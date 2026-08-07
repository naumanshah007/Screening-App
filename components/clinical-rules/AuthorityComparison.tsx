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
  const differs =
    shadow != null &&
    shadow.provisionalRecommendation.trim() !== legacy.recommendation.trim();

  return (
    <div className={cn("space-y-3", className)}>
      {/* ── Authoritative ─────────────────────────────────────────────────── */}
      <div className="rounded-md border border-border bg-card p-3">
        <div className="mb-1.5 flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Authoritative decision
          </span>
          <span className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium">
            Legacy engine
          </span>
        </div>
        <p className="text-sm text-foreground">{legacy.recommendation}</p>
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {legacy.recommendationCode && (
            <span>
              Code <span className="font-mono text-foreground">{legacy.recommendationCode}</span>
            </span>
          )}
          {legacy.figure && (
            <span>
              Pathway <span className="font-mono text-foreground">{legacy.figure}</span>
            </span>
          )}
          {legacy.riskLevel && <span>Risk {legacy.riskLevel}</span>}
          {legacy.referralPriority && <span>Priority {legacy.referralPriority}</span>}
          {typeof legacy.recallIntervalMonths === "number" && (
            <span>Recall {legacy.recallIntervalMonths} months</span>
          )}
        </div>
      </div>

      {/* ── Canonical shadow ──────────────────────────────────────────────── */}
      {shadow ? (
        <div className="rounded-md border border-dashed border-border bg-muted/30 p-3">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Canonical shadow — not authoritative
            </span>
            <span className="rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[10px]">
              {shadow.ruleVersionDisplay}
            </span>
            {canonicalStatus && (
              <span className="rounded border border-border bg-card px-1.5 py-0.5 text-[10px] font-medium">
                {canonicalStatus}
              </span>
            )}
            <span className="rounded border border-border bg-card px-1.5 py-0.5 text-[10px] font-medium">
              {shadow.evaluationMode}
            </span>
            {/* Defensive: a live mode here would be a defect, and must be visible. */}
            {shadowIsOperative && (
              <span className="rounded border border-destructive/40 bg-destructive/5 px-1.5 py-0.5 text-[10px] font-semibold text-destructive">
                Unexpected live mode
              </span>
            )}
          </div>

          <p className="text-sm text-foreground">{shadow.provisionalRecommendation}</p>

          <div className="mt-1.5 space-y-1">
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
            <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-muted-foreground">
              <span>checksum {shadow.rulesetChecksum.slice(0, 12)}</span>
              {shadow.evaluationId && <span>eval {shadow.evaluationId}</span>}
              {shadow.evaluatedAt && <span>{shadow.evaluatedAt}</span>}
            </div>
          </div>

          {differs && (
            <div className="mt-2 rounded border border-border bg-card px-2 py-1 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Shadow difference detected.</span>{" "}
              The canonical ruleset would state a different recommendation. This does not change
              the authoritative decision; reviewer confirmation is still required.
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-border bg-muted/20 p-3 text-xs text-muted-foreground">
          No canonical shadow evaluation was recorded for this decision.
        </div>
      )}
    </div>
  );
}
