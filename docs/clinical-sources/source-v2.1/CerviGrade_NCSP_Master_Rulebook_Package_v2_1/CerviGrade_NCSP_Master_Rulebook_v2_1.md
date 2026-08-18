# CerviGrade NCSP Master Rulebook v2.1

**Status:** Source-derived clinical-software verification specification. **Not a clinically approved protocol and not for direct clinical action.** Every output is a provisional recommendation requiring reviewer confirmation.

**Rule records:** 203

## Controlling source hierarchy
1. June 2023 NCSP Clinical Practice Guidelines v1.1 — base pathways.
2. February 2026 addendum — controlling where it explicitly supersedes the 2023 rules.
3. March 2026 immune-deficiency guidance v1.0.1 — controlling classifier for the 3-year interval.

## Safety-priority definition
- **CRITICAL:** Implementation or routing defect could delay suspected cancer/invasion, wrongly stop screening, or produce unsafe reassurance.
- **HIGH:** Material referral, surveillance, Test-of-Cure, specialist-boundary, or missing-data safety requirement.
- **MEDIUM:** Timing, interval, workflow, provenance, or non-urgent clinical management requirement.
- **LOW:** Education or low-consequence documentation item; no clinician-led treatment/referral rule should be LOW.

## Global implementation invariants
- Select the highest-priority pathway using minimal routing facts, then run a pathway-specific completeness gate.
- Unknown is never equivalent to false, normal, negative, complete, clear margin, or immune competent.
- Symptoms/cancer concern, pregnancy, hysterectomy/cervix status, cancer history, unresolved high-grade/glandular history, active Test of Cure, and current glandular abnormalities override routine screening as applicable.
- Section 3 invalid/unsuitable HPV and unsatisfactory-cytology rules apply at initial and every repeat event.
- Clinician/MDM/specialist boxes are software stopping points, not autonomous decisions.
- Store source rule ID, rule release, branch trace, input provenance, reviewer action, override reason, and immutable decision snapshot.

## Global Router & Safety

| Rule ID | Stage | Condition | Provisional outcome | Timing/destination | Boundary | Source | Priority |
|---|---|---|---|---|---|---|---|
| GR-01 | Global router | Any abnormal vaginal bleeding or cancer concern | Route to Figure 10 before routine screening. A reassuring HPV result must not close the symptom pathway. | Immediate/urgent where cancer suspected | Safety router | Sec. 15; Fig. 10 | CRITICAL |
| GR-02 | Global router | Pregnancy with HPV16/18 or high-grade/glandular cytology | Route to Figure 9 and experienced pregnancy colposcopy. | As soon as practicable | Safety router | Sec. 11; Fig. 9 | CRITICAL |
| GR-03 | Global router | Pregnancy with HPV Other and negative/ASC-US/LSIL | Do not automatically route to Figure 9 high-grade pathway; repeat HPV in 12 months unless another safety override applies. | 12 months | Deterministic provisional | Sec. 11; Fig. 3/9 | HIGH |
| GR-04 | Global router | Total or subtotal hysterectomy recorded | Subtotal: ordinary screening. Total: Figure 8/Table 1. Unknown type: safety stop. | According to pathway | Safety router | Sec. 10; Fig. 8; Table 1 | HIGH |
| GR-05 | Global router | Previous cervical/vaginal/gynaecological cancer | Apply the 2026 cancer overlay before ordinary screening or hysterectomy rules. | According to specialist plan | Safety router | 2026 addendum p6 | CRITICAL |
| GR-06 | Global router | Unresolved prior high-grade or glandular history | Route to Figure 2; do not enter Figure 1 or routine Figure 3. | Immediate/ongoing follow-up | Safety router | Sec. 2; Fig. 2 | HIGH |
| GR-07 | Global router | Active post-treatment HSIL Test of Cure | Route to Figure 6 before routine screening. | 6/18 months and annual sequence | Safety router | Sec. 8; Fig. 6 | HIGH |
| GR-08 | Global router | Glandular abnormality, AIS or adenocarcinoma | Route to Figure 7 or specialist gynaecology/oncology; do not treat as generic high-grade cytology. | Urgent when malignant | Safety router | Sec. 9; Fig. 7 | CRITICAL |
| GR-09 | Global router | Normal colposcopy after low-grade cytology | Route to Figure 4. | 12/24 month surveillance | Safety router | Sec. 6; Fig. 4 | HIGH |
| GR-10 | Global router | Normal colposcopy after cytology >=ASC-H | Route to Figure 5. | Specialist surveillance | Safety router | Sec. 6; Fig. 5 | HIGH |
| GR-11 | Global router | First transition from cytology-based programme | Use Figures 1 and 2 only for transition; otherwise use current pathway. | At transition | Safety router | Sec. 2; Figs. 1-2 | MEDIUM |
| GR-12 | Global router | Asymptomatic participant in HPV primary screening | Use Figure 3 after higher-priority routes are excluded. | According to result | Deterministic provisional | Sec. 4; Fig. 3 | MEDIUM |
| GR-13 | Minimal routing gate | Before pathway selection | Use only the minimum discriminators needed to select the highest-priority pathway. Do not require every pathway-specific field at intake. | At intake | Safety router | Software-safety synthesis of Figs 1-10/Table 1 | CRITICAL |
| GR-14 | Pathway-specific completeness | After a pathway has been selected and before any terminal recommendation | Run a pathway-specific completeness gate. Missing critical facts must return INSUFFICIENT_INFORMATION or EXTERNAL_HISTORY_REQUIRED, never a confident routine outcome. | Before evaluation | Safety stop | Software-safety synthesis of Figs 1-10/Table 1 | CRITICAL |
| GS-01 | Safety | Required clinical fact is missing or unknown | Return INSUFFICIENT_INFORMATION / EXTERNAL_HISTORY_REQUIRED; never generate routine recall from a default false/normal value. | Immediate information request | Software safety stop | Guideline-wide professional judgement + software safety design | CRITICAL |
| GS-02 | Safety | Same input and same rule release | Produce the same provisional result and preserve the exact branch trace. | Immediate | Deterministic invariant | Software verification invariant | HIGH |
| GS-03 | Safety | Rule release changes after a decision is confirmed | Do not silently rewrite historic decisions; regrading must create a new traceable version. | On regrade | Governance invariant | Software governance requirement | HIGH |
| GS-04 | Safety | Clinician-only branch reached | Return CLINICIAN_REVIEW_REQUIRED rather than autonomous final approval. | Immediate | Clinician-only boundary | Guideline-wide clinician judgement | CRITICAL |
| GS-05 | Safety | National clinical route and local booking priority both available | Keep the national pathway result separate from local operational priority. | At disposition | Governance boundary | Guideline + local governance | HIGH |
| GS-06 | Safety | Synthetic/demo environment export | Label outputs: simulated export package; integration-ready preview; not for direct clinical action. | At export | Product safety boundary | Product safety requirement | HIGH |

## Figure 1

