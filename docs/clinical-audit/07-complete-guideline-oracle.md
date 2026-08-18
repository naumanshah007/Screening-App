# Complete source-derived NCSP guideline oracle

Generated from the visually verified June 2023 final v1.1 guideline, with the February 2026 addendum applied only to its named scenarios and the March 2026 immune-deficiency v1.0.1 guidance applied to current immune classification/periodicity. The prior extraction report was used only as a secondary contradiction check. No expected outcome was derived from CerviGrade production code.

## Counting convention

A canonical branch is one distinct source condition vector ending in an action, recall/repeat interval, referral, clinician-only decision, incomplete-result state, or safety stop. Source-listed cytology categories, sample types, repeat stages, inclusive age thresholds, and immune-status outcomes remain separate even when they converge on the same action. Table 1 has one object for each of its 21 displayed history/pathology cells.

| Source | Canonical terminal branches | Printed page | PDF page |
|---|---:|---:|---:|
| Figure 1 | 6 | 18 | 20 |
| Figure 2 | 7 | 19 | 21 |
| Figure 3 | 43 | 24 | 26 |
| Figure 4 | 21 | 45 | 47 |
| Figure 5 | 7 | 47 | 49 |
| Figure 6 | 18 | 4 | 4 |
| Figure 7 | 15 | 59 | 61 |
| Figure 8 | 18 | 5 | 5 |
| Table 1 | 21 | 66 | 68 |
| Figure 9 | 10 | 71 | 73 |
| Figure 10 | 13 | 83 | 85 |
| **Total** | **179** |  |  |

## Source controls and safety interpretation

- The June 2023 guideline remains the base source for unaffected pathways.
- Addendum v1.0 controls updated R6.05, R8.03, R8.06, R9.14, and the specified screening-after-gynaecological-cancer scenarios.
- Immune-deficiency guidance v1.0.1 controls current classification and the three-year regular interval. Its case-by-case categories remain clinician-led rather than Boolean defaults.
- Visible-lesion assessment, histology/biopsy interpretation, MDM/MDT outcomes, suspected invasion, and specialist treatment choices are clinician-led unless the source provides a deterministic routing action.
- `localBookingPriority` is null throughout because the supplied package contains no approved local booking rule document.

## Figure 1

| Rule ID | Source condition | Expected action | Timing | Review | Current source |
|---|---|---|---|---|---|
| `F1-NEVER-SCREENED-INVITE-NOW` | participant has never been screened | Invite now, then perform the HPV screening test and continue through Figure 3. | now | provisional deterministic | 2023 v1.1 |
| `F1-UNDER-SCREENED-INVITE-NOW` | participant is under-screened | Invite now, then perform the HPV screening test and continue through Figure 3. | now | provisional deterministic | 2023 v1.1 |
| `F1-OVERDUE-INVITE-NOW` | participant is overdue | Invite now, then perform the HPV screening test and continue through Figure 3. | now | provisional deterministic | 2023 v1.1 |
| `F1-REGULAR-NORMAL-NEXT-SCHEDULED` | regularly screened with normal results | Invite at the next scheduled visit, then perform the HPV screening test and continue through Figure 3. | next scheduled visit | provisional deterministic | 2023 v1.1 |
| `F1-LOW-GRADE-RESOLVED-NEXT-SCHEDULED` | previous low-grade results and returned to regular screening | Invite at the next scheduled visit, then perform the HPV screening test and continue through Figure 3. | next scheduled visit | provisional deterministic | 2023 v1.1 |
| `F1-HIGH-GRADE-TOC-COMPLETE-NEXT-SCHEDULED` | previous high-grade results with successful Test of Cure | Invite at the next scheduled visit, then perform the HPV screening test and continue through Figure 3. | next scheduled visit | provisional deterministic | 2023 v1.1 |

## Figure 2

| Rule ID | Source condition | Expected action | Timing | Review | Current source |
|---|---|---|---|---|---|
| `F2-HIGH-GRADE-OUTSTANDING-COLPOSCOPY` | previous possible/definite HSIL or atypical glandular cells excluding atypical endometrial cells; last cytology recommended colposcopy and it has not occurred | Refer to colposcopy. | as recommended in last cytology | provisional deterministic | 2023 v1.1 |
| `F2-HIGH-GRADE-INCOMPLETE-TOC` | previous possible/definite HSIL or atypical glandular cells excluding atypical endometrial cells; no outstanding recommended colposcopy; Test of Cure is incomplete | Complete Test of Cure before regular screening. | per Test of Cure pathway | provisional deterministic | 2023 v1.1 |
| `F2-HIGH-GRADE-TOC-COMPLETE-F3` | previous possible/definite HSIL or atypical glandular cells excluding atypical endometrial cells; Test of Cure successfully completed | Return to regular interval screening through Figure 3. | next scheduled screening | provisional deterministic | 2023 v1.1 |
| `F2-AIS-NO-TOTAL-HYSTERECTOMY-R208` | previous AIS; no total hysterectomy | Use the controlling post-treatment AIS follow-up rule. | 6 and 18 months when HPV-detected AIS has clear margins | mandatory confirmation | 2023 v1.1 |
| `F2-ATYPICAL-ENDOMETRIAL-OLDER-3Y-F3` | previous atypical endometrial cells; report more than three years previously | Primary HPV screening at the next scheduled visit; then Figure 3. | next scheduled visit | provisional deterministic | 2023 v1.1 |
| `F2-ATYPICAL-ENDOMETRIAL-DISCHARGED-F3` | previous atypical endometrial cells; investigated by specialist services and discharged to primary care | Primary HPV screening at the next scheduled visit; then Figure 3. | next scheduled visit | provisional deterministic | 2023 v1.1 |
| `F2-ATYPICAL-ENDOMETRIAL-OTHERWISE-GYNAECOLOGY` | previous atypical endometrial cells; not more than three years previously; not discharged by specialist services | Refer to specialist gynaecology; Test of Cure is not appropriate. | as soon as practicable | clinician-only | 2023 v1.1 |

## Figure 3

