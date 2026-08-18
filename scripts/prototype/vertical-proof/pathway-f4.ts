/**
 * THIN VERTICAL ARCHITECTURE PROOF — Figure 4 as a clinical pathway graph.
 *
 * Transcribed from evaluateFigure4 in lib/engine/decision-engine.ts:513, which
 * is the current live implementation of the national pathway. Source rule ids
 * F4-01..F4-10 map 1:1 onto that function's recommendationCodes so provenance
 * stays traceable to the guideline.
 *
 * Note how few terminals are referral grades: four of ten. The rest are recalls,
 * an information request, a discharge-to-routine-screening and a clinician
 * review. This is the scope point — the 81 COL/GYN rules cannot represent this
 * pathway, they only price its referral terminals.
 */

import type { PathwayGraph, TriageOverlay } from "./model";

const SOURCE_VERSION = "NCSP-2023";
const ADDENDUM_VERSION = "NCSP-Addendum-2026";

export const FIGURE_4: PathwayGraph = {
  id: "pathway_f4",
  label: "Figure 4 — follow-up after normal colposcopy (HPV detected, low-grade cytology)",
  schemaVersion: "pathway-graph-v1",
  canonicalStateSchemaVersion: "canonical-state-v1",
  rootId: "nd_f4_start",

  nodes: {
    nd_f4_start: { id: "nd_f4_start", kind: "start", label: "Post-colposcopy follow-up event" },
    nd_f4_colp: { id: "nd_f4_colp", kind: "decision", label: "Normal colposcopy confirmed?" },
    nd_f4_hpv: { id: "nd_f4_hpv", kind: "decision", label: "HPV result at this event?" },
    nd_f4_stage: { id: "nd_f4_stage", kind: "decision", label: "Which repeat stage?" },
    nd_f4_cyt: { id: "nd_f4_cyt", kind: "decision", label: "Cytology result?" },
    nd_f4_imm: { id: "nd_f4_imm", kind: "decision", label: "Immune deficient?" },

    // ── F4-01 — precondition not met ──
    nd_f4_t01: {
      id: "nd_f4_t01", kind: "terminal",
      label: "Confirm normal colposcopy before applying this pathway",
      action: { kind: "requestInformation", missing: ["normalColposcopy"] },
      boundary: "REVIEW_REQUIRED",
      appliesTo: ["CASE", "WORKFLOW"],
      provenance: { sourceRuleIds: ["F4-01"], sourceVersion: SOURCE_VERSION },
    },

    // ── F4-02 — entry recall, no HPV result yet ──
    nd_f4_t02: {
      id: "nd_f4_t02", kind: "terminal",
      label: "Repeat HPV test in 12 months in community care, recommend LBC",
      action: { kind: "recall", intervalMonths: 12, test: "HPV + LBC", setting: "community care" },
      boundary: "DETERMINISTIC_PROVISIONAL",
      appliesTo: ["WORKFLOW"],
      provenance: { sourceRuleIds: ["F4-02"], sourceVersion: SOURCE_VERSION },
    },

    // ── F4-03 — HPV not detected, return to routine ──
    nd_f4_t03: {
      id: "nd_f4_t03", kind: "terminal",
      label: "Return to routine interval screening",
      action: { kind: "discharge", reason: "HPV not detected at repeat after normal colposcopy" },
      boundary: "DETERMINISTIC_PROVISIONAL",
      appliesTo: ["WORKFLOW"],
      provenance: {
        sourceRuleIds: ["F4-03"],
        sourceVersion: SOURCE_VERSION,
        // Immune-deficient participants take a shorter routine interval.
        controllingAddendumRuleIds: ["A26-07"],
      },
    },

    // ── F4-04 — repeat HPV 16/18 → colposcopy ──
    nd_f4_t04: {
      id: "nd_f4_t04", kind: "terminal",
      label: "Refer to colposcopy — HPV 16/18 at repeat",
      action: { kind: "referral", service: "COLPOSCOPY", reason: "HPV 16/18 detected after normal colposcopy follow-up" },
      boundary: "DETERMINISTIC_PROVISIONAL",
      appliesTo: ["BATCH", "CASE", "WORKFLOW"],
      provenance: { sourceRuleIds: ["F4-04"], sourceVersion: SOURCE_VERSION },
    },

    // ── F4-05 — second repeat, any HPV → colposcopy ──
    nd_f4_t05: {
      id: "nd_f4_t05", kind: "terminal",
      label: "Refer to colposcopy — HPV detected at second repeat",
      action: { kind: "referral", service: "COLPOSCOPY", reason: "HPV detected at second repeat after normal colposcopy" },
      boundary: "DETERMINISTIC_PROVISIONAL",
      appliesTo: ["BATCH", "CASE", "WORKFLOW"],
      provenance: { sourceRuleIds: ["F4-05"], sourceVersion: SOURCE_VERSION },
    },

    // ── F4-06 — cytology needed ──
    nd_f4_t06: {
      id: "nd_f4_t06", kind: "terminal",
      label: "Enter cytology result for HPV Other after normal colposcopy",
      action: { kind: "requestInformation", missing: ["cytologyResult"] },
      boundary: "REVIEW_REQUIRED",
      appliesTo: ["CASE", "WORKFLOW"],
      provenance: { sourceRuleIds: ["F4-06"], sourceVersion: SOURCE_VERSION },
    },

    // ── F4-07 — HPV Other + high-grade cytology → colposcopy ──
    nd_f4_t07: {
      id: "nd_f4_t07", kind: "terminal",
      label: "Refer to colposcopy — HPV Other with cytology >= ASC-H",
      action: { kind: "referral", service: "COLPOSCOPY", reason: "HPV Other plus cytology >= ASC-H after normal colposcopy" },
      boundary: "DETERMINISTIC_PROVISIONAL",
      appliesTo: ["BATCH", "CASE", "WORKFLOW"],
      provenance: { sourceRuleIds: ["F4-07"], sourceVersion: SOURCE_VERSION },
    },

    // ── F4-08 — immune deficient → colposcopy ──
    nd_f4_t08: {
      id: "nd_f4_t08", kind: "terminal",
      label: "Refer to colposcopy — immune deficient with persistent HPV",
      action: { kind: "referral", service: "COLPOSCOPY", reason: "Immune deficient participant with persistent HPV after normal colposcopy" },
      boundary: "DETERMINISTIC_PROVISIONAL",
      appliesTo: ["BATCH", "CASE", "WORKFLOW"],
      provenance: {
        sourceRuleIds: ["F4-08"],
        sourceVersion: SOURCE_VERSION,
        controllingAddendumRuleIds: ["A26-07"],
      },
    },

    // ── F4-09 — low-grade, not immune deficient → second repeat ──
    nd_f4_t09: {
      id: "nd_f4_t09", kind: "terminal",
      label: "Second repeat HPV in 12 months in community care, recommend LBC",
      action: { kind: "recall", intervalMonths: 12, test: "HPV + LBC", setting: "community care" },
      boundary: "DETERMINISTIC_PROVISIONAL",
      appliesTo: ["WORKFLOW"],
      provenance: { sourceRuleIds: ["F4-09"], sourceVersion: SOURCE_VERSION },
    },

    // ── F4-10 — unmapped combination ──
    nd_f4_t10: {
      id: "nd_f4_t10", kind: "terminal",
      label: "Clinician review — combination not mapped by Figure 4",
      action: { kind: "mandatoryReview", forum: "SMO", question: "Review HPV/cytology/repeat-stage combination not covered by Figure 4." },
      boundary: "CLINICIAN_LED",
      appliesTo: ["CASE", "WORKFLOW"],
      provenance: { sourceRuleIds: ["F4-10"], sourceVersion: SOURCE_VERSION },
    },

    // ── Safety terminal for contradictory evidence (canonical-state layer) ──
    nd_f4_conflict: {
      id: "nd_f4_conflict", kind: "terminal",
      label: "Contradictory evidence — safety stop",
      action: { kind: "safetyEscalation", reason: "Two sources reported different HPV or cytology results for the same event." },
      boundary: "SAFETY_OVERRIDE",
      appliesTo: ["BATCH", "CASE", "WORKFLOW"],
      provenance: { sourceRuleIds: ["A26-SAFETY"], sourceVersion: ADDENDUM_VERSION },
    },
  },

  edges: {
    ed_f4_start: { id: "ed_f4_start", from: "nd_f4_start", to: "nd_f4_colp", label: "", role: "decisionBranch", priority: 10, predicate: { kind: "otherwise" } },

    // Conflict check precedes everything — contradictions must never be resolved
    // by branch priority further down.
    ed_f4_conflict_hpv: { id: "ed_f4_conflict_hpv", from: "nd_f4_colp", to: "nd_f4_conflict", label: "HPV result conflicted", role: "decisionBranch", priority: 5, predicate: { kind: "fieldConflicted", field: "hpvResult" } },
    ed_f4_conflict_cyt: { id: "ed_f4_conflict_cyt", from: "nd_f4_colp", to: "nd_f4_conflict", label: "Cytology conflicted", role: "decisionBranch", priority: 6, predicate: { kind: "fieldConflicted", field: "cytologyResult" } },

    ed_f4_colp_no: { id: "ed_f4_colp_no", from: "nd_f4_colp", to: "nd_f4_t01", label: "Normal colposcopy not confirmed", role: "decisionBranch", priority: 10, predicate: { kind: "factAbsent", fact: "normalColposcopy" } },
    ed_f4_colp_yes: { id: "ed_f4_colp_yes", from: "nd_f4_colp", to: "nd_f4_hpv", label: "Anything else", role: "otherwise", priority: 999, predicate: { kind: "otherwise" } },

    ed_f4_hpv_missing: { id: "ed_f4_hpv_missing", from: "nd_f4_hpv", to: "nd_f4_t02", label: "No HPV result yet", role: "decisionBranch", priority: 10, predicate: { kind: "fieldMissing", field: "hpvResult" } },
    ed_f4_hpv_neg: { id: "ed_f4_hpv_neg", from: "nd_f4_hpv", to: "nd_f4_t03", label: "HPV not detected", role: "decisionBranch", priority: 20, predicate: { kind: "fieldEquals", field: "hpvResult", value: "NOT_DETECTED" } },
    ed_f4_hpv_1618: { id: "ed_f4_hpv_1618", from: "nd_f4_hpv", to: "nd_f4_t04", label: "HPV 16/18", role: "decisionBranch", priority: 30, predicate: { kind: "fieldEquals", field: "hpvResult", value: "HPV_16_18" } },
    ed_f4_hpv_other: { id: "ed_f4_hpv_other", from: "nd_f4_hpv", to: "nd_f4_stage", label: "HPV Other", role: "decisionBranch", priority: 40, predicate: { kind: "fieldEquals", field: "hpvResult", value: "HPV_OTHER" } },
    ed_f4_hpv_else: { id: "ed_f4_hpv_else", from: "nd_f4_hpv", to: "nd_f4_t10", label: "Anything else", role: "otherwise", priority: 999, predicate: { kind: "otherwise" } },

    ed_f4_stage_2nd: { id: "ed_f4_stage_2nd", from: "nd_f4_stage", to: "nd_f4_t05", label: "Second repeat", role: "decisionBranch", priority: 10, predicate: { kind: "fieldEquals", field: "repeatStage", value: "SECOND_REPEAT" } },
    ed_f4_stage_else: { id: "ed_f4_stage_else", from: "nd_f4_stage", to: "nd_f4_cyt", label: "Anything else", role: "otherwise", priority: 999, predicate: { kind: "otherwise" } },

    ed_f4_cyt_missing: { id: "ed_f4_cyt_missing", from: "nd_f4_cyt", to: "nd_f4_t06", label: "No cytology reported", role: "decisionBranch", priority: 10, predicate: { kind: "fieldMissing", field: "cytologyResult" } },
    ed_f4_cyt_high: { id: "ed_f4_cyt_high", from: "nd_f4_cyt", to: "nd_f4_t07", label: "ASC-H or worse", role: "decisionBranch", priority: 20, predicate: { kind: "fieldIn", field: "cytologyResult", values: ["ASC_H", "HSIL", "SCC"] } },
    ed_f4_cyt_low: { id: "ed_f4_cyt_low", from: "nd_f4_cyt", to: "nd_f4_imm", label: "Negative, ASC-US or LSIL", role: "decisionBranch", priority: 30, predicate: { kind: "fieldIn", field: "cytologyResult", values: ["NEGATIVE", "ASC_US", "LSIL"] } },
    ed_f4_cyt_else: { id: "ed_f4_cyt_else", from: "nd_f4_cyt", to: "nd_f4_t10", label: "Anything else", role: "otherwise", priority: 999, predicate: { kind: "otherwise" } },

    ed_f4_imm_yes: { id: "ed_f4_imm_yes", from: "nd_f4_imm", to: "nd_f4_t08", label: "Immune deficient", role: "decisionBranch", priority: 10, predicate: { kind: "factPresent", fact: "immunocompromised" } },
    ed_f4_imm_no: { id: "ed_f4_imm_no", from: "nd_f4_imm", to: "nd_f4_t09", label: "Anything else", role: "otherwise", priority: 999, predicate: { kind: "otherwise" } },
  },
};

