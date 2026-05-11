import { execFile } from "node:child_process";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { PDFParse } from "pdf-parse";
import { prisma } from "@/lib/prisma";
import {
  getReferralDocumentById,
  getStoredReferralDocument,
  recordReferralDocumentRead,
} from "@/lib/cases/documents";
import { extractFactsFromText } from "@/lib/cases/fact-extraction";

type IngestedPage = {
  pageNumber: number;
  extractedText: string;
};

type ExtractionResult = {
  pages: IngestedPage[];
  pageCount: number;
  ocrStatus: "COMPLETE" | "FAILED";
  parseStatus: "COMPLETE" | "FAILED";
};

const execFileAsync = promisify(execFile);
const OCR_LANGUAGE = process.env.OCR_LANGUAGE?.trim() || "eng";
const TESSERACT_BINARY = process.env.TESSERACT_BINARY?.trim() || "tesseract";
const PDFTOPPM_BINARY = process.env.PDFTOPPM_BINARY?.trim() || "pdftoppm";
const EMPTY_PAGE_FALLBACK = "No readable text could be extracted from this page.";

function normalizeText(text: string) {
  return text.replace(/\u0000/g, " ").replace(/\r\n/g, "\n").trim();
}

function hasMeaningfulText(text: string) {
  return normalizeText(text).replace(/[^A-Za-z0-9]+/g, "").length >= 20;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Unknown error";
}

async function runTesseract(imagePath: string) {
  try {
    const { stdout } = await execFileAsync(
      TESSERACT_BINARY,
      [imagePath, "stdout", "-l", OCR_LANGUAGE, "--psm", "6"],
      {
        maxBuffer: 16 * 1024 * 1024,
      }
    );

    return normalizeText(String(stdout)) || EMPTY_PAGE_FALLBACK;
  } catch (error) {
    throw new Error(`Tesseract OCR failed: ${getErrorMessage(error)}`);
  }
}

function extensionForMimeType(mimeType: string) {
  switch (mimeType) {
    case "image/jpeg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/tiff":
      return ".tiff";
    case "image/webp":
      return ".webp";
    case "application/pdf":
      return ".pdf";
    default:
      return ".bin";
  }
}

