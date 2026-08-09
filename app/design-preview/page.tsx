"use client";

import { notFound } from "next/navigation";
import {
  Inbox, ShieldAlert, Siren, Database, FileCheck2, Clock,
} from "lucide-react";

import {
  PageShell, PageHeader, HeaderMeta, Panel, PanelInset, StatusBadge,
  MetricTile, MetricGrid, FilterBar, FilterPill, DataTable, StepTimeline,
  Timeline, riskTone, type Column,
} from "@/components/system";

/**
 * Development-only design harness.
 *
 * Renders the design system against synthetic data so page layout, density and
 * hierarchy can be reviewed without a database or a session. It is not part of
 * the product: the middleware only admits this path in development, and this
 * guard makes a production build 404 even if that check were ever loosened.
 *
 * All data below is invented for layout purposes. Nothing here is clinical
 * content and nothing is read from the database.
 */
type Row = {
  id: string;
  patient: string;
  nhi: string;
  risk: string;
  pathway: string;
  recommendation: string;
  waiting: string;
};

const ROWS: Row[] = [
  { id: "1", patient: "Aroha Ngata",       nhi: "ZAB1234", risk: "URGENT", pathway: "FIGURE_7",  recommendation: "Refer to colposcopy within 2 weeks", waiting: "3d" },
  { id: "2", patient: "Mei Wong",          nhi: "ZCD5678", risk: "HIGH",   pathway: "FIGURE_3",  recommendation: "Colposcopy referral, routine priority", waiting: "1d" },
  { id: "3", patient: "Patricia Williams", nhi: "ZEF9012", risk: "MEDIUM", pathway: "FIGURE_2",  recommendation: "Repeat HPV test in 12 months", waiting: "6h" },
  { id: "4", patient: "Linda Brown",       nhi: "ZGH3456", risk: "LOW",    pathway: "FIGURE_1",  recommendation: "Return to routine screening in 5 years", waiting: "2h" },
];

const COLUMNS: Column<Row>[] = [
  {
    key: "patient",
    header: "Patient",
    cell: (r) => (
      <div className="min-w-0 leading-tight">
        <div className="truncate font-medium text-foreground">{r.patient}</div>
        <div className="mt-0.5 truncate font-mono text-xs text-muted-foreground">{r.nhi}</div>
      </div>
    ),
  },
  { key: "risk", header: "Risk", cell: (r) => <StatusBadge tone={riskTone(r.risk)} size="sm">{r.risk}</StatusBadge> },
  { key: "pathway", header: "Pathway", cell: (r) => <span className="font-mono text-xs">{r.pathway}</span>, hideOnMobile: true },
  { key: "rec", header: "Provisional recommendation", cell: (r) => <span className="text-sm">{r.recommendation}</span> },
  { key: "waiting", header: "Waiting", cell: (r) => r.waiting, align: "right", numeric: true },
];

