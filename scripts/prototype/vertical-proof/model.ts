/**
 * THIN VERTICAL ARCHITECTURE PROOF — layer model.
 *
 * NOT shipped code. Proves that one user-facing rulebook can carry several
 * different kinds of executable and review-only logic, on one bounded pathway:
 * Figure 4, HPV Other / post-normal-colposcopy follow-up.
 *
 * Four layers under one atomic release:
 *   1. CLINICAL PATHWAY GRAPH   national pathway, source ids (F4-xx, T1-xx, A26-xx)
 *   2. LOCAL TRIAGE OVERLAY     local queue priority + booking target (COL/GYN codes)
 *   3. CANONICAL CLINICAL STATE versioned schema both pipelines produce
 *   4. WORKFLOW ACTION MODEL    typed actions; most terminals are not referral grades
 */

import type { TriagePriority } from "@prisma/client";

// ─────────────────────────────────────────────────────────────────────────────
// LAYER 3 — canonical clinical state
// ─────────────────────────────────────────────────────────────────────────────

export type Pipeline = "BATCH" | "CASE" | "WORKFLOW";

/** A field is known with a value, explicitly not performed, or simply absent. */
export type FieldState<T> =
  | { status: "known"; value: T; provenance: Provenance }
  | { status: "notPerformed"; provenance: Provenance }
  | { status: "missing" }
  /** Two sources disagreed. Never resolved by branch priority — see §4.3. */
  | { status: "conflicted"; values: T[]; provenance: Provenance[] };

export type Provenance = {
  source: "structuredField" | "extractedFact" | "freeText" | "derived";
  confidence?: number;
  quote?: string;
};

export type HpvResult = "NOT_DETECTED" | "HPV_16_18" | "HPV_OTHER";
export type Cytology = "NEGATIVE" | "ASC_US" | "LSIL" | "ASC_H" | "HSIL" | "SCC";
export type RepeatStage = "BASELINE" | "FIRST_REPEAT" | "SECOND_REPEAT";

export const CANONICAL_STATE_SCHEMA_VERSION = "canonical-state-v1";

export type CanonicalClinicalState = {
  schemaVersion: typeof CANONICAL_STATE_SCHEMA_VERSION;
  pipeline: Pipeline;
  fields: {
    hpvResult: FieldState<HpvResult>;
    cytologyResult: FieldState<Cytology>;
    repeatStage: FieldState<RepeatStage>;
  };
  facts: {
    normalColposcopy: boolean;
    immunocompromised: boolean;
  };
  /** Longitudinal context the point-in-time graph must not try to recompute. */
  history: {
    priorRecallsCompleted: number;
    lastEventAt?: string;
  };
};

