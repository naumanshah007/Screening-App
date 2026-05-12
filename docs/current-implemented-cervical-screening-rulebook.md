# Current Implemented Cervical Screening Rulebook

Implementation rulebook for clinical review only - not an approved clinical protocol.

Last extracted from code on 2026-05-13 NZST.

Primary source of truth in code:
- Wizard questions, visibility, pruning, and mapping: `lib/wizard/steps.ts`
- Wizard answer persistence and consent audit: `app/api/pathway/sessions/[id]/answer/route.ts`
- Wizard completion, `ClinicalInput`, persistence, and final audit: `app/api/pathway/sessions/[id]/complete/route.ts`
- Deterministic engine: `lib/engine/decision-engine.ts`
- Engine input/output types: `lib/engine/types.ts`
- Visual summaries: `lib/decision-trees/index.ts`
- Persistence schema: `prisma/schema.prisma`
- Current regression coverage: `lib/engine/__tests__/*.test.ts`

## 1. Document Status And Safety Notice

This document describes the exact implemented behaviour currently present in the app. It is not clinical approval, not a clinical protocol, and not a substitute for NCSP, Healthcare Pathways, local policy, or specialist judgement.

The clinical decision output is deterministic rule logic. The implementation does not use generative AI to select the clinical pathway. The engine output from `evaluateClinicalDecision()` in `lib/engine/decision-engine.ts` is the source of truth for recommendation code, figure/table, risk level, recall/referral flags, and next action.

The visual decision-tree diagrams in `lib/decision-trees/index.ts` are simplified and non-authoritative. Each exported figure has the subtitle `Under validation: simplified visual; rule output is source of truth`. Some diagram node labels/codes are legacy simplified labels and do not always match the current engine recommendation codes.

Out-of-demo UI options are sometimes still supported by backend enums or engine types but hidden from active wizard options. Examples: HPV `INADEQUATE` and cytology/histology `UNSATISFACTORY` remain in types/schema, but current active wizard result options hide HPV "Inadequate / Repeat required" and cytology "Unsatisfactory".

## 2. Current High-Level Product Flow

### Step 1 - Entry pathway selection

Source: `WIZARD_STEPS` in `lib/wizard/steps.ts`, `pathway_entry`.

The first active wizard question is:

`How is this patient entering the cervical screening workflow?`

Options:
- `DIRECT_HPV`: Direct HPV / Molecular Screening Pathway
- `CLINICAL_CARE`: GP / Routine Clinical Care / Specialist Pathway

The Direct HPV / Molecular Screening option is visually primary in the wizard page (`app/(app)/pathway/[sessionId]/page.tsx`).

### Step 2 - Consent confirmation hard gate

Source: `consent_confirmed` in `lib/wizard/steps.ts`; UI rendering in `app/(app)/pathway/[sessionId]/page.tsx`; server rejection in `app/api/pathway/sessions/[id]/complete/route.ts`.

The second active wizard question is:

`Confirm patient consent`

Consent is a mandatory checkbox with this option:

`I confirm the patient has been informed and has provided verbal or written consent.`

Current behaviour:
- No clinical questions are visible until a pathway entry is selected and consent is confirmed.
- There is no visible "No - consent not confirmed" option.
- The UI disables progression until the checkbox is selected.
- Completion rejects without consent: HTTP 409 with `Consent is required before data entry can continue.`
- Confirmed consent is audited as `CONSENT_CONFIRMED`.

### After Direct HPV / Molecular Screening

Direct HPV proceeds to:
1. Immunocompromised status.
2. Sample type (`LBC` or `SWAB`).
3. HPV result.
4. For HPV Other only, the swab return visit and cytology dependent pathway may apply.
5. HPV 16/18 completes directly to colposcopy without cytology.

Direct HPV does not show hysterectomy, transition-history, abnormal bleeding, or clinical-care history questions before the primary HPV result flow.

### After GP / Routine Clinical Care / Specialist

GP/clinical proceeds to:
1. Hysterectomy status and Table 1/Figure 8 fields where applicable.
2. Immunocompromised status where cervix remains/uterus intact.
3. First HPV transition and previous history questions.
4. Abnormal vaginal bleeding questions.
5. Sample/HPV/cytology.
6. Pregnancy, Test of Cure, repeat context/stage, colposcopy, glandular, MDM, biopsy, and related downstream fields where visible.

## 3. Entry Pathway Branch Rules

### 3.1 Direct HPV / Molecular Screening Pathway

Source: `pathway_entry`, `sample_type`, `hpv_result`, `swab_return_visit_completed`, `cytology_result` in `lib/wizard/steps.ts`; `answersToInputFields()`; `evaluateFigure3()` in `lib/engine/decision-engine.ts`.

Intended current context: NCSP, self-collected samples, lab HPV testing, direct cervical screening, or patients not coming through GP.

Required gate:
- `pathway_entry = DIRECT_HPV`
- `consent_confirmed = true`

Current wizard path:
- `immunocompromised`
- `sample_type`
- `hpv_result`
- `swab_return_visit_completed` only when `sample_type = SWAB` and `hpv_result = HPV_OTHER`
- `cytology_result` only when HPV Other or specialist follow-up contexts require cytology; it is not shown after HPV 16/18 in the direct HPV path.

Current Direct HPV engine rules:
- HPV not detected: `F3-HPV-NOT-DETECTED-5Y`, or `F3-HPV-NOT-DETECTED-IC-3Y` if immunocompromised.
- HPV 16/18: `F3-1618-COLP` without requiring cytology. This applies with `LBC`, `SWAB`, no cytology, and stale swab-return answers pruned.
- HPV 16/18 plus high-grade cytology if cytology is supplied in a non-hidden context: `F3-1618-HIGH-GRADE-COLP`.
- HPV Other plus SWAB without return visit: `F3-SWAB-RETURN-REQUIRED`.
- HPV Other without cytology when cytology is required: `F3-HPV-OTHER-CYTOLOGY-REQUIRED`.
- HPV Other plus negative/ASC-US/LSIL cytology at baseline: `F3-HPV-OTHER-NEG-ASCUS-LSIL-12M`.
- HPV Other plus high-grade cytology: `F3-HPV-OTHER-HIGH-GRADE-COLP`.
- First repeat HPV Other plus low-grade cytology: age >= 50 -> `F3-FIRST-REPEAT-AGE50-COLP`; age < 50 -> `F3-FIRST-REPEAT-UNDER50-SECOND-REPEAT`.
- Second repeat HPV detected any type: `F3-SECOND-REPEAT-HPV-DETECTED-COLP`.

Audit events relevant to Direct HPV:
- `NEW_ASSESSMENT_STARTED`
- `PREVIOUS_SESSION_NOT_IMPORTED` or `PREVIOUS_SESSION_IMPORTED`
- `CONSENT_CONFIRMED`
- `WIZARD_COMPLETE`
- `FINAL_RECOMMENDATION_GENERATED`

### 3.2 GP / Routine Clinical Care / Specialist Pathway

Source: `pathway_entry = CLINICAL_CARE` in `lib/wizard/steps.ts`; engine routing in `evaluateClinicalDecision()`.

Intended current context: GP-led care, routine clinical care, abnormal bleeding, symptoms, complex history, or specialist clinic entry.

Required gate:
- `pathway_entry = CLINICAL_CARE`
- `consent_confirmed = true`

Reachable current rule areas:
- Figure 1 transition invitation.
- Figure 2 previous high-grade/AIS/glandular/atypical endometrial history.
- Figure 3 primary HPV screening.
- Figure 4 post-normal colposcopy after low-grade cytology.
- Figure 5 post-normal colposcopy after high-grade cytology.
- Figure 6 Test of Cure.
- Figure 7 glandular abnormalities.
- Figure 8/Table 1 total hysterectomy/vaginal screening after hysterectomy.
- Figure 9 pregnancy with qualifying cytology.
- Figure 10 abnormal vaginal bleeding.
- Routine age gates for under 25, 70-74, and 75+ after higher-priority symptomatic/special routes.

GP/clinical branch uses current wizard answers and explicitly prunes hidden branch answers before completion. Clean new sessions do not inherit previous recommendation code, previous answer maps, repeat context, test-of-cure stage, pregnancy, bleeding, hysterectomy, or colposcopy fields.

## 4. Exact Wizard Questions And Visible Options

Source: `WIZARD_STEPS` in `lib/wizard/steps.ts`. Conditions are summarized in business terms; the exact boolean predicates are in the source.

Notes:
- Active `hpv_result` options are `NOT_DETECTED`, `HPV_16_18`, and `HPV_OTHER`. `INADEQUATE` is hidden from the active wizard.
- Active `cytology_result` options do not include `UNSATISFACTORY`. Backend types/schema still support it.
- Cytology is hidden after HPV 16/18 in the current wizard path. Operationally this is the implemented "N/A - not required" behaviour for HPV 16/18 routing; no explicit N/A option is displayed.
- HPV Other still requires cytology when not blocked by the SWAB return-visit branch.

