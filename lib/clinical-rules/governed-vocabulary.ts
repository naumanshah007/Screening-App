/**
 * Governed vocabulary for canonical rule outputs.
 *
 * WHY THIS EXISTS
 * ---------------
 * CG-NCSP-3.1.0 carries `timingDestination` and `careSetting` as free-text
 * strings transcribed from the source rulebook, and `outcomeBranches[].urgency`
 * as an optional free-text string. Before this module the application derived
 * clinically meaningful values from that prose at runtime:
 *
 *   - urgency by regex   (`/immediate|urgent|P1\b/i` over concatenated text)
 *   - recall interval by parsing the timing string into a month count
 *
 * Both are unsafe as a clinical authority: a wording change silently changes a
 * clinical output, and a parse miss silently yields `undefined` — which, for a
 * recall interval, means a participant is never recalled.
 *
 * WHAT THIS MODULE DOES INSTEAD
 * -----------------------------
 * A **closed, exact-literal lookup table**. Every distinct string the governed
 * snapshot emits has one explicit, reviewed entry. There is no pattern matching,
 * no substring test, no normalisation beyond trimming — the key is the literal.
 *
 * Consequences, all deliberate:
 *
 *   1. A wording change in a future ruleset does not change behaviour. It
 *      produces an *unmapped literal*, which fails closed and fails the
 *      completeness test. Prose can no longer move a clinical output.
 *   2. Only `EXACT` timings yield an automated recall date. Ranges, multi-event
 *      schedules, event-anchored timings and fact-conditional timings do not —
 *      they route to clinician determination. Choosing a number for
 *      "6 weeks-3 months" or "20 or 30 working days according to risk/history"
 *      would be inventing clinical information, which is prohibited.
 *   3. An unmapped literal is a safety stop, never a silent default.
 *
 * WHAT THIS MODULE IS NOT
 * -----------------------
 * It is not a clinical decision. Every entry records what the source text
 * already says, or records that the source text does not say enough to schedule
 * automatically. No entry adds, shortens or lengthens a clinical interval.
 *
 * Changing an entry from a non-EXACT class to `EXACT` is a clinical change and
 * requires the same governance as a ruleset change.
 */

// ── Timing ──────────────────────────────────────────────────────────────────

export type TimingUnit = "DAYS" | "WEEKS" | "MONTHS" | "YEARS";

export type StructuredInterval = { value: number; unit: TimingUnit };

export type TimingClassification =
  /** A single unambiguous interval measured from the evaluation date. Safe to schedule automatically. */
  | { kind: "EXACT"; interval: StructuredInterval }
  /** An explicit upper bound ("within 2 weeks"). Schedulable at the bound; never later. */
  | { kind: "BOUNDED_MAX"; interval: StructuredInterval }
  /** An explicit range stated by the source. Not schedulable without a clinical choice of point. */
  | { kind: "RANGE"; min: StructuredInterval; max: StructuredInterval }
  /** A schedule of several events, not one date. */
  | { kind: "MULTI_EVENT"; events: StructuredInterval[] }
  /** Act now; no recall interval applies. */
  | { kind: "IMMEDIATE" }
  /** Anchored to a clinical event or date other than the evaluation date (treatment, hysterectomy, postpartum, age). */
  | { kind: "EVENT_RELATIVE"; anchor: string }
  /**
   * Depends on facts the string alone cannot resolve. Clinician determines the
   * date.
   *
   * `escalatesWhen` records the urgency the source states for its *urgent limb*,
   * where it states one. It is recorded here once, by review, rather than
   * inferred at runtime. The adapter fails safe to it: escalating a case that
   * turns out not to meet the condition is safe, while silently dropping the
   * urgency of a case that does meet it is not. The reviewer confirms which limb
   * applies, because every canonical result requires reviewer confirmation.
   */
  | { kind: "CONDITIONAL"; reason: string; escalatesWhen?: GovernedUrgency }
  /** The field carries a destination or programme state, not a timing. */
  | { kind: "NOT_A_TIMING" }
  /** Timing is carried by the selected outcome branch instead. */
  | { kind: "DEFERRED_TO_OUTCOME" }
  /** The source states no timing for this rule. */
  | { kind: "NONE" };

