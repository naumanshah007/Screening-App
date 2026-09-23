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
 * 2. Inherited router escalation. A governance safety stop used to carry the
 *    router's referral priority through the adapter's legacy floor. The floor is
 *    gone — a stop now carries no referral or priority at all — and the panel
 *    must still never present a routing artefact as a governed determination.
 *
 * The rest of the file locks the clinician-facing case view: six sections in a
 * fixed order, source evidence only under Source inputs, no static diagram, and
 * every technical detail in one closed disclosure.
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
//
// The clinician view is six sections in a fixed order: case identity, source
// inputs, decision, why, missing information (only when relevant) and an
// optional decision path. Everything technical lives in ONE closed disclosure
// below them. These tests lock that shape.

const DETAIL = readFileSync(
  join(ROOT, "components", "batch", "BatchResultDetail.tsx"),
  "utf8"
);

test("the primary view is source inputs, decision, why — in that order", () => {
  const order = ['title="Source inputs"', 'title="Decision"', 'title="Why"'];
  let previous = -1;
  for (const marker of order) {
    const index = DETAIL.indexOf(marker);
    assert.ok(index > -1, `missing section: ${marker}`);
    assert.ok(index > previous, `${marker} is out of order in the clinician view`);
    previous = index;
  }
});

test("Source inputs renders source evidence, never normalised engine values", () => {
  const section = DETAIL.slice(
    DETAIL.indexOf("const sourceInputs"),
    DETAIL.indexOf("// ── 4. Why")
  );
  for (const field of [
    "evidence.screenCircumstanceText",
    "evidence.hpvResultText",
    "evidence.cytologyFollowUpText",
    "evidence.relevantHistoryText",
  ]) {
    assert.ok(section.includes(field), `Source inputs must show ${field}`);
  }
  // The assumed sample type and the derived repeat stage are normalisation, not
  // source facts, and belong under technical details.
  assert.doesNotMatch(
    section,
    /inp\?\.sampleType|inp\?\.repeatStage|inp\?\.isTestOfCure/,
    "assumed or derived engine values must not appear under Source inputs"
  );
});

test("the case identifier is never labelled NHI unless it is one", () => {
  assert.match(
    DETAIL,
    /const identifierIsNhi = c\.identifierKind === "NHI" \|\| Boolean\(c\.nhi\)/,
    "the NHI label must be conditional on the identifier actually being an NHI"
  );
  assert.match(
    DETAIL,
    /identifierIsNhi \? "NHI" : "Case"/,
    'a synthetic case identifier must be labelled "Case"'
  );
  assert.doesNotMatch(
    DETAIL,
    /`NHI \$\{patientId\}`|NHI \$\{patientId\}/,
    "the unconditional NHI subtitle must not come back"
  );
});

test("no unsupported risk or priority badge appears in the clinician view", () => {
  const primary = DETAIL.slice(
    DETAIL.indexOf("<DetailDrawer"),
    DETAIL.indexOf('title="Technical and audit details"')
  );
  assert.doesNotMatch(primary, /riskTone|RiskBadge|Risk: \{/, "no risk badge in the primary view");
  assert.doesNotMatch(
    primary,
    /Urgent clinical priority|Priority \{decision\.referralPriority\}/,
    "no unsupported urgency or P1/P2 badge in the primary view"
  );
});

test("the four clinician-facing decision states are explicit", () => {
  for (const state of [
    "DECISION",
    "NEEDS_INFORMATION",
    "CLINICIAN_REVIEW",
    "EVALUATION_UNAVAILABLE",
  ]) {
    assert.ok(DETAIL.includes(state), `missing decision state: ${state}`);
  }
  // A completed evaluation that stopped is NEEDS INFORMATION or CLINICIAN
  // REVIEW. "Pending" belongs only to a row that has not been evaluated.
  assert.doesNotMatch(
    DETAIL,
    /Governed evaluation pending/,
    "an evaluated case must never be described as pending evaluation"
  );
});

test("the static pathway diagram is gone from the case view", () => {
  assert.doesNotMatch(
    DETAIL,
    /FlowDiagram|getFigureById/,
    "the hand-maintained figure graph must not be rendered for a specific case"
  );
  assert.doesNotMatch(
    DETAIL,
    /activeCode=/,
    "no path may be inferred from a recommendation code"
  );
});

test("the decision path comes from the persisted trace, or is hidden", () => {
  assert.match(
    DETAIL,
    /tracePathSteps\(shadow\?\.branchPath\)/,
    "the path must be derived from the persisted evaluation's own branch path"
  );
  assert.match(
    DETAIL,
    /const hasTrustworthyTrace = Boolean\(shadow\) && traceSteps\.length > 0/,
    "no trace means no path is shown at all"
  );
  assert.match(
    DETAIL,
    /\{hasTrustworthyTrace && \(/,
    "the path section must be gated on a trustworthy trace"
  );
});

test("missing information is only shown when there is something to ask", () => {
  assert.match(
    DETAIL,
    /\{missingFactNames\.length > 0 && \(\s*<DrawerSection title="Missing information">/,
    "the section must be absent, not empty, when nothing is missing"
  );
  assert.ok(
    DETAIL.includes("MISSING_INFORMATION_QUESTION"),
    "missing facts must be shown as plain-language questions, not raw fact names"
  );
});

test("all technical material sits in ONE closed disclosure, below the decision", () => {
  const technical = DETAIL.indexOf('title="Technical and audit details"');
  assert.ok(technical > -1, "there must be a single technical disclosure");
  for (const marker of [
    "<AuthorityComparison",
    "<CanonicalShadowEvidence",
    '"Routing service"',
    '"Recommendation code"',
    "<Timeline events={provenance}",
  ]) {
    assert.ok(
      DETAIL.indexOf(marker) > technical,
      `${marker} must live inside the technical disclosure, not the clinician view`
    );
  }
  assert.ok(
    DETAIL.indexOf('title="Reviewer record"') < technical,
    "reviewer controls must appear before the technical evidence"
  );
  // The checksum, evaluation mode and ruleset version are only ever RENDERED
  // inside that disclosure, via the provenance timeline it contains.
  const primary = DETAIL.slice(
    DETAIL.indexOf("<DetailDrawer"),
    technical
  );
  assert.doesNotMatch(
    primary,
    /rulesetChecksum|evaluationMode|ruleVersionDisplay|source\.engineVersion/,
    "ruleset identity must not be rendered in the clinician view"
  );
});
