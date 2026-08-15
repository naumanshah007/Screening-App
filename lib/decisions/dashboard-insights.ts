/**
 * Read-only dashboard aggregations.
 *
 * Every value here is derived from stored rows. Nothing is generated, estimated
 * or back-filled. Where a series has no data for a day, the value is 0 because
 * zero cases genuinely occurred — not because a placeholder was substituted.
 *
 * These are additive queries for presentation only. They do not touch clinical
 * logic, authority resolution, rules or decisions, and they respect the same
 * visibility policy as `getCommandCentreMetrics`.
 */

import { prisma } from "@/lib/prisma";
import {
  getCommandCentreMetricPolicy,
  startOfCurrentWeek,
  type CommandCentreMetricPolicy,
} from "./dashboard-metrics";
import type { DecisionUser } from "./completed-decisions";

/** Risk levels as stored on BatchReviewItem. No invented categories. */
export const RISK_LEVELS = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export type QueueTrendPoint = {
  /** ISO date (yyyy-mm-dd) for the day this point covers. */
  date: string;
  /** Items created that day that are still pending review. */
  totalInQueue: number;
  /** Of those, ones the engine flagged for mandatory clinician review. */
  clinicianReviewRequired: number;
  /** Of those, ones at urgent risk or P1 priority. */
  urgentPriority: number;
};

export type PriorityDistribution = {
  period: "today" | "week" | "month";
  counts: Record<RiskLevel, number>;
};

export type ConnectorActivity = {
  /** BatchRunSource value, e.g. "HL7", "HEALTH_NZ". */
  source: string;
  sourceSystem: string | null;
  sessions: number;
  cases: number;
  lastSeenAt: Date | null;
  /**
   * Derived purely from recency of real intake. Never a live health probe:
   * this environment has no live hospital connection.
   */
  status: "ACTIVE" | "IDLE" | "STALE";
};

export type DashboardInsights = {
  policy: CommandCentreMetricPolicy;
  /** Daily series, oldest first. Empty when the user may not see metrics. */
  queueTrend: QueueTrendPoint[];
  priorityDistribution: PriorityDistribution[];
  connectors: ConnectorActivity[];
  /** True when there is no intake at all, so the UI can show a real empty state. */
  hasAnyIntake: boolean;
};

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function isoDate(date: Date) {
  return startOfDay(date).toISOString().slice(0, 10);
}

function emptyInsights(policy: CommandCentreMetricPolicy): DashboardInsights {
  return {
    policy,
    queueTrend: [],
    priorityDistribution: [],
    connectors: [],
    hasAnyIntake: false,
  };
}

/** Recency buckets for connector activity, in days. */
const ACTIVE_WITHIN_DAYS = 2;
const IDLE_WITHIN_DAYS = 14;

function connectorStatus(lastSeenAt: Date | null, now: Date): ConnectorActivity["status"] {
  if (!lastSeenAt) return "STALE";
  const ageDays = (now.getTime() - lastSeenAt.getTime()) / 86_400_000;
  if (ageDays <= ACTIVE_WITHIN_DAYS) return "ACTIVE";
  if (ageDays <= IDLE_WITHIN_DAYS) return "IDLE";
  return "STALE";
}

export async function getDashboardInsights(
  user: DecisionUser,
  options: { trendDays?: number; now?: Date } = {}
): Promise<DashboardInsights> {
  const now = options.now ?? new Date();
  const trendDays = Math.min(Math.max(options.trendDays ?? 7, 1), 90);
  const policy = getCommandCentreMetricPolicy(user);
  if (!policy.canViewOperationalMetrics) return emptyInsights(policy);

  const trendStart = startOfDay(new Date(now.getTime() - (trendDays - 1) * 86_400_000));
  const today = startOfDay(now);
  const week = startOfCurrentWeek(now);
  const month = new Date(now.getFullYear(), now.getMonth(), 1);
  const itemStart = trendStart < month ? trendStart : month;

  const [itemRows, connectorRows] = await Promise.all([
    // One bounded projection supplies both queue trend and priority buckets.
    // Previously two overlapping reads fetched the same month of items.
    prisma.batchReviewItem.findMany({
      where: { createdAt: { gte: itemStart } },
      select: {
        disposition: true,
        createdAt: true,
        reviewRequired: true,
        riskLevel: true,
        referralPriority: true,
      },
    }),
    prisma.batchRun.groupBy({
      by: ["source", "sourceSystem"],
      _count: { _all: true },
      _sum: { totalCases: true },
      _max: { createdAt: true },
    }),
  ]);

  // ── Queue trend ───────────────────────────────────────────────────────────
  const trendByDay = new Map<string, QueueTrendPoint>();
  for (let offset = 0; offset < trendDays; offset += 1) {
    const day = new Date(trendStart.getTime() + offset * 86_400_000);
    trendByDay.set(isoDate(day), {
      date: isoDate(day),
      totalInQueue: 0,
      clinicianReviewRequired: 0,
      urgentPriority: 0,
    });
  }
  for (const row of itemRows) {
    if (row.disposition !== "PENDING" || row.createdAt < trendStart) continue;
    const point = trendByDay.get(isoDate(row.createdAt));
    if (!point) continue;
    point.totalInQueue += 1;
    if (row.reviewRequired) point.clinicianReviewRequired += 1;
    if (row.riskLevel === "URGENT" || row.referralPriority === "P1" || row.referralPriority === "P1_HSC") {
      point.urgentPriority += 1;
    }
  }

  // ── Priority distribution ─────────────────────────────────────────────────
  const emptyCounts = (): Record<RiskLevel, number> => ({
    LOW: 0,
    MEDIUM: 0,
    HIGH: 0,
    URGENT: 0,
  });
  const buckets: Record<PriorityDistribution["period"], Record<RiskLevel, number>> = {
    today: emptyCounts(),
    week: emptyCounts(),
    month: emptyCounts(),
  };
  for (const row of itemRows) {
    if (row.createdAt < month) continue;
    const level = RISK_LEVELS.includes(row.riskLevel as RiskLevel)
      ? (row.riskLevel as RiskLevel)
      : null;
    if (!level) continue; // never coerce an unknown level into a known bucket
    buckets.month[level] += 1;
    if (row.createdAt >= week) buckets.week[level] += 1;
    if (row.createdAt >= today) buckets.today[level] += 1;
  }

  // ── Connectors ────────────────────────────────────────────────────────────
  const connectors: ConnectorActivity[] = connectorRows
    .map((row) => ({
      source: row.source,
      sourceSystem: row.sourceSystem,
      sessions: row._count._all,
      cases: row._sum.totalCases ?? 0,
      lastSeenAt: row._max.createdAt,
      status: connectorStatus(row._max.createdAt, now),
    }))
    .sort((left, right) => (right.lastSeenAt?.getTime() ?? 0) - (left.lastSeenAt?.getTime() ?? 0));

  return {
    policy,
    queueTrend: [...trendByDay.values()],
    priorityDistribution: [
      { period: "today", counts: buckets.today },
      { period: "week", counts: buckets.week },
      { period: "month", counts: buckets.month },
    ],
    connectors,
    hasAnyIntake: connectorRows.length > 0,
  };
}
