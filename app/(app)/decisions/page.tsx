import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ClipboardCheck, Inbox, CheckCircle2, XCircle, HelpCircle } from "lucide-react";

import { PageShell, PageHeader, Panel, MetricTile, MetricGrid } from "@/components/system";
import { EmptyState } from "@/components/ui/empty-state";
import {
  CompletedDecisionsClient,
  type CompletedDecisionFilters,
  type CompletedDecisionRow,
} from "@/components/decisions/CompletedDecisionsClient";
import { auth } from "@/lib/auth";
import { isAuthorizedForRoute } from "@/lib/auth/permissions";
import { isFeatureEnabled } from "@/lib/features";
import {
  canViewCompletedDecisions,
  getCompletedDecisionAccess,
  getCompletedDecisionFilterOptions,
  listCompletedDecisions,
  SOURCE_LABELS,
} from "@/lib/decisions/completed-decisions";
import { formatDateTime } from "@/lib/utils";
import {
  formatDisposition,
  isUrgentClinicalPriority,
} from "@/lib/decisions/package-generator";

export const dynamic = "force-dynamic";

const COMPLETED_DECISIONS_LIMIT = 300;

type DecisionsSearchParams = Promise<{
  disposition?: string;
  source?: string;
  reviewerId?: string;
  urgency?: string;
  dateFrom?: string;
  dateTo?: string;
  q?: string;
}>;

function cleanFilters(params: Awaited<DecisionsSearchParams>): CompletedDecisionFilters {
  return {
    disposition: params.disposition || undefined,
    source: params.source || undefined,
    reviewerId: params.reviewerId || undefined,
    urgency: params.urgency || undefined,
    dateFrom: params.dateFrom || undefined,
    dateTo: params.dateTo || undefined,
    q: params.q?.trim().slice(0, 80) || undefined,
  };
}

function mapRow(item: Awaited<ReturnType<typeof listCompletedDecisions>>[number]): CompletedDecisionRow {
  const sourceSystem =
    item.batchRun.sourceSystem ?? SOURCE_LABELS[item.batchRun.source] ?? item.batchRun.source;

  return {
    id: item.id,
    patientName: item.patientName ?? item.nhi ?? item.externalPatientId ?? `Case ${item.rowNumber}`,
    nhi: item.nhi ?? item.externalPatientId ?? "Source ID unavailable",
    patientAge: item.patientAge,
    gpPractice: item.gpPractice ?? "GP/referrer not recorded",
    sourceSystem,
    source: item.batchRun.source,
    intakeSessionId: item.batchRunId,
    originalRecommendation: item.recommendation,
    recommendationCode: item.recommendationCode,
    disposition: item.disposition as CompletedDecisionRow["disposition"],
    finalDecision: formatDisposition(item.disposition),
    reviewer: item.reviewedBy?.name ?? item.reviewedBy?.email ?? "Reviewer",
    reviewedAt: formatDateTime(item.reviewedAt),
    reason: item.overrideReason ?? item.reviewNote ?? "No reason or note recorded.",
    packageStatus: "Simulated package ready",
    referralPriority: item.referralPriority,
    riskLevel: item.riskLevel,
    mandatoryReview: item.reviewRequired,
    urgentClinicalPriority: isUrgentClinicalPriority(item),
  };
}

export default async function CompletedDecisionsPage({
  searchParams,
}: {
  searchParams: DecisionsSearchParams;
}) {
  if (!isFeatureEnabled("batchDemo")) {
    notFound();
  }

  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!canViewCompletedDecisions(user ?? {})) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const filters = cleanFilters(params);
  const access = getCompletedDecisionAccess(user ?? {});
  const actions = [
    { label: "Open Review Queue", href: "/review", variant: "outline" as const },
    { label: "Pull Cases", href: "/batch", variant: "outline" as const },
  ].filter((action) => isAuthorizedForRoute(action.href, user?.role));
  const [decisions, filterOptions] = await Promise.all([
    listCompletedDecisions({ user: user ?? {}, filters, limit: COMPLETED_DECISIONS_LIMIT }),
    getCompletedDecisionFilterOptions(user ?? {}),
  ]);
  const rows = decisions.map(mapRow);

  // Counts of the rows actually returned for the current filters. Stated as
  // "in this result set" so a filtered view is never read as an all-time total.
  const accepted = rows.filter((row) => row.disposition === "ACCEPTED").length;
  const rejected = rows.filter((row) => row.disposition === "REJECTED").length;
  const needsInfo = rows.filter((row) => row.disposition === "NEEDS_INFO").length;
  const hasFilters = Object.values(filters).some(Boolean);
  const scopeCaption = hasFilters ? "In this filtered result set" : "In this result set";

  return (
    <PageShell width="wide">
      <PageHeader
        eyebrow="Closed Loop"
        title="Completed Decisions"
        description="Reviewer-confirmed decisions with simulated export package previews and integration-ready export packages. These packages are demo-safe and do not update any hospital system."
        actions={actions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {action.label}
          </Link>
        ))}
      />

      {rows.length > 0 && (
        <MetricGrid columns={4}>
          <MetricTile
            label="Completed decisions"
            value={rows.length}
            caption={scopeCaption}
            icon={<ClipboardCheck className="h-4.5 w-4.5" />}
            tone="brand"
          />
          <MetricTile
            label="Accepted"
            value={accepted}
            caption="Reviewer confirmed the recommendation"
            icon={<CheckCircle2 className="h-4.5 w-4.5" />}
            tone="success"
          />
          <MetricTile
            label="Rejected"
            value={rejected}
            caption="Reviewer overrode the recommendation"
            icon={<XCircle className="h-4.5 w-4.5" />}
            tone="danger"
          />
          <MetricTile
            label="Needs information"
            value={needsInfo}
            caption="Returned for further detail"
            icon={<HelpCircle className="h-4.5 w-4.5" />}
            tone="warn"
          />
        </MetricGrid>
      )}

      {rows.length === 0 && !hasFilters ? (
        <Panel>
          <EmptyState
            icon={ClipboardCheck}
            title="No completed decisions yet"
            description="When a reviewer accepts, rejects, or marks a queued case as needing information, the completed decision appears here with a simulated export package."
            action={{ label: "Open Review Queue", href: "/review", variant: "primary" }}
          />
        </Panel>
      ) : (
        <CompletedDecisionsClient
          rows={rows}
          filters={filters}
          sources={filterOptions.sources}
          reviewers={filterOptions.reviewers}
          canFilterReviewer={access === "all"}
          resultLimit={COMPLETED_DECISIONS_LIMIT}
          isLimited={decisions.length >= COMPLETED_DECISIONS_LIMIT}
        />
      )}

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Inbox className="h-3.5 w-3.5" aria-hidden />
        Coordinators can inspect package status and previews, but clinical decisions remain reviewer-confirmed.
      </p>
    </PageShell>
  );
}
