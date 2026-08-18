# CerviGrade full NCSP clinical-parity audit

Audit date: 2026-08-02  
Branch: `audit/full-ncsp-clinical-parity`  
Base/HEAD examined: `578b4b046aed60ef68b950ffb5945e4bf6ec956b`  
Scope: June 2023 final v1.1 guideline, Figures 1–10, Table 1, February 2026 addendum, March 2026 immune-deficiency guidance, application decision paths and user-accessible channels.

## Executive verdict

**CerviGrade remains a proof of concept. It is not clinically validated, not ready to begin a validation claim, and not pilot-ready.**

A tightly controlled conference demonstration is conditionally reasonable only with synthetic/de-identified data and prominent wording on every result and export: **“provisional recommendation — reviewer confirmation required — not for direct clinical action.”** The demonstration must not claim NCSP compliance, clinical validation, autonomous decision-making, live hospital integration or pilot readiness.

The independent audit extracted **179 current source terminal branches** and **133 distinct implemented output/safety codes**. All 179 source branches have executable golden, nearest-neighbour and missing-critical-data probes. The full clinical suite contains **599 tests: 475 pass and 124 fail**. The failures are retained as evidence; no assertion or production rule was weakened to make the suite pass.

At the rule-matrix level, 91/179 source branches (50.8%) are exact or action-equivalent with wording differences. A less strict golden-action comparison passes 123/179 (68.7%), but that number does not establish safe parity because it ignores some missing-data, source-version, provenance, clinician-review and channel limitations. The matrix contains **9 critical and 72 high-severity mismatching source branches**. The consolidated defect register contains **4 critical and 16 high confirmed defects**.

## Method and independence

The audit maintained three independent layers:

1. The expected oracle was rebuilt from the visually inspected primary documents and nearby recommendation text. The earlier extraction report was used only as a secondary cross-check.
2. Current implementation was statically re-extracted from engine functions, types, validation, mapping, APIs, persistence, review and export surfaces without treating current behaviour as correct.
3. Executable probes compare the source-derived expected action and safety boundary with the current engine and end-to-end structures.

No expected outcome was imported from the current production engine. No production logic, application behaviour, API, schema or migration was changed by this audit.

## Stage 1 source verification — PASS

All supplied sources are present, hashable and readable. Poppler rendered each controlling source page at 220 dpi. Every box, connector, arrow direction, branch label, legend, footnote, recommendation reference, age boundary, repeat interval and specialist/MDM requirement in Figures 1–10 and Table 1 was directly inspected at rendered resolution. All nine addendum pages and all three immune-guidance pages were also visually inspected. No source was inferred from illegible content.

| File | Version/date | Pages | SHA-256 | Precedence |
|---|---|---:|---|---|
| `01-ncsp-guidelines-2023-v1.1.pdf` | June 2023 final v1.1; use from July 2023 | 102 | `721ee7fa5f804fd951f49c1d9ec288832d5ad7a29c3c149b1be6e5129ffe7e0b` | Base national source except where expressly superseded. |
| `02-ncsp-guideline-addendum.pdf` | Doc ID 18519 v1.0; published 02/02/2026; immediate effect | 9 | `dc7817a490ea84ff8cd3507647d88d1b364f1ad170122c3d938bb617b6d482e6` | Supersedes only its named 2023 components. |
| `03-ncsp-immune-deficiency-guidance.pdf` | Doc ID 18378 v1.0.1; published 12/03/2026 | 3 | `5fc5b4872ba70eb0648feb9dc54a82c1291979e6a7c6a5f9476db1cdf2c69063` | Controls current immune classification/periodicity and supplements general routes. |
| `04-prior-rule-extraction.md` | Undated secondary extraction | n/a | `46fb36e0a4478d332969c32565de58a7bdf90d3f7904d2b14c1d21640cbfddcf` | Secondary cross-check only. |

### Exact figure and table pages

“PDF page” is one-based; “PDF index” is zero-based.

