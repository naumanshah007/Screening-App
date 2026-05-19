/**
 * Batch Processing — Template Column Definitions
 *
 * Single source of truth for:
 *   - which fields the batch system accepts
 *   - whether each field is required or optional
 *   - allowed values for enum fields
 *   - human-readable descriptions (used in template XLSX + validation messages)
 *   - column name aliases (for flexible CSV/Excel headers)
 *
 * This file drives both validation (validation.ts) and the upload template.
 */

// ─── Column Definition ───────────────────────────────────────────────────────

export interface ColumnDef {
  /** Internal field name matching CanonicalBatchCase keys. */
  field: string;
  /** Human-readable label for UI/template headers. */
  label: string;
  /** Data type. */
  type: "string" | "number" | "boolean" | "enum" | "date";
  /** Whether the field is required for processing. */
  required: boolean;
  /** Allowed enum values (for type: "enum"). */
  allowedValues?: readonly string[];
  /** Human-readable description for the template. */
  description: string;
  /** Alternative column names accepted from uploads. */
  aliases?: readonly string[];
  /** Default value when missing (for required fields with safe defaults). */
  defaultValue?: unknown;
  /** Grouping for template tabs. */
  group: "patient" | "results" | "history" | "colposcopy" | "bleeding" | "pregnancy" | "session";
}

// ─── Allowed Values (imported from engine types for consistency) ──────────────

export const HPV_RESULTS = [
  "NOT_DETECTED",
  "HPV_16_18",
  "HPV_OTHER",
  "INADEQUATE",
] as const;

export const CYTOLOGY_RESULTS = [
  "NEGATIVE", "ASC_US", "LSIL", "ASC_H", "HSIL", "SCC", "AIS",
  "AG1", "AG2", "AG3", "AG4", "AG5",
  "AC1", "AC2", "AC3", "AC4",
  "UNSATISFACTORY",
] as const;

export const HISTOLOGY_RESULTS = [
  "NORMAL", "CIN1", "CIN2", "CIN3", "AIS", "SCC", "ADENOCARCINOMA", "UNSATISFACTORY",
] as const;

export const SAMPLE_TYPES = ["LBC", "SWAB"] as const;
export const TZ_TYPES = ["TYPE1", "TYPE2", "TYPE3"] as const;

export const REPEAT_CONTEXTS = [
  "PRIMARY_HPV",
  "POST_NORMAL_COLPOSCOPY_LOW_GRADE_CYTOLOGY",
  "POST_NORMAL_COLPOSCOPY_HIGH_GRADE_CYTOLOGY",
  "TEST_OF_CURE",
] as const;

export const REPEAT_STAGES = ["BASELINE", "FIRST_REPEAT", "SECOND_REPEAT"] as const;

export const TEST_OF_CURE_STAGES = ["FIRST_TEST", "SECOND_TEST", "CONTINUING"] as const;

export const SCREENING_STATUSES = [
  "NEVER_SCREENED", "UNDER_SCREENED", "OVERDUE", "REGULAR_SCREENING", "UNKNOWN",
] as const;

export const PRIOR_SCREENING_HISTORIES = [
  "NEGATIVE_OR_NORMAL", "LOW_GRADE_ONLY", "LOW_GRADE_RETURNED_TO_REGULAR",
  "LOW_GRADE_NOT_RETURNED_TO_REGULAR", "HIGH_GRADE_TOC_COMPLETE",
  "HIGH_GRADE_TOC_INCOMPLETE", "HSIL_AIS_UNTREATED_OR_INCOMPLETELY_TREATED",
  "PREVIOUS_AIS", "PREVIOUS_ATYPICAL_GLANDULAR", "PREVIOUS_ATYPICAL_ENDOMETRIAL",
  "NO_KNOWN_SCREENING_HISTORY", "UNKNOWN",
] as const;

export const HYSTERECTOMY_INDICATIONS = [
  "BENIGN_GYNAECOLOGICAL_DISEASE", "HSIL_CIN23_OR_AIS",
] as const;

export const HYSTERECTOMY_SPECIMEN_PATHOLOGIES = [
  "NO_CERVICAL_PATHOLOGY", "NORMAL", "LSIL_CIN1", "HSIL_CIN23", "AIS",
] as const;

export const EXCISION_STATUSES = [
  "COMPLETE", "INCOMPLETE", "NOT_APPLICABLE", "UNKNOWN",
] as const;

