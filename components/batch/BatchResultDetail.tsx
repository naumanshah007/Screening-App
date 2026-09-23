"use client";

import {
  AlertTriangle,
  ClipboardCheck,
  Cpu,
  Database,
  FileText,
  FlaskConical,
  MessageSquare,
} from "lucide-react";

import {
  DetailDrawer,
  DrawerSection,
  DrawerDisclosure,
  DrawerFields,
  PanelInset,
  StatusBadge,
  Timeline,
  DataTable,
  dispositionTone,
  type BadgeTone,
  type Column,
} from "@/components/system";
import { Button } from "@/components/ui/button";
import { CanonicalShadowEvidence } from "@/components/batch/CanonicalShadowEvidence";
import { AuthorityComparison } from "@/components/clinical-rules/AuthorityComparison";
import type { BatchCaseResult } from "@/lib/batch/types";
import { getGuidelineCitation } from "@/lib/batch/guideline-citations";
import { FigureLink } from "@/components/clinical/FigureLink";
import {
  isRoutingPreview,
  PREVIEW_PENDING_ACTION,
  PREVIEW_PENDING_FIELD,
} from "@/lib/batch/preview-state";
import {
  EVALUATION_STATUS_LABEL,
  evaluationStatusFor,
  type EvaluationStatus,
} from "@/lib/clinical-rules/decision-envelope";
import { CYTOLOGY_STATE_LABEL } from "@/lib/batch/source-evidence";

/**
 * The clinician-facing case view.
 *
 * SIX SECTIONS, IN THIS ORDER, AND NOTHING ELSE ABOVE THE FOLD
 * -----------------------------------------------------------
 *   1. Case identity        3. Decision        5. Missing information (if any)
 *   2. Source inputs        4. Why             6. Decision path (optional)
 *
 * WHAT IS DELIBERATELY NOT HERE
 * -----------------------------
 * Engine version, routing service, Canonical/Legacy terminology, checksums,
 * evaluation IDs, internal recommendation codes, source row numbers, import
 * timestamps, the workflow timeline, rule-catalogue plumbing, the authority
 * comparison, the implementation safety severity, and any priority or risk
 * badge whose patient-specific basis has not been established.
 *
 * None of it is deleted. All of it lives in the one closed "Technical and audit
 * details" disclosure at the bottom. This is a presentation change: the
 * persisted evidence is unchanged and remains fully reachable.
 *
 * SOURCE INPUTS CONTAINS SOURCE EVIDENCE ONLY
 * -------------------------------------------
 * The strings in that section come from `case.sourceEvidence`, which is the
 * verbatim source row. Normalised engine values (assumed LBC sample type, a
 * derived BASELINE repeat stage, an inferred Test of Cure) are NOT source facts
 * and are not shown there — they appear under the technical disclosure with the
 * rest of the normalisation.
 *
 * THERE IS NO STATIC PATHWAY DIAGRAM
 * ----------------------------------
 * The hand-maintained figure graph was removed. It was keyed on
 * `recommendationCode` and walked every parent edge backwards, so it lit up
 * branches the participant did not take — and at the last check 0 of 30 CHCH
 * recommendation codes even matched a terminal in it. "View decision path"
 * below is derived only from the persisted evaluation's own branch path, and is
 * hidden entirely when no trustworthy trace exists.
 */

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

/**
 * The clinician-facing state, from the SHARED classifier.
 *
 * This used to be a second copy of the state machine inside the component. Two
 * copies of "is this case decided?" is exactly how a worklist row and the
 * drawer it opens come to disagree, so the drawer now asks the same function
 * the evaluation envelope and persistence use.
 *
 * NOT_YET_EVALUATED is the drawer's own addition: a routing preview has not
 * been evaluated by anything, which is a presentation state rather than an
 * evaluation outcome.
 */
type DecisionState = EvaluationStatus | "NOT_YET_EVALUATED";

const DECISION_STATE_LABEL: Record<DecisionState, string> = {
  ...EVALUATION_STATUS_LABEL,
  NOT_YET_EVALUATED: "Not yet evaluated",
};

