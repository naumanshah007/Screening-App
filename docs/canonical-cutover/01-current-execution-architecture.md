# 01 — Current Execution Architecture

**Status:** planning artefact only. No code, rule state, deployment or data was changed.

## 0. Identity verification (performed, not assumed)

| Claim | Verified | Evidence |
|---|---|---|
| Production commit `fb933c3` | **CONFIRMED** | `origin/main` tip is exactly `fb933c3`; `git rev-list --count fb933c3..origin/main` = 0 |
| Integrated candidate `94250e1` | **CONFIRMED as ancestor** | `git merge-base --is-ancestor 94250e1 integration/rule-studio-on-latest-main` → true. **Branch tip is `ab1eb0e`** (`chore(preview): trigger rebuild…`, preceded by `017a62f` R6 status and `4a47c12` R6 credential removal). Assessment was performed against `ab1eb0e`. |
| Local `main` | **STALE** — 11 commits behind `origin/main`. Do not use the local branch for any cutover gate. |

> **Finding EXEC-00 (engineering).** The candidate branch has moved past the commit named in the brief. Any acceptance gate must name a *pinned commit SHA*, not a branch name.

---

## 1. The single most important architectural finding

**The canonical governed ruleset CG-NCSP-3.1.0 is not a router. It is a within-pathway decision layer.**

`currentPathway` is a **required input fact** of the compiled canonical rules
(`lib/clinical-rules/compiled-v2-1.ts` — `eq("currentPathway","FIGURE_3")` and
equivalents gate essentially every Figure rule; also `successor-v3-1.ts:89,122,341`).

Nothing in `lib/clinical-rules/` derives `currentPathway`. In every production
and harness call site it is supplied by the **legacy engine's own output**:

- `app/api/pathway/sessions/[id]/complete/route.ts:137` — `currentPathway: decision.figure`
- `lib/batch/processor.ts:174` — `currentPathway: decision.figure`
- `scripts/rule-studio/run-canonical-differential.ts:63` — `currentPathway: pathwayFor(rule)` (test-harness injection keyed by the rule under test)

`scripts/comparison/emit-router.ts:5` states this explicitly: *"the safety fix
(`ea4e7e3`) lives in the ROUTER — `evaluateClinicalDecision`"*. The 12 router
safety probes therefore test **legacy**, not canonical.

### Consequences

1. **"Replace the legacy engine with CG-NCSP-3.1.0" is not achievable as literally stated.** Removing `evaluateClinicalDecision` removes the router, the age-eligibility gates (`AGE-UNDER-25`, `AGE-70-74-*`, `AGE-75-DISCHARGE`), and the Figure-10 / Figure-9 / Table-1 / hysterectomy precedence chain. Canonical has no substitute for any of these.
2. **The "0 canonical regressions in 179 cases" result is conditional on legacy routing being correct**, because the corpus supplied `currentPathway`. It is a valid result for the decision layer; it is *not* evidence that canonical can route.
3. The achievable and safe cutover is therefore: **legacy retains routing + age gates; canonical becomes the authority for the within-pathway recommendation.** This is what the rest of these documents plan.

> **Finding EXEC-01 (GOVERNANCE_DECISION_REQUIRED + ENGINEERING).** The clinical risk owner must be told that "canonical authority" means *canonical decides the recommendation inside a pathway the legacy router selected*. Signing a cutover approval that reads "canonical replaces legacy" would misdescribe the system.

---

## 2. Entry points for a referral / evaluation

| # | Entry | File | Engine invoked |
|---|---|---|---|
| E1 | Interactive wizard completion | `app/api/pathway/sessions/[id]/complete/route.ts:128` | legacy authority + canonical SHADOW |
| E2 | Session creation | `app/api/sessions/route.ts:108` | legacy only |
| E3 | Stateless rule evaluation API | `app/api/rules/evaluate/route.ts:26` | legacy only |
| E4 | Batch upload / demo / NCSR pull | `lib/batch/processor.ts:154` → `lib/batch/persistence.ts` | legacy authority + canonical SHADOW |
| E5 | Referral-case grading (a **separate** rules stack) | `lib/cases/grading.ts:455` `evaluateCaseRuleRelease` | *neither* — third engine, see §7 |
| E6 | Rule Studio simulation | `lib/clinical-rules/evaluator.ts:456` `evaluateClinicalCase` | canonical only, `SIMULATION` |

---

## 3. Execution diagram — LEGACY path (current authority)

