# 08 — Feasibility Report (Phase 15)

---

# VERDICT: **FEASIBLE_WITH_MINOR_ENGINEERING_CHANGES**

…**with one material qualification that changes what "the switch" means, and six hard blockers (three clinical, three engineering) that must close first.**

## The qualification, stated plainly

**CG-NCSP-3.1.0 cannot replace the legacy engine, because it is not an engine — it is a within-pathway decision layer with no router.**

`currentPathway` is a required input fact of essentially every canonical rule
(`compiled-v2-1.ts`, `successor-v3-1.ts`). Nothing in `lib/clinical-rules/`
derives it. Today it is supplied by the legacy engine's own output
(`decision.figure`) at every call site. Deleting the legacy engine deletes the
router, the age-eligibility gates (including the R1 safety fix `ea4e7e3`), and
the Figure-10 / Figure-9 / Table-1 / hysterectomy precedence chain, with no
canonical substitute for any of it.

The 179-case result and the "0 canonical regressions" figure are **valid for the
decision layer** and were measured with `currentPathway` supplied. They are not
evidence that canonical can route. The 12 router probes explicitly test *legacy*.

**What is feasible — and it is genuinely valuable — is:** legacy retains routing
and age gates; canonical becomes the authority for the recommendation *within*
the pathway legacy selected. That delivers the 31 corrections, the 22 defect
fixes, 21/21 Table 1, and full version/checksum provenance, without giving up
the router safety fixes.

**Nobody should sign a document that says "canonical replaced legacy". It did not, and it cannot today.**

---

## The ten answers

### 1. Can the existing application remain?
**Yes.** Command Centre, Pull Cases, Review Queue, Completed Decisions, Audit Trail, Operational Analytics, Pilot Readiness, Rule Governance, Guidelines, Admin, NCSR, integrations and automation all remain. No screen removed, no workflow redesigned. The adapter preserves the `ClinicalDecision` shape the whole app consumes.

### 2. Can the legacy rules be replaced underneath it?
**Partially, and that is the correct answer.** The legacy *decision content* can be replaced by canonical. The legacy *router and age gates* must be retained. This is a feature, not a compromise: the router is where the R1 safety fix lives.

### 3. Minimum engineering changes
Two new files, three changed call sites, eight fixes.

**New (2):** `lib/clinical-rules/authority.ts` (`resolveClinicalAuthority`, thin wrapper over the existing `resolveActiveClinicalRuleVersion`, **defaults to LEGACY when no activation exists**); `lib/clinical-rules/decision-adapter.ts` (`canonicalToClinicalDecision`, with a never-de-escalate guardrail).

**Changed call sites (3):** `app/api/pathway/sessions/[id]/complete/route.ts:128`; `lib/batch/processor.ts:154`; `app/api/rules/evaluate/route.ts:26`.

**Fixes (8):** ACT-01 remove the production activation guard (own commit); OUT-01 remove regex urgency from the authority path; OUT-02 interval parser with safety-stop-on-failure; OUT-03 overlay inert under canonical + notice; IN-02 `DERIVED_ROUTER` fact source; EXEC-03 export provenance; ACT-05 cache TTL 0 in production; A11 alias-registry fix.

**No clinical logic is duplicated. No second router is created. One authority-selection layer.**

### 4. Database changes
**One additive migration:** `ALTER TYPE "RuleEvaluationMode" ADD VALUE 'LIVE_PRODUCTION'`. Non-destructive, no backfill, no table rewrite.

Everything else is already there: `RuleSetActivation` (org-scoped, with global fallback), `RuleEvaluation` (immutable, checksummed, regrade-chained), `BatchRun.pinnedRuleVersion*`, `WizardSession.ruleEvaluationId`, `BatchReviewItem.ruleEvaluationId`, `RuleVersionAuditEvent`, three immutability triggers. **The governance schema is genuinely well built and needs no redesign.** *(No migration was created.)*

### 5. UI changes
**Six additive components, one notice.** Active-ruleset indicator; per-decision provenance badge (highest priority — the queue will hold both authorities at once); missing-information fact-name→label rendering; regrade action + indicator; activation/rollback control; three-way safety-stop reviewer warning. Plus a notice if the guideline overlay is disabled under canonical. No redesign.

### 6. Governance decisions required
GOV-04 `clinicianOnly` operating point (**hard blocker**); regrade policy for the 26 defects incl. the look-back decision (**hard blocker**); written acceptance that canonical is a conditional within-pathway layer (**hard blocker**); GOV-01/-02/-03 and LEGACY-014/-017/-026 and the 2 input-gap cases (pathway-limited — a scoped activation is possible without them); second-approver policy (ACT-03); separation of duty (SEC-02); activation scope. **No clinical question was decided in this assessment.**