| Rule ID | Stage | Condition | Provisional outcome | Timing/destination | Boundary | Source | Priority |
|---|---|---|---|---|---|---|---|
| F1-01 | Decision branch | Never screened | Invite now, then perform primary HPV screening via Figure 3 | Now / next available screening | Deterministic provisional | Fig. 1 p18; R2.02 | MEDIUM |
| F1-02 | Decision branch | Under-screened | Invite now, then Figure 3 | Now | Deterministic provisional | Fig. 1 p18; R2.02 | MEDIUM |
| F1-03 | Decision branch | Overdue | Invite now, then Figure 3 | Now | Deterministic provisional | Fig. 1 p18; R2.02 | MEDIUM |
| F1-04 | Decision branch | Regularly screened with normal results | Invite at next scheduled visit, then Figure 3 | Next scheduled visit | Deterministic provisional | Fig. 1 p18; R2.02 | MEDIUM |
| F1-05 | Decision branch | Previous low-grade result, already returned to regular screening | Invite at next scheduled visit, then Figure 3 | Next scheduled visit | Deterministic provisional | Fig. 1 p18; R2.02 | MEDIUM |
| F1-06 | Decision branch | Previous high-grade result with successful Test of Cure | Invite at next scheduled visit, then Figure 3 | Next scheduled visit | Deterministic provisional | Fig. 1 p18; R2.02 | MEDIUM |
| F1-X | Decision branch | Previous high-grade/glandular result not returned to regular screening | Do not use Figure 1; route to Figure 2 |  | Safety router | Sec. 2.7; Fig. 2 | LOW |

## Figure 2

| Rule ID | Stage | Condition | Provisional outcome | Timing/destination | Boundary | Source | Priority |
|---|---|---|---|---|---|---|---|
| F2-01 | Decision branch | Previous possible/definite HSIL or atypical glandular cells except atypical endometrial cells | If colposcopy was recommended and not done, refer to colposcopy; otherwise complete Test of Cure. After successful resolution, proceed to regular screening/Figure 3 | Colposcopy or ongoing annual co-testing | Deterministic provisional | Fig. 2 p19; R2.04-R2.07 | HIGH |
| F2-02 | Overlay / modifier | Previous AIS without total hysterectomy | Follow AIS post-treatment pathway rather than ordinary Figure 3 | See R2.08 and 2026 R9.14 overlay | Specialist-led / mandatory review | Fig. 2 p19; R2.08; 2026 addendum R9.14 | HIGH |
| F2-03 | Decision branch | Previous atypical endometrial cells; report >3 years ago | Primary HPV screening test at next scheduled visit via Figure 3 | Next scheduled visit | Deterministic provisional | Fig. 2 p19; R2.04 | MEDIUM |
| F2-04 | Decision branch | Previous atypical endometrial cells; already investigated by specialist and discharged to primary care | Primary HPV screening test at next scheduled visit via Figure 3 | Next scheduled visit | Deterministic provisional | Fig. 2 p19; R2.04 | MEDIUM |
| F2-05 | Decision branch | Previous atypical endometrial cells; neither >3 years nor specialist-assessed/discharged | Refer to specialist gynaecology services | Specialist assessment | Specialist-led | Fig. 2 p19; R2.04 | LOW |
| F2-X | Decision branch | Prior high-grade history already completed Test of Cure | Do not remain in Figure 2; return to Figure 1/Figure 3 |  | Deterministic provisional | Fig. 1-2; R2.02 | LOW |

## Figure 3

| Rule ID | Stage | Condition | Provisional outcome | Timing/destination | Boundary | Source | Priority |
|---|---|---|---|---|---|---|---|
| F3-01 | Entry | Primary HPV test: HPV not detected; immune competent | Return for screening in 5 years | 5 years | Deterministic provisional | Fig. 3 p24; R4.01 | MEDIUM |
| F3-02 | Entry | Primary HPV test: HPV not detected; immune deficient | Return for screening in 3 years | 3 years | Deterministic provisional | Fig. 3 p24; 2026 immune guidance | MEDIUM |
| F3-03 | Safety / exception | HPV 16 or 18 detected, any age in screening range, any cytology including unsatisfactory | Refer directly to colposcopy. If swab sample, obtain LBC/cytology at colposcopy | 20 or 30 working days according to risk/history; urgent if invasive cytology | Deterministic provisional | Fig. 3 p24; R4.06-R4.11 | HIGH |
| F3-04 | Decision branch | HPV Other detected on swab-collected sample | Return visit for clinical examination and clinician-taken LBC for cytology | As soon as practicable for triage | Deterministic provisional | Fig. 3 p24; R2.01; R4.02 | LOW |
| F3-05 | Decision branch | HPV Other + possible/definite high-grade cytology excluding cytology suspicious/definite for invasive cancer and excluding atypical/malignant endometrial cells | Refer to colposcopy or the applicable glandular specialist pathway. | Urgent within 2 weeks if invasive cancer suspected/definite | Deterministic provisional | Fig. 3 p24; R4.04-R4.05 | HIGH |
| F3-06 | Decision branch | HPV Other + atypical endometrial cells with no co-existing colposcopy indication | Refer for specialist gynaecological assessment | Specialist assessment | Specialist-led | R4.04 | MEDIUM |
| F3-07 | Decision branch | Initial HPV Other + negative/ASC-US/LSIL cytology | Repeat HPV test in 12 months, using LBC | 12 months | Deterministic provisional | Fig. 3 p24; R4.02 | MEDIUM |
| F3-08 | Follow-up | First 12-month repeat: HPV not detected | Return to regular interval screening | 5 years or 3 years if immune deficient | Deterministic provisional | Fig. 3; R4.03 | MEDIUM |
| F3-09 | Follow-up | First 12-month repeat: HPV 16 or 18 | Refer to colposcopy | According to HPV16/18 referral priority | Deterministic provisional | Fig. 3; R4.03/R4.06 | HIGH |
| F3-10 | Follow-up | First 12-month repeat: HPV Other + possible/definite high-grade cytology | Refer to colposcopy/specialist pathway | Urgent if invasive | Deterministic provisional | Fig. 3; R4.03-R4.05 | HIGH |
| F3-11 | Follow-up | First 12-month repeat: HPV Other + negative/ASC-US/LSIL and age >=50 | Refer to colposcopy | After second test event | Deterministic provisional | Fig. 3 p24; Sec. 4.4 | HIGH |
| F3-12 | Follow-up | First 12-month repeat: HPV Other + negative/ASC-US/LSIL and age <50 | Second repeat HPV test in another 12 months, using LBC | 12 months later | Deterministic provisional | Fig. 3 p24; Sec. 4.4 | MEDIUM |
| F3-13 | Follow-up | Second repeat: HPV not detected | Return to regular interval screening | 5 years or 3 years if immune deficient | Deterministic provisional | Fig. 3 p24 | MEDIUM |
| F3-14 | Follow-up | Second repeat: HPV detected any type | Refer to colposcopy irrespective of cytology | After third test event | Deterministic provisional | Fig. 3 p24; Sec. 4.12 | HIGH |
| F3-15 | Decision branch | Age 70-74 exit test: HPV not detected | Discharge from NCSP | Immediate exit | Deterministic provisional | R4.13 p8 | LOW |
| F3-16 | Decision branch | Age 70-74 exit test: HPV detected any type | Refer to colposcopy | Do not defer/exit | Deterministic provisional | R4.14 p8 | HIGH |
| F3-17 | Decision branch | Asymptomatic age >=75 | Routine screening not recommended | No routine screening | Deterministic provisional | Sec. 4 exit guidance | MEDIUM |
| F3-18 | Safety / exception | HPV test invalid or unsuitable for analysis | Repeat HPV test as soon as practicable with no required delay | ASAP | Deterministic provisional | R3.04 | MEDIUM |
| F3-19 | Safety / exception | Unsatisfactory cytology | Repeat LBC no sooner than 6 weeks and no later than 3 months; HPV16/18 still goes directly to colposcopy; HPV Other + two consecutive unsatisfactory results goes to colposcopy | 6 weeks-3 months or immediate colposcopy | Deterministic provisional | R3.03/R4.08 | HIGH |
| F3-20 | Initial or repeat HPV event | Cytology suspicious of or definite for invasive cervical cancer with HPV Other | Urgent colposcopic assessment within two weeks. This overrides ordinary HPV Other repeat logic. | Within 2 weeks | Safety escalation | R4.05 | CRITICAL |
| F3-21 | Initial or repeat HPV event | HPV 16/18 with cytology suspicious of or definite for invasive cancer | Urgent evaluation by colposcopy or gynaecological oncology. This is distinct from ordinary HPV16/18 colposcopy. | Urgent / within 2 weeks where specified | Safety escalation | R4.07 | CRITICAL |
| F3-22 | Repeat-event overlay | Any initial, first-repeat, or second-repeat event has invalid/unsuitable HPV, unsatisfactory cytology, or atypical/malignant endometrial cytology | Apply Section 3 validity/adequacy rules and the specialist endometrial route at every repeat stage before ordinary branch evaluation. |  | Safety overlay | Section 3; R4.04; Figure 3 | CRITICAL |

