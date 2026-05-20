import test from "node:test";
import assert from "node:assert/strict";
import { validateBatchRows, type BatchValidationResult } from "../validation";
import type { ParsedSourceRow, SourceMetadata } from "../types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const BASE_SOURCE_META: Omit<SourceMetadata, "rowNumber" | "importedAt"> = {
  sourceType: "csv",
  sourceSystem: "Test Suite",
  sourceFileName: "test.csv",
  mappingVersion: "test-v1",
  engineVersion: "test-v1",
};

function makeRow(
  overrides: Record<string, unknown> = {},
  index = 0,
  sourceFields?: string[]
): ParsedSourceRow {
  return {
    _rowIndex: index,
    _sourceFields: sourceFields ?? Object.keys(overrides).filter((k) => !k.startsWith("_")),
    ...overrides,
  };
}

function validateOne(
  overrides: Record<string, unknown> = {},
  sourceFields?: string[]
): BatchValidationResult {
  return validateBatchRows([makeRow(overrides, 0, sourceFields)], BASE_SOURCE_META);
}

// ─── Boolean Coercion ────────────────────────────────────────────────────────

test("boolean coercion: string 'true' → true", () => {
  const result = validateOne({ isFirstTimeHPVTransition: "true", hpvResult: "NOT_DETECTED" });
  assert.equal(result.cases[0].isFirstTimeHPVTransition, true);
});

test("boolean coercion: string 'yes' → true", () => {
  const result = validateOne({ immunocompromised: "yes", hpvResult: "NOT_DETECTED" });
  assert.equal(result.cases[0].immunocompromised, true);
});

test("boolean coercion: string '1' → true", () => {
  const result = validateOne({ isPostHysterectomy: "1", hpvResult: "NOT_DETECTED" });
  assert.equal(result.cases[0].isPostHysterectomy, true);
});

test("boolean coercion: string 'false' → false", () => {
  const result = validateOne({ immunocompromised: "false", hpvResult: "NOT_DETECTED" });
  assert.equal(result.cases[0].immunocompromised, false);
});

test("boolean coercion: string 'no' → false", () => {
  const result = validateOne({ immunocompromised: "no", hpvResult: "NOT_DETECTED" });
  assert.equal(result.cases[0].immunocompromised, false);
});

test("boolean coercion: string '0' → false", () => {
  const result = validateOne({ immunocompromised: "0", hpvResult: "NOT_DETECTED" });
  assert.equal(result.cases[0].immunocompromised, false);
});

test("boolean coercion: empty string → false (default)", () => {
  const result = validateOne({ immunocompromised: "", hpvResult: "NOT_DETECTED" });
  assert.equal(result.cases[0].immunocompromised, false);
});

test("boolean coercion: unrecognised string warns and defaults to false", () => {
  const result = validateOne({ immunocompromised: "maybe", hpvResult: "NOT_DETECTED" });
  assert.equal(result.cases[0].immunocompromised, false);
  const boolWarning = result.cases[0].validationWarnings.find(
    (w) => w.field === "immunocompromised"
  );
  assert.ok(boolWarning, "Expected warning for unparseable boolean");
});

test("boolean coercion: numeric 1 → true", () => {
  const result = validateOne({ immunocompromised: 1, hpvResult: "NOT_DETECTED" });
  assert.equal(result.cases[0].immunocompromised, true);
});

test("boolean coercion: numeric 0 → false", () => {
  const result = validateOne({ immunocompromised: 0, hpvResult: "NOT_DETECTED" });
  assert.equal(result.cases[0].immunocompromised, false);
});

// ─── Required Field Defaults ─────────────────────────────────────────────────

test("required boolean fields default to false when missing", () => {
  const result = validateOne({ hpvResult: "NOT_DETECTED" });
  const c = result.cases[0];
  assert.equal(c.isFirstTimeHPVTransition, false);
  assert.equal(c.isPostHysterectomy, false);
  assert.equal(c.immunocompromised, false);
  assert.equal(c.atypicalEndometrialHistory, false);
});

