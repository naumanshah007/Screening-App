/**
 * Batch Persistence + Review Worklist
 *
 * Bridges the in-memory batch decision engine to a persisted reviewer queue.
 *
 * Before this, a batch run computed recommendations and threw them away.
 * Now a run is saved as a BatchRun + BatchReviewItem[], so a reviewer can
 * open the worklist, see every pre-graded case with its full picture, and
 * bulk accept / reject / mark-for-info — with an audit trail on every action.
 *
 * The input is a `BatchProcessingResult` (see lib/batch/processor.ts), which is
 * source-agnostic: it looks the same whether the rows came from a CSV upload,
 * an HL7v2 lab feed, or an ERMS eReferral. Only the `source` enum differs.
 */

import type { Prisma, BatchReviewDisposition } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type {
  BatchProcessingResult,
  BatchCaseResult,
  SourceType,
} from "@/lib/batch/types";
import { getActiveCaseRuleSetRelease } from "@/lib/cases/rule-releases";
import { parseCaseRuleReleaseDefinition } from "@/lib/cases/rule-policy";
import { gradeCanonicalCase } from "@/lib/batch/rule-facts";
import type { DecisionSnapshot } from "@/lib/batch/reprocessing";
import { evaluateClinicalCase } from "@/lib/clinical-rules/evaluator";
import { resolveShadowClinicalRuleVersion } from "@/lib/clinical-rules/lifecycle";

// ─── Source mapping ───────────────────────────────────────────────────────────

const SOURCE_TYPE_TO_ENUM: Record<SourceType, Prisma.BatchRunCreateInput["source"]> = {
  demo: "DEMO",
  csv: "CSV",
  xlsx: "XLSX",
  json: "JSON",
  manual: "MANUAL",
  hl7: "HL7",
  fhir: "FHIR",
  erms: "ERMS",
  "health-nz": "HEALTH_NZ",
};

function mapSourceType(sourceType: SourceType): Prisma.BatchRunCreateInput["source"] {
  return SOURCE_TYPE_TO_ENUM[sourceType] ?? "MANUAL";
}

/**
 * Whether the engine refused to silently auto-decide this case. These are the
 * cases a reviewer MUST open — the rest can usually be bulk-accepted.
 */
export function isReviewRequired(item: BatchCaseResult): boolean {
  if (item.status === "error") return true;
  const d = item.decision;
  if (d.safetyOutcome) return true; // INSUFFICIENT_INFORMATION / EXTERNAL_HISTORY_REQUIRED / CLINICIAN_REVIEW_REQUIRED
  if (d.validationStatus && d.validationStatus !== "IMPLEMENTED") return true;
  if ((d.missingInformation?.length ?? 0) > 0) return true;
  if ((d.externalDependencies?.length ?? 0) > 0) return true;
  return false;
}

// ─── Includes ─────────────────────────────────────────────────────────────────

const reviewerSelect = {
  select: { id: true, name: true, email: true, role: true },
} satisfies Prisma.UserDefaultArgs;

const batchRunListInclude = {
  createdBy: reviewerSelect,
} satisfies Prisma.BatchRunInclude;

const batchRunDetailInclude = {
  createdBy: reviewerSelect,
  items: {
    orderBy: [{ reviewRequired: "desc" }, { rowNumber: "asc" }],
    include: { reviewedBy: reviewerSelect, ruleEvaluation: true },
  },
} satisfies Prisma.BatchRunInclude;

export type BatchRunListRecord = Prisma.BatchRunGetPayload<{
  include: typeof batchRunListInclude;
}>;

export type BatchRunDetailRecord = Prisma.BatchRunGetPayload<{
  include: typeof batchRunDetailInclude;
}>;

export type BatchReviewItemRecord = BatchRunDetailRecord["items"][number];

// ─── Save a run ────────────────────────────────────────────────────────────────