export function fieldValue<T>(f: FieldState<T>): T | undefined {
  return f.status === "known" ? f.value : undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// LAYER 4 — typed clinical actions
//
// Figure 4 has ten terminals and only four are referrals. An OutcomeSpec of
// {service, priority, timeframe, recommendation} cannot represent the rest.
// ─────────────────────────────────────────────────────────────────────────────

export type ClinicalAction =
  | { kind: "referral"; service: "COLPOSCOPY" | "GYNAECOLOGY" | "ONCOLOGY"; reason: string }
  | { kind: "recall"; intervalMonths: number; test: string; setting: string }
  | { kind: "screeningInvitation"; timing: "NOW" | "NEXT_SCHEDULED" }
  | { kind: "discharge"; reason: string }
  | { kind: "requestInformation"; missing: string[] }
  | { kind: "mandatoryReview"; forum: "SMO" | "MDM" | "SPECIALIST"; question: string }
  | { kind: "safetyEscalation"; reason: string }
  | { kind: "transitionToPathway"; pathwayId: string; reason: string }
  | { kind: "advisory"; text: string };

/**
 * What the runtime is permitted to do. A boolean requiresSmoReview cannot
 * express the source rulebook's distinction between clinician-led, specialist-led
 * and mandatory-MDM branches.
 */
export type AutomationBoundary =
  | "DETERMINISTIC_PROVISIONAL"
  | "REVIEW_REQUIRED"
  | "CLINICIAN_LED"
  | "SPECIALIST_LED"
  | "MANDATORY_MDM"
  | "SHARED_DECISION"
  | "LOCAL_PATHWAY"
  | "SAFETY_OVERRIDE";

export type ExecutionPolicy = {
  /** May the system emit a provisional recommendation at all? */
  emitsRecommendation: boolean;
  /** May a recommendation be finalised without a human? Never true for
   *  clinician-led, specialist-led, MDM or shared-decision branches. */
  autoFinalisable: boolean;
  /** Does reaching this terminal create a review obligation? */
  createsReviewTask: boolean;
  /** May the triage compiler turn this terminal into a flat grading rule? */
  compilable: boolean;
};

export const EXECUTION_POLICY: Record<AutomationBoundary, ExecutionPolicy> = {
  DETERMINISTIC_PROVISIONAL: { emitsRecommendation: true,  autoFinalisable: false, createsReviewTask: false, compilable: true  },
  REVIEW_REQUIRED:           { emitsRecommendation: true,  autoFinalisable: false, createsReviewTask: true,  compilable: true  },
  CLINICIAN_LED:             { emitsRecommendation: false, autoFinalisable: false, createsReviewTask: true,  compilable: false },
  SPECIALIST_LED:            { emitsRecommendation: false, autoFinalisable: false, createsReviewTask: true,  compilable: false },
  MANDATORY_MDM:             { emitsRecommendation: false, autoFinalisable: false, createsReviewTask: true,  compilable: false },
  SHARED_DECISION:           { emitsRecommendation: false, autoFinalisable: false, createsReviewTask: true,  compilable: false },
  LOCAL_PATHWAY:             { emitsRecommendation: true,  autoFinalisable: false, createsReviewTask: true,  compilable: false },
  SAFETY_OVERRIDE:           { emitsRecommendation: true,  autoFinalisable: false, createsReviewTask: true,  compilable: true  },
};

/**
 * NOTE: autoFinalisable is false for every boundary in this prototype. The
 * source rulebook states that outputs remain provisional pending clinical
 * sign-off, so nothing is autonomously finalised. The field exists so that a
 * future policy change is an explicit, reviewable edit rather than an implicit
 * behaviour change.
 */

// ─────────────────────────────────────────────────────────────────────────────
// LAYER 1 — clinical pathway graph
// ─────────────────────────────────────────────────────────────────────────────

export type Predicate =
  | { kind: "fieldEquals"; field: keyof CanonicalClinicalState["fields"]; value: string }
  | { kind: "fieldIn"; field: keyof CanonicalClinicalState["fields"]; values: string[] }
  | { kind: "fieldMissing"; field: keyof CanonicalClinicalState["fields"] }
  | { kind: "fieldKnown"; field: keyof CanonicalClinicalState["fields"] }
  | { kind: "fieldConflicted"; field: keyof CanonicalClinicalState["fields"] }
  | { kind: "factPresent"; fact: keyof CanonicalClinicalState["facts"] }
  | { kind: "factAbsent"; fact: keyof CanonicalClinicalState["facts"] }
  | { kind: "otherwise" };

export type EdgeRole = "decisionBranch" | "otherwise" | "modifierMatch" | "modifierPassThrough";

export type Edge = {
  id: string;
  from: string;
  to: string;
  label: string;
  role: EdgeRole;
  predicate: Predicate;
  priority: number;
};

export type SourceProvenance = {
  /** National pathway ids, e.g. F4-05, T1-06. */
  sourceRuleIds: string[];
  sourceVersion: string;
  /** 2026 addendum ids that control or supersede the base guidance. */
  controllingAddendumRuleIds?: string[];
  supersededSourceRuleIds?: string[];
};

export type PathwayNode =
  | { id: string; kind: "start"; label: string }
  | { id: string; kind: "decision"; label: string }
  | {
      id: string;
      kind: "terminal";
      label: string;
      action: ClinicalAction;
      boundary: AutomationBoundary;
      /** Pipelines this terminal is DECLARED to serve. A rule absent from a
       *  pipeline it never declared is not a defect. */
      appliesTo: Pipeline[];
      provenance: SourceProvenance;
    };

export type PathwayGraph = {
  id: string;
  label: string;
  schemaVersion: "pathway-graph-v1";
  canonicalStateSchemaVersion: typeof CANONICAL_STATE_SCHEMA_VERSION;
  rootId: string;
  nodes: Record<string, PathwayNode>;
  edges: Record<string, Edge>;
};

// ─────────────────────────────────────────────────────────────────────────────
// LAYER 2 — local triage overlay
//
// Answers a narrower question than the pathway: once the national pathway says a
// referral is required, how does THIS service queue and book it? Editing the
// overlay must never alter the national pathway.
// ─────────────────────────────────────────────────────────────────────────────

export type OverlayEntry = {
  /** Local rule code, e.g. COL-035. */
  code: string;
  /** Which pathway terminal this prices. */
  terminalNodeId: string;
  /** Extra local discriminators applied on top of the pathway terminal. */
  refine?: Predicate[];
  priority: TriagePriority;
  targetDays: number;
  category: string;
  outcome: string;
  rationale: string;
  localPolicyVersion: string;
};

export type TriageOverlay = {
  id: string;
  schemaVersion: "triage-overlay-v1";
  serviceLine: "COLPOSCOPY" | "GYNAECOLOGY";
  localPolicyVersion: string;
  entries: OverlayEntry[];
};

// ─────────────────────────────────────────────────────────────────────────────
// PARENT RELEASE — one atomic unit
// ─────────────────────────────────────────────────────────────────────────────

export type RulebookRelease = {
  version: string;
  pathwayGraphs: PathwayGraph[];
  triageOverlays: TriageOverlay[];
  canonicalStateSchemaVersion: typeof CANONICAL_STATE_SCHEMA_VERSION;
  compilerVersion: string;
  /** Compiled per service line AND per pipeline. */
  compiledArtifacts: Record<string, { definitionJson: string; compiledHash: string }>;
  sourceHash: string;
};