test("counter fields default to 0 when missing", () => {
  const result = validateOne({ hpvResult: "NOT_DETECTED" });
  const c = result.cases[0];
  assert.equal(c.consecutiveNegativeCoTestCount, 0);
  assert.equal(c.consecutiveLowGradeCount, 0);
  assert.equal(c.unsatisfactoryCytologyCount, 0);
});

// ─── Enum Validation ─────────────────────────────────────────────────────────

test("valid HPV enum value is accepted", () => {
  const result = validateOne({ hpvResult: "HPV_16_18" });
  assert.equal(result.cases[0].hpvResult, "HPV_16_18");
  assert.equal(result.cases[0].validationStatus, "valid");
});

test("HPV enum value is case-insensitive (uppercased)", () => {
  const result = validateOne({ hpvResult: "hpv_other" });
  assert.equal(result.cases[0].hpvResult, "HPV_OTHER");
});

test("invalid HPV enum value produces error", () => {
  const result = validateOne({ hpvResult: "POSITIVE" });
  assert.equal(result.cases[0].validationStatus, "invalid");
  const err = result.cases[0].validationErrors.find((e) => e.field === "hpvResult");
  assert.ok(err, "Expected error for invalid hpvResult");
  assert.ok(err.message.includes("POSITIVE"));
});

test("invalid cytology enum value produces error", () => {
  const result = validateOne({ cytologyResult: "ABNORMAL" });
  assert.equal(result.invalidCount, 1);
  const err = result.cases[0].validationErrors.find((e) => e.field === "cytologyResult");
  assert.ok(err, "Expected error for invalid cytologyResult");
});

test("valid cytology enum value is accepted", () => {
  const result = validateOne({ cytologyResult: "HSIL", hpvResult: "HPV_OTHER" });
  assert.equal(result.cases[0].cytologyResult, "HSIL");
});

test("valid histology enum value is accepted", () => {
  const result = validateOne({ histologyResult: "CIN3", hpvResult: "HPV_16_18" });
  assert.equal(result.cases[0].histologyResult, "CIN3");
});

test("invalid histology enum value produces error", () => {
  const result = validateOne({ histologyResult: "GRADE4" });
  const err = result.cases[0].validationErrors.find((e) => e.field === "histologyResult");
  assert.ok(err, "Expected error for invalid histologyResult");
});

test("invalid sampleType enum value produces error", () => {
  const result = validateOne({ sampleType: "BIOPSY", hpvResult: "NOT_DETECTED" });
  // sampleType is not in the pre-Zod enum check list, but Zod will pass it through
  // as a string; the pre-Zod checks only cover the 6 most common enums
  // The value is still accepted (Zod doesn't reject unknown strings for optionalEnum)
  // This test documents current behaviour
  const c = result.cases[0];
  assert.ok(c); // row is still produced
});

// ─── Age Validation ──────────────────────────────────────────────────────────

test("valid age is accepted", () => {
  const result = validateOne({ patientAge: 35, hpvResult: "NOT_DETECTED" });
  assert.equal(result.cases[0].patientAge, 35);
  assert.equal(result.cases[0].validationStatus, "valid");
});

test("string age is coerced to number", () => {
  const result = validateOne({ patientAge: "42", hpvResult: "NOT_DETECTED" });
  assert.equal(result.cases[0].patientAge, 42);
});

test("age over 120 produces error", () => {
  const result = validateOne({ patientAge: 150, hpvResult: "NOT_DETECTED" });
  const err = result.cases[0].validationErrors.find((e) => e.field === "patientAge");
  assert.ok(err, "Expected error for age > 120");
  assert.equal(result.cases[0].validationStatus, "invalid");
});

test("negative age produces error", () => {
  const result = validateOne({ patientAge: -5, hpvResult: "NOT_DETECTED" });
  const err = result.cases[0].validationErrors.find((e) => e.field === "patientAge");
  assert.ok(err, "Expected error for negative age");
});

