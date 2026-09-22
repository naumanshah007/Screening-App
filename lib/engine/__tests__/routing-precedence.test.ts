import test from "node:test";
import assert from "node:assert/strict";
import { evaluateClinicalDecision } from "../decision-engine";
import { baseInput } from "./helpers";

test("Routing precedence sends abnormal bleeding under age 25 to Figure 10 instead of routine age gate", () => {
  const decision = evaluateClinicalDecision(baseInput({
    patientAge: 22,
    hasAbnormalVaginalBleeding: true,
    hasCancerSymptoms: true,
  }));

  assert.equal(decision.figure, "FIGURE_10");
  assert.equal(decision.recommendationCode, "F10-CANCER-SYMPTOMS-URGENT-GYN");
});

test("Routing precedence sends Test of Cure state to Figure 6 before glandular cytology", () => {
  const decision = evaluateClinicalDecision(baseInput({
    isTestOfCure: true,
    hpvResult: "HPV_OTHER",
    cytologyResult: "AG3",
  }));

  assert.equal(decision.figure, "FIGURE_6");
  assert.equal(decision.recommendationCode, "F6-HPV-DETECTED-ANY-CYTOLOGY-COLP");
});

test("Routing precedence sends first transition glandular cytology to Figure 7 unless Figure 2 history applies", () => {
  const figure7 = evaluateClinicalDecision(baseInput({
    isFirstTimeHPVTransition: true,
    cytologyResult: "AG3",
    screeningStatus: "REGULAR_SCREENING",
  }));
  const figure2 = evaluateClinicalDecision(baseInput({
    isFirstTimeHPVTransition: true,
    previousAtypicalEndometrialCells: true,
    ag2ReportDate: new Date().toISOString(),
  }));

  assert.equal(figure7.figure, "FIGURE_7");
  assert.equal(figure2.figure, "FIGURE_2");
});

test("Routing precedence sends total hysterectomy to Figure 8/Table 1 logic", () => {
  const decision = evaluateClinicalDecision(baseInput({
    isPostHysterectomy: true,
    hysterectomyType: "TOTAL",
    priorScreeningHistory: "NO_KNOWN_SCREENING_HISTORY",
    hysterectomySpecimenPathology: "NO_CERVICAL_PATHOLOGY",
  }));

  assert.equal(decision.figure, "FIGURE_8");
  assert.equal(decision.recommendationCode, "F8-NO-HISTORY-NO-PATH-LOWGRADE-HPV-6M");
});

// ── Unresolved high-grade history vs routine recall ──────────────────────────
//
// These lock in a fix for a routing gap: the prior-high-grade check used to sit
// only inside the isFirstTimeHPVTransition branch, so an HPV-era participant
// carried an unresolved episode straight past it into Figure 3, where a
// negative HPV result closed it at five-yearly recall.

test("Routing precedence diverts unresolved high-grade history to Figure 2 even when HPV is not detected", () => {
  const decision = evaluateClinicalDecision(baseInput({
    isFirstTimeHPVTransition: false,
    hpvResult: "NOT_DETECTED",
    priorHighGradeResult: true,
  }));

  assert.equal(decision.figure, "FIGURE_2");
  assert.notEqual(decision.recommendationCode, "F3-HPV-NOT-DETECTED-5Y");
  assert.equal(decision.recallIntervalMonths, undefined);
});

test("Routing precedence keeps a resolved Test of Cure on routine five-yearly recall", () => {
  for (const resolved of [
    { testOfCureStatus: "COMPLETE" as const },
    { testOfCureStatus: "SUCCESSFULLY_COMPLETED" as const },
    { priorScreeningHistory: "HIGH_GRADE_TOC_COMPLETE" as const },
  ]) {
    const decision = evaluateClinicalDecision(baseInput({
      hpvResult: "NOT_DETECTED",
      priorHighGradeResult: true,
      ...resolved,
    }));

    assert.equal(decision.figure, "FIGURE_3");
    assert.equal(decision.recommendationCode, "F3-HPV-NOT-DETECTED-5Y");
  }
});

test("Routing precedence leaves participants with no high-grade history on routine recall", () => {
  const routine = evaluateClinicalDecision(baseInput({ hpvResult: "NOT_DETECTED" }));
  assert.equal(routine.figure, "FIGURE_3");
  assert.equal(routine.recallIntervalMonths, 60);

  const immunocompromised = evaluateClinicalDecision(baseInput({
    hpvResult: "NOT_DETECTED",
    immunocompromised: true,
  }));
  assert.equal(immunocompromised.figure, "FIGURE_3");
  assert.equal(immunocompromised.recallIntervalMonths, 36);
});

test("Routing precedence keeps a declared Test of Cure episode on Figure 6, not Figure 2", () => {
  const decision = evaluateClinicalDecision(baseInput({
    isTestOfCure: true,
    previousHSILCIN23: true,
    priorHighGradeResult: true,
    priorScreeningHistory: "HIGH_GRADE_TOC_INCOMPLETE",
    hpvResult: "HPV_16_18",
    cytologyResult: "NEGATIVE",
  }));

  assert.equal(decision.figure, "FIGURE_6");
  assert.equal(decision.referralPriority, "P1");
});

// ── Previous HPV 16/18 episode with an unresolved referral outcome ───────────
//
// GS-01: a required clinical fact that is missing or unknown returns a safety
// stop, never a routine recall from a default. A previous HPV16/18 result
// mandated colposcopy; whether that happened decides whether routine screening
// is safe, and a negative HPV today does not answer it.

test("a negative HPV result does not close an episode whose HPV16/18 referral outcome is unknown", () => {
  const decision = evaluateClinicalDecision(baseInput({
    hpvResult: "NOT_DETECTED",
    previousHpv1618Episode: true,
    // Unknown, not false: nobody recorded what the colposcopy found.
  }));

  assert.equal(decision.recommendationCode, "F3-PREVIOUS-HPV1618-OUTCOME-REQUIRED");
  assert.equal(decision.safetyOutcome, "EXTERNAL_HISTORY_REQUIRED");
  assert.equal(decision.recallIntervalMonths, undefined);
});

test("a previous HPV16/18 episode with a completed colposcopy returns to routine screening", () => {
  const decision = evaluateClinicalDecision(baseInput({
    hpvResult: "NOT_DETECTED",
    previousHpv1618Episode: true,
    colposcopyCompletedForLastRecommendation: true,
  }));

  assert.equal(decision.recommendationCode, "F3-HPV-NOT-DETECTED-5Y");
  assert.equal(decision.recallIntervalMonths, 60);
});

test("a previous HPV16/18 episode is not treated as previous high-grade disease", () => {
  // Figure 2 entry is defined by previous HSIL / atypical glandular cytology
  // (F2-01). Genotype alone must not route there.
  const decision = evaluateClinicalDecision(baseInput({
    hpvResult: "HPV_OTHER",
    cytologyResult: "NEGATIVE",
    previousHpv1618Episode: true,
  }));

  assert.equal(decision.figure, "FIGURE_3");
  assert.notEqual(decision.figure, "FIGURE_2");
});
