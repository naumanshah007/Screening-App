import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardList, Clock3, FileWarning, Layers3, Plus, ChevronRight, Filter } from "lucide-react";
import { auth } from "@/lib/auth";
import { Badge, PriorityBadge, ServiceLineBadge, StatusBadge, WorkflowBadge } from "@/components/ui/badge";
import { PageIntro } from "@/components/layout/PageIntro";
import { Card, CardHeader, CardTitle, StatCard } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { buildOperationalState } from "@/lib/cases/operational";
import { getCaseSlaSnapshot, getServiceSlaSummary, getSlaBadgeVariant } from "@/lib/cases/sla";
import { prisma } from "@/lib/prisma";
import { buildReferralCaseWhere, listReferralCases } from "@/lib/cases/service";
import type { CaseSlaBucket } from "@/lib/cases/types";
import { formatDate, formatDateTime } from "@/lib/utils";
import { isFeatureEnabled } from "@/lib/features";
import { getWorkspaceContext } from "@/lib/workspace/context";
import { cn } from "@/lib/utils";

const SERVICE_LINE_OPTIONS = ["COLPOSCOPY", "GYNAECOLOGY"] as const;
const WORKFLOW_OPTIONS = ["PENDING_REVIEW", "BOOKABLE", "VIRTUAL_CLINIC", "RETURN_TO_GP", "NEEDS_MORE_INFO"] as const;
const STATUS_OPTIONS = ["READY_FOR_SUMMARY", "READY_FOR_GRADING", "NEEDS_MORE_INFO", "GRADED", "BOOKED"] as const;
const SLA_OPTIONS = ["OVERDUE", "DUE_SOON", "BOOKED", "ON_TRACK", "NO_TARGET"] as const satisfies readonly CaseSlaBucket[];

function getSingleValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
function isServiceLineOption(v: string | undefined): v is (typeof SERVICE_LINE_OPTIONS)[number] {
  return Boolean(v) && SERVICE_LINE_OPTIONS.includes(v as (typeof SERVICE_LINE_OPTIONS)[number]);
}
function isWorkflowOption(v: string | undefined): v is (typeof WORKFLOW_OPTIONS)[number] {
  return Boolean(v) && WORKFLOW_OPTIONS.includes(v as (typeof WORKFLOW_OPTIONS)[number]);
}
function isStatusOption(v: string | undefined): v is (typeof STATUS_OPTIONS)[number] {
  return Boolean(v) && STATUS_OPTIONS.includes(v as (typeof STATUS_OPTIONS)[number]);
}
function isSlaOption(v: string | undefined): v is CaseSlaBucket {
  return Boolean(v) && SLA_OPTIONS.includes(v as CaseSlaBucket);
}
function parseBooleanQuery(v: string | undefined) {
  if (!v) return undefined;
  return ["true", "1", "yes"].includes(v.toLowerCase()) ? true : ["false", "0", "no"].includes(v.toLowerCase()) ? false : undefined;
}
function buildCasesHref(args: { current: Record<string, string | string[] | undefined>; updates: Record<string, string | undefined> }) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(args.current)) { const sv = getSingleValue(v); if (sv) params.set(k, sv); }
  for (const [k, v] of Object.entries(args.updates)) { if (v) params.set(k, v); else params.delete(k); }
  const q = params.toString();
  return q ? `/cases?${q}` : "/cases";
}

