# Implemented Cervical Screening Decision Tree

Prepared for clinical review of the demo app at `https://screening.privexa.co`.

This document describes the decision tree currently implemented in the demo application. It is extracted from the app's wizard step definitions and deterministic decision engine. It should be treated as an implementation review document, not as a final approved clinical protocol.

## Source Of Truth In The App

- Wizard questions: `lib/wizard/steps.ts`
- Answer-to-engine mapping: `answersToInputFields()` in `lib/wizard/steps.ts`
- Deterministic decision engine: `lib/engine/decision-engine.ts`
- Visual figure summaries: `lib/decision-trees/index.ts`

## High-Level Routing Order

The decision engine applies this precedence:

1. Abnormal vaginal bleeding / Figure 10
2. Pregnancy with qualifying high-grade or glandular cytology / Figure 9
3. Table 1 explicit post-hysterectomy pathway
4. Total hysterectomy / Figure 8
5. Routine age gates: under 25, age 70-74, age 75+
6. Figure 2 explicit previous high-grade/glandular/endometrial history
7. Figure 1 explicit first HPV transition invitation
8. First HPV transition, routed to Figure 2 if high-risk history exists, otherwise Figure 1
9. Test of Cure / Figure 6
10. Glandular cytology / Figure 7
11. Post-normal colposcopy after high-grade cytology / Figure 5
12. Post-normal colposcopy after low-grade cytology / Figure 4
13. Primary HPV screening / Figure 3

## Exact Wizard Questions And Answers

The app only shows questions when their visibility condition is met. The text below is the actual implemented question and answer set.

### Initial Patient And Consent

| ID | Question | Answers |
|---|---|---|
| `patient_context` | Review patient details | Information screen only |
| `consent_confirmed` | Has the patient been informed and provided consent for cervical screening data entry? | `true`: Yes - consent confirmed; `false`: No - consent not confirmed |

If consent is not confirmed, the clinical pathway questions do not proceed.

### Hysterectomy / Vault Pathway Entry

| ID | Question | Answers |
|---|---|---|
| `is_post_hysterectomy` | Has this patient had a hysterectomy? | `true`: Yes - hysterectomy performed; `false`: No - uterus intact |
| `hysterectomy_type` | What type of hysterectomy did the patient have? | `TOTAL`: Total hysterectomy - uterus and cervix removed; `SUBTOTAL`: Subtotal hysterectomy - cervix retained |
| `prior_screening_history` | What prior screening history applies for this total hysterectomy pathway? | `NEGATIVE_OR_NORMAL`; `LOW_GRADE_RETURNED_TO_REGULAR`; `LOW_GRADE_NOT_RETURNED_TO_REGULAR`; `HIGH_GRADE_TOC_COMPLETE`; `HSIL_AIS_UNTREATED_OR_INCOMPLETELY_TREATED`; `HIGH_GRADE_TOC_INCOMPLETE`; `PREVIOUS_ATYPICAL_GLANDULAR`; `NO_KNOWN_SCREENING_HISTORY` |
| `hysterectomy_indication` | What was the indication for hysterectomy? | `BENIGN_GYNAECOLOGICAL_DISEASE`; `HSIL_CIN23_OR_AIS` |
| `hysterectomy_specimen_pathology` | What cervical pathology was found in the hysterectomy specimen? | `NO_CERVICAL_PATHOLOGY`; `LSIL_CIN1`; `HSIL_CIN23`; `AIS` |
| `excision_status` | Was HSIL/CIN2/3 or AIS completely excised? | `COMPLETE`; `INCOMPLETE`; `UNKNOWN` |
| `post_hysterectomy_hpv_test_indicated` | Are you entering a post-hysterectomy HPV test result now? | `true`: Yes - HPV result available; `false`: No - decide next action from history/specimen |

Key engine outcomes:

| Branch | Implemented outcome |
|---|---|
| Subtotal hysterectomy | Use standard primary HPV screening pathway / Figure 3 |
| Post-hysterectomy HPV not detected | No further screening required for this branch |
| Post-hysterectomy HPV detected | Follow Figure 3 primary HPV pathway |
| Known negative/returned-regular history and no cervical pathology | No further screening required |
| Unknown history and no cervical pathology | HPV test required |
| LSIL/CIN1 specimen | HPV test and follow Figure 3 |
| HSIL/CIN2/3 or AIS completely excised | Start or continue Test of Cure |
| HSIL/CIN2/3 or AIS incompletely excised | Refer to colposcopy |

