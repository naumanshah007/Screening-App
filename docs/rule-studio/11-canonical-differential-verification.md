# Canonical differential verification

Generated 2026-08-02. This is software conformance evidence for an unpublished draft, not clinical validation.

## Independence boundary

The semantic oracle is the 179-case source-derived corpus created from the rendered June 2023 Figures 1–10 and Table 1, with the later addendum and immune-deficiency guidance applied. It supplies expected action class, referral, timing, review boundary and missing-data behaviour without calling the legacy evaluator. The legacy `ClinicalInput` probe builder is used only to supply synthetic inputs; its evaluator function is never invoked.

A separate 203-rule identity layer checks every canonical source-package ID, exact source/output/timing/care-setting/provenance fields, isolated executable reachability, and whole-snapshot matched-ID reachability. Its condition probes are structural and are not counted as independent semantic oracle cases.

## Result

- Verified source JSON SHA-256: `ffd329502683b2ba9b308e9309e4c6cc970b3954ce1067bfdc5b82869ef886b1`
- Canonical source records checked: 203
- Exact source-record field differences: 0
- Isolated executable rule-ID failures: 0
- Whole-snapshot rule IDs matched by their structural positive probe: 203/203
- Whole-snapshot rules that controlled their structural positive probe: 165/203
- Independent semantic oracle cases: 179
- CANONICAL_MATCH_WITH_METADATA_OR_PRECEDENCE_DIFFERENCE: 15
- CANONICAL_PATHWAY_GAP: 3
- CONCORDANT: 143
- SOURCE_ORACLE_CASE_NOT_REPRESENTABLE_BY_LEGACY_INPUT: 18

A rule that is matched but not controlling is not automatically unreachable: global routers, safety stops, provenance overlays and more-specific terminal branches can legitimately outrank another matched rule. Every one of the 203 IDs is independently reachable in isolation and matched in the whole snapshot.

## Coverage

| Source area | Independent cases |
|---|---:|
| Figure 1 | 6 |
| Figure 2 | 7 |
| Figure 3 | 43 |
| Figure 4 | 21 |
| Figure 5 | 7 |
| Figure 6 | 18 |
| Figure 7 | 15 |
| Figure 8 | 18 |
| Table 1 | 21 |
| Figure 9 | 10 |
| Figure 10 | 13 |
| Under-25 / DES / immune / 2026 overlays | 24 source-package rules in the 203-rule identity layer |

The source corpus includes all 21 Table 1 combinations. Longitudinal states are represented separately for first/second primary-screen repeats, 12/24-month Figure 4 surveillance, 6/18-month Test of Cure, repeated low-grade cytology, AIS follow-up, pregnancy/postpartum review, vault co-tests, and CIN2 surveillance overlays.

## Non-concordant independent cases

