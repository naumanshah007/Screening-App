# 16 — Activation Readiness Pack

**Prepared:** 9 August 2026. **Branch:** `feat/canonical-authority-layer` at `31b8790`. **`origin/main`:** `578b4b0` — unchanged, 82 commits behind this branch.

**Canonical clinical authority remains OFF.** CG-NCSP-3.1.0 is DRAFT, unpublished, inactive, SHADOW/SIMULATION only. Nothing in the preparation of this pack activated anything, changed a clinical rule, touched Production, or wrote to any database. This is a synthesis of the evidence already recorded across docs 01–15 plus the router remediation landed today, assembled into a single go/no-go instrument. Where a document below is cited, this pack does not repeat its detail — it points at it.

---

## 1. Current architecture

```
 real request
      │
      ▼
 legacy router (lib/engine/decision-engine.ts, evaluateClinicalDecision)
      │  — age eligibility gates
      │  — Figure selection
      │  — Figure 10 / Figure 9 / Table 1 / hysterectomy precedence chain
      │  — this layer is retained PERMANENTLY, in every scenario below
      ▼
 pathway resolved (currentPathway / currentFigure)
      │
      ▼
 resolveClinicalAuthority()  (lib/clinical-rules/authority.ts)
      │  — which engine's recommendation is authoritative for THIS pathway
      ▼
   ┌──────────────┴──────────────┐
   ▼                             ▼
 LEGACY recommendation      CANONICAL recommendation
 (business-figures-table1-v1)   (CG-NCSP-3.1.0, within-pathway only)
```

**This is not, and cannot become, a full replacement of the legacy router.** CG-NCSP-3.1.0 has no router of its own — `currentPathway` is one of its *required input facts*, sourced from the legacy engine's own routing decision (`lib/engine/decision-engine.ts` → `evaluateClinicalDecision().figure`). Canonical only ever answers "given this pathway, what is the recommendation" — it cannot answer "which pathway applies." Every future state of this system, including full activation, keeps the legacy router in the request path. What activation changes is a single downstream question: whether the *within-pathway* recommendation comes from legacy or from canonical.

This was the most consequential finding of the original feasibility assessment (`docs/canonical-cutover/01-current-execution-architecture.md`, `08-feasibility-report.md`) and remains true today. **Any framing of activation as "switching to the new rules engine" is inaccurate and must not be signed.**

Reference implementation: `lib/clinical-rules/authority.ts` (resolver), `lib/clinical-rules/decision-adapter.ts` (canonical→legacy-shape adapter, four hard rules: routing never adapted, never de-escalate, no prose interpreted, no invented clinical information), `lib/clinical-rules/pinning.ts` (per-case authority pin, §8 below).

---

## 2. Current ruleset status

| Property | Value | Verified how |
|---|---|---|
| Version | `CG-NCSP-3.1.0` | `ClinicalRuleVersion.displayVersion` |
| Lifecycle status | **DRAFT** | no `publishClinicalRuleVersion` or `activateClinicalRuleVersion` call has ever been made against this database from this work |
| Evaluation mode of every stored evaluation | **SHADOW** or **SIMULATION** | `legacyAuthority()` in `authority.ts` hardcodes `evaluationMode: "SHADOW"` on every non-canonical resolution path; canonical evaluations outside a live activation are `SIMULATION` |
| Published | No — 0 publications | `12-pre-activation-engineering-verification.md` §4 |
| Activated (any environment) | No — 0 activations | same |
| `LIVE_PRODUCTION` evaluations in existence | **0** | the mode is structurally unreachable: code blocker (§7) + no activation exists + `CLINICAL_AUTHORITY_LIVE_PRODUCTION` unset |
| Historical decisions modified by canonical work | **0** | no database connection opened during design/engine work; DB-backed suite (`tests/db`, 28/28) runs only against throwaway test databases |
| Production deployment of this branch | **none** | not pushed to `origin/main`; no Vercel deployment created from it |

**In plain terms: nothing a clinician sees on a real case today comes from CG-NCSP-3.1.0.** Every canonical evaluation that exists anywhere is a shadow comparison artefact, explicitly labelled non-authoritative in the UI (`components/clinical-rules/AuthorityComparison.tsx`), and every review action, every stored recommendation, and every recall schedule for real participants is decided by the legacy engine exactly as it is today in production.

---

## 3. Router remediation

Landed today, commit `31b8790`, full technical detail in `docs/integration/05-router-defect-register.md` (updated in the same commit) and `lib/engine/__tests__/source-router-regression.test.ts`.

### ROUTER-003 — real defect, fixed