### General Risk Modifiers And Transition Entry

| ID | Question | Answers |
|---|---|---|
| `immunocompromised` | Is this patient immunocompromised? | `true`: Yes - immunocompromised; `false`: No - immunocompetent |
| `is_first_hpv_transition` | Is this the patient's first HPV-based test after previous cytology-based screening? | `true`: Yes - first HPV test (transitioning from cytology); `false`: No - already on HPV primary screening |

Immunocompromised patients use shorter recall intervals where the engine applies routine negative recall, typically 36 months rather than 60 months.

### Figure 1 / First HPV Transition Invitation

| ID | Question | Answers |
|---|---|---|
| `screening_status` | What screening status applies for this transition decision? | `NEVER_SCREENED`; `UNDER_SCREENED`; `OVERDUE`; `REGULAR_SCREENING`; `UNKNOWN` |
| `transition_prior_history` | Which prior result category applies for the transition? | `NEGATIVE_OR_NORMAL`; `LOW_GRADE_ONLY`; `LOW_GRADE_RETURNED_TO_REGULAR`; `HIGH_GRADE_TOC_COMPLETE`; `HIGH_GRADE_TOC_INCOMPLETE`; `PREVIOUS_AIS`; `PREVIOUS_ATYPICAL_GLANDULAR`; `PREVIOUS_ATYPICAL_ENDOMETRIAL`; `UNKNOWN` |
| `history_source_available` | Is the previous screening/history source available and reliable? | `true`: Yes - source history available; `false`: No - history source unavailable |

Key engine outcomes:

| Branch | Recommendation code | Implemented outcome |
|---|---|---|
| Never screened, under-screened, or overdue | `F1-INVITE-NOW` | Invite now for HPV primary screening, then continue through Figure 3 |
| Regular screening plus normal/low-grade/completed Test of Cure history | `F1-INVITE-NEXT-SCHEDULED` | Invite at next scheduled visit, then continue through Figure 3 |
| Unknown screening status or insufficient history | `F1-EXTERNAL-HISTORY-REQUIRED` / `F1-HISTORY-DETAIL-REQUIRED` | Confirm screening status/history before selecting invitation timing |

### Figure 2 / Previous High-Grade, AIS, Glandular Or Endometrial History

| ID | Question | Answers |
|---|---|---|
| `colposcopy_recommended_last_cytology` | Did the last cytology report recommend colposcopy? | `true`: Yes - colposcopy was recommended; `false`: No - colposcopy was not recommended |
| `colposcopy_completed_last_recommendation` | Has that recommended colposcopy already occurred? | `true`: Yes - already occurred; `false`: No - has not occurred |
| `ag2_report_timing` | For previous AG2/atypical endometrial cells, when was the report? | `OLDER_THAN_3_YEARS`; `WITHIN_3_YEARS`; `UNKNOWN` |
| `specialist_discharged_to_primary_care` | Has the patient already been seen by specialist services and discharged to primary care? | `true`: Yes - discharged to primary care; `false`: No / not documented |
| `atypical_endometrial_history` | Does this patient have a history of atypical endometrial cells (AG2)? | `true`: Yes - previous AG2 / atypical endometrial cells; `false`: No - no atypical endometrial history |

Key engine outcomes:

| Branch | Recommendation code | Implemented outcome |
|---|---|---|
| Previous AIS without total hysterectomy | `F2-AIS-R208-FOLLOWUP` | Service-defined post-treatment follow-up / clinician-confirmed pathway |
| Previous atypical endometrial report older than 3 years | `F2-AG2-OLDER-3Y-FIG3` | Return to HPV primary screening / Figure 3 |
| Previous atypical endometrial history and discharged to primary care | `F2-AG2-DISCHARGED-FIG3` | Return to HPV primary screening / Figure 3 |
| Previous atypical endometrial history not returned to screening | `F2-AG2-SPECIALIST-GYN` | Refer to specialist gynaecology |
| Previous high-grade/glandular and recommended colposcopy not done | `F2-PRIOR-HG-COLP` | Refer to colposcopy |
| Previous high-grade/glandular with completed Test of Cure | `F2-PRIOR-HG-TOC-COMPLETE-FIG3` | Return to regular HPV screening / Figure 3 |
| Previous high-grade/glandular with incomplete Test of Cure | `F2-PRIOR-HG-COMPLETE-TOC` | Complete Test of Cure / Figure 6 |

