import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Activity,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  CopyX,
  Download,
  History,
  Inbox,
  Layers3,
  RefreshCcw,
  ShieldCheck,
} from "lucide-react";

import { EpisodeHistoryDrawer } from "@/components/usage/EpisodeHistoryDrawer";
import { UsageActivityChart } from "@/components/usage/UsageActivityChart";
import {
  CellStack,
  DataTable,
  MetricGrid,
  MetricTile,
  PageHeader,
  PageShell,
  Panel,
  PanelInset,
  StatusBadge,
  dispositionTone,
  type Column,
} from "@/components/system";
import { EmptyState } from "@/components/ui/empty-state";
import { getServerSession } from "@/lib/auth/server-session";
import { isAuthorizedForRoute } from "@/lib/auth/permissions";
import { getCurrentOrganisation } from "@/lib/organisation/current-organisation";
import {
  getEpisodeHistory,
  getUsageFilterOptions,
  getUsageIntegrityCounts,
  getUsageMetrics,
  getUsageTrend,
  listInvalidatedUsageHistory,
  listUsageActivity,
  REVIEW_STATUS_LABELS,
  USAGE_EVENT_LABELS,
  type UsageActivityRow,
} from "@/lib/usage/usage-activity";
import {
  resolveUsageActivityRequest,
  usageQueryParams,
  type UsageActivitySearchParams,
} from "@/lib/usage/usage-activity-request";
import { USAGE_EVENT_TYPES } from "@/lib/usage/usage-events";
import { getUsageIntegrityReport } from "@/lib/usage/usage-integrity";
import { formatAppDateTime } from "@/lib/usage/usage-date-range";

export const dynamic = "force-dynamic";

const linkButton =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1";
const smallLink =
  "inline-flex items-center rounded-md px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-900/30";

function href(params: UsageActivitySearchParams, overrides: Parameters<typeof usageQueryParams>[1]) {
  const query = usageQueryParams(params, overrides).toString();
  return `/admin/usage${query ? `?${query}` : ""}`;
}

function eventTone(eventType: string) {
  if (eventType === "FIRST_TRIAGE") return "success" as const;
  if (eventType === "DUPLICATE_SUPPRESSED") return "warn" as const;
  if (eventType === "REGRADE") return "canonical" as const;
  return "info" as const;
}

function activityColumns(
  params: UsageActivitySearchParams
): Column<UsageActivityRow>[] {
  return [
    {
      key: "time",
      header: "Date / time",
      cell: (row) => (
        <time className="whitespace-nowrap text-xs text-muted-foreground">
          {formatAppDateTime(row.occurredAt)}
        </time>
      ),
    },
    {
      key: "episode",
      header: "Episode reference",
      cell: (row) => (
        <CellStack primary={row.episodeReference} secondary={row.classificationLabel} />
      ),
    },
    {
      key: "source",
      header: "Source",
      cell: (row) => <span className="text-xs">{row.source}</span>,
      hideOnMobile: true,
    },
    {
      key: "event",
      header: "Event",
      cell: (row) => <StatusBadge tone={eventTone(row.eventType)}>{row.eventLabel}</StatusBadge>,
    },
    {
      key: "status",
      header: "Current review status",
      cell: (row) =>
        row.reviewStatus ? (
          <StatusBadge tone={dispositionTone(row.reviewStatus)}>
            {REVIEW_STATUS_LABELS[row.reviewStatus] ?? row.reviewStatus}
          </StatusBadge>
        ) : (
          <span className="text-xs text-muted-foreground">No review case</span>
        ),
      hideOnMobile: true,
    },
    {
      key: "ruleset",
      header: "Ruleset / evaluation",
      cell: (row) => (
        <CellStack
          primary={row.rulesetVersion ?? "Not recorded"}
          secondary={
            row.ruleEvaluationId
              ? `Evaluation …${row.ruleEvaluationId.slice(-8)}`
              : "No linked evaluation"
          }
        />
      ),
      hideOnMobile: true,
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      cell: (row) => (
        <div className="flex items-center justify-end gap-1 whitespace-nowrap">
          {row.batchRunId && (
            <Link className={smallLink} href={`/batch/runs/${row.batchRunId}`}>
              View case
            </Link>
          )}
          <Link
            className={smallLink}
            href={href(params, { history: row.episodeId })}
            scroll={false}
          >
            History
          </Link>
        </div>
      ),
    },
  ];
}

