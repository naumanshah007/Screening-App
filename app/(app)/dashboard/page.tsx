import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { StatCard, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RiskBadge, PriorityBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatRelativeTime } from "@/lib/utils";
import Link from "next/link";
import {
  Users, ClipboardCheck, AlertTriangle, Activity,
  ArrowRight, GitBranch, Clock, TrendingUp, CheckCircle
} from "lucide-react";

export default async function DashboardPage() {
  const session = await auth();
  const user = session?.user as { name?: string; role?: string; id?: string };
  const now = new Date();
  const firstName = user?.name?.split(" ")[0] ?? "there";
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const [
    totalActivePatients,
    overdueRecalls,
    pendingReferrals,
    p1Referrals,
    recentSessions,
    urgentReferrals,
    pathwayDist,
    recentActivity,
  ] = await Promise.all([
    prisma.patient.count({ where: { status: "ACTIVE" } }),
    prisma.recall.count({ where: { status: "PENDING", dueDate: { lt: now } } }),
    prisma.referral.count({ where: { status: "PENDING" } }),
    prisma.referral.count({ where: { status: "PENDING", priority: "P1" } }),
    prisma.screeningSession.count({
      where: { createdAt: { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) } },
    }),
    prisma.referral.findMany({
      where: { priority: { in: ["P1", "P2"] }, status: { in: ["PENDING", "APPROVED"] } },
      include: {
        screeningSession: {
          include: { patient: { select: { nhi: true, firstName: true, lastName: true } } },
        },
      },
      orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
      take: 6,
    }),
    prisma.screeningSession.groupBy({
      by: ["activeModule"],
      _count: true,
      where: { activeModule: { not: null } },
    }),
    prisma.pathwayStateHistory.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        screeningSession: {
          include: { patient: { select: { firstName: true, lastName: true, nhi: true } } },
        },
      },
    }),
  ]);

  const figureLabels: Record<string, string> = {
    FIGURE_1: "Fig 1 · HPV Transition",
    FIGURE_2: "Fig 2 · HPV Transition (prev. abnormal)",
    FIGURE_3: "Fig 3 · Primary HPV",
    FIGURE_4: "Fig 4 · Colposcopy",
    FIGURE_5: "Fig 5 · High Grade",
    FIGURE_6: "Fig 6 · Test of Cure",
    FIGURE_7: "Fig 7 · Glandular Abnormalities",
    FIGURE_8: "Fig 8 · Post-hysterectomy",
    FIGURE_9: "Fig 9 · Pregnant",
    FIGURE_10: "Fig 10 · Abnormal Bleeding",
    TABLE_1: "Table 1 · Routine",
  };

  const totalSessions = pathwayDist.reduce((s, i) => s + i._count, 0);

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            {greeting}, {firstName}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {now.toLocaleDateString("en-NZ", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            {p1Referrals > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 text-red-600 font-medium">
                <AlertTriangle className="h-3.5 w-3.5" />
                {p1Referrals} urgent {p1Referrals === 1 ? "referral" : "referrals"} need attention
              </span>
            )}
          </p>
        </div>
        <Link href="/pathway">
          <Button size="md" className="flex-shrink-0">
            <GitBranch className="h-4 w-4" />
            New Pathway
          </Button>
        </Link>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Active Patients"
          value={totalActivePatients.toLocaleString()}
          subtext="On screening register"
          icon={<Users className="h-5 w-5" />}
        />
        <StatCard
          label="Overdue Recalls"
          value={overdueRecalls.toLocaleString()}
          subtext="Past due date"
          variant={overdueRecalls > 0 ? "urgent" : "success"}
          icon={<Clock className="h-5 w-5" />}
        />
        <StatCard
          label="Pending Referrals"
          value={pendingReferrals.toLocaleString()}
          subtext="Awaiting review"
          variant={pendingReferrals > 5 ? "warning" : "default"}
          icon={<ClipboardCheck className="h-5 w-5" />}
        />
        <StatCard
          label="Sessions (30 days)"
          value={recentSessions.toLocaleString()}
          subtext="Pathway sessions"
          icon={<Activity className="h-5 w-5" />}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Urgent referrals — 2/3 width */}
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Urgent Referrals Pending</CardTitle>
            <Link href="/coordinator" className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          {urgentReferrals.length === 0 ? (
            <EmptyState
              icon={CheckCircle}
              title="No urgent referrals"
              description="All P1 and P2 referrals have been processed."
            />
          ) : (
            <div className="divide-y divide-slate-50">
              {urgentReferrals.map(r => {
                const patient = r.screeningSession.patient;
                const daysSince = Math.floor((now.getTime() - new Date(r.createdAt).getTime()) / 86400000);
                const targetDays = r.priority === "P1" ? 20 : 42;
                const daysLeft = targetDays - daysSince;
                const isOverdue = daysLeft < 0;
                const isUrgentSoon = daysLeft >= 0 && daysLeft <= 3;
                return (
                  <div key={r.id} className="px-5 py-3.5 flex items-center gap-4 hover:bg-slate-50/80 transition-colors">
                    <PriorityBadge priority={r.priority} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900">
                        {patient.firstName} {patient.lastName}
                      </p>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">{patient.nhi}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {isOverdue ? (
                        <span className="text-xs font-semibold text-red-600 animate-pulse">
                          {Math.abs(daysLeft)}d overdue
                        </span>
                      ) : isUrgentSoon ? (
                        <span className="text-xs font-semibold text-amber-600">{daysLeft}d left</span>
                      ) : (
                        <span className="text-xs text-slate-400">{daysLeft}d left</span>
                      )}
                      <p className="text-[10px] text-slate-300 mt-0.5">Referred {daysSince}d ago</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Pathway distribution — 1/3 width */}
        <Card>
          <CardHeader>
            <CardTitle>Pathway Distribution</CardTitle>
          </CardHeader>
          <CardContent className="py-3">
            {pathwayDist.length === 0 ? (
              <EmptyState
                icon={TrendingUp}
                title="No data yet"
                description="Sessions will appear here once recorded."
              />
            ) : (
              <div className="space-y-3">
                {pathwayDist.sort((a, b) => b._count - a._count).slice(0, 7).map(item => {
                  const pct = Math.round((item._count / totalSessions) * 100);
                  return (
                    <div key={item.activeModule}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs text-slate-600 truncate pr-2" title={figureLabels[item.activeModule ?? ""]}>
                          {figureLabels[item.activeModule ?? ""] ?? item.activeModule}
                        </span>
                        <span className="text-xs font-semibold text-slate-900 flex-shrink-0">{pct}%</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-1.5 bg-brand-500 rounded-full transition-all duration-500"
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

      {/* Recent activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        {recentActivity.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="No recent activity"
            description="Pathway sessions will appear here as they are recorded."
          />
        ) : (
          <div className="divide-y divide-slate-50">
            {recentActivity.map((entry, i) => {
              const patient = entry.screeningSession.patient;
              const timeAgo = formatRelativeTime(new Date(entry.createdAt));
              return (
                <div key={entry.id} className="px-5 py-3 flex items-center gap-4 animate-fade-in" style={{ animationDelay: `${i * 30}ms` }}>
                  <div className="w-8 h-8 rounded-full bg-brand-50 flex items-center justify-center flex-shrink-0">
                    <GitBranch className="h-4 w-4 text-brand-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-900">
                      <span className="font-semibold">{patient.firstName} {patient.lastName}</span>
                      <span className="text-slate-400 mx-1">·</span>
                      <span className="text-slate-600">{figureLabels[entry.toState ?? ""] ?? entry.toState}</span>
                    </p>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">{patient.nhi}</p>
                  </div>
                  <span className="text-xs text-slate-400 flex-shrink-0">{timeAgo}</span>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
