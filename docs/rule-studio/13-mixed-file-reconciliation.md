# Mixed-file integration reconciliation

Date: 2 August 2026

Branch: `codex/versioned-clinical-rule-studio`

Rule Studio base before this reconciliation: `786af7f`

## Outcome

The Rule Studio integration has been separated from the pre-existing dirty working tree without using `git add -A`. The reviewed integration patch contains only versioned-rule persistence, shadow-evaluation, provenance, governed-permission, schema/bootstrap, and Rule Studio regrade changes. Unrelated patient access, batch triage, reprocessing, prior-decision comparison, dashboard, styling, and HL7 timestamp changes remain unstaged.

The staged-only checkout passes TypeScript and Prisma schema validation. The focused export-provenance tests pass 5/5 and the database immutability/activation constraint tests pass 4/4. The complete Rule Studio suite is deferred to the clean-checkout phase because it deliberately requires the external v2.1 source package, which is not committed to Git.

No SQLite database or generated Prisma client is staged. `CG-NCSP-3.0.0` remains a draft and no activation was created.

## Hunk ownership register

| Mixed file | Rule Studio integration retained | User-owned work preserved unstaged |
|---|---|---|
| `prisma/schema.prisma` | Versioned rule enums; `ClinicalRuleSet`, `ClinicalRuleVersion`, `RuleSetActivation`, `RuleEvaluation`, and `RuleVersionAuditEvent`; user/case/wizard/batch relations; batch version pins; evaluation links | Batch triage/reprocessing fields and indexes; unrelated formatting |
| `lib/batch/persistence.ts` | Resolve shadow version; pin version/display/checksum on the run; persist per-item shadow evaluations and link them; audit shadow failures | Active case-rule grading, triage, reprocessing, prior snapshots, and disposition-concurrency edits |
| `lib/database/bootstrap.ts` | Trigger-aware SQL statement splitting required by immutable snapshot triggers | Triage/reprocessing bootstrap patches |
| `lib/database/current-schema.sql` | Migration-backed Rule Studio tables, indexes, foreign keys, version pins, evaluation links, and immutability/activation triggers | Triage/reprocessing columns, indexes, and unrelated patient identity index |
| `app/api/pathway/sessions/[id]/complete/route.ts` | Run the governed version in shadow mode after the legacy decision; audit shadow failure; link the saved evaluation; return visible shadow provenance | Wizard access-control, preview, safety-finalisation, compare-and-set, and transaction refactor |
| `components/batch/BatchResultDetail.tsx` | None required: historical provenance is supplied through the persisted run and export package | Figure-focus redesign, triage, prior-decision comparison, and pathway display changes |
| `components/batch/WorklistClient.tsx` | None required: the committed component already accepts the legacy engine version; Rule Studio provenance is shown at the run level | Triage priority, reprocessing, filtering, clinical-review note, and detail-focus changes |
| `lib/decisions/package-generator.ts` | Historical rule version, checksum, and engine version in summary, GP letter, CSV, FHIR-like JSON, HL7-style message, and PAS preview | Unrelated HL7 timestamp correction |
| `lib/decisions/dashboard-metrics.ts` | Select the persisted run engine and pinned rule version/display/checksum for completed-decision exports | Triage grouping and reprocessing-related metrics |
| `app/(app)/batch/BatchPageClient.tsx` | None required | Batch-result filter and detail-focus UX |
| `app/(app)/batch/runs/[id]/page.tsx` | Show the legacy authority and pinned versioned shadow; expose governed regrade comparison only when permitted; show unavailable state without an active draft | Prior snapshots, triage, and the separate legacy `RegradeRunButton` integration |
| `lib/batch/__tests__/decision-package.test.ts` | Pinned provenance fixture plus full simulated-export provenance assertions | Unrelated HL7 timestamp assertion |
| `lib/auth/permissions.ts` | Typed Rule Studio validate, approve, activate, rollback, simulate, and export permissions and role grants | Patient registry, manual-pathway, recall, and route-guard permissions |

## Clean adapters and supporting evidence

The wizard-completion hunk was rebuilt against committed `HEAD` as a minimal adapter because its working-tree version contains a substantial user-owned transaction/access-control refactor. The first index placement was rejected during patch review; the corrected adapter was generated in a detached checkout, re-applied to the review index, and compiled before commit.

The source-derived differential scripts require two audit support modules. These are now included explicitly:

- `tests/clinical-conformance/support/guideline-oracle.ts`
- `tests/clinical-conformance/support/conformance-runner.ts`

The first holds the direct source rule register. The second provides synthetic input construction; the differential expected outcomes are not obtained from the legacy evaluator.

## Special-check evidence

- Prisma staged-only schema: valid.
- Schema coverage: all models and relations created by `20260802090000_versioned_clinical_rule_studio` are present.
- Batch pinning: `BatchRun.pinnedRuleVersionId`, `pinnedRuleVersionDisplay`, and `pinnedRulesetChecksum` are populated from the resolved shadow version.
- Wizard provenance: `WizardSession.ruleEvaluationId` links the persisted shadow evaluation.
- Historical decisions: completed-decision selection carries the stored engine and pinned version rather than resolving the current version.
- Export provenance: rule version, checksum, and engine are present across every simulated export representation.
- Database exclusion: no `*.db`, `*.sqlite`, generated client, or local database file is included.
- Authority boundary: legacy evaluation still creates the displayed clinical decision; canonical evaluation remains `SHADOW`/`SIMULATION`.
- Activation boundary: no publish or activation operation is part of the patch.

## Reviewed patch verification

The integration patch was reviewed file by file in the Git index as a reversible preview and displayed before commit. Checks performed against that exact staged tree:

```text
git diff --cached --check                 PASS
npx prisma validate                      PASS
npm run typecheck                        PASS
decision-package.test.ts                 5 passed, 0 failed
database-constraints.test.ts             4 passed, 0 failed
```

The full source-dependent test suite and migration/schema-diff equivalence are verified in the clean-checkout report rather than inferred from the dirty working directory.