export default async function UsageActivityPage({
  searchParams,
}: {
  searchParams: Promise<UsageActivitySearchParams>;
}) {
  const session = await getServerSession();
  const user = session?.user as { role?: string } | undefined;
  if (!isAuthorizedForRoute("/admin/usage", user?.role)) redirect("/dashboard");

  const organisation = await getCurrentOrganisation();
  if (!organisation) {
    return (
      <PageShell width="wide">
        <PageHeader
          eyebrow="Administration"
          title="Usage & Activity"
          description="Operational evidence from the immutable usage ledger."
        />
        <Panel>
          <EmptyState
            icon={Activity}
            title="No operating organisation is configured"
            description="Usage activity cannot be attributed until the single operating organisation is available."
            nextStep="Configure or seed one active organisation, then reload this page."
          />
        </Panel>
      </PageShell>
    );
  }

  const params = await searchParams;
  const request = resolveUsageActivityRequest(params, organisation.id);
  const [metrics, integrityCounts, integrity, trend, activity, options, history] =
    await Promise.all([
      getUsageMetrics(request.filters),
      getUsageIntegrityCounts(request.filters),
      getUsageIntegrityReport({ organisationId: organisation.id }),
      getUsageTrend(request.filters),
      listUsageActivity(request.filters),
      getUsageFilterOptions(organisation.id),
      request.historyEpisodeId
        ? getEpisodeHistory({
            organisationId: organisation.id,
            episodeId: request.historyEpisodeId,
          })
        : Promise.resolve(null),
    ]);
  const invalidatedAudit = request.showInvalidatedAudit
    ? await listInvalidatedUsageHistory({
        ...request.filters,
        auditPage: request.auditPage,
      })
    : null;
  const isHealthy =
    integrity.uncorrectedInvalidUsageEvents === 0 &&
    integrity.episodeObservationsWithMissingEpisode === 0 &&
    integrity.duplicateFirstTriageGroups === 0;
  const hasFilters = Boolean(
    request.filters.source ||
      request.filters.eventType ||
      request.filters.episodeActivity ||
      request.filters.rulesetVersion ||
      request.filters.reviewStatus
  );
  const exportParams = usageQueryParams(params, {
    page: null,
    history: null,
    audit: null,
    auditPage: null,
  });

  return (
    <PageShell width="wide">
      <PageHeader
        eyebrow="Administration · Insights"
        title="Usage & Activity"
        description="Operational activity from immutable episode, observation and effective usage evidence. Commercial pricing is applied separately."
        actions={
          <a className={linkButton} href={`/api/admin/usage/export?${exportParams.toString()}`}>
            <Download className="h-4 w-4" aria-hidden />
            Export CSV
          </a>
        }
        meta={
          <>
            <span>
              <span className="block text-[0.625rem] font-medium uppercase tracking-wider text-muted-foreground">
                Organisation
              </span>
              <span className="text-sm font-medium text-foreground">
                {organisation.shortName ?? organisation.name}
              </span>
            </span>
            <span>
              <span className="block text-[0.625rem] font-medium uppercase tracking-wider text-muted-foreground">
                Reporting window
              </span>
              <span className="text-sm font-medium text-foreground">{request.range.label}</span>
            </span>
            <span>
              <span className="block text-[0.625rem] font-medium uppercase tracking-wider text-muted-foreground">
                Usage basis
              </span>
              <span className="text-sm font-medium text-foreground">Effective events</span>
            </span>
          </>
        }
      />

      <Panel title="Reporting window" description="One date range is applied to every metric, chart and activity row below.">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Date range">
          {[
            ["today", "Today"],
            ["7d", "Last 7 days"],
            ["30d", "Last 30 days"],
            ["month", "This month"],
          ].map(([value, label]) => (
            <Link
              key={value}
              href={href(params, { range: value, page: null })}
              className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                request.range.preset === value
                  ? "border-brand-600 bg-brand-600 text-white"
                  : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>

        <form className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6" method="get">
          <input type="hidden" name="range" value="custom" />
          <label className="text-xs font-medium text-muted-foreground">
            From
            <input
              className="mt-1 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground"
              type="date"
              name="from"
              defaultValue={request.range.fromDate}
            />
          </label>
          <label className="text-xs font-medium text-muted-foreground">
            To
            <input
              className="mt-1 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground"
              type="date"
              name="to"
              defaultValue={request.range.toDate}
            />
          </label>
          <label className="text-xs font-medium text-muted-foreground">
            Source
            <select
              className="mt-1 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground"
              name="source"
              defaultValue={request.filters.source ?? ""}
            >
              <option value="">All sources</option>
              {options.sources.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-muted-foreground">
            Event
            <select
              className="mt-1 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground"
              name="event"
              defaultValue={request.filters.eventType ?? ""}
            >
              <option value="">All events</option>
              {USAGE_EVENT_TYPES.map((eventType) => (
                <option key={eventType} value={eventType}>{USAGE_EVENT_LABELS[eventType]}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-muted-foreground">
            Episode activity
            <select
              className="mt-1 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground"
              name="activity"
              defaultValue={request.filters.episodeActivity ?? ""}
            >
              <option value="">All activity</option>
              {options.episodeActivities.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-muted-foreground">
            Review status
            <select
              className="mt-1 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground"
              name="review"
              defaultValue={request.filters.reviewStatus ?? ""}
            >
              <option value="">All review states</option>
              {Object.entries(REVIEW_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-muted-foreground md:col-span-2">
            Ruleset / version
            <select
              className="mt-1 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground"
              name="ruleset"
              defaultValue={request.filters.rulesetVersion ?? ""}
            >
              <option value="">All rulesets</option>
              {options.rulesetVersions.map((version) => (
                <option key={version} value={version}>{version}</option>
              ))}
            </select>
          </label>
          <div className="flex items-end gap-2 md:col-span-2">
            <button className={linkButton} type="submit">
              Apply filters
            </button>
            {hasFilters && (
              <Link
                className={linkButton}
                href={href(params, {
                  source: null,
                  event: null,
                  activity: null,
                  ruleset: null,
                  review: null,
                  page: null,
                })}
              >
                Clear filters
              </Link>
            )}
          </div>
        </form>
      </Panel>

      <MetricGrid columns={4}>
        <MetricTile label="Arrivals" value={metrics.arrivals} caption="Source observations received" icon={<Inbox className="h-4 w-4" />} />
        <MetricTile label="Unique episodes" value={metrics.uniqueEpisodes} caption="Episodes processed in this range" icon={<Layers3 className="h-4 w-4" />} />
        <MetricTile label="First triages" value={metrics.firstTriages} caption="First governed triage per episode" icon={<ClipboardCheck className="h-4 w-4" />} tone="success" />
        <MetricTile label="Updated results" value={metrics.updatedResults} caption="New clinical information re-evaluated" icon={<RefreshCcw className="h-4 w-4" />} />
        <MetricTile label="Manual regrades" value={metrics.manualRegrades} caption="Manual re-evaluations recorded" icon={<History className="h-4 w-4" />} tone="neutral" />
        <MetricTile label="Duplicates not reprocessed" value={metrics.duplicatesSuppressed} caption="Arrivals deliberately withheld" icon={<CopyX className="h-4 w-4" />} tone="warn" />
        <MetricTile label="In review" value={metrics.inReview} caption="Episodes currently pending review" icon={<Clock3 className="h-4 w-4" />} tone={metrics.inReview ? "warn" : "neutral"} />
        <MetricTile label="Completed" value={metrics.completed} caption="Episodes with a recorded disposition" icon={<CheckCircle2 className="h-4 w-4" />} tone="success" />
      </MetricGrid>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(340px,1fr)]">
        <Panel title="Effective activity over time" description="Invalidated historical rows are excluded from every bar.">
          <UsageActivityChart points={trend} />
        </Panel>
        <details className="group rounded-xl border border-border bg-card p-4 shadow-card">
          <summary className="flex cursor-pointer list-none items-start justify-between gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span>
              <span className="flex items-center gap-2 text-[0.9375rem] font-semibold text-foreground">
                <ShieldCheck className="h-4 w-4 text-brand-600" aria-hidden />
                Usage integrity
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                Effective totals and all-time invariant checks
              </span>
            </span>
            <StatusBadge tone={isHealthy ? "success" : "danger"} dot>
              {isHealthy ? "Healthy" : "Attention required"}
            </StatusBadge>
          </summary>
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <PanelInset className="p-2.5">
                <p className="text-[0.625rem] uppercase tracking-wider text-muted-foreground">Effective</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{integrityCounts.effective}</p>
              </PanelInset>
              <PanelInset className="p-2.5">
                <p className="text-[0.625rem] uppercase tracking-wider text-muted-foreground">Invalidated</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{integrityCounts.invalidated}</p>
              </PanelInset>
              <PanelInset className="p-2.5">
                <p className="text-[0.625rem] uppercase tracking-wider text-muted-foreground">Raw</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{integrityCounts.raw}</p>
              </PanelInset>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Invalidated events remain preserved in the immutable audit history and are excluded from operational usage totals.
            </p>
            <dl className="space-y-2 border-t border-border pt-3 text-xs">
              {[
                ["Uncorrected invalid usage events", integrity.uncorrectedInvalidUsageEvents],
                ["Orphan episode observations", integrity.episodeObservationsWithMissingEpisode],
                ["Duplicate FIRST_TRIAGE groups", integrity.duplicateFirstTriageGroups],
              ].map(([label, value]) => (
                <div key={String(label)} className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd><StatusBadge tone={value === 0 ? "success" : "danger"}>{value}</StatusBadge></dd>
                </div>
              ))}
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Historical missing-episode events</dt>
                <dd><StatusBadge tone="neutral">{integrity.usageEventsWithMissingEpisode}</StatusBadge></dd>
              </div>
            </dl>
            {integrityCounts.invalidated > 0 && (
              <Link className={smallLink} href={href(params, { audit: "invalidated", auditPage: null })}>
                Review historical correction evidence
              </Link>
            )}
          </div>
        </details>
      </div>

      <Panel
        title="Effective operational activity"
        description={`${activity.total.toLocaleString()} matching event${activity.total === 1 ? "" : "s"}. Corrected events never appear in this table.`}
        padded={false}
      >
        {activity.rows.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="No effective activity matched"
            description="No correction-aware operational events were recorded for this date range and filter set."
            action={{ label: "Clear filters", href: "/admin/usage", variant: "outline" }}
          />
        ) : (
          <DataTable
            columns={activityColumns(params)}
            rows={activity.rows}
            rowKey={(row) => row.id}
            caption="Effective operational usage activity"
          />
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
          <p className="text-xs text-muted-foreground">Page {activity.page} of {activity.totalPages}</p>
          <div className="flex gap-2">
            {activity.page > 1 && <Link className={linkButton} href={href(params, { page: String(activity.page - 1), history: null })}>Previous</Link>}
            {activity.page < activity.totalPages && <Link className={linkButton} href={href(params, { page: String(activity.page + 1), history: null })}>Next</Link>}
          </div>
        </div>
      </Panel>

      {invalidatedAudit && (
        <Panel
          title="Historical correction evidence"
          description="These immutable raw events have terminal corrections and do not contribute to effective totals."
          action={<Link className={smallLink} href={href(params, { audit: null, auditPage: null })}>Close</Link>}
          padded={false}
        >
          {invalidatedAudit.rows.length === 0 ? (
            <p className="px-4 pb-4 text-sm text-muted-foreground">No invalidated events matched this filter set.</p>
          ) : (
            <div className="divide-y divide-border">
              {invalidatedAudit.rows.map((row) => (
                <div key={row.id} className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[180px_1fr_1fr]">
                  <time className="text-xs text-muted-foreground">{formatAppDateTime(row.occurredAt)}</time>
                  <div>
                    <p className="font-medium text-foreground">{row.eventLabel}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{row.source}</p>
                  </div>
                  <div>
                    <StatusBadge tone="danger">Historically invalidated</StatusBadge>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {row.reasonDetail ?? row.reasonCode.replaceAll("_", " ").toLowerCase()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
            <span>Page {invalidatedAudit.page} of {invalidatedAudit.totalPages}</span>
            <div className="flex gap-2">
              {invalidatedAudit.page > 1 && <Link className={linkButton} href={href(params, { auditPage: String(invalidatedAudit.page - 1) })}>Previous</Link>}
              {invalidatedAudit.page < invalidatedAudit.totalPages && <Link className={linkButton} href={href(params, { auditPage: String(invalidatedAudit.page + 1) })}>Next</Link>}
            </div>
          </div>
        </Panel>
      )}

      <PanelInset className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-600" aria-hidden />
        <div>
          <p className="text-sm font-medium text-foreground">Commercial metering</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            Usage is recorded as immutable operational events. Contract pricing and billing policy are applied separately.
          </p>
        </div>
      </PanelInset>

      <EpisodeHistoryDrawer history={history} />
    </PageShell>
  );
}
