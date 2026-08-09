import assert from "node:assert/strict";
import test from "node:test";

import { evaluateClinicalSnapshot } from "../evaluator";
import { loadGovernedSnapshot } from "../governed-snapshot-store";

const snapshotPromise = Promise.resolve(loadGovernedSnapshot("cg-ncsp-3.0.0"));

test("age 70-74 with any HPV detected is controlled by the exit-test colposcopy branch", async () => {
  const snapshot = await snapshotPromise;
  const evaluated = evaluateClinicalSnapshot(snapshot, {
    currentPathway: "FIGURE_3",
    isExitTest: true,
    ageYears: 72,
    hpvResult: "HPV_16_18",
    sampleType: "LBC",
  });
  assert.equal(evaluated.matchedRules[0]?.stableRuleId, "F3-16");
  assert.ok(evaluated.result.matchedRuleIds.includes("F3-03"));
  assert.match(evaluated.result.provisionalRecommendation, /colposcopy/i);
});

test("age 70-74 exit test with HPV not detected is controlled by discharge", async () => {
  const snapshot = await snapshotPromise;
  const evaluated = evaluateClinicalSnapshot(snapshot, {
    currentPathway: "FIGURE_3",
    isExitTest: true,
    ageYears: 72,
    hpvResult: "NOT_DETECTED",
    subsequentAbnormalResult: false,
    immuneClassification: "IMMUNE_COMPETENT",
    hasSymptoms: false,
  });
  assert.equal(evaluated.matchedRules[0]?.stableRuleId, "F3-15");
  assert.match(evaluated.result.provisionalRecommendation, /discharge/i);
});

test("unknown immune status cannot become a three- or five-year routine result", async () => {
  const snapshot = await snapshotPromise;
  const evaluated = evaluateClinicalSnapshot(snapshot, {
    currentPathway: "FIGURE_3",
    hpvResult: "NOT_DETECTED",
    sampleType: "LBC",
    hasSymptoms: false,
  });
  assert.equal(evaluated.result.clinicianOnly, true);
  assert.ok(evaluated.result.missingInformation.includes("immuneClassification"));
  assert.doesNotMatch(evaluated.result.provisionalRecommendation, /3 years|5 years/i);
});

test("malignant cytology in pregnancy outranks ordinary pregnancy and HPV routers", async () => {
  const snapshot = await snapshotPromise;
  const evaluated = evaluateClinicalSnapshot(snapshot, {
    currentPathway: "FIGURE_9",
    routingStage: "BEFORE_PATHWAY_SELECTION",
    isPregnant: true,
    hpvResult: "HPV_16_18",
    cytologyResult: "DEFINITE_INVASIVE_CANCER",
  });
  assert.equal(evaluated.matchedRules[0]?.stableRuleId, "F9-14");
  assert.ok(evaluated.result.matchedRuleIds.includes("GR-02"));
  assert.ok(evaluated.result.matchedRuleIds.includes("F9-08"));
  assert.equal(evaluated.result.urgency, "URGENT");
});

test("missing Test-of-Cure treatment anchor outranks ordinary ToC progression", async () => {
  const snapshot = await snapshotPromise;
  const evaluated = evaluateClinicalSnapshot(snapshot, {
    currentPathway: "FIGURE_6",
    tocEligibilityConfirmed: true,
    tocEligibilityBasis: "TREATED_HSIL_CIN2_3",
    treatmentConfirmed: false,
  });
  assert.equal(evaluated.matchedRules[0]?.stableRuleId, "F6-12");
  assert.match(evaluated.result.provisionalRecommendation, /request treatment records/i);
});

test("successful vault Test of Cure ends in screening cessation", async () => {
  const snapshot = await snapshotPromise;
  const evaluated = evaluateClinicalSnapshot(snapshot, {
    currentPathway: "FIGURE_8",
    hysterectomyType: "TOTAL",
    operativeReportStatus: "AVAILABLE",
    priorScreeningHistoryGroup: "TREATED_HSIL_TOC_COMPLETE",
    specimenPathologyClass: "NO_OR_LOW_GRADE",
    excisionCompleteness: "COMPLETE",
    sampleSite: "VAGINAL_VAULT",
    consecutiveQualifyingNegativeVaultCoTests: 2,
    monthsBetweenQualifyingVaultCoTests: 12,
  });
  assert.equal(evaluated.matchedRules[0]?.stableRuleId, "F8-11");
  assert.match(evaluated.result.provisionalRecommendation, /cease screening/i);
});

test("clinician-only branches never autonomously finalise", async () => {
  const snapshot = await snapshotPromise;
  const evaluated = evaluateClinicalSnapshot(snapshot, {
    clinicianOnlyBoundaryReached: true,
  });
  assert.equal(evaluated.matchedRules[0]?.stableRuleId, "GS-04");
  assert.equal(evaluated.result.clinicianOnly, true);
  assert.equal(evaluated.result.mandatoryReviewerConfirmation, true);
});