function decisionStateFor(result: BatchCaseResult): DecisionState {
  if (isRoutingPreview(result.decision)) return "NOT_YET_EVALUATED";
  return evaluationStatusFor({
    decision: result.decision,
    engineStatus: result.status,
  });
}

const DECISION_STATE_TONE: Record<DecisionState, BadgeTone> = {
  DECIDED: "success",
  NEEDS_INFORMATION: "warn",
  CLINICIAN_REVIEW: "info",
  EVALUATION_UNAVAILABLE: "warn",
  NOT_YET_EVALUATED: "neutral",
};

/**
 * A canonical fact name as a clinician-readable question.
 *
 * Only facts with an entry are shown: a raw identifier like
 * `isFirstCytologyToHpvTransition` is an engineering token, not a question
 * anyone can answer. Anything unmapped stays in the technical disclosure.
 */
const MISSING_INFORMATION_QUESTION: Record<string, string> = {
  cytologyResult: "Current cytology result",
  hpvResult: "Current HPV result",
  sampleType: "Sample collection method required",
  immuneClassification: "Immune status",
  treatmentDate: "Date of the previous treatment",
  tocStatus: "Where this participant is in Test of Cure",
  tocEventOrdinal: "Which Test of Cure test this is",
  isActiveHsilTestOfCure: "Whether an active Test of Cure applies",
  colposcopyResult: "Outcome of the previous colposcopy",
  colposcopyCompletedForLastRecommendation:
    "Whether the recommended colposcopy took place",
  priorScreeningHistoryGroup: "Previous screening history",
  hasCervicalCancerSignsOrSymptoms: "Whether there are symptoms of concern",
  histologyResult: "Histology result",
  cervixPresent: "Whether the cervix is present",
  eventStage: "Which screening event this is (first screen, repeat or surveillance)",
  cytologyAdequacy: "Whether the cytology sample was adequate",
  treatmentConfirmed: "Confirmation that treatment took place",
  monthsBetweenQualifyingCoTests: "Interval between the qualifying co-tests",
};

/**
 * Human-readable steps from the persisted evaluation's own branch path.
 *
 * Returns an empty list when the trace carries no rule/outcome nodes, which is
 * the signal to hide the path entirely rather than show a speculative one.
 */
