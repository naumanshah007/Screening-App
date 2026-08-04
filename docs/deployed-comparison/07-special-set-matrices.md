# Special-set verification matrices

Date: 4 August 2026. Systems A/B/C as defined in `06-three-way-comparison.md`.

---

## 1. The 26 documented legacy differences

**All 26 matched to the corpus. All 26 are wrong in the deployed production build
*and* in the current candidate legacy engine — they are confirmed deployed
defects, not local artefacts. The canonical engine corrects 22.**

| Defect | Source case | Production | Current legacy | Canonical | Candidate corrects? |
|---|---|:--:|:--:|:--:|:--:|
| LEGACY-001 | `F3-BASELINE-HPV-OTHER-NEGATIVE-REPEAT-12M` | ✗ | ✗ | ✓ | **yes** |
| LEGACY-002 | `F3-BASELINE-HPV-OTHER-ASC-US-REPEAT-12M` | ✗ | ✗ | ✓ | **yes** |
| LEGACY-003 | `F3-BASELINE-HPV-OTHER-LSIL-REPEAT-12M` | ✗ | ✗ | ✓ | **yes** |
| LEGACY-004 | `F3-INVALID-HPV-REPEAT-ASAP` | ✗ | ✗ | ✓ | **yes** |
| LEGACY-005 | `F3-CYTOLOGY-PENDING-INCOMPLETE` | ✗ | ✗ | ✗ | **no — clinical review** |
| LEGACY-006 | `F3-MISSING-SAMPLE-TYPE-SAFETY-STOP` | ✗ | ✗ | ✓ | **yes** |
| LEGACY-007 | `F3-HPV-NOT-DETECTED-UNKNOWN-IMMUNE-SAFETY-STOP` | ✗ | ✗ | ✓ | **yes** |
| LEGACY-008 | `F4-REPEAT-HPV-NOT-DETECTED-REGULAR-5Y` | ✗ | ✗ | ✓ | **yes** |
| LEGACY-009 | `F4-REPEAT-HPV-NOT-DETECTED-IMMUNE-3Y` | ✗ | ✗ | ✓ | **yes** |
| LEGACY-010 | `F4-SECOND-REPEAT-NOT-DETECTED-REGULAR-5Y` | ✗ | ✗ | ✓ | **yes** |
| LEGACY-011 | `F4-SECOND-REPEAT-NOT-DETECTED-IMMUNE-3Y` | ✗ | ✗ | ✓ | **yes** |
| LEGACY-012 | `F5-MDM-DOWNGRADED-LSIL-PATHWAY` | ✗ | ✗ | ✓ | **yes** |
| LEGACY-013 | `F5-MDM-UPGRADED-HSIL-PATHWAY` | ✗ | ✗ | ✓ | **yes** |
| LEGACY-014 | `F5-TREATMENT-DEFERRED-HPV-DETECTED-NORMAL-12M` | ✗ | ✗ | ✗ | **no — clinical review** |
| LEGACY-015 | `F6-MISSING-TREATMENT-DATE-SAFETY-STOP` | ✗ | ✗ | ✓ | **yes** |
| LEGACY-016 | `F7-NO-LESION-CYTOLOGY-CONFIRMED-TYPE3-EXCISION` | ✗ | ✗ | ✓ | **yes** |
| LEGACY-017 | `F7-NO-LESION-AG2-CONFIRMED-INVESTIGATE` | ✗ | ✗ | ✗ | **no — clinical review** |
| LEGACY-018 | `F7-NO-LESION-CYTOLOGY-NOT-CONFIRMED-6M` | ✗ | ✗ | ✓ | **yes** |
| LEGACY-019 | `F8-LOW-RISK-COMPLETE-HSIL-AIS-TOC` | ✗ | ✗ | ✓ | **yes** |
| LEGACY-020 | `F8-LOW-RISK-INCOMPLETE-HSIL-AIS-COLPOSCOPY` | ✗ | ✗ | ✓ | **yes** |
| LEGACY-021 | `F8-UNTREATED-HSIL-AIS-NO-LOW-PATH-TOC` | ✗ | ✗ | ✓ | **yes** |
| LEGACY-022 | `T1-HSIL-AIS-UNTREATED-INCOMPLETE-NO-OR-LOW-PATHOLOGY` | ✗ | ✗ | ✓ | **yes** |
| LEGACY-023 | `T1-PREVIOUS-TREATMENT-INCOMPLETE-TOC-NO-OR-LOW-PATHOLOGY` | ✗ | ✗ | ✓ | **yes** |
| LEGACY-024 | `F9-NORMAL-TZ-MDM-DOWNGRADE-NEGATIVE-F3` | ✗ | ✗ | ✓ | **yes** |
| LEGACY-025 | `F9-NORMAL-TZ-MDM-DOWNGRADE-LOW-GRADE` | ✗ | ✗ | ✓ | **yes** |
| LEGACY-026 | `F9-NORMAL-TZ-MDM-CONFIRMS-HIGH-GRADE-REVIEW` | ✗ | ✗ | ✗ | **no — clinical review** |

