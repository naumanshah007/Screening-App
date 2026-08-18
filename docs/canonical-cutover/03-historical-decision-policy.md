# 03 — Historical Decision Safety (Phase 5)

**No historical record was read for modification, and none was modified.**

## 1. What exists today

| Record | Immutability | Provenance carried |
|---|---|---|
| `RuleEvaluation` | **append-only**; enforced by three DB triggers; regrades chain via `previousEvaluationId` with a *required* `regradeReason` (`evaluator.ts:473`) | `ruleVersionId`, `ruleVersionDisplay`, `rulesetChecksum`, `engineVersion`, `evaluationMode`, `canonicalInputSnapshot` |
| `BatchReviewItem` | mutable disposition; `decisionJson`/`inputJson`/`caseJson` written once at ingest | `batchRun.engineVersion`, `batchRun.pinnedRuleVersion*` |
| `BatchRun` | one row per run, `pinnedRuleVersionId` present | yes |
| `ScreeningSession` | `activeModuleVersion`, `recommendationCode`, `nextScreeningDue` | partial |
| `WizardSession` | `decisionJson` written once at completion; `ruleEvaluationId` link | partial |
| `RuleDecision` (separate cases stack) | **`upsert` — overwrites in place** (`grading.ts:517`) | `ruleSetReleaseId` |

> **Finding HIST-01 (ENGINEERING, pre-existing).** `RuleDecision` is upserted, so re-grading a referral case *destroys* the prior recommendation, keeping only an `AuditLog` row. This is the one place in the system where a clinical recommendation can be silently overwritten. It belongs to the separate cases stack (doc 01 EXEC-05) and is **not** created by this cutover — but it is exactly the failure mode the canonical design was built to prevent, and it should be logged as a defect in its own right.

> **Finding HIST-02.** Legacy decisions carry **no ruleset version and no checksum** — only the constant string `business-figures-table1-v1`. There is therefore no way to reconstruct *which* legacy logic produced a historical decision beyond the deployed commit at the time. Historical legacy decisions can be preserved but not re-verified. This is an argument for pinning, not for regrading.

## 2. Policy evaluation

| | Policy | Clinical safety | Auditability | Operational cost | Verdict |
|---|---|---|---|---|---|
| **A** | Pin every case permanently to the engine/ruleset it started under | **Highest.** No decision ever changes underneath a clinician who already acted on it. | Highest — every record explains itself | Two engines coexist indefinitely; reviewers may see mixed provenance in one queue | **RECOMMENDED (base)** |
| **B** | Pending cases switch to canonical at cutover | **Unsafe.** A case a clinician has already partly reviewed, or that a participant has been told about, can change recommendation with no event that triggered it. Also breaks partially-processed batches mid-run. | Poor — the change has no clinical trigger | Low | **REJECT** |
| **C** | Only newly created cases use canonical | Safe, but under-delivers: a case created the day before cutover stays on defective legacy logic forever with no route out | Good | Low | **Insufficient alone** |
| **D** | Existing cases may be explicitly regraded by a reviewer | Safe **only** if additive | Excellent — `previousEvaluationId` + `regradeReason` already model this | Medium — needs a UI and a policy for who may trigger it | **RECOMMENDED (companion)** |

## 3. Recommended policy: **A + D**

> **Every case is permanently pinned to the authority in force when it was first evaluated. Change is possible only through an explicit, reviewer-authorised, reason-bearing regrade that creates a NEW evaluation and never touches the original.**

Formally:

1. **Pinning.** Authority is resolved **once**, at first evaluation, and recorded. Subsequent reads never re-resolve. Implementation requires **no new column**: the pin is the `RuleEvaluation` row reachable from `BatchReviewItem.ruleEvaluationId` / `WizardSession.ruleEvaluationId`, or — for a case with no `RuleEvaluation` at all — the *absence* of one, which means legacy. Cases with no evaluation row are legacy by construction. See doc 05 §Migration.
2. **Batch runs are pinned as a unit.** `BatchRun.pinnedRuleVersionId` is resolved at run start and every row in the run uses it. A run in progress at cutover **completes on its starting authority**. Never mix authorities inside one run — a reviewer working a worklist must not have two engines in one screen without knowing it.
3. **Newly created cases** use whatever `RuleSetActivation` says at creation time. This is Policy C, subsumed.
4. **Regrade (Policy D)** is the only path from legacy to canonical for an existing case:
   - explicit reviewer action, never automatic, never bulk-by-default;
   - requires a non-empty `regradeReason` (already enforced);
   - creates a new `RuleEvaluation` with `previousEvaluationId` set;
   - the **original recommendation, original rule/version, reviewer decision, audit history and export provenance are all retained unchanged**;
   - the case's displayed current recommendation moves to the new evaluation only after clinician confirmation;
   - a regrade of a case with an **already-exported** package requires a new export with a superseding document reference — the original exported package is never withdrawn or rewritten.

## 4. Case-state matrix

| State at cutover | Behaviour | Rationale |
|---|---|---|
| Completed legacy decision, reviewer-confirmed | **Unchanged. Legacy forever.** Regrade available on request. | Someone has acted on it |
| Completed legacy decision, exported | **Unchanged.** Regrade creates a *new* package; the old one stands with its own provenance | Exported artefacts are external records |
| Pending legacy review (in Review Queue, `PENDING`) | **Stays legacy.** Do not switch. | Policy B rejected |
| Case waiting for information (`NEEDS_INFO`) | **Stays legacy** until the information arrives. When it arrives, the reviewer may complete on legacy **or** regrade to canonical — reviewer's choice, reason recorded. | This is where canonical adds the most value (missing-data handling) but it must be a choice, not a surprise |
| Partially processed batch | **Completes on its starting pin.** | Never mix authorities in one run |
| Imported / historic referrals | **Legacy. Never auto-evaluated.** They lack `CanonicalClinicalFactsV2` provenance; generating it would fabricate `source` and `recordedAt`. | Fabrication prohibited |
| Case reopened after cutover | Reopening **does not** change authority. New clinical information → new evaluation under the *current* authority, linked by `previousEvaluationId`. | The trigger is clinical, not administrative |
| Cases evaluated during a canonical window that is later rolled back | **Remain pinned to canonical.** | See doc 04 |

## 5. The 26 legacy defects

All 26 are confirmed present in production and all 26 are regrade-impacting.
Canonical corrects 22.

**This creates an affirmative clinical duty that is separate from, and larger than, the cutover itself.** Pinning (Policy A) means those 22 corrections do **not** reach already-decided participants. Someone must decide whether the historical cohort is reviewed.

> **Finding HIST-03 (BLOCKS_CANONICAL_ACTIVATION — human clinical decision).** A documented, signed regrade policy for the 26 defects is required *before* activation, not after. The minimum acceptable policy must answer: (1) is the historical cohort identified and quantified; (2) for the subset where canonical is *more* urgent than legacy, is there a look-back obligation; (3) who owns participant safety-netting for that subset. **This is a clinical-governance decision and is explicitly not made in this document.**

Recommended engineering support for that decision — all read-only, none of it a regrade:
- a **simulation-mode** cohort report (`evaluationMode: SIMULATION`, which writes `RuleEvaluation` rows that are audit-visible and non-authoritative) counting historical cases where canonical would be *more* urgent than the recorded legacy decision;
- the report must not alter any case, must not appear in any reviewer worklist, and must be labelled as simulation in every view.

**No such report was generated in this exercise, and no historical record was rewritten.**
