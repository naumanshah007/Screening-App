/**
 * A governed evaluation that produced nothing must say so, once, everywhere.
 *
 * FOUR PLACES USED TO DISAGREE
 * ----------------------------
 * No rule version resolved, the evaluator threw, the adapter threw, and the
 * persistence update threw. Three of them returned the LEGACY decision, so a
 * new case silently carried a clinical recommendation from an engine that was
 * not its authority. The fourth overwrote the summary COLUMNS but not
 * `decisionJson`, and the drawer reads `decisionJson` — so the worklist row and
 * the drawer it opened disagreed about the same case.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  EVALUATION_UNAVAILABLE_CODE,
  evaluationUnavailableDecision,
  isEvaluationUnavailable,
} from "../evaluation-unavailable";

const ROOT = join(__dirname, "..", "..", "..");
const GRADED = readFileSync(join(ROOT, "lib", "clinical-rules", "graded-decision.ts"), "utf8");
const PERSISTENCE = readFileSync(join(ROOT, "lib", "batch", "persistence.ts"), "utf8");

test("the unavailable state carries no clinical action, timing or priority", () => {
  const decision = evaluationUnavailableDecision({
    figure: "FIGURE_3",
    reason: "The governed evaluation failed to run for this case.",
  });
  assert.equal(decision.recommendationCode, EVALUATION_UNAVAILABLE_CODE);
  assert.ok(isEvaluationUnavailable(decision));
  assert.equal(decision.referralRequired, false);
  assert.equal(decision.referralPriority, undefined);
  assert.equal(decision.referralType, undefined);
  assert.equal(decision.recallRequired, false);
  assert.equal(decision.recallIntervalMonths, undefined);
  assert.equal(decision.nextScreeningIntervalMonths, undefined);
  assert.equal(decision.safetyOutcome, "CLINICIAN_REVIEW_REQUIRED");
  // The reason is recorded, not presented as guidance.
  assert.deepEqual(decision.clinicalWarnings, [
    "The governed evaluation failed to run for this case.",
  ]);
});

test("it retains the routed pathway and nothing else from the legacy decision", () => {
  const decision = evaluationUnavailableDecision({ figure: "FIGURE_6", reason: "x" });
  assert.equal(decision.figure, "FIGURE_6");
  assert.doesNotMatch(decision.recommendation, /colposcop/i);
  assert.doesNotMatch(decision.nextAction ?? "", /colposcop/i);
});

test("a governed failure is not silently replaced by the legacy recommendation", () => {
  // All three fallback branches route through the single helper, and the helper
  // returns legacy ONLY where legacy is the configured authority.
  const branches = GRADED.match(/unresolvedGovernedDecision\(\{/g) ?? [];
  assert.equal(branches.length, 3, "all three failure branches must use the shared helper");
  assert.match(
    GRADED,
    /if \(args\.authority\.authorityEngine !== "CANONICAL"\)/,
    "the legacy decision may stand only when legacy is the configured authority"
  );
  assert.match(
    GRADED,
    /return \{\s*decision: evaluationUnavailableDecision\(\{/,
    "a canonical-authority failure must become the explicit unavailable state"
  );
  assert.doesNotMatch(
    GRADED,
    /Canonical evaluation failed; legacy decision stands/,
    "the unconditional legacy fallback wording must not come back"
  );
});

test("a governed safety stop is kept, not reverted to the legacy decision", () => {
  // A stop looks like a de-escalation against a legacy referral — no referral,
  // no priority — but it is the more conservative result. Reverting it was the
  // silent legacy fallback in another guise.
  assert.match(
    GRADED,
    /const deEscalations = adapted\.canonicalStopped\s*\?\s*\[\]/,
    "the de-escalation guard must not fire on a completed governed stop"
  );
});

test("a failed evaluation persists ONE result: columns and decisionJson agree", () => {
  const failClosed = PERSISTENCE.slice(
    PERSISTENCE.indexOf("// FAIL CLOSED."),
    PERSISTENCE.indexOf("CLINICAL_RULE_AUTHORITY_EVALUATION_FAILED")
  );
  assert.ok(
    failClosed.includes("decisionJson: JSON.stringify(unavailable)"),
    "the stored decision snapshot must be replaced, not just the summary columns"
  );
  for (const column of [
    "recommendationCode: NO_GOVERNED_RESULT_CODE",
    "recommendation: NO_GOVERNED_RESULT_TEXT",
    "referralPriority: null",
    "referralType: null",
  ]) {
    assert.ok(failClosed.includes(column), `the summary column ${column} must also be written`);
  }
  // The columns and the JSON must name the same state.
  assert.match(
    PERSISTENCE,
    /const NO_GOVERNED_RESULT_CODE = EVALUATION_UNAVAILABLE_CODE/,
    "the column marker and the decision code must be the same constant"
  );
});

test("a synthetic case identifier is never promoted into the NHI column", () => {
  assert.match(
    PERSISTENCE,
    /nhi: c\.nhi \?\? \(c\.identifierKind === "NHI" \? c\.source\.externalPatientId \?\? null : null\)/,
    "the NHI column must hold an NHI or nothing"
  );
  assert.doesNotMatch(
    PERSISTENCE,
    /nhi: c\.nhi \?\? c\.source\.externalPatientId \?\? null/,
    "the unconditional external-ID fallback must not come back"
  );
});