## Figure 4

| Rule ID | Stage | Condition | Provisional outcome | Timing/destination | Boundary | Source | Priority |
|---|---|---|---|---|---|---|---|
| F4-01 | Decision branch | HPV detected any type + negative/ASC-US/LSIL cytology + normal colposcopy | Repeat HPV test in community care using LBC | 12 months | Deterministic provisional | Fig. 4 p45; R6.03 | MEDIUM |
| F4-02 | Follow-up | 12-month repeat: HPV not detected | Return to regular interval screening: 5 years if immune competent or 3 years if verified immune deficient. | 5 years or 3 years if immune deficient | Deterministic provisional | Fig. 4; R6.03 | MEDIUM |
| F4-03 | Follow-up | 12-month repeat: HPV 16/18 | Refer directly to colposcopy | Referral | Deterministic provisional | Fig. 4; R6.03 | HIGH |
| F4-04 | Follow-up | 12-month repeat: HPV Other + cytology >=ASC-H or other high-grade/glandular abnormality | Refer to colposcopy; atypical endometrial cells may require specialist gynaecology | Referral | Deterministic provisional | Fig. 4; R6.03 | HIGH |
| F4-05 | Follow-up | 12-month repeat: HPV Other + negative/ASC-US/LSIL; immune deficient | Refer to colposcopy | Referral | Deterministic provisional | Fig. 4; R6.03 | HIGH |
| F4-06 | Follow-up | 12-month repeat: HPV Other + negative/ASC-US/LSIL; immune competent | Repeat HPV/cytology using LBC in another 12 months | 24 months post-discharge | Deterministic provisional | Fig. 4; R6.03 | MEDIUM |
| F4-07 | Follow-up | 24-month repeat: HPV not detected | Return to regular interval screening: 5 years if immune competent or 3 years if verified immune deficient. |  | Deterministic provisional | R6.03 | MEDIUM |
| F4-08 | Follow-up | 24-month repeat: HPV detected any type, any cytology | Refer to colposcopy |  | Deterministic provisional | Fig. 4; R6.03 | HIGH |
| F4-09 | Overlay / modifier | Type 3 TZ, HPV positive, low-grade cytology, normal colposcopy | Observation is appropriate; MDM cytological review is not required under the 2026 update | Follow Figure 4 surveillance | Deterministic provisional | 2026 addendum R6.05 | MEDIUM |
| F4-10 | Overlay / modifier | Type 3 TZ with no cytological/colposcopic/histological high-grade evidence | Do not routinely perform diagnostic excision |  | Clinician judgement | R6.04 | MEDIUM |
| F4-11 | Overlay / modifier | Type 3 TZ and selected concerns: completed child-bearing, anxiety, age >50, uncertain attendance | Diagnostic excision may be offered |  | Clinician-only/shared decision | R6.06 | MEDIUM |
| F4-12 | Overlay / modifier | Persistent ASC-US/LSIL with Type 3 TZ | ECC may be considered; a negative ECC is not reassuring |  | Clinician-only | R6.07 | MEDIUM |
| F4-13 | Sample handling | 12-month repeat is HPV Other from swab | Return for clinical examination and clinician-taken LBC before cytology-based routing. | As soon as practicable | Deterministic provisional | Fig. 4 p45 | HIGH |
| F4-14 | Glandular exception | HPV Other + atypical endometrial cells without another cervical colposcopy indication | Refer to specialist gynaecology rather than generic colposcopy. | Specialist assessment | Specialist-led | R6.03 / R4.04 | CRITICAL |
| F4-15 | Post-colposcopy repeat | Cytology suspicious of or definite for invasive cancer at a Figure 4 follow-up event | Urgent colposcopic/specialist assessment; do not treat as ordinary ≥ASC-H referral. | Urgent / within 2 weeks where source applies | Safety escalation | R4.05/R4.07 applied to repeat event | CRITICAL |
| F4-16 | Post-colposcopy repeat overlay | Any Figure 4 12- or 24-month event has invalid/unsuitable HPV, unsatisfactory cytology, or atypical/malignant endometrial cytology | Apply Section 3 and endometrial specialist overlays before ordinary Figure 4 branch evaluation. |  | Safety overlay | Section 3; Figure 4 | CRITICAL |

## Figure 5

