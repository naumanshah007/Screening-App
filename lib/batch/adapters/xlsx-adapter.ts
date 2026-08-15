/**
 * Batch Processing — XLSX Upload Adapter
 *
 * Parses an Excel workbook (as an ArrayBuffer or Buffer) into ParsedSourceRow[].
 * Uses exceljs in read-only mode — no write operations.
 *
 * Reads the first data sheet that has at least one non-empty row.
 * Skips instruction/reference sheets (sheets named "Instructions",
 * "Allowed Values", or "Reference").
 */

import ExcelJS from "exceljs";
import type { DataSourceAdapter, AdapterParseResult, ParsedSourceRow } from "../types";
import { getKnownFieldNames } from "../template-columns";

const SKIP_SHEET_NAMES = new Set(["instructions", "allowed values", "reference", "readme", "notes"]);

function cellToValue(cell: ExcelJS.Cell): unknown {
  const v = cell.value;
  if (v === null || v === undefined) return undefined;
  // Rich text → plain string
  if (typeof v === "object" && "richText" in v) {
    return (v as ExcelJS.CellRichTextValue).richText.map((r) => r.text).join("");
  }
  // Formula → result
  if (typeof v === "object" && "result" in v) {
    return (v as ExcelJS.CellFormulaValue).result ?? undefined;
  }
  // Date → ISO string date part
  if (v instanceof Date) return v.toISOString().split("T")[0];
  return v;
}

export class ExcelUploadAdapter implements DataSourceAdapter<ArrayBuffer | Buffer> {
  readonly name = "Excel Upload";
  readonly sourceType = "xlsx" as const;
  readonly fileExtensions = [".xlsx", ".xls"];

  async parse(buffer: ArrayBuffer | Buffer, _fileName?: string): Promise<AdapterParseResult> {
    const wb = new ExcelJS.Workbook();

    // ExcelJS accepts a Buffer; convert ArrayBuffer if needed
    const nodeBuffer = Buffer.isBuffer(buffer)
      ? buffer
      : Buffer.from(buffer as ArrayBuffer);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await wb.xlsx.load(nodeBuffer as any);

    const warnings: AdapterParseResult["warnings"] = [];
    const errors: AdapterParseResult["errors"] = [];

    // Find the first usable data sheet
    let dataSheet: ExcelJS.Worksheet | undefined;
    for (const ws of wb.worksheets) {
      const nameLower = ws.name.trim().toLowerCase();
      if (SKIP_SHEET_NAMES.has(nameLower)) continue;
      if (ws.rowCount < 2) continue; // no data rows
      dataSheet = ws;
      break;
    }

    if (!dataSheet) {
      errors.push({ rowIndex: 0, message: "No usable data sheet found in workbook." });
      return { sourceRecordCount: 0, rows: [], warnings, errors, detectedColumns: [], unmappedColumns: [] };
    }

    // Read header row
    const headerRow = dataSheet.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell({ includeEmpty: false }, (cell) => {
      const val = cellToValue(cell);
      headers.push(val != null ? String(val).trim() : "");
    });

    if (headers.every((h) => h === "")) {
      errors.push({ rowIndex: 1, message: "Header row is empty." });
      return { sourceRecordCount: 0, rows: [], warnings, errors, detectedColumns: [], unmappedColumns: [] };
    }

    const knownFields = getKnownFieldNames();
    const unmappedColumns = headers.filter(
      (h) => h !== "" && !knownFields.has(h.toLowerCase())
    );

    const rows: ParsedSourceRow[] = [];
    dataSheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return; // skip header
      const record: ParsedSourceRow = {
        _rowIndex: rowNumber - 2, // 0-based data index
        _sourceFields: headers,
      };
      headers.forEach((header, colIdx) => {
        if (!header) return;
        const cell = row.getCell(colIdx + 1);
        const value = cellToValue(cell);
        if (value !== undefined && value !== null && value !== "") {
          record[header] = value;
        }
      });
      // Only include non-empty rows
      const dataKeys = Object.keys(record).filter((k) => !k.startsWith("_"));
      if (dataKeys.length > 0) {
        rows.push(record);
      }
    });

    if (rows.length === 0) {
      warnings.push({ rowIndex: 0, field: "_sheet", message: `No data rows found in sheet "${dataSheet.name}".` });
    }

    return {
      sourceRecordCount: rows.length,
      rows,
      warnings,
      errors,
      detectedColumns: headers.filter(Boolean),
      unmappedColumns,
    };
  }
}
