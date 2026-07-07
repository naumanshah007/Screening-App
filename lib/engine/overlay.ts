// Guideline-figure overlay: a safe, admin-editable layer applied ON TOP of the
// hardcoded decision engine output. It can adjust an existing branch's *outputs*
// (recall interval, referral priority, review requirement, wording, extra
// warnings, or disable the override) — but it can NEVER change the branch's
// figure, referral destination, or lower its risk level. The code branch always
// remains the source of truth; with no overlay (or a disabled entry) the engine
// behaves exactly as before.

import type { ClinicalDecision, ReferralPriority, RiskLevel } from "./types";

export type GuidelineOverlayEntry = {
  /** When true, this override is ignored and the code default is used. */
  disabled?: boolean;
  recallIntervalMonths?: number;
  referralPriority?: ReferralPriority;
  /** Force a mandatory clinician review on this branch (can only add, never remove). */
  requireReview?: boolean;
  /** Replace the recommendation wording. */
  recommendation?: string;
  /** Replace the next-action wording. */
  nextAction?: string;
  /** Extra clinical warnings appended (never replaces existing warnings). */
  extraWarnings?: string[];
};

export type GuidelineOverlay = {
  enabled: boolean;
  /** Keyed by recommendationCode (see lib/engine/rule-catalog.ts). */
  entries: Record<string, GuidelineOverlayEntry>;
};

const RISK_RANK: Record<RiskLevel, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, URGENT: 4 };

/**
 * Fields an overlay entry is permitted to touch. Anything outside this list
 * (figure, referralType, recommendationCode, riskLevel-down, etc.) is ignored,
 * so a malformed or malicious overlay can never re-route or de-escalate a case.
 */
const ALLOWED_FIELDS: (keyof GuidelineOverlayEntry)[] = [
  "recallIntervalMonths",
  "referralPriority",
  "requireReview",
  "recommendation",
  "nextAction",
  "extraWarnings",
];

/**
 * Returns true if applying `entry` to `decision` would relax a safety control
 * (longer recall, lower-urgency referral priority, or removing a review). Used
 * by the admin UI / governance to require reviewer confirmation — the engine
 * still applies it; gating is a publish-time concern.
 */
export function overlayRelaxesSafety(decision: ClinicalDecision, entry: GuidelineOverlayEntry): boolean {
  if (entry.disabled) return false;
  const longerRecall =
    typeof entry.recallIntervalMonths === "number" &&
    typeof decision.recallIntervalMonths === "number" &&
    entry.recallIntervalMonths > decision.recallIntervalMonths;
  const lowerPriority =
    entry.referralPriority !== undefined &&
    decision.referralPriority !== undefined &&
    priorityRank(entry.referralPriority) < priorityRank(decision.referralPriority);
  // requireReview can only add review, never remove — so it never relaxes.
  return longerRecall || lowerPriority;
}

// Higher = more urgent (P1 most urgent).
function priorityRank(p: ReferralPriority): number {
  return { P1: 4, P2: 3, P3: 2, P4: 1 }[p] ?? 0;
}

export function applyGuidelineOverlay(
  decision: ClinicalDecision,
  overlay?: GuidelineOverlay
): ClinicalDecision {
  if (!overlay || !overlay.enabled) return decision;
  const entry = overlay.entries[decision.recommendationCode];
  if (!entry || entry.disabled) return decision;

  const next: ClinicalDecision = { ...decision };
  let touched = false;

  for (const field of ALLOWED_FIELDS) {
    if (entry[field] === undefined) continue;
    switch (field) {
      case "recallIntervalMonths":
        next.recallIntervalMonths = entry.recallIntervalMonths;
        next.nextScreeningIntervalMonths = entry.recallIntervalMonths;
        touched = true;
        break;
      case "referralPriority":
        // Only meaningful when the branch already issues a referral.
        if (decision.referralRequired) {
          next.referralPriority = entry.referralPriority;
          touched = true;
        }
        break;
      case "requireReview":
        if (entry.requireReview) {
          next.safetyOutcome = "CLINICIAN_REVIEW_REQUIRED";
          next.validationStatus = "REQUIRES_CLINICAL_CONFIRMATION";
          // Never lower risk; nudge up to at least HIGH when review is forced.
          if (RISK_RANK[next.riskLevel] < RISK_RANK.HIGH) next.riskLevel = "HIGH";
          touched = true;
        }
        break;
      case "recommendation":
        next.recommendation = entry.recommendation!;
        touched = true;
        break;
      case "nextAction":
        next.nextAction = entry.nextAction!;
        touched = true;
        break;
      case "extraWarnings":
        if (entry.extraWarnings && entry.extraWarnings.length > 0) {
          next.clinicalWarnings = [...(decision.clinicalWarnings ?? []), ...entry.extraWarnings];
          touched = true;
        }
        break;
    }
  }

  if (!touched) return decision;

  // Guardrail: an overlay may never lower the risk level below the code default.
  if (RISK_RANK[next.riskLevel] < RISK_RANK[decision.riskLevel]) {
    next.riskLevel = decision.riskLevel;
  }

  next.branchPath = [...(decision.branchPath ?? [decision.figure, decision.recommendationCode]), "ADMIN_OVERLAY_APPLIED"];
  return next;
}
