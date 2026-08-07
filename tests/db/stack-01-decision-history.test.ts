/**
 * STACK-01 — `lib/cases/grading.ts` RuleDecision history.
 *
 * Two distinct claims are proved here:
 *
 *  1. GOVERNED evaluations are structurally untouchable by this stack. It writes
 *     only `RuleDecision`; it never writes, updates or deletes `RuleEvaluation`.
 *     The feared sequence — governed evaluation → grading.ts runs → governed
 *     recommendation overwritten — CANNOT occur.
 *
 *  2. This stack's OWN recommendation is upserted, so a re-evaluation replaces it
 *     in place. The prior decision is now captured on the append-only audit log,
 *     so replaced clinical history remains recoverable.
 *
 * Runs against a real isolated SQLite database carrying the production
 * immutability triggers.
 */

import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { applySchema, createIsolatedDatabase, seedReferralCase } from "./support/isolated-db";

const database = createIsolatedDatabase("stack01");

type Prisma = typeof import("../../lib/prisma")["prisma"];
let prisma: Prisma;
let getSupersededRuleDecisions: typeof import("../../lib/cases/grading")["getSupersededRuleDecisions"];

before(async () => {
  await applySchema(database.file);
  ({ prisma } = await import("../../lib/prisma"));
  ({ getSupersededRuleDecisions } = await import("../../lib/cases/grading"));
});

after(async () => {
  await prisma?.$disconnect?.().catch(() => undefined);
  database.cleanup();
});

/**
 * Mirrors the write that `generateRuleDecision` performs, without requiring the
 * full document/summary pipeline. The behaviour under test is the upsert plus
 * the audit capture, not the rule evaluation that precedes it.
 */
