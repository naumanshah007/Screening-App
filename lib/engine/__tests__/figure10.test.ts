import test from "node:test";
import assert from "node:assert/strict";
import { evaluateFigure10 } from "../decision-engine";
import { baseInput } from "./helpers";

const bleeding = { hasAbnormalVaginalBleeding: true, bleedingType: "INTER_MENSTRUAL" as const };

test("Figure 10 cancer symptoms cause urgent gynaecology assessment", () => {
  const decision = evaluateFigure10(baseInput({ ...bleeding, hasCancerSymptoms: true }));

  assert.equal(decision.recommendationCode, "F10-CANCER-SYMPTOMS-URGENT-GYN");
  assert.equal(decision.referralType, "GYNAECOLOGY");
});

test("Figure 10 initial assessment asks for workup facts", () => {
  const decision = evaluateFigure10(baseInput(bleeding));

  assert.equal(decision.recommendationCode, "F10-INITIAL-ASSESSMENT");
  assert.ok(decision.missingInformation?.includes("coTestCompleted"));
});

test("Figure 10 abnormal cervix without cancer creates 6-8 week review without same-run resolution", () => {
  const decision = evaluateFigure10(baseInput({ ...bleeding, abnormalCervix: true, suspicionOfCancer: false }));

  assert.equal(decision.recommendationCode, "F10-ABNORMAL-CERVIX-NO-CANCER-REVIEW");
  assert.equal(decision.recallIntervalMonths, 2);
});

test("Figure 10 review resolved returns to regular screening without hard-coded 36 month recall", () => {
  const decision = evaluateFigure10(baseInput({ ...bleeding, abnormalBleedingStage: "SIX_TO_EIGHT_WEEK_REVIEW", bleedingResolved: true }));

  assert.equal(decision.recommendationCode, "F10-REVIEW-RESOLVED-SCREENING");
  assert.equal(decision.recallRequired, undefined);
});

test("Figure 10 review unresolved routes to gynaecology", () => {
  const decision = evaluateFigure10(baseInput({ ...bleeding, abnormalBleedingStage: "SIX_TO_EIGHT_WEEK_REVIEW", bleedingResolved: false }));

  assert.equal(decision.recommendationCode, "F10-REVIEW-UNRESOLVED-GYNAECOLOGY");
  assert.equal(decision.referralType, "GYNAECOLOGY");
});
