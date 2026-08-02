# Remaining MEDIUM/LOW rule classification

Generated 2026-08-02 from the verified v2.1 canonical JSON. This is a governed software classification and compilation register, not independent clinical approval.

## Result

All 61 rules that were `SOURCE_TEXT` at revision 3 are now classified. None was judged safe to leave as unclassified display text because every record either changes routing/workflow, controls validation/reviewer behaviour, or defines a clinician-only decision sidecar.

- EXECUTABLE_ROUTING: 49
- EXECUTABLE_VALIDATION: 1
- CLINICIAN_ONLY_INFORMATION: 11
- DISPLAY_ONLY: 0
- SOURCE_PROVENANCE_ONLY: 0
- SUPERSEDED: 0
- Newly compiled: 61
- Total executable rules: 203/203
- Total unresolved or unclassified rules: 0
- Unique executable conformance IDs: 653

The eleven clinician-only rules also have typed predicates and executable tests. A match may expose source provenance and the required specialist/reviewer boundary, but it cannot autonomously finalise a clinical outcome.

## Complete 61-rule register

`Missing` means the rule carries explicit missing-data control. `Subsumed by` records the one exact duplicate presentation of the 2026 R6.05 update; both IDs remain executable for traceability.

| Rule | Section | Priority | Classification | Routing | Timing | Interval | Referral | ToC completion | Missing | Clinician-only | Informational only | Subsumed by | Tests | Source condition | Source outcome |
|---|---|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|---|---:|---|---|
| `GR-11` | Global Router & Safety | MEDIUM | EXECUTABLE_ROUTING | Yes | Yes | No | No | No | Yes | No | No | — | 3 | First transition from cytology-based programme | Use Figures 1 and 2 only for transition; otherwise use current pathway. |
| `GR-12` | Global Router & Safety | MEDIUM | EXECUTABLE_ROUTING | Yes | Yes | No | No | No | Yes | No | No | — | 3 | Asymptomatic participant in HPV primary screening | Use Figure 3 after higher-priority routes are excluded. |
| `F1-01` | Figure 1 | MEDIUM | EXECUTABLE_ROUTING | Yes | Yes | No | No | No | Yes | No | No | — | 3 | Never screened | Invite now, then perform primary HPV screening via Figure 3 |
| `F1-02` | Figure 1 | MEDIUM | EXECUTABLE_ROUTING | Yes | Yes | No | No | No | Yes | No | No | — | 3 | Under-screened | Invite now, then Figure 3 |
| `F1-03` | Figure 1 | MEDIUM | EXECUTABLE_ROUTING | Yes | Yes | No | No | No | Yes | No | No | — | 3 | Overdue | Invite now, then Figure 3 |
| `F1-04` | Figure 1 | MEDIUM | EXECUTABLE_ROUTING | Yes | Yes | Yes | No | No | Yes | No | No | — | 3 | Regularly screened with normal results | Invite at next scheduled visit, then Figure 3 |
| `F1-05` | Figure 1 | MEDIUM | EXECUTABLE_ROUTING | Yes | Yes | Yes | No | No | Yes | No | No | — | 3 | Previous low-grade result, already returned to regular screening | Invite at next scheduled visit, then Figure 3 |
| `F1-06` | Figure 1 | MEDIUM | EXECUTABLE_ROUTING | Yes | Yes | Yes | No | Yes | Yes | No | No | — | 3 | Previous high-grade result with successful Test of Cure | Invite at next scheduled visit, then Figure 3 |
| `F1-X` | Figure 1 | LOW | EXECUTABLE_ROUTING | Yes | No | No | No | No | Yes | No | No | — | 3 | Previous high-grade/glandular result not returned to regular screening | Do not use Figure 1; route to Figure 2 |
| `F2-03` | Figure 2 | MEDIUM | EXECUTABLE_ROUTING | Yes | Yes | Yes | No | No | Yes | No | No | — | 5 | Previous atypical endometrial cells; report >3 years ago | Primary HPV screening test at next scheduled visit via Figure 3 |
| `F2-04` | Figure 2 | MEDIUM | EXECUTABLE_ROUTING | Yes | Yes | Yes | No | No | Yes | No | No | — | 3 | Previous atypical endometrial cells; already investigated by specialist and discharged to primary care | Primary HPV screening test at next scheduled visit via Figure 3 |
| `F2-05` | Figure 2 | LOW | EXECUTABLE_ROUTING | Yes | Yes | Yes | Yes | No | Yes | No | No | — | 3 | Previous atypical endometrial cells; neither >3 years nor specialist-assessed/discharged | Refer to specialist gynaecology services |
| `F2-X` | Figure 2 | LOW | EXECUTABLE_ROUTING | Yes | No | No | No | Yes | Yes | No | No | — | 3 | Prior high-grade history already completed Test of Cure | Do not remain in Figure 2; return to Figure 1/Figure 3 |
| `F3-04` | Figure 3 | LOW | EXECUTABLE_ROUTING | Yes | Yes | Yes | No | No | Yes | No | No | — | 3 | HPV Other detected on swab-collected sample | Return visit for clinical examination and clinician-taken LBC for cytology |
| `F3-06` | Figure 3 | MEDIUM | EXECUTABLE_ROUTING | Yes | Yes | No | Yes | No | Yes | No | No | — | 3 | HPV Other + atypical endometrial cells with no co-existing colposcopy indication | Refer for specialist gynaecological assessment |
| `F3-07` | Figure 3 | MEDIUM | EXECUTABLE_ROUTING | Yes | Yes | Yes | No | No | Yes | No | No | — | 3 | Initial HPV Other + negative/ASC-US/LSIL cytology | Repeat HPV test in 12 months, using LBC |
| `F3-08` | Figure 3 | MEDIUM | EXECUTABLE_ROUTING | Yes | Yes | Yes | No | No | Yes | No | No | — | 3 | First 12-month repeat: HPV not detected | Return to regular interval screening |
| `F3-12` | Figure 3 | MEDIUM | EXECUTABLE_ROUTING | Yes | Yes | Yes | No | No | Yes | No | No | — | 5 | First 12-month repeat: HPV Other + negative/ASC-US/LSIL and age <50 | Second repeat HPV test in another 12 months, using LBC |
| `F3-13` | Figure 3 | MEDIUM | EXECUTABLE_ROUTING | Yes | Yes | Yes | No | No | Yes | No | No | — | 3 | Second repeat: HPV not detected | Return to regular interval screening |
| `F3-17` | Figure 3 | MEDIUM | EXECUTABLE_ROUTING | Yes | Yes | No | No | No | Yes | No | No | — | 5 | Asymptomatic age >=75 | Routine screening not recommended |
| `F3-18` | Figure 3 | MEDIUM | EXECUTABLE_ROUTING | Yes | Yes | Yes | No | No | Yes | No | No | — | 3 | HPV test invalid or unsuitable for analysis | Repeat HPV test as soon as practicable with no required delay |
| `F4-01` | Figure 4 | MEDIUM | EXECUTABLE_ROUTING | Yes | Yes | Yes | No | No | Yes | No | No | — | 3 | HPV detected any type + negative/ASC-US/LSIL cytology + normal colposcopy | Repeat HPV test in community care using LBC |
| `F4-02` | Figure 4 | MEDIUM | EXECUTABLE_ROUTING | Yes | Yes | Yes | No | No | Yes | No | No | — | 3 | 12-month repeat: HPV not detected | Return to regular interval screening: 5 years if immune competent or 3 years if verified immune deficient. |
| `F4-06` | Figure 4 | MEDIUM | EXECUTABLE_ROUTING | Yes | Yes | Yes | No | No | Yes | No | No | — | 3 | 12-month repeat: HPV Other + negative/ASC-US/LSIL; immune competent | Repeat HPV/cytology using LBC in another 12 months |
| `F4-07` | Figure 4 | MEDIUM | EXECUTABLE_ROUTING | Yes | No | Yes | No | No | Yes | No | No | — | 3 | 24-month repeat: HPV not detected | Return to regular interval screening: 5 years if immune competent or 3 years if verified immune deficient. |
| `F4-09` | Figure 4 | MEDIUM | EXECUTABLE_ROUTING | Yes | Yes | No | Yes | No | Yes | No | No | A26-01 | 3 | Type 3 TZ, HPV positive, low-grade cytology, normal colposcopy | Observation is appropriate; MDM cytological review is not required under the 2026 update |
| `F4-10` | Figure 4 | MEDIUM | CLINICIAN_ONLY_INFORMATION | Yes | No | No | Yes | No | Yes | Yes | Yes | — | 3 | Type 3 TZ with no cytological/colposcopic/histological high-grade evidence | Do not routinely perform diagnostic excision |
| `F4-11` | Figure 4 | MEDIUM | CLINICIAN_ONLY_INFORMATION | Yes | No | No | Yes | No | Yes | Yes | Yes | — | 5 | Type 3 TZ and selected concerns: completed child-bearing, anxiety, age >50, uncertain attendance | Diagnostic excision may be offered |
| `F4-12` | Figure 4 | MEDIUM | CLINICIAN_ONLY_INFORMATION | Yes | No | No | No | No | Yes | Yes | Yes | — | 3 | Persistent ASC-US/LSIL with Type 3 TZ | ECC may be considered; a negative ECC is not reassuring |
| `F5-02` | Figure 5 | MEDIUM | EXECUTABLE_ROUTING | Yes | Yes | Yes | No | No | Yes | No | No | — | 3 | MDM downgrades cytology to LSIL/ASC-US/negative | Follow amended low-grade pathway, generally repeat HPV in 12 months |
| `F5-04` | Figure 5 | MEDIUM | CLINICIAN_ONLY_INFORMATION | Yes | No | No | Yes | No | Yes | Yes | Yes | — | 3 | Confirmed ASC-H, Type 1/2 TZ, no visible lesion | Consider diagnostic excision; observation is an option after informed discussion |
| `F5-08` | Figure 5 | MEDIUM | EXECUTABLE_ROUTING | Yes | Yes | Yes | Yes | No | Yes | No | No | — | 3 | After observation: HPV not detected, negative cytology, no visible lesion/unchanged impression | Repeat co-test in 12 months. Return to regular interval screening only after the subsequent co-test is again HPV not detected with negative cytology and the specialist surveillance sequence is complete. |
| `F6-02` | Figure 6 | MEDIUM | EXECUTABLE_ROUTING | Yes | Yes | Yes | No | No | Yes | No | No | — | 3 | 6-month co-test: HPV not detected + cytology negative | Repeat co-test |
| `F6-06` | Figure 6 | MEDIUM | EXECUTABLE_ROUTING | Yes | Yes | Yes | No | Yes | Yes | No | No | — | 3 | HPV not detected + first low-grade cytology during Test of Cure | Repeat HPV and cytology |
| `T1-01` | Table 1 | MEDIUM | EXECUTABLE_ROUTING | Yes | Yes | No | No | No | Yes | No | No | — | 3 | Prior history: Negative/previous ASC-US/LSIL returned to regular screening; indication: Benign gynaecological disease; specimen: No cervical pathology | No further screening |
| `T1-02` | Table 1 | LOW | EXECUTABLE_ROUTING | Yes | Yes | No | No | No | Yes | No | No | — | 3 | Prior history: Negative/previous ASC-US/LSIL returned to regular screening; indication: Benign gynaecological disease; specimen: LSIL (CIN1), excised or not | HPV test; follow Figure 3 |
| `T1-05` | Table 1 | LOW | EXECUTABLE_ROUTING | Yes | Yes | No | No | No | Yes | No | No | — | 3 | Prior history: Previous ASC-US/LSIL not returned to regular screening; indication: Benign gynaecological disease; specimen: No cervical pathology | HPV test; follow Figure 3 |
| `T1-06` | Table 1 | LOW | EXECUTABLE_ROUTING | Yes | Yes | No | No | No | Yes | No | No | — | 3 | Prior history: Previous ASC-US/LSIL not returned to regular screening; indication: Benign gynaecological disease; specimen: LSIL (CIN1), excised or not | HPV test; follow Figure 3 |
| `T1-09` | Table 1 | MEDIUM | EXECUTABLE_ROUTING | Yes | Yes | No | No | Yes | Yes | No | No | — | 3 | Prior history: Treated HSIL (CIN2/3) with completed Test of Cure; indication: Benign gynaecological disease; specimen: No cervical pathology | No further screening |
| `T1-10` | Table 1 | LOW | EXECUTABLE_ROUTING | Yes | Yes | No | No | Yes | Yes | No | No | — | 3 | Prior history: Treated HSIL (CIN2/3) with completed Test of Cure; indication: Benign gynaecological disease; specimen: LSIL (CIN1), excised or not | HPV test; follow Figure 3 |
| `T1-19` | Table 1 | LOW | EXECUTABLE_ROUTING | Yes | Yes | Yes | No | No | Yes | No | No | — | 3 | Prior history: No known screening history; indication: Benign gynaecological disease; specimen: No cervical pathology or low grade | HPV test at 6 months post-hysterectomy |
| `F8-01` | Figure 8 | MEDIUM | EXECUTABLE_ROUTING | Yes | No | No | No | Yes | Yes | No | No | — | 3 | Total hysterectomy; known negative/regular history or completed ToC; no cervical pathology | No further screening required |
| `F8-02` | Figure 8 | LOW | EXECUTABLE_ROUTING | Yes | Yes | Yes | No | No | Yes | No | No | — | 3 | Same history group; unexpected LSIL/CIN1 in specimen | Vaginal-vault HPV test; use Figure 3 result branches as applicable while preserving cervix-absent and vault-sample provenance. |
| `F8-05` | Figure 8 | LOW | EXECUTABLE_ROUTING | Yes | No | No | No | No | Yes | No | No | — | 3 | Previous low-grade history not returned to regular screening; no pathology or LSIL | Vaginal-vault HPV test; use Figure 3 result branches as applicable while preserving cervix-absent and vault-sample provenance. |
| `F8-09` | Figure 8 | MEDIUM | EXECUTABLE_ROUTING | Yes | No | No | No | No | Yes | No | No | — | 3 | Subtotal hysterectomy (cervix remains) | Continue ordinary cervical screening pathway |
| `F9-03` | Figure 9 | MEDIUM | EXECUTABLE_ROUTING | Yes | No | No | No | No | Yes | No | No | — | 3 | MDM downgrades to negative | Follow primary HPV screening pathway Figure 3 |
| `F9-04` | Figure 9 | LOW | EXECUTABLE_ROUTING | Yes | No | No | No | No | Yes | No | No | — | 3 | MDM downgrades to LSIL/ASC-US | Follow the applicable low-grade pathway after reviewer confirmation; do not automatically force every case into Figure 4. |
| `F9-09` | Figure 9 | MEDIUM | EXECUTABLE_ROUTING | Yes | Yes | Yes | No | No | Yes | No | No | — | 3 | HPV Other + negative/ASC-US/LSIL in pregnancy | Repeat HPV test |
| `F10-02` | Figure 10 | MEDIUM | CLINICIAN_ONLY_INFORMATION | Yes | No | Yes | No | No | Yes | Yes | Yes | — | 3 | Abnormal vaginal bleeding | Perform structured history, speculum and pelvic examination, and co-test as indicated |
| `F10-04` | Figure 10 | MEDIUM | CLINICIAN_ONLY_INFORMATION | Yes | No | No | Yes | No | Yes | Yes | Yes | — | 3 | Abnormal cervix without suspicion of cancer | Treat/investigate according to local Healthcare Pathway or refer to gynaecology |
| `F10-05` | Figure 10 | MEDIUM | CLINICIAN_ONLY_INFORMATION | Yes | Yes | No | No | No | Yes | Yes | Yes | — | 3 | Normal cervix + suspected oral-contraceptive problem | Adjust oral contraceptive and reassess bleeding |
| `F10-06` | Figure 10 | MEDIUM | EXECUTABLE_ROUTING | Yes | No | No | No | No | Yes | No | No | — | 3 | After treatment/adjustment, bleeding resolved in 6-8 weeks | Resume screening according to the participant’s current due date, or commence screening at age 25; do not automatically trigger an immediate Figure 3 test. |
| `F10-07` | Figure 10 | MEDIUM | EXECUTABLE_ROUTING | Yes | No | No | Yes | No | Yes | No | No | — | 3 | After treatment/adjustment, bleeding not resolved in 6-8 weeks | Refer to gynaecology |
| `F10-08` | Figure 10 | MEDIUM | CLINICIAN_ONLY_INFORMATION | Yes | No | No | Yes | No | Yes | Yes | Yes | — | 3 | Normal cervix, no contraceptive cause; STI identified | Treat STI, then reassess; persistent bleeding requires further investigation/referral |
| `F10-09` | Figure 10 | MEDIUM | CLINICIAN_ONLY_INFORMATION | Yes | No | No | Yes | No | Yes | Yes | Yes | — | 3 | Normal cervix, no contraceptive cause; STI not identified | Manage according to local Healthcare Pathway or refer to gynaecology |
| `DES-03` | Special populations | MEDIUM | CLINICIAN_ONLY_INFORMATION | Yes | Yes | Yes | Yes | No | Yes | Yes | Yes | — | 3 | DES exposure with vaginal adenosis absent after specialist assessment | Return to the applicable regular screening interval, with specialist confirmation. |
| `A26-01` | 2026 overlays | MEDIUM | EXECUTABLE_VALIDATION | Yes | No | No | Yes | No | Yes | No | No | — | 3 | Type 3 TZ + HPV positive + low-grade cytology + normal colposcopy | MDM cytology review not required before observation |
| `A26-07` | 2026 overlays | LOW | EXECUTABLE_ROUTING | Yes | Yes | Yes | No | No | Yes | No | No | — | 3 | HPV-detected AIS with clear excision margins | Primary/community co-tests at 6 and 18 months |
| `A26-10` | 2026 overlays | MEDIUM | CLINICIAN_ONLY_INFORMATION | Yes | No | No | No | No | Yes | Yes | Yes | — | 3 | Other previous cervical/vaginal cancer | Outside NCSP screening recommendations; clinician and participant determine testing/management |
| `A26-11` | 2026 overlays | LOW | EXECUTABLE_ROUTING | Yes | Yes | Yes | No | Yes | Yes | No | No | — | 3 | HSIL without ToC before hysterectomy for non-cervical gynaecological cancer | Undertake ToC; cease after two HPV-not-detected/negative-cytology co-tests 12 months apart |
| `A26-12` | 2026 overlays | MEDIUM | EXECUTABLE_ROUTING | Yes | No | No | No | No | Yes | No | No | — | 3 | Gynaecological cancer + subtotal hysterectomy | Continue cervical screening and register notifications |

