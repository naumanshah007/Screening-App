/**
 * Existing-case authority pinning policy.
 *
 * A case that has already received a clinical decision stays pinned to the
 * authority under which that decision was made. Changing the global clinical
 * authority must never silently re-evaluate an existing case under another
 * authority. A deliberate regrade is a separate action that adds new immutable
 * history without disturbing what came before.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { prisma } from "@/lib/prisma";
import { LEGACY_ENGINE_VERSION } from "@/lib/clinical-rules/authority";
import { applyPin, getCaseAuthorityPin } from "@/lib/clinical-rules/pinning";
import { backfillCaseAuthorityPins } from "@/scripts/rule-studio/backfill-case-authority-pins";

const RUN = `PINTEST-${Date.now()}`;

async function actor() {
  const email = `${RUN}-actor@validation.invalid`;
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name: "Pin Test Actor", role: "ADMIN" },
  });
}

async function makeCase(suffix: string) {
  const user = await actor();
  const patient = await prisma.patient.create({
    data: {
      nhi: `${RUN}-${suffix}`,
      firstName: "Synthetic",
      lastName: "PinTest",
      dateOfBirth: new Date("1985-05-05T00:00:00.000Z"),
      status: "ACTIVE",
      isFirstTimeHPVTransition: false,
      isPostHysterectomy: false,
      interpreterRequired: false,
    },
  });
  return prisma.referralCase.create({
    data: {
      id: `${RUN}-CASE-${suffix}`,
      patientId: patient.id,
      serviceLine: "COLPOSCOPY",
      createdByUserId: user.id,
    },
  });
}

async function giveLegacyDecision(caseId: string, outcome = "Legacy provisional outcome") {
  return prisma.ruleDecision.create({
    data: {
      caseId,
      outcome,
      rationale: "Synthetic legacy decision for the pinning policy test.",
      evidenceJson: "{}",
      traceJson: "[]",
      generatedBy: LEGACY_ENGINE_VERSION,
    },
  });
}

// ── 1. A Legacy decision pins the case to Legacy ────────────────────────────

test("a historical Legacy decision pins the case to Legacy", async () => {
  const referralCase = await makeCase("LEGACY-PIN");
  const before = await getCaseAuthorityPin(referralCase.id);
  assert.equal(before.authorityEngine, "LEGACY");
  assert.equal(before.inferredLegacy, true, "no history yet — not pinned");

  await giveLegacyDecision(referralCase.id);

  const after = await getCaseAuthorityPin(referralCase.id);
  assert.equal(after.authorityEngine, "LEGACY");
  assert.equal(after.inferredLegacy, false, "a decided case must be genuinely pinned");
  assert.ok(after.pinnedAt, "the pin must carry the original decision time");
});

test("a Legacy pin survives a canonical activation", async () => {
  const referralCase = await makeCase("LEGACY-SURVIVES");
  await giveLegacyDecision(referralCase.id);

  const pin = await getCaseAuthorityPin(referralCase.id);
  // Simulate the global authority now being canonical.
  const resolvedCanonical = { authorityEngine: "CANONICAL" as const };
  const applied = applyPin(resolvedCanonical, pin);

  assert.equal(applied.pinned, true, "an activation must not move a decided case");
  assert.equal(
    (applied.authority as { authorityEngine: string }).authorityEngine,
    "LEGACY"
  );
});

// ── 2. Canonical pins survive rollback ──────────────────────────────────────

test("a canonical pin survives a rollback to Legacy", async () => {
  const referralCase = await makeCase("CANONICAL-SURVIVES");
  const ruleSet = await prisma.clinicalRuleSet.findFirst();
  const version = await prisma.clinicalRuleVersion.findFirst();
  if (!ruleSet || !version) return; // requires an imported ruleset

  await prisma.ruleEvaluation.create({
    data: {
      caseId: referralCase.id,
      ruleSetId: ruleSet.id,
      ruleVersionId: version.id,
      ruleVersionDisplay: version.displayVersion,
      rulesetChecksum: version.checksum ?? "checksum",
      engineVersion: "canonical-graph-v2",
      evaluationMode: "LIVE_DEMO",
      canonicalInputSnapshot: "{}",
      matchedRuleIds: JSON.stringify(["F3-01"]),
      branchPath: "[]",
      provisionalRecommendation: "Synthetic canonical outcome",
      riskLevel: "LOW",
      missingInformation: "[]",
      reviewerRequirement: "CLINICIAN_REVIEW",
      mandatoryReviewerConfirmation: false,
      clinicianOnly: false,
      sourceReferences: "[]",
      evaluationTrace: "[]",
    },
  });

  const pin = await getCaseAuthorityPin(referralCase.id);
  assert.equal(pin.authorityEngine, "CANONICAL");
  assert.equal(pin.inferredLegacy, false);

  // Global authority rolled back to Legacy.
  const applied = applyPin({ authorityEngine: "LEGACY" as const }, pin);
  assert.equal(applied.pinned, true, "rollback must not rewrite historic case authority");
  assert.equal((applied.authority as { authorityEngine: string }).authorityEngine, "CANONICAL");
});

// ── 3. An explicit persisted pin wins and is never silently overwritten ─────

test("an explicit persisted pin is authoritative", async () => {
  const referralCase = await makeCase("EXPLICIT");
  await prisma.caseAuthorityPin.create({
    data: {
      caseId: referralCase.id,
      authorityEngine: "LEGACY",
      engineVersion: LEGACY_ENGINE_VERSION,
      pinnedAt: new Date("2026-01-01T00:00:00.000Z"),
      origin: "LEGACY_DECISION",
    },
  });
  const pin = await getCaseAuthorityPin(referralCase.id);
  assert.equal(pin.authorityEngine, "LEGACY");
  assert.equal(pin.inferredLegacy, false);
  assert.equal(pin.pinnedAt?.toISOString(), "2026-01-01T00:00:00.000Z");
});

test("a conflicting authority history fails closed and leaves the pin untouched", async () => {
  const referralCase = await makeCase("CONFLICT");
  // Persisted pin says LEGACY…
  await prisma.caseAuthorityPin.create({
    data: {
      caseId: referralCase.id,
      authorityEngine: "LEGACY",
      engineVersion: LEGACY_ENGINE_VERSION,
      pinnedAt: new Date("2026-01-01T00:00:00.000Z"),
      origin: "LEGACY_DECISION",
    },
  });
  const ruleSet = await prisma.clinicalRuleSet.findFirst();
  const version = await prisma.clinicalRuleVersion.findFirst();
  if (!ruleSet || !version) return;
  // …but an operative canonical evaluation also exists.
  await prisma.ruleEvaluation.create({
    data: {
      caseId: referralCase.id,
      ruleSetId: ruleSet.id,
      ruleVersionId: version.id,
      ruleVersionDisplay: version.displayVersion,
      rulesetChecksum: version.checksum ?? "checksum",
      engineVersion: "canonical-graph-v2",
      evaluationMode: "LIVE_DEMO",
      canonicalInputSnapshot: "{}",
      matchedRuleIds: JSON.stringify(["F3-01"]),
      branchPath: "[]",
      provisionalRecommendation: "Synthetic canonical outcome",
      riskLevel: "LOW",
      missingInformation: "[]",
      reviewerRequirement: "CLINICIAN_REVIEW",
      mandatoryReviewerConfirmation: false,
      clinicianOnly: false,
      sourceReferences: "[]",
      evaluationTrace: "[]",
    },
  });

  const result = await backfillCaseAuthorityPins({ dryRun: false });
  const conflict = result.conflicts.find((item) => item.caseId === referralCase.id);
  assert.ok(conflict, "a disagreement between pin and history must be reported");

  const pin = await prisma.caseAuthorityPin.findUniqueOrThrow({ where: { caseId: referralCase.id } });
  assert.equal(pin.authorityEngine, "LEGACY", "the existing pin must not be overwritten");
});

// ── 4. Backfill is idempotent and adds provenance only ──────────────────────

test("backfill creates a Legacy pin from decision history and is idempotent", async () => {
  const referralCase = await makeCase("BACKFILL");
  const decision = await giveLegacyDecision(referralCase.id, "Original legacy outcome");

  const first = await backfillCaseAuthorityPins({ dryRun: false });
  assert.ok(first.created >= 1);

  const pin = await prisma.caseAuthorityPin.findUniqueOrThrow({ where: { caseId: referralCase.id } });
  assert.equal(pin.authorityEngine, "LEGACY");
  assert.equal(pin.origin, "LEGACY_DECISION_BACKFILL");
  assert.equal(pin.pinnedAt.toISOString(), decision.createdAt.toISOString());

  // Rerunning must not duplicate or change anything.
  const second = await backfillCaseAuthorityPins({ dryRun: false });
  const pinAfter = await prisma.caseAuthorityPin.findUniqueOrThrow({ where: { caseId: referralCase.id } });
  assert.equal(pinAfter.id, pin.id, "rerun must not replace the pin");
  assert.equal(second.conflicts.length, first.conflicts.length);

  // Clinical content untouched.
  const decisionAfter = await prisma.ruleDecision.findUniqueOrThrow({ where: { caseId: referralCase.id } });
  assert.equal(decisionAfter.outcome, "Original legacy outcome");
  assert.equal(decisionAfter.createdAt.toISOString(), decision.createdAt.toISOString());
  assert.equal(decisionAfter.generatedBy, LEGACY_ENGINE_VERSION);
});

test("backfill records an audit row for every pin it creates", async () => {
  const referralCase = await makeCase("AUDIT");
  await giveLegacyDecision(referralCase.id);
  await backfillCaseAuthorityPins({ dryRun: false });

  const audit = await prisma.auditLog.findFirst({
    where: { action: "CASE_AUTHORITY_PIN_BACKFILL", entityId: referralCase.id },
  });
  assert.ok(audit, "pin creation must be auditable");
});

test("a dry run reports without writing", async () => {
  const referralCase = await makeCase("DRYRUN");
  await giveLegacyDecision(referralCase.id);
  const result = await backfillCaseAuthorityPins({ dryRun: true });
  assert.ok(result.created >= 1);
  const pin = await prisma.caseAuthorityPin.findUnique({ where: { caseId: referralCase.id } });
  assert.equal(pin, null, "a dry run must not write");
});

// ── 5. Regrade adds history and never overwrites ────────────────────────────

test("an explicit regrade creates new immutable history and preserves the prior evaluation", async () => {
  const referralCase = await makeCase("REGRADE");
  const ruleSet = await prisma.clinicalRuleSet.findFirst();
  const version = await prisma.clinicalRuleVersion.findFirst();
  if (!ruleSet || !version) return;

  const base = {
    caseId: referralCase.id,
    ruleSetId: ruleSet.id,
    ruleVersionId: version.id,
    ruleVersionDisplay: version.displayVersion,
    rulesetChecksum: version.checksum ?? "checksum",
    engineVersion: "canonical-graph-v2",
    evaluationMode: "LIVE_DEMO" as const,
    canonicalInputSnapshot: "{}",
    branchPath: "[]",
    riskLevel: "LOW",
    missingInformation: "[]",
    reviewerRequirement: "CLINICIAN_REVIEW",
    mandatoryReviewerConfirmation: false,
    clinicianOnly: false,
    sourceReferences: "[]",
    evaluationTrace: "[]",
  };

  const original = await prisma.ruleEvaluation.create({
    data: { ...base, matchedRuleIds: JSON.stringify(["F3-01"]), provisionalRecommendation: "First outcome" },
  });
  const regrade = await prisma.ruleEvaluation.create({
    data: {
      ...base,
      matchedRuleIds: JSON.stringify(["F3-02"]),
      provisionalRecommendation: "Regraded outcome",
      previousEvaluationId: original.id,
      regradeReason: "Deliberate regrade for the pinning policy test.",
    },
  });

  const preserved = await prisma.ruleEvaluation.findUniqueOrThrow({ where: { id: original.id } });
  assert.equal(preserved.provisionalRecommendation, "First outcome", "prior evidence must be preserved");
  assert.equal(regrade.previousEvaluationId, original.id, "the regrade must link to what it replaced");
  assert.ok(regrade.regradeReason, "a regrade must record its reason");

  // The pin still points at the FIRST operative evaluation.
  const pin = await getCaseAuthorityPin(referralCase.id);
  assert.equal(pin.evaluationId, original.id, "a regrade must not move the pin");
});