| Summary | Count |
|---|---:|
| Matched to corpus | **26 / 26** |
| Present in the **deployed production build** | **26** |
| Present in the current candidate legacy engine | **26** |
| Corrected by CG-NCSP-3.1.0 | **22** |
| Still unresolved — require clinical review | **4** (LEGACY-005, -014, -017, -026) |
| Defect groups | `WRONG_REFERRAL_OR_PATHWAY` 10, `INCOMPLETE_LONGITUDINAL_STATE` 5, `MISSING_DATA_COLLAPSE` 4, `WRONG_INTERVAL` 4, `PRESENTATION_CODE_MISMATCH` 3 |

**User-visible recommendation change:** all 26 change the recommendation a user
would see, since each is a wrong referral, interval, pathway or missing-data
response rather than a formatting difference.

**Potential historical-regrade impact: all 26 are flagged
`historicalRegradeMayChangeOutcome`.** Any past decision graded through the
deployed engine on one of these branches could change if regraded under
CG-NCSP-3.1.0.

> **No historical regrade was performed.** No completed decision was re-evaluated,
> no stored `RuleEvaluation` was altered, no evaluated snapshot was overwritten.
> The regrade-impact column is a documented property of the register, carried
> forward — not a computed replay.

---

## 2. The 18 former input-contract gaps

States the deployed `ClinicalInput` cannot encode at all.

| # | Source case | Canonical resolves? |
|---:|---|:--:|
| 1 | `F3-UNSUITABLE-HPV-REPEAT-ASAP` | ✓ |
| 2 | `F6-CIN2-UNDER30-ELIGIBLE-ACTIVE-SURVEILLANCE` | ✓ |
| 3 | `F6-CIN2-SURVEILLANCE-CIN3-TREAT` | ✓ |
| 4 | `F6-CIN2-PERSISTS-24M-TREAT` | ✓ |
| 5 | `F6-CIN2-REGRESSION-TOC` | ✓ |
| 6 | `F6-POSITIVE-MARGINS-UNDER50-COMMUNITY-TOC` | ✓ |
| 7 | `F6-POSITIVE-MARGINS-AGE50PLUS-SPECIALIST` | ✓ |
| 8 | `F7-AIS-CLEAR-MARGINS-PRIMARY-CARE-6-18M` | ✓ |
| 9 | `F8-CANCER-STAGE1A1-LOCAL-EXCISION-TOC-COMPLETE-REGULAR` | **✗** |
| 10 | `F8-CANCER-STAGE1A1-TOC-ABNORMAL-COLPOSCOPY` | ✓ |
| 11 | `F8-CANCER-STAGE1A1-POST-TOC-HPV-FIG3` | ✓ |
| 12 | `F8-CANCER-TOTAL-HYSTERECTOMY-TOC-COMPLETE-CEASE` | ✓ |
| 13 | `F8-OTHER-GYNAECOLOGICAL-CANCER-OUTSIDE-NCSP` | ✓ |
| 14 | `F8-NONCERVICAL-CANCER-HYSTERECTOMY-HSIL-INCOMPLETE-TOC` | **✗** |
| 15 | `F10-SINGLE-PREMENOPAUSAL-PCB-REASSURING-NO-COLPOSCOPY` | ✓ |
| 16 | `F10-RECURRENT-PERSISTENT-PCB-GYNAECOLOGY` | ✓ |
| 17 | `F10-PERSISTENT-UNEXPLAINED-IMB-GYNAECOLOGY` | ✓ |
| 18 | `F10-POSTMENOPAUSAL-BLEEDING-EXAM-COTEST-GYNAECOLOGY` | ✓ |