| Rule ID | Source condition | Expected action | Timing | Review | Current source |
|---|---|---|---|---|---|
| `F3-BASELINE-SWAB-HPV-NOT-DETECTED-5Y` | baseline HPV not detected; not immune deficient under v1.0.1 guidance | Return for HPV screening in five years. | 5 years | provisional deterministic | 2023 v1.1 |
| `F3-BASELINE-SWAB-HPV-NOT-DETECTED-IMMUNE-3Y` | baseline HPV not detected; immune deficient under v1.0.1 guidance | Return for HPV screening in three years. | 3 years | provisional deterministic | 2026-immune-v1.0.1 |
| `F3-BASELINE-LBC-HPV-NOT-DETECTED-5Y` | baseline HPV not detected; not immune deficient under v1.0.1 guidance | Return for HPV screening in five years. | 5 years | provisional deterministic | 2023 v1.1 |
| `F3-BASELINE-LBC-HPV-NOT-DETECTED-IMMUNE-3Y` | baseline HPV not detected; immune deficient under v1.0.1 guidance | Return for HPV screening in three years. | 3 years | provisional deterministic | 2026-immune-v1.0.1 |
| `F3-FIRST-REPEAT-HPV-NOT-DETECTED-5Y` | HPV not detected; immune competent | Return for HPV screening in five years. | 5 years | provisional deterministic | 2023 v1.1 |
| `F3-SECOND-REPEAT-HPV-NOT-DETECTED-5Y` | HPV not detected; immune competent | Return for HPV screening in five years. | 5 years | provisional deterministic | 2023 v1.1 |
| `F3-FIRST-REPEAT-HPV-NOT-DETECTED-IMMUNE-3Y` | HPV not detected; immune deficient | Return for HPV screening in three years. | 3 years | provisional deterministic | 2026-immune-v1.0.1 |
| `F3-SECOND-REPEAT-HPV-NOT-DETECTED-IMMUNE-3Y` | HPV not detected; immune deficient | Return for HPV screening in three years. | 3 years | provisional deterministic | 2026-immune-v1.0.1 |
| `F3-HPV16-18-SWAB-COLPOSCOPY` | HPV 16 or 18 detected | Refer directly to colposcopy; take LBC cytology at colposcopy. | — | mandatory confirmation | 2023 v1.1 |
| `F3-HPV16-18-LBC-COLPOSCOPY` | HPV 16 or 18 detected | Report reflex cytology and refer to colposcopy regardless of cytology result. | — | mandatory confirmation | 2023 v1.1 |
| `F3-HPV-OTHER-SWAB-RETURN-FOR-LBC` | HPV Other detected; cytology unavailable from swab | Return for clinical examination and an LBC cytology sample before the cytology-dependent branch is selected. | without avoidable delay | provisional deterministic | 2023 v1.1 |
| `F3-BASELINE-HPV-OTHER-NEGATIVE-REPEAT-12M` | baseline HPV Other; negative cytology | Repeat HPV testing in 12 months; LBC is recommended. | 12 months | provisional deterministic | 2023 v1.1 |
| `F3-BASELINE-HPV-OTHER-ASC-US-REPEAT-12M` | baseline HPV Other; ASC-US cytology | Repeat HPV testing in 12 months; LBC is recommended. | 12 months | provisional deterministic | 2023 v1.1 |
| `F3-BASELINE-HPV-OTHER-LSIL-REPEAT-12M` | baseline HPV Other; LSIL cytology | Repeat HPV testing in 12 months; LBC is recommended. | 12 months | provisional deterministic | 2023 v1.1 |
| `F3-BASELINE-HPV-OTHER-ASC-H-COLPOSCOPY` | HPV Other; ASC-H cytology | Refer to colposcopy. | — | mandatory confirmation | 2023 v1.1 |
| `F3-BASELINE-HPV-OTHER-HSIL-COLPOSCOPY` | HPV Other; HSIL cytology | Refer to colposcopy. | — | mandatory confirmation | 2023 v1.1 |
| `F3-BASELINE-HPV-OTHER-SCC-COLPOSCOPY` | HPV Other; squamous cell carcinoma cytology | Refer to colposcopy. | urgent assessment where invasive disease is suspected | mandatory confirmation | 2023 v1.1 |
| `F3-BASELINE-HPV-OTHER-ATYPICAL-GLANDULAR-COLPOSCOPY` | HPV Other; atypical glandular cells | Refer according to the glandular/specialist pathway; colposcopy applies except the endometrial exception. | — | clinician-only | 2023 v1.1 |
| `F3-BASELINE-HPV-OTHER-AIS-COLPOSCOPY` | HPV Other; adenocarcinoma in situ cytology | Refer to colposcopy. | — | mandatory confirmation | 2023 v1.1 |
| `F3-BASELINE-HPV-OTHER-ADENOCARCINOMA-COLPOSCOPY` | HPV Other; adenocarcinoma cytology | Refer according to the glandular/specialist pathway; colposcopy applies except the endometrial exception. | urgent assessment where invasive disease is suspected | clinician-only | 2023 v1.1 |
| `F3-FIRST-REPEAT-HPV-OTHER-NEGATIVE-UNDER50-SECOND-REPEAT` | HPV Other persists; negative cytology; age below 50 years | Schedule the second repeat HPV test in 12 months; LBC is recommended. | 12 months | provisional deterministic | 2023 v1.1 |
| `F3-FIRST-REPEAT-HPV-OTHER-NEGATIVE-AGE50PLUS-COLPOSCOPY` | HPV Other persists; negative cytology; age 50 years or older | Refer to colposcopy. | — | mandatory confirmation | 2023 v1.1 |
| `F3-FIRST-REPEAT-HPV-OTHER-ASC-US-UNDER50-SECOND-REPEAT` | HPV Other persists; ASC-US cytology; age below 50 years | Schedule the second repeat HPV test in 12 months; LBC is recommended. | 12 months | provisional deterministic | 2023 v1.1 |
| `F3-FIRST-REPEAT-HPV-OTHER-ASC-US-AGE50PLUS-COLPOSCOPY` | HPV Other persists; ASC-US cytology; age 50 years or older | Refer to colposcopy. | — | mandatory confirmation | 2023 v1.1 |
| `F3-FIRST-REPEAT-HPV-OTHER-LSIL-UNDER50-SECOND-REPEAT` | HPV Other persists; LSIL cytology; age below 50 years | Schedule the second repeat HPV test in 12 months; LBC is recommended. | 12 months | provisional deterministic | 2023 v1.1 |
| `F3-FIRST-REPEAT-HPV-OTHER-LSIL-AGE50PLUS-COLPOSCOPY` | HPV Other persists; LSIL cytology; age 50 years or older | Refer to colposcopy. | — | mandatory confirmation | 2023 v1.1 |
| `F3-FIRST-REPEAT-HPV-OTHER-ASC-H-COLPOSCOPY` | HPV Other persists; ASC-H cytology | Refer to colposcopy or the controlling glandular specialist pathway. | — | mandatory confirmation | 2023 v1.1 |
| `F3-FIRST-REPEAT-HPV-OTHER-HSIL-COLPOSCOPY` | HPV Other persists; HSIL cytology | Refer to colposcopy or the controlling glandular specialist pathway. | — | mandatory confirmation | 2023 v1.1 |
| `F3-FIRST-REPEAT-HPV-OTHER-SCC-COLPOSCOPY` | HPV Other persists; squamous cell carcinoma cytology | Refer to colposcopy or the controlling glandular specialist pathway. | — | mandatory confirmation | 2023 v1.1 |
| `F3-FIRST-REPEAT-HPV-OTHER-ATYPICAL-GLANDULAR-COLPOSCOPY` | HPV Other persists; atypical glandular cells | Refer to colposcopy or the controlling glandular specialist pathway. | — | clinician-only | 2023 v1.1 |
| `F3-FIRST-REPEAT-HPV-OTHER-AIS-COLPOSCOPY` | HPV Other persists; adenocarcinoma in situ cytology | Refer to colposcopy or the controlling glandular specialist pathway. | — | mandatory confirmation | 2023 v1.1 |
| `F3-FIRST-REPEAT-HPV-OTHER-ADENOCARCINOMA-COLPOSCOPY` | HPV Other persists; adenocarcinoma cytology | Refer to colposcopy or the controlling glandular specialist pathway. | — | clinician-only | 2023 v1.1 |
| `F3-SECOND-REPEAT-HPV16-18-COLPOSCOPY` | HPV16-18 detected at second repeat | Report cytology and refer to colposcopy; use the glandular specialist exception where applicable. | — | mandatory confirmation | 2023 v1.1 |
| `F3-SECOND-REPEAT-HPV-OTHER-COLPOSCOPY` | HPV-OTHER detected at second repeat | Report cytology and refer to colposcopy; use the glandular specialist exception where applicable. | — | mandatory confirmation | 2023 v1.1 |
| `F3-INVALID-HPV-REPEAT-ASAP` | HPV result invalid | Repeat the HPV test as soon as practicable without a mandatory delay. | as soon as practicable | provisional deterministic | 2023 v1.1 |
| `F3-UNSUITABLE-HPV-REPEAT-ASAP` | sample unsuitable for analysis, including leakage | Repeat the HPV test as soon as practicable without a mandatory delay. | as soon as practicable | provisional deterministic | 2023 v1.1 |
| `F3-HPV-OTHER-FIRST-UNSAT-CYTOLOGY-REPEAT` | HPV Other; first unsatisfactory cytology | Repeat LBC cytology within three months. | within 3 months | provisional deterministic | 2023 v1.1 |
| `F3-HPV-OTHER-SECOND-UNSAT-CYTOLOGY-COLPOSCOPY` | HPV Other; two consecutive unsatisfactory cytology results | Refer to colposcopy. | — | provisional deterministic | 2023 v1.1 |
| `F3-CYTOLOGY-PENDING-INCOMPLETE` | HPV Other; cytology pending | Keep the result incomplete; do not issue a terminal recommendation. | — | mandatory confirmation | 2023 v1.1 |
| `F3-MISSING-GENOTYPE-SAFETY-STOP` | HPV detected but genotype missing | Request the genotype/result category before routing. | — | mandatory confirmation | 2023 v1.1 |
| `F3-MISSING-SAMPLE-TYPE-SAFETY-STOP` | sample type missing | Request sample type before deciding whether cytology is available or a return visit is required. | — | mandatory confirmation | 2023 v1.1 |
| `F3-FIRST-REPEAT-MISSING-AGE-SAFETY-STOP` | persistent HPV Other with negative/low-grade cytology; age missing | Request age/date of birth before applying the ≥50 branch. | — | mandatory confirmation | 2023 v1.1 |
| `F3-HPV-NOT-DETECTED-UNKNOWN-IMMUNE-SAFETY-STOP` | HPV not detected; immune-deficiency status unknown | Resolve immune-deficiency classification before selecting three- versus five-year recall. | — | mandatory confirmation | 2023 v1.1 |

