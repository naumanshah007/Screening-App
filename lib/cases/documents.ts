import { randomUUID } from "node:crypto";
import path from "node:path";
import { Readable } from "node:stream";
import { Prisma, type DocumentType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  ALLOWED_DOCUMENT_MIME_TYPES,
  MAX_DOCUMENT_UPLOAD_BYTES,
} from "@/lib/cases/document-types";
import { documentStorage } from "@/lib/documents/storage";

const referralDocumentInclude = {
  uploadedBy: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  },
} satisfies Prisma.ReferralDocumentInclude;

export type ReferralDocumentRecord = Prisma.ReferralDocumentGetPayload<{
  include: typeof referralDocumentInclude;
}>;

function sanitizeFileName(fileName: string): string {
  const normalized = path.basename(fileName).replace(/\s+/g, "-");
  const safe = normalized.replace(/[^A-Za-z0-9._-]/g, "");
  return safe || "document";
}

function inferExtension(fileName: string, mimeType: string): string {
  const extension = path.extname(fileName).toLowerCase();
  if (extension) return extension;

  switch (mimeType) {
    case "application/pdf":
      return ".pdf";
    case "image/jpeg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/tiff":
      return ".tiff";
    case "image/webp":
      return ".webp";
    default:
      return "";
  }
}

function inferMimeType(fileName: string, mimeType: string): string {
  if (mimeType) return mimeType;

  const extension = path.extname(fileName).toLowerCase();
  switch (extension) {
    case ".pdf":
      return "application/pdf";
    case ".jpg":
    case ".jpeg":
    case ".jfif":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".tif":
    case ".tiff":
      return "image/tiff";
    case ".webp":
      return "image/webp";
    default:
      return mimeType;
  }
}

export function validateDocumentUpload(file: File, normalizedMimeType: string) {
  if (!ALLOWED_DOCUMENT_MIME_TYPES.has(normalizedMimeType)) {
    throw new Error("Unsupported file type");
  }
  if (file.size === 0) {
    throw new Error("Uploaded file is empty");
  }
  if (file.size > MAX_DOCUMENT_UPLOAD_BYTES) {
    throw new Error("File exceeds 20 MB limit");
  }
}

export async function listReferralDocuments(caseId: string) {
  return prisma.referralDocument.findMany({
    where: { caseId },
    include: referralDocumentInclude,
    orderBy: [{ createdAt: "desc" }],
  });
}

export async function getReferralDocumentById(caseId: string, documentId: string) {
  return prisma.referralDocument.findFirst({
    where: {
      id: documentId,
      caseId,
    },
    include: referralDocumentInclude,
  });
}

async function streamToBuffer(stream: Readable) {
  const chunks: Buffer[] = [];

  for await (const chunk of stream) {
    if (typeof chunk === "string") {
      chunks.push(Buffer.from(chunk));
      continue;
    }

    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

export async function createReferralDocument(args: {
  caseId: string;
  type: DocumentType;
  file: File;
  uploadedByUserId?: string;
}) {
  const { caseId, type, file, uploadedByUserId } = args;

  const referralCase = await prisma.referralCase.findUnique({
    where: { id: caseId },
    select: { id: true },
  });

  if (!referralCase) {
    throw new Error("Referral case not found");
  }

  const arrayBuffer = await file.arrayBuffer();
  const fileBuffer = Buffer.from(arrayBuffer);
  const safeName = sanitizeFileName(file.name);
  const normalizedMimeType = inferMimeType(safeName, file.type);

  validateDocumentUpload(file, normalizedMimeType);

  const extension = inferExtension(safeName, normalizedMimeType);
  const storageKey = path.posix.join(
    caseId,
    `${Date.now()}-${randomUUID()}${extension}`
  );
  const uploadResult = await documentStorage.upload({
    key: storageKey,
    contentType: normalizedMimeType,
    byteSize: fileBuffer.byteLength,
    stream: Readable.from(fileBuffer),
  });

  if (!uploadResult.ok) {
    throw new Error(
      `Unable to store document via ${documentStorage.providerName}: ${uploadResult.error}`
    );
  }

  try {
    const document = await prisma.referralDocument.create({
      data: {
        caseId,
        type,
        fileName: safeName,
        storageKey: uploadResult.storageKey,
        mimeType: normalizedMimeType,
        byteSize: uploadResult.byteSize,
        uploadedByUserId,
      },
      include: referralDocumentInclude,
    });

    await prisma.auditLog.create({
      data: {
        userId: uploadedByUserId,
        action: "CREATE",
        entity: "ReferralDocument",
        entityId: document.id,
        newValue: JSON.stringify({
          caseId,
          type: document.type,
          fileName: document.fileName,
          storageKey: document.storageKey,
          byteSize: document.byteSize,
          storageProvider: documentStorage.providerName,
        }),
      },
    });

    return document;
  } catch (error) {
    await documentStorage.delete(uploadResult.storageKey).catch(() => undefined);
    throw error;
  }
}

export async function getStoredReferralDocument(args: {
  caseId: string;
  documentId: string;
}) {
  const document = await getReferralDocumentById(args.caseId, args.documentId);
  if (!document) {
    return null;
  }

  const downloadResult = await documentStorage.download(document.storageKey);
  if (!downloadResult.ok) {
    return null;
  }

  const fileBuffer = await streamToBuffer(downloadResult.stream);
  return { document, fileBuffer };
}

export async function recordReferralDocumentRead(
  documentId: string,
  actorUserId?: string
) {
  await prisma.auditLog.create({
    data: {
      userId: actorUserId,
      action: "READ",
      entity: "ReferralDocument",
      entityId: documentId,
    },
  });
}
