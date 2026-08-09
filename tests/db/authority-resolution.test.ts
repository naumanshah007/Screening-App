/**
 * DB-backed clinical authority resolution.
 *
 * Runs against a real isolated SQLite database built by the application's own
 * bootstrap. No shared or production database is touched, and no PRODUCTION
 * activation is created outside this throwaway file.
 *
 * The 12 scenarios in PRE-ACTIVATION HARDENING PHASE 3, in order.
 */

import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import {
  applySchema,
  createIsolatedDatabase,
  seedActivation,
  seedRuleSet,
  seedVersion,
  seedReferralCase,
} from "./support/isolated-db";

// Must run before any import that pulls in @/lib/prisma.
const database = createIsolatedDatabase("authority");

type Prisma = typeof import("../../lib/prisma")["prisma"];
type ResolveAuthority = typeof import("../../lib/clinical-rules/authority")["resolveClinicalAuthority"];

let prisma: Prisma;
let resolveClinicalAuthority: ResolveAuthority;
let ruleSetId: string;

before(async () => {
  await applySchema(database.file);
  ({ prisma } = await import("../../lib/prisma"));
  ({ resolveClinicalAuthority } = await import("../../lib/clinical-rules/authority"));
  const ruleSet = await seedRuleSet(prisma as never);
  ruleSetId = ruleSet.id;
});

after(async () => {
  await prisma?.$disconnect?.().catch(() => undefined);
  database.cleanup();
});

function withProductionGate<T>(value: string | undefined, run: () => Promise<T>): Promise<T> {
  const previous = process.env.CLINICAL_AUTHORITY_LIVE_PRODUCTION;
  if (value === undefined) delete process.env.CLINICAL_AUTHORITY_LIVE_PRODUCTION;
  else process.env.CLINICAL_AUTHORITY_LIVE_PRODUCTION = value;
  return run().finally(() => {
    if (previous === undefined) delete process.env.CLINICAL_AUTHORITY_LIVE_PRODUCTION;
    else process.env.CLINICAL_AUTHORITY_LIVE_PRODUCTION = previous;
  });
}

async function clearActivations() {
  await prisma.ruleSetActivation.deleteMany({});
}

// ── 1 ───────────────────────────────────────────────────────────────────────

test("1. no activation resolves to LEGACY", async () => {
  await clearActivations();
  const authority = await resolveClinicalAuthority({ environment: "DEMO" });
  assert.equal(authority.authorityEngine, "LEGACY");
  assert.equal(authority.evaluationMode, "SHADOW");
  assert.equal(authority.activationScope, "NONE");
  assert.match(authority.reason, /no ACTIVE clinical rule activation/i);
});

// ── 2 and 3: the production gate ────────────────────────────────────────────

test("2. global canonical activation with the production gate OFF resolves to LEGACY", async () => {
  await clearActivations();
  const version = await seedVersion(prisma as never, {
    ruleSetId,
    displayVersion: "CG-NCSP-3.1.0-p2",
    status: "ACTIVE",
    patch: 2,
  });
  await seedActivation(prisma as never, {
    ruleSetId,
    ruleVersionId: version.id,
    environment: "PRODUCTION",
  });

  await withProductionGate(undefined, async () => {
    const authority = await resolveClinicalAuthority({ environment: "PRODUCTION" });
    assert.equal(authority.authorityEngine, "LEGACY");
    assert.match(authority.reason, /CLINICAL_AUTHORITY_LIVE_PRODUCTION is off/i);
  });
});

test("3. organisation activation with the production gate OFF resolves to LEGACY", async () => {
  await clearActivations();
  const version = await seedVersion(prisma as never, {
    ruleSetId,
    displayVersion: "CG-NCSP-3.1.0-p3",
    status: "ACTIVE",
    patch: 3,
  });
  await seedActivation(prisma as never, {
    ruleSetId,
    ruleVersionId: version.id,
    environment: "PRODUCTION",
    organisationKey: "org-a",
  });

  for (const value of [undefined, "false", "0", "off", ""]) {
    await withProductionGate(value, async () => {
      const authority = await resolveClinicalAuthority({
        environment: "PRODUCTION",
        organisationKey: "org-a",
      });
      assert.equal(
        authority.authorityEngine,
        "LEGACY",
        `gate value ${JSON.stringify(value)} must not enable canonical authority`
      );
    });
  }
});

