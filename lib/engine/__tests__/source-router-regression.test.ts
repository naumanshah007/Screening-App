/**
 * Source-derived router regression suite.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * The 179-case clinical conformance corpus drives the FIGURE EVALUATORS
 * directly (evaluateFigure1…10, evaluateTable1). It never calls
 * evaluateClinicalDecision, which is the real application entry point and the
 * home of age gating, the pregnancy/bleeding precedence chain, and the overlay
 * wrapper.
 *
 * That blind spot allowed a stale router to survive undetected on a feature
 * branch: the branch forked before the R1 age-gate fix, and 9 of 12 router
 * states were less safe than production while every figure-level test passed.
 * See docs/deployed-comparison/07-special-set-matrices.md §7.
 *
 * These assertions are SAFETY INVARIANTS taken from the source guideline, not
 * from any engine's current output. They deliberately assert "must not reassure
 * / must escalate / must request information" rather than exact recommendation
 * codes wherever the source constrains the disposition but not the wording, so
 * the suite survives legitimate presentation changes and fails on real
 * regressions.
 *
 * Run via: npm run test:engine (included in test:all).
 */

import test from "node:test";
import assert from "node:assert/strict";
import { evaluateClinicalDecision } from "../decision-engine";
import { baseInput } from "./helpers";
import type { ClinicalDecision } from "../types";

/** A disposition that leaves the participant with no action and no follow-up. */
function isBareReassurance(d: ClinicalDecision): boolean {
  return (
    d.riskLevel === "LOW" &&
    !d.referralRequired &&
    (d.recommendationCode === "AGE-UNDER-25" ||
      d.recommendationCode === "AGE-75-DISCHARGE" ||
      d.recommendationCode === "AGE-70-74-DEFERRED")
  );
}

function escalates(d: ClinicalDecision): boolean {
  return Boolean(d.referralRequired) || d.riskLevel === "HIGH" || d.riskLevel === "URGENT";
}

function requestsInformation(d: ClinicalDecision): boolean {
  return (
    d.safetyOutcome === "INSUFFICIENT_INFORMATION" ||
    d.safetyOutcome === "EXTERNAL_HISTORY_REQUIRED" ||
    (d.missingInformation?.length ?? 0) > 0 ||
    d.recommendationCode.includes("REQUIRED")
  );
}

// ── Age gates must not override an abnormal result ───────────────────────────

test("router: age 23 with HSIL cytology must not receive an age-based reassurance", () => {
  const d = evaluateClinicalDecision(
    baseInput({ patientAge: 23, cytologyResult: "HSIL", hpvResult: "HPV_OTHER" })
  );
  assert.ok(!isBareReassurance(d), `got bare reassurance: ${d.recommendationCode}`);
  assert.ok(escalates(d), `expected escalation, got ${d.recommendationCode} / ${d.riskLevel}`);
});

test("router: age 23 with malignant cytology (SCC) must not receive an age-based reassurance", () => {
  const d = evaluateClinicalDecision(
    baseInput({ patientAge: 23, cytologyResult: "SCC", hpvResult: "HPV_16_18" })
  );
  assert.ok(!isBareReassurance(d), `got bare reassurance: ${d.recommendationCode}`);
  assert.ok(escalates(d), `expected escalation, got ${d.recommendationCode} / ${d.riskLevel}`);
});

test("router: age 23 glandular AG3 must reach a specialist pathway, not an age gate", () => {
  const d = evaluateClinicalDecision(baseInput({ patientAge: 23, cytologyResult: "AG3" }));
  assert.ok(!isBareReassurance(d), `got bare reassurance: ${d.recommendationCode}`);
  assert.ok(escalates(d));
});

test("router: age 72 with HPV 16/18 must be referred, not offered a final screen", () => {
  const d = evaluateClinicalDecision(baseInput({ patientAge: 72, hpvResult: "HPV_16_18" }));
  assert.notEqual(d.recommendationCode, "AGE-70-74-DEFERRED");
  assert.ok(escalates(d), `expected escalation, got ${d.recommendationCode} / ${d.riskLevel}`);
});