| | |
|---|---|
| **Defect** | `"SCC"` (malignant squamous cytology) was absent from `FIGURE_9_QUALIFYING_CYTOLOGY` while present in `isHighGradeCytology`. A pregnant participant with malignant cytology failed the Figure 9 gate, fell through to Figure 3, and was asked for an HPV result instead of being escalated. |
| **File / line** | `lib/engine/decision-engine.ts` — the `FIGURE_9_QUALIFYING_CYTOLOGY` constant |
| **Fix** | Added `"SCC"` to the list. Malignant cytology cannot be the one value in that list that does not qualify. |
| **Before** | `F9-QUALIFYING-CYTOLOGY-REQUIRED` (asks for an HPV result; no escalation) |
| **After** | Routes to Figure 9 → `F9-INITIAL-COLPOSCOPY` — HIGH, referral required, priority **P1** |
| **Tests** | `router: pregnancy with malignant cytology routes to the pregnancy pathway and escalates` — now unconditional (was `todo`) |
| **Residual difference** | Canonical `F9-14` specifies *"urgent experienced colposcopy and oncology/MDT"*. Legacy now escalates to colposcopy but does not express the oncology/MDT element. `PREGNANCY-MALIGNANT-CYTOLOGY` in `lib/clinical-rules/__tests__/shadow-comparison.test.ts` remains an explicit, asserted divergence — updated to pin the narrowed gap at `F9-INITIAL-COLPOSCOPY`, not deleted. **Closing this residual is a clinical decision (§4, §5), not an engine edit.** |

### ROUTER-002 — real defect, mis-located in the original register, fixed

| | |
|---|---|
| **Original claim** | "Missing sample type resolves to `F3-HPV-NOT-DETECTED-5Y`, a terminal 5-year interval." Re-probed and found **false as stated**: sample type does not fork the HPV-not-detected branch at all — LBC, swab, and unknown all correctly return the same 5-year recall. |
| **Actual defect** | LEGACY-006's own source expectation is *"request sample type before deciding whether cytology is available or a return visit is required."* That decision point is **HPV Other with no cytology result yet**: an LBC sample is asked for cytology; a self-collected swab is sent for a return visit with clinical examination. With the sample type unknown, the engine defaulted to asking for a cytology result that a self-collected swab **cannot physically produce**. |
| **File / line** | `lib/engine/decision-engine.ts`, `evaluateFigure3`, the `hpvResult === "HPV_OTHER"` / `!cytologyResult` branch |
| **Fix** | Where HPV Other has no cytology yet and sample type is unknown, return `F3-SAMPLE-TYPE-REQUIRED` before the cytology request. Scoped precisely: a cytology result already present proves clinician-taken, so nothing is asked; the HPV-not-detected branch is untouched. |
| **Tests** | `router: HPV Other with no cytology must not request a result a swab cannot produce`, `router: an existing cytology result is not blocked by a sample-type request`, `router: HPV not detected returns to routine recall for either sample type` |
| **Self-correction on record** | An earlier, broader version of this fix fired before the high-grade-cytology check and would have delayed a colposcopy referral behind a sample-type question. `lib/engine/__tests__/figure3.test.ts` caught it (`Figure 3 baseline HPV Other with ASC-US/LSIL schedules first repeat` failed) and the fix was narrowed to the correct branch. Recorded so the review trail shows the mistake and the catch, not just the final diff. |

### ROUTER-001 — not a defect; closed with no engine change

| | |
|---|---|
| **Original claim** | "Omitting an age that changes the ≥50 branch produces the same terminal action as supplying it." |
| **Re-analysis** | The age ≥50 fork lives at `FIRST_REPEAT`, not at baseline. Probed directly at both: at baseline the source gives every age the identical 12-month repeat (`F3-HPV-OTHER-NEG-ASCUS-LSIL-12M`), so the original test compared two states the guideline defines as the same. At `FIRST_REPEAT`, the engine **already** returns `F3-FIRST-REPEAT-AGE-REQUIRED` when age is absent. |
| **Engine change** | **None.** |
| **Tests** | The existing test was retargeted to `FIRST_REPEAT`, where the fork actually is. A second test pins the baseline behaviour (`router: at baseline, HPV Other with negative cytology does not depend on age`) so a future reader does not "fix" a non-defect by adding an age prompt the source does not call for. |

### Post-remediation suite state

| Metric | Before today | After today |
|---|---|---|
| Router probes | 17 | 20 |
| Marked `todo` | 3 | **0** |
| Whole suite | 1,441 tests / 6 todo / 0 fail | **1,447 tests / 0 todo / 0 fail** |

No assertion was relaxed to reach this state. Two tests were retargeted to the branch point they claim to test; both retargets are documented above, and the previous (correct) behaviour at the original probe point is now itself pinned by an additional test.

---

## 4. Clinical sign-off table

Every clinical behaviour change made in service of this readiness pack. **Neither row is approved. Both require a named clinical signature before either fix is treated as clinically endorsed** — the engine changes are made from the source expectations recorded in the defect register (§3), which is an engineering reading of a written guideline, not a clinical authority.

