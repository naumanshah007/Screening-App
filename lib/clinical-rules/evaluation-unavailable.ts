/**
 * The one explicit state for "the governed evaluation did not produce a result".
 *
 * WHY THIS EXISTS
 * ---------------
 * A governed evaluation can fail in four different places — no rule version
 * resolved, the evaluator threw, the adapter threw, the persistence update threw
 * — and each of those used to be handled separately. Three of them quietly
 * returned the LEGACY decision, which is a clinical recommendation produced by
 * an engine that is not the authority for a new case. A reader could not tell
 * that apart from a governed recommendation.
 *
 * All four now resolve to this single state. It says what happened, carries no
 * clinical action, no timing and no priority, and requires clinician review.
 *
 * It is NOT a safety stop. A safety stop is a COMPLETED evaluation that
 * deliberately stopped. This is the absence of an evaluation.
 */

import type { ClinicalDecision } from "@/lib/engine/types";

export const EVALUATION_UNAVAILABLE_CODE = "EVALUATION-UNAVAILABLE";

export const EVALUATION_UNAVAILABLE_TEXT =
  "Governed evaluation unavailable — clinician review required.";

export const EVALUATION_UNAVAILABLE_ACTION =
  "No recommendation is offered. A clinician must review this case.";

/** True when a decision is the explicit unavailable state rather than a result. */
export function isEvaluationUnavailable(decision: {
  recommendationCode?: string | null;
}): boolean {
  return decision.recommendationCode === EVALUATION_UNAVAILABLE_CODE;
}

/**
 * Build the unavailable decision.
 *
 * The pathway is retained because routing genuinely happened and is useful
 * context. Nothing else from the legacy decision is carried: no referral, no
 * priority, no recall, no risk elevation, no legacy recommendation text.
 */
export function evaluationUnavailableDecision(args: {
  /** Retained for pathway context only. */
  figure: ClinicalDecision["figure"];
  /** Why the evaluation is unavailable. Recorded, not clinical guidance. */
  reason: string;
}): ClinicalDecision {
  return {
    figure: args.figure,
    // The lowest rung of the technical risk domain. This states nothing about
    // the participant: no evaluation ran, so no clinical risk was determined.
    riskLevel: "LOW",
    recommendation: EVALUATION_UNAVAILABLE_TEXT,
    recommendationCode: EVALUATION_UNAVAILABLE_CODE,
    nextAction: EVALUATION_UNAVAILABLE_ACTION,
    referralRequired: false,
    recallRequired: false,
    safetyOutcome: "CLINICIAN_REVIEW_REQUIRED",
    validationStatus: "REQUIRES_CLINICAL_CONFIRMATION",
    clinicalWarnings: [args.reason],
    branchPath: [`router:${args.figure}`, "evaluation:unavailable"],
  };
}
