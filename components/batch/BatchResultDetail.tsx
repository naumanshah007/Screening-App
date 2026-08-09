"use client";

import {
  ArrowUpRight, GitBranch, FileText, Database,
  AlertTriangle, FlaskConical, Cpu, CalendarClock, BookMarked,
  History, HelpCircle, MessageSquare, ClipboardCheck,
} from "lucide-react";

import {
  DetailDrawer,
  DrawerSection,
  DrawerFields,
  Panel,
  PanelInset,
  StatusBadge,
  StepTimeline,
  Timeline,
  DataTable,
  riskTone,
  dispositionTone,
  type Column,
  type StepState,
} from "@/components/system";
import { Button } from "@/components/ui/button";
import { CanonicalShadowEvidence } from "@/components/batch/CanonicalShadowEvidence";
import { AuthorityComparison } from "@/components/clinical-rules/AuthorityComparison";
import { cn } from "@/lib/utils";
import type { BatchCaseResult } from "@/lib/batch/types";
import { getGuidelineCitation } from "@/lib/batch/guideline-citations";
import { FlowDiagram } from "@/components/clinical/FlowDiagram";
import { FigureLink } from "@/components/clinical/FigureLink";
import { getFigureById } from "@/lib/decision-trees";

/** Reviewer context, supplied only where a review workflow actually exists. */
export interface CaseReviewContext {
  disposition: "PENDING" | "ACCEPTED" | "REJECTED" | "NEEDS_INFO";
  reviewedByName: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  overrideReason: string | null;
  /** Omitted when the signed-in role cannot action cases; controls then hide. */
  onAccept?: () => void;
  onReject?: () => void;
  onNeedsInfo?: () => void;
  busy?: boolean;
}

interface BatchResultDetailProps {
  result: BatchCaseResult | null;
  open: boolean;
  onClose: () => void;
  reviewItemId?: string;
  canCorrectCanonicalFacts?: boolean;
  /** Present only when opened from a worklist; absent on the intake preview. */
  review?: CaseReviewContext;
}

const DISPOSITION_LABEL: Record<CaseReviewContext["disposition"], string> = {
  PENDING: "Pending reviewer confirmation",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  NEEDS_INFO: "Needs information",
};

function SectionIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-muted-foreground" aria-hidden>
      {children}
    </span>
  );
}

/** Turns an engine branch token into readable text without altering its meaning. */
function formatTraceNode(step: string) {
  const figure = step.match(/^FIGURE_(\d+)$/);
  if (figure) return `Figure ${figure[1]}`;

  const acronymTokens = new Set([
    "AC2", "AG2", "AIS", "ASC", "ASCUS", "CIN", "GP", "HPV",
    "HSIL", "LSIL", "MDM", "OCP", "STI", "TOC", "TZ",
  ]);

  return step
    .split("_")
    .filter(Boolean)
    .map((token) => {
      const upper = token.toUpperCase();
      if (upper === "NEG") return "Negative";
      if (acronymTokens.has(upper) || /^[A-Z]+\d+$/.test(upper)) return upper;
      if (/^\d+M$/.test(upper)) return upper.replace("M", " months");
      return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
    })
    .join(" ")
    .replace(/\b16 18\b/g, "16/18")
    .replace(/\bASC H\b/g, "ASC-H");
}

/**
 * The reasoning trace, as a vertical stepper.
 *
 * Every node is a step the engine actually recorded. The final step is marked
 * "current" rather than "complete" because the outcome is provisional until a
 * reviewer confirms it — nothing here is styled as a finished decision.
 */
