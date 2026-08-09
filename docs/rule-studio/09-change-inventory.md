# Baseline-aware change and ownership inventory

Generated 2026-08-02 against baseline `578b4b046aed60ef68b950ffb5945e4bf6ec956b`. The pre-implementation worktree was materially dirty; its exact status is preserved in `00-baseline.md`.

## Ownership policy

No `git add -A`, broad directory staging, reset, checkout, clean, or deletion was used. A file was eligible for a Rule Studio commit only when it was absent from the recorded baseline or clean at baseline and wholly changed by this implementation. Files already modified or untracked at baseline were treated as user-owned or mixed, even where later Rule Studio integration hunks can be identified semantically.

The branch also contains pre-existing commit `418e3b8` (`feat(batch): rebase demo dataset across NZ regions`) after the recorded baseline. It is outside this implementation and is not rewritten.

## Wholly Rule Studio-owned files eligible for scoped commits

| Area | Files |
|---|---|
| Governed domain and tests | `lib/clinical-rules/**` |
| Database migration | `prisma/migrations/20260802090000_versioned_clinical_rule_studio/migration.sql` |
| Importer | `scripts/import-ncsp-rulebook-v2-1.ts` |
| Dependencies | `package.json`, `package-lock.json` |
| Studio UI | `app/(app)/rules/clinical/**`, `components/clinical-rules/**` |
| Studio API | `app/api/clinical-rules/**` |
| Administration entry | `app/(app)/admin/page.tsx` |
| Clinical regrade endpoint | `app/api/batch/runs/[id]/clinical-regrade/route.ts` |
| Completed-decision provenance UI | `components/decisions/CompletedDecisionsClient.tsx`, `lib/decisions/completed-decisions.ts` |
| Handoff evidence | `docs/rule-studio/**` |

These paths were clean or absent in the baseline record. They are staged by explicit path, split into domain, UI/API, completed-decision/regrade, and documentation commits.

## Mixed or user-owned files excluded from commits

The following pre-existing dirty files contain identifiable Rule Studio integration hunks but no trustworthy pre-change blob exists from which to separate ownership mechanically. They remain unstaged for manual reconciliation:

- `app/(app)/batch/BatchPageClient.tsx`
- `app/(app)/batch/runs/[id]/page.tsx`
- `app/api/pathway/sessions/[id]/complete/route.ts`
- `components/batch/BatchResultDetail.tsx`
- `components/batch/WorklistClient.tsx`
- `lib/batch/__tests__/decision-package.test.ts`
- `lib/batch/persistence.ts`
- `lib/database/bootstrap.ts`
- `lib/database/current-schema.sql`
- `lib/decisions/dashboard-metrics.ts`
- `lib/decisions/package-generator.ts`
- `prisma/schema.prisma`

All other paths listed in the recorded baseline status remain user-owned and unstaged. This includes the original clinical sources, the full clinical audit, decision-tree prototypes, case-rule editor work, batch reprocessing work, the earlier migration, verification scripts, `tests/**`, and `tmp/**`.

The excluded mixed files are required for the complete local end-to-end integration. Their uncommitted state is intentional: staging the whole file would claim ownership of unrelated pre-existing hunks. A future clean integration commit should start from an owner-approved baseline or manually stage reviewed hunks.

## Thirty largest changed text files by churn

Tracked churn is additions plus deletions from the baseline commit. An untracked text file is counted as a whole-file addition. `>800` flags the requested review threshold.

