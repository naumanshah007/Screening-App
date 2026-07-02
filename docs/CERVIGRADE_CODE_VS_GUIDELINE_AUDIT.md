# CerviGrade — Code vs Guideline Implementation Audit

**Product:** CerviGrade / Cervical Referral Grading Tool
**Guideline baseline:** *Clinical Practice Guidelines for Cervical Screening in Aotearoa New Zealand, June 2023, final v1.1*
**Audit type:** Strict code-vs-specification audit (no product changes made — this file is the only addition)
**Audit date:** 2026-07-01
**Auditor role:** Guideline implementation auditor / code reviewer / product-safety reviewer / QA architect
**Repo state at audit:** branch `main`, working tree clean, 348 tracked files, Next.js 16 / React 19 / Prisma 7 / SQLite (dev).

> **Scope note / honesty statement.** This audit is based on reading the source (engine, types, wizard, batch, schema, tests) and running the test/lint/typecheck/prisma commands that actually exist. Where I could not verify a claim from code I have written **UNCERTAIN** and named the file I could not fully confirm. I have **not** re-derived the guideline itself; the "expected" column is taken from the specification supplied in the audit brief, which the product team asserts reflects the June 2023 guideline.

---

## 1. Executive verdict

**Overall status: BUYER-DEMO-SAFE WITH LIMITATIONS. NOT PILOT-READY. Pilot-ready only after the Phase B/C fixes below.**

This is a far more complete implementation than a typical demo. All ten guideline figures **and** Table 1 exist as real, individually-tested engine functions (`lib/engine/decision-engine.ts`, 1,742 lines; 104 engine tests + 181 batch tests all green). The engine follows the correct safety posture in most branches: it returns `INSUFFICIENT_INFORMATION` / `CLINICIAN_REVIEW_REQUIRED` rather than silently defaulting to routine recall, it carries `branchPath` / `guidelineReference` / `rationale` for audit, and the batch UI enforces "provisional / reviewer confirmation / not for direct clinical action" wording via an automated test.

But it is **not** the finished, single, coherent guideline product it appears to be, and several branches are genuinely unsafe as written. The most important structural facts a buyer must understand:

- **There are two separate rule engines.** The guideline engine (Figures 1–10) powers the **pathway wizard** and the **batch** surface. The **case Review Queue "grade" page uses a *different* engine** (`lib/cases/rule-evaluator.ts` + `lib/cases/grading.ts`, a booking/triage service-line engine whose rulesets appear unpopulated). The core "Command Centre → Review Queue → grade a case" flow does **not** run the Figures 1–10 logic.
- **The age-eligibility gate is over-simplified and can reassure unsafe cases** (see risk register R1).
- **DES exposure is entirely absent** — no field, no branch, nowhere (risk R2).
- **The primary nurse wizard captures no age at all**, so age eligibility (25/69/70/74/75) is never enforced on that surface.

### Top 10 findings

1. **Age gate ordering is unsafe (CRITICAL).** In `evaluateClinicalDecision` the age gates (`<25`, `70–74`, `75+`) run *before* Figure 2 / Figure 6 / Figure 7 cytology routing. A non-bleeding under-25 with HSIL/glandular cytology gets `AGE-UNDER-25` "routine screening does not apply", **risk LOW, no clinician-review flag**. A 70–74 participant with HPV 16/18 gets `AGE-70-74-DEFERRED` "offer final HPV screen" and is **never routed to colposcopy** (guideline requires colposcopy for 70–74 HPV-detected). `decision-engine.ts:1653–1687`.
2. **DES exposure not modelled anywhere** — schema, batch types, wizard, engine all lack it. A DES-exposed participant silently follows the routine pathway. (R2)
3. **Two-engine bifurcation.** The Review Queue grade page runs the booking-triage engine, not the guideline engine; guideline recommendations only surface in the wizard + batch. Buyer must not be shown the grade page as "the guideline engine".
4. **Unsatisfactory cytology has no dedicated pathway.** The type and a counter exist but the engine never reads the counter; HPV-Other + unsatisfactory falls through to a generic `F3-UNMAPPED` clinician-review rather than the specified "repeat LBC in 3 months / track consecutive unsatisfactory". `decision-engine.ts:432–510`.
5. **Pregnancy is not a global hard-stop.** Figure 9 only triggers when cytology is high-grade/glandular. A pregnant participant with HPV-detected + negative/low-grade cytology flows into routine Figure 3/4 with no mandatory-review flag. `decision-engine.ts:1642`.
6. **Invalid vs unsuitable-for-analysis HPV collapsed** into one `INADEQUATE` bucket (repeat 3 months). Guideline distinguishes them; leakage/unsuitable handling is not separately represented.
7. **"patient" used pervasively where the guideline wants "participant"** — wizard, engine output strings ("Patient is under 25 years old"), microcopy, schema. Batch surfaces are clean (test-enforced) but the wizard/pathway UI and engine strings are not.
8. **`npm test` silently excludes the batch tests.** The `test` script globs only `lib/engine/__tests__/*.test.ts`; the 181 batch tests (including the safety-wording guard) never run in the default command. The audit-brief scripts (`test:all`, `test:engine`, `test:batch`, `demo:reset`) do not exist.
9. **5 lint errors** in batch/marketing UI components (React hooks `set-state-in-effect`, refs-during-render, memoization, unescaped entity). Typecheck is clean.
10. **Wizard captures no age**, so age eligibility is unenforced on the primary clinician surface; and several "no visible lesion / MDM" specialist branches correctly stop for review but their **demo data does not exercise them** (seed has essentially one special-pathway example).

