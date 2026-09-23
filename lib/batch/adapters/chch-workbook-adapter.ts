/**
 * The CHCH workbook importer.
 *
 * WHY THIS EXISTS RATHER THAN THE GENERIC XLSX ADAPTER
 * ----------------------------------------------------
 * `ExcelUploadAdapter` expects a header on row 1. The CHCH workbook has its
 * header on row 3, with data in `Sheet1!A4:I33`. Feeding this workbook to the
 * generic adapter does not produce these 30 cases, and claiming that uploading
 * it is equivalent to "pulling CHCH" was not true.
 *
 * WHAT THIS DOES DIFFERENTLY
 * --------------------------
 *  1. It verifies the schema instead of guessing it: the sheet name, the header
 *     row, and every expected column heading.
 *  2. It preserves the exact cell text, and records the cell each value came
 *     from, so a reviewer can open the workbook at `Sheet1!E4` and check.
 *  3. It REJECTS a malformed row rather than repairing it. A row missing its
 *     HPV result is an error, not a case with an unknown HPV result, because a
 *     silent repair is indistinguishable from data that was never there.
 *  4. It inserts NO clinical defaults. Nothing here supplies a sample type, an
 *     immune status or a repeat stage to make a rule fire — that is the exact
 *     failure the frozen fixture was rebuilt to remove.
 *
 * It does NOT replace `CHCH_SOURCE_EVIDENCE`. The frozen fixture remains the
 * oracle until `assertEquivalentToFrozenFixture` passes against the real
 * workbook, which requires the workbook itself.
 */

import ExcelJS from "exceljs";
import { createHash } from "node:crypto";

import {
  CHCH_SOURCE_COLUMNS,
  type CaseSourceEvidence,
  type SourceField,
} from "@/lib/batch/source-evidence";
import {
  CHCH_MAPPING_VERSION,
  CHCH_SOURCE_SHA256,
  CHCH_SOURCE_SHEET,
} from "@/lib/batch/chch-source-records";

/**
 * The exact header text each column carries on row 3 of the CHCH workbook.
 *
 * Compared case-insensitively after collapsing whitespace, so a re-export that
 * changes spacing still imports, but a DIFFERENT workbook does not. These are
 * the literals as the current workbook states them, not guesses.
 */
const EXPECTED_HEADERS: Record<SourceField, string> = {
  caseId: "patient id",
  patientName: "patient",
  age: "age",
  screenCircumstance: "screen / circumstance",
  hpvResult: "hpv result",
  cytologyFollowUp: "cytology / follow-up",
  relevantHistory: "relevant history / context",
};

function normaliseHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export const CHCH_HEADER_ROW = 3;
export const CHCH_FIRST_DATA_ROW = 4;
export const CHCH_LAST_DATA_ROW = 33;

export type ChchImportIssue = {
  /** The worksheet row, never the case ordinal. */
  row: number;
  field?: SourceField | "sheet" | "header";
  message: string;
};

export type ChchImportResult = {
  /** Rows that passed validation, in worksheet order. */
  rows: Array<
    Pick<
      CaseSourceEvidence,
      "caseId" | "patientName" | "age" | "screenCircumstanceText" |
      "hpvResultText" | "cytologyFollowUpText" | "relevantHistoryText"
    > & { worksheetRow: number; cells: Record<SourceField, string> }
  >;
  /** Rows rejected, and why. A rejected row is never partially imported. */
  rejected: ChchImportIssue[];
  errors: ChchImportIssue[];
  /** SHA-256 of the uploaded file. */
  documentSha256: string;
  /** True when the upload is byte-identical to the workbook the fixture came from. */
  matchesKnownWorkbook: boolean;
  sheet: string;
  mappingVersion: string;
};

function columnIndex(field: SourceField): number {
  // "A" → 1, as ExcelJS numbers columns.
  return CHCH_SOURCE_COLUMNS[field].charCodeAt(0) - 64;
}

/** Exact cell text. No coercion, no trimming beyond the surrounding whitespace. */
function cellText(row: ExcelJS.Row, field: SourceField): string {
  const value = row.getCell(columnIndex(field)).value;
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && value !== null && "richText" in value) {
    return (value.richText as Array<{ text: string }>).map((part) => part.text).join("").trim();
  }
  if (typeof value === "object" && value !== null && "text" in value) {
    return String((value as { text: unknown }).text).trim();
  }
  return String(value).trim();
}