| Rule ID | Stage | Condition | Provisional outcome | Timing/destination | Boundary | Source | Priority |
|---|---|---|---|---|---|---|---|
| F5-01 | Decision branch | HPV detected any type + cytology >=ASC-H + normal colposcopy | MDM/cytopathology review before deciding treatment |  | Mandatory clinician/MDM review | Fig. 5 p47; R6.08-R6.16 | HIGH |
| F5-02 | Decision branch | MDM downgrades cytology to LSIL/ASC-US/negative | Follow amended low-grade pathway, generally repeat HPV in 12 months | 12 months | Deterministic provisional | Fig. 5; R6.10/R6.14 | MEDIUM |
| F5-03 | Decision branch | MDM upgrades/confirms HSIL | Follow HSIL pathway; diagnostic excision/treatment recommended |  | Specialist-led | Fig. 5; R6.11-R6.13 | HIGH |
| F5-04 | Decision branch | Confirmed ASC-H, Type 1/2 TZ, no visible lesion | Consider diagnostic excision; observation is an option after informed discussion |  | Specialist/shared decision | R6.08-R6.09 | MEDIUM |
| F5-05 | Decision branch | Confirmed ASC-H with treatment deferred | Repeat HPV, cytology and colposcopy | 6 months | Specialist-led | R6.09 | HIGH |
| F5-06 | Follow-up | After observation: abnormal cytology and/or visible lesion; isolated HPV detection with negative cytology and normal colposcopy is excluded | Specialist reassessment; diagnostic excision or treatment should be reconsidered. Isolated HPV detection with negative cytology and normal colposcopy follows F5-07. |  | Specialist-led | Fig. 5 | HIGH |
| F5-07 | Follow-up | After observation: HPV detected, normal colposcopy, negative cytology | Repeat colposcopy, HPV and cytology | 12 months | Specialist-led | Fig. 5 | HIGH |
| F5-08 | Follow-up | After observation: HPV not detected, negative cytology, no visible lesion/unchanged impression | Repeat co-test in 12 months. Return to regular interval screening only after the subsequent co-test is again HPV not detected with negative cytology and the specialist surveillance sequence is complete. | 12 months | Specialist-led | Fig. 5; R6.09 | MEDIUM |
| F5-09 | Overlay / modifier | Type 3 TZ with ASC-H/HSIL confirmed on review | Diagnostic excision of TZ |  | Specialist-led | R6.15-R6.16 | HIGH |
| F5-10 | Pre-excision safety | Diagnostic excision being considered after high-grade cytology and normal cervical colposcopy | Complete full vaginal/lower-genital-tract colposcopic examination before proceeding. | Before excision | Clinician-only | R5.04; R6.08 | HIGH |
| F5-11 | Shared decision | Confirmed ASC-H, Type 1/2 TZ, no visible lesion; observation selected | Observation may begin only after the informed treatment-deferral plan is documented. | Before 6-month surveillance | Clinician-only | R6.09 | HIGH |
| F5-12 | Post-excision router | Diagnostic excision completed | Route by histology: benign/no high-grade -> MDM surveillance; LSIL -> low-grade pathway; HSIL treated -> Figure 6; AIS -> Figure 7/AIS follow-up; invasive disease -> oncology. | After histology | Clinician-only | R5.13; Sec. 6-9 | CRITICAL |

## Figure 6

| Rule ID | Stage | Condition | Provisional outcome | Timing/destination | Boundary | Source | Priority |
|---|---|---|---|---|---|---|---|
| F6-01 | Entry | Participant is eligible for Test of Cure after treated HSIL/CIN2/3 or another guideline-defined high-grade squamous follow-up episode | Perform HPV and cytology co-testing according to the applicable ToC schedule. | 6 months post-treatment | Deterministic provisional | Fig. 6 p56; R8.06 | HIGH |
| F6-02 | Decision branch | 6-month co-test: HPV not detected + cytology negative | Repeat co-test | 12 months later / 18 months post-treatment | Deterministic provisional | Fig. 6; R8.06 | MEDIUM |
| F6-03 | Decision branch | Two consecutive co-tests both HPV not detected and cytology negative | Test of Cure complete; return to regular interval screening |  | Deterministic provisional | R8.06 | HIGH |
| F6-04 | Decision branch | Any HPV detected at any Test-of-Cure event, any cytology | Refer to colposcopy |  | Deterministic provisional | Fig. 6; R8.07 | HIGH |
| F6-05 | Decision branch | ASC-H/HSIL or any glandular cytology during Test of Cure, regardless of HPV | Refer to colposcopy |  | Deterministic provisional | R8.08 | HIGH |
| F6-06 | Decision branch | HPV not detected + first low-grade cytology during Test of Cure | Repeat HPV and cytology | 12 months | Deterministic provisional | Fig. 6; R8.07 | MEDIUM |
| F6-07 | Decision branch | HPV not detected + two consecutive low-grade cytology results | Refer to colposcopy |  | Deterministic provisional | R8.07 | HIGH |
| F6-08 | Decision branch | After a low-grade event, next co-test HPV not detected + cytology negative | Continue Test of Cure until the required two consecutive negative co-tests are achieved |  | Deterministic provisional | Fig. 6 | HIGH |
| F6-09 | Overlay / modifier | Clear excision margins after HSIL treatment | Test of Cure may be performed in primary/community care | 6 and 18 months | Deterministic provisional | 2023 R8.06 | HIGH |
| F6-10 | Overlay / modifier | Positive margins after HSIL treatment and age <50 | Test of Cure follow-up can be in primary/community care | 6 and 18 months | Deterministic provisional | 2026 addendum R8.06 | HIGH |
| F6-11 | Overlay / modifier | Positive/incomplete margins after HSIL treatment and age >=50 | Follow-up remains in colposcopy clinic unless later guidance/local governance says otherwise | 6 and 18 months | Clinician-led | 2023 R8.06; 2026 addendum applies only under 50 | HIGH |
| F6-12 | Entry safety | Treatment date absent or treatment not confirmed | Do not issue a terminal Test-of-Cure disposition; request treatment records. | Immediate | Safety stop | Fig. 6; Sec. 8 | CRITICAL |
| F6-13 | Result quality | HPV invalid/unsuitable or cytology unsatisfactory during Test of Cure | Apply Section 3 repeat/colposcopy rules; do not count the event as a qualifying negative ToC result. | ASAP or 6 weeks-3 months as applicable | Deterministic provisional | Sec. 3; Fig. 6 | HIGH |
| F6-14 | ToC entry | Treatment modality and margin applicability | Use margin-dependent setting rules only when margins exist. Ablation and non-excisional pathways must use margin status “not applicable,” not an inferred clear margin. |  | Safety/data rule | Section 8; R8.06; R8.12; R2.07 | CRITICAL |
| F6-15 | ToC eligibility | Historical high-grade squamous abnormality requiring ToC even when histological confirmation or treatment documentation is incomplete | Route to clinician-confirmed ToC eligibility and obtain missing records. Do not exclude the participant solely because a histology or excision-margin field is absent. |  | Clinician-only | R8.12; R2.07 | HIGH |
| F6-16 | ToC repeat overlay | Any ToC event has invalid/unsuitable HPV, unsatisfactory cytology, or atypical/malignant endometrial cytology | Apply Section 3 and specialist endometrial rules before counting or completing the ToC sequence. The event cannot count as a qualifying negative. |  | Safety overlay | Section 3; Figure 6 | CRITICAL |

## Figure 7

