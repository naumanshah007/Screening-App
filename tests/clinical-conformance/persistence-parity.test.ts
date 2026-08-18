import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const schema = readFileSync(new URL("../../prisma/schema.prisma", import.meta.url), "utf8");
const completion = readFileSync(new URL("../../app/api/pathway/sessions/[id]/complete/route.ts", import.meta.url), "utf8");
const persistence = readFileSync(new URL("../../lib/batch/persistence.ts", import.meta.url), "utf8");

test("patient date of birth exists, but exact age-boundary use is traceable in the decision snapshot", () => {
  assert.match(schema, /dateOfBirth\s+DateTime/);
  assert.match(completion, /ageAtEvent|ageCalculationDate|dateOfBirth[\s\S]*inputFacts/);
});

test("Test-of-Cure treatment date and qualifying sequence are persisted as first-class longitudinal fields", () => {
  assert.match(schema, /treatmentDate\s+DateTime/);
  assert.match(schema, /testOfCureStage|consecutiveNegativeCoTestCount/);
  assert.match(completion, /treatmentDate/);
});

test("immutable input and decision snapshots retain the applied rule version", () => {
  assert.match(schema, /inputFacts|inputSnapshot/);
  assert.match(schema, /ruleVersion|ruleSetVersion/);
  assert.match(persistence, /inputSnapshot|inputFacts/);
  assert.match(persistence, /ruleVersion|engineVersion/);
});

test("hysterectomy indication/pathology/completeness and MDM/biopsy provenance are all persisted", () => {
  for (const field of ["hysterectomyIndication", "hysterectomySpecimenPathology", "excisionStatus", "biopsyResult", "mdmOutcome"]) assert.match(`${schema}\n${completion}`, new RegExp(field), field);
  for (const provenance of ["biopsySource", "mdmSource"]) assert.match(`${schema}\n${completion}`, new RegExp(provenance, "i"), provenance);
});
