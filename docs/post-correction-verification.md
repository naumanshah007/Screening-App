# Post-Correction Verification

Verification date: 2026-04-29

## Summary Verdict

- All 11 supplied sources are represented in automated tests: Figures 1-10, Table 1, plus routing precedence.
- Engine tests are mostly source-truth oriented: they assert expected business outcomes such as referral destination, recall interval, safety outcome, and recommendation code.
- No compile-breaking issue found.
- Figure 7 visible lesion inference has been removed. Post-colposcopy glandular evaluation now requires explicit `visibleLesion`; missing status returns `INSUFFICIENT_INFORMATION` with `missingInformation: ["visibleLesion"]`.

Verification commands run:

- `npm test` -> 58 passing
- `npx tsc --noEmit` -> passing

## Pass / Fail By Source

| Source | Verification result | Evidence | Notes |
| --- | --- | --- | --- |
| Figure 1 | Pass | `lib/engine/__tests__/figure1.test.ts` | Tests invitation logic and external history safety outcome. |
| Figure 2 | Pass with confirmation dependency | `lib/engine/__tests__/figure2.test.ts` | AIS/R2.08 branch correctly returns clinician review; service wording still needs confirmation. |
| Figure 3 | Pass | `lib/engine/__tests__/figure3.test.ts` | Covers HPV not detected, HPV 16/18, SWAB return visit, HPV Other baseline/first/second repeat. |
| Figure 4 | Pass | `lib/engine/__tests__/figure4.test.ts` | Covers normal colposcopy follow-up, HPV 16/18, HPV Other cytology branches, immune deficiency, second repeat. |
| Figure 5 | Pass | `lib/engine/__tests__/figure5.test.ts` | Covers MDM required and key source MDM outcomes. |
| Figure 6 | Pass | `lib/engine/__tests__/figure6.test.ts` | HPV detected any type currently routes to colposcopy via `F6-HPV-DETECTED-ANY-CYTOLOGY-COLP`. |
| Figure 7 | Pass | `lib/engine/__tests__/figure7.test.ts` | Explicit visible lesion is now required for post-colposcopy glandular evaluation; no inference from colposcopic impression. |
| Figure 8 | Pass | `lib/engine/__tests__/figure8.test.ts` | Figure 8 and Table 1 share the same hysterectomy evaluator with source-prefixed codes. |
| Figure 9 | Pass | `lib/engine/__tests__/figure9.test.ts` | Routing applies only to pregnant + qualifying cytology, and invasion requires biopsy before oncology. |
| Figure 10 | Pass | `lib/engine/__tests__/figure10.test.ts` | Initial assessment and 6-8 week review are separated. Initial run does not force `bleedingResolved`. |
| Table 1 | Pass | `lib/engine/__tests__/table1.test.ts` | Table-driven axes are represented: prior history, pathology, excision completeness, incomplete ToC, no known history. |

## Specific Checks

| Check | Result | Notes |
| --- | --- | --- |
| 1. All 11 sources represented in tests | Pass | Test files exist for Figures 1-10 and Table 1. |
| 2. Tests assert business outcome, not current implementation only | Mostly pass | Tests assert source outcomes by recommendation code plus referral/recall/safety in important branches. Some tests could be stronger by asserting full destination, priority, and branch path. |
| 3. Safety outcomes used when required facts are missing | Mostly pass | `insufficient()` and `clinicianReview()` set explicit safety outcomes. Some actionable interim states, such as Figure 10 initial assessment, return missing facts without `safetyOutcome` because they are workflow collection steps rather than final pathway guesses. |
| 4. Any branches silently guessing | Pass | The known Figure 7 visible-lesion inference was removed; missing `visibleLesion` now produces a safety outcome. |
| 5. Figure 8 and Table 1 routed consistently | Pass | `evaluateTable1()` delegates to the same hysterectomy pathway as Figure 8 with `T1-` code prefix. Routing sends total hysterectomy to Figure 8 unless `currentFigure` is `TABLE_1`. |
| 6. Figure 10 split initial vs 6-8 week follow-up | Pass | `abnormalBleedingStage === "SIX_TO_EIGHT_WEEK_REVIEW"` gates `bleedingResolved`; initial assessment returns workup/review actions. |
| 7. Figure 9 only pregnant + qualifying cytology | Pass | Routing requires `input.isPregnant && isPregnancyQualifyingCytology(...)`; non-qualifying pregnant case is tested. |
| 8. Figure 6 HPV detected any type / any cytology -> colposcopy | Pass | Engine checks `isHpvDetected()` before cytology branches. Test covers HPV Other; route also covers HPV 16/18 by the same helper. |
| 9. Stale visual labels fixed / under validation | Pass | `lib/decision-trees/index.ts` titles are source-aligned and subtitles say simplified visual under validation; `lib/utils.ts`, GP options, and `DecisionCard` labels are updated. |
| 10. Audit outputs store rule version, branch path, input facts, missing facts, external flags | Pass | Wizard completion and direct session evaluation audit payloads include `ruleVersion`, `branchPath`, `inputFacts`, `missingInformation`, and `externalDependencies`. |

## Remaining Unsafe Branches

| Area | Risk | Evidence | Recommendation |
| --- | --- | --- | --- |
| Manual/direct session API | Medium | `app/api/sessions/route.ts` spreads body into the engine and audits full input, but does not persist `ColposcopyFinding` like wizard completion does. | If manual GP/API entry is in pilot scope for colposcopy states, add persistence parity or disable those fields from that route. |

## Tests That Are Too Weak

| Test area | Current weakness | Suggested strengthening |
| --- | --- | --- |
| Figure 8/Table 1 | Strong row-group coverage, but not every literal row from Table 1. | Add exhaustive Table 1 row matrix once business confirms all rows are in pilot scope. |
| Audit payload | Verified by code inspection, not automated persistence tests. | Add route/integration tests for audit payload shape if test DB infrastructure is available. |

## Test Hardening Update

- Figure 6 now has a table-driven test for HPV 16/18 and HPV Other across negative, ASC-US, LSIL, ASC-H, HSIL, and SCC cytology, all asserting colposcopy.
- Figure 9 now has a table-driven qualifying cytology test for ASC-H, HSIL, AG1-AG5, and AC1-AC4, all asserting Figure 9 initial colposcopy.
- Visual labels now have a registry test covering source-aligned decision-tree titles, under-validation subtitles, and `getFigureLabel()` output.
- Exhaustive literal-row Table 1 tests remain deferred until business confirms Table 1 is fully in pilot scope.

## UI / API Mapping Gaps

| Area | Status | Gap |
| --- | --- | --- |
| Main wizard | Pass with caveat | It captures the newly required structured fields, but some external facts such as NCSR-verified history, Test of Cure count, specialist discharge, and hysterectomy histology are still manually entered. |
| Wizard completion API | Pass | Expanded `ClinicalInput` is passed through, `activeModuleVersion` is stored, `ColposcopyFinding` is persisted when colposcopy facts exist, and audit includes rule trace data. |
| Direct rules evaluation API | Pass | Spreads request body into `ClinicalInput`; suitable for testing/preview. |
| Direct session API / GP manual entry | Partial | It can pass expanded body fields to the engine and audit them, but the visible GP form still mainly captures HPV/cytology/sample/figure override and does not expose the full structured workflow fields. |
| Visual decision trees | Pass with caveat | Labels are source-aligned and marked under validation, but diagrams remain simplified and should not be treated as authoritative. |

## Final Demo / Pilot Recommendation

- Safe to demo as workflow MVP: yes, with the current “under validation” framing and clear explanation that external history and clinical validation are still required.
- Safe to pilot with real cases: not yet. The Figure 7 visible-lesion blocker has been tightened, but pilot readiness still needs stronger table-driven tests for HPV-detected Test of Cure and pregnancy cytology categories, plus local clinical policy confirmation for R2.08, Figure 7 AC routing, Figure 10 Healthcare Pathways wording, and pregnancy follow-up timing.
- Safe to claim clinically complete: no. The implementation is materially safer and much closer to the supplied figures/table, but it still depends on clinical sign-off and external history/NCSR inputs.