## Figure 4

| Rule ID | Source condition | Expected action | Timing | Review | Current source |
|---|---|---|---|---|---|
| `F4-NORMAL-COLPOSCOPY-INITIAL-REPEAT-12M` | enter Figure 4 | Repeat HPV test in community care in 12 months; use LBC. | 12 months | provisional deterministic | 2023 v1.1 |
| `F4-REPEAT-HPV-NOT-DETECTED-REGULAR-5Y` | HPV not detected; immune competent | Return to five-year regular screening. | 5 years | provisional deterministic | 2023 v1.1 |
| `F4-REPEAT-HPV-NOT-DETECTED-IMMUNE-3Y` | HPV not detected; immune deficient | Return to three-year screening. | 3 years | provisional deterministic | 2026-immune-v1.0.1 |
| `F4-REPEAT-HPV16-18-COLPOSCOPY` | HPV 16 or 18 detected | Refer to colposcopy. | — | mandatory confirmation | 2023 v1.1 |
| `F4-HPV-OTHER-ASC-H-COLPOSCOPY` | HPV Other; ASC-H cytology | Refer to colposcopy or the controlling glandular specialist route. | — | mandatory confirmation | 2023 v1.1 |
| `F4-HPV-OTHER-HSIL-COLPOSCOPY` | HPV Other; HSIL cytology | Refer to colposcopy or the controlling glandular specialist route. | — | mandatory confirmation | 2023 v1.1 |
| `F4-HPV-OTHER-SCC-COLPOSCOPY` | HPV Other; squamous cell carcinoma cytology | Refer to colposcopy or the controlling glandular specialist route. | — | mandatory confirmation | 2023 v1.1 |
| `F4-HPV-OTHER-ATYPICAL-GLANDULAR-COLPOSCOPY` | HPV Other; atypical glandular cells | Refer to colposcopy or the controlling glandular specialist route. | — | clinician-only | 2023 v1.1 |
| `F4-HPV-OTHER-AIS-COLPOSCOPY` | HPV Other; adenocarcinoma in situ cytology | Refer to colposcopy or the controlling glandular specialist route. | — | mandatory confirmation | 2023 v1.1 |
| `F4-HPV-OTHER-ADENOCARCINOMA-COLPOSCOPY` | HPV Other; adenocarcinoma cytology | Refer to colposcopy or the controlling glandular specialist route. | — | clinician-only | 2023 v1.1 |
| `F4-HPV-OTHER-NEGATIVE-SECOND-REPEAT-12M` | HPV Other; negative cytology; immune competent | Repeat HPV test in community care in 12 months; use LBC. | 12 months | provisional deterministic | 2023 v1.1 |
| `F4-HPV-OTHER-NEGATIVE-IMMUNE-COLPOSCOPY` | HPV Other; negative cytology; immune deficient | Refer to colposcopy. | — | mandatory confirmation | 2023 v1.1 |
| `F4-HPV-OTHER-ASC-US-SECOND-REPEAT-12M` | HPV Other; ASC-US cytology; immune competent | Repeat HPV test in community care in 12 months; use LBC. | 12 months | provisional deterministic | 2023 v1.1 |
| `F4-HPV-OTHER-ASC-US-IMMUNE-COLPOSCOPY` | HPV Other; ASC-US cytology; immune deficient | Refer to colposcopy. | — | mandatory confirmation | 2023 v1.1 |
| `F4-HPV-OTHER-LSIL-SECOND-REPEAT-12M` | HPV Other; LSIL cytology; immune competent | Repeat HPV test in community care in 12 months; use LBC. | 12 months | provisional deterministic | 2023 v1.1 |
| `F4-HPV-OTHER-LSIL-IMMUNE-COLPOSCOPY` | HPV Other; LSIL cytology; immune deficient | Refer to colposcopy. | — | mandatory confirmation | 2023 v1.1 |
| `F4-SECOND-REPEAT-HPV16-18-COLPOSCOPY` | HPV16-18 detected | Refer to colposcopy. | — | mandatory confirmation | 2023 v1.1 |
| `F4-SECOND-REPEAT-HPV-OTHER-COLPOSCOPY` | HPV-OTHER detected | Refer to colposcopy. | — | mandatory confirmation | 2023 v1.1 |
| `F4-SECOND-REPEAT-NOT-DETECTED-REGULAR-5Y` | HPV not detected; immune competent | Return to regular five-year screening. | 5 years | provisional deterministic | 2023 v1.1 |
| `F4-SECOND-REPEAT-NOT-DETECTED-IMMUNE-3Y` | HPV not detected; immune deficient | Return to three-year screening. | 3 years | provisional deterministic | 2023 v1.1 |
| `F4-TYPE3-LOW-GRADE-NORMAL-COLPOSCOPY-NO-MDM` | updated R6.05 applies | Continue the Figure 4 observation pathway without MDM cytological review. | 12-month repeat per Figure 4 | provisional deterministic | 2026-addendum-v1.0 |

