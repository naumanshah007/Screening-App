import { prisma } from "@/lib/prisma";

export async function countCaseFacts(caseId: string) {
  return prisma.extractedFact.count({
    where: { caseId },
  });
}

export async function listCaseFacts(caseId: string) {
  return prisma.extractedFact.findMany({
    where: { caseId },
    include: {
      documentPage: {
        select: {
          id: true,
          pageNumber: true,
          extractedText: true,
          document: {
            select: {
              id: true,
              fileName: true,
              type: true,
              mimeType: true,
              ocrStatus: true,
              parseStatus: true,
              createdAt: true,
            },
          },
        },
      },
    },
    orderBy: [{ createdAt: "desc" }],
  });
}

export async function listCaseEvidenceDocuments(caseId: string) {
  return prisma.referralDocument.findMany({
    where: { caseId },
    include: {
      pages: {
        orderBy: { pageNumber: "asc" },
        include: {
          facts: {
            orderBy: { createdAt: "desc" },
          },
        },
      },
    },
    orderBy: [{ createdAt: "desc" }],
  });
}