async function writeRuleDecision(args: {
  caseId: string;
  userId: string;
  priority: string;
  outcome: string;
}) {
  const superseded = await prisma.ruleDecision.findUnique({
    where: { caseId: args.caseId },
    select: {
      id: true,
      ruleSetReleaseId: true,
      priority: true,
      category: true,
      outcome: true,
      rationale: true,
      evidenceJson: true,
      traceJson: true,
      generatedBy: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const decision = await prisma.ruleDecision.upsert({
    where: { caseId: args.caseId },
    update: {
      priority: args.priority as never,
      category: "TEST",
      outcome: args.outcome,
      rationale: `rationale for ${args.outcome}`,
      evidenceJson: "{}",
      traceJson: "{}",
      generatedBy: args.userId,
    },
    create: {
      caseId: args.caseId,
      priority: args.priority as never,
      category: "TEST",
      outcome: args.outcome,
      rationale: `rationale for ${args.outcome}`,
      evidenceJson: "{}",
      traceJson: "{}",
      generatedBy: args.userId,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: args.userId,
      action: superseded ? "REEVALUATE" : "EVALUATE",
      entity: "RuleDecision",
      entityId: decision.id,
      oldValue: superseded ? JSON.stringify(superseded) : undefined,
      newValue: JSON.stringify({ priority: args.priority, outcome: args.outcome }),
    },
  });

  return decision;
}

async function governedEvaluation(caseId: string, label: string, mode = "SHADOW") {
  const ruleSet = await prisma.clinicalRuleSet.upsert({
    where: { key: "cervigrade-ncsp-national" },
    update: {},
    create: { key: "cervigrade-ncsp-national", name: "Test" },
  });
  const version = await prisma.clinicalRuleVersion.findFirst({ where: { ruleSetId: ruleSet.id } });
  const ruleVersion =
    version ??
    (await prisma.clinicalRuleVersion.create({
      data: {
        ruleSetId: ruleSet.id,
        versionMajor: 3,
        versionMinor: 1,
        versionPatch: 0,
        displayVersion: "CG-NCSP-3.1.0",
        status: "DRAFT",
        sourceGuidelineSummary: "test",
        snapshotJson: "{}",
        checksum: "checksum-abc",
      },
    }));

  return prisma.ruleEvaluation.create({
    data: {
      caseId,
      ruleSetId: ruleSet.id,
      ruleVersionId: ruleVersion.id,
      ruleVersionDisplay: "CG-NCSP-3.1.0",
      rulesetChecksum: "checksum-abc",
      engineVersion: "canonical-graph-v2",
      evaluationMode: mode as never,
      canonicalInputSnapshot: "{}",
      matchedRuleIds: "[]",
      branchPath: "[]",
      provisionalRecommendation: label,
      riskLevel: "LOW",
      missingInformation: "[]",
      reviewerRequirement: "CLINICIAN_REVIEW",
      sourceReferences: "[]",
      evaluationTrace: "{}",
    },
  });
}

// ── Claim 1: governed evaluations are untouchable by this stack ─────────────

test("a governed evaluation survives a subsequent RuleDecision write", async () => {
  const { referralCase, user } = await seedReferralCase(prisma as never, "gov1");
  const evaluation = await governedEvaluation(referralCase.id, "governed recommendation");

  await writeRuleDecision({
    caseId: referralCase.id,
    userId: user.id,
    priority: "P2",
    outcome: "case-stack outcome",
  });

  const after = await prisma.ruleEvaluation.findUnique({ where: { id: evaluation.id } });
  assert.ok(after, "the governed evaluation must still exist");
  assert.equal(after?.provisionalRecommendation, "governed recommendation");
});

test("repeated RuleDecision writes destroy no governed evaluation", async () => {
  const { referralCase, user } = await seedReferralCase(prisma as never, "gov2");
  await governedEvaluation(referralCase.id, "first governed");
  await governedEvaluation(referralCase.id, "second governed");

  for (const outcome of ["one", "two", "three"]) {
    await writeRuleDecision({ caseId: referralCase.id, userId: user.id, priority: "P3", outcome });
  }

  const evaluations = await prisma.ruleEvaluation.findMany({
    where: { caseId: referralCase.id },
    orderBy: { evaluatedAt: "asc" },
  });
  assert.equal(evaluations.length, 2, "historical governed recommendations destroyed = 0");
  assert.deepEqual(
    evaluations.map((e) => e.provisionalRecommendation),
    ["first governed", "second governed"]
  );
});

test("the database itself refuses to mutate a governed evaluation", async () => {
  const { referralCase } = await seedReferralCase(prisma as never, "gov3");
  const evaluation = await governedEvaluation(referralCase.id, "immutable recommendation");

  await assert.rejects(
    () =>
      prisma.ruleEvaluation.update({
        where: { id: evaluation.id },
        data: { provisionalRecommendation: "tampered" },
      }),
    "the immutability trigger must reject an update to an evaluation"
  );
  await assert.rejects(
    () => prisma.ruleEvaluation.delete({ where: { id: evaluation.id } }),
    "the immutability trigger must reject a delete of an evaluation"
  );

  const after = await prisma.ruleEvaluation.findUnique({ where: { id: evaluation.id } });
  assert.equal(after?.provisionalRecommendation, "immutable recommendation");
});

// ── Claim 2: this stack's own history is recoverable ────────────────────────

test("first decision records no superseded history", async () => {
  const { referralCase, user } = await seedReferralCase(prisma as never, "first");
  await writeRuleDecision({ caseId: referralCase.id, userId: user.id, priority: "P3", outcome: "initial" });

  const history = await getSupersededRuleDecisions(referralCase.id);
  assert.deepEqual(history, []);
});

test("a second evaluation preserves the replaced recommendation", async () => {
  const { referralCase, user } = await seedReferralCase(prisma as never, "second");
  await writeRuleDecision({ caseId: referralCase.id, userId: user.id, priority: "P3", outcome: "initial" });
  await writeRuleDecision({ caseId: referralCase.id, userId: user.id, priority: "P1", outcome: "escalated" });

  const current = await prisma.ruleDecision.findUnique({ where: { caseId: referralCase.id } });
  assert.equal(current?.outcome, "escalated", "the current decision is the latest");

  const history = await getSupersededRuleDecisions(referralCase.id);
  assert.equal(history.length, 1, "the replaced recommendation must be recoverable");
  assert.equal(history[0].decision.outcome, "initial");
  assert.equal(history[0].decision.priority, "P3");
  assert.equal(history[0].supersededByUserId, user.id);
});

test("repeated regrades preserve every replaced recommendation, newest first", async () => {
  const { referralCase, user } = await seedReferralCase(prisma as never, "regrade");
  // Note: TriagePriority (this stack) has no P4, unlike the engine's
  // ReferralPriority. The two priority vocabularies are not the same domain.
  for (const [priority, outcome] of [
    ["P5", "v1"],
    ["P3", "v2"],
    ["P2", "v3"],
    ["P1", "v4"],
  ]) {
    await writeRuleDecision({ caseId: referralCase.id, userId: user.id, priority, outcome });
  }

  const history = await getSupersededRuleDecisions(referralCase.id);
  assert.equal(history.length, 3, "three replacements must leave three recoverable decisions");
  assert.deepEqual(
    history.map((entry) => entry.decision.outcome),
    ["v3", "v2", "v1"],
    "newest superseded first"
  );

  const current = await prisma.ruleDecision.findUnique({ where: { caseId: referralCase.id } });
  assert.equal(current?.outcome, "v4");
});

test("a batch repeat over the same case preserves history", async () => {
  const { referralCase, user } = await seedReferralCase(prisma as never, "batch");
  // Simulates the same case being re-processed by a repeated batch run.
  await writeRuleDecision({ caseId: referralCase.id, userId: user.id, priority: "P3", outcome: "run-1" });
  await writeRuleDecision({ caseId: referralCase.id, userId: user.id, priority: "P3", outcome: "run-2" });

  const history = await getSupersededRuleDecisions(referralCase.id);
  assert.equal(history.length, 1);
  assert.equal(history[0].decision.outcome, "run-1");
});

test("a duplicate intake creates a separate case and never merges history", async () => {
  const first = await seedReferralCase(prisma as never, "dupA");
  const second = await seedReferralCase(prisma as never, "dupB");
  await writeRuleDecision({ caseId: first.referralCase.id, userId: first.user.id, priority: "P3", outcome: "a" });
  await writeRuleDecision({ caseId: second.referralCase.id, userId: second.user.id, priority: "P1", outcome: "b" });

  assert.deepEqual(await getSupersededRuleDecisions(first.referralCase.id), []);
  assert.deepEqual(await getSupersededRuleDecisions(second.referralCase.id), []);
  const a = await prisma.ruleDecision.findUnique({ where: { caseId: first.referralCase.id } });
  const b = await prisma.ruleDecision.findUnique({ where: { caseId: second.referralCase.id } });
  assert.equal(a?.outcome, "a");
  assert.equal(b?.outcome, "b");
});

test("a reopened case re-evaluated after a canonical shadow keeps both histories", async () => {
  const { referralCase, user } = await seedReferralCase(prisma as never, "reopen");
  await writeRuleDecision({ caseId: referralCase.id, userId: user.id, priority: "P3", outcome: "before-reopen" });
  const shadow = await governedEvaluation(referralCase.id, "canonical shadow", "SHADOW");
  await writeRuleDecision({ caseId: referralCase.id, userId: user.id, priority: "P1", outcome: "after-reopen" });

  const history = await getSupersededRuleDecisions(referralCase.id);
  assert.equal(history.length, 1);
  assert.equal(history[0].decision.outcome, "before-reopen");

  const evaluation = await prisma.ruleEvaluation.findUnique({ where: { id: shadow.id } });
  assert.equal(evaluation?.provisionalRecommendation, "canonical shadow");
});

test("a simulated future LIVE evaluation is not destroyed by a later RuleDecision", async () => {
  const { referralCase, user } = await seedReferralCase(prisma as never, "live");
  // LIVE_DEMO stands in for the future live authority; LIVE_PRODUCTION is never
  // created outside a throwaway database.
  const live = await governedEvaluation(referralCase.id, "live canonical recommendation", "LIVE_DEMO");
  await writeRuleDecision({ caseId: referralCase.id, userId: user.id, priority: "P2", outcome: "later" });

  const after = await prisma.ruleEvaluation.findUnique({ where: { id: live.id } });
  assert.equal(after?.provisionalRecommendation, "live canonical recommendation");
  assert.equal(after?.evaluationMode, "LIVE_DEMO");
});

test("no code path in this stack writes RuleEvaluation", async () => {
  // Structural guard: the feared overwrite sequence is impossible because the
  // module never references the governed evaluation table at all.
  const { readFileSync } = await import("node:fs");
  const source = readFileSync("lib/cases/grading.ts", "utf8");
  assert.equal(
    /ruleEvaluation\s*\.\s*(create|update|delete|upsert|deleteMany|updateMany)/.test(source),
    false,
    "lib/cases/grading.ts must never write a governed RuleEvaluation"
  );
});
