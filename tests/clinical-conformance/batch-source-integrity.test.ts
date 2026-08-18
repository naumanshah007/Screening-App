import assert from "node:assert/strict";
import test from "node:test";
import { mapCanonicalToClinicalInput } from "../../lib/batch/processor";
import { validateBatchRows } from "../../lib/batch/validation";
import type { CanonicalBatchCase } from "../../lib/batch/types";

function batch(overrides: Partial<CanonicalBatchCase> = {}): CanonicalBatchCase {
  return { caseId: "SYNTHETIC-BATCH", source: { sourceType: "demo", rowNumber: 1, importedAt: new Date(0).toISOString(), mappingVersion: "audit", engineVersion: "audit" }, isFirstTimeHPVTransition: false, isPostHysterectomy: false, immunocompromised: false, atypicalEndometrialHistory: false, consecutiveNegativeCoTestCount: 0, consecutiveLowGradeCount: 0, unsatisfactoryCytologyCount: 0, validationStatus: "valid", validationErrors: [], validationWarnings: [], ...overrides };
}

test("AUD-005: active bleeding does not fabricate history, examination, co-test, treatment, or resolution facts", () => {
  const mapped = mapCanonicalToClinicalInput(batch({ hasAbnormalVaginalBleeding: true, bleedingType: "POST_COITAL" }));
  assert.equal(mapped.menstrualHistoryCaptured, undefined);
  assert.equal(mapped.contraceptiveHistoryCaptured, undefined);
  assert.equal(mapped.sexualHistoryCaptured, undefined);
  assert.equal(mapped.speculumExamCompleted, undefined);
  assert.equal(mapped.pelvicExamCompleted, undefined);
  assert.equal(mapped.coTestCompleted, undefined);
  assert.equal(mapped.oralContraceptiveAdjusted, undefined);
  assert.equal(mapped.stiTreated, undefined);
});

test("batch validation preserves unknown immune status instead of converting it to false", () => {
  const result = validateBatchRows([{ _rowIndex: 0, _sourceFields: ["hpvResult", "sampleType"], hpvResult: "NOT_DETECTED", sampleType: "LBC" }], { sourceType: "demo", mappingVersion: "audit", engineVersion: "audit" });
  assert.equal(result.cases[0].immunocompromised, undefined);
  assert.notEqual(result.cases[0].validationStatus, "valid");
});

test("batch canonical model and mapper preserve the Test-of-Cure treatment date", () => {
  const candidate = batch({ isTestOfCure: true, hpvResult: "NOT_DETECTED", cytologyResult: "NEGATIVE" }) as CanonicalBatchCase & { treatmentDate?: string };
  candidate.treatmentDate = "2025-01-01";
  const mapped = mapCanonicalToClinicalInput(candidate);
  assert.equal(mapped.treatmentDate, "2025-01-01");
});

test("batch and single-case source facts preserve sample type, genotype, cytology, and repeat stage", () => {
  const mapped = mapCanonicalToClinicalInput(batch({ sampleType: "SWAB", hpvResult: "HPV_OTHER", cytologyResult: "LSIL", repeatStage: "FIRST_REPEAT" }));
  assert.deepEqual({ sampleType: mapped.sampleType, hpvResult: mapped.hpvResult, cytologyResult: mapped.cytologyResult, repeatStage: mapped.repeatStage }, { sampleType: "SWAB", hpvResult: "HPV_OTHER", cytologyResult: "LSIL", repeatStage: "FIRST_REPEAT" });
});
