# CerviGrade rule-studio current architecture

Recorded on 2 August 2026 from branch `codex/versioned-clinical-rule-studio` at base commit `578b4b046aed60ef68b950ffb5945e4bf6ec956b`.

This document describes the repository before the versioned NCSP rule-studio integration. It is an engineering baseline, not a statement of clinical validation or production readiness.

## Current decision systems

CerviGrade currently has two separate deterministic rule systems with different responsibilities.

1. **NCSP clinical decision engine.** `lib/engine/decision-engine.ts` exposes `evaluateClinicalDecision(ClinicalInput)`. Its Figure 1–10 and Table 1 routing is TypeScript logic, selected by a hard-coded global router. `lib/batch/processor.ts`, `app/api/rules/evaluate/route.ts`, `app/api/sessions/route.ts`, and the pathway-completion endpoint call this function directly. The processor reports the fixed identifier `business-figures-table1-v1`.
2. **Operational booking/triage rule releases.** `lib/cases/rule-policy.ts`, `lib/cases/rule-evaluator.ts`, `lib/cases/rule-releases.ts`, and `lib/cases/grading.ts` implement editable COLPOSCOPY/GYNAECOLOGY rules. Conditions use a typed declarative union rather than executable JavaScript. These releases choose booking priority, category, target days, and operational outcome; they are not the complete NCSP clinical graph.

These systems must not be collapsed by treating local booking rules as national clinical logic. The new versioned engine will own national NCSP evaluation. Existing `CaseRuleSetRelease` records remain local operational overlays and continue to run after a national clinical result has been generated.

## Clinical engine entry points

| Consumer | Current entry point | Persistence/provenance behaviour |
|---|---|---|
| Manual pathway completion | `app/api/pathway/sessions/[id]/complete/route.ts` | Stores a full legacy `ClinicalDecision` JSON in `WizardSession.decisionJson`; no relational rule-version record. |
| Session API | `app/api/sessions/route.ts` | Calls the legacy engine and stores downstream session/recall data. |
| Preview API | `app/api/rules/evaluate/route.ts` | Calls the legacy engine without saving an evaluation. |
| Batch processing | `lib/batch/processor.ts` | Maps `CanonicalBatchCase` to `ClinicalInput`, calls the legacy engine, and labels the run with a fixed engine version. |
| Batch persistence | `lib/batch/persistence.ts` | Freezes `caseJson`, `inputJson`, and `decisionJson`; also stores denormalised recommendation fields and the separate operational triage release/version. |
| Case grading | `lib/cases/grading.ts` | Evaluates an active `CaseRuleSetRelease` and stores one `RuleDecision` per referral case. |

## Rule storage and release control

- `ClinicalRuleSet` is a currently unused, single-table placeholder containing a unique `version`, `rulesJson`, active flag, and review/publish metadata. It does not model a stable family plus immutable versions, activations, evaluation provenance, layouts, or audit history.
- `CaseRuleSetRelease` has useful governance conventions: semantic version per service line, a JSON definition, reviewer and publisher relations, regression gating, and an atomic active-release switch. Drafts are editable only while unpublished and inactive. It lacks explicit status, checksum, parent snapshot, environment/scope activation, and full clinical graph concepts.
- `RuleDecision` records the operational release and generated grade for a referral case. It is not a record of the NCSP Figure/Table evaluation.
- `AuditLog` is the repository-wide event ledger and already supports actor, action/entity, before/after JSON, IP address, user agent, severity, and correlation ID. Version-specific audit events can follow this convention while retaining typed version relations.

## Current visual trees and Rule Studio

- `lib/decision-trees/index.ts` contains hand-written, simplified SVG node/edge arrays for Figures 1–10. These are presentation data, are not generated from the evaluator, and explicitly identify themselves as simplified visuals.
- `components/rules/RuleStudioEditor.tsx` is a form editor for operational `CaseRuleSetRelease` JSON. It supports rule ordering and typed conditions, but it is not a canonical graph editor.
- `app/(app)/rules` and `app/api/case-rules` provide the existing operational release list, draft editor, review, publish/activate flow, and regression summaries.
- No mature graph-editor dependency is currently installed. The requested clinical studio therefore needs one shared graph model and an interactive client projection; the existing static Figure definitions must not become another source of truth.

## Data flow to completed decisions and exports

```text
CSV/XLSX/JSON/demo case
  -> batch adapter and CanonicalBatchCase validation
  -> mapCanonicalToClinicalInput
  -> legacy evaluateClinicalDecision
  -> BatchCaseResult
  -> save BatchRun + immutable BatchReviewItem JSON snapshots
  -> optional active CaseRuleSetRelease booking grade
  -> reviewer disposition
  -> completed-decision view
  -> simulated CSV/FHIR/HL7/JSON export package
```

