# Final Clinical Review Pack

Source document: `docs/current-implemented-cervical-screening-rulebook.md`

Status: safe for clinical review demo.

This pack is for clinical validation only. It is not an approved clinical protocol, not a substitute for NCSP guidance, Healthcare Pathways, NCSR history, local policy, or specialist judgement.

The deterministic engine output is the source of truth. Visual diagrams are simplified and non-authoritative.

## 1. Reviewer-Facing Summary

The demo implements a deterministic cervical screening pathway wizard with two entry branches:

- Direct HPV / Molecular Screening Pathway
- GP / Routine Clinical Care / Specialist Pathway

The app does not use generative AI to choose recommendations. The final recommendation comes from the deterministic rule engine in `lib/engine/decision-engine.ts`, using mapped `ClinicalInput` values from `lib/wizard/steps.ts`.

Current release status:

| Area | Current status for review |
|---|---|
| Product state | Safe for clinical review demo |
| Clinical protocol status | Not approved clinical protocol |
| Engine type | Deterministic rule engine |
| Source of truth | Engine recommendation code and output |
| Visual diagrams | Simplified/non-authoritative |
| Clinical sign-off | Pending |
| Healthcare Pathways/local gynaecology interpretation | Requires clinical sign-off |
| NCSR/history-dependent branches | Manual/external-history dependent; requires clinical sign-off |

Primary implementation references:

| Area | Source |
|---|---|
| Wizard questions, visibility, mapping, pruning | `lib/wizard/steps.ts` |
| Wizard page and back navigation | `app/(app)/pathway/[sessionId]/page.tsx` |
| Answer save and consent audit | `app/api/pathway/sessions/[id]/answer/route.ts` |
| Completion, persistence, audit, engine call | `app/api/pathway/sessions/[id]/complete/route.ts` |
| Deterministic rules | `lib/engine/decision-engine.ts` |
| Engine types | `lib/engine/types.ts` |
| Persistence schema | `prisma/schema.prisma` |
| Simplified visual summaries | `lib/decision-trees/index.ts` |
| Regression tests | `lib/engine/__tests__/*.test.ts` |

Core implemented flow:

1. Select entry branch.
2. Confirm patient consent.
3. Answer only currently visible pathway questions.
4. Hidden/stale future answers are pruned when earlier answers change.
5. Completion maps visible answers to `ClinicalInput`.
6. Deterministic engine returns a recommendation code.
7. Recommendation, `inputFacts`, audit events, and structured clinical records are persisted.

## 2. Figure-By-Figure Validation Checklist

Use this checklist against the live demo and the implementation rulebook. The reviewer should mark each row after independent validation.

### Figure 1 - Transition To HPV Primary Screening

| Review item | Implemented behaviour/code | Reviewer |
|---|---|---|
| Never screened / under-screened / overdue routes to invite now | `F1-INVITE-NOW` | [ ] |
| Regular screening routes to next scheduled visit | `F1-INVITE-NEXT-SCHEDULED` | [ ] |
| Regular screening with completed Test of Cure routes to next scheduled visit | `F1-INVITE-NEXT-SCHEDULED` | [ ] |
| Unknown status requires external history | `F1-EXTERNAL-HISTORY-REQUIRED` | [ ] |
| Figure 1 is reached from GP/clinical branch, not Direct HPV branch | Branch visibility/routing | [ ] |

### Figure 2 - Previous High-Grade, AIS, Glandular, Or Atypical Endometrial History

| Review item | Implemented behaviour/code | Reviewer |
|---|---|---|
| Outstanding recommended colposcopy routes to colposcopy | `F2-PRIOR-HG-COLP` | [ ] |
| Prior high-grade with incomplete Test of Cure routes to Test of Cure | `F2-PRIOR-HG-COMPLETE-TOC` | [ ] |
| Completed Test of Cure routes to primary HPV pathway | Figure 3 delegation | [ ] |
| Atypical endometrial cells older than 3 years route to Figure 3 | `F2-AG2-OLDER-3Y-FIG3` | [ ] |
| Atypical endometrial cells discharged to primary care route to Figure 3 | `F2-AG2-DISCHARGED-FIG3` | [ ] |
| Returned to 3-yearly cytology after atypical endometrial cells routes to Figure 3 | `F2-AG2-RETURNED-3Y-CYTOLOGY-FIG3` | [ ] |
| Otherwise atypical endometrial cells route to specialist gynaecology | `F2-AG2-SPECIALIST-GYN` | [ ] |
| Previous AIS without total hysterectomy remains service-defined/clinical review | `F2-AIS-R208-FOLLOWUP` | [ ] |

