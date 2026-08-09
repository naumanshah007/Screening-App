/**
 * Rollback rehearsal, T0 → T4, against a real isolated SQLite database.
 *
 *   T0  legacy authority
 *   T1  test-only canonical activation for organisation A
 *   T2  new cases for organisation A use the canonical decision layer
 *   T3  rollback (deactivate)
 *   T4  new cases use legacy again
 *
 * Proves: cases created during T1–T3 stay pinned, canonical-period decisions
 * stay intact, no restore, no deletion, no overwritten evaluation, and rollback
 * is visible on the very next resolution.
 *
 * The PRODUCTION environment is never used here; this rehearses the mechanism in
 * the TEST environment inside a throwaway database.
 */

import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import {
  applySchema,
  seedActivation,
  seedReferralCase,
  seedRuleSet,
  seedVersion,
  createIsolatedDatabase,
} from "./support/isolated-db";

const database = createIsolatedDatabase("rollback");

type Prisma = typeof import("../../lib/prisma")["prisma"];
let prisma: Prisma;
let resolveClinicalAuthority: typeof import("../../lib/clinical-rules/authority")["resolveClinicalAuthority"];
let getCaseAuthorityPin: typeof import("../../lib/clinical-rules/pinning")["getCaseAuthorityPin"];
let applyPin: typeof import("../../lib/clinical-rules/pinning")["applyPin"];
let rollbackClinicalRuleAuthorityToLegacy: typeof import("../../lib/clinical-rules/lifecycle")["rollbackClinicalRuleAuthorityToLegacy"];
let ruleSetId: string;
let versionId: string;

before(async () => {
  await applySchema(database.file);
  ({ prisma } = await import("../../lib/prisma"));
  ({ resolveClinicalAuthority } = await import("../../lib/clinical-rules/authority"));
  ({ getCaseAuthorityPin, applyPin } = await import("../../lib/clinical-rules/pinning"));
  ({ rollbackClinicalRuleAuthorityToLegacy } = await import("../../lib/clinical-rules/lifecycle"));
  const ruleSet = await seedRuleSet(prisma as never);
  ruleSetId = ruleSet.id;
  const version = await seedVersion(prisma as never, {
    ruleSetId,
    displayVersion: "CG-NCSP-3.1.0-rehearsal",
    status: "ACTIVE",
    checksum: "checksum-rehearsal",
  });
  versionId = version.id;
});

after(async () => {
  await prisma?.$disconnect?.().catch(() => undefined);
  database.cleanup();
});

async function decideCase(label: string, canonical: boolean) {
  const { referralCase } = await seedReferralCase(prisma as never, label);
  if (canonical) {
    await prisma.ruleEvaluation.create({
      data: {
        caseId: referralCase.id,
        ruleSetId,
        ruleVersionId: versionId,
        ruleVersionDisplay: "CG-NCSP-3.1.0-rehearsal",
        rulesetChecksum: "checksum-rehearsal",
        engineVersion: "canonical-graph-v2",
        evaluationMode: "LIVE_DEMO",
        canonicalInputSnapshot: "{}",
        matchedRuleIds: '["F3-01"]',
        branchPath: "[]",
        provisionalRecommendation: `canonical decision for ${label}`,
        riskLevel: "LOW",
        missingInformation: "[]",
        reviewerRequirement: "CLINICIAN_REVIEW",
        sourceReferences: "[]",
        evaluationTrace: "{}",
      },
    });
  }
  return referralCase;
}

