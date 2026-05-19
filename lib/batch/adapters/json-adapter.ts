/**
 * Batch Processing — JSON Upload Adapter
 *
 * Parses a JSON string containing an array of objects into ParsedSourceRow[].
 * Accepts two shapes:
 *   - Array of objects:  [{ hpvResult: "NOT_DETECTED", ... }, ...]
 *   - Wrapper object:    { cases: [...] }  or  { data: [...] }  or  { rows: [...] }
 */

import type { DataSourceAdapter, AdapterParseResult, ParsedSourceRow } from "../types";
import { getKnownFieldNames } from "../template-columns";

export class JSONUploadAdapter implements DataSourceAdapter<string> {
  readonly name = "JSON Upload";
  readonly sourceType = "json" as const;
  readonly fileExtensions = [".json"];

  async parse(jsonString: string, _fileName?: string): Promise<AdapterParseResult> {
    const warnings: AdapterParseResult["warnings"] = [];
    const errors: AdapterParseResult["errors"] = [];

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonString);
    } catch (e) {
      errors.push({ rowIndex: 0, message: `Invalid JSON: ${e instanceof Error ? e.message : String(e)}` });
      return { rows: [], warnings, errors, detectedColumns: [], unmappedColumns: [] };
    }

    // Unwrap common wrapper shapes
    let records: unknown[];
    if (Array.isArray(parsed)) {
      records = parsed;
    } else if (parsed && typeof parsed === "object") {
      const obj = parsed as Record<string, unknown>;
      if (Array.isArray(obj.cases)) records = obj.cases;
      else if (Array.isArray(obj.data)) records = obj.data;
      else if (Array.isArray(obj.rows)) records = obj.rows;
      else {
        errors.push({
          rowIndex: 0,
          message: "JSON must be an array of objects, or an object with a 'cases', 'data', or 'rows' array.",
        });
        return { rows: [], warnings, errors, detectedColumns: [], unmappedColumns: [] };
      }
    } else {
      errors.push({ rowIndex: 0, message: "JSON root must be an array or object." });
      return { rows: [], warnings, errors, detectedColumns: [], unmappedColumns: [] };
    }

    if (records.length === 0) {
      warnings.push({ rowIndex: 0, field: "_root", message: "JSON array is empty." });
      return { rows: [], warnings, errors, detectedColumns: [], unmappedColumns: [] };
    }

    // Collect all keys across all records to detect columns
    const columnSet = new Set<string>();
    for (const rec of records) {
      if (rec && typeof rec === "object" && !Array.isArray(rec)) {
        for (const key of Object.keys(rec as object)) columnSet.add(key);
      }
    }
    const detectedColumns = Array.from(columnSet).filter((k) => !k.startsWith("_"));
    const knownFields = getKnownFieldNames();
    const unmappedColumns = detectedColumns.filter((k) => !knownFields.has(k.toLowerCase()));

    const rows: ParsedSourceRow[] = [];
    for (let i = 0; i < records.length; i++) {
      const rec = records[i];
      if (!rec || typeof rec !== "object" || Array.isArray(rec)) {
        warnings.push({ rowIndex: i, field: "_type", message: `Row ${i + 1} is not an object — skipped.` });
        continue;
      }
      const row: ParsedSourceRow = {
        _rowIndex: i,
        _sourceFields: detectedColumns,
        ...(rec as Record<string, unknown>),
      };
      rows.push(row);
    }

    return { rows, warnings, errors, detectedColumns, unmappedColumns };
  }
}