| Item | Printed page | PDF page | PDF index | Readability |
|---|---:|---:|---:|---|
| Figure 1 | 18 | 20 | 19 | PASS |
| Figure 2 | 19 | 21 | 20 | PASS |
| Figure 3 | 24 | 26 | 25 | PASS |
| Figure 4 | 45 | 47 | 46 | PASS |
| Figure 5 | 47 | 49 | 48 | PASS |
| Figure 6 | 56 | 58 | 57 | PASS |
| Figure 7 | 59 | 61 | 60 | PASS |
| Table 1 | 66 | 68 | 67 | PASS |
| Figure 8 | 67 | 69 | 68 | PASS |
| Figure 9 | 71 | 73 | 72 | PASS |
| Figure 10 | 83 | 85 | 84 | PASS |

Full metadata, controlling recommendations and rendered-image names are recorded in `06-source-register.md`. Renders are under `docs/clinical-audit/rendered-sources/`.

## Source precedence

### Addendum supersession

The February 2026 addendum does not replace the whole 2023 guideline. It changes these components:

1. Updated R6.05 removes MDM cytological review for the Type 3 TZ + HPV positive + low-grade cytology + normal-colposcopy scenario.
2. Updated R8.03 defines under-30 biopsy-confirmed CIN2 active-surveillance eligibility and its six-monthly pathway, 24-month limit, treatment triggers and regression-to-ToC route.
3. Updated R8.06 allows under-50 participants with positive HSIL excision margins to receive ToC follow-up in primary/community care; the 50+ specialist route remains distinct.
4. Updated R9.14 allows HPV-detected AIS with clear margins to receive primary/community co-tests at 6 and 18 months.
5. The gynaecological-cancer update changes six Figure 8/Table 1-context branches: stage 1a1 after local excision/ToC; abnormality during ToC; post-ToC HPV routing; cessation after total hysterectomy plus successful ToC; clinician/participant follow-up for other cancer histories outside NCSP; and incomplete ToC before total hysterectomy for a non-cervical cancer.
6. The addendum's immune categories are refined by the later standalone v1.0.1 document.

### Immune-deficiency precedence

The March 2026 v1.0.1 document controls who uses the immune-deficient three-year interval in Figure 3/Figure 4 context. It supplements rather than replaces HPV genotype, cytology, repeat, colposcopy, gynaecology and oncology routing. Named recommended categories can be deterministic only when their evidence is present. “Highly considered,” similar/unlisted conditions and complex medicine/dose/duration situations are clinician-led and must not default to false. Named non-immune conditions and non-immunosuppressive treatments must not be incorrectly classified as immune deficient.

## Canonical oracle and implemented inventory

| Source | Canonical terminal branches | Implemented output/safety codes attributed to pathway |
|---|---:|---:|
| Figure 1 | 6 | 4 |
| Figure 2 | 7 | 12 |
| Figure 3 | 43 | 15 |
| Figure 4 | 21 | 10 |
| Figure 5 | 7 | 8 |
| Figure 6 | 18 | 9 |
| Figure 7 | 15 | 13 |
| Figure 8 | 18 | 17 |
| Table 1 | 21 | 17 |
| Figure 9 | 10 | 12 |
| Figure 10 | 13 | 13 |
| Cross-cutting age router | — | 3 |
| **Total** | **179** | **133** |

Implemented-code counts are not evidence of coverage: several codes are missing-information/safety outputs, several source branches collapse into one code, some implemented branches lack a supplied source, and updated source branches may have no current-version representation.

The machine-readable oracle contains all required fields and 179 unique IDs. Table 1 contains 21 separate displayed cell outcomes; it was not reduced to one generic hysterectomy rule. The implemented inventory records exact function/file/line, conditions, output, rule version and channel reachability for each distinct extracted code.

## Rule-to-code parity result

| Classification | Matrix rows |
|---|---:|
| EXACT_MATCH | 2 |
| MATCH_WITH_WORDING_DIFFERENCE | 90 (89 guideline rows plus one implemented-only wording row) |
| PARTIAL_IMPLEMENTATION | 27 |
| INCORRECT_OUTPUT | 27 |
| INCORRECT_REVIEW_REQUIREMENT | 8 |
| INCORRECT_DESTINATION | 2 |
| UPDATED_RULE_NOT_IMPLEMENTED | 19 |
| UNSUPPORTED_BY_DATA_MODEL | 5 |
| POSSIBLE_OVERREACH | 3 |
| UNSOURCED_IMPLEMENTED_RULE | 1 |
| LOCAL_RULE_REQUIRES_GOVERNANCE | 1 |