## Figure 5

| Rule ID | Source condition | Expected action | Timing | Review | Current source |
|---|---|---|---|---|---|
| `F5-MDM-PENDING-REVIEW` | MDM outcome pending | Stop for MDM case review. | — | clinician-only | 2023 v1.1 |
| `F5-MDM-DOWNGRADED-LSIL-PATHWAY` | MDM downgrades cytology to LSIL | Follow the LSIL pathway. | — | clinician-only | 2023 v1.1 |
| `F5-MDM-UPGRADED-HSIL-PATHWAY` | MDM upgrades cytology to HSIL | Follow the HSIL pathway; specialist treatment decision required. | — | clinician-only | 2023 v1.1 |
| `F5-CONFIRMED-ASC-H-TREATMENT-RECOMMENDED` | ASC-H confirmed; treatment recommended | Proceed with specialist-recommended treatment. | — | clinician-only | 2023 v1.1 |
| `F5-TREATMENT-DEFERRED-ABNORMAL-TREATMENT` | treatment deferred; abnormal cytology, HPV detected, or visible lesion | Treatment is recommended; consider Type 2 transformation-zone excision. | — | clinician-only | 2023 v1.1 |
| `F5-TREATMENT-DEFERRED-HPV-NOT-DETECTED-TOC` | treatment deferred; HPV not detected; no visible lesion | Begin/continue Test of Cure co-testing. | co-testing sequence | clinician-only | 2023 v1.1 |
| `F5-TREATMENT-DEFERRED-HPV-DETECTED-NORMAL-12M` | treatment deferred; HPV detected; normal colposcopy; negative cytology | Repeat colposcopy, HPV, and cytology in 12 months. | 12 months | clinician-only | 2023 v1.1 |

## Figure 6

