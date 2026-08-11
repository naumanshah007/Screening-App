/**
 * SHARED-REHEARSAL harness — activation and rollback rehearsal (observations A–L).
 *
 * SAFETY
 * ------
 * - Refuses to run against a Production deployment or the Production database.
 * - Activates only in the VALIDATION environment. It never touches PRODUCTION
 *   authority and never sets CLINICAL_AUTHORITY_LIVE_PRODUCTION.
 * - Uses synthetic rehearsal identities on the `.invalid` reserved TLD and
 *   synthetic subject references, so no rehearsal signature can be mistaken for
 *   a Production clinical approval and no real participant data is involved.
 *
 * Run with REHEARSAL_DATABASE_URL pointing at a dedicated non-Production
 * durable database.
 */

import { performance } from "node:perf_hooks";

import { prisma } from "@/lib/prisma";
import { resolveDatabaseUrl, getDatabaseRuntimeSummary } from "@/lib/config/database";
import {
  importNcspRulebookV21,
  importNcspRulebookV21Successor,
} from "@/lib/clinical-rules/importer";
import {
  activateClinicalRuleVersion,
  rollbackClinicalRuleAuthorityToLegacy,
  approveClinicalRuleVersion,
  publishClinicalRuleVersion,
  validateClinicalRuleVersion,
} from "@/lib/clinical-rules/lifecycle";
import { resolveClinicalAuthority } from "@/lib/clinical-rules/authority";
import { evaluateGradedDecision } from "@/lib/clinical-rules/graded-decision";
import { getClinicalAuthorityMonitoringSummary } from "@/lib/clinical-rules/monitoring";
import type { ClinicalInput } from "@/lib/engine/types";
import { canonicalV2Corpus } from "@/lib/clinical-rules/__tests__/support/canonical-v2-corpus";

/**
 * A governed source-oracle fixture, so the canonical evaluation matches a real
 * rule and F can prove a controlling rule id. Sparse ad-hoc facts land on the
 * governed "insufficient rule coverage" stop, which is correct behaviour but
 * proves nothing about provenance.
 */
const ORACLE = canonicalV2Corpus.find((entry) => entry.caseId === "F3-01") ?? canonicalV2Corpus[0];

