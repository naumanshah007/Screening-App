/**
 * Case Review semantics for an operative governed evaluation.
 *
 * TWO DEFECTS THESE LOCK
 * ----------------------
 * 1. Shadow-era wording. The evidence panel said "Canonical V2 Shadow
 *    Comparison" and "the legacy decision remains authoritative" for LIVE_DEMO
 *    evaluations. Once the governed ruleset decides the case both statements are
 *    false. Shadow wording is retained for genuine SHADOW / SIMULATION records.
 *
 * 2. Inherited router escalation. decision-adapter.ts must never de-escalate
 *    below the legacy router, so a governance safety stop still carries the
 *    router's referral priority. That guardrail is correct and stays — but the
 *    canonical panel must not present the inherited escalation as though the
 *    governed rules determined a referral.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const EVIDENCE = readFileSync(
  join(ROOT, "components", "batch", "CanonicalShadowEvidence.tsx"),
  "utf8"
);
const COMPARISON = readFileSync(
  join(ROOT, "components", "clinical-rules", "AuthorityComparison.tsx"),
  "utf8"
);

test("shadow wording is conditional on the evaluation mode", () => {
  assert.match(
    EVIDENCE,
    /const isOperative = isOperativeMode\(/,
    "the panel must derive operative state from the evaluation mode"
  );
  for (const [operative, shadow] of [
    ['"Governed evaluation details"', '"Canonical V2 Shadow Comparison"'],
    ['"Provisional recommendation"', '"Shadow outcome"'],
    ['"Create governed re-evaluation"', '"Preserve prior and rerun shadow"'],
  ]) {
    assert.match(
      EVIDENCE,
      new RegExp(
        `isOperative \\?[\\s\\S]{0,40}${operative.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`
      ),
      `operative wording ${operative} must be selected by isOperative`
    );
    assert.ok(
      EVIDENCE.includes(shadow),
      `genuine shadow wording ${shadow} must remain for SHADOW/SIMULATION records`
    );
  }
});

test("an operative evaluation is not called non-authoritative", () => {
  assert.match(
    EVIDENCE,
    /isOperative[\s\S]{0,160}Evaluated by the current governed rules/,
    "an operative evaluation must be described as the governed decision"
  );
  assert.ok(
    EVIDENCE.includes("The legacy decision remains authoritative"),
    "the legacy-authoritative sentence must survive for genuine shadow records"
  );
});

test("the machine trace is labelled a governed evaluation trace", () => {
  assert.ok(
    EVIDENCE.includes("Governed evaluation trace"),
    "the canonical branch path is the governed trace, not a router trace"
  );
});

test("a governance safety stop does not present a governed referral", () => {
  assert.match(
    COMPARISON,
    /const governedSafetyStop = Boolean\(shadow\) && shadow!\.matchedRuleIds\.length === 0/,
    "a safety stop is identified by the absence of a matched governed rule"
  );
  assert.match(
    COMPARISON,
    /governedSafetyStop \? "No governed referral determined"/,
    "a safety stop must state that no governed referral was determined"
  );
  assert.match(
    COMPARISON,
    /governedSafetyStop \? "Clinician review required"/,
    "a safety stop must show clinician review rather than a governed recommendation"
  );
});

test("the safety stop explains that any referral came from routing", () => {
  assert.match(
    COMPARISON,
    /came\s+from\s+pathway routing, not from a governed determination/,
    "the panel must attribute an inherited referral to routing, not to the governed rules"
  );
});