| Rule ID | Source condition | Expected action | Timing | Review | Current source |
|---|---|---|---|---|---|
| `F6-CIN2-UNDER30-ELIGIBLE-ACTIVE-SURVEILLANCE` | biopsy-confirmed CIN2; age below 30 at diagnosis; Type 1 or 2 transformation zone; CIN3 and invasion excluded; MDM histology review complete; participant agrees | Begin active surveillance with colposcopy, cytology, and biopsy of visible lesions every six months. | 6-monthly for no more than 24 months | clinician-only | 2026-addendum-v1.0 |
| `F6-CIN2-SURVEILLANCE-CIN3-TREAT` | active surveillance; CIN3 develops at any review | Stop surveillance and proceed to specialist treatment. | at detection | clinician-only | 2026-addendum-v1.0 |
| `F6-CIN2-PERSISTS-24M-TREAT` | active surveillance; CIN2 persists at 24 months | Proceed to specialist treatment. | 24 months | clinician-only | 2026-addendum-v1.0 |
| `F6-CIN2-REGRESSION-TOC` | active surveillance; CIN2 regresses and no CIN3/invasion | Discharge from surveillance into Test of Cure. | after documented regression | clinician-only | 2026-addendum-v1.0 |
| `F6-6M-HPV-DETECTED-COLPOSCOPY` | six-month post-treatment co-test; HPV detected any type | Refer to colposcopy. | — | mandatory confirmation | 2023 v1.1 |
| `F6-6M-HPV-NOT-DETECTED-HIGH-GRADE-COLPOSCOPY` | six-month HPV not detected; possible/definite high-grade cytology | Refer to colposcopy. | — | mandatory confirmation | 2023 v1.1 |
| `F6-6M-HPV-NOT-DETECTED-LOW-GRADE-REPEAT-12M` | six-month HPV not detected; low-grade cytology | Repeat HPV and cytology in 12 months. | 12 months | provisional deterministic | 2023 v1.1 |
| `F6-6M-FIRST-NEGATIVE-REPEAT-12M` | six-month HPV not detected; negative cytology; first negative co-test | Repeat HPV and cytology in 12 months. | 12 months | provisional deterministic | 2023 v1.1 |
| `F6-18M-SECOND-NEGATIVE-COMPLETE` | two consecutive HPV-not-detected and negative-cytology co-tests 12 months apart | Successfully complete Test of Cure and return to regular screening. | — | provisional deterministic | 2023 v1.1 |
| `F6-18M-HPV-DETECTED-COLPOSCOPY` | repeat co-test after first negative; HPV detected any type | Refer to colposcopy. | — | mandatory confirmation | 2023 v1.1 |
| `F6-18M-HPV-NOT-DETECTED-HIGH-GRADE-COLPOSCOPY` | repeat HPV not detected; possible/definite high-grade cytology | Refer to colposcopy. | — | mandatory confirmation | 2023 v1.1 |
| `F6-18M-HPV-NOT-DETECTED-LOW-GRADE-REPEAT` | repeat HPV not detected; low-grade cytology after prior negative co-test | Repeat HPV and cytology in 12 months. | 12 months | provisional deterministic | 2023 v1.1 |
| `F6-AFTER-LOW-GRADE-HPV-DETECTED-COLPOSCOPY` | co-test after a low-grade cytology event; HPV detected any type | Refer to colposcopy. | — | mandatory confirmation | 2023 v1.1 |
| `F6-AFTER-LOW-GRADE-HPV-NOT-DETECTED-ABNORMAL-COLPOSCOPY` | co-test after a low-grade cytology event; HPV not detected; cytology remains abnormal | Refer to colposcopy. | — | mandatory confirmation | 2023 v1.1 |
| `F6-AFTER-LOW-GRADE-NEGATIVE-CONTINUE-TOC` | co-test after a low-grade cytology event; HPV not detected; negative cytology | Continue Test of Cure until the required negative sequence is complete. | 12 months between qualifying co-tests | provisional deterministic | 2023 v1.1 |
| `F6-MISSING-TREATMENT-DATE-SAFETY-STOP` | Test of Cure requested; treatment date missing | Stop and obtain the treatment date before calculating the six- or eighteen-month event. | — | mandatory confirmation | 2023 v1.1 |
| `F6-POSITIVE-MARGINS-UNDER50-COMMUNITY-TOC` | positive HSIL excision margins; age below 50 | Test of Cure follow-up may occur in primary/community care. | 6 and 18 months post-treatment | provisional deterministic | 2026-addendum-v1.0 |
| `F6-POSITIVE-MARGINS-AGE50PLUS-SPECIALIST` | positive HSIL excision margins; age 50 or older | Follow the specialist/colposcopy positive-margin pathway. | — | clinician-only | 2026-addendum-v1.0 |

## Figure 7

| Rule ID | Source condition | Expected action | Timing | Review | Current source |
|---|---|---|---|---|---|
| `F7-AG2-GYNAECOLOGY` | AG2 | Refer to gynaecology. | — | clinician-only | 2023 v1.1 |
| `F7-AC2-GYNAECOLOGY` | AC2 | Refer to gynaecology. | urgent | clinician-only | 2023 v1.1 |
| `F7-AG1-COLPOSCOPY` | AG1 | Refer to colposcopy for specialist assessment. | — | clinician-only | 2023 v1.1 |
| `F7-AG3-COLPOSCOPY` | AG3 | Refer to colposcopy for specialist assessment. | — | clinician-only | 2023 v1.1 |
| `F7-AG4-COLPOSCOPY` | AG4 | Refer to colposcopy for specialist assessment. | — | clinician-only | 2023 v1.1 |
| `F7-AG5-COLPOSCOPY` | AG5 | Refer to colposcopy for specialist assessment. | — | clinician-only | 2023 v1.1 |
| `F7-AC1-COLPOSCOPY` | AC1 | Refer to colposcopy for specialist assessment. | urgent | clinician-only | 2023 v1.1 |
| `F7-AC3-COLPOSCOPY` | AC3 | Refer to colposcopy for specialist assessment. | urgent | clinician-only | 2023 v1.1 |
| `F7-AC4-COLPOSCOPY` | AC4 | Refer to colposcopy for specialist assessment. | urgent | clinician-only | 2023 v1.1 |
| `F7-NO-LESION-CYTOLOGY-CONFIRMED-TYPE3-EXCISION` | no visible lesion; MDM confirms cytology, not AG2 | Specialist Type 3 excision. | — | clinician-only | 2023 v1.1 |
| `F7-NO-LESION-AG2-CONFIRMED-INVESTIGATE` | no visible lesion; MDM confirms AG2 | Investigate further for other gynaecological malignancies. | — | clinician-only | 2023 v1.1 |
| `F7-NO-LESION-CYTOLOGY-NOT-CONFIRMED-6M` | no visible lesion; MDM does not confirm cytology | Repeat colposcopy in six months. | 6 months | clinician-only | 2023 v1.1 |
| `F7-VISIBLE-LESION-BIOPSY-AIS-TYPE3` | visible lesion; biopsy shows AIS | Specialist Type 3 excision. | — | clinician-only | 2023 v1.1 |
| `F7-VISIBLE-LESION-BIOPSY-CANCER-ONCOLOGY` | visible lesion; biopsy consistent with cancer | Refer to gynaecological oncology. | urgent | clinician-only | 2023 v1.1 |
| `F7-AIS-CLEAR-MARGINS-PRIMARY-CARE-6-18M` | clear margins | Follow in primary/community care with co-tests at 6 and 18 months. | 6 and 18 months post-treatment | mandatory confirmation | 2026-addendum-v1.0 |