| # | Old behaviour | New behaviour | Guideline / source basis | Affected pathways | Safety impact | Clinical approver required | Approval status |
|---|---|---|---|---|---|---|---|
| 1 | Pregnant participant with malignant (SCC) cytology asked for an HPV result via Figure 3 (`F9-QUALIFYING-CYTOLOGY-REQUIRED`); no escalation | Routes to Figure 9, HIGH risk, colposcopy referral required, priority P1 (`F9-INITIAL-COLPOSCOPY`) | Figure 9 qualifying-cytology list; `SCC` is present in the engine's own `isHighGradeCytology` classification and absent only from this one gate | Figure 9 (pregnancy pathway) | **Strictly more urgent** — closes a defect that was under-escalating a malignant-cytology pregnant participant | Clinician holding `rules:approve` (CLINICAL_LEAD / SMO or equivalent, `lib/auth/permissions.ts`) | **UNSIGNED** |
| 2 | HPV Other, no cytology yet, sample type unknown → asked for a cytology result | Same state → asked to confirm sample type first (`F3-SAMPLE-TYPE-REQUIRED`), so a self-collected swab is correctly routed to its return visit rather than asked for cytology it cannot produce | LEGACY-006 source expectation, quoted verbatim in `docs/rule-studio/24-legacy-defect-governance-pack.md`: *"request sample type before deciding whether cytology is available or a return visit is required"* | Figure 3 (HPV Other, baseline and first-repeat cytology-pending states) | **Neutral-to-safer** — adds one clarifying question; no path becomes less urgent; the not-detected branch (the vast majority of Figure 3 traffic) is unaffected | Clinician holding `rules:approve` | **UNSIGNED** |