// ── 4: gate enabled in the test harness only ────────────────────────────────

test("4. activation plus gate resolves canonical authority correctly", async () => {
  await clearActivations();
  const version = await seedVersion(prisma as never, {
    ruleSetId,
    displayVersion: "CG-NCSP-3.1.0-p4",
    status: "ACTIVE",
    checksum: "checksum-p4",
    patch: 4,
  });
  const activation = await seedActivation(prisma as never, {
    ruleSetId,
    ruleVersionId: version.id,
    environment: "PRODUCTION",
    organisationKey: "org-a",
  });

  await withProductionGate("true", async () => {
    const authority = await resolveClinicalAuthority({
      environment: "PRODUCTION",
      organisationKey: "org-a",
    });
    assert.equal(authority.authorityEngine, "CANONICAL");
    assert.equal(authority.evaluationMode, "LIVE_PRODUCTION");
    assert.equal(authority.ruleSetVersion, "CG-NCSP-3.1.0-p4");
    assert.equal(authority.ruleSetChecksum, "checksum-p4");
    assert.equal(authority.activationId, activation.id);
    assert.equal(authority.activationScope, "ORGANISATION");
    // The router is legacy under BOTH authorities.
    assert.equal(authority.routerEngine, "business-figures-table1-v1");
  });
});

// ── 5: organisation overrides global ────────────────────────────────────────

test("5. an organisation activation overrides the global activation", async () => {
  await clearActivations();
  const globalVersion = await seedVersion(prisma as never, {
    ruleSetId,
    displayVersion: "CG-NCSP-3.1.0-global",
    status: "ACTIVE",
    patch: 5,
  });
  const orgVersion = await seedVersion(prisma as never, {
    ruleSetId,
    displayVersion: "CG-NCSP-3.1.0-org",
    status: "ACTIVE",
    patch: 6,
  });
  await seedActivation(prisma as never, {
    ruleSetId,
    ruleVersionId: globalVersion.id,
    environment: "TEST",
    organisationKey: null,
  });
  await seedActivation(prisma as never, {
    ruleSetId,
    ruleVersionId: orgVersion.id,
    environment: "TEST",
    organisationKey: "org-a",
  });

  const orgAuthority = await resolveClinicalAuthority({
    environment: "TEST",
    organisationKey: "org-a",
  });
  assert.equal(orgAuthority.ruleSetVersion, "CG-NCSP-3.1.0-org");
  assert.equal(orgAuthority.activationScope, "ORGANISATION");

  // A different organisation falls through to global.
  const otherAuthority = await resolveClinicalAuthority({
    environment: "TEST",
    organisationKey: "org-b",
  });
  assert.equal(otherAuthority.ruleSetVersion, "CG-NCSP-3.1.0-global");
  assert.equal(otherAuthority.activationScope, "GLOBAL");
});

// ── 6: deactivated activation ───────────────────────────────────────────────

test("6. a deactivated activation is never selected", async () => {
  await clearActivations();
  const version = await seedVersion(prisma as never, {
    ruleSetId,
    displayVersion: "CG-NCSP-3.1.0-p7",
    status: "ACTIVE",
    patch: 7,
  });
  await seedActivation(prisma as never, {
    ruleSetId,
    ruleVersionId: version.id,
    environment: "TEST",
    deactivatedAt: new Date(),
  });

  const authority = await resolveClinicalAuthority({ environment: "TEST" });
  assert.equal(authority.authorityEngine, "LEGACY");
});

// ── 7: DRAFT ruleset ────────────────────────────────────────────────────────

test("7. a DRAFT ruleset is never live-authoritative", async () => {
  await clearActivations();
  for (const status of ["DRAFT", "VALIDATED", "PUBLISHED", "RETIRED"]) {
    await prisma.ruleSetActivation.deleteMany({});
    const version = await seedVersion(prisma as never, {
      ruleSetId,
      displayVersion: `CG-NCSP-3.1.0-${status}`,
      status,
      patch: 10 + status.length,
    });
    await seedActivation(prisma as never, {
      ruleSetId,
      ruleVersionId: version.id,
      environment: "TEST",
    });
    const authority = await resolveClinicalAuthority({ environment: "TEST" });
    assert.equal(
      authority.authorityEngine,
      "LEGACY",
      `${status} must not be clinically authoritative even with an activation row`
    );
    assert.match(authority.reason, /not ACTIVE or has no published checksum/i);
  }
});