function ReasoningTrace({
  decision,
  figureTitle,
}: {
  decision: BatchCaseResult["decision"];
  figureTitle?: string;
}) {
  const rawSteps = decision.branchPath?.length
    ? decision.branchPath
    : [decision.figure, decision.recommendationCode].filter((s): s is string => Boolean(s));

  const finalStep = decision.recommendationCode;
  const steps = rawSteps[rawSteps.length - 1] === finalStep ? rawSteps : [...rawSteps, finalStep];

  return (
    <ol className="space-y-2.5">
      {steps.map((step, i) => {
        const isFirst = i === 0;
        const isLast = i === steps.length - 1;
        const kind = isFirst ? "Pathway figure" : isLast ? "Provisional outcome" : "Decision branch";
        const label = isFirst && figureTitle
          ? figureTitle
          : isLast
            ? decision.recommendation
            : formatTraceNode(step);

        return (
          <li key={`${step}-${i}`} className="relative grid grid-cols-[1.5rem_1fr] gap-3">
            {!isLast && (
              <span
                aria-hidden
                className="absolute left-3 top-6 h-[calc(100%+0.625rem)] w-px bg-border"
              />
            )}
            <span
              className={cn(
                "z-10 flex h-6 w-6 items-center justify-center rounded-full border text-[0.6875rem] font-semibold tabular-nums",
                isFirst
                  ? "border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-800 dark:bg-brand-950/60 dark:text-brand-300"
                  : isLast
                    ? "border-border-strong bg-card text-foreground"
                    : "border-border bg-background text-muted-foreground"
              )}
              aria-hidden
            >
              {i + 1}
            </span>
            <div
              className={cn(
                "min-w-0 rounded-md border px-3 py-2",
                isLast ? "border-border-strong bg-surface-raised" : "border-border bg-background"
              )}
            >
              <div className="text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
                {kind}
              </div>
              <div className="mt-0.5 break-words text-sm font-medium text-foreground">{label}</div>
              <div className="mt-1 break-all font-mono text-[0.6875rem] text-muted-foreground">
                {step}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function BatchResultDetail({
  result,
  open,
  onClose,
  reviewItemId,
  canCorrectCanonicalFacts = false,
  review,
}: BatchResultDetailProps) {
  if (!result) return null;

  const { decision } = result;
  const c = result.case;
  const inp = result.input;
  const shadow = result.canonicalShadow;
  const canonicalIsOperative =
    result.clinicalAuthority?.authorityEngine === "CANONICAL" &&
    Boolean(shadow && ["LIVE_DEMO", "LIVE_PRODUCTION"].includes(shadow.evaluationMode));
  const legacyDecision = canonicalIsOperative ? result.legacyDecision ?? decision : decision;

  const patientId =
    c.nhi ?? c.source.externalPatientId ?? `ROW-${String(c.source.rowNumber).padStart(3, "0")}`;
  const citation = getGuidelineCitation(decision?.figure);
  const receivedDisplay = c.receivedDate
    ? new Date(c.receivedDate).toLocaleDateString("en-NZ", {
        day: "numeric", month: "short", year: "numeric",
      })
    : null;

  // ClinicalDecision.referralPriority is P1–P4; the P1_HSC value used elsewhere
  // exists only on the persisted triage record, so it cannot occur here.
  const isUrgent = decision?.riskLevel === "URGENT" || decision?.referralPriority === "P1";

  // ── Clinical facts actually supplied to the engine ───────────────────────
  // Only fields present on the input are listed; a field that was not supplied
  // is reported in "Information not available" below rather than shown blank,
  // so a reviewer can tell "absent" apart from "recorded as negative".
  const clinicalFacts: { label: string; value: React.ReactNode }[] = [];
  const fact = (label: string, value: unknown) => {
    if (value === undefined || value === null || value === "" || value === false) return;
    clinicalFacts.push({
      label,
      value: typeof value === "string" ? value.replace(/_/g, " ") : String(value),
    });
  };

  if (c.patientAge != null) fact("Patient age", `${c.patientAge} years`);
  fact("HPV result", inp?.hpvResult);
  fact("Cytology result", inp?.cytologyResult);
  fact("Histology result", inp?.histologyResult);
  fact("Sample type", inp?.sampleType);
  fact("TZ type", inp?.tzType);
  fact("Colposcopic impression", inp?.colposcopicImpression);
  fact("Biopsy result", inp?.biopsyResult);
  if (inp?.immunocompromised) fact("Immunocompromised", "Yes");
  if (inp?.isPostHysterectomy) fact("Post-hysterectomy", "Yes");
  fact("Hysterectomy type", inp?.hysterectomyType);
  fact("Hysterectomy indication", inp?.hysterectomyIndication);
  if (inp?.isFirstTimeHPVTransition) fact("First HPV transition", "Yes");
  if (inp?.isPregnant) fact("Pregnant", "Yes");
  if (inp?.hasAbnormalVaginalBleeding) fact("Abnormal bleeding", "Yes");
  if (inp?.hasCancerSymptoms) fact("Cancer symptoms", "Yes");
  if (inp?.isTestOfCure) fact("Test of cure", "Yes");
  fact("Test-of-cure stage", inp?.testOfCureStage);
  if (inp?.atypicalEndometrialHistory) fact("Atypical endometrial history", "Yes");
  fact("Repeat stage", inp?.repeatStage);
  fact("Repeat context", inp?.repeatContext);
  fact("Screening status", inp?.screeningStatus);
  if ((inp?.consecutiveNegativeCoTestCount ?? 0) > 0)
    fact("Negative co-test count", inp.consecutiveNegativeCoTestCount);
  if ((inp?.consecutiveLowGradeCount ?? 0) > 0)
    fact("Low-grade count", inp.consecutiveLowGradeCount);

  // ── Missing / unusable information, straight from the evaluation ─────────
  const diagnostics = shadow?.factDiagnostics;
  const missingGroups = (
    [
      { label: "Missing information", tone: "warn", items: shadow?.missingInformation ?? [] },
      { label: "Facts not supplied", tone: "warn", items: diagnostics?.factsMissing ?? [] },
      { label: "Conflicting facts", tone: "danger", items: diagnostics?.factsConflicting ?? [] },
      {
        label: "Facts ignored by the ruleset",
        tone: "neutral",
        items: diagnostics?.factsIgnored ?? [],
      },
    ] as const
  ).filter((group) => group.items.length > 0);

  // ── Provenance, from recorded timestamps only ────────────────────────────
  const provenance = [
    {
      id: "imported",
      title: "Imported from source",
      timestamp: new Date(c.source.importedAt).toLocaleString("en-NZ"),
      description: `${c.source.sourceSystem ?? c.source.sourceType} · row ${c.source.rowNumber}`,
      icon: <Database className="h-3 w-3" />,
      tone: "neutral" as const,
    },
    {
      id: "legacy",
      title: canonicalIsOperative
        ? "Pathway selected by the Legacy router"
        : "Evaluated by the authoritative Legacy engine",
      description: (
        <span className="font-mono">{c.source.engineVersion}</span>
      ),
      icon: <Cpu className="h-3 w-3" />,
      tone: "brand" as const,
    },
    ...(shadow
      ? [{
          id: "shadow",
          title: "Canonical shadow evaluation recorded",
          timestamp: shadow.evaluatedAt ?? undefined,
          description: (
            <span className="font-mono">
              {shadow.ruleVersionDisplay} · {shadow.evaluationMode} · checksum{" "}
              {shadow.rulesetChecksum.slice(0, 12)}
            </span>
          ),
          icon: <FlaskConical className="h-3 w-3" />,
          tone: "neutral" as const,
        }]
      : []),
    ...(review?.reviewedAt
      ? [{
          id: "reviewed",
          title: `Reviewer recorded: ${DISPOSITION_LABEL[review.disposition]}`,
          timestamp: review.reviewedAt,
          actor: review.reviewedByName ?? undefined,
          icon: <ClipboardCheck className="h-3 w-3" />,
          tone: (review.disposition === "REJECTED" ? "danger" : "success") as "danger" | "success",
        }]
      : []),
  ];

  // Workflow position. Derived from stored state only — never advanced early.
  const workflowSteps: { id: string; label: string; state: StepState; caption?: string }[] = [
    { id: "intake", label: "Pulled from source", state: "complete", caption: c.source.sourceType },
    {
      id: "evaluated",
      label: "Decision support run",
      state: result.status === "success" ? "complete" : "failed",
      caption: result.status === "success" ? "Provisional output" : "Processing error",
    },
    {
      id: "review",
      label: "Clinician review",
      state:
        !review || review.disposition === "PENDING"
          ? result.status === "success" ? "current" : "upcoming"
          : "complete",
      caption: review ? DISPOSITION_LABEL[review.disposition] : "Confirmation required",
    },
  ];

  const referenceColumns: Column<{ document: string; reference: string }>[] = [
    {
      key: "document",
      header: "Document",
      cell: (row) => <span className="font-medium text-foreground">{row.document}</span>,
    },
    {
      key: "reference",
      header: "Reference",
      cell: (row) => <span className="font-mono text-xs">{row.reference}</span>,
      align: "right",
    },
  ];

  const hasValidationIssues =
    c.validationErrors.length > 0 || c.validationWarnings.length > 0;

  return (
    <DetailDrawer
      open={open}
      onClose={onClose}
      title={c.patientName ?? patientId}
      subtitle={c.patientName ? `NHI ${patientId}` : (c.label ?? `Row ${c.source.rowNumber}`)}
      width="2xl"
      footer={
        review?.onAccept || review?.onReject || review?.onNeedsInfo ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Recording a decision writes to the audit trail.
            </p>
            <div className="flex flex-wrap gap-2">
              {review.onNeedsInfo && (
                <Button variant="outline" size="sm" onClick={review.onNeedsInfo} disabled={review.busy}>
                  Needs information
                </Button>
              )}
              {review.onReject && (
                <Button variant="danger" size="sm" onClick={review.onReject} disabled={review.busy}>
                  Reject
                </Button>
              )}
              {review.onAccept && (
                <Button variant="primary" size="sm" onClick={review.onAccept} loading={review.busy}>
                  Accept
                </Button>
              )}
            </div>
          </div>
        ) : undefined
      }
    >
      {/* ── Safety notice. The wording here is fixed and guarded by
           lib/batch/__tests__/safety-wording.test.ts — do not reword it. ─── */}
      <div
        role="note"
        className="rounded-lg border border-amber-200 bg-amber-50/60 px-3.5 py-2.5 dark:border-amber-800 dark:bg-amber-950/20"
      >
        <p className="flex items-start gap-2 text-xs leading-snug text-amber-800 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden />
          {/* Kept on one line: the guard test matches this raw source text. */}
          {/* prettier-ignore */}
          <span><strong>Provisional recommendation</strong> · Decision-support output · Not for direct clinical action</span>
        </p>
      </div>

      {/* ── Status strip. Each badge carries its own text, so urgency and
           review state are legible without relying on colour. ───────────── */}
      <div className="flex flex-wrap items-center gap-1.5">
        {decision?.riskLevel && (
          <StatusBadge tone={riskTone(decision.riskLevel)}>Risk: {decision.riskLevel}</StatusBadge>
        )}
        {isUrgent && <StatusBadge tone="danger">Urgent clinical priority</StatusBadge>}
        {decision?.referralPriority && (
          <StatusBadge tone="neutral">Priority {decision.referralPriority}</StatusBadge>
        )}
        {review && (
          <StatusBadge tone={dispositionTone(review.disposition)}>
            {DISPOSITION_LABEL[review.disposition]}
          </StatusBadge>
        )}
      </div>

      {/* ── Workflow position ───────────────────────────────────────────── */}
      <PanelInset>
        <StepTimeline steps={workflowSteps} />
      </PanelInset>

      {/* ── Case summary ────────────────────────────────────────────────── */}
      <DrawerSection title="Case summary">
        <DrawerFields
          fields={[
            ...(c.patientName ? [{ label: "Patient", value: c.patientName }] : []),
            { label: "NHI", value: <span className="font-mono font-semibold">{patientId}</span> },
            ...(c.patientAge != null
              ? [{ label: "Age", value: `${c.patientAge} years` }]
              : []),
            ...(c.ethnicityPrimary
              ? [{ label: "Ethnicity", value: c.ethnicityPrimary }]
              : []),
            ...(c.gpPractice ? [{ label: "Referring GP", value: c.gpPractice }] : []),
            ...(receivedDisplay ? [{ label: "Received", value: receivedDisplay }] : []),
            {
              label: "Source system",
              value: c.source.sourceSystem ?? c.source.sourceType,
            },
            { label: "Row in source", value: c.source.rowNumber },
          ]}
        />
      </DrawerSection>

      {/* The operative authority is derived from the persisted evaluation mode. */}
      <DrawerSection title="Clinical decision">
        <AuthorityComparison
          legacy={{
            recommendation: legacyDecision?.recommendation ?? "No recommendation recorded",
            recommendationCode: legacyDecision?.recommendationCode,
            figure: legacyDecision?.figure,
            riskLevel: legacyDecision?.riskLevel,
            referralPriority: legacyDecision?.referralPriority ?? null,
            recallIntervalMonths: legacyDecision?.recallIntervalMonths ?? null,
          }}
          shadow={
            shadow
              ? {
                  ruleVersionDisplay: shadow.ruleVersionDisplay,
                  rulesetChecksum: shadow.rulesetChecksum,
                  evaluationMode: shadow.evaluationMode,
                  evaluationId: shadow.evaluationId,
                  provisionalRecommendation: shadow.provisionalRecommendation,
                  matchedRuleIds: shadow.matchedRuleIds,
                  reviewerRequirement: shadow.reviewerRequirement,
                  clinicianOnly: shadow.clinicianOnly,
                  repeatInterval: shadow.repeatInterval ?? null,
                  pathway: decision?.figure ?? null,
                  priority: decision?.referralPriority ?? null,
                  sourceReferences: shadow.sourceReferences,
                  evaluatedAt: shadow.evaluatedAt ?? null,
                }
              : null
          }
        />
      </DrawerSection>

      {result.status === "success" ? (
        <>
          {/* ── Timing & next action ─────────────────────────────────────── */}
          <DrawerSection title="Timing & next action">
            <Panel padded={false} className="shadow-none">
              <div className="border-b border-border px-4 py-3">
                <div className="flex items-start gap-2">
                  <SectionIcon>
                    <BookMarked className="h-4 w-4" />
                  </SectionIcon>
                  <div className="min-w-0">
                    <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">
                      NCSP guideline pathway
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-foreground">
                      {citation ? citation.title : (decision.figure?.replace(/_/g, " ") ?? "—")}
                    </p>
                    {citation && (
                      <p className="mt-0.5 text-xs italic text-muted-foreground">
                        {citation.context}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <div className="px-4 py-3">
                <DrawerFields
                  className="border-0 bg-transparent p-0"
                  fields={[
                    {
                      label: "Recommendation code",
                      value: <span className="font-mono">{decision.recommendationCode}</span>,
                    },
                    { label: "Next action", value: decision.nextAction ?? "—" },
                    {
                      label: "Recall interval",
                      value:
                        decision.recallIntervalMonths != null ? (
                          <span className="inline-flex items-center gap-1.5">
                            <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                            {decision.recallIntervalMonths} months
                          </span>
                        ) : (
                          // Never fabricate a date: an absent interval is stated
                          // as clinician-determined, not left blank.
                          <span className="text-muted-foreground">
                            Not stated — clinician timing required
                          </span>
                        ),
                    },
                    {
                      label: "Referral",
                      value: decision.referralRequired ? (
                        <span className="inline-flex items-center gap-1.5">
                          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                          {decision.referralType?.replace(/_/g, " ") ?? "Required"}
                        </span>
                      ) : (
                        "Not required"
                      ),
                    },
                  ]}
                />
              </div>
            </Panel>
          </DrawerSection>

          {/* ── Clinical warnings ────────────────────────────────────────── */}
          {decision.clinicalWarnings && decision.clinicalWarnings.length > 0 && (
            <DrawerSection title="Clinical warnings">
              <ul className="space-y-1.5 rounded-lg border border-amber-200 bg-amber-50/50 px-3.5 py-3 dark:border-amber-800 dark:bg-amber-950/20">
                {decision.clinicalWarnings.map((w: string, i: number) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-amber-800 dark:text-amber-300"
                  >
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden />
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </DrawerSection>
          )}

          {/* ── Key clinical facts ───────────────────────────────────────── */}
          <DrawerSection title="Clinical facts used">
            {clinicalFacts.length > 0 ? (
              <DrawerFields fields={clinicalFacts} />
            ) : (
              <PanelInset>
                <p className="text-xs text-muted-foreground">
                  No clinical facts were recorded against this case.
                </p>
              </PanelInset>
            )}
          </DrawerSection>

          {/* ── Missing information ──────────────────────────────────────── */}
          {missingGroups.length > 0 && (
            <DrawerSection title="Information not available">
              <div className="space-y-2">
                {missingGroups.map((group) => (
                  <PanelInset key={group.label}>
                    <div className="flex items-center gap-2">
                      <SectionIcon>
                        <HelpCircle className="h-3.5 w-3.5" />
                      </SectionIcon>
                      <StatusBadge tone={group.tone} size="sm">
                        {group.label}
                      </StatusBadge>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {group.items.length}
                      </span>
                    </div>
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {group.items.map((item) => (
                        <li
                          key={item}
                          className="rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[0.6875rem] text-foreground"
                        >
                          {item}
                        </li>
                      ))}
                    </ul>
                  </PanelInset>
                ))}
                <p className="text-xs text-muted-foreground">
                  These are facts the evaluation recorded as absent, conflicting or unused. An
                  absent fact is not the same as a negative result.
                </p>
              </div>
            </DrawerSection>
          )}

          {/* ── Reasoning trace ──────────────────────────────────────────── */}
          <DrawerSection title="Reasoning trace">
            <PanelInset>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <SectionIcon>
                    <GitBranch className="h-3.5 w-3.5" />
                  </SectionIcon>
                  <p className="text-xs text-muted-foreground">
                    Path recorded by <span className="font-mono">evaluateClinicalDecision()</span>
                  </p>
                </div>
                <StatusBadge tone="info" size="sm">
                  Reviewer confirmation required
                </StatusBadge>
              </div>
              <ReasoningTrace decision={decision} figureTitle={citation?.title} />
            </PanelInset>
          </DrawerSection>

          {/* ── Pathway diagram ──────────────────────────────────────────── */}
          {(() => {
            const fig = decision.figure ? getFigureById(decision.figure) : undefined;
            if (!fig) return null;
            return (
              <DrawerSection title="Pathway diagram">
                <p className="mb-2 text-xs text-muted-foreground">
                  The highlighted path shows how this case reached its provisional outcome.{" "}
                  <FigureLink figure={decision.figure} showIcon /> · open the full pathway.
                </p>
                <div className="overflow-hidden rounded-lg border border-border bg-card">
                  <FlowDiagram
                    figure={fig}
                    activeCode={decision.recommendationCode}
                    height={360}
                    className="rounded-none border-0"
                  />
                </div>
              </DrawerSection>
            );
          })()}

          {/* ── Guideline & source references ────────────────────────────── */}
          {shadow?.sourceReferences && shadow.sourceReferences.length > 0 && (
            <DrawerSection title="Guideline references">
              <Panel padded={false} className="shadow-none">
                <DataTable
                  dense
                  columns={referenceColumns}
                  rows={shadow.sourceReferences}
                  rowKey={(row, i) => `${row.document}-${row.reference}-${i}`}
                  caption="Guideline documents and references cited by the canonical evaluation"
                />
              </Panel>
            </DrawerSection>
          )}
        </>
      ) : (
        <DrawerSection title="Processing error">
          <div
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-3 text-sm text-destructive"
          >
            {result.error}
          </div>
        </DrawerSection>
      )}

      {/* ── Reviewer record ──────────────────────────────────────────────── */}
      {review && (review.reviewNote || review.overrideReason || review.reviewedByName) && (
        <DrawerSection title="Reviewer record">
          <PanelInset>
            <div className="flex items-center gap-2">
              <SectionIcon>
                <MessageSquare className="h-3.5 w-3.5" />
              </SectionIcon>
              <StatusBadge tone={dispositionTone(review.disposition)} size="sm">
                {DISPOSITION_LABEL[review.disposition]}
              </StatusBadge>
              {review.reviewedByName && (
                <span className="text-xs text-muted-foreground">by {review.reviewedByName}</span>
              )}
            </div>
            {review.overrideReason && (
              <p className="mt-2 text-sm text-foreground">
                <span className="font-medium">Reason: </span>
                {review.overrideReason}
              </p>
            )}
            {review.reviewNote && (
              <p className="mt-1.5 text-sm text-foreground">
                <span className="font-medium">Note: </span>
                {review.reviewNote}
              </p>
            )}
          </PanelInset>
        </DrawerSection>
      )}

      {/* ── Canonical fact evidence / correction ─────────────────────────── */}
      <CanonicalShadowEvidence
        result={result}
        reviewItemId={reviewItemId}
        canCorrectCanonicalFacts={canCorrectCanonicalFacts}
      />

      {/* ── Validation issues ────────────────────────────────────────────── */}
      {hasValidationIssues && (
        <DrawerSection title="Validation issues">
          <PanelInset>
            <ul className="space-y-1.5">
              {c.validationErrors.map((e, i) => (
                <li key={`e-${i}`} className="flex items-start gap-2 text-xs">
                  <FileText className="mt-0.5 h-3 w-3 flex-shrink-0 text-destructive" aria-hidden />
                  <span className="text-destructive">
                    <strong>Error · {e.field}:</strong> {e.message}
                  </span>
                </li>
              ))}
              {c.validationWarnings.map((w, i) => (
                <li key={`w-${i}`} className="flex items-start gap-2 text-xs">
                  <AlertTriangle
                    className="mt-0.5 h-3 w-3 flex-shrink-0 text-amber-600 dark:text-amber-400"
                    aria-hidden
                  />
                  <span className="text-amber-700 dark:text-amber-400">
                    <strong>Warning · {w.field}:</strong> {w.message}
                  </span>
                </li>
              ))}
            </ul>
          </PanelInset>
        </DrawerSection>
      )}

      {/* ── Provenance ───────────────────────────────────────────────────── */}
      <DrawerSection title="Provenance">
        <PanelInset>
          <Timeline events={provenance} />
        </PanelInset>
      </DrawerSection>

      {/* Prior decision history is intentionally absent: this case payload
          carries no regrade chain, and inventing one would misrepresent the
          record. It belongs here once a prior-evaluation link is available. */}
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <History className="h-3 w-3" aria-hidden />
        No prior decision recorded for this case.
      </p>
    </DetailDrawer>
  );
}
