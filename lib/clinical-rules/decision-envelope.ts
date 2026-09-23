/**
 * The one authoritative result shape.
 *
 * WHY ONE ENVELOPE
 * ----------------
 * The application previously answered "what happened to this case?" from four
 * different places: the summary columns, `decisionJson`, the canonical shadow
 * record, and whatever the drawer could infer from a recommendation code. They
 * could disagree, and they did — a row reading "no governed recommendation"
 * opened a drawer showing a legacy referral with a recall interval.
 *
 * Everything that decides, persists, reconstructs or displays a case now passes
 * this envelope around instead. It carries one status, one decision, one reason,
 * and the evidence needed to justify all three.
 *
 * WHAT IS NOT IN IT
 * -----------------
 * The legacy decision is present only under `legacyComparison`, as technical
 * evidence. Its recommendation, risk, priority and warnings are never read as
 * part of the authoritative result — that conflation is the defect this shape
 * exists to make structurally impossible.
 */

import type { ClinicalDecision } from "@/lib/engine/types";

import type { ClinicalAuthority } from "./authority";
import { isEvaluationUnavailable } from "./evaluation-unavailable";
import type { PriorityProvenance } from "./priority-provenance";

/**
 * What kind of answer this is.
 *
 * A safety stop is a COMPLETED evaluation, so it is NEEDS_INFORMATION or
 * CLINICIAN_REVIEW. EVALUATION_UNAVAILABLE means no evaluation produced a
 * result at all, which is a different thing and must never be shown as a
 * clinical outcome.
 */
export type EvaluationStatus =
  | "DECIDED"
  | "NEEDS_INFORMATION"
  | "CLINICIAN_REVIEW"
  | "EVALUATION_UNAVAILABLE";

export const EVALUATION_STATUS_LABEL: Record<EvaluationStatus, string> = {
  DECIDED: "Decision",
  NEEDS_INFORMATION: "Needs information",
  CLINICIAN_REVIEW: "Clinician review",
  EVALUATION_UNAVAILABLE: "Evaluation unavailable",
};

/** The pinned ruleset an evaluation was executed against. */
export type EvaluationPin = {
  ruleVersionId: string | null;
  ruleVersionDisplay: string | null;
  rulesetChecksum: string | null;
  engineVersion: string | null;
  /** The router that selected the pathway. Never the decision-maker. */
  routerEngine: string | null;
};

export type DecisionEnvelope = {
  status: EvaluationStatus;
  /** The authoritative decision. Under canonical authority, canonical's alone. */
  decision: ClinicalDecision;
  /** Short, plain-language why. The operative evaluation's own words. */
  reason: string;
  /** Rule-relevant, actionable. Never the whole rule vocabulary. */
  missingInformation: string[];

  authority: ClinicalAuthority["authorityEngine"];
  authorityReason: string;
  /** True when an existing case/run pin overrode the resolved authority. */
  pinned: boolean;
  pin: EvaluationPin;
  evaluationId: string | null;

  /** Ordered by governed precedence; [0] controls. */
  matchedRuleIds: string[];
  controllingRuleId: string | null;
  /** The evaluation's own recorded trace. Never reconstructed from a code. */
  trace: string[];
  sourceReferences: Array<{ document: string; reference: string }>;

  /** Null unless a priority has explicit supported provenance. */
  priorityProvenance: PriorityProvenance | null;

  /** Technical evidence only. Never part of the authoritative answer. */
  legacyComparison: {
    recommendation: string;
    recommendationCode: string;
    figure: string;
    riskLevel: string;
    referralPriority: string | null;
    clinicalWarnings: string[];
  } | null;
  adapterNotices: string[];
};

/**
 * Classify a decision into the four clinician-facing states.
 *
 * Deliberately derived from the decision itself rather than stored separately:
 * a status field that can drift from the decision it describes is another way
 * for two surfaces to disagree about one case.
 */
export function evaluationStatusFor(args: {
  decision: ClinicalDecision;
  /** True when the evaluation ran but reached no terminal outcome. */
  canonicalStopped?: boolean;
  engineStatus?: "success" | "error";
}): EvaluationStatus {
  const { decision } = args;
  if (isEvaluationUnavailable(decision) || args.engineStatus === "error") {
    return "EVALUATION_UNAVAILABLE";
  }
  if (
    decision.safetyOutcome === "INSUFFICIENT_INFORMATION" ||
    decision.safetyOutcome === "EXTERNAL_HISTORY_REQUIRED" ||
    (decision.missingInformation?.length ?? 0) > 0
  ) {
    return "NEEDS_INFORMATION";
  }
  if (decision.safetyOutcome === "CLINICIAN_REVIEW_REQUIRED" || args.canonicalStopped) {
    return "CLINICIAN_REVIEW";
  }
  return "DECIDED";
}

/** True when this envelope reached a governed recommendation worth metering. */
export function producedRecommendation(envelope: {
  status: EvaluationStatus;
}): boolean {
  return envelope.status !== "EVALUATION_UNAVAILABLE";
}
