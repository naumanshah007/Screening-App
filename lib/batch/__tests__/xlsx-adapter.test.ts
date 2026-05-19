import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { ExcelUploadAdapter } from "../adapters/xlsx-adapter";

const adapter = new ExcelUploadAdapter();

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function makeXlsx(
  sheets: Array<{ name: string; rows: Array<Record<string, unknown>> }>
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  for (const { name, rows } of sheets) {
    const ws = wb.addWorksheet(name);
    if (rows.length === 0) continue;
    const headers = Object.keys(rows[0]);
    ws.addRow(headers);
    for (const row of rows) ws.addRow(headers.map((h) => row[h]));
  }
  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// ─── Basic parsing ────────────────────────────────────────────────────────────

test("xlsx adapter: parses a simple workbook", async () => {
  const buf = await makeXlsx([{
    name: "Data",
    rows: [{ hpvResult: "NOT_DETECTED", immunocompromised: false }],
  }]);
  const result = await adapter.parse(buf.buffer as ArrayBuffer);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].hpvResult, "NOT_DETECTED");
});

test("xlsx adapter: rowIndex is 0-based for data rows", async () => {
  const buf = await makeXlsx([{
    name: "Data",
    rows: [
      { hpvResult: "NOT_DETECTED" },
      { hpvResult: "HPV_16_18" },
    ],
  }]);
  const result = await adapter.parse(buf.buffer as ArrayBuffer);
  assert.equal(result.rows[0]._rowIndex, 0);
  assert.equal(result.rows[1]._rowIndex, 1);
});

test("xlsx adapter: sourceFields contains column headers", async () => {
  const buf = await makeXlsx([{
    name: "Data",
    rows: [{ hpvResult: "NOT_DETECTED", cytologyResult: "NEGATIVE" }],
  }]);
  const result = await adapter.parse(buf.buffer as ArrayBuffer);
  assert.ok(result.rows[0]._sourceFields.includes("hpvResult"));
  assert.ok(result.rows[0]._sourceFields.includes("cytologyResult"));
});

test("xlsx adapter: multiple data rows", async () => {
  const buf = await makeXlsx([{
    name: "Data",
    rows: [
      { hpvResult: "NOT_DETECTED" },
      { hpvResult: "HPV_16_18" },
      { hpvResult: "HPV_OTHER" },
    ],
  }]);
  const result = await adapter.parse(buf.buffer as ArrayBuffer);
  assert.equal(result.rows.length, 3);
  assert.equal(result.rows[2].hpvResult, "HPV_OTHER");
});

// ─── Sheet selection ─────────────────────────────────────────────────────────

test("xlsx adapter: skips instruction sheet and reads data sheet", async () => {
  const buf = await makeXlsx([
    { name: "Instructions", rows: [{ col: "val" }] },
    { name: "Template",     rows: [{ hpvResult: "NOT_DETECTED" }] },
  ]);
  const result = await adapter.parse(buf.buffer as ArrayBuffer);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].hpvResult, "NOT_DETECTED");
});

test("xlsx adapter: skips 'Allowed Values' sheet", async () => {
  const buf = await makeXlsx([
    { name: "Allowed Values", rows: [{ col: "val" }] },
    { name: "Patient Data",   rows: [{ hpvResult: "HPV_16_18" }] },
  ]);
  const result = await adapter.parse(buf.buffer as ArrayBuffer);
  assert.equal(result.rows[0].hpvResult, "HPV_16_18");
});

test("xlsx adapter: error when no usable sheet found", async () => {
  const buf = await makeXlsx([
    { name: "Instructions", rows: [] },
    { name: "Reference",    rows: [] },
  ]);
  const result = await adapter.parse(buf.buffer as ArrayBuffer);
  assert.ok(result.errors.length > 0);
  assert.ok(result.errors[0].message.includes("No usable data sheet"));
  assert.equal(result.rows.length, 0);
});

// ─── Column detection ─────────────────────────────────────────────────────────

test("xlsx adapter: detectedColumns matches headers", async () => {
  const buf = await makeXlsx([{
    name: "Data",
    rows: [{ hpvResult: "NOT_DETECTED", patientAge: 35 }],
  }]);
  const result = await adapter.parse(buf.buffer as ArrayBuffer);
  assert.ok(result.detectedColumns.includes("hpvResult"));
  assert.ok(result.detectedColumns.includes("patientAge"));
});

test("xlsx adapter: unmappedColumns flags unknown columns", async () => {
  const buf = await makeXlsx([{
    name: "Data",
    rows: [{ hpvResult: "NOT_DETECTED", WEIRD_COLUMN: "x" }],
  }]);
  const result = await adapter.parse(buf.buffer as ArrayBuffer);
  assert.ok(result.unmappedColumns.includes("WEIRD_COLUMN"));
  assert.ok(!result.unmappedColumns.includes("hpvResult"));
});

// ─── Adapter metadata ─────────────────────────────────────────────────────────

test("xlsx adapter: sourceType is xlsx", () => {
  assert.equal(adapter.sourceType, "xlsx");
});

test("xlsx adapter: accepts Buffer (not just ArrayBuffer)", async () => {
  const buf = await makeXlsx([{
    name: "Data",
    rows: [{ hpvResult: "NOT_DETECTED" }],
  }]);
  // Pass as Buffer directly (not ArrayBuffer)
  const result = await adapter.parse(buf);
  assert.equal(result.rows.length, 1);
});
