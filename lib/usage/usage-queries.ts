import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type UsageQueryFilters = {
  organisationId?: string;
  episodeId?: string;
  eventType?: string;
  classification?: string;
  rulesetVersion?: string;
  source?: string;
  from?: Date;
  to?: Date;
  /** Prefer this for UI date ranges: the instant belongs to the next range. */
  toExclusive?: Date;
  skip?: number;
  take?: number;
};

const auditInclude = {
  corrections: { orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.UsageEventInclude;

function whereFor(filters: UsageQueryFilters): Prisma.UsageEventWhereInput {
  return {
    ...(filters.organisationId
      ? { organisationId: filters.organisationId }
      : {}),
    ...(filters.episodeId ? { episodeId: filters.episodeId } : {}),
    ...(filters.eventType ? { eventType: filters.eventType } : {}),
    ...(filters.classification ? { classification: filters.classification } : {}),
    ...(filters.rulesetVersion ? { rulesetVersion: filters.rulesetVersion } : {}),
    ...(filters.source ? { source: filters.source } : {}),
    ...(filters.from || filters.to || filters.toExclusive
      ? {
          occurredAt: {
            ...(filters.from ? { gte: filters.from } : {}),
            ...(filters.to ? { lte: filters.to } : {}),
            ...(filters.toExclusive ? { lt: filters.toExclusive } : {}),
          },
        }
      : {}),
  };
}

function takeFor(filters: UsageQueryFilters) {
  return Math.max(1, Math.min(filters.take ?? 500, 2_000));
}

/** Raw immutable facts plus every correction, for audit/provenance. */
export function rawUsageEvents(filters: UsageQueryFilters = {}) {
  return prisma.usageEvent.findMany({
    where: whereFor(filters),
    include: auditInclude,
    orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
    skip: Math.max(0, filters.skip ?? 0),
    take: takeFor(filters),
  });
}

/** Canonical operational/commercial view. Terminally invalidated facts do not
 * contribute, but remain available through rawUsageEvents(). */
export function effectiveUsageEvents(filters: UsageQueryFilters = {}) {
  return prisma.usageEvent.findMany({
    where: {
      ...whereFor(filters),
      corrections: { none: { correctionType: "INVALIDATE" } },
    },
    include: auditInclude,
    orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
    skip: Math.max(0, filters.skip ?? 0),
    take: takeFor(filters),
  });
}

/** Invalidated facts and their append-only correction evidence. */
export function invalidatedUsageEvents(filters: UsageQueryFilters = {}) {
  return prisma.usageEvent.findMany({
    where: {
      ...whereFor(filters),
      corrections: { some: { correctionType: "INVALIDATE" } },
    },
    include: auditInclude,
    orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
    skip: Math.max(0, filters.skip ?? 0),
    take: takeFor(filters),
  });
}

export function effectiveUsageCount(filters: UsageQueryFilters = {}) {
  return prisma.usageEvent.count({
    where: {
      ...whereFor(filters),
      corrections: { none: { correctionType: "INVALIDATE" } },
    },
  });
}