**16 of 18 resolved** (`CANDIDATE_ADDS_PREVIOUSLY_UNSUPPORTED_STATE`); **2 remain
`DEPLOYED_INPUT_CONTRACT_GAP`** — both stage-1A1/non-cervical cancer overlay
states, where the canonical result also does not match the source expectation.

No mapping was invented for any of the 18. Where the deployed contract cannot
express a state, it is recorded as a gap, not forced into an approximation.

---

## 3. The 21 Table 1 combinations

| Metric | Value |
|---|---:|
| Cases | **21** |
| Production-executable | **21** (no input-contract gaps) |
| Production matches source | **19** |
| Current legacy matches source | **19** |
| Canonical matches source | **21 / 21** |
| `THREE_WAY_EXACT_AGREEMENT` | **19** |
| `CANDIDATE_FIXES_CONFIRMED_LEGACY_DEFECT` | **2** |

The two corrections are `T1-HSIL-AIS-UNTREATED-INCOMPLETE-NO-OR-LOW-PATHOLOGY`
(LEGACY-022) and `T1-PREVIOUS-TREATMENT-INCOMPLETE-TOC-NO-OR-LOW-PATHOLOGY`
(LEGACY-023). All six history groups × the pathology axis are covered, and Table 1
is the strongest area of the deployed engine.

---

## 4. GOV-01 … GOV-04

| Item | Result |
|---|---|
| GOV-01 / GOV-02 / GOV-03 | Governance decisions, not executable corpus branches. Unchanged; still unsigned. No decision was populated or approved in this pass. |
| **GOV-04 — clinician-only boundary** | **Measured. Over-restriction confirmed.** |

### GOV-04 measurement

| Metric | Value |
|---|---:|
| Source oracle says `clinicianOnly` | **53 / 179** |
| CG-NCSP-3.1.0 sets `clinicianOnly` | **152 / 179** |
| Agreement | **80 / 179** |
| **Canonical over-restricts** (source says no, canonical says yes) | **99** |
| **Canonical under-restricts** (source says yes, canonical says no) | **0** |

The direction is uniformly fail-safe — the canonical engine never releases a case
the source says a clinician must own. But it marks **nearly three times** as many
cases clinician-only as the source requires. Two cases were classified
`GOV04_CLINICIAN_ONLY_OVERRESTRICTION` as their primary classification
(`F8-INCOMPLETE-TOC-NO-LOW-PATH-CONTINUE-TOC`, `F9-ABNORMAL-TZ-LSIL-HSIL-AIS-REVIEW`);
the remaining 97 carry it as a secondary flag alongside another classification.

**Implication for GOV-04:** the boundary is safe but the automation value is
substantially eroded. This is a clinical-governance decision, not an engineering
defect — a reviewer must decide whether 152/179 clinician-only is the intended
operating point.

---

## 5. Missing-data safety cases

| Source case | Production | Current legacy | Canonical |
|---|:--:|:--:|:--:|
| `F3-MISSING-GENOTYPE-SAFETY-STOP` | ✓ | ✓ | ✓ |
| `F3-FIRST-REPEAT-MISSING-AGE-SAFETY-STOP` | ✓ | ✓ | ✓ |
| `F3-MISSING-SAMPLE-TYPE-SAFETY-STOP` | ✗ | ✗ | ✓ |
| `F3-HPV-NOT-DETECTED-UNKNOWN-IMMUNE-SAFETY-STOP` | ✗ | ✗ | ✓ |
| `F6-MISSING-TREATMENT-DATE-SAFETY-STOP` | ✗ | ✗ | ✓ |
| `F3-CYTOLOGY-PENDING-INCOMPLETE` | ✗ | ✗ | ✗ |
| `F3-INVALID-HPV-REPEAT-ASAP` | ✗ | ✗ | ✓ |
| `F3-UNSUITABLE-HPV-REPEAT-ASAP` | gap | gap | ✓ |

The deployed engine collapses four missing-data states into a terminal
recommendation instead of stopping (`MISSING_DATA_COLLAPSE`, 4 defects). The
canonical engine stops correctly in all but `F3-CYTOLOGY-PENDING-INCOMPLETE`,
where it emits `SAFETY_STOP` while the source expects the distinct
`INCOMPLETE_RESULT` disposition — a presentation-versus-semantics question left
for clinical review.

---

## 6. Longitudinal pathways

