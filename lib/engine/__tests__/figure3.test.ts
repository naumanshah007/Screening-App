import test from "node:test";
import assert from "node:assert/strict";
import { evaluateFigure3 } from "../decision-engine";
import { baseInput } from "./helpers";

test("Figure 3 returns HPV not detected to 5 years, or 3 years if immune deficient", () => {
  assert.equal(evaluateFigure3(baseInput({ hpvResult: "NOT_DETECTED" })).recallIntervalMonths, 60);
  assert.equal(evaluateFigure3(baseInput({ hpvResult: "NOT_DETECTED", immunocompromised: true })).recallIntervalMonths, 36);
});

test("Figure 3 routes HPV 16/18 to colposcopy even when cytology is pending", () => {
  const decision = evaluateFigure3(baseInput({ hpvResult: "HPV_16_18", sampleType: "LBC" }));

  assert.equal(decision.recommendationCode, "F3-1618-COLP");
  assert.equal(decision.referralType, "COLPOSCOPY");
});

test("Figure 3 requires a return visit for HPV detected on swab before cytology-dependent decision", () => {
  const decision = evaluateFigure3(baseInput({ hpvResult: "HPV_OTHER", sampleType: "SWAB" }));

  assert.equal(decision.recommendationCode, "F3-SWAB-RETURN-REQUIRED");
});

test("Figure 3 baseline HPV Other with ASC-US/LSIL schedules first repeat", () => {
  const ascus = evaluateFigure3(baseInput({ hpvResult: "HPV_OTHER", cytologyResult: "ASC_US" }));
  const lsil = evaluateFigure3(baseInput({ hpvResult: "HPV_OTHER", cytologyResult: "LSIL" }));

  assert.equal(ascus.recommendationCode, "F3-HPV-OTHER-NEG-ASCUS-LSIL-12M");
  assert.equal(lsil.recommendationCode, "F3-HPV-OTHER-NEG-ASCUS-LSIL-12M");
});

test("Figure 3 first repeat HPV Other low-grade cytology routes by age", () => {
  const over50 = evaluateFigure3(baseInput({
    hpvResult: "HPV_OTHER",
    cytologyResult: "LSIL",
    repeatStage: "FIRST_REPEAT",
    patientAge: 52,
  }));
  const under50 = evaluateFigure3(baseInput({
    hpvResult: "HPV_OTHER",
    cytologyResult: "ASC_US",
    repeatStage: "FIRST_REPEAT",
    patientAge: 49,
  }));

  assert.equal(over50.recommendationCode, "F3-FIRST-REPEAT-AGE50-COLP");
  assert.equal(under50.recommendationCode, "F3-FIRST-REPEAT-UNDER50-SECOND-REPEAT");
});

test("Figure 3 second repeat HPV detected any type routes to colposcopy", () => {
  const decision = evaluateFigure3(baseInput({
    hpvResult: "HPV_OTHER",
    cytologyResult: "NEGATIVE",
    repeatStage: "SECOND_REPEAT",
  }));

  assert.equal(decision.recommendationCode, "F3-SECOND-REPEAT-HPV-DETECTED-COLP");
  assert.equal(decision.referralType, "COLPOSCOPY");
});