export async function saveBatchRun(args: {
  result: BatchProcessingResult;
  actorUserId: string;
  sourceSystem?: string;
}): Promise<BatchRunDetailRecord> {
  const { result, actorUserId } = args;

  const reviewRequiredCount = result.results.filter(isReviewRequired).length;
  const shadowRuleVersion = await resolveShadowClinicalRuleVersion().catch(() => null);

  // Booking triage grade — run each case through the active, admin-editable
  // rule release. Cervical screening pulls map to the COLPOSCOPY service line.
  // Best-effort: if no release is published, items simply have no triage grade.
  const activeRelease = await getActiveCaseRuleSetRelease("COLPOSCOPY").catch(() => null);
  const ruleDefinition = activeRelease
    ? parseCaseRuleReleaseDefinition({
        serviceLine: activeRelease.serviceLine,
        definitionJson: activeRelease.definitionJson,
      })
    : null;

  // Reprocessing — find how many times each NHI in this batch was seen before
  // and the most recent prior item id, in a single query.
  const nhis = Array.from(
    new Set(
      result.results
        .map((r) => r.case.nhi ?? r.case.source.externalPatientId)
        .filter((v): v is string => Boolean(v))
    )
  );
  const priorItems = nhis.length
    ? await prisma.batchReviewItem.findMany({
        where: { nhi: { in: nhis } },
        select: { id: true, nhi: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      })
    : [];
  const priorByNhi = new Map<string, { count: number; latestId: string }>();
  for (const p of priorItems) {
    if (!p.nhi) continue;
    const existing = priorByNhi.get(p.nhi);
    if (existing) existing.count += 1;
    else priorByNhi.set(p.nhi, { count: 1, latestId: p.id });
  }

  const itemData: Prisma.BatchReviewItemCreateWithoutBatchRunInput[] =
    result.results.map((item) => {
      const c = item.case;
      const d = item.decision;
      const nhi = c.nhi ?? c.source.externalPatientId ?? null;
      const prior = nhi ? priorByNhi.get(nhi) : undefined;

      // Grade against the active release (only for successfully-processed cases).
      const grade =
        ruleDefinition && item.status === "success"
          ? gradeCanonicalCase({ ruleDefinition, batchCase: c })
          : null;

      return {
        rowNumber: c.source.rowNumber,
        label: c.label ?? null,
        externalPatientId: c.source.externalPatientId ?? null,
        patientAge: c.patientAge ?? null,
        ethnicityPrimary: c.ethnicityPrimary ?? null,
        patientName: c.patientName ?? null,
        nhi,
        gpPractice: c.gpPractice ?? null,
        receivedDate: c.receivedDate ? new Date(c.receivedDate) : null,
        figure: d.figure,
        riskLevel: d.riskLevel,
        recommendationCode: d.recommendationCode,
        recommendation: d.recommendation,
        referralPriority: d.referralPriority ?? null,
        referralType: d.referralType ?? null,
        safetyOutcome: d.safetyOutcome ?? null,
        reviewRequired: isReviewRequired(item),
        engineStatus: item.status,
        caseJson: JSON.stringify(c),
        inputJson: JSON.stringify(item.input),
        decisionJson: JSON.stringify(d),
        // Booking triage grade
        triagePriority: grade?.recommendation.priority ?? null,
        triageCategory: grade?.recommendation.category ?? null,
        triageOutcome: grade?.recommendation.outcome ?? null,
        triageTargetDays: grade?.recommendation.targetDays ?? null,
        triageRuleCode: grade?.matchedRuleCode ?? null,
        triageRuleReleaseId: grade ? activeRelease?.id ?? null : null,
        triageRuleVersion: grade ? activeRelease?.version ?? null : null,
        // Reprocessing
        priorDecisionCount: prior?.count ?? 0,
        priorItemId: prior?.latestId ?? null,
      };
    });

  const run = await prisma.batchRun.create({
    data: {
      source: mapSourceType(result.sourceType),
      sourceSystem: args.sourceSystem ?? null,
      sourceFileName: result.sourceFileName ?? null,
      engineVersion: result.engineVersion,
      pinnedRuleVersionId: shadowRuleVersion?.id ?? null,
      pinnedRuleVersionDisplay: shadowRuleVersion?.displayVersion ?? null,
      pinnedRulesetChecksum: shadowRuleVersion?.checksum ?? null,
      totalCases: result.results.length,
      pendingCount: result.results.length,
      reviewRequiredCount,
      createdByUserId: actorUserId,
      items: { create: itemData },
    },
    include: batchRunDetailInclude,
  });

  await prisma.auditLog.create({
    data: {
      userId: actorUserId,
      action: "CREATE",
      entity: "BatchRun",
      entityId: run.id,
      newValue: JSON.stringify({
        source: run.source,
        sourceSystem: run.sourceSystem,
        sourceFileName: run.sourceFileName,
        engineVersion: run.engineVersion,
        totalCases: run.totalCases,
        reviewRequiredCount: run.reviewRequiredCount,
      }),
    },
  });

  if (shadowRuleVersion) {
    const resultByRow = new Map(
      result.results.map((item) => [item.case.source.rowNumber, item])
    );
    for (const reviewItem of run.items) {
      const sourceResult = resultByRow.get(reviewItem.rowNumber);
      if (!sourceResult) continue;
      try {
        const shadow = await evaluateClinicalCase({
          ...(sourceResult.canonicalFactsV2
            ? { canonicalFactsV2: sourceResult.canonicalFactsV2 }
            : { facts: sourceResult.input as unknown as Record<string, unknown> }),
          ruleVersionId: shadowRuleVersion.id,
          evaluationMode: "SHADOW",
          legacyInput: sourceResult.input,
          batchRunId: run.id,
        });
        await prisma.batchReviewItem.update({
          where: { id: reviewItem.id },
          data: { ruleEvaluationId: shadow.evaluationId },
        });
      } catch (error) {
        await prisma.auditLog.create({
          data: {
            userId: actorUserId,
            action: "CLINICAL_RULE_SHADOW_FAILED",
            entity: "BatchReviewItem",
            entityId: reviewItem.id,
            severity: "ERROR",
            newValue: JSON.stringify({
              ruleVersionId: shadowRuleVersion.id,
              message: error instanceof Error ? error.message : String(error),
            }),
          },
        });
      }
    }
  }

  return run;
}

// ─── Read ───────────────────────────────────────────────────────────────────

export async function listBatchRuns(limit = 50): Promise<BatchRunListRecord[]> {
  return prisma.batchRun.findMany({
    include: batchRunListInclude,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function getBatchRunWithItems(
  id: string
): Promise<BatchRunDetailRecord | null> {
  return prisma.batchRun.findUnique({
    where: { id },
    include: batchRunDetailInclude,
  });
}

/** Reconstruct the BatchCaseResult shape from a stored item for the drill-in UI. */
export function reconstructBatchCaseResult(item: BatchReviewItemRecord): BatchCaseResult {
  const evaluationTrace = item.ruleEvaluation
    ? JSON.parse(item.ruleEvaluation.evaluationTrace) as {
        factDiagnostics?: BatchCaseResult["canonicalShadow"] extends infer T
          ? T extends { factDiagnostics?: infer D }
            ? D
            : never
          : never;
        legacyComparison?: unknown;
      }
    : undefined;
  return {
    case: JSON.parse(item.caseJson),
    input: JSON.parse(item.inputJson),
    decision: JSON.parse(item.decisionJson),
    ...(item.ruleEvaluation
      ? {
          canonicalFactsV2: JSON.parse(item.ruleEvaluation.canonicalInputSnapshot),
          canonicalShadow: {
            reviewItemId: item.id,
            evaluationId: item.ruleEvaluation.id,
            evaluationMode: item.ruleEvaluation.evaluationMode,
            ruleVersionDisplay: item.ruleEvaluation.ruleVersionDisplay,
            rulesetChecksum: item.ruleEvaluation.rulesetChecksum,
            engineVersion: item.ruleEvaluation.engineVersion,
            provisionalRecommendation: item.ruleEvaluation.provisionalRecommendation,
            reviewerRequirement: item.ruleEvaluation.reviewerRequirement,
            clinicianOnly: item.ruleEvaluation.clinicianOnly,
            matchedRuleIds: JSON.parse(item.ruleEvaluation.matchedRuleIds),
            branchPath: JSON.parse(item.ruleEvaluation.branchPath),
            missingInformation: JSON.parse(item.ruleEvaluation.missingInformation),
            sourceReferences: JSON.parse(item.ruleEvaluation.sourceReferences),
            factDiagnostics: evaluationTrace?.factDiagnostics,
            legacyComparison: evaluationTrace?.legacyComparison,
          },
        }
      : {}),
    processingTimeMs: 0,
    status: item.engineStatus === "error" ? "error" : "success",
    error: undefined,
  };
}

// ─── Reprocessing: prior decision snapshots for the drill-in compare ──────────

export type SnapshotItem = {
  recommendation: string;
  recommendationCode: string;
  riskLevel: string;
  referralPriority: string | null;
  triagePriority: string | null;
  disposition: string;
  reviewedAt: Date | null;
  createdAt: Date;
  reviewedBy: { name: string | null; email: string } | null;
};

function toSnapshot(item: SnapshotItem): DecisionSnapshot {
  const date = item.reviewedAt ?? item.createdAt;
  return {
    recommendation: item.recommendation,
    recommendationCode: item.recommendationCode,
    riskLevel: item.riskLevel,
    referralPriority: item.referralPriority,
    triagePriority: item.triagePriority,
    disposition: item.disposition,
    reviewedByName: item.reviewedBy?.name ?? item.reviewedBy?.email ?? null,
    reviewedAt: item.reviewedAt ? item.reviewedAt.toISOString() : null,
    date: date.toISOString(),
  };
}

export function buildSnapshotFromRecord(item: SnapshotItem): DecisionSnapshot {
  return toSnapshot(item);
}

/** Load DecisionSnapshots for a set of prior item ids, keyed by id. */
export async function getPriorSnapshots(
  priorItemIds: string[]
): Promise<Map<string, DecisionSnapshot>> {
  const ids = Array.from(new Set(priorItemIds.filter(Boolean)));
  if (ids.length === 0) return new Map();
  const rows = await prisma.batchReviewItem.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      recommendation: true,
      recommendationCode: true,
      riskLevel: true,
      referralPriority: true,
      triagePriority: true,
      disposition: true,
      reviewedAt: true,
      createdAt: true,
      reviewedBy: { select: { name: true, email: true } },
    },
  });
  const map = new Map<string, DecisionSnapshot>();
  for (const r of rows) map.set(r.id, toSnapshot(r));
  return map;
}

// ─── Re-grade a run with the currently-active rule release ────────────────────

/**
 * Re-applies the active COLPOSCOPY rule release to a run's still-PENDING items.
 * Lets a demo show: edit a rule → activate → re-grade → booking priorities move,
 * without re-pulling. Returns how many items changed.
 */
export async function regradeRunWithActiveRules(args: {
  runId: string;
  actorUserId: string;
}): Promise<{ regraded: number; changed: number; ruleVersion: string | null }> {
  const release = await getActiveCaseRuleSetRelease("COLPOSCOPY").catch(() => null);
  if (!release) {
    throw new BatchReviewError("No active rule release to grade against.");
  }
  const ruleDefinition = parseCaseRuleReleaseDefinition({
    serviceLine: release.serviceLine,
    definitionJson: release.definitionJson,
  });

  const items = await prisma.batchReviewItem.findMany({
    where: { batchRunId: args.runId, disposition: "PENDING" },
    select: { id: true, caseJson: true, engineStatus: true, triagePriority: true },
  });

  let changed = 0;
  await prisma.$transaction(async (tx) => {
    for (const item of items) {
      if (item.engineStatus === "error") continue;
      const batchCase = JSON.parse(item.caseJson);
      const grade = gradeCanonicalCase({ ruleDefinition, batchCase });
      if (grade.recommendation.priority !== item.triagePriority) changed += 1;
      await tx.batchReviewItem.update({
        where: { id: item.id },
        data: {
          triagePriority: grade.recommendation.priority,
          triageCategory: grade.recommendation.category,
          triageOutcome: grade.recommendation.outcome,
          triageTargetDays: grade.recommendation.targetDays ?? null,
          triageRuleCode: grade.matchedRuleCode,
          triageRuleReleaseId: release.id,
          triageRuleVersion: release.version,
        },
      });
    }
    await tx.auditLog.create({
      data: {
        userId: args.actorUserId,
        action: "REGRADE",
        entity: "BatchRun",
        entityId: args.runId,
        newValue: JSON.stringify({
          ruleReleaseId: release.id,
          ruleVersion: release.version,
          regraded: items.length,
          changed,
        }),
      },
    });
  });

  return { regraded: items.length, changed, ruleVersion: release.version };
}

// ─── Review queue (aggregate, across all runs) ────────────────────────────────

const reviewQueueInclude = {
  reviewedBy: reviewerSelect,
  ruleEvaluation: true,
  batchRun: {
    select: { id: true, source: true, sourceSystem: true, sourceFileName: true },
  },
} satisfies Prisma.BatchReviewItemInclude;

export type ReviewQueueItemRecord = Prisma.BatchReviewItemGetPayload<{
  include: typeof reviewQueueInclude;
}>;

const RISK_RANK: Record<string, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

/**
 * Every case still awaiting a reviewer decision, across all runs — the single
 * destination a reviewer opens. Sorted so the most clinically pressing surface
 * first: engine-flagged review-required, then by risk, then most recent.
 */
export async function getReviewQueue(limit = 300): Promise<ReviewQueueItemRecord[]> {
  const items = await prisma.batchReviewItem.findMany({
    where: { disposition: "PENDING" },
    include: reviewQueueInclude,
    take: limit,
  });

  return items.sort((a, b) => {
    if (a.reviewRequired !== b.reviewRequired) return a.reviewRequired ? -1 : 1;
    const rank = (RISK_RANK[a.riskLevel] ?? 9) - (RISK_RANK[b.riskLevel] ?? 9);
    if (rank !== 0) return rank;
    const ad = a.receivedDate?.getTime() ?? a.createdAt.getTime();
    const bd = b.receivedDate?.getTime() ?? b.createdAt.getTime();
    return bd - ad;
  });
}

/** Lightweight counts for the sidebar badge. */
export async function getReviewQueueCounts(): Promise<{ pending: number; urgent: number }> {
  const [pending, urgent] = await Promise.all([
    prisma.batchReviewItem.count({ where: { disposition: "PENDING" } }),
    prisma.batchReviewItem.count({ where: { disposition: "PENDING", reviewRequired: true } }),
  ]);
  return { pending, urgent };
}

// ─── Review (bulk disposition) ────────────────────────────────────────────────

export class BatchReviewError extends Error {}

async function recomputeRunCounts(
  tx: Prisma.TransactionClient,
  runId: string
) {
  const grouped = await tx.batchReviewItem.groupBy({
    by: ["disposition"],
    where: { batchRunId: runId },
    _count: { _all: true },
  });
  const counts: Record<BatchReviewDisposition, number> = {
    PENDING: 0,
    ACCEPTED: 0,
    REJECTED: 0,
    NEEDS_INFO: 0,
  };
  for (const g of grouped) counts[g.disposition] = g._count._all;
  await tx.batchRun.update({
    where: { id: runId },
    data: {
      pendingCount: counts.PENDING,
      acceptedCount: counts.ACCEPTED,
      rejectedCount: counts.REJECTED,
      needsInfoCount: counts.NEEDS_INFO,
    },
  });
}

/**
 * Run-agnostic bulk disposition. Items may span multiple runs (the aggregate
 * Review Queue); counts are recomputed for every affected run. Returns how many
 * items were updated.
 */
export async function applyDisposition(args: {
  itemIds: string[];
  disposition: Exclude<BatchReviewDisposition, "PENDING">;
  reviewedByUserId: string;
  note?: string | null;
  overrideReason?: string | null;
}): Promise<{ updated: number; affectedRuns: number }> {
  const { disposition, reviewedByUserId } = args;

  if (args.itemIds.length === 0) {
    throw new BatchReviewError("No items selected for review.");
  }

  // A rejection must carry a reason — it's a clinical decision to NOT proceed
  // on a pre-graded case, and must be defensible in the audit trail.
  const note = args.note?.trim() || null;
  const overrideReason = args.overrideReason?.trim() || null;
  if (disposition === "REJECTED" && !overrideReason && !note) {
    throw new BatchReviewError("A reason is required when rejecting cases.");
  }

  const items = await prisma.batchReviewItem.findMany({
    where: { id: { in: args.itemIds }, disposition: "PENDING" },
    select: { id: true, batchRunId: true, reviewRequired: true },
  });
  const requestedIds = Array.from(new Set(args.itemIds));
  if (items.length !== requestedIds.length) {
    throw new BatchReviewError("One or more cases were already reviewed or no longer exist. Refresh the queue and try again.");
  }
  if (disposition === "ACCEPTED" && items.some((item) => item.reviewRequired) && !note) {
    throw new BatchReviewError("A clinical review note is required when accepting mandatory-review cases.");
  }
  const validIds = items.map((i) => i.id);
  const runIds = Array.from(new Set(items.map((i) => i.batchRunId)));

  await prisma.$transaction(async (tx) => {
    const update = await tx.batchReviewItem.updateMany({
      where: { id: { in: validIds }, disposition: "PENDING" },
      data: {
        disposition,
        reviewedByUserId,
        reviewedAt: new Date(),
        reviewNote: note,
        overrideReason,
      },
    });
    if (update.count !== validIds.length) {
      throw new BatchReviewError("Another reviewer updated one or more cases. Refresh the queue and try again.");
    }

    for (const runId of runIds) {
      await recomputeRunCounts(tx, runId);
    }

    await tx.auditLog.create({
      data: {
        userId: reviewedByUserId,
        action: "REVIEW",
        entity: "BatchReviewItem",
        entityId: runIds[0],
        newValue: JSON.stringify({
          runIds,
          disposition,
          itemCount: validIds.length,
          itemIds: validIds,
          note,
          overrideReason,
        }),
      },
    });
  });

  return { updated: validIds.length, affectedRuns: runIds.length };
}

/** Per-run bulk disposition (validates membership), returns the updated run. */
export async function reviewBatchItems(args: {
  runId: string;
  itemIds: string[];
  disposition: Exclude<BatchReviewDisposition, "PENDING">;
  reviewedByUserId: string;
  note?: string | null;
  overrideReason?: string | null;
}): Promise<BatchRunDetailRecord> {
  const members = await prisma.batchReviewItem.findMany({
    where: { id: { in: args.itemIds }, batchRunId: args.runId },
    select: { id: true },
  });
  if (members.length === 0) {
    throw new BatchReviewError("None of the selected items belong to this run.");
  }

  await applyDisposition({
    itemIds: members.map((m) => m.id),
    disposition: args.disposition,
    reviewedByUserId: args.reviewedByUserId,
    note: args.note,
    overrideReason: args.overrideReason,
  });

  const updated = await getBatchRunWithItems(args.runId);
  if (!updated) {
    throw new BatchReviewError("Batch run disappeared during review.");
  }
  return updated;
}
