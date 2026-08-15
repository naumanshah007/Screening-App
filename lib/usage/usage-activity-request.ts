import {
  isSupportedUsageEventType,
  type UsageActivityFilters,
} from "@/lib/usage/usage-activity";
import { resolveUsageDateRange } from "@/lib/usage/usage-date-range";

export type UsageActivitySearchParams = {
  range?: string;
  from?: string;
  to?: string;
  source?: string;
  event?: string;
  activity?: string;
  ruleset?: string;
  review?: string;
  page?: string;
  history?: string;
  audit?: string;
  auditPage?: string;
};

const REVIEW_STATUSES = new Set(["PENDING", "ACCEPTED", "REJECTED", "NEEDS_INFO"]);

function compact(value: string | undefined, max = 120) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

function positiveInteger(value: string | undefined) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export function resolveUsageActivityRequest(
  params: UsageActivitySearchParams,
  organisationId: string
) {
  const range = resolveUsageDateRange({
    preset: params.range,
    from: params.from,
    to: params.to,
  });
  const eventType = isSupportedUsageEventType(params.event)
    ? params.event
    : undefined;
  const reviewStatus = REVIEW_STATUSES.has(params.review ?? "")
    ? params.review
    : undefined;
  const filters: UsageActivityFilters = {
    organisationId,
    from: range.from,
    toExclusive: range.toExclusive,
    source: compact(params.source),
    eventType,
    episodeActivity: compact(params.activity, 40),
    rulesetVersion: compact(params.ruleset, 80),
    reviewStatus,
    page: positiveInteger(params.page),
    pageSize: 25,
  };
  return {
    range,
    filters,
    historyEpisodeId: compact(params.history, 180),
    showInvalidatedAudit: params.audit === "invalidated",
    auditPage: positiveInteger(params.auditPage),
  };
}

export function usageQueryParams(
  params: UsageActivitySearchParams,
  overrides: Partial<Record<keyof UsageActivitySearchParams, string | null>> = {}
) {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...params, ...overrides })) {
    if (value) next.set(key, value);
  }
  return next;
}