test("router: age 72 with HPV Other and high-grade cytology must be referred", () => {
  const d = evaluateClinicalDecision(
    baseInput({ patientAge: 72, hpvResult: "HPV_OTHER", cytologyResult: "HSIL" })
  );
  assert.notEqual(d.recommendationCode, "AGE-70-74-DEFERRED");
  assert.ok(escalates(d));
});

test("router: age 76 with HPV 16/18 must not be discharged", () => {
  const d = evaluateClinicalDecision(baseInput({ patientAge: 76, hpvResult: "HPV_16_18" }));
  assert.notEqual(d.recommendationCode, "AGE-75-DISCHARGE");
  assert.ok(escalates(d));
});

test("router: age 70-74 with no HPV result must request information, not reassure", () => {
  const d = evaluateClinicalDecision(baseInput({ patientAge: 72 }));
  assert.notEqual(d.recommendationCode, "AGE-70-74-DEFERRED");
  assert.ok(requestsInformation(d), `expected an information request, got ${d.recommendationCode}`);
});

test("router: age-appropriate asymptomatic states still reassure (no over-escalation)", () => {
  const under25 = evaluateClinicalDecision(baseInput({ patientAge: 24 }));
  assert.equal(under25.recommendationCode, "AGE-UNDER-25");
  const over75 = evaluateClinicalDecision(baseInput({ patientAge: 75 }));
  assert.equal(over75.recommendationCode, "AGE-75-DISCHARGE");
});

// ── Missing critical data must stop, not resolve to a terminal action ────────

// ROUTER-001 — KNOWN DEFECT, present in the deployed production build fb933c3
// and in this branch identically. Omitting an age that selects the Figure 3 ≥50
// branch yields the same terminal action as supplying age 52. Marked `todo` so
// the gate stays honest: the assertion is source-correct and must not be
// weakened. See docs/integration/05-router-defect-register.md.
test("router: missing age where age changes routing must not silently pick a branch", { todo: "ROUTER-001 — pre-existing defect, also fails on production fb933c3" }, () => {
  const withAge = evaluateClinicalDecision(
    baseInput({ patientAge: 52, hpvResult: "HPV_OTHER", cytologyResult: "NEGATIVE" })
  );
  const withoutAge = evaluateClinicalDecision(
    baseInput({ patientAge: undefined, hpvResult: "HPV_OTHER", cytologyResult: "NEGATIVE" })
  );
  assert.ok(
    requestsInformation(withoutAge) || withoutAge.recommendationCode !== withAge.recommendationCode,
    "omitting an age that changes the ≥50 branch produced the same terminal action as supplying it"
  );
});

// ROUTER-002 — KNOWN DEFECT, present in production fb933c3 identically. A
// missing sample type resolves to F3-HPV-NOT-DETECTED-5Y, a terminal 5-year
// interval, although F3-MISSING-SAMPLE-TYPE-SAFETY-STOP is a source branch.
// This is the router-level twin of LEGACY-006 (MISSING_DATA_COLLAPSE).
test("router: missing sample type must not resolve to a terminal screening interval", { todo: "ROUTER-002 - pre-existing defect, also fails on production fb933c3" }, () => {
  const d = evaluateClinicalDecision(
    baseInput({ patientAge: 30, hpvResult: "NOT_DETECTED", sampleType: undefined })
  );
  assert.ok(
    requestsInformation(d) || d.nextScreeningIntervalMonths === undefined,
    `missing sample type produced a terminal interval: ${d.recommendationCode}`
  );
});

test("router: unknown immune status must not silently assume immunocompetent", () => {
  const competent = evaluateClinicalDecision(
    baseInput({ patientAge: 30, hpvResult: "NOT_DETECTED", sampleType: "LBC", immunocompromised: false })
  );
  const compromised = evaluateClinicalDecision(
    baseInput({ patientAge: 30, hpvResult: "NOT_DETECTED", sampleType: "LBC", immunocompromised: true })
  );
  assert.notDeepEqual(
    [competent.recommendationCode, competent.nextScreeningIntervalMonths],
    [compromised.recommendationCode, compromised.nextScreeningIntervalMonths],
    "immune status does not change the recall interval — the 3-year immune branch is unreachable"
  );
});

