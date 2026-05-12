/**
 * Pathway Wizard — Step Definitions
 *
 * Each WizardStep represents one question shown to the nurse.
 * Steps are shown one at a time (Typeform-style) and branched
 * based on prior answers via the `isVisible()` function.
 *
 * The answers collected map directly to ClinicalInput fields
 * consumed by evaluateClinicalDecision().
 */

export type OptionCard = {
  value: string;
  label: string;
  hint?: string;        // shown below label in smaller text
  cautionTag?: string;  // e.g. "Urgent" shown as a red chip
};

export type WizardStep = {
  id: string;                         // maps to ClinicalInput key or sentinel
  question: string;                   // large question text
  hint?: string;                      // clinical guidance shown below question
  type: "option-cards" | "boolean-cards" | "info";
  options?: OptionCard[];             // for option-cards and boolean-cards
  isVisible: (answers: Record<string, string>) => boolean;
};

// ─── Helper predicates ────────────────────────────────────────────────────────

const always = () => true;

// ─── Step Definitions ─────────────────────────────────────────────────────────

export const WIZARD_STEPS: WizardStep[] = [
  // ── Step 0: Patient context info card (always shown, no answer required) ────
  {
    id: "patient_context",
    question: "Review patient details",
    type: "info",
    isVisible: always,
  },

  // ── Step 0b: Consent confirmation ─────────────────────────────────────────
  {
    id: "consent_confirmed",
    question: "Has the patient been informed and provided consent for cervical screening data entry?",
    hint: "Under the NZ Privacy Act 2020, patients must be informed of how their health information will be used. Confirm verbal or written consent before proceeding with data entry.",
    type: "boolean-cards",
    options: [
      { value: "true",  label: "Yes — consent confirmed", hint: "Patient has been informed and consents to data entry" },
      { value: "false", label: "No — consent not confirmed", hint: "Do not proceed until consent is obtained", cautionTag: "Required" },
    ],
    isVisible: always,
  },

  // ── Step 1: Post-hysterectomy flag ────────────────────────────────────────
  {
    id: "is_post_hysterectomy",
    question: "Has this patient had a hysterectomy?",
    hint: "Post-hysterectomy patients may follow the vault screening pathway. Important: a subtotal hysterectomy (cervix retained) still requires standard cervical screening.",
    type: "boolean-cards",
    options: [
      { value: "true",  label: "Yes — hysterectomy performed", hint: "Will ask for hysterectomy type on next step" },
      { value: "false", label: "No — uterus intact", hint: "Continue with standard screening pathway" },
    ],
    isVisible: (ans) => ans.consent_confirmed === "true",
  },

  // ── Step 1a: Hysterectomy type ────────────────────────────────────────────
  {
    id: "hysterectomy_type",
    question: "What type of hysterectomy did the patient have?",
    hint: "A total hysterectomy removes the uterus and cervix, so the vault screening pathway may apply. A subtotal hysterectomy preserves the cervix, so standard cervical screening continues.",
    type: "option-cards",
    options: [
      { value: "TOTAL",    label: "Total hysterectomy — uterus and cervix removed", hint: "Uses the vault screening pathway" },
      { value: "SUBTOTAL", label: "Subtotal hysterectomy — cervix retained", hint: "Standard cervical screening continues", cautionTag: "Cervix intact" },
    ],
    isVisible: (ans) => ans.is_post_hysterectomy === "true",
  },

  // ── Step 1a.1: Hysterectomy prior screening history ─────────────────────
  {
    id: "prior_screening_history",
    question: "What prior screening history applies for this total hysterectomy pathway?",
    hint: "The post-hysterectomy pathway requires the prior screening category. If it cannot be verified, choose no known screening history so the system marks the history dependency explicitly.",
    type: "option-cards",
    options: [
      { value: "NEGATIVE_OR_NORMAL", label: "Negative or normal prior screening", hint: "No previous abnormal results requiring follow-up" },
      { value: "LOW_GRADE_RETURNED_TO_REGULAR", label: "Previous low-grade returned to regular screening", hint: "ASC-US/LSIL or low-grade history returned to regular screening" },
      { value: "LOW_GRADE_NOT_RETURNED_TO_REGULAR", label: "Previous low-grade not returned to regular screening", hint: "Low-grade result/history without return to routine screening" },
      { value: "HIGH_GRADE_TOC_COMPLETE", label: "HSIL/CIN2/3 or AIS with Test of Cure complete", hint: "Completed Test of Cure after treatment" },
      { value: "HSIL_AIS_UNTREATED_OR_INCOMPLETELY_TREATED", label: "HSIL/CIN2/3 or AIS untreated/incompletely treated", hint: "Uses the high-grade post-hysterectomy branch", cautionTag: "High attention" },
      { value: "HIGH_GRADE_TOC_INCOMPLETE", label: "High-grade history with incomplete Test of Cure", hint: "Routes to Test of Cure or colposcopy depending on specimen/excision", cautionTag: "High attention" },
      { value: "PREVIOUS_ATYPICAL_GLANDULAR", label: "Previous atypical glandular cells/AIS", hint: "High-grade/glandular post-hysterectomy branch", cautionTag: "High attention" },
      { value: "NO_KNOWN_SCREENING_HISTORY", label: "No known screening history", hint: "History source unavailable or unknown", cautionTag: "External history" },
    ],
    isVisible: (ans) =>
      ans.is_post_hysterectomy === "true" &&
      ans.hysterectomy_type === "TOTAL",
  },

  // ── Step 1a.2: Hysterectomy indication ──────────────────────────────────
  {
    id: "hysterectomy_indication",
    question: "What was the indication for hysterectomy?",
    hint: "The post-hysterectomy pathway separates benign gynaecological disease from hysterectomy associated with HSIL/CIN2/3 or AIS.",
    type: "option-cards",
    options: [
      { value: "BENIGN_GYNAECOLOGICAL_DISEASE", label: "Benign gynaecological disease", hint: "Examples: fibroids, prolapse, menstrual problems" },
      { value: "HSIL_CIN23_OR_AIS", label: "HSIL/CIN2/3 or AIS", hint: "Hysterectomy associated with high-grade cervical disease", cautionTag: "High attention" },
    ],
    isVisible: (ans) =>
      ans.is_post_hysterectomy === "true" &&
      ans.hysterectomy_type === "TOTAL",
  },

  // ── Step 1a.3: Hysterectomy specimen pathology ──────────────────────────
  {
    id: "hysterectomy_specimen_pathology",
    question: "What cervical pathology was found in the hysterectomy specimen?",
    hint: "The post-hysterectomy pathway branches on no pathology, LSIL/CIN1, HSIL/CIN2/3, AIS, and excision completeness.",
    type: "option-cards",
    options: [
      { value: "NO_CERVICAL_PATHOLOGY", label: "No cervical pathology", hint: "No cervical abnormality in the specimen" },
      { value: "LSIL_CIN1", label: "LSIL/CIN1", hint: "Low-grade pathology excised or not" },
      { value: "HSIL_CIN23", label: "HSIL/CIN2/3", hint: "High-grade pathology", cautionTag: "High-grade" },
      { value: "AIS", label: "AIS", hint: "Adenocarcinoma in situ", cautionTag: "High-grade" },
    ],
    isVisible: (ans) =>
      ans.is_post_hysterectomy === "true" &&
      ans.hysterectomy_type === "TOTAL",
  },

  // ── Step 1a.4: Excision status ──────────────────────────────────────────
  {
    id: "excision_status",
    question: "Was HSIL/CIN2/3 or AIS completely excised?",
    hint: "Complete excision routes to Test of Cure; incomplete excision routes to colposcopy.",
    type: "option-cards",
    options: [
      { value: "COMPLETE", label: "Completely excised", hint: "Routes to Test of Cure where applicable" },
      { value: "INCOMPLETE", label: "Incompletely excised", hint: "Routes to colposcopy", cautionTag: "High attention" },
      { value: "UNKNOWN", label: "Unknown / not documented", hint: "Requires clinical review", cautionTag: "Missing information" },
    ],
    isVisible: (ans) =>
      ans.is_post_hysterectomy === "true" &&
      ans.hysterectomy_type === "TOTAL" &&
      (ans.hysterectomy_specimen_pathology === "HSIL_CIN23" || ans.hysterectomy_specimen_pathology === "AIS"),
  },

  // ── Step 1a.5: Post-hysterectomy HPV follow-up result ───────────────────
  {
    id: "post_hysterectomy_hpv_test_indicated",
    question: "Are you entering a post-hysterectomy HPV test result now?",
    hint: "Use this only when post-hysterectomy HPV testing has already been indicated. If not, the system will decide the next indicated action from history and specimen details.",
    type: "boolean-cards",
    options: [
      { value: "true", label: "Yes — HPV result available", hint: "Enter HPV result and continue post-hysterectomy routing" },
      { value: "false", label: "No — decide next action from history/specimen", hint: "No current post-hysterectomy HPV result to apply" },
    ],
    isVisible: (ans) =>
      ans.is_post_hysterectomy === "true" &&
      ans.hysterectomy_type === "TOTAL",
  },

  // ── Step 1b: Immunocompromised flag ──────────────────────────────────────
  {
    id: "immunocompromised",
    question: "Is this patient immunocompromised?",
    hint: "Immunocompromised patients (e.g. HIV, organ transplant, long-term immunosuppressive therapy) require shorter recall intervals and earlier colposcopy referral. NZ guidelines recommend 3-year recall (not 5-year) for immunocompromised patients with negative co-tests.",
    type: "boolean-cards",
    options: [
      { value: "true",  label: "Yes — immunocompromised", hint: "Shorter recall intervals apply — 3-year not 5-year for negatives", cautionTag: "Modified pathway" },
      { value: "false", label: "No — immunocompetent", hint: "Standard recall intervals apply" },
    ],
    isVisible: (ans) =>
      ans.is_post_hysterectomy === "false" ||
      ans.hysterectomy_type === "SUBTOTAL",
  },

  // ── Step 2: First-time HPV transition flag ────────────────────────────────
  {
    id: "is_first_hpv_transition",
    question: "Is this the patient's first HPV-based test after previous cytology-based screening?",
    hint: "Use this when a patient is transitioning from the old cytology programme to HPV primary screening.",
    type: "boolean-cards",
    options: [
      { value: "true",  label: "Yes — first HPV test (transitioning from cytology)", hint: "Uses the transition pathway" },
      { value: "false", label: "No — already on HPV primary screening", hint: "Uses the current clinical pathway based on symptoms, history, and results" },
    ],
    isVisible: (ans) =>
      ans.is_post_hysterectomy === "false" ||
      ans.hysterectomy_type === "SUBTOTAL",
  },

  // ── Step 2a: Screening status for transition invitation ─────────────────
  {
    id: "screening_status",
    question: "What screening status applies for this transition decision?",
    hint: "This is an invitation decision. It does not depend on a current HPV result.",
    type: "option-cards",
    options: [
      { value: "NEVER_SCREENED", label: "Never screened", hint: "Invite now" },
      { value: "UNDER_SCREENED", label: "Under-screened", hint: "Invite now" },
      { value: "OVERDUE", label: "Overdue", hint: "Invite now" },
      { value: "REGULAR_SCREENING", label: "Regular screening", hint: "Invite at next scheduled visit" },
      { value: "UNKNOWN", label: "Unknown / cannot verify", hint: "Requires external history or clinician review", cautionTag: "External history" },
    ],
    isVisible: (ans) =>
      ans.is_post_hysterectomy === "false" &&
      ans.is_first_hpv_transition === "true",
  },

  // ── Step 2a.1: Transition prior screening category ──────────────────────
  {
    id: "transition_prior_history",
    question: "Which prior result category applies for the transition?",
    hint: "Use NCSR/history where available. Previous high-grade, glandular, or endometrial results that have not returned to regular screening need a history-specific pathway.",
    type: "option-cards",
    options: [
      { value: "NEGATIVE_OR_NORMAL", label: "Normal/negative history", hint: "Regular transition pathway" },
      { value: "LOW_GRADE_ONLY", label: "Previous low-grade only", hint: "Regular transition pathway" },
      { value: "LOW_GRADE_RETURNED_TO_REGULAR", label: "Previous low-grade returned to regular screening", hint: "Regular transition pathway" },
      { value: "HIGH_GRADE_TOC_COMPLETE", label: "Previous high-grade with successful Test of Cure", hint: "Regular transition pathway" },
      { value: "HIGH_GRADE_TOC_INCOMPLETE", label: "Previous high-grade not returned to regular screening", hint: "High-grade history transition pathway", cautionTag: "History review" },
      { value: "PREVIOUS_AIS", label: "Previous AIS without total hysterectomy", hint: "Post-treatment history pathway", cautionTag: "History review" },
      { value: "PREVIOUS_ATYPICAL_GLANDULAR", label: "Previous atypical glandular cells", hint: "Glandular history transition pathway", cautionTag: "History review" },
      { value: "PREVIOUS_ATYPICAL_ENDOMETRIAL", label: "Previous atypical endometrial cells", hint: "Endometrial history transition pathway", cautionTag: "History review" },
      { value: "UNKNOWN", label: "Unknown / cannot verify", hint: "Requires external history or clinician review", cautionTag: "External history" },
    ],
    isVisible: (ans) =>
      ans.is_post_hysterectomy === "false" &&
      ans.is_first_hpv_transition === "true",
  },

  // ── Step 2a.2: History source availability ──────────────────────────────
  {
    id: "history_source_available",
    question: "Is the previous screening/history source available and reliable?",
    hint: "If NCSR or local records are unavailable, the engine will mark the decision as requiring external history rather than guessing.",
    type: "boolean-cards",
    options: [
      { value: "true", label: "Yes — source history available", hint: "History can be used for routing" },
      { value: "false", label: "No — history source unavailable", hint: "Requires external history/NCSR confirmation", cautionTag: "External history" },
    ],
    isVisible: (ans) =>
      ans.is_post_hysterectomy === "false" &&
      ans.is_first_hpv_transition === "true" &&
      !ans.transition_prior_history,
  },

  // ── Step 2a.3: Outstanding colposcopy recommendation ────────────────────
  {
    id: "colposcopy_recommended_last_cytology",
    question: "Did the last cytology report recommend colposcopy?",
    hint: "Previous possible/definite HSIL or atypical glandular history goes to colposcopy if the last cytology report recommended it and colposcopy has not already occurred.",
    type: "boolean-cards",
    options: [
      { value: "true", label: "Yes — colposcopy was recommended", hint: "Confirm whether it already occurred" },
      { value: "false", label: "No — colposcopy was not recommended", hint: "Complete Test of Cure or other history-specific branch" },
    ],
    isVisible: (ans) =>
      ans.is_first_hpv_transition === "true" &&
      (ans.transition_prior_history === "HIGH_GRADE_TOC_INCOMPLETE" || ans.transition_prior_history === "PREVIOUS_ATYPICAL_GLANDULAR"),
  },

  {
    id: "colposcopy_completed_last_recommendation",
    question: "Has that recommended colposcopy already occurred?",
    hint: "If it has not occurred, the history pathway recommends referral to colposcopy.",
    type: "boolean-cards",
    options: [
      { value: "true", label: "Yes — already occurred", hint: "Proceed to Test of Cure/history branch" },
      { value: "false", label: "No — has not occurred", hint: "Refer to colposcopy", cautionTag: "Referral" },
    ],
    isVisible: (ans) =>
      ans.colposcopy_recommended_last_cytology === "true",
  },

  // ── Step 2a.4: AG2 transition status ────────────────────────────────────
  {
    id: "ag2_report_timing",
    question: "For previous AG2/atypical endometrial cells, when was the report?",
    hint: "The history pathway returns to primary HPV screening when the atypical endometrial report was more than 3 years previously.",
    type: "option-cards",
    options: [
      { value: "OLDER_THAN_3_YEARS", label: "More than 3 years ago", hint: "Primary HPV screening at next scheduled visit" },
      { value: "WITHIN_3_YEARS", label: "Within the last 3 years", hint: "Specialist/discharge status decides the branch" },
      { value: "UNKNOWN", label: "Unknown / not available", hint: "Requires clinician review or external history", cautionTag: "Missing information" },
    ],
    isVisible: (ans) =>
      ans.is_first_hpv_transition === "true" &&
      (ans.transition_prior_history === "PREVIOUS_ATYPICAL_ENDOMETRIAL" || ans.atypical_endometrial_history === "true"),
  },

  {
    id: "specialist_discharged_to_primary_care",
    question: "Has the patient already been seen by specialist services and discharged to primary care?",
    hint: "The history pathway returns to primary HPV screening if specialist services have already discharged the patient to primary healthcare services.",
    type: "boolean-cards",
    options: [
      { value: "true", label: "Yes — discharged to primary care", hint: "Primary HPV screening pathway" },
      { value: "false", label: "No / not documented", hint: "Refer to specialist gynaecology unless report is older than 3 years", cautionTag: "Specialist review" },
    ],
    isVisible: (ans) =>
      ans.is_first_hpv_transition === "true" &&
      (ans.transition_prior_history === "PREVIOUS_ATYPICAL_ENDOMETRIAL" || ans.atypical_endometrial_history === "true") &&
      ans.ag2_report_timing !== "OLDER_THAN_3_YEARS",
  },

  // ── Step 2b: Abnormal vaginal bleeding entry ─────────────────────────────
  {
    id: "has_abnormal_vaginal_bleeding",
    question: "Does this patient have abnormal vaginal bleeding (inter-menstrual or post-coital)?",
    hint: "Abnormal vaginal bleeding follows a separate investigation pathway. Important: refer for gynaecological assessment without delay if there are signs or symptoms of cervical cancer.",
    type: "boolean-cards",
    options: [
      { value: "true",  label: "Yes — abnormal vaginal bleeding present", hint: "Uses the abnormal bleeding investigation pathway", cautionTag: "Bleeding pathway" },
      { value: "false", label: "No — no abnormal vaginal bleeding", hint: "Continue with standard screening pathway" },
    ],
    isVisible: (ans) =>
      ans.is_post_hysterectomy === "false" &&
      ans.is_first_hpv_transition === "false",
  },

  // ── Step 2b.1: Bleeding type ────────────────────────────────────────────
  {
    id: "bleeding_type",
    question: "What abnormal bleeding pattern is present?",
    hint: "This pathway applies to inter-menstrual or post-coital bleeding.",
    type: "option-cards",
    options: [
      { value: "INTER_MENSTRUAL", label: "Inter-menstrual bleeding", hint: "Bleeding between periods" },
      { value: "POST_COITAL", label: "Post-coital bleeding", hint: "Bleeding after intercourse" },
      { value: "BOTH", label: "Both inter-menstrual and post-coital", hint: "Both abnormal bleeding entry symptoms are present" },
      { value: "UNSPECIFIED", label: "Abnormal bleeding, type not specified", hint: "Document type later if available", cautionTag: "Incomplete" },
    ],
    isVisible: (ans) =>
      ans.has_abnormal_vaginal_bleeding === "true" &&
      ans.abnormal_bleeding_stage === "INITIAL_ASSESSMENT" &&
      ans.has_cancer_symptoms !== "true" &&
      ans.figure10_initial_workup_completed === "true",
  },

  // ── Step 2b.2: Bleeding workflow stage ──────────────────────────────────
  {
    id: "abnormal_bleeding_stage",
    question: "Which abnormal bleeding review stage is this?",
    hint: "Do not force 6–8 week resolution at the first visit. Use follow-up review only when the review has actually occurred.",
    type: "option-cards",
    options: [
      { value: "INITIAL_ASSESSMENT", label: "Initial assessment", hint: "History, speculum/pelvic exam and co-test should be captured" },
      { value: "SIX_TO_EIGHT_WEEK_REVIEW", label: "6–8 week follow-up review", hint: "Bleeding resolution can be assessed now" },
    ],
    isVisible: (ans) => ans.has_abnormal_vaginal_bleeding === "true",
  },

  // ── Step 2b.3: Cancer symptoms ──────────────────────────────────────────
  {
    id: "has_cancer_symptoms",
    question: "Are there signs or symptoms of cervical cancer?",
    hint: "Refer for gynaecological assessment without delay if signs or symptoms of cervical cancer are present.",
    type: "boolean-cards",
    options: [
      { value: "true", label: "Yes — signs/symptoms present", hint: "Urgent gynaecological assessment without delay", cautionTag: "Urgent" },
      { value: "false", label: "No — no cancer symptoms identified", hint: "Continue abnormal bleeding workup" },
    ],
    isVisible: (ans) =>
      ans.has_abnormal_vaginal_bleeding === "true" &&
      ans.abnormal_bleeding_stage === "INITIAL_ASSESSMENT",
  },

  // ── Step 2b.4: Initial workup captured ──────────────────────────────────
  {
    id: "figure10_initial_workup_completed",
    question: "Have history, speculum exam, pelvic exam and co-test been completed or arranged?",
    hint: "Initial workup includes menstrual, contraceptive and sexual history, speculum exam, pelvic exam and co-test.",
    type: "boolean-cards",
    options: [
      { value: "true", label: "Yes — initial workup completed/arranged", hint: "Proceed to cervix assessment" },
      { value: "false", label: "No — workup incomplete", hint: "Complete or arrange the initial abnormal bleeding workup", cautionTag: "Required" },
    ],
    isVisible: (ans) =>
      ans.has_abnormal_vaginal_bleeding === "true" &&
      ans.abnormal_bleeding_stage === "INITIAL_ASSESSMENT" &&
      ans.has_cancer_symptoms !== "true",
  },

  {
    id: "figure10_cotest_result_available",
    question: "Is the abnormal bleeding co-test result available to record now?",
    hint: "The bleeding pathway should capture co-test completion and results when available, but management still follows the bleeding workflow rather than routine screening triage.",
    type: "boolean-cards",
    options: [
      { value: "true", label: "Yes — record co-test result", hint: "HPV/cytology result questions will appear" },
      { value: "false", label: "No — result not available yet", hint: "Continue the abnormal bleeding workflow and record later" },
    ],
    isVisible: (ans) =>
      ans.has_abnormal_vaginal_bleeding === "true" &&
      ans.abnormal_bleeding_stage === "INITIAL_ASSESSMENT" &&
      ans.figure10_initial_workup_completed === "true",
  },

  // ── Step 2c: Abnormal cervix ─────────────────────────────────────────────
  {
    id: "abnormal_cervix",
    question: "Is the cervix abnormal on speculum and pelvic examination?",
    hint: "An abnormal-appearing cervix changes the management pathway. Ensure you have performed speculum examination, pelvic exam and co-test as part of the initial assessment.",
    type: "boolean-cards",
    options: [
      { value: "true",  label: "Yes — cervix appears abnormal", hint: "Assess for suspicion of cancer", cautionTag: "Assess urgently" },
      { value: "false", label: "No — cervix appears normal", hint: "Investigate for OCP, STI or other cause" },
    ],
    isVisible: (ans) => ans.has_abnormal_vaginal_bleeding === "true",
  },

  // ── Step 2d: Suspicion of cancer ─────────────────────────────────────────
  {
    id: "suspicion_of_cancer",
    question: "Is there clinical suspicion of cervical cancer?",
    hint: "If there are signs or symptoms of cervical cancer (e.g. contact bleeding, abnormal appearance, unusual discharge), refer for gynaecological assessment without delay.",
    type: "boolean-cards",
    options: [
      { value: "true",  label: "Yes — suspicion of cancer", hint: "Co-test and colposcopy required urgently", cautionTag: "Urgent" },
      { value: "false", label: "No — no suspicion of cancer", hint: "Treat per Healthcare Pathways or refer to gynaecology" },
    ],
    isVisible: (ans) =>
      ans.has_abnormal_vaginal_bleeding === "true" &&
      ans.abnormal_bleeding_stage === "INITIAL_ASSESSMENT" &&
      ans.has_cancer_symptoms !== "true" &&
      ans.abnormal_cervix === "true",
  },

  // ── Step 2e: Suspect OCP problem ─────────────────────────────────────────
  {
    id: "suspect_ocp_problem",
    question: "Is an oral contraceptive pill (OCP) problem suspected as the cause?",
    hint: "If the patient is using an OCP and bleeding is likely related to contraceptive use (e.g. break-through bleeding), adjusting the OCP is the first step.",
    type: "boolean-cards",
    options: [
      { value: "true",  label: "Yes — OCP problem suspected", hint: "Adjust oral contraceptive and review in 6–8 weeks" },
      { value: "false", label: "No — OCP not the likely cause", hint: "Investigate for STI and other causes" },
    ],
    isVisible: (ans) =>
      ans.has_abnormal_vaginal_bleeding === "true" &&
      ans.abnormal_bleeding_stage === "INITIAL_ASSESSMENT" &&
      ans.has_cancer_symptoms !== "true" &&
      ans.abnormal_cervix === "false",
  },

  // ── Step 2f: STI identified ──────────────────────────────────────────────
  {
    id: "sti_identified",
    question: "Has an STI been identified on investigation?",
    hint: "Investigation results may identify an STI (e.g. chlamydia, gonorrhoea) as the cause of abnormal vaginal bleeding. If STI found, treat accordingly and review.",
    type: "boolean-cards",
    options: [
      { value: "true",  label: "Yes — STI identified", hint: "Treat STI and review bleeding at 6–8 weeks" },
      { value: "false", label: "No — no STI identified", hint: "Manage per Healthcare Pathways or consult local gynaecology" },
    ],
    isVisible: (ans) =>
      ans.has_abnormal_vaginal_bleeding === "true" &&
      ans.abnormal_bleeding_stage === "INITIAL_ASSESSMENT" &&
      ans.has_cancer_symptoms !== "true" &&
      ans.abnormal_cervix === "false" &&
      ans.suspect_ocp_problem === "false",
  },

  // ── Step 2g: Bleeding resolved follow-up review ─────────────────────────
  {
    id: "bleeding_resolved",
    question: "Has the bleeding resolved at the 6–8 week follow-up review?",
    hint: "After treatment (OCP adjustment, STI treatment, or general management), review the patient at 6–8 weeks to assess bleeding resolution.",
    type: "boolean-cards",
    options: [
      { value: "true",  label: "Yes — bleeding resolved", hint: "Continue regular cervical screening (if ≥25 or commence at 25)" },
      { value: "false", label: "No — bleeding has not resolved", hint: "Refer to gynaecology" },
    ],
    isVisible: (ans) =>
      ans.has_abnormal_vaginal_bleeding === "true" &&
      ans.abnormal_bleeding_stage === "SIX_TO_EIGHT_WEEK_REVIEW",
  },

  // ── Step 3: Atypical endometrial history (AG2 routing) ────────────────────
  {
    id: "atypical_endometrial_history",
    question: "Does this patient have a history of atypical endometrial cells (AG2)?",
    hint: "Patients with atypical endometrial history use the previous abnormal cytology pathway and may require direct gynaecology referral.",
    type: "boolean-cards",
    options: [
      { value: "true",  label: "Yes — previous AG2 / atypical endometrial cells", hint: "Uses previous abnormal cytology pathway", cautionTag: "High attention" },
      { value: "false", label: "No — no atypical endometrial history", hint: "Uses regular transition pathway" },
    ],
    isVisible: (ans) =>
      ans.is_post_hysterectomy === "false" &&
      ans.is_first_hpv_transition === "true",
  },

  // ── Step 4: Sample type ───────────────────────────────────────────────────
  {
    id: "sample_type",
    question: "What sample type was used for this test?",
    hint: "Self-collected swabs (SWAB) require a return visit with clinical examination before cytology results can be interpreted.",
    type: "option-cards",
    options: [
      { value: "LBC",  label: "LBC — Liquid Based Cytology", hint: "Clinician-collected cervical sample" },
      { value: "SWAB", label: "SWAB — Self-collected vaginal swab", hint: "Requires clinical review if cytology needed", cautionTag: "Clinical review required" },
    ],
    isVisible: (ans) =>
      (ans.figure10_cotest_result_available === "true" ||
        ans.is_post_hysterectomy === "false" ||
        ans.post_hysterectomy_hpv_test_indicated === "true") &&
      (ans.has_abnormal_vaginal_bleeding !== "true" || ans.figure10_cotest_result_available === "true") &&
      ans.is_first_hpv_transition !== "true",
  },

  // ── Step 4b: SWAB return-visit confirmation ───────────────────────────────
  {
    id: "swab_return_visit_completed",
    question: "Has the patient returned for a clinical examination following the self-collected swab?",
    hint: "NZ NCSP requires a return visit with speculum examination and co-test review before the pathway decision can be made for self-collected swabs. Do not proceed until this visit is documented.",
    type: "boolean-cards",
    options: [
      { value: "true",  label: "Yes — return visit completed", hint: "Clinical examination and co-test review has been performed" },
      { value: "false", label: "No — return visit not yet completed", hint: "Schedule return visit before proceeding", cautionTag: "Required" },
    ],
    isVisible: (ans) => ans.sample_type === "SWAB",
  },

  // ── Step 5: HPV result ────────────────────────────────────────────────────
  {
    id: "hpv_result",
    question: "What was the HPV test result?",
    hint: "HPV 16/18 is considered high-risk and typically triggers colposcopy referral. HPV Other requires co-testing with cytology.",
    type: "option-cards",
    options: [
      { value: "NOT_DETECTED", label: "HPV Not Detected",     hint: "Routine recall — 5-year interval" },
      { value: "HPV_16_18",    label: "HPV 16/18 Positive",   hint: "High risk — colposcopy referral likely", cautionTag: "High risk" },
      { value: "HPV_OTHER",    label: "HPV Other Positive",   hint: "Requires cytology co-test result" },
      { value: "INADEQUATE",   label: "Inadequate / Repeat required", hint: "3-month repeat required" },
    ],
    isVisible: (ans) =>
      (ans.has_abnormal_vaginal_bleeding !== "true" || ans.figure10_cotest_result_available === "true") &&
      (ans.is_post_hysterectomy !== "true" || ans.post_hysterectomy_hpv_test_indicated === "true") &&
      ans.is_first_hpv_transition !== "true",
  },

  // ── Step 6: Cytology result ───────────────────────────────────────────────
  {
    id: "cytology_result",
    question: "What was the cytology result?",
    hint: "Only required when HPV Other is detected. High-grade results (ASC-H, HSIL, SCC, AG3–AG5, AC2–AC4) trigger urgent referral.",
    type: "option-cards",
    options: [
      { value: "NEGATIVE",       label: "Negative",                hint: "No abnormal cells detected" },
      { value: "ASC_US",         label: "ASC-US",                  hint: "Atypical squamous cells of undetermined significance" },
      { value: "LSIL",           label: "LSIL",                    hint: "Low-grade squamous intraepithelial lesion" },
      { value: "ASC_H",          label: "ASC-H",                   hint: "Cannot exclude HSIL", cautionTag: "High-grade" },
      { value: "HSIL",           label: "HSIL",                    hint: "High-grade squamous intraepithelial lesion", cautionTag: "High-grade" },
      { value: "SCC",            label: "SCC",                     hint: "Squamous cell carcinoma", cautionTag: "Urgent" },
      { value: "AG1",            label: "AG1 — atypical endocervical cells", hint: "Glandular abnormality pathway — colposcopy" },
      { value: "AG2",            label: "AG2 — atypical endometrial cells", hint: "Glandular abnormality pathway — direct gynaecology referral", cautionTag: "Gynaecology" },
      { value: "AG3",            label: "AG3 — atypical glandular cells NOS", hint: "Glandular abnormality pathway — colposcopy", cautionTag: "High-grade" },
      { value: "AG4",            label: "AG4 — atypical endocervical cells favouring neoplasia", hint: "Glandular abnormality pathway — colposcopy", cautionTag: "High-grade" },
      { value: "AG5",            label: "AG5 — atypical glandular cells favouring neoplasia", hint: "Glandular abnormality pathway — colposcopy", cautionTag: "High-grade" },
      { value: "AC1",            label: "AC1 — endocervical adenocarcinoma", hint: "Glandular abnormality pathway — colposcopy", cautionTag: "Urgent" },
      { value: "AC2",            label: "AC2 — endometrial adenocarcinoma", hint: "Glandular abnormality pathway — direct gynaecology referral", cautionTag: "Gynaecology" },
      { value: "AC3",            label: "AC3 — extrauterine adenocarcinoma", hint: "Glandular abnormality pathway — colposcopy", cautionTag: "Urgent" },
      { value: "AC4",            label: "AC4 — adenocarcinoma NOS", hint: "Glandular abnormality pathway — colposcopy", cautionTag: "Urgent" },
      { value: "UNSATISFACTORY", label: "Unsatisfactory",          hint: "Sample inadequate — 3-month repeat" },
    ],
    isVisible: (ans) =>
      (ans.has_abnormal_vaginal_bleeding !== "true" || ans.figure10_cotest_result_available === "true") &&
      (ans.is_post_hysterectomy !== "true" || ans.post_hysterectomy_hpv_test_indicated === "true") &&
      ans.is_first_hpv_transition !== "true" &&
      (
        ans.hpv_result === "HPV_OTHER" ||
        ans.hpv_result === "HPV_16_18" ||
        ans.is_test_of_cure === "true" ||
        ans.repeat_context === "TEST_OF_CURE" ||
        ans.repeat_context === "POST_NORMAL_COLPOSCOPY_HIGH_GRADE_CYTOLOGY"
      ),
  },

  // ── Step 6b: Pregnant participant? ────────────────────────────────────────
  // Only visible when cytology is high-grade and patient is not post-hysterectomy
  {
    id: "is_pregnant",
    question: "Is this patient currently pregnant?",
    hint: "Pregnant participants with high-grade cytology (ASC-H, HSIL, atypical glandular cells, AIS) use a pregnancy-specific pathway. Treatment is deferred and MDM review is required.",
    type: "boolean-cards",
    options: [
      { value: "true",  label: "Yes — patient is pregnant", hint: "Uses the pregnant participant pathway", cautionTag: "Pregnancy pathway" },
      { value: "false", label: "No — patient is not pregnant", hint: "Continue with standard pathway" },
    ],
    isVisible: (ans) => {
      if (ans.is_post_hysterectomy === "true") return false;
      if (ans.has_abnormal_vaginal_bleeding === "true") return false;
      const qualifyingCytology = ["ASC_H", "HSIL", "AG1", "AG2", "AG3", "AG4", "AG5", "AC1", "AC2", "AC3", "AC4"];
      return qualifyingCytology.includes(ans.cytology_result ?? "");
    },
  },

  // ── Step 6c: Pregnant MDM outcome ────────────────────────────────────────
  {
    id: "mdm_outcome_pregnant",
    question: "What was the MDM (Multidisciplinary Meeting) outcome for this pregnant participant?",
    hint: "In the Normal TZ (no visible lesion) pathway for pregnant participants, MDM review determines whether cytology was downgraded or high-grade status was confirmed.",
    type: "option-cards",
    options: [
      { value: "DOWNGRADED_NEGATIVE",    label: "Downgraded to negative",            hint: "Return to primary HPV screening pathway" },
      { value: "DOWNGRADED_LSIL",        label: "Downgraded to LSIL / ASC-US",       hint: "Manage as LSIL — follow LSIL pathway" },
      { value: "CONFIRMED_HIGH_GRADE",   label: "Confirmed possible/definite high-grade", hint: "Colposcopy review in 6 months or 6–12 weeks postpartum", cautionTag: "Defer treatment" },
    ],
    isVisible: (ans) =>
      ans.is_pregnant === "true" &&
      ans.has_colposcopy_findings === "true" &&
      (ans.transformation_zone_state === "NORMAL" || ans.visible_lesion === "false"),
  },

  // ── Step 7: Is this a Test of Cure follow-up? ─────────────────────────────
  {
    id: "is_test_of_cure",
    question: "Is this a Test of Cure follow-up after previous CIN treatment?",
    hint: "Test of Cure applies after treatment for CIN2/CIN3. Two consecutive HPV-negative co-tests are required for discharge to routine recall.",
    type: "boolean-cards",
    options: [
      { value: "true",  label: "Yes — post-treatment Test of Cure", hint: "Uses the Test of Cure pathway" },
      { value: "false", label: "No — routine or post-abnormal screening", hint: "Uses the appropriate screening, glandular, or follow-up pathway" },
    ],
    isVisible: (ans) =>
      ans.is_post_hysterectomy === "false" &&
      ans.is_first_hpv_transition === "false" &&
      ans.has_abnormal_vaginal_bleeding !== "true" &&
      ans.is_pregnant !== "true",
  },

  // ── Step 7a: Repeat context ─────────────────────────────────────────────
  {
    id: "repeat_context",
    question: "What repeat/follow-up context applies to this result?",
    hint: "The same HPV/cytology result can route differently depending on whether this is primary HPV follow-up, normal-colposcopy follow-up, high-grade colposcopy follow-up, or Test of Cure.",
    type: "option-cards",
    options: [
      { value: "PRIMARY_HPV", label: "Primary HPV screening", hint: "Baseline or repeat primary HPV pathway" },
      { value: "POST_NORMAL_COLPOSCOPY_LOW_GRADE_CYTOLOGY", label: "After normal colposcopy, low-grade cytology", hint: "Post-normal-colposcopy follow-up context" },
      { value: "POST_NORMAL_COLPOSCOPY_HIGH_GRADE_CYTOLOGY", label: "After normal colposcopy, cytology ≥ ASC-H", hint: "High-grade post-colposcopy follow-up context", cautionTag: "High-grade" },
      { value: "TEST_OF_CURE", label: "Test of Cure", hint: "Post-treatment context" },
    ],
    isVisible: (ans) =>
      ans.is_post_hysterectomy === "false" &&
      ans.is_first_hpv_transition === "false" &&
      ans.has_abnormal_vaginal_bleeding !== "true" &&
      ans.is_pregnant !== "true",
  },

  // ── Step 7b: Repeat stage ───────────────────────────────────────────────
  {
    id: "repeat_stage",
    question: "Is this a baseline, first repeat, or second repeat result?",
    hint: "Primary HPV, post-normal-colposcopy, and Test of Cure pathways depend on explicit repeat stage. Do not infer second repeat from an unrelated counter.",
    type: "option-cards",
    options: [
      { value: "BASELINE", label: "Baseline / initial result", hint: "Initial result in this pathway" },
      { value: "FIRST_REPEAT", label: "First repeat", hint: "Usually the 12-month repeat after initial HPV Other/low-grade branch" },
      { value: "SECOND_REPEAT", label: "Second repeat", hint: "Second repeat follow-up; persistent HPV usually escalates", cautionTag: "Escalation branch" },
    ],
    isVisible: (ans) =>
      ans.is_post_hysterectomy === "false" &&
      ans.is_first_hpv_transition === "false" &&
      ans.has_abnormal_vaginal_bleeding !== "true" &&
      ans.is_pregnant !== "true" &&
      ans.repeat_context !== "POST_NORMAL_COLPOSCOPY_HIGH_GRADE_CYTOLOGY",
  },

  // ── Step 7c: Test of Cure stage ─────────────────────────────────────────
  {
    id: "test_of_cure_stage",
    question: "Which Test of Cure stage is this?",
    hint: "Test of Cure returns to regular screening only after the required consecutive negative co-tests.",
    type: "option-cards",
    options: [
      { value: "FIRST_TEST", label: "First post-treatment co-test", hint: "6 months post-treatment" },
      { value: "SECOND_TEST", label: "Second consecutive co-test", hint: "Usually 12 months after first negative co-test" },
      { value: "CONTINUING", label: "Continuing Test of Cure", hint: "Use when Test of Cure is ongoing until successful completion" },
    ],
    isVisible: (ans) =>
      ans.is_test_of_cure === "true" ||
      ans.repeat_context === "TEST_OF_CURE",
  },

  // ── Step 8: Colposcopy context — entering colposcopy findings ─────────────
  {
    id: "has_colposcopy_findings",
    question: "Are you entering colposcopy findings for this patient?",
    hint: "Select Yes if the patient has attended a colposcopy appointment and results are available.",
    type: "boolean-cards",
    options: [
      { value: "true",  label: "Yes — entering colposcopy findings", hint: "Uses the relevant colposcopy follow-up pathway" },
      { value: "false", label: "No — HPV/cytology results only",      hint: "Uses primary HPV screening logic" },
    ],
    isVisible: (ans) =>
      ans.is_post_hysterectomy === "false" &&
      ans.has_abnormal_vaginal_bleeding !== "true" &&
      (
        // Standard path: not first transition, not test of cure
        (ans.is_first_hpv_transition === "false" && ans.is_test_of_cure !== "true") ||
        // Pregnant path: always ask colposcopy findings after pregnancy confirmed
        ans.is_pregnant === "true"
      ),
  },

  // ── Step 9: TZ type ───────────────────────────────────────────────────────
  {
    id: "tz_type",
    question: "What is the Transformation Zone (TZ) type?",
    hint: "TZ Type 3 (fully endocervical) has exception pathways and may require 12-month co-test or MDM review for excision guidance.",
    type: "option-cards",
    options: [
      { value: "TYPE1", label: "TZ Type 1 — Fully ectocervical",     hint: "Entire squamocolumnar junction visible" },
      { value: "TYPE2", label: "TZ Type 2 — Partly endocervical",    hint: "Part of junction in endocervical canal" },
      { value: "TYPE3", label: "TZ Type 3 — Fully endocervical",     hint: "Junction entirely in canal — exception rules apply", cautionTag: "TZ3 exception" },
    ],
    isVisible: (ans) => ans.has_colposcopy_findings === "true",
  },

  // ── Step 9a: Transformation zone state ─────────────────────────────────
  {
    id: "transformation_zone_state",
    question: "Is the transformation zone normal or abnormal?",
    hint: "Pregnancy pathway logic separates normal TZ/no visible lesion from abnormal TZ/visible lesion.",
    type: "option-cards",
    options: [
      { value: "NORMAL", label: "Normal TZ", hint: "No abnormal transformation zone findings" },
      { value: "ABNORMAL", label: "Abnormal TZ", hint: "Abnormal transformation zone or lesion seen", cautionTag: "Abnormal" },
    ],
    isVisible: (ans) =>
      ans.has_colposcopy_findings === "true" &&
      ans.is_pregnant === "true",
  },

  // ── Step 9b: Visible lesion ─────────────────────────────────────────────
  {
    id: "visible_lesion",
    question: "Is there a visible lesion at colposcopy?",
    hint: "High-grade post-colposcopy, glandular, and pregnancy pathways require visible lesion status to avoid unsafe branch selection.",
    type: "boolean-cards",
    options: [
      { value: "true", label: "Yes — visible lesion present", hint: "Biopsy or treatment branch may apply", cautionTag: "Visible lesion" },
      { value: "false", label: "No — no visible lesion", hint: "MDM/repeat pathway may apply depending on the clinical context" },
    ],
    isVisible: (ans) =>
      ans.has_colposcopy_findings === "true" &&
      (
        ans.repeat_context === "POST_NORMAL_COLPOSCOPY_HIGH_GRADE_CYTOLOGY" ||
        ans.is_pregnant === "true" ||
        ["AG1", "AG2", "AG3", "AG4", "AG5", "AC1", "AC2", "AC3", "AC4"].includes(ans.cytology_result ?? "")
      ),
  },

  // ── Step 10: Colposcopic impression ──────────────────────────────────────
  {
    id: "colposcopic_impression",
    question: "What is the colposcopic impression?",
    hint: "The colposcopist's overall assessment. HSIL impression or worse escalates to high-grade management.",
    type: "option-cards",
    options: [
      { value: "NORMAL",         label: "Normal",                   hint: "No acetowhite change or abnormality detected" },
      { value: "LSIL",           label: "LSIL impression",          hint: "Low-grade changes — biopsy recommended" },
      { value: "HSIL",           label: "HSIL impression",          hint: "High-grade changes — treatment likely required", cautionTag: "High-grade" },
      { value: "AIS",            label: "AIS impression",           hint: "Adenocarcinoma in situ impression", cautionTag: "High-grade" },
      { value: "INVASION",       label: "Invasive disease suspected", hint: "Urgent MDM review required", cautionTag: "Urgent" },
      { value: "UNSATISFACTORY", label: "Unsatisfactory",           hint: "Incomplete examination — repeat in 3–6 months" },
    ],
    isVisible: (ans) => ans.has_colposcopy_findings === "true",
  },

  // ── Step 11: Biopsy taken? ────────────────────────────────────────────────
  {
    id: "biopsy_taken",
    question: "Was a biopsy taken during colposcopy?",
    hint: "Biopsy provides histological confirmation. If no biopsy was taken, management is based on colposcopic impression alone.",
    type: "boolean-cards",
    options: [
      { value: "true",  label: "Yes — biopsy taken", hint: "Enter histology result on next step" },
      { value: "false", label: "No — no biopsy",     hint: "Decision based on colposcopic impression" },
    ],
    isVisible: (ans) =>
      ans.has_colposcopy_findings === "true" &&
      ans.colposcopic_impression !== "UNSATISFACTORY",
  },

  // ── Step 12: Histology result ─────────────────────────────────────────────
  {
    id: "histology_result",
    question: "What was the histology result?",
    hint: "CIN2/CIN3 requires treatment. AIS, SCC, or adenocarcinoma require urgent specialist/MDM referral.",
    type: "option-cards",
    options: [
      { value: "NORMAL",          label: "Normal / No CIN",             hint: "No dysplasia detected" },
      { value: "CIN1",            label: "CIN 1",                       hint: "Low-grade — 12-month co-test recall" },
      { value: "CIN2",            label: "CIN 2",                       hint: "High-grade — treatment required (P2)", cautionTag: "Treatment" },
      { value: "CIN3",            label: "CIN 3",                       hint: "High-grade — urgent treatment (P1)", cautionTag: "Urgent" },
      { value: "AIS",             label: "AIS — Adenocarcinoma in situ", hint: "MDM + gynaecology specialist required", cautionTag: "Urgent" },
      { value: "SCC",             label: "SCC — Squamous cell carcinoma", hint: "Urgent oncology referral", cautionTag: "Urgent" },
      { value: "ADENOCARCINOMA",  label: "Adenocarcinoma",               hint: "Urgent oncology referral", cautionTag: "Urgent" },
      { value: "UNSATISFACTORY",  label: "Unsatisfactory",               hint: "Biopsy inadequate — repeat required" },
    ],
    isVisible: (ans) =>
      ans.has_colposcopy_findings === "true" &&
      ans.biopsy_taken === "true",
  },

  // ── Step 13: MDM outcome (for AIS/cancer cases) ───────────────────────────
  {
    id: "mdm_outcome",
    question: "What was the MDM (Multidisciplinary Meeting) outcome?",
    hint: "Use the pathway-specific MDM outcome where high-grade post-colposcopy, glandular, pregnancy, AIS or invasive disease requires case review.",
    type: "option-cards",
    options: [
      { value: "DOWNGRADED_NEGATIVE", label: "Downgraded to negative", hint: "Pregnancy pathway branch to primary HPV screening" },
      { value: "DOWNGRADED_ASC_US_LSIL", label: "Downgraded to ASC-US/LSIL", hint: "Follow LSIL pathway" },
      { value: "DOWNGRADED_LSIL", label: "Downgraded to LSIL", hint: "High-grade review follows LSIL pathway" },
      { value: "UPGRADED_HSIL", label: "Upgraded to HSIL", hint: "HSIL treatment pathway", cautionTag: "Treatment" },
      { value: "CONFIRMED_ASC_H", label: "Confirmed ASC-H", hint: "Determine next step from HPV/cytology/visible lesion", cautionTag: "High attention" },
      { value: "CONFIRMED_HIGH_GRADE", label: "Confirmed possible/definite high-grade", hint: "Pregnancy pathway colposcopy review timing", cautionTag: "High-grade" },
      { value: "CYTOLOGY_CONFIRMED_NOT_AG2", label: "Cytology confirmed, not AG2", hint: "Glandular pathway type 3 excision" },
      { value: "AG2_CYTOLOGY_CONFIRMED", label: "AG2 cytology confirmed", hint: "Investigate other gynaecological malignancies", cautionTag: "Gynaecology" },
      { value: "CYTOLOGY_NOT_CONFIRMED", label: "Cytology not confirmed", hint: "Repeat colposcopy in 6 months" },
      { value: "EXCISION",      label: "Excision recommended",         hint: "LLETZ or cold-knife cone biopsy" },
      { value: "ABLATION",      label: "Ablation recommended",         hint: "Laser ablation or cryotherapy" },
      { value: "HYSTERECTOMY",  label: "Hysterectomy recommended",     hint: "For AIS or recurrent high-grade disease" },
      { value: "SURVEILLANCE",  label: "Surveillance only",            hint: "Close monitoring without immediate treatment" },
      { value: "REFERRAL",      label: "Specialist referral required", hint: "Gynaecological oncology referral" },
    ],
    isVisible: (ans) =>
      ans.has_colposcopy_findings === "true" &&
      (
        ans.repeat_context === "POST_NORMAL_COLPOSCOPY_HIGH_GRADE_CYTOLOGY" ||
        ans.visible_lesion === "false" ||
        ["AG1", "AG2", "AG3", "AG4", "AG5", "AC1", "AC2", "AC3", "AC4"].includes(ans.cytology_result ?? "") ||
        ans.histology_result === "AIS" ||
        ans.histology_result === "SCC" ||
        ans.histology_result === "ADENOCARCINOMA" ||
        ans.colposcopic_impression === "INVASION"
      ),
  },
];

