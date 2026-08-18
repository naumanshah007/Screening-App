import Link from "next/link";
import {
  ArrowRight,
  ClipboardCheck,
  Clock,
  Database,
  FileCheck2,
  FileSearch,
  Inbox,
  ShieldAlert,
  Stethoscope,
  UploadCloud,
} from "lucide-react";

import { auth } from "@/lib/auth";
import { isAuthorizedForRoute, isVisibleInDemoFlow } from "@/lib/auth/permissions";
import { isFeatureEnabled } from "@/lib/features";
import { Badge, PriorityBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, StatCard } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  getCommandCentreMetrics,
  startOfCurrentWeek,
  type DecisionSplit,
} from "@/lib/decisions/dashboard-metrics";
import { SOURCE_LABELS } from "@/lib/decisions/completed-decisions";
import {
  formatDisposition,
  isUrgentClinicalPriority,
} from "@/lib/decisions/package-generator";
import { formatDateTime } from "@/lib/utils";

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
      return "Executive overview for the buyer demo: intake volume, pending review, decisions, simulated exports, and audit evidence.";
    default:
      return "Operational overview for the CerviGrade batch demo.";
  }
}

function formatDuration(minutes: number | null) {
  if (minutes == null) return "—";
  if (minutes < 60) return `${minutes}m`;
  const hours = minutes / 60;
  return `${hours.toFixed(hours >= 10 ? 0 : 1)}h`;
}

function splitPercent(value: number, split: DecisionSplit) {
  if (split.total === 0) return 0;
  return Math.round((value / split.total) * 100);
}

function formatDateParam(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function sourceLabel(source: string, sourceSystem?: string | null) {
  return sourceSystem ?? SOURCE_LABELS[source] ?? source;
}

function commandCentreActions(role?: string) {
  return [
    { label: "Pull Cases", href: "/batch", variant: "primary" as const, icon: <UploadCloud className="h-4 w-4" /> },
    { label: "Open Review Queue", href: "/review", variant: "outline" as const, icon: <Inbox className="h-4 w-4" /> },
    { label: "View Completed Decisions", href: "/decisions", variant: "outline" as const, icon: <FileCheck2 className="h-4 w-4" /> },
    { label: "View Audit Trail", href: "/audit", variant: "outline" as const, icon: <FileSearch className="h-4 w-4" /> },
  ].filter((action) => isVisibleInDemoFlow(action.href, role));
}

function MiniBar({
  label,
  value,
  percent,
  tone,
}: {
  label: string;
  value: number;
  percent: number;
  tone: "success" | "danger" | "info";
}) {
  const color = {
    success: "bg-emerald-500",
    danger: "bg-red-500",
    info: "bg-sky-500",
  }[tone];

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-foreground">{value.toLocaleString()}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className={color} style={{ width: `${percent}%`, height: "100%" }} />
      </div>
    </div>
  );
}

function FunnelStep({
  label,
  value,
  icon,
  href,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  href?: string;
}) {
  const content = (
    <div className="rounded-lg border border-border bg-muted/25 px-4 py-3 transition-colors hover:border-brand-300/60 hover:bg-muted/40">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold text-foreground tabular-nums">
        {value.toLocaleString()}
      </div>
    </div>
  );

  if (!href) return content;

  return (
    <Link
      href={href}
      className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
      aria-label={`View ${label}`}
    >
      {content}
    </Link>
  );
}