const exact = (value: number, unit: TimingUnit): TimingClassification => ({
  kind: "EXACT",
  interval: { value, unit },
});
const boundedMax = (value: number, unit: TimingUnit): TimingClassification => ({
  kind: "BOUNDED_MAX",
  interval: { value, unit },
});
const range = (
  min: StructuredInterval,
  max: StructuredInterval
): TimingClassification => ({ kind: "RANGE", min, max });
const multi = (...events: StructuredInterval[]): TimingClassification => ({
  kind: "MULTI_EVENT",
  events,
});
const immediate = (): TimingClassification => ({ kind: "IMMEDIATE" });
const eventRelative = (anchor: string): TimingClassification => ({
  kind: "EVENT_RELATIVE",
  anchor,
});
const conditional = (
  reason: string,
  escalatesWhen?: GovernedUrgency
): TimingClassification => ({
  kind: "CONDITIONAL",
  reason,
  ...(escalatesWhen ? { escalatesWhen } : {}),
});
const notATiming = (): TimingClassification => ({ kind: "NOT_A_TIMING" });

const months = (value: number): StructuredInterval => ({ value, unit: "MONTHS" });
const weeks = (value: number): StructuredInterval => ({ value, unit: "WEEKS" });

/**
 * Every distinct `timingDestination` literal emitted by CG-NCSP-3.1.0.
 *
 * Verified complete by `timing-vocabulary-completeness.test.ts`, which rebuilds
 * the governed snapshot and asserts no literal is missing and no entry is
 * unused. 104 entries at CG-NCSP-3.1.0.
 */