async function extractPagesFromImage(args: {
  buffer: Buffer;
  mimeType: string;
}): Promise<ExtractionResult> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "case-image-ocr-"));

  try {
    const imagePath = path.join(tempDir, `image${extensionForMimeType(args.mimeType)}`);
    await writeFile(imagePath, args.buffer);

    return {
      pages: [
        {
          pageNumber: 1,
          extractedText: await runTesseract(imagePath),
        },
      ],
      pageCount: 1,
      ocrStatus: "COMPLETE",
      parseStatus: "COMPLETE",
    };
  } catch (error) {
    return {
      pages: [
        {
          pageNumber: 1,
          extractedText: `Image document stored successfully, but OCR failed: ${getErrorMessage(
            error
          )}`,
        },
      ],
      pageCount: 1,
      ocrStatus: "FAILED",
      parseStatus: "FAILED",
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function renderPdfPagesWithOcr(
  buffer: Buffer,
  pageNumbers?: Set<number>
) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "case-pdf-ocr-"));

  try {
    const pdfPath = path.join(tempDir, "document.pdf");
    const outputPrefix = path.join(tempDir, "page");

    await writeFile(pdfPath, buffer);
    await execFileAsync(PDFTOPPM_BINARY, ["-png", pdfPath, outputPrefix], {
      maxBuffer: 16 * 1024 * 1024,
    });

    const files = (await readdir(tempDir))
      .filter((fileName) => /^page-\d+\.png$/i.test(fileName))
      .sort((left, right) => {
        const leftPage = Number.parseInt(left.match(/\d+/)?.[0] ?? "0", 10);
        const rightPage = Number.parseInt(right.match(/\d+/)?.[0] ?? "0", 10);
        return leftPage - rightPage;
      });

    if (files.length === 0) {
      throw new Error("PDF OCR fallback rendered no page images");
    }

    const ocrPages = new Map<number, string>();

    for (const fileName of files) {
      const pageNumber = Number.parseInt(fileName.match(/\d+/)?.[0] ?? "0", 10);
      if (!pageNumber || (pageNumbers && !pageNumbers.has(pageNumber))) {
        continue;
      }

      const imagePath = path.join(tempDir, fileName);
      const extractedText = await runTesseract(imagePath);
      ocrPages.set(pageNumber, extractedText);
    }

    return ocrPages;
  } catch (error) {
    throw new Error(`PDF OCR fallback failed: ${getErrorMessage(error)}`);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

function buildPdfPages(args: {
  pageCount: number;
  parsedTextByPage: Map<number, string>;
  ocrTextByPage?: Map<number, string>;
}) {
  const pages: IngestedPage[] = [];

  for (let pageNumber = 1; pageNumber <= args.pageCount; pageNumber += 1) {
    const parsedText = args.parsedTextByPage.get(pageNumber) ?? "";
    const ocrText = args.ocrTextByPage?.get(pageNumber) ?? "";

    pages.push({
      pageNumber,
      extractedText: hasMeaningfulText(parsedText)
        ? parsedText
        : normalizeText(ocrText) || normalizeText(parsedText) || EMPTY_PAGE_FALLBACK,
    });
  }

  return pages;
}

async function extractPagesFromPdfUsingOcrOnly(
  buffer: Buffer,
  parseError?: unknown
): Promise<ExtractionResult> {
  try {
    const ocrPages = await renderPdfPagesWithOcr(buffer);
    const pages = [...ocrPages.entries()].map(([pageNumber, extractedText]) => ({
      pageNumber,
      extractedText,
    }));

    return {
      pages,
      pageCount: pages.length,
      ocrStatus: "COMPLETE",
      parseStatus: "COMPLETE",
    };
  } catch (ocrError) {
    const parseMessage = parseError
      ? `PDF text extraction failed: ${getErrorMessage(parseError)}`
      : "PDF text extraction failed";
    throw new Error(`${parseMessage}. OCR fallback failed: ${getErrorMessage(ocrError)}`);
  }
}

async function extractPagesFromPdf(buffer: Buffer): Promise<ExtractionResult> {
  const parser = new PDFParse({ data: buffer });

  try {
    const parsed = await parser.getText();
    const rawPages =
      parsed.pages.length > 0
        ? parsed.pages.map((page) => ({
            pageNumber: page.num,
            extractedText: normalizeText(page.text),
          }))
        : [
            {
              pageNumber: 1,
              extractedText: normalizeText(parsed.text ?? ""),
            },
          ];

    const pageCount = Math.max(parsed.total ?? rawPages.length, rawPages.length, 1);
    const parsedTextByPage = new Map(
      rawPages.map((page) => [page.pageNumber, page.extractedText])
    );
    const missingPageNumbers = new Set<number>();

    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      const extractedText = parsedTextByPage.get(pageNumber) ?? "";
      if (!hasMeaningfulText(extractedText)) {
        missingPageNumbers.add(pageNumber);
      }
    }

    if (missingPageNumbers.size === 0) {
      return {
        pages: buildPdfPages({
          pageCount,
          parsedTextByPage,
        }),
        pageCount,
        ocrStatus: "COMPLETE",
        parseStatus: "COMPLETE",
      };
    }

    try {
      const ocrTextByPage = await renderPdfPagesWithOcr(buffer, missingPageNumbers);

      return {
        pages: buildPdfPages({
          pageCount,
          parsedTextByPage,
          ocrTextByPage,
        }),
        pageCount,
        ocrStatus: "COMPLETE",
        parseStatus: "COMPLETE",
      };
    } catch (ocrError) {
      const pages = buildPdfPages({
        pageCount,
        parsedTextByPage,
      });
      const hasAnyMeaningfulPage = pages.some((page) =>
        hasMeaningfulText(page.extractedText)
      );

      if (!hasAnyMeaningfulPage) {
        return {
          pages: pages.map((page) => ({
            ...page,
            extractedText: `${EMPTY_PAGE_FALLBACK} OCR fallback failed: ${getErrorMessage(
              ocrError
            )}`,
          })),
          pageCount,
          ocrStatus: "FAILED",
          parseStatus: "FAILED",
        };
      }

      return {
        pages: pages.map((page) => ({
          ...page,
          extractedText:
            page.extractedText === EMPTY_PAGE_FALLBACK
              ? `${EMPTY_PAGE_FALLBACK} OCR fallback failed: ${getErrorMessage(
                  ocrError
                )}`
              : page.extractedText,
        })),
        pageCount,
        ocrStatus: "FAILED",
        parseStatus: "COMPLETE",
      };
    }
  } catch (parseError) {
    return extractPagesFromPdfUsingOcrOnly(buffer, parseError);
  } finally {
    await parser.destroy();
  }
}

