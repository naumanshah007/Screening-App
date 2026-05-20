import test from "node:test";
import assert from "node:assert/strict";
import { validateBatchRows, type BatchValidationResult } from "../validation";
import { processBatch, mapCanonicalToClinicalInput } from "../processor";
import type { ParsedSourceRow, SourceMetadata, CanonicalBatchCase } from "../types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MANUAL_SOURCE_META: Omit<SourceMetadata, "rowNumber" | "importedAt"> = {
  sourceType: "manual",
  sourceSystem: "Manual test entry",
  mappingVersion: "manual-v1",
  engineVersion: "test-v1",
};

const CSV_SOURCE_META: Omit<SourceMetadata, "rowNumber" | "importedAt"> = {
  sourceType: "csv",
  sourceSystem: "Test CSV",
  sourceFileName: "test.csv",
  mappingVersion: "csv-v1",
  engineVersion: "test-v1",
};

function makeRow(
  overrides: Record<string, unknown> = {},
  index = 0
): ParsedSourceRow {
  return {
    _rowIndex: index,
    _sourceFields: Object.keys(overrides).filter((k) => !k.startsWith("_")),
    ...overrides,
  };
}

function validateManual(rows: ParsedSourceRow[]): BatchValidationResult {
  return validateBatchRows(rows, MANUAL_SOURCE_META);
}

// ════════════════════════════════════════════════════════════════════════════
// 1. Issue popover data — validation issues contain field, value, message
// ════════════════════════════════════════════════════════════════════════════

test("popover data: invalid enum issue contains field, value, and allowed list", () => {
  const result = validateManual([
    makeRow({ hpvResult: "POSITIVE" }),
  ]);
  const c = result.cases[0];
  assert.equal(c.validationStatus, "invalid");

  const hpvError = c.validationErrors.find((e) => e.field === "hpvResult");
  assert.ok(hpvError, "should have hpvResult error");
  assert.equal(hpvError.field, "hpvResult");
  assert.equal(hpvError.value, "POSITIVE");
  assert.ok(hpvError.message.includes("Allowed:"), "message should list allowed values");
  assert.ok(hpvError.message.includes("NOT_DETECTED"), "message should include NOT_DETECTED");
  assert.ok(hpvError.message.includes("HPV_16_18"), "message should include HPV_16_18");
});

test("popover data: age out of range issue contains field, value, and range", () => {
  const result = validateManual([
    makeRow({ patientAge: 145, hpvResult: "NOT_DETECTED" }),
  ]);
  const ageError = result.cases[0].validationErrors.find((e) => e.field === "patientAge");
  assert.ok(ageError, "should have patientAge error");
  assert.equal(ageError.value, 145);
  assert.ok(ageError.message.includes("0") && ageError.message.includes("120"), "should mention valid range");
});

test("popover data: unknown column warning contains field name", () => {
  const result = validateManual([
    makeRow({ hpvResult: "NOT_DETECTED", labOrderId: "LAB-999" }, 0, ["hpvResult", "labOrderId"]),
  ]);
  const unknownWarn = result.cases[0].validationWarnings.find(
    (w) => w.field === "labOrderId"
  );
  assert.ok(unknownWarn, "should warn about unknown column");
  assert.ok(unknownWarn.message.includes("Unknown column"), "message should mention unknown column");
});

test("popover data: duplicate patient ID warning contains both row references", () => {
  const result = validateManual([
    makeRow({ hpvResult: "NOT_DETECTED", externalPatientId: "DUP-001" }, 0),
    makeRow({ hpvResult: "HPV_OTHER", externalPatientId: "DUP-001" }, 1),
  ]);
  const dupWarn = result.cases[1].validationWarnings.find(
    (w) => w.field === "externalPatientId" && w.message.includes("Duplicate")
  );
  assert.ok(dupWarn, "second row should have duplicate warning");
  assert.equal(dupWarn.value, "DUP-001");
});

test("popover data: no clinical data warning has _row field", () => {
  const result = validateManual([
    makeRow({ externalPatientId: "EMPTY-001" }),
  ]);
  const noClinical = result.cases[0].validationWarnings.find(
    (w) => w.field === "_row"
  );
  assert.ok(noClinical, "should warn about missing clinical data");
  assert.ok(noClinical.message.includes("no clinical data"));
});

// ════════════════════════════════════════════════════════════════════════════
// 2. Edit-row validation — edited rows re-validate correctly
// ════════════════════════════════════════════════════════════════════════════

test("edit: fixing invalid enum value makes row valid", () => {
  // Start with invalid
  const invalid = validateManual([makeRow({ hpvResult: "POSITIVE" })]);
  assert.equal(invalid.cases[0].validationStatus, "invalid");

  // "Edit" to fix
  const fixed = validateManual([makeRow({ hpvResult: "HPV_16_18" })]);
  assert.equal(fixed.cases[0].validationStatus, "valid");
  assert.equal(fixed.cases[0].hpvResult, "HPV_16_18");
});

