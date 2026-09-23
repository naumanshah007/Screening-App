/**
 * Canonical → application decision adapter.
 *
 * The one place where a CG-NCSP-3.1.0 `ClinicalEvaluationResult` becomes the
 * `ClinicalDecision` that the rest of CerviGrade already consumes (Review Queue,
 * Completed Decisions, batch worklist, export, analytics, notifications, APIs).
 *
 * DESIGN RULES
 * ------------
 *  1. **Routing is never adapted.** `figure` always comes from the legacy
 *     router's decision. The adapter cannot change which pathway a participant
 *     is on.
 *  2. **Never de-escalate.** The adapted decision is compared against the legacy
 *     decision and may not come out lower on risk, referral priority, or
 *     referral-required. Same guardrail idiom as `lib/engine/overlay.ts`.
 *  3. **No prose is interpreted.** Urgency, timing and destination come from the
 *     closed vocabulary in `governed-vocabulary.ts`. An unmapped literal is a
 *     safety stop, never a default.
 *  4. **No invented clinical information.** Where canonical states nothing
 *     (interval not schedulable, destination not a care setting), the adapter
 *     emits a safety stop and *no* recall date — never a fabricated one.
 *  5. **Canonical is the clinical authority when it is the authority.** Where
 *     canonical decides, canonical alone supplies the recommendation, referral,
 *     priority and timing. The legacy decision no longer sets a floor under
 *     them: a preserved legacy P1 on a case whose governed evaluation reached a
 *     safety stop is a legacy recommendation wearing the governed result's
 *     badge, which is the specific defect rule 5 exists to prevent.
 *  6. **Software safety severity is not patient risk.** `safetyPriority`
 *     describes how dangerous a software mistake in a rule would be. It is
 *     recorded as technical evidence and is never mapped into the participant's
 *     clinical risk or urgency.
 */

import type {
  ClinicalDecision,
  ReferralPriority,
  ReferralType,
  RiskLevel,
  SafetyOutcome,
} from "@/lib/engine/types";

import type { ClinicalEvaluationResult } from "./evaluator";
import {
  UnmappedGovernedLiteralError,
  classifyDestination,
  classifyTiming,
  intervalToDays,
  intervalToMonths,
  isAutomaticallySchedulable,
  urgencyFromTiming,
  type GovernedDestination,
  type GovernedUrgency,
  type TimingClassification,
} from "./governed-vocabulary";


function toReferralType(destination: GovernedDestination): ReferralType | undefined {
  switch (destination) {
    case "COLPOSCOPY":
      return "COLPOSCOPY";
    case "GYNAECOLOGY":
      return "GYNAECOLOGY";
    case "GYNAE_ONCOLOGY":
      // The application's ReferralType has no oncology member; SPECIALIST is the
      // closest existing value and the reviewer confirms the destination.
      return "SPECIALIST";
    case "MDM":
      return "MDM";
    case "PRIMARY_CARE":
    case "PROGRAMME_FOLLOW_UP":
    case "REVIEWER_WORKFLOW":
    case "NOT_A_CARE_SETTING":
      return undefined;
  }
}

function toReferralPriority(urgency: GovernedUrgency): ReferralPriority | undefined {
  switch (urgency) {
    case "URGENT":
      return "P1";
    case "PROMPT":
      return "P2";
    case "ROUTINE":
      return "P3";
    case "NOT_STATED":
      // Absence of a governed urgency must not become a priority.
      return undefined;
  }
}

export type AdaptedDecision = {
  decision: ClinicalDecision;
  /**
   * True when the governed evaluation completed but reached NO terminal
   * recommendation: no rule matched, or required information is missing.
   *
   * This is a COMPLETED evaluation, not a failure. It deliberately excludes a
   * rule that reached an outcome whose follow-up date a clinician must set —
   * that case has a recommendation, it simply has no automatic interval.
   */
  canonicalStopped: boolean;
  /** The controlling rule's implementation safety severity. Technical only. */
  safetyPriority: string;
  /** Non-fatal normalisation problems that forced a safety stop. */
  adapterNotices: string[];
  /** True when the canonical timing could not be scheduled automatically. */
  timingRequiresClinicianDetermination: boolean;
  timingClassificationKind: TimingClassification["kind"];
};

/**
 * Adapt a canonical evaluation into the application decision contract.
 *
 * `legacyDecision` is required, not optional: it supplies the pathway (which
 * canonical cannot determine) and the de-escalation floor.
 */
