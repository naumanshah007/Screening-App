# 11 — Authority Layer Implementation

**Canonical clinical authority is OFF.** Nothing in this implementation makes CG-NCSP-3.1.0 authoritative. It remains DRAFT, unpublished, inactive, SHADOW/SIMULATION.

Branch `feat/canonical-authority-layer`, from `integration/rule-studio-on-latest-main` @ `ab1eb0e`.

---

## 1. Target architecture, as built

```
Referral / wizard answers / batch row
        │
        ▼
  normalization            lib/wizard/steps.ts · lib/batch/processor.ts
        │
        ▼
  LEGACY ROUTER            lib/engine/decision-engine.ts  ← RETAINED, never bypassed
  age gates · Figure selection · F10/F9/Table-1/F8 precedence
        │
        ├──────────────► legacy ClinicalDecision (authoritative today)
        │
        ▼
  AUTHORITY RESOLVER       lib/clinical-rules/authority.ts        ← NEW
  RuleSetActivation: org-scoped → global → LEGACY
        │
        ▼
  PIN GUARD                lib/clinical-rules/pinning.ts          ← NEW
  an existing pin wins over the current activation
        │
        ├── LEGACY ────► legacy decision stands; canonical written as SHADOW
        │
        └── CANONICAL ─► evaluateClinicalCase()
                              │
                              ▼
                        DECISION ADAPTER   lib/clinical-rules/decision-adapter.ts  ← NEW
                        closed governed vocabulary; never de-escalates
                              │
                              ▼
        ┌─────────────────────┘
        ▼
  DE-ESCALATION GUARD → blocked and audited if it would relax a control
        │
        ▼
  reviewer workflow → immutable RuleEvaluation → export / audit
```

Orchestrated by `evaluateGradedDecision()` in `lib/clinical-rules/graded-decision.ts`.

**No second router was created. No clinical logic was duplicated.**

## 2. Files added

| File | Purpose |
|---|---|
| `lib/clinical-rules/authority.ts` | Authority resolution. Defaults to LEGACY on every failure path. |
| `lib/clinical-rules/decision-adapter.ts` | Canonical → `ClinicalDecision`; never de-escalates, never invents. |
| `lib/clinical-rules/governed-vocabulary.ts` | Closed literal tables for timing, care setting, urgency. |
| `lib/clinical-rules/pinning.ts` | Case and batch-run authority pins. No schema change. |
| `lib/clinical-rules/graded-decision.ts` | The authority-sensitive execution path. |
| `components/clinical-rules/ClinicalAuthorityBadge.tsx` | Provenance badge + header indicator. |
| `prisma/migrations/20260807120000_add_live_production_evaluation_mode/` | Additive enum value. |

Files changed: `evaluator.ts` (urgency), `canonical-facts-v2.ts` (`DERIVED_ROUTER`), `lifecycle.ts` (blocker extraction, cache removal), `overlay.ts` (compatibility guard), `processor.ts` and the wizard complete route (router provenance), `schema.prisma`.

## 3. The exact switch point

Three independent conditions, all required. Today **none** holds.

| # | Condition | State | Where |
|---|---|---|---|
| 1 | `assertProductionActivationPermitted` permits PRODUCTION | **blocked** | `lifecycle.ts` |
| 2 | An ACTIVE PRODUCTION `RuleSetActivation` exists | **none** | database |
| 3 | `CLINICAL_AUTHORITY_LIVE_PRODUCTION` is affirmative | **unset → off** | `authority.ts` |

Condition 1 is a single trivial function so that the enabling change is a one-purpose commit whose entire diff is reviewable at a glance and can be pointed at by the approval record.

## 4. Safety properties, each test-covered

| Property | Test |
|---|---|
| Default is LEGACY; no flag defaults canonical | `authority.test.ts` |
| Routing is never adapted | `decision-adapter.test.ts` |
| Never de-escalates risk, referral or priority | `decision-adapter.test.ts` (incl. all 203 rules) |
| No rule can produce a recall date it did not state | `decision-adapter.test.ts` (all 203 rules) |
| Unmapped literal → safety stop, never a default | `governed-vocabulary.test.ts`, `decision-adapter.test.ts` |
| Prose cannot change urgency or timing | `governed-vocabulary.test.ts` |
| Fabricated clinical facts = 0 | `canonical-fact-provenance.test.ts`, `graded-decision-fabrication.test.ts` |
| `currentPathway` is `DERIVED_ROUTER` | both provenance tests |
| SHADOW/SIMULATION never pin a case | `pinning-and-activation-blocker.test.ts` |
| A rollback leaves canonical-window cases on canonical | `pinning-and-activation-blocker.test.ts` |
| PRODUCTION activation is blocked | `pinning-and-activation-blocker.test.ts` |
| Overlay cannot be silently dropped | `overlay-authority-compatibility.test.ts` |