// ─── Helper functions ─────────────────────────────────────────────────────────

/**
 * Returns the subset of steps visible given current answers.
 */
export function getVisibleSteps(answers: Record<string, string>): WizardStep[] {
  return WIZARD_STEPS.filter((step) => step.isVisible(answers));
}

/**
 * Returns the next step that has not yet been answered.
 * The "patient_context" info step is skipped for next-step computation.
 */
export function getNextUnansweredStep(
  answers: Record<string, string>
): WizardStep | null {
  const visible = getVisibleSteps(answers);
  return (
    visible.find(
      (step) => step.type !== "info" && !(step.id in answers)
    ) ?? null
  );
}

/**
 * Returns the step by ID (regardless of visibility).
 */
export function getStepById(id: string): WizardStep | undefined {
  return WIZARD_STEPS.find((s) => s.id === id);
}

/**
 * Returns the canonical order index for a wizard step.
 */
export function getStepIndex(id: string): number {
  return WIZARD_STEPS.findIndex((s) => s.id === id);
}

/**
 * Returns answer IDs that should be discarded after a step is answered.
 * Hidden answers are always stale. If an existing answer changes, all later
 * answers are also stale even when their questions remain visible, because the
 * user must reconfirm the branch from that point onward.
 */
export function getInvalidatedAnswerStepIds(
  currentAnswers: Record<string, string>,
  stepId: string,
  nextValue: string
): string[] {
  const updatedAnswers = { ...currentAnswers, [stepId]: nextValue };
  const visibleStepIds = new Set(getVisibleSteps(updatedAnswers).map((s) => s.id));
  const previousValue = currentAnswers[stepId];
  const changedExistingAnswer = previousValue !== undefined && previousValue !== nextValue;
  const changedStepIndex = getStepIndex(stepId);

  return Object.keys(currentAnswers).filter((existingStepId) => {
    if (existingStepId === stepId) return false;
    if (!visibleStepIds.has(existingStepId)) return true;
    return changedExistingAnswer &&
      changedStepIndex >= 0 &&
      getStepIndex(existingStepId) > changedStepIndex;
  });
}

