import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { StatCard, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

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
  ]);

  const totalPatients = patientStats.reduce((sum, s) => sum + s._count, 0);
  const activePatients = patientStats.find((s) => s.status === "ACTIVE")?._count ?? 0;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1E3A5F]">Admin Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          System administration — NZ Cervical Screening Programme
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Total Patients"
          value={totalPatients.toLocaleString()}
          subtext={`${activePatients} active`}
        />
        <StatCard
          label="System Users"
          value={totalUsers.toLocaleString()}
          subtext="Clinicians and coordinators"
        />
        <StatCard
          label="Active Rule Sets"
          value={activeRules.toLocaleString()}
          subtext="Clinical decision rules published"
          variant={activeRules === 0 ? "urgent" : "default"}
        />
        <StatCard
          label="Audit Events (30d)"
          value={recentAuditLogs.length.toLocaleString()}
          subtext="System access and changes"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Clinical Rule Set history */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Rule Version History</CardTitle>
              <Badge variant="default">Two-Person Rule</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {rulesets.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-400 text-sm">
                No rule sets published yet.
                <p className="mt-2 text-xs">
                  Clinical rules must go through two-person review before publishing.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {rulesets.map((rs) => (
                  <div key={rs.id} className="px-6 py-4">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-[#1E3A5F] text-sm">{rs.name}</p>
                          {rs.isActive && (
                            <Badge variant="low">Active</Badge>
                          )}
                        </div>
                        <p className="text-xs font-mono text-gray-400">v{rs.version}</p>
                        {rs.changeNotes && (
                          <p className="text-xs text-gray-500 mt-1">{rs.changeNotes}</p>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-500">
                      {rs.publishedBy && (
                        <span>Published by: {rs.publishedBy.name} ({formatDate(rs.publishedAt)})</span>
                      )}
                      {rs.reviewedBy && (
                        <span>Reviewed by: {rs.reviewedBy.name} ({formatDate(rs.reviewedAt)})</span>
                      )}
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
            <CardTitle>Recent Audit Events</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {recentAuditLogs.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-400 text-sm">
                No audit events recorded.
              </div>
            ) : (
              <div className="overflow-y-auto max-h-[400px] divide-y divide-gray-100">
                {recentAuditLogs.map((log) => (
                  <div key={log.id} className="px-4 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-mono px-1.5 py-0.5 rounded ${
                            log.action === "CREATE"
                              ? "bg-green-100 text-green-700"
                              : log.action === "READ"
                              ? "bg-blue-100 text-blue-700"
                              : log.action === "UPDATE"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {log.action}
                        </span>
                        <span className="text-xs text-gray-600">{log.entity}</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {log.user?.name ?? "System"} ({log.user?.role ?? "—"}) ·{" "}
                        {formatDateTime(log.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Patient status breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Patient Register Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-6">
            {patientStats.map((s) => (
              <div key={s.status} className="text-center">
                <p className="text-2xl font-bold text-[#1E3A5F]">{s._count}</p>
                <p className="text-xs text-gray-500 mt-1">{s.status}</p>
              </div>
            ))}
            {patientStats.length === 0 && (
              <p className="text-sm text-gray-400">No patients registered yet.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Security info */}
      <Card>
        <CardHeader>
          <CardTitle>Security & Compliance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3">
              <p className="font-semibold text-green-800">Session Security</p>
              <p className="text-green-700 text-xs mt-1">15-minute idle timeout enforced</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
              <p className="font-semibold text-blue-800">Account Lockout</p>
              <p className="text-blue-700 text-xs mt-1">30-min lockout after 5 failed attempts</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              <p className="font-semibold text-amber-800">Audit Logging</p>
              <p className="text-amber-700 text-xs mt-1">All read/write access logged</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
