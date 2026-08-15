import { Prisma } from "@prisma/client";

import { ensureDatabaseReady } from "@/lib/database/bootstrap";
import { prisma } from "@/lib/prisma";
import { APP_TIME_ZONE } from "@/lib/usage/usage-date-range";
import { USAGE_EVENT_TYPES, type UsageEventType } from "@/lib/usage/usage-events";

export const USAGE_EVENT_LABELS: Record<UsageEventType, string> = {
  FIRST_TRIAGE: "First triage",
  UPDATE_REEVALUATION: "Updated result",
  REGRADE: "Manual re-evaluation",
  DUPLICATE_SUPPRESSED: "Duplicate not reprocessed",
};

export const EPISODE_ACTIVITY_LABELS: Record<string, string> = {
  NEW: "New episode",
  ALREADY_IN_REVIEW: "Already in review",
  COMPLETED: "Completed previously",
  UPDATED: "Updated result received",
  POSSIBLE_DUPLICATE: "Possible duplicate processed",
  MANUAL_REGRADE: "Manual re-evaluation",
};

export const REVIEW_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending review",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  NEEDS_INFO: "Needs information",
};

const SOURCE_LABELS: Record<string, string> = {
  DEMO: "Demo connector",
  CSV: "CSV upload",
  XLSX: "Excel upload",
  JSON: "JSON upload",
  MANUAL: "Manual entry",
  HL7: "HL7v2 lab feed",
  FHIR: "FHIR",
  ERMS: "eReferral / ERMS",
  HEALTH_NZ: "Health NZ",
};

export type UsageActivityFilters = {
  organisationId: string;
  from: Date;
  toExclusive: Date;
  source?: string;
  eventType?: string;
  episodeActivity?: string;
  rulesetVersion?: string;
  reviewStatus?: string;
  page?: number;
  pageSize?: number;
};

export type UsageActivityRow = {
  id: string;
  occurredAt: string;
  episodeId: string;
  episodeReference: string;
  source: string;
  sourceFacility: string | null;
  eventType: string;
  eventLabel: string;
  classification: string;
  classificationLabel: string;
  rulesetVersion: string | null;
  ruleEvaluationId: string | null;
  batchReviewItemId: string | null;
  batchRunId: string | null;
  reviewStatus: string | null;
};

export type UsageMetrics = {
  arrivals: number;
  uniqueEpisodes: number;
  firstTriages: number;
  updatedResults: number;
  manualRegrades: number;
  duplicatesSuppressed: number;
  inReview: number;
  completed: number;
};

export type UsageIntegrityCounts = {
  raw: number;
  effective: number;
  invalidated: number;
};

export type UsageTrendPoint = {
  date: string;
  firstTriages: number;
  updatedResults: number;
  manualRegrades: number;
  duplicatesSuppressed: number;
  total: number;
};

export type UsageFilterOptions = {
  sources: { value: string; label: string }[];
  rulesetVersions: string[];
  episodeActivities: { value: string; label: string }[];
};

export type InvalidatedUsageHistoryRow = {
  id: string;
  occurredAt: string;
  eventLabel: string;
  source: string;
  reasonCode: string;
  reasonDetail: string | null;
  correctedAt: string;
  systemActor: string | null;
};

export type EpisodeHistory = {
  episodeId: string;
  episodeReference: string;
  sourceFacility: string | null;
  testType: string | null;
  collectedOn: string | null;
  events: Array<{
    id: string;
    title: string;
    timestamp: string;
    description: string | null;
    tone: "neutral" | "brand" | "success" | "warn" | "danger";
  }>;
  evaluations: Array<{
    id: string;
    evaluatedAt: string;
    rulesetVersion: string;
    evaluationMode: string;
    previousEvaluationId: string | null;
    regradeReason: string | null;
  }>;
};

type CountValue = bigint | number | string | null;

function numberValue(value: CountValue | undefined) {
  return Number(value ?? 0);
}

function iso(value: Date | string | number | null | undefined) {
  if (value === null || value === undefined) return null;
  return new Date(value).toISOString();
}

function sourceLabel(value: string | null | undefined) {
  if (!value) return "Source not recorded";
  return SOURCE_LABELS[value] ?? value;
}

function eventLabel(value: string) {
  return USAGE_EVENT_LABELS[value as UsageEventType] ?? value.replaceAll("_", " ").toLowerCase();
}

