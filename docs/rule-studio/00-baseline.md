# Versioned Clinical Rule Studio baseline

Recorded on 2026-08-02 before Rule Studio implementation.

## Repository state

| Item | Value |
|---|---|
| Repository package | `cervical-screening-app` 0.1.0 |
| Starting branch | `audit/full-ncsp-clinical-parity` |
| Dedicated implementation branch | `codex/versioned-clinical-rule-studio` |
| HEAD | `578b4b046aed60ef68b950ffb5945e4bf6ec956b` |
| Node | v25.1.0 |
| npm | 11.6.2 |
| Prisma / Prisma Client | 7.5.0 / 7.5.0 |
| Database | SQLite `prisma/dev.db` |
| Migration status | 6 migrations found; database schema up to date |

The worktree was already materially dirty before this implementation began. Those changes are user-owned and were preserved. They include changes across batch, dashboard, pathway, patient, review, rules, APIs, permissions, persistence, database bootstrap/schema, Prisma, demo scripts, tests and audit documentation. Pre-existing untracked areas include the clinical source/audit package, decision-tree prototypes, editable rule-release work, batch reprocessing, rule-diff/vocabulary files and the migration `20260620210537_batch_triage_reprocessing`.

The exact pre-implementation status was:

```text
 M .gitignore
 M app/(app)/batch/BatchPageClient.tsx
 M app/(app)/batch/runs/[id]/page.tsx
 M app/(app)/dashboard/page.tsx
 M app/(app)/pathway/[sessionId]/page.tsx
 M app/(app)/pathway/[sessionId]/result/page.tsx
 M app/(app)/patients/new/page.tsx
 M app/(app)/review/page.tsx
 M app/(app)/rules/RuleReleaseActionButton.tsx
 M app/(app)/rules/[id]/RuleReleaseEditForm.tsx
 M app/(app)/rules/[id]/page.tsx
 M app/(app)/rules/page.tsx
 M app/api/analytics/overdue-recalls/route.ts
 M app/api/case-rules/[id]/publish/route.ts
 M app/api/case-rules/[id]/review/route.ts
 M app/api/case-rules/[id]/route.ts
 M app/api/case-rules/route.ts
 M app/api/cases/[id]/rules/evaluate/route.ts
 M app/api/notifications/send-recall/route.ts
 M app/api/pathway/sessions/[id]/answer/route.ts
 M app/api/pathway/sessions/[id]/complete/route.ts
 M app/api/pathway/sessions/[id]/notify/route.ts
 M app/api/pathway/sessions/[id]/route.ts
 M app/api/pathway/sessions/route.ts
 M app/api/patients/[id]/route.ts
 M app/api/patients/route.ts
 M components/batch/BatchActionQueue.tsx
 M components/batch/BatchDataTable.tsx
 M components/batch/BatchResultDetail.tsx
 M components/batch/BatchStatCards.tsx
 M components/batch/WorklistClient.tsx
 M components/ui/card.tsx
 M components/ui/dialog.tsx
 M components/ui/dropdown.tsx
 M lib/auth/permissions.ts
 M lib/batch/__tests__/dashboard-metrics.test.ts
 M lib/batch/__tests__/decision-package.test.ts
 M lib/batch/persistence.ts
 M lib/batch/realistic-dataset.ts
 M lib/cases/grading.ts
 M lib/cases/rule-governance.ts
 M lib/cases/rule-releases.ts
 M lib/database/bootstrap.ts
 M lib/database/current-schema.sql
 M lib/decisions/dashboard-metrics.ts
 M lib/decisions/package-generator.ts
 M prisma/schema.prisma
 M scripts/demo-reset.ts
?? app/api/batch/runs/[id]/regrade/
?? app/api/case-rules/[id]/activate/
?? components/batch/RegradeRunButton.tsx
?? components/rules/
?? docs/DecissionTrees/
?? docs/clinical-audit/
?? docs/clinical-sources/
?? docs/rulebook-decision-tree-redesign.md
?? lib/batch/__tests__/reprocessing.test.ts
?? lib/batch/__tests__/rule-diff.test.ts
?? lib/batch/__tests__/rule-facts.test.ts
?? lib/batch/reprocessing.ts
?? lib/batch/rule-facts.ts
?? lib/cases/rule-diff.ts
?? lib/cases/rule-vocabulary.ts
?? lib/engine/__tests__/access-control.test.ts
?? lib/wizard/access.ts
?? prisma/migrations/20260620210537_batch_triage_reprocessing/
?? scripts/analyse-rule-overlap.ts
?? scripts/clinical-audit/
?? scripts/prototype/
?? scripts/shadow-regrade-corrections.ts
?? scripts/verify-independent.ts
?? scripts/verify-rule-reachability.ts
?? tests/
?? tmp/
```

## v2.1 source-package verification

The package was found at the equivalent path:

`docs/clinical-sources/source-v2.1/CerviGrade_NCSP_Master_Rulebook_Package_v2_1/`

The supplied manifest verified every package file. The JSON contains exactly 203 rule records with 203 unique `rule_id` values and all 21 `T1-*` Table 1 rules. It contains QA-closure metadata for QA-01 through QA-18. The tree-coverage CSV contains a record for each rule. The workbook has 21 sheets, including `18_All_Rules` with 203 data rows, `19_QA_Closure` and `20_Tree_Coverage`; all sheets were rendered and visually checked, and the formula-error scan returned no matches.

Section counts in the JSON source:

| Section | Rules |
|---|---:|
| Global Router & Safety | 20 |
| Figure 1 | 7 |
| Figure 2 | 6 |
| Figure 3 | 22 |
| Figure 4 | 16 |
| Figure 5 | 12 |
| Figure 6 | 16 |
| Figure 7 | 18 |
| Table 1 | 21 |
| Figure 8 | 14 |
| Figure 9 | 14 |
| Figure 10 | 15 |
| Special populations | 7 |
| 2026 overlays | 14 |
| Immune-deficiency classifier | 1 |
| **Total** | **203** |

The package explicitly remains a source-derived clinical-software verification specification, not a clinically approved protocol.

## Verification commands and results

| Command | Result |
|---|---|
| `npm ci` | Pass; 723 packages added. Peer/Node-engine warnings. Audit reported 30 dependency vulnerabilities: 2 low, 7 moderate, 19 high, 2 critical. No automatic fixes applied. |
| `npm run test:all` immediately after `npm ci` | Engine 107/107 pass. Batch discovered 201 tests: 199 pass, 2 module-load failures because `npm ci` had not generated `.prisma/client/default`. |
| `npm run lint` | Pass; 0 errors, 21 warnings. |
| `npm run typecheck` | Pass. |
| `npm run build` | Pass; generated Prisma Client; one existing Turbopack file-tracing warning. |
| `npm run demo:reset` | Pass; demo data reset and seeded. |
| `npx prisma migrate status` | Pass; 6 migrations, schema up to date. |
| `npm run test:all` after Prisma generation | Pass; engine 107/107 and batch 217/217, **324/324 total**. |
| `shasum -a 256 -c MANIFEST_SHA256_v2_1.txt` | All 11 package files pass. |

The initial two batch failures are a reproducible installation-order issue, not a clinical-rule failure. The passing existing regression suite describes current product behaviour and must not be treated as evidence that the v2.1 rules are implemented or clinically validated.

## Safety guardrail

The implementation must retain the legacy decision engine as a shadow-comparison path until the versioned engine has independent conformance evidence. Required wording remains:

- Provisional recommendation
- Reviewer confirmation required
- Not for direct clinical action
- Demo environment
- Simulated export package