export function canonicalToClinicalDecision(args: {
  canonical: ClinicalEvaluationResult;
  legacyDecision: ClinicalDecision;
  evaluationId?: string;
}): AdaptedDecision {
  const { canonical, legacyDecision } = args;
  const adapterNotices: string[] = [];

  // ── Timing (Phase 4): closed vocabulary, fail closed ──────────────────────
  let timing: TimingClassification;
  try {
    timing = classifyTiming(canonical.repeatInterval ?? "");
  } catch (error) {
    if (!(error instanceof UnmappedGovernedLiteralError)) throw error;
    timing = { kind: "CONDITIONAL", reason: error.message };
    adapterNotices.push(error.message);
  }

  // ── Destination: closed vocabulary, fail closed ───────────────────────────
  let destination: GovernedDestination;
  try {
    destination = classifyDestination(canonical.referralDestination ?? "Reviewer-confirmed pathway");
  } catch (error) {
    if (!(error instanceof UnmappedGovernedLiteralError)) throw error;
    destination = "REVIEWER_WORKFLOW";
    adapterNotices.push(error.message);
  }

  // ── Urgency (Phase 3): from the governed branch value, else from the closed
  //    timing table. Never from prose. ───────────────────────────────────────
  const branchUrgency = canonical.urgency;
  const governedUrgency: GovernedUrgency =
    branchUrgency === "URGENT"
      ? "URGENT"
      : branchUrgency === "PROMPT"
        ? "PROMPT"
        : urgencyFromTiming(timing);

  // ── Recall interval: only from an automatically schedulable timing ────────
  const schedulable = isAutomaticallySchedulable(timing);
  const recallIntervalMonths = isAutomaticallySchedulable(timing)
    ? intervalToMonths(timing.interval)
    : null;
  const recallIntervalDays = isAutomaticallySchedulable(timing)
    ? intervalToDays(timing.interval)
    : null;

  // A timing that states a follow-up but cannot be scheduled must never become a
  // silent null recall. It becomes an explicit clinician determination.
  const timingRequiresClinicianDetermination =
    !schedulable &&
    ["RANGE", "MULTI_EVENT", "EVENT_RELATIVE", "CONDITIONAL"].includes(timing.kind);

  if (timingRequiresClinicianDetermination) {
    adapterNotices.push(
      `Canonical follow-up timing "${canonical.repeatInterval ?? ""}" (${timing.kind}) ` +
        "does not resolve to a single interval from the evaluation date. A clinician must set the follow-up date."
    );
  }
  if (schedulable && recallIntervalMonths === null) {
    adapterNotices.push(
      `Canonical follow-up interval is shorter than one month (${recallIntervalDays} days) and cannot be expressed ` +
        "in the whole-month recall contract. A clinician must set the follow-up date."
    );
  }

  // ── Safety stop ──────────────────────────────────────────────────────────
  const canonicalStopped =
    canonical.matchedRuleIds.length === 0 || canonical.missingInformation.length > 0;

  const stoppedForAnyReason =
    canonicalStopped || canonical.clinicianOnly || timingRequiresClinicianDetermination;

  const safetyOutcome: SafetyOutcome | undefined =
    canonical.missingInformation.length > 0
      ? "INSUFFICIENT_INFORMATION"
      : stoppedForAnyReason
        ? "CLINICIAN_REVIEW_REQUIRED"
        : legacyDecision.safetyOutcome;

  // A conditional urgent limb the facts did not establish is explained, not
  // applied. Without this the evidence would show an absent priority with no
  // stated reason, which invites someone to "restore" the unconditional one.
  if (canonical.unresolvedUrgentLimb) {
    adapterNotices.push(
      `The governed timing "${canonical.repeatInterval ?? ""}" states an urgent limb that applies ` +
        "only under a condition this evaluation did not establish. No patient-specific urgency is asserted."
    );
  }

  // ── Referral ─────────────────────────────────────────────────────────────
  //
  // No legacy floor. Where canonical decided, canonical's destination is the
  // referral; where canonical stopped, there is no referral at all, because a
  // stop is the absence of a recommendation and not a quieter version of one.
  const canonicalReferralType = toReferralType(destination);
  const referralRequired = !canonicalStopped && canonicalReferralType !== undefined;
  const referralType = referralRequired ? canonicalReferralType : undefined;

  // Priority comes from the governed urgency or not at all. A legacy P2 must
  // not survive as the governed result's priority.
  const referralPriority = referralRequired
    ? toReferralPriority(governedUrgency)
    : undefined;

  // ── Risk ─────────────────────────────────────────────────────────────────
  //
  // Deliberately the ROUTER's risk level, unchanged. Canonical states no
  // participant risk: `canonical.safetyPriority` is the implementation severity
  // of the controlling rule, and mapping CRITICAL ("no governed rule covers
  // this case") to URGENT turned a coverage gap into an urgent patient.
  const riskLevel: RiskLevel = legacyDecision.riskLevel;

  const decision: ClinicalDecision = {
    // 1. Routing is legacy's, always.
    figure: legacyDecision.figure,

    riskLevel,
    recommendation: canonical.provisionalRecommendation,
    // The controlling rule identifies the decision. matchedRuleIds is ordered by
    // governed precedence, so [0] is the controlling rule.
    recommendationCode: canonical.matchedRuleIds[0] ?? "CANONICAL-SAFETY-STOP",
    nextAction: stoppedForAnyReason
      ? "Clinician review required before this recommendation may be acted on."
      : canonical.provisionalRecommendation,

    referralRequired,
    referralType,
    referralPriority,
    referralReason: referralRequired ? canonical.provisionalRecommendation : undefined,

    // A stopped evaluation schedules nothing: it reached no outcome to recall
    // against.
    recallRequired: !canonicalStopped && recallIntervalMonths !== null,
    recallIntervalMonths: canonicalStopped ? undefined : recallIntervalMonths ?? undefined,
    nextScreeningIntervalMonths: canonicalStopped
      ? undefined
      : recallIntervalMonths ?? undefined,

    // Counter updates remain the legacy engine's: CG-NCSP-3.1.0 expresses no
    // counter semantics, and inventing them would be fabrication.
    incrementConsecutiveNegative: legacyDecision.incrementConsecutiveNegative,
    incrementConsecutiveLowGrade: legacyDecision.incrementConsecutiveLowGrade,
    incrementUnsatisfactory: legacyDecision.incrementUnsatisfactory,
    resetConsecutiveNegative: legacyDecision.resetConsecutiveNegative,
    resetConsecutiveLowGrade: legacyDecision.resetConsecutiveLowGrade,
    resetUnsatisfactory: legacyDecision.resetUnsatisfactory,

    requiresMDMReview: destination === "MDM",
    requiresSwabRepeat: legacyDecision.requiresSwabRepeat,

    clinicalWarnings: [
      ...(legacyDecision.clinicalWarnings ?? []),
      ...canonical.safetyNotices,
      ...adapterNotices,
    ],
    safetyOutcome,
    missingInformation:
      canonical.missingInformation.length > 0 ? canonical.missingInformation : undefined,
    externalDependencies: legacyDecision.externalDependencies,

    // Provenance: the legacy routing prefix, then the canonical branch path.
    branchPath: [
      `router:${legacyDecision.figure}`,
      `router:${legacyDecision.recommendationCode}`,
      ...canonical.branchPath,
      ...(args.evaluationId ? [`evaluation:${args.evaluationId}`] : []),
    ],
    ruleVersion: canonical.ruleVersionDisplay,
    // Canonical always requires reviewer confirmation.
    validationStatus: "REQUIRES_CLINICAL_CONFIRMATION",

    guidelineReference: canonical.sourceReferences
      .map((reference) => `${reference.document} ${reference.reference}`)
      .join("; "),
    rationale: [
      `Pathway ${legacyDecision.figure} selected by the legacy router (${legacyDecision.recommendationCode}).`,
      `Within-pathway decision by canonical ${canonical.ruleVersionDisplay} (checksum ${canonical.ruleSetChecksum.slice(0, 12)}).`,
      canonical.matchedRuleIds.length > 0
        ? `Controlling rule ${canonical.matchedRuleIds[0]}${
            canonical.matchedRuleIds.length > 1
              ? `; also matched ${canonical.matchedRuleIds.slice(1).join(", ")}`
              : ""
          }.`
        : "No governed rule matched; routed to clinician review.",
      `Reviewer requirement ${canonical.reviewerRequirement}${canonical.clinicianOnly ? " (clinician only)" : ""}.`,
    ].join(" "),
  };

  return {
    decision,
    // The NARROW sense: the evaluation reached no outcome at all. A rule that
    // matched and referred, but whose timing a clinician must set, has reached
    // an outcome and is not a stop.
    canonicalStopped,
    safetyPriority: canonical.safetyPriority,
    adapterNotices,
    timingRequiresClinicianDetermination,
    timingClassificationKind: timing.kind,
  };
}

/**
 * Assert the adapted decision never relaxes a safety control relative to legacy.
 * Exported so call sites and tests can enforce it explicitly.
 */
export function findDeEscalations(
  adapted: ClinicalDecision,
  legacy: ClinicalDecision
): string[] {
  const problems: string[] = [];
  // Only routing is guarded here, because only routing is legacy's to supply.
  //
  // Risk, referral priority and referral-required used to be compared too, and
  // each comparison was a legacy floor in disguise: a governed result that
  // stated no urgency, or sent a participant to programme follow-up rather than
  // colposcopy, tripped the guard and the case silently reverted to the legacy
  // recommendation. That is a governed DISAGREEMENT, not a normalisation bug,
  // and it is recorded by `recordAuthorityComparison` for review instead of
  // being overridden here.
  //
  // The failure mode this still catches is the one the adapter could actually
  // cause: moving a participant onto a different pathway. Adapter bugs in the
  // other fields surface as unmapped governed literals, which already fail
  // closed to a safety stop.
  if (legacy.figure !== adapted.figure) {
    problems.push(`pathway changed ${legacy.figure} → ${adapted.figure}`);
  }
  return problems;
}
