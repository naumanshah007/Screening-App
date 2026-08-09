# 02 — Minimum Switch Point, Input Compatibility, Output Compatibility

Covers brief Phases 2, 3 and 4.

---

# Phase 2 — Minimum safe switch point

## Options assessed

| | Option | Verdict |
|---|---|---|
| **A** | Replace legacy evaluator directly | **REJECT — unsafe and infeasible.** Deletes the router and age gates (doc 01 §1). Canonical cannot route. Would reintroduce every R1-class age-gate defect. |
| **B** | Authority selector / engine adapter | **Necessary but not sufficient alone** — it is the *mechanism*, and it is the right one, but it needs G to decide *which* authority. |
| **C** | New ruleset activation service | **REJECT — duplication.** `lib/clinical-rules/lifecycle.ts` already is this service (DRAFT→VALIDATED→PUBLISHED→ACTIVE, activation records, retirement, rollback, 30 s cache). Building a second one violates "do not create a second production stack". |
| **D** | Org-level feature flag | **REJECT as primary.** `ClinicalRuleSet.organisationKey` is nullable and the app has *no tenant model* (schema comment: "The application does not yet have a general tenant model"). A per-org flag would be a *new* concept. `RuleSetActivation.organisationKey` already supports org scoping with global fallback (`lifecycle.ts:502-508`) — keep it available, do not make it the switch. |
| **E** | Per-case feature flag | **REJECT.** Case-level authority selection is exactly the "second independent routing stack" the brief forbids, and it makes audit non-deterministic. |
| **F** | Dual execution, canonical displayed | **REJECT as an end state; ACCEPT as a transitional phase.** Displaying one engine while another is legally authoritative is a governance trap: reviewers act on what they see. Acceptable only while legacy remains *both* authoritative and displayed, with canonical shown as an explicitly-labelled comparison. |
| **G** | Publish + activate, resolve authority from `RuleSetActivation` | **RECOMMENDED.** |

## Recommended architecture

**G, implemented through B, over a retained legacy router.**

```
ClinicalInput
     |
     +--> [ RETAINED ] legacy router: evaluateBase() precedence chain
     |                  + age eligibility gates
     |                  → figure, and the legacy ClinicalDecision
     |
     v
resolveClinicalAuthority({ environment, organisationKey })      ← NEW, ~1 file
     |   reads RuleSetActivation (deactivatedAt IS NULL, isDefault)
     |   returns { mode: "LEGACY" } | { mode: "CANONICAL", version }
     |
     +-- LEGACY  ---> legacy ClinicalDecision is authority (today's behaviour,
     |                 byte-identical when no activation row exists)
     |
     +-- CANONICAL -> canonical facts (currentPathway := legacy figure)
                      → evaluateClinicalCase(mode: LIVE_*)
                      → canonicalToClinicalDecision(adapter)      ← NEW, ~1 file
                      → authority ClinicalDecision
```

**Exact switch point — two files, one new function each:**

1. `lib/clinical-rules/authority.ts` **(new)** — `resolveClinicalAuthority()`. Thin wrapper over the *existing* `resolveActiveClinicalRuleVersion()` (`lifecycle.ts:476`). Default when no `ACTIVE` activation exists for the environment = **LEGACY**. This makes "do nothing" the safe state and makes rollback a data operation.
2. `lib/clinical-rules/decision-adapter.ts` **(new)** — `canonicalToClinicalDecision(result, legacyDecision)`. Produces the `ClinicalDecision` shape the rest of the app already consumes (see Phase 4). Inherits `figure` and `branchPath` root from the legacy router; overrides recommendation/risk/referral/reviewer fields from canonical; **never** de-escalates below the legacy decision (same guardrail idiom as `overlay.ts:127-130`).

Then **three call-sites change**, each by one line plus an `await`:
`app/api/pathway/sessions/[id]/complete/route.ts:128`,
`lib/batch/processor.ts:154` (needs to become async or accept a pre-resolved authority),
`app/api/rules/evaluate/route.ts:26`.

`app/api/sessions/route.ts:108` is a session-scaffold call, not a graded decision — leave on legacy and document it.

**No clinical logic is duplicated. No second router is created. One authority-selection layer.**

---

# Phase 3 — Input compatibility

## 3.1 Intake paths