| Rule ID | Stage | Condition | Provisional outcome | Timing/destination | Boundary | Source | Priority |
|---|---|---|---|---|---|---|---|
| F7-01 | Decision branch | AG2 atypical endometrial cells or AC2 endometrial adenocarcinoma | Refer to specialist gynaecology | Urgent if malignant | Specialist-led | Fig. 7 p59; R9.01/R9.10 | HIGH |
| F7-02 | Decision branch | AG1, AG3-AG5, AIS, AC1, AC3 or AC4 | Refer to colposcopy |  | Specialist-led | Fig. 7; R9.01 | HIGH |
| F7-03 | Decision branch | No visible lesion at colposcopy | MDM case review |  | Mandatory MDM | Fig. 7; R9.02 | HIGH |
| F7-04 | Decision branch | No visible lesion; cytology confirmed, not AG2 | Type 3 diagnostic excision, with D&C or appropriate endometrial assessment where indicated by the confirmed glandular category and specialist plan. |  | Specialist-led | Fig. 7; R9.03/R9.08 | HIGH |
| F7-05 | Decision branch | No visible lesion; AG2 confirmed | Investigate other gynaecological malignancies |  | Specialist-led | Fig. 7; R9.03 | HIGH |
| F7-06 | Decision branch | No visible lesion; cytology not confirmed | Repeat colposcopy | 6 months | Mandatory MDM | Fig. 7; R9.04 | HIGH |
| F7-07 | Decision branch | Visible lesion; biopsy confirms AIS | Type 3 excision |  | Specialist-led | Fig. 7; R9.06/R9.09 | HIGH |
| F7-08 | Decision branch | Visible lesion; biopsy consistent with cancer | Refer to gynaecological oncologist | Urgent | Specialist-led | Fig. 7; R9.07/R9.10 | CRITICAL |
| F7-09 | Overlay / modifier | HPV-detected AIS, clear excision margins | Primary/community-care co-tests at 6 and 18 months. Any HPV detected or abnormal cytology during follow-up requires colposcopic assessment. | 6 and 18 months | Deterministic provisional | 2026 addendum R9.14 | HIGH |
| F7-10 | Overlay / modifier | AIS incompletely excised or margins unassessable | Further excision to obtain adequate margins |  | Specialist-led | R9.15 | HIGH |
| F7-11 | Overlay / modifier | HPV-negative or HPV-status-unknown AIS without qualifying total hysterectomy | Annual co-testing for life | Annually | Specialist-led | R2.08/R9.17 | HIGH |
| F7-12 | Specialist sidecar | No lower-genital-tract abnormality detected after glandular referral | Consider upper genital-tract imaging and endometrial assessment under specialist direction. | According to specialist plan | Clinician-only | R5.09; R9.05 | HIGH |
| F7-13 | Pre-treatment check | AIS confirmed without prior HPV testing | Obtain HPV status before treatment where applicable. | Before treatment | Clinician-only | R9.06 | HIGH |
| F7-14 | Post-excision router | Type 3 excision completed for glandular abnormality | Route by histology: benign/no lesion -> MDM surveillance; AIS -> margin/HPV follow-up; invasive adenocarcinoma -> oncology; other pathology -> corresponding specialist pathway. | After histology | Clinician-only | Sec. 9; Fig. 7 | CRITICAL |
| F7-15 | AIS follow-up | Clear-margin HPV-detected AIS follow-up has any HPV detected or abnormal cytology | Refer for colposcopic assessment; do not continue routine completion. | At abnormal follow-up | Deterministic provisional | 2026 R9.14 + Sec. 9 | CRITICAL |
| F7-16 | AIS follow-up completion | HPV-detected AIS with clear margins has qualifying co-tests at both 6 and 18 months: HPV not detected and cytology negative | Complete AIS Test of Cure and return to the applicable regular screening interval when the cervix remains. If total hysterectomy applies, use the vault/cessation pathway instead. | After qualifying 6- and 18-month co-tests | Deterministic provisional | R9.14; 2026 addendum | HIGH |
| F7-17 | Malignant cytology entry | Cytology result of invasive adenocarcinoma or otherwise suspicious/definite invasive glandular cancer | Urgent referral to a colposcopist or gynaecologist to confirm diagnosis; once confirmed, refer to gynaecological oncology. Urgency applies irrespective of HPV result. | Urgent | Safety escalation | R9.10 | CRITICAL |
| F7-18 | TZ-specific glandular management | No visible lesion after glandular referral | Explicitly distinguish Type 1/2 from Type 3 TZ. Type 3 TZ requires cytology review/MDM and diagnostic excision when the glandular abnormality is confirmed; missing TZ type is a safety stop. |  | Clinician-only | R9.02-R9.08 | HIGH |

## Table 1

