import Link from "next/link";
import { AlertTriangle, Clock, TrendingUp, Stethoscope, Brain, ShieldCheck } from "lucide-react";
import { auth } from "@/lib/auth";
import { PageIntro } from "@/components/layout/PageIntro";
import { StatCard, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, PriorityBadge, WorkflowBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { isFeatureEnabled } from "@/lib/features";
import { notFound } from "next/navigation";
import {
  getConcordanceSummary,
  getBacklogSummary,
  getPriorityBreakdown,
  getGradingThroughput,
  getWorkflowSummary,
} from "@/lib/cases/concordance";
import { prisma } from "@/lib/prisma";
import { getSecurityAnalyticsSummary } from "@/lib/security/analytics";
import {
  buildAuditSearchParams,
  resolveAuditFilters,
} from "@/lib/security/audit-investigations";
import { cn } from "@/lib/utils";
import { getWorkspaceContext } from "@/lib/workspace/context";
import { CreateSecurityIncidentButton } from "./CreateSecurityIncidentButton";
import { SecurityResponseActions } from "./SecurityResponseActions";

function ConcordanceBar({
  rate,
  hasData,
}: {
  rate: number;
  hasData: boolean;
}) {
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-muted-foreground">Concordance rate</span>
        <span className="text-sm font-bold text-foreground">{rate}%</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={cn(
            "h-2 rounded-full transition-all duration-500",
            rate >= 85
              ? "bg-gradient-to-r from-emerald-500 to-teal-400"
              : rate >= 70
                ? "bg-gradient-to-r from-amber-500 to-amber-400"
                : "bg-gradient-to-r from-rose-500 to-red-400"
          )}
          style={{ width: `${rate}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
        <span>{hasData ? "" : "No data yet"}</span>
        <span>Target ≥85%</span>
      </div>
    </div>
  );
}

function ThroughputChart({
  data,
  eyebrow,
}: {
  data: { week: string; count: number }[];
  eyebrow: string;
}) {
  if (data.length === 0) {
    return (
      <EmptyState
        icon={TrendingUp}
        eyebrow={eyebrow}
        title="No grading data yet"
        description="Graded cases will appear here week by week."
        nextStep="Save clinician decisions on live cases and the weekly throughput chart will start filling automatically."
        action={{ href: "/cases?workflow=PENDING_REVIEW", label: "Open pending cases" }}
      />
    );
  }
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="flex items-end gap-1.5 h-24">
      {data.map((d) => (
        <div key={d.week} className="group flex flex-col items-center flex-1 gap-1">
          <div
            className="w-full rounded-t-md bg-gradient-to-t from-brand-600 to-teal-400 min-h-[2px] shadow-sm transition-all duration-300 group-hover:from-brand-700 group-hover:to-teal-300"
            style={{ height: `${Math.round((d.count / max) * 88)}px` }}
            title={`${d.week}: ${d.count} graded`}
          />
          <span className="text-[9px] text-muted-foreground rotate-45 origin-left whitespace-nowrap">
            {d.week}
          </span>
        </div>
      ))}
    </div>
  );
}

function PriorityBreakdownTable({
  rows,
}: {
  rows: { priority: string; count: number }[];
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground py-2">No active cases.</p>;
  }
  const total = rows.reduce((s, r) => s + r.count, 0);
  return (
    <div className="space-y-2">
      {rows.map((r) => {
        const pct = Math.round((r.count / total) * 100);
        return (
          <div key={r.priority}>
            <div className="flex items-center justify-between mb-0.5">
              <PriorityBadge priority={r.priority as never} />
              <span className="text-xs font-semibold text-muted-foreground">
                {r.count} ({pct}%)
              </span>
            </div>
            <div className="h-1 bg-muted rounded-full overflow-hidden">
              <div
                className="h-1 bg-gradient-to-r from-brand-600 to-teal-400 rounded-full"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function WorkflowBreakdownPanel({
  title,
  totalTracked,
  workflows,
  smoOnly,
}: {
  title: string;
  totalTracked: number;
  workflows: {
    PENDING_REVIEW: number;
    BOOKABLE: number;
    VIRTUAL_CLINIC: number;
    RETURN_TO_GP: number;
    NEEDS_MORE_INFO: number;
  };
  smoOnly: number;
}) {
  const workflowRows = [
    ["PENDING_REVIEW", workflows.PENDING_REVIEW],
    ["BOOKABLE", workflows.BOOKABLE],
    ["VIRTUAL_CLINIC", workflows.VIRTUAL_CLINIC],
    ["NEEDS_MORE_INFO", workflows.NEEDS_MORE_INFO],
    ["RETURN_TO_GP", workflows.RETURN_TO_GP],
  ] as const;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-muted/40 border border-border px-3 py-3">
            <p className="text-2xl font-bold text-foreground">{totalTracked}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Tracked cases</p>
          </div>
          <div className="rounded-lg bg-info/10 border border-info/20 px-3 py-3">
            <p className="text-2xl font-bold text-info">{smoOnly}</p>
            <p className="text-xs text-muted-foreground mt-0.5">SMO only</p>
          </div>
        </div>

        <div className="space-y-2">
          {workflowRows.map(([workflow, count]) => (
            <div
              key={workflow}
              className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2"
            >
              <WorkflowBadge workflow={workflow} />
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">
                  {count}
                </span>
                {count > 0 && totalTracked > 0 && (
                  <Badge variant="default">
                    {Math.round((count / totalTracked) * 100)}%
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SecurityAlertPanel({
  alerts,
  canInvestigate,
  canManageIncidents,
}: {
  alerts: Array<{
    severity: "urgent" | "high" | "info";
    title: string;
    detail: string;
    auditHref?: string;
    actionLabel?: string;
  }>;
  canInvestigate: boolean;
  canManageIncidents: boolean;
}) {
  if (alerts.length === 0) {
    return (
      <div className="rounded-lg border border-success/30 bg-success/5 px-4 py-4 text-sm text-foreground">
        No security alerts are active right now.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {alerts.map((alert) => (
        <div
          key={`${alert.severity}-${alert.title}`}
          className={cn(
            "rounded-lg border px-4 py-4",
            alert.severity === "urgent"
              ? "border-destructive/30 bg-destructive/5 text-foreground"
              : alert.severity === "high"
                ? "border-warn/30 bg-warn/5 text-foreground"
                : "border-info/30 bg-info/5 text-foreground"
          )}
        >
          <div className="flex items-center gap-2">
            <Badge variant={alert.severity}>{alert.title}</Badge>
          </div>
          <p className="mt-2 text-sm">{alert.detail}</p>
          {canInvestigate && alert.auditHref && (
            <div className="mt-3">
              <Link
                href={alert.auditHref}
                className="text-xs font-medium text-current underline underline-offset-2"
              >
                {alert.actionLabel ?? "Open audit trail"}
              </Link>
            </div>
          )}
          {canManageIncidents && (
            <CreateSecurityIncidentButton
              title={alert.title}
              summary={alert.detail}
              severity={
                alert.severity === "urgent"
                  ? "URGENT"
                  : alert.severity === "high"
                    ? "HIGH"
                    : "INFO"
              }
              auditHref={alert.auditHref}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export default async function AnalyticsPage() {
  if (!isFeatureEnabled("casesV2")) {
    notFound();
  }

  const session = await auth();
  const user = session?.user as { role?: string } | undefined;
  const workspace = getWorkspaceContext(user?.role, true);
  const canManageUsers = user?.role === "ADMIN";
  const canInvestigateAudit =
    user?.role === "ADMIN" || user?.role === "INTEGRATION_ADMIN";
  const canManageIncidents = canInvestigateAudit;
  const [
    colpoConcordance,
    gynaeConcordance,
    colpoBacklog,
    gynaeBacklog,
    colpoPriorities,
    gynaePriorities,
    colpoThroughput,
    gynaeThroughput,
    colpoWorkflow,
    gynaeWorkflow,
    totalAiRecs,
    concordantAiRecs,
    securitySummary,
  ] = await Promise.all([
    getConcordanceSummary("COLPOSCOPY"),
    getConcordanceSummary("GYNAECOLOGY"),
    getBacklogSummary("COLPOSCOPY"),
    getBacklogSummary("GYNAECOLOGY"),
    getPriorityBreakdown("COLPOSCOPY"),
    getPriorityBreakdown("GYNAECOLOGY"),
    getGradingThroughput("COLPOSCOPY"),
    getGradingThroughput("GYNAECOLOGY"),
    getWorkflowSummary("COLPOSCOPY"),
    getWorkflowSummary("GYNAECOLOGY"),
    prisma.aIRecommendation.count(),
    prisma.aIRecommendation.count({ where: { concordantWithRule: true } }),
    user?.role === "ADMIN" || user?.role === "INTEGRATION_ADMIN"
      ? getSecurityAnalyticsSummary()
      : Promise.resolve(null),
  ]);

  const aiConcordancePct =
    totalAiRecs > 0 ? Math.round((concordantAiRecs / totalAiRecs) * 100) : null;
  const securityInvestigationFilters = resolveAuditFilters({
    preset: "recent-security",
    days: "7",
  });
  const securityReviewHref = `/audit?${buildAuditSearchParams(
    securityInvestigationFilters,
    {
      preset: "recent-security",
      page: 1,
    }
  ).toString()}`;
  const securityExportHref = `/api/audit/export?${buildAuditSearchParams(
    securityInvestigationFilters,
    {
      preset: "recent-security",
      page: 1,
      format: "json",
    }
  ).toString()}`;

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="page-aura">
        <PageIntro
          eyebrow={workspace.label}
          title="Analytics"
          description="Grading throughput, concordance, and backlog across the enterprise workflow."
          actions={[
            { href: "/cases", label: "Open cases" },
            { href: "/rules", label: "Review rules" },
          ]}
        />
      </div>

      {/* ─── KPI strip ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
        <StatCard
          label="Total Active Cases"
          value={(colpoBacklog.active + gynaeBacklog.active).toLocaleString()}
          subtext={`${colpoBacklog.active} colpo · ${gynaeBacklog.active} gynae`}
          icon={<Stethoscope className="h-5 w-5" />}
        />
        <StatCard
          label="Overdue SLA"
          value={(colpoBacklog.overdue + gynaeBacklog.overdue).toLocaleString()}
          subtext="Past target due date"
          variant={colpoBacklog.overdue + gynaeBacklog.overdue > 0 ? "urgent" : "success"}
          icon={<AlertTriangle className="h-5 w-5" />}
        />
        <StatCard
          label="Awaiting Grading"
          value={(colpoBacklog.awaitingGrading + gynaeBacklog.awaitingGrading).toLocaleString()}
          subtext="Ready for summary or grading"
          variant={colpoBacklog.awaitingGrading + gynaeBacklog.awaitingGrading > 5 ? "warning" : "default"}
          icon={<Clock className="h-5 w-5" />}
        />
        <StatCard
          label="Needs More Info"
          value={(colpoBacklog.awaitingInfo + gynaeBacklog.awaitingInfo).toLocaleString()}
          subtext="Cases blocked on missing evidence"
          variant={colpoBacklog.awaitingInfo + gynaeBacklog.awaitingInfo > 0 ? "warning" : "default"}
          icon={<AlertTriangle className="h-5 w-5" />}
        />
        <StatCard
          label="AI Recommendations"
          value={totalAiRecs.toLocaleString()}
          subtext={
            aiConcordancePct !== null
              ? `${aiConcordancePct}% concordant with rules`
              : "No AI runs yet"
          }
          icon={<Brain className="h-5 w-5" />}
        />
      </div>

      {securitySummary && (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-6 gap-4">
            <StatCard
              label="Failed Sign-ins (24h)"
              value={securitySummary.counts.failedLogin24h.toLocaleString()}
              subtext="Unknown user, password, 2FA, and recovery failures"
              variant={securitySummary.counts.failedLogin24h >= 5 ? "urgent" : "default"}
              icon={<AlertTriangle className="h-5 w-5" />}
            />
            <StatCard
              label="Locked Accounts"
              value={securitySummary.counts.lockedAccountsNow.toLocaleString()}
              subtext={`${securitySummary.counts.lockedEvents7d} lock events in 7 days`}
              variant={securitySummary.counts.lockedAccountsNow > 0 ? "urgent" : "success"}
              icon={<Clock className="h-5 w-5" />}
            />
            <StatCard
              label="Invalid Recovery Codes"
              value={securitySummary.counts.invalidRecovery7d.toLocaleString()}
              subtext="Backup-code failures in the last 7 days"
              variant={securitySummary.counts.invalidRecovery7d > 0 ? "warning" : "default"}
              icon={<AlertTriangle className="h-5 w-5" />}
            />
            <StatCard
              label="Admin Credential Resets"
              value={(securitySummary.counts.passwordResets7d + securitySummary.counts.twoFactorResets7d).toLocaleString()}
              subtext={`${securitySummary.counts.passwordResets7d} password · ${securitySummary.counts.twoFactorResets7d} 2FA`}
              variant={
                securitySummary.counts.passwordResets7d +
                  securitySummary.counts.twoFactorResets7d >
                0
                  ? "warning"
                  : "default"
              }
              icon={<Brain className="h-5 w-5" />}
            />
            <StatCard
              label="Privileged Sign-ins (24h)"
              value={securitySummary.counts.privilegedSignIns24h.toLocaleString()}
              subtext={`${securitySummary.counts.privilegedWithout2FA} privileged account(s) still missing 2FA`}
              variant={securitySummary.counts.privilegedWithout2FA > 0 ? "urgent" : "default"}
              icon={<ShieldCheck className="h-5 w-5" />}
            />
            <StatCard
              label="Open Incidents"
              value={securitySummary.counts.openIncidents.toLocaleString()}
              subtext={`${securitySummary.counts.overdueIncidents} overdue · ${securitySummary.counts.unassignedIncidents} unassigned`}
              variant={securitySummary.counts.overdueIncidents > 0 ? "urgent" : securitySummary.counts.openIncidents > 0 ? "warning" : "success"}
              icon={<ShieldCheck className="h-5 w-5" />}
            />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Security Alerts</CardTitle>
              </CardHeader>
              <CardContent>
                {canInvestigateAudit && (
                  <div className="mb-4 flex flex-wrap gap-3 text-xs">
                    <Link
                      href={securityReviewHref}
                      className="font-medium text-brand-700 underline underline-offset-2"
                    >
                      Open saved investigation
                    </Link>
                    <a
                      href={securityExportHref}
                      className="font-medium text-muted-foreground underline underline-offset-2"
                    >
                      Export 7-day report
                    </a>
                  </div>
                )}
                <SecurityAlertPanel
                  alerts={securitySummary.alerts}
                  canInvestigate={canInvestigateAudit}
                  canManageIncidents={canManageIncidents}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Accounts Requiring Attention</CardTitle>
              </CardHeader>
              <CardContent>
                {securitySummary.atRiskUsers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No active lockouts, failed-attempt accumulation, or privileged 2FA gaps right now.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {securitySummary.atRiskUsers.map((account) => (
                      <div
                        key={account.id}
                        className="rounded-lg border border-border bg-card px-4 py-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              {account.name ?? account.email}
                            </p>
                            <p className="text-xs text-muted-foreground">{account.email}</p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="default">{account.role}</Badge>
                            {account.lockedUntil && account.lockedUntil > new Date() && (
                              <Badge variant="urgent">Locked</Badge>
                            )}
                            {account.failedAttempts > 0 && (
                              <Badge variant="high">
                                {account.failedAttempts} failed attempt{account.failedAttempts === 1 ? "" : "s"}
                              </Badge>
                            )}
                            {account.twoFactorRequired && !account.twoFAEnabled && (
                              <Badge variant="urgent">2FA missing</Badge>
                            )}
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-3">
                          {canManageUsers && (
                            <Link
                              href={`/admin?focusUser=${account.id}#user-${account.id}`}
                              className="text-xs font-medium text-brand-700 underline underline-offset-2"
                            >
                              Open user recovery
                            </Link>
                          )}
                          <Link
                            href={`/audit?entity=SecurityEvent&userId=${account.id}&days=30`}
                            className="text-xs font-medium text-muted-foreground underline underline-offset-2"
                          >
                            Open audit trail
                          </Link>
                        </div>
                        <div className="mt-3">
                          <SecurityResponseActions
                            userId={account.id}
                            locked={Boolean(account.lockedUntil && account.lockedUntil > new Date())}
                            hasFailedAttempts={account.failedAttempts > 0}
                            twoFAEnabled={account.twoFAEnabled}
                            canManageUsers={canManageUsers}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent Security Events</CardTitle>
            </CardHeader>
            <CardContent>
              {securitySummary.recentEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No recent security events were recorded in the last 7 days.
                </p>
              ) : (
                <div className="space-y-3">
                  {securitySummary.recentEvents.map((event) => (
                    <div
                      key={event.id}
                      className="rounded-lg border border-border bg-card px-4 py-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={event.variant}>{event.label}</Badge>
                          {event.actorRole && <Badge variant="default">{event.actorRole}</Badge>}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {event.createdAt.toLocaleString("en-NZ")}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-foreground">{event.description}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Actor: {event.actorName}</p>
                      {canInvestigateAudit && (
                        <div className="mt-3">
                          <Link
                            href={`/audit?entity=${encodeURIComponent(event.entity)}&action=${encodeURIComponent(event.action)}&days=7`}
                            className="text-xs font-medium text-brand-700 underline underline-offset-2"
                          >
                            Investigate similar events
                          </Link>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* ─── Concordance panels ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Colposcopy concordance */}
        <Card>
          <CardHeader>
            <CardTitle>Colposcopy — Rule vs Clinician Concordance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg bg-muted/40 border border-border px-3 py-3">
                <p className="text-2xl font-bold text-foreground">
                  {colpoConcordance.totalGraded}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Total graded</p>
              </div>
              <div className="rounded-lg bg-success/5 border border-success/30 px-3 py-3">
                <p className="text-2xl font-bold text-success">
                  {colpoConcordance.ruleVsClinician.concordant}
                </p>
                <p className="text-xs text-success mt-0.5">Concordant</p>
              </div>
              <div className="rounded-lg bg-warn/5 border border-warn/30 px-3 py-3">
                <p className="text-2xl font-bold text-warn">
                  {colpoConcordance.gradedLast30Days}
                </p>
                <p className="text-xs text-warn mt-0.5">Last 30 days</p>
              </div>
            </div>

            <ConcordanceBar
              rate={colpoConcordance.ruleVsClinician.ratePercent}
              hasData={colpoConcordance.totalGraded > 0}
            />

            {colpoConcordance.averageDaysToGrade !== null && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Avg days to grade</span>
                <span className="font-semibold text-foreground">
                  {colpoConcordance.averageDaysToGrade}d
                </span>
              </div>
            )}

            {Object.keys(colpoConcordance.overridesByPriority).length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Override destinations
                </p>
                <div className="space-y-1">
                  {Object.entries(colpoConcordance.overridesByPriority).map(
                    ([p, count]) => (
                      <div
                        key={p}
                        className="flex items-center justify-between text-sm"
                      >
                        <PriorityBadge priority={p as never} />
                        <span className="text-muted-foreground">{String(count)} overrides</span>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Gynaecology concordance */}
        <Card>
          <CardHeader>
            <CardTitle>Gynaecology — Rule vs Clinician Concordance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg bg-muted/40 border border-border px-3 py-3">
                <p className="text-2xl font-bold text-foreground">
                  {gynaeConcordance.totalGraded}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Total graded</p>
              </div>
              <div className="rounded-lg bg-success/5 border border-success/30 px-3 py-3">
                <p className="text-2xl font-bold text-success">
                  {gynaeConcordance.ruleVsClinician.concordant}
                </p>
                <p className="text-xs text-success mt-0.5">Concordant</p>
              </div>
              <div className="rounded-lg bg-warn/5 border border-warn/30 px-3 py-3">
                <p className="text-2xl font-bold text-warn">
                  {gynaeConcordance.gradedLast30Days}
                </p>
                <p className="text-xs text-warn mt-0.5">Last 30 days</p>
              </div>
            </div>

            <ConcordanceBar
              rate={gynaeConcordance.ruleVsClinician.ratePercent}
              hasData={gynaeConcordance.totalGraded > 0}
            />

            {gynaeConcordance.averageDaysToGrade !== null && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Avg days to grade</span>
                <span className="font-semibold text-foreground">
                  {gynaeConcordance.averageDaysToGrade}d
                </span>
              </div>
            )}

            {Object.keys(gynaeConcordance.overridesByPriority).length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Override destinations
                </p>
                <div className="space-y-1">
                  {Object.entries(gynaeConcordance.overridesByPriority).map(
                    ([p, count]) => (
                      <div
                        key={p}
                        className="flex items-center justify-between text-sm"
                      >
                        <PriorityBadge priority={p as never} />
                        <span className="text-muted-foreground">{String(count)} overrides</span>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ─── Throughput + priority breakdown ─────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Grading Throughput — Last 8 Weeks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Colposcopy
              </p>
              <ThroughputChart data={colpoThroughput} eyebrow={workspace.label} />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Gynaecology
              </p>
              <ThroughputChart data={gynaeThroughput} eyebrow={workspace.label} />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Colposcopy — Active Priority Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <PriorityBreakdownTable rows={colpoPriorities} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Gynaecology — Active Priority Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <PriorityBreakdownTable rows={gynaePriorities} />
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <WorkflowBreakdownPanel
          title="Colposcopy — Operational Routing"
          totalTracked={colpoWorkflow.totalTracked}
          workflows={colpoWorkflow.workflows}
          smoOnly={colpoWorkflow.smoOnly}
        />
        <WorkflowBreakdownPanel
          title="Gynaecology — Operational Routing"
          totalTracked={gynaeWorkflow.totalTracked}
          workflows={gynaeWorkflow.workflows}
          smoOnly={gynaeWorkflow.smoOnly}
        />
      </div>

      {/* ─── AI recommendation summary ────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>AI Grading Assistance</CardTitle>
          <p className="text-xs text-muted-foreground">
            Tracks concordance between AI recommendations and deterministic rule decisions over time
          </p>
        </CardHeader>
        <CardContent>
          {totalAiRecs === 0 ? (
            <EmptyState
              icon={Brain}
              eyebrow={workspace.label}
              title="No AI recommendations yet"
              description="Run AI Assist on a graded case to start building concordance data."
              nextStep="Start with an already graded case so the AI result can be compared against a final clinician decision."
              action={{ href: "/cases?status=GRADED", label: "Open graded cases" }}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-lg bg-muted/40 border border-border px-4 py-3 text-center">
                <p className="text-2xl font-bold text-foreground">{totalAiRecs}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Total AI runs</p>
              </div>
              <div className="rounded-lg bg-success/5 border border-success/30 px-4 py-3 text-center">
                <p className="text-2xl font-bold text-success">
                  {concordantAiRecs}
                </p>
                <p className="text-xs text-success mt-0.5">
                  Concordant with rules
                </p>
              </div>
              <div className="rounded-lg bg-brand-50 border border-brand-200 px-4 py-3 text-center">
                <p className="text-2xl font-bold text-brand-700">
                  {aiConcordancePct ?? "—"}
                  {aiConcordancePct !== null ? "%" : ""}
                </p>
                <p className="text-xs text-brand-600 mt-0.5">
                  AI concordance rate
                </p>
              </div>
            </div>
          )}
          <div className="mt-4 rounded-lg bg-brand-50/40 border border-brand-200 px-4 py-3 text-sm text-purple-800">
            <p className="font-semibold">How concordance learning works</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Each time a clinician confirms or overrides a grading recommendation, the outcome is
              logged. Over time, concordance data reveals which rule or AI patterns match clinical
              judgement — enabling continuous improvement of both the deterministic rules and the AI model.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