| Pathway | Cases | Production OK | Canonical OK |
|---|---:|---:|---:|
| Figure 6 Test of Cure (incl. 6/18-month sequence) | 18 | 10 | 18 |
| Figure 5 post-colposcopy surveillance | 7 | **1** | 6 |
| CIN2 active surveillance | 4 (all gaps) | 0 | 4 |
| AIS follow-up (Figure 7) | 15 | 10 | 14 |
| Hysterectomy / cancer history (Figure 8) | 18 | 9 | 15 |

Five of the 26 legacy defects are `INCOMPLETE_LONGITUDINAL_STATE`. Figure 5 is the
single worst area of the deployed engine, at **1 of 7** source branches correct.

---

## 7. ⚠ Router-level age gates — the operative regression finding

The 179-case corpus calls the figure evaluators directly and never reaches
`evaluateClinicalDecision`. The R1 age-gate safety fix (`ea4e7e3`, 2 July 2026)
lives in that router and is present in **production** but **absent from the
candidate branch**, which forked from `578b4b0` before it landed.

A dedicated router probe (`scripts/comparison/emit-router.ts`, 12 boundary
states) was run against both engines.

**9 of 12 probes differ. Every difference is the candidate being clinically less
safe than production.**

| Probe | Clinical concern | Production `fb933c3` | Candidate `8eed086` |
|---|---|---|---|
| `AGE-U25-HSIL-HPVOTHER` | 23 y with HSIL must not be reassured | `F3-HPV-OTHER-HIGH-GRADE-COLP` · **HIGH** · COLPOSCOPY | `AGE-UNDER-25` · LOW · **no referral** |
| `AGE-U25-AG3` | 23 y glandular AG3 must reach specialist review | `F7-GLANDULAR-COLPOSCOPY` · **HIGH** · COLPOSCOPY | `AGE-UNDER-25` · LOW · **no referral** |
| `AGE-U25-CANCER-SYMPTOMS` | 22 y with cancer symptoms must not be reassured | `F3-HPV-REQUIRED` · MEDIUM | `AGE-UNDER-25` · LOW |
| `AGE-70-HPV-NEG` | 70 y HPV negative exit | `AGE-70-74-HPV-NOT-DETECTED-DISCHARGE` | `AGE-70-74-DEFERRED` |
| `AGE-72-HPV-1618` | 72 y HPV 16/18 must reach colposcopy | `AGE-70-74-HPV-DETECTED-COLP` · **HIGH** · COLPOSCOPY | `AGE-70-74-DEFERRED` · LOW · **no referral** |
| `AGE-72-HPV-OTHER` | 72 y HPV other must reach colposcopy | `AGE-70-74-HPV-DETECTED-COLP` · **HIGH** · COLPOSCOPY | `AGE-70-74-DEFERRED` · LOW · **no referral** |
| `AGE-72-NO-HPV` | 72 y with no HPV result must request information | `AGE-70-74-HPV-REQUIRED` · MEDIUM | `AGE-70-74-DEFERRED` · LOW |
| `AGE-76-AG1` | 76 y glandular AG1 must not be discharged | `F7-GLANDULAR-COLPOSCOPY` · **HIGH** · COLPOSCOPY | `AGE-75-DISCHARGE` · LOW · **no referral** |
| `AGE-76-HPV-1618` | 76 y HPV 16/18 must not be discharged | `F3-1618-COLP` · **HIGH** · COLPOSCOPY | `AGE-75-DISCHARGE` · LOW · **no referral** |

Identical on the 3 remaining probes (`AGE-U25-ASYMPTOMATIC`, `AGE-25-HPV-NEG`,
`AGE-75-ASYMPTOMATIC`) — the states where reassurance is genuinely correct.

### Correct characterisation of this finding

This is **fork-point staleness, not a code change**. The candidate branch
**modified no file under `lib/engine/`** — verified by diffing the merge base
against each branch. The regression exists in the branch *as it stands*, and
would be real if the branch were deployed as-is; it disappears on integration
onto current `main`, because git will take main's engine files unchanged.

**Consequence:** integration onto current `main` is not merely preferable, it is a
**clinical safety requirement**. Any strategy that reconstructs the candidate
without main's engine — a squash, a cherry-pick onto the old base, or a deploy of
the branch tip — would reintroduce a known and already-fixed patient-safety
defect affecting under-25s with high-grade cytology and over-70s with detected
HPV.

Raw evidence: `07-router-age-gate-production.json`,
`07-router-age-gate-candidate.json`.
