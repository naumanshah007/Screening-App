# CHCH dataset assumptions — clinician review pack

Assumptions version: `chch-public-assumptions-v1`
Manifest sha256: `d23093955ccf6f7de510f74aa9e5531a6c1b315bd026d71990ad639eb2e8e371`
Dataset sha256: `e121cc60833888b024f2c81d740703306296c3b3965f219d5d4ce3ef0b8351ae`
Cases: 30 · Assumptions: 10 · Awaiting decision: 10

The clinician-supplied workbook does not state these facts, and the engine requires a value for each. Every value below is an assumption made to build the dataset, not something the source reports. Please mark each APPROVE, REJECT or MODIFY. Nothing here is approved.

## 1. immunocompromised

| | |
|---|---|
| **Current value** | `false` |
| **Cases affected** | all 30 cases |
| **Why introduced** | The source states no immune-deficiency status for any case. A screening extract that records immune deficiency would normally carry it; its absence across all 30 rows is read as 'not indicated on the request'. |
| **Consequence if wrong** | Recall interval is wrong for HPV-negative cases: 5 years instead of the 3 years an immune-deficient participant requires. Affects 11 cases. |
| **Rules affected** | `F3-HPV-NOT-DETECTED-5Y`, `F3-HPV-NOT-DETECTED-IC-3Y`, `IMM-01` |
| **Decision** | ☐ APPROVE ☐ REJECT ☐ MODIFY → ______________________ |
| **Clinician comment** | |

## 2. isPostHysterectomy

| | |
|---|---|
| **Current value** | `false` |
| **Cases affected** | all 30 cases |
| **Why introduced** | Every case is described as a cervical screening episode with a cervical sample or a cervical screening circumstance, which presupposes a cervix. |
| **Consequence if wrong** | Post-hysterectomy participants would be graded on Figure 3 rather than Figure 8 / Table 1. |
| **Rules affected** | `GR-04`, `F8-*`, `TABLE_1` |
| **Decision** | ☐ APPROVE ☐ REJECT ☐ MODIFY → ______________________ |
| **Clinician comment** | |

## 3. isPregnant / hasAbnormalVaginalBleeding / hasCancerSymptoms

| | |
|---|---|
| **Current value** | `not present` |
| **Cases affected** | all 30 cases |
| **Why introduced** | All 30 rows describe asymptomatic screening or surveillance circumstances. No row mentions pregnancy, bleeding or symptoms. |
| **Consequence if wrong** | A pregnant or symptomatic participant would be routed to Figure 9 or Figure 10, which take precedence over routine screening. |
| **Rules affected** | `GR-02`, `F9-*`, `F10-*` |
| **Decision** | ☐ APPROVE ☐ REJECT ☐ MODIFY → ______________________ |
| **Clinician comment** | |

## 4. sampleType

| | |
|---|---|
| **Current value** | `LBC` |
| **Cases affected** | all 30 cases |
| **Why introduced** | The source does not state collection method. LBC is assumed because several rows report a cytology result, which a self-collected swab cannot produce without a return visit. |
| **Consequence if wrong** | Self-collected swabs with HPV detected require a return visit with clinical examination before a cytology-dependent decision (F3-SWAB-RETURN-REQUIRED). Assuming LBC bypasses that step. |
| **Rules affected** | `F3-03`, `F3-SWAB-RETURN-REQUIRED` |
| **Decision** | ☐ APPROVE ☐ REJECT ☐ MODIFY → ______________________ |
| **Clinician comment** | |

## 5. repeatStage

| | |
|---|---|
| **Current value** | `BASELINE unless the row states a repeat interval` |
| **Cases affected** | all 30 cases |
| **Why introduced** | Rows stating '12-month follow-up' or '12-month surveillance' are marked FIRST_REPEAT. Rows described as 'routine screening' or 'first screen' are treated as baseline events. |
| **Consequence if wrong** | Repeat-stage routing changes which Figure 3 branch applies to a non-16/18 HPV result, and whether a second consecutive positive escalates. |
| **Rules affected** | `F3-09`, `F3-HPV-OTHER-NEG-ASCUS-LSIL-12M` |
| **Decision** | ☐ APPROVE ☐ REJECT ☐ MODIFY → ______________________ |
| **Clinician comment** | |

