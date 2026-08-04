# Full shadow disposition

Generated 2026-08-02. Legacy remains authoritative; canonical results are shadow/simulation evidence only.

## Scope

- Independent semantic source cases: 179
- Canonical structural rule-ID cases: 203
- Combined evidence records: 382
- Global, under-25, DES, immune and 2026 overlay rules in structural layer: 42
- Canonical rule IDs matched in whole-snapshot structural probes: 203/203
- Semantic coverage includes Figures 1–10, all 21 Table 1 combinations, first/second repeats, longitudinal ToC, AIS, vault, pregnancy/postpartum, bleeding and current source overlays.

The direct source oracle is the expected authority. Legacy output is never used to generate or modify a canonical expectation.

## Disposition counts

- AGREEMENT: 110
- CONFIRMED_LEGACY_DEFECT: 26
- PRESENTATION_ONLY_DIFFERENCE: 7
- SOURCE_AMBIGUITY: 3
- UNRESOLVED_CLINICAL_REVIEW: 15
- UNSUPPORTED_LEGACY_STATE: 18
- Total semantic legacy/canonical differences or blocked comparisons: 69

`UNSUPPORTED_LEGACY_STATE` means the old input contract cannot encode the source state. `SOURCE_AMBIGUITY` is retained where the independent source oracle and consolidated package do not yield a safely inferable identical terminal condition. Metadata/precedence differences remain `UNRESOLVED_CLINICAL_REVIEW` even when the broad action class agrees.

## Five earlier defects

| Defect | State | Canonical shadow disposition |
|---|---|---|
| AUD-001 | Missing Figure 3 sample type | Canonical does not match F3-01/F3-02 and returns the unresolved governed safety outcome; legacy returns routine recall. |
| AUD-002 | Unknown immune classification | Canonical does not select a three-/five-year interval; legacy defaults to five years. |
| AUD-003 | Age 70 with HPV 16/18 | Canonical F3-16 colposcopy route outranks the age-exit branch; legacy defers/exits. |
| AUD-004 | Missing ToC treatment date | Canonical F6-12 requests treatment records and prevents a terminal ToC disposition; legacy continues the sequence. |
| AUD-005 | Batch bleeding assessment provenance | Canonical input normalization preserves absent assessment fields as absent; it does not fabricate six completed work-up facts. |

All five are canonical corrections of retained legacy behaviour. They do not change production authority, and no regrade correction was written to a live/persisted decision during this verification.

## Every non-agreement or blocked comparison