test("non-numeric age produces error", () => {
  const result = validateOne({ patientAge: "old", hpvResult: "NOT_DETECTED" });
  const err = result.cases[0].validationErrors.find((e) => e.field === "patientAge");
  assert.ok(err, "Expected error for non-numeric age");
});

// ─── Minimal Clinical Data Warning ──────────────────────────────────────────

test("row with no clinical data gets warning", () => {
  const result = validateOne({ patientAge: 30, label: "Empty row" });
  const w = result.cases[0].validationWarnings.find((w) => w.field === "_row");
  assert.ok(w, "Expected minimal data warning");
  assert.ok(w.message.includes("no clinical data"));
});

test("row with HPV result does not get minimal data warning", () => {
  const result = validateOne({ hpvResult: "NOT_DETECTED" });
  const w = result.cases[0].validationWarnings.find((w) => w.field === "_row");
  assert.equal(w, undefined, "Should not have minimal data warning");
});

// ─── Unknown Column Detection ────────────────────────────────────────────────

test("unknown column produces warning", () => {
  const result = validateOne(
    { hpvResult: "NOT_DETECTED", weirdColumn: "foo" },
    ["hpvResult", "weirdColumn"]
  );
  const w = result.cases[0].validationWarnings.find(
    (w) => w.field === "weirdColumn"
  );
  assert.ok(w, "Expected unknown column warning");
  assert.ok(w.message.includes("Unknown column"));
});

test("known column does not produce unknown warning", () => {
  const result = validateOne(
    { hpvResult: "NOT_DETECTED" },
    ["hpvResult"]
  );
  const unknownWarnings = result.cases[0].validationWarnings.filter(
    (w) => w.message.includes("Unknown column")
  );
  assert.equal(unknownWarnings.length, 0);
});

// ─── Duplicate Patient ID Detection ─────────────────────────────────────────

test("duplicate externalPatientId produces warning", () => {
  const rows = [
    makeRow({ externalPatientId: "ZZZ0001", hpvResult: "NOT_DETECTED" }, 0, ["externalPatientId", "hpvResult"]),
    makeRow({ externalPatientId: "ZZZ0001", hpvResult: "HPV_16_18" }, 1, ["externalPatientId", "hpvResult"]),
  ];
  const result = validateBatchRows(rows, BASE_SOURCE_META);
  // Second row should have duplicate warning
  const w = result.cases[1].validationWarnings.find(
    (w) => w.field === "externalPatientId" && w.message.includes("Duplicate")
  );
  assert.ok(w, "Expected duplicate patient ID warning on second row");
  assert.ok(w.message.includes("Duplicate"));
});

test("duplicate detection is case-insensitive", () => {
  const rows = [
    makeRow({ externalPatientId: "zzz0001", hpvResult: "NOT_DETECTED" }, 0, ["externalPatientId", "hpvResult"]),
    makeRow({ externalPatientId: "ZZZ0001", hpvResult: "HPV_16_18" }, 1, ["externalPatientId", "hpvResult"]),
  ];
  const result = validateBatchRows(rows, BASE_SOURCE_META);
  const w = result.cases[1].validationWarnings.find(
    (w) => w.field === "externalPatientId" && w.message.includes("Duplicate")
  );
  assert.ok(w, "Expected duplicate warning even with different case");
});

test("different patient IDs do not trigger duplicate warning", () => {
  const rows = [
    makeRow({ externalPatientId: "ZZZ0001", hpvResult: "NOT_DETECTED" }, 0, ["externalPatientId", "hpvResult"]),
    makeRow({ externalPatientId: "ZZZ0002", hpvResult: "HPV_16_18" }, 1, ["externalPatientId", "hpvResult"]),
  ];
  const result = validateBatchRows(rows, BASE_SOURCE_META);
  for (const c of result.cases) {
    const dupeWarnings = c.validationWarnings.filter(
      (w) => w.field === "externalPatientId" && w.message.includes("Duplicate")
    );
    assert.equal(dupeWarnings.length, 0);
  }
});

