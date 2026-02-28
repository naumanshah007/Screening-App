import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { StatCard, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RiskBadge, PriorityBadge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await auth();
  const user = session?.user as { name?: string; role?: string; id?: string };

  const now = new Date();

  // Load KPI data server-side
  const [
    totalActivePatients,
    overdueRecalls,
    pendingReferrals,
    recentSessions,
    urgentReferrals,
    pathwayDist,
  ] = await Promise.all([
    prisma.patient.count({ where: { status: "ACTIVE" } }),
    prisma.recall.count({ where: { status: "PENDING", dueDate: { lt: now } } }),
    prisma.referral.count({ where: { status: "PENDING" } }),
    prisma.screeningSession.count({
      where: { createdAt: { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) } },
    }),
    prisma.referral.findMany({
      where: {
        priority: { in: ["P1", "P2"] },
        status: { in: ["PENDING", "APPROVED"] },
      },
      include: {
        screeningSession: {
          include: {
            patient: { select: { nhi: true, firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
      take: 5,
    }),
    prisma.screeningSession.groupBy({
      by: ["activeModule"],
      _count: true,
      where: { activeModule: { not: null } },
    }),
  ]);

  const figureLabels: Record<string, string> = {
    FIGURE_1: "Fig 1 - HPV Transition",
    FIGURE_2: "Fig 2 - HPV Transition (prev. abnormal)",
    FIGURE_3: "Fig 3 - Primary HPV",
    FIGURE_4: "Fig 4 - Colposcopy",
    FIGURE_5: "Fig 5 - High Grade",
    FIGURE_6: "Fig 6 - Test of Cure",
    FIGURE_7: "Fig 7 - Post-abnormal",
    FIGURE_8: "Fig 8 - Post-hysterectomy",
    FIGURE_9: "Fig 9 - Extended",
    FIGURE_10: "Fig 10 - Post-hyst follow-up",
    TABLE_1: "Table 1 - Routine",
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1E3A5F]">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          Welcome back, {user?.name ?? "User"} · {user?.role}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Active Patients"
          value={totalActivePatients.toLocaleString()}
          subtext="On cervical screening register"
          icon={<span className="text-4xl">♦</span>}
        />
        <StatCard
          label="Overdue Recalls"
          value={overdueRecalls.toLocaleString()}
          subtext="Past due date"
          variant={overdueRecalls > 0 ? "urgent" : "default"}
          icon={<span className="text-4xl">⏰</span>}
        />
        <StatCard
          label="Pending Referrals"
          value={pendingReferrals.toLocaleString()}
          subtext="Awaiting coordinator review"
          variant={pendingReferrals > 10 ? "warning" : "default"}
          icon={<span className="text-4xl">◉</span>}
        />
        <StatCard
          label="Sessions (30 days)"
          value={recentSessions.toLocaleString()}
          subtext="Screening sessions entered"
          icon={<span className="text-4xl">✦</span>}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Urgent referrals */}
        <Card>
          <CardHeader>
            <CardTitle>P1/P2 Referrals Pending</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {urgentReferrals.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-400 text-sm">
                No urgent referrals pending.
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {urgentReferrals.map((r) => {
                  const patient = r.screeningSession.patient;
                  const daysSince = Math.floor(
                    (now.getTime() - new Date(r.createdAt).getTime()) / (1000 * 60 * 60 * 24)
                  );
                  const target = r.priority === "P1" ? 20 : 42;
                  const overdue = Math.max(0, daysSince - target);
                  return (
                    <div key={r.id} className="px-6 py-4 flex items-center justify-between gap-4">
                      <div>
                        <p className="font-medium text-[#1E3A5F] text-sm">
                          {patient.firstName} {patient.lastName}
                        </p>
                        <p className="text-xs text-gray-400 font-mono">{patient.nhi}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Referred {daysSince} days ago
                          {overdue > 0 && (
                            <span className="text-red-600 font-semibold ml-1">
                              · {overdue} days overdue
                            </span>
                          )}
                        </p>
                      </div>
                      <PriorityBadge priority={r.priority} />
                    </div>
                  );
                })}
                <div className="px-6 py-3 bg-gray-50">
                  <Link href="/coordinator" className="text-sm text-[#0D9488] hover:underline font-medium">
                    View all referrals →
                  </Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pathway distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Pathway Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {pathwayDist.length === 0 ? (
              <div className="text-center text-gray-400 text-sm py-8">
                No sessions recorded yet.
              </div>
            ) : (
              <div className="space-y-3">
                {pathwayDist
                  .sort((a, b) => b._count - a._count)
                  .map((item) => {
                    const total = pathwayDist.reduce((sum, i) => sum + i._count, 0);
                    const pct = Math.round((item._count / total) * 100);
                    return (
                      <div key={item.activeModule ?? "null"}>
                        <div className="flex justify-between text-xs text-gray-600 mb-1">
                          <span>{figureLabels[item.activeModule ?? ""] ?? item.activeModule}</span>
                          <span className="font-semibold">{item._count} ({pct}%)</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-2 bg-[#0D9488] rounded-full"
                            style={{ width: `${pct}%` }}
                            role="progressbar"
                            aria-valuenow={pct}
                            aria-valuemin={0}
                            aria-valuemax={100}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/gp"
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#0D9488] text-white rounded-lg text-sm font-medium hover:bg-[#0b7a6f] transition-colors"
            >
              ✦ Enter Results
            </Link>
            <Link
              href="/patients"
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#1E3A5F] text-white rounded-lg text-sm font-medium hover:bg-[#162b47] transition-colors"
            >
              ♦ Patient Search
            </Link>
            <Link
              href="/coordinator"
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              ◉ Referral Queue
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