| Rank | Lines | Owner | `>800` | Path |
|---:|---:|---|:---:|---|
| 1 | 7,846 | User source package | yes | `docs/clinical-sources/source-v2.1/CerviGrade_Verified_Pathway_Views_v2_1_1/views/08_hysterectomy_vaginal_vault/08_hysterectomy_vaginal_vault_graphviz.json` |
| 2 | 7,598 | User source package | yes | `docs/clinical-sources/source-v2.1/CerviGrade_Verified_Pathway_Views_v2_1_1/views/03_primary_hpv_screening/03_primary_hpv_screening_graphviz.json` |
| 3 | 7,539 | User audit | yes | `docs/clinical-audit/complete-guideline-oracle.json` |
| 4 | 6,740 | User source package | yes | `docs/clinical-sources/source-v2.1/CerviGrade_Verified_Pathway_Views_v2_1_1/views/05_normal_colposcopy_high_grade/05_normal_colposcopy_high_grade_graphviz.json` |
| 5 | 5,461 | User source package | yes | `docs/clinical-sources/source-v2.1/CerviGrade_Verified_Pathway_Views_v2_1_1/views/01_global_router_safety/01_global_router_safety_graphviz.json` |
| 6 | 5,450 | User source package | yes | `docs/clinical-sources/source-v2.1/CerviGrade_Verified_Pathway_Views_v2_1_1/views/04_normal_colposcopy_low_grade/04_normal_colposcopy_low_grade_graphviz.json` |
| 7 | 5,316 | User source package | yes | `docs/clinical-sources/source-v2.1/CerviGrade_Verified_Pathway_Views_v2_1_1/views/07_glandular_abnormalities_ais/07_glandular_abnormalities_ais_graphviz.json` |
| 8 | 4,581 | User temporary evidence | yes | `tmp/pdfs/ncsp-2023.txt` |
| 9 | 4,271 | User source package | yes | `docs/clinical-sources/source-v2.1/CerviGrade_Verified_Pathway_Views_v2_1_1/CerviGrade_NCSP_Master_Decision_Tree_v2_1_1_verified.svg` |
| 10 | 4,211 | User source package | yes | `docs/clinical-sources/source-v2.1/CerviGrade_NCSP_Master_Rulebook_Package_v2_1/CerviGrade_NCSP_Master_Decision_Tree_v2_1_poster.svg` |
| 11 | 4,190 | User source package | yes | `docs/clinical-sources/source-v2.1/CerviGrade_Verified_Pathway_Views_v2_1_1/views/02_transition_to_hpv/02_transition_to_hpv_graphviz.json` |
| 12 | 4,091 | User audit | yes | `docs/clinical-audit/expanded-implemented-rules.json` |
| 13 | 4,058 | User source package | yes | `docs/clinical-sources/source-v2.1/CerviGrade_NCSP_Master_Rulebook_Package_v2_1/CerviGrade_NCSP_Master_Rules_v2_1.json` |
| 14 | 3,916 | User source package | yes | `docs/clinical-sources/source-v2.1/CerviGrade_Verified_Pathway_Views_v2_1_1/views/06_hsil_treatment_test_of_cure/06_hsil_treatment_test_of_cure_graphviz.json` |
| 15 | 3,916 | User source package | yes | `docs/clinical-sources/source-v2.1/CerviGrade_Verified_Pathway_Views_v2_1_1/views/10_abnormal_bleeding/10_abnormal_bleeding_graphviz.json` |
| 16 | 3,253 | User source package | yes | `docs/clinical-sources/source-v2.1/CerviGrade_Verified_Pathway_Views_v2_1_1/views/09_pregnancy/09_pregnancy_graphviz.json` |
| 17 | 1,600 | User audit | yes | `docs/clinical-audit/06-reachability-register.json` |
| 18 | 1,481 | User design plan | yes | `docs/rulebook-decision-tree-redesign.md` |
| 19 | 1,160 | Rule Studio | yes | `lib/clinical-rules/source-package.ts` |
| 20 | 1,054 | Rule Studio | yes | `components/clinical-rules/ClinicalRuleGraphStudio.tsx` |
| 21 | 1,007 | User case-rule editor | yes | `components/rules/RuleStudioEditor.tsx` |
| 22 | 801 | User audit | yes | `docs/clinical-audit/07-pipeline-reachability.json` |
| 23 | 770 | User source package | no | `docs/clinical-sources/source-v2.1/CerviGrade_Verified_Pathway_Views_v2_1_1/views/08_hysterectomy_vaginal_vault/08_hysterectomy_vaginal_vault.svg` |
| 24 | 738 | User source package | no | `docs/clinical-sources/source-v2.1/CerviGrade_Verified_Pathway_Views_v2_1_1/views/03_primary_hpv_screening/03_primary_hpv_screening.svg` |
| 25 | 726 | User clinical source | no | `docs/clinical-sources/04-prior-rule-extraction.md` |
| 26 | 724 | User verification script | no | `scripts/verify-rule-reachability.ts` |
| 27 | 694 | User source package | no | `docs/clinical-sources/source-v2.1/CerviGrade_Verified_Pathway_Views_v2_1_1/CerviGrade_NCSP_Master_Decision_Tree_v2_1_1_verified.dot` |
| 28 | 686 | User source package | no | `docs/clinical-sources/source-v2.1/CerviGrade_NCSP_Master_Rulebook_Package_v2_1/CerviGrade_NCSP_Master_Decision_Tree_v2_1.dot` |
| 29 | 686 | User source package | no | `docs/clinical-sources/source-v2.1/CerviGrade_NCSP_Master_Rulebook_Package_v2_1/CerviGrade_NCSP_Master_Decision_Tree_v2_1_poster.dot` |
| 30 | 650 | User source package | no | `docs/clinical-sources/source-v2.1/CerviGrade_Verified_Pathway_Views_v2_1_1/views/05_normal_colposcopy_high_grade/05_normal_colposcopy_high_grade.svg` |

The two Rule Studio-owned files above 800 lines are cohesive but require focused review: `source-package.ts` verifies and projects two source packages, while `ClinicalRuleGraphStudio.tsx` contains the interactive canvas and inspector. They were not split mechanically because doing so would fragment their state and validation boundaries.

## Binary artifacts

The worktree contains 60 untracked binary evidence files: 3 PDFs (3,526,881 bytes), 56 PNGs (56,447,102 bytes), and 1 XLSX workbook (98,445 bytes). They are all under the pre-existing user-owned `docs/clinical-sources/**`, `docs/clinical-audit/rendered-sources/**`, or `docs/DecissionTrees/**` areas. None is staged in a Rule Studio commit.

No new Rule Studio-owned binary artifact is eligible for commit. Exports generated by the UI are runtime downloads, not repository files.

## Final verification

| Command | Result |
|---|---|
| `npm run typecheck` | PASS after adding an explicit test-boundary cast; final run has zero errors |
| `npm run lint` | PASS with 0 errors and 21 existing worktree warnings |
| `npm run test:all` | PASS: 107 engine + 218 batch + 638 rule tests = 963 tests |
| `npm run test:rules` | PASS: 638/638 |
| `npm run build` | PASS; one existing Turbopack file-tracing warning |
| `npx prisma migrate status` | PASS; 7 migrations found and database schema up to date |

Database state was checked after validation: `CG-NCSP-3.0.0` is revision 3, status `DRAFT`, `publishedAt` is null, and there are zero live activations.

## Commit boundaries

The final scoped commits are:

1. `30e8dfb` — `feat(rule-studio): add governed clinical rule domain` — compiler, evaluator, tests, importer, migration, and dependencies.
2. `707f622` — `feat(rule-studio): add graph administration surfaces` — Rule Studio UI, APIs, and administration entry.
3. `8379d57` — `feat(rule-studio): add governed regrade provenance` — clinical regrade and completed-decision provenance surfaces.
4. The documentation commit containing this inventory records the Rule Studio handoff and verification reports.

Mixed and user-owned files remain unstaged and are visible in `git status` after these commits.