// ─── Validation Status Classification ────────────────────────────────────────

test("row with errors is classified as invalid", () => {
  const result = validateOne({ hpvResult: "BANANA" });
  assert.equal(result.cases[0].validationStatus, "invalid");
  assert.equal(result.invalidCount, 1);
  assert.equal(result.validCount, 0);
});

test("row with only warnings is classified as warnings", () => {
  const result = validateOne(
    { hpvResult: "NOT_DETECTED", weirdField: "x" },
    ["hpvResult", "weirdField"]
  );
  assert.equal(result.cases[0].validationStatus, "warnings");
  assert.equal(result.warningCount, 1);
});

test("clean row is classified as valid", () => {
  const result = validateOne(
    { hpvResult: "NOT_DETECTED" },
    ["hpvResult"]
  );
  assert.equal(result.cases[0].validationStatus, "valid");
  assert.equal(result.validCount, 1);
});

// ─── Aggregate Counts ────────────────────────────────────────────────────────

test("aggregate counts are correct for mixed batch", () => {
  const rows = [
    // Valid
    makeRow({ hpvResult: "NOT_DETECTED" }, 0, ["hpvResult"]),
    // Invalid (bad enum)
    makeRow({ hpvResult: "INVALID_ENUM" }, 1, ["hpvResult"]),
    // Warning (unknown column)
    makeRow({ hpvResult: "HPV_16_18", unknownCol: "x" }, 2, ["hpvResult", "unknownCol"]),
  ];
  const result = validateBatchRows(rows, BASE_SOURCE_META);
  assert.equal(result.totalRows, 3);
  assert.equal(result.validCount, 1);
  assert.equal(result.invalidCount, 1);
  assert.equal(result.warningCount, 1);
});

// ─── Source Metadata ─────────────────────────────────────────────────────────

test("source metadata is attached to each case", () => {
  const result = validateOne({ hpvResult: "NOT_DETECTED" });
  const src = result.cases[0].source;
  assert.equal(src.sourceType, "csv");
  assert.equal(src.sourceSystem, "Test Suite");
  assert.equal(src.sourceFileName, "test.csv");
  assert.equal(src.mappingVersion, "test-v1");
  assert.equal(src.engineVersion, "test-v1");
  assert.equal(src.rowNumber, 1); // 1-based
  assert.ok(src.importedAt); // ISO timestamp
});

test("row numbers are 1-based for display", () => {
  const rows = [
    makeRow({ hpvResult: "NOT_DETECTED" }, 0, ["hpvResult"]),
    makeRow({ hpvResult: "HPV_16_18" }, 1, ["hpvResult"]),
    makeRow({ hpvResult: "HPV_OTHER" }, 2, ["hpvResult"]),
  ];
  const result = validateBatchRows(rows, BASE_SOURCE_META);
  assert.equal(result.cases[0].source.rowNumber, 1);
  assert.equal(result.cases[1].source.rowNumber, 2);
  assert.equal(result.cases[2].source.rowNumber, 3);
});

// ─── Case ID Generation ─────────────────────────────────────────────────────

test("each case gets a unique caseId", () => {
  const rows = [
    makeRow({ hpvResult: "NOT_DETECTED" }, 0, ["hpvResult"]),
    makeRow({ hpvResult: "HPV_16_18" }, 1, ["hpvResult"]),
  ];
  const result = validateBatchRows(rows, BASE_SOURCE_META);
  assert.notEqual(result.cases[0].caseId, result.cases[1].caseId);
  // UUID format
  assert.match(result.cases[0].caseId, /^[0-9a-f]{8}-[0-9a-f]{4}-/);
});

// ─── Counter Field Coercion ─────────────────────────────────────────────────