```
INPUT
  E1 wizard answers            E4 CSV / NCSR row
        |                            |
        v                            v
NORMALIZATION
  answersToInputFields()      mapCanonicalToClinicalInput()
  lib/wizard/steps.ts         lib/batch/processor.ts:32
        \                            /
         v                          v
              ClinicalInput  (lib/engine/types.ts)
                        |
                        v
ROUTER  ── evaluateBase()  lib/engine/decision-engine.ts:1645
          precedence: bleeding/F10 → F9 pregnancy → TABLE_1 →
          F8 hysterectomy → AGE GATES (<25 / 70-74 / 75+, with
          red-flag fall-through, R1 fix ea4e7e3) → F2 → F1 →
          first-time transition → F6 ToC → F7 glandular →
          F5 → F4 → default F3
                        |
                        v
ENGINE  ── evaluateFigureN()  (hardcoded, pure, no DB)
                        |
                        v
OVERLAY ── applyGuidelineOverlay()  lib/engine/overlay.ts:73
          admin-editable; may only adjust recall / priority /
          wording / add-review / add-warnings; may NEVER change
          figure, referralType, recommendationCode, or lower
          riskLevel (guardrail lines 127-130)
                        |
                        v
RECOMMENDATION  ClinicalDecision
  { figure, riskLevel, recommendation, recommendationCode,
    nextAction, referralRequired, referralType, referralPriority,
    recallIntervalMonths, safetyOutcome, validationStatus,
    missingInformation, guidelineReference, rationale, branchPath }
                        |
        +---------------+----------------+
        v                                v
REVIEWER WORKFLOW                   PERSISTENCE
  E1: ScreeningSession +               E1: WizardSession.decisionJson
      wizard confirmation                  ScreeningSession.*
  E4: BatchReviewItem.reviewRequired    E4: BatchReviewItem denormalised
      disposition PENDING/ACCEPT/            figure, riskLevel,
      REJECT/NEEDS_INFO                      recommendationCode,
      components/batch/WorklistClient        recommendation,
                                             referralPriority,
                                             referralType,
                                             safetyOutcome,
                                             decisionJson, inputJson
                        |
                        v
EXPORT / AUDIT
  lib/decisions/package-generator.ts  (PDF / CSV / HL7 OBX)
  engine_version = "business-figures-table1-v1"  (processor.ts:24)
  clinical_ruleset_checksum = batchRun.pinnedRulesetChecksum
    → today this is the *shadow* version's checksum, not the
      authority's  ← see Finding EXEC-03
  AuditLog rows
```

## 4. Execution diagram — CANONICAL path (shadow / simulation today)

```
INPUT (same rows, same wizard answers)
                        |
                        v
        ClinicalInput  ──────► *** legacy evaluateClinicalDecision() ***
                        |                       |
                        |                  decision.figure
                        |                       |
                        v                       v
NORMALIZATION  normalizeClinicalFactMap(lib/clinical-rules/facts.ts)
     +  de-fabrication step (deletes menstrualHistoryCaptured,
        speculumExamCompleted, coTestCompleted, stiTreated,
        oralContraceptiveAdjusted … processor.ts:159-170,
        complete/route.ts:133-135)
                        |
                        v
        canonicalClinicalFactsV2FromFlatFacts()
        → CanonicalClinicalFactsV2  { schemaId, subjectReference,
          capturedAt, facts: { name: { value, status, source,
          recordedAt, enteredBy, verificationStatus, corrections }}}
          status ∈ KNOWN | UNKNOWN | NOT_RECORDED | NOT_APPLICABLE
                       | PENDING | CONFLICTING
                        |
                        v
ROUTER  ── *** NONE ***  currentPathway arrives as a supplied fact
                        |
                        v
ENGINE  ── evaluateCanonicalClinicalFactsV2()  evaluator.ts:331
             canonicalClinicalFactsV2ToFactMap()  (KNOWN→value;
               UNKNOWN/NOT_RECORDED/PENDING→missing; CONFLICTING→stop)
             evaluateClinicalSnapshot()  evaluator.ts:221
               three-valued logic TRUE/FALSE/UNKNOWN, depth cap 64
               precedence: governedRulePrecedence → safetyPriority
                           → snapshot order
             safety stops:
               • conflicting facts        → SPECIALIST_REVIEW, HIGH
               • unresolved HIGH/CRITICAL → SPECIALIST_REVIEW,
                                            HIGH/CRITICAL
               • no controlling rule      → CLINICIAN_REVIEW, HIGH/CRITICAL
                        |
                        v
RECOMMENDATION  ClinicalEvaluationResult
  { ruleSetId, ruleVersionId, ruleVersionDisplay, ruleSetChecksum,
    engineVersion, matchedRuleIds, branchPath, provisionalRecommendation,
    riskLevel, urgency, referralDestination, repeatInterval,
    missingInformation, mandatoryReviewerConfirmation (always true),
    reviewerRequirement, clinicianOnly, sourceReferences,
    safetyNotices, factDiagnostics }
                        |
                        v
PERSISTENCE  prisma.ruleEvaluation.create()  evaluator.ts:505
  IMMUTABLE, append-only. Regrade chain via previousEvaluationId +
  required regradeReason (evaluator.ts:473). Three DB triggers
  enforce immutability of evaluated snapshots.
  evaluationMode ∈ LIVE_DEMO | SHADOW | SIMULATION
                        |
                        v
REVIEWER WORKFLOW  ── *** NOT WIRED ***
  BatchReviewItem.ruleEvaluationId is a side-link only
  (persistence.ts:182). The worklist sorts, filters, counts and
  displays from the LEGACY denormalised columns.
                        |
                        v
EXPORT / AUDIT  ── secondary only
  package-generator.ts:265 canonical_shadow_rule_version
                      :266 canonical_shadow_checksum
  Emitted as *shadow* annotation beside the legacy decision.
```