export default function DesignPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <div className="min-h-screen bg-bg">
      <PageShell width="wide">
        <PageHeader
          eyebrow="Design harness"
          title="Review Queue"
          description="Synthetic data. This page exists only to review layout, density and hierarchy of the shared design system."
          meta={
            <>
              <HeaderMeta label="Engine" value={<span className="font-mono">business-figures-table1-v1</span>} />
              <HeaderMeta label="Shadow" value={<span className="font-mono">CG-NCSP-3.1.0</span>} />
              <HeaderMeta label="Records" value="4" />
            </>
          }
          filters={
            <FilterBar>
              <FilterPill label="All" active count={4} onClick={() => {}} />
              <FilterPill label="Mandatory review" active={false} count={2} onClick={() => {}} />
              <FilterPill label="Urgent" active={false} count={1} onClick={() => {}} />
            </FilterBar>
          }
        />

        <MetricGrid columns={6}>
          <MetricTile label="Pending review" value={128} caption="Awaiting clinician" icon={<Inbox className="h-4.5 w-4.5" />} tone="brand" series={[12, 18, 15, 22, 19, 26, 31]} />
          <MetricTile label="Clinician review required" value={34} caption="Safety stop or evidence gap" icon={<ShieldAlert className="h-4.5 w-4.5" />} tone="warn" series={[4, 6, 5, 9, 7, 8, 11]} />
          <MetricTile label="Urgent clinical priority" value={7} caption="Urgent risk or P1" icon={<Siren className="h-4.5 w-4.5" />} tone="danger" series={[1, 2, 1, 3, 2, 2, 4]} />
          <MetricTile label="Cases pulled today" value={52} caption="Organisation intake" icon={<Database className="h-4.5 w-4.5" />} tone="neutral" />
          <MetricTile label="Completed this week" value={216} caption="Reviewer-confirmed" icon={<FileCheck2 className="h-4.5 w-4.5" />} tone="neutral" />
          <MetricTile label="Avg intake to decision" value="4h 12m" caption="Completed decisions" icon={<Clock className="h-4.5 w-4.5" />} tone="neutral" />
        </MetricGrid>

        <Panel title="Pending cases" description="Sorted by clinical priority" padded={false}>
          <DataTable columns={COLUMNS} rows={ROWS} rowKey={(r) => r.id} caption="Pending review cases" />
        </Panel>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <Panel title="Run lifecycle" className="xl:col-span-7">
            <StepTimeline
              steps={[
                { id: "a", label: "Pulled from source", state: "complete", caption: "HL7" },
                { id: "b", label: "Decision support run", state: "complete", caption: "52 cases" },
                { id: "c", label: "Added to Review Queue", state: "complete", caption: "9 Aug, 2:14 pm" },
                { id: "d", label: "Clinician review", state: "current", caption: "12 still pending" },
              ]}
            />
          </Panel>

          <Panel title="Provenance" className="xl:col-span-5">
            <PanelInset>
              <Timeline
                events={[
                  { id: "1", title: "Imported from source", timestamp: "9 Aug, 2:14 pm", description: "Awanui Labs (HL7v2) · row 18", tone: "neutral" },
                  { id: "2", title: "Evaluated by legacy engine", description: <span className="font-mono">business-figures-table1-v1</span>, tone: "brand" },
                  { id: "3", title: "Canonical shadow recorded", timestamp: "9 Aug, 2:15 pm", description: <span className="font-mono">SHADOW · checksum 3ab8657a13e7</span>, tone: "neutral" },
                ]}
              />
            </PanelInset>
          </Panel>
        </div>

        <Panel title="Authority comparison" description="Legacy is operative; canonical is shadow">
          <div className="space-y-2.5">
            <section className="overflow-hidden rounded-lg border border-border border-l-4 border-l-brand-600 bg-card shadow-card">
              <div className="flex flex-wrap items-center gap-2 border-b border-border bg-brand-50/60 px-4 py-2 dark:bg-brand-950/30">
                <StatusBadge tone="brand" size="sm" dot>Authoritative decision</StatusBadge>
                <StatusBadge tone="neutral" size="sm">Legacy engine</StatusBadge>
                <StatusBadge tone="danger" size="sm" className="ml-auto">Risk: URGENT</StatusBadge>
              </div>
              <div className="px-4 py-3">
                <p className="text-base font-semibold leading-snug text-foreground">Refer to colposcopy within 2 weeks</p>
                <dl className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
                  <div className="flex gap-1.5"><dt>Code</dt><dd className="font-mono font-medium text-foreground">F7-HSIL-URGENT</dd></div>
                  <div className="flex gap-1.5"><dt>Pathway</dt><dd className="font-mono font-medium text-foreground">FIGURE_7</dd></div>
                  <div className="flex gap-1.5"><dt>Priority</dt><dd className="font-medium text-foreground">P1</dd></div>
                </dl>
              </div>
            </section>
            <section className="rounded-lg border border-dashed border-border bg-muted/40 px-4 py-3">
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                <StatusBadge tone="canonical" size="sm">Canonical shadow — not authoritative</StatusBadge>
                <StatusBadge tone="neutral" size="sm" mono>CG-NCSP-3.1.0</StatusBadge>
                <StatusBadge tone="neutral" size="sm">DRAFT</StatusBadge>
                <StatusBadge tone="neutral" size="sm" mono>SHADOW</StatusBadge>
              </div>
              <p className="text-sm leading-snug text-muted-foreground">Refer to colposcopy; urgent where invasion is suspected</p>
              <div className="mt-2 text-xs text-muted-foreground">
                <span>Follow-up: </span>
                <span className="font-medium text-amber-700 dark:text-amber-300">Clinician timing required</span>
                <span> — source states “Urgent / within 2 weeks”</span>
              </div>
            </section>
          </div>
        </Panel>

        <Panel title="Empty and status treatments">
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge tone="warn" dot>Provisional · decision support</StatusBadge>
            <StatusBadge tone="danger">Urgent clinical priority</StatusBadge>
            <StatusBadge tone="success">Accepted</StatusBadge>
            <StatusBadge tone="info">Needs information</StatusBadge>
            <StatusBadge tone="canonical">Canonical shadow</StatusBadge>
            <StatusBadge tone="neutral" mono>business-figures-table1-v1</StatusBadge>
          </div>
        </Panel>
      </PageShell>
    </div>
  );
}