/**
 * Rebuilds answers in wizard order and drops answers whose steps are not
 * visible from the already-confirmed path. This prevents old hidden branch
 * answers from affecting final decision generation.
 */
export function getVisibleAnswerMap(
  answers: Record<string, string>
): Record<string, string> {
  const visibleAnswers: Record<string, string> = {};

  for (const step of WIZARD_STEPS) {
    if (step.type === "info") continue;
    if (!(step.id in answers)) continue;
    if (!step.isVisible(visibleAnswers)) continue;
    visibleAnswers[step.id] = answers[step.id];
  }

  return visibleAnswers;
}

/**
 * Returns the current progress: { current, total, percent }
 */
export function getWizardProgress(answers: Record<string, string>): {
  current: number;
  total: number;
  percent: number;
} {
  const visible = getVisibleSteps(answers).filter((s) => s.type !== "info");
  const answered = visible.filter((s) => s.id in answers).length;
  const total = visible.length;
  return {
    current: answered,
    total,
    percent: total > 0 ? Math.round((answered / total) * 100) : 0,
  };
}

/**
 * Maps wizard answers to a ClinicalInput-compatible object.
 * Handles all standard figures (1–8) plus Figure 9 (pregnant) and Figure 10 (abnormal vaginal bleeding).
 */
