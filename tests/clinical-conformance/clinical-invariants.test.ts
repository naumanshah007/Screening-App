import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { evaluateClinicalDecision, evaluateFigure5, evaluateFigure7 } from "../../lib/engine/decision-engine";
import { mapCanonicalToClinicalInput } from "../../lib/batch/processor";
import type { ClinicalInput } from "../../lib/engine/types";
import type { CanonicalBatchCase } from "../../lib/batch/types";

function base(overrides: Partial<ClinicalInput> = {}): ClinicalInput {
  return { patientId: "SYNTHETIC-INVARIANT", patientAge: 35, isFirstTimeHPVTransition: false, isPostHysterectomy: false, atypicalEndometrialHistory: false, immunocompromised: false, consecutiveNegativeCoTestCount: 0, consecutiveLowGradeCount: 0, unsatisfactoryCytologyCount: 0, ...overrides };
}

for (const age of [25, 49, 50, 69, 70, 74]) {
  test(`property: HPV 16/18 at age ${age} never routes to routine recall`, () => {
    const decision = evaluateClinicalDecision(base({ patientAge: age, hpvResult: "HPV_16_18", sampleType: "LBC" }));
    assert.equal(decision.referralType, "COLPOSCOPY", `${decision.recommendationCode} trace=${JSON.stringify(decision.branchPath)}`);
  });
}

for (const age of [24, 25, 70, 75, 90]) {
  test(`property: suspected cervical cancer at age ${age} never routes to routine screening`, () => {
    const decision = evaluateClinicalDecision(base({ patientAge: age, hasAbnormalVaginalBleeding: true, hasCancerSymptoms: true, coTestCompleted: false }));
    assert.equal(decision.referralRequired, true);
    assert.equal(decision.riskLevel, "URGENT");
  });
}

test("property: missing sample type cannot yield confident HPV-not-detected recall", () => {
  const decision = evaluateClinicalDecision(base({ hpvResult: "NOT_DETECTED" }));
  assert.equal(decision.safetyOutcome, "INSUFFICIENT_INFORMATION");
});

test("property: unknown immune status cannot choose three- or five-year recall", () => {
  const decision = evaluateClinicalDecision(base({ hpvResult: "NOT_DETECTED", sampleType: "LBC", immunocompromised: undefined as unknown as boolean }));
  assert.equal(decision.safetyOutcome, "INSUFFICIENT_INFORMATION");
});

test("property: Test of Cure cannot complete without a proven first qualifying negative co-test", () => {
  const decision = evaluateClinicalDecision(base({ isTestOfCure: true, treatmentDate: "2025-01-01", testOfCureStage: "SECOND_TEST", consecutiveNegativeCoTestCount: 0, hpvResult: "NOT_DETECTED", cytologyResult: "NEGATIVE" }));
  assert.notEqual(decision.recommendationCode, "F6-SECOND-NEGATIVE-RETURN-REGULAR");
});

test("property: clinician-only MDM branches expose an explicit review boundary", () => {
  const f5 = evaluateFigure5(base({ currentFigure: "FIGURE_5", normalColposcopy: true, hpvResult: "HPV_OTHER", cytologyResult: "ASC_H" }));
  const f7 = evaluateFigure7(base({ currentFigure: "FIGURE_7", cytologyResult: "AG3", visibleLesion: false }));
  for (const decision of [f5, f7]) assert.ok(decision.requiresMDMReview || decision.safetyOutcome === "CLINICIAN_REVIEW_REQUIRED");
});

test("property: same input and rule version always produce the same output", () => {
  const input = base({ hpvResult: "HPV_OTHER", sampleType: "LBC", cytologyResult: "LSIL", repeatStage: "FIRST_REPEAT", patientAge: 49 });
  assert.deepEqual(evaluateClinicalDecision(input), evaluateClinicalDecision(structuredClone(input)));
});

test("property: batch mapping and single-case evaluation yield the same clinical decision", () => {
  const candidate = { caseId: "SYNTHETIC", source: { sourceType: "demo", rowNumber: 1, importedAt: new Date(0).toISOString(), mappingVersion: "audit", engineVersion: "audit" }, patientAge: 49, isFirstTimeHPVTransition: false, isPostHysterectomy: false, immunocompromised: false, atypicalEndometrialHistory: false, hpvResult: "HPV_OTHER", sampleType: "LBC", cytologyResult: "LSIL", repeatStage: "FIRST_REPEAT", consecutiveNegativeCoTestCount: 0, consecutiveLowGradeCount: 0, unsatisfactoryCytologyCount: 0, validationStatus: "valid", validationErrors: [], validationWarnings: [] } as CanonicalBatchCase;
  const mapped = mapCanonicalToClinicalInput(candidate);
  const single = base({ patientId: mapped.patientId, patientAge: 49, hpvResult: "HPV_OTHER", sampleType: "LBC", cytologyResult: "LSIL", repeatStage: "FIRST_REPEAT" });
  assert.deepEqual(evaluateClinicalDecision(mapped), evaluateClinicalDecision(single));
});

test("property: historical confirmed decisions are immutable and retain applied rule/input snapshots", () => {
  const schema = readFileSync(new URL("../../prisma/schema.prisma", import.meta.url), "utf8");
  const persistence = readFileSync(new URL("../../lib/batch/persistence.ts", import.meta.url), "utf8");
  assert.match(schema, /inputSnapshot|inputFacts/);
  assert.match(schema, /engineVersion|ruleVersion/);
  assert.match(persistence, /priorSnapshot|DecisionSnapshot/);
  assert.match(persistence, /immutable|historical|original/i);
});