## Governance interpretation

- `EXECUTABLE_ROUTING` rules select or modify a pathway, outcome, repeat, interval, referral, cessation or completion state and therefore require typed execution.
- `EXECUTABLE_VALIDATION` is used for `A26-01`, the controlling 2026 R6.05 boundary that removes the prior MDM requirement for the exact Type 3 TZ scenario. `F4-09` is the same predicate represented inside Figure 4 and is recorded as fully subsumed by `A26-01`, while remaining executable for matched-rule provenance.
- `CLINICIAN_ONLY_INFORMATION` rules identify a clinician/specialist judgement branch. Their predicates are executable, but the evaluator forces `clinicianOnly`, mandatory confirmation, and no autonomous finalisation.
- No rule was assigned `DISPLAY_ONLY`, `SOURCE_PROVENANCE_ONLY`, or `SUPERSEDED`; the source package gives every remaining record a behavioural or reviewer-boundary effect.

## Test evidence

Each newly compiled rule has a positive, negative and missing-fact test ID. Eight additional named boundary tests cover the >3-year transition date, age 49/50 repeat split, age 74/75 exit boundary, and Type 3 TZ age 50/51 shared-decision boundary. The classification map is stored in the canonical snapshot with each affected rule.

`CG-NCSP-3.0.0` remains an unpublished, unactivated draft. Classification and executable software tests do not constitute clinical validation.
