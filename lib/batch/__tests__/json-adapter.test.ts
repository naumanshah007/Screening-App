import test from "node:test";
import assert from "node:assert/strict";
import { JSONUploadAdapter } from "../adapters/json-adapter";

const adapter = new JSONUploadAdapter();

// ─── Basic parsing ────────────────────────────────────────────────────────────

test("json adapter: parses a root array", async () => {
  const json = JSON.stringify([{ hpvResult: "NOT_DETECTED" }, { hpvResult: "HPV_16_18" }]);
  const result = await adapter.parse(json);
  assert.equal(result.rows.length, 2);
  assert.equal(result.rows[0].hpvResult, "NOT_DETECTED");
  assert.equal(result.rows[1].hpvResult, "HPV_16_18");
});

test("json adapter: parses { cases: [...] } wrapper", async () => {
  const json = JSON.stringify({ cases: [{ hpvResult: "NOT_DETECTED" }] });
  const result = await adapter.parse(json);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].hpvResult, "NOT_DETECTED");
});

test("json adapter: parses { data: [...] } wrapper", async () => {
  const json = JSON.stringify({ data: [{ hpvResult: "HPV_OTHER" }] });
  const result = await adapter.parse(json);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].hpvResult, "HPV_OTHER");
});

test("json adapter: parses { rows: [...] } wrapper", async () => {
  const json = JSON.stringify({ rows: [{ hpvResult: "HPV_16_18" }] });
  const result = await adapter.parse(json);
  assert.equal(result.rows.length, 1);
});

test("json adapter: rowIndex is 0-based", async () => {
  const json = JSON.stringify([{ hpvResult: "NOT_DETECTED" }, { hpvResult: "HPV_16_18" }]);
  const result = await adapter.parse(json);
  assert.equal(result.rows[0]._rowIndex, 0);
  assert.equal(result.rows[1]._rowIndex, 1);
});

test("json adapter: sourceFields includes all detected keys", async () => {
  const json = JSON.stringify([{ hpvResult: "NOT_DETECTED", immunocompromised: false }]);
  const result = await adapter.parse(json);
  assert.ok(result.rows[0]._sourceFields.includes("hpvResult"));
  assert.ok(result.rows[0]._sourceFields.includes("immunocompromised"));
});

// ─── Error handling ───────────────────────────────────────────────────────────

test("json adapter: returns error for invalid JSON", async () => {
  const result = await adapter.parse("{ not valid json }");
  assert.equal(result.errors.length, 1);
  assert.ok(result.errors[0].message.includes("Invalid JSON"));
  assert.equal(result.rows.length, 0);
});

test("json adapter: returns error for JSON string (not object/array)", async () => {
  const result = await adapter.parse('"just a string"');
  assert.equal(result.errors.length, 1);
  assert.equal(result.rows.length, 0);
});

test("json adapter: returns error for unknown wrapper shape", async () => {
  const result = await adapter.parse(JSON.stringify({ patients: [] }));
  assert.equal(result.errors.length, 1);
  assert.ok(result.errors[0].message.includes("'cases'"));
});

test("json adapter: warns for empty array", async () => {
  const result = await adapter.parse(JSON.stringify([]));
  assert.equal(result.warnings.length, 1);
  assert.ok(result.warnings[0].message.includes("empty"));
  assert.equal(result.rows.length, 0);
});

test("json adapter: skips non-object elements with warning", async () => {
  const json = JSON.stringify([{ hpvResult: "NOT_DETECTED" }, "not-an-object"]);
  const result = await adapter.parse(json);
  assert.equal(result.rows.length, 1);
  assert.equal(result.warnings.length, 1);
  assert.ok(result.warnings[0].message.includes("not an object"));
});

// ─── Column detection ─────────────────────────────────────────────────────────

test("json adapter: detectedColumns collects keys from all records", async () => {
  const json = JSON.stringify([
    { hpvResult: "NOT_DETECTED" },
    { cytologyResult: "NEGATIVE" },
  ]);
  const result = await adapter.parse(json);
  assert.ok(result.detectedColumns.includes("hpvResult"));
  assert.ok(result.detectedColumns.includes("cytologyResult"));
});

test("json adapter: unmappedColumns identifies unknown keys", async () => {
  const json = JSON.stringify([{ hpvResult: "NOT_DETECTED", weirdKey: "x" }]);
  const result = await adapter.parse(json);
  assert.ok(result.unmappedColumns.includes("weirdKey"));
  assert.ok(!result.unmappedColumns.includes("hpvResult"));
});

// ─── Adapter metadata ─────────────────────────────────────────────────────────

test("json adapter: sourceType is json", () => {
  assert.equal(adapter.sourceType, "json");
});

test("json adapter: preserves field types (boolean, number)", async () => {
  const json = JSON.stringify([{ immunocompromised: true, patientAge: 42 }]);
  const result = await adapter.parse(json);
  assert.equal(result.rows[0].immunocompromised, true);
  assert.equal(result.rows[0].patientAge, 42);
});