## 5. Where each thing happens (as asked)

| Concern | Legacy | Canonical |
|---|---|---|
| Facts normalized | `lib/wizard/steps.ts`, `processor.ts:32` | `lib/clinical-rules/facts.ts`, `canonical-facts-v2.ts:242` |
| Router | `decision-engine.ts:1645` `evaluateBase` | **none — inherits legacy `decision.figure`** |
| Engine invoked | `decision-engine.ts:1638` | `evaluator.ts:331` / `:221` |
| Recommendation normalized | `withDefaults()` + `applyGuidelineOverlay` | `evaluateClinicalSnapshot` result block, `evaluator.ts:296-328` |
| Reviewer requirement | `safetyOutcome` / `validationStatus` / `reviewRequired` | `reviewerRequirement`, `clinicianOnly`, `mandatoryReviewerConfirmation` (hardcoded `true`) |
| Rule IDs attached | `recommendationCode` (single string) | `matchedRuleIds[]` + `branchPath[]` (`stableRuleId`s) |
| Version / checksum provenance | `engineVersion` string constant only | `ruleVersionDisplay`, `rulesetChecksum`, `engineVersion`, re-verified at eval time (`evaluator.ts:479`) |
| Visible in Review Queue | `BatchReviewItem` denormalised columns | not surfaced as authority |
| Clinician confirmation | `disposition`, `reviewedByUserId`, `overrideReason` | not wired |
| Completed decisions persisted | `BatchReviewItem`, `ScreeningSession`, `WizardSession.decisionJson` | `RuleEvaluation` (append-only) |
| Batch invokes engine | `processor.ts:154` in-process loop | `persistence.ts:182` shadow write |
| Export | `package-generator.ts` | shadow annotation fields only |
| Regrades | **no mechanism** for legacy | `previousEvaluationId` + `regradeReason`, enforced |

## 6. Further findings

> **Finding EXEC-02 (ENGINEERING — must fix before cutover).** `lib/clinical-rules/lifecycle.ts:384-386` hard-throws on `environment === "PRODUCTION"`: *"This proof-of-concept may not activate a production ruleset environment."* Production activation is impossible without a deliberate code change. This is a **correct** safety design and should be removed only as an explicit, reviewed, single-purpose commit.

> **Finding EXEC-03 (ADAPTER_REQUIRED — provenance mislabel).** `lib/batch/persistence.ts:134` pins `BatchRun.pinnedRuleVersionId` / `pinnedRulesetChecksum` from the **shadow** version, while `engineVersion` remains the legacy constant. `package-generator.ts:227,255,340` then exports that checksum as `clinical_ruleset_checksum` next to a legacy recommendation. Today an exported package can carry a canonical checksum against a legacy decision. This must be corrected as part of cutover regardless of which strategy is chosen.

> **Finding EXEC-04 (ENGINEERING).** `mandatoryReviewerConfirmation` is hardcoded `true` for every canonical result (`evaluator.ts:320`). Combined with GOV-04's 152/179 `clinicianOnly`, canonical authority currently means *near-total loss of automation*. See doc 05.

> **Finding EXEC-05 (NOT_RELEVANT_TO_CUTOVER, but must not be confused).** `lib/cases/grading.ts` is a **third, independent** rules stack — `RuleSetRelease` / `RuleDecision` / `evaluateCaseRuleRelease`, driving COLPOSCOPY / GYNAECOLOGY referral triage. It already has its own publish/active-release lifecycle (`getActiveCaseRuleSetRelease`). It is **not** in scope for CG-NCSP-3.1.0 and must not be swept into the same activation. Confirm this explicitly with the risk owner so nobody assumes "the rules were switched" covers it.

## 7. Batch fabrication note

`processor.ts:94-105` injects `menstrualHistoryCaptured / contraceptiveHistoryCaptured /
sexualHistoryCaptured / speculumExamCompleted / pelvicExamCompleted / coTestCompleted`
as `true` for every bleeding case, and `oralContraceptiveAdjusted` / `stiTreated`
from mere suspicion. **These are fabricated clinical facts in the legacy path.**
The canonical shadow path already strips them (lines 159-170). Any cutover must
keep them stripped — see doc 02 §Fabrication.