`BatchReviewItem` is the durable review/completed-decision record. Export builders consume the stored item; they do not need to re-run the clinical engine. This is the correct preservation boundary: new provenance fields and a linked `RuleEvaluation` may be added, but historical `decisionJson` must never be silently rewritten.

Manual pathways similarly freeze `WizardSession.decisionJson`. A new relational evaluation link may be added, while the stored snapshot remains readable and unchanged.

## Router precedence and clinical tests

- Router precedence is embedded in `evaluateClinicalDecision`; dedicated tests exist in `lib/engine/__tests__/routing-precedence.test.ts`.
- Figure-specific tests exist under `lib/engine/__tests__`, including Figure 1 and Figure 9 suites, wizard integration, access control, and clinical-audit additions.
- Batch tests exercise mapping, persistence, dashboards, review, reprocessing, and rule diffs.
- The current tests remain the legacy shadow oracle only. Expected outcomes for the new source-derived model must come from the verified v2.1 package and primary-source audit, not from production code.

## Permissions and scope

- Repository permissions currently expose `rules:view`, `rules:edit`, and `rules:publish`; ADMIN can edit/publish and clinical roles can view.
- `lib/cases/rule-governance.ts` already separates viewing, draft editing, clinical review, and ADMIN activation for operational releases.
- There is no general `Organisation` model or request-scoped tenant context. `GPPractice` is a patient/user association, not a proven organisation-isolation boundary for national rule activation.
- Initial national-rule activation should therefore be `GLOBAL` and environment-scoped. The schema can carry a nullable `organisationKey` for future integration, but the UI and resolver must not claim organisation isolation until the application has a real tenant boundary.

## Extension decisions

1. Refactor the unused `ClinicalRuleSet` placeholder into the stable family record and add `ClinicalRuleVersion`, `RuleSetActivation`, `RuleEvaluation`, and `RuleVersionAuditEvent`.
2. Store each version as one canonical, validated snapshot JSON. Rules, graph nodes, graph edges, outcomes, sources, views, and per-view layouts live in that snapshot; pathway views only reference canonical IDs.
3. Reuse repository audit, auth, Prisma, Zod, API, and optimistic-update conventions.
4. Keep `CaseRuleSetRelease` as the local operational overlay mechanism. It must not rewrite or relabel national outcomes.
5. Preserve `evaluateClinicalDecision` behind an explicit legacy adapter for shadow comparison until source-derived executable coverage is demonstrated.
6. Add immutable `RuleEvaluation` records and link new batch/wizard outputs to them without changing prior JSON snapshots.

## Migration risks and controls

| Risk | Control |
|---|---|
| Existing `ClinicalRuleSet` table shape conflicts with the family concept | Migrate the unused placeholder explicitly and verify the demo database; do not create a second competing national-rule table. |
| Dirty worktree contains prior clinical-audit and feature changes | Preserve all existing changes, make narrowly scoped patches, and never reset or overwrite unrelated files. |
| SQLite cannot enforce all conditional uniqueness/immutability rules | Use a partial unique activation index plus transactions and service-layer guards; published snapshot updates are rejected. |
| Source JSON contains clinical prose rather than a compiled Boolean AST | Import prose and provenance losslessly, mark uncompiled conditions as clinician-review boundaries, and never invent executable logic from text. Typed expressions are required before autonomous traversal. |
| Existing flows assume a synchronous pure evaluator | Add a version-resolving async orchestration layer and retain a pure snapshot evaluator for tests/simulation. |
| Batch runs can span an activation change | Resolve and pin a version before processing/persistence; never resolve per row. |
| Activation could alter open/completed cases | New evaluations use the new activation; completed outputs stay frozen; regrading is explicit, reasoned, linked, and audited. |
| Visual projections can drift from execution | Validate all view IDs against the canonical node/edge collections and build rulebook/diff/export projections from the same snapshot. |
| v2.1 package is a verification specification, not a clinical approval | Keep all required demo and provisional safety wording and require reviewer confirmation.

## Temporary legacy code

The following must remain until shadow comparison and governance sign-off are complete:

- `lib/engine/decision-engine.ts` and `lib/engine/types.ts`;
- existing Figure/Table and router-precedence tests;
- `lib/batch/processor.ts` legacy adapter path;
- current wizard/session decision snapshots;
- static `lib/decision-trees` views where older screens still reference them;
- operational `CaseRuleSetRelease` evaluation and release lifecycle.

Successful import, validation, or automated tests are software-engineering evidence only. They are not clinical validation, pilot approval, or production readiness.