**Explicitly not in this table:** the residual ROUTER-003 oncology/MDT gap (row 1's known incompleteness — see §5), and every pre-existing GOV-01…04 / LEGACY-005/-014/-017/-026 item, none of which was touched by this work and all of which remain open per §5.

---

## 5. Known unresolved adjudications

Carried forward, unchanged by this pack, from docs 04, 05, 12, 15. Nothing below was decided in preparing this pack — restating them here is what makes this a complete package rather than a partial one.

### Malignant cytology / oncology-MDT residual (new, from §3/§4)
Canonical `F9-14` specifies escalation **and** oncology/MDT involvement for pregnancy with malignant cytology. Legacy, even after today's fix, escalates but does not express the MDT element. **Decision needed:** add an oncology/MDT trigger to the legacy Figure 9 malignant-cytology branch, accept the documented divergence as a canonical-only improvement, or defer to the canonical cutover itself.

### Pre-existing clinical differences requiring a clinician decision
| Item | Nature | Doc |
|---|---|---|
| GOV-01 | Confirmed ASC-H, Type 1/2 TZ, no visible lesion — Figure 4/5 colposcopy branch | `05` |
| GOV-02 | Figure 5 observation → reassuring six-month results | `05` |
| GOV-03 | First vs second consecutive low-grade cytology during Test of Cure (Figure 6) | `05` |
| GOV-04 | **The operating-point decision.** Canonical requires `clinicianOnly` on 152/179 corpus cases (source oracle requires it on 53/179) — 99 over-restrictions, 0 under-restrictions, fail-safe direction. Combined with only **20/203 rules (9.9%)** permitting a machine-generated recall date, canonical authority delivers near-zero automation at today's settings. Not a safety question — a reviewer-capacity question that must be signed with a number attached. | `05`, `15` §6 |
| LEGACY-005 | `F3-CYTOLOGY-PENDING-INCOMPLETE` — canonical is *more* conservative; open question is the historical cohort, not forward safety | `05` |
| LEGACY-014 | Figure 5, canonical produces `UNMAPPED_ACTUAL` | `05` |
| LEGACY-017 | Figure 7, `F7-NO-LESION-AG2-CONFIRMED-INVESTIGATE` → GYNAECOLOGY | `05` |
| LEGACY-026 | Figure 9 pregnancy, `F9-NORMAL-TZ-MDM-CONFIRMS-HIGH-GRADE-REVIEW` → MDM_REVIEW | `05` |
| 2 input-gap adjudications | Stage-1A1 states; non-cervical-cancer hysterectomy overlay — states the deployed contract cannot express. No mapping invented; absent → safety stop | `05` |
| Regrade policy for 26 defects | 22 corrected forward, 4 open; **all regrade-impacting**; required **before**, not after, activation | `03` (HIST-03), `05` |

### Timing / governance issues
- **MISS-01** — `UNKNOWN`, `NOT_RECORDED`, `NOT_APPLICABLE`, `PENDING` all share one `factsMissing` channel. Evaluation outcome is identical (fail-safe safety stop) for all four, so no clinical interpretation currently changes — but a reviewer cannot tell from the evaluation which of the four applies, and `NOT_APPLICABLE` chased as if missing wastes reviewer effort. Classified **engineering, non-blocking for activation, blocking for reviewer usability at scale**. Belongs with the missing-information label work (C6), still outstanding. (`15` §7)
- **C6** — missing-information fact names need human labels (e.g. `preTreatmentHpvGenotype` → "Pre-treatment HPV genotype"). Not done. Every safety stop is unactionable to a reviewer without it. (`05`, `12`)
- **9.9% auto-schedulable recall** (§ above) is itself a timing/governance issue: `ScreeningSession.nextScreeningDue`, recall generation, overdue-recall analytics and recall notifications all depend on a machine-generated date that canonical can supply for only 20 of 203 rules. This is fail-safe (an explicit clinician-determination stop, never a silent null) but is a capacity question that compounds with GOV-04.

### Second-approver policy (ACT-03)
`ClinicalRuleVersion` has exactly one `approvedById`, and creator≠approver is enforced (`lifecycle.ts:297`) — but that is the *only* separation of duty. One ADMIN can approve someone else's draft, publish it, and activate it, alone (`SEC-02`, doc `05`). **Recommendation on record, not yet implemented or policy-adopted:** require two independent clinical approvers plus an activating operator distinct from both, enforced as a convention over two `APPROVAL` `RuleVersionAuditEvent` rows from distinct `actorUserId`s at publish time. No schema change needed. **Status: recommended, unadopted, unenforced in code today** — nothing currently stops single-approver publication.

---

## 6. Production infrastructure readiness

**This section cannot be completed from this environment, and that is itself the finding.**

### What is known from the repository

`lib/config/database.ts` resolves the database URL in this order:

```
DATABASE_URL  →  TURSO_DATABASE_URL  →  (Vercel only) file:/tmp/cervical-screening-v2.db  →  local file
```

If Production has neither `DATABASE_URL` nor `TURSO_DATABASE_URL` set to a remote `libsql://` (or `https://`/`wss://`) endpoint, it silently falls back to `/tmp`, which on Vercel's serverless model is **ephemeral and per-instance**. Two concurrent requests can land on two different instances with two different, disconnected databases — a split-brain that would be disqualifying for canonical activation on its own, independent of any clinical-rule question.

### Exact backend type — cannot be determined from the repository

`getDatabaseRuntimeSummary()` (`lib/config/database.ts`) reports `mode: "remote-libsql" | "local-file"` and `authConfigured: boolean` at runtime, without exposing the URL or token — this is the correct non-secret-leaking way to answer the question, and it already exists in the code. **It has not been read against Production**, because doing so requires either Vercel dashboard access or an authenticated request against `screening.privexa.co` that this session does not have and will not obtain (no password entry, no credential use — per the standing constraint in force throughout this engagement).

### Prove repeated requests hit shared persistent storage — procedure specified, not executed

The non-destructive verification this pack recommends, once authorised:

1. Add (or confirm the existence of) a diagnostic endpoint that returns `getDatabaseRuntimeSummary()` — mode and `authConfigured` only, never the URL or token — plus a request-scoped instance identifier (e.g. a process-start timestamp or cold-start nonce).
2. Issue **N ≥ 10 sequential requests** to that endpoint against `screening.privexa.co`, spaced to encourage cold starts (the split-brain window is exactly the multi-instance case).
3. Confirm `mode` is `remote-libsql` on every response — if any response reports `local-file`, Production is running on ephemeral storage and canonical activation is disqualified regardless of every other gate.
4. As a stronger proof: write one additive, harmless row (a diagnostic ping row in a table created for this purpose, never touching clinical data) from one request, and confirm it reads back from a **different** request/instance. This is the same method that surfaced the earlier Preview-environment split-brain evidence referenced in prior sessions of this engagement, applied here to Production instead of Preview.
5. **Do not run step 4 against Production without your explicit authorisation in that moment** — this pack specifies the method; it does not execute it.

### Confirm activation/pinning data survives instance changes

Directly dependent on the result above. If Production is confirmed `remote-libsql`, `RuleSetActivation` and `RuleEvaluation` rows are ordinary durable rows in that store and survive instance recycling by construction — no additional proof needed beyond confirming the backend. If Production is on `/tmp`, this cannot be true under any code change short of fixing the backend, and the question is moot until that is fixed.

### Status: **UNKNOWN — BLOCKING.** No Production data was read, written, or modified in preparing this pack.

---

## 7. Activation mechanics

Three independent conditions, **all three required simultaneously**. None is sufficient alone; this is deliberate (`authority.ts` docstring, `lifecycle.ts` docstring).

| # | Condition | Where | Current state |
|---|---|---|---|
| 1 | **Code blocker removed.** `assertProductionActivationPermitted()` in `lib/clinical-rules/lifecycle.ts` throws unconditionally when `environment === "PRODUCTION"`. It is called from every code path that creates a `RuleSetActivation`. | `lib/clinical-rules/lifecycle.ts:382-392` | **PRESENT — blocking.** Confirmed still throwing today. Designed so the future enabling change is a single-purpose, single-function diff, reviewable at a glance. |
| 2 | **A PRODUCTION `RuleSetActivation` row exists**, `isDefault: true`, `deactivatedAt: null`, pointing at a `ClinicalRuleVersion` with `status: "ACTIVE"` and a non-null `checksum`. | `authority.ts` gates 2–4 | **Does not exist.** 0 activations of any kind exist (§2). |
| 3 | **`CLINICAL_AUTHORITY_LIVE_PRODUCTION` environment variable explicitly set** to one of `1`/`true`/`yes`/`on`. Absence, or any other value, resolves to legacy. | `isLiveProductionAuthorityEnabled()`, `authority.ts:78-82` | **Unset in Production** (per the standing engagement rule that this value has never been changed; not independently re-verified in this pack, per §6's constraint on Production access). |

**Any one of the three being false is sufficient to keep authority at LEGACY.** The resolver's own failure path (`authority.ts:150-202`) additionally defaults to legacy on a missing rule set, a missing activation, a database error, or an activated-but-non-ACTIVE version — there is no code path from "something went wrong" to "canonical became authoritative."

**Prerequisite to condition 1 (code blocker removal) itself:** per `lifecycle.ts`'s own docstring, removing the blocker requires the governance and security gates in `docs/canonical-cutover/05-governance-and-security-gates.md` to be signed. §13 of this pack enumerates exactly which of those are still open.

---

## 8. Case pinning

Already fully implemented, requires no schema change, and was not modified in preparing this pack. Reference: `lib/clinical-rules/pinning.ts`.

- **Every case is pinned to the authority in force at its FIRST clinically operative evaluation.** `getCaseAuthorityPin()` reads the earliest `RuleEvaluation` with `evaluationMode IN (LIVE_DEMO, LIVE_PRODUCTION)` for the case; `SHADOW` and `SIMULATION` evaluations never pin, by construction (`isOperativeMode()`).
- **New cases use the currently active authority.** `applyPin()` is the enforcement point: if a case already carries a pin, that pin wins regardless of what the current activation says (`pinned: true`, resolved authority discarded). A case with no operative evaluation yet is unpinned and takes the live-resolved authority, which is the act that establishes its pin.
- **Explicit regrade creates a new immutable evaluation and never touches the original.** `RuleEvaluation` rows are immutable (three DB triggers enforce this at the database level, `15` §3). A regrade carries `previousEvaluationId` and a mandatory `regradeReason`; the original evaluation's provenance is untouched.
- **No historical overwrite is possible.** An activation or a rollback changes what `resolveClinicalAuthority()` returns for a *new* resolution; it cannot and does not rewrite any stored `RuleEvaluation`. This was the subject of `D1` (historical records rewritten = 0) in the acceptance plan and is asserted by the DB-backed suite (`tests/db`, 28/28 passing, `15` §2).
- **Batch runs pin at the run level**, not per-case, deliberately: `getBatchRunAuthorityPin()` ensures a reviewer working one worklist never sees two engines mixed in one screen, even if an activation changes mid-run.

---

## 9. Rollback procedure

Full detail: `docs/canonical-cutover/04-activation-and-rollback-design.md` §6.3 step 5, `07-cutover-runbook.md` "Rollback decision point."

**Deactivate canonical.** `OPS` executes:
```
activateClinicalRuleVersion({
  id: <legacy pin version id, "CG-LEGACY-1.0.0">,
  environment: "PRODUCTION",
  organisationKey: <scope>,
  rollback: true,
  reason: <required, non-empty>
})
```
This runs through the same governed lifecycle path as any activation, inside one transaction: the canonical activation gets `deactivatedAt`, the legacy pin version becomes the active `RuleSetActivation`, and a `ROLLBACK` audit event is written.

- **New cases return to legacy** the moment the transaction commits — `resolveClinicalAuthority()` re-reads the activation table on every call (no cache, `authority.ts:116-121`), so there is no propagation delay across instances by design.
- **Cases evaluated during the canonical window stay pinned to canonical** — pinning (§8) is unconditional on the *current* activation state; a rollback does not, and structurally cannot, move an existing pin. This is deliberate: the participant's original decision provenance must never appear to have silently changed.
- **No restore, no migration, no redeploy, no restart.** The deployed code stays deployed; only the authority activation row moves. This was a deliberate design constraint (`04`) precisely so rollback is an application-level action, not an infrastructure incident.
- **0 records deleted, 0 rewritten, 0 audit rows lost** — verified requirement in the runbook's post-rollback checklist.

**Target RTO: ≤5 minutes**, from trigger decision to a new resolution returning LEGACY. This target has **not yet been rehearsed end-to-end** in a live `VALIDATION` environment — the runbook (`07`, step 6) requires this rehearsal at T-7 days before any activation, with the wall-clock time recorded, and explicitly instructs: *"if it exceeds 5 minutes, stop and fix before proceeding."* **Status: unrehearsed.**

**Verification steps after any rollback (from the runbook):**
1. Confirm a new evaluation now resolves to LEGACY.
2. Confirm cases decided during the canonical window remain pinned to canonical and were not altered.
3. Confirm 0 records deleted, 0 rewritten, 0 audit rows lost.
4. Notify reviewers immediately that authority has reverted and what that means for cases already in their queue.
5. Identify the affected cohort by `ruleVersionId` + `evaluatedAt` range (both indexed) and hand it to clinical safety-netting. **Do not bulk-regrade.**
6. Do not re-activate the same day. Root-cause first, fix, re-run the full acceptance suite against a new pinned SHA, re-sign, and re-enter the runbook at T-7.

**Rollback triggers** (any one, not a discussion — automatic): canonical less urgent than legacy on identical facts (any 1 case) · adapter parse failure (any 1) · null recall date on a recall-required decision (any 1) · cross-organisation authority leakage (any 1) · clinician-reported harm or near-miss (any 1) · safety-stop rate above the signed operating point · error rate above baseline · discretionary call by the clinical risk owner or on-call clinical lead, at will.

---

## 10. Pre-activation test evidence

| Suite | Tests | Pass | Fail | Todo |
|---|---:|---:|---:|---:|
| `lib/engine` (router regression + unit) | 155 | 155 | 0 | 0 |
| `lib/batch` | 216 | 216 | 0 | 0 |
| `lib/clinical-rules` (rules, shadow comparison, governed vocabulary) | 983 | 983 | 0 | 0 |
| `lib/engine/__tests__/source-router-regression.test.ts` (router suite, subset of the above) | 20 | 20 | 0 | 0 |
| `tests/security` | 20 | 20 | 0 | 0 |
| `tests/clinical-conformance` (179-case semantic corpus) | 6 | 6 | 0 | 0 |
| `tests/db` (DB-backed authority, 14/14 scenarios; pinning; rollback history) | 28 | 28 | 0 | 0 |
| `tests/ui` (structural — authority never hidden, never mislabelled) | 19 | 19 | 0 | 0 |
| **Total** | **1,447** | **1,447** | **0** | **0** |

`npx prisma generate` ✓ · `tsc --noEmit` clean ✓ · `eslint --max-warnings=100` 0 errors, 20 pre-existing warnings ✓ · `npm run build` compiled successfully ✓.

**Table 1 coverage:** 21/21 (`15` §3). **Input representation:** 18/18 (`15` §3).

**Shadow comparison results:** every registered comparison case renders both recommendations, labels legacy authoritative and canonical non-authoritative, and never silently collapses a difference (`AuthorityComparison.tsx`, guarded by `tests/ui/authority-wiring.test.ts`). `PREGNANCY-MALIGNANT-CYTOLOGY` was updated today (§3) to reflect the narrowed-not-closed divergence; it remains an asserted, explicit mismatch, not a passing equivalence.

**Source reproducibility (VERIFY-01):** **RESOLVED** at the engineering level — `REPOSITORY_SELF_CONTAINED_WITH_DERIVED_GOVERNED_SNAPSHOT`. Clean checkout went from 900 failures to 0 (`12` §3, `15` §9). A committed governed snapshot means the canonical evaluator no longer depends on the 39 MB external source package at runtime, build time, or for the committed test suite. **One sub-item remains open and blocks publication, not this pack's engineering claim:** the source-package **redistribution rights / storage decision** is still owed by a human (`13` §6) — the package contains NCSP guideline PDFs and its licensing has not been assessed. `npm run test:source-verification` (5 tests) still requires the external package and skips explicitly, with an honest guard, when it is absent — this is by design, not a gap in the committed suite.

---

## 11. Prospective validation plan

A staged sequence, each stage gated on the previous stage's evidence, none of which has been entered yet beyond Stage 0.

**Stage 0 — SHADOW (current state).** Canonical evaluates every case alongside legacy, recorded as `SHADOW`, never shown as authoritative, never actioned. This is where the system is today and has been throughout this engagement. No further code change is required to remain here indefinitely.

**Stage 1 — Clinician-reviewed prospective comparison.** With the two router fixes and the residual documented (§3, §4), run a defined window (recommend: 2–4 weeks) of live legacy-authoritative traffic with canonical shadow evaluations reviewed **retrospectively** by a named clinician against the same cases legacy actually decided. Purpose: surface any further divergence beyond the corpus and the registered defects, on real (not synthetic) case distribution, with zero patient-facing risk since legacy remains authoritative throughout.

**Stage 2 — Governance sign-off.** Every item in §13's "NEEDS CLINICAL SIGN-OFF" and "NEEDS TECHNICAL VERIFICATION" rows closed, specifically: GOV-04 operating point signed with a number; the 26-defect regrade policy signed; ROUTER-002/003 fixes clinically approved (§4); the oncology/MDT residual (§5) adjudicated; second-approver policy (§5) adopted and enforced; Production database backend confirmed durable (§6); rollback rehearsed end-to-end with a recorded wall-clock time (§9); R1–R6 security items resolved or explicitly risk-accepted by a named owner (per `05`).

**Stage 3 — Limited new-case activation.** Activate canonical for **new cases only**, scoped to a single pilot organisation (`organisationKey`-scoped activation — already supported, §7 condition 2), with the two monitors from §12 live before the first case. Existing cases remain pinned to legacy by construction (§8) — no case in flight is affected by crossing this boundary. Hold period at T+0/T+15min/T+1h/T+24h exactly as specified in `07-cutover-runbook.md`, with the rollback triggers in §9 live and automatic from the first activated case.

**Stage 4 — Monitored expansion.** Only after Stage 3's T+24h review (`07`, "CRO + ADM + ENG + OPS review: continue pilot / expand / roll back") returns "continue" with zero rollback triggers fired, expand organisation scope incrementally, repeating the T+0-through-T+24h monitoring window at each expansion step. Full national activation is the end state of repeated Stage 4 expansions, not a single event.

At every stage, rollback (§9) is available with the same ≤5-minute target and the same zero-history-loss guarantee — the staging exists to bound the *blast radius* of a problem, not to make rollback itself any less immediate.

---

## 12. Monitoring after activation

**Required to exist and be live *before* the first activated case (SEC-03, `05`) — not yet built.**

| Signal | What it measures | Why it is a rollback trigger | Status |
|---|---|---|---|
| **Authority mismatches** | Cases where canonical's shadow recommendation differs from legacy's, categorised by direction (more/less urgent) | A canonical-less-urgent-than-legacy case is an automatic, non-discretionary rollback trigger (§9) | Shadow comparison exists; a live dashboard/alert over it does not |
| **Clinician overrides** | Rate at which reviewers reject or amend a canonical-authoritative recommendation | An unusually high override rate is direct evidence the operating point (GOV-04) was mis-set | Not built |
| **Urgent cases** | Volume and outcome of URGENT/P1 cases under canonical authority, spot-checked against the clinical oracle | Runbook step 39 requires ≥10 canonical decisions spot-checked at T+1h; any less-urgent case is an immediate rollback trigger | Manual spot-check specified in the runbook; no automated flag |
| **Missing-information outcomes** | Rate and distribution of `INSUFFICIENT_INFORMATION` / `EXTERNAL_HISTORY_REQUIRED` safety stops, broken down by the four MISS-01 statuses where possible | Directly measures the automation ceiling implied by GOV-04's 152/179 and the 9.9% recall-schedulable figure; a sudden change signals an adapter or data-quality regression | Not built; blocked in part by MISS-01/C6 (§5) |
| **Evaluation failures** | Adapter parse failures, engine exceptions, any evaluation that does not complete cleanly | **Any 1 non-zero count is an automatic rollback trigger** (§9) — this is the single most safety-critical monitor and the one explicitly named in SEC-03 | **Not built.** Highest-priority item in this section. |
| **Timing ambiguity** | Rate of `CLINICIAN_TIMING_REQUIRED` / non-schedulable recall outcomes reaching `ScreeningSession.nextScreeningDue` as null-with-stop vs the 9.9% baseline | A null `nextScreeningDue` on a recall-required decision is an automatic rollback trigger (§9); this monitor is how it is caught, since it otherwise surfaces downstream in recall reporting where it is much harder to attribute | Not built |
| **Rollback trigger thresholds** | The numeric thresholds themselves (safety-stop rate, error rate above baseline) | Per `07`, these must be **signed with a number** by CRO + ENG before T-0; an unmeasured threshold is not a rollback plan, it is an intention | **Unsigned — no numbers exist yet** |

**Net position: the two hardest-blocking monitors — evaluation-failure count and the numeric rollback thresholds — do not exist today.** Per `05`'s SEC-03 finding, without them "the rollback triggers in doc 04 cannot be evaluated and the rollback plan is decorative." That finding is unchanged by this pack.

---

## 13. Final blocker matrix

**READY** — verified true and requires no further action to remain true.
**NEEDS CLINICAL SIGN-OFF** — a named clinical risk owner or approver must sign; no code change required.
**NEEDS TECHNICAL VERIFICATION** — a check or build step that has not been performed, is performable, and is not itself a policy decision.
**BLOCKED** — cannot proceed until a prior item in this same matrix is resolved, or requires access/authorisation this session does not have.

| Item | Status |
|---|---|
| Legacy remains permanently the router; architecture correctly reflects a within-pathway layer, not a replacement | **READY** |
| CG-NCSP-3.1.0 stays DRAFT / SHADOW / unpublished / inactive / no `LIVE_PRODUCTION` authority | **READY** |
| ROUTER-003 fix — engineering | **READY** (engineering complete; see clinical sign-off row below) |
| ROUTER-003 fix — clinical approval | **NEEDS CLINICAL SIGN-OFF** |
| ROUTER-003 residual (oncology/MDT) | **NEEDS CLINICAL SIGN-OFF** |
| ROUTER-002 fix — engineering | **READY** (engineering complete; see clinical sign-off row below) |
| ROUTER-002 fix — clinical approval | **NEEDS CLINICAL SIGN-OFF** |
| ROUTER-001 — correctly identified as not a defect, no change needed | **READY** |
| GOV-01 / GOV-02 / GOV-03 | **NEEDS CLINICAL SIGN-OFF** |
| GOV-04 operating point (152/179 clinician-only + 9.9% auto-schedulable, both quantified) | **NEEDS CLINICAL SIGN-OFF** |
| LEGACY-005 / -014 / -017 / -026 | **NEEDS CLINICAL SIGN-OFF** |
| 2 input-gap adjudications | **NEEDS CLINICAL SIGN-OFF** |
| Regrade policy for the 26 registered defects | **NEEDS CLINICAL SIGN-OFF** |
| Second-approver policy (ACT-03) | **NEEDS CLINICAL SIGN-OFF** to adopt; **NEEDS TECHNICAL VERIFICATION** to confirm enforced once adopted |
| MISS-01 / C6 missing-information labels | **NEEDS TECHNICAL VERIFICATION** (build required; non-blocking for activation safety, blocking for reviewer usability — §5) |
| Source package redistribution rights / storage decision | **NEEDS CLINICAL/GOVERNANCE SIGN-OFF** (owner not yet named) — **BLOCKED** on publication until decided |
| ACT-01 code blocker removal | **BLOCKED** — by design, until §5/§13's clinical and security items are signed; removal itself is a single-function commit once unblocked |
| ACT-02 schema migration (`LIVE_PRODUCTION` enum value) | **READY** — already present in `prisma/schema.prisma`, additive, no data rewrite |
| Production `CLINICAL_AUTHORITY_LIVE_PRODUCTION` flag state | **NEEDS TECHNICAL VERIFICATION** — not independently re-checked this pack; per standing constraint, unset |
| Production database backend (durable vs `/tmp`) | **BLOCKED** — cannot verify from this environment; see §6 for the exact non-destructive procedure to run once authorised |
| Rollback rehearsal in a live `VALIDATION` environment | **NEEDS TECHNICAL VERIFICATION** — not yet performed |
| Evaluation-failure monitor | **NEEDS TECHNICAL VERIFICATION** — not built, highest-priority monitor per §12 |
| Rollback numeric thresholds | **NEEDS CLINICAL SIGN-OFF** — no numbers signed yet |
| R1, R2, R4 (unsigned runtime dependency risk) | **NEEDS TECHNICAL VERIFICATION** / risk-accept sign-off |
| R6-B (demo credential validity in Production) | **BLOCKED** — cannot check the production user store from this environment |
| R6-E (Vercel Preview deployment protection) | **BLOCKED** — dashboard-only setting, not verifiable from the repository |
| Backup/restore rehearsal | **NEEDS TECHNICAL VERIFICATION** — not performed |
| Authenticated production-readiness QA (E1–E9 workflow suites) | **NEEDS TECHNICAL VERIFICATION** — needs an integration environment, not yet run |
| Case pinning (existing cases stay on original authority) | **READY** — implemented, tested, unmodified by this pack |
| Rollback mechanics (no restore, history preserved) | **READY** — implemented and tested at unit/DB level; **wall-clock rehearsal still needed** (separate row above) |
| Pre-activation test suite | **READY** — 1,447 / 1,447 / 0 fail / 0 todo, typecheck clean, lint clean, build green |
| Prospective validation plan defined | **READY** — this pack, §11 |

---

## 14. Final recommendation

**`NOT_READY_FOR_ACTIVATION`**

The engineering substrate is in the best state it has been at any point in this engagement: 1,447/1,447 tests passing with zero `todo`s, the source-reproducibility blocker resolved, and — as of today — all three registered router defects correctly triaged, with two genuinely fixed and clinically sound by source-basis. That is real, material progress, and it removes one of the hard activation blockers named in `05`.

It does not change the answer. Of the fourteen sections in this pack, one substantive item is genuinely `READY` end-to-end (the test suite and the already-built architecture), and the rest resolve to `NEEDS CLINICAL SIGN-OFF`, `NEEDS TECHNICAL VERIFICATION`, or `BLOCKED`. Three of those are disqualifying on their own, independent of every other item:

1. **Production database durability is `UNKNOWN`.** If Production is on `/tmp`, no other gate in this document matters — activation data would not reliably persist across instances. This has been an open finding since the earlier hardening phase and remains unverified because verifying it requires Production access this session does not have.
2. **The two safety-critical monitors named in SEC-03 — evaluation-failure count and signed numeric rollback thresholds — do not exist.** The rollback procedure (§9) is well-designed and tested at the mechanism level, but its own triggers cannot currently be evaluated in production, which the prior finding correctly called "decorative" without them.
3. **No clinical signature exists anywhere in this pack** — not on today's two router fixes, not on the ROUTER-003 residual, not on GOV-01–04, not on the regrade policy, not on the second-approver policy. Every clinical decision this document surfaces is still open.

Nothing in this pack authorises, or should be read as inching toward, activation. It is the complete, current inventory of what stands between here and a defensible go decision — assembled so that the next action, for anyone with the authority to take it, is to work the blocker matrix in §13, not to re-derive it.

---

## Appendix — provenance of this pack

- **No clinical rule was changed while preparing this pack.** The two router fixes in §3 were made and committed (`31b8790`) as a separate, prior, explicitly authorised action — this pack documents them; it did not make them.
- **Nothing was activated.** 0 publications, 0 activations, before or after this pack.
- **Production was not modified.** No Production credential was read, entered, or printed. No Production database connection was opened. §6's verification procedure was specified, not executed.
- **`main` was not touched.** This pack is committed to `feat/canonical-authority-layer` only.
- **This document supersedes no prior document.** Docs 01–15 remain the primary evidence; this pack is a synthesis and status roll-up, cross-referenced throughout rather than duplicated.