### Figure 3 - Primary HPV Screening

| Review item | Implemented behaviour/code | Reviewer |
|---|---|---|
| HPV not detected returns to 5-year recall | `F3-HPV-NOT-DETECTED-5Y` | [ ] |
| HPV not detected in immunocompromised participant returns to 3-year recall | `F3-HPV-NOT-DETECTED-IC-3Y` | [ ] |
| HPV16/18 routes directly to colposcopy | `F3-1618-COLP` | [ ] |
| HPV16/18 with SWAB routes directly to colposcopy | `F3-1618-COLP`; no swab-return block | [ ] |
| HPV16/18 with LBC routes directly to colposcopy | `F3-1618-COLP` | [ ] |
| HPV16/18 does not require cytology | Cytology hidden in ordinary Direct HPV path | [ ] |
| HPV Other with SWAB and no return visit stops at return-visit recommendation | `F3-SWAB-RETURN-REQUIRED` | [ ] |
| HPV Other with return visit / LBC and negative, ASC-US, or LSIL routes to 12-month repeat | `F3-HPV-OTHER-NEG-ASCUS-LSIL-12M` | [ ] |
| HPV Other with high-grade cytology routes to colposcopy | `F3-HPV-OTHER-HIGH-GRADE-COLP` | [ ] |
| First repeat HPV Other low-grade age >= 50 routes to colposcopy | `F3-FIRST-REPEAT-AGE50-COLP` | [ ] |
| First repeat HPV Other low-grade age < 50 routes to second repeat | `F3-FIRST-REPEAT-UNDER50-SECOND-REPEAT` | [ ] |
| Second repeat HPV detected routes to colposcopy | `F3-SECOND-REPEAT-HPV-DETECTED-COLP` | [ ] |
| HPV inadequate and cytology unsatisfactory are hidden from active demo HPV/cytology options | UI visibility/test coverage | [ ] |

### Figure 4 - Normal Colposcopy After Low-Grade Cytology

| Review item | Implemented behaviour/code | Reviewer |
|---|---|---|
| Normal colposcopy follow-up starts with 12-month HPV repeat | `F4-NORMAL-COLP-REPEAT-HPV-12M` | [ ] |
| Repeat HPV not detected returns to regular screening | `F4-REPEAT-HPV-NOT-DETECTED-REGULAR` | [ ] |
| Repeat HPV16/18 routes to colposcopy | `F4-REPEAT-1618-COLP` | [ ] |
| HPV Other plus high-grade cytology routes to colposcopy | `F4-HPV-OTHER-HIGH-GRADE-COLP` | [ ] |
| HPV Other plus low-grade cytology in immune-deficient participant routes to colposcopy | `F4-HPV-OTHER-LOW-GRADE-IC-COLP` | [ ] |
| HPV Other plus low-grade cytology otherwise repeats HPV in 12 months | `F4-HPV-OTHER-LOW-GRADE-SECOND-REPEAT` | [ ] |
| Second repeat HPV detected any type routes to colposcopy | `F4-SECOND-REPEAT-HPV-DETECTED-COLP` | [ ] |

### Figure 5 - Normal Colposcopy After High-Grade Cytology

| Review item | Implemented behaviour/code | Reviewer |
|---|---|---|
| Initial high-grade normal colposcopy requires MDM review | `F5-MDM-REQUIRED` | [ ] |
| MDM downgraded LSIL/ASC-US follows LSIL pathway | `F5-MDM-DOWNGRADED-LSIL` | [ ] |
| MDM upgraded HSIL recommends treatment | `F5-MDM-UPGRADED-HSIL-TREAT` | [ ] |
| Confirmed ASC-H + HPV not detected + no visible lesion routes to Test of Cure/co-test | `F5-CONFIRMED-ASCH-HPV-NEG-NO-LESION-TOC` | [ ] |
| Confirmed ASC-H + HPV detected + normal colposcopy + negative cytology repeats colposcopy/HPV/cytology in 12 months | `F5-CONFIRMED-ASCH-HPV-DETECTED-NORMAL-NEG-12M` | [ ] |
| Confirmed ASC-H + abnormal cytology recommends treatment | `F5-CONFIRMED-ASCH-TREAT` | [ ] |
| Confirmed ASC-H + visible lesion recommends treatment | `F5-CONFIRMED-ASCH-TREAT` | [ ] |
| No broad “HPV detected alone = treatment” rule remains | Regression-tested | [ ] |