## Figure 8

| Rule ID | Source condition | Expected action | Timing | Review | Current source |
|---|---|---|---|---|---|
| `F8-CANCER-STAGE1A1-LOCAL-EXCISION-TOC-COMPLETE-REGULAR` | stage 1a1 cervical cancer treated by local excision; treatment and Test of Cure successful | Return to regular NCSP screening. | — | mandatory confirmation | 2026-addendum-v1.0 |
| `F8-CANCER-STAGE1A1-TOC-ABNORMAL-COLPOSCOPY` | stage 1a1 cervical cancer local excision; HPV detected or abnormal cytology during Test of Cure | Refer to colposcopy. | — | mandatory confirmation | 2026-addendum-v1.0 |
| `F8-CANCER-STAGE1A1-POST-TOC-HPV-FIG3` | stage 1a1 cervical cancer local excision; Test of Cure complete; subsequent HPV detected | Follow the HPV primary screening pathway. | — | mandatory confirmation | 2026-addendum-v1.0 |
| `F8-CANCER-TOTAL-HYSTERECTOMY-TOC-COMPLETE-CEASE` | stage 1a1 cervical cancer; total hysterectomy; Test of Cure complete | Cease NCSP screening. | — | mandatory confirmation | 2026-addendum-v1.0 |
| `F8-OTHER-GYNAECOLOGICAL-CANCER-OUTSIDE-NCSP` | other gynaecological cancer history; not enrolled in an NCSP pathway | No deterministic NCSP recommendation; clinician and participant determine follow-up. | — | clinician-only | 2026-addendum-v1.0 |
| `F8-NONCERVICAL-CANCER-HYSTERECTOMY-HSIL-INCOMPLETE-TOC` | total hysterectomy for non-cervical gynaecological cancer; HSIL history without completed Test of Cure | Complete Test of Cure and obtain two negative co-tests 12 months apart before cessation. | two negative co-tests 12 months apart | mandatory confirmation | 2026-addendum-v1.0 |
| `F8-LOW-RISK-NO-PATHOLOGY-NO-FURTHER` | negative/returned-regular history; no cervical pathology | No further screening. | — | provisional deterministic | 2023 v1.1 |
| `F8-LOW-RISK-LSIL-HPV` | negative/returned-regular history; unexpected LSIL/CIN1 | Perform HPV test; if detected follow Figure 3, if not detected cease. | — | provisional deterministic | 2023 v1.1 |
| `F8-LOW-RISK-COMPLETE-HSIL-AIS-TOC` | negative/returned-regular history; unexpected HSIL/AIS completely excised | Complete Test of Cure. | — | mandatory confirmation | 2023 v1.1 |
| `F8-LOW-RISK-INCOMPLETE-HSIL-AIS-COLPOSCOPY` | negative/returned-regular history; unexpected HSIL/AIS incompletely excised | Refer to colposcopy. | — | mandatory confirmation | 2023 v1.1 |
| `F8-NO-KNOWN-HISTORY-NO-LOW-PATHOLOGY-HPV6M` | no known screening history; no pathology or LSIL/CIN1 | HPV test at six months after hysterectomy. | 6 months post-hysterectomy | provisional deterministic | 2023 v1.1 |
| `F8-PRIOR-LOW-GRADE-NOT-RETURNED-HPV` | prior low-grade history not returned to regular screening; normal or LSIL pathology | Perform HPV test and follow Figure 3. | — | provisional deterministic | 2023 v1.1 |
| `F8-TREATED-HSIL-AIS-TOC-COMPLETE-NO-PATH-NO-FURTHER` | previous HSIL/AIS treatment; Test of Cure complete; no cervical pathology | No further screening. | — | provisional deterministic | 2023 v1.1 |
| `F8-TREATED-HSIL-AIS-TOC-COMPLETE-LSIL-HPV` | previous HSIL/AIS treatment; Test of Cure complete; LSIL/CIN1 pathology | Perform HPV test and follow Figure 3. | — | provisional deterministic | 2023 v1.1 |
| `F8-INCOMPLETE-TOC-NO-LOW-PATH-CONTINUE-TOC` | previous HSIL/AIS; Test of Cure incomplete; no pathology or LSIL/CIN1 | Continue Test of Cure until successful completion. | — | mandatory confirmation | 2023 v1.1 |
| `F8-UNTREATED-HSIL-AIS-NO-LOW-PATH-TOC` | HSIL/AIS untreated or incompletely treated before hysterectomy; no pathology or LSIL/CIN1 | Complete Test of Cure. | — | mandatory confirmation | 2023 v1.1 |
| `F8-ANY-HIGH-GRADE-COMPLETE-TOC` | HSIL/CIN2/3 or AIS in specimen; complete excision | Complete Test of Cure. | — | mandatory confirmation | 2023 v1.1 |
| `F8-ANY-HIGH-GRADE-INCOMPLETE-COLPOSCOPY` | HSIL/CIN2/3 or AIS in specimen; incomplete excision | Refer to colposcopy. | — | mandatory confirmation | 2023 v1.1 |

## Table 1