| Case | Area | Disposition | Expected | Controlling rule | Reason |
|---|---|---|---|---|---|
| `F2-AIS-NO-TOTAL-HYSTERECTOMY-R208` | Figure 2 | CANONICAL_MATCH_WITH_METADATA_OR_PRECEDENCE_DIFFERENCE | AIS_FOLLOW_UP | `F2-02` | Matching source-area rule(s) F2-02 were present but did not control. |
| `F3-UNSUITABLE-HPV-REPEAT-ASAP` | Figure 3 | SOURCE_ORACLE_CASE_NOT_REPRESENTABLE_BY_LEGACY_INPUT | REPEAT_ASAP | — | ClinicalInput collapses invalid/unsuitable into one INADEQUATE HPV value and cannot encode leakage/unsuitable separately. |
| `F3-HPV-OTHER-FIRST-UNSAT-CYTOLOGY-REPEAT` | Figure 3 | CANONICAL_MATCH_WITH_METADATA_OR_PRECEDENCE_DIFFERENCE | REPEAT_CYTOLOGY | `F3-22` | Matching source-area rule(s) F3-19 were present but did not control. |
| `F3-HPV-OTHER-SECOND-UNSAT-CYTOLOGY-COLPOSCOPY` | Figure 3 | CANONICAL_MATCH_WITH_METADATA_OR_PRECEDENCE_DIFFERENCE | COLPOSCOPY | `F3-22` | Matching source-area rule(s) F3-19 were present but did not control. |
| `F5-CONFIRMED-ASC-H-TREATMENT-RECOMMENDED` | Figure 5 | CANONICAL_PATHWAY_GAP | TREATMENT | `F5-01` | Matched F5-01, but none expressed TREATMENT. |
| `F5-TREATMENT-DEFERRED-ABNORMAL-TREATMENT` | Figure 5 | CANONICAL_MATCH_WITH_METADATA_OR_PRECEDENCE_DIFFERENCE | TREATMENT | `F5-05` | Matching source-area rule(s) F5-06 were present but did not control. |
| `F5-TREATMENT-DEFERRED-HPV-NOT-DETECTED-TOC` | Figure 5 | CANONICAL_PATHWAY_GAP | TEST_OF_CURE | `F5-05` | Matched F5-05, F5-06, F5-04, but none expressed TEST_OF_CURE. |
| `F6-CIN2-UNDER30-ELIGIBLE-ACTIVE-SURVEILLANCE` | Figure 6 | SOURCE_ORACLE_CASE_NOT_REPRESENTABLE_BY_LEGACY_INPUT | CIN2_ACTIVE_SURVEILLANCE | — | No source-to-engine probe mapper for F6-CIN2-UNDER30-ELIGIBLE-ACTIVE-SURVEILLANCE. |
| `F6-CIN2-SURVEILLANCE-CIN3-TREAT` | Figure 6 | SOURCE_ORACLE_CASE_NOT_REPRESENTABLE_BY_LEGACY_INPUT | TREATMENT | — | No source-to-engine probe mapper for F6-CIN2-SURVEILLANCE-CIN3-TREAT. |
| `F6-CIN2-PERSISTS-24M-TREAT` | Figure 6 | SOURCE_ORACLE_CASE_NOT_REPRESENTABLE_BY_LEGACY_INPUT | TREATMENT | — | No source-to-engine probe mapper for F6-CIN2-PERSISTS-24M-TREAT. |
| `F6-CIN2-REGRESSION-TOC` | Figure 6 | SOURCE_ORACLE_CASE_NOT_REPRESENTABLE_BY_LEGACY_INPUT | TEST_OF_CURE | — | No source-to-engine probe mapper for F6-CIN2-REGRESSION-TOC. |
| `F6-18M-HPV-NOT-DETECTED-LOW-GRADE-REPEAT` | Figure 6 | CANONICAL_PATHWAY_GAP | REPEAT_COTEST | `F6-09` | Matched F6-09, F6-01, F6-14, but none expressed REPEAT_COTEST. |
| `F6-AFTER-LOW-GRADE-NEGATIVE-CONTINUE-TOC` | Figure 6 | CANONICAL_MATCH_WITH_METADATA_OR_PRECEDENCE_DIFFERENCE | CONTINUE_TOC | `F6-08` | Matching source-area rule(s) F6-08, F6-09, F6-01 were present but did not control. |
| `F6-POSITIVE-MARGINS-UNDER50-COMMUNITY-TOC` | Figure 6 | SOURCE_ORACLE_CASE_NOT_REPRESENTABLE_BY_LEGACY_INPUT | COMMUNITY_TOC | — | ClinicalInput has no HSIL excision-margin field, so updated R8.06 cannot be represented. |
| `F6-POSITIVE-MARGINS-AGE50PLUS-SPECIALIST` | Figure 6 | SOURCE_ORACLE_CASE_NOT_REPRESENTABLE_BY_LEGACY_INPUT | SPECIALIST_FOLLOW_UP | — | ClinicalInput has no HSIL excision-margin field, so updated R8.06 cannot be represented. |
| `F7-AC1-COLPOSCOPY` | Figure 7 | CANONICAL_MATCH_WITH_METADATA_OR_PRECEDENCE_DIFFERENCE | COLPOSCOPY | `F7-02` | Matching source-area rule(s) F7-02 were present but did not control. |
| `F7-AC3-COLPOSCOPY` | Figure 7 | CANONICAL_MATCH_WITH_METADATA_OR_PRECEDENCE_DIFFERENCE | COLPOSCOPY | `F7-02` | Matching source-area rule(s) F7-02 were present but did not control. |
| `F7-AC4-COLPOSCOPY` | Figure 7 | CANONICAL_MATCH_WITH_METADATA_OR_PRECEDENCE_DIFFERENCE | COLPOSCOPY | `F7-02` | Matching source-area rule(s) F7-02 were present but did not control. |
| `F7-VISIBLE-LESION-BIOPSY-AIS-TYPE3` | Figure 7 | CANONICAL_MATCH_WITH_METADATA_OR_PRECEDENCE_DIFFERENCE | TYPE3_EXCISION | `F7-07` | Matching source-area rule(s) F7-07 were present but did not control. |
| `F7-AIS-CLEAR-MARGINS-PRIMARY-CARE-6-18M` | Figure 7 | SOURCE_ORACLE_CASE_NOT_REPRESENTABLE_BY_LEGACY_INPUT | COMMUNITY_TOC | — | ClinicalInput cannot encode AIS pre-treatment HPV status plus excision margin status and treatment date for updated R9.14. |
| `F8-CANCER-STAGE1A1-LOCAL-EXCISION-TOC-COMPLETE-REGULAR` | Figure 8 | SOURCE_ORACLE_CASE_NOT_REPRESENTABLE_BY_LEGACY_INPUT | ROUTINE_SCREENING | — | ClinicalInput cannot encode cancer type/stage, NCSP enrolment status, or the addendum's cancer-treatment follow-up state. |
| `F8-CANCER-STAGE1A1-TOC-ABNORMAL-COLPOSCOPY` | Figure 8 | SOURCE_ORACLE_CASE_NOT_REPRESENTABLE_BY_LEGACY_INPUT | COLPOSCOPY | — | ClinicalInput cannot encode cancer type/stage, NCSP enrolment status, or the addendum's cancer-treatment follow-up state. |
| `F8-CANCER-STAGE1A1-POST-TOC-HPV-FIG3` | Figure 8 | SOURCE_ORACLE_CASE_NOT_REPRESENTABLE_BY_LEGACY_INPUT | ROUTE_FIGURE_3 | — | ClinicalInput cannot encode cancer type/stage, NCSP enrolment status, or the addendum's cancer-treatment follow-up state. |
| `F8-CANCER-TOTAL-HYSTERECTOMY-TOC-COMPLETE-CEASE` | Figure 8 | SOURCE_ORACLE_CASE_NOT_REPRESENTABLE_BY_LEGACY_INPUT | NO_FURTHER_SCREENING | — | ClinicalInput cannot encode cancer type/stage, NCSP enrolment status, or the addendum's cancer-treatment follow-up state. |
| `F8-OTHER-GYNAECOLOGICAL-CANCER-OUTSIDE-NCSP` | Figure 8 | SOURCE_ORACLE_CASE_NOT_REPRESENTABLE_BY_LEGACY_INPUT | CLINICIAN_REVIEW_REQUIRED | — | ClinicalInput cannot encode cancer type/stage, NCSP enrolment status, or the addendum's cancer-treatment follow-up state. |
| `F8-NONCERVICAL-CANCER-HYSTERECTOMY-HSIL-INCOMPLETE-TOC` | Figure 8 | SOURCE_ORACLE_CASE_NOT_REPRESENTABLE_BY_LEGACY_INPUT | CONTINUE_TOC | — | ClinicalInput cannot encode cancer type/stage, NCSP enrolment status, or the addendum's cancer-treatment follow-up state. |
| `F9-ABNORMAL-TZ-LSIL-HSIL-AIS-REVIEW` | Figure 9 | CANONICAL_MATCH_WITH_METADATA_OR_PRECEDENCE_DIFFERENCE | PREGNANCY_COLPOSCOPY_REVIEW | `F9-06` | Matching source-area rule(s) F9-01 were present but did not control. |
| `F10-SINGLE-PREMENOPAUSAL-PCB-REASSURING-NO-COLPOSCOPY` | Figure 10 | SOURCE_ORACLE_CASE_NOT_REPRESENTABLE_BY_LEGACY_INPUT | NO_COLPOSCOPY | — | ClinicalInput cannot encode menopausal status, episode count/persistence, or the full reassuring co-test combination required by R15.02/R15.05/R15.06. |
| `F10-RECURRENT-PERSISTENT-PCB-GYNAECOLOGY` | Figure 10 | SOURCE_ORACLE_CASE_NOT_REPRESENTABLE_BY_LEGACY_INPUT | GYNAECOLOGY | — | ClinicalInput cannot encode menopausal status, episode count/persistence, or the full reassuring co-test combination required by R15.02/R15.05/R15.06. |
| `F10-PERSISTENT-UNEXPLAINED-IMB-GYNAECOLOGY` | Figure 10 | SOURCE_ORACLE_CASE_NOT_REPRESENTABLE_BY_LEGACY_INPUT | GYNAECOLOGY | — | ClinicalInput cannot encode menopausal status, episode count/persistence, or the full reassuring co-test combination required by R15.02/R15.05/R15.06. |
| `F10-POSTMENOPAUSAL-BLEEDING-EXAM-COTEST-GYNAECOLOGY` | Figure 10 | SOURCE_ORACLE_CASE_NOT_REPRESENTABLE_BY_LEGACY_INPUT | URGENT_GYNAECOLOGY | — | ClinicalInput cannot encode menopausal status, episode count/persistence, or the full reassuring co-test combination required by R15.02/R15.05/R15.06. |
| `F10-CANCER-SIGNS-URGENT-GYNAECOLOGY` | Figure 10 | CANONICAL_MATCH_WITH_METADATA_OR_PRECEDENCE_DIFFERENCE | URGENT_GYNAECOLOGY | `F10-01` | Matching source-area rule(s) F10-01 were present but did not control. |
| `F10-ABNORMAL-CERVIX-NO-CANCER-LOCAL-REVIEW` | Figure 10 | CANONICAL_MATCH_WITH_METADATA_OR_PRECEDENCE_DIFFERENCE | LOCAL_PATHWAY_REVIEW | `F10-04` | Matching source-area rule(s) F10-04 were present but did not control. |
| `F10-NORMAL-CERVIX-STI-TREAT-REVIEW` | Figure 10 | CANONICAL_MATCH_WITH_METADATA_OR_PRECEDENCE_DIFFERENCE | STI_REVIEW | `F10-08` | Matching source-area rule(s) F10-08 were present but did not control. |
| `F10-NORMAL-CERVIX-NO-STI-LOCAL-PATHWAY` | Figure 10 | CANONICAL_MATCH_WITH_METADATA_OR_PRECEDENCE_DIFFERENCE | LOCAL_PATHWAY_REVIEW | `F10-09` | Matching source-area rule(s) F10-09 were present but did not control. |
| `F10-REVIEW-BLEEDING-PERSISTS-GYNAECOLOGY` | Figure 10 | CANONICAL_MATCH_WITH_METADATA_OR_PRECEDENCE_DIFFERENCE | GYNAECOLOGY | `F10-07` | Matching source-area rule(s) F10-07 were present but did not control. |

## Interpretation and gate

`SOURCE_ORACLE_CASE_NOT_REPRESENTABLE_BY_LEGACY_INPUT` means the independent expected branch exists but the old input contract cannot encode the necessary fact vector; this is not treated as a canonical failure. `CANONICAL_FACT_ADAPTER_GAP` identifies a source case for which the old input could be generated but not fully translated into canonical facts. `CANONICAL_MATCH_WITH_METADATA_OR_PRECEDENCE_DIFFERENCE` means the expected action is represented but timing, destination, reviewer metadata, clinician-only status, or controlling precedence still differs. `CANONICAL_PATHWAY_GAP` is the strongest defect signal and must be resolved or explicitly governed before publication.

The draft remains unpublished and unactivated. Legacy remains authoritative.

Machine-readable results: `docs/rule-studio/11-canonical-differential-results.json`
