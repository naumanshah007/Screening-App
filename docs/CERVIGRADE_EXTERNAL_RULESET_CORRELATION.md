# CerviGrade — External Rule-Set Correlation Report

**Input:** an external decision-rule extraction ("OpenAI 5.5 deep search") of the June 2023 v1.1 guideline figures (F1–F10 + Table 1), plus references to a **February 2026 official addendum**.
**Task:** correlate that extraction against what our product **actually implements** in `lib/engine/decision-engine.ts` / `lib/engine/types.ts`, and report what we already did vs. gaps.
**Date:** 2026-07-01. **No code changed — report only.**
**Method:** every "implemented / partial / missing" verdict below was checked against current engine code (file:line cited). Where the external doc cites external URLs I could not open, I treat its guideline claims as the assertion to correlate against, not as independently re-verified fact.

---

## 1. Verdict

Our engine is **strongly aligned** with the external figure-level extraction for the **June 2023 v1.1 baseline** — the branch structure, escalation triggers, and safety-stop posture match closely, and Table 1's 21 rows are all covered by our history×pathology matrix. The correlation surfaces **six substantive gaps**, of which the most important is entirely new to our prior audit:

- **NEW — the February 2026 addendum is not implemented at all**, and today's date (2026-07-01) is *after* its stated "implement immediately / supersedes" effective date (2026-02-02). This is now a currency gap, not just a future item.
- **NEW — Test of Cure 6-month/18-month checkpoints are not enforced** (we use generic 12-month repeats + stage flags; `treatmentDate` only warns).
- **NEW — cancer-survivor / cancer hysterectomy-indication exclusion is not modelled** (no `CANCER` indication; no F8/Table-1 exclusion).
- **NEW — postmenopausal bleeding pattern is not a captured type** (`BleedingType` lacks `POSTMENOPAUSAL`).
- **Possible timing discrepancy — Figure 5 deferred ASC-H initial repeat**: external says 6 months; our code uses 12 months.
- **Minor — AIS cytology is not in Figure 7's colposcopy-entry list** (routed to colposcopy via Figure 3 high-grade instead).

The correlation also **re-confirms the two live safety findings from our earlier audit**: age-gate ordering (R1) and unsatisfactory/invalid/unsuitable sample handling (R4). The external extraction does **not** cover DES or under-25-specific screening (they are outside this figure set), so our DES gap (R2) is neither confirmed nor refuted by this document.

---

## 2. Figure-by-figure correlation