### Figure 10 / Abnormal Vaginal Bleeding

| ID | Question | Answers |
|---|---|---|
| `has_abnormal_vaginal_bleeding` | Does this patient have abnormal vaginal bleeding (inter-menstrual or post-coital)? | `true`: Yes - abnormal vaginal bleeding present; `false`: No - no abnormal vaginal bleeding |
| `abnormal_bleeding_stage` | Which abnormal bleeding review stage is this? | `INITIAL_ASSESSMENT`; `SIX_TO_EIGHT_WEEK_REVIEW` |
| `has_cancer_symptoms` | Are there signs or symptoms of cervical cancer? | `true`: Yes - signs/symptoms present; `false`: No - no cancer symptoms identified |
| `figure10_initial_workup_completed` | Have history, speculum exam, pelvic exam and co-test been completed or arranged? | `true`: Yes - initial workup completed/arranged; `false`: No - workup incomplete |
| `figure10_cotest_result_available` | Is the abnormal bleeding co-test result available to record now? | `true`: Yes - record co-test result; `false`: No - result not available yet |
| `bleeding_type` | What abnormal bleeding pattern is present? | `INTER_MENSTRUAL`; `POST_COITAL`; `BOTH`; `UNSPECIFIED` |
| `abnormal_cervix` | Is the cervix abnormal on speculum and pelvic examination? | `true`: Yes - cervix appears abnormal; `false`: No - cervix appears normal |
| `suspicion_of_cancer` | Is there clinical suspicion of cervical cancer? | `true`: Yes - suspicion of cancer; `false`: No - no suspicion of cancer |
| `suspect_ocp_problem` | Is an oral contraceptive pill (OCP) problem suspected as the cause? | `true`: Yes - OCP problem suspected; `false`: No - OCP not the likely cause |
| `sti_identified` | Has an STI been identified on investigation? | `true`: Yes - STI identified; `false`: No - no STI identified |
| `bleeding_resolved` | Has the bleeding resolved at the 6-8 week follow-up review? | `true`: Yes - bleeding resolved; `false`: No - bleeding has not resolved |

Key engine outcomes:

| Branch | Recommendation code | Implemented outcome |
|---|---|---|
| Cancer signs/symptoms present | `F10-CANCER-SYMPTOMS-URGENT-GYN` | Urgent gynaecological assessment without delay |
| Initial assessment incomplete or cervix not assessed | `F10-INITIAL-ASSESSMENT` | Complete history, speculum exam, pelvic exam, co-test, and cervix assessment |
| Abnormal cervix with suspicion of cancer | `F10-ABNORMAL-CERVIX-CANCER-COTEST-COLP` | Complete co-test and refer to colposcopy, P1 |
| Abnormal cervix without suspicion of cancer | `F10-ABNORMAL-CERVIX-NO-CANCER-REVIEW` | Treat per Healthcare Pathways or refer to gynaecology, then review in 6-8 weeks |
| Normal cervix, suspected OCP issue | `F10-OCP-ADJUST-REVIEW` | Adjust OCP and review in 6-8 weeks |
| Normal cervix, no suspected OCP issue, STI status unknown | `F10-NORMAL-CERVIX-INVESTIGATE` | Investigate including STI assessment |
| STI identified | `F10-STI-TREAT-REVIEW` | Treat STI and review bleeding in 6-8 weeks |
| No STI identified | `F10-NO-STI-HEALTHCARE-PATHWAYS` | Manage according to Healthcare Pathways or refer to gynaecology |
| 6-8 week review, bleeding resolved | `F10-REVIEW-RESOLVED-SCREENING` | Continue regular cervical screening if age >=25, or commence at 25 |
| 6-8 week review, bleeding not resolved | `F10-REVIEW-UNRESOLVED-GYNAECOLOGY` | Refer to gynaecology |