type Observation = { id: string; title: string; pass: boolean; detail: Record<string, unknown> };
const observations: Observation[] = [];
function record(id: string, title: string, pass: boolean, detail: Record<string, unknown>) {
  observations.push({ id, title, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${title}`);
  for (const [k, v] of Object.entries(detail)) console.log(`        ${k}: ${JSON.stringify(v)}`);
}

/** Synthetic rehearsal actors. `.invalid` is reserved and unroutable by RFC 2606. */
const ACTORS = {
  creator: "rehearsal.creator@validation.invalid",
  approverA: "rehearsal.approver-a@validation.invalid",
  approverB: "rehearsal.approver-b@validation.invalid",
  operator: "rehearsal.operator@validation.invalid",
} as const;

async function ensureActor(email: string, role: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing;
  return prisma.user.create({
    data: { email, name: `Rehearsal ${role}`, role: "ADMIN", passwordHash: null },
  });
}

/**
 * Real Patient + ReferralCase rows are required: RuleEvaluation.caseId is a
 * foreign key to ReferralCase, and a missing parent makes the evaluator fail
 * closed rather than record a canonical result.
 */
async function ensureSyntheticCase(caseRef: string, subject: string, createdByUserId: string) {
  const patient = await prisma.patient.upsert({
    where: { nhi: subject },
    update: {},
    create: {
      nhi: subject,
      firstName: "Synthetic",
      lastName: `Rehearsal ${subject}`,
      dateOfBirth: new Date("1984-01-01T00:00:00.000Z"),
      status: "ACTIVE",
      isFirstTimeHPVTransition: false,
      isPostHysterectomy: false,
      interpreterRequired: false,
    },
  });
  const existing = await prisma.referralCase.findUnique({ where: { id: caseRef } });
  if (existing) return existing;
  return prisma.referralCase.create({
    data: {
      id: caseRef,
      patientId: patient.id,
      serviceLine: "COLPOSCOPY",
      createdByUserId,
    },
  });
}

function syntheticInput(patientId: string, overrides: Partial<ClinicalInput> = {}): ClinicalInput {
  return {
    patientId,
    patientAge: 42,
    hpvResult: "NOT_DETECTED",
    isFirstTimeHPVTransition: false,
    isPostHysterectomy: false,
    atypicalEndometrialHistory: false,
    immunocompromised: false,
    ...overrides,
  } as ClinicalInput;
}

async function main() {
  // ── Guard rails ───────────────────────────────────────────────────────────
  const summary = getDatabaseRuntimeSummary();
  const url = resolveDatabaseUrl();
  if (process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production") {
    throw new Error("Refusing to run the rehearsal against a Production deployment.");
  }
  if (/aws-ap-south-1\.turso\.io/.test(url) && !process.env.REHEARSAL_ALLOW_REMOTE) {
    throw new Error("Refusing to run against the known Production database host.");
  }
  console.log(`Rehearsal database: mode=${summary.mode} target=${summary.displayTarget}`);
  console.log(`Environment: VALIDATION (activation is scoped to VALIDATION only)\n`);

  const [creator, approverA, approverB, operator] = await Promise.all([
    ensureActor(ACTORS.creator, "Creator"),
    ensureActor(ACTORS.approverA, "Approver A"),
    ensureActor(ACTORS.approverB, "Approver B"),
    ensureActor(ACTORS.operator, "Activation Operator"),
  ]);

  // ── A. Starting authority is Legacy ───────────────────────────────────────
  const startAuthority = await resolveClinicalAuthority({ environment: "VALIDATION" });
  record("A", "Starting authority is Legacy", startAuthority.authorityEngine === "LEGACY", {
    authorityEngine: startAuthority.authorityEngine,
    evaluationMode: startAuthority.evaluationMode,
    routerEngine: startAuthority.routerEngine,
    reason: startAuthority.reason,
  });

  // ── B. Synthetic Legacy case ──────────────────────────────────────────────
  const legacyCaseId = `REHEARSAL-LEGACY-${Date.now()}`;
  await ensureSyntheticCase(legacyCaseId, "SYNTHETIC-REHEARSAL-001", creator.id);
  const legacyRun = await evaluateGradedDecision({
    input: syntheticInput("SYNTHETIC-REHEARSAL-001"),
    subjectReference: "SYNTHETIC-REHEARSAL-001",
    enteredBy: creator.id,
    environment: "VALIDATION",
    caseId: legacyCaseId,
  });
  record("B", "Synthetic Legacy case created and evaluated", legacyRun.authority.authorityEngine === "LEGACY", {
    caseId: legacyCaseId,
    authorityEngine: legacyRun.authority.authorityEngine,
    figure: legacyRun.legacyDecision.figure,
    recommendationCode: legacyRun.decision.recommendationCode,
    evaluationId: legacyRun.evaluationId,
  });

  // ── C. Rehearsal state: import, validate, approve x2, publish ─────────────
  // The successor requires its protected parent (CG-NCSP-3.0.0) to exist first.
  await importNcspRulebookV21({ actorUserId: creator.id });
  const imported = await importNcspRulebookV21Successor({ actorUserId: creator.id });
  const versionId = imported.ruleVersionId;
  await validateClinicalRuleVersion({ id: versionId, actorUserId: creator.id });
  await approveClinicalRuleVersion({ id: versionId, actorUserId: approverA.id, reason: "Rehearsal approval A — synthetic, non-Production." });
  await approveClinicalRuleVersion({ id: versionId, actorUserId: approverB.id, reason: "Rehearsal approval B — synthetic, non-Production." });
  await publishClinicalRuleVersion({
    id: versionId,
    actorUserId: creator.id,
    reason: "Rehearsal publication — synthetic, non-Production.",
    sourceSummary: "Shared activation/rollback rehearsal on a dedicated non-Production database.",
  });
  const published = await prisma.clinicalRuleVersion.findUniqueOrThrow({ where: { id: versionId } });
  record("C", "Rehearsal state prepared with two distinct synthetic approvers", published.status === "PUBLISHED", {
    displayVersion: published.displayVersion,
    status: published.status,
    checksum: published.checksum?.slice(0, 16),
    approverA: approverA.email,
    approverB: approverB.email,
    note: "Synthetic .invalid identities — not Production clinical signatures",
  });

  // ── D. Activate in VALIDATION only ────────────────────────────────────────
  await activateClinicalRuleVersion({
    id: versionId,
    actorUserId: operator.id,
    environment: "VALIDATION",
    reason: "Shared rehearsal activation — VALIDATION only.",
  });
  const activated = await resolveClinicalAuthority({ environment: "VALIDATION" });
  record("D", "CG-NCSP-3.1.0 activated in VALIDATION only", activated.authorityEngine === "CANONICAL", {
    authorityEngine: activated.authorityEngine,
    environment: activated.environment,
    ruleSetVersion: activated.ruleSetVersion,
    activationScope: activated.activationScope,
    operator: operator.email,
    productionUntouched: (await resolveClinicalAuthority({ environment: "PRODUCTION" })).authorityEngine,
  });

  // ── E. New case runs the full chain ───────────────────────────────────────
  const canonicalCaseId = `REHEARSAL-CANONICAL-${Date.now()}`;
  await ensureSyntheticCase(canonicalCaseId, "SYNTHETIC-REHEARSAL-002", creator.id);
  const canonicalRun = await evaluateGradedDecision({
    input: syntheticInput("SYNTHETIC-REHEARSAL-002"),
    subjectReference: "SYNTHETIC-REHEARSAL-002",
    enteredBy: creator.id,
    environment: "VALIDATION",
    caseId: canonicalCaseId,
    canonicalFactsV2: ORACLE.canonicalFacts,
  });
  record("E", "New case: referral → legacy router → pathway → canonical → provisional recommendation", canonicalRun.authority.authorityEngine === "CANONICAL", {
    caseId: canonicalCaseId,
    legacyRouterFigure: canonicalRun.legacyDecision.figure,
    authorityEngine: canonicalRun.authority.authorityEngine,
    ruleSetVersion: canonicalRun.authority.ruleSetVersion,
    provisionalRecommendation: canonicalRun.decision.recommendation?.slice(0, 80),
    requiresMDMReview: canonicalRun.decision.requiresMDMReview ?? null,
    evaluationId: canonicalRun.evaluationId,
  });

  // ── F. Persisted provenance ───────────────────────────────────────────────
  const persisted = canonicalRun.evaluationId
    ? await prisma.ruleEvaluation.findUnique({ where: { id: canonicalRun.evaluationId } })
    : null;
  const matched: string[] = persisted?.matchedRuleIds ? JSON.parse(persisted.matchedRuleIds) : [];
  const provenanceComplete = Boolean(
    persisted &&
      persisted.engineVersion &&
      persisted.ruleVersionDisplay &&
      persisted.rulesetChecksum &&
      matched.length > 0 &&
      persisted.evaluatedAt
  );
  record("F", "Provenance persisted and verifiable", provenanceComplete, {
    evaluationId: persisted?.id,
    engine: persisted?.engineVersion,
    ruleset: persisted?.ruleVersionDisplay,
    checksum: persisted?.rulesetChecksum?.slice(0, 16),
    pathway: canonicalRun.legacyDecision.figure,
    controllingRuleId: matched[0] ?? null,
    oracleFixture: ORACLE.caseId,
    evaluationMode: persisted?.evaluationMode,
    timestamp: persisted?.evaluatedAt?.toISOString(),
  });

  // ── G. Original Legacy case stays pinned to Legacy ────────────────────────
  const legacyReplay = await evaluateGradedDecision({
    input: syntheticInput("SYNTHETIC-REHEARSAL-001"),
    subjectReference: "SYNTHETIC-REHEARSAL-001",
    enteredBy: creator.id,
    environment: "VALIDATION",
    caseId: legacyCaseId,
  });
  // A pin is established by the first clinically OPERATIVE evaluation, which only
  // canonical runs write. A case decided under Legacy therefore has no pin, and a
  // re-evaluation after activation adopts current authority. Recorded as an
  // observation with its real value — see the finding in the rehearsal report.
  const legacyStaysLegacy = legacyReplay.authority.authorityEngine === "LEGACY";
  record("G", "Pre-existing Legacy case on re-evaluation after activation", legacyStaysLegacy, {
    caseId: legacyCaseId,
    authorityEngine: legacyReplay.authority.authorityEngine,
    pinned: legacyReplay.pinned,
    authorityReason: legacyReplay.authorityReason,
    finding: legacyStaysLegacy
      ? "Legacy-era case retained Legacy authority."
      : "FINDING: a Legacy-era case is not pinned, because pins are established only by an operative canonical evaluation. A regrade after activation adopts canonical authority.",
  });

  // ── H. Rollback, with measured RTO ────────────────────────────────────────
  const rollbackStart = performance.now();
  await rollbackClinicalRuleAuthorityToLegacy({
    id: versionId,
    actorUserId: operator.id,
    environment: "VALIDATION",
    reason: "Shared rehearsal rollback to Legacy — VALIDATION only.",
  });
  const afterRollback = await resolveClinicalAuthority({ environment: "VALIDATION" });
  const rtoMs = performance.now() - rollbackStart;
  record("H", "Rollback / deactivation returns authority to Legacy", afterRollback.authorityEngine === "LEGACY", {
    authorityEngine: afterRollback.authorityEngine,
    reason: afterRollback.reason,
    databaseRestoreRequired: false,
  });

  // ── I. New case after rollback is Legacy ──────────────────────────────────
  const postRollbackCaseId = `REHEARSAL-POST-ROLLBACK-${Date.now()}`;
  await ensureSyntheticCase(postRollbackCaseId, "SYNTHETIC-REHEARSAL-003", creator.id);
  const postRollbackRun = await evaluateGradedDecision({
    input: syntheticInput("SYNTHETIC-REHEARSAL-003"),
    subjectReference: "SYNTHETIC-REHEARSAL-003",
    enteredBy: creator.id,
    environment: "VALIDATION",
    caseId: postRollbackCaseId,
  });
  record("I", "New case after rollback resolves to Legacy", postRollbackRun.authority.authorityEngine === "LEGACY", {
    caseId: postRollbackCaseId,
    authorityEngine: postRollbackRun.authority.authorityEngine,
  });

  // ── J. Canonical case stays canonical historically ────────────────────────
  const canonicalReplay = await evaluateGradedDecision({
    input: syntheticInput("SYNTHETIC-REHEARSAL-002"),
    subjectReference: "SYNTHETIC-REHEARSAL-002",
    enteredBy: creator.id,
    environment: "VALIDATION",
    caseId: canonicalCaseId,
    canonicalFactsV2: ORACLE.canonicalFacts,
  });
  const originalStillIntact = canonicalRun.evaluationId
    ? await prisma.ruleEvaluation.findUnique({ where: { id: canonicalRun.evaluationId } })
    : null;
  record("J", "Canonical case remains canonical historically after rollback", canonicalReplay.authority.authorityEngine === "CANONICAL" && Boolean(originalStillIntact), {
    caseId: canonicalCaseId,
    authorityEngine: canonicalReplay.authority.authorityEngine,
    pinned: canonicalReplay.pinned,
    originalEvaluationStillPresent: Boolean(originalStillIntact),
    originalRuleset: originalStillIntact?.ruleVersionDisplay,
  });

  // ── K. Immutability, audit, monitoring, fail-closed ───────────────────────
  const evaluationsNow = await prisma.ruleEvaluation.count();
  const activationEvents = await prisma.ruleVersionAuditEvent.findMany({
    where: { ruleVersionId: versionId, eventType: { in: ["ACTIVATION", "ROLLBACK_TO_LEGACY", "ROLLBACK", "DEACTIVATION"] } },
    select: { eventType: true, createdAt: true, actorUserId: true },
    orderBy: { createdAt: "asc" },
  });
  const auditRows = await prisma.auditLog.findMany({
    where: { entityId: versionId },
    select: { action: true },
  });
  let immutabilityEnforced = false;
  if (canonicalRun.evaluationId) {
    try {
      await prisma.ruleEvaluation.delete({ where: { id: canonicalRun.evaluationId } });
    } catch {
      immutabilityEnforced = true;
    }
  }
  let failClosed = false;
  try {
    await activateClinicalRuleVersion({
      id: versionId,
      actorUserId: operator.id,
      environment: "PRODUCTION",
      reason: "Rehearsal fail-closed probe — must be refused.",
    });
  } catch {
    failClosed = true;
  }
  const monitoring = await getClinicalAuthorityMonitoringSummary(1).catch(() => null);
  record("K", "Immutability, audit, monitoring and fail-closed behaviour", immutabilityEnforced && activationEvents.length >= 2 && failClosed, {
    ruleEvaluationsPresent: evaluationsNow,
    evaluationDeleteRefused: immutabilityEnforced,
    activationAuditEvents: activationEvents.map((e) => e.eventType),
    auditLogActions: [...new Set(auditRows.map((r) => r.action))],
    monitoringSummaryAvailable: Boolean(monitoring),
    productionActivationRefused: failClosed,
    databaseRestoreRequired: false,
  });

  // ── L. Measured rollback RTO ──────────────────────────────────────────────
  record("L", "Measured rollback RTO", rtoMs > 0, {
    rollbackToLegacyMs: Math.round(rtoMs),
    method: "deactivate activation row; no database restore",
  });

  const allPass = observations.every((o) => o.pass);
  console.log(`\n${allPass ? "SHARED_REHEARSAL_PASSED" : "SHARED_REHEARSAL_FAILED"}  (${observations.filter((o) => o.pass).length}/${observations.length})`);
  console.log(JSON.stringify({ generatedAt: new Date().toISOString(), database: summary.mode, observations }, null, 2));
  if (!allPass) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error("Rehearsal aborted:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