| Intake | Reaches `ClinicalInput`? | Can populate `CanonicalClinicalFactsV2`? | Verdict |
|---|---|---|---|
| Manual referral / wizard (E1) | yes | yes, via `answersToInputFields` → `normalizeClinicalFactMap` → `canonicalClinicalFactsV2FromFlatFacts` | **SAFE** |
| Pulled / NCSR referrals | yes, through the batch adapter | yes, same route | **SAFE, unverified at volume** — no authenticated production NCSR pull has been exercised |
| Batch uploads (CSV/XLSX) | yes | yes (`canonical-clinical-facts-v2-template.xlsx` + field dictionary + JSON schema shipped) | **SAFE** |
| Integrations (HL7/FHIR adapters) | yes | yes | **SAFE, unverified** |
| Historic / imported cases | `ClinicalInput` reconstructable from `BatchReviewItem.inputJson` | yes, but provenance would be `PRIOR_RECORD` at best | **DO NOT RE-EVALUATE** — see doc 03 |
| Incomplete cases | yes | yes — absent keys are simply absent, and canonical treats absence as `UNKNOWN` → safety stop | **SAFE and strictly safer than legacy** |

## 3.2 Fact-status expressiveness — the real gain

`canonicalClinicalFactsV2FromFlatFacts` (`canonical-facts-v2.ts:242`) is the
**lossy** part: it maps every present scalar to `status: "KNOWN"` and drops
`undefined`/`null` entirely. It therefore cannot emit `UNKNOWN`,
`NOT_RECORDED`, `NOT_APPLICABLE`, `PENDING` or `CONFLICTING` — the five states
that are the point of the V2 contract.

> **Finding IN-01 (ADAPTER_REQUIRED, blocking for full value; not blocking for safety).** The flat-fact adapter collapses "not recorded" and "unknown" into "absent". Absent is treated as missing → safety stop, so this is **fail-safe**, not unsafe. But until intake distinguishes these states, canonical will over-stop. This directly compounds GOV-04. Fixing it is UI + intake work (doc 06 Phase 12), not engine work.

## 3.3 Field matrix

`L→C` = legacy `ClinicalInput` field → canonical fact name. Transformation column notes anything beyond a rename.