function activityLabel(value: string) {
  return EPISODE_ACTIVITY_LABELS[value] ?? value.replaceAll("_", " ").toLowerCase();
}

function pagination(filters: UsageActivityFilters) {
  const pageSize = Math.max(1, Math.min(filters.pageSize ?? 25, 100));
  const page = Math.max(1, filters.page ?? 1);
  return { page, pageSize, skip: (page - 1) * pageSize };
}

const joins = Prisma.sql`
  LEFT JOIN "ScreeningEpisode" episode ON episode."id" = usage."episodeId"
  LEFT JOIN "BatchRun" event_run ON event_run."id" = usage."batchRunId"
  LEFT JOIN "BatchReviewItem" current_item ON current_item."id" = (
    SELECT candidate."id"
    FROM "BatchReviewItem" candidate
    WHERE candidate."episodeId" = usage."episodeId"
    ORDER BY candidate."createdAt" DESC, candidate."id" DESC
    LIMIT 1
  )
  LEFT JOIN "BatchRun" current_run ON current_run."id" = current_item."batchRunId"
`;

function conditions(filters: UsageActivityFilters) {
  const parts: Prisma.Sql[] = [
    Prisma.sql`usage."organisationId" = ${filters.organisationId}`,
    Prisma.sql`usage."occurredAt" >= ${filters.from}`,
    Prisma.sql`usage."occurredAt" < ${filters.toExclusive}`,
  ];

  if (filters.source) {
    parts.push(Prisma.sql`(
      usage."source" = ${filters.source}
      OR episode."sourceFacility" = ${filters.source}
      OR event_run."sourceSystem" = ${filters.source}
      OR event_run."source" = ${filters.source}
      OR current_run."sourceSystem" = ${filters.source}
      OR current_run."source" = ${filters.source}
    )`);
  }
  if (filters.eventType) {
    parts.push(Prisma.sql`usage."eventType" = ${filters.eventType}`);
  }
  if (filters.episodeActivity) {
    parts.push(Prisma.sql`usage."classification" = ${filters.episodeActivity}`);
  }
  if (filters.rulesetVersion) {
    parts.push(Prisma.sql`usage."rulesetVersion" = ${filters.rulesetVersion}`);
  }
  if (filters.reviewStatus) {
    parts.push(Prisma.sql`current_item."disposition" = ${filters.reviewStatus}`);
  }
  return Prisma.join(parts, " AND ");
}

const effectiveCondition = Prisma.sql`
  NOT EXISTS (
    SELECT 1
    FROM "UsageEventCorrection" correction
    WHERE correction."usageEventId" = usage."id"
      AND correction."correctionType" = 'INVALIDATE'
  )
`;