The parity matrix has 185 rows: 179 source branches and six implemented-only governance/overreach rows. The two exact matches and 89 action-equivalent wording matches among guideline rows yield strict current-source parity of **91/179 (50.8%)**. “Strict” here still means conformance demonstrated by the audit probes and inventory; it is not formal clinical validation.

Mismatch severity among the 179 source rows is **9 critical, 72 high and 7 medium**. Low-severity wording/provenance rows are not counted as mismatches in that severity total.

## Executable test evidence

### Source-specific suites

Every source branch has one golden, one nearest-neighbour and one missing-critical-data probe. All 179 nearest-neighbour probes pass. Golden action probes pass 123/179; missing-data probes pass 135/179.

| Source | Oracle branches | Tests written | Pass | Fail | Golden pass/fail | Missing implementation | Unsupported input | Clinician-only |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Figure 1 | 6 | 18 | 17 | 1 | 6 / 0 | 0 | 0 | 0 |
| Figure 2 | 7 | 21 | 19 | 2 | 6 / 1 | 0 | 0 | 1 |
| Figure 3 | 43 | 129 | 105 | 24 | 33 / 10 | 4 | 1 | 4 |
| Figure 4 | 21 | 63 | 51 | 12 | 17 / 4 | 2 | 0 | 2 |
| Figure 5 | 7 | 21 | 14 | 7 | 1 / 6 | 0 | 0 | 7 |
| Figure 6 | 18 | 54 | 34 | 20 | 10 / 8 | 6 | 0 | 5 |
| Figure 7 | 15 | 45 | 38 | 7 | 10 / 5 | 1 | 0 | 14 |
| Figure 8 | 18 | 54 | 45 | 9 | 9 / 9 | 6 | 0 | 1 |
| Table 1 | 21 | 63 | 61 | 2 | 19 / 2 | 0 | 0 | 0 |
| Figure 9 | 10 | 30 | 24 | 6 | 6 / 4 | 0 | 0 | 10 |
| Figure 10 | 13 | 39 | 29 | 10 | 6 / 7 | 0 | 4 | 7 |
| **Source suites** | **179** | **537** | **437** | **100** | **123 / 56** | **19** | **5** | **51** |

“Missing implementation” counts current 2026 branches classified `UPDATED_RULE_NOT_IMPLEMENTED`; “unsupported input” counts branches classified `UNSUPPORTED_BY_DATA_MODEL`. Other wrong or partial branches are reflected in pass/fail and the complete matrix rather than these two narrow columns.

### Cross-cutting and end-to-end suites

| Suite | Tests | Pass | Fail | Main result |
|---|---:|---:|---:|---|
| Router precedence | 19 | 17 | 2 | Fails age 70–74 + HPV 16/18 and invalid HPV + HSIL. |
| Batch source integrity | 4 | 1 | 3 | Fails fabricated bleeding facts, unknown-immune preservation and treatment-date preservation. |
| API/schema parity | 5 | 0 | 5 | Tri-state immune, DES, exact date/age, invalid-vs-unsuitable and updated AIS/cancer/provenance facts are absent. |
| Persistence parity | 4 | 1 | 3 | Longitudinal anchors/provenance are incomplete. |
| Review Queue parity | 4 | 3 | 1 | Stored clinical result is visible, but the separate grading engine remains disconnected from source-parity enforcement. |
| Export safety | 3 | 3 | 0 | Simulated/integration-preview/not-for-action labelling is present in tested surfaces. |
| Clinical invariants | 18 | 12 | 6 | Fails age 70/74 HPV 16/18, missing sample, unknown immune, ToC sequence and immutable snapshot requirements. |
| Earlier oracle safety probes | 5 | 1 | 4 | Reconfirms AUD-001 to AUD-004; urgent suspected-cancer routing passes. |
| **Additional suites** | **62** | **38** | **24** | — |
| **All clinical conformance tests** | **599** | **475** | **124** | Evidence of material non-parity. |