export const TIMING_VOCABULARY: Readonly<Record<string, TimingClassification>> =
  Object.freeze({
    // ── No timing stated ────────────────────────────────────────────────────
    "": { kind: "NONE" },
    "As specified by outcome": { kind: "DEFERRED_TO_OUTCOME" },

    // ── Exact intervals from the evaluation date ────────────────────────────
    // These are the ONLY entries that produce an automated recall date.
    "12 months": exact(12, "MONTHS"),
    "12 months later": exact(12, "MONTHS"),
    "12-month repeat under Figure 4 surveillance": exact(12, "MONTHS"),
    "6 months": exact(6, "MONTHS"),
    "5 years": exact(5, "YEARS"),
    "3 years": exact(3, "YEARS"),
    Annually: exact(1, "YEARS"),
    Annual: exact(1, "YEARS"),

    // ── Explicit upper bounds ───────────────────────────────────────────────
    "Urgent; within 2 weeks": boundedMax(2, "WEEKS"),
    "Before 24 months": boundedMax(24, "MONTHS"),

    // ── Stated ranges — a point within the range is a clinical choice ───────
    "6-8 weeks": range(weeks(6), weeks(8)),
    "6 weeks to 3 months": range(weeks(6), months(3)),

    // ── Multi-event schedules — not a single date ───────────────────────────
    "6 and 18 months": multi(months(6), months(18)),
    "12/24 month surveillance": multi(months(12), months(24)),
    "6, 12, 18, 24 months": multi(months(6), months(12), months(18), months(24)),
    "6/18 months and annual sequence": multi(months(6), months(18)),

    // ── Act now ─────────────────────────────────────────────────────────────
    Immediate: immediate(),
    "Immediate exit": immediate(),
    "Immediate information request": immediate(),
    Now: immediate(),
    Urgent: immediate(),
    "Urgent/without delay": immediate(),
    "Without delay": immediate(),
    "Without avoidable delay": immediate(),
    ASAP: immediate(),
    "As soon as practicable": immediate(),
    "As soon as practicable for triage": immediate(),
    "Do not defer/exit": immediate(),

    // ── Anchored to an event other than the evaluation date ─────────────────
    "Next scheduled visit": eventRelative("next scheduled screening visit"),
    "According to specialist plan": eventRelative("specialist care plan"),
    "According to pathway": eventRelative("pathway definition"),
    "According to Figure 3": eventRelative("Figure 3 screening interval"),
    "According to the current screening due date": eventRelative("current screening due date"),
    "After histology": eventRelative("histology result"),
    "After second test event": eventRelative("second test event"),
    "After third test event": eventRelative("third test event"),
    "After second qualifying co-test": eventRelative("second qualifying co-test"),
    "After qualifying 6- and 18-month co-tests": eventRelative("qualifying 6- and 18-month co-tests"),
    "After the 6-8 week reassessment": eventRelative("6-8 week reassessment"),
    "At transition": eventRelative("programme transition"),
    "At intake": eventRelative("intake"),
    "At disposition": eventRelative("reviewer disposition"),
    "At export": eventRelative("decision package export"),
    "At abnormal follow-up": eventRelative("abnormal follow-up result"),
    "At abnormal result": eventRelative("abnormal result"),
    "At any surveillance event": eventRelative("surveillance event"),
    "At age 25": eventRelative("participant age 25"),
    "Before evaluation": eventRelative("evaluation"),
    "Before excision": eventRelative("excisional treatment"),
    "Before treatment": eventRelative("treatment"),
    "Before 6-month surveillance": eventRelative("6-month surveillance event"),
    "On regrade": eventRelative("regrade"),
    "Initial assessment": eventRelative("initial assessment"),
    "6 months post-treatment": eventRelative("treatment date"),
    "6 months post-hysterectomy": eventRelative("hysterectomy date"),
    "6 months post-hysterectomy in Table 1": eventRelative("hysterectomy date"),
    "6-12 weeks postpartum": eventRelative("delivery date"),
    "Postpartum management": eventRelative("delivery date"),
    "12 months between qualifying co-tests": eventRelative("previous qualifying co-test"),
    "12 months apart": eventRelative("previous qualifying test"),
    "Review 6-8 weeks after clinician-led treatment/investigation": eventRelative(
      "clinician-led treatment or investigation"
    ),
    "Review 6-8 weeks after recorded STI treatment": eventRelative("recorded STI treatment"),

    // ── Fact-conditional: the string alone cannot resolve a date ────────────
    "5 years or 3 years if immune deficient": conditional(
      "interval depends on immune classification"
    ),
    // Conditional entries whose source text states an urgent limb. The urgency
    // is recorded once here, under review; it is never inferred at runtime.
    "Immediate/urgent where cancer suspected": conditional("depends on cancer suspicion", "URGENT"),
    "Immediate/ongoing follow-up": conditional(
      "immediate action and ongoing follow-up differ",
      "URGENT"
    ),
    "Urgent when malignant": conditional("depends on malignancy", "URGENT"),
    "Urgent if malignant": conditional("depends on malignancy", "URGENT"),
    "Urgent if invasive": conditional("depends on invasion status", "URGENT"),
    "Urgent within 2 weeks if invasive cancer suspected/definite": conditional(
      "depends on invasive cancer suspicion",
      "URGENT"
    ),
    "Urgent where invasive glandular disease is suspected": conditional(
      "depends on invasive glandular disease suspicion",
      "URGENT"
    ),
    "Urgent where invasive glandular disease is suspected or definite": conditional(
      "depends on invasive glandular disease status",
      "URGENT"
    ),
    "Urgent / within 2 weeks where specified": conditional(
      "applies only where the source specifies",
      "URGENT"
    ),
    "Urgent / within 2 weeks where source applies": conditional(
      "applies only where the source applies",
      "URGENT"
    ),
    "Urgent / within 2 weeks when invasion confirmed or strongly suspected": conditional(
      "depends on invasion status",
      "URGENT"
    ),
    "Urgent gynaecological oncology review; within 2 weeks when invasive disease is indicated":
      conditional("depends on whether invasive disease is indicated", "URGENT"),
    "Immediate/urgent as applicable": conditional("depends on applicability", "URGENT"),
    "Immediate after diagnosis / at 24 months": conditional("two distinct events", "URGENT"),
    "Now / next available screening": conditional("two distinct timings", "URGENT"),
    "20 or 30 working days according to risk/history; urgent if invasive cytology": conditional(
      "depends on risk category, history and cytology",
      "URGENT"
    ),
    "6 weeks-3 months or immediate colposcopy": conditional(
      "range or immediate referral",
      "URGENT"
    ),
    "ASAP or 6 weeks-3 months as applicable": conditional(
      "immediate or range depending on applicability",
      "URGENT"
    ),

    // Conditional entries whose source text states no urgency for any limb.
    "According to result": conditional("depends on the result"),
    "According to HPV16/18 referral priority": conditional("depends on HPV genotype referral priority"),
    "According to the colposcopy referral risk category": conditional(
      "depends on colposcopy referral risk category"
    ),
    "As clinically indicated": conditional("clinician determines"),
    "6 months, or 6-12 weeks postpartum": conditional("depends on pregnancy status"),
    "6 months or 6-12 weeks postpartum": conditional("depends on pregnancy status"),
    "6 and 18 months when HPV-detected AIS has clear excision margins": conditional(
      "depends on AIS HPV status and margin status"
    ),
    "6 months post-hysterectomy where specified": conditional("applies only where the source specifies"),
    "12 months later / 18 months post-treatment": conditional("two distinct anchors"),
    "Repeat in 12 months (24 months post-discharge)": conditional("two distinct anchors"),
    "Colposcopy or ongoing annual co-testing": conditional("referral or surveillance"),
    "Review at 6-8 weeks if a clinician records local treatment; otherwise referral is not delayed":
      conditional("depends on whether local treatment is recorded"),

    // ── Destination or programme state carried in the timing field ─────────
    Referral: notATiming(),
    "Specialist assessment": notATiming(),
    "Specialist surveillance": notATiming(),
    "Vault co-tests": notATiming(),
    "Vault co-testing": notATiming(),
    "No routine screening": notATiming(),
    "No routine screen": notATiming(),
    "Regular interval": notATiming(),
    "Regular screening interval": notATiming(),
  });