test("edit: fixing age brings row from invalid to valid", () => {
  const invalid = validateManual([makeRow({ patientAge: 200, hpvResult: "NOT_DETECTED" })]);
  assert.equal(invalid.cases[0].validationStatus, "invalid");

  const fixed = validateManual([makeRow({ patientAge: 35, hpvResult: "NOT_DETECTED" })]);
  assert.equal(fixed.cases[0].validationStatus, "valid");
  assert.equal(fixed.cases[0].patientAge, 35);
});

test("edit: validation issues list is empty after fixing all errors", () => {
  const fixed = validateManual([
    makeRow({ hpvResult: "HPV_OTHER", cytologyResult: "LSIL", patientAge: 42 }),
  ]);
  assert.equal(fixed.cases[0].validationErrors.length, 0);
  assert.equal(fixed.cases[0].validationStatus, "valid");
});

test("edit: validation issues carry field-level detail for UI highlighting", () => {
  const result = validateManual([
    makeRow({ hpvResult: "INVALID_VALUE", cytologyResult: "WRONG" }),
  ]);
  const c = result.cases[0];
  assert.equal(c.validationStatus, "invalid");

  // Both fields should have separate errors
  const hpvErr = c.validationErrors.find((e) => e.field === "hpvResult");
  const cytErr = c.validationErrors.find((e) => e.field === "cytologyResult");
  assert.ok(hpvErr, "hpvResult should have an error");
  assert.ok(cytErr, "cytologyResult should have an error");
  assert.equal(hpvErr.value, "INVALID_VALUE");
  assert.equal(cytErr.value, "WRONG");
});

test("edit: source metadata is preserved as manual after edit", () => {
  const result = validateManual([
    makeRow({ hpvResult: "NOT_DETECTED", externalPatientId: "EDIT-001" }),
  ]);
  assert.equal(result.cases[0].source.sourceType, "manual");
  assert.equal(result.cases[0].source.sourceSystem, "Manual test entry");
  assert.equal(result.cases[0].source.mappingVersion, "manual-v1");
});

// ════════════════════════════════════════════════════════════════════════════
// 3. Invalid rows cannot be processed
// ════════════════════════════════════════════════════════════════════════════

test("processor: invalid rows are skipped by default", () => {
  const validation = validateManual([
    makeRow({ hpvResult: "NOT_DETECTED" }, 0),  // valid
    makeRow({ hpvResult: "POSITIVE" }, 1),        // invalid
    makeRow({ hpvResult: "HPV_16_18" }, 2),       // valid
  ]);

  const batch = processBatch(validation.cases);
  // Only 2 valid rows should be processed
  assert.equal(batch.results.length, 2);
  assert.equal(batch.processedCount, 2);

  // The invalid row (HPV "POSITIVE") should not appear in results
  const processedHpvValues = batch.results.map((r) => r.input.hpvResult);
  assert.ok(processedHpvValues.includes("NOT_DETECTED"));
  assert.ok(processedHpvValues.includes("HPV_16_18"));
});

test("processor: invalid rows are skipped even when includeWarnings is true", () => {
  const validation = validateManual([
    makeRow({ hpvResult: "POSITIVE" }, 0),  // invalid
  ]);

  const batch = processBatch(validation.cases, { includeWarnings: true, includeInvalid: false });
  assert.equal(batch.results.length, 0);
  assert.equal(batch.processedCount, 0);
});

test("processor: warning rows are processed by default", () => {
  // A row with only a warning (no clinical data) should still be processable
  const validation = validateManual([
    makeRow({ externalPatientId: "WARN-001", patientAge: 30 }, 0),
  ]);
  assert.equal(validation.cases[0].validationStatus, "warnings");

  const batch = processBatch(validation.cases);
  assert.equal(batch.results.length, 1);
  assert.equal(batch.results[0].status, "success");
});

// ════════════════════════════════════════════════════════════════════════════
// 4. Edited rows go through the same processor path (evaluateClinicalDecision)
// ════════════════════════════════════════════════════════════════════════════

test("processor: manually added row produces same decision as CSV row with same data", () => {
  // Same clinical data, different source types
  const manualValidation = validateManual([
    makeRow({ hpvResult: "NOT_DETECTED", patientAge: 35 }, 0),
  ]);
  const csvValidation = validateBatchRows(
    [makeRow({ hpvResult: "NOT_DETECTED", patientAge: 35 }, 0)],
    CSV_SOURCE_META
  );

  const manualBatch = processBatch(manualValidation.cases);
  const csvBatch = processBatch(csvValidation.cases);

  assert.equal(manualBatch.results[0].status, "success");
  assert.equal(csvBatch.results[0].status, "success");

  // Same decision output
  assert.equal(manualBatch.results[0].decision.figure, csvBatch.results[0].decision.figure);
  assert.equal(manualBatch.results[0].decision.riskLevel, csvBatch.results[0].decision.riskLevel);
  assert.equal(manualBatch.results[0].decision.recommendation, csvBatch.results[0].decision.recommendation);
});