### Sample Type And HPV/Cytology Results

| ID | Question | Answers |
|---|---|---|
| `sample_type` | What sample type was used for this test? | `LBC`: LBC - Liquid Based Cytology; `SWAB`: SWAB - Self-collected vaginal swab |
| `swab_return_visit_completed` | Has the patient returned for a clinical examination following the self-collected swab? | `true`: Yes - return visit completed; `false`: No - return visit not yet completed |
| `hpv_result` | What was the HPV test result? | `NOT_DETECTED`; `HPV_16_18`; `HPV_OTHER`; `INADEQUATE` |
| `cytology_result` | What was the cytology result? | `NEGATIVE`; `ASC_US`; `LSIL`; `ASC_H`; `HSIL`; `SCC`; `AG1`; `AG2`; `AG3`; `AG4`; `AG5`; `AC1`; `AC2`; `AC3`; `AC4`; `UNSATISFACTORY` |

### Figure 3 / Primary HPV Screening

Key engine outcomes:

| Branch | Recommendation code | Implemented outcome |
|---|---|---|
| Self-collected swab with HPV detected and no return visit | `F3-SWAB-RETURN-REQUIRED` | Schedule return visit with clinical exam and cytology/co-test review |
| HPV not detected | `F3-NEG-5Y` or immunocompromised 3-year branch | Routine recall, 60 months or 36 months if immunocompromised |
| Inadequate HPV sample | `F3-INAD-3M` | Repeat HPV test in 3 months |
| Second repeat HPV detected, any type | `F3-SECOND-REPEAT-HPV-DETECTED-COLP` | Report cytology if available and refer to colposcopy |
| HPV 16/18 | `F3-1618-COLP` / `F3-1618-HIGH-GRADE-COLP` | Refer to colposcopy; high-grade cytology uses urgent/high-grade branch |
| HPV Other + high-grade cytology | `F3-HPV-OTHER-HIGH-GRADE-COLP` | Refer to colposcopy |
| Baseline HPV Other + negative/ASC-US/LSIL | `F3-HPV-OTHER-NEG-ASCUS-LSIL-12M` | First repeat HPV test in 12 months, recommend LBC |
| First repeat HPV Other + negative/ASC-US/LSIL + age >=50 | `F3-FIRST-REPEAT-AGE50-COLP` | Refer to colposcopy |
| First repeat HPV Other + negative/ASC-US/LSIL + age <50 | `F3-FIRST-REPEAT-UNDER50-SECOND-REPEAT` | Second repeat HPV test in 12 months, recommend LBC |

Age gates in routine screening:

| Age | Recommendation code | Implemented outcome |
|---|---|---|
| Under 25 | `AGE-UNDER-25` | Routine cervical screening does not apply; investigate symptoms through symptomatic pathway |
| 70-74 | `AGE-70-74-DEFERRED` | Offer final HPV screen if indicated and discharge at age 75 |
| 75+ | `AGE-75-DISCHARGE` | Discharge from routine cervical screening programme |

### Pregnancy / Figure 9

| ID | Question | Answers |
|---|---|---|
| `is_pregnant` | Is this patient currently pregnant? | `true`: Yes - patient is pregnant; `false`: No - patient is not pregnant |
| `mdm_outcome_pregnant` | What was the MDM (Multidisciplinary Meeting) outcome for this pregnant participant? | `DOWNGRADED_NEGATIVE`; `DOWNGRADED_LSIL`; `CONFIRMED_HIGH_GRADE` |

Key engine outcomes:

| Branch | Recommendation code | Implemented outcome |
|---|---|---|
| Pregnant with qualifying high-grade/glandular cytology and no colposcopy findings yet | `F9-INITIAL-COLPOSCOPY` | Arrange colposcopy |
| Normal TZ/no visible lesion, MDM downgraded negative | `F9-MDM-DOWNGRADED-NEGATIVE-FIG3` | Follow Figure 3 |
| Normal TZ/no visible lesion, MDM downgraded LSIL | `F9-MDM-DOWNGRADED-LSIL` | Follow LSIL pathway |
| Normal TZ/no visible lesion, MDM confirmed high-grade | `F9-MDM-CONFIRMED-HIGH-GRADE-REVIEW` | Colposcopy review in 6 months or 6-12 weeks postpartum |
| Normal TZ/no visible lesion, MDM not entered | `F9-NORMAL-TZ-MDM` | Complete MDM case review |
| Invasion suspected, no biopsy | `F9-INVASION-IMPRESSION-BIOPSY` | Perform biopsy |
| Biopsy positive for invasion | `F9-BIOPSY-POSITIVE-INVASION-ONCOLOGY` | Refer to gynaecological oncologist |
| Biopsy negative for invasion | `F9-BIOPSY-NEGATIVE-INVASION-MDM` | Complete MDM case review |
| Abnormal TZ/visible lesion with LSIL, HSIL/CIN2/3, or AIS impression | `F9-ABNORMAL-TZ-REVIEW` | Colposcopy review in 6 months or 6-12 weeks postpartum |

### Test Of Cure / Figure 6

| ID | Question | Answers |
|---|---|---|
| `is_test_of_cure` | Is this a Test of Cure follow-up after previous CIN treatment? | `true`: Yes - post-treatment Test of Cure; `false`: No - routine or post-abnormal screening |
| `test_of_cure_stage` | Which Test of Cure stage is this? | `FIRST_TEST`; `SECOND_TEST`; `CONTINUING` |

Key engine outcomes:

| Branch | Recommendation code | Implemented outcome |
|---|---|---|
| HPV detected any type with any cytology | `F6-HPV-DETECTED-ANY-CYTOLOGY-COLP` | Refer to colposcopy |
| First negative Test of Cure co-test | `F6-FIRST-NEGATIVE-REPEAT-12M` | Repeat cytology and HPV in 12 months |
| HPV not detected but high-grade cytology | `F6-HPV-NEG-HIGH-GRADE-COLP` | Refer to colposcopy |
| HPV not detected with low-grade cytology | `F6-HPV-NEG-LOW-GRADE-REPEAT-12M` | Repeat cytology and HPV in 12 months |

### Repeat / Follow-Up Context

| ID | Question | Answers |
|---|---|---|
| `repeat_context` | What repeat/follow-up context applies to this result? | `PRIMARY_HPV`; `POST_NORMAL_COLPOSCOPY_LOW_GRADE_CYTOLOGY`; `POST_NORMAL_COLPOSCOPY_HIGH_GRADE_CYTOLOGY`; `TEST_OF_CURE` |
| `repeat_stage` | Is this a baseline, first repeat, or second repeat result? | `BASELINE`; `FIRST_REPEAT`; `SECOND_REPEAT` |

### Colposcopy Findings

| ID | Question | Answers |
|---|---|---|
| `has_colposcopy_findings` | Are you entering colposcopy findings for this patient? | `true`: Yes - entering colposcopy findings; `false`: No - HPV/cytology results only |
| `tz_type` | What is the Transformation Zone (TZ) type? | `TYPE1`; `TYPE2`; `TYPE3` |
| `transformation_zone_state` | Is the transformation zone normal or abnormal? | `NORMAL`; `ABNORMAL` |
| `visible_lesion` | Is there a visible lesion at colposcopy? | `true`: Yes - visible lesion present; `false`: No - no visible lesion |
| `colposcopic_impression` | What is the colposcopic impression? | `NORMAL`; `LSIL`; `HSIL`; `AIS`; `INVASION`; `UNSATISFACTORY` |
| `biopsy_taken` | Was a biopsy taken during colposcopy? | `true`: Yes - biopsy taken; `false`: No - no biopsy |
| `histology_result` | What was the histology result? | `NORMAL`; `CIN1`; `CIN2`; `CIN3`; `AIS`; `SCC`; `ADENOCARCINOMA`; `UNSATISFACTORY` |
| `mdm_outcome` | What was the MDM (Multidisciplinary Meeting) outcome? | `DOWNGRADED_NEGATIVE`; `DOWNGRADED_ASC_US_LSIL`; `DOWNGRADED_LSIL`; `UPGRADED_HSIL`; `CONFIRMED_ASC_H`; `CONFIRMED_HIGH_GRADE`; `CYTOLOGY_CONFIRMED_NOT_AG2`; `AG2_CYTOLOGY_CONFIRMED`; `CYTOLOGY_NOT_CONFIRMED`; `EXCISION`; `ABLATION`; `HYSTERECTOMY`; `SURVEILLANCE`; `REFERRAL` |