### Commands run

Source verification and rendering:

```text
find docs/clinical-sources -maxdepth 1 -type f -print
pdfinfo docs/clinical-sources/01-ncsp-guidelines-2023-v1.1.pdf
pdfinfo docs/clinical-sources/02-ncsp-guideline-addendum.pdf
pdfinfo docs/clinical-sources/03-ncsp-immune-deficiency-guidance.pdf
shasum -a 256 docs/clinical-sources/*
pdftoppm -png -r 220 -f <page> -l <page> -singlefile <source.pdf> <render-target>
```

Each generated PNG was then opened and visually inspected at rendered resolution. `pdftotext -layout` was used only to locate/cross-check adjacent text, never as a replacement for visual inspection.

Audit generation and test commands:

```text
npx tsx scripts/clinical-audit/write-complete-oracle.ts
npx tsx scripts/clinical-audit/write-implemented-inventory.ts
npx tsx scripts/clinical-audit/write-parity-artifacts.ts
npx tsx --test tests/clinical-conformance/*.test.ts
npx tsx --test --experimental-test-coverage lib/engine/__tests__/*.test.ts
npm run lint
npm run typecheck
npm run test:engine
npm run test:batch
npm run build
```

The baseline records the initial `npm ci`, generated-Prisma-client issue and repeat checks. Ordinary product regression tests passing do not close source-derived failures.

Final repository check results were: lint pass with 0 errors and 21 pre-existing/worktree warnings; TypeScript pass; engine regression 107/107 pass; batch regression 217/217 pass; production build pass with one Turbopack tracing warning; clinical conformance 475/599 pass and 124/599 intentional mismatch failures.

## Coverage — ordinary code versus clinical coverage

| Measure | Result | Meaning |
|---|---:|---|
| Ordinary all-file line / branch / function coverage for engine-test command | 91.63% / 78.37% / 83.17% | Structural execution by existing engine tests, not guideline parity. |
| `decision-engine.ts` line / branch / function coverage | 86.91% / 77.05% / 98.04% | Structural execution only. |
| Guideline branch fixture coverage | 179/179 = **100%** | Every extracted source terminal branch has executable probes. |
| Golden action equivalence | 123/179 = **68.7%** | Coarse expected action matches; does not prove safe missing-data/version/channel handling. |
| Correctly implemented guideline branch coverage | 91/179 = **50.8%** | Exact or wording-only match under the current-source parity matrix. |
| Fully UI-reachable branches | 84/179 = **46.9%** | A further 77 are partial; 18 are absent. |
| Fully API-representable branches | 161/179 = **89.9%** | 18 are absent; this does not imply UI, persistence or correct logic. |
| Fully batch-reachable branches | 42/179 = **23.5%** | A further 119 are partial; 18 are absent. |
| Persistence-complete branches | 0/179 = **0% independently demonstrated** | 161 have partial snapshot representation and 18 are absent; no branch met the audit's full longitudinal/provenance criterion. |
| Fully Review-Queue-complete branches | 0/179 | 161 are partial and 18 absent; review visibility is not full source/provenance parity. |
| Fully export-complete branches | 0/179 | Safety labels pass, but source/provenance and unsupported facts remain partial. |

The 0% persistence/review/export figures use the requested strict definition: all required inputs, longitudinal state, source provenance, rule version and decision snapshot must survive end to end. They do not mean the product stores nothing; it stores useful partial case/input/decision snapshots.

## Reproduction of the five earlier defects