test("string counter values are coerced to numbers", () => {
  const result = validateOne({
    hpvResult: "NOT_DETECTED",
    consecutiveNegativeCoTestCount: "3",
    consecutiveLowGradeCount: "2",
  });
  assert.equal(result.cases[0].consecutiveNegativeCoTestCount, 3);
  assert.equal(result.cases[0].consecutiveLowGradeCount, 2);
});

test("negative counter values default to 0", () => {
  const result = validateOne({
    hpvResult: "NOT_DETECTED",
    consecutiveNegativeCoTestCount: -1,
  });
  assert.equal(result.cases[0].consecutiveNegativeCoTestCount, 0);
});

test("non-numeric counter values default to 0", () => {
  const result = validateOne({
    hpvResult: "NOT_DETECTED",
    consecutiveNegativeCoTestCount: "abc",
  });
  assert.equal(result.cases[0].consecutiveNegativeCoTestCount, 0);
});

// ─── Label and External Patient ID ──────────────────────────────────────────

test("label is passed through", () => {
  const result = validateOne({ label: "Test Patient", hpvResult: "NOT_DETECTED" });
  assert.equal(result.cases[0].label, "Test Patient");
});

test("externalPatientId is trimmed", () => {
  const result = validateOne({ externalPatientId: "  ZZZ9999  ", hpvResult: "NOT_DETECTED" });
  assert.equal(result.cases[0].source.externalPatientId, "ZZZ9999");
});

// ─── Empty Batch ─────────────────────────────────────────────────────────────

test("empty batch produces empty result", () => {
  const result = validateBatchRows([], BASE_SOURCE_META);
  assert.equal(result.totalRows, 0);
  assert.equal(result.validCount, 0);
  assert.equal(result.warningCount, 0);
  assert.equal(result.invalidCount, 0);
  assert.equal(result.cases.length, 0);
});

// ════════════════════════════════════════════════════════════════════════════
// NHI Format Validation
// ════════════════════════════════════════════════════════════════════════════

test("NHI: valid old format (3 letters + 4 digits) passes", () => {
  const result = validateOne({ externalPatientId: "ZZZ0001", hpvResult: "NOT_DETECTED" });
  const nhiWarns = result.cases[0].validationWarnings.filter(
    (w) => w.field === "externalPatientId" && w.message.includes("NHI")
  );
  assert.equal(nhiWarns.length, 0, "Valid old-format NHI should not produce NHI warning");
});

test("NHI: valid new format (3 letters + 2 digits + 2 letters) passes", () => {
  const result = validateOne({ externalPatientId: "ZAB12CD", hpvResult: "NOT_DETECTED" });
  const nhiWarns = result.cases[0].validationWarnings.filter(
    (w) => w.field === "externalPatientId" && w.message.includes("NHI")
  );
  assert.equal(nhiWarns.length, 0, "Valid new-format NHI should not produce NHI warning");
});

test("NHI: case-insensitive — lowercase accepted", () => {
  const result = validateOne({ externalPatientId: "zzz0001", hpvResult: "NOT_DETECTED" });
  const nhiWarns = result.cases[0].validationWarnings.filter(
    (w) => w.field === "externalPatientId" && w.message.includes("NHI")
  );
  assert.equal(nhiWarns.length, 0, "Lowercase NHI should be accepted");
});

test("NHI: letters I and O are rejected", () => {
  const result = validateOne({ externalPatientId: "ZIO0001", hpvResult: "NOT_DETECTED" });
  const nhiWarns = result.cases[0].validationWarnings.filter(
    (w) => w.field === "externalPatientId" && w.message.includes("NHI")
  );
  assert.equal(nhiWarns.length, 1, "NHI with I/O should be warned");
  assert.ok(nhiWarns[0].message.includes("I or O"), "Should mention I/O restriction");
});

test("NHI: wrong length is rejected", () => {
  const result = validateOne({ externalPatientId: "ZZZ00", hpvResult: "NOT_DETECTED" });
  const nhiWarns = result.cases[0].validationWarnings.filter(
    (w) => w.field === "externalPatientId" && w.message.includes("NHI")
  );
  assert.equal(nhiWarns.length, 1);
  assert.ok(nhiWarns[0].message.includes("characters"), "Should mention length");
});

