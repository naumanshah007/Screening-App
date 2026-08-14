/**
 * A disabled control must say why it is disabled.
 *
 * Live browser QA across the nine product surfaces found three controls greyed
 * out with no title, no aria-label and no adjacent text:
 *
 *   1. "Create governed re-evaluation" (Case Review) — four validation rules,
 *      none of them stated.
 *   2. The four governance decision controls — a reviewer could not tell
 *      whether they lacked the entitlement, were looking at a published
 *      version, or had simply not written a comment yet.
 *   3. "Publish release" (Local Rules) — the caller had ALWAYS computed a
 *      precise reason and passed it in, but the component only surfaced it from
 *      its click handler, and a disabled button never fires one. The reason was
 *      unreachable in the UI it was written for.
 *
 * WHAT THIS DOES NOT CHANGE
 * -------------------------
 * No entitlement, gate or validation rule is widened. Each reason reproduces
 * the control's own `disabled` predicates; the governance case below asserts
 * that explicitly, because a "wording" change that quietly relaxed an approval
 * gate would be a clinical-safety defect rather than a UX improvement.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

const EVIDENCE = read("components/batch/CanonicalShadowEvidence.tsx");
const GOVERNANCE = read("components/clinical-rules/ClinicalGovernanceReviewWorkspace.tsx");
const RELEASE_BUTTON = read("app/(app)/rules/RuleReleaseActionButton.tsx");
const RULES_PAGE = read("app/(app)/rules/page.tsx");

test("the governed re-evaluation control names the unmet requirement", () => {
  assert.match(EVIDENCE, /const correctionBlockedReason = /);
  assert.match(
    EVIDENCE,
    /disabled=\{Boolean\(correctionBlockedReason\)\} title=\{correctionBlockedReason \?\? undefined\}/,
    "the button must be disabled by, and titled with, the same reason"
  );
  for (const reason of [
    "Enter the fact name",
    "A KNOWN fact needs a value",
    "at least 10 characters",
  ]) {
    assert.ok(EVIDENCE.includes(reason), `missing reason: ${reason}`);
  }
});

test("governance controls explain themselves without changing the gate", () => {
  assert.match(GOVERNANCE, /function blockedReason\(entitled: boolean, verb: "propose" \| "approve"\)/);
  // Propose and approve are separate entitlements and must stay separate.
  assert.match(GOVERNANCE, /title=\{blockedReason\(canPropose, "propose"\) \?\? undefined\}/);
  assert.match(GOVERNANCE, /title=\{blockedReason\(canApprove, "approve"\) \?\? undefined\}/);

  // The four decision buttons keep their original disabled predicates verbatim.
  const proposeGate =
    /disabled=\{!canPropose \|\| status !== "DRAFT" \|\| comments\.trim\(\)\.length < 10 \|\| busy !== null\}/;
  const approveGate =
    /disabled=\{!canApprove \|\| status !== "DRAFT" \|\| comments\.trim\(\)\.length < 10 \|\| busy !== null\}/;
  assert.match(GOVERNANCE, proposeGate);
  assert.equal(
    (GOVERNANCE.match(new RegExp(approveGate.source, "g")) ?? []).length,
    3,
    "APPROVE, REJECT and REQUEST CHANGE must all still require the approve entitlement"
  );

  // A proposer must never be told they may approve their own interpretation.
  assert.match(
    GOVERNANCE,
    /a proposer cannot approve their own interpretation/,
    "the approval reason must restate the separation-of-duties boundary"
  );
});

test("the release publish reason is reachable, not click-only", () => {
  assert.match(
    RELEASE_BUTTON,
    /title=\{disabled \? disabledReason : undefined\}/,
    "the reason must be on the disabled button itself"
  );
  assert.match(
    RELEASE_BUTTON,
    /\{disabled && disabledReason && \(/,
    "the reason must also be visible without hovering"
  );
  assert.doesNotMatch(
    RELEASE_BUTTON,
    /if \(disabled\) \{\s*setError/,
    "the unreachable click-handler branch must be gone"
  );
  // The caller's precise reasons must survive.
  for (const reason of [
    "This release is already active",
    "Review is required before publish",
    "Regression suite must pass before publish",
  ]) {
    assert.ok(RULES_PAGE.includes(reason), `missing reason: ${reason}`);
  }
});