| Defect | Input | Expected from controlling source | Actual / trace | Result |
|---|---|---|---|---|
| AUD-001 HIGH | HPV not detected; missing sample type | Information stop before terminal recall | `F3-HPV-NOT-DETECTED-5Y`; Figure 3 routine return | CONFIRMED |
| AUD-002 HIGH | HPV not detected; LBC; immune status unknown | Resolve immune classification before three-/five-year choice | `F3-HPV-NOT-DETECTED-5Y` because unknown/default becomes false | CONFIRMED |
| AUD-003 CRITICAL | Age 70; HPV 16/18; LBC | Colposcopy | `AGE-70-74-DEFERRED`; trace `[FIGURE_3, AGE-70-74-DEFERRED]` | CONFIRMED |
| AUD-004 HIGH | Active ToC; HPV not detected; negative cytology; missing treatment date | Information stop | `F6-FIRST-NEGATIVE-REPEAT-12M`; treatment date is only a warning/missing list | CONFIRMED |
| AUD-005 HIGH | Batch record states abnormal bleeding only | Preserve assessment facts as missing | Mapper sets six histories/examination/co-test fields to true | CONFIRMED |

Passing current implementation tests does not refute these source-derived reproductions.

## Newly discovered consolidated defects

The full audit adds AUD-006 through AUD-020. The most consequential are:

- **AUD-006 CRITICAL:** invalid HPV plus reportable HSIL produces `F3-INAD-3M` and no colposcopy because the invalid branch executes before cytology risk routing.
- **AUD-013 CRITICAL:** six current gynaecological-cancer/hysterectomy branches from the addendum cannot be represented or executed.
- **AUD-018 CRITICAL:** age 75 alone produces unconditional programme discharge without proving the qualifying negative exit test/history.
- **AUD-007 HIGH:** invalid and unsuitable HPV are collapsed and given an unsupported fixed three-month delay.
- **AUD-008 to AUD-012 HIGH:** current immune classification and updated R6.05/R8.03/R8.06/R9.14 branches lack adequate versioned representation/implementation.
- **AUD-014 HIGH:** single/recurrent PCB, persistent IMB and PMB cannot be distinguished; batch ingestion compounds this by inventing assessment facts.
- **AUD-015 HIGH:** some clinician-led specialist branches can be emitted as ordinary implemented terminal decisions.
- **AUD-016 HIGH:** DES exposure is absent across the clinical type, schema, API, batch and UI.
- **AUD-017 HIGH:** a `SECOND_TEST` marker can complete ToC without a proven prior qualifying negative co-test.
- **AUD-019 HIGH:** national routing and unsourced local P1/P2 priorities are mixed.
- **AUD-020 HIGH:** the clinical figure engine and editable operational grading engine can diverge without an enforced consistency boundary.

The complete row-level inputs, expected/actual outputs, traces, locations, consequences and remediation are in `full-defects.csv`.

## Structural findings rechecked

| Earlier finding | Classification | Current evidence |
|---|---|---|
| Guideline engine and review-queue grading engine are separate and may disconnect | **CONFIRMED** | `evaluateClinicalDecision` creates the figure decision; `evaluateCaseRuleRelease` independently creates editable triage. Regrade changes triage fields without re-running the national clinical decision. |
| Main Review Queue may not execute Figures 1–10 | **PARTIALLY CONFIRMED** | The page reads stored `BatchReviewItem` snapshots and does not execute the figure engine itself. The batch processor did execute the engine before persistence, so the queue is not wholly detached from figure outputs. |
| DES exposure absent | **CONFIRMED** | No DES field exists in engine types, Prisma schema, pathway API, canonical batch model or UI. |
| DOB or precise age-boundary calculation absent | **PARTIALLY CONFIRMED** | `Patient.dateOfBirth` exists, but pathway completion computes integer age from current time using 365.25 days and the engine receives `patientAge`, not DOB plus clinical event date. |
| Wizard does not capture age or other required history | **PARTIALLY CONFIRMED** | DOB is captured/derived, but many required immune, DES, cancer, margin, surveillance, bleeding and longitudinal ToC facts are not captured. |
| Table 1 is a generic evaluator rather than a full matrix | **CONFIRMED** | `evaluateTable1` delegates to the shared `evaluateHysterectomyPathway`; 17 T1 output codes represent 21 source cells and two golden cell outcomes fail. |
| Specialist pathways expose clinician-led decisions as deterministic outputs | **CONFIRMED** | MDM/biopsy/excision/oncology outputs are not consistently marked with a non-final clinician-review safety outcome. |
| User-facing guideline references may be approximate/non-verifiable | **CONFIRMED** | References are generic strings such as “Figure 3 - HPV 16 or 18” or “Age eligibility”; exact document version, printed/PDF page and recommendation are absent. The audit does not assert every phrase is invented, only that provenance is insufficient. |
| National pathway routing and local booking priority are mixed | **CONFIRMED** | P1/P2 priorities are embedded in the clinical engine, but no approved local priority source was supplied. |
| Longitudinal ToC state is not reliably persisted | **CONFIRMED** | Counters and some snapshots exist, but pathway completion starts counters at zero, treatment date is not reliably carried, and a declared stage can substitute for a proven event sequence. |

## Rules unsupported by the product

The parity matrix identifies **24 directly unsupported current-source branches**:

- 19 `UPDATED_RULE_NOT_IMPLEMENTED`: four immune-guidance Figure 3 branches; two current Figure 4 branches (immune interval and updated R6.05); six Figure 6 addendum branches; updated R9.14; and six gynaecological-cancer Figure 8 branches.
- 5 `UNSUPPORTED_BY_DATA_MODEL`: one Figure 3 invalid-versus-unsuitable branch distinction and four Figure 10 R15.02/R15.05/R15.06 branches.

Beyond those 24 narrow classifications, DES, exact age-at-event, immune classification provenance, CIN2 surveillance, AIS margins, cancer stage/history, bleeding chronology and robust ToC event sequence are cross-cutting product gaps that make additional implemented-looking branches only partial.

## Clinician-only handling

The source oracle marks **51/179 branches as clinician-only**: Figure 2 (1), Figure 3 (4), Figure 4 (2), Figure 5 (7), Figure 6 (5), Figure 7 (14), Figure 8 (1), Figure 9 (10) and Figure 10 (7). Table 1 and Figure 1 have no branch marked clinician-only in the canonical extraction, although many branches still require reviewer confirmation before product use.

Clinician-only includes MDM/MDT interpretation, visible-lesion/biopsy/histology decisions, suspected invasion, specialist treatment choices, case-by-case immune classification and cancer follow-up outside deterministic NCSP rules. These must return a non-final `CLINICIAN_REVIEW_REQUIRED`-type state until an authorised clinician supplies and confirms the decision. A deterministic code is acceptable as workflow routing only when it cannot be mistaken for an autonomous final clinical choice.

## Readiness assessment

| Question | Result |
|---|---|
| Source package verified? | **YES.** All controlling pages are readable and registered. |
| Proof-of-concept only? | **YES.** |
| Conference-demo safe? | **CONDITIONALLY YES**, only with synthetic/de-identified data, prominent provisional/reviewer/not-for-action wording, no live integration and no clinical-accuracy claim. |
| Ready for clinical validation? | **NO.** The oracle can support a future controlled validation programme after critical remediation and clinical-owner sign-off, but the product is not ready to claim or enter successful validation in its current state. |
| Pilot-ready? | **NO.** Critical/high safety, data, workflow and governance blockers remain. |

The remediation sequence and acceptance evidence are in `remediation-backlog.md`. Passing ordinary unit tests or closing a subset of failures must not be described as clinical validation.

## Production-change guardrail

This audit added or updated only documentation, rendered source images, audit-generation scripts and independent clinical-conformance tests. It did **not** modify production decision logic, application behaviour, API routes, Prisma schema, database migrations or production UI. The repository had unrelated pre-existing production-file changes in the dirty worktree before this audit; those were preserved and are not adopted or attributed to the audit.

## Audit artifacts

- `06-source-register.md` and `rendered-sources/`
- `07-complete-guideline-oracle.md` and `complete-guideline-oracle.json`
- `08-expanded-implemented-inventory.md` and `expanded-implemented-rules.json`
- `09-complete-rule-parity-matrix.md` and `complete-rule-parity.csv`
- `10-full-conformance-report.md`
- `full-defects.csv`
- `remediation-backlog.md`
- `tests/clinical-conformance/`

These artifacts are audit evidence only. They do not constitute Health New Zealand/NCSP approval, clinical validation, regulatory approval or authority for direct clinical action.
