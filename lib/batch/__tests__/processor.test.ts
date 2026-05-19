import test from "node:test";
import assert from "node:assert/strict";
import { processBatch, mapCanonicalToClinicalInput } from "../processor";
import { DEMO_DATASET } from "../demo-dataset";

test("processBatch processes all 14 demo rows successfully", () => {
  const result = processBatch(DEMO_DATASET);
  assert.equal(result.processedCount, 14);
  assert.equal(result.errorCount, 0);
  assert.equal(result.results.length, 14);
});

test("every demo row produces a valid decision with required fields", () => {
  const result = processBatch(DEMO_DATASET);
  for (const r of result.results) {
    assert.equal(r.status, "success", `Row ${r.case.label} failed: ${r.error}`);
    assert.ok(r.decision.figure, `Missing figure for ${r.case.label}`);
    assert.ok(r.decision.riskLevel, `Missing riskLevel for ${r.case.label}`);
    assert.ok(r.decision.recommendation, `Missing recommendation for ${r.case.label}`);
    assert.ok(r.decision.recommendationCode, `Missing recommendationCode for ${r.case.label}`);
    assert.ok(r.decision.nextAction, `Missing nextAction for ${r.case.label}`);
    assert.ok(r.processingTimeMs >= 0, `Invalid processingTimeMs for ${r.case.label}`);
  }
});

test("demo row 1 (HPV Negative) routes to Figure 3 with LOW risk", () => {
  const result = processBatch([DEMO_DATASET[0]]);
  const decision = result.results[0].decision;
  assert.equal(decision.figure, "FIGURE_3");
  assert.equal(decision.riskLevel, "LOW");
});

test("demo row 2 (HPV 16/18) routes to colposcopy referral", () => {
  const result = processBatch([DEMO_DATASET[1]]);
  const decision = result.results[0].decision;
  assert.equal(decision.referralRequired, true);
  assert.equal(decision.referralType, "COLPOSCOPY");
});

test("demo row 6 (immunocompromised) gets 3yr recall not 5yr", () => {
  const result = processBatch([DEMO_DATASET[5]]);
  const decision = result.results[0].decision;
  assert.equal(decision.recallIntervalMonths, 36);
});

test("demo row 7 (post-hysterectomy) routes to Figure 8", () => {
  const result = processBatch([DEMO_DATASET[6]]);
  const decision = result.results[0].decision;
  assert.equal(decision.figure, "FIGURE_8");
});

test("demo row 10 (abnormal bleeding + cancer) routes to Figure 10 urgent", () => {
  const result = processBatch([DEMO_DATASET[9]]);
  const decision = result.results[0].decision;
  assert.equal(decision.figure, "FIGURE_10");
  assert.equal(decision.riskLevel, "URGENT");
});

test("demo row 13 (first HPV transition) routes to Figure 1", () => {
  const result = processBatch([DEMO_DATASET[12]]);
  const decision = result.results[0].decision;
  assert.equal(decision.figure, "FIGURE_1");
});

test("processBatch skips invalid rows by default", () => {
  const invalidCase = {
    ...DEMO_DATASET[0],
    caseId: crypto.randomUUID(),
    validationStatus: "invalid" as const,
    validationErrors: [{ field: "test", message: "test error", severity: "error" as const }],
  };
  const result = processBatch([invalidCase, DEMO_DATASET[0]]);
  assert.equal(result.processedCount, 1);
});

test("processBatch includes invalid rows when requested", () => {
  const invalidCase = {
    ...DEMO_DATASET[0],
    caseId: crypto.randomUUID(),
    validationStatus: "invalid" as const,
    validationErrors: [{ field: "test", message: "test error", severity: "error" as const }],
  };
  const result = processBatch([invalidCase, DEMO_DATASET[0]], { includeInvalid: true });
  assert.equal(result.results.length, 2);
});

test("processBatch result contains aggregate metadata", () => {
  const result = processBatch(DEMO_DATASET);
  assert.ok(result.totalTimeMs >= 0);
  assert.equal(result.sourceType, "demo");
  assert.ok(result.processedAt);
  assert.ok(result.engineVersion);
});

test("mapCanonicalToClinicalInput produces valid ClinicalInput", () => {
  const input = mapCanonicalToClinicalInput(DEMO_DATASET[0]);
  assert.ok(input.patientId.startsWith("batch-"));
  assert.equal(input.isFirstTimeHPVTransition, false);
  assert.equal(input.isPostHysterectomy, false);
  assert.equal(input.immunocompromised, false);
  assert.equal(input.atypicalEndometrialHistory, false);
  assert.equal(input.consecutiveNegativeCoTestCount, 0);
  assert.equal(input.hpvResult, "NOT_DETECTED");
});