| Rule ID | Stage | Condition | Provisional outcome | Timing/destination | Boundary | Source | Priority |
|---|---|---|---|---|---|---|---|
| T1-01 | Decision branch | Prior history: Negative/previous ASC-US/LSIL returned to regular screening; indication: Benign gynaecological disease; specimen: No cervical pathology | No further screening | As specified by outcome | Deterministic provisional | Table 1 p66 | MEDIUM |
| T1-02 | Decision branch | Prior history: Negative/previous ASC-US/LSIL returned to regular screening; indication: Benign gynaecological disease; specimen: LSIL (CIN1), excised or not | HPV test; follow Figure 3 | As specified by outcome | Deterministic provisional | Table 1 p66 | LOW |
| T1-03 | Decision branch | Prior history: Negative/previous ASC-US/LSIL returned to regular screening; indication: Benign gynaecological disease; specimen: HSIL (CIN2/3) or AIS, completely excised | Test of Cure | As specified by outcome | Deterministic provisional | Table 1 p66 | HIGH |
| T1-04 | Decision branch | Prior history: Negative/previous ASC-US/LSIL returned to regular screening; indication: Benign gynaecological disease; specimen: HSIL (CIN2/3) or AIS, incompletely excised | Colposcopy | As specified by outcome | Deterministic provisional | Table 1 p66 | HIGH |
| T1-05 | Decision branch | Prior history: Previous ASC-US/LSIL not returned to regular screening; indication: Benign gynaecological disease; specimen: No cervical pathology | HPV test; follow Figure 3 | As specified by outcome | Deterministic provisional | Table 1 p66 | LOW |
| T1-06 | Decision branch | Prior history: Previous ASC-US/LSIL not returned to regular screening; indication: Benign gynaecological disease; specimen: LSIL (CIN1), excised or not | HPV test; follow Figure 3 | As specified by outcome | Deterministic provisional | Table 1 p66 | LOW |
| T1-07 | Decision branch | Prior history: Previous ASC-US/LSIL not returned to regular screening; indication: Benign gynaecological disease; specimen: HSIL (CIN2/3) or AIS, completely excised | Test of Cure | As specified by outcome | Deterministic provisional | Table 1 p66 | HIGH |
| T1-08 | Decision branch | Prior history: Previous ASC-US/LSIL not returned to regular screening; indication: Benign gynaecological disease; specimen: HSIL (CIN2/3) or AIS, incompletely excised | Colposcopy | As specified by outcome | Deterministic provisional | Table 1 p66 | HIGH |
| T1-09 | Decision branch | Prior history: Treated HSIL (CIN2/3) with completed Test of Cure; indication: Benign gynaecological disease; specimen: No cervical pathology | No further screening | As specified by outcome | Deterministic provisional | Table 1 p66 | MEDIUM |
| T1-10 | Decision branch | Prior history: Treated HSIL (CIN2/3) with completed Test of Cure; indication: Benign gynaecological disease; specimen: LSIL (CIN1), excised or not | HPV test; follow Figure 3 | As specified by outcome | Deterministic provisional | Table 1 p66 | LOW |
| T1-11 | Decision branch | Prior history: Treated HSIL (CIN2/3) with completed Test of Cure; indication: Benign gynaecological disease; specimen: HSIL (CIN2/3) or AIS, completely excised | Test of Cure | As specified by outcome | Deterministic provisional | Table 1 p66 | HIGH |
| T1-12 | Decision branch | Prior history: Treated HSIL (CIN2/3) with completed Test of Cure; indication: Benign gynaecological disease; specimen: HSIL (CIN2/3) or AIS, incompletely excised | Colposcopy | As specified by outcome | Deterministic provisional | Table 1 p66 | HIGH |
| T1-13 | Overlay / modifier | Prior history: Abnormal screening with diagnosed HSIL/AIS before hysterectomy, untreated or incompletely treated; indication: HSIL/AIS +/- associated benign gynaecological disease; specimen: No cervical pathology or low grade | Test of Cure | As specified by outcome | Deterministic provisional | Table 1 p66 | HIGH |
| T1-14 | Decision branch | Prior history: Same as T1-13; indication: HSIL/AIS +/- associated benign gynaecological disease; specimen: HSIL (CIN2/3) or AIS, completely excised | Test of Cure | As specified by outcome | Deterministic provisional | Table 1 p66 | HIGH |
| T1-15 | Decision branch | Prior history: Same as T1-13; indication: HSIL/AIS +/- associated benign gynaecological disease; specimen: HSIL (CIN2/3) or AIS, incompletely excised | Colposcopy | As specified by outcome | Deterministic provisional | Table 1 p66 | HIGH |
| T1-16 | Decision branch | Prior history: Previous treatment for HSIL/AIS; incomplete Test of Cure; indication: Benign gynaecological disease; specimen: No cervical pathology or low grade | Test of Cure | As specified by outcome | Deterministic provisional | Table 1 p66 | HIGH |
| T1-17 | Decision branch | Prior history: Previous treatment for HSIL/AIS; incomplete Test of Cure; indication: Benign gynaecological disease; specimen: HSIL (CIN2/3) or AIS, completely excised | Test of Cure | As specified by outcome | Deterministic provisional | Table 1 p66 | HIGH |
| T1-18 | Decision branch | Prior history: Previous treatment for HSIL/AIS; incomplete Test of Cure; indication: Benign gynaecological disease; specimen: HSIL (CIN2/3) or AIS, incompletely excised | Colposcopy | As specified by outcome | Deterministic provisional | Table 1 p66 | HIGH |
| T1-19 | Decision branch | Prior history: No known screening history; indication: Benign gynaecological disease; specimen: No cervical pathology or low grade | HPV test at 6 months post-hysterectomy | As specified by outcome | Deterministic provisional | Table 1 p66 | LOW |
| T1-20 | Decision branch | Prior history: No known screening history; indication: Benign gynaecological disease; specimen: HSIL (CIN2/3) or AIS, completely excised | Test of Cure | As specified by outcome | Deterministic provisional | Table 1 p66 | HIGH |
| T1-21 | Decision branch | Prior history: No known screening history; indication: Benign gynaecological disease; specimen: HSIL (CIN2/3) or AIS, incompletely excised | Colposcopy | As specified by outcome | Deterministic provisional | Table 1 p66 | HIGH |

## Figure 8

| Rule ID | Stage | Condition | Provisional outcome | Timing/destination | Boundary | Source | Priority |
|---|---|---|---|---|---|---|---|
| F8-01 | Overlay / modifier | Total hysterectomy; known negative/regular history or completed ToC; no cervical pathology | No further screening required |  | Deterministic provisional | Fig. 8 p67; R10.01-R10.02 | MEDIUM |
| F8-02 | Decision branch | Same history group; unexpected LSIL/CIN1 in specimen | Vaginal-vault HPV test; use Figure 3 result branches as applicable while preserving cervix-absent and vault-sample provenance. | 6 months post-hysterectomy where specified | Deterministic provisional | Fig. 8; R10.02 | LOW |
| F8-03 | Decision branch | Same history group; HSIL/AIS completely excised | Test of Cure | Vault co-testing | Deterministic provisional | Fig. 8/Table 1 | HIGH |
| F8-04 | Decision branch | Same history group; HSIL/AIS incompletely excised | Colposcopy |  | Deterministic provisional | Fig. 8/Table 1 | HIGH |
| F8-05 | Decision branch | Previous low-grade history not returned to regular screening; no pathology or LSIL | Vaginal-vault HPV test; use Figure 3 result branches as applicable while preserving cervix-absent and vault-sample provenance. |  | Deterministic provisional | Fig. 8/Table 1 | LOW |
| F8-06 | Overlay / modifier | Untreated/incompletely treated HSIL/AIS before hysterectomy; no or low-grade pathology | Test of Cure | Vault co-tests | Deterministic provisional | Fig. 8/Table 1 | HIGH |
| F8-07 | Decision branch | Previous treatment for HSIL/AIS with incomplete ToC; no or low-grade pathology | Test of Cure | Vault co-tests | Deterministic provisional | Fig. 8/Table 1 | HIGH |
| F8-08 | Decision branch | No known screening history; benign indication; no pathology or low-grade pathology | Vaginal-vault HPV test at 6 months. If HPV not detected, screening may cease; if HPV is detected, use the reviewer-confirmed post-hysterectomy/vault pathway and refer to colposcopy where required. | 6 months post-hysterectomy in Table 1 | Deterministic provisional | Fig. 8; R10.06; Table 1 | HIGH |
| F8-09 | Overlay / modifier | Subtotal hysterectomy (cervix remains) | Continue ordinary cervical screening pathway |  | Deterministic provisional | 2026 addendum cancer section; general guideline | MEDIUM |
| F8-10 | Decision branch | Previous cervical/vaginal cancer | Use 2026 cancer overlay; most are outside NCSP recommendations except specified stage 1a1 routes |  | Specialist-led | 2026 addendum p6 | CRITICAL |
| F8-11 | Vault Test of Cure | Total hysterectomy and vault ToC reaches two consecutive HPV-not-detected + negative-cytology co-tests 12 months apart | Complete vault Test of Cure and cease screening. | After second qualifying co-test | Deterministic provisional | R10.04-R10.05; Table 1 | HIGH |
| F8-12 | Vault escalation | Any HPV detected or abnormal vaginal cytology during vault observation/ToC | Refer to colposcopy/specialist review. | At abnormal result | Deterministic provisional | R10.04-R10.05 | CRITICAL |
| F8-13 | Entry safety | Hysterectomy type, operative report, prior history, pathology or excision completeness is unknown | Stop and obtain records; do not infer no pathology or complete excision. | Immediate | Safety stop | Sec. 10; Table 1 | CRITICAL |
| F8-14 | Symptom override | Bleeding after total hysterectomy | Use Figure 10 symptom-investigation pathway regardless of reassuring vault surveillance. | Immediate/urgent as applicable | Safety router | Sec. 10 + Sec. 15 | CRITICAL |

