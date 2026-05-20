import test from "node:test";
import assert from "node:assert/strict";
import { validateBatchRows, type BatchValidationResult } from "../validation";
import type { ParsedSourceRow, SourceMetadata } from "../types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MANUAL_SOURCE_META: Omit<SourceMetadata, "rowNumber" | "importedAt"> = {
  sourceType: "manual",
  sourceSystem: "Manual test entry",
  mappingVersion: "manual-v1",
  engineVersion: "test-v1",
};

function makeManualRow(
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

// ─── Valid Manual Row ────────────────────────────────────────────────────────

test("manual: valid row with HPV result produces valid case", () => {
  const result = validateManual([
    makeManualRow({
      externalPatientId: "MANUAL-001",
      patientAge: 35,
      hpvResult: "NOT_DETECTED",
      label: "Manual test — HPV negative",
    }),
  ]);

  assert.equal(result.cases.length, 1);
  assert.equal(result.validCount, 1);
  assert.equal(result.invalidCount, 0);

  const c = result.cases[0];
  assert.equal(c.validationStatus, "valid");
  assert.equal(c.source.sourceType, "manual");
  assert.equal(c.source.sourceSystem, "Manual test entry");
  assert.equal(c.source.mappingVersion, "manual-v1");
  assert.equal(c.source.externalPatientId, "MANUAL-001");
  assert.equal(c.patientAge, 35);
  assert.equal(c.hpvResult, "NOT_DETECTED");
  assert.equal(c.label, "Manual test — HPV negative");
});

test("manual: valid row with all boolean flags", () => {
  const result = validateManual([
    makeManualRow({
      hpvResult: "HPV_16_18",
      cytologyResult: "HSIL",
      isPostHysterectomy: false,
      immunocompromised: true,
      isFirstTimeHPVTransition: false,
      atypicalEndometrialHistory: false,
      isPregnant: true,
    }),
  ]);

  const c = result.cases[0];
  assert.equal(c.validationStatus, "valid");
  assert.equal(c.hpvResult, "HPV_16_18");
  assert.equal(c.cytologyResult, "HSIL");
  assert.equal(c.immunocompromised, true);
  assert.equal(c.isPregnant, true);
});

// ─── Edited Manual Row ──────────────────────────────────────────────────────

test("manual: edited row updates field values", () => {
  // Simulate: first validate with HPV_OTHER, then "edit" by re-validating with HPV_16_18
  const original = validateManual([
    makeManualRow({ hpvResult: "HPV_OTHER", patientAge: 40 }),
  ]);
  assert.equal(original.cases[0].hpvResult, "HPV_OTHER");
  assert.equal(original.cases[0].patientAge, 40);

  // "Edit": re-validate with changed values
  const edited = validateManual([
    makeManualRow({ hpvResult: "HPV_16_18", patientAge: 42, cytologyResult: "HSIL" }),
  ]);
  assert.equal(edited.cases[0].hpvResult, "HPV_16_18");
  assert.equal(edited.cases[0].patientAge, 42);
  assert.equal(edited.cases[0].cytologyResult, "HSIL");
});

test("manual: edited row preserves source metadata", () => {
  const result = validateManual([
    makeManualRow({ hpvResult: "NOT_DETECTED", externalPatientId: "EDIT-001" }),
  ]);

  assert.equal(result.cases[0].source.sourceType, "manual");
  assert.equal(result.cases[0].source.sourceSystem, "Manual test entry");
  assert.equal(result.cases[0].source.mappingVersion, "manual-v1");
  assert.equal(result.cases[0].source.externalPatientId, "EDIT-001");
});

// ─── Invalid Manual Row ─────────────────────────────────────────────────────

test("manual: invalid enum value produces validation error", () => {
  const result = validateManual([
    makeManualRow({ hpvResult: "POSITIVE" }), // invalid enum
  ]);

  assert.equal(result.invalidCount, 1);
  assert.equal(result.cases[0].validationStatus, "invalid");
  assert.ok(result.cases[0].validationErrors.length > 0);

  const hpvError = result.cases[0].validationErrors.find((e) => e.field === "hpvResult");
  assert.ok(hpvError, "should have an error for hpvResult");
  assert.ok(hpvError.message.includes("POSITIVE"));
});

test("manual: invalid age (> 120) produces validation error", () => {
  const result = validateManual([
    makeManualRow({ patientAge: 145, hpvResult: "NOT_DETECTED" }),
  ]);

  assert.equal(result.invalidCount, 1);
  assert.equal(result.cases[0].validationStatus, "invalid");

  const ageError = result.cases[0].validationErrors.find((e) => e.field === "patientAge");
  assert.ok(ageError, "should have an error for patientAge");
  assert.ok(ageError.message.includes("145"));
});

test("manual: row with no clinical data gets warning", () => {
  const result = validateManual([
    makeManualRow({ externalPatientId: "EMPTY-001", patientAge: 30 }),
  ]);

  // Should still be processable (warning, not error)
  assert.equal(result.warningCount, 1);
  assert.equal(result.cases[0].validationStatus, "warnings");

  const noClinical = result.cases[0].validationWarnings.find(
    (w) => w.field === "_row" && w.message.includes("no clinical data")
  );
  assert.ok(noClinical, "should warn about missing clinical data");
});

// ─── Duplicated Row Gets New caseId / Patient ID ────────────────────────────

test("manual: duplicated row gets a different caseId", () => {
  // Two identical rows (simulating duplicate) both get unique caseIds
  const result = validateManual([
    makeManualRow({ hpvResult: "NOT_DETECTED", externalPatientId: "DUP-001" }, 0),
    makeManualRow({ hpvResult: "NOT_DETECTED" }, 1), // no patient ID (duplicate cleared it)
  ]);

  assert.equal(result.cases.length, 2);
  assert.notEqual(result.cases[0].caseId, result.cases[1].caseId);

  // First row keeps original ID, second row has none (will be auto-labeled ROW-nnn)
  assert.equal(result.cases[0].source.externalPatientId, "DUP-001");
  assert.equal(result.cases[1].source.externalPatientId, undefined);
});

test("manual: duplicate with same patient ID triggers warning", () => {
  const result = validateManual([
    makeManualRow({ hpvResult: "NOT_DETECTED", externalPatientId: "DUP-001" }, 0),
    makeManualRow({ hpvResult: "HPV_OTHER", externalPatientId: "DUP-001" }, 1),
  ]);

  // Second row should have duplicate warning
  const dupWarning = result.cases[1].validationWarnings.find(
    (w) => w.field === "externalPatientId" && w.message.includes("Duplicate")
  );
  assert.ok(dupWarning, "should warn about duplicate patient ID");
});

// ─── Deleted Row Removed from Selection ─────────────────────────────────────

test("manual: deleting a row reduces total count", () => {
  const rows = [
    makeManualRow({ hpvResult: "NOT_DETECTED" }, 0),
    makeManualRow({ hpvResult: "HPV_OTHER", cytologyResult: "LSIL" }, 1),
    makeManualRow({ hpvResult: "HPV_16_18" }, 2),
  ];

  const full = validateManual(rows);
  assert.equal(full.cases.length, 3);
  assert.equal(full.totalRows, 3);

  // Simulate deletion by removing middle row and re-validating
  const afterDelete = validateManual([rows[0], rows[2]]);
  assert.equal(afterDelete.cases.length, 2);
  assert.equal(afterDelete.totalRows, 2);

  // Remaining cases should have valid data
  assert.equal(afterDelete.cases[0].hpvResult, "NOT_DETECTED");
  assert.equal(afterDelete.cases[1].hpvResult, "HPV_16_18");
});

test("manual: deleted row caseIds are not reused", () => {
  const rows = [
    makeManualRow({ hpvResult: "NOT_DETECTED" }, 0),
    makeManualRow({ hpvResult: "HPV_OTHER" }, 1),
  ];

  const before = validateManual(rows);
  const caseIdsBefore = before.cases.map((c) => c.caseId);

  // Simulate: delete row 1, re-validate row 0 only
  const after = validateManual([rows[0]]);
  const caseIdsAfter = after.cases.map((c) => c.caseId);

  // caseIds are generated fresh (UUIDs) — none should match
  for (const id of caseIdsAfter) {
    assert.ok(!caseIdsBefore.includes(id), "revalidation should produce new caseIds");
  }
});

// ─── Mixed Base + Manual ────────────────────────────────────────────────────

test("manual: manual rows coexist with base rows", () => {
  const baseResult = validateBatchRows(
    [makeManualRow({ hpvResult: "NOT_DETECTED", externalPatientId: "CSV-001" }, 0)],
    {
      sourceType: "csv",
      sourceSystem: "Test CSV",
      sourceFileName: "test.csv",
      mappingVersion: "csv-v1",
      engineVersion: "test-v1",
    }
  );

  const manualResult = validateManual([
    makeManualRow({ hpvResult: "HPV_16_18", externalPatientId: "MANUAL-001" }, 0),
  ]);

  // Merge (as BatchPageClient does)
  const merged = {
    cases: [...baseResult.cases, ...manualResult.cases],
    totalRows: baseResult.totalRows + manualResult.totalRows,
    validCount: baseResult.validCount + manualResult.validCount,
    warningCount: baseResult.warningCount + manualResult.warningCount,
    invalidCount: baseResult.invalidCount + manualResult.invalidCount,
  };

  assert.equal(merged.cases.length, 2);
  assert.equal(merged.cases[0].source.sourceType, "csv");
  assert.equal(merged.cases[1].source.sourceType, "manual");
  assert.equal(merged.cases[0].hpvResult, "NOT_DETECTED");
  assert.equal(merged.cases[1].hpvResult, "HPV_16_18");
});

// ─── Source Metadata Labeling ───────────────────────────────────────────────

test("manual: source metadata is correctly labeled", () => {
  const result = validateManual([
    makeManualRow({ hpvResult: "NOT_DETECTED" }),
  ]);

  const c = result.cases[0];
  assert.equal(c.source.sourceType, "manual");
  assert.equal(c.source.sourceSystem, "Manual test entry");
  assert.equal(c.source.mappingVersion, "manual-v1");
  assert.equal(c.source.engineVersion, "test-v1");
  assert.ok(c.source.importedAt, "should have importedAt timestamp");
  assert.equal(c.source.rowNumber, 1); // 1-based
});
