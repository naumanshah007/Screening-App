import type { ServiceLine, TriagePriority } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildOperationalState,
  type OperationalWorkflow,
} from "@/lib/cases/operational";

export type ConcordanceRate = {
  total: number;
  concordant: number;
  ratePercent: number;
};

export type ConcordanceSummary = {
  serviceLine: ServiceLine;
  ruleVsClinician: ConcordanceRate;
  overridesByPriority: Record<string, number>;
  totalGraded: number;
  gradedLast30Days: number;
  averageDaysToGrade: number | null;
};

export type WorkflowSummary = {
  serviceLine: ServiceLine;
  totalTracked: number;
  workflows: Record<OperationalWorkflow, number>;
  smoOnly: number;
};

/** Cases where the clinician accepted the rule recommendation without change */
function isConcordant(
  ruleP: TriagePriority | null | undefined,
  clinicianP: TriagePriority | null | undefined
): boolean {
  if (!ruleP || !clinicianP) return false;
  return ruleP === clinicianP;
}

export async function getConcordanceSummary(
  serviceLine: ServiceLine
): Promise<ConcordanceSummary> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const gradedCases = await prisma.referralCase.findMany({
    where: {
      serviceLine,
      status: "GRADED",
    },
    include: {
      ruleDecision: { select: { priority: true, createdAt: true } },
      clinicianDecision: {
        select: { finalPriority: true, overrideReason: true, createdAt: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const total = gradedCases.length;
  const concordant = gradedCases.filter((c) =>
    isConcordant(c.ruleDecision?.priority, c.clinicianDecision?.finalPriority)
  ).length;

  const overridesByPriority: Record<string, number> = {};
  for (const c of gradedCases) {
    if (
      !isConcordant(
        c.ruleDecision?.priority,
        c.clinicianDecision?.finalPriority
      ) &&
      c.clinicianDecision?.finalPriority
    ) {
      const key = c.clinicianDecision.finalPriority;
      overridesByPriority[key] = (overridesByPriority[key] ?? 0) + 1;
    }
  }

  const gradedLast30Days = gradedCases.filter(
    (c) =>
      c.clinicianDecision?.createdAt &&
      new Date(c.clinicianDecision.createdAt) >= thirtyDaysAgo
  ).length;

  // Average days from receivedAt to clinician decision
  const gradingTimes = gradedCases
    .filter((c) => c.clinicianDecision?.createdAt)
    .map((c) => {
      const received = new Date(c.receivedAt).getTime();
      const decided = new Date(c.clinicianDecision!.createdAt).getTime();
      return Math.max(0, (decided - received) / (1000 * 60 * 60 * 24));
    });

  const averageDaysToGrade =
    gradingTimes.length > 0
      ? Math.round(
          (gradingTimes.reduce((a, b) => a + b, 0) / gradingTimes.length) * 10
        ) / 10
      : null;

  return {
    serviceLine,
    ruleVsClinician: {
      total,
      concordant,
      ratePercent: total > 0 ? Math.round((concordant / total) * 100) : 0,
    },
    overridesByPriority,
    totalGraded: total,
    gradedLast30Days,
    averageDaysToGrade,
  };
}

export async function getBacklogSummary(serviceLine: ServiceLine) {
  const now = new Date();
  const [active, overdue, awaitingGrading, awaitingInfo] = await Promise.all([
    prisma.referralCase.count({
      where: {
        serviceLine,
        status: { notIn: ["REJECTED", "RETURNED_TO_GP", "CLOSED"] },
      },
    }),
    prisma.referralCase.count({
      where: {
        serviceLine,
        status: { notIn: ["REJECTED", "RETURNED_TO_GP", "CLOSED"] },
        targetDueAt: { lt: now },
      },
    }),
    prisma.referralCase.count({
      where: {
        serviceLine,
        status: { in: ["READY_FOR_SUMMARY", "READY_FOR_GRADING"] },
      },
    }),
    prisma.referralCase.count({
      where: { serviceLine, status: "NEEDS_MORE_INFO" },
    }),
  ]);

  return { active, overdue, awaitingGrading, awaitingInfo };
}

export async function getPriorityBreakdown(serviceLine: ServiceLine) {
  const rows = await prisma.referralCase.groupBy({
    by: ["currentPriority"],
    where: {
      serviceLine,
      status: { notIn: ["REJECTED", "RETURNED_TO_GP", "CLOSED"] },
    },
    _count: true,
  });
  return rows
    .filter((r) => r.currentPriority !== null)
    .map((r) => ({ priority: r.currentPriority!, count: r._count }))
    .sort((a, b) => b.count - a.count);
}

export async function getGradingThroughput(serviceLine: ServiceLine) {
  // Last 8 weeks, grouped by ISO week
  const eightWeeksAgo = new Date(Date.now() - 56 * 24 * 60 * 60 * 1000);
  const decisions = await prisma.clinicianDecision.findMany({
    where: {
      referralCase: { serviceLine },
      createdAt: { gte: eightWeeksAgo },
    },
    select: { createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  // Group by week label
  const byWeek: Record<string, number> = {};
  for (const d of decisions) {
    const date = new Date(d.createdAt);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    const key = weekStart.toLocaleDateString("en-NZ", {
      day: "2-digit",
      month: "short",
    });
    byWeek[key] = (byWeek[key] ?? 0) + 1;
  }

  return Object.entries(byWeek).map(([week, count]) => ({ week, count }));
}

export async function getWorkflowSummary(
  serviceLine: ServiceLine
): Promise<WorkflowSummary> {
  const cases = await prisma.referralCase.findMany({
    where: {
      serviceLine,
      status: { not: "CLOSED" },
    },
    select: {
      currentPriority: true,
      smoOnly: true,
      ruleDecision: {
        select: { priority: true, outcome: true },
      },
      clinicianDecision: {
        select: { finalPriority: true, finalOutcome: true },
      },
    },
  });

  const workflows: Record<OperationalWorkflow, number> = {
    PENDING_REVIEW: 0,
    BOOKABLE: 0,
    VIRTUAL_CLINIC: 0,
    RETURN_TO_GP: 0,
    NEEDS_MORE_INFO: 0,
  };

  let smoOnly = 0;

  for (const referralCase of cases) {
    const operationalState = buildOperationalState({
      priority:
        referralCase.clinicianDecision?.finalPriority ??
        referralCase.currentPriority ??
        referralCase.ruleDecision?.priority ??
        null,
      outcome:
        referralCase.clinicianDecision?.finalOutcome ??
        referralCase.ruleDecision?.outcome ??
        null,
      requiresSmoReview: referralCase.smoOnly,
    });

    workflows[operationalState.workflow] += 1;

    if (operationalState.requiresSmoReview) {
      smoOnly += 1;
    }
  }

  return {
    serviceLine,
    totalTracked: cases.length,
    workflows,
    smoOnly,
  };
}
