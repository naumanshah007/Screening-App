import Link from "next/link";
import {
  Inbox,
  ShieldAlert,
  Siren,
  Database,
  FileCheck2,
  Clock,
  UploadCloud,
  FileSearch,
} from "lucide-react";

import { auth } from "@/lib/auth";
import { isVisibleInDemoFlow } from "@/lib/auth/permissions";
import { isFeatureEnabled } from "@/lib/features";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";
import { getCommandCentreMetrics } from "@/lib/decisions/dashboard-metrics";
import { getDashboardInsights } from "@/lib/decisions/dashboard-insights";
import { getClinicalAuthorityDisplay } from "@/lib/clinical-rules/authority-display";

import {
  PageShell,
  PageHeader,
  Panel,
  MetricTile,
  MetricGrid,
  RangeControl,
} from "@/components/system";

import { WorkflowFunnel } from "@/components/dashboard/WorkflowFunnel";
import { QueueTrendChart } from "@/components/dashboard/QueueTrendChart";
import { DecisionSplitChart } from "@/components/dashboard/DecisionSplitChart";
import { PriorityHeatmap } from "@/components/dashboard/PriorityHeatmap";
import { ConnectorStatusCard } from "@/components/dashboard/ConnectorStatusCard";
import { RecentSessionsTable } from "@/components/dashboard/RecentSessionsTable";
import { RecentDecisionsTable } from "@/components/dashboard/RecentDecisionsTable";
import { RulesetStatusPanel } from "@/components/dashboard/RulesetStatusPanel";

export const dynamic = "force-dynamic";

function roleNarrative(role?: string) {
  switch (role) {
    case "COORDINATOR":
      return "Intake status, cases added to the queue, and current pending review volume.";
    case "SMO_REVIEWER":
    case "COLPOSCOPIST":
    case "COLPO_CNS":
    case "GYNAE_GRADER":
      return "Urgent review workload, mandatory clinician review, and your recent reviewer-confirmed decisions.";
    case "INTEGRATION_ADMIN":
      return "Connector readiness, simulated export evidence, and package preview/export audit trail.";
    case "ADMIN":
      return "Executive overview of intake, triage, review, governance and audit visibility.";
    default:
      return "Operational overview for the CerviGrade batch demo.";
  }
}

