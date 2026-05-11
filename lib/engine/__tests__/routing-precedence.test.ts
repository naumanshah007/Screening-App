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
  assert.equal(decision.recommendationCode, "F8-NO-KNOWN-HISTORY-HPV-6M");
});