test("rollback rehearsal T0 through T4", async () => {
  // ── T0: legacy ────────────────────────────────────────────────────────────
  const t0 = await resolveClinicalAuthority({ environment: "TEST", organisationKey: "org-a" });
  assert.equal(t0.authorityEngine, "LEGACY", "T0 must be legacy");
  const legacyCase = await decideCase("t0-legacy", false);

  // ── T1: activate for organisation A only ──────────────────────────────────
  const activation = await seedActivation(prisma as never, {
    ruleSetId,
    ruleVersionId: versionId,
    environment: "TEST",
    organisationKey: "org-a",
  });

  const t1 = await resolveClinicalAuthority({ environment: "TEST", organisationKey: "org-a" });
  assert.equal(t1.authorityEngine, "CANONICAL", "T1 must resolve canonical for org-a");
  assert.equal(t1.activationScope, "ORGANISATION");

  // Blast radius: another organisation is unaffected.
  const otherOrg = await resolveClinicalAuthority({ environment: "TEST", organisationKey: "org-b" });
  assert.equal(otherOrg.authorityEngine, "LEGACY", "cross-org authority leakage = 0");

  // ── T2: new cases for org A use canonical ─────────────────────────────────
  const canonicalCaseA = await decideCase("t2-canonical-a", true);
  const canonicalCaseB = await decideCase("t2-canonical-b", true);

  const pinDuring = await getCaseAuthorityPin(canonicalCaseA.id);
  assert.equal(pinDuring.authorityEngine, "CANONICAL");
  assert.equal(pinDuring.ruleVersionDisplay, "CG-NCSP-3.1.0-rehearsal");

  const evaluationsBefore = await prisma.ruleEvaluation.count();

  // ── T3: rollback — deactivate. One UPDATE. No deploy, no restore. ─────────
  const rollbackStarted = Date.now();
  await rollbackClinicalRuleAuthorityToLegacy({
    id: versionId,
    actorUserId: (await prisma.user.findFirstOrThrow()).id,
    environment: "TEST",
    organisationKey: "org-a",
    reason: "T3 controlled rollback rehearsal",
  });

  // ── T4: new cases resolve legacy, on the very next resolution ─────────────
  const t4 = await resolveClinicalAuthority({ environment: "TEST", organisationKey: "org-a" });
  const rollbackVisibleMs = Date.now() - rollbackStarted;

  assert.equal(t4.authorityEngine, "LEGACY", "T4 must resolve legacy for new cases");
  assert.ok(
    rollbackVisibleMs < 1_000,
    `rollback visibility took ${rollbackVisibleMs}ms; must be immediate (next request), well inside the 5-minute RTO`
  );

  // ── Verifications ─────────────────────────────────────────────────────────

  // Cases created during T1–T3 remain pinned to canonical.
  for (const canonicalCase of [canonicalCaseA, canonicalCaseB]) {
    const pin = await getCaseAuthorityPin(canonicalCase.id);
    assert.equal(pin.authorityEngine, "CANONICAL", "a canonical-window case must stay pinned after rollback");
    const { pinned, authority } = applyPin(t4, pin);
    assert.equal(pinned, true);
    assert.equal((authority as typeof pin).ruleVersionDisplay, "CG-NCSP-3.1.0-rehearsal");
  }

  // The legacy case is unaffected throughout.
  const legacyPin = await getCaseAuthorityPin(legacyCase.id);
  assert.equal(legacyPin.authorityEngine, "LEGACY");
  assert.equal(legacyPin.inferredLegacy, true);

  // Completed canonical-period decisions remain intact — no deletions, no overwrites.
  const evaluationsAfter = await prisma.ruleEvaluation.count();
  assert.equal(evaluationsAfter, evaluationsBefore, "rollback history loss = 0");

  const canonicalEvaluation = await prisma.ruleEvaluation.findFirst({
    where: { caseId: canonicalCaseA.id },
  });
  assert.equal(
    canonicalEvaluation?.provisionalRecommendation,
    "canonical decision for t2-canonical-a",
    "a canonical-period decision must be byte-identical after rollback"
  );

  // The activation record survives; rollback records when it ended.
  const activationAfter = await prisma.ruleSetActivation.findUnique({ where: { id: activation.id } });
  assert.ok(activationAfter, "rollback must not delete the activation record");
  assert.ok(activationAfter?.deactivatedAt, "rollback must record the deactivation time");
  assert.equal(activationAfter?.reason, "isolated test activation", "the original activation reason survives");
  assert.equal(
    await prisma.ruleVersionAuditEvent.count({ where: { eventType: "ROLLBACK_TO_LEGACY" } }),
    1,
    "the application rollback writes an append-only audit event"
  );
});

test("rollback is idempotent and re-activation is possible without data loss", async () => {
  const before = await prisma.ruleEvaluation.count();

  // Re-activate: a fresh activation row, not a mutation of the old one.
  await prisma.clinicalRuleVersion.update({ where: { id: versionId }, data: { status: "ACTIVE" } });
  const reactivation = await seedActivation(prisma as never, {
    ruleSetId,
    ruleVersionId: versionId,
    environment: "TEST",
    organisationKey: "org-a",
  });
  const reactivated = await resolveClinicalAuthority({ environment: "TEST", organisationKey: "org-a" });
  assert.equal(reactivated.authorityEngine, "CANONICAL");
  assert.equal(reactivated.activationId, reactivation.id, "the newest active activation wins");

  // Roll back again.
  await rollbackClinicalRuleAuthorityToLegacy({
    id: versionId,
    actorUserId: (await prisma.user.findFirstOrThrow()).id,
    environment: "TEST",
    organisationKey: "org-a",
    reason: "Idempotent rollback rehearsal",
  });
  const unchanged = await rollbackClinicalRuleAuthorityToLegacy({
    id: versionId,
    actorUserId: (await prisma.user.findFirstOrThrow()).id,
    environment: "TEST",
    organisationKey: "org-a",
    reason: "Repeated idempotent rollback rehearsal",
  });
  assert.equal(unchanged.unchanged, true);
  const rolledBack = await resolveClinicalAuthority({ environment: "TEST", organisationKey: "org-a" });
  assert.equal(rolledBack.authorityEngine, "LEGACY");

  assert.equal(await prisma.ruleEvaluation.count(), before, "no evaluation was created or destroyed");
  assert.equal(
    await prisma.ruleSetActivation.count(),
    2,
    "both activation records survive as an audit trail"
  );
});

test("no LIVE_PRODUCTION evaluation was created during the rehearsal", async () => {
  assert.equal(await prisma.ruleEvaluation.count({ where: { evaluationMode: "LIVE_PRODUCTION" } }), 0);
});
