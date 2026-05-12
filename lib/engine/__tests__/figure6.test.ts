import test from "node:test";
import assert from "node:assert/strict";
import { evaluateFigure6 } from "../decision-engine";
import { baseInput } from "./helpers";

test("Figure 6 first negative co-test repeats in 12 months", () => {
  const decision = evaluateFigure6(baseInput({ hpvResult: "NOT_DETECTED", cytologyResult: "NEGATIVE" }));

  assert.equal(decision.recommendationCode, "F6-FIRST-NEGATIVE-REPEAT-12M");
});

test("Figure 6 second negative co-test returns to regular screening", () => {
  const decision = evaluateFigure6(baseInput({ hpvResult: "NOT_DETECTED", cytologyResult: "NEGATIVE", testOfCureStage: "SECOND_TEST" }));

  assert.equal(decision.recommendationCode, "F6-SECOND-NEGATIVE-RETURN-REGULAR");
});

test("Figure 6 HPV detected any type routes to colposcopy, including first HPV Other", () => {
  const decision = evaluateFigure6(baseInput({ hpvResult: "HPV_OTHER", cytologyResult: "NEGATIVE" }));

  assert.equal(decision.recommendationCode, "F6-HPV-DETECTED-ANY-CYTOLOGY-COLP");
  assert.equal(decision.referralType, "COLPOSCOPY");
});

test("Figure 6 HPV 16/18 and HPV Other route to colposcopy across cytology classes", () => {
  const detectedHpvResults = ["HPV_16_18", "HPV_OTHER"] as const;
  const cytologyResults = ["NEGATIVE", "ASC_US", "LSIL", "ASC_H", "HSIL", "SCC"] as const;

  for (const hpvResult of detectedHpvResults) {
    for (const cytologyResult of cytologyResults) {
      const decision = evaluateFigure6(baseInput({ hpvResult, cytologyResult }));

      assert.equal(decision.recommendationCode, "F6-HPV-DETECTED-ANY-CYTOLOGY-COLP", `${hpvResult} + ${cytologyResult}`);
      assert.equal(decision.referralType, "COLPOSCOPY", `${hpvResult} + ${cytologyResult}`);
    }
  }
});

test("Figure 6 HPV not detected with low-grade cytology repeats in 12 months", () => {
  const decision = evaluateFigure6(baseInput({ hpvResult: "NOT_DETECTED", cytologyResult: "LSIL" }));

  assert.equal(decision.recommendationCode, "F6-HPV-NEG-LOW-GRADE-REPEAT-12M");
});

test("Figure 6 repeat HPV not detected with abnormal cytology routes to colposcopy", () => {
  const decision = evaluateFigure6(baseInput({
    hpvResult: "NOT_DETECTED",
    cytologyResult: "LSIL",
    testOfCureStage: "SECOND_TEST",
  }));

  assert.equal(decision.recommendationCode, "F6-REPEAT-HPV-NEG-CYTOLOGY-ABNORMAL-COLP");
  assert.equal(decision.referralType, "COLPOSCOPY");
});

test("Figure 6 continuing Test of Cure HPV not detected with negative cytology continues until complete", () => {
  const decision = evaluateFigure6(baseInput({
    hpvResult: "NOT_DETECTED",
    cytologyResult: "NEGATIVE",
    testOfCureStage: "CONTINUING",
  }));

  assert.equal(decision.recommendationCode, "F6-CONTINUE-TOC-UNTIL-COMPLETE");
});

test("Figure 6 HPV not detected with high-grade cytology routes to colposcopy", () => {
  const decision = evaluateFigure6(baseInput({ hpvResult: "NOT_DETECTED", cytologyResult: "ASC_H" }));

  assert.equal(decision.recommendationCode, "F6-HPV-NEG-HIGH-GRADE-COLP");
});
