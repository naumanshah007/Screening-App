# 10 — Third Rules Stack Assessment (`lib/cases/grading.ts`)

**Status:** investigation only. Nothing was deleted, disabled or changed in this stack.

---

## 1. Summary

`lib/cases/grading.ts` is a **third, independent clinical rules stack**, separate from both the legacy cervical-screening engine and CG-NCSP-3.1.0.

**It does participate in real clinical grading**, and **it can overwrite an existing recommendation in place.** It does not, however, touch governed `RuleEvaluation` records.

| Question | Answer |
|---|---|
| Is it a distinct rules stack? | **Yes** — own storage, own lifecycle, own evaluator |
| Does it participate in production clinical grading? | **Yes**, gated by `ENABLE_CASES_V2` (default **on**) |
| Can it overwrite an existing recommendation? | **Yes** — `prisma.ruleDecision.upsert` on a unique `caseId` |
| Can it overwrite a governed `RuleEvaluation`? | **No** |
| Is it in scope for the CG-NCSP-3.1.0 cutover? | **No** |
| Should it be deleted? | **No** — it is live functionality |

## 2. What it is

A referral-triage grading engine for **colposcopy and gynaecology referral prioritisation** — a different clinical question from cervical screening pathway selection. It answers "how urgently should this referral be seen, and by which service", not "what is this participant's screening recommendation".

**Its own governed release mechanism, independent of `ClinicalRuleSet`:**

| Concern | This stack | CG-NCSP-3.1.0 stack |
|---|---|---|
| Rule storage | `RuleSetRelease.definitionJson` | `ClinicalRuleVersion.snapshotJson` |
| Active selection | `getActiveCaseRuleSetRelease(serviceLine)` | `RuleSetActivation` |
| Evaluator | `evaluateCaseRuleRelease` (`lib/cases/rule-evaluator.ts`) | `evaluateClinicalSnapshot` |
| Result | `RuleDecision` (one per case, **mutable**) | `RuleEvaluation` (**immutable, append-only**) |
| Provenance | `ruleSetReleaseId`, `version`, `schemaVersion` | version, checksum, engine, mode, canonical input snapshot |
| Checksum | **none** | SHA-256, re-verified at evaluation time |
| Regrade chain | **none** | `previousEvaluationId` + mandatory `regradeReason` |
| Input | extracted document facts, mapped referral fields, text extraction | `CanonicalClinicalFactsV2` |

## 3. Call sites

**Write path (one):**
- `app/api/cases/[id]/rules/evaluate/route.ts:39` → `generateRuleDecision()`
  - `POST`, requires `cases:grade` permission, gated by `isFeatureEnabled("casesV2")`
  - Refuses unless a clinical summary exists **and** is clinician-approved (`grading.ts:443-449`)

**Read paths (five):**
- `app/(app)/cases/[id]/triage/page.tsx:50`
- `app/(app)/cases/[id]/grade/page.tsx:80`
- `app/(app)/cases/[id]/summary/print/page.tsx:24`
- `app/(app)/cases/page.tsx:150,222,226,354` — case list priority/outcome columns
- `app/(app)/cases/[id]/page.tsx:95,99,167`

**Regression harness:** `lib/cases/rule-regression.ts:49`.

## 4. The overwrite finding

```ts
// lib/cases/grading.ts:517
const ruleDecision = await prisma.ruleDecision.upsert({
  where: { caseId: referralCase.id },
  update: { ruleSetReleaseId, priority, category, outcome, rationale, evidenceJson, traceJson, generatedBy },
  create: { ... },
});
```

`RuleDecision.caseId` is unique. Re-running `POST /api/cases/[id]/rules/evaluate` on a case that already has a decision **replaces the prior recommendation, priority, category, outcome, rationale, evidence and trace in place.**

What survives:
- an `AuditLog` row with `action: "EVALUATE"` carrying the **new** values (`grading.ts:549-566`)

What does not survive:
- the previous `priority`, `category`, `outcome`, `rationale`, `evidenceJson`, `traceJson`
- which `RuleSetRelease` produced the previous decision
- any link between the old and new decisions

The audit log records that a re-evaluation happened and what it produced. It does **not** record what was replaced, because `oldValue` is not populated on this write. **The prior clinical recommendation is not recoverable from the database.**

Mitigating: `ClinicianDecision` is a separate record, so a clinician's *confirmed* decision is not destroyed — only the rule engine's recommendation is. And re-evaluation requires an approved clinical summary plus `cases:grade`, so it is not trivially triggered.

> ### Finding STACK-01 — `RuleDecision` overwrites a prior clinical recommendation with no recoverable history
>
> **Severity: MEDIUM. Blocking for this stack; NOT blocking for the CG-NCSP-3.1.0 cutover.**
>
> This is a pre-existing defect on production `fb933c3`. It is not created, worsened or touched by the canonical cutover, and it operates on different records via a different code path. It is exactly the failure mode the canonical architecture was built to prevent — which is why the canonical stack uses immutable append-only evaluations with a regrade chain.
>
> **Recommended fix (separate change, separate approval):** make `RuleDecision` append-only with a `supersededById` chain, mirroring `RuleEvaluation.previousEvaluationId`; or, minimally, populate `AuditLog.oldValue` with the replaced decision so history is at least reconstructable. **Do not bundle this into the cutover change** — it is a different clinical stack with a different risk owner, and mixing them would make both harder to review.

## 5. Relationship to the other two engines

**To the legacy cervical engine:** none at runtime. Different inputs (`ReferralCase` + extracted document facts vs `ClinicalInput`), different outputs (`TriagePriority` + service-line category vs `ClinicalDecision`), different storage. They do not call each other.

**To CG-NCSP-3.1.0:** none. `generateRuleDecision` writes no `RuleEvaluation`, resolves no `RuleSetActivation`, and does not consult `resolveClinicalAuthority`. Activating canonical authority changes **nothing** in this stack.

**Shared surface:** both surface a priority to reviewers, and `grading.ts:542-547` writes `ReferralCase.smoOnly` from `operational.requiresSmoReview`.

## 6. Consequences for the cutover

1. **Do not delete.** Live functionality behind a default-on flag with five read paths.
2. **Do not include it in the canonical activation.** Different clinical question, different rule set, different release lifecycle.
3. **State this explicitly to the risk owner.** After canonical activation, someone reasonably told "the clinical rules were switched to CG-NCSP-3.1.0" would be wrong about colposcopy/gynaecology referral triage, which continues on its own `RuleSetRelease`. This wording risk is a governance item, not an engineering one.
4. **Track STACK-01 separately**, with its own owner and its own approval.
5. **The Rule Governance UI must distinguish the two rule stacks by name**, so an administrator cannot confuse "Case Rule Releases" with "Clinical Rule Versions". The application already draws this distinction in copy at `app/(app)/rules/clinical/page.tsx:47` — that framing should be preserved and extended to the provenance badges added in Phase 14.