export const ABNORMAL_BLEEDING_STAGES = [
  "INITIAL_ASSESSMENT", "SIX_TO_EIGHT_WEEK_REVIEW",
] as const;

export const BLEEDING_TYPES = [
  "INTER_MENSTRUAL", "POST_COITAL", "BOTH", "UNSPECIFIED",
] as const;

export const COLPOSCOPIC_IMPRESSIONS = [
  "NORMAL", "LSIL", "HSIL", "AIS", "INVASION", "UNSATISFACTORY",
] as const;

export const TRANSFORMATION_ZONE_STATES = ["NORMAL", "ABNORMAL"] as const;

// ─── Column Definitions ──────────────────────────────────────────────────────

export const BATCH_COLUMNS: readonly ColumnDef[] = [
  // ── Patient context ─────────────────────────────────────────────────────
  {
    field: "label",
    label: "Case Label",
    type: "string",
    required: false,
    description: "Optional display label for this case (e.g. 'Case 7 — HPV 16/18')",
    aliases: ["case_label", "name", "description"],
    group: "patient",
  },
  {
    field: "externalPatientId",
    label: "Patient ID",
    type: "string",
    required: false,
    description: "External patient identifier (e.g. dummy NHI). Used for duplicate detection.",
    aliases: ["patient_id", "nhi", "patientId", "NHI", "id"],
    group: "patient",
  },
  {
    field: "patientAge",
    label: "Age",
    type: "number",
    required: false,
    description: "Patient age in years (0–120). Used for age-based pathway gates.",
    aliases: ["age", "patient_age"],
    group: "patient",
  },
  {
    field: "ethnicityPrimary",
    label: "Ethnicity (Primary)",
    type: "string",
    required: false,
    description: "NZ Level 2 ethnicity code (e.g. '21' for Māori, '30' for Pacific).",
    aliases: ["ethnicity", "ethnicity_primary"],
    group: "patient",
  },

  // ── Required boolean flags ──────────────────────────────────────────────
  {
    field: "isFirstTimeHPVTransition",
    label: "First HPV Transition?",
    type: "boolean",
    required: true,
    defaultValue: false,
    description: "Is this the patient's first HPV test after previous cytology-era screening?",
    aliases: ["first_hpv_transition", "is_first_hpv_transition", "firstHPVTransition"],
    group: "patient",
  },
  {
    field: "isPostHysterectomy",
    label: "Post-Hysterectomy?",
    type: "boolean",
    required: true,
    defaultValue: false,
    description: "Has the patient had a hysterectomy? (Total hysterectomy follows vault pathway.)",
    aliases: ["post_hysterectomy", "is_post_hysterectomy", "postHysterectomy"],
    group: "patient",
  },
  {
    field: "immunocompromised",
    label: "Immunocompromised?",
    type: "boolean",
    required: true,
    defaultValue: false,
    description: "Is the patient immunocompromised? Affects recall intervals (3yr not 5yr).",
    aliases: ["immuno", "is_immunocompromised"],
    group: "patient",
  },
  {
    field: "atypicalEndometrialHistory",
    label: "Atypical Endometrial History?",
    type: "boolean",
    required: true,
    defaultValue: false,
    description: "Does the patient have a history of atypical endometrial cells (AG2)?",
    aliases: ["ag2_history", "atypical_endometrial", "atypicalEndometrial"],
    group: "patient",
  },

  // ── Hysterectomy details ────────────────────────────────────────────────
  {
    field: "hysterectomyType",
    label: "Hysterectomy Type",
    type: "enum",
    required: false,
    allowedValues: ["TOTAL", "SUBTOTAL"],
    description: "TOTAL (uterus + cervix removed) or SUBTOTAL (cervix retained).",
    aliases: ["hyst_type", "hysterectomy_type"],
    group: "patient",
  },
  {
    field: "hysterectomyIndication",
    label: "Hysterectomy Indication",
    type: "enum",
    required: false,
    allowedValues: HYSTERECTOMY_INDICATIONS as unknown as string[],
    description: "Reason for hysterectomy: benign disease or HSIL/CIN2-3/AIS.",
    aliases: ["hyst_indication", "hysterectomy_indication"],
    group: "patient",
  },
  {
    field: "hysterectomySpecimenPathology",
    label: "Hysterectomy Specimen Pathology",
    type: "enum",
    required: false,
    allowedValues: HYSTERECTOMY_SPECIMEN_PATHOLOGIES as unknown as string[],
    description: "Cervical pathology found in the hysterectomy specimen.",
    aliases: ["hyst_pathology", "specimen_pathology"],
    group: "patient",
  },
  {
    field: "excisionStatus",
    label: "Excision Status",
    type: "enum",
    required: false,
    allowedValues: EXCISION_STATUSES as unknown as string[],
    description: "Whether HSIL/CIN2-3 or AIS was completely excised.",
    aliases: ["excision"],
    group: "patient",
  },

  // ── Current test results ────────────────────────────────────────────────
  {
    field: "hpvResult",
    label: "HPV Result",
    type: "enum",
    required: false,
    allowedValues: HPV_RESULTS as unknown as string[],
    description: "HPV test result: NOT_DETECTED, HPV_16_18, HPV_OTHER, or INADEQUATE.",
    aliases: ["hpv", "hpv_result", "hpvTestResult"],
    group: "results",
  },
  {
    field: "cytologyResult",
    label: "Cytology Result",
    type: "enum",
    required: false,
    allowedValues: CYTOLOGY_RESULTS as unknown as string[],
    description: "Cytology result code (e.g. NEGATIVE, LSIL, HSIL, AG1–AG5, AC1–AC4).",
    aliases: ["cytology", "cytology_result", "cytologySample"],
    group: "results",
  },
  {
    field: "histologyResult",
    label: "Histology Result",
    type: "enum",
    required: false,
    allowedValues: HISTOLOGY_RESULTS as unknown as string[],
    description: "Histology/biopsy result (e.g. NORMAL, CIN1, CIN2, CIN3, AIS, SCC).",
    aliases: ["histology", "histology_result", "biopsy", "biopsyResult"],
    group: "results",
  },
  {
    field: "sampleType",
    label: "Sample Type",
    type: "enum",
    required: false,
    allowedValues: SAMPLE_TYPES as unknown as string[],
    description: "LBC (liquid-based cytology) or SWAB (self-collected vaginal swab).",
    aliases: ["sample", "sample_type"],
    group: "results",
  },

  // ── Screening history ───────────────────────────────────────────────────
  {
    field: "screeningStatus",
    label: "Screening Status",
    type: "enum",
    required: false,
    allowedValues: SCREENING_STATUSES as unknown as string[],
    description: "Current screening status for transition pathway decisions.",
    aliases: ["screening_status"],
    group: "history",
  },
  {
    field: "priorScreeningHistory",
    label: "Prior Screening History",
    type: "enum",
    required: false,
    allowedValues: PRIOR_SCREENING_HISTORIES as unknown as string[],
    description: "Detailed prior screening category (affects transition routing).",
    aliases: ["prior_history", "screening_history", "priorHistory"],
    group: "history",
  },
  {
    field: "previousHSILCIN23",
    label: "Previous HSIL/CIN2-3?",
    type: "boolean",
    required: false,
    description: "History of HSIL/CIN2/CIN3.",
    aliases: ["prev_hsil", "previous_hsil"],
    group: "history",
  },
  {
    field: "previousAIS",
    label: "Previous AIS?",
    type: "boolean",
    required: false,
    description: "History of adenocarcinoma in situ.",
    aliases: ["prev_ais", "previous_ais"],
    group: "history",
  },

  // ── Session / repeat context ────────────────────────────────────────────
  {
    field: "repeatContext",
    label: "Repeat Context",
    type: "enum",
    required: false,
    allowedValues: REPEAT_CONTEXTS as unknown as string[],
    description: "What context this result is in: primary HPV, post-colposcopy follow-up, or Test of Cure.",
    aliases: ["repeat_context"],
    group: "session",
  },
  {
    field: "repeatStage",
    label: "Repeat Stage",
    type: "enum",
    required: false,
    allowedValues: REPEAT_STAGES as unknown as string[],
    description: "Baseline, first repeat, or second repeat result.",
    aliases: ["repeat_stage", "stage"],
    group: "session",
  },
  {
    field: "isTestOfCure",
    label: "Test of Cure?",
    type: "boolean",
    required: false,
    description: "Is this a Test of Cure follow-up after CIN treatment?",
    aliases: ["test_of_cure", "is_test_of_cure", "toc"],
    group: "session",
  },
  {
    field: "testOfCureStage",
    label: "Test of Cure Stage",
    type: "enum",
    required: false,
    allowedValues: TEST_OF_CURE_STAGES as unknown as string[],
    description: "Which Test of Cure stage: FIRST_TEST, SECOND_TEST, or CONTINUING.",
    aliases: ["toc_stage", "test_of_cure_stage"],
    group: "session",
  },
  {
    field: "consecutiveNegativeCoTestCount",
    label: "Consecutive Negative Count",
    type: "number",
    required: true,
    defaultValue: 0,
    description: "Number of consecutive negative co-tests (default 0).",
    aliases: ["neg_count", "consecutive_negative"],
    group: "session",
  },
  {
    field: "consecutiveLowGradeCount",
    label: "Consecutive Low-Grade Count",
    type: "number",
    required: true,
    defaultValue: 0,
    description: "Number of consecutive low-grade results (default 0).",
    aliases: ["low_grade_count", "consecutive_low_grade"],
    group: "session",
  },
  {
    field: "unsatisfactoryCytologyCount",
    label: "Unsatisfactory Cytology Count",
    type: "number",
    required: true,
    defaultValue: 0,
    description: "Number of unsatisfactory cytology samples (default 0).",
    aliases: ["unsat_count", "unsatisfactory_count"],
    group: "session",
  },

  // ── Figure 9: Pregnancy ─────────────────────────────────────────────────
  {
    field: "isPregnant",
    label: "Pregnant?",
    type: "boolean",
    required: false,
    description: "Is the patient currently pregnant? Triggers pregnancy pathway (Figure 9).",
    aliases: ["pregnant", "is_pregnant"],
    group: "pregnancy",
  },
  {
    field: "postpartumReviewTiming",
    label: "Postpartum Review Timing",
    type: "enum",
    required: false,
    allowedValues: ["SIX_MONTHS", "SIX_TO_TWELVE_WEEKS_POSTPARTUM"],
    description: "Timing for postpartum colposcopy review.",
    aliases: ["postpartum_timing"],
    group: "pregnancy",
  },

  // ── Figure 10: Abnormal vaginal bleeding ────────────────────────────────
  {
    field: "hasAbnormalVaginalBleeding",
    label: "Abnormal Vaginal Bleeding?",
    type: "boolean",
    required: false,
    description: "Does the patient have abnormal vaginal bleeding? Triggers Figure 10.",
    aliases: ["bleeding", "abnormal_bleeding", "has_bleeding"],
    group: "bleeding",
  },
  {
    field: "abnormalBleedingStage",
    label: "Bleeding Stage",
    type: "enum",
    required: false,
    allowedValues: ABNORMAL_BLEEDING_STAGES as unknown as string[],
    description: "Initial assessment or 6–8 week follow-up review.",
    aliases: ["bleeding_stage"],
    group: "bleeding",
  },
  {
    field: "bleedingType",
    label: "Bleeding Type",
    type: "enum",
    required: false,
    allowedValues: BLEEDING_TYPES as unknown as string[],
    description: "Inter-menstrual, post-coital, both, or unspecified.",
    aliases: ["bleeding_type"],
    group: "bleeding",
  },
  {
    field: "hasCancerSymptoms",
    label: "Cancer Symptoms?",
    type: "boolean",
    required: false,
    description: "Are there signs or symptoms of cervical cancer?",
    aliases: ["cancer_symptoms", "has_cancer_symptoms"],
    group: "bleeding",
  },
  {
    field: "abnormalCervix",
    label: "Abnormal Cervix?",
    type: "boolean",
    required: false,
    description: "Is the cervix abnormal on speculum/pelvic examination?",
    aliases: ["abnormal_cervix"],
    group: "bleeding",
  },
  {
    field: "suspicionOfCancer",
    label: "Suspicion of Cancer?",
    type: "boolean",
    required: false,
    description: "Clinical suspicion of cervical cancer?",
    aliases: ["suspicion_cancer"],
    group: "bleeding",
  },
  {
    field: "suspectOralContraceptiveProblem",
    label: "OCP Problem Suspected?",
    type: "boolean",
    required: false,
    description: "Is an oral contraceptive pill problem suspected?",
    aliases: ["ocp_problem", "suspect_ocp"],
    group: "bleeding",
  },
  {
    field: "stiIdentified",
    label: "STI Identified?",
    type: "boolean",
    required: false,
    description: "Has an STI been identified as cause of bleeding?",
    aliases: ["sti", "sti_identified"],
    group: "bleeding",
  },
  {
    field: "bleedingResolved",
    label: "Bleeding Resolved?",
    type: "boolean",
    required: false,
    description: "Has the bleeding resolved at 6–8 week review?",
    aliases: ["bleeding_resolved", "resolved"],
    group: "bleeding",
  },

  // ── Colposcopy findings ─────────────────────────────────────────────────
  {
    field: "colposcopicImpression",
    label: "Colposcopic Impression",
    type: "enum",
    required: false,
    allowedValues: COLPOSCOPIC_IMPRESSIONS as unknown as string[],
    description: "Colposcopist's overall assessment: Normal, LSIL, HSIL, AIS, Invasion, Unsatisfactory.",
    aliases: ["colposcopy_impression", "colposcopic_impression"],
    group: "colposcopy",
  },
  {
    field: "visibleLesion",
    label: "Visible Lesion?",
    type: "boolean",
    required: false,
    description: "Is there a visible lesion at colposcopy?",
    aliases: ["visible_lesion", "lesion"],
    group: "colposcopy",
  },
  {
    field: "normalColposcopy",
    label: "Normal Colposcopy?",
    type: "boolean",
    required: false,
    description: "Was the colposcopy normal?",
    aliases: ["normal_colposcopy"],
    group: "colposcopy",
  },
  {
    field: "transformationZoneState",
    label: "TZ State",
    type: "enum",
    required: false,
    allowedValues: TRANSFORMATION_ZONE_STATES as unknown as string[],
    description: "Transformation zone state: Normal or Abnormal.",
    aliases: ["tz_state"],
    group: "colposcopy",
  },
  {
    field: "colposcopyTZType",
    label: "Colposcopy TZ Type",
    type: "enum",
    required: false,
    allowedValues: ["TYPE1", "TYPE2", "TYPE3"],
    description: "TZ type at colposcopy (Type 1/2/3).",
    aliases: ["colp_tz_type"],
    group: "colposcopy",
  },
  {
    field: "biopsyResult",
    label: "Biopsy Result",
    type: "enum",
    required: false,
    allowedValues: HISTOLOGY_RESULTS as unknown as string[],
    description: "Biopsy histology result at colposcopy.",
    aliases: ["biopsy_result"],
    group: "colposcopy",
  },
  {
    field: "mdmOutcome",
    label: "MDM Outcome",
    type: "string",
    required: false,
    description: "Multidisciplinary meeting outcome (e.g. EXCISION, SURVEILLANCE, REFERRAL).",
    aliases: ["mdm", "mdm_outcome"],
    group: "colposcopy",
  },
  {
    field: "tzType",
    label: "TZ Type",
    type: "enum",
    required: false,
    allowedValues: ["TYPE1", "TYPE2", "TYPE3"],
    description: "Transformation zone type for the current test.",
    aliases: ["tz_type"],
    group: "results",
  },

  // ── SWAB return visit ───────────────────────────────────────────────────
  {
    field: "swabReturnVisitCompleted",
    label: "SWAB Return Visit?",
    type: "boolean",
    required: false,
    description: "Has the patient returned for clinical examination after self-collected swab?",
    aliases: ["swab_return", "swab_return_visit"],
    group: "results",
  },
] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build a lookup from field name and aliases → ColumnDef. */
export function buildColumnLookup(): Map<string, ColumnDef> {
  const map = new Map<string, ColumnDef>();
  for (const col of BATCH_COLUMNS) {
    // Register the canonical field name (case-insensitive)
    map.set(col.field.toLowerCase(), col);
    // Register aliases
    if (col.aliases) {
      for (const alias of col.aliases) {
        map.set(alias.toLowerCase(), col);
      }
    }
  }
  return map;
}

/** Get list of known field names (canonical + aliases), lowercased. */
export function getKnownFieldNames(): Set<string> {
  const set = new Set<string>();
  for (const col of BATCH_COLUMNS) {
    set.add(col.field.toLowerCase());
    if (col.aliases) {
      for (const alias of col.aliases) {
        set.add(alias.toLowerCase());
      }
    }
  }
  return set;
}

/** Get required fields with their defaults. */
export function getRequiredFieldDefaults(): Record<string, unknown> {
  const defaults: Record<string, unknown> = {};
  for (const col of BATCH_COLUMNS) {
    if (col.required && col.defaultValue !== undefined) {
      defaults[col.field] = col.defaultValue;
    }
  }
  return defaults;
}

/** Get CSV header row string. */
export function getCSVHeaderRow(): string {
  return BATCH_COLUMNS.map((c) => c.field).join(",");
}