## 6. consecutiveNegativeCoTestCount / consecutiveLowGradeCount / unsatisfactoryCytologyCount

| | |
|---|---|
| **Current value** | `0 unless stated` |
| **Cases affected** | all 30 cases |
| **Why introduced** | No row reports a count of prior consecutive results. Zero represents 'no such prior sequence recorded in this extract'. |
| **Consequence if wrong** | Test of Cure completion and repeat-escalation thresholds depend on these counts; a non-zero true value could complete or escalate a pathway. |
| **Rules affected** | `F6-*`, `F4-*`, `F5-*` |
| **Decision** | ☐ APPROVE ☐ REJECT ☐ MODIFY → ______________________ |
| **Clinician comment** | |

## 7. atypicalEndometrialHistory

| | |
|---|---|
| **Current value** | `false` |
| **Cases affected** | all 30 cases |
| **Why introduced** | No row reports atypical endometrial cells. The AG2 pathway has distinctive wording that none of the histories use. |
| **Consequence if wrong** | An AG2 history routes to Figure 2's endometrial branch and specialist gynaecology. |
| **Rules affected** | `F2-AG2-*` |
| **Decision** | ☐ APPROVE ☐ REJECT ☐ MODIFY → ______________________ |
| **Clinician comment** | |

## 8. isTestOfCure (chch-018)

| | |
|---|---|
| **Current value** | `NOT assumed — left unknown` |
| **Cases affected** | chch-018 |
| **Why introduced** | The source says 'Previous CIN2; surveillance episode'. It does not say the CIN2 was treated, and Test of Cure presupposes treatment. CIN2 is also frequently managed by observation. The dataset records the high-grade history and leaves treatment status unstated, which produces a safety stop rather than a terminal recommendation. |
| **Consequence if wrong** | If the CIN2 was in fact treated, the case belongs on Figure 6 Test of Cure and would carry a P1 referral rather than stopping for records. |
| **Rules affected** | `F2-01`, `F6-*` |
| **Decision** | ☐ APPROVE ☐ REJECT ☐ MODIFY → ______________________ |
| **Clinician comment** | |

## 9. isTestOfCure (chch-007)

| | |
|---|---|
| **Current value** | `true` |
| **Cases affected** | chch-007 |
| **Why introduced** | The source states both 'Post-treatment surveillance' and 'Treated CIN3 three years ago'. Treatment of a high-grade lesion followed by surveillance is Test of Cure by definition. Stage and status are NOT assumed — the source does not say how far through Test of Cure this participant is. |
| **Consequence if wrong** | If this is not a Test of Cure episode the case would be graded on Figure 3 as routine primary screening. |
| **Rules affected** | `F2-01`, `F6-HPV-DETECTED-ANY-CYTOLOGY-COLP` |
| **Decision** | ☐ APPROVE ☐ REJECT ☐ MODIFY → ______________________ |
| **Clinician comment** | |

## 10. previousHpv1618Episode (chch-009, chch-010, chch-019)

| | |
|---|---|
| **Current value** | `true, with referral outcome left unknown` |
| **Cases affected** | chch-009, chch-010, chch-019 |
| **Why introduced** | These rows report a previous HPV16 or HPV18 positive result. Recorded as a previous HPV 16/18 episode — NOT as previous high-grade disease, which the rulebook defines by cytology and histology categories (F2-01) and never equates with genotype. |
| **Consequence if wrong** | If the earlier referral was in fact completed and benign, these cases would return to routine screening rather than stopping for records. |
| **Rules affected** | `F3-03`, `F3-PREVIOUS-HPV1618-OUTCOME-REQUIRED`, `GS-01` |
| **Decision** | ☐ APPROVE ☐ REJECT ☐ MODIFY → ______________________ |
| **Clinician comment** | |

---

**Reviewed by:** ______________________  **Role:** ______________________  **Date:** ____________

Decisions are transcribed back into `lib/batch/chch-public-assumptions.ts`. Only explicit clinician decisions are incorporated; the acceptance run is then repeated before the evaluation build is frozen.