| Production field | Legacy mapping | CanonicalClinicalFactsV2 field | Transformation | Info-loss risk | Verdict |
|---|---|---|---|---|---|
| patient DOB / age | `patientAge` | `ageYears` | integer years; both compute from DOB | none | **SAFE** |
| ethnicity | `ethnicityPrimary` | *(not referenced by rules)* | → `factsIgnored` | none (equity reporting only) | **SAFE** |
| HPV result | `hpvResult` | `hpvResult` | direct | none | **SAFE** |
| HPV genotype detail | folded into `hpvResult` | `hpvResult` + `preTreatmentHpvGenotype` | direct | none | **SAFE** |
| Prior HPV | `priorScreeningHistory`, `sixMonthHpvResult`, `eighteenMonthHpvResult` | same names | direct | none | **SAFE** |
| Cytology (current) | `cytologyResult` | `cytologyResult` | direct | none | **SAFE** |
| Prior cytology | `priorLowGradeResult`, `priorHighGradeResult` | `previousCytologyClass` | **enum re-classification** (booleans → `POSSIBLE_HSIL`/`DEFINITE_HSIL`/`ATYPICAL_GLANDULAR_NON_ENDOMETRIAL`) | **MEDIUM** — a boolean cannot say *which* high-grade class | **ADAPTER_REQUIRED** |
| Cytology adequacy | `unsatisfactoryCytologyCount` | `cytologyAdequacy`, `consecutiveUnsatisfactoryCount`, `cytologyPending` | count → count; adequacy/pending **not present in legacy** | absence → `UNKNOWN` → stop | **SAFE (fail-safe)** |
| Histology | `histologyResult`, `biopsyResult` | `histologyResult`, `biopsyResult`, `currentHistology`, `treatedHistology` | direct + context split | LOW | **SAFE** |
| Sample type / validity | `sampleType` | `sampleType` + `hpvValidity`,`hpvSampleValid/Invalid/Unsuitable/Leaked/Inadequate` | legacy has **only** `sampleType` | validity states absent → stop | **SAFE (fail-safe)** |
| Immune status | `immunocompromised: boolean` | `immuneClassification: IMMUNE_COMPETENT \| IMMUNE_DEFICIENT` | boolean → enum | none (total mapping) | **SAFE** |
| Pregnancy | `isPregnant`, `postpartumReviewTiming` | `isPregnant` | direct | none | **SAFE** |
| Abnormal bleeding | `hasAbnormalVaginalBleeding`, `bleedingType`, `abnormalBleedingStage`, `bleedingResolved` | `bleedingType`, `bleedingEpisodeCount`, `bleedingEpisodeState`, `bleedingDurationDays`, `bleedingResolved`, `bleedingReviewDate`, `menopausalStatus` | **canonical is richer**; legacy has no episode count / duration / menopausal status | absent → stop | **SAFE (fail-safe)** |
| Bleeding work-up | `menstrualHistoryCaptured`…`coTestCompleted` — **fabricated `true` in batch** (`processor.ts:94-105`) | `speculumExamStatus`, `pelvicExamStatus`, `coTestStatus`, `stiAssessmentComplete` | **MUST remain stripped** | — | **UNSAFE IF INHERITED** — see §3.4 |
| Previous treatment | `isTestOfCure`, `testOfCureStage`, `excisionStatus` | `treatmentModality`, `treatmentDate`, `marginStatus`, `marginApplicability`, `tocEventSequence`, `tocStatus` | **decomposition**; legacy `excisionStatus` carries margin implicitly | **MEDIUM** — margin status not separately recorded in legacy | **ADAPTER_REQUIRED** |
| Hysterectomy | `isPostHysterectomy`, `hysterectomyType`, `hysterectomyIndication`, `hysterectomySpecimenPathology`, `postHysterectomyHpvTestIndicated` | `hysterectomyType`, `cervixPresent` | `cervixPresent` derivable from `hysterectomyType === "TOTAL"` — a **defined clinical equivalence**, not a fabrication | LOW | **SAFE (document the derivation)** |
| Cancer history | `suspicionOfCancer`, `hasCancerSymptoms`, `invasionStatus` | `cancerType`, `gynaecologicalCancerType`, `cancerStage`, `cancerTreatment`, `treatmentConfirmed`, `ncspApplicability`, `cancerFollowUpPhase`, `invasionStatus` | **canonical far richer**; legacy has *no* cancer type/stage/treatment fields | absent → stop | **SAFE (fail-safe)** — and this is precisely the 2 unresolved input gaps (stage-1A1, non-cervical-cancer hysterectomy overlay) |
| Longitudinal history | `consecutiveNegativeCoTestCount`, `consecutiveLowGradeCount`, `screeningHistoryKnown`, `historySourceAvailable` | `tocEventSequence`, `followUpEventCount`, `eventStage`, `surveillanceDurationMonths` | counts → sequence/stage enums | LOW-MEDIUM | **ADAPTER_REQUIRED** |
| Colposcopy findings | `normalColposcopy`, `visibleLesion`, `transformationZoneState`, `colposcopicImpression`, `colposcopyTZType`, `mdmOutcome` | `visibleLesion`, `colposcopicImpression`, plus CIN2-surveillance set | direct + additions | LOW | **SAFE** |
| CIN2 surveillance | **absent from legacy entirely** | `cin2SurveillanceEligible`, `cin2ActiveSurveillance`, `cin3Excluded`, `sharedDecisionRequired`, `participantTreatmentPreference`, `fertilityContextDocumented`, `cin2RegressionConfirmed` | n/a | absent → stop | **SAFE — newly expressible** |
| **`currentPathway`** | **`decision.figure` (legacy engine OUTPUT)** | `currentPathway` | **engine output re-entered as an input fact** | **STRUCTURAL** | **GOVERNANCE_DECISION_REQUIRED** — see IN-02 |

## 3.4 Fabrication check (prohibited)

Two places where switching engines *would* require or perpetuate fabrication.
Neither is acceptable; both already have the correct mitigation in the candidate.

> **Finding IN-02 (GOVERNANCE_DECISION_REQUIRED — the central one).** `currentPathway` is emitted by legacy and consumed by canonical as a `KNOWN`, `verificationStatus: "UNVERIFIED"` fact whose `source` is `REVIEWER_ENTRY` (wizard) or `PRIOR_RECORD` (batch). **Neither provenance label is true — the source is a software router.** This is a provenance misstatement in the immutable evaluation record. Required before cutover: (a) add a `DERIVED_ROUTER` value to `CanonicalFactSourceSchema` and label it honestly, and (b) the risk owner must accept in writing that canonical decisions are conditional on legacy routing. Do not proceed on the current labelling.

