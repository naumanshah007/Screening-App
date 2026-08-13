"use client";

/**
 * Side-by-side authoritative vs shadow recommendation.
 *
 * The point of this component is that a reviewer can never be in doubt about
 * which recommendation is operative. The authoritative one is labelled as such;
 * the canonical one is labelled SHADOW and carries its DRAFT status, so it can
 * never be mistaken for an active clinical authority.
 *
 * It also renders timing safely (Phase 7): a canonical rule that does not state
 * a single schedulable interval shows "Clinician timing required" plus the
 * source text — never a fabricated date, and never a silent blank.
 */

import { cn } from "@/lib/utils";
import { StatusBadge, riskTone } from "@/components/system";
import { isRoutingPreview } from "@/lib/batch/preview-state";
import {
  classifyTiming,
  intervalToMonths,
  isAutomaticallySchedulable,
} from "@/lib/clinical-rules/governed-vocabulary";

export type AuthorityComparisonProps = {
  /** The operative decision. Today this is always the legacy engine's. */
  legacy: {
    recommendation: string;
    recommendationCode?: string;
    figure?: string;
    riskLevel?: string;
    referralPriority?: string | null;
    recallIntervalMonths?: number | null;
  };
  /** The canonical evaluation, when one was recorded. */
  shadow?: {
    ruleVersionDisplay: string;
    rulesetChecksum: string;
    evaluationMode: string;
    evaluationId?: string;
    evaluatedAt?: string | null;
    provisionalRecommendation: string;
    matchedRuleIds: string[];
    reviewerRequirement: string;
    clinicianOnly?: boolean;
    /** Raw governed timing text, e.g. "12 months" or "6-8 weeks". */
    repeatInterval?: string | null;
    pathway?: string | null;
    priority?: string | null;
    sourceReferences?: Array<{ document: string; reference: string }>;
  } | null;
  /** The canonical version's lifecycle status, e.g. "DRAFT". */
  canonicalStatus?: string | null;
  className?: string;
};

/** Only a live mode is clinically operative; anything else is a comparison artefact. */
function isOperativeMode(mode: string) {
  return mode === "LIVE_PRODUCTION" || mode === "LIVE_DEMO";
}

function TimingLine({ repeatInterval }: { repeatInterval?: string | null }) {
  if (repeatInterval === undefined || repeatInterval === null) return null;

  let classification;
  try {
    classification = classifyTiming(repeatInterval);
  } catch {
    return (
      <div className="text-xs">
        <span className="text-muted-foreground">Follow-up: </span>
        <span className="font-medium text-amber-700 dark:text-amber-300">
          Clinician timing required
        </span>
        <span className="text-muted-foreground"> — unrecognised governed timing</span>
      </div>
    );
  }

  if (isAutomaticallySchedulable(classification)) {
    const months = intervalToMonths(classification.interval);
    return (
      <div className="text-xs">
        <span className="text-muted-foreground">Follow-up: </span>
        <span className="font-medium text-foreground">
          {months !== null ? `${months} month${months === 1 ? "" : "s"}` : repeatInterval}
        </span>
        {classification.kind === "BOUNDED_MAX" && (
          <span className="text-muted-foreground"> (within, not later than)</span>
        )}
      </div>
    );
  }

  if (classification.kind === "NONE" || classification.kind === "NOT_A_TIMING") {
    return (
      <div className="text-xs">
        <span className="text-muted-foreground">Follow-up: not stated by this rule</span>
      </div>
    );
  }

  // RANGE, MULTI_EVENT, EVENT_RELATIVE, CONDITIONAL, DEFERRED_TO_OUTCOME.
  return (
    <div className="text-xs">
      <span className="text-muted-foreground">Follow-up: </span>
      <span className="font-medium text-amber-700 dark:text-amber-300">
        Clinician timing required
      </span>
      {repeatInterval.trim().length > 0 && (
        <span className="text-muted-foreground"> — source states “{repeatInterval}”</span>
      )}
    </div>
  );
}

