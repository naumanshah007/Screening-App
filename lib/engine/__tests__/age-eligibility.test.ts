import test from "node:test";
import assert from "node:assert/strict";
import { evaluateClinicalDecision } from "../decision-engine";
import { baseInput } from "./helpers";

// R1 fix: age gates must not reassure when a high-grade/glandular/HPV-detected
// result or cancer suspicion is present. See docs/CERVIGRADE_R1_R3_FIX_PLAN.md.

test("under 25 + HSIL + HPV Other -> colposcopy, not reassurance", () => {
  const d = evaluateClinicalDecision(baseInput({ patientAge: 23, cytologyResult: "HSIL", hpvResult: "HPV_OTHER" }));
  assert.notEqual(d.recommendationCode, "AGE-UNDER-25");
  assert.notEqual(d.riskLevel, "LOW");
  assert.equal(d.referralType, "COLPOSCOPY");
  assert.equal(d.recallIntervalMonths, undefined);
});

test("under 25 + glandular AG3 -> Figure 7 specialist review, not routine exclusion", () => {
  const d = evaluateClinicalDecision(baseInput({ patientAge: 23, cytologyResult: "AG3" }));
  assert.equal(d.figure, "FIGURE_7");
  assert.notEqual(d.recommendationCode, "AGE-UNDER-25");
});

test("under 25 + AG1 with visible lesion + AIS biopsy -> Figure 7 type 3 excision, clinician review", () => {
  const d = evaluateClinicalDecision(baseInput({
    patientAge: 23,
    cytologyResult: "AG1",
    visibleLesion: true,
    biopsyResult: "AIS",
  }));
  assert.equal(d.figure, "FIGURE_7");
  assert.equal(d.recommendationCode, "F7-BIOPSY-AIS-TYPE3-EXCISION");
  assert.notEqual(d.riskLevel, "LOW");
});

test("under 25 asymptomatic with no abnormal result -> routine screening does not apply (safe)", () => {
  const d = evaluateClinicalDecision(baseInput({ patientAge: 24 }));
  assert.equal(d.recommendationCode, "AGE-UNDER-25");
  assert.equal(d.riskLevel, "LOW");
  assert.notEqual(d.referralType, "COLPOSCOPY");
});

test("under 25 with cancer symptoms flag -> does not reassure", () => {
  const d = evaluateClinicalDecision(baseInput({ patientAge: 22, hasCancerSymptoms: true }));
  assert.notEqual(d.recommendationCode, "AGE-UNDER-25");
});

test("25 + HPV not detected -> routine screening, 5-year recall", () => {
  const d = evaluateClinicalDecision(baseInput({ patientAge: 25, hpvResult: "NOT_DETECTED" }));
  assert.equal(d.figure, "FIGURE_3");
  assert.equal(d.recallIntervalMonths, 60);
});

test("70 + HPV not detected -> exit/discharge", () => {
  const d = evaluateClinicalDecision(baseInput({ patientAge: 70, hpvResult: "NOT_DETECTED" }));
  assert.equal(d.recommendationCode, "AGE-70-74-HPV-NOT-DETECTED-DISCHARGE");
  assert.equal(d.riskLevel, "LOW");
});

test("72 + HPV 16/18 -> colposcopy / clinician review, not 'offer final HPV screen'", () => {
  const d = evaluateClinicalDecision(baseInput({ patientAge: 72, hpvResult: "HPV_16_18" }));
  assert.equal(d.recommendationCode, "AGE-70-74-HPV-DETECTED-COLP");
  assert.equal(d.referralType, "COLPOSCOPY");
  assert.equal(d.safetyOutcome, "CLINICIAN_REVIEW_REQUIRED");
  assert.notEqual(d.recommendationCode, "AGE-70-74-DEFERRED");
});

test("72 + HPV Other -> colposcopy / clinician review, not routine recall", () => {
  const d = evaluateClinicalDecision(baseInput({ patientAge: 72, hpvResult: "HPV_OTHER" }));
  assert.equal(d.recommendationCode, "AGE-70-74-HPV-DETECTED-COLP");
  assert.equal(d.referralType, "COLPOSCOPY");
  assert.equal(d.recallIntervalMonths, undefined);
});

test("72 + no HPV result -> needs information, not reassurance", () => {
  const d = evaluateClinicalDecision(baseInput({ patientAge: 72 }));
  assert.equal(d.recommendationCode, "AGE-70-74-HPV-REQUIRED");
  assert.equal(d.safetyOutcome, "INSUFFICIENT_INFORMATION");
});

test("75 asymptomatic with no abnormal result -> discharge", () => {
  const d = evaluateClinicalDecision(baseInput({ patientAge: 75 }));
  assert.equal(d.recommendationCode, "AGE-75-DISCHARGE");
  assert.equal(d.riskLevel, "LOW");
});

test("76 + glandular AG1 -> not discharged, routed to Figure 7 specialist pathway", () => {
  const d = evaluateClinicalDecision(baseInput({ patientAge: 76, cytologyResult: "AG1" }));
  assert.notEqual(d.recommendationCode, "AGE-75-DISCHARGE");
  assert.equal(d.figure, "FIGURE_7");
});

test("76 + HPV 16/18 -> not discharged, escalates via Figure 3 colposcopy branch", () => {
  const d = evaluateClinicalDecision(baseInput({ patientAge: 76, hpvResult: "HPV_16_18" }));
  assert.notEqual(d.recommendationCode, "AGE-75-DISCHARGE");
  assert.equal(d.referralType, "COLPOSCOPY");
});
