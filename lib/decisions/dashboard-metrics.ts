import type { BatchReviewDisposition, Prisma, UserRole } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  buildCompletedDecisionWhere,
  type CompletedDecisionRecord,
  type DecisionUser,
} from "@/lib/decisions/completed-decisions";
import { getActiveCaseRuleSetRelease } from "@/lib/cases/rule-releases";

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

export type CommandCentreMetricScope = "organisation" | "own" | "hidden";

export type CommandCentreMetricPolicy = {
  canViewOperationalMetrics: boolean;
  queueScope: Exclude<CommandCentreMetricScope, "own">;
  intakeScope: Exclude<CommandCentreMetricScope, "own">;
  completedScope: CommandCentreMetricScope;
  packageScope: Exclude<CommandCentreMetricScope, "own">;
  queueLabel: string;
  intakeLabel: string;
  completedLabel: string;
  packageLabel: string;
  showRecentIntakeSessions: boolean;
  showRecentCompletedDecisions: boolean;
};

export type CommandCentreMetrics = {
  policy: CommandCentreMetricPolicy;
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
  // Pending queue grouped by the rules-driven booking priority + which rule
  // release produced it — makes the editable-rules → product impact visible.
  bookingPriorityMix: Array<{ priority: string; count: number }>;
  activeRuleVersion: string | null;
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

const OPERATIONAL_ROLES: UserRole[] = [
  "ADMIN",
  "INTEGRATION_ADMIN",
  "COORDINATOR",
  "SMO_REVIEWER",
  "COLPOSCOPIST",
  "COLPO_CNS",
  "GYNAE_GRADER",
];

const REVIEWER_ROLES: UserRole[] = [
  "SMO_REVIEWER",
  "COLPOSCOPIST",
  "COLPO_CNS",
  "GYNAE_GRADER",
];

function isUserRole(role: string | null | undefined): role is UserRole {
  return Boolean(role && [...OPERATIONAL_ROLES, "GP"].includes(role as UserRole));
}

export function getCommandCentreMetricPolicy(
  user: DecisionUser
): CommandCentreMetricPolicy {
  if (!isUserRole(user.role) || !OPERATIONAL_ROLES.includes(user.role)) {
    return {
      canViewOperationalMetrics: false,
      queueScope: "hidden",
      intakeScope: "hidden",
      completedScope: "hidden",
      packageScope: "hidden",
      queueLabel: "Not shown for this role",
      intakeLabel: "Not shown for this role",
      completedLabel: "Not shown for this role",
      packageLabel: "Not shown for this role",
      showRecentIntakeSessions: false,
      showRecentCompletedDecisions: false,
    };
  }

  if (REVIEWER_ROLES.includes(user.role)) {
    return {
      canViewOperationalMetrics: true,
      queueScope: "organisation",
      intakeScope: "organisation",
      completedScope: "own",
      packageScope: "organisation",
      queueLabel: "Organisation pending queue",
      intakeLabel: "Organisation intake",
      completedLabel: "Your reviewer-confirmed decisions",
      packageLabel: "Organisation simulated export evidence",
      showRecentIntakeSessions: true,
      showRecentCompletedDecisions: true,
    };
  }

  return {
    canViewOperationalMetrics: true,
    queueScope: "organisation",
    intakeScope: "organisation",
    completedScope: "organisation",
    packageScope: "organisation",
    queueLabel: "Organisation pending queue",
    intakeLabel: "Organisation intake",
    completedLabel: "Organisation completed decisions",
    packageLabel: "Organisation simulated export evidence",
    showRecentIntakeSessions: true,
    showRecentCompletedDecisions: true,
  };
}

function emptyMetrics(policy: CommandCentreMetricPolicy): CommandCentreMetrics {
  return {
    policy,
    pendingReview: 0,
    mandatoryClinicianReview: 0,
    urgentClinicalPriority: 0,
    casesPulledToday: 0,
    casesPulledThisWeek: 0,
    completedToday: 0,
    completedThisWeek: 0,
    decisionSplit: { accepted: 0, rejected: 0, needsInfo: 0, total: 0 },
    averageIntakeToDecisionMinutes: null,
    packagePreviewedOrExported: 0,
    packagePreviewedOrExportedThisWeek: 0,
    bookingPriorityMix: [],
    activeRuleVersion: null,
    recentIntakeSessions: [],
    recentCompletedDecisions: [],
  };
}

const BOOKING_PRIORITY_ORDER = ["P1_HSC", "P1", "P2_HSC", "P2", "P3", "P5", "REJECT", "DECLINE", "INFO_REQUIRED"];

export function orderBookingPriorityMix(
  grouped: Array<{ triagePriority: string | null; _count: { _all: number } }>
): Array<{ priority: string; count: number }> {
  return grouped
    .filter((g): g is { triagePriority: string; _count: { _all: number } } => Boolean(g.triagePriority))
    .map((g) => ({ priority: g.triagePriority, count: g._count._all }))
    .sort((a, b) => {
      const ai = BOOKING_PRIORITY_ORDER.indexOf(a.priority);
      const bi = BOOKING_PRIORITY_ORDER.indexOf(b.priority);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
}

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
  const policy = getCommandCentreMetricPolicy(user);
  if (!policy.canViewOperationalMetrics) {
    return emptyMetrics(policy);
  }

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
    bookingPriorityGrouped,
    activeRelease,
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
        ruleEvaluation: true,
        batchRun: {
          select: {
            id: true,
            source: true,
            sourceSystem: true,
            sourceFileName: true,
            engineVersion: true,
            pinnedRuleVersionId: true,
            pinnedRuleVersionDisplay: true,
            pinnedRulesetChecksum: true,
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
    prisma.batchReviewItem.groupBy({
      by: ["triagePriority"],
      where: { disposition: "PENDING", triagePriority: { not: null } },
      _count: { _all: true },
    }),
    getActiveCaseRuleSetRelease("COLPOSCOPY").catch(() => null),
  ]);

  return {
    policy,
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
    bookingPriorityMix: orderBookingPriorityMix(bookingPriorityGrouped),
    activeRuleVersion: activeRelease?.version ?? null,
    recentIntakeSessions,
    recentCompletedDecisions,
  };
}
