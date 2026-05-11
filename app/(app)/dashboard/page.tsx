import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isAuthorizedForRoute } from "@/lib/auth/permissions";
import { isFeatureEnabled } from "@/lib/features";
import { StatCard, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, PriorityBadge, ServiceLineBadge, StatusBadge, WorkflowBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { formatRelativeTime } from "@/lib/utils";
import { getWorkflowSummary } from "@/lib/cases/concordance";
import Link from "next/link";
import {
  Users, ClipboardCheck, AlertTriangle, Activity, ArrowRight,
  GitBranch, Clock, TrendingUp, CheckCircle2, FileText,
  Stethoscope, Calendar, ChevronRight, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

type WorkflowSummaryData = {
  totalTracked: number;
  workflows: {
    PENDING_REVIEW: number;
    BOOKABLE: number;
    VIRTUAL_CLINIC: number;
    RETURN_TO_GP: number;
    NEEDS_MORE_INFO: number;
  };
  smoOnly: number;
};

type RoleFocusAction = {
  title: string;
  description: string;
  href: string;
  buttonLabel: string;
  count: number;
};

function getRoleFocusConfig(args: {
  role?: string;
  overdueCases: number;
  totalNeedsMoreInfo: number;
  totalPendingReview: number;
  totalSmoOnly: number;
  colpo: WorkflowSummaryData;
  gynae: WorkflowSummaryData;
}) {
  switch (args.role) {
    case "COORDINATOR":
      return {
        title: "Your focus today",
        actions: [
          { title: "Awaiting review", description: "Cases without a recommendation or final route.", href: "/cases?workflow=PENDING_REVIEW", buttonLabel: "Open queue", count: args.totalPendingReview },
          { title: "Missing information", description: "Referrals blocked by incomplete evidence.", href: "/cases?workflow=NEEDS_MORE_INFO", buttonLabel: "Resolve", count: args.totalNeedsMoreInfo },
          { title: "Overdue SLA", description: "Past the target booking date.", href: "/cases?slaBucket=OVERDUE", buttonLabel: "View overdue", count: args.overdueCases },
        ] satisfies RoleFocusAction[],
      };
    case "COLPO_CNS":
      return {
        title: "Your focus today",
        actions: [
          { title: "Pending colposcopy", description: "Need a recommendation or clinical route.", href: "/cases?serviceLine=COLPOSCOPY&workflow=PENDING_REVIEW", buttonLabel: "Open queue", count: args.colpo.workflows.PENDING_REVIEW },
          { title: "Evidence gaps", description: "Referrals blocked on missing information.", href: "/cases?serviceLine=COLPOSCOPY&workflow=NEEDS_MORE_INFO", buttonLabel: "Resolve", count: args.colpo.workflows.NEEDS_MORE_INFO },
          { title: "SMO review needed", description: "Colposcopy cases requiring senior sign-off.", href: "/cases?serviceLine=COLPOSCOPY&smoOnly=true", buttonLabel: "SMO queue", count: args.colpo.smoOnly },
        ] satisfies RoleFocusAction[],
      };
    case "COLPOSCOPIST":
      return {
        title: "Your focus today",
        actions: [
          { title: "Pending review", description: "Need recommendation review or final decision.", href: "/cases?serviceLine=COLPOSCOPY&workflow=PENDING_REVIEW", buttonLabel: "Review", count: args.colpo.workflows.PENDING_REVIEW },
          { title: "Virtual clinic", description: "Non-bookable outcomes needing oversight.", href: "/cases?serviceLine=COLPOSCOPY&workflow=VIRTUAL_CLINIC", buttonLabel: "View virtual", count: args.colpo.workflows.VIRTUAL_CLINIC },
          { title: "Return to GP", description: "Declined or rejected cases to review.", href: "/cases?serviceLine=COLPOSCOPY&workflow=RETURN_TO_GP", buttonLabel: "View returns", count: args.colpo.workflows.RETURN_TO_GP },
        ] satisfies RoleFocusAction[],
      };
    case "GYNAE_GRADER":
      return {
        title: "Your focus today",
        actions: [
          { title: "Pending gynaecology", description: "Need a recommendation or clinician decision.", href: "/cases?serviceLine=GYNAECOLOGY&workflow=PENDING_REVIEW", buttonLabel: "Open queue", count: args.gynae.workflows.PENDING_REVIEW },
          { title: "Evidence gaps", description: "Blocked by incomplete summaries or info.", href: "/cases?serviceLine=GYNAECOLOGY&workflow=NEEDS_MORE_INFO", buttonLabel: "Resolve", count: args.gynae.workflows.NEEDS_MORE_INFO },
          { title: "Virtual clinic", description: "Non-bookable routes needing review.", href: "/cases?serviceLine=GYNAECOLOGY&workflow=VIRTUAL_CLINIC", buttonLabel: "View virtual", count: args.gynae.workflows.VIRTUAL_CLINIC },
        ] satisfies RoleFocusAction[],
      };
    case "SMO_REVIEWER":
      return {
        title: "Your focus today",
        actions: [
          { title: "All SMO-only cases", description: "Combined queue for senior review.", href: "/cases?smoOnly=true", buttonLabel: "SMO queue", count: args.totalSmoOnly },
          { title: "Colposcopy SMO", description: "Senior-review cases in colposcopy.", href: "/cases?serviceLine=COLPOSCOPY&smoOnly=true", buttonLabel: "Colpo SMO", count: args.colpo.smoOnly },
          { title: "Gynaecology SMO", description: "Senior-review cases in gynaecology.", href: "/cases?serviceLine=GYNAECOLOGY&smoOnly=true", buttonLabel: "Gynae SMO", count: args.gynae.smoOnly },
        ] satisfies RoleFocusAction[],
      };
    case "ADMIN":
      return {
        title: "Your focus today",
        actions: [
          { title: "Overdue SLA", description: "Strongest signal of operational risk.", href: "/cases?slaBucket=OVERDUE", buttonLabel: "View overdue", count: args.overdueCases },
          { title: "Awaiting review", description: "Cases without a final decision.", href: "/cases?workflow=PENDING_REVIEW", buttonLabel: "Open queue", count: args.totalPendingReview },
          { title: "SMO bottlenecks", description: "Cases already marked for escalation.", href: "/cases?smoOnly=true", buttonLabel: "SMO queue", count: args.totalSmoOnly },
        ] satisfies RoleFocusAction[],
      };
    default:
      return {
        title: "What to do next",
        actions: [
          { title: "Awaiting review", description: "Cases without a final operational route.", href: "/cases?workflow=PENDING_REVIEW", buttonLabel: "Open queue", count: args.totalPendingReview },
          { title: "Missing information", description: "Referrals blocked by incomplete evidence.", href: "/cases?workflow=NEEDS_MORE_INFO", buttonLabel: "Resolve", count: args.totalNeedsMoreInfo },
          { title: "SMO bottlenecks", description: "Cases marked for senior escalation.", href: "/cases?smoOnly=true", buttonLabel: "SMO queue", count: args.totalSmoOnly },
        ] satisfies RoleFocusAction[],
      };
  }
}

const FIGURE_LABELS: Record<string, string> = {
  FIGURE_1: "HPV transition",
  FIGURE_2: "History transition",
  FIGURE_3: "Primary HPV",
  FIGURE_4: "Post-colposcopy follow-up",
  FIGURE_5: "High-grade colposcopy follow-up",
  FIGURE_6: "Test of Cure",
  FIGURE_7: "Glandular",
  FIGURE_8: "Post-hysterectomy",
  FIGURE_9: "Pregnancy pathway",
  FIGURE_10: "Abnormal bleeding",
  TABLE_1: "Post-hysterectomy table",
};

export default async function DashboardPage() {
  const session = await auth();
  const user = session?.user as { name?: string; role?: string; id?: string };
  const now = new Date();
  const firstName = user?.name?.split(" ")[0] ?? "there";
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const showCasesV2 = isFeatureEnabled("casesV2");
  const canAccessCases = showCasesV2 && isAuthorizedForRoute("/cases", user?.role);

  const enterpriseStats = canAccessCases
    ? await Promise.all([
        prisma.referralCase.count({ where: { status: { notIn: ["REJECTED", "RETURNED_TO_GP", "CLOSED"] } } }),
        prisma.referralCase.count({ where: { status: { in: ["READY_FOR_SUMMARY", "READY_FOR_GRADING"] } } }),
        prisma.referralCase.count({ where: { status: { notIn: ["REJECTED", "RETURNED_TO_GP", "CLOSED"] }, targetDueAt: { lt: now } } }),
        prisma.referralCase.count({ where: { status: "GRADED", updatedAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) } } }),
        prisma.referralCase.count({ where: { serviceLine: "COLPOSCOPY", status: { notIn: ["REJECTED", "RETURNED_TO_GP", "CLOSED"] } } }),
        prisma.referralCase.count({ where: { serviceLine: "GYNAECOLOGY", status: { notIn: ["REJECTED", "RETURNED_TO_GP", "CLOSED"] } } }),
        prisma.referralCase.findMany({
          where: { status: { notIn: ["REJECTED", "RETURNED_TO_GP", "CLOSED"] } },
          include: {
            patient: { select: { firstName: true, lastName: true, nhi: true } },
            clinicianDecision: { select: { finalPriority: true, finalCategory: true } },
          },
          orderBy: { updatedAt: "desc" },
          take: 6,
        }),
        getWorkflowSummary("COLPOSCOPY"),
        getWorkflowSummary("GYNAECOLOGY"),
      ])
    : null;

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
    prisma.screeningSession.count({ where: { createdAt: { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) } } }),
    prisma.referral.findMany({
      where: { priority: { in: ["P1", "P2"] }, status: { in: ["PENDING", "APPROVED"] } },
      include: { screeningSession: { include: { patient: { select: { nhi: true, firstName: true, lastName: true } } } } },
      orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
      take: 6,
    }),
    prisma.screeningSession.groupBy({ by: ["activeModule"], _count: true, where: { activeModule: { not: null } } }),
    prisma.pathwayStateHistory.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { screeningSession: { include: { patient: { select: { firstName: true, lastName: true, nhi: true } } } } },
    }),
  ]);

  const totalSessions = pathwayDist.reduce((s, i) => s + i._count, 0);

  const enterpriseWorkflowTotals = enterpriseStats ? {
    pendingReview:  enterpriseStats[7].workflows.PENDING_REVIEW + enterpriseStats[8].workflows.PENDING_REVIEW,
    needsMoreInfo:  enterpriseStats[7].workflows.NEEDS_MORE_INFO + enterpriseStats[8].workflows.NEEDS_MORE_INFO,
    virtualClinic:  enterpriseStats[7].workflows.VIRTUAL_CLINIC + enterpriseStats[8].workflows.VIRTUAL_CLINIC,
    returnToGp:     enterpriseStats[7].workflows.RETURN_TO_GP + enterpriseStats[8].workflows.RETURN_TO_GP,
    smoOnly:        enterpriseStats[7].smoOnly + enterpriseStats[8].smoOnly,
  } : null;

  const roleFocusConfig = enterpriseStats ? getRoleFocusConfig({
    role: user?.role,
    overdueCases: enterpriseStats[2],
    totalNeedsMoreInfo: enterpriseWorkflowTotals?.needsMoreInfo ?? 0,
    totalPendingReview: enterpriseWorkflowTotals?.pendingReview ?? 0,
    totalSmoOnly: enterpriseWorkflowTotals?.smoOnly ?? 0,
    colpo: enterpriseStats[7],
    gynae: enterpriseStats[8],
  }) : null;

  return (
    <div className="p-6 lg:p-8 max-w-[1440px] mx-auto space-y-8 animate-fade-in">

      {/* ── Page header ─────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-h2 text-foreground">
            {greeting}, {firstName}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
            {now.toLocaleDateString("en-NZ", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            {p1Referrals > 0 && (
              <span className="inline-flex items-center gap-1 text-destructive font-medium">
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                {p1Referrals} urgent {p1Referrals === 1 ? "referral" : "referrals"}
              </span>
            )}
          </p>
        </div>
        <Link href="/pathway">
          <Button size="md" icon={<GitBranch className="h-4 w-4" />}>New pathway</Button>
        </Link>
      </div>

      {/* ── Enterprise Case Management ───────────────────────────── */}
      {canAccessCases && enterpriseStats && (
        <>
          {/* SLA stat strip */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard
              label="Active cases"
              value={enterpriseStats[0].toLocaleString()}
              subtext={`${enterpriseStats[4]} colpo · ${enterpriseStats[5]} gynae`}
              icon={<FileText className="h-5 w-5" />}
            />
            <StatCard
              label="Awaiting grading"
              value={enterpriseStats[1].toLocaleString()}
              subtext="Ready for summary or grading"
              variant={enterpriseStats[1] > 5 ? "warning" : "default"}
              icon={<Stethoscope className="h-5 w-5" />}
            />
            <StatCard
              label="Overdue SLA"
              value={enterpriseStats[2].toLocaleString()}
              subtext="Past target date"
              variant={enterpriseStats[2] > 0 ? "urgent" : "success"}
              icon={<AlertTriangle className="h-5 w-5" />}
            />
            <StatCard
              label="Graded today"
              value={enterpriseStats[3].toLocaleString()}
              subtext="Clinician decisions made"
              icon={<Calendar className="h-5 w-5" />}
            />
          </div>

          {/* Operational snapshot + role focus */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Operational snapshot */}
            <Card>
              <CardHeader>
                <CardTitle>Operational snapshot</CardTitle>
                <Link href="/cases" className="text-xs text-accent-color hover:opacity-80 font-medium flex items-center gap-1">
                  All cases <ArrowRight className="h-3 w-3" />
                </Link>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { workflow: "PENDING_REVIEW", count: enterpriseWorkflowTotals?.pendingReview ?? 0, note: "Need a recommendation or decision" },
                    { workflow: "NEEDS_MORE_INFO", count: enterpriseWorkflowTotals?.needsMoreInfo ?? 0, note: "Blocked on missing evidence" },
                    { workflow: "VIRTUAL_CLINIC", count: enterpriseWorkflowTotals?.virtualClinic ?? 0, note: "Non-bookable outcomes" },
                  ].map(({ workflow, count, note }) => (
                    <div key={workflow} className="rounded-xl border border-border bg-surface-raised px-4 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <WorkflowBadge workflow={workflow} />
                        <span className="text-xl font-bold text-foreground tabular-nums">{count}</span>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">{note}</p>
                    </div>
                  ))}
                  <div className="rounded-xl border border-border bg-surface-raised px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="info">SMO only</Badge>
                      <span className="text-xl font-bold text-foreground tabular-nums">{enterpriseWorkflowTotals?.smoOnly ?? 0}</span>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">Need senior sign-off</p>
                  </div>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { line: "COLPOSCOPY", data: enterpriseStats[7] },
                    { line: "GYNAECOLOGY", data: enterpriseStats[8] },
                  ].map(({ line, data }) => (
                    <div key={line} className="rounded-lg border border-border bg-card px-3 py-3">
                      <div className="flex items-center justify-between mb-1">
                        <ServiceLineBadge serviceLine={line} />
                        <span className="font-semibold text-foreground text-sm tabular-nums">{data.totalTracked}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {data.workflows.PENDING_REVIEW} pending · {data.smoOnly} SMO
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Role focus */}
            <Card>
              <CardHeader>
                <CardTitle>
                  <span className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-accent-color" aria-hidden />
                    {roleFocusConfig?.title ?? "What to do next"}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {roleFocusConfig?.actions.map((action) => (
                  <div key={action.href} className="flex items-center gap-3 rounded-xl border border-border bg-surface-raised px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-semibold text-foreground">{action.title}</p>
                        <Badge
                          variant={action.count > 0 ? (action.href.includes("OVERDUE") ? "urgent" : "info") : "default"}
                        >
                          {action.count}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{action.description}</p>
                    </div>
                    <Link href={action.href} className="flex-shrink-0">
                      <Button variant="outline" size="sm">{action.buttonLabel}</Button>
                    </Link>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Recent cases */}
          <Card>
            <CardHeader>
              <CardTitle>Recent cases</CardTitle>
              <Link href="/cases" className="text-xs text-accent-color hover:opacity-80 font-medium flex items-center gap-1">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </CardHeader>
            {enterpriseStats[6].length === 0 ? (
              <EmptyState icon={FileText} title="No active cases" description="Create a referral case to get started." action={{ href: "/cases/new", label: "New case", variant: "outline" }} />
            ) : (
              <div className="divide-y divide-border">
                {enterpriseStats[6].map((c) => (
                  <Link key={c.id} href={`/cases/${c.id}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/40 transition-colors group">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{c.patient.firstName} {c.patient.lastName}</p>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">{c.patient.nhi}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
                      <ServiceLineBadge serviceLine={c.serviceLine} />
                      <StatusBadge status={c.status} />
                      {c.currentPriority && <PriorityBadge priority={c.currentPriority} />}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" aria-hidden />
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </>
      )}

      {/* ── Legacy KPI strip ───────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Active patients" value={totalActivePatients.toLocaleString()} subtext="On screening register" icon={<Users className="h-5 w-5" />} />
        <StatCard label="Overdue recalls" value={overdueRecalls.toLocaleString()} subtext="Past due date" variant={overdueRecalls > 0 ? "urgent" : "success"} icon={<Clock className="h-5 w-5" />} />
        <StatCard label="Pending referrals" value={pendingReferrals.toLocaleString()} subtext="Awaiting review" variant={pendingReferrals > 5 ? "warning" : "default"} icon={<ClipboardCheck className="h-5 w-5" />} />
        <StatCard label="Sessions (30 days)" value={recentSessions.toLocaleString()} subtext="Pathway sessions" icon={<Activity className="h-5 w-5" />} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Urgent referrals */}
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Urgent referrals</CardTitle>
            <Link href="/coordinator" className="text-xs text-accent-color hover:opacity-80 font-medium flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          {urgentReferrals.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="All clear" description="No urgent P1/P2 referrals pending." size="sm" />
          ) : (
            <div className="divide-y divide-border">
              {urgentReferrals.map((r) => {
                const patient = r.screeningSession.patient;
                const daysSince = Math.floor((now.getTime() - new Date(r.createdAt).getTime()) / 86400000);
                const targetDays = r.priority === "P1" ? 20 : 42;
                const daysLeft = targetDays - daysSince;
                const isOverdue = daysLeft < 0;
                const isDueSoon = daysLeft >= 0 && daysLeft <= 3;
                return (
                  <div key={r.id} className="px-5 py-3.5 flex items-center gap-4">
                    <PriorityBadge priority={r.priority} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{patient.firstName} {patient.lastName}</p>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">{patient.nhi}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={cn("text-xs font-semibold", isOverdue ? "text-destructive" : isDueSoon ? "text-warn" : "text-muted-foreground")}>
                        {isOverdue ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{daysSince}d ago</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Pathway distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Pathway distribution</CardTitle>
          </CardHeader>
          <CardContent className="py-3">
            {pathwayDist.length === 0 ? (
              <EmptyState icon={TrendingUp} title="No data yet" description="Sessions will appear once recorded." size="sm" />
            ) : (
              <div className="space-y-3">
                {pathwayDist.sort((a, b) => b._count - a._count).slice(0, 7).map((item) => {
                  const pct = Math.round((item._count / totalSessions) * 100);
                  return (
                    <div key={item.activeModule}>
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-xs text-muted-foreground truncate pr-2" title={FIGURE_LABELS[item.activeModule ?? ""]}>
                          {FIGURE_LABELS[item.activeModule ?? ""] ?? item.activeModule}
                        </span>
                        <span className="text-xs font-semibold text-foreground flex-shrink-0 tabular-nums">{pct}%</span>
                      </div>
                      <Progress value={pct} label={FIGURE_LABELS[item.activeModule ?? ""]} />
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
          <CardTitle>Recent activity</CardTitle>
        </CardHeader>
        {recentActivity.length === 0 ? (
          <EmptyState icon={Activity} title="No recent activity" description="Pathway sessions will appear here as they are recorded." size="sm" />
        ) : (
          <div className="divide-y divide-border">
            {recentActivity.map((entry, i) => {
              const patient = entry.screeningSession.patient;
              const timeAgo = formatRelativeTime(new Date(entry.createdAt));
              return (
                <div key={entry.id} className="px-5 py-3 flex items-center gap-4 animate-fade-in" style={{ animationDelay: `${i * 25}ms` }}>
                  <div className="w-8 h-8 rounded-full bg-brand-50 flex items-center justify-center flex-shrink-0">
                    <GitBranch className="h-4 w-4 text-brand-600" aria-hidden />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">
                      <span className="font-semibold">{patient.firstName} {patient.lastName}</span>
                      <span className="text-muted-foreground mx-1.5" aria-hidden>·</span>
                      <span className="text-muted-foreground">{FIGURE_LABELS[entry.toState ?? ""] ?? entry.toState}</span>
                    </p>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">{patient.nhi}</p>
                  </div>
                  <span className="text-xs text-muted-foreground flex-shrink-0">{timeAgo}</span>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
