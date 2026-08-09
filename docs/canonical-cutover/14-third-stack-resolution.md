# 14 — Third Rules Stack Resolution (STACK-01)

**Status:** partially resolved. Governed evaluations are proved safe; this stack's own history is now recoverable; making `RuleDecision` immutable remains open and belongs to this stack's owner.

---

## 1. The question that had to be answered

Can this occur?

```
governed evaluation → recommendation stored → lib/cases/grading.ts executes
                    → RuleDecision.upsert → previous recommendation overwritten
```

**No. Proved three ways.**

1. **Structural.** `lib/cases/grading.ts` contains no reference to `ruleEvaluation` at all. A test asserts the module never calls `ruleEvaluation.{create,update,delete,upsert,deleteMany,updateMany}`.
2. **Behavioural.** Against a real database: create a governed `RuleEvaluation`, then write `RuleDecision` repeatedly. The evaluation survives byte-identical. *(`repeated RuleDecision writes destroy no governed evaluation`)*
3. **Database-enforced.** The production immutability triggers reject `UPDATE` and `DELETE` on `RuleEvaluation` regardless of the caller. *(`the database itself refuses to mutate a governed evaluation`)*

**Historical governed recommendations destroyed = 0.**

The two stacks write to different tables and never intersect:

| | Governed stack | Case-triage stack |
|---|---|---|
| Table | `RuleEvaluation` | `RuleDecision` |
| Mutability | append-only, trigger-enforced | **upsert, replaced in place** |
| Written by | `evaluateClinicalCase` | `generateRuleDecision` |
| Rows per case | many (chained) | **exactly one** |

## 2. Call graph

```
POST /api/cases/[id]/rules/evaluate          ← the ONLY write path
  requires isFeatureEnabled("casesV2")        (default ON)
  requires permission "cases:grade"
  requires an existing clinical summary
  requires that summary to be clinician-APPROVED
        │
        ▼
  generateRuleDecision()                      lib/cases/grading.ts
        ├── getActiveCaseRuleSetRelease(serviceLine)     ← its own release lifecycle
        ├── buildEvaluationFacts()                        ← extracted document facts,
        │                                                   mapped referral fields,
        │                                                   free-text extraction
        ├── evaluateCaseRuleRelease()                     lib/cases/rule-evaluator.ts
        ├── [NEW] read prior RuleDecision
        ├── prisma.ruleDecision.upsert()                  ← REPLACES IN PLACE
        ├── prisma.referralCase.update({ smoOnly })
        └── prisma.auditLog.create()                      ← now carries oldValue
```

**Read paths (5):** case list, case detail, triage, grade, summary print.

**Workflow participation:**

| Workflow | Uses this stack? |
|---|---|
| Manual referral (cases v2) | **Yes** — this is its primary workflow |
| Batch | No |
| NCSR / integrations | No |
| Review Queue (batch worklist) | No |
| Regrade (canonical) | No |
| Automation / cron | No |
| Cervical screening wizard | No |

It can run after a governed `RuleEvaluation` exists on the same `ReferralCase` — both models carry `caseId` — but it does not read, write or invalidate it.

## 3. What was wrong, and what was fixed

`RuleDecision.caseId` is unique and the write is an `upsert`. Re-running the endpoint replaced `priority`, `category`, `outcome`, `rationale`, `evidenceJson`, `traceJson` and `generatedBy` in place. `AuditLog.oldValue` was not populated, so **the prior clinical recommendation was unrecoverable.**

**Correction applied** (no schema change):

- Read the prior decision immediately before the upsert.
- Write it in full to `AuditLog.oldValue` as a `REEVALUATE` event (a first evaluation stays `EVALUATE`).
- `getSupersededRuleDecisions(caseId)` reconstructs the replaced history, newest first, from the append-only audit log.

**Tests** (all against a real isolated database): first decision · second evaluation · repeated regrades · batch repeat · duplicate intake · reopened case after a canonical shadow · reviewer-visible current decision · canonical shadow evaluation · simulated future live evaluation.

## 4. What is still open

> ### STACK-01-B — `RuleDecision` is still mutable
>
> **Severity: MEDIUM. Owner: the cases-v2 clinical stack, not the canonical cutover.**
>
> The current recommendation is still replaced in place. History is now *recoverable from the audit log*, which is a genuine improvement over destruction, but it is not the same as immutability:
>
> - the audit log is a general-purpose table, not a clinical record;
> - reconstruction depends on JSON parsing rather than a typed relation;
> - **decisions replaced before this change are not recoverable and cannot be made so retrospectively.**
>
> **Preferred model, matching the governed stack:**
>
> ```
> RuleDecision (append-only)
>   id, caseId, supersededById?, supersededAt?, ...
> ReferralCase.currentRuleDecisionId → the latest operative decision
> ```
>
> Each evaluation inserts a new row and marks the previous one superseded. The displayed decision follows `currentRuleDecisionId`; history is never destroyed. This needs a migration and a backfill decision for existing rows, so it is a separate change with its own approval.
>
> **Alternative, if this stack is to converge on the governed model:** make `RuleDecision` an explicit *projection* of immutable evaluations. That is a larger change and would merge two clinical stacks — not advisable without a clinical owner deciding they should be one thing.

## 5. Consequences for the canonical cutover

1. **Not a cutover blocker.** Governed evaluations are structurally safe. The gate "historical governed recommendations destroyed = 0" is met.
2. **It is a production-readiness item for cases v2**, which is live behind a default-on flag.
3. **Do not bundle STACK-01-B into the cutover change.** Different stack, different rules, different owner; mixing them makes both harder to review.
4. **Wording risk stands.** After canonical activation, telling someone "the clinical rules were switched to CG-NCSP-3.1.0" would be wrong about colposcopy/gynaecology referral triage, which continues on its own `RuleSetRelease` lifecycle. This needs saying explicitly in the governance record.
5. **Incidental finding:** `TriagePriority` (this stack) has no `P4`, while the engine's `ReferralPriority` does. The two priority vocabularies are different domains and must not be mapped to each other by name.
