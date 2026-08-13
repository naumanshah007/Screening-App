/**
 * Shared markers for a pre-persistence routing preview.
 *
 * A Pull Cases preview has been routed by the legacy engine but has NOT been
 * evaluated by the current governed ruleset — that happens at persistence time
 * via saveBatchRun → evaluateGradedDecision. Until then there is no
 * authoritative decision, no controlling governed rule, and no clinical action.
 *
 * The API redacts the legacy recommendation using these constants and the UI
 * detects the same marker, so a single source of truth decides whether a row is
 * "routed but not yet decided". Duplicating the string in the UI would let the
 * two drift and quietly reintroduce a preview that reads as authoritative.
 */

export const PREVIEW_PENDING_CODE = "PREVIEW-PENDING-GOVERNED-EVALUATION";

export const PREVIEW_PENDING_TEXT =
  "Routing complete — recommendation is generated when added to the Review Queue.";

/** Placeholder for any field that only exists once a governed rule has run. */
export const PREVIEW_PENDING_FIELD = "Pending governed evaluation";

/** Placeholder for the action a governed evaluation would determine. */
export const PREVIEW_PENDING_ACTION = "Generated after governed evaluation";

/**
 * True when a decision is a routing preview rather than a governed evaluation.
 *
 * Keyed on the recommendation code because that is what the API replaces, and
 * it survives serialisation to the client unchanged.
 */
export function isRoutingPreview(decision: {
  recommendationCode?: string | null;
}): boolean {
  return decision.recommendationCode === PREVIEW_PENDING_CODE;
}
