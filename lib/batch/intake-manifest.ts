import type {
  AdapterParseResult,
  IntakeParseManifest,
  ParseError,
  ParseWarning,
} from "@/lib/batch/types";

const MAX_DIAGNOSTICS = 200;
const MAX_COLUMNS = 200;
const MAX_TEXT = 500;

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, MAX_TEXT) : "";
}

function cleanCount(value: unknown, field: string): number {
  if (!Number.isInteger(value) || Number(value) < 0 || Number(value) > 1_000) {
    throw new Error(`${field} must be an integer between 0 and 1,000.`);
  }
  return Number(value);
}

function cleanWarnings(value: unknown): ParseWarning[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_DIAGNOSTICS).map((entry) => {
    const item = entry && typeof entry === "object" ? entry as Record<string, unknown> : {};
    return {
      rowIndex: cleanCount(item.rowIndex ?? 0, "warning rowIndex"),
      field: cleanText(item.field) || "_row",
      message: cleanText(item.message) || "Unspecified parse warning.",
    };
  });
}

function cleanErrors(value: unknown): ParseError[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_DIAGNOSTICS).map((entry) => {
    const item = entry && typeof entry === "object" ? entry as Record<string, unknown> : {};
    const field = cleanText(item.field);
    return {
      rowIndex: cleanCount(item.rowIndex ?? 0, "error rowIndex"),
      ...(field ? { field } : {}),
      message: cleanText(item.message) || "Unspecified parse error.",
    };
  });
}

function cleanColumns(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, MAX_COLUMNS)
    .map(cleanText)
    .filter(Boolean);
}

export function manifestFromAdapter(result: AdapterParseResult): IntakeParseManifest {
  return {
    schemaVersion: 1,
    sourceRecordCount: result.sourceRecordCount,
    parsedRecordCount: result.rows.length,
    skippedRecordCount: Math.max(0, result.sourceRecordCount - result.rows.length),
    preparedRecordCount: result.rows.length,
    warnings: result.warnings,
    errors: result.errors,
    detectedColumns: result.detectedColumns,
    unmappedColumns: result.unmappedColumns,
  };
}

/** Validate and bound the manifest before it crosses the persistence boundary. */
export function normalizeIntakeParseManifest(
  value: unknown,
  expectedPreparedRecords: number
): IntakeParseManifest {
  if (!value || typeof value !== "object") {
    throw new Error("A parse manifest is required for this intake.");
  }
  const item = value as Record<string, unknown>;
  if (item.schemaVersion !== 1) {
    throw new Error("Unsupported parse manifest version.");
  }

  const manifest: IntakeParseManifest = {
    schemaVersion: 1,
    sourceRecordCount: cleanCount(item.sourceRecordCount, "sourceRecordCount"),
    parsedRecordCount: cleanCount(item.parsedRecordCount, "parsedRecordCount"),
    skippedRecordCount: cleanCount(item.skippedRecordCount, "skippedRecordCount"),
    preparedRecordCount: cleanCount(item.preparedRecordCount, "preparedRecordCount"),
    warnings: cleanWarnings(item.warnings),
    errors: cleanErrors(item.errors),
    detectedColumns: cleanColumns(item.detectedColumns),
    unmappedColumns: cleanColumns(item.unmappedColumns),
  };

  if (manifest.sourceRecordCount !== manifest.parsedRecordCount + manifest.skippedRecordCount) {
    throw new Error("Parse manifest does not reconcile source, parsed, and skipped records.");
  }
  if (manifest.preparedRecordCount !== expectedPreparedRecords) {
    throw new Error("Parse manifest does not reconcile the rows prepared for processing.");
  }
  return manifest;
}