## Figure 9

| Rule ID | Stage | Condition | Provisional outcome | Timing/destination | Boundary | Source | Priority |
|---|---|---|---|---|---|---|---|
| F9-01 | Decision branch | Pregnant participant with ASC-H, HSIL, atypical glandular cells or AIS | Refer to colposcopy by an experienced pregnancy colposcopist | As soon as practicable | Specialist-led | Fig. 9 p71; R11.03-R11.07 | HIGH |
| F9-02 | Decision branch | Normal TZ/no visible lesion at colposcopy | MDM case review |  | Mandatory MDM | Fig. 9 | HIGH |
| F9-03 | Decision branch | MDM downgrades to negative | Follow primary HPV screening pathway Figure 3 |  | Deterministic provisional | Fig. 9 | MEDIUM |
| F9-04 | Decision branch | MDM downgrades to LSIL/ASC-US | Follow the applicable low-grade pathway after reviewer confirmation; do not automatically force every case into Figure 4. |  | Deterministic provisional | Fig. 9 | LOW |
| F9-05 | Decision branch | MDM confirms possible/definite high-grade in situ result, without invasion | Colposcopy review in 6 months or 6-12 weeks postpartum | At least 6 weeks postpartum where postpartum review is used | Specialist-led | Fig. 9; R11.09-R11.10 | HIGH |
| F9-06 | Decision branch | Abnormal TZ/visible lesion; impression LSIL, HSIL (CIN2/3) or AIS, no invasion | Conservative surveillance; review in 6 months or 6-12 weeks postpartum |  | Specialist-led | Fig. 9; R11.09 | HIGH |
| F9-07 | Decision branch | Invasion suspected on cytology or colposcopy | Biopsy; if positive, urgent gynaecological oncology referral; if negative, MDM review | Oncology review within 2 weeks when invasive disease indicated | Specialist-led | Fig. 9; R11.05/R11.08 | CRITICAL |
| F9-08 | Decision branch | HPV 16/18 in pregnancy regardless of cytology | Colposcopy as soon as practicable; do not defer to postpartum |  | Specialist-led | R11.04 | HIGH |
| F9-09 | Decision branch | HPV Other + negative/ASC-US/LSIL in pregnancy | Repeat HPV test | 12 months | Deterministic provisional | R11.02 | MEDIUM |
| F9-10 | Decision branch | High-grade lesion without invasion in pregnancy | Defer definitive treatment until after pregnancy | Postpartum management | Specialist-led | R11.09 | HIGH |
| F9-11 | Postpartum timing | Postpartum reassessment required | Perform postpartum assessment no earlier than 6 weeks after delivery; figure indicates 6-12 weeks postpartum. | 6-12 weeks postpartum | Clinician-led | R11.10; Fig. 9 | HIGH |
| F9-12 | Entry safety | Pregnancy, cytology, lesion/TZ, invasion, biopsy or MDM state is unknown | Return mandatory specialist review; no autonomous routine outcome. | Immediate | Safety stop | Sec. 11; Fig. 9 | CRITICAL |
| F9-13 | Pregnancy safety gate | Before pregnancy-pathway timing or postpartum recommendation | Missing required pregnancy facts must return mandatory specialist review. Postpartum timing must be calculated from the documented delivery date and must not be earlier than six weeks. |  | Safety stop | Section 11; Figure 9 | CRITICAL |
| F9-14 | Pregnancy malignant entry | Pregnant participant with cytology suspicious of or definite for invasive cancer | Urgent experienced colposcopy and oncology/MDT assessment as appropriate; do not defer to routine postpartum review. | Urgent / within 2 weeks when invasion confirmed or strongly suspected | Safety escalation | R11.07-R11.09; Figure 9 | CRITICAL |

## Figure 10

| Rule ID | Stage | Condition | Provisional outcome | Timing/destination | Boundary | Source | Priority |
|---|---|---|---|---|---|---|---|
| F10-01 | Decision branch | Any age with signs/symptoms suggestive of cervical cancer | Clinical examination and co-test, plus urgent referral for investigation; do not delay referral for co-test or blood | Urgent | Safety override | R15.01 | CRITICAL |
| F10-02 | Decision branch | Abnormal vaginal bleeding | Perform structured history, speculum and pelvic examination, and co-test as indicated |  | Clinician assessment required | Fig. 10 p83; Sec. 15 | MEDIUM |
| F10-03 | Decision branch | Abnormal cervix + suspicion of cancer | Co-test and colposcopy/urgent specialist investigation | Urgent | Specialist-led | Fig. 10; R15.01/R15.04 | CRITICAL |
| F10-04 | Decision branch | Abnormal cervix without suspicion of cancer | Treat/investigate according to local Healthcare Pathway or refer to gynaecology |  | Local pathway/clinician-only | Fig. 10 | MEDIUM |
| F10-05 | Decision branch | Normal cervix + suspected oral-contraceptive problem | Adjust oral contraceptive and reassess bleeding | 6-8 weeks | Clinician-led | Fig. 10 | MEDIUM |
| F10-06 | Entry | After treatment/adjustment, bleeding resolved in 6-8 weeks | Resume screening according to the participant’s current due date, or commence screening at age 25; do not automatically trigger an immediate Figure 3 test. |  | Deterministic provisional | Fig. 10 | MEDIUM |
| F10-07 | Entry | After treatment/adjustment, bleeding not resolved in 6-8 weeks | Refer to gynaecology |  | Specialist referral | Fig. 10 | MEDIUM |
| F10-08 | Decision branch | Normal cervix, no contraceptive cause; STI identified | Treat STI, then reassess; persistent bleeding requires further investigation/referral |  | Clinician-led | Fig. 10; R15.03 | MEDIUM |
| F10-09 | Decision branch | Normal cervix, no contraceptive cause; STI not identified | Manage according to local Healthcare Pathway or refer to gynaecology |  | Local pathway/clinician-only | Fig. 10 | MEDIUM |
| F10-10 | Decision branch | Single episode postcoital bleeding, premenopausal, normal cervix, HPV not detected and negative cytology | No colposcopy referral required |  | Deterministic provisional | R15.02 | HIGH |
| F10-11 | Decision branch | Recurrent/persistent postcoital bleeding despite negative co-test | Refer to gynaecology; assessment may include colposcopy |  | Deterministic provisional | R15.02 | HIGH |
| F10-12 | Decision branch | Persistent/unexplained intermenstrual bleeding | Refer for specialist gynaecological assessment regardless of test results |  | Deterministic provisional | R15.05 | HIGH |
| F10-13 | Decision branch | Any postmenopausal bleeding, including postcoital | Examine, co-test and refer for specialist gynaecological assessment; do not delay referral for co-test | Urgent/without delay | Deterministic provisional | R15.06 | HIGH |
| F10-14 | Pregnancy safety | Pregnant participant with abnormal bleeding | Route to clinician/obstetric assessment as appropriate while retaining Figure 10 cancer-suspicion escalation. | Immediate | Clinician-only | Sec. 11 + Sec. 15 | CRITICAL |
| F10-15 | Hysterectomy safety | Post-hysterectomy participant with abnormal bleeding | Remain in symptom investigation; do not close based on negative vault screening. | Immediate | Safety router | Sec. 10 + Sec. 15 | CRITICAL |