function tracePathSteps(branchPath: readonly string[] | undefined): string[] {
  if (!branchPath?.length) return [];
  const steps: string[] = [];
  for (const node of branchPath) {
    if (node.startsWith("node:section:")) {
      const section = node.slice("node:section:".length).replace(/-/g, " ");
      steps.push(section.charAt(0).toUpperCase() + section.slice(1));
    } else if (node.startsWith("node:rule:")) {
      steps.push(`Rule ${node.slice("node:rule:".length)} applied`);
    } else if (node.startsWith("node:clinician-review:")) {
      const reason = node.slice("node:clinician-review:".length).replace(/-/g, " ");
      steps.push(`Stopped for clinician review — ${reason}`);
    } else if (node.startsWith("branch:")) {
      steps.push(`Outcome branch ${node.slice("branch:".length)}`);
    }
  }
  return steps;
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
  const evidence = c.sourceEvidence;
  const canonicalIsOperative =
    result.clinicalAuthority?.authorityEngine === "CANONICAL" &&
    Boolean(shadow && ["LIVE_DEMO", "LIVE_PRODUCTION"].includes(shadow.evaluationMode));
  const legacyDecision = canonicalIsOperative ? result.legacyDecision ?? decision : decision;
  const isPreview = isRoutingPreview(decision);
  const state = decisionStateFor(result);
  const citation = getGuidelineCitation(decision?.figure);

  // ── 1. Case identity ──────────────────────────────────────────────────────
  //
  // The case ID is a case ID. Labelling a synthetic evaluation identifier "NHI"
  // was wrong in the drawer subtitle and wrong in the Case summary field; both
  // are gone. A real NHI is still shown as one when a real NHI exists.
  const caseIdentifier =
    c.source.externalPatientId ?? `Row ${c.source.rowNumber}`;
  const identifierIsNhi = c.identifierKind === "NHI" || Boolean(c.nhi);
  const identifierLabel = identifierIsNhi ? "NHI" : "Case";
  const identifierValue = c.nhi ?? caseIdentifier;

  // ── 2. Source inputs — source evidence ONLY ───────────────────────────────
  const sourceInputs: { label: string; value: React.ReactNode }[] = [];
  if (evidence) {
    sourceInputs.push({ label: "Screen", value: evidence.screenCircumstanceText });
    sourceInputs.push({
      label: "HPV",
      value: evidence.hpvIsCurrentResult
        ? evidence.hpvResultText
        : `${evidence.hpvResultText} — no current HPV result`,
    });
    sourceInputs.push({
      label: "Cytology",
      value:
        evidence.cytologyState === "AVAILABLE"
          ? evidence.cytologyFollowUpText
          : `${CYTOLOGY_STATE_LABEL[evidence.cytologyState]} — “${evidence.cytologyFollowUpText}”`,
    });
    sourceInputs.push({ label: "History", value: evidence.relevantHistoryText });
  }
  // There is deliberately NO fallback.
  //
  // A case with no immutable source record has nothing to show here. The
  // previous fallback listed ClinicalInput values under this heading, so a row
  // whose source said "HPV 16 positive" displayed "HPV 16 18" — a normalised
  // engine value, printed under the caption "Exactly as the source states
  // them". Showing nothing is correct; the engine values are below, under
  // technical details, labelled as what they are.

  // ── 4. Why ────────────────────────────────────────────────────────────────
  //
  // The operative evaluation's own words. Never assembled from the legacy
  // engine's text while a governed evaluation is the authority.
  const why =
    state === "NOT_YET_EVALUATED"
      ? PREVIEW_PENDING_ACTION
      : state === "EVALUATION_UNAVAILABLE"
        ? "No governed evaluation produced a result for this case. Nothing here is a clinical recommendation."
        : (shadow?.provisionalRecommendation ?? decision.recommendation);

  // ── 5. Missing information — only questions a clinician can act on ────────
  const missingFactNames = [
    ...(decision.missingInformation ?? []),
    ...(shadow?.missingInformation ?? []),
  ].filter((value, index, all) => all.indexOf(value) === index);
  const missingQuestions = missingFactNames
    .map((name) => MISSING_INFORMATION_QUESTION[name])
    .filter((question): question is string => Boolean(question))
    .filter((value, index, all) => all.indexOf(value) === index);
  const unmappedMissingCount = missingFactNames.length - missingQuestions.length;

  // ── 6. Decision path — from the persisted trace, or not at all ────────────
  const traceSteps = tracePathSteps(shadow?.branchPath);
  const hasTrustworthyTrace = Boolean(shadow) && traceSteps.length > 0 && !isPreview;

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

  // Audit/provenance, from recorded timestamps only. Technical disclosure.
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
      title: isPreview
        ? "Pathway routed by"
        : canonicalIsOperative
          ? "Pathway selected by the Legacy router"
          : "Evaluated by the authoritative Legacy engine",
      description: <span className="font-mono">{c.source.engineVersion}</span>,
      icon: <Cpu className="h-3 w-3" />,
      tone: "brand" as const,
    },
    ...(shadow
      ? [{
          id: "shadow",
          title: "Canonical evaluation recorded",
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

  return (
    <DetailDrawer
      open={open}
      onClose={onClose}
      title={c.patientName ? `${c.patientName}${c.patientAge != null ? ` · ${c.patientAge}` : ""}` : identifierValue}
      // Case chch-001 — never "NHI chch-001".
      subtitle={`${identifierLabel} ${identifierValue}`}
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
          <span>
            {isPreview ? (
              <>
                <strong>Routing preview</strong> · Governed recommendation pending · Not for direct clinical action
              </>
            ) : (
              <>
                <strong>Provisional recommendation</strong> · Decision-support output · Not for direct clinical action
              </>
            )}
          </span>
        </p>
      </div>

      {/* Status: the decision state and the reviewer disposition. Nothing else.
          No risk badge and no P1/P2 badge: neither has a demonstrated
          patient-specific basis on this path. */}
      <div className="flex flex-wrap items-center gap-1.5">
        <StatusBadge tone={DECISION_STATE_TONE[state]}>
          {DECISION_STATE_LABEL[state]}
        </StatusBadge>
        {review && (
          <StatusBadge tone={dispositionTone(review.disposition)}>
            {DISPOSITION_LABEL[review.disposition]}
          </StatusBadge>
        )}
      </div>

      {/* ── 2. Source inputs ─────────────────────────────────────────────── */}
      <DrawerSection title="Source inputs">
        {sourceInputs.length > 0 ? (
          <>
            <DrawerFields fields={sourceInputs} />
            <p className="mt-2 text-xs text-muted-foreground">
              Exactly as the source states them. Values the source does not state
              are not shown here.
            </p>
          </>
        ) : (
          <PanelInset>
            <p className="text-xs text-muted-foreground">
              No source record is held for this case.
            </p>
          </PanelInset>
        )}
      </DrawerSection>

      {/* ── 3. Decision ──────────────────────────────────────────────────── */}
      <DrawerSection title="Decision">
        <PanelInset>
          <p className="text-sm font-semibold text-foreground">
            {state === "NOT_YET_EVALUATED"
              ? PREVIEW_PENDING_FIELD
              : (shadow?.provisionalRecommendation ?? decision.recommendation)}
          </p>
          {state !== "NOT_YET_EVALUATED" &&
            state !== "EVALUATION_UNAVAILABLE" &&
            decision.recallIntervalMonths != null && (
              <p className="mt-1 text-sm text-foreground">
                Repeat in {decision.recallIntervalMonths} months.
              </p>
            )}
        </PanelInset>
      </DrawerSection>

      {/* ── 4. Why ───────────────────────────────────────────────────────── */}
      <DrawerSection title="Why">
        <p className="text-sm leading-relaxed text-foreground">{why}</p>
        {citation && (
          <p className="mt-2 text-xs text-muted-foreground">
            Guideline: {citation.title} · <FigureLink figure={decision.figure} showIcon />
          </p>
        )}
      </DrawerSection>

      {/* ── 5. Missing information — only when there is something to ask ─── */}
      {missingFactNames.length > 0 && (
        <DrawerSection title="Missing information">
          {missingQuestions.length > 0 ? (
            <ul className="space-y-1.5 text-sm text-foreground">
              {missingQuestions.map((question) => (
                <li key={question} className="flex items-start gap-2">
                  <span aria-hidden className="mt-2 h-1 w-1 flex-shrink-0 rounded-full bg-muted-foreground" />
                  <span>{question}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              This case is waiting on information recorded under technical
              details below.
            </p>
          )}
          {unmappedMissingCount > 0 && missingQuestions.length > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              {unmappedMissingCount} further item
              {unmappedMissingCount === 1 ? " is" : "s are"} listed under
              technical details.
            </p>
          )}
        </DrawerSection>
      )}

      {/* ── 6. Decision path — from the persisted trace, or hidden ───────── */}
      {hasTrustworthyTrace && (
        <DrawerDisclosure
          title="View decision path"
          caption="The steps this evaluation actually recorded"
        >
          <PanelInset>
            <ol className="space-y-1.5 text-sm text-foreground">
              {traceSteps.map((step, index) => (
                <li key={`${step}-${index}`} className="flex items-start gap-2">
                  <span className="mt-0.5 font-mono text-xs text-muted-foreground tabular-nums">
                    {index + 1}.
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            {/*
              The path is tied to the pinned evaluation STRUCTURALLY — it is
              read from that evaluation's own recorded branch path, and the
              ruleset version and checksum it ran under are stated in the
              technical disclosure below. They are not printed here: a checksum
              is not something a clinician can act on, and section N keeps
              identifiers out of the clinician-facing view.
            */}
            <p className="mt-2 text-xs text-muted-foreground">
              Taken from this case&apos;s own recorded evaluation. It is not a
              catalogue diagram, and no step is inferred from the recommendation.
            </p>
          </PanelInset>
        </DrawerDisclosure>
      )}

      {/* ── Reviewer record ──────────────────────────────────────────────── */}
      {review && (review.reviewNote || review.overrideReason || review.reviewedByName) && (
        <DrawerSection title="Reviewer record">
          <PanelInset>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
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

      {/* ── ONE technical disclosure, closed by default ──────────────────────
          Everything an auditor needs and a clinician does not: normalised
          engine facts, ruleset identity, checksums, evaluation IDs, the
          authority comparison, the canonical trace, guideline references,
          validation issues and the recorded provenance timeline. Nothing is
          dropped from the persisted record — it is moved out of the way. */}
      <DrawerDisclosure
        title="Technical and audit details"
        caption="Normalisation, ruleset identity, evaluation trace, references and provenance"
      >
        <div className="space-y-4">
          <PanelInset>
            <p className="text-[0.6875rem] uppercase tracking-wider text-muted-foreground">
              Normalised engine input
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Values the engine consumed. Some are derived or assumed rather than
              stated by the source; the assumption manifest records which.
            </p>
            <dl className="mt-2 grid gap-1.5 text-xs sm:grid-cols-2">
              {Object.entries({
                "Selected pathway": decision.figure,
                "Routing service": c.source.engineVersion,
                "Recommendation code": decision.recommendationCode,
                "HPV (engine value)": inp?.hpvResult,
                "Cytology (engine value)": inp?.cytologyResult,
                "Sample type (assumed)": inp?.sampleType,
                "Repeat stage": inp?.repeatStage,
                "Repeat context": inp?.repeatContext,
                "Screening status": inp?.screeningStatus,
                "Source row": c.source.rowNumber,
                "Imported at": c.source.importedAt,
                "Mapping version": c.source.mappingVersion,
                ...(c.sourceEvidence?.locator
                  ? {
                      "Source cell": `${c.sourceEvidence.locator.sheet} row ${c.sourceEvidence.locator.row}`,
                      "Source document": c.sourceEvidence.locator.fileName,
                    }
                  : {}),
                ...(c.sourceEvidence?.hpvGenotype
                  ? { "Source genotype": c.sourceEvidence.hpvGenotype }
                  : {}),
                ...(c.sourceEvidence
                  ? { "Cytology state": c.sourceEvidence.cytologyState }
                  : {}),
              })
                .filter(([, value]) => value != null && value !== "")
                .map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="break-all font-mono font-medium text-foreground">
                      {String(value)}
                    </dd>
                  </div>
                ))}
            </dl>
          </PanelInset>

          {missingFactNames.length > 0 && (
            <PanelInset>
              <p className="text-[0.6875rem] uppercase tracking-wider text-muted-foreground">
                Facts the evaluation could not resolve
              </p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {missingFactNames.map((name) => (
                  <li
                    key={name}
                    className="rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[0.6875rem] text-foreground"
                  >
                    {name}
                  </li>
                ))}
              </ul>
            </PanelInset>
          )}

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

          <CanonicalShadowEvidence
            result={result}
            reviewItemId={reviewItemId}
            canCorrectCanonicalFacts={canCorrectCanonicalFacts}
          />

          {shadow?.sourceReferences && shadow.sourceReferences.length > 0 && (
            <DataTable
              dense
              columns={referenceColumns}
              rows={shadow.sourceReferences}
              rowKey={(row, i) => `${row.document}-${row.reference}-${i}`}
              caption="Guideline documents and references recorded for this evaluation"
            />
          )}

          {hasValidationIssues && (
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
          )}

          <PanelInset>
            <Timeline events={provenance} />
          </PanelInset>
        </div>
      </DrawerDisclosure>
    </DetailDrawer>
  );
}