### Figure 4 / Post-Normal Colposcopy After Low-Grade Cytology

| Branch | Recommendation code | Implemented outcome |
|---|---|---|
| Normal colposcopy after HPV detected and negative/ASC-US/LSIL cytology | `F4-NORMAL-COLP-REPEAT-HPV-12M` | Repeat HPV test in 12 months in community care; recommend LBC |
| Repeat HPV 16/18 detected | `F4-REPEAT-1618-COLP` | Refer to colposcopy |
| Second repeat HPV detected, any type | `F4-SECOND-REPEAT-HPV-DETECTED-COLP` | Refer to colposcopy |
| HPV Other with cytology >= ASC-H | `F4-HPV-OTHER-HIGH-GRADE-COLP` | Refer to colposcopy |
| HPV Other with negative/ASC-US/LSIL and immunocompromised | `F4-HPV-OTHER-LOW-GRADE-IC-COLP` | Refer to colposcopy |
| HPV Other with negative/ASC-US/LSIL | `F4-HPV-OTHER-LOW-GRADE-SECOND-REPEAT` | Repeat HPV test in 12 months in community care; recommend LBC |

### Figure 5 / Post-Normal Colposcopy After High-Grade Cytology

| Branch | Recommendation code | Implemented outcome |
|---|---|---|
| Normal colposcopy after HPV detected with cytology >= ASC-H | `F5-MDM-REQUIRED` | MDM case review required |
| MDM downgraded to LSIL/ASC-US | `F5-MDM-DOWNGRADED-LSIL` | Follow LSIL pathway |
| MDM upgraded to HSIL | `F5-MDM-UPGRADED-HSIL-TREAT` | Follow HSIL pathway and arrange treatment |
| Confirmed ASC-H + HPV not detected + no visible lesion | `F5-CONFIRMED-ASCH-HPV-NEG-NO-LESION-TOC` | Arrange Test of Cure/co-testing |
| Confirmed ASC-H + HPV detected + normal colposcopy + negative cytology | `F5-CONFIRMED-ASCH-HPV-DETECTED-NORMAL-NEG-12M` | Repeat colposcopy, HPV, and cytology in 12 months |
| Confirmed ASC-H with abnormal cytology, HPV detected, or visible lesion | `F5-CONFIRMED-ASCH-TREAT` | Treatment recommended; consider type 2 excision TZ |

### Figure 7 / Glandular Abnormality

| Branch | Recommendation code | Implemented outcome |
|---|---|---|
| AG2 or AC2 cytology | `F7-AG2-GYNAECOLOGY` / `F7-AC2-GYNAECOLOGY` | Refer to gynaecology |
| Other glandular abnormality | `F7-GLANDULAR-COLPOSCOPY` | Refer to colposcopy |
| Visible lesion | `F7-VISIBLE-LESION-BIOPSY` | Biopsy required |
| Biopsy AIS | `F7-BIOPSY-AIS-TYPE3-EXCISION` | Arrange type 3 excision |
| Biopsy consistent with cancer | `F7-BIOPSY-CANCER-ONCOLOGY` | Refer to gynaecological oncologist |
| No visible lesion | `F7-NO-LESION-MDM` | MDM case review required |
| MDM confirmed cytology and not AG2 | `F7-MDM-CONFIRMED-NOT-AG2-TYPE3` | Type 3 excision required |
| MDM confirmed AG2 | `F7-MDM-AG2-INVESTIGATE-MALIGNANCIES` | Investigate other gynaecological malignancies |
| MDM did not confirm cytology | `F7-MDM-CYTOLOGY-NOT-CONFIRMED-6M` | Repeat colposcopy in 6 months |

## Known Review Notes

- The demo uses deterministic rule logic, not AI, for the pathway decision.
- Several branches intentionally return "insufficient information", "external history required", or "clinician review required" instead of guessing.
- The visual decision-tree diagrams in the app are labelled as simplified visuals; the deterministic engine output is the operational source of truth.
- This document should be clinically reviewed before using any branch as an approved production protocol.