## 5. Findings that changed the design

### 5.1 The Phase 4 gate as written is not achievable — and should not be

The brief required *"structured interval mapping success = 100%"*. The governed snapshot emits **104 distinct `timingDestination` literals**, of which only **8** are unambiguous single intervals. The rest include:

- `"6 weeks-3 months or immediate colposcopy"` — a range **or** an alternative action
- `"20 or 30 working days according to risk/history; urgent if invasive cytology"` — depends on facts not in the string
- `"5 years or 3 years if immune deficient"` — depends on immune classification
- `"As specified by outcome"` (20 rules) and `""` (52 rules) — no timing at all

Converting these to `{value, unit}` requires either **fabricating a clinical interval** (prohibited) or **changing CG-NCSP-3.1.0** (a governed ruleset change requiring re-validation, re-approval and a new checksum — not an engineering decision).

**What was achieved instead: 100% *classification* coverage with fail-closed behaviour.** Every literal has one explicit reviewed entry; only `EXACT` and `BOUNDED_MAX` yield an automated recall date; everything else routes to clinician determination and **never a silent null**. The safety goal in the brief — *"no clinically significant follow-up interval may depend on parsing prose"* and no silent null — is fully met. The literal numeric gate is not, and reporting it as met would be false.

**Consequence for the risk owner:** canonical CG-NCSP-3.1.0 can produce an unambiguous automated recall interval for only a small minority of its rules. Under canonical authority, most follow-up dates would require clinician determination. This compounds GOV-04 and is material to the operating-point decision.

### 5.2 Conditional urgency had to be recorded, not dropped

Classifying `"Urgent / within 2 weeks when invasion confirmed or strongly suspected"` (F9-14, pregnancy with suspected invasion) as "no urgency" would have **under-stated** a genuinely urgent case relative to the old regex. Conditional entries therefore record the urgency their source text states for the urgent limb (`escalatesWhen`) and **fail safe to it**. It is recorded once, under review, never inferred at runtime.

### 5.3 The overlay finding was overstated

OUT-03 claimed configured overlay entries would silently stop applying. The overlay is **not wired to anything** — no model, no route, no call site. Zero entries exist, so zero behaviours would be lost. Downgraded from a hard activation blocker; a guard was added against the prospective hazard. See [09](09-guideline-overlay-transition.md).

### 5.4 The governed source rulebook is not in version control

`docs/clinical-sources/source-v2.1` (39 MB) is **untracked**. In a genuinely clean checkout, **900 of 963** clinical-rules tests fail because the canonical snapshot cannot be built. With the package restored: 963/963 pass. See [12](12-pre-activation-engineering-verification.md) §3. **This is a governance defect and an activation blocker.**

### 5.5 `lib/cases/grading.ts` overwrites recommendations

Confirmed as a third live rules stack whose `RuleDecision.upsert` destroys the prior recommendation with no recoverable history (STACK-01, MEDIUM). Pre-existing, out of scope, tracked separately. See [10](10-third-rules-stack-assessment.md).

## 6. The future switch, precisely

**Do not execute. Each step is gated by [05](05-governance-and-security-gates.md) and [06](06-acceptance-test-plan.md).**

1. Clinical and governance approvals obtained — GOV-04 operating point, regrade policy, written acceptance of the conditional within-pathway model, R1–R6 signatures, source-package remediation.
2. Publish CG-NCSP-3.1.0 (`VALIDATED` + two `APPROVAL` events from distinct actors → `PUBLISHED`).
3. Remove the blocker in `assertProductionActivationPermitted` — **single-purpose commit**.
4. Set `CLINICAL_AUTHORITY_LIVE_PRODUCTION=true` in the production environment.
5. Create an **organisation-scoped** PRODUCTION `RuleSetActivation` for the pilot organisation.
6. New cases in that organisation resolve canonical authority and write `LIVE_PRODUCTION` evaluations.
7. Existing cases stay pinned; batch runs complete on their starting authority.
8. The legacy router continues selecting the pathway for every case, under both authorities.
9. Monitor per [07](07-cutover-runbook.md).
10. Rollback = deactivate the canonical activation (or activate the legacy pin version). New cases return to legacy; canonical-window cases stay pinned to canonical. ≤5 minutes, no deploy, no restore, no deletion.

Steps 3, 4 and 5 are three independent switches held by different mechanisms — code review, environment configuration, and a governed database activation with an immutable audit event. No single actor or accident flips all three.