| Question ID | Exact question text | Visible options | Hidden/removed options | Visibility condition | Mapped ClinicalInput field | Branch |
|---|---|---|---|---|---|---|
| `patient_context` | Review patient details | Info only | None | Always | None | Both |
| `pathway_entry` | How is this patient entering the cervical screening workflow? | `DIRECT_HPV`, `CLINICAL_CARE` | None | Always | Not mapped to engine; controls wizard visibility | Both |
| `consent_confirmed` | Confirm patient consent | `true` checkbox | No false option | After pathway entry | Server gate only; not mapped to engine | Both |
| `is_post_hysterectomy` | Has this patient had a hysterectomy? | `true`, `false` | None | Consent confirmed + clinical care | `isPostHysterectomy` | GP/clinical |
| `hysterectomy_type` | What type of hysterectomy did the patient have? | `TOTAL`, `SUBTOTAL` | None | Hysterectomy yes | `hysterectomyType`; subtotal maps `isPostHysterectomy=false` | GP/clinical |
| `prior_screening_history` | What prior screening history applies for this total hysterectomy pathway? | `NEGATIVE_OR_NORMAL`, `LOW_GRADE_RETURNED_TO_REGULAR`, `LOW_GRADE_NOT_RETURNED_TO_REGULAR`, `HIGH_GRADE_TOC_COMPLETE`, `HSIL_AIS_UNTREATED_OR_INCOMPLETELY_TREATED`, `HIGH_GRADE_TOC_INCOMPLETE`, `PREVIOUS_ATYPICAL_GLANDULAR`, `NO_KNOWN_SCREENING_HISTORY` | None | Total hysterectomy | `priorScreeningHistory` | GP/clinical |
| `hysterectomy_indication` | What was the indication for hysterectomy? | `BENIGN_GYNAECOLOGICAL_DISEASE`, `HSIL_CIN23_OR_AIS` | None | Total hysterectomy | `hysterectomyIndication` | GP/clinical |
| `hysterectomy_specimen_pathology` | What cervical pathology was found in the hysterectomy specimen? | `NO_CERVICAL_PATHOLOGY`, `LSIL_CIN1`, `HSIL_CIN23`, `AIS` | None | Total hysterectomy | `hysterectomySpecimenPathology` | GP/clinical |
| `excision_status` | Was HSIL/CIN2/3 or AIS completely excised? | `COMPLETE`, `INCOMPLETE`, `UNKNOWN` | None | Total hysterectomy + HSIL/AIS specimen | `excisionStatus` | GP/clinical |
| `post_hysterectomy_hpv_test_indicated` | Are you entering a post-hysterectomy HPV test result now? | `true`, `false` | None | Total hysterectomy | `postHysterectomyHpvTestIndicated` | GP/clinical |
| `immunocompromised` | Is this patient immunocompromised? | `true`, `false` | None | Consent confirmed and direct HPV, uterus intact, or subtotal hysterectomy | `immunocompromised` | Both |
| `is_first_hpv_transition` | Is this the patient's first HPV-based test after previous cytology-based screening? | `true`, `false` | None | Consent confirmed + clinical care + cervix present | `isFirstTimeHPVTransition` | GP/clinical |
| `screening_status` | What screening status applies for this transition decision? | `NEVER_SCREENED`, `UNDER_SCREENED`, `OVERDUE`, `REGULAR_SCREENING`, `UNKNOWN` | None | First HPV transition | `screeningStatus` | GP/clinical |
| `transition_prior_history` | Which prior result category applies for the transition? | `NEGATIVE_OR_NORMAL`, `LOW_GRADE_ONLY`, `LOW_GRADE_RETURNED_TO_REGULAR`, `HIGH_GRADE_TOC_COMPLETE`, `HIGH_GRADE_TOC_INCOMPLETE`, `PREVIOUS_AIS`, `PREVIOUS_ATYPICAL_GLANDULAR`, `PREVIOUS_ATYPICAL_ENDOMETRIAL`, `UNKNOWN` | None | First HPV transition | `priorScreeningHistory` and derived history booleans | GP/clinical |
| `history_source_available` | Is the previous screening/history source available and reliable? | `true`, `false` | None | First HPV transition and no prior history answer | `historySourceAvailable` | GP/clinical |
| `colposcopy_recommended_last_cytology` | Did the last cytology report recommend colposcopy? | `true`, `false` | None | First HPV transition + high-grade incomplete ToC or previous atypical glandular | `colposcopyRecommendedInLastCytology` | GP/clinical |
| `colposcopy_completed_last_recommendation` | Has that recommended colposcopy already occurred? | `true`, `false` | None | Last cytology recommended colposcopy | `colposcopyCompletedForLastRecommendation` | GP/clinical |
| `ag2_report_timing` | For previous AG2/atypical endometrial cells, when was the report? | `OLDER_THAN_3_YEARS`, `WITHIN_3_YEARS`, `UNKNOWN` | None | Previous atypical endometrial history | `ag2ReportDate` derived | GP/clinical |
| `specialist_discharged_to_primary_care` | Has the patient already been seen by specialist services and discharged to primary care? | `true`, `false` | None | Previous atypical endometrial history unless report older than 3 years | `specialistDischargedToPrimaryCare` | GP/clinical |
| `returned_to_3_yearly_cytology_screening` | Has the patient returned to 3-yearly cytology screening after previous atypical endometrial cells? | `true`, `false`, `unknown` | None | Previous atypical endometrial history, not older than 3 years, not discharged | `returnedTo3YearlyCytologyScreening` | GP/clinical |
| `has_abnormal_vaginal_bleeding` | Does this patient have abnormal vaginal bleeding (inter-menstrual or post-coital)? | `true`, `false` | None | Clinical care, not transition, not post-hysterectomy | `hasAbnormalVaginalBleeding` | GP/clinical |
| `abnormal_bleeding_stage` | Which abnormal bleeding review stage is this? | `INITIAL_ASSESSMENT`, `SIX_TO_EIGHT_WEEK_REVIEW` | None | Abnormal bleeding yes | `abnormalBleedingStage` | GP/clinical |
| `has_cancer_symptoms` | Are there signs or symptoms of cervical cancer? | `true`, `false` | None | Abnormal bleeding initial assessment | `hasCancerSymptoms` | GP/clinical |
| `figure10_initial_workup_completed` | Have history, speculum exam, pelvic exam and co-test been completed or arranged? | `true`, `false` | None | Abnormal bleeding initial assessment without cancer symptoms | Maps menstrual/contraceptive/sexual/speculum/pelvic/coTest booleans | GP/clinical |
| `figure10_cotest_result_available` | Is the abnormal bleeding co-test result available to record now? | `true`, `false` | None | Abnormal bleeding initial workup complete | Controls sample/HPV/cytology visibility | GP/clinical |
| `bleeding_type` | What abnormal bleeding pattern is present? | `INTER_MENSTRUAL`, `POST_COITAL`, `BOTH`, `UNSPECIFIED` | None | Abnormal bleeding initial, workup complete, no cancer symptoms | `bleedingType` | GP/clinical |
| `abnormal_cervix` | Is the cervix abnormal on speculum and pelvic examination? | `true`, `false` | None | Abnormal bleeding | `abnormalCervix` | GP/clinical |
| `suspicion_of_cancer` | Is there clinical suspicion of cervical cancer? | `true`, `false` | None | Abnormal cervix in initial bleeding pathway | `suspicionOfCancer` | GP/clinical |
| `suspect_ocp_problem` | Is an oral contraceptive pill (OCP) problem suspected as the cause? | `true`, `false` | None | Normal cervix, no cancer symptoms | `suspectOralContraceptiveProblem`, `oralContraceptiveAdjusted` | GP/clinical |
| `sti_identified` | Has an STI been identified on investigation? | `true`, `false` | None | Normal cervix + no OCP issue | `stiIdentified`, `stiTreated` | GP/clinical |
| `bleeding_resolved` | Has the bleeding resolved at the 6-8 week follow-up review? | `true`, `false` | None | Abnormal bleeding 6-8 week review | `bleedingResolved` | GP/clinical |
| `atypical_endometrial_history` | Does this patient have a history of atypical endometrial cells (AG2)? | `true`, `false` | None | First HPV transition | `atypicalEndometrialHistory` | GP/clinical |
| `sample_type` | What sample type was used for this test? | `LBC`, `SWAB` | None | Consent confirmed and direct HPV or current result entry context | `sampleType` | Both |
| `swab_return_visit_completed` | Has the patient returned for a clinical examination following the self-collected swab? | `true`, `false` | Hidden after HPV 16/18 | `sample_type=SWAB` and `hpv_result=HPV_OTHER` | `swabReturnVisitCompleted` | Both |
| `hpv_result` | What was the HPV test result? | `NOT_DETECTED`, `HPV_16_18`, `HPV_OTHER` | `INADEQUATE` hidden | Current test result context | `hpvResult` | Both |
| `cytology_result` | What was the cytology result? | `NEGATIVE`, `ASC_US`, `LSIL`, `ASC_H`, `HSIL`, `SCC`, `AIS`, `AG1`, `AG2`, `AG3`, `AG4`, `AG5`, `AC1`, `AC2`, `AC3`, `AC4` | `UNSATISFACTORY` hidden; no explicit N/A option; hidden after HPV16/18 where not required | HPV Other or Test of Cure or high-grade post-colposcopy contexts | `cytologyResult` | Both where visible |
| `is_pregnant` | Is this patient currently pregnant? | `true`, `false` | None | Qualifying high-grade/glandular/AIS cytology, not post-hysterectomy or bleeding | `isPregnant` | GP/clinical |
| `mdm_outcome_pregnant` | What was the MDM (Multidisciplinary Meeting) outcome for this pregnant participant? | `DOWNGRADED_NEGATIVE`, `DOWNGRADED_LSIL`, `CONFIRMED_HIGH_GRADE` | None | Pregnant + colposcopy findings + normal TZ/no lesion | `mdmOutcome` | GP/clinical |
| `is_test_of_cure` | Is this a Test of Cure follow-up after previous CIN treatment? | `true`, `false` | None | Clinical care, not bleeding, not pregnant, cervix present | `isTestOfCure` | GP/clinical |
| `repeat_context` | What repeat/follow-up context applies to this result? | `PRIMARY_HPV`, `POST_NORMAL_COLPOSCOPY_LOW_GRADE_CYTOLOGY`, `POST_NORMAL_COLPOSCOPY_HIGH_GRADE_CYTOLOGY`, `TEST_OF_CURE` | None | Clinical care, not bleeding, not pregnant, cervix present | `repeatContext` | GP/clinical |
| `repeat_stage` | Is this a baseline, first repeat, or second repeat result? | `BASELINE`, `FIRST_REPEAT`, `SECOND_REPEAT` | None | Clinical care, not bleeding/pregnant; not high-grade post-colposcopy context | `repeatStage` | GP/clinical |
| `test_of_cure_stage` | Which Test of Cure stage is this? | `FIRST_TEST`, `SECOND_TEST`, `CONTINUING` | None | `is_test_of_cure=true` or repeat context Test of Cure | `testOfCureStage` | GP/clinical |
| `has_colposcopy_findings` | Are you entering colposcopy findings for this patient? | `true`, `false` | None | Clinical care path or pregnant path | Controls colposcopy persistence and next questions | GP/clinical |
| `tz_type` | What is the Transformation Zone (TZ) type? | `TYPE1`, `TYPE2`, `TYPE3` | None | Colposcopy findings | `tzType`, `colposcopyTZType` | GP/clinical |
| `transformation_zone_state` | Is the transformation zone normal or abnormal? | `NORMAL`, `ABNORMAL` | None | Colposcopy findings + pregnant | `transformationZoneState` | GP/clinical |
| `visible_lesion` | Is there a visible lesion at colposcopy? | `true`, `false` | None | High-grade post-colposcopy, pregnancy, or glandular contexts | `visibleLesion` | GP/clinical |
| `colposcopic_impression` | What is the colposcopic impression? | `NORMAL`, `LSIL`, `HSIL`, `AIS`, `INVASION`, `UNSATISFACTORY` | None | Colposcopy findings | `colposcopicImpression`, `normalColposcopy` derived | GP/clinical |
| `biopsy_taken` | Was a biopsy taken during colposcopy? | `true`, `false` | None | Colposcopy findings and impression not unsatisfactory | Controls histology | GP/clinical |
| `histology_result` | What was the histology result? | `NORMAL`, `CIN1`, `CIN2`, `CIN3`, `AIS`, `SCC`, `ADENOCARCINOMA`, `UNSATISFACTORY` | None | Biopsy taken | `histologyResult`, `biopsyResult` | GP/clinical |
| `mdm_outcome` | What was the MDM (Multidisciplinary Meeting) outcome? | `DOWNGRADED_NEGATIVE`, `DOWNGRADED_ASC_US_LSIL`, `DOWNGRADED_LSIL`, `UPGRADED_HSIL`, `CONFIRMED_ASC_H`, `CONFIRMED_HIGH_GRADE`, `CYTOLOGY_CONFIRMED_NOT_AG2`, `AG2_CYTOLOGY_CONFIRMED`, `CYTOLOGY_NOT_CONFIRMED`, `EXCISION`, `ABLATION`, `HYSTERECTOMY`, `SURVEILLANCE`, `REFERRAL` | None | Colposcopy + high-grade/glandular/AIS/cancer/no lesion contexts | `mdmOutcome` | GP/clinical |

## 5. Current ClinicalInput Mapping

Source: `answersToInputFields()` in `lib/wizard/steps.ts`; completion defaults in `app/api/pathway/sessions/[id]/complete/route.ts`.