/**
 * True when the classification supports scheduling a recall date automatically
 * from the evaluation date without a clinician choosing a point in time.
 *
 * Deliberately narrow: only `EXACT` and `BOUNDED_MAX`. Everything else requires
 * a clinical determination that this software must not make.
 */
export function isAutomaticallySchedulable(
  classification: TimingClassification
): classification is
  | { kind: "EXACT"; interval: StructuredInterval }
  | { kind: "BOUNDED_MAX"; interval: StructuredInterval } {
  return classification.kind === "EXACT" || classification.kind === "BOUNDED_MAX";
}

/** Whole months, for the existing `recallIntervalMonths` contract. Null when not a whole number of months. */
export function intervalToMonths(interval: StructuredInterval): number | null {
  switch (interval.unit) {
    case "YEARS":
      return interval.value * 12;
    case "MONTHS":
      return interval.value;
    case "WEEKS":
      return (interval.value * 7) % 30 === 0 ? (interval.value * 7) / 30 : null;
    case "DAYS":
      return interval.value % 30 === 0 ? interval.value / 30 : null;
  }
}

/** Days, for scheduling anything shorter than a month. */
export function intervalToDays(interval: StructuredInterval): number {
  switch (interval.unit) {
    case "YEARS":
      return interval.value * 365;
    case "MONTHS":
      return interval.value * 30;
    case "WEEKS":
      return interval.value * 7;
    case "DAYS":
      return interval.value;
  }
}

// ── Urgency ─────────────────────────────────────────────────────────────────

/** Governed urgency. Mirrors the legacy `ReferralPriority` ladder plus an explicit "not stated". */
export type GovernedUrgency = "URGENT" | "PROMPT" | "ROUTINE" | "NOT_STATED";

/**
 * `outcomeBranches[].urgency` literals emitted by CG-NCSP-3.1.0.
 * Only three distinct values exist (`URGENT`, `PROMPT`, absent).
 */
export const BRANCH_URGENCY_VOCABULARY: Readonly<Record<string, GovernedUrgency>> =
  Object.freeze({
    URGENT: "URGENT",
    PROMPT: "PROMPT",
  });

/**
 * Urgency implied by a *timing* classification, where and only where the source
 * timing itself states immediacy. This is a property of the closed table above,
 * not of any text pattern.
 *
 * `CONDITIONAL` never yields an urgency: a string such as "Urgent if invasive"
 * states a condition this layer cannot evaluate, so it resolves to `NOT_STATED`
 * and the decision routes to clinician determination.
 */
export function urgencyFromTiming(classification: TimingClassification): GovernedUrgency {
  switch (classification.kind) {
    case "IMMEDIATE":
      return "URGENT";
    case "BOUNDED_MAX":
      return "PROMPT";
    case "EXACT":
    case "RANGE":
    case "MULTI_EVENT":
      return "ROUTINE";
    case "CONDITIONAL":
      // Fail safe to the urgent limb the source states, where it states one.
      return classification.escalatesWhen ?? "NOT_STATED";
    case "EVENT_RELATIVE":
    case "NOT_A_TIMING":
    case "DEFERRED_TO_OUTCOME":
    case "NONE":
      return "NOT_STATED";
  }
}

// ── Care setting → referral destination ─────────────────────────────────────

/** Matches the legacy `ReferralType` domain plus explicit non-referral outcomes. */
export type GovernedDestination =
  | "COLPOSCOPY"
  | "GYNAECOLOGY"
  | "GYNAE_ONCOLOGY"
  | "MDM"
  | "PRIMARY_CARE"
  | "PROGRAMME_FOLLOW_UP"
  | "REVIEWER_WORKFLOW"
  | "NOT_A_CARE_SETTING";

/**
 * Every distinct `careSetting` literal emitted by CG-NCSP-3.1.0. 44 entries.
 *
 * Where the source names two possible settings ("Colposcopy or specialist
 * gynaecology"), this table records the **more specialised** of the two. That is
 * a fail-safe reading, not a clinical judgement about which the participant
 * should receive: the reviewer confirms the destination in every case, because
 * `mandatoryReviewerConfirmation` is true for all canonical results.
 */