### Figure 6 - Test Of Cure

| Review item | Implemented behaviour/code | Reviewer |
|---|---|---|
| First negative Test of Cure repeats cytology and HPV in 12 months | `F6-FIRST-NEGATIVE-REPEAT-12M` | [ ] |
| Second negative Test of Cure returns to regular screening | `F6-SECOND-NEGATIVE-RETURN-REGULAR` | [ ] |
| HPV detected any type with any cytology routes to colposcopy | `F6-HPV-DETECTED-ANY-CYTOLOGY-COLP` | [ ] |
| HPV not detected plus low-grade cytology repeats in 12 months | `F6-HPV-NEG-LOW-GRADE-REPEAT-12M` | [ ] |
| HPV not detected plus high-grade cytology routes to colposcopy | `F6-HPV-NEG-HIGH-GRADE-COLP` | [ ] |
| Repeat HPV not detected but cytology abnormal routes to colposcopy | `F6-REPEAT-HPV-NEG-CYTOLOGY-ABNORMAL-COLP` | [ ] |
| Continuing Test of Cure remains in Test of Cure until successful completion | `F6-CONTINUE-TOC-UNTIL-COMPLETE` | [ ] |

### Figure 7 - Atypical And Abnormal Glandular Abnormalities

| Review item | Implemented behaviour/code | Reviewer |
|---|---|---|
| AG2 routes to gynaecology | `F7-AG2-GYNAECOLOGY` | [ ] |
| AC2 routes to gynaecology | `F7-AC2-GYNAECOLOGY` | [ ] |
| AG1, AG3, AG4, AG5, AC1, AC3, AC4 route to colposcopy | `F7-GLANDULAR-COLPOSCOPY` | [ ] |
| Visible lesion requires biopsy | `F7-VISIBLE-LESION-BIOPSY` | [ ] |
| Biopsy AIS routes to type 3 excision | `F7-BIOPSY-AIS-TYPE3-EXCISION` | [ ] |
| Biopsy cancer routes to gynae oncology | `F7-BIOPSY-CANCER-ONCOLOGY` | [ ] |
| No visible lesion requires MDM | `F7-NO-LESION-MDM` | [ ] |
| MDM cytology confirmed, not AG2, routes to type 3 excision | `F7-MDM-CONFIRMED-NOT-AG2-TYPE3` | [ ] |
| MDM AG2 confirmed investigates other gynaecological malignancies | `F7-MDM-AG2-INVESTIGATE-MALIGNANCIES` | [ ] |
| MDM cytology not confirmed repeats colposcopy in 6 months | `F7-MDM-CYTOLOGY-NOT-CONFIRMED-6M` | [ ] |

Glossary for review:

- AG1: Atypical endocervical cells
- AG2: Atypical endometrial cells
- AG3: Atypical glandular cells NOS
- AG4: Atypical endocervical cells favouring a neoplastic process
- AG5: Atypical glandular cells favouring a neoplastic process
- AIS: Adenocarcinoma in situ
- AC1: Endocervical adenocarcinoma
- AC2: Endometrial adenocarcinoma
- AC3: Extrauterine adenocarcinoma
- AC4: Adenocarcinoma NOS

### Figure 8 - Screening After Total Hysterectomy