| Wizard answer ID | ClinicalInput field | Type | Used by figure/rule | Notes |
|---|---|---|---|---|
| `pathway_entry` | None | string | Wizard visibility only | `DIRECT_HPV` or `CLINICAL_CARE`; not passed to engine |
| `consent_confirmed` | None | boolean-like string | Completion gate | Required by completion route; not in `ClinicalInput` |
| Patient DOB | `patientAge` | number | Age gates; Figure 3 first repeat age >= 50; Figure 10 age-25 wording | Computed in completion route |
| `sample_type` | `sampleType` | `LBC`/`SWAB` | Figure 3, persistence | Stored in `TestResult.sampleType` |
| `swab_return_visit_completed` | `swabReturnVisitCompleted` | boolean | Figure 3 HPV Other SWAB branch | Preserved only for HPV Other SWAB |
| `hpv_result` | `hpvResult` | `NOT_DETECTED`/`HPV_16_18`/`HPV_OTHER`/internal `INADEQUATE` | Figures 3,4,6,8/Table 1 post-hyst HPV | UI hides `INADEQUATE`; schema/type still support it |
| `cytology_result` | `cytologyResult` | cytology enum | Figures 3,4,5,6,7,9 | UI hides `UNSATISFACTORY`; hidden after HPV16/18 in ordinary Direct HPV flow |
| `histology_result` | `histologyResult`, `biopsyResult` | histology enum | Figures 7,9; persistence | Biopsy result mirrors histology |
| `immunocompromised` | `immunocompromised` | boolean | Figures 3,4,6 recall interval | Defaults from patient medical history if not mapped |
| `is_first_hpv_transition` | `isFirstTimeHPVTransition` | boolean | Figures 1/2 transition routing | Defaults from patient profile if not mapped |
| `screening_status` | `screeningStatus` | enum | Figure 1 | `UNKNOWN` makes `screeningHistoryKnown=false` |
| `transition_prior_history`, `prior_screening_history` | `priorScreeningHistory` | enum | Figures 1,2,8/Table 1 | Transition history overrides/combines with hysterectomy prior history |
| `history_source_available` | `historySourceAvailable` | boolean | Figure 2 | False creates external history dependency |
| Derived from history | `priorLowGradeResult` | boolean | Figure 1/2 | True for low-grade categories |
| Derived from history | `priorHighGradeResult`, `previousHSILCIN23`, `previousAIS`, `previousAtypicalGlandularCells`, `previousAtypicalEndometrialCells` | boolean | Figure 2 routing | Derived from prior history categories |
| `ag2_report_timing` | `ag2ReportDate` | Date | Figure 2 | Synthetic date: older than 3 years or current date |
| `returned_to_3_yearly_cytology_screening` | `returnedTo3YearlyCytologyScreening` | boolean/undefined | Figure 2 AG2 branch | `unknown` maps undefined |
| `specialist_discharged_to_primary_care` | `specialistDischargedToPrimaryCare` | boolean/undefined | Figure 2 AG2 branch |  |
| `colposcopy_recommended_last_cytology` | `colposcopyRecommendedInLastCytology` | boolean/undefined | Figure 2 high-grade/glandular branch |  |
| `colposcopy_completed_last_recommendation` | `colposcopyCompletedForLastRecommendation` | boolean/undefined | Figure 2 high-grade/glandular branch |  |
| `atypical_endometrial_history` | `atypicalEndometrialHistory` | boolean | Figure 2/7 | Defaults from patient medical history if not mapped |
| `is_post_hysterectomy` | `isPostHysterectomy` | boolean | Figure 8/Table 1 | Subtotal maps false for `isPostHysterectomy` |
| `hysterectomy_type` | `hysterectomyType` | `TOTAL`/`SUBTOTAL` | Figure 8/Table 1 | Subtotal routes to Figure 3-style pathway |
| `hysterectomy_indication` | `hysterectomyIndication` | enum | Figure 8/Table 1 | Currently documented/persisted in input; main row logic uses history/pathology/excision |
| `hysterectomy_specimen_pathology` | `hysterectomySpecimenPathology` | enum | Figure 8/Table 1 |  |
| `excision_status` | `excisionStatus` | enum | Figure 8/Table 1 high-grade specimen | Unknown returns review |
| `post_hysterectomy_hpv_test_indicated` | `postHysterectomyHpvTestIndicated` | boolean | Figure 8/Table 1 post-hyst HPV result branch |  |
| `repeat_context` | `repeatContext` | enum | Figures 4/5/6/3 | `is_test_of_cure=true` also implies `TEST_OF_CURE` |
| `repeat_stage` | `repeatStage` | enum | Figures 3/4 | Completion counters default zero; no hidden counter inheritance |
| `is_test_of_cure` | `isTestOfCure` | boolean | Figure 6 | Defaults false |
| `test_of_cure_stage` | `testOfCureStage` | enum | Figure 6 | First/second/continuing |
| `is_pregnant` | `isPregnant` | boolean/undefined | Figure 9 routing | Qualifying cytology required |
| `postpartum_review_timing` | `postpartumReviewTiming` | enum/undefined | Figure 9 type | No current wizard step visible in `WIZARD_STEPS` |
| `has_abnormal_vaginal_bleeding` | `hasAbnormalVaginalBleeding` | boolean/undefined | Figure 10 highest precedence |  |
| `abnormal_bleeding_stage` | `abnormalBleedingStage` | enum | Figure 10 |  |
| `bleeding_type` | `bleedingType` | enum | Figure 10 initial workup |  |
| `has_cancer_symptoms` | `hasCancerSymptoms` | boolean/undefined | Figure 10 urgent pathway | Highest Figure 10 branch |
| `figure10_initial_workup_completed` | `menstrualHistoryCaptured`, `contraceptiveHistoryCaptured`, `sexualHistoryCaptured`, `speculumExamCompleted`, `pelvicExamCompleted`, `coTestCompleted` | booleans | Figure 10 | True maps all captured/completed booleans true |
| `abnormal_cervix` | `abnormalCervix` | boolean/undefined | Figure 10 |  |
| `suspicion_of_cancer` | `suspicionOfCancer` | boolean/undefined | Figure 10 |  |
| `suspect_ocp_problem` | `suspectOralContraceptiveProblem`, `oralContraceptiveAdjusted` | booleans | Figure 10 | If true, `oralContraceptiveAdjusted=true` |
| `sti_identified` | `stiIdentified`, `stiTreated` | booleans | Figure 10 | If true, `stiTreated=true` |
| `bleeding_resolved` | `bleedingResolved` | boolean/undefined | Figure 10 review |  |
| `has_colposcopy_findings` | None directly | boolean-like | Wizard controls downstream colposcopy fields and persistence | Used as `answersMap` for persistence |
| `tz_type` | `tzType`, `colposcopyTZType` | enum | Persistence, colposcopy context |  |
| `transformation_zone_state` | `transformationZoneState` | enum | Figure 9 |  |
| `visible_lesion` | `visibleLesion` | boolean/undefined | Figures 5,7,9 |  |
| `colposcopic_impression` | `colposcopicImpression`, `normalColposcopy` | enum/boolean | Figures 4,5,7,9 | `NORMAL` sets `normalColposcopy=true` |
| `biopsy_taken` | None directly | boolean-like | Persistence | `biopsyTaken` persisted if true or biopsyResult exists |
| `mdm_outcome`, `mdm_outcome_pregnant` | `mdmOutcome` | string | Figures 5,7,9 | Pregnant-specific MDM step takes priority when pregnant |
| Completion route | `consecutiveNegativeCoTestCount`, `consecutiveLowGradeCount`, `unsatisfactoryCytologyCount` | number | Figures 3/6 fallback repeat inference | Always zero for clean wizard completion; no prior-session counter carry-over |

## 6. High-Level Routing Precedence

Source: `evaluateClinicalDecision()` in `lib/engine/decision-engine.ts`; consent gate is outside the engine in the completion route.

| Precedence | Condition | Target | Reason/notes |
|---:|---|---|---|
| 0 | `answersMap.consent_confirmed !== "true"` at completion | HTTP 409, no engine evaluation | Consent hard gate in `complete/route.ts` |
| 1 | `hasAbnormalVaginalBleeding` or `currentFigure=FIGURE_10` | `evaluateFigure10()` | Symptomatic abnormal bleeding has highest engine routing priority, including under age 25 |
| 2 | `currentFigure=FIGURE_9` or pregnant with qualifying cytology | `evaluateFigure9()` | Pregnancy high-grade/glandular/AIS path before age/hysterectomy routine paths |
| 3 | `currentFigure=TABLE_1` | `evaluateTable1()` | Explicit Table 1 route |
| 4 | `isPostHysterectomy` or `currentFigure=FIGURE_8` | `evaluateFigure8()` | Total hysterectomy/vault screening path before routine age gates |
| 5 | `patientAge < 25` | `AGE-UNDER-25` | Routine screening gate after symptomatic/special routes |
| 6 | `patientAge >= 75` | `AGE-75-DISCHARGE` | Routine screening exit |
| 7 | `patientAge >= 70` | `AGE-70-74-DEFERRED` | Deferred exit/final HPV screen |
| 8 | `currentFigure=FIGURE_2` | `evaluateFigure2()` | Explicit Figure 2 route |
| 9 | `currentFigure=FIGURE_1` | `evaluateFigure1()` | Explicit Figure 1 route |
| 10 | `isFirstTimeHPVTransition` plus Figure 2 history | `evaluateFigure2()` | Previous high-grade/AIS/glandular/endometrial histories override transition invitation |
| 11 | `isFirstTimeHPVTransition` plus glandular cytology | `evaluateFigure7()` | Glandular cytology route |
| 12 | `isFirstTimeHPVTransition` otherwise | `evaluateFigure1()` | Transition invitation |
| 13 | `isTestOfCure` or `currentFigure=FIGURE_6` or `repeatContext=TEST_OF_CURE` | `evaluateFigure6()` | Test of Cure before glandular/colposcopy follow-up |
| 14 | `currentFigure=FIGURE_7` or glandular cytology | `evaluateFigure7()` | Glandular abnormalities |
| 15 | `currentFigure=FIGURE_5` or high-grade post-normal-colposcopy repeat context | `evaluateFigure5()` | Post-normal colposcopy high-grade cytology |
| 16 | `currentFigure=FIGURE_4` or low-grade post-normal-colposcopy repeat context | `evaluateFigure4()` | Post-normal colposcopy low-grade cytology |
| 17 | Default | `evaluateFigure3()` | Primary HPV screening |

## 7. Figure-By-Figure Implemented Rules

### Figure 1 - Transition To HPV Primary Screening

Source: `evaluateFigure1()` in `lib/engine/decision-engine.ts`.

| Branch condition | Required inputs | Recommendation code | Implemented outcome | Source function/file | Test coverage |
|---|---|---|---|---|---|
| Missing/unknown screening status | `screeningStatus` absent or `UNKNOWN` | `F1-EXTERNAL-HISTORY-REQUIRED` | Insufficient/external history required | `evaluateFigure1()` | `figure1.test.ts` unknown status |
| Never screened | `screeningStatus=NEVER_SCREENED` | `F1-INVITE-NOW` | Invite now, then Figure 3 | `evaluateFigure1()` | `figure1.test.ts` |
| Under-screened | `screeningStatus=UNDER_SCREENED` | `F1-INVITE-NOW` | Invite now, then Figure 3 | `evaluateFigure1()` | Covered by branch set in code; not individually named |
| Overdue | `screeningStatus=OVERDUE` | `F1-INVITE-NOW` | Invite now, then Figure 3 | `evaluateFigure1()` | Covered by branch set in code; not individually named |
| Regular screening with negative/normal, low-grade only/returned, high-grade ToC complete, or successful ToC | `screeningStatus=REGULAR_SCREENING`; qualifying history or ToC complete | `F1-INVITE-NEXT-SCHEDULED` | Invite at next scheduled visit, then Figure 3 | `evaluateFigure1()` | `figure1.test.ts` |
| Regular screening without enough prior-history detail | `screeningStatus=REGULAR_SCREENING`; missing qualifying history | `F1-HISTORY-DETAIL-REQUIRED` | External history/detail required | `evaluateFigure1()` | Not separately named |

### Figure 2 - Previous High-Grade, AIS, Glandular, Or Atypical Endometrial History

Source: `evaluateFigure2()` in `lib/engine/decision-engine.ts`.

| Branch condition | Required inputs | Recommendation code | Implemented outcome | Source function/file | Test coverage |
|---|---|---|---|---|---|
| History source unavailable | `historySourceAvailable=false` | `F2-EXTERNAL-HISTORY-REQUIRED` | External history required | `evaluateFigure2()` | Indirect routing tests |
| Previous AIS without total hysterectomy | `previousAIS` or `PREVIOUS_AIS`; not post-hysterectomy | `F2-AIS-R208-FOLLOWUP` | Clinician review/service-defined R2.08 follow-up | `evaluateFigure2()` | `figure2.test.ts` |
| Previous AIS with post-hysterectomy | Previous AIS + post-hysterectomy | Table 1 code | Delegates to Table 1 | `evaluateFigure2()` -> `evaluateTable1()` | Routing/figure8/table1 tests |
| Previous AG2 older than 3 years | AG2 history + older report | `F2-AG2-OLDER-3Y-FIG3` | Return to Figure 3 | `evaluateFigure2()` | `figure2.test.ts` |
| Previous AG2 specialist discharged | AG2 history + discharged to primary care | `F2-AG2-DISCHARGED-FIG3` | Return to Figure 3 | `evaluateFigure2()` | Code branch present; no separate named test |
| Previous AG2 returned to 3-year cytology | `returnedTo3YearlyCytologyScreening=true` | `F2-AG2-RETURNED-3Y-CYTOLOGY-FIG3` | Return to Figure 3 | `evaluateFigure2()` | `figure2.test.ts`, `wizard-integration.test.ts` |
| Previous AG2 status missing | Missing AG2 report/discharge/returned status | `F2-AG2-STATUS-REQUIRED` | Insufficient/external history required | `evaluateFigure2()` | Code branch present |
| Previous AG2 otherwise | AG2 history not eligible for Figure 3 | `F2-AG2-SPECIALIST-GYN` | Refer specialist gynaecology | `evaluateFigure2()` | `figure2.test.ts` |
| Previous high-grade/glandular, colposcopy recommended and not done | High-grade/glandular history + recommended colposcopy + not completed | `F2-PRIOR-HG-COLP` | Refer to colposcopy | `evaluateFigure2()` | `figure2.test.ts` |
| Previous high-grade/glandular ToC complete | ToC complete/successful | `F2-PRIOR-HG-TOC-COMPLETE-FIG3` | Return to Figure 3 | `evaluateFigure2()` | Code branch present |
| Previous high-grade/glandular ToC required/incomplete | ToC required/incomplete | `F2-PRIOR-HG-COMPLETE-TOC` | Complete Figure 6 ToC | `evaluateFigure2()` | `figure2.test.ts` |
| Prior high-grade/glandular but ToC status missing | Prior high-grade/glandular with missing ToC status | `F2-PRIOR-HG-TOC-STATUS-REQUIRED` | Insufficient/external history required | `evaluateFigure2()` | Code branch present |
| No Figure 2 history category | Missing relevant history | `F2-PRIOR-HISTORY-REQUIRED` | Insufficient/external history required | `evaluateFigure2()` | Code branch present |

### Figure 3 - Primary HPV Screening

Source: `evaluateFigure3()` in `lib/engine/decision-engine.ts`; Direct HPV wizard visibility in `lib/wizard/steps.ts`.