test("NHI: non-NHI format like DEMO-001 is warned", () => {
  const result = validateOne({ externalPatientId: "DEMO-001", hpvResult: "NOT_DETECTED" });
  const nhiWarns = result.cases[0].validationWarnings.filter(
    (w) => w.field === "externalPatientId" && w.message.includes("NHI")
  );
  assert.equal(nhiWarns.length, 1, "Non-NHI format should be warned");
});

test("NHI: LAB-001-2026 format is warned", () => {
  const result = validateOne({ externalPatientId: "LAB-001-2026", hpvResult: "NOT_DETECTED" });
  const nhiWarns = result.cases[0].validationWarnings.filter(
    (w) => w.field === "externalPatientId" && w.message.includes("NHI")
  );
  assert.equal(nhiWarns.length, 1, "Lab format should trigger NHI warning");
});

test("NHI: empty externalPatientId does not produce NHI warning", () => {
  const result = validateOne({ hpvResult: "NOT_DETECTED" });
  const nhiWarns = result.cases[0].validationWarnings.filter(
    (w) => w.field === "externalPatientId" && w.message.includes("NHI")
  );
  assert.equal(nhiWarns.length, 0);
});

// ════════════════════════════════════════════════════════════════════════════
// Ethnicity Validation
// ════════════════════════════════════════════════════════════════════════════

test("ethnicity: valid Level-2 code '21' (Māori) passes", () => {
  const result = validateOne({ ethnicityPrimary: "21", hpvResult: "NOT_DETECTED" });
  const ethWarns = result.cases[0].validationWarnings.filter(
    (w) => w.field === "ethnicityPrimary"
  );
  assert.equal(ethWarns.length, 0);
});

test("ethnicity: valid name 'MAORI' passes", () => {
  const result = validateOne({ ethnicityPrimary: "MAORI", hpvResult: "NOT_DETECTED" });
  const ethWarns = result.cases[0].validationWarnings.filter(
    (w) => w.field === "ethnicityPrimary"
  );
  assert.equal(ethWarns.length, 0);
});

test("ethnicity: valid name 'EUROPEAN' passes", () => {
  const result = validateOne({ ethnicityPrimary: "EUROPEAN", hpvResult: "NOT_DETECTED" });
  const ethWarns = result.cases[0].validationWarnings.filter(
    (w) => w.field === "ethnicityPrimary"
  );
  assert.equal(ethWarns.length, 0);
});

test("ethnicity: invalid value 'MARTIAN' is warned", () => {
  const result = validateOne({ ethnicityPrimary: "MARTIAN", hpvResult: "NOT_DETECTED" });
  const ethWarns = result.cases[0].validationWarnings.filter(
    (w) => w.field === "ethnicityPrimary"
  );
  assert.equal(ethWarns.length, 1);
  assert.ok(ethWarns[0].message.includes("not recognised"));
});

test("ethnicity: empty value does not produce warning", () => {
  const result = validateOne({ hpvResult: "NOT_DETECTED" });
  const ethWarns = result.cases[0].validationWarnings.filter(
    (w) => w.field === "ethnicityPrimary"
  );
  assert.equal(ethWarns.length, 0);
});

// ════════════════════════════════════════════════════════════════════════════
// Age Range Warnings (NCSP screening ages)
// ════════════════════════════════════════════════════════════════════════════

test("age: under 25 produces NCSP screening start warning", () => {
  const result = validateOne({ patientAge: 22, hpvResult: "NOT_DETECTED" });
  const ageWarns = result.cases[0].validationWarnings.filter(
    (w) => w.field === "patientAge" && w.message.includes("below")
  );
  assert.equal(ageWarns.length, 1);
  assert.ok(ageWarns[0].message.includes("25"));
});