### Highest patient-safety risks

- **R1 — Inappropriate reassurance / missed colposcopy at age boundaries** (CRITICAL). Under-25 high-grade and 70–74 HPV-detected are reassured, not escalated.
- **R2 — DES exposure invisible** (HIGH): no capture, no branch, no missing-data stop.
- **R3 — Pregnancy not a mandatory-review hard stop for non-high-grade cytology** (HIGH).
- **R4 — Unsatisfactory / invalid / unsuitable sample handling incomplete** (MEDIUM-HIGH): the exact repeat-timing and consecutive-failure safety nets are not enforced.
- **R5 — Governance illusion**: a reviewer could believe the grade-page recommendation is guideline-derived when it is the (largely empty) booking engine (HIGH for pilot).

---

## 2. Codebase map

| Area | Files |
|---|---|
| **Guideline rule engine** | `lib/engine/decision-engine.ts` (Figures 1–10 + Table 1 + router `evaluateClinicalDecision`), `lib/engine/types.ts` (all clinical enums + `ClinicalInput`/`ClinicalDecision`) |
| **Booking/triage engine (separate)** | `lib/cases/rule-evaluator.ts`, `lib/cases/grading.ts`, `lib/cases/rule-policy.ts`, `lib/cases/rule-regression.ts`, `lib/cases/rule-releases.ts`, `lib/cases/concordance.ts` |
| **Pathway wizard** | `lib/wizard/steps.ts` (1,150 lines, step defs + `answers → ClinicalInput` mapping ~L1043–1150), `lib/wizard/autofill.ts` |
| **Decision-tree visual metadata** | `lib/decision-trees/index.ts` |
| **Batch surface** | `lib/batch/processor.ts` (maps `CanonicalBatchCase → ClinicalInput`, calls engine), `lib/batch/validation.ts`, `lib/batch/adapters/*`, `lib/batch/demo-dataset.ts`, `lib/batch/demo-dataset-messy.ts`, `lib/batch/template-columns.ts`, `lib/batch/guideline-citations.ts`, `lib/batch/integration-types.ts` |
| **Schema / models** | `prisma/schema.prisma` (993 lines), `prisma/seed.ts` (1,094 lines), `lib/database/current-schema.sql`, 3 migrations |
| **API / actions** | `app/api/sessions/route.ts` (wizard→engine), `app/api/rules/evaluate/route.ts`, `app/api/batch/process/route.ts`, `app/api/cases/[id]/rules/evaluate/route.ts` (booking engine), `app/api/cases/[id]/decision/route.ts`, `app/api/audit/route.ts` + `app/api/audit/export/route.ts` |
| **UI workflow** | `app/(app)/dashboard`, `/coordinator`, `/gp`, `/cases`, `/cases/[id]/grade`, `/cases/[id]/triage`, `/batch`, `/audit`, `/analytics`, `/pathway`, `/readiness`, `/rules` |
| **Safety / governance UI** | `components/cases/ClinicalValidationBanner.tsx`, `RecommendationSafetyPanel.tsx`, `WorkflowGovernancePanel.tsx`, `components/batch/BatchEngineTrustPanel.tsx`, `BatchValidationPreview.tsx`, `BatchResultDetail.tsx`, `IntegrationReadinessPanel.tsx` |
| **Audit / security** | `lib/security/events.ts` (`auditLog.create`), `lib/security/incidents.ts`, `lib/security/analytics.ts`, `lib/auth/*` (RBAC, 2FA, password policy) |
| **Tests** | `lib/engine/__tests__/figure1..10.test.ts`, `table1.test.ts`, `routing-precedence.test.ts`, `wizard-flow.test.ts`, `wizard-integration.test.ts`, `visual-labels.test.ts`; `lib/batch/__tests__/*` (validation, adapters, processor, safety-wording, selection-state, manual-cases) |
| **Docs** | `docs/clinical-parity-matrix.md`, `docs/decision-tree-parity-audit.md`, `docs/implemented-cervical-screening-decision-tree.md`, `docs/production-readiness-gap-analysis.md`, and this file |

**Engine wiring (verified):** `evaluateClinicalDecision` is imported by `lib/batch/processor.ts:11`, `app/api/sessions/route.ts:4`, `app/api/rules/evaluate/route.ts:3`. The case grade route (`app/api/cases/[id]/rules/evaluate/route.ts:5`) imports `generateRuleDecision` from `lib/cases/grading.ts`, which uses the **booking** engine — **not** the guideline engine.

