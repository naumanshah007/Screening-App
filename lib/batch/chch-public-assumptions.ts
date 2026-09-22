/**
 * Dataset assumptions for the CHCH Public evaluation set.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * The rulebook is explicit that "unknown is never equivalent to false, normal,
 * negative, complete, clear margin, or immune competent" (§20), and GS-01
 * requires a safety stop rather than a routine recall when a required fact is
 * missing. The clinician's spreadsheet is silent on several facts the engine
 * needs, so building the dataset requires filling them in — and those choices
 * were previously spread as literals through a case-construction helper, where
 * nobody could see or approve them.
 *
 * They are gathered here instead: one object, each entry naming what is being
 * assumed, why the dataset can carry it, and whether a clinician has agreed.
 * Nothing here is approved by engineering. `clinicianApproved: false` means
 * exactly that, and the assumptions report renders it for review.
 *
 * WHAT DOES NOT BELONG HERE
 * -------------------------
 * An assumption that changes a clinical outcome. If a case cannot reach a
 * recommendation without assuming something material, the correct result is a
 * safety stop, not an assumption that manufactures a terminal answer. The
 * entries below are limited to facts whose absence is a property of a synthetic
 * screening extract rather than a clinical unknown about a real patient.
 */

export type DatasetAssumption = {
  /** The field the assumption fills in. */
  field: string;
  /** The value the dataset applies. */
  assumed: string;
  /** Why the dataset may carry this value at all. */
  basis: string;
  /** What changes clinically if the assumption is wrong. */
  consequenceIfWrong: string;
  /** Rule(s) whose behaviour depends on it. */
  rulesAffected: string[];
  /** Case IDs the assumption is applied to. */
  appliesTo: "all" | string[];
  /** Set only by a clinician reviewing this file. Engineering never sets it. */
  clinicianApproved: boolean;
};

export const CHCH_PUBLIC_ASSUMPTIONS_VERSION = "chch-public-assumptions-v1";

