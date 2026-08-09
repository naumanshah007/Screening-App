import type { ClinicalDecision } from "@/lib/engine/types";
import { prisma } from "@/lib/prisma";

import type { ClinicalEvaluationResult } from "./evaluator";

const LEGACY_RISK_RANK: Record<ClinicalDecision["riskLevel"], number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  URGENT: 4,
};

const CANONICAL_RISK_RANK: Record<string, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

export type AuthorityComparisonDirection =
  | "CANONICAL_LESS_URGENT"
  | "CANONICAL_MORE_URGENT"
  | "DIFFERENT_SAME_URGENCY";

/**
 * Append a de-identified operational signal when the governed shadow/live
 * result differs from the legacy result. This never changes either decision and
 * is deliberately best-effort: a monitoring write cannot make a clinical path
 * less available.
 */
export async function recordAuthorityComparison(args: {
  evaluationId: string;
  caseId?: string;
  legacy: ClinicalDecision;
  canonical: ClinicalEvaluationResult;
  adapted: ClinicalDecision;
}): Promise<void> {
  const canonicalRank = CANONICAL_RISK_RANK[args.canonical.riskLevel] ?? 3;
  const legacyRank = LEGACY_RISK_RANK[args.legacy.riskLevel];
  const differs =
    args.adapted.recommendationCode !== args.legacy.recommendationCode ||
    args.adapted.riskLevel !== args.legacy.riskLevel ||
    args.adapted.referralRequired !== args.legacy.referralRequired ||
    args.adapted.referralType !== args.legacy.referralType ||
    args.adapted.referralPriority !== args.legacy.referralPriority ||
    args.adapted.recallIntervalMonths !== args.legacy.recallIntervalMonths ||
    args.adapted.safetyOutcome !== args.legacy.safetyOutcome;

  if (!differs) return;

  const direction: AuthorityComparisonDirection =
    canonicalRank < legacyRank
      ? "CANONICAL_LESS_URGENT"
      : canonicalRank > legacyRank
        ? "CANONICAL_MORE_URGENT"
        : "DIFFERENT_SAME_URGENCY";
  const urgentDisagreement =
    (canonicalRank === 4) !== (legacyRank === 4) ||
    (args.adapted.referralPriority === "P1") !==
      (args.legacy.referralPriority === "P1");

  const payload = JSON.stringify({
    evaluationId: args.evaluationId,
    caseId: args.caseId ?? null,
    direction,
    urgentDisagreement,
    legacy: {
      recommendationCode: args.legacy.recommendationCode,
      riskLevel: args.legacy.riskLevel,
      referralPriority: args.legacy.referralPriority ?? null,
    },
    canonical: {
      matchedRuleIds: args.canonical.matchedRuleIds,
      riskLevel: args.canonical.riskLevel,
      urgency: args.canonical.urgency ?? null,
    },
  });

  await prisma.auditLog
    .create({
      data: {
        action: "CLINICAL_AUTHORITY_DISAGREEMENT",
        entity: "RuleEvaluation",
        entityId: args.evaluationId,
        severity: direction === "CANONICAL_LESS_URGENT" ? "ERROR" : "WARN",
        newValue: payload,
      },
    })
    .catch(() => undefined);

  if (urgentDisagreement) {
    await prisma.auditLog
      .create({
        data: {
          action: "CLINICAL_AUTHORITY_URGENT_DISAGREEMENT",
          entity: "RuleEvaluation",
          entityId: args.evaluationId,
          severity: "ERROR",
          newValue: payload,
        },
      })
      .catch(() => undefined);
  }
}

function hasJsonItems(value: string): boolean {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.length > 0 : Boolean(parsed);
  } catch {
    return value.trim() !== "" && value.trim() !== "[]";
  }
}

export type ClinicalAuthorityMonitoringSummary = Awaited<
  ReturnType<typeof getClinicalAuthorityMonitoringSummary>
>;

