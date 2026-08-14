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
import { getRuntimeClinicalEnvironment, resolveClinicalAuthority } from "@/lib/clinical-rules/authority";
import { evaluateGradedDecision } from "@/lib/clinical-rules/graded-decision";
import { resolveShadowClinicalRuleVersion } from "@/lib/clinical-rules/lifecycle";
import { requireCurrentOrganisationId } from "@/lib/organisation/current-organisation";
import { clinicalPayloadDigest, rawPayloadDigest } from "@/lib/batch/source-identity";
import {
  classifyIncomingCases,
  identityForCase,
  recordEpisodeObservation,
} from "@/lib/batch/episode-registry";

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

/**
 * Fail-closed markers used when the current governed ruleset cannot evaluate a
 * new case. These describe the ABSENCE of a governed recommendation — they are
 * a safety state, not clinical guidance, and deliberately carry no timing,
 * priority or referral action.
 */
const NO_GOVERNED_RESULT_CODE = "NO-GOVERNED-RECOMMENDATION";
const NO_GOVERNED_RESULT_TEXT =
  "No governed recommendation available — clinician review required.";

export async function saveBatchRun(args: {
  result: BatchProcessingResult;
  actorUserId: string;
  sourceSystem?: string;
}): Promise<BatchRunDetailRecord> {
  const { result, actorUserId } = args;

  const reviewRequiredCount = result.results.filter(isReviewRequired).length;
  const runtimeEnvironment = getRuntimeClinicalEnvironment();
  const resolvedAuthority = await resolveClinicalAuthority({ environment: runtimeEnvironment });
  const shadowRuleVersion = await resolveShadowClinicalRuleVersion().catch(() => null);
  const runRuleVersion =
    resolvedAuthority.authorityEngine === "CANONICAL" && resolvedAuthority.ruleSetVersionId
      ? {
          id: resolvedAuthority.ruleSetVersionId,
          displayVersion: resolvedAuthority.ruleSetVersion,
          checksum: resolvedAuthority.ruleSetChecksum,
        }
      : shadowRuleVersion;

  const itemData: Prisma.BatchReviewItemCreateWithoutBatchRunInput[] =
    result.results.map((item) => {
      const c = item.case;
      const d = item.decision;
      return {
        rowNumber: c.source.rowNumber,
        label: c.label ?? null,
        externalPatientId: c.source.externalPatientId ?? null,
        patientAge: c.patientAge ?? null,
        ethnicityPrimary: c.ethnicityPrimary ?? null,
        patientName: c.patientName ?? null,
        nhi: c.nhi ?? c.source.externalPatientId ?? null,
        gpPractice: c.gpPractice ?? null,
        receivedDate: c.receivedDate ? new Date(c.receivedDate) : null,
        // Episode identity, stored in clear alongside the digests so any later
        // match can be explained in the source's own terms.
        sourceEpisodeKey: c.source.sourceEpisodeKey ?? null,
        sourceFacility: c.source.sourceFacility ?? c.source.sourceSystem ?? null,
        testType: c.source.testType ?? null,
        collectedOn: c.source.collectedOn ? new Date(c.source.collectedOn) : null,
        rawPayloadDigest: rawPayloadDigest(c),
        clinicalPayloadDigest: clinicalPayloadDigest(item.input),
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
      };
    });

  // Fails closed. A run written without a tenant is silently wrong — it cannot
  // be attributed later, and the episode and usage rows that will hang off it
  // are append-only. Refusing to persist is the recoverable outcome.
  const organisationId = await requireCurrentOrganisationId();

  const run = await prisma.batchRun.create({
    data: {
      organisationId,
      source: mapSourceType(result.sourceType),
      sourceSystem: args.sourceSystem ?? null,
      sourceFileName: result.sourceFileName ?? null,
      engineVersion: result.engineVersion,
      pinnedRuleVersionId: runRuleVersion?.id ?? null,
      pinnedRuleVersionDisplay: runRuleVersion?.displayVersion ?? null,
      pinnedRulesetChecksum: runRuleVersion?.checksum ?? null,
      totalCases: result.results.length,
      pendingCount: result.results.length,
      reviewRequiredCount,
      createdByUserId: actorUserId,
      items: { create: itemData },
    },
    include: batchRunDetailInclude,
  });

  // Register every arrival against its clinical episode.
  //
  // Runs after the items exist so each observation can point at the case it
  // produced. Deliberately not inside the run's creation transaction: an
  // episode-register failure must not discard a batch of clinical decisions
  // that were computed correctly. The register is provenance; the decisions are
  // the product.
  try {
    const classified = await classifyIncomingCases({
      organisationId,
      items: result.results,
    });

    await prisma.$transaction(async (tx) => {
      for (const entry of classified) {
        const item = result.results[entry.index];
        const persisted = run.items.find(
          (candidate) => candidate.rowNumber === item.case.source.rowNumber
        );

        const episodeId = await recordEpisodeObservation({
          tx,
          organisationId,
          batchRunId: run.id,
          identity: identityForCase(organisationId, item),
          classified: entry,
          batchReviewItemId: persisted?.id ?? null,
        });

        if (persisted) {
          await tx.batchReviewItem.update({
            where: { id: persisted.id },
            data: { episodeId },
          });
        }
      }
    });
  } catch (error) {
    // Recorded rather than raised. A case that reaches the queue without an
    // episode link is a provenance gap; a case that never reaches the queue
    // because episode bookkeeping failed is a clinical one.
    console.error("Episode registration failed for batch run", run.id, error);
  }

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

  // The authoritative evaluation runs for EVERY item, unconditionally.
  //
  // It used to be gated on `runRuleVersion`. When that resolved to null — no
  // canonical activation and no shadow version — the loop was skipped entirely
  // and each row silently kept the legacy recommendation written above, while
  // the rest of the application reported canonical authority. That mixed state
  // is the defect this block now prevents.
  {
    const resultByRow = new Map(
      result.results.map((item) => [item.case.source.rowNumber, item])
    );
    for (const reviewItem of run.items) {
      const sourceResult = resultByRow.get(reviewItem.rowNumber);
      if (!sourceResult) continue;
      try {
        const graded = await evaluateGradedDecision({
          input: sourceResult.input,
          subjectReference:
            sourceResult.case.nhi ??
            sourceResult.case.source.externalPatientId ??
            `batch:${run.id}:row:${reviewItem.rowNumber}`,
          enteredBy: actorUserId,
          canonicalFactsV2: sourceResult.canonicalFactsV2,
          batchRunId: run.id,
          environment: runtimeEnvironment,
          factSource: "REVIEWER_ENTRY",
        });
        const operativeResult = { ...sourceResult, decision: graded.decision };
        await prisma.batchReviewItem.update({
          where: { id: reviewItem.id },
          data: {
            ruleEvaluationId: graded.evaluationId,
            authorityEngine: graded.authority.authorityEngine,
            authorityReason: graded.authorityReason,
            legacyDecisionJson: JSON.stringify(graded.legacyDecision),
            decisionJson: JSON.stringify(graded.decision),
            figure: graded.decision.figure,
            riskLevel: graded.decision.riskLevel,
            recommendationCode: graded.decision.recommendationCode,
            recommendation: graded.decision.recommendation,
            referralPriority: graded.decision.referralPriority ?? null,
            referralType: graded.decision.referralType ?? null,
            safetyOutcome: graded.decision.safetyOutcome ?? null,
            reviewRequired: isReviewRequired(operativeResult),
          },
        });
      } catch (error) {
        // FAIL CLOSED.
        //
        // This block previously only wrote an audit row, which left the legacy
        // recommendation persisted above as the item's recommendation — a
        // silent legacy fallback for a NEW case. A failed authoritative
        // evaluation must never present a legacy clinical recommendation as
        // though it were the governed result.
        //
        // The clinical columns are non-null, so the row is overwritten with an
        // explicit safety state rather than left blank. This states that no
        // governed recommendation exists; it does not invent a clinical action.
        await prisma.batchReviewItem.update({
          where: { id: reviewItem.id },
          data: {
            recommendationCode: NO_GOVERNED_RESULT_CODE,
            recommendation: NO_GOVERNED_RESULT_TEXT,
            referralPriority: null,
            referralType: null,
            safetyOutcome: "NO_GOVERNED_RECOMMENDATION",
            reviewRequired: true,
            engineStatus: "error",
            authorityReason:
              "The current governed ruleset could not evaluate this case; no " +
              "recommendation is offered and clinician review is required.",
          },
        });
        await prisma.auditLog.create({
          data: {
            userId: actorUserId,
            action: "CLINICAL_RULE_AUTHORITY_EVALUATION_FAILED",
            entity: "BatchReviewItem",
            entityId: reviewItem.id,
            severity: "ERROR",
            newValue: JSON.stringify({
              ruleVersionId: runRuleVersion?.id ?? null,
              failedClosed: true,
              message: error instanceof Error ? error.message : String(error),
            }),
          },
        });
      }
    }
  }

  const persisted = await prisma.batchRun.findUnique({
    where: { id: run.id },
    include: batchRunDetailInclude,
  });
  if (!persisted) throw new Error("Persisted batch run could not be reloaded.");
  await prisma.batchRun.update({
    where: { id: run.id },
    data: {
      reviewRequiredCount: persisted.items.filter((item) => item.reviewRequired).length,
    },
  });
  return (await prisma.batchRun.findUnique({
    where: { id: run.id },
    include: batchRunDetailInclude,
  }))!;
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
    legacyDecision: item.legacyDecisionJson ? JSON.parse(item.legacyDecisionJson) : undefined,
    clinicalAuthority: {
      authorityEngine: item.authorityEngine === "CANONICAL" ? "CANONICAL" : "LEGACY",
      reason: item.authorityReason,
    },
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
            repeatInterval: item.ruleEvaluation.repeatInterval,
            evaluatedAt: item.ruleEvaluation.evaluatedAt.toISOString(),
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
    where: { id: { in: args.itemIds } },
    select: { id: true, batchRunId: true },
  });
  if (items.length === 0) {
    throw new BatchReviewError("No matching cases found.");
  }
  const validIds = items.map((i) => i.id);
  const runIds = Array.from(new Set(items.map((i) => i.batchRunId)));

  await prisma.$transaction(async (tx) => {
    await tx.batchReviewItem.updateMany({
      where: { id: { in: validIds } },
      data: {
        disposition,
        reviewedByUserId,
        reviewedAt: new Date(),
        reviewNote: note,
        overrideReason,
      },
    });

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