export function AuthorityComparison({
  legacy,
  shadow,
  canonicalStatus,
  className,
}: AuthorityComparisonProps) {
  const shadowIsOperative = shadow ? isOperativeMode(shadow.evaluationMode) : false;
  // Routed but not yet evaluated by the current governed ruleset.
  const legacyIsPreview = isRoutingPreview(legacy);
  const differs =
    shadow != null &&
    shadow.provisionalRecommendation.trim() !== legacy.recommendation.trim();

  return (
    <div className={cn("space-y-2.5", className)}>
      {shadowIsOperative && shadow ? (
        <section className="overflow-hidden rounded-lg border border-border border-l-4 border-l-brand-600 bg-card shadow-card">
          <div className="flex flex-wrap items-center gap-2 border-b border-border bg-brand-50/60 px-4 py-2 dark:bg-brand-950/30">
            <StatusBadge tone="brand" size="sm" dot>Canonical authority</StatusBadge>
            <StatusBadge tone="canonical" size="sm" mono>{shadow.ruleVersionDisplay}</StatusBadge>
            <StatusBadge tone="neutral" size="sm" mono>{shadow.evaluationMode}</StatusBadge>
          </div>
          <div className="px-4 py-3">
            <p className="text-[0.6875rem] font-bold uppercase tracking-wider text-muted-foreground">Provisional clinical recommendation</p>
            <p className="mt-1 text-base font-semibold leading-snug text-foreground">{shadow.provisionalRecommendation}</p>
            <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
              <div><dt className="text-muted-foreground">Pathway</dt><dd className="font-mono font-medium text-foreground">{shadow.pathway ?? legacy.figure ?? "—"}</dd></div>
              <div><dt className="text-muted-foreground">Rule</dt><dd className="font-mono font-medium text-foreground">{shadow.matchedRuleIds.join(", ") || "governance stop"}</dd></div>
              <div><dt className="text-muted-foreground">Priority</dt><dd className="font-medium text-foreground">{shadow.priority ?? "Clinician determination"}</dd></div>
              <div><dt className="text-muted-foreground">Ruleset / version</dt><dd className="font-mono font-medium text-foreground">{shadow.ruleVersionDisplay}</dd></div>
            </dl>
            <div className="mt-3"><TimingLine repeatInterval={shadow.repeatInterval} /></div>
            <p className="mt-3 text-xs font-semibold text-amber-700 dark:text-amber-300">Reviewer confirmation required.</p>
            <div className="mt-2 text-[0.6875rem] text-muted-foreground">
              <span className="font-mono">checksum {shadow.rulesetChecksum}</span>
              {shadow.sourceReferences?.length ? <p className="mt-1">Source: {shadow.sourceReferences.map((source) => `${source.document} · ${source.reference}`).join("; ")}</p> : null}
            </div>
          </div>
        </section>
      ) : (
      <section className="overflow-hidden rounded-lg border border-border border-l-4 border-l-brand-600 bg-card shadow-card">
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-brand-50/60 px-4 py-2 dark:bg-brand-950/30">
          {/*
            A routing preview has no authoritative decision — it has been routed
            but not evaluated by any clinical authority. Labelling it
            "Authoritative decision · Legacy engine" presented a legacy routing
            result as a settled clinical outcome on a brand-new case.
          */}
          <StatusBadge tone="brand" size="sm" dot>
            {legacyIsPreview ? "Routing preview" : "Authoritative decision"}
          </StatusBadge>
          <StatusBadge tone="neutral" size="sm">
            {legacyIsPreview ? "Awaiting governed evaluation" : "Legacy engine"}
          </StatusBadge>
          {legacy.riskLevel && (
            <StatusBadge tone={riskTone(legacy.riskLevel)} size="sm" className="ml-auto">
              Risk: {legacy.riskLevel}
            </StatusBadge>
          )}
        </div>

        <div className="px-4 py-3">
          <p className="text-base font-semibold leading-snug text-foreground">
            {legacy.recommendation}
          </p>
          <dl className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
            {legacy.recommendationCode && (
              <div className="flex gap-1.5">
                <dt>Code</dt>
                <dd className="font-mono font-medium text-foreground">
                  {legacy.recommendationCode}
                </dd>
              </div>
            )}
            {legacy.figure && (
              <div className="flex gap-1.5">
                <dt>Pathway</dt>
                <dd className="font-mono font-medium text-foreground">{legacy.figure}</dd>
              </div>
            )}
            {legacy.referralPriority && (
              <div className="flex gap-1.5">
                <dt>Priority</dt>
                <dd className="font-medium text-foreground">{legacy.referralPriority}</dd>
              </div>
            )}
            {typeof legacy.recallIntervalMonths === "number" && (
              <div className="flex gap-1.5">
                <dt>Recall</dt>
                <dd className="font-medium text-foreground">
                  {legacy.recallIntervalMonths} months
                </dd>
              </div>
            )}
          </dl>
        </div>
      </section>
      )}

      {/* ── Canonical shadow ──────────────────────────────────────────────────
           Held visually below the authoritative block on every axis that
           signals weight: dashed border, recessed surface, no elevation, no
           colour rail, smaller type. This is a clinical-safety requirement, not
           a stylistic choice — the shadow must never be mistaken for the
           operative decision, so do not raise it to parity when restyling. */}
      {shadow && !shadowIsOperative ? (
        <section className="rounded-lg border border-dashed border-border bg-muted/40 px-4 py-3">
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <StatusBadge tone="canonical" size="sm">
              Canonical shadow — not authoritative
            </StatusBadge>
            <StatusBadge tone="neutral" size="sm" mono>
              {shadow.ruleVersionDisplay}
            </StatusBadge>
            {canonicalStatus && (
              <StatusBadge tone="neutral" size="sm">
                {canonicalStatus}
              </StatusBadge>
            )}
            <StatusBadge tone="neutral" size="sm" mono>
              {shadow.evaluationMode}
            </StatusBadge>
          </div>

          <p className="text-sm leading-snug text-muted-foreground">
            {shadow.provisionalRecommendation}
          </p>

          <div className="mt-2 space-y-1">
            <TimingLine repeatInterval={shadow.repeatInterval} />
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>
                Controlling rule{" "}
                <span className="font-mono text-foreground">
                  {shadow.matchedRuleIds[0] ?? "governance stop"}
                </span>
              </span>
              {shadow.matchedRuleIds.length > 1 && (
                <span>
                  Also matched{" "}
                  <span className="font-mono text-foreground">
                    {shadow.matchedRuleIds.slice(1).join(", ")}
                  </span>
                </span>
              )}
              <span>Reviewer {shadow.reviewerRequirement}</span>
              {shadow.clinicianOnly && <span>Clinician only</span>}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[0.625rem] text-muted-foreground">
              <span>checksum {shadow.rulesetChecksum.slice(0, 12)}</span>
              {shadow.evaluationId && <span>eval {shadow.evaluationId}</span>}
              {shadow.evaluatedAt && <span>{shadow.evaluatedAt}</span>}
            </div>
          </div>

          {differs && (
            <p className="mt-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Shadow difference detected.</span>{" "}
              The canonical ruleset would state a different recommendation. This does not change
              the authoritative decision; reviewer confirmation is still required.
            </p>
          )}
        </section>
      ) : shadowIsOperative ? (
        <section className="rounded-lg border border-dashed border-border bg-muted/40 px-4 py-3">
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <StatusBadge tone="neutral" size="sm">Technical provenance</StatusBadge>
            <StatusBadge tone="neutral" size="sm">Legacy pathway router</StatusBadge>
          </div>
          <p className="text-sm text-muted-foreground">{legacy.recommendation}</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {legacy.figure && <span>Selected pathway <span className="font-mono text-foreground">{legacy.figure}</span></span>}
            {legacy.recommendationCode && <span>Legacy code <span className="font-mono text-foreground">{legacy.recommendationCode}</span></span>}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Legacy remains the pathway-selection component; it is not a competing within-pathway clinical authority.</p>
        </section>
      ) : (
        <p className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
          {/*
            For a routing preview this is not yet a decision, and "canonical
            shadow evaluation" is internal architecture language a clinician
            should not have to decode. State plainly what happens next.
          */}
          {legacyIsPreview
            ? "Governed evaluation will run when this case is added to the Review Queue."
            : "No canonical shadow evaluation was recorded for this decision."}
        </p>
      )}
    </div>
  );
}