---

## 3. Implemented pathway coverage matrix

| Pathway / figure | Expected behaviour | Current code behaviour | Location | Status | Severity | Required fix | Test gap |
|---|---|---|---|---|---|---|---|
| **Router / pathway classification** | Classify before HPV logic; symptoms & pregnancy first | Bleeding→Pregnancy(qualifying cytology only)→Table1→Hyst→**Age gates**→Fig2→Fig1→transition→ToC→Fig7→Fig5→Fig4→Fig3 | `decision-engine.ts:1637–1728` | **Partial / unsafe** | **Critical** | Move age gates *after* symptomatic/high-grade/glandular routing; make pregnancy a global review flag | `routing-precedence.test.ts` covers bleeding<25 only; no under-25-high-grade, no 70–74-HPV+ test |
| **Fig 1 — transition (normal/low-grade)** | never/under/overdue→invite now; regular→next visit; then Fig 3 | Implemented, blocks on unknown status via `insufficient` | `evaluateFigure1` `137–185` | **Complete** | Low | — | 3 tests; adequate |
| **Fig 2 — transition (prior high-grade/glandular/AIS/AG2)** | Colp if referral outstanding; else ToC; AIS→R2.08; AG2 rules | Implemented incl. AG2 age/discharge branches, AIS→Table1 if post-hyst else R2.08 review | `evaluateFigure2` `188–337` | **Complete** | Low | Confirm R2.08 service mapping | 6 tests |
| **Fig 3 — primary HPV screening** | not-detected 5y/3y IC; 16/18→colp; Other→cytology→repeat logic; ≥50 branch; 2nd repeat | Implemented incl. swab-return, ≥50 branch, second-repeat; **UNSATISFACTORY cytology unmapped**; **IC not escalated at baseline** | `evaluateFigure3` `339–511` | **Partial** | High | Add unsatisfactory-cytology branch; confirm IC handling at baseline | 7 tests; no unsatisfactory / no swab-Other-negative repeat test |
| **Fig 4 — normal colposcopy, low-grade cytology** | repeat HPV 12m; IC→colp; 2nd repeat any→colp | Implemented incl. IC branch | `evaluateFigure4` `513–627` | **Complete** | Low | — | 6 tests |
| **Fig 5 — normal colposcopy, ≥ASC-H (MDM)** | MDM required; downgrade/upgrade/treat/repeat/ToC | Implemented; MDM-gated; specialist review preserved | `evaluateFigure5` `629–731` | **Complete (specialist)** | Medium | Keep mandatory review; do not automate treatment | 6 tests |
| **Fig 6 — Test of Cure** | 6-mo co-test; two negatives→regular; abnormal→colp; continue ToC | Implemented incl. first/second/continuing stages; treatmentDate flagged as missing but not blocking | `evaluateFigure6` `733–871` | **Complete** | Medium | Consider blocking when `treatmentDate` absent (currently only warns) | 8 tests |
| **Fig 7 — glandular abnormalities** | AG2/AC2→gynae; others→colp; lesion→biopsy→AIS/cancer; no lesion→MDM | Implemented incl. biopsy, type-3 excision, oncology, MDM outcomes | `evaluateFigure7` `873–1031` | **Complete (specialist)** | Medium | Keep mandatory review | 5 tests |
| **Fig 8 / Table 1 — post total hysterectomy** | Capture total/subtotal, indication, specimen pathology, history, excision; combinations | Implemented; subtotal→Fig3; blocks on missing history/specimen | `evaluateHysterectomyPathway` `1136–1300` | **Complete** | Medium | — | Fig8=5, Table1=7 |
| **Fig 9 — pregnancy** | high-grade/glandular→colp; MDM; invasion→biopsy→oncology; mandatory review | Implemented for qualifying cytology; **does not trigger for non-high-grade cytology** | `evaluateFigure9` `1306–1455` | **Partial** | High | Make pregnancy a review flag even when cytology low/negative | 8 tests (all qualifying-cytology) |
| **Fig 10 — abnormal bleeding** | cancer sx→urgent; workup; abnormal cervix→colp; STI/OCP; 6–8wk review | Implemented incl. cancer-symptom exception first | `evaluateFigure10` `1457–1631` | **Complete** | Medium | Confirm postmenopausal bleeding routed as urgent | 5 tests |
| **Invalid HPV** | repeat timing; no reassurance | Mapped to `INADEQUATE`→repeat 3m | `decision-engine.ts:375–388` | **Partial** | Medium | Split invalid vs unsuitable | none specific |
| **Unsuitable-for-analysis (leakage)** | separate repeat + warning | Not represented (folds into INADEQUATE) | — | **Missing** | Medium | Add sample-integrity field + branch | none |
| **DES exposure** | separate handling + clinician review; block if unknown & relevant | Absent everywhere | — | **Missing** | High | Add field, missing-data stop, review branch | none |
| **Under-25 symptomatic** | do not reassure; escalate | Only escalates if bleeding/cancer-symptom flag set; high-grade cytology alone reassured | `decision-engine.ts:1654–1663` | **Partial / unsafe** | High | Route symptoms/high-grade before age gate | none |
| **Age 70–74 exit HPV** | HPV-detected→colposcopy; not-detected→discharge | Generic "offer final HPV screen"; HPV-detected not routed to colposcopy | `decision-engine.ts:1676–1686` | **Partial / unsafe** | High | Branch on HPV result within 70–74 gate | none |
| **Immune deficiency** | required field; 3y interval; escalate HPV-detected | Required boolean; 3y interval in Fig3/4/6; Fig4 IC→colp; under-25 long-term IC not modelled | `types.ts:141`, `returnToScreening` `113–134` | **Partial** | Medium | Model under-25 IC review | covered in Fig3/4 tests |
| **Discordant colp/cytology/histology** | specialist MDT review support only | Fig5 MDM + Fig7 MDM cover key discordance; no dedicated concordance-to-engine link | `evaluateFigure5/7`; `lib/cases/concordance.ts` | **Partial** | Medium | Wire concordance into review flags | none in engine |

