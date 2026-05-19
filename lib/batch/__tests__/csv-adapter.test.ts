import test from "node:test";
import assert from "node:assert/strict";
import { CSVUploadAdapter } from "../adapters/csv-adapter";

const adapter = new CSVUploadAdapter();

// ─── Basic parsing ────────────────────────────────────────────────────────────

test("csv adapter: parses a minimal header + one row", async () => {
  const csv = `hpvResult,cytologyResult\nNOT_DETECTED,NEGATIVE\n`;
  const result = await adapter.parse(csv);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].hpvResult, "NOT_DETECTED");
  assert.equal(result.rows[0].cytologyResult, "NEGATIVE");
});

test("csv adapter: rowIndex is 0-based", async () => {
  const csv = `hpvResult\nNOT_DETECTED\nHPV_16_18\n`;
  const result = await adapter.parse(csv);
  assert.equal(result.rows[0]._rowIndex, 0);
  assert.equal(result.rows[1]._rowIndex, 1);
});

test("csv adapter: sourceFields matches header columns", async () => {
  const csv = `hpvResult,immunocompromised\nNOT_DETECTED,false\n`;
  const result = await adapter.parse(csv);
  assert.deepEqual(result.rows[0]._sourceFields, ["hpvResult", "immunocompromised"]);
});

test("csv adapter: empty string values become undefined", async () => {
  const csv = `hpvResult,cytologyResult\nNOT_DETECTED,\n`;
  const result = await adapter.parse(csv);
  assert.equal(result.rows[0].hpvResult, "NOT_DETECTED");
  assert.equal(result.rows[0].cytologyResult, undefined);
});

test("csv adapter: skips blank rows (skipEmptyLines)", async () => {
  const csv = `hpvResult\nNOT_DETECTED\n\n\nHPV_16_18\n`;
  const result = await adapter.parse(csv);
  assert.equal(result.rows.length, 2);
});

test("csv adapter: trims whitespace from values", async () => {
  const csv = `hpvResult\n  NOT_DETECTED  \n`;
  const result = await adapter.parse(csv);
  assert.equal(result.rows[0].hpvResult, "NOT_DETECTED");
});

test("csv adapter: handles quoted values with commas", async () => {
  const csv = `label,hpvResult\n"Smith, Jane",NOT_DETECTED\n`;
  const result = await adapter.parse(csv);
  assert.equal(result.rows[0].label, "Smith, Jane");
});

test("csv adapter: handles BOM prefix", async () => {
  const csv = `﻿hpvResult\nNOT_DETECTED\n`;
  const result = await adapter.parse(csv);
  // PapaParse strips BOM; the column should still parse correctly
  assert.equal(result.rows.length, 1);
});

// ─── Multi-row ────────────────────────────────────────────────────────────────

test("csv adapter: parses multiple rows correctly", async () => {
  const csv = [
    "hpvResult,cytologyResult,immunocompromised",
    "NOT_DETECTED,,false",
    "HPV_16_18,HSIL,false",
    "HPV_OTHER,LSIL,true",
  ].join("\n");
  const result = await adapter.parse(csv);
  assert.equal(result.rows.length, 3);
  assert.equal(result.rows[2].hpvResult, "HPV_OTHER");
  assert.equal(result.rows[2].immunocompromised, "true");
});

// ─── Column detection ─────────────────────────────────────────────────────────

test("csv adapter: detectedColumns matches headers", async () => {
  const csv = `hpvResult,cytologyResult\nNOT_DETECTED,NEGATIVE\n`;
  const result = await adapter.parse(csv);
  assert.deepEqual(result.detectedColumns, ["hpvResult", "cytologyResult"]);
});

test("csv adapter: unmappedColumns identifies unknown headers", async () => {
  const csv = `hpvResult,MYSTERY_COLUMN\nNOT_DETECTED,foo\n`;
  const result = await adapter.parse(csv);
  assert.ok(result.unmappedColumns.includes("MYSTERY_COLUMN"));
});

test("csv adapter: known columns are NOT in unmappedColumns", async () => {
  const csv = `hpvResult,immunocompromised\nNOT_DETECTED,false\n`;
  const result = await adapter.parse(csv);
  assert.equal(result.unmappedColumns.length, 0);
});

// ─── Adapter metadata ─────────────────────────────────────────────────────────

test("csv adapter: sourceType is csv", () => {
  assert.equal(adapter.sourceType, "csv");
});

test("csv adapter: returns no errors for well-formed CSV", async () => {
  const csv = `hpvResult\nNOT_DETECTED\n`;
  const result = await adapter.parse(csv);
  assert.equal(result.errors.length, 0);
});

// ─── Column aliases ───────────────────────────────────────────────────────────

test("csv adapter: passes through alias column names as-is (normalisation is validation layer)", async () => {
  // 'nhi' is an alias for externalPatientId — the adapter should keep the original key
  const csv = `nhi,hpvResult\nNHI123,NOT_DETECTED\n`;
  const result = await adapter.parse(csv);
  assert.equal(result.rows[0].nhi, "NHI123");
});
