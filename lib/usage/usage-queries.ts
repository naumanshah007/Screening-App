import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type UsageQueryFilters = {
  organisationId?: string;
  eventType?: string;
  from?: Date;
  to?: Date;
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
    ...(filters.eventType ? { eventType: filters.eventType } : {}),
    ...(filters.from || filters.to
      ? {
          occurredAt: {
            ...(filters.from ? { gte: filters.from } : {}),
            ...(filters.to ? { lte: filters.to } : {}),
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