export const CHCH_PUBLIC_ASSUMPTIONS: DatasetAssumption[] = [
  {
    field: "immunocompromised",
    assumed: "false",
    basis:
      "The source states no immune-deficiency status for any case. A screening extract that records immune deficiency would normally carry it; its absence across all 30 rows is read as 'not indicated on the request'.",
    consequenceIfWrong:
      "Recall interval is wrong for HPV-negative cases: 5 years instead of the 3 years an immune-deficient participant requires. Affects 11 cases.",
    rulesAffected: ["F3-HPV-NOT-DETECTED-5Y", "F3-HPV-NOT-DETECTED-IC-3Y", "IMM-01"],
    appliesTo: "all",
    clinicianApproved: false,
  },
  {
    field: "isPostHysterectomy",
    assumed: "false",
    basis:
      "Every case is described as a cervical screening episode with a cervical sample or a cervical screening circumstance, which presupposes a cervix.",
    consequenceIfWrong:
      "Post-hysterectomy participants would be graded on Figure 3 rather than Figure 8 / Table 1.",
    rulesAffected: ["GR-04", "F8-*", "TABLE_1"],
    appliesTo: "all",
    clinicianApproved: false,
  },
  {
    field: "isPregnant / hasAbnormalVaginalBleeding / hasCancerSymptoms",
    assumed: "not present",
    basis:
      "All 30 rows describe asymptomatic screening or surveillance circumstances. No row mentions pregnancy, bleeding or symptoms.",
    consequenceIfWrong:
      "A pregnant or symptomatic participant would be routed to Figure 9 or Figure 10, which take precedence over routine screening.",
    rulesAffected: ["GR-02", "F9-*", "F10-*"],
    appliesTo: "all",
    clinicianApproved: false,
  },
  {
    field: "sampleType",
    assumed: "LBC",
    basis:
      "The source does not state collection method. LBC is assumed because several rows report a cytology result, which a self-collected swab cannot produce without a return visit.",
    consequenceIfWrong:
      "Self-collected swabs with HPV detected require a return visit with clinical examination before a cytology-dependent decision (F3-SWAB-RETURN-REQUIRED). Assuming LBC bypasses that step.",
    rulesAffected: ["F3-03", "F3-SWAB-RETURN-REQUIRED"],
    appliesTo: "all",
    clinicianApproved: false,
  },
  {
    field: "repeatStage",
    assumed: "BASELINE unless the row states a repeat interval",
    basis:
      "Rows stating '12-month follow-up' or '12-month surveillance' are marked FIRST_REPEAT. Rows described as 'routine screening' or 'first screen' are treated as baseline events.",
    consequenceIfWrong:
      "Repeat-stage routing changes which Figure 3 branch applies to a non-16/18 HPV result, and whether a second consecutive positive escalates.",
    rulesAffected: ["F3-09", "F3-HPV-OTHER-NEG-ASCUS-LSIL-12M"],
    appliesTo: "all",
    clinicianApproved: false,
  },
  {
    field: "consecutiveNegativeCoTestCount / consecutiveLowGradeCount / unsatisfactoryCytologyCount",
    assumed: "0 unless stated",
    basis:
      "No row reports a count of prior consecutive results. Zero represents 'no such prior sequence recorded in this extract'.",
    consequenceIfWrong:
      "Test of Cure completion and repeat-escalation thresholds depend on these counts; a non-zero true value could complete or escalate a pathway.",
    rulesAffected: ["F6-*", "F4-*", "F5-*"],
    appliesTo: "all",
    clinicianApproved: false,
  },
  {
    field: "atypicalEndometrialHistory",
    assumed: "false",
    basis:
      "No row reports atypical endometrial cells. The AG2 pathway has distinctive wording that none of the histories use.",
    consequenceIfWrong: "An AG2 history routes to Figure 2's endometrial branch and specialist gynaecology.",
    rulesAffected: ["F2-AG2-*"],
    appliesTo: "all",
    clinicianApproved: false,
  },
  {
    field: "isTestOfCure (chch-018)",
    assumed: "NOT assumed — left unknown",
    basis:
      "The source says 'Previous CIN2; surveillance episode'. It does not say the CIN2 was treated, and Test of Cure presupposes treatment. CIN2 is also frequently managed by observation. The dataset records the high-grade history and leaves treatment status unstated, which produces a safety stop rather than a terminal recommendation.",
    consequenceIfWrong:
      "If the CIN2 was in fact treated, the case belongs on Figure 6 Test of Cure and would carry a P1 referral rather than stopping for records.",
    rulesAffected: ["F2-01", "F6-*"],
    appliesTo: ["chch-018"],
    clinicianApproved: false,
  },
  {
    field: "isTestOfCure (chch-007)",
    assumed: "true",
    basis:
      "The source states both 'Post-treatment surveillance' and 'Treated CIN3 three years ago'. Treatment of a high-grade lesion followed by surveillance is Test of Cure by definition. Stage and status are NOT assumed — the source does not say how far through Test of Cure this participant is.",
    consequenceIfWrong:
      "If this is not a Test of Cure episode the case would be graded on Figure 3 as routine primary screening.",
    rulesAffected: ["F2-01", "F6-HPV-DETECTED-ANY-CYTOLOGY-COLP"],
    appliesTo: ["chch-007"],
    clinicianApproved: false,
  },
  {
    field: "previousHpv1618Episode (chch-009, chch-010, chch-019)",
    assumed: "true, with referral outcome left unknown",
    basis:
      "These rows report a previous HPV16 or HPV18 positive result. Recorded as a previous HPV 16/18 episode — NOT as previous high-grade disease, which the rulebook defines by cytology and histology categories (F2-01) and never equates with genotype.",
    consequenceIfWrong:
      "If the earlier referral was in fact completed and benign, these cases would return to routine screening rather than stopping for records.",
    rulesAffected: ["F3-03", "F3-PREVIOUS-HPV1618-OUTCOME-REQUIRED", "GS-01"],
    appliesTo: ["chch-009", "chch-010", "chch-019"],
    clinicianApproved: false,
  },
];

/** Assumptions still awaiting clinician sign-off. */
export function unapprovedAssumptions(): DatasetAssumption[] {
  return CHCH_PUBLIC_ASSUMPTIONS.filter((a) => !a.clinicianApproved);
}