// ── 8: missing checksum ─────────────────────────────────────────────────────

test("8. an ACTIVE version without a checksum fails closed to LEGACY", async () => {
  await clearActivations();
  const version = await seedVersion(prisma as never, {
    ruleSetId,
    displayVersion: "CG-NCSP-3.1.0-nochecksum",
    status: "ACTIVE",
    checksum: null,
    patch: 20,
  });
  await seedActivation(prisma as never, {
    ruleSetId,
    ruleVersionId: version.id,
    environment: "TEST",
  });

  const authority = await resolveClinicalAuthority({ environment: "TEST" });
  assert.equal(authority.authorityEngine, "LEGACY");
  assert.match(authority.reason, /no published checksum/i);
});

// ── 9: database error ───────────────────────────────────────────────────────

test("9. a database error fails closed to LEGACY", async () => {
  const { resolveClinicalAuthority: resolver } = await import("../../lib/clinical-rules/authority");
  const findUnique = prisma.clinicalRuleSet.findUnique;
  // Force the lookup to throw.
  (prisma.clinicalRuleSet as { findUnique: unknown }).findUnique = () => {
    throw new Error("simulated database failure");
  };
  try {
    const authority = await resolver({ environment: "TEST" });
    assert.equal(authority.authorityEngine, "LEGACY");
    assert.match(authority.reason, /resolution failed/i);
  } finally {
    (prisma.clinicalRuleSet as { findUnique: unknown }).findUnique = findUnique;
  }
});

// ── 10: rollback ────────────────────────────────────────────────────────────

test("10. after rollback, new resolutions return LEGACY immediately", async () => {
  await clearActivations();
  const version = await seedVersion(prisma as never, {
    ruleSetId,
    displayVersion: "CG-NCSP-3.1.0-rollback",
    status: "ACTIVE",
    patch: 30,
  });
  const activation = await seedActivation(prisma as never, {
    ruleSetId,
    ruleVersionId: version.id,
    environment: "TEST",
    organisationKey: "org-a",
  });

  const before = await resolveClinicalAuthority({ environment: "TEST", organisationKey: "org-a" });
  assert.equal(before.authorityEngine, "CANONICAL");

  // Rollback = deactivate. No deletion, no restore.
  await prisma.ruleSetActivation.update({
    where: { id: activation.id },
    data: { deactivatedAt: new Date() },
  });

  const started = Date.now();
  const after = await resolveClinicalAuthority({ environment: "TEST", organisationKey: "org-a" });
  const elapsedMs = Date.now() - started;

  assert.equal(after.authorityEngine, "LEGACY", "rollback must take effect on the very next resolution");
  assert.ok(elapsedMs < 5_000, `rollback visibility took ${elapsedMs}ms; must be immediate`);

  // The activation row still exists — rollback destroys nothing.
  const stillThere = await prisma.ruleSetActivation.findUnique({ where: { id: activation.id } });
  assert.ok(stillThere, "rollback must not delete the activation record");
  assert.ok(stillThere?.deactivatedAt, "rollback must record when the activation ended");
});

test("10a. an in-flight workflow created before activation remains Legacy", async () => {
  await clearActivations();
  const version = await seedVersion(prisma as never, {
    ruleSetId,
    displayVersion: "CG-NCSP-3.1.0-new-cases-only",
    status: "ACTIVE",
    patch: 31,
  });
  const activation = await seedActivation(prisma as never, {
    ruleSetId,
    ruleVersionId: version.id,
    environment: "TEST",
  });
  const stored = await prisma.ruleSetActivation.findUniqueOrThrow({ where: { id: activation.id } });

  const existing = await resolveClinicalAuthority({
    environment: "TEST",
    caseCreatedAt: new Date(stored.activatedAt.getTime() - 1),
  });
  assert.equal(existing.authorityEngine, "LEGACY");
  assert.match(existing.reason, /predates the canonical activation/i);

  const newCase = await resolveClinicalAuthority({
    environment: "TEST",
    caseCreatedAt: new Date(stored.activatedAt.getTime() + 1),
  });
  assert.equal(newCase.authorityEngine, "CANONICAL");
});

// ── 11 and 12: pinning ──────────────────────────────────────────────────────