---

## 4. Rule-engine audit matrix (representative rules)

| Rule ID | Input conditions | Expected | Current | Urgency | Referral | Interval | Review req? | Missing-data behaviour | Status | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|
| `F3-HPV-NOT-DETECTED-5Y` | HPV not detected, not IC | recall 5y | recall 60m | LOW | — | 60m | no | n/a | ✅ | `decision-engine.ts:366–373,113–134` |
| `F3-HPV-NOT-DETECTED-IC-3Y` | HPV not detected, IC | recall 3y | recall 36m | LOW | — | 36m | no | n/a | ✅ | `:119,366` |
| `F3-1618-COLP` | HPV 16/18 | colposcopy | colposcopy P2 (P1 if high-grade cytology) | HIGH/URGENT | COLPOSCOPY | — | provisional | warns if no cytology | ✅ | `:408–430` |
| `F3-HPV-OTHER-*` | HPV Other + cytology | cytology-driven repeat/colp; ≥50 branch | implemented incl. swab-return, ≥50, 2nd repeat | MED/HIGH | conditional | 12m | provisional | blocks if cytology missing (`F3-HPV-OTHER-CYTOLOGY-REQUIRED`) | ✅ | `:432–508` |
| `F3` + `UNSATISFACTORY` cytology | HPV Other + unsatisfactory | repeat LBC 3m; track consecutive | **falls to `F3-UNMAPPED-COMBINATION` clinician review** | HIGH | — | — | yes | not the specified branch | ⚠️ Partial | `:459,510` |
| `AGE-UNDER-25` | age<25, no bleeding flag | if symptomatic/high-grade escalate | "routine screening does not apply" | **LOW** | — | — | **no** | reassures even with HSIL cytology | ❌ Unsafe | `:1654–1663` |
| `AGE-70-74-DEFERRED` | age 70–74 | HPV-detected→colposcopy | "offer final HPV screen", no colp | **LOW** | — | — | no | ignores HPV result | ❌ Unsafe | `:1676–1686` |
| `AGE-75-DISCHARGE` | age≥75 | discharge asymptomatic; but not glandular | "discharge"; fires before Fig7 | LOW | — | — | no | glandular cytology missed | ⚠️ Unsafe | `:1665–1675` |
| `F6-*` Test of Cure | HPV+cytology co-test | two-negative→regular; abnormal→colp | implemented; `treatmentDate` only warned | LOW–HIGH | conditional | 12m | provisional | warns (not blocks) on missing treatmentDate | ⚠️ | `:733–871` |
| `F7-AG2/AC2-GYNAECOLOGY` | AG2/AC2 | gynaecology (not colp) | gynaecology P1 | HIGH | GYNAECOLOGY | — | provisional | n/a | ✅ | `:876–891` |
| `F8/T1-*-EXCISION-UNKNOWN-REVIEW` | high-grade specimen, excision unknown | block | `insufficient` | MED | — | — | yes | ✅ blocks | ✅ | `:1074–1079` |
| `insufficient()` generic | any required fact missing | never default to routine | returns MEDIUM + missingInformation | MED | — | — | yes | ✅ no silent recall | ✅ | `:26–47` |
| DES-exposed | any | separate handling | **no rule exists** | — | — | — | — | silently routine | ❌ Missing | — |

**Positive engine-safety observations:** `insufficient()` (`:26–47`) and `clinicianReview()` (`:49–69`) never emit a routine recall interval; missing HPV, missing cytology-when-required, missing hysterectomy history/specimen, and unknown excision all block. `branchPath`, `guidelineReference`, `rationale`, `validationStatus` are attached to every decision, which is exactly what an audit trail needs. Ethnicity (`ethnicityPrimary`) is present on the input but is **not read by any decision branch** — correct: no biological/ethnic decisioning.