| Review item | Implemented behaviour/code | Reviewer |
|---|---|---|
| Subtotal hysterectomy routes to standard primary HPV screening | `F8-SUBTOTAL-FIG3` | [ ] |
| Post-hysterectomy HPV not detected returns to no further screening where applicable | `F8-POST-HYST-HPV-NOT-DETECTED-NO-FURTHER` | [ ] |
| Post-hysterectomy HPV detected delegates to Figure 3 | `F8-POST-HYST-HPV-DETECTED-FIG3` | [ ] |
| Low-risk/no pathology routes to no further screening | `F8-NEG-RETURNED-NO-PATH-NO-FURTHER` | [ ] |
| Low-risk/LSIL-CIN1 routes to HPV test/Figure 3 | `F8-NEG-RETURNED-LSIL-HPV` | [ ] |
| Untreated/incomplete HSIL/AIS with no or low-grade pathology routes to Test of Cure | `F8-UNTREATED-HSIL-AIS-NO-PATH-LOWGRADE-TOC` | [ ] |
| HSIL/AIS completely excised routes to Test of Cure | `F8-HSIL-AIS-COMPLETE-TOC` | [ ] |
| HSIL/AIS incompletely excised routes to colposcopy | `F8-HSIL-AIS-INCOMPLETE-COLP` | [ ] |
| Unknown excision status requires review, not guessing | `F8-HSIL-AIS-EXCISION-UNKNOWN-REVIEW` | [ ] |

### Table 1 - Vaginal Screening After Total Hysterectomy

| Review item | Implemented behaviour/code | Reviewer |
|---|---|---|
| Negative/returned regular + no pathology needs no further screening | `T1-NEG-RETURNED-NO-PATH-NO-FURTHER` | [ ] |
| Negative/returned regular + LSIL/CIN1 routes to HPV/Figure 3 | `T1-NEG-RETURNED-LSIL-HPV` | [ ] |
| Low-grade not returned + no pathology routes to HPV/Figure 3 | `T1-LOWGRADE-NOT-RETURNED-NO-PATH-HPV` | [ ] |
| Low-grade not returned + LSIL/CIN1 routes to HPV/Figure 3 | `T1-LOWGRADE-NOT-RETURNED-LSIL-HPV` | [ ] |
| Completed Test of Cure + no pathology needs no further screening | `T1-HSIL-TOC-COMPLETE-NO-PATH-NO-FURTHER` | [ ] |
| Completed Test of Cure + LSIL/CIN1 routes to HPV/Figure 3 | `T1-HSIL-TOC-COMPLETE-LSIL-HPV` | [ ] |
| Untreated/incomplete HSIL/AIS + no or low-grade pathology routes to Test of Cure | `T1-UNTREATED-HSIL-AIS-NO-PATH-LOWGRADE-TOC` | [ ] |
| Incomplete Test of Cure + no or low-grade pathology routes to Test of Cure | `T1-INCOMPLETE-TOC-NO-PATH-LOWGRADE-TOC` | [ ] |
| No known screening history + no or low-grade pathology schedules HPV at 6 months | `T1-NO-HISTORY-NO-PATH-LOWGRADE-HPV-6M` | [ ] |
| HSIL/AIS complete excision routes to Test of Cure | `T1-HSIL-AIS-COMPLETE-TOC` | [ ] |
| HSIL/AIS incomplete excision routes to colposcopy | `T1-HSIL-AIS-INCOMPLETE-COLP` | [ ] |
| HSIL/AIS unknown excision requires review | `T1-HSIL-AIS-EXCISION-UNKNOWN-REVIEW` | [ ] |

### Figure 9 - Pregnancy

| Review item | Implemented behaviour/code | Reviewer |
|---|---|---|
| Qualifying cytology values are ASC-H, HSIL, AIS, AG1-AG5, AC1-AC4 | Visibility/routing | [ ] |
| Pregnant + qualifying cytology without colposcopy findings routes to initial colposcopy | `F9-INITIAL-COLPOSCOPY` | [ ] |
| Normal TZ/no visible lesion requires MDM | `F9-NORMAL-TZ-MDM` | [ ] |
| MDM downgraded negative routes to Figure 3 | `F9-MDM-DOWNGRADED-NEGATIVE-FIG3` | [ ] |
| MDM downgraded LSIL/ASC-US follows LSIL pathway | `F9-MDM-DOWNGRADED-LSIL` | [ ] |
| MDM confirmed high-grade routes to pregnancy colposcopy review timing | `F9-MDM-CONFIRMED-HIGH-GRADE-REVIEW` | [ ] |
| Abnormal TZ/visible lesion with LSIL/HSIL/AIS impression routes to review | `F9-ABNORMAL-TZ-REVIEW` | [ ] |
| Invasion impression requires biopsy | `F9-INVASION-IMPRESSION-BIOPSY` | [ ] |
| Biopsy positive for invasion routes to gynae oncology | `F9-BIOPSY-POSITIVE-INVASION-ONCOLOGY` | [ ] |
| Biopsy negative for invasion routes to MDM | `F9-BIOPSY-NEGATIVE-INVASION-MDM` | [ ] |

