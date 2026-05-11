import test from "node:test";
import assert from "node:assert/strict";
import { evaluateClinicalDecision, evaluateFigure9 } from "../decision-engine";
import { baseInput } from "./helpers";

test("Figure 9 applies only to pregnant participants with qualifying cytology", () => {
  const decision = evaluateClinicalDecision(baseInput({ isPregnant: true, hpvResult: "NOT_DETECTED", cytologyResult: "NEGATIVE" }));

  assert.notEqual(decision.figure, "FIGURE_9");
});

test("Figure 9 initial pregnant high-grade cytology routes to colposcopy", () => {
  const decision = evaluateFigure9(baseInput({ isPregnant: true, cytologyResult: "HSIL" }));

  assert.equal(decision.recommendationCode, "F9-INITIAL-COLPOSCOPY");
});

test("Figure 9 qualifying cytology categories route pregnant participants to initial colposcopy", () => {
  const qualifyingCytology = ["ASC_H", "HSIL", "AG1", "AG2", "AG3", "AG4", "AG5", "AC1", "AC2", "AC3", "AC4"] as const;

  for (const cytologyResult of qualifyingCytology) {
    const decision = evaluateClinicalDecision(baseInput({ isPregnant: true, cytologyResult }));

    assert.equal(decision.figure, "FIGURE_9", cytologyResult);
    assert.equal(decision.recommendationCode, "F9-INITIAL-COLPOSCOPY", cytologyResult);
    assert.equal(decision.referralType, "COLPOSCOPY", cytologyResult);
  }
});

test("Figure 9 normal TZ/no lesion requires MDM", () => {
  const decision = evaluateFigure9(baseInput({ isPregnant: true, cytologyResult: "ASC_H", transformationZoneState: "NORMAL" }));

  assert.equal(decision.recommendationCode, "F9-NORMAL-TZ-MDM");
});

test("Figure 9 invasion impression requires biopsy before oncology", () => {
  const decision = evaluateFigure9(baseInput({ isPregnant: true, cytologyResult: "HSIL", transformationZoneState: "ABNORMAL", colposcopicImpression: "INVASION" }));

  assert.equal(decision.recommendationCode, "F9-INVASION-IMPRESSION-BIOPSY");
});

test("Figure 9 biopsy positive for invasion routes to oncology", () => {
  const decision = evaluateFigure9(baseInput({
    isPregnant: true,
    cytologyResult: "HSIL",
    transformationZoneState: "ABNORMAL",
    colposcopicImpression: "INVASION",
    biopsyPositiveForInvasion: true,
  }));

  assert.equal(decision.recommendationCode, "F9-BIOPSY-POSITIVE-INVASION-ONCOLOGY");
});

test("Figure 9 abnormal TZ LSIL/HSIL/AIS impression routes to colposcopy review", () => {
  assert.equal(evaluateFigure9(baseInput({ isPregnant: true, cytologyResult: "HSIL", transformationZoneState: "ABNORMAL", colposcopicImpression: "LSIL" })).recommendationCode, "F9-ABNORMAL-TZ-REVIEW");
  assert.equal(evaluateFigure9(baseInput({ isPregnant: true, cytologyResult: "HSIL", transformationZoneState: "ABNORMAL", colposcopicImpression: "HSIL" })).recommendationCode, "F9-ABNORMAL-TZ-REVIEW");
  assert.equal(evaluateFigure9(baseInput({ isPregnant: true, cytologyResult: "HSIL", transformationZoneState: "ABNORMAL", colposcopicImpression: "AIS" })).recommendationCode, "F9-ABNORMAL-TZ-REVIEW");
});