function FilterChip({ active, href, children }: { active: boolean; href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-7 items-center rounded-full px-3 text-xs font-medium transition-all",
        active
          ? "bg-accent-color text-white shadow-sm"
          : "border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {children}
    </Link>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-label text-muted-foreground mb-2">{label}</div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

const STATUS_DISPLAY: Record<string, string> = {
  READY_FOR_SUMMARY: "Ready for summary",
  READY_FOR_GRADING: "Ready for grading",
  NEEDS_MORE_INFO: "Needs more info",
  GRADED: "Graded",
  BOOKED: "Booked",
};

const WORKFLOW_DISPLAY: Record<string, string> = {
  PENDING_REVIEW: "Pending review",
  BOOKABLE: "Bookable",
  VIRTUAL_CLINIC: "Virtual clinic",
  RETURN_TO_GP: "Return to GP",
  NEEDS_MORE_INFO: "Needs more info",
};

const SLA_DISPLAY: Record<string, string> = {
  OVERDUE: "Overdue",
  DUE_SOON: "Due soon",
  BOOKED: "Booked",
  ON_TRACK: "On track",
  NO_TARGET: "No target",
};

export default async function CasesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!isFeatureEnabled("casesV2")) notFound();

  const session = await auth();
  const user = session?.user as { role?: string } | undefined;
  const workspace = getWorkspaceContext(user?.role, true);
  const resolvedSearchParams = (await searchParams) ?? {};
  const serviceLineParam = getSingleValue(resolvedSearchParams.serviceLine);
  const statusParam = getSingleValue(resolvedSearchParams.status);
  const workflowParam = getSingleValue(resolvedSearchParams.workflow);
  const slaBucketParam = getSingleValue(resolvedSearchParams.slaBucket);
  const smoOnlyParam = getSingleValue(resolvedSearchParams.smoOnly);
  const selectedServiceLine = isServiceLineOption(serviceLineParam) ? serviceLineParam : undefined;
  const selectedStatus = isStatusOption(statusParam) ? statusParam : undefined;
  const selectedWorkflow = isWorkflowOption(workflowParam) ? workflowParam : undefined;
  const selectedSlaBucket = isSlaOption(slaBucketParam) ? slaBucketParam : undefined;
  const selectedSmoOnly = parseBooleanQuery(smoOnlyParam);

  const now = new Date();
  const statsWhere = buildReferralCaseWhere({ serviceLine: selectedServiceLine });
  const queueFilters = { serviceLine: selectedServiceLine, status: selectedStatus, workflow: selectedWorkflow, slaBucket: selectedSlaBucket, requiresSmoReview: selectedSmoOnly, page: 1, limit: 50 } as const;

  const [
    totalCases, readyForSummary, readyForGrading, urgentCases, overdueCases, bookedCases,
    pendingReviewCases, virtualClinicCases, returnToGpCases, needsMoreInfoCases, smoReviewCases,
    demoCases,
    queueResult,
  ] = await Promise.all([
    prisma.referralCase.count({ where: statsWhere }),
    prisma.referralCase.count({ where: { AND: [statsWhere, { status: "READY_FOR_SUMMARY" }] } }),
    prisma.referralCase.count({ where: { AND: [statsWhere, { status: "READY_FOR_GRADING" }] } }),
    prisma.referralCase.count({ where: { AND: [statsWhere, { currentPriority: { in: ["P1", "P1_HSC"] }, status: { notIn: ["CLOSED", "REJECTED", "RETURNED_TO_GP"] } }] } }),
    prisma.referralCase.count({ where: { AND: [statsWhere, { targetDueAt: { lt: now }, status: { in: ["GRADED", "READY_FOR_GRADING"] } }] } }),
    prisma.referralCase.count({ where: { AND: [statsWhere, { status: "BOOKED" }] } }),
    prisma.referralCase.count({ where: buildReferralCaseWhere({ serviceLine: selectedServiceLine, workflow: "PENDING_REVIEW" }) }),
    prisma.referralCase.count({ where: buildReferralCaseWhere({ serviceLine: selectedServiceLine, workflow: "VIRTUAL_CLINIC" }) }),
    prisma.referralCase.count({ where: buildReferralCaseWhere({ serviceLine: selectedServiceLine, workflow: "RETURN_TO_GP" }) }),
    prisma.referralCase.count({ where: buildReferralCaseWhere({ serviceLine: selectedServiceLine, workflow: "NEEDS_MORE_INFO" }) }),
    prisma.referralCase.count({ where: buildReferralCaseWhere({ serviceLine: selectedServiceLine, requiresSmoReview: true }) }),
    prisma.referralCase.findMany({
      where: {
        externalCaseId: { startsWith: "DEMO-" },
        deletedAt: null,
      },
      include: {
        patient: true,
        ruleDecision: true,
        clinicianDecision: true,
      },
      orderBy: { externalCaseId: "asc" },
      take: 8,
    }),
    listReferralCases(queueFilters),
  ]);

  const queueCases = queueResult.cases;
  const activeFilters = [selectedServiceLine, selectedStatus, selectedWorkflow, selectedSlaBucket, selectedSmoOnly].filter(Boolean).length;

  return (
    <div className="p-6 lg:p-8 max-w-[1440px] mx-auto space-y-6 animate-fade-in">
      <div className="page-aura">
        <PageIntro
          eyebrow={workspace.label}
          title="Referral Cases"
          description={`Enterprise case queue for colposcopy and gynaecology grading. ${getServiceSlaSummary(selectedServiceLine)}`}
          actions={[
            { href: "/cases/new", label: "New case", icon: <Plus className="h-4 w-4" /> },
            { href: "/analytics", label: "Analytics", variant: "outline" },
          ]}
        />
      </div>

      {/* ── Stats strip ── */}
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
        <StatCard label={selectedServiceLine ? (selectedServiceLine === "COLPOSCOPY" ? "Colposcopy" : "Gynaecology") : "All cases"} value={totalCases.toLocaleString()} subtext="Active referral cases" icon={<Layers3 className="h-5 w-5" />} />
        <StatCard label="Ready for summary" value={readyForSummary.toLocaleString()} variant={readyForSummary > 0 ? "warning" : "default"} icon={<ClipboardList className="h-5 w-5" />} />
        <StatCard label="Ready for grading" value={readyForGrading.toLocaleString()} icon={<Clock3 className="h-5 w-5" />} />
        <StatCard label="Urgent (P1)" value={urgentCases.toLocaleString()} variant={urgentCases > 0 ? "urgent" : "success"} icon={<FileWarning className="h-5 w-5" />} />
        <StatCard label="Overdue SLA" value={overdueCases.toLocaleString()} subtext={`${bookedCases} booked`} variant={overdueCases > 0 ? "urgent" : "default"} icon={<Clock3 className="h-5 w-5" />} />
      </div>

      {/* ── Routing summary ── */}
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
        {[
          { label: "Pending review", value: pendingReviewCases, variant: pendingReviewCases > 0 ? "warning" : "default" },
          { label: "Virtual clinic", value: virtualClinicCases, variant: virtualClinicCases > 0 ? "warning" : "default" },
          { label: "Needs more info", value: needsMoreInfoCases, variant: needsMoreInfoCases > 0 ? "warning" : "default" },
          { label: "Return to GP", value: returnToGpCases, variant: "default" },
          { label: "SMO only", value: smoReviewCases, variant: smoReviewCases > 0 ? "warning" : "default" },
        ].map(({ label, value, variant }) => (
          <div key={label} className={cn("rounded-xl border border-border bg-card px-4 py-3", variant === "warning" && value > 0 && "border-warn-border bg-warn-bg/30")}>
            <p className="text-label text-muted-foreground mb-1">{label}</p>
            <p className="text-2xl font-bold text-foreground tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      {demoCases.length > 0 && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Demo-ready cases</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Curated cases for the stakeholder walkthrough: clean colposcopy,
                missing history/NCSR dependency, clinician override, and
                gynaecology summary workflow.
              </p>
            </div>
            <Link href="/readiness" className="text-xs text-accent-color hover:opacity-80 font-medium">
              Readiness
            </Link>
          </CardHeader>
          <div className="grid grid-cols-1 gap-3 px-5 pb-5 md:grid-cols-2 xl:grid-cols-4">
            {demoCases.map((caseItem) => {
              const operationalState = buildOperationalState({
                priority:
                  caseItem.clinicianDecision?.finalPriority ??
                  caseItem.currentPriority ??
                  caseItem.ruleDecision?.priority ??
                  null,
                outcome:
                  caseItem.clinicianDecision?.finalOutcome ??
                  caseItem.ruleDecision?.outcome ??
                  null,
                requiresSmoReview: caseItem.smoOnly,
              });
              return (
                <Link
                  key={caseItem.id}
                  href={`/cases/${caseItem.id}/triage`}
                  className="rounded-xl border border-border bg-card px-4 py-4 transition-colors hover:bg-muted/40"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="info">{caseItem.externalCaseId}</Badge>
                    <ServiceLineBadge serviceLine={caseItem.serviceLine} />
                  </div>
                  <div className="mt-3 font-semibold text-foreground">
                    {caseItem.patient.firstName} {caseItem.patient.lastName}
                  </div>
                  <div className="mt-1 text-xs font-mono text-muted-foreground">
                    {caseItem.patient.nhi}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <StatusBadge status={caseItem.status} />
                    <WorkflowBadge workflow={operationalState.workflow} />
                    {caseItem.clinicianDecision?.overrideReason && (
                      <Badge variant="high">Override</Badge>
                    )}
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
                    {caseItem.referralReason}
                  </p>
                </Link>
              );
            })}
          </div>
        </Card>
      )}

      {/* ── Filters ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" aria-hidden />
            Filters
            {activeFilters > 0 && (
              <span className="ml-1 rounded-full bg-accent-color text-white text-xs px-2 py-0.5 font-semibold">{activeFilters}</span>
            )}
          </CardTitle>
          {activeFilters > 0 && (
            <Link href="/cases" className="text-xs text-accent-color hover:opacity-80 font-medium">Clear all</Link>
          )}
        </CardHeader>
        <div className="px-5 pb-5 space-y-4">
          <FilterGroup label="Service line">
            <FilterChip active={!selectedServiceLine} href={buildCasesHref({ current: resolvedSearchParams, updates: { serviceLine: undefined } })}>All</FilterChip>
            {SERVICE_LINE_OPTIONS.map((sl) => (
              <FilterChip key={sl} active={selectedServiceLine === sl} href={buildCasesHref({ current: resolvedSearchParams, updates: { serviceLine: sl } })}>
                {sl === "COLPOSCOPY" ? "Colposcopy" : "Gynaecology"}
              </FilterChip>
            ))}
          </FilterGroup>
          <FilterGroup label="Status">
            <FilterChip active={!selectedStatus} href={buildCasesHref({ current: resolvedSearchParams, updates: { status: undefined } })}>All</FilterChip>
            {STATUS_OPTIONS.map((s) => (
              <FilterChip key={s} active={selectedStatus === s} href={buildCasesHref({ current: resolvedSearchParams, updates: { status: s } })}>{STATUS_DISPLAY[s] ?? s}</FilterChip>
            ))}
          </FilterGroup>
          <FilterGroup label="Operational route">
            <FilterChip active={!selectedWorkflow} href={buildCasesHref({ current: resolvedSearchParams, updates: { workflow: undefined } })}>All</FilterChip>
            {WORKFLOW_OPTIONS.map((w) => (
              <FilterChip key={w} active={selectedWorkflow === w} href={buildCasesHref({ current: resolvedSearchParams, updates: { workflow: w } })}>{WORKFLOW_DISPLAY[w] ?? w}</FilterChip>
            ))}
          </FilterGroup>
          <FilterGroup label="SLA">
            <FilterChip active={!selectedSlaBucket} href={buildCasesHref({ current: resolvedSearchParams, updates: { slaBucket: undefined } })}>All</FilterChip>
            {SLA_OPTIONS.map((b) => (
              <FilterChip key={b} active={selectedSlaBucket === b} href={buildCasesHref({ current: resolvedSearchParams, updates: { slaBucket: b } })}>{SLA_DISPLAY[b] ?? b}</FilterChip>
            ))}
          </FilterGroup>
          <FilterGroup label="SMO review">
            <FilterChip active={selectedSmoOnly === undefined} href={buildCasesHref({ current: resolvedSearchParams, updates: { smoOnly: undefined } })}>All cases</FilterChip>
            <FilterChip active={selectedSmoOnly === true} href={buildCasesHref({ current: resolvedSearchParams, updates: { smoOnly: "true" } })}>SMO only</FilterChip>
            <FilterChip active={selectedSmoOnly === false} href={buildCasesHref({ current: resolvedSearchParams, updates: { smoOnly: "false" } })}>No SMO restriction</FilterChip>
          </FilterGroup>
        </div>
      </Card>

      {/* ── Queue table ── */}
      <Card>
        <CardHeader>
          <CardTitle>
            Queue
            <span className="ml-2 text-xs font-normal text-muted-foreground">({queueCases.length} shown)</span>
          </CardTitle>
          {queueCases.length > 0 && (
            <Link href="/cases/new">
              <span className="text-xs text-accent-color hover:opacity-80 font-medium flex items-center gap-1">
                <Plus className="h-3.5 w-3.5" /> New case
              </span>
            </Link>
          )}
        </CardHeader>
        {queueCases.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No cases match these filters"
            description="Adjust or clear the filters above to widen the queue view."
            action={{ href: "/cases/new", label: "Create case", variant: "primary" }}
            secondaryAction={{ href: "/cases", label: "Clear filters" }}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" role="grid" aria-label="Referral cases">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  {["Patient", "Service", "Status", "Priority", "Target date", "SLA", "Booked", "Assigned", "Received", ""].map((h) => (
                    <th key={h} scope="col" className="text-left px-4 py-3 text-label text-muted-foreground whitespace-nowrap font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {queueCases.map((caseItem) => {
                  const slaSnapshot = getCaseSlaSnapshot({
                    targetDueAt: caseItem.targetDueAt,
                    bookedForAt: caseItem.bookedForAt,
                    status: caseItem.status,
                    now,
                  });
                  const operationalState = buildOperationalState({
                    priority: caseItem.clinicianDecision?.finalPriority ?? caseItem.currentPriority ?? caseItem.ruleDecision?.priority ?? null,
                    outcome: caseItem.clinicianDecision?.finalOutcome ?? caseItem.ruleDecision?.outcome ?? null,
                    requiresSmoReview: caseItem.smoOnly,
                  });
                  const rowBg = slaSnapshot.kind === "overdue" ? "bg-danger-bg/30 hover:bg-danger-bg/50" : slaSnapshot.kind === "due_soon" ? "bg-warn-bg/30 hover:bg-warn-bg/50" : "hover:bg-muted/40";
                  return (
                    <tr key={caseItem.id} className={cn("border-b border-border transition-colors", rowBg)}>
                      <td className="px-4 py-3 align-middle">
                        <Link href={`/cases/${caseItem.id}`} className="block group">
                          <p className="font-semibold text-foreground group-hover:text-accent-color transition-colors">
                            {caseItem.patient.firstName} {caseItem.patient.lastName}
                          </p>
                          <p className="text-xs text-muted-foreground font-mono mt-0.5">{caseItem.patient.nhi}</p>
                        </Link>
                      </td>
                      <td className="px-4 py-3 align-middle"><ServiceLineBadge serviceLine={caseItem.serviceLine} /></td>
                      <td className="px-4 py-3 align-middle">
                        <div className="flex flex-wrap gap-1.5">
                          <StatusBadge status={caseItem.status} />
                          <WorkflowBadge workflow={operationalState.workflow} />
                          {operationalState.requiresSmoReview && <Badge variant="info">SMO</Badge>}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        {caseItem.currentPriority ? <PriorityBadge priority={caseItem.currentPriority} /> : <Badge>Unassigned</Badge>}
                        {operationalState.reason && <p className="mt-1 text-xs text-muted-foreground max-w-[180px]">{operationalState.reason}</p>}
                      </td>
                      <td className="px-4 py-3 align-middle text-sm text-muted-foreground whitespace-nowrap">{formatDate(caseItem.targetDueAt)}</td>
                      <td className="px-4 py-3 align-middle"><Badge variant={getSlaBadgeVariant(slaSnapshot.kind)}>{slaSnapshot.label}</Badge></td>
                      <td className="px-4 py-3 align-middle text-sm text-muted-foreground whitespace-nowrap">{formatDateTime(caseItem.bookedForAt)}</td>
                      <td className="px-4 py-3 align-middle text-sm text-muted-foreground">{caseItem.assignedTo?.name ?? <span className="text-muted-foreground/50">Unassigned</span>}</td>
                      <td className="px-4 py-3 align-middle text-sm text-muted-foreground whitespace-nowrap">{formatDateTime(caseItem.receivedAt)}</td>
                      <td className="px-4 py-3 align-middle">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/cases/${caseItem.id}/triage`} className="text-xs font-semibold text-success hover:opacity-80 transition-opacity">Triage</Link>
                          <Link href={`/cases/${caseItem.id}`}>
                            <span className="flex items-center gap-0.5 text-xs font-medium text-accent-color hover:opacity-80 transition-opacity">View <ChevronRight className="h-3 w-3" /></span>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
