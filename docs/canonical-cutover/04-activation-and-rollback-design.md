# 04 — Activation Model, Cutover Options, Rollback, Migrations

Covers brief Phases 6, 7, 8 and 11. **No rule state was changed. CG-NCSP-3.1.0 remains DRAFT, unpublished, inactive.**

---

# Phase 6 — Governed ruleset activation model

## 6.1 Is the existing architecture sufficient?

**Yes — with two deliberate code changes and no invented states.**

What already exists and is fit for purpose (`lib/clinical-rules/lifecycle.ts`, `prisma/schema.prisma`):

| Requirement | Present? | Where |
|---|---|---|
| `DRAFT → VALIDATING → VALIDATED → PUBLISHED → ACTIVE → RETIRED → ARCHIVED` | **yes**, exactly this enum | `ClinicalRuleVersionStatus` |
| Two-person approval | **yes, enforced** — creator cannot approve (`lifecycle.ts:297`) | `approveClinicalRuleVersion` |
| Publication requires validation + approval + checksum match | **yes** (`lifecycle.ts:330-336`) | `publishClinicalRuleVersion` |
| Only PUBLISHED may be activated | **yes** (`lifecycle.ts:391`) | `activateClinicalRuleVersion` |
| Activation time recorded | **yes** — `RuleSetActivation.activatedAt` + `ClinicalRuleVersion.activatedAt` | |
| Previous authority retired atomically | **yes** — prior activation gets `deactivatedAt`, prior version reverts to `PUBLISHED` if no other activation holds it, all in one transaction (`lifecycle.ts:410-434`) | |
| Rollback reactivates a previous ruleset | **yes** — `rollback: true` flag emits a `ROLLBACK` audit event through the same path | |
| Organisation-scoped activation | **yes** — `organisationKey` with global fallback (`lifecycle.ts:502-508`) | |
| Immutable evaluations + checksum re-verification at eval time | **yes** (`evaluator.ts:479`) | |
| Regrade provenance | **yes** — `previousEvaluationId` + mandatory `regradeReason` | |
| Full audit | **yes** — `RuleVersionAuditEvent` *and* `AuditLog`, both written in-transaction, with IP + user agent | |

**This is a genuinely well-built governance layer.** It needs no redesign.

## 6.2 The two required changes

> **ACT-01 (ENGINEERING, blocking).** `lifecycle.ts:384-386` throws unconditionally on `environment === "PRODUCTION"`. Must be removed to activate in production. Remove it in a **single-purpose commit** whose diff is those three lines, so the approval record points at one reviewable change. Replace with a permission check on `rules:activate` plus an explicit `environment === "PRODUCTION"` confirmation token, so removing the guard does not make production activation *easier* than demo activation.

> **ACT-02 (SCHEMA — the only migration, additive).** `RuleEvaluationMode` is `LIVE_DEMO | SHADOW | SIMULATION`. Production authority evaluations have no honest mode. Reusing `LIVE_DEMO` would mislabel every production clinical decision in the immutable record — unacceptable. **Add `LIVE_PRODUCTION`.** This is an additive Postgres enum value: non-destructive, no data rewrite, no backfill, instantly reversible by simply not using it. It is the *only* migration this cutover needs.
>
> Note `evaluator.ts:470` gates `LIVE_DEMO` on `PUBLISHED|ACTIVE`; the new value needs the same gate, tightened to `ACTIVE` only.

## 6.3 Proposed lifecycle for CG-NCSP-3.1.0

Current: **DRAFT**, unpublished, inactive, 0 activations, all stored evaluations `SIMULATION`.

| Step | Actor | Gate | Audit event |
|---|---|---|---|
| 1. Validate | any `rules:validate` | schema + coverage validation passes | `VALIDATION_PASSED` |
| 2. **Clinical approval** | a clinician holding `rules:approve`, **≠ draft creator** (enforced) | GOV-01…GOV-04 adjudicated; LEGACY-005/-014/-017/-026 adjudicated; the 2 input-gap adjudications closed; GOV-04 operating point signed | `APPROVAL` |
| 2b. **Second approval (recommended addition)** | a second, independent clinician | see ACT-03 | `APPROVAL` |
| 3. Publish | `rules:publish` (ADMIN only in the current matrix) | passing validation report + approval + checksum match | `PUBLICATION` |
| 4. Activate — `VALIDATION` env | `rules:activate` | full acceptance suite green (doc 06) | `ACTIVATION` |
| 5. Activate — `PRODUCTION`, **organisation-scoped** | `rules:activate` + production confirmation token | runbook T-0 (doc 07) | `ACTIVATION` |
| 6. Retire legacy | — | *not applicable*: legacy is code, not a versioned row. See ACT-04 | — |

- **Who approves:** a clinician with `rules:approve`. Held today by CLINICAL_LEAD / SMO / equivalent roles per `lib/auth/permissions.ts:62-85`. Not the author.
- **Who publishes:** ADMIN (`rules:publish` is ADMIN-only, `permissions.ts:52-53`).
- **Who activates:** ADMIN (`rules:activate`). 
- **Is two-person approval appropriate:** **Yes, and the current single `approvedById` is insufficient for a production clinical authority change.**

