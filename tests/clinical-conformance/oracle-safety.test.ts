/**
 * Independent conformance probes. Expectations below come from the supplied
 * audit brief's stated national-pathway requirements, not engine branches.
 * These intentionally fail where the current proof-of-concept is unsafe.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { evaluateClinicalDecision } from "../../lib/engine/decision-engine";
import type { ClinicalInput } from "../../lib/engine/types";

const base: ClinicalInput = {
  patientId: "SYNTHETIC-AUDIT-ONLY",
  isFirstTimeHPVTransition: false,
  isPostHysterectomy: false,
  immunocompromised: false,
  atypicalEndometrialHistory: false,
  consecutiveNegativeCoTestCount: 0,
  consecutiveLowGradeCount: 0,
  unsatisfactoryCytologyCount: 0,
};

test("F3 missing sample type is an information stop, not a routine recall", () => {
  const actual = evaluateClinicalDecision({ ...base, hpvResult: "NOT_DETECTED" });
  assert.equal(actual.safetyOutcome, "INSUFFICIENT_INFORMATION");
});

test("F3 unknown immune-deficiency status is an information stop where recall differs", () => {
  const actual = evaluateClinicalDecision({ ...base, hpvResult: "NOT_DETECTED", sampleType: "LBC", immunocompromised: undefined as unknown as boolean });
  assert.equal(actual.safetyOutcome, "INSUFFICIENT_INFORMATION");
});

test("F6 missing treatment date stops before a Test-of-Cure disposition", () => {
  const actual = evaluateClinicalDecision({ ...base, isTestOfCure: true, hpvResult: "NOT_DETECTED", cytologyResult: "NEGATIVE" });
  assert.equal(actual.safetyOutcome, "INSUFFICIENT_INFORMATION");
});

test("age 70–74 with HPV 16/18 retains the HPV referral branch", () => {
  const actual = evaluateClinicalDecision({ ...base, patientAge: 70, hpvResult: "HPV_16_18", sampleType: "LBC" });
  assert.equal(actual.recommendationCode, "F3-1618-COLP");
});

test("F10 suspected cancer is referred without waiting for a co-test", () => {
  const actual = evaluateClinicalDecision({ ...base, hasAbnormalVaginalBleeding: true, abnormalCervix: true, suspicionOfCancer: true, coTestCompleted: false });
  assert.equal(actual.referralRequired, true);
  assert.equal(actual.riskLevel, "URGENT");
});
