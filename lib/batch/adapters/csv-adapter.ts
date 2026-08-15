/**
 * Batch Processing — CSV Upload Adapter
 *
 * Parses a CSV string (from a FileReader result) into ParsedSourceRow[].
 * Uses papaparse for robust CSV handling (quoting, BOM, whitespace, etc.).
 *
 * Header names are passed through as-is; the validation layer's column
 * alias lookup normalises them to canonical field names.
 */

import Papa from "papaparse";
import type { DataSourceAdapter, AdapterParseResult, ParsedSourceRow } from "../types";
import { getKnownFieldNames } from "../template-columns";

export class CSVUploadAdapter implements DataSourceAdapter<string> {
  readonly name = "CSV Upload";
  readonly sourceType = "csv" as const;
  readonly fileExtensions = [".csv"];

  async parse(csvString: string, _fileName?: string): Promise<AdapterParseResult> {
    const result = Papa.parse<Record<string, string>>(csvString, {
      header: true,
      skipEmptyLines: true,
      // Normalise header names by trimming whitespace
      transformHeader: (h: string) => h.trim(),
      // Default to comma; auto-detect fails on single-column files
      delimiter: ",",
      transform: (value: string) => value.trim(),
    });

    const warnings: AdapterParseResult["warnings"] = [];
    const errors: AdapterParseResult["errors"] = [];

    // Surface papaparse parse errors as adapter errors/warnings
    for (const err of result.errors ?? []) {
      if (err.type === "Quotes") {
        errors.push({ rowIndex: err.row ?? 0, message: err.message });
      } else {
        // Delimiter detection issues, etc. — non-fatal
        warnings.push({ rowIndex: err.row ?? 0, field: err.type, message: err.message });
      }
    }

    const headers: string[] = result.meta?.fields ?? [];
    const knownFields = getKnownFieldNames();

    const unmappedColumns = headers.filter(
      (h) => !knownFields.has(h.toLowerCase()) && h !== ""
    );

    const rows: ParsedSourceRow[] = (result.data ?? []).map((record, index) => {
      const row: ParsedSourceRow = {
        _rowIndex: index,
        _sourceFields: headers,
      };
      for (const [key, value] of Object.entries(record)) {
        if (key) row[key] = value === "" ? undefined : value;
      }
      return row;
    });
    // PapaParse may report a malformed source row without returning a data
    // object for it. Use the highest reported row index as a lower bound so
    // that row remains visible in the receipt instead of disappearing.
    const highestReportedRow = (result.errors ?? []).reduce(
      (highest, error) => Math.max(highest, error.row ?? -1),
      -1
    );

    return {
      sourceRecordCount: Math.max(result.data?.length ?? 0, highestReportedRow + 1),
      rows,
      warnings,
      errors,
      detectedColumns: headers,
      unmappedColumns,
    };
  }
}