export const CARE_SETTING_VOCABULARY: Readonly<Record<string, GovernedDestination>> =
  Object.freeze({
    "Primary/community care or programme follow-up": "PROGRAMME_FOLLOW_UP",
    "Colposcopy service": "COLPOSCOPY",
    "Reviewer-confirmed pathway": "REVIEWER_WORKFLOW",
    "Specialist gynaecology": "GYNAECOLOGY",
    "Primary/community care": "PRIMARY_CARE",
    "Primary/community or specialist care": "GYNAECOLOGY",
    Colposcopy: "COLPOSCOPY",
    "Experienced colposcopy": "COLPOSCOPY",
    "Specialist pathway": "GYNAECOLOGY",
    "Review queue": "REVIEWER_WORKFLOW",
    "Colposcopy or specialist gynaecology": "GYNAECOLOGY",
    "Symptom investigation": "GYNAECOLOGY",
    "ToC pathway": "PROGRAMME_FOLLOW_UP",
    "Specialist review": "GYNAECOLOGY",
    "Specialist colposcopy": "COLPOSCOPY",
    "Gynaecological oncology / MDT": "GYNAE_ONCOLOGY",
    "Urgent specialist/oncology assessment": "GYNAE_ONCOLOGY",
    "Colposcopy/MDM": "MDM",
    "Specialist/NCSP boundary": "GYNAECOLOGY",
    "Colposcopy/specialist": "GYNAECOLOGY",
    "Colposcopy follow-up": "COLPOSCOPY",
    "MDM/colposcopy": "MDM",
    "Programme transition": "PROGRAMME_FOLLOW_UP",
    "Primary screening": "PRIMARY_CARE",
    "Global routing": "NOT_A_CARE_SETTING",
    "All pathways": "NOT_A_CARE_SETTING",
    "Engine/audit": "NOT_A_CARE_SETTING",
    "Audit/persistence": "NOT_A_CARE_SETTING",
    "Workflow layer": "NOT_A_CARE_SETTING",
    "Demo/export": "NOT_A_CARE_SETTING",
    "Colposcopy or primary/community care according to current R9.14": "COLPOSCOPY",
    "Urgent colposcopy": "COLPOSCOPY",
    "Urgent specialist assessment": "GYNAECOLOGY",
    "Urgent colposcopy/specialist assessment": "COLPOSCOPY",
    "Colposcopy/specialist decision service": "COLPOSCOPY",
    "Clinician-confirmed follow-up": "REVIEWER_WORKFLOW",
    "Urgent colposcopy and gynaecological oncology": "GYNAE_ONCOLOGY",
    "Specialist colposcopy/excisional treatment service": "COLPOSCOPY",
    "NCSP/vault follow-up": "PROGRAMME_FOLLOW_UP",
    "Experienced pregnancy colposcopy service": "COLPOSCOPY",
    "Urgent specialist gynaecology": "GYNAECOLOGY",
    "Obstetric/gynaecological assessment": "GYNAECOLOGY",
    "Gynaecological assessment": "GYNAECOLOGY",
    "Clinician/safeguarding pathway": "REVIEWER_WORKFLOW",
  });

// ── Fail-closed lookups ─────────────────────────────────────────────────────

/** Raised when the governed snapshot emits a literal this closed vocabulary does not carry. */
export class UnmappedGovernedLiteralError extends Error {
  constructor(
    readonly field: "timingDestination" | "careSetting" | "urgency",
    readonly literal: string
  ) {
    super(
      `Unmapped governed ${field} literal ${JSON.stringify(literal)}. ` +
        "The canonical decision cannot be normalised safely and must route to clinician review. " +
        "Add an explicit, reviewed entry to lib/clinical-rules/governed-vocabulary.ts."
    );
    this.name = "UnmappedGovernedLiteralError";
  }
}

export function classifyTiming(literal: string): TimingClassification {
  const entry = TIMING_VOCABULARY[literal.trim()];
  if (!entry) throw new UnmappedGovernedLiteralError("timingDestination", literal);
  return entry;
}

export function classifyDestination(literal: string): GovernedDestination {
  const entry = CARE_SETTING_VOCABULARY[literal.trim()];
  if (!entry) throw new UnmappedGovernedLiteralError("careSetting", literal);
  return entry;
}

export function classifyBranchUrgency(literal: string | undefined): GovernedUrgency {
  if (literal === undefined) return "NOT_STATED";
  const entry = BRANCH_URGENCY_VOCABULARY[literal.trim()];
  if (!entry) throw new UnmappedGovernedLiteralError("urgency", literal);
  return entry;
}
