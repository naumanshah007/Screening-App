import type { BatchReviewDisposition, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  buildCompletedDecisionWhere,
  type CompletedDecisionRecord,
  type DecisionUser,
} from "@/lib/decisions/completed-decisions";

type DecisionSplitInput = Array<{
  disposition: BatchReviewDisposition;
  _count: { _all: number };
}>;

export type DecisionSplit = {
  accepted: number;
  rejected: number;
  needsInfo: number;
  total: number;
};

export type CommandCentreMetrics = {
  pendingReview: number;
  mandatoryClinicianReview: number;
  urgentClinicalPriority: number;
  casesPulledToday: number;
  casesPulledThisWeek: number;
  completedToday: number;
  completedThisWeek: number;
  decisionSplit: DecisionSplit;
  averageIntakeToDecisionMinutes: number | null;
  packagePreviewedOrExported: number;
  packagePreviewedOrExportedThisWeek: number;
  recentIntakeSessions: Array<{
    id: string;
    source: string;
    sourceSystem: string | null;
    sourceFileName: string | null;
    totalCases: number;
    pendingCount: number;
    acceptedCount: number;
    rejectedCount: number;
    needsInfoCount: number;
    createdAt: Date;
    createdBy: { name: string | null; email: string | null };
  }>;
  recentCompletedDecisions: CompletedDecisionRecord[];
};

function startOfToday(now = new Date()) {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function startOfCurrentWeek(now = new Date()) {
  const date = startOfToday(now);
  const day = date.getDay();
  const daysSinceMonday = (day + 6) % 7;
  date.setDate(date.getDate() - daysSinceMonday);
  return date;
}

export function summariseDecisionSplit(grouped: DecisionSplitInput): DecisionSplit {
  const split = { accepted: 0, rejected: 0, needsInfo: 0, total: 0 };
  for (const row of grouped) {
    const count = row._count._all;
    if (row.disposition === "ACCEPTED") split.accepted = count;
    if (row.disposition === "REJECTED") split.rejected = count;
    if (row.disposition === "NEEDS_INFO") split.needsInfo = count;
  }
  split.total = split.accepted + split.rejected + split.needsInfo;
  return split;
}

export function calculateAverageDecisionMinutes(
  items: Array<{ reviewedAt: Date | null; batchRun: { createdAt: Date } }>
) {
  const durations = items
    .map((item) => {
      if (!item.reviewedAt) return null;
      const minutes = Math.round(
        (item.reviewedAt.getTime() - item.batchRun.createdAt.getTime()) / 60000
      );
      return minutes >= 0 ? minutes : null;
    })
    .filter((value): value is number => value != null);

  if (durations.length === 0) return null;
  return Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length);
}

function sumCases(result: { _sum: { totalCases: number | null } }) {
  return result._sum.totalCases ?? 0;
}

export async function getCommandCentreMetrics(
  user: DecisionUser,
  now = new Date()
): Promise<CommandCentreMetrics> {
  const today = startOfToday(now);
  const week = startOfCurrentWeek(now);
  const completedWhere = buildCompletedDecisionWhere(user);
  const pendingWhere: Prisma.BatchReviewItemWhereInput = { disposition: "PENDING" };
  const urgentPendingWhere: Prisma.BatchReviewItemWhereInput = {
    disposition: "PENDING",
    OR: [
      { riskLevel: "URGENT" },
      { referralPriority: { in: ["P1", "P1_HSC"] } },
    ],
  };

  const [
    pendingReview,
    mandatoryClinicianReview,
    urgentClinicalPriority,
    pulledToday,
    pulledThisWeek,
    completedToday,
    completedThisWeek,
    splitGrouped,
    averageItems,
    recentIntakeSessions,
    recentCompletedDecisions,
    packagePreviewedOrExported,
    packagePreviewedOrExportedThisWeek,
  ] = await Promise.all([
    prisma.batchReviewItem.count({ where: pendingWhere }),
    prisma.batchReviewItem.count({ where: { disposition: "PENDING", reviewRequired: true } }),
    prisma.batchReviewItem.count({ where: urgentPendingWhere }),
    prisma.batchRun.aggregate({
      where: { createdAt: { gte: today } },
      _sum: { totalCases: true },
    }),
    prisma.batchRun.aggregate({
      where: { createdAt: { gte: week } },
      _sum: { totalCases: true },
    }),
    prisma.batchReviewItem.count({
      where: { AND: [completedWhere, { reviewedAt: { gte: today } }] },
    }),
    prisma.batchReviewItem.count({
      where: { AND: [completedWhere, { reviewedAt: { gte: week } }] },
    }),
    prisma.batchReviewItem.groupBy({
      by: ["disposition"],
      where: completedWhere,
      _count: { _all: true },
    }),
    prisma.batchReviewItem.findMany({
      where: { AND: [completedWhere, { reviewedAt: { not: null } }] },
      select: {
        reviewedAt: true,
        batchRun: { select: { createdAt: true } },
      },
      take: 500,
    }),
    prisma.batchRun.findMany({
      include: {
        createdBy: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.batchReviewItem.findMany({
      where: completedWhere,
      include: {
        reviewedBy: { select: { id: true, name: true, email: true, role: true } },
        batchRun: {
          select: {
            id: true,
            source: true,
            sourceSystem: true,
            sourceFileName: true,
            createdAt: true,
            createdBy: { select: { id: true, name: true, email: true, role: true } },
          },
        },
      },
      orderBy: [{ reviewedAt: "desc" }, { updatedAt: "desc" }],
      take: 6,
    }),
    prisma.auditLog.count({
      where: {
        entity: "DecisionPackage",
        action: { in: ["SIMULATED_PACKAGE_PREVIEW", "SIMULATED_PACKAGE_EXPORT"] },
      },
    }),
    prisma.auditLog.count({
      where: {
        entity: "DecisionPackage",
        action: { in: ["SIMULATED_PACKAGE_PREVIEW", "SIMULATED_PACKAGE_EXPORT"] },
        createdAt: { gte: week },
      },
    }),
  ]);

  return {
    pendingReview,
    mandatoryClinicianReview,
    urgentClinicalPriority,
    casesPulledToday: sumCases(pulledToday),
    casesPulledThisWeek: sumCases(pulledThisWeek),
    completedToday,
    completedThisWeek,
    decisionSplit: summariseDecisionSplit(splitGrouped),
    averageIntakeToDecisionMinutes: calculateAverageDecisionMinutes(averageItems),
    packagePreviewedOrExported,
    packagePreviewedOrExportedThisWeek,
    recentIntakeSessions,
    recentCompletedDecisions,
  };
}
