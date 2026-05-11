import test from "node:test";
import assert from "node:assert/strict";
import { evaluateFigure8 } from "../decision-engine";
import { baseInput } from "./helpers";

const total = { isPostHysterectomy: true, hysterectomyType: "TOTAL" as const };

test("Figure 8 known returned-regular history with no pathology needs no further screening", () => {
  const decision = evaluateFigure8(baseInput({
    ...total,
    priorScreeningHistory: "LOW_GRADE_RETURNED_TO_REGULAR",
    hysterectomySpecimenPathology: "NO_CERVICAL_PATHOLOGY",
    screeningHistoryKnown: true,
  }));

  assert.equal(decision.recommendationCode, "F8-KNOWN-HISTORY-NO-PATHOLOGY-NO-FURTHER");
});

test("Figure 8 LSIL/CIN1 specimen routes to HPV test/Figure 3", () => {
  const decision = evaluateFigure8(baseInput({
    ...total,
    priorScreeningHistory: "NEGATIVE_OR_NORMAL",
    hysterectomySpecimenPathology: "LSIL_CIN1",
  }));

  assert.equal(decision.recommendationCode, "F8-LSIL-CIN1-HPV-FIG3");
});

test("Figure 8 high-grade specimen routes by excision completeness", () => {
  const complete = evaluateFigure8(baseInput({
    ...total,
    priorScreeningHistory: "NEGATIVE_OR_NORMAL",
    hysterectomySpecimenPathology: "HSIL_CIN23",
    excisionStatus: "COMPLETE",
  }));
  const incomplete = evaluateFigure8(baseInput({
    ...total,
    priorScreeningHistory: "NEGATIVE_OR_NORMAL",
    hysterectomySpecimenPathology: "AIS",
    excisionStatus: "INCOMPLETE",
  }));

  assert.equal(complete.recommendationCode, "F8-HSIL-AIS-COMPLETE-TOC");
  assert.equal(incomplete.recommendationCode, "F8-HSIL-AIS-INCOMPLETE-COLP");
});

test("Figure 8 post-hysterectomy HPV test uses no further screening / Figure 3 outcomes", () => {
  const negative = evaluateFigure8(baseInput({ ...total, postHysterectomyHpvTestIndicated: true, hpvResult: "NOT_DETECTED" }));
  const detected = evaluateFigure8(baseInput({ ...total, postHysterectomyHpvTestIndicated: true, hpvResult: "HPV_OTHER" }));

  assert.equal(negative.recommendationCode, "F8-POST-HYST-HPV-NOT-DETECTED-NO-FURTHER");
  assert.equal(detected.recommendationCode, "F8-POST-HYST-HPV-DETECTED-FIG3");
});