### 7. Security blockers
The three gates are different. **Merging code:** nothing blocks it. **Deploying:** R1, R2, R4 (unsigned, runtime), R6, authenticated production QA, backup/restore evidence. **Activating clinical authority:** all of the above plus R6 *confirmed closed in the production environment, not merely hidden from the login page* (SEC-01), separation of duty (SEC-02), and the two monitors (SEC-03) — without which the rollback triggers are unmeasurable and the rollback plan is decorative.

### 8. Recommended cutover strategy
**Organisation-scoped activation (Option 3) + new-cases-only pinning (Option 4)**, scoring 35/40 against 19 for hard cutover. Sequence: `VALIDATION` → one pilot organisation in `PRODUCTION` → observation → progressive org-by-org expansion → global. Uses `RuleSetActivation.organisationKey`, which already exists with global fallback — **zero extra code for the scoping itself**. Requires establishing a real `organisationKey` for the pilot (data/config, not schema).

### 9. Rollback strategy
`Canonical ACTIVE → Legacy ACTIVE` for new evaluations only, via the existing governed `activateClinicalRuleVersion({ rollback: true })` path. **≤5 minutes**, 0 s cache window once ACT-05 is fixed. No deploy, no restore, no migration, no deletion, no rewriting of completed decisions, no loss of audit history. Cases decided during the canonical window **remain pinned to canonical** and are handled by clinical safety-netting, never by bulk regrade. Create the `CG-LEGACY-1.0.0` pin version (ACT-04) so rollback has a real, auditable target. **Rollback must be rehearsed and timed in `VALIDATION` before production activation.**

### 10. Engineering effort by component

Estimates in **engineer-days**, one senior full-stack engineer familiar with this codebase. Ranges are low / expected / high. Clinical adjudication and governance sign-off are **elapsed** time on other people and are excluded from the engineering total.

| Component | Work | Low | **Expected** | High |
|---|---|---:|---:|---:|
| **Engine / adapter** | `authority.ts`; `decision-adapter.ts`; never-de-escalate guardrail; OUT-01 urgency; OUT-02 interval parser + destination mapping; OUT-03 overlay inertness; ACT-01 guard removal; ACT-05 cache | 6 | **9** | 14 |
| **Data mapping** | `previousCytologyClass` re-classification; treatment/margin decomposition; longitudinal counts→stage enums; IN-02 `DERIVED_ROUTER`; IN-03 fabrication guards; fact-name→label dictionary wiring | 4 | **6** | 9 |
| **Persistence** | authority pinning at first evaluation; batch run-level pinning; regrade wiring; EXEC-03 export provenance; ACT-04 legacy pin version | 3 | **5** | 8 |
| **UI** | 6 components + overlay notice; provenance badges across Review Queue, Completed Decisions, detail, export | 5 | **8** | 12 |
| **Tests** | ~45 new tests across doc 06 groups A5, A11, B5, C1–C9, D1–D8, F2–F10; A11 alias fix + re-run of A1/A8 | 7 | **11** | 16 |
| **Migration** | one additive enum value + verification | 0.5 | **0.5** | 1 |
| **Deployment** | environment config, production activation token, `VALIDATION` environment setup | 1 | **2** | 3 |
| **QA** | full acceptance suite execution; authenticated production-readiness QA; rollback rehearsal; restore rehearsal; monitors (SEC-03) | 5 | **8** | 12 |
| **Governance preparation** | evidence packs, runbook finalisation, approval workflow (ACT-03/SEC-02), reviewer communications — *engineering support only* | 3 | **4** | 6 |
| **Engineering total** | | **34.5** | **53.5** | **81** |

≈ **11 engineer-weeks expected** (≈7 low, ≈16 high) for one engineer; roughly **5–6 calendar weeks** with two engineers working in parallel on engine/adapter and UI/tests.

**Excluded, and on the critical path regardless of engineering:** clinical adjudication of GOV-01…GOV-04 and LEGACY-005/-014/-017/-026 and the 2 input-gap cases; the regrade look-back decision; R1–R6 risk signatures. **These are likely to dominate the schedule.** GOV-04 in particular is not a small question: deciding the clinician-only operating point may require re-deriving parts of the ruleset, which would add engineering not costed above.

---

## Exact implementation phases