test("processor: edited manual row maps to ClinicalInput correctly", () => {
  const validation = validateManual([
    makeRow({
      hpvResult: "HPV_16_18",
      cytologyResult: "HSIL",
      immunocompromised: true,
      patientAge: 40,
      sampleType: "LBC",
    }),
  ]);

  const input = mapCanonicalToClinicalInput(validation.cases[0]);
  assert.equal(input.hpvResult, "HPV_16_18");
  assert.equal(input.cytologyResult, "HSIL");
  assert.equal(input.immunocompromised, true);
  assert.equal(input.patientAge, 40);
  assert.equal(input.sampleType, "LBC");
});

test("processor: manual row with HPV 16/18 gets colposcopy referral", () => {
  const validation = validateManual([
    makeRow({ hpvResult: "HPV_16_18", sampleType: "LBC" }),
  ]);
  const batch = processBatch(validation.cases);
  const decision = batch.results[0].decision;

  assert.equal(batch.results[0].status, "success");
  assert.equal(decision.figure, "FIGURE_3");
  assert.ok(decision.referralRequired, "HPV 16/18 should require referral");
});

test("processor: manual row with HPV negative gets routine recall", () => {
  const validation = validateManual([
    makeRow({ hpvResult: "NOT_DETECTED" }),
  ]);
  const batch = processBatch(validation.cases);
  const decision = batch.results[0].decision;

  assert.equal(batch.results[0].status, "success");
  assert.equal(decision.riskLevel, "LOW");
});

// ════════════════════════════════════════════════════════════════════════════
// 5. Duplicate row gets new caseId, delete removes from selection
// ════════════════════════════════════════════════════════════════════════════

test("duplicate: duplicated row gets different caseId", () => {
  const result = validateManual([
    makeRow({ hpvResult: "NOT_DETECTED", externalPatientId: "DUP-001" }, 0),
    makeRow({ hpvResult: "NOT_DETECTED" }, 1), // duplicate without patient ID
  ]);
  assert.equal(result.cases.length, 2);
  assert.notEqual(result.cases[0].caseId, result.cases[1].caseId);
});

test("delete: removing a row reduces the case count", () => {
  const rows = [
    makeRow({ hpvResult: "NOT_DETECTED" }, 0),
    makeRow({ hpvResult: "HPV_OTHER", cytologyResult: "LSIL" }, 1),
    makeRow({ hpvResult: "HPV_16_18" }, 2),
  ];
  const full = validateManual(rows);
  assert.equal(full.cases.length, 3);

  // Simulate deletion of middle row
  const after = validateManual([rows[0], rows[2]]);
  assert.equal(after.cases.length, 2);
  assert.equal(after.cases[0].hpvResult, "NOT_DETECTED");
  assert.equal(after.cases[1].hpvResult, "HPV_16_18");
});

test("delete: deleted row caseIds are not reused", () => {
  const before = validateManual([
    makeRow({ hpvResult: "NOT_DETECTED" }, 0),
    makeRow({ hpvResult: "HPV_OTHER" }, 1),
  ]);
  const oldIds = new Set(before.cases.map((c) => c.caseId));

  const after = validateManual([makeRow({ hpvResult: "NOT_DETECTED" }, 0)]);
  for (const c of after.cases) {
    assert.ok(!oldIds.has(c.caseId), "revalidation should produce fresh caseIds");
  }
});

// ════════════════════════════════════════════════════════════════════════════
// 6. Manual source metadata labeling
// ════════════════════════════════════════════════════════════════════════════

test("source: manual rows have correct source metadata", () => {
  const result = validateManual([makeRow({ hpvResult: "NOT_DETECTED" })]);
  const c = result.cases[0];
  assert.equal(c.source.sourceType, "manual");
  assert.equal(c.source.sourceSystem, "Manual test entry");
  assert.equal(c.source.mappingVersion, "manual-v1");
  assert.ok(c.source.importedAt, "should have importedAt timestamp");
  assert.equal(c.source.rowNumber, 1);
});

test("source: manual rows coexist with CSV rows", () => {
  const csvResult = validateBatchRows(
    [makeRow({ hpvResult: "NOT_DETECTED", externalPatientId: "CSV-001" }, 0)],
    CSV_SOURCE_META
  );
  const manualResult = validateManual([
    makeRow({ hpvResult: "HPV_16_18", externalPatientId: "MANUAL-001" }, 0),
  ]);

  // Merge as BatchPageClient does
  const merged = [...csvResult.cases, ...manualResult.cases];
  assert.equal(merged.length, 2);
  assert.equal(merged[0].source.sourceType, "csv");
  assert.equal(merged[1].source.sourceType, "manual");
});