| Branch condition | Required inputs | Recommendation code | Implemented outcome | Source function/file | Test coverage |
|---|---|---|---|---|---|
| HPV result missing | Missing `hpvResult` | `F3-HPV-REQUIRED` | Insufficient information | `evaluateFigure3()` | Session isolation tests verify no stale HPV |
| HPV not detected, immunocompetent | `hpvResult=NOT_DETECTED`, `immunocompromised=false` | `F3-HPV-NOT-DETECTED-5Y` | Routine recall 60 months | `evaluateFigure3()` | `figure3.test.ts` |
| HPV not detected, immunocompromised | `hpvResult=NOT_DETECTED`, `immunocompromised=true` | `F3-HPV-NOT-DETECTED-IC-3Y` | Routine recall 36 months | `evaluateFigure3()` | `figure3.test.ts` |
| HPV 16/18 baseline, no cytology | `hpvResult=HPV_16_18`; no cytology | `F3-1618-COLP` | Direct colposcopy; cytology warning only if LBC exists | `evaluateFigure3()` | `figure3.test.ts`, `wizard-integration.test.ts` |
| HPV 16/18 first repeat | `hpvResult=HPV_16_18`, `repeatStage=FIRST_REPEAT` | `F3-1618-COLP` or high-grade variant if high-grade cytology supplied | Direct colposcopy | `evaluateFigure3()` | Covered by same branch logic |
| HPV 16/18 with SWAB | `sampleType=SWAB`, `hpvResult=HPV_16_18` | `F3-1618-COLP` | Direct colposcopy; swab return not required | `evaluateFigure3()`, wizard visibility | `figure3.test.ts`, `wizard-integration.test.ts` |
| HPV 16/18 with LBC | `sampleType=LBC`, `hpvResult=HPV_16_18`, no cytology | `F3-1618-COLP` | Direct colposcopy | `evaluateFigure3()` | `wizard-integration.test.ts` |
| HPV 16/18 plus high-grade cytology supplied | `hpvResult=HPV_16_18`, high-grade cytology | `F3-1618-HIGH-GRADE-COLP` | Urgent/high-grade colposcopy priority P1 | `evaluateFigure3()` | Code branch present |
| HPV Other with SWAB and no return visit | `sampleType=SWAB`, `hpvResult=HPV_OTHER`, no/false swab return | `F3-SWAB-RETURN-REQUIRED` | Return visit required before cytology-dependent pathway | `evaluateFigure3()` and `getVisibleAnswerMap()` | `figure3.test.ts`, `wizard-integration.test.ts` |
| HPV Other missing cytology | `hpvResult=HPV_OTHER`, return visit not blocking, missing cytology | `F3-HPV-OTHER-CYTOLOGY-REQUIRED` | Insufficient information | `evaluateFigure3()` | Code branch present |
| HPV Other with AG2 or AC2 | `hpvResult=HPV_OTHER`, `cytologyResult=AG2/AC2` | Figure 7 code | Delegates to Figure 7 | `evaluateFigure3()` -> `evaluateFigure7()` | `figure7.test.ts` |
| HPV Other high-grade cytology | HPV Other + ASC-H/HSIL/SCC/AIS/glandular high-grade | `F3-HPV-OTHER-HIGH-GRADE-COLP` | Refer colposcopy P2 | `evaluateFigure3()` | `wizard-integration.test.ts` |
| HPV Other negative/ASC-US/LSIL baseline | HPV Other + negative/ASC-US/LSIL | `F3-HPV-OTHER-NEG-ASCUS-LSIL-12M` | First repeat HPV in 12 months; recommend LBC | `evaluateFigure3()` | `figure3.test.ts` |
| HPV Other first repeat low-grade, age missing | `repeatStage=FIRST_REPEAT`, low-grade cytology, missing age | `F3-FIRST-REPEAT-AGE-REQUIRED` | Insufficient age information | `evaluateFigure3()` | Code branch present |
| HPV Other first repeat low-grade, age >= 50 | First repeat HPV Other + negative/ASC-US/LSIL + age >= 50 | `F3-FIRST-REPEAT-AGE50-COLP` | Colposcopy | `evaluateFigure3()` | `figure3.test.ts` |
| HPV Other first repeat low-grade, age < 50 | First repeat HPV Other + negative/ASC-US/LSIL + age < 50 | `F3-FIRST-REPEAT-UNDER50-SECOND-REPEAT` | Second repeat in 12 months | `evaluateFigure3()` | `figure3.test.ts` |
| Second repeat HPV detected any type | `repeatStage=SECOND_REPEAT`, HPV 16/18 or HPV Other | `F3-SECOND-REPEAT-HPV-DETECTED-COLP` | Cytology if available and colposcopy | `evaluateFigure3()` | `figure3.test.ts` |
| HPV inadequate | `hpvResult=INADEQUATE` | `F3-INAD-3M` | Repeat HPV in 3 months | `evaluateFigure3()` | Backend only; hidden from active wizard |
| Unmapped HPV/cytology combination | Combination outside above rules | `F3-UNMAPPED-COMBINATION` | Clinician review | `evaluateFigure3()` | Code branch present |
| Cytology N/A/not required UI behaviour | HPV16/18 in ordinary wizard path | No cytology field sent | Cytology hidden after HPV16/18; no explicit N/A option shown | `WIZARD_STEPS`, wizard page | `wizard-integration.test.ts` |
| Hidden inadequate/unsatisfactory UI behaviour | Active wizard options | N/A | `INADEQUATE` and `UNSATISFACTORY` hidden from active HPV/cytology options | `WIZARD_STEPS` | `wizard-integration.test.ts` |

### Figure 4 - Post-Normal Colposcopy After Low-Grade Cytology

Source: `evaluateFigure4()` in `lib/engine/decision-engine.ts`.

| Branch condition | Required inputs | Recommendation code | Implemented outcome | Source function/file | Test coverage |
|---|---|---|---|---|---|
| Normal colposcopy missing | Not `normalColposcopy` and impression not `NORMAL` | `F4-NORMAL-COLPOSCOPY-REQUIRED` | Insufficient information | `evaluateFigure4()` | Code branch present |
| Entry/initial normal colposcopy follow-up | Normal colposcopy, no repeat HPV result yet | `F4-NORMAL-COLP-REPEAT-HPV-12M` | Repeat HPV in 12 months in community care; recommend LBC | `evaluateFigure4()` | `figure4.test.ts` |
| Repeat HPV not detected | Normal colposcopy + `hpvResult=NOT_DETECTED` | `F4-REPEAT-HPV-NOT-DETECTED-REGULAR` | Return to regular interval screening | `evaluateFigure4()` | `figure4.test.ts` |
| Repeat HPV 16/18 | Normal colposcopy + `hpvResult=HPV_16_18` | `F4-REPEAT-1618-COLP` | Refer to colposcopy | `evaluateFigure4()` | `figure4.test.ts` |
| Second repeat HPV detected any type | Normal colposcopy + HPV Other + second repeat | `F4-SECOND-REPEAT-HPV-DETECTED-COLP` | Refer to colposcopy | `evaluateFigure4()` | `figure4.test.ts` |
| HPV Other missing cytology | HPV Other without cytology | `F4-HPV-OTHER-CYTOLOGY-REQUIRED` | Insufficient information | `evaluateFigure4()` | Code branch present |
| HPV Other high-grade cytology | HPV Other + cytology >= ASC-H | `F4-HPV-OTHER-HIGH-GRADE-COLP` | Refer colposcopy | `evaluateFigure4()` | `figure4.test.ts` |
| HPV Other low-grade cytology, immune deficient | HPV Other + negative/ASC-US/LSIL + immunocompromised | `F4-HPV-OTHER-LOW-GRADE-IC-COLP` | Refer colposcopy | `evaluateFigure4()` | `figure4.test.ts` |
| HPV Other low-grade cytology, not immune deficient | HPV Other + negative/ASC-US/LSIL + not immunocompromised | `F4-HPV-OTHER-LOW-GRADE-SECOND-REPEAT` | Repeat HPV in 12 months | `evaluateFigure4()` | Code branch present |
| Unmapped follow-up | Outside above | `F4-UNMAPPED-COMBINATION` | Clinician review | `evaluateFigure4()` | Code branch present |

### Figure 5 - Post-Normal Colposcopy After High-Grade Cytology

Source: `evaluateFigure5()` in `lib/engine/decision-engine.ts`.

| Branch condition | Required inputs | Recommendation code | Implemented outcome | Source function/file | Test coverage |
|---|---|---|---|---|---|
| MDM not yet completed | Missing `mdmOutcome` | `F5-MDM-REQUIRED` | MDM required | `evaluateFigure5()` | `figure5.test.ts` |
| MDM downgraded to LSIL/ASC-US | `mdmOutcome=DOWNGRADED_LSIL` or `DOWNGRADED_ASC_US_LSIL` | `F5-MDM-DOWNGRADED-LSIL` | Follow LSIL pathway | `evaluateFigure5()` | `figure5.test.ts` |
| MDM upgraded to HSIL | `mdmOutcome=UPGRADED_HSIL` | `F5-MDM-UPGRADED-HSIL-TREAT` | HSIL pathway; treatment recommended | `evaluateFigure5()` | `figure5.test.ts` |
| Confirmed ASC-H + HPV not detected + no visible lesion | `CONFIRMED_ASC_H`, `hpvResult=NOT_DETECTED`, `visibleLesion=false` | `F5-CONFIRMED-ASCH-HPV-NEG-NO-LESION-TOC` | Test of Cure/co-testing pathway | `evaluateFigure5()` | `figure5.test.ts` |
| Confirmed ASC-H + HPV detected + normal colposcopy + negative cytology + no visible lesion | `CONFIRMED_ASC_H`, HPV detected, cytology negative, normal colposcopy, no visible lesion | `F5-CONFIRMED-ASCH-HPV-DETECTED-NORMAL-NEG-12M` | Repeat colposcopy, HPV, cytology in 12 months | `evaluateFigure5()` | `figure5.test.ts`, `wizard-integration.test.ts` |
| Confirmed ASC-H + abnormal cytology | `CONFIRMED_ASC_H`, cytology not negative | `F5-CONFIRMED-ASCH-TREAT` | Treatment recommended; consider type 2 excision TZ | `evaluateFigure5()` | `wizard-integration.test.ts` |
| Confirmed ASC-H + visible lesion | `CONFIRMED_ASC_H`, `visibleLesion=true` | `F5-CONFIRMED-ASCH-TREAT` | Treatment recommended; consider type 2 excision TZ | `evaluateFigure5()` | `wizard-integration.test.ts` |
| Confirmed ASC-H missing required facts | `CONFIRMED_ASC_H`, missing HPV/cytology/lesion facts | `F5-CONFIRMED-ASCH-RESULTS-REQUIRED` | Insufficient information | `evaluateFigure5()` | `figure5.test.ts` |
| Unmapped MDM outcome | Other `mdmOutcome` | `F5-MDM-OUTCOME-UNMAPPED` | Clinician review | `evaluateFigure5()` | Code branch present |

There is no broad "HPV detected alone = treatment" rule in the current Figure 5 confirmed ASC-H logic. HPV detected with normal colposcopy and negative cytology explicitly routes to `F5-CONFIRMED-ASCH-HPV-DETECTED-NORMAL-NEG-12M`.

### Figure 6 - Test Of Cure

Source: `evaluateFigure6()` in `lib/engine/decision-engine.ts`.

