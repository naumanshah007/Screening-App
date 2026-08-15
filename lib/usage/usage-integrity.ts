import { Prisma } from "@prisma/client";

import { ensureDatabaseReady } from "@/lib/database/bootstrap";
import { prisma } from "@/lib/prisma";

export type UsageIntegrityReport = {
  /** Raw historical facts. Corrected defect rows deliberately remain here. */
  usageEventsWithMissingEpisode: number;
  episodeObservationsWithMissingEpisode: number;
  duplicateFirstTriageGroups: number;
  /** Missing-episode facts with no terminal INVALIDATE correction. */
  uncorrectedInvalidUsageEvents: number;
};

function count(rows: Array<{ count: bigint | number }>) {
  return Number(rows[0]?.count ?? 0);
}

/** Reusable operational health query. It states raw and effective integrity
 * separately so a preserved historical defect is never reported as erased. */
export async function getUsageIntegrityReport(args: {
  organisationId?: string;
} = {}): Promise<UsageIntegrityReport> {
  // Raw Prisma queries bypass the all-model bootstrap extension. Make this
  // service safe as the first operation run by a deployment or remediation
  // process against a database that predates UsageEventCorrection.
  await ensureDatabaseReady();

  const usageOrganisation = args.organisationId
    ? Prisma.sql`AND usage."organisationId" = ${args.organisationId}`
    : Prisma.empty;
  const duplicateOrganisation = args.organisationId
    ? Prisma.sql`WHERE "organisationId" = ${args.organisationId}`
    : Prisma.empty;

  const [missingUsage, missingObservations, duplicateFirstTriage, uncorrected] =
    await Promise.all([
      prisma.$queryRaw<Array<{ count: bigint | number }>>(Prisma.sql`
        SELECT COUNT(*) AS count
        FROM "UsageEvent" usage
        LEFT JOIN "ScreeningEpisode" episode ON episode."id" = usage."episodeId"
        WHERE episode."id" IS NULL
        ${usageOrganisation}
      `),
      prisma.$queryRaw<Array<{ count: bigint | number }>>(Prisma.sql`
        SELECT COUNT(*) AS count
        FROM "EpisodeObservation" observation
        LEFT JOIN "ScreeningEpisode" episode ON episode."id" = observation."episodeId"
        WHERE episode."id" IS NULL
      `),
      prisma.$queryRaw<Array<{ count: bigint | number }>>(Prisma.sql`
        SELECT COUNT(*) AS count
        FROM (
          SELECT "organisationId", "episodeId"
          FROM "UsageEvent"
          ${duplicateOrganisation}
          ${args.organisationId ? Prisma.sql`AND` : Prisma.sql`WHERE`} "eventType" = 'FIRST_TRIAGE'
          GROUP BY "organisationId", "episodeId"
          HAVING COUNT(*) > 1
        ) duplicates
      `),
      prisma.$queryRaw<Array<{ count: bigint | number }>>(Prisma.sql`
        SELECT COUNT(*) AS count
        FROM "UsageEvent" usage
        LEFT JOIN "ScreeningEpisode" episode ON episode."id" = usage."episodeId"
        LEFT JOIN "UsageEventCorrection" correction
          ON correction."usageEventId" = usage."id"
         AND correction."correctionType" = 'INVALIDATE'
        WHERE episode."id" IS NULL
          AND correction."id" IS NULL
          ${usageOrganisation}
      `),
    ]);

  return {
    usageEventsWithMissingEpisode: count(missingUsage),
    episodeObservationsWithMissingEpisode: count(missingObservations),
    duplicateFirstTriageGroups: count(duplicateFirstTriage),
    uncorrectedInvalidUsageEvents: count(uncorrected),
  };
}
