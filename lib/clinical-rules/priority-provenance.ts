/**
 * May this referral priority be presented as a clinical booking priority?
 *
 * WHY THIS GATE EXISTS
 * --------------------
 * A P1 or P2 on a case is an instruction to a booking clerk. Four different
 * things have been feeding that field, and only one of them is a priority:
 *
 *   1. a governed urgency, from the rule's own stated timing — legitimate;
 *   2. the legacy router's genotype-only escalation (HPV16/18 → P2, Figure 6
 *      → P1), which no cited national or local policy supports;
 *   3. the controlling rule's `safetyPriority`, which describes how dangerous a
 *      software mistake would be, not how urgent the participant is;
 *   4. the partner's "Demo priority" spreadsheet column, which is an
 *      expectation, not guideline authority.
 *
 * Hiding (2)–(4) in the case drawer was not enough: they were still leaving the
 * building through the export package, the simulated PAS update, the CSV and
 * the Completed Decisions table, where they read as authoritative.
 *
 * THE RULE
 * --------
 * No priority provenance → no priority. Provenance is never INFERRED from the
 * legacy engine, from `safetyPriority`, from `riskLevel`, or from a source
 * spreadsheet column. Today exactly one source qualifies: a decision made under
 * CANONICAL authority, where the priority came from the governed urgency in
 * `decision-adapter.ts`.
 *
 * When a local booking policy is cited and versioned, it becomes the second
 * qualifying source and this is where it is added.
 */

/** Why a priority is allowed to be presented. Recorded, never inferred. */
export type PriorityProvenance = "GOVERNED_URGENCY";

export type PriorityBearingRecord = {
  /** Which engine decided this case. */
  authorityEngine?: string | null;
  referralPriority?: string | null;
};

/**
 * The priority that may be shown or exported, or null.
 *
 * Null means "no supported priority", which is different from P4 and must be
 * rendered as an absence, never as a low priority.
 */
export function presentableReferralPriority(
  record: PriorityBearingRecord
): string | null {
  if (!record.referralPriority) return null;
  if (record.authorityEngine !== "CANONICAL") return null;
  return record.referralPriority;
}

/** The provenance of a presentable priority, for audit surfaces. */
export function referralPriorityProvenance(
  record: PriorityBearingRecord
): PriorityProvenance | null {
  return presentableReferralPriority(record) ? "GOVERNED_URGENCY" : null;
}

/**
 * Urgency for operational counting, using only supportable signals.
 *
 * Deliberately excludes `riskLevel`: the legacy router's URGENT is a routing
 * artefact, and `NOT_ASSESSED` is the absence of a judgement. A count that
 * mixes them tells an operator a number they cannot act on.
 */
export function isSupportedUrgentPriority(record: PriorityBearingRecord): boolean {
  const priority = presentableReferralPriority(record);
  return priority === "P1" || priority === "P1_HSC";
}

/** Shown wherever a priority would have been, when none is supportable. */
export const NO_SUPPORTED_PRIORITY_LABEL = "Not stated";
