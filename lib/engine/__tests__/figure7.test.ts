import test from "node:test";
import assert from "node:assert/strict";
import { evaluateFigure7 } from "../decision-engine";
import { baseInput } from "./helpers";

test("Figure 7 routes AG2 and AC2 to gynaecology", () => {
  assert.equal(evaluateFigure7(baseInput({ cytologyResult: "AG2" })).referralType, "GYNAECOLOGY");
  assert.equal(evaluateFigure7(baseInput({ cytologyResult: "AC2" })).referralType, "GYNAECOLOGY");
});

test("Figure 7 routes AC3/AC4 to colposcopy rather than gynaecology", () => {
  assert.equal(evaluateFigure7(baseInput({ cytologyResult: "AC3" })).referralType, "COLPOSCOPY");
  assert.equal(evaluateFigure7(baseInput({ cytologyResult: "AC4" })).referralType, "COLPOSCOPY");
});

test("Figure 7 visible lesion requires biopsy, then AIS goes to type 3 excision and cancer to oncology", () => {
  assert.equal(evaluateFigure7(baseInput({ cytologyResult: "AG3", visibleLesion: true })).recommendationCode, "F7-VISIBLE-LESION-BIOPSY");
  assert.equal(evaluateFigure7(baseInput({ cytologyResult: "AG3", visibleLesion: true, biopsyResult: "AIS" })).recommendationCode, "F7-BIOPSY-AIS-TYPE3-EXCISION");
  assert.equal(evaluateFigure7(baseInput({ cytologyResult: "AG3", visibleLesion: true, biopsyResult: "ADENOCARCINOMA" })).recommendationCode, "F7-BIOPSY-CANCER-ONCOLOGY");
});

test("Figure 7 no visible lesion requires MDM and supports source MDM outcomes", () => {
  assert.equal(evaluateFigure7(baseInput({ cytologyResult: "AG3", visibleLesion: false })).recommendationCode, "F7-NO-LESION-MDM");
  assert.equal(evaluateFigure7(baseInput({ cytologyResult: "AG3", visibleLesion: false, mdmOutcome: "CYTOLOGY_CONFIRMED_NOT_AG2" })).recommendationCode, "F7-MDM-CONFIRMED-NOT-AG2-TYPE3");
  assert.equal(evaluateFigure7(baseInput({ cytologyResult: "AG3", visibleLesion: false, mdmOutcome: "AG2_CYTOLOGY_CONFIRMED" })).recommendationCode, "F7-MDM-AG2-INVESTIGATE-MALIGNANCIES");
  assert.equal(evaluateFigure7(baseInput({ cytologyResult: "AG3", visibleLesion: false, mdmOutcome: "CYTOLOGY_NOT_CONFIRMED" })).recommendationCode, "F7-MDM-CYTOLOGY-NOT-CONFIRMED-6M");
});

test("Figure 7 missing visible lesion returns missing information instead of inferring from impression", () => {
  const decision = evaluateFigure7(baseInput({ cytologyResult: "AG3", colposcopicImpression: "HSIL" }));

  assert.equal(decision.recommendationCode, "F7-VISIBLE-LESION-REQUIRED");
  assert.equal(decision.safetyOutcome, "INSUFFICIENT_INFORMATION");
  assert.deepEqual(decision.missingInformation, ["visibleLesion"]);
});