### Figure 10 - Abnormal Vaginal Bleeding

| Review item | Implemented behaviour/code | Reviewer |
|---|---|---|
| Abnormal bleeding has high routing priority | Routing precedence tests | [ ] |
| Cancer symptoms route to urgent gynaecological assessment without delay | `F10-CANCER-SYMPTOMS-URGENT-GYN` | [ ] |
| Initial assessment requires workup facts | `F10-INITIAL-ASSESSMENT` | [ ] |
| Initial workup includes menstrual, contraceptive, sexual history, speculum, pelvic exam, co-test | Mapping from `figure10_initial_workup_completed` | [ ] |
| Abnormal cervix + suspicion of cancer routes to co-test and colposcopy | `F10-ABNORMAL-CERVIX-CANCER-COTEST-COLP` | [ ] |
| Abnormal cervix + no suspicion routes to Healthcare Pathways/gynae and 6-8 week review | `F10-ABNORMAL-CERVIX-NO-CANCER-REVIEW` | [ ] |
| Normal cervix + suspected OCP issue adjusts OCP and reviews in 6-8 weeks | `F10-OCP-ADJUST-REVIEW` | [ ] |
| Normal cervix + no OCP issue routes to Healthcare Pathways/local gynaecology/STI assessment | `F10-NORMAL-CERVIX-INVESTIGATE` | [ ] |
| STI identified routes to treat STI and review | `F10-STI-TREAT-REVIEW` | [ ] |
| No STI routes to Healthcare Pathways/gynaecology | `F10-NO-STI-HEALTHCARE-PATHWAYS` | [ ] |
| Bleeding resolved continues regular screening if age >=25 or commence at 25 | `F10-REVIEW-RESOLVED-SCREENING` | [ ] |
| Bleeding unresolved routes to gynaecology | `F10-REVIEW-UNRESOLVED-GYNAECOLOGY` | [ ] |

## 3. Demo Script

Use dummy patient data only. Each scenario should be started as a new clean assessment so previous answers do not leak into the current run.

### Demo Setup

1. Open the app.
2. Log in with a demo user.
3. Select any dummy patient.
4. Use `Start new assessment`.
5. Confirm the assessment run/session ID is visible on the final result.

### Branch A - Direct HPV / Molecular Screening Pathway

Purpose: demonstrate direct molecular screening, HPV16/18 direct colposcopy, HPV Other swab return-visit handling, and hidden cytology when not required.

#### Scenario A1 - HPV16/18 On Self-Collected Swab

Steps:

1. Entry pathway: Direct HPV / Molecular Screening Pathway.
2. Confirm patient consent.
3. Immunocompromised: No.
4. Sample type: SWAB.
5. HPV result: HPV 16/18 Positive.

Expected demo result:

| Expected item | Value |
|---|---|
| Recommendation code | `F3-1618-COLP` |
| Outcome | Direct colposcopy |
| Cytology question | Hidden |
| Swab return visit question | Hidden |

Reviewer talking point: HPV16/18 does not wait for cytology or a generic swab-return branch.

#### Scenario A2 - HPV Other On Self-Collected Swab, No Return Visit

Steps:

1. Entry pathway: Direct HPV / Molecular Screening Pathway.
2. Confirm patient consent.
3. Immunocompromised: No.
4. Sample type: SWAB.
5. HPV result: HPV Other Positive.
6. Return visit completed: No.

Expected demo result:

| Expected item | Value |
|---|---|
| Recommendation code | `F3-SWAB-RETURN-REQUIRED` |
| Outcome | Return visit with clinical examination/cytology collection required |
| Cytology question | Hidden until return visit is complete |

Reviewer talking point: HPV Other still keeps the return-visit/cytology-dependent pathway; this was intentionally not relaxed for HPV Other.

#### Scenario A3 - HPV Other With High-Grade Cytology

Steps:

1. Entry pathway: Direct HPV / Molecular Screening Pathway.
2. Confirm patient consent.
3. Immunocompromised: No.
4. Sample type: LBC.
5. HPV result: HPV Other Positive.
6. Cytology result: HSIL.

Expected demo result:

| Expected item | Value |
|---|---|
| Recommendation code | `F3-HPV-OTHER-HIGH-GRADE-COLP` |
| Outcome | Colposcopy |