---

## 5. Required data-model gap analysis (selected high-value fields)

| Field | Required for | Present? | Where | UI captured? | Demo populated? | Tested? | Missingness behaviour | Risk if absent | Fix |
|---|---|---|---|---|---|---|---|---|---|
| `patientAge` | age gates, Fig3 ≥50 | Yes (input) | `types.ts:114`, batch `processor.ts:36` | **No in wizard** | Yes (batch) | routing-precedence only | age gate skipped when undefined | eligibility unenforced on wizard | Add age/DOB step to wizard |
| `dateOfBirth` | derive age | Yes | `schema.prisma:416` | patient forms | yes | — | — | — | wire to engine age |
| `ethnicityPrimary` | equity monitoring only | Yes | `schema.prisma:435`, `types.ts:116` | yes | yes | — | not used in logic (correct) | none | keep monitoring-only |
| `immunocompromised` | 3y interval, escalation | Yes (**required bool**) | `types.ts:141`, `MedicalHistory` `:678` | wizard step | partial | Fig3/4 | defaults false | under-recall | keep; add IC category |
| `hiv` | IC category | Yes | `MedicalHistory:679` | — | — | — | — | — | surface to engine |
| DES exposure | DES pathway | **No** | — | No | No | No | none | routine misapplied | **Add field + branch + stop** |
| `isPregnant` / postpartum | Fig 9 | Yes | `types.ts:162`, batch `:77` | wizard | one case | Fig9 | undefined→routine | missed review | pregnancy global review flag |
| hysterectomy type/indication/specimen/excision | Fig8/Table1 | Yes (all) | `types.ts:97–104,133–139`; schema `:430–432` | wizard | partial | Fig8/T1 | blocks | unsafe recall | keep; enrich demo |
| sample integrity (leakage/unsuitable) | invalid/unsuitable HPV | **No distinct field** | INADEQUATE only | No | No | No | folds to 3m repeat | wrong repeat | add `sampleIntegrity` |
| `unsatisfactoryCytologyCount` | consecutive-unsat safety | Yes (field) | `types.ts:156`, schema `:704` | batch | 0 | validation only | **engine never reads it** | ignored escalation | wire counter into Fig3 |
| `treatmentDate` | Fig6 timing | Yes | `types.ts:159` | wizard | — | — | warns not blocks | ToC timing wrong | block when required |
| reviewer decision / notes | governance | Yes | `ClinicianDecision` `:618` | grade UI | — | — | — | — | ensure required to complete |
| audit event | audit trail | Yes | `AuditLog` + `security/events.ts:44` | audit page | yes | — | — | — | add rule-citation payload |
| export payload (simulated) | write-back preview | Partial/UNCERTAIN | `IntegrationReadinessPanel`, `audit/export` | batch | — | — | — | overclaim risk | verify "simulated" label |

---

## 6. Missing-pathway ranking

**Blocker before buyer demo**
- (none strictly block a *demo* — but the two-engine split and age-gate reassurance must be verbally disclaimed or the affected surfaces hidden).

**Blocker before clinical pilot**
- **Age-gate over-simplification** (under-25 high-grade; 70–74 HPV-detected; 75+ glandular) — R1.
- **DES exposure** capture + branch — R2.
- **Pregnancy as mandatory review** for non-high-grade cytology — R3.
- **Unsatisfactory / invalid / unsuitable** sample handling — R4.
- **Two-engine reconciliation**: the Review Queue grade page must run guideline logic (or be clearly labelled as booking triage only) — R5.
- **Under-25 symptomatic** escalation independent of the bleeding flag.

**Important Phase 2/3**
- Immune-deficient under-25 special review; postmenopausal-over-70 vaginal-oestrogen practice point; consecutive-unsatisfactory tracking; discordant colp/cytology/histology wired into engine review flags.

**Specialist module later**
- Full Figure 5 / Figure 7 / Figure 9 treatment-decision support (keep as provisional + mandatory MDT review — do **not** automate).

---

## 7. Safety risk register

