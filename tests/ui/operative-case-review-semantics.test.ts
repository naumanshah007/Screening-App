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
    /const isOperative = isOperativeEvaluationMode\(shadow\.evaluationMode\)/,
    "the panel must derive operative state from the shared evaluation-mode helper"
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

// ─── Case Review structure ──────────────────────────────────────────────────

const DETAIL = readFileSync(
  join(ROOT, "components", "batch", "BatchResultDetail.tsx"),
  "utf8"
);

test("routing and governed evaluation are separate sections", () => {
  assert.match(DETAIL, /DrawerSection title="Routing"/, "routing must be its own section");
  assert.match(
    DETAIL,
    /Pathway selection only/,
    "the routing section must state it is selection only"
  );
  assert.match(
    DETAIL,
    /DrawerSection title="Why this recommendation\?"/,
    "the governed evaluation must be its own section"
  );
  assert.match(
    DETAIL,
    /The router selects which pathway applies\. It does not produce the/,
    "the router must be explicitly excluded from producing the recommendation"
  );
});

test("diagnostics are three distinct states, not one 'not available' list", () => {
  assert.doesNotMatch(
    DETAIL,
    /DrawerSection title="Information not available"/,
    "the merged 'information not available' section must be gone"
  );
  for (const title of [
    "Missing information",
    "Conflicting information",
    "Other available facts",
  ]) {
    assert.ok(DETAIL.includes(`title="${title}"`), `missing section: ${title}`);
  }
  // An available-but-unused fact must never be described as missing.
  assert.match(
    DETAIL,
    /They are available, not missing\./,
    "unused facts must be distinguished from missing ones"
  );
  assert.match(
    DETAIL,
    /None identified\./,
    "an empty missing/conflicting list must say so rather than disappear"
  );
});

test("a safety stop does not highlight a terminal in the diagram", () => {
  assert.match(
    DETAIL,
    /activeCode=\{\s*governedSafetyStop \|\| isPreview\s*\?\s*undefined/,
    "no governed rule matched means no highlighted terminal"
  );
  assert.match(
    DETAIL,
    /No governed terminal outcome was reached/,
    "the safety-stop diagram must state no terminal was reached"
  );
  assert.match(
    DETAIL,
    /"Pathway context"\s*:\s*"Pathway to recommendation"/,
    "the diagram title must reflect whether an outcome was reached"
  );
});

test("guideline basis is filtered but the full set stays reachable", () => {
  assert.match(DETAIL, /DrawerSection title="Guideline basis"/);
  assert.match(DETAIL, /rows=\{primaryReferences\}/, "the basis shows the relevant subset");
  assert.match(
    DETAIL,
    /title="Full ruleset references"/,
    "the complete bibliography must remain available"
  );
  assert.match(
    DETAIL,
    /rows=\{allReferences\}/,
    "the full disclosure must render every recorded reference"
  );
});

test("technical evidence is collapsed, reviewer controls are not", () => {
  assert.match(
    DETAIL,
    /title="Technical governed evaluation"/,
    "raw governed evidence must be collapsed"
  );
  assert.match(
    DETAIL,
    /title="Audit and provenance"/,
    "provenance must be collapsed"
  );
  assert.ok(
    DETAIL.indexOf('title="Reviewer record"') <
      DETAIL.indexOf('title="Technical governed evaluation"'),
    "reviewer controls must appear before the technical evidence"
  );
});