| Branch condition | Required inputs | Recommendation code | Implemented outcome | Source function/file | Test coverage |
|---|---|---|---|---|---|
| Missing HPV or cytology | Missing `hpvResult` or `cytologyResult` | `F6-COTEST-REQUIRED` | Insufficient information | `evaluateFigure6()` | Code branch present |
| HPV detected any type/any cytology | HPV 16/18 or HPV Other; any cytology | `F6-HPV-DETECTED-ANY-CYTOLOGY-COLP` | Refer to colposcopy; P1 if HPV16/18 or high-grade cytology, otherwise P2 | `evaluateFigure6()` | `figure6.test.ts` |
| Continuing ToC, HPV not detected + negative cytology | `testOfCureStage=CONTINUING`, HPV not detected, negative cytology | `F6-CONTINUE-TOC-UNTIL-COMPLETE` | Continue ToC until successful completion | `evaluateFigure6()` | `figure6.test.ts` |
| Second negative ToC | HPV not detected + negative cytology + `SECOND_TEST`, complete status, or prior negative counter | `F6-SECOND-NEGATIVE-RETURN-REGULAR` | Return to regular screening; 60 months or 36 months if immunocompromised | `evaluateFigure6()` | `figure6.test.ts`, `wizard-integration.test.ts` |
| First negative ToC | HPV not detected + negative cytology without second-negative criteria | `F6-FIRST-NEGATIVE-REPEAT-12M` | Repeat cytology and HPV in 12 months | `evaluateFigure6()` | `figure6.test.ts`, `wizard-integration.test.ts` |
| HPV not detected + high-grade cytology | HPV not detected + high-grade/glandular/AIS/SCC cytology | `F6-HPV-NEG-HIGH-GRADE-COLP` | Refer colposcopy P1 | `evaluateFigure6()` | `figure6.test.ts` |
| HPV not detected + low-grade cytology, first/unspecified | HPV not detected + ASC-US/LSIL; not second/continuing | `F6-HPV-NEG-LOW-GRADE-REPEAT-12M` | Repeat cytology and HPV in 12 months | `evaluateFigure6()` | `figure6.test.ts` |
| Repeat/continuing HPV not detected + low-grade cytology | HPV not detected + ASC-US/LSIL + `SECOND_TEST` or `CONTINUING` | `F6-REPEAT-HPV-NEG-CYTOLOGY-ABNORMAL-COLP` | Refer colposcopy | `evaluateFigure6()` | `figure6.test.ts`, `wizard-integration.test.ts` |
| HPV not detected + any abnormal non-negative cytology not already handled | HPV not detected + non-negative cytology | `F6-REPEAT-HPV-NEG-CYTOLOGY-ABNORMAL-COLP` | Refer colposcopy | `evaluateFigure6()` | Code branch present |
| Unmapped cytology | Outside above | `F6-UNMAPPED-CYTOLOGY` | Clinician review | `evaluateFigure6()` | Code branch present |

### Figure 7 - Atypical And Abnormal Glandular Abnormalities

AG/AC glossary in current UI:
- `AG1`: Atypical endocervical cells
- `AG2`: Atypical endometrial cells
- `AG3`: Atypical glandular cells NOS
- `AG4`: Atypical endocervical cells favouring neoplasia
- `AG5`: Atypical glandular cells favouring neoplasia
- `AIS`: Adenocarcinoma in situ
- `AC1`: Endocervical adenocarcinoma
- `AC2`: Endometrial adenocarcinoma
- `AC3`: Extrauterine adenocarcinoma
- `AC4`: Adenocarcinoma NOS

Source: `evaluateFigure7()` in `lib/engine/decision-engine.ts`.

| Branch condition | Required inputs | Recommendation code | Implemented outcome | Source function/file | Test coverage |
|---|---|---|---|---|---|
| AG2 or atypical endometrial history | `cytologyResult=AG2` or `atypicalEndometrialHistory=true` | `F7-AG2-GYNAECOLOGY` | Refer gynaecology P1 | `evaluateFigure7()` | `figure7.test.ts` |
| AC2 | `cytologyResult=AC2` | `F7-AC2-GYNAECOLOGY` | Refer gynaecology P1 | `evaluateFigure7()` | `figure7.test.ts` |
| AG1/AG3/AG4/AG5/AC1/AC3/AC4 without colposcopy context | Supported cytology and no visible lesion/impression/normal colpo | `F7-GLANDULAR-COLPOSCOPY` | Refer colposcopy; AG1/AC1 P2, others P1 | `evaluateFigure7()` | `figure7.test.ts` |
| Colposcopy context but visible lesion unknown | Missing `visibleLesion` | `F7-VISIBLE-LESION-REQUIRED` | Insufficient information | `evaluateFigure7()` | `figure7.test.ts` |
| Visible lesion, biopsy missing | `visibleLesion=true`, missing biopsy | `F7-VISIBLE-LESION-BIOPSY` | Biopsy required | `evaluateFigure7()` | `figure7.test.ts` |
| Visible lesion, biopsy AIS | `biopsyResult=AIS` | `F7-BIOPSY-AIS-TYPE3-EXCISION` | Type 3 excision | `evaluateFigure7()` | `figure7.test.ts` |
| Visible lesion, biopsy cancer/invasion | SCC, adenocarcinoma, or invasion positive | `F7-BIOPSY-CANCER-ONCOLOGY` | Refer gynaecological oncologist | `evaluateFigure7()` | `figure7.test.ts` |
| Visible lesion, other biopsy result | Other biopsy | `F7-BIOPSY-RESULT-OUTSIDE-SOURCE` | Clinician review | `evaluateFigure7()` | Code branch present |
| No visible lesion, no MDM | `visibleLesion=false`, missing MDM | `F7-NO-LESION-MDM` | MDM case review | `evaluateFigure7()` | `figure7.test.ts` |
| MDM cytology confirmed not AG2 | `mdmOutcome=CYTOLOGY_CONFIRMED_NOT_AG2` | `F7-MDM-CONFIRMED-NOT-AG2-TYPE3` | Type 3 excision | `evaluateFigure7()` | `figure7.test.ts` |
| MDM AG2 confirmed | `mdmOutcome=AG2_CYTOLOGY_CONFIRMED` | `F7-MDM-AG2-INVESTIGATE-MALIGNANCIES` | Investigate other gynaecological malignancies | `evaluateFigure7()` | `figure7.test.ts` |
| MDM cytology not confirmed | `mdmOutcome=CYTOLOGY_NOT_CONFIRMED` | `F7-MDM-CYTOLOGY-NOT-CONFIRMED-6M` | Repeat colposcopy in 6 months | `evaluateFigure7()` | `figure7.test.ts` |
| Unmapped MDM | Other MDM | `F7-MDM-OUTCOME-UNMAPPED` | Clinician review | `evaluateFigure7()` | Code branch present |

### Figure 8 - Screening After Total Hysterectomy

Source: `evaluateFigure8()` -> `evaluateHysterectomyPathway(input, "FIGURE_8")`.

Figure 8 uses the same row logic as Table 1 but returns `F8-...` recommendation codes. Subtotal hysterectomy routes to standard primary HPV screening via `F8-SUBTOTAL-FIG3`. Post-hysterectomy HPV not detected returns `F8-POST-HYST-HPV-NOT-DETECTED-NO-FURTHER`; post-hysterectomy HPV detected returns `F8-POST-HYST-HPV-DETECTED-FIG3`.

| Branch condition | Required inputs | Recommendation code | Implemented outcome | Source function/file | Test coverage |
|---|---|---|---|---|---|
| Subtotal hysterectomy | `hysterectomyType=SUBTOTAL` | `F8-SUBTOTAL-FIG3` | Use standard primary HPV screening | `evaluateHysterectomyPathway()` | Code branch present |
| Post-hyst HPV not detected | `postHysterectomyHpvTestIndicated=true`, HPV not detected | `F8-POST-HYST-HPV-NOT-DETECTED-NO-FURTHER` | No further screening for branch | `evaluateHysterectomyPathway()` | `figure8.test.ts` |
| Post-hyst HPV detected | `postHysterectomyHpvTestIndicated=true`, HPV 16/18 or HPV Other | `F8-POST-HYST-HPV-DETECTED-FIG3` | Follow Figure 3 | `evaluateHysterectomyPathway()` | `figure8.test.ts` |
| Missing history/pathology | Missing prior history or specimen pathology | `F8-HYSTERECTOMY-HISTORY-REQUIRED` | Insufficient external history/pathology | `evaluateHysterectomyPathway()` | Code branch present |
| Low-risk no pathology | Negative/normal or low-grade returned + no pathology | `F8-NEG-RETURNED-NO-PATH-NO-FURTHER` | No further screening | `evaluateHysterectomyPathway()` | `figure8.test.ts` |
| Low-risk LSIL/CIN1 | Negative/normal or low-grade returned + LSIL/CIN1 | `F8-NEG-RETURNED-LSIL-HPV` | HPV test and follow Figure 3 | `evaluateHysterectomyPathway()` | `figure8.test.ts`, `wizard-integration.test.ts` |
| High-grade specimen complete | HSIL/CIN2/3 or AIS + complete excision | `F8-HSIL-AIS-COMPLETE-TOC` | Test of Cure | `hysterectomyHighGradeOutcome()` | `figure8.test.ts` |
| High-grade specimen incomplete | HSIL/CIN2/3 or AIS + incomplete excision | `F8-HSIL-AIS-INCOMPLETE-COLP` | Colposcopy | `hysterectomyHighGradeOutcome()` | `figure8.test.ts` |
| High-grade specimen unknown | HSIL/AIS specimen + unknown/missing excision | `F8-HSIL-AIS-EXCISION-UNKNOWN-REVIEW` | Insufficient/review | `hysterectomyHighGradeOutcome()` | Code branch present |
| Otherwise unmapped | History/pathology combination outside table | `F8-UNMAPPED-HYSTERECTOMY-BRANCH` | Clinician review | `evaluateHysterectomyPathway()` | Code branch present |

### Table 1 - Vaginal Screening After Total Hysterectomy

Source: `evaluateTable1()` -> `evaluateHysterectomyPathway(input, "TABLE_1")`.

Table 1 uses the same logic as Figure 8 but returns `T1-...` codes.

| Branch condition | Required inputs | Recommendation code | Implemented outcome | Source function/file | Test coverage |
|---|---|---|---|---|---|
| Low-risk/returned + no pathology | Negative/normal, low-grade only, or low-grade returned; no pathology | `T1-NEG-RETURNED-NO-PATH-NO-FURTHER` | No further screening | `evaluateHysterectomyPathway()` | `table1.test.ts` |
| Low-risk/returned + LSIL/CIN1 | Same history + LSIL/CIN1 | `T1-NEG-RETURNED-LSIL-HPV` | HPV test and Figure 3 | `evaluateHysterectomyPathway()` | Code branch present |
| Low-grade not returned + no pathology | `LOW_GRADE_NOT_RETURNED_TO_REGULAR` + no pathology | `T1-LOWGRADE-NOT-RETURNED-NO-PATH-HPV` | HPV test and Figure 3 | `evaluateHysterectomyPathway()` | Code branch present |
| Low-grade not returned + LSIL/CIN1 | `LOW_GRADE_NOT_RETURNED_TO_REGULAR` + LSIL/CIN1 | `T1-LOWGRADE-NOT-RETURNED-LSIL-HPV` | HPV test and Figure 3 | `evaluateHysterectomyPathway()` | `table1.test.ts` |
| Completed ToC + no pathology | `HIGH_GRADE_TOC_COMPLETE` + no pathology | `T1-HSIL-TOC-COMPLETE-NO-PATH-NO-FURTHER` | No further screening | `evaluateHysterectomyPathway()` | Code branch present |
| Completed ToC + LSIL/CIN1 | `HIGH_GRADE_TOC_COMPLETE` + LSIL/CIN1 | `T1-HSIL-TOC-COMPLETE-LSIL-HPV` | HPV test and Figure 3 | `evaluateHysterectomyPathway()` | Code branch present |
| HSIL/AIS complete excision | HSIL/CIN2/3 or AIS pathology + `COMPLETE` | `T1-HSIL-AIS-COMPLETE-TOC` | Test of Cure | `hysterectomyHighGradeOutcome()` | `table1.test.ts` |
| HSIL/AIS incomplete excision | HSIL/CIN2/3 or AIS pathology + `INCOMPLETE` | `T1-HSIL-AIS-INCOMPLETE-COLP` | Colposcopy | `hysterectomyHighGradeOutcome()` | `table1.test.ts` |
| HSIL/AIS unknown excision | HSIL/CIN2/3 or AIS pathology + missing/unknown excision | `T1-HSIL-AIS-EXCISION-UNKNOWN-REVIEW` | Insufficient/review | `hysterectomyHighGradeOutcome()` | `table1.test.ts` |
| Untreated/incomplete HSIL/AIS + no or low-grade pathology | `HSIL_AIS_UNTREATED_OR_INCOMPLETELY_TREATED` + no/low-grade pathology | `T1-UNTREATED-HSIL-AIS-NO-PATH-LOWGRADE-TOC` | Continue Test of Cure | `evaluateHysterectomyPathway()` | `table1.test.ts`, `wizard-integration.test.ts` |
| Incomplete ToC + no or low-grade pathology | `HIGH_GRADE_TOC_INCOMPLETE` or `testOfCureStatus=INCOMPLETE` + no/low-grade pathology | `T1-INCOMPLETE-TOC-NO-PATH-LOWGRADE-TOC` | Continue Test of Cure | `evaluateHysterectomyPathway()` | `table1.test.ts` |
| No known history + no or low-grade pathology | `NO_KNOWN_SCREENING_HISTORY` + no/low-grade pathology | `T1-NO-HISTORY-NO-PATH-LOWGRADE-HPV-6M` | HPV test at 6 months post-hysterectomy | `evaluateHysterectomyPathway()` | `table1.test.ts`, `wizard-integration.test.ts` |
| Subtotal hysterectomy | `hysterectomyType=SUBTOTAL` | `T1-SUBTOTAL-FIG3` | Figure 3 primary HPV | `evaluateHysterectomyPathway()` | Code branch present |
| Post-hyst HPV not detected | HPV test indicated + not detected | `T1-POST-HYST-HPV-NOT-DETECTED-NO-FURTHER` | No further screening | `evaluateHysterectomyPathway()` | Code branch present |
| Post-hyst HPV detected | HPV test indicated + HPV detected | `T1-POST-HYST-HPV-DETECTED-FIG3` | Figure 3 | `evaluateHysterectomyPathway()` | Code branch present |
| Missing history/pathology | Missing prior history/specimen pathology | `T1-HYSTERECTOMY-HISTORY-REQUIRED` | Insufficient external history/pathology | `evaluateHysterectomyPathway()` | Code branch present |
| Unmapped history/specimen combination | Outside implemented row logic | `T1-UNMAPPED-HYSTERECTOMY-BRANCH` | Clinician review | `evaluateHysterectomyPathway()` | Code branch present |