/** Real measurements only. No series is backfilled or synthetically inferred. */
export async function getClinicalAuthorityMonitoringSummary(days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const now = new Date();

  const [evaluations, events, liveOverrides, recommendationReversals, queueAnomalies] =
    await Promise.all([
      prisma.ruleEvaluation.findMany({
        where: { evaluatedAt: { gte: since } },
        select: {
          evaluationMode: true,
          riskLevel: true,
          urgency: true,
          repeatInterval: true,
          missingInformation: true,
          clinicianOnly: true,
        },
      }),
      prisma.auditLog.groupBy({
        by: ["action"],
        where: {
          createdAt: { gte: since },
          action: {
            in: [
              "CLINICAL_RULE_EVALUATION_FAILED",
              "CLINICAL_AUTHORITY_RESOLUTION_FAILED",
              "CLINICAL_AUTHORITY_DISAGREEMENT",
              "CLINICAL_AUTHORITY_URGENT_DISAGREEMENT",
              "CLINICAL_AUTHORITY_DEESCALATION_BLOCKED",
              "CLINICAL_AUTHORITY_ADAPTER_FAILED",
              "DATABASE_OPERATION_FAILED",
            ],
          },
        },
        _count: { _all: true },
      }),
      prisma.clinicianDecision.count({
        where: {
          updatedAt: { gte: since },
          overrideReason: { not: null },
          referralCase: {
            ruleEvaluations: {
              some: { evaluationMode: { in: ["LIVE_DEMO", "LIVE_PRODUCTION"] } },
            },
          },
        },
      }),
      prisma.auditLog.count({
        where: { action: "REEVALUATE", entity: "RuleDecision", createdAt: { gte: since } },
      }),
      prisma.referralCase.count({
        where: {
          status: { in: ["READY_FOR_SUMMARY", "READY_FOR_GRADING", "NEEDS_MORE_INFO"] },
          targetDueAt: { lt: now },
          deletedAt: null,
        },
      }),
    ]);

  const eventCount = new Map(events.map((event) => [event.action, event._count._all]));
  const liveEvaluations = evaluations.filter((evaluation) =>
    ["LIVE_DEMO", "LIVE_PRODUCTION"].includes(evaluation.evaluationMode)
  );
  const missingInformationStops = evaluations.filter((evaluation) =>
    hasJsonItems(evaluation.missingInformation)
  ).length;
  const timingAmbiguities = evaluations.filter((evaluation) => {
    const timing = evaluation.repeatInterval?.trim() ?? "";
    return timing.length > 0 && !/^\d+\s+(day|days|week|weeks|month|months|year|years)$/i.test(timing);
  }).length;

  return {
    windowDays: days,
    since,
    generatedAt: now,
    counts: {
      totalEvaluations: evaluations.length,
      liveCanonicalEvaluations: liveEvaluations.length,
      canonicalEvaluationFailures: eventCount.get("CLINICAL_RULE_EVALUATION_FAILED") ?? 0,
      authorityResolutionFailures: eventCount.get("CLINICAL_AUTHORITY_RESOLUTION_FAILED") ?? 0,
      disagreements: eventCount.get("CLINICAL_AUTHORITY_DISAGREEMENT") ?? 0,
      urgentDisagreements: eventCount.get("CLINICAL_AUTHORITY_URGENT_DISAGREEMENT") ?? 0,
      deEscalationBlocks: eventCount.get("CLINICAL_AUTHORITY_DEESCALATION_BLOCKED") ?? 0,
      adapterFailures: eventCount.get("CLINICAL_AUTHORITY_ADAPTER_FAILED") ?? 0,
      missingInformationStops,
      clinicianOnlyStops: evaluations.filter((evaluation) => evaluation.clinicianOnly).length,
      clinicianOverrides: liveOverrides,
      recommendationReversals,
      timingAmbiguities,
      urgentEvaluations: evaluations.filter(
        (evaluation) => evaluation.riskLevel === "CRITICAL" || evaluation.urgency === "URGENT"
      ).length,
      queueAnomalies,
      databaseFailures: eventCount.get("DATABASE_OPERATION_FAILED") ?? 0,
    },
    thresholds: [
      { signal: "Canonical evaluation or adapter failure", proposed: "Any 1 event", approved: false },
      { signal: "Canonical less urgent than Legacy", proposed: "Any 1 event", approved: false },
      { signal: "Urgent-case disagreement", proposed: "Any 1 event", approved: false },
      { signal: "Missing-information safety-stop rate", proposed: "Set after signed pilot baseline", approved: false },
      { signal: "Clinician override rate", proposed: "Set after signed pilot baseline", approved: false },
      { signal: "Review queue anomaly rate", proposed: "Set with operations owner", approved: false },
    ],
  };
}