| Rule ID | Source condition | Expected action | Timing | Review | Current source |
|---|---|---|---|---|---|
| `T1-NEGATIVE-OR-RETURNED-REGULAR-NO-PATHOLOGY` | negative history or previous ASC-US/LSIL returned to regular screening; no cervical pathology | No further screening. | — | provisional deterministic | 2023 v1.1 |
| `T1-NEGATIVE-OR-RETURNED-REGULAR-LSIL-CIN1` | negative history or previous ASC-US/LSIL returned to regular screening; LSIL/CIN1, excised or not | HPV test and follow Figure 3. | — | provisional deterministic | 2023 v1.1 |
| `T1-NEGATIVE-OR-RETURNED-REGULAR-HSIL-AIS-COMPLETE` | negative history or previous ASC-US/LSIL returned to regular screening; HSIL/CIN2/3 or AIS completely excised | Test of Cure. | — | mandatory confirmation | 2023 v1.1 |
| `T1-NEGATIVE-OR-RETURNED-REGULAR-HSIL-AIS-INCOMPLETE` | negative history or previous ASC-US/LSIL returned to regular screening; HSIL/CIN2/3 or AIS incompletely excised | Colposcopy. | — | mandatory confirmation | 2023 v1.1 |
| `T1-LOW-GRADE-NOT-RETURNED-NO-PATHOLOGY` | previous ASC-US/LSIL not returned to regular screening; no cervical pathology | HPV test and follow Figure 3. | — | provisional deterministic | 2023 v1.1 |
| `T1-LOW-GRADE-NOT-RETURNED-LSIL-CIN1` | previous ASC-US/LSIL not returned to regular screening; LSIL/CIN1, excised or not | HPV test and follow Figure 3. | — | provisional deterministic | 2023 v1.1 |
| `T1-LOW-GRADE-NOT-RETURNED-HSIL-AIS-COMPLETE` | previous ASC-US/LSIL not returned to regular screening; HSIL/CIN2/3 or AIS completely excised | Test of Cure. | — | mandatory confirmation | 2023 v1.1 |
| `T1-LOW-GRADE-NOT-RETURNED-HSIL-AIS-INCOMPLETE` | previous ASC-US/LSIL not returned to regular screening; HSIL/CIN2/3 or AIS incompletely excised | Colposcopy. | — | mandatory confirmation | 2023 v1.1 |
| `T1-TREATED-HSIL-TOC-COMPLETE-NO-PATHOLOGY` | treated HSIL/CIN2/3 with completed Test of Cure; no cervical pathology | No further screening. | — | provisional deterministic | 2023 v1.1 |
| `T1-TREATED-HSIL-TOC-COMPLETE-LSIL-CIN1` | treated HSIL/CIN2/3 with completed Test of Cure; LSIL/CIN1, excised or not | HPV test and follow Figure 3. | — | provisional deterministic | 2023 v1.1 |
| `T1-TREATED-HSIL-TOC-COMPLETE-HSIL-AIS-COMPLETE` | treated HSIL/CIN2/3 with completed Test of Cure; HSIL/CIN2/3 or AIS completely excised | Test of Cure. | — | mandatory confirmation | 2023 v1.1 |
| `T1-TREATED-HSIL-TOC-COMPLETE-HSIL-AIS-INCOMPLETE` | treated HSIL/CIN2/3 with completed Test of Cure; HSIL/CIN2/3 or AIS incompletely excised | Colposcopy. | — | mandatory confirmation | 2023 v1.1 |
| `T1-HSIL-AIS-UNTREATED-INCOMPLETE-NO-OR-LOW-PATHOLOGY` | diagnosed HSIL/CIN2/3 or AIS before hysterectomy, untreated or incompletely treated; no cervical pathology or low grade | Test of Cure. | — | mandatory confirmation | 2023 v1.1 |
| `T1-HSIL-AIS-UNTREATED-INCOMPLETE-HSIL-AIS-COMPLETE` | diagnosed HSIL/CIN2/3 or AIS before hysterectomy, untreated or incompletely treated; HSIL/CIN2/3 or AIS completely excised | Test of Cure. | — | mandatory confirmation | 2023 v1.1 |
| `T1-HSIL-AIS-UNTREATED-INCOMPLETE-HSIL-AIS-INCOMPLETE` | diagnosed HSIL/CIN2/3 or AIS before hysterectomy, untreated or incompletely treated; HSIL/CIN2/3 or AIS incompletely excised | Colposcopy. | — | mandatory confirmation | 2023 v1.1 |
| `T1-PREVIOUS-TREATMENT-INCOMPLETE-TOC-NO-OR-LOW-PATHOLOGY` | previous treatment for HSIL/CIN2/3 or AIS with incomplete Test of Cure; no cervical pathology or low grade | Test of Cure. | — | mandatory confirmation | 2023 v1.1 |
| `T1-PREVIOUS-TREATMENT-INCOMPLETE-TOC-HSIL-AIS-COMPLETE` | previous treatment for HSIL/CIN2/3 or AIS with incomplete Test of Cure; HSIL/CIN2/3 or AIS completely excised | Test of Cure. | — | mandatory confirmation | 2023 v1.1 |
| `T1-PREVIOUS-TREATMENT-INCOMPLETE-TOC-HSIL-AIS-INCOMPLETE` | previous treatment for HSIL/CIN2/3 or AIS with incomplete Test of Cure; HSIL/CIN2/3 or AIS incompletely excised | Colposcopy. | — | mandatory confirmation | 2023 v1.1 |
| `T1-NO-KNOWN-HISTORY-NO-OR-LOW-PATHOLOGY` | no known screening history; no cervical pathology or low grade | HPV test at six months post-hysterectomy. | 6 months post-hysterectomy | provisional deterministic | 2023 v1.1 |
| `T1-NO-KNOWN-HISTORY-HSIL-AIS-COMPLETE` | no known screening history; HSIL/CIN2/3 or AIS completely excised | Test of Cure. | — | mandatory confirmation | 2023 v1.1 |
| `T1-NO-KNOWN-HISTORY-HSIL-AIS-INCOMPLETE` | no known screening history; HSIL/CIN2/3 or AIS incompletely excised | Colposcopy. | — | mandatory confirmation | 2023 v1.1 |

## Figure 9

