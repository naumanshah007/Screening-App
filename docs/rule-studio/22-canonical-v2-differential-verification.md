# CanonicalClinicalFactsV2 differential verification

Generated 3 August 2026. This is software conformance evidence for an unpublished draft; it is not clinical validation or a production-readiness claim.

## Outcome

- Successor: `CG-NCSP-3.1.0` (DRAFT-only contract)
- Engine contract: `canonical-graph-v2`
- Deterministic checksum: `3ab8657a13e73bb0080f18399d9165c20e9af5796bdcf594bdc71170309c824a`
- Independent source-oracle cases: 179/179 represented
- Previously unsupported legacy inputs now represented: 18/18
- Dispositions: ACTION_EQUIVALENT_PRESENTATION_ALIAS=15, EXACT_AGREEMENT=164

The expected action, timing, destination and review boundary come from the independent source oracle. Fixture construction does not call the legacy evaluator or derive an expected result from the canonical compiler.

## Non-exact cases

| Case | Area | Disposition | Expected | Actual classes | Mismatching fields | Controlling rule |
|---|---|---|---|---|---|---|
| `F3-BASELINE-HPV-OTHER-ATYPICAL-GLANDULAR-COLPOSCOPY` | Figure 3 | ACTION_EQUIVALENT_PRESENTATION_ALIAS | GLANDULAR_SPECIALIST_ROUTE | COLPOSCOPY, GYNAECOLOGY, URGENT_GYNAECOLOGY | — | `F3-05` |
| `F3-BASELINE-HPV-OTHER-ADENOCARCINOMA-COLPOSCOPY` | Figure 3 | ACTION_EQUIVALENT_PRESENTATION_ALIAS | GLANDULAR_SPECIALIST_ROUTE | COLPOSCOPY, GYNAECOLOGY, URGENT_GYNAECOLOGY | — | `F3-05` |
| `F3-FIRST-REPEAT-HPV-OTHER-ATYPICAL-GLANDULAR-COLPOSCOPY` | Figure 3 | ACTION_EQUIVALENT_PRESENTATION_ALIAS | GLANDULAR_SPECIALIST_ROUTE | COLPOSCOPY, GYNAECOLOGY, URGENT_GYNAECOLOGY | — | `F3-10` |
| `F3-FIRST-REPEAT-HPV-OTHER-ADENOCARCINOMA-COLPOSCOPY` | Figure 3 | ACTION_EQUIVALENT_PRESENTATION_ALIAS | GLANDULAR_SPECIALIST_ROUTE | COLPOSCOPY, GYNAECOLOGY, URGENT_GYNAECOLOGY | — | `F3-10` |
| `F3-CYTOLOGY-PENDING-INCOMPLETE` | Figure 3 | ACTION_EQUIVALENT_PRESENTATION_ALIAS | INCOMPLETE_RESULT | SAFETY_STOP | — | governed stop |
| `F4-HPV-OTHER-ATYPICAL-GLANDULAR-COLPOSCOPY` | Figure 4 | ACTION_EQUIVALENT_PRESENTATION_ALIAS | GLANDULAR_SPECIALIST_ROUTE | COLPOSCOPY, GYNAECOLOGY | — | `F4-04` |
| `F4-HPV-OTHER-ADENOCARCINOMA-COLPOSCOPY` | Figure 4 | ACTION_EQUIVALENT_PRESENTATION_ALIAS | GLANDULAR_SPECIALIST_ROUTE | COLPOSCOPY, GYNAECOLOGY | — | `F4-04` |
| `F5-TREATMENT-DEFERRED-HPV-DETECTED-NORMAL-12M` | Figure 5 | ACTION_EQUIVALENT_PRESENTATION_ALIAS | REPEAT_COLPOSCOPY_COTEST | COLPOSCOPY, REPEAT_COLPOSCOPY | — | `F5-07` |
| `F6-POSITIVE-MARGINS-AGE50PLUS-SPECIALIST` | Figure 6 | ACTION_EQUIVALENT_PRESENTATION_ALIAS | SPECIALIST_FOLLOW_UP | COLPOSCOPY | — | `F6-11` |
| `F7-NO-LESION-AG2-CONFIRMED-INVESTIGATE` | Figure 7 | ACTION_EQUIVALENT_PRESENTATION_ALIAS | GYNAECOLOGY_INVESTIGATION | GYNAECOLOGY | — | `F7-05` |
| `F8-CANCER-STAGE1A1-LOCAL-EXCISION-TOC-COMPLETE-REGULAR` | Figure 8 | ACTION_EQUIVALENT_PRESENTATION_ALIAS | ROUTINE_SCREENING | ROUTINE_RECALL, TEST_OF_CURE | — | `A26-08` |
| `F8-NONCERVICAL-CANCER-HYSTERECTOMY-HSIL-INCOMPLETE-TOC` | Figure 8 | ACTION_EQUIVALENT_PRESENTATION_ALIAS | CONTINUE_TOC | TEST_OF_CURE | — | `A26-11` |
| `F8-INCOMPLETE-TOC-NO-LOW-PATH-CONTINUE-TOC` | Figure 8 | ACTION_EQUIVALENT_PRESENTATION_ALIAS | CONTINUE_TOC | TEST_OF_CURE | — | `F8-07` |
| `F9-NORMAL-TZ-MDM-CONFIRMS-HIGH-GRADE-REVIEW` | Figure 9 | ACTION_EQUIVALENT_PRESENTATION_ALIAS | PREGNANCY_COLPOSCOPY_REVIEW | COLPOSCOPY | — | `F9-05` |
| `F9-ABNORMAL-TZ-LSIL-HSIL-AIS-REVIEW` | Figure 9 | ACTION_EQUIVALENT_PRESENTATION_ALIAS | PREGNANCY_COLPOSCOPY_REVIEW | COLPOSCOPY | — | `F9-06` |

## Gate interpretation

A presentation alias is accepted only when it preserves the source action, timing, referral and review boundary. A governance stop is visible and non-terminal. Any implementation or metadata difference remains a publication blocker. The legacy engine remains authoritative and the successor remains unpublished and inactive.

Machine-readable evidence: `docs/rule-studio/22-canonical-v2-differential-results.json`