### Figure 9 - Pregnancy

Source: `evaluateFigure9()` in `lib/engine/decision-engine.ts`.

Qualifying cytology values currently implemented: `ASC_H`, `HSIL`, `AIS`, `AG1`, `AG2`, `AG3`, `AG4`, `AG5`, `AC1`, `AC2`, `AC3`, `AC4`.

| Branch condition | Required inputs | Recommendation code | Implemented outcome | Source function/file | Test coverage |
|---|---|---|---|---|---|
| Pregnancy not confirmed | Missing/false `isPregnant` for explicit Figure 9 | `F9-PREGNANCY-REQUIRED` | Insufficient information | `evaluateFigure9()` | `figure9.test.ts` |
| Cytology not qualifying | Pregnant but cytology not in qualifying list | `F9-QUALIFYING-CYTOLOGY-REQUIRED` | Insufficient information | `evaluateFigure9()` | `figure9.test.ts` |
| Pregnant with qualifying cytology and no colposcopy findings | Qualifying cytology; no colpo assessment | `F9-INITIAL-COLPOSCOPY` | Initial colposcopy | `evaluateFigure9()` | `figure9.test.ts`, `wizard-integration.test.ts` |
| Normal TZ/no lesion, MDM missing | Normal TZ/no lesion/normal colposcopy | `F9-NORMAL-TZ-MDM` | MDM required | `evaluateFigure9()` | `figure9.test.ts` |
| MDM downgraded negative | Normal/no lesion + `DOWNGRADED_NEGATIVE` | `F9-MDM-DOWNGRADED-NEGATIVE-FIG3` | Follow Figure 3 | `evaluateFigure9()` | Code branch present |
| MDM downgraded LSIL/ASC-US | Normal/no lesion + `DOWNGRADED_LSIL` or `DOWNGRADED_ASC_US_LSIL` | `F9-MDM-DOWNGRADED-LSIL` | Follow LSIL pathway | `evaluateFigure9()` | `figure9.test.ts` |
| MDM confirmed high-grade | Normal/no lesion + `CONFIRMED_HIGH_GRADE` | `F9-MDM-CONFIRMED-HIGH-GRADE-REVIEW` | Colposcopy review in 6 months or 6-12 weeks postpartum | `evaluateFigure9()` | Code branch present |
| Abnormal TZ/visible lesion with invasion impression and no biopsy | `colposcopicImpression=INVASION`, no biopsy | `F9-INVASION-IMPRESSION-BIOPSY` | Biopsy required | `evaluateFigure9()` | `figure9.test.ts` |
| Invasion biopsy positive | SCC/adenocarcinoma or positive invasion | `F9-BIOPSY-POSITIVE-INVASION-ONCOLOGY` | Refer gynaecological oncologist | `evaluateFigure9()` | `figure9.test.ts` |
| Invasion biopsy negative | Invasion impression with non-invasive biopsy | `F9-BIOPSY-NEGATIVE-INVASION-MDM` | MDM required | `evaluateFigure9()` | Code branch present |
| Abnormal TZ/visible lesion with LSIL/HSIL/AIS impression | Impression `LSIL`, `HSIL`, or `AIS` | `F9-ABNORMAL-TZ-REVIEW` | Colposcopy review in 6 months or 6-12 weeks postpartum | `evaluateFigure9()` | `figure9.test.ts` |
| Unmapped colposcopy state | Outside above | `F9-UNMAPPED-COLPOSCOPY-STATE` | Clinician review | `evaluateFigure9()` | Code branch present |

### Figure 10 - Abnormal Vaginal Bleeding

Source: `evaluateFigure10()` in `lib/engine/decision-engine.ts`.

| Branch condition | Required inputs | Recommendation code | Implemented outcome | Source function/file | Test coverage |
|---|---|---|---|---|---|
| Cancer symptoms present | `hasCancerSymptoms=true` | `F10-CANCER-SYMPTOMS-URGENT-GYN` | Urgent gynaecological assessment without delay | `evaluateFigure10()` | `figure10.test.ts`, `routing-precedence.test.ts`, `wizard-integration.test.ts` |
| 6-8 week review, resolution missing | `abnormalBleedingStage=SIX_TO_EIGHT_WEEK_REVIEW`, missing `bleedingResolved` | `F10-REVIEW-RESOLUTION-REQUIRED` | Insufficient information | `evaluateFigure10()` | Code branch present |
| 6-8 week review, bleeding resolved | `bleedingResolved=true` | `F10-REVIEW-RESOLVED-SCREENING` | Continue regular cervical screening if age >= 25, or commence at 25 | `evaluateFigure10()` | `figure10.test.ts` |
| 6-8 week review, bleeding unresolved | `bleedingResolved=false` | `F10-REVIEW-UNRESOLVED-GYNAECOLOGY` | Refer gynaecology | `evaluateFigure10()` | `figure10.test.ts` |
| Initial workup incomplete or cervix assessment missing | `abnormalCervix` undefined | `F10-INITIAL-ASSESSMENT` | Complete menstrual/contraceptive/sexual history, speculum/pelvic exam, co-test, cervix assessment | `evaluateFigure10()` | `figure10.test.ts` |
| Abnormal cervix, suspicion missing | `abnormalCervix=true`, missing suspicion | `F10-SUSPICION-REQUIRED` | Insufficient information | `evaluateFigure10()` | Code branch present |
| Abnormal cervix + suspicion of cancer | `abnormalCervix=true`, `suspicionOfCancer=true` | `F10-ABNORMAL-CERVIX-CANCER-COTEST-COLP` | Co-test and colposcopy | `evaluateFigure10()` | Code branch present |
| Abnormal cervix + no suspicion | `abnormalCervix=true`, `suspicionOfCancer=false` | `F10-ABNORMAL-CERVIX-NO-CANCER-REVIEW` | Treat per Healthcare Pathways or refer gynaecology; review 6-8 weeks | `evaluateFigure10()` | `figure10.test.ts` |
| Normal cervix, OCP status missing | `abnormalCervix=false`, missing OCP status | `F10-OCP-STATUS-REQUIRED` | Insufficient information | `evaluateFigure10()` | Code branch present |
| Normal cervix + suspected OCP issue | `suspectOralContraceptiveProblem=true` | `F10-OCP-ADJUST-REVIEW` | Adjust oral contraceptive and review 6-8 weeks | `evaluateFigure10()` | Code branch present |
| Normal cervix + no OCP issue, STI status missing | `suspectOralContraceptiveProblem=false`, missing STI | `F10-NORMAL-CERVIX-INVESTIGATE` | Investigations per Healthcare Pathways/local gynaecology, including STI assessment | `evaluateFigure10()` | Code branch present |
| STI identified | `stiIdentified=true` | `F10-STI-TREAT-REVIEW` | Treat STI and review in 6-8 weeks | `evaluateFigure10()` | Code branch present |
| No STI | `stiIdentified=false` | `F10-NO-STI-HEALTHCARE-PATHWAYS` | Manage according to Healthcare Pathways or refer gynaecology | `evaluateFigure10()` | Code branch present |

## 8. Entry-Branch Validation Matrix

| Figure/Table | Direct HPV / Molecular Screening | GP / Routine Clinical Care / Specialist | Both | Notes |
|---|---:|---:|---:|---|
| Figure 1 | No | Yes | No | Direct HPV skips transition invitation and starts at current HPV result flow |
| Figure 2 | No | Yes | No | Previous history fields live under GP/clinical transition path |
| Figure 3 | Yes | Yes | Yes | Direct HPV defaults here; GP/clinical reaches it through routine, subtotal, or result workflows |
| Figure 4 | No | Yes | No | Requires post-normal colposcopy low-grade repeat context |
| Figure 5 | No | Yes | No | Requires high-grade post-normal colposcopy repeat context/MDM |
| Figure 6 | No | Yes | No | Test of Cure question is GP/clinical only |
| Figure 7 | No | Yes | No | Glandular cytology path is GP/clinical result/specialist context |
| Figure 8 | No | Yes | No | Hysterectomy questions are GP/clinical only |
| Figure 9 | No | Yes | No | Pregnancy question requires cytology context under GP/clinical |
| Figure 10 | No | Yes | No | Abnormal bleeding/symptom path is GP/clinical only |
| Table 1 | No | Yes | No | Explicit Table 1 engine route or prior AIS post-hysterectomy logic |

## 9. Session Isolation And Repeat-Run Behaviour

Source: `app/api/pathway/sessions/route.ts`, `getVisibleAnswerMap()` in `lib/wizard/steps.ts`, completion route counter defaults.

Current start modes:
- `clean`: creates a fresh `WizardSession` with no imported answers. Summary says previous answers were not imported.
- `resume`: resumes the latest incomplete session for that patient and user; this intentionally retains previous answers in that incomplete session.
- `import`: explicitly imports answers from patient data through `autofillFromPatient()`.

Current same-patient repeat-run behaviour:
- A new clean assessment creates a new `WizardSession.id`.
- Old wizard answers are not copied.
- Old recommendation codes are not copied.
- Previous HPV/cytology/sample, ToC, pregnancy, bleeding, colposcopy, hysterectomy, repeat context, MDM, and recommendation state do not carry over into the new clean run.
- Completion creates a fresh `ScreeningSession`.
- Completion counters (`consecutiveNegativeCoTestCount`, `consecutiveLowGradeCount`, `unsatisfactoryCytologyCount`) are initialized to zero in the wizard completion route.
- Old sessions remain in database history/audit.
- Final output displays assessment run timestamp and short session ID in `app/(app)/pathway/[sessionId]/result/page.tsx`.
- `WIZARD_COMPLETE` and `FINAL_RECOMMENDATION_GENERATED` audit records contain independent `inputFacts` for that run.

## 10. Back Button / Navigation Behaviour

Source: `app/(app)/pathway/[sessionId]/page.tsx`, `getInvalidatedAnswerStepIds()`, `getVisibleSteps()`, `getNextUnansweredStep()`.

Current behaviour:
- Back does not leave the wizard when there is a previous visible answered step.
- The client finds the current visible step index, walks backward through `allSteps`, and selects the previous visible answered step.
- The previous answer is loaded from `answersMap` and re-selected in the UI.
- If an answer is changed, the answer API calls `getInvalidatedAnswerStepIds()`.
- Hidden answers are removed.
- If an existing answer changes, all later wizard-order answers are removed even when still visible, so the user reconfirms downstream answers.
- `getVisibleAnswerMap()` is used at finalization to rebuild answers in wizard order and drop stale hidden branch answers.
- Special preservation exists for cytology in later clinical contexts (Test of Cure and Figure 5) and SWAB return status for HPV Other.

## 11. Audit And Persistence Behaviour

Source: session start route, answer route, completion route, `prisma/schema.prisma`.

Audit events:
- `NEW_ASSESSMENT_STARTED`: created when a clean or import session starts.
- `PREVIOUS_SESSION_NOT_IMPORTED`: created for clean starts.
- `PREVIOUS_SESSION_IMPORTED`: created for import starts.
- `ASSESSMENT_RESUMED`: created when an incomplete session is resumed.
- `CONSENT_CONFIRMED`: created when `consent_confirmed=true` is saved.
- `WIZARD_COMPLETE`: created after decision evaluation with `decisionCode`, figure, risk, rule version, branch path, validation status, patient ID, and `inputFacts`.
- `FINAL_RECOMMENDATION_GENERATED`: created after decision evaluation with patient ID, wizard session ID, screening session ID, decision code, figure, and `inputFacts`.

