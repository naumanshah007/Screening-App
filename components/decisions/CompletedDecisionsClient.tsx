"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Download,
  Eye,
  FileCheck2,
  FileJson,
  FileText,
  Loader2,
  Search,
} from "lucide-react";

import { Badge, PriorityBadge, RiskBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input, Select } from "@/components/ui/input";
import { Tab, TabList, TabPanel, Tabs } from "@/components/ui/tabs";
import {
  serialiseCsvRow,
  type SimulatedDecisionPackage,
} from "@/lib/decisions/package-generator";
import { cn } from "@/lib/utils";

export type CompletedDecisionRow = {
  id: string;
  patientName: string;
  nhi: string;
  patientAge: number | null;
  gpPractice: string;
  sourceSystem: string;
  source: string;
  intakeSessionId: string;
  originalRecommendation: string;
  recommendationCode: string;
  disposition: "ACCEPTED" | "REJECTED";
  finalDecision: string;
  reviewer: string;
  reviewedAt: string;
  reason: string;
  packageStatus: string;
  referralPriority: string | null;
  riskLevel: string;
  mandatoryReview: boolean;
  urgentClinicalPriority: boolean;
};

export type CompletedDecisionFilters = {
  disposition?: string;
  source?: string;
  reviewerId?: string;
  urgency?: string;
  dateFrom?: string;
  dateTo?: string;
  q?: string;
};

type FilterOption = { value: string; label: string };

const DISPOSITION_BADGE: Record<
  CompletedDecisionRow["disposition"],
  { variant: "low" | "urgent" | "info"; label: string }
> = {
  ACCEPTED: { variant: "low", label: "Accepted" },
  REJECTED: { variant: "urgent", label: "Rejected" },
};

const EXPORT_FORMATS = [
  { format: "csv", label: "CSV export", icon: FileText },
  { format: "fhir", label: "FHIR-like JSON", icon: FileJson },
  { format: "hl7", label: "HL7-style message", icon: FileText },
  { format: "json", label: "Full package JSON", icon: Download },
] as const;

function PreviewBlock({ children }: { children: string }) {
  return (
    <pre className="max-h-[420px] overflow-auto rounded-lg border border-border bg-muted/35 p-4 text-xs leading-relaxed text-foreground">
      {children}
    </pre>
  );
}

function Field({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className={cn("mt-1 text-sm text-foreground", mono && "break-all font-mono text-xs")}>{value || "—"}</dd>
    </div>
  );
}