/** The paginated normal view. Every row is correction-aware effective usage. */
export async function listUsageActivity(filters: UsageActivityFilters) {
  await ensureDatabaseReady();
  const { page, pageSize, skip } = pagination(filters);
  const where = conditions(filters);

  type RawRow = {
    id: string;
    occurredAt: Date | string | number;
    episodeId: string;
    eventType: string;
    classification: string;
    rulesetVersion: string | null;
    ruleEvaluationId: string | null;
    batchReviewItemId: string | null;
    batchRunId: string | null;
    usageSource: string | null;
    sourceEpisodeKey: string | null;
    sourceFacility: string | null;
    currentExternalPatientId: string | null;
    currentRowNumber: number | null;
    currentDisposition: string | null;
    eventSourceSystem: string | null;
    eventSourceType: string | null;
    currentSourceSystem: string | null;
    currentSourceType: string | null;
  };
  type CountRow = { count: CountValue };

  const [rawRows, countRows] = await Promise.all([
    prisma.$queryRaw<RawRow[]>(Prisma.sql`
      SELECT
        usage."id" AS "id",
        usage."occurredAt" AS "occurredAt",
        usage."episodeId" AS "episodeId",
        usage."eventType" AS "eventType",
        usage."classification" AS "classification",
        usage."rulesetVersion" AS "rulesetVersion",
        usage."ruleEvaluationId" AS "ruleEvaluationId",
        usage."batchReviewItemId" AS "batchReviewItemId",
        usage."batchRunId" AS "batchRunId",
        usage."source" AS "usageSource",
        episode."sourceEpisodeKey" AS "sourceEpisodeKey",
        episode."sourceFacility" AS "sourceFacility",
        current_item."externalPatientId" AS "currentExternalPatientId",
        current_item."rowNumber" AS "currentRowNumber",
        current_item."disposition" AS "currentDisposition",
        event_run."sourceSystem" AS "eventSourceSystem",
        event_run."source" AS "eventSourceType",
        current_run."sourceSystem" AS "currentSourceSystem",
        current_run."source" AS "currentSourceType"
      FROM "UsageEvent" usage
      ${joins}
      WHERE ${where} AND ${effectiveCondition}
      ORDER BY usage."occurredAt" DESC, usage."id" DESC
      LIMIT ${pageSize} OFFSET ${skip}
    `),
    prisma.$queryRaw<CountRow[]>(Prisma.sql`
      SELECT COUNT(*) AS "count"
      FROM "UsageEvent" usage
      ${joins}
      WHERE ${where} AND ${effectiveCondition}
    `),
  ]);

  const rows: UsageActivityRow[] = rawRows.map((row) => {
    const source =
      row.sourceFacility ??
      row.eventSourceSystem ??
      row.currentSourceSystem ??
      row.usageSource ??
      row.eventSourceType ??
      row.currentSourceType;
    const episodeReference =
      row.sourceEpisodeKey ??
      row.currentExternalPatientId ??
      (row.currentRowNumber ? `Source case ${row.currentRowNumber}` : `Episode …${row.episodeId.slice(-6)}`);
    return {
      id: row.id,
      occurredAt: iso(row.occurredAt)!,
      episodeId: row.episodeId,
      episodeReference,
      source: sourceLabel(source),
      sourceFacility: row.sourceFacility,
      eventType: row.eventType,
      eventLabel: eventLabel(row.eventType),
      classification: row.classification,
      classificationLabel: activityLabel(row.classification),
      rulesetVersion: row.rulesetVersion,
      ruleEvaluationId: row.ruleEvaluationId,
      batchReviewItemId: row.batchReviewItemId,
      batchRunId: row.batchRunId,
      reviewStatus: row.currentDisposition,
    };
  });
  const total = numberValue(countRows[0]?.count);

  return {
    rows,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getUsageMetrics(filters: UsageActivityFilters): Promise<UsageMetrics> {
  await ensureDatabaseReady();
  const where = conditions(filters);
  type MetricRow = {
    uniqueEpisodes: CountValue;
    firstTriages: CountValue;
    updatedResults: CountValue;
    manualRegrades: CountValue;
    duplicatesSuppressed: CountValue;
    inReview: CountValue;
    completed: CountValue;
  };
  type ArrivalRow = { arrivals: CountValue };

  const [metricRows, arrivalRows] = await Promise.all([
    prisma.$queryRaw<MetricRow[]>(Prisma.sql`
      SELECT
        COUNT(DISTINCT CASE WHEN usage."eventType" <> 'DUPLICATE_SUPPRESSED' THEN usage."episodeId" END) AS "uniqueEpisodes",
        SUM(CASE WHEN usage."eventType" = 'FIRST_TRIAGE' THEN 1 ELSE 0 END) AS "firstTriages",
        SUM(CASE WHEN usage."eventType" = 'UPDATE_REEVALUATION' THEN 1 ELSE 0 END) AS "updatedResults",
        SUM(CASE WHEN usage."eventType" = 'REGRADE' THEN 1 ELSE 0 END) AS "manualRegrades",
        SUM(CASE WHEN usage."eventType" = 'DUPLICATE_SUPPRESSED' THEN 1 ELSE 0 END) AS "duplicatesSuppressed",
        COUNT(DISTINCT CASE WHEN current_item."disposition" = 'PENDING' THEN usage."episodeId" END) AS "inReview",
        COUNT(DISTINCT CASE WHEN current_item."disposition" IN ('ACCEPTED', 'REJECTED', 'NEEDS_INFO') THEN usage."episodeId" END) AS "completed"
      FROM "UsageEvent" usage
      ${joins}
      WHERE ${where} AND ${effectiveCondition}
    `),
    prisma.$queryRaw<ArrivalRow[]>(Prisma.sql`
      SELECT COUNT(*) AS "arrivals"
      FROM "EpisodeObservation" observation
      JOIN "ScreeningEpisode" observed_episode ON observed_episode."id" = observation."episodeId"
      WHERE observed_episode."organisationId" = ${filters.organisationId}
        AND observation."observedAt" >= ${filters.from}
        AND observation."observedAt" < ${filters.toExclusive}
        AND EXISTS (
          SELECT 1
          FROM "UsageEvent" usage
          ${joins}
          WHERE usage."episodeId" = observation."episodeId"
            AND ${where}
            AND ${effectiveCondition}
        )
    `),
  ]);
  const row = metricRows[0];
  return {
    arrivals: numberValue(arrivalRows[0]?.arrivals),
    uniqueEpisodes: numberValue(row?.uniqueEpisodes),
    firstTriages: numberValue(row?.firstTriages),
    updatedResults: numberValue(row?.updatedResults),
    manualRegrades: numberValue(row?.manualRegrades),
    duplicatesSuppressed: numberValue(row?.duplicatesSuppressed),
    inReview: numberValue(row?.inReview),
    completed: numberValue(row?.completed),
  };
}

export async function getUsageIntegrityCounts(
  filters: UsageActivityFilters
): Promise<UsageIntegrityCounts> {
  await ensureDatabaseReady();
  type Row = { raw: CountValue; effective: CountValue; invalidated: CountValue };
  const rows = await prisma.$queryRaw<Row[]>(Prisma.sql`
    SELECT
      COUNT(*) AS "raw",
      SUM(CASE WHEN ${effectiveCondition} THEN 1 ELSE 0 END) AS "effective",
      SUM(CASE WHEN ${effectiveCondition} THEN 0 ELSE 1 END) AS "invalidated"
    FROM "UsageEvent" usage
    ${joins}
    WHERE ${conditions(filters)}
  `);
  return {
    raw: numberValue(rows[0]?.raw),
    effective: numberValue(rows[0]?.effective),
    invalidated: numberValue(rows[0]?.invalidated),
  };
}

export async function getUsageTrend(filters: UsageActivityFilters): Promise<UsageTrendPoint[]> {
  await ensureDatabaseReady();
  type Row = { hour: string; eventType: string; count: CountValue };
  const rows = await prisma.$queryRaw<Row[]>(Prisma.sql`
    SELECT substr(usage."occurredAt", 1, 13) AS "hour",
           usage."eventType" AS "eventType",
           COUNT(*) AS "count"
    FROM "UsageEvent" usage
    ${joins}
    WHERE ${conditions(filters)} AND ${effectiveCondition}
    GROUP BY substr(usage."occurredAt", 1, 13), usage."eventType"
    ORDER BY "hour" ASC
  `);
  const byDate = new Map<string, UsageTrendPoint>();
  for (const row of rows) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: APP_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(`${row.hour}:00:00.000Z`));
    const part = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((entry) => entry.type === type)?.value ?? "";
    const date = `${part("year")}-${part("month")}-${part("day")}`;
    const point = byDate.get(date) ?? {
      date,
      firstTriages: 0,
      updatedResults: 0,
      manualRegrades: 0,
      duplicatesSuppressed: 0,
      total: 0,
    };
    const count = numberValue(row.count);
    if (row.eventType === "FIRST_TRIAGE") point.firstTriages += count;
    if (row.eventType === "UPDATE_REEVALUATION") point.updatedResults += count;
    if (row.eventType === "REGRADE") point.manualRegrades += count;
    if (row.eventType === "DUPLICATE_SUPPRESSED") point.duplicatesSuppressed += count;
    point.total += count;
    byDate.set(date, point);
  }
  return [...byDate.values()];
}