> **Finding IN-03 (must be preserved).** The legacy batch path fabricates eight clinical work-up facts (`processor.ts:94-105`). The canonical path already deletes them (`processor.ts:159-170`, `complete/route.ts:133-135`). **Under canonical authority these deletions must remain**, which means canonical will emit "missing information" safety stops on bleeding cases where legacy silently proceeded. This is a correction, will look like a regression in throughput, and must be pre-communicated to reviewers.

**No other case was found where switching engines requires inventing a fact.** Everywhere else canonical is either equal to legacy or strictly richer, and richer-with-absent-data resolves to a safety stop, never to a guess.

**Result: 18/18 input states representable; 16/18 resolved; 2 (stage-1A1, non-cervical-cancer hysterectomy overlay) remain open clinical adjudications. No fabrication required, provided IN-02 and IN-03 are honoured.**

---

# Phase 4 — Output compatibility

Legacy authority contract = `ClinicalDecision` (`lib/engine/types.ts`).
Canonical produces `ClinicalEvaluationResult` (`evaluator.ts:31`).

## 4.1 Field-by-field

| Output | Legacy | Canonical | Classification |
|---|---|---|---|
| recommendation code | `recommendationCode` (single string, e.g. `F3-1618-COLP`) | `matchedRuleIds[]` (array of `stableRuleId`) | **ADAPTER_REQUIRED** — cardinality mismatch 1:N. Adapter takes the controlling rule. `BatchReviewItem.recommendationCode` is `String`, indexed and filtered on. |
| action / recommendation text | `recommendation`, `nextAction` | `provisionalRecommendation` (one field) | **ADAPTER_REQUIRED** — canonical has no separate `nextAction` |
| urgency | `referralPriority` (`P1..P4`) | `urgency` (`URGENT`/`P2`/`P3`, *inferred by regex* `evaluator.ts:174-181`) | **ADAPTER_REQUIRED + GOVERNANCE_DECISION_REQUIRED** — regex-inferred urgency from free text is not a governed derivation. See OUT-01. |
| timing | `recallIntervalMonths`, `nextScreeningIntervalMonths` (integers) | `repeatInterval` (**free-text** `timingDestination`) | **ADAPTER_REQUIRED** — string→int parse. Drives `addMonths()` for `nextScreeningDue` (`complete/route.ts`) and the whole recall/overdue analytics. See OUT-02. |
| referral destination | `referralRequired: boolean` + `referralType` (enum) | `referralDestination` (free-text `careSetting`) | **ADAPTER_REQUIRED** — string→enum; `referralRequired` must be derived |
| clinicianOnly | *no equivalent* | `clinicianOnly: boolean` | **UI_CHANGE_REQUIRED** (new concept to surface) |
| reviewerRequirement | `validationStatus`, `safetyOutcome` | `reviewerRequirement` (`CLINICIAN_REVIEW`/`SPECIALIST_REVIEW`/…), prefixed `CLINICIAN_ONLY:` when `clinicianOnly` (`evaluator.ts:528`) | **ADAPTER_REQUIRED** |
| safety stop | `safetyOutcome: "CLINICIAN_REVIEW_REQUIRED"`, `validationStatus: "REQUIRES_CLINICAL_CONFIRMATION"` | three distinct stop branches (`evaluator.ts:261,365,399`) | **DIRECTLY_COMPATIBLE via adapter** — canonical is a superset |
| missing information | `missingInformation: string[]` (human phrases) | `missingInformation: string[]` (**fact names**) + `factDiagnostics` | **UI_CHANGE_REQUIRED** — reviewers would see `preTreatmentHpvGenotype`, not "Enter exit HPV result". Needs a fact-name→label dictionary (the shipped field dictionary CSV covers this). |
| rule ID | `recommendationCode` | `matchedRuleIds[]` | ADAPTER_REQUIRED |
| pathway / figure | `figure: PathwayFigure` | *(none — inherits input `currentPathway`)* | **DIRECTLY_COMPATIBLE** (carried from legacy router) |
| source references | `guidelineReference` (string) | `sourceReferences: SourceReference[]` | **UI_CHANGE_REQUIRED** (richer; worth surfacing) |
| rationale | `rationale` (string), `branchPath: string[]` | `branchPath: string[]` (`node:`/`branch:` form), `safetyNotices[]` | **ADAPTER_REQUIRED** — different vocabulary |
| version | `ruleVersion` (implicit constant) | `ruleVersionDisplay` (`CG-NCSP-3.1.0`) | **DIRECTLY_COMPATIBLE** |
| checksum | none | `ruleSetChecksum`, re-verified at eval (`evaluator.ts:479`) | **DIRECTLY_COMPATIBLE** (fields already exist on `BatchRun`) |