export function answersToInputFields(
  answers: Record<string, string>
): Record<string, unknown> {
  // MDM outcome: use pregnancy-specific step when patient is pregnant
  const mdmOutcome = answers.is_pregnant === "true"
    ? (answers.mdm_outcome_pregnant ?? answers.mdm_outcome ?? undefined)
    : (answers.mdm_outcome ?? undefined);
  const transitionHistory = answers.transition_prior_history ?? answers.prior_screening_history;
  const ag2ReportDate =
    answers.ag2_report_timing === "OLDER_THAN_3_YEARS"
      ? new Date(Date.now() - 4 * 365.25 * 24 * 60 * 60 * 1000)
      : answers.ag2_report_timing === "WITHIN_3_YEARS"
        ? new Date()
        : undefined;
  const initialBleedingWorkupComplete = answers.figure10_initial_workup_completed === "true";
  const colposcopicImpression = answers.colposcopic_impression ?? undefined;

  return {
    // Standard flags
    isFirstTimeHPVTransition:   answers.is_first_hpv_transition === "true",
    isPostHysterectomy:         answers.is_post_hysterectomy === "true" && answers.hysterectomy_type !== "SUBTOTAL",
    hysterectomyType:           answers.hysterectomy_type === "TOTAL" ? "TOTAL"
                              : answers.hysterectomy_type === "SUBTOTAL" ? "SUBTOTAL"
                              : undefined,
    screeningStatus:            answers.screening_status ?? undefined,
    priorScreeningHistory:      transitionHistory ?? undefined,
    screeningHistoryKnown:      transitionHistory === "NO_KNOWN_SCREENING_HISTORY" || answers.screening_status === "UNKNOWN" ? false
                              : transitionHistory ? true
                              : undefined,
    historySourceAvailable:     answers.history_source_available === "true" ? true
                              : answers.history_source_available === "false" ? false
                              : undefined,
    priorLowGradeResult:        transitionHistory === "LOW_GRADE_ONLY" || transitionHistory === "LOW_GRADE_RETURNED_TO_REGULAR" || transitionHistory === "LOW_GRADE_NOT_RETURNED_TO_REGULAR",
    priorHighGradeResult:       transitionHistory === "HIGH_GRADE_TOC_COMPLETE" || transitionHistory === "HIGH_GRADE_TOC_INCOMPLETE",
    previousHSILCIN23:          transitionHistory === "HIGH_GRADE_TOC_COMPLETE" || transitionHistory === "HIGH_GRADE_TOC_INCOMPLETE" || transitionHistory === "HSIL_AIS_UNTREATED_OR_INCOMPLETELY_TREATED",
    previousAIS:                transitionHistory === "PREVIOUS_AIS",
    previousAtypicalGlandularCells: transitionHistory === "PREVIOUS_ATYPICAL_GLANDULAR",
    previousAtypicalEndometrialCells: transitionHistory === "PREVIOUS_ATYPICAL_ENDOMETRIAL" || answers.atypical_endometrial_history === "true",
    ag2ReportDate,
    specialistDischargedToPrimaryCare: answers.specialist_discharged_to_primary_care === "true" ? true
                                    : answers.specialist_discharged_to_primary_care === "false" ? false
                                    : undefined,
    colposcopyRecommendedInLastCytology: answers.colposcopy_recommended_last_cytology === "true" ? true
                                      : answers.colposcopy_recommended_last_cytology === "false" ? false
                                      : undefined,
    colposcopyCompletedForLastRecommendation: answers.colposcopy_completed_last_recommendation === "true" ? true
                                           : answers.colposcopy_completed_last_recommendation === "false" ? false
                                           : undefined,
    atypicalEndometrialHistory: answers.atypical_endometrial_history === "true" || transitionHistory === "PREVIOUS_ATYPICAL_ENDOMETRIAL",
    immunocompromised:          answers.immunocompromised === "true",
    swabReturnVisitCompleted:   answers.swab_return_visit_completed === "true" ? true
                              : answers.swab_return_visit_completed === "false" ? false
                              : undefined,
    hysterectomyIndication:     answers.hysterectomy_indication ?? undefined,
    hysterectomySpecimenPathology: answers.hysterectomy_specimen_pathology ?? undefined,
    excisionStatus:             answers.excision_status ?? undefined,
    postHysterectomyHpvTestIndicated: answers.post_hysterectomy_hpv_test_indicated === "true" ? true
                                    : answers.post_hysterectomy_hpv_test_indicated === "false" ? false
                                    : undefined,
    repeatContext:              answers.repeat_context ?? (answers.is_test_of_cure === "true" ? "TEST_OF_CURE" : undefined),
    repeatStage:                answers.repeat_stage ?? undefined,
    testOfCureStage:            answers.test_of_cure_stage ?? undefined,

    // Figure 9: Pregnant participant
    isPregnant: answers.is_pregnant === "true" ? true
              : answers.is_pregnant === "false" ? false
              : undefined,
    postpartumReviewTiming: answers.postpartum_review_timing ?? undefined,

    // Figure 10: Abnormal vaginal bleeding
    hasAbnormalVaginalBleeding: answers.has_abnormal_vaginal_bleeding === "true" ? true
                              : answers.has_abnormal_vaginal_bleeding === "false" ? false
                              : undefined,
    abnormalBleedingStage: answers.abnormal_bleeding_stage ?? undefined,
    bleedingType: answers.bleeding_type ?? undefined,
    hasCancerSymptoms: answers.has_cancer_symptoms === "true" ? true
                     : answers.has_cancer_symptoms === "false" ? false
                     : undefined,
    menstrualHistoryCaptured: initialBleedingWorkupComplete ? true : undefined,
    contraceptiveHistoryCaptured: initialBleedingWorkupComplete ? true : undefined,
    sexualHistoryCaptured: initialBleedingWorkupComplete ? true : undefined,
    speculumExamCompleted: initialBleedingWorkupComplete ? true : undefined,
    pelvicExamCompleted: initialBleedingWorkupComplete ? true : undefined,
    coTestCompleted: initialBleedingWorkupComplete ? true : undefined,
    abnormalCervix: answers.abnormal_cervix === "true" ? true
                  : answers.abnormal_cervix === "false" ? false
                  : undefined,
    suspicionOfCancer: answers.suspicion_of_cancer === "true" ? true
                     : answers.suspicion_of_cancer === "false" ? false
                     : undefined,
    suspectOralContraceptiveProblem: answers.suspect_ocp_problem === "true" ? true
                                   : answers.suspect_ocp_problem === "false" ? false
                                   : undefined,
    oralContraceptiveAdjusted: answers.suspect_ocp_problem === "true" ? true : undefined,
    stiIdentified: answers.sti_identified === "true" ? true
                 : answers.sti_identified === "false" ? false
                 : undefined,
    stiTreated: answers.sti_identified === "true" ? true : undefined,
    bleedingResolved: answers.bleeding_resolved === "true" ? true
                    : answers.bleeding_resolved === "false" ? false
                    : undefined,

    // Test results
    sampleType:            answers.sample_type ?? undefined,
    hpvResult:             answers.hpv_result ?? undefined,
    cytologyResult:        answers.cytology_result ?? undefined,
    histologyResult:       answers.histology_result ?? undefined,
    biopsyResult:          answers.histology_result ?? undefined,
    tzType:                answers.tz_type ?? undefined,
    colposcopyTZType:      answers.tz_type ?? undefined,
    transformationZoneState: answers.transformation_zone_state ?? undefined,
    visibleLesion:         answers.visible_lesion === "true" ? true
                          : answers.visible_lesion === "false" ? false
                          : undefined,
    normalColposcopy:      colposcopicImpression === "NORMAL" ? true : undefined,
    colposcopicImpression,

    // Session context
    isTestOfCure: answers.is_test_of_cure === "true",
    mdmOutcome,
  };
}
