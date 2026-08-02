import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { PageIntro } from "@/components/layout/PageIntro";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { StatCard, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { NcsrCertificationManager } from "./NcsrCertificationManager";
import { IntegrationValidationManager } from "./IntegrationValidationManager";
import { CreateUserForm } from "./CreateUserForm";
import { UserAccessManager } from "./UserAccessManager";
import { formatDate, formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { listAdminUsers } from "@/lib/admin/user-management";
import { getDatabaseRuntimeSummary } from "@/lib/config/database";
import { getDocumentStorageRuntimeSummary } from "@/lib/documents/storage";
import { getNcsrCertificationSummary } from "@/lib/integrations/colposcopy-registry/access";
import { getEnterpriseIntegrationStatuses } from "@/lib/ops/integration-status";
import { getIntegrationValidationStateMap } from "@/lib/ops/integration-validations";
import { getRuntimeReadinessReport } from "@/lib/ops/runtime-readiness";
import { getSecurityIncidentAutomationOverview } from "@/lib/security/incident-automation";
import { securityIncidentStatusVariant } from "@/lib/security/incident-shared";
import { getSecurityIncidentOverview } from "@/lib/security/incidents";
import { getWorkspaceContext } from "@/lib/workspace/context";
import { SecurityIncidentAutomationCard } from "./SecurityIncidentAutomationCard";
import { SecurityIncidentManager } from "./SecurityIncidentManager";
import {
  Users, Shield, Settings, FileText, CheckCircle,
  Lock, Database, Activity, AlertTriangle, Bot, FolderOpen, Link2
} from "lucide-react";

function readinessBadgeVariant(status: "ready" | "warning" | "blocked" | "info") {
  switch (status) {
    case "ready":
      return "low";
    case "warning":
      return "high";
    case "blocked":
      return "urgent";
    default:
      return "default";
  }
}

function integrationIcon(id: "database" | "storage" | "ai" | "ncsr") {
  switch (id) {
    case "database":
      return <Database className="h-4 w-4 text-brand-600" />;
    case "storage":
      return <FolderOpen className="h-4 w-4 text-brand-600" />;
    case "ai":
      return <Bot className="h-4 w-4 text-brand-600" />;
    case "ncsr":
      return <Link2 className="h-4 w-4 text-brand-600" />;
  }
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams?: Promise<{ focusUser?: string }>;
}) {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (user?.role !== "ADMIN" && user?.role !== "INTEGRATION_ADMIN") redirect("/dashboard");
  const params = (await searchParams) ?? {};
  const workspace = getWorkspaceContext(user?.role, true);
  const canManageUsers = user?.role === "ADMIN";

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const databaseRuntime = getDatabaseRuntimeSummary();
  const storageRuntime = getDocumentStorageRuntimeSummary();
  const readinessReport = await getRuntimeReadinessReport();
  const integrationStatuses = await getEnterpriseIntegrationStatuses();
  const ncsrCertificationSummary = await getNcsrCertificationSummary();
  const integrationValidationStateMap = await getIntegrationValidationStateMap();
  const integrationValidationRows = integrationStatuses.map((integration) => ({
    id: integration.id,
    title: integration.title,
    integration,
    validation:
      integrationValidationStateMap.get(integration.id) ??
      {
        kind: "none" as const,
        label: "No validation recorded",
        summary: "No formal validation record is on file for this integration.",
        detail:
          "The integration may be configured, but there is no governed sign-off showing a controlled test was completed.",
        recommendedAction:
          "Record a controlled validation before treating this integration as live-service ready.",
        record: null,
      },
  }));

  const [
    totalUsers,
    activeRules,
    recentAuditLogs,
    patientStats,
    practices,
    rulesets,
    sessionsThirtyDays,
    referralStats,
    users,
    incidentOverview,
    incidentAutomationOverview,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.clinicalRuleVersion.count({ where: { status: "ACTIVE" } }),
    prisma.auditLog.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      include: { user: { select: { name: true, role: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.patient.groupBy({ by: ["status"], _count: true }),
    canManageUsers
      ? prisma.gPPractice.findMany({
          select: {
            id: true,
            name: true,
            hpiNumber: true,
          },
          orderBy: [{ name: "asc" }],
        })
      : Promise.resolve([]),
    prisma.clinicalRuleVersion.findMany({
      include: {
        ruleSet: { select: { name: true, scope: true } },
        publishedBy: { select: { name: true } },
        approvedBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.screeningSession.count({
      where: { createdAt: { gte: thirtyDaysAgo } },
    }),
    prisma.referral.groupBy({
      by: ["priority", "status"],
      _count: true,
    }),
    canManageUsers ? listAdminUsers() : Promise.resolve([]),
    getSecurityIncidentOverview(),
    getSecurityIncidentAutomationOverview(),
  ]);

  type PatientStat = { status: string; _count: number };
  const totalPatients = patientStats.reduce(
    (sum: number, s: PatientStat) => sum + s._count,
    0
  );
  const activePatients =
    patientStats.find((s: PatientStat) => s.status === "ACTIVE")?._count ?? 0;

  const actionBadgeClass: Record<string, string> = {
    CREATE: "bg-success/10 text-success",
    READ:   "bg-info/10 text-info",
    UPDATE: "bg-warn/10 text-warn",
    DELETE: "bg-destructive/10 text-destructive",
  };

  // Pending referrals by priority
  type ReferralStat = { priority: string; status: string; _count: number };
  const pendingByPriority = referralStats
    .filter((r: ReferralStat) => r.status === "PENDING")
    .reduce((acc: Record<string, number>, r: ReferralStat) => {
      acc[r.priority] = (acc[r.priority] ?? 0) + r._count;
      return acc;
    }, {} as Record<string, number>);
  const pendingEntries = Object.entries(pendingByPriority) as [string, number][];

  type AdminRuleSet = Prisma.ClinicalRuleVersionGetPayload<{
    include: {
      ruleSet: { select: { name: true; scope: true } };
      publishedBy: { select: { name: true } };
      approvedBy: { select: { name: true } };
    };
  }>;

  type AdminAuditLog = Prisma.AuditLogGetPayload<{
    include: {
      user: { select: { name: true; role: true } };
    };
  }>;

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="page-aura">
        <PageIntro
          eyebrow={workspace.label}
          title="Admin Dashboard"
          description="System administration, runtime readiness, rule governance, and audit visibility."
          actions={[
            { href: "/rules", label: "Open rules" },
            { href: "/analytics", label: "View analytics" },
          ]}
        />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Total Patients"
          value={totalPatients.toLocaleString()}
          subtext={`${activePatients} active`}
          icon={<Users className="h-5 w-5" />}
        />
        <StatCard
          label="System Users"
          value={totalUsers.toLocaleString()}
          subtext="Clinicians and coordinators"
          icon={<Users className="h-5 w-5" />}
        />
        <StatCard
          label="Active Rule Sets"
          value={activeRules.toLocaleString()}
          subtext="Clinical decision rules"
          variant={activeRules === 0 ? "urgent" : "default"}
          icon={<Settings className="h-5 w-5" />}
        />
        <StatCard
          label="Audit Events (30d)"
          value={recentAuditLogs.length.toLocaleString()}
          subtext="System access logged"
          icon={<FileText className="h-5 w-5" />}
        />
        <StatCard
          label="Open Incidents"
          value={incidentOverview.counts.open.toLocaleString()}
          subtext={`${incidentOverview.counts.overdue} overdue · ${incidentOverview.counts.unassigned} unassigned`}
          variant={incidentOverview.counts.overdue > 0 ? "urgent" : incidentOverview.counts.open > 0 ? "warning" : "success"}
          icon={<AlertTriangle className="h-5 w-5" />}
        />
      </div>

      {/* Second KPI row */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Sessions (30d)"
          value={sessionsThirtyDays.toLocaleString()}
          subtext="Pathway sessions"
          icon={<Activity className="h-5 w-5" />}
        />
        {pendingEntries.sort().map(([priority, count]) => (
          <StatCard
            key={priority}
            label={`${priority} Pending`}
            value={count}
            subtext="Referrals awaiting action"
            variant={priority === "P1" ? "urgent" : priority === "P2" ? "warning" : "default"}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Rule version history */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-brand-600" />
              Rule Version History
            </CardTitle>
            <Badge variant="info">Two-Person Rule</Badge>
          </CardHeader>
          <CardContent className="p-0">
            {rulesets.length === 0 ? (
              <EmptyState
                icon={Database}
                eyebrow={workspace.label}
                title="No rule sets published"
                description="Clinical rules must go through two-person review before publishing."
                nextStep="Create or review a rules release so the governance trail exists before production use."
                action={{ href: "/rules", label: "Open rules" }}
              />
            ) : (
              <div className="divide-y divide-border">
                {rulesets.map((rs: AdminRuleSet) => (
                  <div key={rs.id} className="px-5 py-4 hover:bg-muted/40 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-foreground text-sm">{rs.ruleSet.name}</p>
                          {rs.status === "ACTIVE" && (
                            <Badge variant="low">Active</Badge>
                          )}
                          <span className="text-xs font-mono text-muted-foreground">{rs.displayVersion}</span>
                        </div>
                        {rs.changeSummary && (
                          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{rs.changeSummary}</p>
                        )}
                        <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                          {rs.publishedBy && (
                            <span>Published by {rs.publishedBy.name} ({formatDate(rs.publishedAt)})</span>
                          )}
                          {rs.approvedBy && (
                            <span>· Approved by {rs.approvedBy.name} ({formatDate(rs.validatedAt)})</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Audit log */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-brand-600" />
              Recent Audit Events
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {recentAuditLogs.length === 0 ? (
              <EmptyState
                icon={FileText}
                eyebrow={workspace.label}
                title="No audit events"
                description="System access and changes will be logged here."
                nextStep="Once users begin viewing or editing data, the enterprise audit trail will populate automatically."
              />
            ) : (
              <div className="overflow-y-auto max-h-[360px] divide-y divide-border">
                {recentAuditLogs.map((log: AdminAuditLog) => (
                  <div key={log.id} className="px-5 py-3 flex items-center gap-3 hover:bg-muted/40 transition-colors">
                    <span className={cn(
                      "text-[10px] font-bold font-mono px-1.5 py-0.5 rounded flex-shrink-0",
                      actionBadgeClass[log.action] ?? "bg-muted text-muted-foreground"
                    )}>
                      {log.action}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-muted-foreground">{log.entity}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {log.user?.name ?? "System"} ({log.user?.role ?? "—"}) · {formatDateTime(log.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <SecurityIncidentAutomationCard
        secretConfigured={incidentAutomationOverview.config.secretConfigured}
        secretSource={incidentAutomationOverview.config.secretSource}
        reminderCooldownHours={incidentAutomationOverview.config.reminderCooldownHours}
        lastRunAt={incidentAutomationOverview.activity.lastRunAt}
        runs7d={incidentAutomationOverview.activity.runs7d}
        automatedReminders7d={incidentAutomationOverview.activity.automatedReminders7d}
      />

      <div id="security-incidents">
        <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-brand-600" />
            Security Incident Queue
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            <Badge variant={securityIncidentStatusVariant("OPEN")}>
              {incidentOverview.counts.open} open
            </Badge>
            <Badge variant={securityIncidentStatusVariant("UNDER_REVIEW")}>
              {incidentOverview.counts.underReview} under review
            </Badge>
            <Badge variant={securityIncidentStatusVariant("ACKNOWLEDGED")}>
              {incidentOverview.counts.acknowledged} acknowledged
            </Badge>
            <Badge variant="urgent">
              {incidentOverview.counts.overdue} overdue
            </Badge>
            <Badge variant="high">
              {incidentOverview.counts.dueSoon} due soon
            </Badge>
            <Badge variant="default">
              {incidentOverview.counts.resolved} resolved
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {incidentOverview.incidents.length === 0 ? (
            <EmptyState
              icon={AlertTriangle}
              eyebrow={workspace.label}
              title="No security incidents"
              description="Security alerts can now be escalated into managed incidents with owner, status, and notes."
              nextStep="Open an incident from Analytics when an alert needs active follow-through."
              action={{ href: "/analytics", label: "Open analytics" }}
            />
          ) : (
            <SecurityIncidentManager
              incidents={incidentOverview.incidents}
              assignees={incidentOverview.assignees}
            />
          )}
        </CardContent>
        </Card>
      </div>

      {canManageUsers && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4 text-brand-600" />
              User Onboarding
            </CardTitle>
            <Badge variant="info">Admin only</Badge>
          </CardHeader>
          <CardContent>
            <CreateUserForm practices={practices} />
          </CardContent>
        </Card>
      )}

      {canManageUsers && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4 text-brand-600" />
              User Access Management
            </CardTitle>
            <Badge variant="info">Admin only</Badge>
          </CardHeader>
          <CardContent>
            {users.length === 0 ? (
              <EmptyState
                icon={Users}
                eyebrow={workspace.label}
                title="No users found"
                description="User accounts will appear here once they exist in the system."
                nextStep="Create the required clinician, coordinator, and integration accounts before production onboarding."
              />
            ) : (
              <UserAccessManager
                users={users}
                currentUserId={user?.id}
                focusUserId={params.focusUser}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Patient register status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-4 w-4 text-brand-600" />
            Patient Register Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {patientStats.length === 0 ? (
            <p className="text-sm text-muted-foreground">No patients registered yet.</p>
          ) : (
            <div className="flex flex-wrap gap-8">
              {patientStats.map((s) => (
                <div key={s.status} className="text-center">
                  <p className="text-3xl font-bold text-foreground tracking-tight">{s._count.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wide">{s.status}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Security & Compliance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-4 w-4 text-brand-600" />
            Runtime Infrastructure
          </CardTitle>
          <Badge variant={readinessBadgeVariant(readinessReport.overallStatus)}>
            {readinessReport.overallStatus === "ready"
              ? "Ready"
              : readinessReport.overallStatus === "warning"
                ? "Warnings"
                : readinessReport.overallStatus === "blocked"
                  ? "Blocked items"
                  : "Info"}
          </Badge>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-border bg-muted/40 px-4 py-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Database adapter</div>
            <div className="mt-2 text-sm font-semibold text-foreground">
              {databaseRuntime.adapter}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-muted/40 px-4 py-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Database mode</div>
            <div className="mt-2 flex items-center gap-2">
              <Badge variant={databaseRuntime.mode === "remote-libsql" ? "low" : "high"}>
                {databaseRuntime.mode === "remote-libsql" ? "Managed remote" : "Local file"}
              </Badge>
            </div>
            <div className="mt-2 text-xs text-muted-foreground break-all">
              {databaseRuntime.displayTarget}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-muted/40 px-4 py-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Database auth</div>
            <div className="mt-2">
              <Badge variant={databaseRuntime.authConfigured ? "low" : "default"}>
                {databaseRuntime.authConfigured ? "Configured" : "Not required / not set"}
              </Badge>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-muted/40 px-4 py-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Document storage</div>
            <div className="mt-2 text-sm font-semibold text-foreground">
              {storageRuntime.providerName}
            </div>
            <div className="mt-2 text-xs text-muted-foreground break-all">
              {storageRuntime.targetLabel}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-brand-600" />
            Live Integrations
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {integrationStatuses.map((integration) => (
            <div
              key={integration.id}
              className="rounded-xl border border-border bg-card px-4 py-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  {integrationIcon(integration.id)}
                  <div className="text-sm font-semibold text-foreground">
                    {integration.title}
                  </div>
                </div>
                <Badge variant={readinessBadgeVariant(integration.status)}>
                  {integration.status}
                </Badge>
              </div>
              <div className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">
                {integration.mode}
              </div>
              <div className="mt-2 text-sm text-muted-foreground">{integration.summary}</div>
              <div className="mt-2 text-xs text-muted-foreground">{integration.detail}</div>
              {integration.nextStep && (
                <div className="mt-3 rounded-lg border border-border bg-muted/40 px-3 py-3 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Next step:</span>{" "}
                  {integration.nextStep}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-brand-600" />
            Formal Integration Validation
          </CardTitle>
          <Badge variant="info">Governed sign-off</Badge>
        </CardHeader>
        <CardContent>
          <IntegrationValidationManager rows={integrationValidationRows} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-brand-600" />
            Restricted Access Governance
          </CardTitle>
          <Badge
            variant={
              ncsrCertificationSummary.blockedCount > 0
                ? "high"
                : ncsrCertificationSummary.warningCount > 0
                  ? "info"
                  : "low"
            }
          >
            NCSR
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <StatCard
              label="Eligible Users"
              value={ncsrCertificationSummary.totalEligibleUsers.toLocaleString()}
              subtext="Roles that can request NCSR pull"
              icon={<Users className="h-5 w-5" />}
            />
            <StatCard
              label="Certified"
              value={ncsrCertificationSummary.readyCount.toLocaleString()}
              subtext="Fully current access"
              variant="success"
              icon={<CheckCircle className="h-5 w-5" />}
            />
            <StatCard
              label="Expiring Soon"
              value={ncsrCertificationSummary.warningCount.toLocaleString()}
              subtext="Still active but needs renewal"
              variant={ncsrCertificationSummary.warningCount > 0 ? "warning" : "default"}
              icon={<AlertTriangle className="h-5 w-5" />}
            />
            <StatCard
              label="Blocked"
              value={ncsrCertificationSummary.blockedCount.toLocaleString()}
              subtext="Missing or expired training"
              variant={ncsrCertificationSummary.blockedCount > 0 ? "urgent" : "default"}
              icon={<Lock className="h-5 w-5" />}
            />
          </div>

          {ncsrCertificationSummary.rows.length === 0 ? (
            <EmptyState
              icon={Shield}
              eyebrow={workspace.label}
              title="No restricted-access users found"
              description="There are no users in roles that can access the national colposcopy registry."
              nextStep="Create or import the relevant COLPO_CNS, SMO_REVIEWER, ADMIN, or INTEGRATION_ADMIN users before live validation."
            />
          ) : (
            <NcsrCertificationManager rows={ncsrCertificationSummary.rows} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-brand-600" />
            Enterprise Readiness
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {readinessReport.checks.map((check) => (
            <div
              key={check.id}
              className="rounded-xl border border-border bg-card px-4 py-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-foreground">
                    {check.title}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {check.summary}
                  </div>
                </div>
                <Badge variant={readinessBadgeVariant(check.status)}>
                  {check.status}
                </Badge>
              </div>
              <div className="mt-3 text-sm text-muted-foreground">{check.detail}</div>
              {check.recommendedAction && (
                <div className="mt-3 rounded-lg border border-border bg-muted/40 px-3 py-3 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Next step:</span>{" "}
                  {check.recommendedAction}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-brand-600" />
            Security &amp; Compliance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex items-start gap-3 p-4 rounded-xl bg-success/5 border border-success/30">
              <CheckCircle className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-foreground">Session Security</p>
                <p className="text-xs text-success mt-0.5">15-minute idle timeout enforced</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-xl bg-info/5 border border-info/30">
              <Lock className="h-5 w-5 text-info flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-foreground">Account Lockout</p>
                <p className="text-xs text-info mt-0.5">30-min lockout after 5 failed attempts</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-xl bg-warn/5 border border-warn/30">
              <AlertTriangle className="h-5 w-5 text-warn flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-foreground">Audit Logging</p>
                <p className="text-xs text-warn mt-0.5">All read/write access logged</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