Persistence:
- `WizardSession`: stores status, patient, creator, started/completed timestamps, decision JSON, determined figure, and linked `screeningSessionId`.
- `WizardAnswer`: stores one answer per `wizardSessionId + stepId`; updates replace the answer and pruning deletes invalidated downstream answers.
- `ScreeningSession`: created on completion; stores status, figure, rule version, risk, recommendation text, recommendation code, next due date, and counters.
- `TestResult`: created if HPV or cytology exists; stores sample type, HPV result, HPV boolean flags, cytology, histology, TZ type.
- `ColposcopyFinding`: created if colposcopy facts are present; stores TZ, visible lesion, colposcopic impression including AIS, biopsy result, MDM state, and TZ-state notes.
- `Referral`: created when engine says referral required and priority exists.
- `Recall`: created when engine says recall required, interval exists, and the patient has a GP practice.
- `PathwayStateHistory`: always created on completion; stores previous active module from latest active/recalled screening session if any, target figure, recommendation code, user, and risk.

Known persistence limitations:
- Recall creation depends on `patient.gpPracticeId`.
- `inputFacts` are stored in audit JSON, not in a dedicated structured `ClinicalInput` table.
- Direct external NCSR integration is not represented; external history dependencies remain manual/clinical review.

## 12. Test Coverage Summary

Current test command runs all `lib/engine/__tests__/*.test.ts` files.

| Test file | Test name | Scenario | Expected code | Current status |
|---|---|---|---|---|
| `figure1.test.ts` | Figure 1 invites never screened participants now without requiring HPV result | Never screened transition | `F1-INVITE-NOW` | Passing |
| `figure1.test.ts` | Figure 1 invites regular screening with completed Test of Cure at next scheduled visit | Regular transition after ToC | `F1-INVITE-NEXT-SCHEDULED` | Passing |
| `figure1.test.ts` | Figure 1 returns external history required when screening status is unknown | Unknown transition status | `F1-EXTERNAL-HISTORY-REQUIRED` | Passing |
| `figure2.test.ts` | Figure 2 sends outstanding recommended colposcopy to colposcopy | Outstanding previous colposcopy | `F2-PRIOR-HG-COLP` | Passing |
| `figure2.test.ts` | Figure 2 sends prior high-grade with incomplete ToC to Test of Cure | Incomplete ToC history | `F2-PRIOR-HG-COMPLETE-TOC` | Passing |
| `figure2.test.ts` | Figure 2 routes atypical endometrial cells older than 3 years to Figure 3 | AG2 older than 3 years | `F2-AG2-OLDER-3Y-FIG3` | Passing |
| `figure2.test.ts` | Figure 2 routes atypical endometrial cells returned to 3-yearly cytology to Figure 3 | AG2 returned to 3-yearly cytology | `F2-AG2-RETURNED-3Y-CYTOLOGY-FIG3` | Passing |
| `figure2.test.ts` | Figure 2 routes atypical endometrial cells otherwise to specialist gynaecology | AG2 otherwise | `F2-AG2-SPECIALIST-GYN` | Passing |
| `figure2.test.ts` | Figure 2 marks previous AIS/no hysterectomy as service-defined post-treatment follow-up | AIS no hysterectomy | `F2-AIS-R208-FOLLOWUP` | Passing |
| `figure3.test.ts` | Figure 3 returns HPV not detected to 5 years, or 3 years if immune deficient | HPV not detected recall intervals | `F3-HPV-NOT-DETECTED-5Y` / `F3-HPV-NOT-DETECTED-IC-3Y` | Passing |
| `figure3.test.ts` | Figure 3 routes HPV 16/18 to colposcopy even when cytology is pending | HPV16/18 no cytology | `F3-1618-COLP` | Passing |
| `figure3.test.ts` | Figure 3 requires a return visit for HPV detected on swab before cytology-dependent decision | HPV Other SWAB no return | `F3-SWAB-RETURN-REQUIRED` | Passing |
| `figure3.test.ts` | Figure 3 HPV 16/18 on swab routes to colposcopy without generic swab-return block | HPV16/18 SWAB | `F3-1618-COLP` | Passing |
| `figure3.test.ts` | Figure 3 baseline HPV Other with ASC-US/LSIL schedules first repeat | HPV Other low-grade baseline | `F3-HPV-OTHER-NEG-ASCUS-LSIL-12M` | Passing |
| `figure3.test.ts` | Figure 3 first repeat HPV Other low-grade cytology routes by age | First repeat age split | `F3-FIRST-REPEAT-AGE50-COLP` / `F3-FIRST-REPEAT-UNDER50-SECOND-REPEAT` | Passing |
| `figure3.test.ts` | Figure 3 second repeat HPV detected any type routes to colposcopy | Second repeat HPV detected | `F3-SECOND-REPEAT-HPV-DETECTED-COLP` | Passing |
| `figure4.test.ts` | Figure 4 initial normal colposcopy schedules repeat HPV in 12 months | Initial normal colpo | `F4-NORMAL-COLP-REPEAT-HPV-12M` | Passing |
| `figure4.test.ts` | Figure 4 repeat HPV not detected returns to regular screening | Repeat HPV negative | `F4-REPEAT-HPV-NOT-DETECTED-REGULAR` | Passing |
| `figure4.test.ts` | Figure 4 repeat HPV 16/18 routes to colposcopy | Repeat HPV16/18 | `F4-REPEAT-1618-COLP` | Passing |
| `figure4.test.ts` | Figure 4 HPV Other with high-grade cytology routes to colposcopy | HPV Other high-grade | `F4-HPV-OTHER-HIGH-GRADE-COLP` | Passing |
| `figure4.test.ts` | Figure 4 HPV Other low-grade cytology routes immune deficient participants to colposcopy | Immune deficient Figure 4 | `F4-HPV-OTHER-LOW-GRADE-IC-COLP` | Passing |
| `figure4.test.ts` | Figure 4 second repeat HPV detected any type routes to colposcopy | Second repeat | `F4-SECOND-REPEAT-HPV-DETECTED-COLP` | Passing |
| `figure5.test.ts` | Figure 5 requires MDM before downstream management | Missing MDM | `F5-MDM-REQUIRED` | Passing |
| `figure5.test.ts` | Figure 5 MDM downgraded LSIL follows LSIL pathway | MDM downgrade | `F5-MDM-DOWNGRADED-LSIL` | Passing |
| `figure5.test.ts` | Figure 5 MDM upgraded HSIL recommends treatment | MDM upgrade | `F5-MDM-UPGRADED-HSIL-TREAT` | Passing |
| `figure5.test.ts` | Figure 5 confirmed ASC-H HPV not detected with no lesion routes to Test of Cure/co-testing | ASC-H HPV negative | `F5-CONFIRMED-ASCH-HPV-NEG-NO-LESION-TOC` | Passing |
| `figure5.test.ts` | Figure 5 confirmed ASC-H HPV detected normal colposcopy negative cytology repeats in 12 months | ASC-H repeat branch | `F5-CONFIRMED-ASCH-HPV-DETECTED-NORMAL-NEG-12M` | Passing |
| `figure5.test.ts` | Figure 5 confirmed ASC-H does not use HPV detected alone as treatment trigger | Unsafe broad rule regression | `F5-CONFIRMED-ASCH-RESULTS-REQUIRED` | Passing |
| `figure6.test.ts` | Figure 6 first negative co-test repeats in 12 months | First negative ToC | `F6-FIRST-NEGATIVE-REPEAT-12M` | Passing |
| `figure6.test.ts` | Figure 6 second negative co-test returns to regular screening | Second negative ToC | `F6-SECOND-NEGATIVE-RETURN-REGULAR` | Passing |
| `figure6.test.ts` | Figure 6 HPV detected any type routes to colposcopy, including first HPV Other | HPV detected ToC | `F6-HPV-DETECTED-ANY-CYTOLOGY-COLP` | Passing |
| `figure6.test.ts` | Figure 6 HPV 16/18 and HPV Other route to colposcopy across cytology classes | HPV detected across cytology | `F6-HPV-DETECTED-ANY-CYTOLOGY-COLP` | Passing |
| `figure6.test.ts` | Figure 6 HPV not detected with low-grade cytology repeats in 12 months | Low-grade ToC | `F6-HPV-NEG-LOW-GRADE-REPEAT-12M` | Passing |
| `figure6.test.ts` | Figure 6 repeat HPV not detected with abnormal cytology routes to colposcopy | Repeat abnormal ToC | `F6-REPEAT-HPV-NEG-CYTOLOGY-ABNORMAL-COLP` | Passing |
| `figure6.test.ts` | Figure 6 continuing Test of Cure HPV not detected with negative cytology continues until complete | Continuing ToC | `F6-CONTINUE-TOC-UNTIL-COMPLETE` | Passing |
| `figure6.test.ts` | Figure 6 HPV not detected with high-grade cytology routes to colposcopy | High-grade ToC | `F6-HPV-NEG-HIGH-GRADE-COLP` | Passing |
| `figure7.test.ts` | Figure 7 routes AG2 and AC2 to gynaecology | AG2/AC2 | `F7-AG2-GYNAECOLOGY` / `F7-AC2-GYNAECOLOGY` | Passing |
| `figure7.test.ts` | Figure 7 routes AC3/AC4 to colposcopy rather than gynaecology | AC3/AC4 | `F7-GLANDULAR-COLPOSCOPY` | Passing |
| `figure7.test.ts` | Figure 7 visible lesion requires biopsy, then AIS goes to type 3 excision and cancer to oncology | Biopsy branches | `F7-VISIBLE-LESION-BIOPSY`, `F7-BIOPSY-AIS-TYPE3-EXCISION`, `F7-BIOPSY-CANCER-ONCOLOGY` | Passing |
| `figure7.test.ts` | Figure 7 no visible lesion requires MDM and supports source MDM outcomes | MDM branches | `F7-NO-LESION-MDM`, `F7-MDM-CONFIRMED-NOT-AG2-TYPE3`, etc. | Passing |
| `figure7.test.ts` | Figure 7 missing visible lesion returns missing information instead of inferring from impression | Missing visible lesion | `F7-VISIBLE-LESION-REQUIRED` | Passing |
| `figure8.test.ts` | Figure 8 known returned-regular history with no pathology needs no further screening | Low-risk no pathology | `F8-NEG-RETURNED-NO-PATH-NO-FURTHER` | Passing |
| `figure8.test.ts` | Figure 8 LSIL/CIN1 specimen with low-risk history routes to HPV test/Figure 3 | Low-risk LSIL | `F8-NEG-RETURNED-LSIL-HPV` | Passing |
| `figure8.test.ts` | Figure 8 LSIL/CIN1 specimen with untreated/incomplete HSIL/AIS history routes to Test of Cure | Untreated history LSIL | `F8-UNTREATED-HSIL-AIS-NO-PATH-LOWGRADE-TOC` | Passing |
| `figure8.test.ts` | Figure 8 high-grade specimen routes by excision completeness | Complete/incomplete excision | `F8-HSIL-AIS-COMPLETE-TOC` / `F8-HSIL-AIS-INCOMPLETE-COLP` | Passing |
| `figure8.test.ts` | Figure 8 post-hysterectomy HPV test uses no further screening / Figure 3 outcomes | Post-hyst HPV result | `F8-POST-HYST-HPV-NOT-DETECTED-NO-FURTHER` / `F8-POST-HYST-HPV-DETECTED-FIG3` | Passing |
| `figure9.test.ts` | Figure 9 applies only to pregnant participants with qualifying cytology | Qualification guard | `F9-PREGNANCY-REQUIRED` | Passing |
| `figure9.test.ts` | Figure 9 initial pregnant high-grade cytology routes to colposcopy | Initial pregnancy path | `F9-INITIAL-COLPOSCOPY` | Passing |
| `figure9.test.ts` | Figure 9 qualifying cytology categories route pregnant participants to initial colposcopy | Qualifying list | `F9-INITIAL-COLPOSCOPY` | Passing |
| `figure9.test.ts` | Figure 9 normal TZ/no lesion requires MDM | Normal TZ/no lesion | `F9-NORMAL-TZ-MDM` | Passing |
| `figure9.test.ts` | Figure 9 MDM downgraded to LSIL/ASC-US follows LSIL pathway | MDM downgrade | `F9-MDM-DOWNGRADED-LSIL` | Passing |
| `figure9.test.ts` | Figure 9 invasion impression requires biopsy before oncology | Invasion impression | `F9-INVASION-IMPRESSION-BIOPSY` | Passing |
| `figure9.test.ts` | Figure 9 biopsy positive for invasion routes to oncology | Positive invasion biopsy | `F9-BIOPSY-POSITIVE-INVASION-ONCOLOGY` | Passing |
| `figure9.test.ts` | Figure 9 abnormal TZ LSIL/HSIL/AIS impression routes to colposcopy review | Abnormal TZ impressions | `F9-ABNORMAL-TZ-REVIEW` | Passing |
| `figure10.test.ts` | Figure 10 cancer symptoms cause urgent gynaecology assessment | Cancer symptoms | `F10-CANCER-SYMPTOMS-URGENT-GYN` | Passing |
| `figure10.test.ts` | Figure 10 initial assessment asks for workup facts | Initial workup | `F10-INITIAL-ASSESSMENT` | Passing |
| `figure10.test.ts` | Figure 10 abnormal cervix without cancer creates 6-8 week review without same-run resolution | Abnormal cervix no cancer | `F10-ABNORMAL-CERVIX-NO-CANCER-REVIEW` | Passing |
| `figure10.test.ts` | Figure 10 review resolved returns to regular screening without hard-coded 36 month recall | Resolved bleeding | `F10-REVIEW-RESOLVED-SCREENING` | Passing |
| `figure10.test.ts` | Figure 10 review unresolved routes to gynaecology | Unresolved bleeding | `F10-REVIEW-UNRESOLVED-GYNAECOLOGY` | Passing |
| `routing-precedence.test.ts` | Routing precedence sends abnormal bleeding under age 25 to Figure 10 instead of routine age gate | Precedence | `F10-CANCER-SYMPTOMS-URGENT-GYN` | Passing |
| `routing-precedence.test.ts` | Routing precedence sends Test of Cure state to Figure 6 before glandular cytology | Precedence | `F6-HPV-DETECTED-ANY-CYTOLOGY-COLP` | Passing |
| `routing-precedence.test.ts` | Routing precedence sends first transition glandular cytology to Figure 7 unless Figure 2 history applies | Precedence | `F7-GLANDULAR-COLPOSCOPY` | Passing |
| `routing-precedence.test.ts` | Routing precedence sends total hysterectomy to Figure 8/Table 1 logic | Precedence | `F8-NO-HISTORY-NO-PATH-LOWGRADE-HPV-6M` | Passing |
| `table1.test.ts` | Table 1 negative/returned regular history with no pathology needs no further screening | Table 1 low-risk no pathology | `T1-NEG-RETURNED-NO-PATH-NO-FURTHER` | Passing |
| `table1.test.ts` | Table 1 previous ASC-US/LSIL not returned with low-grade specimen follows Figure 3 after HPV test | Table 1 low-grade not returned | `T1-LOWGRADE-NOT-RETURNED-LSIL-HPV` | Passing |
| `table1.test.ts` | Table 1 complete vs incomplete high-grade excision routes to ToC or colposcopy | Table 1 excision | `T1-HSIL-AIS-COMPLETE-TOC` / `T1-HSIL-AIS-INCOMPLETE-COLP` | Passing |
| `table1.test.ts` | Table 1 incomplete Test of Cure with no/low-grade pathology continues Test of Cure | Incomplete ToC | `T1-INCOMPLETE-TOC-NO-PATH-LOWGRADE-TOC` | Passing |
| `table1.test.ts` | Table 1 no known screening history with no/low-grade pathology schedules HPV at 6 months post hysterectomy | No known history | `T1-NO-HISTORY-NO-PATH-LOWGRADE-HPV-6M` | Passing |
| `table1.test.ts` | Table 1 untreated/incompletely treated HSIL/AIS with low-grade pathology routes to Test of Cure | Untreated/incomplete history | `T1-UNTREATED-HSIL-AIS-NO-PATH-LOWGRADE-TOC` | Passing |
| `table1.test.ts` | Table 1 unknown high-grade excision status requires review rather than guessing | Unknown excision | `T1-HSIL-AIS-EXCISION-UNKNOWN-REVIEW` | Passing |
| `wizard-flow.test.ts` | wizard keeps later answers when the same answer is submitted again | Same answer no pruning | N/A | Passing |
| `wizard-flow.test.ts` | wizard invalidates later answers when an earlier answer changes even if they remain visible | Changed answer pruning | N/A | Passing |
| `wizard-flow.test.ts` | wizard invalidates answers from branches that become hidden | Hidden branch pruning | N/A | Passing |
| `wizard-flow.test.ts` | wizard finalization ignores hidden stale branch answers | Final visible answer map | N/A | Passing |
| `wizard-integration.test.ts` | Wizard/API completion mapping: Figure 3 HPV 16/18 swab bypasses return-visit block without cytology | Direct HPV SWAB HPV16/18 | `F3-1618-COLP` | Passing |
| `wizard-integration.test.ts` | Wizard/API completion mapping: Figure 3 HPV 16/18 LBC bypasses cytology requirement | Direct HPV LBC HPV16/18 | `F3-1618-COLP` | Passing |
| `wizard-integration.test.ts` | Wizard/API completion mapping: Figure 3 HPV 16/18 ignores stale swab-return answer | Stale swab answer pruned | `F3-1618-COLP` | Passing |
| `wizard-integration.test.ts` | Wizard/API completion mapping: Figure 3 HPV Other swab still requires return visit | HPV Other SWAB | `F3-SWAB-RETURN-REQUIRED` | Passing |
| `wizard-integration.test.ts` | Wizard/API completion mapping: Figure 3 HPV Other high-grade cytology routes to colposcopy | HPV Other HSIL | `F3-HPV-OTHER-HIGH-GRADE-COLP` | Passing |
| `wizard-integration.test.ts` | Wizard UI flow: cytology is hidden after HPV 16/18 and inadequate options are hidden | UI visibility | N/A | Passing |
| `wizard-integration.test.ts` | Wizard UI flow: consent gate blocks clinical questions until confirmed | Consent gate | N/A | Passing |
| `wizard-integration.test.ts` | Wizard UI flow: entry pathway selection routes Direct HPV and clinical care differently | Entry branch | N/A | Passing |
| `wizard-integration.test.ts` | Wizard UI flow: Back target is previous visible answered step and changed answers prune future branch answers | Back/pruning | N/A | Passing |
| `wizard-integration.test.ts` | Wizard/API completion mapping: Figure 5 confirmed ASC-H HPV detected normal colposcopy negative cytology repeats | Figure 5 repeat | `F5-CONFIRMED-ASCH-HPV-DETECTED-NORMAL-NEG-12M` | Passing |
| `wizard-integration.test.ts` | Wizard/API completion mapping: Figure 5 confirmed ASC-H abnormal cytology recommends treatment | Figure 5 abnormal cytology | `F5-CONFIRMED-ASCH-TREAT` | Passing |
| `wizard-integration.test.ts` | Wizard/API completion mapping: Figure 5 confirmed ASC-H visible lesion recommends treatment | Figure 5 visible lesion | `F5-CONFIRMED-ASCH-TREAT` | Passing |
| `wizard-integration.test.ts` | Wizard/API completion mapping: Figure 6 first negative Test of Cure repeats in 12 months | ToC first negative | `F6-FIRST-NEGATIVE-REPEAT-12M` | Passing |
| `wizard-integration.test.ts` | Wizard/API completion mapping: Figure 6 second negative Test of Cure returns to regular screening | ToC second negative | `F6-SECOND-NEGATIVE-RETURN-REGULAR` | Passing |
| `wizard-integration.test.ts` | Wizard/API completion mapping: Figure 6 repeat HPV negative with abnormal cytology routes to colposcopy | ToC repeat abnormal | `F6-REPEAT-HPV-NEG-CYTOLOGY-ABNORMAL-COLP` | Passing |
| `wizard-integration.test.ts` | Wizard/API completion mapping: Figure 8 low-risk returned history with LSIL/CIN1 routes to HPV/Figure 3 branch | Figure 8 low-risk LSIL | `F8-NEG-RETURNED-LSIL-HPV` | Passing |
| `wizard-integration.test.ts` | Wizard/API completion mapping: Figure 8 untreated/incomplete HSIL/AIS with LSIL/CIN1 routes to Test of Cure | Figure 8 untreated LSIL | `F8-UNTREATED-HSIL-AIS-NO-PATH-LOWGRADE-TOC` | Passing |
| `wizard-integration.test.ts` | Wizard/API completion mapping: Table 1 no known history with no pathology schedules HPV at 6 months | Table 1 no known | `F8-NO-HISTORY-NO-PATH-LOWGRADE-HPV-6M` | Passing |
| `wizard-integration.test.ts` | Wizard/API completion mapping: Figure 9 pregnant qualifying cytology without colposcopy findings routes to initial colposcopy | Pregnancy initial | `F9-INITIAL-COLPOSCOPY` | Passing |
| `wizard-integration.test.ts` | Wizard/API completion mapping: Figure 10 abnormal bleeding with cancer symptoms routes to urgent gynaecology | Bleeding cancer symptoms | `F10-CANCER-SYMPTOMS-URGENT-GYN` | Passing |
| `wizard-integration.test.ts` | Wizard/API completion mapping preserves Figure 2 returned-to-3-yearly-cytology field | Mapping field survival | `F2-AG2-RETURNED-3Y-CYTOLOGY-FIG3` | Passing |
| `wizard-integration.test.ts` | Wizard/API completion mapping preserves all completion-route clinical fields | Mapping field survival | `F5-CONFIRMED-ASCH-HPV-DETECTED-NORMAL-NEG-12M` | Passing |
| `wizard-integration.test.ts` | Session isolation: same patient Run 2 does not retain HPV Other swab-return result | Repeated same-patient HPV runs | `F3-SWAB-RETURN-REQUIRED` then `F3-1618-COLP` | Passing |
| `wizard-integration.test.ts` | Session isolation: new primary HPV run does not retain previous Test of Cure stage | Repeated same-patient ToC then primary | `F6-SECOND-NEGATIVE-RETURN-REGULAR` then `F3-HPV-NOT-DETECTED-5Y` | Passing |
| `wizard-integration.test.ts` | Session isolation: new uterus-intact run does not retain hysterectomy fields | Repeated hysterectomy then primary | `F8-UNTREATED-HSIL-AIS-NO-PATH-LOWGRADE-TOC` then `F3-HPV-NOT-DETECTED-5Y` | Passing |
| `wizard-integration.test.ts` | Session isolation: Figure 10 priority does not remain active in new primary HPV run | Repeated bleeding then primary | `F10-CANCER-SYMPTOMS-URGENT-GYN` then `F3-HPV-NOT-DETECTED-5Y` | Passing |
| `wizard-integration.test.ts` | Session isolation: pregnancy state and high-grade cytology do not remain active in new primary HPV run | Repeated pregnancy then primary | `F9-INITIAL-COLPOSCOPY` then `F3-HPV-NOT-DETECTED-5Y` | Passing |
| `visual-labels.test.ts` | visual decision tree titles remain clinically named and marked under validation | Visual diagram non-authoritative labels | N/A | Passing |
| `visual-labels.test.ts` | pathway labels avoid internal source numbering | Display labels | N/A | Passing |