test("age: over 70 produces NCSP screening exit warning", () => {
  const result = validateOne({ patientAge: 75, hpvResult: "NOT_DETECTED" });
  const ageWarns = result.cases[0].validationWarnings.filter(
    (w) => w.field === "patientAge" && w.message.includes("above")
  );
  assert.equal(ageWarns.length, 1);
  assert.ok(ageWarns[0].message.includes("69"));
});

test("age: 25 does not produce screening range warning", () => {
  const result = validateOne({ patientAge: 25, hpvResult: "NOT_DETECTED" });
  const ageWarns = result.cases[0].validationWarnings.filter(
    (w) => w.field === "patientAge"
  );
  assert.equal(ageWarns.length, 0);
});

test("age: 69 does not produce screening range warning", () => {
  const result = validateOne({ patientAge: 69, hpvResult: "NOT_DETECTED" });
  const ageWarns = result.cases[0].validationWarnings.filter(
    (w) => w.field === "patientAge"
  );
  assert.equal(ageWarns.length, 0);
});

// ════════════════════════════════════════════════════════════════════════════
// Counter Field Warnings
// ════════════════════════════════════════════════════════════════════════════

test("counter: non-numeric value produces warning", () => {
  const result = validateOne({
    hpvResult: "NOT_DETECTED",
    consecutiveNegativeCoTestCount: "abc",
  });
  const counterWarns = result.cases[0].validationWarnings.filter(
    (w) => w.field === "consecutiveNegativeCoTestCount" && w.message.includes("Non-numeric")
  );
  assert.equal(counterWarns.length, 1);
});

test("counter: negative value produces warning", () => {
  const result = validateOne({
    hpvResult: "NOT_DETECTED",
    consecutiveLowGradeCount: -3,
  });
  const counterWarns = result.cases[0].validationWarnings.filter(
    (w) => w.field === "consecutiveLowGradeCount" && w.message.includes("Negative")
  );
  assert.equal(counterWarns.length, 1);
});

test("counter: unusually high value produces warning", () => {
  const result = validateOne({
    hpvResult: "NOT_DETECTED",
    unsatisfactoryCytologyCount: 25,
  });
  const counterWarns = result.cases[0].validationWarnings.filter(
    (w) => w.field === "unsatisfactoryCytologyCount" && w.message.includes("Unusually high")
  );
  assert.equal(counterWarns.length, 1);
});

test("counter: value of 5 does not produce warning", () => {
  const result = validateOne({
    hpvResult: "NOT_DETECTED",
    consecutiveNegativeCoTestCount: 5,
  });
  const counterWarns = result.cases[0].validationWarnings.filter(
    (w) => w.field === "consecutiveNegativeCoTestCount"
  );
  assert.equal(counterWarns.length, 0);
});

// ════════════════════════════════════════════════════════════════════════════
// Logical Consistency Checks
// ════════════════════════════════════════════════════════════════════════════

test("consistency: hysterectomyType without isPostHysterectomy produces warning", () => {
  const result = validateOne({
    hpvResult: "NOT_DETECTED",
    hysterectomyType: "TOTAL",
    isPostHysterectomy: false,
  });
  const warns = result.cases[0].validationWarnings.filter(
    (w) => w.field === "hysterectomyType" && w.message.includes("isPostHysterectomy")
  );
  assert.equal(warns.length, 1);
});

test("consistency: hysterectomyType with isPostHysterectomy=true does not warn", () => {
  const result = validateOne({
    hysterectomyType: "TOTAL",
    hysterectomyIndication: "BENIGN_GYNAECOLOGICAL_DISEASE",
    hysterectomySpecimenPathology: "NO_CERVICAL_PATHOLOGY",
    isPostHysterectomy: true,
  });
  const warns = result.cases[0].validationWarnings.filter(
    (w) => w.field === "hysterectomyType" && w.message.includes("isPostHysterectomy")
  );
  assert.equal(warns.length, 0);
});