| External family | Core determinant (external) | Our implementation | Code | Status |
|---|---|---|---|---|
| **F1** transition, resolved/low-risk | invite now / next visit → Fig 3 | `evaluateFigure1`: never/under/overdue→invite now; regular+ok history/ToC→next visit; blocks on unknown | `decision-engine.ts:137–185` | ✅ **Match** |
| **F2** transition, unresolved high-grade/glandular | colposcopy outstanding / complete ToC / specialist gynae / →Fig 3; AG endometrial >3y or discharged→Fig 3 | `evaluateFigure2`: F2-R1..R6 all represented incl. AIS→R2.08/Table1, AG2 age/discharge/returned branches | `:188–337` | ✅ **Match** |
| **F3** primary HPV | HPV type + cytology + **age 50** + immune deficiency; not-detected 5y/3y-IC; 16/18→colp; Other→12m repeat/≥50 colp/2nd-repeat | `evaluateFigure3`: F3-R1..R12 all present incl. swab-return, ≥50 branch, 2nd-repeat-any→colp | `:339–511` | ✅ **Match** (except unsatisfactory — see §3) |
| **F4** post-colposcopy low-grade | repeat HPV 12m; not-detected→regular; 16/18→colp; Other+≥ASC-H→colp; Other+low+IC→colp; else 12m; 2nd→colp | `evaluateFigure4`: F4-R1..R9 all present incl. IC branch | `:513–627` | ✅ **Match** |
| **F5** normal colp + ≥ASC-H (MDM) | MDM downgrade LSIL / upgrade HSIL / confirm ASC-H; deferred-treatment follow-up; **initial repeat 6 months** | `evaluateFigure5`: downgrade/upgrade/confirm + deferred branches present; **repeat uses 12 months** | `:629–731` | ⚠️ **Partial** (timing — §3) |
| **F6** Test of Cure (HSIL) | co-test at **6 and 18 months**; two consecutive negatives→regular; HPV-detected/high-grade→colp | `evaluateFigure6`: first/second/continuing stages, escalation branches present; **no explicit 6mo/18mo timing**, `treatmentDate` warned only | `:733–871` | ⚠️ **Partial** (timing — §3) |
| **F7** glandular | AG2/AC2→gynae; AG1/AG3-5/AC1/AC3/AC4/**AIS**→colp; lesion→biopsy→AIS/cancer; no-lesion→MDM | `evaluateFigure7`: AG2/AC2→gynae, others→colp, biopsy/type-3/oncology/MDM present; **AIS not in colp-entry list** | `:873–1031` | ✅ **Match** (minor AIS routing — §3) |
| **F8 + Table 1** post-total-hysterectomy | history×indication×specimen×excision matrix (21 rows) | `evaluateHysterectomyPathway`: 6 history categories × pathology cover **all 21 T1 rows**; subtotal→Fig3; blocks on missing history/specimen/excision | `:1136–1300` | ✅ **Match** (except cancer exclusion — §3) |
| **F9** pregnancy high-grade | colp; MDM downgrade/confirm; abnormal-TZ; invasion→biopsy→oncology; mandatory review | `evaluateFigure9`: F9-R1..R8 all present incl. invasion→biopsy→oncology, MDM | `:1306–1455` | ✅ **Match** (no 2-week SLA / oestrogen note — minor) |
| **F10** abnormal bleeding | cancer-sx→urgent; workup; abnormal cervix→colp; STI/OCP; 6–8wk review; **postmenopausal→refer without waiting** | `evaluateFigure10`: cancer-symptom exception, workup, abnormal-cervix, OCP/STI, 6–8wk review present; **no `POSTMENOPAUSAL` bleeding type** | `:1457–1631` | ✅ **Match** (postmenopausal gap — §3) |

**Table 1 row-level mapping (all covered):** T1-R1..R4 → `NEGATIVE_OR_NORMAL / LOW_GRADE_RETURNED / LOW_GRADE_ONLY` (`:1192–1214`); T1-R5..R8 → `LOW_GRADE_NOT_RETURNED_TO_REGULAR` (`:1236–1254`); T1-R9..R12 → `HIGH_GRADE_TOC_COMPLETE` (`:1216–1234`); T1-R13..R15 → `HSIL_AIS_UNTREATED_OR_INCOMPLETELY_TREATED` (`:1256–1266`); T1-R16..R18 → `HIGH_GRADE_TOC_INCOMPLETE` (`:1268–1278`); T1-R19..R21 → `NO_KNOWN_SCREENING_HISTORY` (`:1280–1297`). Excision-complete→ToC, incomplete→colposcopy handled in `hysterectomyHighGradeOutcome` (`:1045–1080`). **This is a genuine strength.**

---

## 3. Gaps surfaced by this correlation

### G1 — February 2026 addendum not implemented (NEW; now a currency gap) — HIGH
The external doc reports an official addendum (effective 2026-02-02, "implement immediately… supersedes") with four in-scope changes. **None are in our engine** (`grep` for `addendum/2026/clear margin/cancer survivor/18 month` in `lib/engine` → no hits). Because today is 2026-07-01, these are *current* official rules, not future ones:
1. **Type 3 TZ + HPV+ + low-grade cytology + normal colposcopy → MDM cytological review no longer required.** Our Figure 4/5 still route this context through MDM (`evaluateFigure5` `:632–644`). Over-cautious, not unsafe, but out of date.
2. **Under-50 + positive excision margins after HSIL treatment → Test of Cure in primary/community care** (not mandatory colposcopy). Our `hysterectomyHighGradeOutcome` sends *incomplete excision* → colposcopy unconditionally (`:1058–1073`); Figure 6 does not branch on age/margins.
3. **HPV-detected AIS with clear margins → primary/community co-test at 6 and 18 months** (not colposcopy-first). Not represented.
4. **Cervical/vaginal cancer survivors generally outside NCSP** (except stage 1a1). Not represented (see G3).

> Caveat: the product was scoped to *June 2023 v1.1*. Implementing the addendum is a **scope decision**, but it should be an explicit, documented one — the product currently makes no statement that it predates the addendum.

### G2 — Test of Cure 6-month / 18-month checkpoints not enforced (NEW) — MEDIUM
External F6 is explicit: co-test at **6 months** post-treatment, then **18 months**. Our Figure 6 uses generic `recallIntervalMonths: 12` with `testOfCureStage` flags and only **warns** on missing `treatmentDate` (`:738,769,793`). The *spacing* between first and second co-test is right (12 months), but the **6-month initial timing is not derived from `treatmentDate`** and completion is not tied to dated checkpoints. Partial.

### G3 — Cancer hysterectomy-indication / cancer-survivor exclusion not modelled (NEW) — MEDIUM
`HysterectomyIndication = "BENIGN_GYNAECOLOGICAL_DISEASE" | "HSIL_CIN23_OR_AIS"` (`types.ts:97`) — there is **no `CANCER` value**, and `evaluateHysterectomyPathway` has no exclusion for cervical/vaginal cancer survivors (external F8-R8 + addendum item 4). A cancer-survivor case would be run through the ordinary Table 1 matrix. Add an exclusion → specialist/clinician-review.

### G4 — Postmenopausal bleeding not a captured pattern (NEW) — MEDIUM
External F10 stresses postmenopausal bleeding → **refer without waiting for co-test**. Our `BleedingType = INTER_MENSTRUAL | POST_COITAL | BOTH | UNSPECIFIED` (`types.ts:108`) has no `POSTMENOPAUSAL`, and Figure 10 has no dedicated postmenopausal branch. The cancer-symptom exception (`:1458–1473`) catches it only if `hasCancerSymptoms` is set. Add the type + urgent-referral branch.

### G5 — Figure 5 deferred ASC-H initial repeat timing (NEW; verify) — LOW/UNCERTAIN
External F5-R4 says the initial deferred-treatment repeat is at **6 months**; our confirmed-ASC-H follow-up uses **12 months** (`F5-CONFIRMED-ASCH-HPV-DETECTED-NORMAL-NEG-12M`, `:700–703`). The external doc itself flags this as an ambiguous point in the source PDF. **Verify against the guideline text before changing** — do not assume our value is wrong.

### G6 — AIS cytology not in Figure 7 colposcopy-entry list (NEW; minor) — LOW
External F7-R2 lists **AIS** in the colposcopy group. Our `supportedColposcopyEntry = ["AG1","AG3","AG4","AG5","AC1","AC3","AC4"]` excludes AIS (`:893`); AIS cytology instead reaches colposcopy via Figure 3's high-grade branch (`isHighGradeCytology` includes AIS, `:84`). End result (colposcopy) is equivalent, but if a case is force-routed into Figure 7 with `AIS` it would skip the explicit glandular colposcopy entry. Cosmetic/robustness only.

---

## 4. Prior-audit findings re-confirmed by this correlation

- **R1 — age-gate ordering (CRITICAL).** External emphasises age cut-points 25/50/70/74 as "load-bearing" and that **HPV 16/18 and high-grade always override**. Our age gates still short-circuit before high-grade/glandular routing and the 70–74 gate ignores HPV result (`:1653–1687`). Fix plan already documented in `docs/CERVIGRADE_R1_R3_FIX_PLAN.md`.
- **R4 — invalid / unsuitable / unsatisfactory (MED-HIGH).** External §14 makes these explicit cross-cutting safety stops: invalid/unsuitable HPV → repeat; unsatisfactory cytology → repeat 6wk–3mo; **HPV 16/18 + unsatisfactory → still colposcopy** (we do — 16/18 routes to colp regardless, `:408`); **HPV Other + two consecutive unsatisfactory → colposcopy** (we do **not** — `unsatisfactoryCytologyCount` is never read; HPV-Other+unsatisfactory falls to `F3-UNMAPPED` clinician review, `:459,510`). Confirms our gap.

**Out of scope of this external doc:** DES exposure (R2) and under-25-specific screening are not part of these figures, so this correlation neither adds to nor removes our existing DES finding.

---

## 5. What we already did well (confirmed against the external extraction)

- All **10 figures + Table 1** exist as discrete, tested engine functions; branch coverage matches the external extraction almost 1:1 for the June 2023 baseline.
- **Table 1's 21 rows are fully covered** by our history×pathology matrix — the external doc's "single most useful deterministic source" is our strongest area.
- **Safety-stop posture matches the external "missing-data matrix" (§16):** missing HPV, missing cytology-when-required, missing hysterectomy type/specimen/excision, missing pregnancy status all block via `insufficient()` rather than defaulting to routine recall (`:26–47`, `:343`, `:1179–1187`).
- **Automation-suitability matches the external §18:** specialist branches (F5, most of F7, F9) correctly emit `CLINICIAN_REVIEW_REQUIRED` / `requiresMDMReview` and never auto-close (`clinicianReview()` `:49–69`).
- **Escalation triggers align:** HPV 16/18→colposcopy, possible/definite high-grade→colposcopy, glandular→specialist, invasion→oncology all present.

---

## 6. Recommended additions (prioritised, not yet implemented)

| # | Item | Gap | Effort | Priority |
|---|---|---|---|---|
| 1 | Decide + document guideline currency: implement Feb-2026 addendum items, or explicitly state the product targets June 2023 v1.1 | G1 | Med–High | **High** |
| 2 | Fix age-gate ordering (already planned) | R1 | Low | **High** |
| 3 | Unsatisfactory-cytology branch + wire `unsatisfactoryCytologyCount`; split invalid vs unsuitable HPV | R4 | Med | **High** |
| 4 | Add `CANCER` hysterectomy indication + cancer-survivor exclusion (→ specialist review) | G3 | Low | Medium |
| 5 | Add `POSTMENOPAUSAL` bleeding type + urgent-referral branch in Figure 10 | G4 | Low | Medium |
| 6 | Enforce Test-of-Cure 6mo/18mo checkpoints from `treatmentDate` (block, not warn) | G2 | Med | Medium |
| 7 | Verify Figure 5 deferred ASC-H repeat 6mo vs our 12mo against guideline text | G5 | Low | Low (verify first) |
| 8 | Add `AIS` to Figure 7 colposcopy-entry list for robustness | G6 | Trivial | Low |

---

### Correlation coverage summary

| Bucket | Count |
|---|---|
| Figure families matching our implementation (June 2023 baseline) | F1, F2, F3, F4, F7, F8, F9, F10, Table 1 |
| Partial (timing/detail) | F5, F6 |
| New gaps this extraction surfaced | G1 (addendum), G2 (ToC timing), G3 (cancer exclusion), G4 (postmenopausal), G5 (F5 timing — verify), G6 (AIS list) |
| Prior findings re-confirmed | R1 (age gates), R4 (unsatisfactory/invalid/unsuitable) |
| Not covered by this extraction | DES (R2), under-25-specific screening |