| ID | Risk | Severity | Where | Potential harm | Trigger case | Current mitigation | Required mitigation | Test required |
|---|---|---|---|---|---|---|---|---|
| R1 | Inappropriate reassurance / missed urgent referral at age boundaries | **Critical** | `decision-engine.ts:1653–1687` | Delayed cancer investigation | 23yo HSIL no-bleeding; 72yo HPV 16/18; 76yo AG1 | none — returns LOW risk | age gate AFTER symptom/high-grade/glandular routing; 70–74 HPV+→colp; force review | golden tests for each |
| R2 | DES exposure invisible | **High** | absent | Under-surveillance of DES-exposed | any DES participant | none | add field + missing-data stop + review branch | DES routing test |
| R3 | Pregnancy not a hard stop for low/neg cytology | **High** | `:1642` | Missed pregnancy-specific review | pregnant, HPV-Other, LSIL | Fig9 only for high-grade | pregnancy review flag globally | test pregnant+low-grade |
| R4 | Unsatisfactory/invalid/unsuitable mishandled | **Med-High** | `:375–388,459,510` | Wrong repeat interval / ignored consecutive failures | HPV-Other + unsatisfactory | falls to clinician review (safe-ish) | dedicated branches + counter wiring | unsatisfactory tests |
| R5 | Reviewer trusts booking engine as guideline logic | **High** (pilot) | grade page vs guideline engine | False confidence in recommendation | any graded case | separate UIs | unify or label surfaces explicitly | integration test |
| R6 | Missing audit trace on age-gate/short-circuit outputs | Medium | age gates lack `safetyOutcome` | Weak defensibility | age-gate cases | `branchPath` present | add `CLINICIAN_REVIEW_REQUIRED` where escalation intended | audit-payload test |
| R7 | Equity data misuse | Low (currently OK) | `ethnicityPrimary` unused in logic | Equity harm if later wired to decisions | future change | not used in engine | keep monitoring-only; add guard test | "ethnicity-not-in-branch" test |
| R8 | `npm test` skips batch + safety-wording tests | Medium (process) | `package.json` `test` glob | Regressions ship unnoticed | CI run | none | add `test:all`/`test:batch` scripts | CI includes both dirs |
| R9 | Terminology overstates ("patient", directive phrasing) | Medium | wizard/engine strings | Implies autonomous clinical direction | wizard use | batch UI guarded | extend guard to wizard/engine; "participant" | wording test on wizard |
| R10 | Unnecessary colposcopy | Low | Fig3/4 branches | Over-referral | persistent HPV-Other | matches guideline | none needed | keep coverage |

---

## 8. Terminology & wording audit

**Aligned / good.** Batch surfaces use `Provisional`, `Reviewer confirmation`, `Not for direct clinical action`, `Decision-support`, `Batch Decision Support`, and forbid `Batch Decision Engine`, `automated clinical decision`, `production ready` — all enforced by `lib/batch/__tests__/safety-wording.test.ts`. Engine carries `validationStatus: REQUIRES_CLINICAL_CONFIRMATION` / `EXTERNAL_DEPENDENCY`. HPV vocabulary (`NOT_DETECTED` / `HPV_16_18` / `HPV_OTHER`) and cytology categories (ASC-US, LSIL, ASC-H, HSIL, SCC, AIS, AG1–5, AC1–4) match the guideline lexicon.

**Unsafe / outdated / to replace.**
- "patient" throughout the wizard (`steps.ts` questions), engine outputs (`"Patient is under 25 years old"` `:1658`, `"Patient is 75 or older"` `:1669`), `lib/copy/microcopy.ts`, and `schema.prisma`. In screening context replace with **"participant"** (keep "patient" only in genuinely clinical-care/GP contexts if intentional).
- Age-gate strings read as directives ("Discharge from routine cervical screening programme") at **LOW** risk with no review flag — reword as provisional + require review where escalation is possible.
- "vault screening pathway" wording in the wizard is fine but should link to Figure 8/Table 1 explicitly.
- **UNCERTAIN:** I could not find an explicit "**simulated** export / write-back package" label on an export-preview component (grep on `IntegrationReadinessPanel.tsx` / `integration-types.ts` returned no "simulated/write-back" string). Verify the export/write-back preview is labelled *simulated* before demo.

**Claims to check:** the batch safety test forbids "production ready" — confirm no `docs/` or marketing copy asserts "clinically validated", "guarantees guideline compliance", or "live integration".

---

## 9. Workflow / product-design audit

| Element | State | Notes |
|---|---|---|
| Pull Cases / Intake | Implemented | `app/(app)/cases`, NCSR pull (`cases/[id]/ncsr`), batch upload adapters (CSV/JSON/XLSX + demo) |
| Review Queue | Implemented | `cases` list + `cases/[id]/grade` — **but runs booking-triage engine, not guideline engine** |
| Mandatory clinician review | Partial | Engine emits `CLINICIAN_REVIEW_REQUIRED` for specialist branches; **age-gate short-circuits bypass it**; confirm UI blocks completion without human accept |
| Urgent clinical priority | Implemented | `riskLevel URGENT`, `referralPriority P1`, Fig10 cancer-symptom exception |
| Accept / reject / needs-information | Implemented | `ClinicianDecision` model + decision route; batch action queue |
| Completed Decisions | Implemented | decision history models present; verify immutability/audit link |
| Simulated export package | Partial / UNCERTAIN | `IntegrationReadinessPanel`, `audit/export` exist; "Adapter pattern defined · not connected" wording enforced; explicit "simulated write-back" label unverified |
| Audit Trail | Implemented | `AuditLog` + `security/events.ts`; export route; consider embedding `branchPath`/`guidelineReference` in the case audit payload |
| Equity reporting | Implemented, monitoring-only | `BatchEquityCard`; engine does not use ethnicity — correct |
| Role-based access | Implemented | `lib/auth/permissions.ts`, `api-permissions.ts`, roles incl. `SMO_REVIEWER`; **IDOR/scoping not audited here** — flag for security review |
| Deterministic reset / session isolation | Implemented + tested | `wizard-integration.test.ts` session-isolation tests pass |
| Simulated connectors | Implemented | colposcopy-registry stub returns synthetic data (`client.ts:110`) |
| Not-for-direct-clinical-action wording | Partial | Present on batch; extend to wizard/pathway result + grade page |