function formatDuration(minutes: number | null) {
  if (minutes == null) return "—";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

function PanelLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-300"
    >
      {children}
    </Link>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const session = await auth();
  const user = session?.user as
    | { id?: string; role?: string; name?: string; email?: string }
    | undefined;

  const params = await searchParams;
  const parsedDays = Number.parseInt(params.days ?? "", 10);
  const days = [7, 14, 30].includes(parsedDays) ? parsedDays : 7;

  const showBatch = isFeatureEnabled("batchDemo");

  const [metrics, insights, authority] = await Promise.all([
    getCommandCentreMetrics({ id: user?.id, role: user?.role }),
    getDashboardInsights({ id: user?.id, role: user?.role }, { trendDays: days }),
    getClinicalAuthorityDisplay(),
  ]);

  const { policy } = metrics;
  const scopeLabel = policy.completedScope === "own" ? "Your decisions" : "Organisation";

  const quickActions = [
    { label: "Pull Cases", href: "/batch", icon: <UploadCloud className="h-4 w-4" /> },
    { label: "Open Review Queue", href: "/review", icon: <Inbox className="h-4 w-4" /> },
    { label: "Completed Decisions", href: "/decisions", icon: <FileCheck2 className="h-4 w-4" /> },
    { label: "Audit Trail", href: "/audit", icon: <FileSearch className="h-4 w-4" /> },
  ].filter((action) => isVisibleInDemoFlow(action.href, user?.role));

  // Sparkline series exist only where a genuine daily history is stored.
  const trend = insights.queueTrend;
  const hasSeries = trend.length >= 2;

  const header = (
    <PageHeader
      eyebrow="Command Centre"
      title="Clinical Command Centre"
      description={roleNarrative(user?.role)}
      actions={<RangeControl activeDays={days} ranges={[7, 14, 30]} label="Dashboard date range" />}
      filters={
        quickActions.length > 0 ? (
          <>
            {quickActions.map((action, index) => (
              <Link
                key={action.href}
                href={action.href}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  index === 0
                    ? "bg-brand-600 text-white shadow-sm hover:bg-brand-700"
                    : "border border-border bg-card text-foreground hover:bg-muted"
                )}
              >
                {action.icon}
                {action.label}
              </Link>
            ))}
          </>
        ) : undefined
      }
    />
  );

  if (!policy.canViewOperationalMetrics) {
    return (
      <PageShell width="wide">
        {header}
        <EmptyState
          icon={ShieldAlert}
          title="Operational metrics are not available for your role"
          description="Your role does not include organisation-wide intake and review metrics."
        />
      </PageShell>
    );
  }

  return (
    <PageShell width="wide">
      {header}

      {/* ── KPI row ───────────────────────────────────────────────────────── */}
      <MetricGrid columns={6}>
        <MetricTile
          label="Pending review"
          value={metrics.pendingReview}
          caption={`${scopeLabel} · awaiting clinician`}
          icon={<Inbox className="h-4.5 w-4.5" />}
          tone="brand"
          href={showBatch ? "/review" : undefined}
          series={hasSeries ? trend.map((point) => point.totalInQueue) : undefined}
          ariaSparklineLabel={`Pending review over the last ${days} days`}
        />
        <MetricTile
          label="Clinician review required"
          value={metrics.mandatoryClinicianReview}
          caption="Safety stop or evidence gap"
          icon={<ShieldAlert className="h-4.5 w-4.5" />}
          tone="warn"
          href={showBatch ? "/review" : undefined}
          series={hasSeries ? trend.map((point) => point.clinicianReviewRequired) : undefined}
          ariaSparklineLabel={`Mandatory clinician review over the last ${days} days`}
        />
        <MetricTile
          label="Urgent clinical priority"
          value={metrics.urgentClinicalPriority}
          caption="Urgent risk or P1 priority"
          icon={<Siren className="h-4.5 w-4.5" />}
          tone="danger"
          href={showBatch ? "/review" : undefined}
          series={hasSeries ? trend.map((point) => point.urgentPriority) : undefined}
          ariaSparklineLabel={`Urgent priority over the last ${days} days`}
        />
        <MetricTile
          label="Cases pulled today"
          value={metrics.casesPulledToday}
          caption="Organisation intake"
          icon={<Database className="h-4.5 w-4.5" />}
          tone="neutral"
          href={showBatch ? "/batch" : undefined}
        />
        <MetricTile
          label="Completed this week"
          value={metrics.completedThisWeek}
          caption={`${scopeLabel} · reviewer-confirmed`}
          icon={<FileCheck2 className="h-4.5 w-4.5" />}
          tone="neutral"
          href="/decisions"
        />
        <MetricTile
          label="Avg intake to decision"
          value={formatDuration(metrics.averageIntakeToDecisionMinutes)}
          caption="Completed decisions"
          icon={<Clock className="h-4.5 w-4.5" />}
          tone="neutral"
        />
      </MetricGrid>

      {/* ── Funnel + trend + split ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Panel
          title="Decision workflow funnel"
          description="Real counts for the current week"
          className="xl:col-span-4"
        >
          <WorkflowFunnel
            scopeLabel={scopeLabel}
            stages={[
              {
                label: "Pulled",
                value: metrics.casesPulledThisWeek,
                href: showBatch ? "/batch" : undefined,
              },
              {
                label: "Pending",
                value: metrics.pendingReview,
                href: showBatch ? "/review" : undefined,
              },
              { label: "Completed", value: metrics.completedThisWeek, href: "/decisions" },
              {
                label: "Exported",
                value: metrics.packagePreviewedOrExportedThisWeek,
                href: "/decisions",
              },
            ]}
          />
        </Panel>

        <Panel
          title="Review queue trend"
          description={`Daily intake still pending · last ${days} days`}
          className="xl:col-span-5"
        >
          <QueueTrendChart data={trend} />
        </Panel>

        <Panel title="Decision split" description={scopeLabel} className="xl:col-span-3">
          <DecisionSplitChart split={metrics.decisionSplit} />
        </Panel>
      </div>

      {/* ── Heatmap + connectors + tables ──────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-12">
        <Panel
          title="Priority distribution"
          description="Stored clinical risk level"
          className="xl:col-span-3"
        >
          <PriorityHeatmap distribution={insights.priorityDistribution} />
        </Panel>

        <Panel
          title="Intake source activity"
          description="Simulated sources only"
          className="xl:col-span-3"
        >
          <ConnectorStatusCard connectors={insights.connectors} />
        </Panel>

        <Panel
          title="Recent intake sessions"
          className="xl:col-span-3"
          action={showBatch ? <PanelLink href="/batch/runs">View all</PanelLink> : undefined}
        >
          <RecentSessionsTable sessions={metrics.recentIntakeSessions} />
        </Panel>

        <Panel
          title="Recent completed decisions"
          className="xl:col-span-3"
          action={<PanelLink href="/decisions">View all</PanelLink>}
        >
          <RecentDecisionsTable decisions={metrics.recentCompletedDecisions} />
        </Panel>
      </div>

      {/* ── Governance ────────────────────────────────────────────────────── */}
      <RulesetStatusPanel authority={authority} />
    </PageShell>
  );
}
