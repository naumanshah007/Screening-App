import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { StatCard, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate, formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  Users, Shield, Settings, FileText, CheckCircle,
  Lock, Database, Activity, AlertTriangle
} from "lucide-react";

export default async function AdminPage() {
  const session = await auth();
  const user = session?.user as { role?: string };
  if (user?.role !== "ADMIN") redirect("/dashboard");

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    activeRules,
    recentAuditLogs,
    patientStats,
    rulesets,
    sessionsThirtyDays,
    referralStats,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.clinicalRuleSet.count({ where: { isActive: true } }),
    prisma.auditLog.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      include: { user: { select: { name: true, role: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.patient.groupBy({ by: ["status"], _count: true }),
    prisma.clinicalRuleSet.findMany({
      include: {
        publishedBy: { select: { name: true } },
        reviewedBy: { select: { name: true } },
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
  ]);

  type PatientStat = { status: string; _count: number };
  const totalPatients = patientStats.reduce(
    (sum: number, s: PatientStat) => sum + s._count,
    0
  );
  const activePatients =
    patientStats.find((s: PatientStat) => s.status === "ACTIVE")?._count ?? 0;

  const actionBadgeClass: Record<string, string> = {
    CREATE: "bg-emerald-100 text-emerald-700",
    READ:   "bg-sky-100 text-sky-700",
    UPDATE: "bg-amber-100 text-amber-700",
    DELETE: "bg-red-100 text-red-700",
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

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Admin Dashboard</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          System administration — NZ Cervical Screening Programme
        </p>
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
                title="No rule sets published"
                description="Clinical rules must go through two-person review before publishing."
              />
            ) : (
              <div className="divide-y divide-slate-50">
                {rulesets.map((rs) => (
                  <div key={rs.id} className="px-5 py-4 hover:bg-slate-50/60 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-slate-900 text-sm">{rs.name}</p>
                          {rs.isActive && (
                            <Badge variant="low">Active</Badge>
                          )}
                          <span className="text-xs font-mono text-slate-400">v{rs.version}</span>
                        </div>
                        {rs.changeNotes && (
                          <p className="text-xs text-slate-500 mt-1 leading-relaxed">{rs.changeNotes}</p>
                        )}
                        <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-400">
                          {rs.publishedBy && (
                            <span>Published by {rs.publishedBy.name} ({formatDate(rs.publishedAt)})</span>
                          )}
                          {rs.reviewedBy && (
                            <span>· Reviewed by {rs.reviewedBy.name} ({formatDate(rs.reviewedAt)})</span>
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
                title="No audit events"
                description="System access and changes will be logged here."
              />
            ) : (
              <div className="overflow-y-auto max-h-[360px] divide-y divide-slate-50">
                {recentAuditLogs.map((log) => (
                  <div key={log.id} className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50/60 transition-colors">
                    <span className={cn(
                      "text-[10px] font-bold font-mono px-1.5 py-0.5 rounded flex-shrink-0",
                      actionBadgeClass[log.action] ?? "bg-slate-100 text-slate-600"
                    )}>
                      {log.action}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-700">{log.entity}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
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
            <p className="text-sm text-slate-400">No patients registered yet.</p>
          ) : (
            <div className="flex flex-wrap gap-8">
              {patientStats.map((s) => (
                <div key={s.status} className="text-center">
                  <p className="text-3xl font-bold text-slate-900 tracking-tight">{s._count.toLocaleString()}</p>
                  <p className="text-xs text-slate-400 mt-1 uppercase tracking-wide">{s.status}</p>
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
            <Shield className="h-4 w-4 text-brand-600" />
            Security &amp; Compliance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
              <CheckCircle className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-emerald-800">Session Security</p>
                <p className="text-xs text-emerald-700 mt-0.5">15-minute idle timeout enforced</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-xl bg-sky-50 border border-sky-200">
              <Lock className="h-5 w-5 text-sky-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-sky-800">Account Lockout</p>
                <p className="text-xs text-sky-700 mt-0.5">30-min lockout after 5 failed attempts</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">Audit Logging</p>
                <p className="text-xs text-amber-700 mt-0.5">All read/write access logged</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