---

## 10. Test-suite audit

**Found (all green):** 104 engine tests (`npm test`) — Fig1(3) Fig2(6) Fig3(7) Fig4(6) Fig5(6) Fig6(8) Fig7(5) Fig8(5) Fig9(8) Fig10(5) Table1(7) + routing-precedence(4) + wizard-flow + wizard-integration + visual-labels. 181 batch tests (adapters, validation, processor, safety-wording, selection-state, manual-cases) — **but only runnable via `npx tsx --test "lib/batch/__tests__/*.test.ts"`, not `npm test`.** Typecheck clean. Lint: **5 errors** (`components/batch/*`, `components/marketing/*` — hooks/refs/memoization/unescaped entity) + 34 warnings. `prisma migrate status`: up to date (3 migrations).

**Missing / high-priority golden tests to add:**
- `figure3.test.ts`: HPV-Other + `UNSATISFACTORY` cytology; self-collected swab HPV-Other requiring LBC return; HPV-Other + negative → 12m repeat → second repeat.
- **`age-eligibility.test.ts` (new):** under-25 + HSIL/glandular (expect escalation, not reassurance); 70–74 + HPV 16/18 (expect colposcopy); 70–74 + not-detected (discharge); 75+ + AG1 (expect Fig7, not discharge); boundary 24/25 and 69/70/74/75.
- **`pregnancy-hardstop.test.ts` (new):** pregnant + HPV-Other + LSIL (expect mandatory review, not routine Fig3).
- **`des.test.ts` (new):** DES-exposed (expect dedicated review branch / missing-data stop).
- **`sample-integrity.test.ts` (new):** invalid vs unsuitable-leakage distinct repeat timings; consecutive-unsatisfactory escalation.
- `missing-data.test.ts`: assert *no* branch ever returns a routine recall interval when a required field is undefined (property test over the router).
- `terminology.test.ts`: extend the batch safety-wording guard to wizard steps + engine output strings ("participant" not "patient"; no directive discharge wording at LOW risk).
- `audit-payload.test.ts`: every decision carries `branchPath` + `guidelineReference` + `validationStatus`.
- RBAC/IDOR scoping tests for `/api/cases/[id]/*` (cross-user access).

---

## 11. Buyer-demo readiness

**Safe to show:** the batch surface (strong provisional/reviewer/"not for direct clinical action" wording, equity card, integration-readiness "not connected"), the pathway wizard for the clean primary-HPV and Test-of-Cure paths, the audit trail, and the Figures 1–10 decision-tree visualisations.

**Hide or soften:** (a) any age-boundary case on the wizard/batch until R1 is fixed — do not demo a 72yo HPV-16/18 or a 23yo HSIL; (b) the case grade page as "guideline engine" — it is the booking engine; (c) DES / unsatisfactory-sample cases.

**Disclaimers that must appear:** "Synthetic demo data only", "Simulated connectors — not connected to live systems", "Provisional decision support — reviewer confirmation required — not for direct clinical action", and (recommended) "Two engines: guideline pathway (wizard/batch) and booking triage (case queue)".

**Demo data should add:** at least one worked example per special pathway (pregnancy high-grade, glandular AG2→gynae, incomplete-excision hysterectomy, immune-deficient 3-year, abnormal bleeding urgent) — current seed exercises essentially one.

---

## 12. Clinical-pilot readiness

**Blockers:** R1 (age gates), R2 (DES), R3 (pregnancy hard-stop), R4 (sample integrity), R5 (engine reconciliation), plus terminology/participant fixes, wizard age capture, and CI that runs *all* tests.

**Governance needs:** documented clinician sign-off on every implemented branch against the June 2023 v1.1 source (a parity matrix exists in `docs/` — must be re-signed after fixes); versioned rule releases with reviewer (models exist: `CaseRuleSetRelease`, `ClinicalRuleSet`); RBAC + IDOR security review; audit immutability; DPIA / NZ Privacy Act 2020 review (consent step already present in wizard).

**Validation protocol:** golden-case regression covering every guideline branch with clinician-agreed expected outputs; discordance-review workflow; a "no silent routine recall on missing data" invariant test in CI.

---

## 13. Prioritised implementation backlog

**Phase A — demo-safe (do before next buyer demo)**
1. A1. Reorder router so age gates run **after** symptomatic/high-grade/glandular routing; add `CLINICIAN_REVIEW_REQUIRED` to under-25-with-abnormality and 70–74-HPV-detected.
2. A2. Add explicit "simulated export / write-back" labels; verify no "clinically validated / production ready / guarantees compliance" copy.
3. A3. Enrich seed/demo data with one case per special pathway.
4. A4. Fix the 5 lint errors; add `test:all` + `test:batch` scripts and run both in CI.