> **Finding OUT-01 (GOVERNANCE_DECISION_REQUIRED).** `inferUrgency()` derives clinical priority by regex-matching `/immediate|urgent|P1\b/i` over concatenated free text. Under shadow this is harmless. **Under authority it becomes a clinical derivation that is neither in the governed snapshot nor checksummed.** Either encode urgency explicitly per rule/outcome-branch in CG-NCSP-3.1.0, or map priority in the adapter from the legacy decision. Do not ship regex-derived priority as authority.

> **Finding OUT-02 (SCHEMA-ADJACENT, ADAPTER_REQUIRED).** `repeatInterval` is free text (`timingDestination`). `ScreeningSession.nextScreeningDue`, `Recall`, overdue-recall analytics (`app/api/analytics/overdue-recalls`) and notifications all need an **integer month count**. A parse failure must be a safety stop, never a silent null — a silent null means a participant is never recalled. This is the single highest-consequence adapter defect risk in the whole cutover.

## 4.2 Consumers of the legacy output

| Consumer | Fields relied on | Classification |
|---|---|---|
| Wizard result UI `app/(app)/pathway/[sessionId]/result` | full `ClinicalDecision` | ADAPTER_REQUIRED (unchanged if adapter emits the shape) |
| Review Queue / worklist `components/batch/WorklistClient`, `BatchDataTable` | `figure`, `riskLevel`, `recommendationCode`, `recommendation`, `referralPriority`, `referralType`, `safetyOutcome`, `reviewRequired` — **denormalised, sorted and filtered in SQL** | **ADAPTER_REQUIRED** (populate from canonical) |
| Batch stat cards `BatchStatCards` | `reviewRequiredCount`, `pendingCount`… | ADAPTER_REQUIRED |
| Batch detail `BatchResultDetail` | `decisionJson`, `inputJson`, `caseJson` | ADAPTER_REQUIRED |
| Completed Decisions `lib/decisions/completed-decisions.ts` | disposition + denormalised columns | DIRECTLY_COMPATIBLE via adapter |
| Export `lib/decisions/package-generator.ts` | `recommendationCode`, `engineVersion`, `pinnedRulesetChecksum`, shadow block | **ADAPTER_REQUIRED** + fix EXEC-03 mislabel |
| Audit `AuditLog`, `RuleVersionAuditEvent` | append-only | DIRECTLY_COMPATIBLE |
| Analytics `lib/decisions/dashboard-metrics.ts`, overdue-recalls | `recallIntervalMonths` → `nextScreeningDue` | **ADAPTER_REQUIRED** (see OUT-02) |
| Notifications `app/api/notifications/send-recall` | recall date, priority | ADAPTER_REQUIRED |
| Public APIs `/api/rules/evaluate`, `/api/sessions` | `ClinicalDecision` JSON shape | **DIRECTLY_COMPATIBLE if and only if the adapter preserves the shape** — treat as a published contract; do not change field names |
| Guideline overlay `lib/engine/overlay.ts` + `rule-catalog.ts` | keyed by `recommendationCode` | **GOVERNANCE_DECISION_REQUIRED** — see OUT-03 |

> **Finding OUT-03 (GOVERNANCE_DECISION_REQUIRED).** The admin guideline overlay is keyed on legacy `recommendationCode`. Under canonical authority those codes no longer identify the controlling logic, so **every configured overlay entry silently stops applying**. Two admin-visible safety behaviours (forced review, extra warnings) would vanish without any error. Decide before cutover: (a) disable the overlay under canonical authority and say so in the UI, or (b) re-key it to `stableRuleId`. **Option (a) is recommended** — canonical rules are themselves governed and versioned, so an ungoverned overlay on top of them is a regression in governance.

**No output was found in the `NOT_SUPPORTED` class.** Every legacy consumer can be served by the adapter. The work is real but it is adapter and UI work, not redesign.
