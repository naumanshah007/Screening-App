import type { DocumentType } from "@prisma/client";

export const DOCUMENT_TYPES = [
  "REFERRAL",
  "CLINIC_LETTER",
  "DISCHARGE_SUMMARY",
  "LAB_RESULT",
  "RADIOLOGY",
  "OTHER",
] as const satisfies readonly DocumentType[];

export const ALLOWED_DOCUMENT_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/tiff",
  "image/webp",
]);

export const MAX_DOCUMENT_UPLOAD_BYTES = 20 * 1024 * 1024;

export function isDocumentType(value: unknown): value is DocumentType {
  return (
    typeof value === "string" &&
    DOCUMENT_TYPES.includes(value as (typeof DOCUMENT_TYPES)[number])
  );
}