> **Finding ACT-03 (GOVERNANCE_DECISION_REQUIRED).** `ClinicalRuleVersion` has one `approvedById`. Creator≠approver is enforced, but a change of national clinical authority for a screening programme conventionally requires two independent clinical approvers plus a separate publishing/activating operator. Recording a second approver requires either a new nullable column or a convention over `RuleVersionAuditEvent` `APPROVAL` rows. **Recommendation: use the audit-event convention** (two `APPROVAL` events from distinct `actorUserId`, asserted at publish time) — it needs no migration and the events are already immutable.

> **Finding ACT-04.** "Retiring the previous authority" has no representation, because the previous authority is **hardcoded TypeScript**, not a `ClinicalRuleVersion`. The activation record will show canonical becoming active with `previous = null`, which understates what happened. **Mitigation: create a `ClinicalRuleVersion` row representing the legacy engine** — status `PUBLISHED`, `displayVersion` e.g. `CG-LEGACY-1.0.0`, snapshot documenting that its logic lives in `lib/engine/decision-engine.ts` at commit `fb933c3`, checksum over that file. Activate *it* first (a no-op that changes nothing, since the resolver defaults to legacy anyway), so that the canonical activation has a real predecessor to deactivate and rollback has a real target to reactivate. **This is the single cleanest way to make both cutover and rollback fully auditable, and it needs no schema change.**

- **Activation time:** `RuleSetActivation.activatedAt`, set inside the transaction, shared with the deactivation of the predecessor — so there is no gap and no overlap.
- **Organisation-scoped?** **Yes — activate scoped first.** The resolver's org→global fallback (`lifecycle.ts:502-508`) means an org-scoped activation affects exactly one organisation and everyone else keeps falling through to the global (legacy) activation. This gives a genuine pilot with **zero** extra code. It is the mechanism behind the recommended cutover option below.

> **Finding ACT-05 (ENGINEERING).** `resolveActiveClinicalRuleVersion` caches for 30 s in **process memory** (`lifecycle.ts:363,510`). On Vercel serverless there are N independent instances. After an activation *or a rollback*, different instances resolve different authorities for up to 30 seconds, and `invalidateClinicalRuleVersionCache` only clears the local process. **Two cases can therefore be decided by two different engines in the same 30-second window.** For rollback this is the difference between a 30-second and a 0-second recovery. Either set the TTL to 0 for `PRODUCTION`, or accept and document a 30-second mixed-authority window. Recommend TTL 0 in production: the resolver is one indexed query.

---

# Phase 7 — Cutover options

Scores: 1 = worst, 5 = best.

| Criterion | **1 Hard cutover** | **2 Dual-run then switch** | **3 Org-level flag** | **4 New-cases-only** |
|---|---|---|---|---|
| Clinical safety | 1 | 4 | **5** | 3 |
| Implementation complexity (5 = simplest) | 4 | 2 | **4** | 3 |
| Rollback simplicity | 2 | 4 | **5** | 4 |
| Auditability | 3 | 4 | **5** | 4 |
| Historical consistency | 1 | 3 | **5** | **5** |
| Operational complexity (5 = simplest) | **5** | 1 | 3 | 3 |
| Governance burden (5 = lightest) | 1 | 3 | **4** | 3 |
| Testing burden (5 = lightest) | 2 | 1 | **4** | 3 |
| **Total** | **19** | **22** | **35** | **28** |

Notes on each:

- **Option 1 — Hard cutover.** Every pending case flips mid-review. Combined with GOV-04 (152/179 clinicianOnly) and IN-03 (bleeding-case safety stops), the Review Queue floods on day one with no prior exposure. Rejected.
- **Option 2 — Dual-run then switch.** Already achieved: shadow mode has been running and produced the 179-case comparison. Continuing it indefinitely adds cost without adding evidence, and it does not itself contain a switch mechanism. Its value is already banked.
- **Option 3 — Organisation-level activation.** Uses `RuleSetActivation.organisationKey`, which already exists, is already indexed, and already has global fallback. Rollback = one `deactivatedAt` write. Blast radius = one organisation. Every activation and deactivation is an immutable audit event. **Caveat: `ClinicalRuleSet.organisationKey` is nullable "until a governed organisation boundary exists" — so a real, named `organisationKey` must be established for the pilot site. That is a data/config decision, not a schema change.**
- **Option 4 — New-cases-only.** Not an alternative — it is the *historical* policy (doc 03, Policy A + C) and applies under **all** options. Scored here for completeness; it should be combined with, not chosen instead of, Option 3.

## Recommendation

**Option 3 + Option 4: organisation-scoped activation, new cases only, existing cases pinned, regrade by explicit reviewer action.**

Sequenced: `VALIDATION` env → one pilot organisation in `PRODUCTION` → observation window → progressive org-by-org expansion → global activation only after the pilot's discrepancy rate and reviewer-load metrics are accepted.

---

# Phase 8 — Rollback design

## Constraints (all satisfiable)

