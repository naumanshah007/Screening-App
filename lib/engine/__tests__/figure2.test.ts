import test from "node:test";
import assert from "node:assert/strict";
import { evaluateFigure2 } from "../decision-engine";
import { baseInput } from "./helpers";

test("Figure 2 sends outstanding recommended colposcopy to colposcopy", () => {
  const decision = evaluateFigure2(baseInput({
    priorHighGradeResult: true,
    colposcopyRecommendedInLastCytology: true,
    colposcopyCompletedForLastRecommendation: false,
  }));

  assert.equal(decision.recommendationCode, "F2-PRIOR-HG-COLP");
  assert.equal(decision.referralType, "COLPOSCOPY");
});

test("Figure 2 sends prior high-grade with incomplete ToC to Test of Cure", () => {
  const decision = evaluateFigure2(baseInput({
    priorHighGradeResult: true,
    testOfCureStatus: "INCOMPLETE",
  }));

  assert.equal(decision.recommendationCode, "F2-PRIOR-HG-COMPLETE-TOC");
});

test("Figure 2 routes atypical endometrial cells older than 3 years to Figure 3", () => {
  const decision = evaluateFigure2(baseInput({
    previousAtypicalEndometrialCells: true,
    ag2ReportDate: "2020-01-01",
  }));

  assert.equal(decision.recommendationCode, "F2-AG2-OLDER-3Y-FIG3");
});

test("Figure 2 routes atypical endometrial cells returned to 3-yearly cytology to Figure 3", () => {
  const decision = evaluateFigure2(baseInput({
    previousAtypicalEndometrialCells: true,
    returnedTo3YearlyCytologyScreening: true,
  }));

  assert.equal(decision.recommendationCode, "F2-AG2-RETURNED-3Y-CYTOLOGY-FIG3");
});

test("Figure 2 routes atypical endometrial cells otherwise to specialist gynaecology", () => {
  const decision = evaluateFigure2(baseInput({
    previousAtypicalEndometrialCells: true,
    ag2ReportDate: new Date().toISOString(),
    returnedTo3YearlyCytologyScreening: false,
  }));

  assert.equal(decision.recommendationCode, "F2-AG2-SPECIALIST-GYN");
  assert.equal(decision.referralType, "GYNAECOLOGY");
});

test("Figure 2 marks previous AIS/no hysterectomy as service-defined post-treatment follow-up", () => {
  const decision = evaluateFigure2(baseInput({ previousAIS: true }));

  assert.equal(decision.recommendationCode, "F2-AIS-R208-FOLLOWUP");
  assert.equal(decision.safetyOutcome, "CLINICIAN_REVIEW_REQUIRED");
});