| Case | Area | Expected | Legacy | Canonical controlling rule | Disposition | Reason |
|---|---|---|---|---|---|---|
| `F2-AIS-NO-TOTAL-HYSTERECTOMY-R208` | Figure 2 | AIS_FOLLOW_UP | UNMAPPED_ACTUAL:F2-AIS-R208-FOLLOWUP | `F2-02` | UNRESOLVED_CLINICAL_REVIEW | Legacy action differs and canonical metadata/precedence also requires review: Matching source-area rule(s) F2-02 were present but did not control. |
| `F3-BASELINE-HPV-OTHER-NEGATIVE-REPEAT-12M` | Figure 3 | REPEAT_HPV | UNMAPPED_ACTUAL:F3-HPV-OTHER-NEG-ASCUS-LSIL-12M | `F3-07` | CONFIRMED_LEGACY_DEFECT | Canonical agrees with the direct source oracle; legacy produced UNMAPPED_ACTUAL:F3-HPV-OTHER-NEG-ASCUS-LSIL-12M. |
| `F3-BASELINE-HPV-OTHER-ASC-US-REPEAT-12M` | Figure 3 | REPEAT_HPV | UNMAPPED_ACTUAL:F3-HPV-OTHER-NEG-ASCUS-LSIL-12M | `F3-07` | CONFIRMED_LEGACY_DEFECT | Canonical agrees with the direct source oracle; legacy produced UNMAPPED_ACTUAL:F3-HPV-OTHER-NEG-ASCUS-LSIL-12M. |
| `F3-BASELINE-HPV-OTHER-LSIL-REPEAT-12M` | Figure 3 | REPEAT_HPV | UNMAPPED_ACTUAL:F3-HPV-OTHER-NEG-ASCUS-LSIL-12M | `F3-07` | CONFIRMED_LEGACY_DEFECT | Canonical agrees with the direct source oracle; legacy produced UNMAPPED_ACTUAL:F3-HPV-OTHER-NEG-ASCUS-LSIL-12M. |
| `F3-BASELINE-HPV-OTHER-ATYPICAL-GLANDULAR-COLPOSCOPY` | Figure 3 | GLANDULAR_SPECIALIST_ROUTE | COLPOSCOPY | `F3-05` | PRESENTATION_ONLY_DIFFERENCE | Legacy COLPOSCOPY is an accepted action-equivalent alias for GLANDULAR_SPECIALIST_ROUTE. |
| `F3-BASELINE-HPV-OTHER-ADENOCARCINOMA-COLPOSCOPY` | Figure 3 | GLANDULAR_SPECIALIST_ROUTE | COLPOSCOPY | `F3-05` | PRESENTATION_ONLY_DIFFERENCE | Legacy COLPOSCOPY is an accepted action-equivalent alias for GLANDULAR_SPECIALIST_ROUTE. |
| `F3-FIRST-REPEAT-HPV-OTHER-ATYPICAL-GLANDULAR-COLPOSCOPY` | Figure 3 | GLANDULAR_SPECIALIST_ROUTE | COLPOSCOPY | `F3-10` | PRESENTATION_ONLY_DIFFERENCE | Legacy COLPOSCOPY is an accepted action-equivalent alias for GLANDULAR_SPECIALIST_ROUTE. |
| `F3-FIRST-REPEAT-HPV-OTHER-ADENOCARCINOMA-COLPOSCOPY` | Figure 3 | GLANDULAR_SPECIALIST_ROUTE | COLPOSCOPY | `F3-10` | PRESENTATION_ONLY_DIFFERENCE | Legacy COLPOSCOPY is an accepted action-equivalent alias for GLANDULAR_SPECIALIST_ROUTE. |
| `F3-INVALID-HPV-REPEAT-ASAP` | Figure 3 | REPEAT_ASAP | REPEAT_HPV | `F3-18` | CONFIRMED_LEGACY_DEFECT | Canonical agrees with the direct source oracle; legacy produced REPEAT_HPV. |
| `F3-UNSUITABLE-HPV-REPEAT-ASAP` | Figure 3 | REPEAT_ASAP | UNSUPPORTED | — | UNSUPPORTED_LEGACY_STATE | ClinicalInput collapses invalid/unsuitable into one INADEQUATE HPV value and cannot encode leakage/unsuitable separately. |
| `F3-HPV-OTHER-FIRST-UNSAT-CYTOLOGY-REPEAT` | Figure 3 | REPEAT_CYTOLOGY | UNMAPPED_ACTUAL:F3-UNMAPPED-COMBINATION | `F3-22` | UNRESOLVED_CLINICAL_REVIEW | Legacy action differs and canonical metadata/precedence also requires review: Matching source-area rule(s) F3-19 were present but did not control. |
| `F3-HPV-OTHER-SECOND-UNSAT-CYTOLOGY-COLPOSCOPY` | Figure 3 | COLPOSCOPY | UNMAPPED_ACTUAL:F3-UNMAPPED-COMBINATION | `F3-22` | UNRESOLVED_CLINICAL_REVIEW | Legacy action differs and canonical metadata/precedence also requires review: Matching source-area rule(s) F3-19 were present but did not control. |
| `F3-CYTOLOGY-PENDING-INCOMPLETE` | Figure 3 | INCOMPLETE_RESULT | SAFETY_STOP | — | CONFIRMED_LEGACY_DEFECT | Canonical agrees with the direct source oracle; legacy produced SAFETY_STOP. |
| `F3-MISSING-SAMPLE-TYPE-SAFETY-STOP` | Figure 3 | SAFETY_STOP | ROUTINE_RECALL | — | CONFIRMED_LEGACY_DEFECT | Canonical agrees with the direct source oracle; legacy produced ROUTINE_RECALL. |
| `F3-HPV-NOT-DETECTED-UNKNOWN-IMMUNE-SAFETY-STOP` | Figure 3 | SAFETY_STOP | ROUTINE_RECALL | — | CONFIRMED_LEGACY_DEFECT | Canonical agrees with the direct source oracle; legacy produced ROUTINE_RECALL. |
| `F4-REPEAT-HPV-NOT-DETECTED-REGULAR-5Y` | Figure 4 | ROUTINE_RECALL | REPEAT_HPV | `F4-02` | CONFIRMED_LEGACY_DEFECT | Canonical agrees with the direct source oracle; legacy produced REPEAT_HPV. |
| `F4-REPEAT-HPV-NOT-DETECTED-IMMUNE-3Y` | Figure 4 | ROUTINE_RECALL | REPEAT_HPV | `F4-02` | CONFIRMED_LEGACY_DEFECT | Canonical agrees with the direct source oracle; legacy produced REPEAT_HPV. |
| `F4-HPV-OTHER-ATYPICAL-GLANDULAR-COLPOSCOPY` | Figure 4 | GLANDULAR_SPECIALIST_ROUTE | COLPOSCOPY | `F4-04` | PRESENTATION_ONLY_DIFFERENCE | Legacy COLPOSCOPY is an accepted action-equivalent alias for GLANDULAR_SPECIALIST_ROUTE. |
| `F4-HPV-OTHER-ADENOCARCINOMA-COLPOSCOPY` | Figure 4 | GLANDULAR_SPECIALIST_ROUTE | COLPOSCOPY | `F4-04` | PRESENTATION_ONLY_DIFFERENCE | Legacy COLPOSCOPY is an accepted action-equivalent alias for GLANDULAR_SPECIALIST_ROUTE. |
| `F4-SECOND-REPEAT-NOT-DETECTED-REGULAR-5Y` | Figure 4 | ROUTINE_RECALL | REPEAT_HPV | `F4-07` | CONFIRMED_LEGACY_DEFECT | Canonical agrees with the direct source oracle; legacy produced REPEAT_HPV. |
| `F4-SECOND-REPEAT-NOT-DETECTED-IMMUNE-3Y` | Figure 4 | ROUTINE_RECALL | REPEAT_HPV | `F4-07` | CONFIRMED_LEGACY_DEFECT | Canonical agrees with the direct source oracle; legacy produced REPEAT_HPV. |
| `F4-TYPE3-LOW-GRADE-NORMAL-COLPOSCOPY-NO-MDM` | Figure 4 | NO_MDM_CONTINUE_F4 | REPEAT_HPV | `F4-09` | PRESENTATION_ONLY_DIFFERENCE | Legacy REPEAT_HPV is an accepted action-equivalent alias for NO_MDM_CONTINUE_F4. |
| `F5-MDM-DOWNGRADED-LSIL-PATHWAY` | Figure 5 | ROUTE_LSIL | MDM_REVIEW | `F5-02` | CONFIRMED_LEGACY_DEFECT | Canonical agrees with the direct source oracle; legacy produced MDM_REVIEW. |
| `F5-MDM-UPGRADED-HSIL-PATHWAY` | Figure 5 | ROUTE_HSIL | COLPOSCOPY | `F5-03` | CONFIRMED_LEGACY_DEFECT | Canonical agrees with the direct source oracle; legacy produced COLPOSCOPY. |
| `F5-CONFIRMED-ASC-H-TREATMENT-RECOMMENDED` | Figure 5 | TREATMENT | COLPOSCOPY | `F5-01` | SOURCE_AMBIGUITY | The direct 2023/addendum oracle and the consolidated v2.1 rule record do not expose the same terminal condition; no clinical condition was inferred to close the difference. |
| `F5-TREATMENT-DEFERRED-ABNORMAL-TREATMENT` | Figure 5 | TREATMENT | COLPOSCOPY | `F5-05` | UNRESOLVED_CLINICAL_REVIEW | Legacy action differs and canonical metadata/precedence also requires review: Matching source-area rule(s) F5-06 were present but did not control. |
| `F5-TREATMENT-DEFERRED-HPV-NOT-DETECTED-TOC` | Figure 5 | TEST_OF_CURE | TEST_OF_CURE | `F5-05` | SOURCE_AMBIGUITY | The direct 2023/addendum oracle and the consolidated v2.1 rule record do not expose the same terminal condition; no clinical condition was inferred to close the difference. |
| `F5-TREATMENT-DEFERRED-HPV-DETECTED-NORMAL-12M` | Figure 5 | REPEAT_COLPOSCOPY_COTEST | UNMAPPED_ACTUAL:F5-CONFIRMED-ASCH-HPV-DETECTED-NORMAL-NEG-12M | `F5-05` | CONFIRMED_LEGACY_DEFECT | Canonical agrees with the direct source oracle; legacy produced UNMAPPED_ACTUAL:F5-CONFIRMED-ASCH-HPV-DETECTED-NORMAL-NEG-12M. |
| `F6-CIN2-UNDER30-ELIGIBLE-ACTIVE-SURVEILLANCE` | Figure 6 | CIN2_ACTIVE_SURVEILLANCE | UNSUPPORTED | — | UNSUPPORTED_LEGACY_STATE | No source-to-engine probe mapper for F6-CIN2-UNDER30-ELIGIBLE-ACTIVE-SURVEILLANCE. |
| `F6-CIN2-SURVEILLANCE-CIN3-TREAT` | Figure 6 | TREATMENT | UNSUPPORTED | — | UNSUPPORTED_LEGACY_STATE | No source-to-engine probe mapper for F6-CIN2-SURVEILLANCE-CIN3-TREAT. |
| `F6-CIN2-PERSISTS-24M-TREAT` | Figure 6 | TREATMENT | UNSUPPORTED | — | UNSUPPORTED_LEGACY_STATE | No source-to-engine probe mapper for F6-CIN2-PERSISTS-24M-TREAT. |
| `F6-CIN2-REGRESSION-TOC` | Figure 6 | TEST_OF_CURE | UNSUPPORTED | — | UNSUPPORTED_LEGACY_STATE | No source-to-engine probe mapper for F6-CIN2-REGRESSION-TOC. |
| `F6-18M-HPV-NOT-DETECTED-LOW-GRADE-REPEAT` | Figure 6 | REPEAT_COTEST | COLPOSCOPY | `F6-09` | SOURCE_AMBIGUITY | The direct 2023/addendum oracle and the consolidated v2.1 rule record do not expose the same terminal condition; no clinical condition was inferred to close the difference. |
| `F6-AFTER-LOW-GRADE-NEGATIVE-CONTINUE-TOC` | Figure 6 | CONTINUE_TOC | CONTINUE_TOC | `F6-08` | UNRESOLVED_CLINICAL_REVIEW | Legacy action is source-equivalent, while canonical metadata/precedence remains unresolved: Matching source-area rule(s) F6-08, F6-09, F6-01 were present but did not control. |
| `F6-MISSING-TREATMENT-DATE-SAFETY-STOP` | Figure 6 | SAFETY_STOP | REPEAT_COTEST | `F6-12` | CONFIRMED_LEGACY_DEFECT | Canonical agrees with the direct source oracle; legacy produced REPEAT_COTEST. |
| `F6-POSITIVE-MARGINS-UNDER50-COMMUNITY-TOC` | Figure 6 | COMMUNITY_TOC | UNSUPPORTED | — | UNSUPPORTED_LEGACY_STATE | ClinicalInput has no HSIL excision-margin field, so updated R8.06 cannot be represented. |
| `F6-POSITIVE-MARGINS-AGE50PLUS-SPECIALIST` | Figure 6 | SPECIALIST_FOLLOW_UP | UNSUPPORTED | — | UNSUPPORTED_LEGACY_STATE | ClinicalInput has no HSIL excision-margin field, so updated R8.06 cannot be represented. |
| `F7-AC1-COLPOSCOPY` | Figure 7 | COLPOSCOPY | COLPOSCOPY | `F7-02` | UNRESOLVED_CLINICAL_REVIEW | Legacy action is source-equivalent, while canonical metadata/precedence remains unresolved: Matching source-area rule(s) F7-02 were present but did not control. |
| `F7-AC3-COLPOSCOPY` | Figure 7 | COLPOSCOPY | COLPOSCOPY | `F7-02` | UNRESOLVED_CLINICAL_REVIEW | Legacy action is source-equivalent, while canonical metadata/precedence remains unresolved: Matching source-area rule(s) F7-02 were present but did not control. |
| `F7-AC4-COLPOSCOPY` | Figure 7 | COLPOSCOPY | COLPOSCOPY | `F7-02` | UNRESOLVED_CLINICAL_REVIEW | Legacy action is source-equivalent, while canonical metadata/precedence remains unresolved: Matching source-area rule(s) F7-02 were present but did not control. |
| `F7-NO-LESION-CYTOLOGY-CONFIRMED-TYPE3-EXCISION` | Figure 7 | TYPE3_EXCISION | COLPOSCOPY | `F7-04` | CONFIRMED_LEGACY_DEFECT | Canonical agrees with the direct source oracle; legacy produced COLPOSCOPY. |
| `F7-NO-LESION-AG2-CONFIRMED-INVESTIGATE` | Figure 7 | GYNAECOLOGY_INVESTIGATION | GYNAECOLOGY | `F7-05` | CONFIRMED_LEGACY_DEFECT | Canonical agrees with the direct source oracle; legacy produced GYNAECOLOGY. |
| `F7-NO-LESION-CYTOLOGY-NOT-CONFIRMED-6M` | Figure 7 | REPEAT_COLPOSCOPY | MDM_REVIEW | `F7-06` | CONFIRMED_LEGACY_DEFECT | Canonical agrees with the direct source oracle; legacy produced MDM_REVIEW. |
| `F7-VISIBLE-LESION-BIOPSY-AIS-TYPE3` | Figure 7 | TYPE3_EXCISION | COLPOSCOPY | `F7-07` | UNRESOLVED_CLINICAL_REVIEW | Legacy action differs and canonical metadata/precedence also requires review: Matching source-area rule(s) F7-07 were present but did not control. |
| `F7-AIS-CLEAR-MARGINS-PRIMARY-CARE-6-18M` | Figure 7 | COMMUNITY_TOC | UNSUPPORTED | — | UNSUPPORTED_LEGACY_STATE | ClinicalInput cannot encode AIS pre-treatment HPV status plus excision margin status and treatment date for updated R9.14. |
| `F8-CANCER-STAGE1A1-LOCAL-EXCISION-TOC-COMPLETE-REGULAR` | Figure 8 | ROUTINE_SCREENING | UNSUPPORTED | — | UNSUPPORTED_LEGACY_STATE | ClinicalInput cannot encode cancer type/stage, NCSP enrolment status, or the addendum's cancer-treatment follow-up state. |
| `F8-CANCER-STAGE1A1-TOC-ABNORMAL-COLPOSCOPY` | Figure 8 | COLPOSCOPY | UNSUPPORTED | — | UNSUPPORTED_LEGACY_STATE | ClinicalInput cannot encode cancer type/stage, NCSP enrolment status, or the addendum's cancer-treatment follow-up state. |
| `F8-CANCER-STAGE1A1-POST-TOC-HPV-FIG3` | Figure 8 | ROUTE_FIGURE_3 | UNSUPPORTED | — | UNSUPPORTED_LEGACY_STATE | ClinicalInput cannot encode cancer type/stage, NCSP enrolment status, or the addendum's cancer-treatment follow-up state. |
| `F8-CANCER-TOTAL-HYSTERECTOMY-TOC-COMPLETE-CEASE` | Figure 8 | NO_FURTHER_SCREENING | UNSUPPORTED | — | UNSUPPORTED_LEGACY_STATE | ClinicalInput cannot encode cancer type/stage, NCSP enrolment status, or the addendum's cancer-treatment follow-up state. |
| `F8-OTHER-GYNAECOLOGICAL-CANCER-OUTSIDE-NCSP` | Figure 8 | CLINICIAN_REVIEW_REQUIRED | UNSUPPORTED | — | UNSUPPORTED_LEGACY_STATE | ClinicalInput cannot encode cancer type/stage, NCSP enrolment status, or the addendum's cancer-treatment follow-up state. |
| `F8-NONCERVICAL-CANCER-HYSTERECTOMY-HSIL-INCOMPLETE-TOC` | Figure 8 | CONTINUE_TOC | UNSUPPORTED | — | UNSUPPORTED_LEGACY_STATE | ClinicalInput cannot encode cancer type/stage, NCSP enrolment status, or the addendum's cancer-treatment follow-up state. |
| `F8-LOW-RISK-COMPLETE-HSIL-AIS-TOC` | Figure 8 | TEST_OF_CURE | NO_FURTHER_SCREENING | `F8-03` | CONFIRMED_LEGACY_DEFECT | Canonical agrees with the direct source oracle; legacy produced NO_FURTHER_SCREENING. |
| `F8-LOW-RISK-INCOMPLETE-HSIL-AIS-COLPOSCOPY` | Figure 8 | COLPOSCOPY | NO_FURTHER_SCREENING | `F8-04` | CONFIRMED_LEGACY_DEFECT | Canonical agrees with the direct source oracle; legacy produced NO_FURTHER_SCREENING. |
| `F8-UNTREATED-HSIL-AIS-NO-LOW-PATH-TOC` | Figure 8 | TEST_OF_CURE | CONTINUE_TOC | `F8-06` | CONFIRMED_LEGACY_DEFECT | Canonical agrees with the direct source oracle; legacy produced CONTINUE_TOC. |
| `T1-HSIL-AIS-UNTREATED-INCOMPLETE-NO-OR-LOW-PATHOLOGY` | Table 1 | TEST_OF_CURE | CONTINUE_TOC | `T1-13` | CONFIRMED_LEGACY_DEFECT | Canonical agrees with the direct source oracle; legacy produced CONTINUE_TOC. |
| `T1-PREVIOUS-TREATMENT-INCOMPLETE-TOC-NO-OR-LOW-PATHOLOGY` | Table 1 | TEST_OF_CURE | CONTINUE_TOC | `T1-16` | CONFIRMED_LEGACY_DEFECT | Canonical agrees with the direct source oracle; legacy produced CONTINUE_TOC. |
| `F9-NORMAL-TZ-MDM-DOWNGRADE-NEGATIVE-F3` | Figure 9 | ROUTE_FIGURE_3 | MDM_REVIEW | `F9-03` | CONFIRMED_LEGACY_DEFECT | Canonical agrees with the direct source oracle; legacy produced MDM_REVIEW. |
| `F9-NORMAL-TZ-MDM-DOWNGRADE-LOW-GRADE` | Figure 9 | ROUTE_LSIL | MDM_REVIEW | `F9-04` | CONFIRMED_LEGACY_DEFECT | Canonical agrees with the direct source oracle; legacy produced MDM_REVIEW. |
| `F9-NORMAL-TZ-MDM-CONFIRMS-HIGH-GRADE-REVIEW` | Figure 9 | PREGNANCY_COLPOSCOPY_REVIEW | MDM_REVIEW | `F9-05` | CONFIRMED_LEGACY_DEFECT | Canonical agrees with the direct source oracle; legacy produced MDM_REVIEW. |
| `F9-ABNORMAL-TZ-LSIL-HSIL-AIS-REVIEW` | Figure 9 | PREGNANCY_COLPOSCOPY_REVIEW | PREGNANCY_COLPOSCOPY_REVIEW | `F9-06` | UNRESOLVED_CLINICAL_REVIEW | Legacy action is source-equivalent, while canonical metadata/precedence remains unresolved: Matching source-area rule(s) F9-01 were present but did not control. |
| `F10-SINGLE-PREMENOPAUSAL-PCB-REASSURING-NO-COLPOSCOPY` | Figure 10 | NO_COLPOSCOPY | UNSUPPORTED | — | UNSUPPORTED_LEGACY_STATE | ClinicalInput cannot encode menopausal status, episode count/persistence, or the full reassuring co-test combination required by R15.02/R15.05/R15.06. |
| `F10-RECURRENT-PERSISTENT-PCB-GYNAECOLOGY` | Figure 10 | GYNAECOLOGY | UNSUPPORTED | — | UNSUPPORTED_LEGACY_STATE | ClinicalInput cannot encode menopausal status, episode count/persistence, or the full reassuring co-test combination required by R15.02/R15.05/R15.06. |
| `F10-PERSISTENT-UNEXPLAINED-IMB-GYNAECOLOGY` | Figure 10 | GYNAECOLOGY | UNSUPPORTED | — | UNSUPPORTED_LEGACY_STATE | ClinicalInput cannot encode menopausal status, episode count/persistence, or the full reassuring co-test combination required by R15.02/R15.05/R15.06. |
| `F10-POSTMENOPAUSAL-BLEEDING-EXAM-COTEST-GYNAECOLOGY` | Figure 10 | URGENT_GYNAECOLOGY | UNSUPPORTED | — | UNSUPPORTED_LEGACY_STATE | ClinicalInput cannot encode menopausal status, episode count/persistence, or the full reassuring co-test combination required by R15.02/R15.05/R15.06. |
| `F10-CANCER-SIGNS-URGENT-GYNAECOLOGY` | Figure 10 | URGENT_GYNAECOLOGY | URGENT_GYNAECOLOGY | `F10-01` | UNRESOLVED_CLINICAL_REVIEW | Legacy action is source-equivalent, while canonical metadata/precedence remains unresolved: Matching source-area rule(s) F10-01 were present but did not control. |
| `F10-ABNORMAL-CERVIX-NO-CANCER-LOCAL-REVIEW` | Figure 10 | LOCAL_PATHWAY_REVIEW | LOCAL_PATHWAY_REVIEW | `F10-04` | UNRESOLVED_CLINICAL_REVIEW | Legacy action is source-equivalent, while canonical metadata/precedence remains unresolved: Matching source-area rule(s) F10-04 were present but did not control. |
| `F10-NORMAL-CERVIX-STI-TREAT-REVIEW` | Figure 10 | STI_REVIEW | TREATMENT | `F10-08` | UNRESOLVED_CLINICAL_REVIEW | Legacy action differs and canonical metadata/precedence also requires review: Matching source-area rule(s) F10-08 were present but did not control. |
| `F10-NORMAL-CERVIX-NO-STI-LOCAL-PATHWAY` | Figure 10 | LOCAL_PATHWAY_REVIEW | LOCAL_PATHWAY_REVIEW | `F10-09` | UNRESOLVED_CLINICAL_REVIEW | Legacy action is source-equivalent, while canonical metadata/precedence remains unresolved: Matching source-area rule(s) F10-09 were present but did not control. |
| `F10-REVIEW-BLEEDING-PERSISTS-GYNAECOLOGY` | Figure 10 | GYNAECOLOGY | GYNAECOLOGY | `F10-07` | UNRESOLVED_CLINICAL_REVIEW | Legacy action is source-equivalent, while canonical metadata/precedence remains unresolved: Matching source-area rule(s) F10-07 were present but did not control. |

## Safety disposition

Known unsafe legacy differences were retained as `CONFIRMED_LEGACY_DEFECT`; canonical logic was not weakened to improve the mismatch count. The three source ambiguities and all metadata/precedence cases remain publication blockers pending independent clinical review. No ruleset was published or activated.

Machine-readable results: `docs/rule-studio/12-full-shadow-results.json`
