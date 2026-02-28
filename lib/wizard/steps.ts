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
const a = (answers: Record<string, string>) => answers;

// ─── Step Definitions ─────────────────────────────────────────────────────────

export const WIZARD_STEPS: WizardStep[] = [
  // ── Step 0: Patient context info card (always shown, no answer required) ────
  {
    id: "patient_context",
    question: "Review patient details",
    type: "info",
    isVisible: always,
  },

  // ── Step 1: Post-hysterectomy flag ────────────────────────────────────────
  {
    id: "is_post_hysterectomy",
    question: "Has this patient had a hysterectomy?",
    hint: "Post-hysterectomy patients follow the vault screening pathway (Figure 8).",
    type: "boolean-cards",
    options: [
      { value: "true",  label: "Yes — hysterectomy performed", hint: "Routes to vault screening pathway (Figure 8)" },
      { value: "false", label: "No — uterus intact", hint: "Continue with standard screening pathway" },
    ],
    isVisible: always,
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
    isVisible: (ans) => ans.is_post_hysterectomy === "false",
  },

  // ── Step 2: First-time HPV transition flag ────────────────────────────────
  {
    id: "is_first_hpv_transition",
    question: "Is this the patient's first HPV-based test after previous cytology-based screening?",
    hint: "Module A applies when a patient is transitioning from the old cytology programme to HPV primary screening. This routes to Figures 1 or 2.",
    type: "boolean-cards",
    options: [
      { value: "true",  label: "Yes — first HPV test (transitioning from cytology)", hint: "Routes to Figure 1 or 2 (Module A)" },
      { value: "false", label: "No — already on HPV primary screening", hint: "Routes to Figures 3–10" },
    ],
    isVisible: (ans) => ans.is_post_hysterectomy === "false",
  },

  // ── Step 2b: Abnormal vaginal bleeding (Figure 10 entry) ─────────────────
  {
    id: "has_abnormal_vaginal_bleeding",
    question: "Does this patient have abnormal vaginal bleeding (inter-menstrual or post-coital)?",
    hint: "Abnormal vaginal bleeding is investigated via Figure 10. Important: refer for gynaecological assessment without delay if there are signs or symptoms of cervical cancer.",
    type: "boolean-cards",
    options: [
      { value: "true",  label: "Yes — abnormal vaginal bleeding present", hint: "Routes to Figure 10 investigation pathway", cautionTag: "Figure 10" },
      { value: "false", label: "No — no abnormal vaginal bleeding", hint: "Continue with standard screening pathway" },
    ],
    isVisible: (ans) =>
      ans.is_post_hysterectomy === "false" &&
      ans.is_first_hpv_transition === "false",
  },

  // ── Step 2c: Abnormal cervix (Figure 10) ─────────────────────────────────
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

  // ── Step 2d: Suspicion of cancer (Figure 10, abnormal cervix) ────────────
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
      ans.abnormal_cervix === "true",
  },

  // ── Step 2e: Suspect OCP problem (Figure 10, normal cervix) ─────────────
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
      ans.abnormal_cervix === "false",
  },

  // ── Step 2f: STI identified (Figure 10, normal cervix, no OCP) ───────────
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
      ans.abnormal_cervix === "false" &&
      ans.suspect_ocp_problem === "false",
  },

  // ── Step 2g: Bleeding resolved (Figure 10 follow-up review) ─────────────
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
      (
        // Abnormal cervix, no cancer suspicion path
        (ans.abnormal_cervix === "true" && ans.suspicion_of_cancer === "false") ||
        // Normal cervix, OCP path
        (ans.abnormal_cervix === "false" && ans.suspect_ocp_problem === "true") ||
        // Normal cervix, STI or no-STI path
        (ans.abnormal_cervix === "false" && ans.suspect_ocp_problem === "false")
      ),
  },

  // ── Step 3: Atypical endometrial history (AG2 routing) ────────────────────
  {
    id: "atypical_endometrial_history",
    question: "Does this patient have a history of atypical endometrial cells (AG2)?",
    hint: "Patients with atypical endometrial history are routed to Figure 2 (previously abnormal cytology pathway) and may require direct gynaecology referral.",
    type: "boolean-cards",
    options: [
      { value: "true",  label: "Yes — previous AG2 / atypical endometrial cells", hint: "Routes to Figure 2", cautionTag: "High attention" },
      { value: "false", label: "No — no atypical endometrial history", hint: "Routes to Figure 1" },
    ],
    isVisible: (ans) =>
      ans.is_post_hysterectomy === "false" &&
      ans.is_first_hpv_transition === "true",
  },

  // ── Step 4: Sample type ───────────────────────────────────────────────────
  {
    id: "sample_type",
    question: "What sample type was used for this test?",
    hint: "Self-collected swabs (SWAB) require a return visit with clinical examination before cytology results can be interpreted per Figure 3 guidance.",
    type: "option-cards",
    options: [
      { value: "LBC",  label: "LBC — Liquid Based Cytology", hint: "Clinician-collected cervical sample" },
      { value: "SWAB", label: "SWAB — Self-collected vaginal swab", hint: "Requires clinical review if cytology needed", cautionTag: "Clinical review required" },
    ],
    isVisible: (ans) =>
      ans.is_post_hysterectomy === "false" &&
      ans.has_abnormal_vaginal_bleeding !== "true",
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
    isVisible: (ans) => ans.has_abnormal_vaginal_bleeding !== "true",
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
      { value: "AG1",            label: "AG1 — Low-grade glandular",hint: "Atypical glandular cells, low-grade" },
      { value: "AG2",            label: "AG2 — Endometrial",       hint: "Atypical endometrial cells — direct gynaecology referral", cautionTag: "Gynaecology" },
      { value: "AG3",            label: "AG3",                     hint: "Atypical glandular cells, high-grade", cautionTag: "High-grade" },
      { value: "AG4",            label: "AG4 — AIS",               hint: "Adenocarcinoma in situ", cautionTag: "Urgent" },
      { value: "AG5",            label: "AG5 — Invasive",          hint: "Invasive adenocarcinoma", cautionTag: "Urgent" },
      { value: "AC1",            label: "AC1 — Low-grade",         hint: "Adenocarcinoma cells, low-grade" },
      { value: "AC2",            label: "AC2",                     hint: "Adenocarcinoma cells, high-grade", cautionTag: "High-grade" },
      { value: "AC3",            label: "AC3 — AIS",               hint: "Adenocarcinoma in situ", cautionTag: "Urgent" },
      { value: "AC4",            label: "AC4 — Invasive",          hint: "Invasive adenocarcinoma", cautionTag: "Urgent" },
      { value: "UNSATISFACTORY", label: "Unsatisfactory",          hint: "Sample inadequate — 3-month repeat" },
    ],
    isVisible: (ans) =>
      ans.has_abnormal_vaginal_bleeding !== "true" &&
      (
        ans.hpv_result === "HPV_OTHER" ||
        ans.is_first_hpv_transition === "false"
      ),
  },

  // ── Step 6b: Pregnant participant? (Figure 9 entry) ───────────────────────
  // Only visible when cytology is high-grade and patient is not post-hysterectomy
  {
    id: "is_pregnant",
    question: "Is this patient currently pregnant?",
    hint: "Pregnant participants with high-grade cytology (ASC-H, HSIL, atypical glandular cells, AIS) are managed via Figure 9 — a special pregnancy pathway. Treatment is deferred and MDM review is required.",
    type: "boolean-cards",
    options: [
      { value: "true",  label: "Yes — patient is pregnant", hint: "Routes to Figure 9 — pregnant participant pathway", cautionTag: "Figure 9" },
      { value: "false", label: "No — patient is not pregnant", hint: "Continue with standard pathway" },
    ],
    isVisible: (ans) => {
      if (ans.is_post_hysterectomy === "true") return false;
      if (ans.has_abnormal_vaginal_bleeding === "true") return false;
      const highGradeCytology = ["ASC_H", "HSIL", "SCC", "AG3", "AG4", "AG5", "AC2", "AC3", "AC4"];
      return highGradeCytology.includes(ans.cytology_result ?? "") ||
             ans.hpv_result === "HPV_16_18"; // HPV 16/18 is high-risk
    },
  },

  // ── Step 6c: Pregnant MDM outcome (Figure 9 — Normal TZ path) ────────────
  {
    id: "mdm_outcome_pregnant",
    question: "What was the MDM (Multidisciplinary Meeting) outcome for this pregnant participant?",
    hint: "In the Normal TZ (no visible lesion) pathway for pregnant participants, MDM review determines whether cytology was downgraded or high-grade status was confirmed.",
    type: "option-cards",
    options: [
      { value: "DOWNGRADED_NEGATIVE",    label: "Downgraded to negative",            hint: "Return to Figure 3 HPV primary screening pathway" },
      { value: "DOWNGRADED_LSIL",        label: "Downgraded to LSIL / ASC-US",       hint: "Manage as LSIL — follow LSIL pathway" },
      { value: "CONFIRMED_HIGH_GRADE",   label: "Confirmed possible/definite high-grade", hint: "Colposcopy review in 6 months or 6–12 weeks postpartum", cautionTag: "Defer treatment" },
    ],
    isVisible: (ans) =>
      ans.is_pregnant === "true" &&
      (ans.colposcopic_impression === "NORMAL" || !ans.colposcopic_impression),
  },

  // ── Step 7: Is this a Test of Cure follow-up? ─────────────────────────────
  {
    id: "is_test_of_cure",
    question: "Is this a Test of Cure follow-up after previous CIN treatment?",
    hint: "Test of Cure applies after treatment for CIN2/CIN3. Two consecutive HPV-negative co-tests are required for discharge to routine recall (Figure 6).",
    type: "boolean-cards",
    options: [
      { value: "true",  label: "Yes — post-treatment Test of Cure", hint: "Routes to Figure 6" },
      { value: "false", label: "No — routine or post-abnormal screening", hint: "Routes to Figures 3, 7 or further assessment" },
    ],
    isVisible: (ans) =>
      ans.is_post_hysterectomy === "false" &&
      ans.is_first_hpv_transition === "false" &&
      ans.has_abnormal_vaginal_bleeding !== "true" &&
      ans.is_pregnant !== "true",
  },

  // ── Step 8: Colposcopy context — entering colposcopy findings ─────────────
  {
    id: "has_colposcopy_findings",
    question: "Are you entering colposcopy findings for this patient?",
    hint: "Select Yes if the patient has attended a colposcopy appointment and results are available (routes to Figures 4 or 5, or Figure 9 for pregnant patients).",
    type: "boolean-cards",
    options: [
      { value: "true",  label: "Yes — entering colposcopy findings", hint: "Routes to Figure 4, 5 or 9" },
      { value: "false", label: "No — HPV/cytology results only",      hint: "Routes based on Figure 3 logic" },
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
    hint: "TZ Type 3 (fully endocervical) has exception pathways — Figure 4 routes to 12-month co-test instead of routine recall, and Figure 5 requires MDM review for excision guidance.",
    type: "option-cards",
    options: [
      { value: "TYPE1", label: "TZ Type 1 — Fully ectocervical",     hint: "Entire squamocolumnar junction visible" },
      { value: "TYPE2", label: "TZ Type 2 — Partly endocervical",    hint: "Part of junction in endocervical canal" },
      { value: "TYPE3", label: "TZ Type 3 — Fully endocervical",     hint: "Junction entirely in canal — exception rules apply", cautionTag: "TZ3 exception" },
    ],
    isVisible: (ans) => ans.has_colposcopy_findings === "true",
  },

  // ── Step 10: Colposcopic impression ──────────────────────────────────────
  {
    id: "colposcopic_impression",
    question: "What is the colposcopic impression?",
    hint: "The colposcopist's overall assessment. HSIL impression or worse escalates to Figure 5 for high-grade management.",
    type: "option-cards",
    options: [
      { value: "NORMAL",         label: "Normal",                   hint: "No acetowhite change or abnormality detected" },
      { value: "LSIL",           label: "LSIL impression",          hint: "Low-grade changes — biopsy recommended" },
      { value: "HSIL",           label: "HSIL impression",          hint: "High-grade changes — treatment likely required", cautionTag: "High-grade" },
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
    hint: "MDM review is required for AIS, invasive disease, and TZ Type 3 with CIN2/3. Enter the MDM decision to determine subsequent management.",
    type: "option-cards",
    options: [
      { value: "EXCISION",      label: "Excision recommended",         hint: "LLETZ or cold-knife cone biopsy" },
      { value: "ABLATION",      label: "Ablation recommended",         hint: "Laser ablation or cryotherapy" },
      { value: "HYSTERECTOMY",  label: "Hysterectomy recommended",     hint: "For AIS or recurrent high-grade disease" },
      { value: "SURVEILLANCE",  label: "Surveillance only",            hint: "Close monitoring without immediate treatment" },
      { value: "REFERRAL",      label: "Specialist referral required", hint: "Gynaecological oncology referral" },
    ],
    isVisible: (ans) =>
      ans.has_colposcopy_findings === "true" &&
      ans.biopsy_taken === "true" &&
      (ans.histology_result === "AIS" ||
        ans.histology_result === "SCC" ||
        ans.histology_result === "ADENOCARCINOMA" ||
        ans.colposcopic_impression === "INVASION"),
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

  return {
    // Standard flags
    isFirstTimeHPVTransition:   answers.is_first_hpv_transition === "true",
    isPostHysterectomy:         answers.is_post_hysterectomy === "true",
    atypicalEndometrialHistory: answers.atypical_endometrial_history === "true",
    immunocompromised:          answers.immunocompromised === "true",

    // Figure 9: Pregnant participant
    isPregnant: answers.is_pregnant === "true" ? true
              : answers.is_pregnant === "false" ? false
              : undefined,

    // Figure 10: Abnormal vaginal bleeding
    hasAbnormalVaginalBleeding: answers.has_abnormal_vaginal_bleeding === "true" ? true
                              : answers.has_abnormal_vaginal_bleeding === "false" ? false
                              : undefined,
    abnormalCervix: answers.abnormal_cervix === "true" ? true
                  : answers.abnormal_cervix === "false" ? false
                  : undefined,
    suspicionOfCancer: answers.suspicion_of_cancer === "true" ? true
                     : answers.suspicion_of_cancer === "false" ? false
                     : undefined,
    suspectOralContraceptiveProblem: answers.suspect_ocp_problem === "true" ? true
                                   : answers.suspect_ocp_problem === "false" ? false
                                   : undefined,
    stiIdentified: answers.sti_identified === "true" ? true
                 : answers.sti_identified === "false" ? false
                 : undefined,
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
    colposcopicImpression: answers.colposcopic_impression ?? undefined,

    // Session context
    isTestOfCure: answers.is_test_of_cure === "true",
    mdmOutcome,
  };
}
