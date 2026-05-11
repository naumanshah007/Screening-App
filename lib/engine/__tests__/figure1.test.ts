import test from "node:test";
import assert from "node:assert/strict";
import { evaluateClinicalDecision, evaluateFigure1 } from "../decision-engine";
import { baseInput } from "./helpers";

test("Figure 1 invites never screened participants now without requiring HPV result", () => {
  const decision = evaluateFigure1(baseInput({
    currentFigure: "FIGURE_1",
    screeningStatus: "NEVER_SCREENED",
  }));

  assert.equal(decision.recommendationCode, "F1-INVITE-NOW");
  assert.equal(decision.figure, "FIGURE_1");
  assert.equal(decision.safetyOutcome, undefined);
});

test("Figure 1 invites regular screening with completed Test of Cure at next scheduled visit", () => {
  const decision = evaluateFigure1(baseInput({
    screeningStatus: "REGULAR_SCREENING",
    priorScreeningHistory: "HIGH_GRADE_TOC_COMPLETE",
    testOfCureStatus: "SUCCESSFULLY_COMPLETED",
  }));

  assert.equal(decision.recommendationCode, "F1-INVITE-NEXT-SCHEDULED");
});

test("Figure 1 returns external history required when screening status is unknown", () => {
  const decision = evaluateClinicalDecision(baseInput({
    currentFigure: "FIGURE_1",
    screeningStatus: "UNKNOWN",
  }));

  assert.equal(decision.recommendationCode, "F1-EXTERNAL-HISTORY-REQUIRED");
  assert.equal(decision.safetyOutcome, "EXTERNAL_HISTORY_REQUIRED");
});