## Special populations

| Rule ID | Stage | Condition | Provisional outcome | Timing/destination | Boundary | Source | Priority |
|---|---|---|---|---|---|---|---|
| DES-01 | DES exposure | Known in-utero DES exposure | Refer for initial colposcopy and specialist assessment. | Initial assessment | Clinician-only | Section 14 | HIGH |
| DES-02 | DES exposure | DES exposure with vaginal adenosis present | Annual colposcopy under specialist direction. | Annual | Clinician-only | Section 14 | HIGH |
| DES-03 | DES exposure | DES exposure with vaginal adenosis absent after specialist assessment | Return to the applicable regular screening interval, with specialist confirmation. | Regular interval | Clinician-led | Section 14 | MEDIUM |
| DES-04 | DES exposure | Any screen-detected abnormality in a DES-exposed participant | Management must be directed by a colposcopist; do not use an autonomous routine pathway. |  | Clinician-only | Section 14 | CRITICAL |
| U25-01 | Screening age | Asymptomatic participant aged under 25 who is not already in an indicated follow-up pathway | Routine HPV screening is not recommended. Symptoms and established follow-up pathways override this age gate. | No routine screen | Deterministic provisional | Screening age and interval; Section 12 | HIGH |
| U25-02 | Screening age | Participant under 25 already in screening or follow-up | Recall at the next clinically indicated appointment rather than applying a new routine-screening interval. | As clinically indicated | Clinician-led | Screening age and interval | HIGH |
| U25-03 | Early sexual activity / abuse | Participant under 25 with early sexual activity, sexual abuse history, symptoms, or another clinical concern | Do not automatically initiate routine screening. Require clinician review and apply symptom, safeguarding, or specialist pathways as appropriate. |  | Clinician-only | Section 12 | CRITICAL |

## 2026 overlays

| Rule ID | Stage | Condition | Provisional outcome | Timing/destination | Boundary | Source | Priority |
|---|---|---|---|---|---|---|---|
| A26-01 | Overlay / modifier | Type 3 TZ + HPV positive + low-grade cytology + normal colposcopy | MDM cytology review not required before observation |  | Deterministic provisional | 2026 addendum R6.05 | MEDIUM |
| A26-02 | Decision branch | CIN2 on biopsy, age <30, Type 1/2 TZ, no CIN3/invasion | MDM review. If CIN2 confirmed and participant agrees, active surveillance with colposcopy/cytology every 6 months up to 24 months | 6, 12, 18, 24 months | Specialist/shared decision | 2026 addendum R8.03 | HIGH |
| A26-03 | Decision branch | Active surveillance: biopsy downgraded to LSIL | Discharge from colposcopy with HPV +/- cytology in 12 months | 12 months | Deterministic provisional | 2026 addendum Fig. 1 | HIGH |
| A26-04 | Decision branch | Active surveillance: CIN2 regresses | Discharge from colposcopy with Test of Cure at 12 months | 12 months | Deterministic provisional | 2026 addendum Fig. 1 | HIGH |
| A26-05 | Follow-up | Active surveillance: CIN3 diagnosed at any follow-up or CIN2 persists at 24 months | Treatment recommended | Immediate after diagnosis / at 24 months | Specialist-led | 2026 addendum R8.03/Fig. 1 | HIGH |
| A26-06 | Overlay / modifier | Positive HSIL excision margins, age <50 | Test of Cure can be in primary/community care | 6 and 18 months | Deterministic provisional | 2026 addendum R8.06 | HIGH |
| A26-07 | Overlay / modifier | HPV-detected AIS with clear excision margins | Primary/community co-tests at 6 and 18 months | 6 and 18 months | Deterministic provisional | 2026 addendum R9.14 | LOW |
| A26-08 | Decision branch | Stage 1a1 cervical cancer treated by local excision | Return to regular screening only after successful treatment and ToC; HPV detected or abnormal cytology during ToC -> colposcopy; after completed ToC, HPV detected -> Figure 3 |  | Specialist-led | 2026 addendum p6 | HIGH |
| A26-09 | Overlay / modifier | Stage 1a1 cervical cancer treated by total hysterectomy | Cease screening after completing Test of Cure |  | Specialist-led | 2026 addendum p6 | HIGH |
| A26-10 | Decision branch | Other previous cervical/vaginal cancer | Outside NCSP screening recommendations; clinician and participant determine testing/management |  | Clinician-only | 2026 addendum p6 | MEDIUM |
| A26-11 | Overlay / modifier | HSIL without ToC before hysterectomy for non-cervical gynaecological cancer | Undertake ToC; cease after two HPV-not-detected/negative-cytology co-tests 12 months apart | 12 months apart | Deterministic provisional | 2026 addendum p6 | LOW |
| A26-12 | Overlay / modifier | Gynaecological cancer + subtotal hysterectomy | Continue cervical screening and register notifications |  | Deterministic provisional | 2026 addendum p6 | MEDIUM |
| A26-13 | CIN2 active surveillance | CIN2 remains under surveillance before 24 months | Complete a follow-up MDM review before the 24-month endpoint and document the revised plan. | Before 24 months | Clinician-only | 2026 addendum CIN2 surveillance figure | HIGH |
| A26-14 | CIN2 active surveillance | Participant requests treatment at any surveillance event while CIN2 remains | Offer clinician-led treatment planning without requiring surveillance to continue to 24 months. | At any surveillance event | Shared decision / clinician-only | 2026 addendum CIN2 surveillance figure | HIGH |

## Immune-deficiency classifier

| Rule ID | Stage | Condition | Provisional outcome | Timing/destination | Boundary | Source | Priority |
|---|---|---|---|---|---|---|---|
| IMM-01 | Operational provenance | Immune-deficiency status is assigned or changed | Store the provenance and record whether immune-deficient status was indicated on the laboratory request. Unknown or unlisted combinations require clinician review. |  | Workflow/audit rule | Page 3, item 5; pages 1-3 classifier | HIGH |

## Source page register
| Item | Printed page | PDF page number (1-based) |
|---|---:|---:|
| Figure 1 | 18 | 20 |
| Figure 2 | 19 | 21 |
| Figure 3 | 24 | 26 |
| Figure 4 | 45 | 47 |
| Figure 5 | 47 | 49 |
| Figure 6 | 56 | 58 |
| Figure 7 | 59 | 61 |
| Table 1 | 66 | 68 |
| Figure 8 | 67 | 69 |
| Figure 9 | 71 | 73 |
| Figure 10 | 83 | 85 |

## v2.1 QA closure
All findings QA-01 through QA-18 from the independent v2 audit are incorporated in the v2.1 rule set and master decision tree. This is a completeness statement against that audit, not a claim of clinical validation or regulatory approval.