| Rule ID | Source condition | Expected action | Timing | Review | Current source |
|---|---|---|---|---|---|
| `F9-PREGNANT-ASC-H-INITIAL-COLPOSCOPY` | ASC-H cytology | Refer for colposcopy by an experienced colposcopist; do not treat autonomously. | — | clinician-only | 2023 v1.1 |
| `F9-PREGNANT-HSIL-INITIAL-COLPOSCOPY` | HSIL cytology | Refer for colposcopy by an experienced colposcopist; do not treat autonomously. | — | clinician-only | 2023 v1.1 |
| `F9-PREGNANT-ATYPICAL-GLANDULAR-INITIAL-COLPOSCOPY` | atypical glandular cells cytology | Refer for colposcopy by an experienced colposcopist; do not treat autonomously. | — | clinician-only | 2023 v1.1 |
| `F9-PREGNANT-AIS-INITIAL-COLPOSCOPY` | AIS cytology | Refer for colposcopy by an experienced colposcopist; do not treat autonomously. | — | clinician-only | 2023 v1.1 |
| `F9-NORMAL-TZ-MDM-DOWNGRADE-NEGATIVE-F3` | normal transformation zone/no visible lesion; MDM downgrades to negative | Follow Figure 3 HPV primary screening. | — | clinician-only | 2023 v1.1 |
| `F9-NORMAL-TZ-MDM-DOWNGRADE-LOW-GRADE` | normal transformation zone/no visible lesion; MDM downgrades to ASC-US/LSIL | Follow the LSIL pathway. | — | clinician-only | 2023 v1.1 |
| `F9-NORMAL-TZ-MDM-CONFIRMS-HIGH-GRADE-REVIEW` | normal transformation zone/no visible lesion; MDM confirms possible/definite high-grade | Colposcopy review in six months or 6–12 weeks postpartum. | 6 months or 6–12 weeks postpartum | clinician-only | 2023 v1.1 |
| `F9-ABNORMAL-TZ-LSIL-HSIL-AIS-REVIEW` | abnormal transformation zone/visible lesion; colposcopic impression LSIL, HSIL/CIN2/3, or AIS | Colposcopy review in six months or 6–12 weeks postpartum. | 6 months or 6–12 weeks postpartum | clinician-only | 2023 v1.1 |
| `F9-INVASION-BIOPSY-POSITIVE-ONCOLOGY` | colposcopic impression of invasion; biopsy positive for invasion | Refer to gynaecological oncology. | urgent | clinician-only | 2023 v1.1 |
| `F9-INVASION-BIOPSY-NEGATIVE-MDM` | colposcopic impression of invasion; biopsy negative for invasion | MDM case review. | — | clinician-only | 2023 v1.1 |

## Figure 10

| Rule ID | Source condition | Expected action | Timing | Review | Current source |
|---|---|---|---|---|---|
| `F10-SINGLE-PREMENOPAUSAL-PCB-REASSURING-NO-COLPOSCOPY` | single episode of postcoital bleeding; pre-menopausal; clinically normal cervix; HPV not detected; negative cytology | No colposcopy referral is required; continue appropriate screening and clinical follow-up. | — | mandatory confirmation | 2023 v1.1 |
| `F10-RECURRENT-PERSISTENT-PCB-GYNAECOLOGY` | postcoital bleeding recurs or persists; negative co-test does not resolve symptom concern | Refer to gynaecology for assessment, which may include colposcopy. | as appropriate without routine-screening reassurance | clinician-only | 2023 v1.1 |
| `F10-PERSISTENT-UNEXPLAINED-IMB-GYNAECOLOGY` | persistent and/or unexplained inter-menstrual bleeding | Refer for specialist gynaecological assessment regardless of test results. | without allowing screening results to cancel referral | clinician-only | 2023 v1.1 |
| `F10-POSTMENOPAUSAL-BLEEDING-EXAM-COTEST-GYNAECOLOGY` | any postmenopausal bleeding, including postcoital bleeding | Examine, obtain a co-test, and refer for specialist gynaecological assessment; do not delay for blood or results. | referral must not wait for co-test results | clinician-only | 2023 v1.1 |
| `F10-CANCER-SIGNS-URGENT-GYNAECOLOGY` | signs or symptoms of cervical cancer | Refer for gynaecological assessment without delay; do not wait for co-test results. | without delay | clinician-only | 2023 v1.1 |
| `F10-ABNORMAL-CERVIX-CANCER-COTEST-COLPOSCOPY` | abnormal cervix; suspicion of cancer | Perform co-test and refer to colposcopy; do not delay referral for the co-test. | without delay | mandatory confirmation | 2023 v1.1 |
| `F10-ABNORMAL-CERVIX-NO-CANCER-LOCAL-REVIEW` | abnormal cervix; no suspicion of cancer | Treat according to approved Healthcare Pathways or refer to gynaecology, then review. | 6–8 weeks | clinician-only | 2023 v1.1 |
| `F10-NORMAL-CERVIX-OCP-ADJUST-REVIEW` | normal cervix; oral-contraceptive problem suspected | Adjust oral contraceptive and review bleeding. | 6–8 weeks | provisional deterministic | 2023 v1.1 |
| `F10-NORMAL-CERVIX-STI-TREAT-REVIEW` | normal cervix; no OCP problem; STI identified | Treat STI and review bleeding. | 6–8 weeks | provisional deterministic | 2023 v1.1 |
| `F10-NORMAL-CERVIX-NO-STI-LOCAL-PATHWAY` | normal cervix; no OCP problem; no STI identified | Manage according to an approved Healthcare Pathway or refer to gynaecology. | 6–8 weeks if treated locally | clinician-only | 2023 v1.1 |
| `F10-REVIEW-BLEEDING-RESOLVED-AGE25PLUS` | bleeding resolved at 6–8 week review; age 25 or older | Continue regular cervical screening. | — | provisional deterministic | 2023 v1.1 |
| `F10-REVIEW-BLEEDING-RESOLVED-UNDER25` | bleeding resolved at 6–8 week review; age below 25 | Commence routine cervical screening at age 25. | at age 25 | provisional deterministic | 2023 v1.1 |
| `F10-REVIEW-BLEEDING-PERSISTS-GYNAECOLOGY` | bleeding persists at 6–8 week review | Refer to gynaecology. | after 6–8 week review | clinician-only | 2023 v1.1 |

## Machine-readable contract

`complete-guideline-oracle.json` contains the full required schema for every object: source/version/page/recommendations, effective version, entry/exclusion/required/conditional facts, branch conditions, action/referral/timing, booking-priority separation, clinician-review flags, missing-data behaviour, rationale, supersession, and source ambiguity.

This is an audit oracle for executable comparison. It is not clinical validation and must remain subject to formal clinical-governance review before product remediation or use.