export async function ingestReferralDocument(args: {
  caseId: string;
  documentId: string;
  actorUserId?: string;
}) {
  const { caseId, documentId, actorUserId } = args;

  const document = await getReferralDocumentById(caseId, documentId);
  if (!document) {
    throw new Error("Document not found");
  }

  await prisma.referralDocument.update({
    where: { id: document.id },
    data: {
      ocrStatus: "PROCESSING",
      parseStatus: "PROCESSING",
    },
  });

  try {
    await recordReferralDocumentRead(document.id, actorUserId);

    const stored = await getStoredReferralDocument({ caseId, documentId });

    if (!stored) {
      throw new Error("Stored file not found");
    }

    const extraction =
      document.mimeType === "application/pdf"
        ? await extractPagesFromPdf(stored.fileBuffer)
        : await extractPagesFromImage({
            buffer: stored.fileBuffer,
            mimeType: document.mimeType,
          });

    await prisma.$transaction(async (tx) => {
      await tx.extractedFact.deleteMany({
        where: {
          documentPage: {
            documentId: document.id,
          },
        },
      });

      await tx.documentPage.deleteMany({
        where: { documentId: document.id },
      });

      for (const page of extraction.pages) {
        const createdPage = await tx.documentPage.create({
          data: {
            documentId: document.id,
            pageNumber: page.pageNumber,
            extractedText: page.extractedText,
          },
        });

        const facts =
          extraction.parseStatus === "FAILED"
            ? []
            : extractFactsFromText(page.extractedText);

        if (facts.length > 0) {
          await tx.extractedFact.createMany({
            data: facts.map((fact) => ({
              caseId,
              documentPageId: createdPage.id,
              factType: fact.factType,
              label: fact.label,
              valueText: fact.valueText,
              valueNumber: fact.valueNumber,
              confidence: fact.confidence,
              sourceQuote: fact.sourceQuote,
            })),
          });
        }
      }

      await tx.referralDocument.update({
        where: { id: document.id },
        data: {
          ocrStatus: extraction.ocrStatus,
          parseStatus: extraction.parseStatus,
          pageCount: extraction.pageCount,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: actorUserId,
          action: "INGEST",
          entity: "ReferralDocument",
          entityId: document.id,
          newValue: JSON.stringify({
            caseId,
            pageCount: extraction.pageCount,
            ocrStatus: extraction.ocrStatus,
            parseStatus: extraction.parseStatus,
          }),
        },
      });
    });

    return prisma.referralDocument.findUnique({
      where: { id: document.id },
      include: {
        pages: {
          include: {
            facts: true,
          },
          orderBy: { pageNumber: "asc" },
        },
      },
    });
  } catch (error) {
    await prisma.referralDocument.update({
      where: { id: document.id },
      data: {
        ocrStatus: "FAILED",
        parseStatus: "FAILED",
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: actorUserId,
        action: "INGEST_FAILED",
        entity: "ReferralDocument",
        entityId: document.id,
        newValue: JSON.stringify({
          caseId,
          error: error instanceof Error ? error.message : "Unknown ingest error",
        }),
      },
    });

    throw error;
  }
}
