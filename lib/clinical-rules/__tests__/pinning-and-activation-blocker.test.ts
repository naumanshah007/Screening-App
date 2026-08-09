/**
 * Pinning semantics, the production activation blocker, and the removal of the
 * activation cache split-brain.
 *
 * These are pure-function tests; the database-backed pin lookups are exercised
 * by the integration suite.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  assertProductionActivationPermitted,
  invalidateClinicalRuleVersionCache,
} from "../lifecycle";
import { applyPin, isOperativeMode, type AuthorityPin } from "../pinning";

// ── The production activation blocker ───────────────────────────────────────

test("PRODUCTION activation is blocked while the explicit control is off", () => {
  delete process.env.CLINICAL_AUTHORITY_LIVE_PRODUCTION;
  assert.throws(
    () => assertProductionActivationPermitted("PRODUCTION"),
    /activation control is off/
  );
});

test("non-production environments are permitted", () => {
  for (const environment of ["DEMO", "TEST", "VALIDATION"] as const) {
    assert.doesNotThrow(() => assertProductionActivationPermitted(environment));
  }
});

test("PRODUCTION activation reaches persisted governance checks only when explicitly enabled", () => {
  process.env.CLINICAL_AUTHORITY_LIVE_PRODUCTION = "1";
  assert.doesNotThrow(() => assertProductionActivationPermitted("PRODUCTION"));
  delete process.env.CLINICAL_AUTHORITY_LIVE_PRODUCTION;
});

// ── Cache split-brain ───────────────────────────────────────────────────────

test("activation cache invalidation is a no-op because there is no cache", () => {
  // Two consecutive calls must be indistinguishable and must not throw. The
  // safety property this stands for — no 30-second window in which different
  // serverless instances apply different clinical authorities — is a property of
  // there being no cache at all.
  assert.doesNotThrow(() => invalidateClinicalRuleVersionCache());
  assert.doesNotThrow(() => invalidateClinicalRuleVersionCache("any-rule-set"));
});

// ── Operative modes ─────────────────────────────────────────────────────────

test("only live modes are clinically operative", () => {
  assert.equal(isOperativeMode("LIVE_PRODUCTION"), true);
  assert.equal(isOperativeMode("LIVE_DEMO"), true);
  assert.equal(isOperativeMode("SHADOW"), false, "a shadow evaluation must never pin a case");
  assert.equal(isOperativeMode("SIMULATION"), false, "a simulation must never pin a case");
});

// ── Pinning ─────────────────────────────────────────────────────────────────

const canonicalPin: AuthorityPin = {
  authorityEngine: "CANONICAL",
  ruleVersionId: "rv-1",
  ruleVersionDisplay: "CG-NCSP-3.1.0",
  rulesetChecksum: "abc",
  engineVersion: "canonical-graph-v2",
  evaluationId: "eval-1",
  evaluationMode: "LIVE_PRODUCTION",
  pinnedAt: new Date("2026-08-07T00:00:00.000Z"),
  inferredLegacy: false,
};

const notYetPinned: AuthorityPin = {
  authorityEngine: "LEGACY",
  ruleVersionId: null,
  ruleVersionDisplay: null,
  rulesetChecksum: null,
  engineVersion: "business-figures-table1-v1",
  evaluationId: null,
  evaluationMode: null,
  pinnedAt: null,
  inferredLegacy: true,
};

test("an existing pin wins over the currently resolved authority", () => {
  const resolved = { authorityEngine: "LEGACY" as const };
  const { authority, pinned, reason } = applyPin(resolved, canonicalPin);
  assert.equal(pinned, true);
  assert.equal(authority, canonicalPin);
  assert.match(reason, /does not apply to this case/);
});

test("a rollback leaves canonical-window cases pinned to canonical", () => {
  // After a rollback the resolver returns LEGACY. A case decided during the
  // canonical window must keep canonical: its reviewer may already have acted.
  const afterRollback = { authorityEngine: "LEGACY" as const };
  const { authority, pinned } = applyPin(afterRollback, canonicalPin);
  assert.equal(pinned, true);
  assert.equal((authority as AuthorityPin).ruleVersionDisplay, "CG-NCSP-3.1.0");
});

test("an activation does not apply to a case that already carries a pin", () => {
  const afterActivation = { authorityEngine: "CANONICAL" as const };
  const legacyPinned: AuthorityPin = { ...canonicalPin, authorityEngine: "LEGACY", ruleVersionDisplay: null };
  const { authority, pinned } = applyPin(afterActivation, legacyPinned);
  assert.equal(pinned, true);
  assert.equal((authority as AuthorityPin).authorityEngine, "LEGACY");
});

test("an unpinned case takes the currently resolved authority", () => {
  const resolved = { authorityEngine: "CANONICAL" as const };
  const { authority, pinned, reason } = applyPin(resolved, notYetPinned);
  assert.equal(pinned, false);
  assert.equal(authority, resolved);
  assert.match(reason, /establishes the pin/);
});

test("a null pin is treated as unpinned, not as an error", () => {
  const resolved = { authorityEngine: "LEGACY" as const };
  const { pinned, authority } = applyPin(resolved, null);
  assert.equal(pinned, false);
  assert.equal(authority, resolved);
});
