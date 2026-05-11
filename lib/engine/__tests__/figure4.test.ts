import test from "node:test";
import assert from "node:assert/strict";
import { evaluateFigure4 } from "../decision-engine";
import { baseInput } from "./helpers";

const normal = { normalColposcopy: true, repeatContext: "POST_NORMAL_COLPOSCOPY_LOW_GRADE_CYTOLOGY" as const };

test("Figure 4 initial normal colposcopy schedules repeat HPV in 12 months", () => {
  const decision = evaluateFigure4(baseInput(normal));

  assert.equal(decision.recommendationCode, "F4-NORMAL-COLP-REPEAT-HPV-12M");
});

test("Figure 4 repeat HPV not detected returns to regular screening", () => {
  const decision = evaluateFigure4(baseInput({ ...normal, hpvResult: "NOT_DETECTED", repeatStage: "FIRST_REPEAT" }));

  assert.equal(decision.recommendationCode, "F4-REPEAT-HPV-NOT-DETECTED-REGULAR");
});

test("Figure 4 repeat HPV 16/18 routes to colposcopy", () => {
  const decision = evaluateFigure4(baseInput({ ...normal, hpvResult: "HPV_16_18", repeatStage: "FIRST_REPEAT" }));

  assert.equal(decision.recommendationCode, "F4-REPEAT-1618-COLP");
});

test("Figure 4 HPV Other with high-grade cytology routes to colposcopy", () => {
  const decision = evaluateFigure4(baseInput({ ...normal, hpvResult: "HPV_OTHER", cytologyResult: "ASC_H", repeatStage: "FIRST_REPEAT" }));

  assert.equal(decision.recommendationCode, "F4-HPV-OTHER-HIGH-GRADE-COLP");
});

test("Figure 4 HPV Other low-grade cytology routes immune deficient participants to colposcopy", () => {
  const decision = evaluateFigure4(baseInput({ ...normal, hpvResult: "HPV_OTHER", cytologyResult: "LSIL", immunocompromised: true }));

  assert.equal(decision.recommendationCode, "F4-HPV-OTHER-LOW-GRADE-IC-COLP");
});

test("Figure 4 second repeat HPV detected any type routes to colposcopy", () => {
  const decision = evaluateFigure4(baseInput({ ...normal, hpvResult: "HPV_OTHER", repeatStage: "SECOND_REPEAT" }));

  assert.equal(decision.recommendationCode, "F4-SECOND-REPEAT-HPV-DETECTED-COLP");
});