| Phase | Content | Gate to exit |
|---|---|---|
| **P0 — Evidence integrity** | Pin the SHA. Fix A11 alias defect. Re-run A1/A8. Add the A5 never-less-urgent assertion. | Existing evidence is trustworthy |
| **P1 — Governance track** *(parallel, starts now, likely the long pole)* | GOV-01…04, LEGACY-005/-014/-017/-026, 2 input-gap cases, regrade policy, EXEC-01/IN-02 acceptance, R1–R6 signatures | H1–H7 signed |
| **P2 — Authority layer** | `authority.ts` + `decision-adapter.ts` + 3 call sites. **Defaults to LEGACY — zero behaviour change on deploy.** | B5 green; production byte-identical to today |
| **P3 — Adapter correctness** | OUT-01, OUT-02, OUT-03, IN-02, IN-03, EXEC-03 | C1–C9 green |
| **P4 — Persistence & pinning** | pinning, batch pinning, regrade wiring, ACT-04 legacy pin version | D1–D8 green |
| **P5 — UI** | 6 components + notice | E1–E11 green |
| **P6 — Activation enablement** | ACT-01 (own commit), ACT-03, ACT-05, migration, SEC-02, SEC-03 monitors | F1–F10, G1–G8 green |
| **P7 — Rehearsal** | full acceptance suite in `VALIDATION`; **rollback rehearsed and timed**; restore rehearsed | F2 ≤5 min; G4 green |
| **P8 — Pilot activation** | doc 07 runbook, one organisation | T+24h review |
| **P9 — Expansion** | org-by-org, then global | metrics accepted per org |

P2 is the safest possible first shipment: it introduces the switch **in the off position** and proves production is unchanged.

---

## Residual risks after cutover

| Risk | Severity | Mitigation |
|---|---|---|
| Canonical decisions are conditional on legacy routing — a router defect is inherited silently | **HIGH** | H3 written acceptance; B1/B5 gates; retain and keep testing the router suite |
| GOV-04 over-restriction erodes automation to near zero | **HIGH** | signed operating point; A10 monitor; capacity-based rollback trigger |
| Adapter interval-parse failure → participant never recalled | **HIGH** | C1 100% coverage; safety-stop on failure; cron monitor; any-occurrence rollback trigger |
| 4 unadjudicated legacy defects remain live | **MEDIUM** | scoped activation with pathway safety stops |
| Historical cohort keeps 22 uncorrected defects | **MEDIUM** | signed regrade policy; simulation-mode cohort report; explicit look-back decision |
| Two engines in one reviewer queue causes confusion | **MEDIUM** | provenance badges (UI #2); reviewer briefing |
| 2 input-gap states remain unrepresentable | **MEDIUM** | fail-safe (stop, no fabrication); adjudicate |
| `RuleDecision` upsert overwrites recommendations (HIST-01) | **MEDIUM** | separate defect, separate fix, different rules stack |
| No tamper-evidence on `AuditLog` | **LOW-MEDIUM** | pre-existing; raise separately |
| 30 s mixed-authority window if ACT-05 unfixed | **LOW** once fixed | TTL 0 in production; F5 gate |
| R1–R5 dependency risks | **LOW-MEDIUM** | signed acceptance; patch schedule |

---

## Final position

The governance architecture already in this codebase — immutable checksummed evaluations, a real DRAFT→ACTIVE lifecycle, enforced creator≠approver, org-scoped activations with global fallback, an audited regrade chain, and a production activation guard that currently refuses to fire — is **better than most systems that have already made a change like this**. The switch is small, the schema is ready, and the recommended first shipment (P2, switch in the off position) is close to risk-free.

The work that remains is mostly **not** engineering. It is deciding the clinician-only operating point, deciding what is owed to participants already decided under 26 known-defective rules, and writing down honestly that canonical decides *within* a pathway that legacy still chooses. Those three should start now, in parallel with P0–P2.

---

## Compliance confirmation

**No rule publication, no rule activation, no production deployment, no push to `main`, no authority switch, and no historical regrade occurred during this assessment.**

- CG-NCSP-3.1.0 remains **DRAFT, unpublished, inactive**; 0 publications, 0 activations.
- No `RuleEvaluation`, `BatchReviewItem`, `ScreeningSession`, `WizardSession`, `RuleDecision` or `AuditLog` row was created, read for modification, or altered.
- No migration was created or run. No schema was changed.
- No application code was modified. No branch was merged, pushed or deleted.
- No credential was read, entered, printed or committed.
- Actions taken were: read-only `git` inspection; creation of a temporary read-only worktree of `integration/rule-studio-on-latest-main` at `ab1eb0e` in the session scratchpad; reading source and documentation; writing the eight planning documents under `docs/canonical-cutover/`.
- Nothing was committed.