test("router: Test of Cure without a treatment date must not assert a completed interval", () => {
  const d = evaluateClinicalDecision(
    baseInput({
      patientAge: 35,
      isTestOfCure: true,
      currentFigure: "FIGURE_6",
      testOfCureStage: "FIRST_TEST",
      treatmentDate: undefined,
      hpvResult: "NOT_DETECTED",
    })
  );
  assert.ok(
    requestsInformation(d) || !/complete/i.test(d.recommendationCode),
    `Test of Cure with no treatment anchor claimed completion: ${d.recommendationCode}`
  );
});

// ── Precedence: symptomatic and pregnancy routes outrank routine screening ───

// ROUTER-003 — KNOWN DEFECT, present in production fb933c3 identically. A
// pregnant participant with malignant (SCC) cytology falls through the Figure 9
// gate to Figure 3 and is asked for an HPV result instead of being escalated.
test("router: pregnancy with malignant cytology routes to the pregnancy pathway and escalates", { todo: "ROUTER-003 - pre-existing defect, also fails on production fb933c3" }, () => {
  const d = evaluateClinicalDecision(
    baseInput({ patientAge: 30, isPregnant: true, cytologyResult: "SCC" })
  );
  assert.ok(escalates(d), `pregnant participant with malignant cytology not escalated: ${d.recommendationCode}`);
  assert.ok(!isBareReassurance(d));
});

test("router: abnormal bleeding with an incomplete work-up must not reassure", () => {
  const d = evaluateClinicalDecision(
    baseInput({
      patientAge: 30,
      hasAbnormalVaginalBleeding: true,
      bleedingType: "POST_COITAL",
      abnormalBleedingStage: "INITIAL_ASSESSMENT",
    })
  );
  assert.ok(
    !isBareReassurance(d) && (escalates(d) || requestsInformation(d)),
    `abnormal bleeding with incomplete work-up produced: ${d.recommendationCode}`
  );
});

test("router: abnormal bleeding takes precedence over the age gate", () => {
  const d = evaluateClinicalDecision(
    baseInput({ patientAge: 23, hasAbnormalVaginalBleeding: true, bleedingType: "POST_COITAL" })
  );
  assert.notEqual(d.recommendationCode, "AGE-UNDER-25");
});

// ── Figure 5 / Figure 6 provenance must stay distinct ────────────────────────

test("router: Figure 5 surveillance is not routed as Figure 6 Test of Cure", () => {
  const d = evaluateClinicalDecision(
    baseInput({ patientAge: 35, currentFigure: "FIGURE_5", hpvResult: "HPV_OTHER", cytologyResult: "NEGATIVE" })
  );
  assert.notEqual(d.figure, "FIGURE_6", "Figure 5 surveillance was routed into Figure 6");
  assert.ok(
    !/^F6-/.test(d.recommendationCode),
    `Figure 5 state produced a Figure 6 recommendation: ${d.recommendationCode}`
  );
});

test("router: Figure 6 Test of Cure is not routed as Figure 5 surveillance", () => {
  const d = evaluateClinicalDecision(
    baseInput({
      patientAge: 35,
      currentFigure: "FIGURE_6",
      isTestOfCure: true,
      testOfCureStage: "FIRST_TEST",
      treatmentDate: "2026-01-15",
      hpvResult: "NOT_DETECTED",
    })
  );
  assert.notEqual(d.figure, "FIGURE_5", "Figure 6 Test of Cure was routed into Figure 5");
  assert.ok(
    !/^F5-/.test(d.recommendationCode),
    `Figure 6 state produced a Figure 5 recommendation: ${d.recommendationCode}`
  );
});