export async function importChchWorkbook(
  buffer: ArrayBuffer | Buffer
): Promise<ChchImportResult> {
  const nodeBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const documentSha256 = createHash("sha256").update(nodeBuffer).digest("hex");

  const workbook = new ExcelJS.Workbook();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await workbook.xlsx.load(nodeBuffer as any);

  const errors: ChchImportIssue[] = [];
  const rejected: ChchImportIssue[] = [];
  const rows: ChchImportResult["rows"] = [];

  const sheet = workbook.getWorksheet(CHCH_SOURCE_SHEET);
  if (!sheet) {
    errors.push({
      row: 0,
      field: "sheet",
      message: `The workbook has no sheet named "${CHCH_SOURCE_SHEET}". This importer accepts the CHCH schema only and does not guess a data sheet.`,
    });
    return {
      rows, rejected, errors, documentSha256,
      matchesKnownWorkbook: documentSha256 === CHCH_SOURCE_SHA256,
      sheet: CHCH_SOURCE_SHEET, mappingVersion: CHCH_MAPPING_VERSION,
    };
  }

  // ── Verify the header, on row 3 ──────────────────────────────────────────
  const headerRow = sheet.getRow(CHCH_HEADER_ROW);
  for (const field of Object.keys(EXPECTED_HEADERS) as SourceField[]) {
    const actual = normaliseHeader(cellText(headerRow, field));
    if (actual !== EXPECTED_HEADERS[field]) {
      errors.push({
        row: CHCH_HEADER_ROW,
        field: "header",
        message:
          `Column ${CHCH_SOURCE_COLUMNS[field]} on row ${CHCH_HEADER_ROW} reads "${cellText(headerRow, field)}", ` +
          `but the CHCH schema expects "${EXPECTED_HEADERS[field]}". The schema was not confirmed, so nothing was imported.`,
      });
    }
  }
  if (errors.length > 0) {
    return {
      rows, rejected, errors, documentSha256,
      matchesKnownWorkbook: documentSha256 === CHCH_SOURCE_SHA256,
      sheet: sheet.name, mappingVersion: CHCH_MAPPING_VERSION,
    };
  }

  // ── Read the data rows ───────────────────────────────────────────────────
  const seen = new Set<string>();
  for (let rowNumber = CHCH_FIRST_DATA_ROW; rowNumber <= CHCH_LAST_DATA_ROW; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const cells = Object.fromEntries(
      (Object.keys(CHCH_SOURCE_COLUMNS) as SourceField[]).map((field) => [
        field,
        cellText(row, field),
      ])
    ) as Record<SourceField, string>;

    // Entirely blank rows are skipped silently; partially blank rows are not.
    if (Object.values(cells).every((value) => value === "")) continue;

    const missing = (Object.keys(CHCH_SOURCE_COLUMNS) as SourceField[]).filter(
      (field) => cells[field] === ""
    );
    if (missing.length > 0) {
      rejected.push({
        row: rowNumber,
        field: missing[0],
        message:
          `Row ${rowNumber} is missing ${missing.join(", ")}. The row is rejected rather than ` +
          `imported with gaps: an absent value repaired into a default is indistinguishable from one that was reported.`,
      });
      continue;
    }

    const age = Number(cells.age);
    if (!Number.isInteger(age) || age <= 0 || age > 120) {
      rejected.push({
        row: rowNumber,
        field: "age",
        message: `Row ${rowNumber} has a non-numeric or implausible age ("${cells.age}").`,
      });
      continue;
    }
    if (seen.has(cells.caseId)) {
      rejected.push({
        row: rowNumber,
        field: "caseId",
        message: `Row ${rowNumber} repeats case ID ${cells.caseId}.`,
      });
      continue;
    }
    seen.add(cells.caseId);

    rows.push({
      caseId: cells.caseId,
      patientName: cells.patientName,
      age,
      screenCircumstanceText: cells.screenCircumstance,
      hpvResultText: cells.hpvResult,
      cytologyFollowUpText: cells.cytologyFollowUp,
      relevantHistoryText: cells.relevantHistory,
      worksheetRow: rowNumber,
      cells,
    });
  }

  return {
    rows,
    rejected,
    errors,
    documentSha256,
    matchesKnownWorkbook: documentSha256 === CHCH_SOURCE_SHA256,
    sheet: sheet.name,
    mappingVersion: CHCH_MAPPING_VERSION,
  };
}

/**
 * Prove an import reproduces the frozen fixture exactly.
 *
 * The fixture stays authoritative until this passes against the real workbook.
 * Swapping the evaluation set for a freshly parsed one without this check would
 * mean the 30 cases in the demonstration are no longer the 30 cases the audit
 * verified.
 */
export function differencesFromFrozenFixture(
  imported: ChchImportResult["rows"],
  frozen: readonly CaseSourceEvidence[]
): string[] {
  const problems: string[] = [];
  if (imported.length !== frozen.length) {
    problems.push(`row count ${imported.length} != frozen ${frozen.length}`);
  }
  for (const expected of frozen) {
    const actual = imported.find((row) => row.caseId === expected.caseId);
    if (!actual) {
      problems.push(`${expected.caseId} missing from the import`);
      continue;
    }
    const checks: Array<[string, string | number | undefined, string | number | undefined]> = [
      ["patientName", actual.patientName, expected.patientName],
      ["age", actual.age, expected.age],
      ["screenCircumstance", actual.screenCircumstanceText, expected.screenCircumstanceText],
      ["hpvResult", actual.hpvResultText, expected.hpvResultText],
      ["cytologyFollowUp", actual.cytologyFollowUpText, expected.cytologyFollowUpText],
      ["relevantHistory", actual.relevantHistoryText, expected.relevantHistoryText],
      ["worksheetRow", actual.worksheetRow, expected.locator?.row],
    ];
    for (const [field, got, want] of checks) {
      if (got !== want) {
        problems.push(`${expected.caseId}.${field}: imported ${JSON.stringify(got)} != frozen ${JSON.stringify(want)}`);
      }
    }
  }
  return problems;
}