/**
 * LAYER 2 — local triage overlay.
 *
 * Prices only the four referral terminals. Notice these are precisely the
 * COL-035..COL-038 rules that Phase 0b proved are shadowed today: the pathway
 * decides that a referral is needed, the overlay decides the local queue.
 * Editing a target here cannot alter the national pathway above.
 */
export const COLPOSCOPY_OVERLAY: TriageOverlay = {
  id: "overlay_colp_local",
  schemaVersion: "triage-overlay-v1",
  serviceLine: "COLPOSCOPY",
  localPolicyVersion: "CM-Health-local-2026.1",
  entries: [
    {
      code: "COL-035",
      terminalNodeId: "nd_f4_t04",
      refine: [{ kind: "fieldMissing", field: "cytologyResult" }],
      priority: "P3", targetDays: 180,
      category: "Previous normal colposcopy re-referral — 6 months",
      outcome: "Colposcopy within 6 months",
      rationale: "Re-referral after previous normal colposcopy: HPV 16/18 with no cytology result.",
      localPolicyVersion: "CM-Health-local-2026.1",
    },
    {
      code: "COL-036",
      terminalNodeId: "nd_f4_t04",
      refine: [{ kind: "fieldIn", field: "cytologyResult", values: ["NEGATIVE", "ASC_US", "LSIL"] }],
      priority: "P3", targetDays: 180,
      category: "Previous normal colposcopy re-referral — 6 months",
      outcome: "Colposcopy within 6 months",
      rationale: "Re-referral after previous normal colposcopy: HPV 16/18 with normal or low-grade cytology.",
      localPolicyVersion: "CM-Health-local-2026.1",
    },
    {
      // BRANCH-LOCAL FALLBACK for terminal nd_f4_t04. Without it the pathway
      // refers every HPV 16/18 case but the overlay prices only the two cytology
      // cases above, so an ASC-H/HSIL/SCC case compiles to nothing. The direct-vs-
      // compiled differential test caught this; `validateOverlayCoverage` now
      // makes it a hard error. COL-004 is the live rulebook's general HPV 16/18
      // referral price, so it is the faithful fallback.
      code: "COL-004",
      terminalNodeId: "nd_f4_t04",
      priority: "P2", targetDays: 30,
      category: "HPV 16/18 positive referral",
      outcome: "High-priority colposcopy within 30 days",
      rationale: "HPV 16/18 referral not covered by a more specific local rule.",
      localPolicyVersion: "CM-Health-local-2026.1",
    },
    {
      code: "COL-037",
      terminalNodeId: "nd_f4_t08",
      priority: "P3", targetDays: 180,
      category: "Previous normal colposcopy re-referral — 6 months",
      outcome: "Colposcopy within 6 months",
      rationale: "Re-referral after previous normal colposcopy: immune-deficient participant with HPV Other.",
      localPolicyVersion: "CM-Health-local-2026.1",
    },
    {
      code: "COL-038",
      terminalNodeId: "nd_f4_t05",
      priority: "P3", targetDays: 180,
      category: "Previous normal colposcopy re-referral — 6 months",
      outcome: "Colposcopy within 6 months",
      rationale: "Re-referral after previous normal colposcopy: HPV detected at second repeat.",
      localPolicyVersion: "CM-Health-local-2026.1",
    },
    {
      code: "COL-003",
      terminalNodeId: "nd_f4_t07",
      priority: "P2", targetDays: 30,
      category: "High-grade cytology referral",
      outcome: "High-priority colposcopy within 30 days",
      rationale: "HPV Other with cytology ASC-H or worse is booked on the 30-day pathway locally.",
      localPolicyVersion: "CM-Health-local-2026.1",
    },
  ],
};
