import { z } from "zod";

import {
  CANONICAL_CLINICAL_FACTS_V2_SCHEMA_ID,
  CanonicalClinicalFactsV2Schema,
  CanonicalFactSourceSchema,
  CanonicalFactStatusSchema,
  CanonicalFactVerificationStatusSchema,
  type CanonicalClinicalFactsV2,
} from "@/lib/clinical-rules/canonical-facts-v2";

export const CANONICAL_V2_BATCH_SCHEMA_ID =
  "cervigrade-canonical-facts-batch-v2" as const;

const BatchFactValueTypeSchema = z.enum(["STRING", "NUMBER", "BOOLEAN"]);

export const CanonicalV2BatchFactRowSchema = z.object({
  schema_id: z.literal(CANONICAL_V2_BATCH_SCHEMA_ID),
  subject_reference: z.string().trim().min(1),
  captured_at: z.string().datetime(),
  fact_name: z.string().trim().min(1).max(160),
  fact_value: z.string().optional().default(""),
  value_type: BatchFactValueTypeSchema.optional(),
  status: CanonicalFactStatusSchema,
  source: CanonicalFactSourceSchema,
  observed_at: z.string().datetime().optional().or(z.literal("")),
  recorded_at: z.string().datetime(),
  entered_by: z.string().trim().min(1),
  verified_by: z.string().trim().optional().default(""),
  verification_status: CanonicalFactVerificationStatusSchema,
  source_document_id: z.string().trim().optional().default(""),
  external_reference: z.string().trim().optional().default(""),
});
export type CanonicalV2BatchFactRow = z.infer<
  typeof CanonicalV2BatchFactRowSchema
>;

function parseValue(row: CanonicalV2BatchFactRow) {
  if (row.status !== "KNOWN") return undefined;
  if (!row.value_type) {
    throw new Error(`${row.fact_name}: KNOWN facts require value_type.`);
  }
  if (row.fact_value === "") {
    throw new Error(`${row.fact_name}: KNOWN facts require fact_value.`);
  }
  if (row.value_type === "STRING") return row.fact_value;
  if (row.value_type === "BOOLEAN") {
    if (!/^(true|false)$/i.test(row.fact_value)) {
      throw new Error(`${row.fact_name}: BOOLEAN values must be true or false.`);
    }
    return row.fact_value.toLowerCase() === "true";
  }
  const number = Number(row.fact_value);
  if (!Number.isFinite(number)) {
    throw new Error(`${row.fact_name}: NUMBER value is not finite.`);
  }
  return number;
}

export type CanonicalV2BatchValidationError = {
  rowNumber: number;
  subjectReference?: string;
  factName?: string;
  message: string;
};

export function buildCanonicalFactsV2FromBatchRows(
  rows: unknown[]
): {
  cases: CanonicalClinicalFactsV2[];
  errors: CanonicalV2BatchValidationError[];
} {
  const errors: CanonicalV2BatchValidationError[] = [];
  const parsedRows: Array<{ row: CanonicalV2BatchFactRow; rowNumber: number }> = [];
  rows.forEach((candidate, index) => {
    const parsed = CanonicalV2BatchFactRowSchema.safeParse(candidate);
    if (!parsed.success) {
      errors.push({
        rowNumber: index + 2,
        subjectReference:
          typeof candidate === "object" && candidate
            ? String((candidate as Record<string, unknown>).subject_reference ?? "")
            : undefined,
        factName:
          typeof candidate === "object" && candidate
            ? String((candidate as Record<string, unknown>).fact_name ?? "")
            : undefined,
        message: parsed.error.issues.map((issue) => issue.message).join("; "),
      });
      return;
    }
    parsedRows.push({ row: parsed.data, rowNumber: index + 2 });
  });

  const groups = new Map<string, typeof parsedRows>();
  for (const item of parsedRows) {
    const current = groups.get(item.row.subject_reference) ?? [];
    current.push(item);
    groups.set(item.row.subject_reference, current);
  }

  const cases: CanonicalClinicalFactsV2[] = [];
  for (const [subjectReference, items] of groups) {
    const capturedAt = new Set(items.map((item) => item.row.captured_at));
    if (capturedAt.size !== 1) {
      errors.push({
        rowNumber: items[0].rowNumber,
        subjectReference,
        message: "All fact rows for a subject must share one captured_at value.",
      });
      continue;
    }
    const facts: CanonicalClinicalFactsV2["facts"] = {};
    let invalid = false;
    for (const item of items) {
      const row = item.row;
      if (facts[row.fact_name]) {
        errors.push({
          rowNumber: item.rowNumber,
          subjectReference,
          factName: row.fact_name,
          message: "Duplicate fact name for subject.",
        });
        invalid = true;
        continue;
      }
      try {
        const value = parseValue(row);
        facts[row.fact_name] = {
          ...(value === undefined ? {} : { value }),
          status: row.status,
          source: row.source,
          ...(row.observed_at ? { observedAt: row.observed_at } : {}),
          recordedAt: row.recorded_at,
          enteredBy: row.entered_by,
          ...(row.verified_by ? { verifiedBy: row.verified_by } : {}),
          verificationStatus: row.verification_status,
          ...(row.source_document_id
            ? { sourceDocumentId: row.source_document_id }
            : {}),
          ...(row.external_reference
            ? { externalReference: row.external_reference }
            : {}),
          corrections: [],
        };
      } catch (error) {
        errors.push({
          rowNumber: item.rowNumber,
          subjectReference,
          factName: row.fact_name,
          message: error instanceof Error ? error.message : String(error),
        });
        invalid = true;
      }
    }
    if (invalid) continue;
    const parsed = CanonicalClinicalFactsV2Schema.safeParse({
      schemaId: CANONICAL_CLINICAL_FACTS_V2_SCHEMA_ID,
      subjectReference,
      capturedAt: [...capturedAt][0],
      facts,
    });
    if (!parsed.success) {
      errors.push({
        rowNumber: items[0].rowNumber,
        subjectReference,
        message: parsed.error.issues.map((issue) => issue.message).join("; "),
      });
      continue;
    }
    cases.push(parsed.data);
  }

  return { cases, errors };
}

export function protectCsvCell(value: string) {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}