export function CompletedDecisionsClient({
  rows,
  filters,
  sources,
  reviewers,
  canFilterReviewer,
}: {
  rows: CompletedDecisionRow[];
  filters: CompletedDecisionFilters;
  sources: FilterOption[];
  reviewers: FilterOption[];
  canFilterReviewer: boolean;
}) {
  const [selectedRow, setSelectedRow] = useState<CompletedDecisionRow | null>(null);
  const [preview, setPreview] = useState<SimulatedDecisionPackage | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);

  async function openPreview(row: CompletedDecisionRow) {
    setSelectedRow(row);
    setPreview(null);
    setPreviewError("");
    setPreviewLoading(true);
    try {
      const res = await fetch(`/api/decisions/${row.id}/package/preview`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setPreview(await res.json());
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : "Preview failed.");
    } finally {
      setPreviewLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="py-4">
          <form action="/decisions" className="grid gap-3 lg:grid-cols-12">
            <div className="lg:col-span-2">
              <Select
                label="Decision"
                name="disposition"
                defaultValue={filters.disposition ?? ""}
                placeholder="All decisions"
                options={[
                  { value: "ACCEPTED", label: "Accepted" },
                  { value: "REJECTED", label: "Rejected" },
                ]}
              />
            </div>
            <div className="lg:col-span-2">
              <Select
                label="Source"
                name="source"
                defaultValue={filters.source ?? ""}
                placeholder="All sources"
                options={sources}
              />
            </div>
            <div className="lg:col-span-2">
              <Select
                label="Urgency"
                name="urgency"
                defaultValue={filters.urgency ?? ""}
                placeholder="All urgency"
                options={[
                  { value: "urgent", label: "Urgent clinical priority" },
                  { value: "mandatory", label: "Mandatory review" },
                  { value: "routine", label: "Routine" },
                ]}
              />
            </div>
            {canFilterReviewer && (
              <div className="lg:col-span-2">
                <Select
                  label="Reviewer"
                  name="reviewerId"
                  defaultValue={filters.reviewerId ?? ""}
                  placeholder="All reviewers"
                  options={reviewers}
                />
              </div>
            )}
            <div className={cn(canFilterReviewer ? "lg:col-span-2" : "lg:col-span-3")}>
              <Input label="From" name="dateFrom" type="date" defaultValue={filters.dateFrom ?? ""} />
            </div>
            <div className={cn(canFilterReviewer ? "lg:col-span-2" : "lg:col-span-3")}>
              <Input label="To" name="dateTo" type="date" defaultValue={filters.dateTo ?? ""} />
            </div>
            <div className="lg:col-span-8">
              <Input
                label="Search"
                name="q"
                defaultValue={filters.q ?? ""}
                placeholder="Patient, NHI/source ID, or GP/referrer"
                maxLength={80}
                icon={<Search className="h-4 w-4" />}
              />
            </div>
            <div className="lg:col-span-4 flex items-end gap-2">
              <Button type="submit" className="flex-1">Apply filters</Button>
              <Link
                href="/decisions"
                className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-card px-4 text-sm font-medium text-foreground shadow-sm hover:bg-muted"
              >
                Reset
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="max-w-full overflow-x-auto overscroll-x-contain">
            <table className="min-w-[1220px] w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2.5 min-w-[230px]">Patient</th>
                  <th className="px-3 py-2.5 min-w-[170px]">Source</th>
                  <th className="px-3 py-2.5 min-w-[240px]">Original recommendation</th>
                  <th className="px-3 py-2.5">Final decision</th>
                  <th className="px-3 py-2.5 min-w-[190px]">Reviewer</th>
                  <th className="px-3 py-2.5 min-w-[180px]">Reason / note</th>
                  <th className="px-3 py-2.5">Package</th>
                  <th className="px-3 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const disposition = DISPOSITION_BADGE[row.disposition];
                  return (
                    <tr key={row.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30">
                      <td className="px-3 py-3 align-top">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-medium text-foreground">{row.patientName}</span>
                          {row.urgentClinicalPriority && (
                            <Badge variant="urgent" size="sm">Urgent clinical priority</Badge>
                          )}
                          {row.mandatoryReview && (
                            <Badge variant="high" size="sm">Mandatory clinician review</Badge>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          <span className="font-mono">{row.nhi}</span>
                          {row.patientAge != null && <> · {row.patientAge} yrs</>}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground truncate max-w-[260px]">
                          {row.gpPractice}
                        </p>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <p className="text-foreground">{row.sourceSystem}</p>
                        <Link
                          href={`/batch/runs/${row.intakeSessionId}`}
                          className="text-xs text-brand-600 dark:text-brand-400 hover:underline"
                        >
                          Intake session
                        </Link>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <p className="line-clamp-2 text-foreground">{row.originalRecommendation}</p>
                        <p className="mt-0.5 text-xs font-mono text-muted-foreground">{row.recommendationCode}</p>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          <RiskBadge risk={row.riskLevel} />
                          {row.referralPriority && <PriorityBadge priority={row.referralPriority} />}
                        </div>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <Badge variant={disposition.variant}>{disposition.label}</Badge>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <p className="text-foreground">{row.reviewer}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{row.reviewedAt}</p>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <p className="line-clamp-3 text-muted-foreground">{row.reason}</p>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <Badge variant="info">{row.packageStatus}</Badge>
                        <p className="mt-1 text-xs text-muted-foreground">Simulated export</p>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <div className="flex justify-end gap-1 whitespace-nowrap">
                          <Link href={`/batch/runs/${row.intakeSessionId}`}>
                            <Button size="xs" variant="ghost" icon={<Eye className="h-3.5 w-3.5" />}>
                              Open
                            </Button>
                          </Link>
                          <Button
                            size="xs"
                            variant="outline"
                            onClick={() => void openPreview(row)}
                            icon={<FileCheck2 className="h-3.5 w-3.5" />}
                          >
                            Preview package
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-12 text-center text-sm text-muted-foreground">
                      No completed decisions match these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(selectedRow)}
        onClose={() => {
          setSelectedRow(null);
          setPreview(null);
          setPreviewError("");
        }}
        size="xl"
        title="Preview integration-ready package"
        description={
          selectedRow
            ? `${selectedRow.patientName} · Prepared from reviewer-confirmed decision`
            : undefined
        }
        footer={
          preview && selectedRow ? (
            <div className="flex flex-wrap justify-end gap-2">
              {EXPORT_FORMATS.map(({ format, label, icon: Icon }) => (
                <a
                  key={format}
                  href={`/api/decisions/${selectedRow.id}/package/export?format=${format}`}
                  className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-medium text-foreground shadow-sm hover:bg-muted"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </a>
              ))}
            </div>
          ) : null
        }
      >
        {previewLoading && (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/35 px-4 py-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Preparing simulated export preview.
          </div>
        )}

        {previewError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/20 dark:text-red-300">
            {previewError}
          </div>
        )}

        {preview && (
          <Tabs defaultTab="summary" className="space-y-4">
            <TabList>
              <Tab id="summary">Summary</Tab>
              <Tab id="pas">Demo PAS update</Tab>
              <Tab id="letter">GP/referrer letter</Tab>
              <Tab id="csv">CSV row</Tab>
              <Tab id="fhir">FHIR-like JSON</Tab>
              <Tab id="hl7">HL7-style message</Tab>
              <Tab id="audit">Audit metadata</Tab>
            </TabList>

            <TabPanel id="summary">
              <dl className="grid gap-4 sm:grid-cols-2">
                <Field label="Package label" value={preview.summary.packageLabel} />
                <Field label="Clinical rule version" value={preview.summary.ruleVersion} />
                <Field label="Ruleset checksum" value={preview.summary.rulesetChecksum} mono />
                <Field label="Engine version" value={preview.summary.engineVersion} mono />
                <Field
                  label="Export evaluation authority"
                  value={preview.governedEvaluation?.authority ?? "Not recorded"}
                />
                <Field
                  label="Evaluation mode"
                  value={preview.governedEvaluation?.evaluationMode ?? "Not recorded"}
                  mono
                />
                <Field
                  label="Authority engine"
                  value={preview.governedEvaluation?.authorityEngine ?? "Not recorded"}
                />
                <Field
                  label="Authority reason"
                  value={preview.governedEvaluation?.authorityReason ?? "Not recorded"}
                />
                <Field label="Patient" value={preview.summary.patientDisplay} />
                <Field label="Source system" value={preview.summary.sourceSystem} />
                <Field label="Intake session" value={preview.summary.intakeSessionId} />
                <Field label="Final reviewer decision" value={preview.summary.finalReviewerDecision} />
                <Field label="Reviewer" value={preview.summary.reviewer} />
                <Field label="Reviewed at" value={preview.summary.reviewedAt} />
                <Field label="Safety notice" value={preview.summary.safetyNotice} />
              </dl>
            </TabPanel>

            <TabPanel id="pas" className="space-y-4">
              <dl className="grid gap-4 sm:grid-cols-2">
                <Field label="Status" value={preview.pasUpdate.bookingStatus} />
                <Field label="Priority" value={preview.pasUpdate.priority} />
              </dl>
              <div className="rounded-lg border border-border bg-muted/35 p-4 text-sm text-foreground">
                {preview.pasUpdate.notes}
              </div>
            </TabPanel>

            <TabPanel id="letter">
              <PreviewBlock>{preview.gpLetter.body}</PreviewBlock>
            </TabPanel>

            <TabPanel id="csv">
              <PreviewBlock>{serialiseCsvRow(preview.csvExportRow)}</PreviewBlock>
            </TabPanel>

            <TabPanel id="fhir">
              <PreviewBlock>{JSON.stringify(preview.fhirLikeJson, null, 2)}</PreviewBlock>
            </TabPanel>

            <TabPanel id="hl7">
              <PreviewBlock>{preview.hl7StyleMessage}</PreviewBlock>
            </TabPanel>

            <TabPanel id="audit">
              <PreviewBlock>{JSON.stringify(preview.auditMetadata, null, 2)}</PreviewBlock>
            </TabPanel>
          </Tabs>
        )}
      </Dialog>
    </div>
  );
}