export async function getUsageFilterOptions(
  organisationId: string
): Promise<UsageFilterOptions> {
  const [usageSources, episodeSources, runs, versions, usageActivities, observations] =
    await Promise.all([
      prisma.usageEvent.findMany({
        where: { organisationId, source: { not: null } },
        select: { source: true },
        distinct: ["source"],
      }),
      prisma.screeningEpisode.findMany({
        where: { organisationId, sourceFacility: { not: null } },
        select: { sourceFacility: true },
        distinct: ["sourceFacility"],
      }),
      prisma.batchRun.findMany({
        where: { organisationId },
        select: { source: true, sourceSystem: true },
        distinct: ["source", "sourceSystem"],
      }),
      prisma.usageEvent.findMany({
        where: { organisationId, rulesetVersion: { not: null } },
        select: { rulesetVersion: true },
        distinct: ["rulesetVersion"],
      }),
      prisma.usageEvent.findMany({
        where: { organisationId },
        select: { classification: true },
        distinct: ["classification"],
      }),
      prisma.episodeObservation.findMany({
        where: { episode: { organisationId } },
        select: { classification: true },
        distinct: ["classification"],
      }),
    ]);

  const sources = new Set<string>();
  usageSources.forEach((row) => row.source && sources.add(row.source));
  episodeSources.forEach((row) => row.sourceFacility && sources.add(row.sourceFacility));
  runs.forEach((row) => {
    sources.add(row.source);
    if (row.sourceSystem) sources.add(row.sourceSystem);
  });
  const activities = new Set([
    ...usageActivities.map((row) => row.classification),
    ...observations.map((row) => row.classification),
  ]);

  return {
    sources: [...sources]
      .map((value) => ({ value, label: sourceLabel(value) }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    rulesetVersions: versions
      .map((row) => row.rulesetVersion)
      .filter((value): value is string => Boolean(value))
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true })),
    episodeActivities: [...activities]
      .map((value) => ({ value, label: activityLabel(value) }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  };
}

export async function listInvalidatedUsageHistory(
  filters: UsageActivityFilters & { auditPage?: number; auditPageSize?: number }
) {
  await ensureDatabaseReady();
  const pageSize = Math.max(1, Math.min(filters.auditPageSize ?? 25, 100));
  const page = Math.max(1, filters.auditPage ?? 1);
  const skip = (page - 1) * pageSize;
  type Row = {
    id: string;
    occurredAt: Date | string | number;
    eventType: string;
    source: string | null;
    reasonCode: string;
    reasonDetail: string | null;
    correctedAt: Date | string | number;
    systemActor: string | null;
  };
  type CountRow = { count: CountValue };
  const [rows, counts] = await Promise.all([
    prisma.$queryRaw<Row[]>(Prisma.sql`
      SELECT usage."id" AS "id",
             usage."occurredAt" AS "occurredAt",
             usage."eventType" AS "eventType",
             usage."source" AS "source",
             correction."reasonCode" AS "reasonCode",
             correction."reasonDetail" AS "reasonDetail",
             correction."createdAt" AS "correctedAt",
             correction."systemActor" AS "systemActor"
      FROM "UsageEvent" usage
      ${joins}
      JOIN "UsageEventCorrection" correction
        ON correction."usageEventId" = usage."id"
       AND correction."correctionType" = 'INVALIDATE'
      WHERE ${conditions(filters)}
      ORDER BY usage."occurredAt" DESC, usage."id" DESC
      LIMIT ${pageSize} OFFSET ${skip}
    `),
    prisma.$queryRaw<CountRow[]>(Prisma.sql`
      SELECT COUNT(*) AS "count"
      FROM "UsageEvent" usage
      ${joins}
      WHERE ${conditions(filters)} AND NOT ${effectiveCondition}
    `),
  ]);
  const total = numberValue(counts[0]?.count);
  return {
    rows: rows.map<InvalidatedUsageHistoryRow>((row) => ({
      id: row.id,
      occurredAt: iso(row.occurredAt)!,
      eventLabel: eventLabel(row.eventType),
      source: sourceLabel(row.source),
      reasonCode: row.reasonCode,
      reasonDetail: row.reasonDetail,
      correctedAt: iso(row.correctedAt)!,
      systemActor: row.systemActor,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getEpisodeHistory(args: {
  organisationId: string;
  episodeId: string;
}): Promise<EpisodeHistory | null> {
  const episode = await prisma.screeningEpisode.findFirst({
    where: { id: args.episodeId, organisationId: args.organisationId },
    include: {
      observations: { orderBy: { observedAt: "asc" } },
    },
  });
  if (!episode) return null;

  const [usageEvents, items] = await Promise.all([
    prisma.usageEvent.findMany({
      where: { organisationId: args.organisationId, episodeId: args.episodeId },
      include: { corrections: { orderBy: { createdAt: "asc" } } },
      orderBy: { occurredAt: "asc" },
    }),
    prisma.batchReviewItem.findMany({
      where: { episodeId: args.episodeId },
      select: {
        id: true,
        createdAt: true,
        disposition: true,
        reviewedAt: true,
        supersededAt: true,
        ruleEvaluationId: true,
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const evaluationIds = new Set<string>();
  usageEvents.forEach((event) => event.ruleEvaluationId && evaluationIds.add(event.ruleEvaluationId));
  items.forEach((item) => item.ruleEvaluationId && evaluationIds.add(item.ruleEvaluationId));
  const evaluations = evaluationIds.size
    ? await prisma.ruleEvaluation.findMany({
        where: { id: { in: [...evaluationIds] } },
        select: {
          id: true,
          evaluatedAt: true,
          ruleVersionDisplay: true,
          evaluationMode: true,
          previousEvaluationId: true,
          regradeReason: true,
        },
        orderBy: { evaluatedAt: "asc" },
      })
    : [];

  const historyEvents: EpisodeHistory["events"] = [
    {
      id: `episode-${episode.id}`,
      title: "Episode received",
      timestamp: iso(episode.firstSeenAt)!,
      description: episode.sourceFacility
        ? `Received from ${episode.sourceFacility}.`
        : "The episode was registered from source data.",
      tone: "neutral",
    },
  ];

  for (const observation of episode.observations) {
    const title =
      observation.classification === "UPDATED"
        ? "Updated result received"
        : observation.classification === "ALREADY_IN_REVIEW"
          ? "Already in review"
          : observation.classification === "COMPLETED"
            ? "Completed previously"
            : observation.classification === "POSSIBLE_DUPLICATE"
              ? "Possible duplicate processed"
              : "Arrival observed";
    historyEvents.push({
      id: `observation-${observation.id}`,
      title,
      timestamp: iso(observation.observedAt)!,
      description: observation.explanation,
      tone:
        observation.classification === "UPDATED"
          ? "brand"
          : observation.classification === "ALREADY_IN_REVIEW" ||
              observation.classification === "COMPLETED"
            ? "warn"
            : "neutral",
    });
  }

  for (const event of usageEvents) {
    const invalidated = event.corrections.some(
      (correction) => correction.correctionType === "INVALIDATE"
    );
    const title = invalidated
      ? `${eventLabel(event.eventType)} — historically invalidated`
      : eventLabel(event.eventType);
    historyEvents.push({
      id: `usage-${event.id}`,
      title,
      timestamp: iso(event.occurredAt)!,
      description: invalidated
        ? "The immutable event remains in raw audit history but is excluded from operational totals."
        : event.rulesetVersion
          ? `Recorded under ruleset ${event.rulesetVersion}.`
          : "Recorded as immutable operational activity.",
      tone: invalidated
        ? "danger"
        : event.eventType === "FIRST_TRIAGE"
          ? "success"
          : event.eventType === "DUPLICATE_SUPPRESSED"
            ? "warn"
            : "brand",
    });
  }

  for (const item of items) {
    historyEvents.push({
      id: `review-open-${item.id}`,
      title: "Added to review",
      timestamp: iso(item.createdAt)!,
      description: "A reviewable case was created without replacing earlier episode history.",
      tone: "neutral",
    });
    if (item.supersededAt) {
      historyEvents.push({
        id: `superseded-${item.id}`,
        title: "Newer result available",
        timestamp: iso(item.supersededAt)!,
        description: "The earlier decision remains preserved and is marked as superseded.",
        tone: "warn",
      });
    }
    if (item.reviewedAt && item.disposition !== "PENDING") {
      historyEvents.push({
        id: `reviewed-${item.id}`,
        title: "Review completed",
        timestamp: iso(item.reviewedAt)!,
        description: REVIEW_STATUS_LABELS[item.disposition] ?? item.disposition,
        tone: item.disposition === "REJECTED" ? "warn" : "success",
      });
    }
  }

  historyEvents.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  const episodeReference =
    episode.sourceEpisodeKey ?? episode.nhi ?? `Episode …${episode.id.slice(-6)}`;

  return {
    episodeId: episode.id,
    episodeReference,
    sourceFacility: episode.sourceFacility,
    testType: episode.testType,
    collectedOn: iso(episode.collectedOn),
    events: historyEvents,
    evaluations: evaluations.map((evaluation) => ({
      id: evaluation.id,
      evaluatedAt: iso(evaluation.evaluatedAt)!,
      rulesetVersion: evaluation.ruleVersionDisplay,
      evaluationMode: evaluation.evaluationMode,
      previousEvaluationId: evaluation.previousEvaluationId,
      regradeReason: evaluation.regradeReason,
    })),
  };
}

export function isSupportedUsageEventType(value: string | undefined): value is UsageEventType {
  return Boolean(value && USAGE_EVENT_TYPES.includes(value as UsageEventType));
}