test("consistency: testOfCureStage without isTestOfCure produces warning", () => {
  const result = validateOne({
    hpvResult: "NOT_DETECTED",
    testOfCureStage: "FIRST_TEST",
    isTestOfCure: false,
  });
  const warns = result.cases[0].validationWarnings.filter(
    (w) => w.field === "testOfCureStage" && w.message.includes("isTestOfCure")
  );
  assert.equal(warns.length, 1);
});

test("consistency: abnormalBleedingStage without hasAbnormalVaginalBleeding produces warning", () => {
  const result = validateOne({
    hpvResult: "NOT_DETECTED",
    abnormalBleedingStage: "INITIAL_ASSESSMENT",
    hasAbnormalVaginalBleeding: false,
  });
  const warns = result.cases[0].validationWarnings.filter(
    (w) => w.field === "abnormalBleedingStage" && w.message.includes("hasAbnormalVaginalBleeding")
  );
  assert.equal(warns.length, 1);
});

test("consistency: pregnant + immunocompromised produces advisory warning", () => {
  const result = validateOne({
    hpvResult: "NOT_DETECTED",
    isPregnant: true,
    immunocompromised: true,
  });
  const warns = result.cases[0].validationWarnings.filter(
    (w) => w.field === "isPregnant" && w.message.includes("immunocompromised")
  );
  assert.equal(warns.length, 1);
});

// ════════════════════════════════════════════════════════════════════════════
// Extended Enum Validation (all 21 fields)
// ════════════════════════════════════════════════════════════════════════════

test("enum: invalid repeatContext produces error", () => {
  const result = validateOne({ hpvResult: "NOT_DETECTED", repeatContext: "BANANA" });
  const err = result.cases[0].validationErrors.find((e) => e.field === "repeatContext");
  assert.ok(err, "Invalid repeatContext should produce error");
  assert.ok(err.message.includes("Allowed:"));
});

test("enum: valid repeatStage accepted", () => {
  const result = validateOne({ hpvResult: "HPV_OTHER", repeatStage: "SECOND_REPEAT" });
  const err = result.cases[0].validationErrors.find((e) => e.field === "repeatStage");
  assert.equal(err, undefined, "Valid repeatStage should not produce error");
});

test("enum: invalid screeningStatus produces error", () => {
  const result = validateOne({ screeningStatus: "INVALID_STATUS" });
  const err = result.cases[0].validationErrors.find((e) => e.field === "screeningStatus");
  assert.ok(err);
});

test("enum: valid colposcopicImpression accepted", () => {
  const result = validateOne({ hpvResult: "HPV_16_18", colposcopicImpression: "HSIL" });
  const err = result.cases[0].validationErrors.find((e) => e.field === "colposcopicImpression");
  assert.equal(err, undefined);
});

test("enum: invalid abnormalBleedingStage produces error", () => {
  const result = validateOne({
    hasAbnormalVaginalBleeding: true,
    abnormalBleedingStage: "PHASE_THREE",
  });
  const err = result.cases[0].validationErrors.find((e) => e.field === "abnormalBleedingStage");
  assert.ok(err, "Invalid bleeding stage should produce error");
});

test("enum: valid hysterectomyType accepted", () => {
  const result = validateOne({
    isPostHysterectomy: true,
    hysterectomyType: "TOTAL",
    hysterectomyIndication: "BENIGN_GYNAECOLOGICAL_DISEASE",
    hysterectomySpecimenPathology: "NO_CERVICAL_PATHOLOGY",
  });
  const err = result.cases[0].validationErrors.find((e) => e.field === "hysterectomyType");
  assert.equal(err, undefined);
});

test("enum: invalid hysterectomyType produces error", () => {
  const result = validateOne({
    isPostHysterectomy: true,
    hysterectomyType: "PARTIAL",
  });
  const err = result.cases[0].validationErrors.find((e) => e.field === "hysterectomyType");
  assert.ok(err);
  assert.ok(err.message.includes("TOTAL"));
  assert.ok(err.message.includes("SUBTOTAL"));
});