**Phase B — clinical validation**
5. B1. Add DES exposure field (schema + wizard + batch + engine branch + missing-data stop).
6. B2. Add sample-integrity field; split invalid vs unsuitable-for-analysis; add unsatisfactory-cytology branch and wire `unsatisfactoryCytologyCount`.
7. B3. Make pregnancy a global mandatory-review flag.
8. B4. Add age eligibility to the wizard (age/DOB step) and 70–74 HPV-result branch to colposcopy.
9. B5. Terminology pass to "participant"; extend the wording guard test to wizard + engine strings.

**Phase C — pilot readiness**
10. C1. Reconcile the two engines (route the case grade page through the guideline engine, or clearly scope it as booking triage).
11. C2. Golden-regression suite for every branch; missing-data invariant test; audit-payload test.
12. C3. RBAC/IDOR security review; audit immutability; DPIA.

**Phase D — real integration**
13. D1. Replace simulated connectors (NCSR pull, colposcopy registry, write-back) with governed live adapters behind feature flags.

**Phase E — specialist expansion**
14. E1. Deepen Figure 5 / 7 / 9 MDT support (provisional + mandatory review only), immune-deficient-under-25 review, postmenopausal-over-70 practice point.

---

## 14. Exact next Codex prompts

1. "In `lib/engine/decision-engine.ts` `evaluateClinicalDecision`, move the age gates (`<25`, `70–74`, `75+`) to run **after** Figure 2/6/7 and glandular-cytology routing. For under-25 with high-grade/glandular cytology or cancer symptoms, and for 70–74 with HPV detected (route to colposcopy), return a `CLINICIAN_REVIEW_REQUIRED` decision instead of a LOW-risk reassurance. Add `lib/engine/__tests__/age-eligibility.test.ts` covering 24/25, 69/70/74/75 boundaries, 23yo+HSIL, 72yo+HPV16/18, 76yo+AG1."
2. "Add a DES-exposure field end-to-end: `desExposure?: boolean` in `ClinicalInput`, a `DesExposure` column on `MedicalHistory`/schema, a wizard step, a batch template column + validation, and an engine branch that routes DES-exposed participants to clinician review and blocks routine recall when DES status is unknown-and-relevant. Add `des.test.ts`."
3. "Implement unsatisfactory-cytology handling in `evaluateFigure3`: HPV-Other + `UNSATISFACTORY` → repeat LBC in 3 months; wire `unsatisfactoryCytologyCount` so consecutive unsatisfactory results escalate; keep HPV 16/18 + unsatisfactory → colposcopy. Add tests."
4. "Split HPV `INADEQUATE` into `INVALID` and `UNSUITABLE_FOR_ANALYSIS` with distinct repeat timing/warnings; add a `sampleIntegrity` field and tests."
5. "Make pregnancy a global mandatory-review flag in the router: any `isPregnant` case that would otherwise route to routine Figure 3/4 must carry `safetyOutcome: CLINICIAN_REVIEW_REQUIRED`. Add `pregnancy-hardstop.test.ts`."
6. "Add an age/DOB step to the wizard (`lib/wizard/steps.ts`) and map it to `patientAge` in the `answers → ClinicalInput` builder."
7. "Add npm scripts `test:engine`, `test:batch`, and `test:all` (running both `lib/engine/__tests__` and `lib/batch/__tests__`) and update CI to run `test:all`. Fix the 5 ESLint errors in `components/batch/*` and `components/marketing/*`."
8. "Terminology pass: replace 'patient' with 'participant' in screening-context wizard steps, engine output strings, and `lib/copy/microcopy.ts`; extend `lib/batch/__tests__/safety-wording.test.ts` to also scan wizard step text and engine strings."
9. "Add a missing-data invariant test: for every figure, assert that when a required field is undefined the decision never sets `recallIntervalMonths`/`nextScreeningIntervalMonths` to a routine value (i.e., no silent routine recall)."
10. "Decide and implement engine reconciliation for the case Review Queue: either route `app/api/cases/[id]/rules/evaluate` through `evaluateClinicalDecision`, or add explicit UI labelling that the grade page is booking-triage only and not guideline-derived; add an integration test asserting which engine each surface uses."

---

### Command results appendix

| Command | Result |
|---|---|
| `git status` | clean, branch `main` |
| `npm test` | **104 passed / 0 failed** (engine only — batch dir not included) |
| `npx tsx --test "lib/batch/__tests__/*.test.ts"` | **181 passed / 0 failed** |
| `npm run lint` | 39 problems — **5 errors**, 34 warnings |
| `npx tsc --noEmit` | clean (no errors) |
| `npx prisma migrate status` | up to date, 3 migrations |
| `npm run test:all` / `test:engine` / `test:batch` / `demo:reset` | **do not exist** (missing scripts) |
