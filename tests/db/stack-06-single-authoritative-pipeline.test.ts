/**
 * One authoritative recommendation pipeline for every NEW case.
 *
 * THE DEFECT THESE LOCK
 * ---------------------
 * Batch intake computes a legacy decision first (it supplies routing) and
 * persists it, then re-evaluates through the authoritative orchestrator and
 * overwrites the clinical fields. Two paths let the legacy recommendation
 * survive as the item's recommendation while the rest of the application
 * reported canonical authority:
 *
 *   1. the authoritative pass was gated on a resolvable rule version, so it was
 *      skipped entirely when none resolved;
 *   2. its catch block only wrote an audit row, leaving the legacy
 *      recommendation in place after a failed authoritative evaluation.
 *
 * Both are silent legacy fallbacks for a NEW case. These are source-level
 * assertions because reproducing them needs a full batch run against a live
 * activation; the shape of the guarantee is what must not regress.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const PERSISTENCE = readFileSync(
  join(ROOT, "lib", "batch", "persistence.ts"),
  "utf8"
);

test("the authoritative evaluation is not gated on a resolvable rule version", () => {
  assert.doesNotMatch(
    PERSISTENCE,
    /if \(runRuleVersion\) \{[\s\S]{0,400}evaluateGradedDecision/,
    "the authoritative pass must run for every item, not only when a rule version resolves"
  );
  assert.match(
    PERSISTENCE,
    /evaluateGradedDecision\(/,
    "batch persistence must still route through the single orchestrator"
  );
});

test("a failed authoritative evaluation fails closed instead of keeping the legacy recommendation", () => {
  // The catch must overwrite the clinical fields, not merely audit the failure.
  const catchBlock = PERSISTENCE.slice(
    PERSISTENCE.indexOf("} catch (error) {")
  );
  assert.match(
    catchBlock,
    /batchReviewItem\.update/,
    "a failed authoritative evaluation must overwrite the persisted recommendation"
  );
  assert.match(
    catchBlock,
    /NO_GOVERNED_RESULT_CODE/,
    "the item must be marked as having no governed recommendation"
  );
  assert.match(
    catchBlock,
    /reviewRequired: true/,
    "a fail-closed item must require clinician review"
  );
  assert.match(
    catchBlock,
    /engineStatus: "error"/,
    "a fail-closed item must be recorded as an engine error"
  );
});

test("the fail-closed state carries no clinical action", () => {
  const catchBlock = PERSISTENCE.slice(
    PERSISTENCE.indexOf("} catch (error) {")
  );
  // Absence of a recommendation must not be dressed up as one: no priority, no
  // referral type, no invented timing.
  assert.match(
    catchBlock,
    /referralPriority: null/,
    "a fail-closed item must not carry a referral priority"
  );
  assert.match(
    catchBlock,
    /referralType: null/,
    "a fail-closed item must not carry a referral type"
  );
});

test("batch persistence contains no independent recommendation engine", () => {
  // Routing may come from the legacy engine, but persistence must never call a
  // clinical evaluator of its own.
  assert.doesNotMatch(
    PERSISTENCE,
    /evaluateClinicalDecision\(/,
    "batch persistence must not evaluate clinical decisions independently"
  );
  assert.doesNotMatch(
    PERSISTENCE,
    /evaluateClinicalSnapshot\(|evaluateCanonicalClinicalFactsV2\(/,
    "batch persistence must not call the governed evaluator directly; it goes through the orchestrator"
  );
});

test("the orchestrator records router and recommendation provenance separately", () => {
  const graded = readFileSync(
    join(ROOT, "lib", "clinical-rules", "graded-decision.ts"),
    "utf8"
  );
  // The legacy engine supplies routing and is retained for that purpose.
  assert.match(
    graded,
    /routerEngine: LEGACY_ENGINE_VERSION/,
    "router provenance must be recorded as router provenance"
  );
  // And it is kept distinct from the authoritative engine field.
  assert.match(
    graded,
    /authorityEngine: "CANONICAL"/,
    "recommendation provenance must be recorded separately from router provenance"
  );
});