## 13. Known Limitations / Items Requiring Clinical Sign-Off

- This document and the app are implementation artifacts for review only, not approved clinical protocol.
- Visual diagrams are simplified and non-authoritative. Engine output is source of truth.
- Some visual diagrams still contain legacy/simplified node labels and codes that do not match the current engine codes exactly.
- HPV `INADEQUATE` and cytology/histology `UNSATISFACTORY` remain in backend types/schema for compatibility, but HPV inadequate and cytology unsatisfactory are hidden from active demo HPV/cytology wizard options.
- Cytology N/A/not required after HPV16/18 is implemented by hiding cytology rather than showing an explicit N/A option.
- Healthcare Pathways/local gynaecology branches in Figure 10 require local clinical interpretation.
- NCSR/external history is not live; external history dependencies are manual and often return insufficient information or clinician review.
- `F2-AIS-R208-FOLLOWUP` is marked as clinician review/service-defined because the referenced R2.08 workflow is not fully encoded.
- Several unmapped or missing-input branches intentionally return insufficient information or clinician review rather than guessing.
- Completion route persists `inputFacts` in audit JSON; there is not a dedicated structured `ClinicalInput` persistence table.
- Age gates apply after symptomatic, pregnancy, and hysterectomy routing; clinical reviewers should confirm this product ordering.
- Direct HPV branch intentionally limits visible questions to primary screening inputs and does not expose history/symptom/specialist contexts.

## 14. Final Confirmation Checklist

- [ ] Direct HPV branch reviewed
- [ ] GP/routine/specialist branch reviewed
- [ ] HPV16/18 direct colposcopy reviewed
- [ ] HPV Other cytology handling reviewed
- [ ] Figure 1 reviewed
- [ ] Figure 2 reviewed
- [ ] Figure 3 reviewed
- [ ] Figure 4 reviewed
- [ ] Figure 5 reviewed
- [ ] Figure 6 reviewed
- [ ] Figure 7 reviewed
- [ ] Figure 8 reviewed
- [ ] Figure 9 reviewed
- [ ] Figure 10 reviewed
- [ ] Table 1 reviewed
- [ ] Session isolation reviewed
- [ ] Consent gate reviewed
- [ ] Back navigation reviewed
- [ ] Audit trail reviewed
- [ ] Clinical sign-off pending