### Branch B - GP / Routine Clinical Care / Specialist Pathway

Purpose: demonstrate symptom/history/specialist pathways beyond direct HPV screening.

#### Scenario B1 - Abnormal Vaginal Bleeding With Cancer Symptoms

Steps:

1. Entry pathway: GP / Routine Clinical Care / Specialist Pathway.
2. Confirm patient consent.
3. Hysterectomy: No.
4. Immunocompromised: No.
5. First HPV transition: No.
6. Abnormal vaginal bleeding: Yes.
7. Bleeding stage: Initial assessment.
8. Cancer symptoms: Yes.

Expected demo result:

| Expected item | Value |
|---|---|
| Recommendation code | `F10-CANCER-SYMPTOMS-URGENT-GYN` |
| Outcome | Urgent gynaecological assessment without delay |

#### Scenario B2 - Pregnancy With High-Grade Cytology

Steps:

1. Entry pathway: GP / Routine Clinical Care / Specialist Pathway.
2. Confirm patient consent.
3. Hysterectomy: No.
4. Immunocompromised: No.
5. First HPV transition: No.
6. Abnormal vaginal bleeding: No.
7. Sample type: LBC.
8. HPV result: HPV Other Positive.
9. Cytology result: HSIL.
10. Pregnant: Yes.
11. Colposcopy findings available: No.

Expected demo result:

| Expected item | Value |
|---|---|
| Recommendation code | `F9-INITIAL-COLPOSCOPY` |
| Outcome | Initial colposcopy |

#### Scenario B3 - Total Hysterectomy, No Known History, No Pathology

Steps:

1. Entry pathway: GP / Routine Clinical Care / Specialist Pathway.
2. Confirm patient consent.
3. Hysterectomy: Yes.
4. Hysterectomy type: Total.
5. Prior screening history: No known screening history.
6. Hysterectomy indication: Benign gynaecological disease.
7. Specimen pathology: No cervical pathology.
8. Enter post-hysterectomy HPV result now: No.

Expected demo result:

| Expected item | Value |
|---|---|
| Recommendation code | `F8-NO-HISTORY-NO-PATH-LOWGRADE-HPV-6M` |
| Outcome | HPV at 6 months post-hysterectomy |

#### Scenario B4 - Test Of Cure, Second Negative Co-Test

Steps:

1. Entry pathway: GP / Routine Clinical Care / Specialist Pathway.
2. Confirm patient consent.
3. Hysterectomy: No.
4. Immunocompromised: No.
5. First HPV transition: No.
6. Abnormal vaginal bleeding: No.
7. Sample type: LBC.
8. HPV result: HPV Not Detected.
9. Is this Test of Cure: Yes.
10. Cytology result: Negative.
11. Test of Cure stage: Second consecutive co-test.

Expected demo result:

| Expected item | Value |
|---|---|
| Recommendation code | `F6-SECOND-NEGATIVE-RETURN-REGULAR` |
| Outcome | Return to regular screening |

#### Scenario B5 - Post-Normal Colposcopy High-Grade, Confirmed ASC-H Special Case

Steps:

1. Entry pathway: GP / Routine Clinical Care / Specialist Pathway.
2. Confirm patient consent.
3. Hysterectomy: No.
4. Immunocompromised: No.
5. First HPV transition: No.
6. Abnormal vaginal bleeding: No.
7. Sample type: LBC.
8. HPV result: HPV Other Positive.
9. Cytology result: Negative.
10. Pregnant: No.
11. Test of Cure: No.
12. Repeat/follow-up context: After normal colposcopy, cytology >= ASC-H.
13. Colposcopy findings: Yes.
14. TZ type: Type 1.
15. Visible lesion: No.
16. Colposcopic impression: Normal.
17. Biopsy taken: No.
18. MDM outcome: Confirmed ASC-H.

Expected demo result:

| Expected item | Value |
|---|---|
| Recommendation code | `F5-CONFIRMED-ASCH-HPV-DETECTED-NORMAL-NEG-12M` |
| Outcome | Repeat colposcopy, HPV, and cytology in 12 months |

Reviewer talking point: HPV detected alone does not trigger treatment in this confirmed ASC-H special case.

#### Scenario B6 - Glandular Abnormality

Steps:

1. Entry pathway: GP / Routine Clinical Care / Specialist Pathway.
2. Confirm patient consent.
3. Hysterectomy: No.
4. Immunocompromised: No.
5. First HPV transition: No.
6. Abnormal vaginal bleeding: No.
7. Sample type: LBC.
8. HPV result: HPV Other Positive.
9. Cytology result: AG3.
10. Pregnant: No.
11. Test of Cure: No.
12. Repeat/follow-up context: Primary HPV screening.
13. Repeat stage: Baseline.
14. Colposcopy findings: No.

Expected demo result:

| Expected item | Value |
|---|---|
| Recommendation code | `F7-GLANDULAR-COLPOSCOPY` |
| Outcome | Colposcopy |

## 4. Known Limitations / Items Requiring Clinical Sign-Off

These are expected review caveats, not hidden clinical approvals.

| Area | Limitation/sign-off need |
|---|---|
| Overall status | Safe for clinical review demo, not approved clinical protocol |
| Visual diagrams | Simplified and non-authoritative; engine output is source of truth |
| Healthcare Pathways | Local interpretation and gynaecology pathways require sign-off |
| NCSR/history-dependent branches | External history is not live; history-dependent branches rely on manual confirmation or return review/insufficient-information outputs |
| Figure 2 AIS follow-up | `F2-AIS-R208-FOLLOWUP` remains service-defined/clinician-review rather than fully encoded R2.08 workflow |
| Missing or unmapped inputs | Some branches intentionally return insufficient information or clinician review rather than guessing |
| Cytology N/A after HPV16/18 | Implemented by hiding cytology in ordinary Direct HPV flow, not by showing an explicit N/A dropdown |
| Hidden demo options | HPV `INADEQUATE` and cytology `UNSATISFACTORY` remain in backend support but are hidden from active demo HPV/cytology options |
| ClinicalInput persistence | `inputFacts` are stored in audit JSON; there is no dedicated structured `ClinicalInput` table |
| Age gates | Age gates apply after symptomatic, pregnancy, and hysterectomy routing; reviewers should confirm this precedence |
| Direct HPV branch | Intentionally limited to primary screening inputs; symptom/history/specialist contexts are in GP/clinical branch |

## 5. Sign-Off Checklist

### Product Review

- [ ] Demo is understood as safe for clinical review demo only.
- [ ] Demo is understood as not approved clinical protocol.
- [ ] Deterministic engine output accepted as source of truth.
- [ ] Visual diagrams accepted as simplified/non-authoritative.
- [ ] Two starting branches reviewed.
- [ ] Consent hard gate reviewed.
- [ ] Back navigation and answer pruning reviewed.
- [ ] Same-patient clean repeated-run behaviour reviewed.
- [ ] Audit trail reviewed.

### Clinical Figure/Table Review

- [ ] Figure 1 reviewed.
- [ ] Figure 2 reviewed.
- [ ] Figure 3 reviewed.
- [ ] Figure 4 reviewed.
- [ ] Figure 5 reviewed.
- [ ] Figure 6 reviewed.
- [ ] Figure 7 reviewed.
- [ ] Figure 8 reviewed.
- [ ] Figure 9 reviewed.
- [ ] Figure 10 reviewed.
- [ ] Table 1 reviewed.

### Specific Reviewer Sign-Off Points

- [ ] HPV16/18 direct colposcopy reviewed.
- [ ] HPV16/18 cytology-not-required behaviour reviewed.
- [ ] HPV Other return-visit/cytology handling reviewed.
- [ ] Test of Cure first-negative and second-negative handling reviewed.
- [ ] Figure 5 confirmed ASC-H special case reviewed.
- [ ] Table 1 row-specific hysterectomy logic reviewed.
- [ ] Pregnancy pathway reviewed.
- [ ] Abnormal vaginal bleeding pathway reviewed.
- [ ] AIS cytology, histology, specimen pathology, colposcopic impression, persistence, and audit behaviour reviewed.
- [ ] Healthcare Pathways/local gynaecology interpretation signed off or assigned.
- [ ] NCSR/history-dependent branches signed off or assigned.
- [ ] Clinical sign-off pending/completed decision recorded.

Reviewer name:

Date:

Decision:

- [ ] Approved for continued clinical review/demo use
- [ ] Approved with changes required before broader demonstration
- [ ] Hold for clinical or implementation changes

Notes:
