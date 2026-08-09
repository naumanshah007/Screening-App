# 06 — Acceptance Test Plan (Phase 13)

**This is the gate. Canonical clinical authority may not be activated in production until every gate below is green against one pinned commit SHA.**

Evidence rule: every gate names a command, an artefact, and a numeric threshold. "Reviewed and looks fine" is not evidence. All gates run against **one commit SHA**, recorded in the sign-off (see EXEC-00 — a branch name is not acceptable).

---

## Gate group A — Clinical equivalence and correction

| # | Gate | Threshold | Source |
|---|---|---|---|
| A1 | 179-case semantic oracle | **Canonical regressions = 0** | `scripts/rule-studio/run-canonical-differential.ts` |
| A2 | Confirmed corrections retained | **≥ 31** | same |
| A3 | Newly expressible states | **≥ 16** | same |
| A4 | Unexplained differences | **= 0** — every legacy↔canonical difference is classified as correction, newly-expressible, or adjudicated | `scripts/comparison/classify.mjs` |
| A5 | **Canonical is never less urgent than legacy on identical facts** | **violations = 0** | new assertion — must be added; this is the single most important clinical gate and does not exist today |
| A6 | Table 1 combinations | **21/21** | conformance suite |
| A7 | Input-state representation | **18/18 representable**, 16 resolved, 2 adjudicated or explicitly routed to a safety stop | field dictionary + schema |
| A8 | 26 legacy defects | 22 corrections reproduced; **4 (LEGACY-005/-014/-017/-026) adjudicated or their pathways routed to a safety stop** | defect register |
| A9 | GOV-01…GOV-03 | adjudicated, or pathway explicitly stopped, **signed** | governance handoff |
| A10 | GOV-04 operating point | `clinicianOnly` rate measured and **within the signed target ±5 pp** | new metric |
| A11 | **Alias-registry defect fixed** — `equivalent()` no longer collapses `FIGURE_5_COTEST_SURVEILLANCE` into `TEST_OF_CURE`; A1/A8 re-run after the fix | fix landed, suite re-run green | `tests/…/conformance-runner.ts` |

> A11 gates A1 and A8. Until it is fixed, the Figure 5 evidence underpinning GOV-02 and LEGACY-014 is not trustworthy.

## Gate group B — Router and safety (legacy retained)

| # | Gate | Threshold |
|---|---|---|
| B1 | 12 router safety probes | **12/12**, and byte-identical to production `fb933c3` output | `scripts/comparison/emit-router.ts` |
| B2 | Age-eligibility regression suite | **0 regressions** | `lib/engine/__tests__/source-router-regression.test.ts`, `age-eligibility.test.ts` |
| B3 | Routing precedence | **0 regressions** | `routing-precedence.test.ts` |
| B4 | Overlay guardrails — overlay cannot lower risk, change figure, change referral type, or remove review | **0 violations** | `overlay.test.ts` |
| B5 | **Router output identical with authority = LEGACY vs CANONICAL** — proving the authority layer cannot alter routing | **differences = 0** | new test |

## Gate group C — Adapter correctness (all new tests)

These cover the three engineering blockers. **None of these tests exists today.**

| # | Gate | Threshold |
|---|---|---|
| C1 | `repeatInterval` free-text → integer months, over **every** `timingDestination` value present in the CG-NCSP-3.1.0 snapshot | **parse coverage = 100%**; **unparsed → safety stop, never null**; **null `nextScreeningDue` on a recall-required decision = 0** |
| C2 | `referralDestination` free text → `ReferralType` enum, full snapshot coverage | 100%; unmapped → safety stop |
| C3 | Urgency (OUT-01) — regex inference **removed** from the authority path | occurrences of `inferUrgency` in the authority path = **0** |
| C4 | Adapter never de-escalates below the legacy decision (risk, priority, referral-required) | **violations = 0** |
| C5 | `matchedRuleIds[]` → single `recommendationCode` is deterministic and stable across runs | 100% deterministic |
| C6 | Missing-information fact names all resolve to a human label | **unresolved labels = 0** |
| C7 | Overlay (OUT-03) is provably inert under canonical authority, and the Admin UI says so | asserted |
| C8 | Batch fabrication (IN-03) — the eight work-up facts remain stripped under canonical authority | **fabricated facts reaching canonical = 0** |
| C9 | `currentPathway` provenance (IN-02) labelled `DERIVED_ROUTER`, never `REVIEWER_ENTRY`/`PRIOR_RECORD` | **mislabels = 0** |

## Gate group D — Persistence, history and provenance

| # | Gate | Threshold |
|---|---|---|
| D1 | **Historical records rewritten = 0** — byte-compare a full snapshot of pre-cutover `RuleEvaluation`, `BatchReviewItem`, `ScreeningSession`, `WizardSession`, `AuditLog` before and after the whole exercise | **0 rows changed** |
| D2 | Evaluation immutability triggers reject `UPDATE`/`DELETE` on an evaluated snapshot | 3/3 triggers fire |
| D3 | Regrade creates a new evaluation, sets `previousEvaluationId`, requires a reason, and **leaves the original intact** | asserted |
| D4 | Pinning — a legacy case stays legacy across an activation; a canonical case stays canonical across a rollback | **authority drift = 0** |
| D5 | Batch pinning — a run started pre-activation completes entirely on its starting authority | **mixed-authority runs = 0** |
| D6 | Export provenance (EXEC-03) — the checksum in an exported package matches the authority that produced the decision | **mismatches = 0** |
| D7 | Already-exported packages are never rewritten by a regrade; a regrade produces a new package with a superseding reference | asserted |
| D8 | Checksum verification at evaluation time rejects a tampered snapshot | rejects |

## Gate group E — Application workflows

| # | Gate | Threshold |
|---|---|---|
| E1 | Review Queue — sort, filter, count, drill-in on canonical rows | full parity with legacy rows |
| E2 | Completed Decisions — mixed legacy/canonical list renders with correct provenance badges | 100% badged |
| E3 | Batch end-to-end: upload → process → worklist → disposition → export | green |
| E4 | NCSR pull → canonical evaluation → worklist | green |
| E5 | Integrations (HL7/FHIR adapters) | green |
| E6 | Wizard end-to-end → result page → screening session → recall date | green |
| E7 | Notifications — recall notification fires on a canonical decision with a correct date | green |
| E8 | Analytics / overdue recalls with mixed-authority data | no nulls, no double counting |
| E9 | Audit Trail shows `ACTIVATION`, `DEACTIVATION`, `ROLLBACK`, `PUBLICATION`, `APPROVAL` | all present |
| E10 | **1,271 existing tests** still pass in a clean checkout | **1,271 pass, 0 fail** (any count change explained) |
| E11 | Full typecheck + lint + build | clean |

## Gate group F — Activation, rollback, permissions, concurrency

| # | Gate | Threshold |
|---|---|---|
| F1 | Full lifecycle rehearsal in `VALIDATION`: DRAFT→VALIDATED→2×APPROVAL→PUBLISHED→ACTIVE | green, all audit events present |
| F2 | **Rollback rehearsed end-to-end and timed** in `VALIDATION` | **≤ 5 minutes**, 0 records deleted, 0 records rewritten, 0 audit rows lost |
| F3 | Rollback leaves canonical-window cases pinned to canonical | asserted |
| F4 | Permissions — non-ADMIN cannot activate, publish or roll back; creator cannot approve; second approver enforced (ACT-03) | all denied |
| F5 | **Activation cache (ACT-05)** — mixed-authority window measured across ≥3 concurrent serverless instances | **= 0 s in production config**, or the measured window documented and signed |
| F6 | Concurrency — 50 simultaneous evaluations across an activation boundary | **split-brain decisions = 0** |
| F7 | Org-scoped activation — activated org gets canonical; **every other org still gets legacy** | **cross-org leakage = 0** |
| F8 | Draft optimistic-locking (`expectedRevision`) rejects a stale write | rejects |
| F9 | Missing-data safety — for every fact removed one at a time from a matched case, canonical never becomes *less* urgent | **violations = 0** |
| F10 | Conflicting-facts input → `SPECIALIST_REVIEW` stop, never a recommendation | 100% |

## Gate group G — Security and operations

| # | Gate | Threshold |
|---|---|---|
| G1 | **R6 closed**: demo accounts disabled or secrets rotated **in the production environment**, evidenced (SEC-01) | signed |
| G2 | R1–R5 risk acceptance **signed** by a named owner | 5/5 signed |
| G3 | Authenticated production-readiness QA completed | signed |
| G4 | **Database restore rehearsed**, not merely scheduled | restore succeeds, time recorded |
| G5 | **Monitors live (SEC-03)**: adapter parse-failure count; safety-stop and `clinicianOnly` rate | both emitting, alerts configured |
| G6 | Rollback trigger thresholds agreed **numerically** and published in the runbook | signed |
| G7 | Named on-call rollback operator + deputy, with contact details | named |
| G8 | Separation of duty (SEC-02) enforced at publish time | asserted |

## Gate group H — Governance sign-off

| # | Gate |
|---|---|
| H1 | GOV-04 `clinicianOnly` operating point signed |
| H2 | Regrade policy for the 26 defects signed (doc 03 HIST-03), including the look-back decision |
| H3 | **EXEC-01 / IN-02 acceptance signed**: the risk owner has acknowledged in writing that canonical is a within-pathway decision layer over a retained legacy router, and that canonical decisions are conditional on legacy routing |
| H4 | LEGACY-005/-014/-017/-026 adjudicated, or their pathways explicitly scoped out with a documented safety stop |
| H5 | The 2 input-gap adjudications closed or explicitly scoped out |
| H6 | Activation scope (which organisation, which pathways) signed |
| H7 | Pinned commit SHA recorded |

---

## Headline quantitative gates

```
Canonical regressions                        = 0
Canonical-less-urgent-than-legacy violations = 0     ← new, most important
Router regressions                           = 0
Router probes                                = 12/12
Unsafe missing-data regressions              = 0
Unexplained differences                      = 0
Table 1                                      = 21/21
Input representation                         = 18/18
Historical records rewritten                 = 0
Adapter interval parse coverage              = 100%
Null recall dates on recall-required cases   = 0
Fabricated facts reaching canonical          = 0
Cross-org authority leakage                  = 0
Mixed-authority window (production)          = 0 s
Rollback rehearsal time                      ≤ 5 min
Existing test suite                          = 1,271 pass / 0 fail
```

**Gates added beyond the brief, and why:** A5 and F9 (never-less-urgent — the brief's "0 regressions" does not by itself assert directionality, and directionality is what protects participants); A11 (the alias defect invalidates part of the existing evidence); C1/C2 (OUT-02 is the highest-consequence silent failure in the design); C8/C9 (fabrication and provenance honesty); D1 (a hard, measurable statement that nothing historical moved); F5/F6 (serverless split-brain); F7 (org scoping is the recommended strategy, so its isolation must be proven); G4/G5 (an unmeasurable rollback trigger is not a rollback plan).
