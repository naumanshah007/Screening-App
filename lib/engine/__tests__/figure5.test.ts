import test from "node:test";
import assert from "node:assert/strict";
import { evaluateFigure5 } from "../decision-engine";
import { baseInput } from "./helpers";

test("Figure 5 requires MDM before downstream management", () => {
  const decision = evaluateFigure5(baseInput({ normalColposcopy: true, hpvResult: "HPV_OTHER", cytologyResult: "ASC_H" }));

  assert.equal(decision.recommendationCode, "F5-MDM-REQUIRED");
});

test("Figure 5 MDM downgraded LSIL follows LSIL pathway", () => {
  const decision = evaluateFigure5(baseInput({ mdmOutcome: "DOWNGRADED_LSIL" }));

  assert.equal(decision.recommendationCode, "F5-MDM-DOWNGRADED-LSIL");
});

test("Figure 5 MDM upgraded HSIL recommends treatment", () => {
  const decision = evaluateFigure5(baseInput({ mdmOutcome: "UPGRADED_HSIL" }));

  assert.equal(decision.recommendationCode, "F5-MDM-UPGRADED-HSIL-TREAT");
});

test("Figure 5 confirmed ASC-H HPV not detected with no lesion routes to Test of Cure/co-testing", () => {
  const decision = evaluateFigure5(baseInput({ mdmOutcome: "CONFIRMED_ASC_H", hpvResult: "NOT_DETECTED", visibleLesion: false }));

  assert.equal(decision.recommendationCode, "F5-CONFIRMED-ASCH-HPV-NEG-NO-LESION-TOC");
});

test("Figure 5 confirmed ASC-H HPV detected normal colposcopy negative cytology repeats in 12 months", () => {
  const decision = evaluateFigure5(baseInput({
    mdmOutcome: "CONFIRMED_ASC_H",
    hpvResult: "HPV_OTHER",
    cytologyResult: "NEGATIVE",
    normalColposcopy: true,
    visibleLesion: false,
  }));

  assert.equal(decision.recommendationCode, "F5-CONFIRMED-ASCH-HPV-DETECTED-NORMAL-NEG-12M");
});
