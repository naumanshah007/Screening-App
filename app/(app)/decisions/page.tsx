import { redirect, notFound } from "next/navigation";
import { ClipboardCheck, Inbox } from "lucide-react";

import { PageIntro } from "@/components/layout/PageIntro";
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

  return (
    <div className="page-aura p-6 lg:p-8 space-y-6 max-w-[1500px] mx-auto">
      <PageIntro
        eyebrow="Closed Loop"
        title="Completed Decisions"
        description="Reviewer-confirmed decisions with simulated export package previews and integration-ready export packages. These packages are demo-safe and do not update any hospital system."
        actions={actions}
      />

      {rows.length === 0 && Object.values(filters).every((value) => !value) ? (
        <EmptyState
          icon={ClipboardCheck}
          title="No completed decisions yet"
          description="When a reviewer accepts, rejects, or marks a queued case as needing information, the completed decision appears here with a simulated export package."
          action={{ label: "Open Review Queue", href: "/review", variant: "primary" }}
        />
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
        <Inbox className="h-3.5 w-3.5" />
        Coordinators can inspect package status and previews, but clinical decisions remain reviewer-confirmed.
      </p>
    </div>
  );
}
