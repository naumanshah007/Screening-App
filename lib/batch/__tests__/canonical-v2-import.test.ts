import assert from "node:assert/strict";
import test from "node:test";

import {
  CANONICAL_V2_BATCH_SCHEMA_ID,
  buildCanonicalFactsV2FromBatchRows,
  protectCsvCell,
} from "../canonical-v2-import";

const base = {
  schema_id: CANONICAL_V2_BATCH_SCHEMA_ID,
  subject_reference: "SYNTHETIC-1",
  captured_at: "2026-08-03T00:00:00.000Z",
  source: "LAB_RESULT",
  recorded_at: "2026-08-03T00:00:00.000Z",
  entered_by: "batch-test",
  verified_by: "",
  verification_status: "SOURCE_VERIFIED",
  source_document_id: "LAB-1",
  external_reference: "",
};

test("canonical V2 batch rows preserve known, unknown and provenance states", () => {
  const result = buildCanonicalFactsV2FromBatchRows([
    {
      ...base,
      fact_name: "hpvValidity",
      fact_value: "UNSUITABLE",
      value_type: "STRING",
      status: "KNOWN",
      observed_at: "2026-08-02T23:00:00.000Z",
    },
    {
      ...base,
      fact_name: "cytologyResult",
      fact_value: "",
      status: "PENDING",
      observed_at: "",
    },
  ]);
  assert.deepEqual(result.errors, []);
  assert.equal(result.cases.length, 1);
  assert.equal(result.cases[0].facts.hpvValidity.value, "UNSUITABLE");
  assert.equal(result.cases[0].facts.cytologyResult.status, "PENDING");
  assert.equal(result.cases[0].facts.cytologyResult.value, undefined);
});

test("canonical V2 batch rows reject duplicate or malformed facts", () => {
  const row = {
    ...base,
    fact_name: "ageYears",
    fact_value: "not-a-number",
    value_type: "NUMBER",
    status: "KNOWN",
    observed_at: "",
  };
  const malformed = buildCanonicalFactsV2FromBatchRows([row]);
  assert.equal(malformed.cases.length, 0);
  assert.equal(malformed.errors.length, 1);

  const duplicate = buildCanonicalFactsV2FromBatchRows([
    { ...row, fact_value: "29" },
    { ...row, fact_value: "30" },
  ]);
  assert.equal(duplicate.cases.length, 0);
  assert.match(duplicate.errors[0].message, /Duplicate fact/);
});

test("CSV cells that could execute as formulas are neutralised", () => {
  assert.equal(protectCsvCell("=HYPERLINK(\"https://bad\")"), "'=HYPERLINK(\"https://bad\")");
  assert.equal(protectCsvCell("normal"), "normal");
});