test("11. an already-pinned case retains its original authority", async () => {
  const { getCaseAuthorityPin, applyPin } = await import("../../lib/clinical-rules/pinning");
  await clearActivations();

  const version = await seedVersion(prisma as never, {
    ruleSetId,
    displayVersion: "CG-NCSP-3.1.0-pin",
    status: "ACTIVE",
    patch: 40,
  });
  const { referralCase } = await seedReferralCase(prisma as never, "pin");

  await prisma.ruleEvaluation.create({
    data: {
      caseId: referralCase.id,
      ruleSetId,
      ruleVersionId: version.id,
      ruleVersionDisplay: "CG-NCSP-3.1.0-pin",
      rulesetChecksum: "checksum-abc",
      engineVersion: "canonical-graph-v2",
      evaluationMode: "LIVE_DEMO",
      canonicalInputSnapshot: "{}",
      matchedRuleIds: "[]",
      branchPath: "[]",
      provisionalRecommendation: "pinned canonical recommendation",
      riskLevel: "LOW",
      missingInformation: "[]",
      reviewerRequirement: "CLINICIAN_REVIEW",
      sourceReferences: "[]",
      evaluationTrace: "{}",
    },
  });

  const pin = await getCaseAuthorityPin(referralCase.id);
  assert.equal(pin.authorityEngine, "CANONICAL");
  assert.equal(pin.inferredLegacy, false);

  // Even though the resolver now says LEGACY, the pin wins.
  const resolved = await resolveClinicalAuthority({ environment: "TEST" });
  assert.equal(resolved.authorityEngine, "LEGACY");
  const { pinned, authority } = applyPin(resolved, pin);
  assert.equal(pinned, true);
  assert.equal((authority as typeof pin).ruleVersionDisplay, "CG-NCSP-3.1.0-pin");
});

test("12. a shadow evaluation never pins live authority", async () => {
  const { getCaseAuthorityPin } = await import("../../lib/clinical-rules/pinning");

  const version = await seedVersion(prisma as never, {
    ruleSetId,
    displayVersion: "CG-NCSP-3.1.0-shadow",
    status: "ACTIVE",
    patch: 50,
  });
  const { referralCase } = await seedReferralCase(prisma as never, "shadow");

  for (const mode of ["SHADOW", "SIMULATION"]) {
    await prisma.ruleEvaluation.create({
      data: {
        caseId: referralCase.id,
        ruleSetId,
        ruleVersionId: version.id,
        ruleVersionDisplay: "CG-NCSP-3.1.0-shadow",
        rulesetChecksum: "checksum-abc",
        engineVersion: "canonical-graph-v2",
        evaluationMode: mode as never,
        canonicalInputSnapshot: "{}",
        matchedRuleIds: "[]",
        branchPath: "[]",
        provisionalRecommendation: `${mode} recommendation`,
        riskLevel: "LOW",
        missingInformation: "[]",
        reviewerRequirement: "CLINICIAN_REVIEW",
        sourceReferences: "[]",
        evaluationTrace: "{}",
      },
    });
  }

  const pin = await getCaseAuthorityPin(referralCase.id);
  assert.equal(pin.authorityEngine, "LEGACY", "shadow/simulation evaluations must not pin canonical authority");
  assert.equal(pin.inferredLegacy, true);
  assert.equal(pin.evaluationId, null);
});

// ── Determinism ─────────────────────────────────────────────────────────────

test("authority resolution is deterministic across repeated calls", async () => {
  await clearActivations();
  const version = await seedVersion(prisma as never, {
    ruleSetId,
    displayVersion: "CG-NCSP-3.1.0-det",
    status: "ACTIVE",
    patch: 60,
  });
  await seedActivation(prisma as never, {
    ruleSetId,
    ruleVersionId: version.id,
    environment: "TEST",
  });

  const results = await Promise.all(
    Array.from({ length: 25 }, () => resolveClinicalAuthority({ environment: "TEST" }))
  );
  const distinct = new Set(results.map((r) => `${r.authorityEngine}:${r.ruleSetVersion}:${r.activationId}`));
  assert.equal(distinct.size, 1, `authority resolution nondeterminism = ${distinct.size - 1}`);
});

test("no LIVE_PRODUCTION evaluation exists in this isolated database", async () => {
  const count = await prisma.ruleEvaluation.count({ where: { evaluationMode: "LIVE_PRODUCTION" } });
  assert.equal(count, 0, "this suite must not create LIVE_PRODUCTION evaluations");
});