Rollback must not require deleting evaluations, rewriting completed decisions, restoring the database, or losing audit history. **The recommended design requires none of these**, because rollback is a single `INSERT` + `UPDATE` in `RuleSetActivation`, not a data operation on clinical records.

## Mechanism

`Canonical ACTIVE → Legacy ACTIVE`, **for new evaluations only**, via `activateClinicalRuleVersion({ id: <legacy pin version>, rollback: true, reason })` — the same governed path, producing a `ROLLBACK` audit event and a `DEACTIVATION` event for canonical. If ACT-04's legacy pin row is not created, rollback degrades to "deactivate the canonical activation and let the resolver fall back to legacy", which works but produces a weaker audit trail.

| | |
|---|---|
| **Trigger** | Any one of: (a) ≥1 unexplained discrepancy where canonical is *less* urgent than legacy on the same facts; (b) any adapter parse failure producing a null recall date (OUT-02); (c) safety-stop rate above the pre-agreed reviewer-capacity threshold; (d) any clinician-reported harm or near-miss; (e) discretionary call by the on-call clinical lead. Thresholds must be **numeric and agreed before T-0**, not judged live. |
| **Operator** | ADMIN holding `rules:rollback`. Named on-call individual, named deputy, both listed in the runbook with contact details. |
| **Audit event** | `ROLLBACK` in `RuleVersionAuditEvent` + mirrored `AuditLog`, both carrying `reason` (mandatory, `lifecycle.ts:383`), actor, IP, user agent, before/after version IDs. |
| **Maximum rollback time** | **Target ≤ 5 minutes from decision to effect.** Composition: ~1 min to authenticate and open Rule Studio, ~1 min to execute, plus cache propagation — **0 s if ACT-05 is fixed (TTL 0 in production), up to 30 s if not**. No deploy, no build, no restart, no migration. If ACT-05 is *not* fixed, the honest figure is ≤ 5 min 30 s with a mixed-authority tail. |
| **Cases evaluated during the canonical window** | **Remain pinned to canonical.** Their `RuleEvaluation` rows are immutable and their reviewers may already have acted. |
| **Are those cases re-run?** | **No — never automatically.** Each is individually reviewable and individually regradable under doc 03 Policy D, with a reason recorded. If rollback was triggered by a *systematic* canonical defect, the affected cohort is identified by `ruleVersionId` + `evaluatedAt` range (both indexed: `@@index([ruleVersionId, evaluatedAt])`) and handled as a clinical safety-netting exercise, not as a data fix. |
| **What rollback does NOT do** | Delete or amend any `RuleEvaluation`; change any `BatchReviewItem` disposition; withdraw any exported package; alter any audit row. |

## Rollback rehearsal

Rollback must be **executed end-to-end in the `VALIDATION` environment** and timed, before production activation. An untested rollback is not a rollback. This is a gate in doc 06.

---

# Phase 11 — Database migration requirements

**Preferred outcome — no schema change — is very nearly achieved.**

| Requirement | Existing support | Migration needed? |
|---|---|---|
| Active-ruleset lookup | `RuleSetActivation` + `resolveActiveClinicalRuleVersion` | **No** |
| Evaluation provenance | `RuleEvaluation.{ruleVersionId, ruleVersionDisplay, rulesetChecksum, engineVersion, canonicalInputSnapshot}` | **No** |
| Case ↔ engine pinning | `WizardSession.ruleEvaluationId` (unique), `BatchReviewItem.ruleEvaluationId` (unique), `RuleEvaluation.caseId`; **absence of a row = legacy** | **No** |
| Batch pinning | `BatchRun.pinnedRuleVersionId` / `pinnedRuleVersionDisplay` / `pinnedRulesetChecksum` | **No** |
| Historical decisions | immutable `RuleEvaluation` + append-only `AuditLog` | **No** |
| Export provenance | `package-generator.ts` already emits version + checksum fields | **No** (a *code* fix is needed for EXEC-03's mislabel, not a schema change) |
| Rollback | `RuleSetActivation.deactivatedAt` + `ROLLBACK` audit event | **No** |
| Regrade | `previousEvaluationId` + `regradeReason` | **No** |
| Second clinical approver | audit-event convention (ACT-03) | **No** (a column would be cleaner; not required) |
| **Honest production evaluation mode** | `RuleEvaluationMode` lacks a production value | **YES — one additive enum value** |

## The one migration

```
ALTER TYPE "RuleEvaluationMode" ADD VALUE 'LIVE_PRODUCTION';
```

**Why it is required:** every production clinical decision is written to an immutable record. Labelling those records `LIVE_DEMO` would make the permanent audit trail state something untrue about the clinical status of real participant decisions. That is a governance defect, not a cosmetic one.

**Why it is safe:** additive; no table rewrite; no backfill; no existing row changes meaning; no down-migration needed (unused enum values are inert). Postgres does not permit `ADD VALUE` inside a transaction block with other DDL in some versions — run it as its own migration step, ahead of the deploy, and verify `SELECT enum_range(NULL::"RuleEvaluationMode")` before proceeding.

**Nothing else requires a migration. No migration was created.**