export default async function DashboardPage() {
  const session = await auth();
  const user = session?.user as { id?: string; name?: string; role?: string } | undefined;
  const showBatchDemo = isFeatureEnabled("batchDemo");

  if (!showBatchDemo) {
    return (
      <div className="page-aura p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="mb-1.5 flex items-center gap-2">
              <span className="eyebrow-rule" aria-hidden />
              <span className="text-label text-accent-color">Command Centre</span>
            </div>
            <h1 className="text-h2 text-foreground tracking-tight">CerviGrade Command Centre</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Batch demo reporting is disabled in this environment.
            </p>
          </div>
        </div>
        <EmptyState
          icon={Database}
          title="Batch demo is not enabled"
          description="Enable the batch demo flag to show intake volume, review queue status, completed decisions, simulated export packages, and audit evidence."
        />
      </div>
    );
  }

  const metrics = await getCommandCentreMetrics(user ?? {});
  const actions = commandCentreActions(user?.role);
  const canPullCases = isAuthorizedForRoute("/batch", user?.role);
  const canOpenReview = isAuthorizedForRoute("/review", user?.role);
  const canOpenBatchRuns = isAuthorizedForRoute("/batch/runs", user?.role);
  const canOpenDecisions = isAuthorizedForRoute("/decisions", user?.role);
  const canOpenAudit = isAuthorizedForRoute("/audit", user?.role);
  const split = metrics.decisionSplit;
  const todayParam = formatDateParam(new Date());
  const weekParam = formatDateParam(startOfCurrentWeek(new Date()));
  const hasAnyBatchActivity =
    metrics.casesPulledThisWeek > 0 ||
    metrics.pendingReview > 0 ||
    metrics.completedThisWeek > 0;

  return (
    <div className="page-aura p-6 lg:p-8 space-y-6 max-w-[1500px] mx-auto">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-1.5 flex items-center gap-2">
            <span className="eyebrow-rule" aria-hidden />
            <span className="text-label text-accent-color">Command Centre</span>
          </div>
          <h1 className="text-h2 text-foreground tracking-tight">
            CerviGrade closed-loop demo
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground leading-relaxed">
            {roleNarrative(user?.role)}
          </p>
        </div>
        {actions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {actions.map((action) => (
              <Link key={action.href} href={action.href}>
                <Button size="sm" variant={action.variant} icon={action.icon}>
                  {action.label}
                </Button>
              </Link>
            ))}
          </div>
        )}
      </div>

      {!metrics.policy.canViewOperationalMetrics && (
        <EmptyState
          icon={Database}
          title="Limited demo view"
          description="This role does not show organisation-wide intake, review, decision, or simulated export metrics in the demo environment."
          nextStep="Use an admin, coordinator, reviewer, or integration admin account to present the buyer demo flow."
        />
      )}

      {metrics.policy.canViewOperationalMetrics && !hasAnyBatchActivity && (
        <EmptyState
          icon={ClipboardCheck}
          title="No closed-loop activity yet"
          description="Pull simulated cases, add them to the Review Queue, then record reviewer decisions to populate the Command Centre."
          action={
            canPullCases
              ? { label: "Pull cases", href: "/batch", variant: "primary" }
              : undefined
          }
        />
      )}

      {metrics.policy.canViewOperationalMetrics && (
        <>
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          label="Pending review"
          value={metrics.pendingReview.toLocaleString()}
          subtext={metrics.policy.queueLabel}
          variant={metrics.pendingReview > 0 ? "info" : "success"}
          icon={<Inbox className="h-5 w-5" />}
          href={canOpenReview ? "/review?filter=pending" : undefined}
        />
        <StatCard
          label="Mandatory clinician review"
          value={metrics.mandatoryClinicianReview.toLocaleString()}
          subtext={`${metrics.policy.queueLabel} · safety-stop or evidence gap`}
          variant={metrics.mandatoryClinicianReview > 0 ? "warning" : "success"}
          icon={<ShieldAlert className="h-5 w-5" />}
          href={canOpenReview ? "/review?filter=review" : undefined}
        />
        <StatCard
          label="Urgent clinical priority"
          value={metrics.urgentClinicalPriority.toLocaleString()}
          subtext={`${metrics.policy.queueLabel} · urgent risk or P1 priority`}
          variant={metrics.urgentClinicalPriority > 0 ? "urgent" : "success"}
          icon={<Stethoscope className="h-5 w-5" />}
          href={canOpenReview ? "/review?filter=urgent" : undefined}
        />
        <StatCard
          label="Avg intake to decision"
          value={formatDuration(metrics.averageIntakeToDecisionMinutes)}
          subtext={metrics.policy.completedLabel}
          variant="default"
          icon={<Clock className="h-5 w-5" />}
          href={canOpenDecisions ? "/decisions" : undefined}
        />
        <StatCard
          label="Cases pulled today"
          value={metrics.casesPulledToday.toLocaleString()}
          subtext={metrics.policy.intakeLabel}
          variant="default"
          icon={<Database className="h-5 w-5" />}
          href={canOpenBatchRuns ? "/batch/runs" : undefined}
        />
        <StatCard
          label="Cases pulled this week"
          value={metrics.casesPulledThisWeek.toLocaleString()}
          subtext={`${metrics.policy.intakeLabel} · Monday to today`}
          variant="default"
          icon={<Database className="h-5 w-5" />}
          href={canOpenBatchRuns ? "/batch/runs" : undefined}
        />
        <StatCard
          label="Completed today"
          value={metrics.completedToday.toLocaleString()}
          subtext={metrics.policy.completedLabel}
          variant="success"
          icon={<FileCheck2 className="h-5 w-5" />}
          href={canOpenDecisions ? `/decisions?dateFrom=${todayParam}&dateTo=${todayParam}` : undefined}
        />
        <StatCard
          label="Completed this week"
          value={metrics.completedThisWeek.toLocaleString()}
          subtext={`${metrics.policy.packageLabel}: ${metrics.packagePreviewedOrExportedThisWeek}`}
          variant="success"
          icon={<FileCheck2 className="h-5 w-5" />}
          href={canOpenDecisions ? `/decisions?dateFrom=${weekParam}&dateTo=${todayParam}` : undefined}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Decision Funnel</CardTitle>
            <Badge variant="info">{metrics.policy.intakeLabel}</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-4">
              <FunnelStep
                label="Pulled this week"
                value={metrics.casesPulledThisWeek}
                icon={<Database className="h-3.5 w-3.5" />}
                href={canOpenBatchRuns ? "/batch/runs" : undefined}
              />
              <FunnelStep
                label="Pending"
                value={metrics.pendingReview}
                icon={<Inbox className="h-3.5 w-3.5" />}
                href={canOpenReview ? "/review?filter=pending" : undefined}
              />
              <FunnelStep
                label="Completed this week"
                value={metrics.completedThisWeek}
                icon={<FileCheck2 className="h-3.5 w-3.5" />}
                href={canOpenDecisions ? `/decisions?dateFrom=${weekParam}&dateTo=${todayParam}` : undefined}
              />
              <FunnelStep
                label="Packages previewed/exported"
                value={metrics.packagePreviewedOrExportedThisWeek}
                icon={<FileSearch className="h-3.5 w-3.5" />}
                href={canOpenAudit ? "/audit?days=7" : undefined}
              />
            </div>
            <div className="rounded-lg border border-border bg-muted/25 px-4 py-3 text-sm text-muted-foreground">
              Pull Cases → Review Queue → reviewer decision → Completed Decisions → simulated export package → audit evidence.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Decision Split</CardTitle>
            <Badge variant="default">{metrics.policy.completedLabel}</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <MiniBar
              label="Accepted"
              value={split.accepted}
              percent={splitPercent(split.accepted, split)}
              tone="success"
            />
            <MiniBar
              label="Rejected"
              value={split.rejected}
              percent={splitPercent(split.rejected, split)}
              tone="danger"
            />
            <MiniBar
              label="Needs information"
              value={split.needsInfo}
              percent={splitPercent(split.needsInfo, split)}
              tone="info"
            />
          </CardContent>
        </Card>
      </div>

      {metrics.policy.canViewOperationalMetrics && (
        <Card>
          <CardHeader>
            <CardTitle>Booking Priority Mix</CardTitle>
            <Badge variant="info">
              {metrics.activeRuleVersion ? `Rules v${metrics.activeRuleVersion}` : "No active rules"}
            </Badge>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Pending queue graded by the active, admin-editable rule release. Edit and activate a
              new version, then re-grade an intake to see this shift.
            </p>
            {metrics.bookingPriorityMix.length === 0 ? (
              <p className="text-sm text-muted-foreground">No graded pending cases yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {metrics.bookingPriorityMix.map((b) => {
                  const content = (
                    <>
                      <PriorityBadge priority={b.priority} />
                      <span className="text-lg font-bold text-foreground tabular-nums">{b.count}</span>
                    </>
                  );
                  const className = "inline-flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2";

                  return canOpenReview ? (
                    <Link
                      key={b.priority}
                      href={`/review?priority=${encodeURIComponent(b.priority)}`}
                      className={className}
                    >
                      {content}
                    </Link>
                  ) : (
                    <div key={b.priority} className={className}>
                      {content}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Source Connector Status</CardTitle>
            <Badge variant="info">Demo-safe</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              {
                title: "Demo source connector",
                status: "Demo connector ready",
                detail: "Simulated source with integration-ready synthetic payloads.",
                badge: "low" as const,
              },
              {
                title: "CSV / Excel / JSON",
                status: "File upload available",
                detail: "Persisted intake sessions and review queue creation are active.",
                badge: "info" as const,
              },
              {
                title: "HL7 / FHIR / ERMS",
                status: "Adapter pattern defined · not connected",
                detail: "Previews are generated as simulated export packages for the demo environment.",
                badge: "default" as const,
              },
            ].map((connector) => (
              <div key={connector.title} className="rounded-lg border border-border px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-foreground">{connector.title}</p>
                  <Badge variant={connector.badge}>{connector.status}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{connector.detail}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Intake Sessions</CardTitle>
            {isAuthorizedForRoute("/batch/runs", user?.role) && (
              <Link href="/batch/runs" className="text-xs text-brand-600 dark:text-brand-400 hover:underline">
                View all
              </Link>
            )}
          </CardHeader>
          <CardContent>
            {metrics.recentIntakeSessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No intake sessions yet.</p>
            ) : (
              <div className="space-y-3">
                {metrics.recentIntakeSessions.map((run) => (
                  <Link key={run.id} href={`/batch/runs/${run.id}`} className="block rounded-lg border border-border px-4 py-3 hover:bg-muted/35">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-foreground">
                        {sourceLabel(run.source, run.sourceSystem)}
                      </p>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {run.totalCases} cases · {run.pendingCount} pending · saved {formatDateTime(run.createdAt)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {run.acceptedCount} accepted · {run.rejectedCount} rejected · {run.needsInfoCount} needs information
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Completed Decisions</CardTitle>
            {isAuthorizedForRoute("/decisions", user?.role) && (
              <Link href="/decisions" className="text-xs text-brand-600 dark:text-brand-400 hover:underline">
                View completed
              </Link>
            )}
          </CardHeader>
          <CardContent>
            {metrics.recentCompletedDecisions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No completed decisions yet.</p>
            ) : (
              <div className="space-y-3">
                {metrics.recentCompletedDecisions.map((item) => {
                  const urgent = isUrgentClinicalPriority(item);
                  return (
                    <Link
                      key={item.id}
                      href="/decisions"
                      className="block rounded-lg border border-border px-4 py-3 hover:bg-muted/35"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {item.patientName ?? item.nhi ?? item.externalPatientId ?? `Case ${item.rowNumber}`}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {item.reviewedBy?.name ?? item.reviewedBy?.email ?? "Reviewer"} · {formatDateTime(item.reviewedAt)}
                          </p>
                        </div>
                        <Badge
                          variant={
                            item.disposition === "ACCEPTED"
                              ? "low"
                              : item.disposition === "REJECTED"
                                ? "urgent"
                                : "info"
                          }
                        >
                          {formatDisposition(item.disposition)}
                        </Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {item.reviewRequired && <Badge variant="high">Mandatory clinician review</Badge>}
                        {urgent && <Badge variant="urgent">Urgent clinical priority</Badge>}
                        <Badge variant="info">Simulated package ready</Badge>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
        </>
      )}
    </div>
  );
}
