# Mixed-file landing review

Date: 3 August 2026. Reviewed against `d1e2dce` and the recovery commits
`8b56781`, `e2bf41d`.

Compared against `09-change-inventory.md` and `13-mixed-file-reconciliation.md`.

## Outcome

**No mixed file requires staging.** Every Rule Studio hunk described in report 13
is already reproduced by committed history at `HEAD`. This was verified by
grepping the *committed blob* (`git show HEAD:<path>`) for the feature markers,
not by reading the working tree.

Consequently the recommended landing action for all 48 tracked working-tree
modifications is **leave unstaged — user-owned**. No end-to-end behaviour depends
on an uncommitted mixed hunk, so no clean adapter and no patch file is required
in this session.

The working tree at the start of this session held 49 modified tracked files:
the 48 user-owned/mixed files recorded at the release-hardening baseline, plus
`docs/rule-studio/28-release-hardening-clean-checkout.md`, which was the previous
session's interrupted correction. That one file was Rule Studio-owned and has
been committed as `8b56781`. `package.json` and `package-lock.json` were clean at
`HEAD` and were modified by this session only for dependency remediation
(`e2bf41d`).

## Mixed-file register

| Mixed file | Required Rule Studio hunk | Committed history reproduces it? | Current ownership of working-tree hunks | Recommended landing action |
|---|---|---|---|---|
| `prisma/schema.prisma` | Versioned rule enums; `ClinicalRuleSet`, `ClinicalRuleVersion`, `RuleSetActivation`, `RuleEvaluation`, `RuleVersionAuditEvent`; batch version pins | YES (32 marker hits) | Pre-existing user-owned: batch triage/reprocessing fields, indexes, formatting | Leave unstaged |
| `lib/database/current-schema.sql` | Rule Studio tables, indexes, FKs, version pins, immutability/activation triggers | YES (21 hits) | Pre-existing user-owned: triage/reprocessing columns, patient identity index | Leave unstaged |
| `lib/auth/permissions.ts` | Typed `rules:validate`, `rules:approve`, `rules:activate`, rollback, simulate, export permissions and role grants | YES (9 hits) | Pre-existing user-owned: patient registry, manual-pathway, recall, route-guard permissions | Leave unstaged |
| `lib/batch/persistence.ts` | Resolve shadow version; pin version/display/checksum; persist and link per-item shadow evaluations; audit shadow failures | YES (22 hits) | Pre-existing user-owned: active case-rule grading, triage, reprocessing, prior snapshots, disposition concurrency | Leave unstaged |
| `lib/decisions/package-generator.ts` | Historical rule version, checksum and engine version across summary, GP letter, CSV, FHIR-like JSON, HL7-style message, PAS preview | YES (14 hits) | Pre-existing user-owned: HL7 timestamp correction | Leave unstaged |
| `lib/decisions/dashboard-metrics.ts` | Persisted run engine and pinned rule version/display/checksum for completed-decision exports | YES (3 hits) | Pre-existing user-owned: triage grouping, reprocessing metrics | Leave unstaged |
| `app/api/pathway/sessions/[id]/complete/route.ts` | Governed shadow run after the legacy decision; audit shadow failure; link saved evaluation; return visible shadow provenance | YES (7 hits) | Pre-existing user-owned: wizard access control, preview, safety finalisation, compare-and-set, transaction refactor | Leave unstaged |
| `lib/database/bootstrap.ts` | Trigger-aware SQL statement splitting required by immutable snapshot triggers | YES | Pre-existing user-owned: triage/reprocessing bootstrap patches | Leave unstaged |
| `components/batch/BatchResultDetail.tsx` | Canonical shadow evidence surface | YES (2 hits) | Pre-existing user-owned: figure-focus redesign, triage, prior-decision comparison, pathway display | Leave unstaged |
| `components/batch/WorklistClient.tsx` | Run-level engine/rule version provenance | YES (3 hits) | Pre-existing user-owned: triage priority, reprocessing, filtering, clinical-review note, detail focus | Leave unstaged |
| `lib/batch/__tests__/decision-package.test.ts` | Pinned provenance fixture and simulated-export provenance assertions | YES (9 hits) | Pre-existing user-owned: HL7 timestamp assertion (+ user-owned tests) | Leave unstaged |
| `app/(app)/batch/runs/[id]/page.tsx` | Legacy authority plus pinned versioned shadow; governed regrade comparison only when permitted; unavailable state without an active draft | YES (4 hits) | Pre-existing user-owned: prior snapshots, triage, separate legacy `RegradeRunButton` integration | Leave unstaged |
| `app/(app)/batch/BatchPageClient.tsx` | None required | n/a | Pre-existing user-owned: batch-result filter and detail-focus UX | Leave unstaged |

## Remaining tracked modifications, classified

The other 35 modified tracked files were dirty at the recorded release-hardening
baseline and carry no Rule Studio requirement. Classified as
**pre-existing user-owned**:

- Pathway and patient routes — `app/api/pathway/sessions/**`,
  `app/api/patients/**`, `app/(app)/pathway/**`, `app/(app)/patients/new/page.tsx`
- Legacy case-rule release surface — `app/api/case-rules/**`,
  `app/(app)/rules/**`, `lib/cases/rule-governance.ts`,
  `lib/cases/rule-releases.ts`, `lib/cases/grading.ts`
- Batch UI — `components/batch/BatchActionQueue.tsx`, `BatchDataTable.tsx`,
  `BatchStatCards.tsx`, `app/(app)/dashboard/page.tsx`, `app/(app)/review/page.tsx`
- Shared UI and styling — `components/ui/card.tsx`, `dialog.tsx`, `dropdown.tsx`,
  `app/globals.css`
- Notifications and analytics — `app/api/notifications/send-recall/route.ts`,
  `app/api/analytics/overdue-recalls/route.ts`
- Tooling — `scripts/demo-reset.ts`, `lib/batch/__tests__/dashboard-metrics.test.ts`
- `.gitignore` — user-owned addition of `.env*.local`

## Untracked entries, classified

| Group | Classification | Action |
|---|---|---|
| `docs/clinical-sources/**` (source v2.1 package, verified views, PDFs) | External clinical source package | Deliberately **not committed**; copied into clean checkouts at verification time |
| `docs/clinical-audit/**`, `docs/DecissionTrees/**`, `docs/rulebook-decision-tree-redesign.md` | Pre-existing user-owned audit material | Leave untracked |
| `tests/clinical-conformance/*.test.ts` | Pre-existing user-owned conformance specs | Leave untracked (the two `support/` modules they share **are** committed) |
| `lib/engine/__tests__/access-control.test.ts`, `lib/batch/__tests__/{reprocessing,rule-diff,rule-facts}.test.ts` | Pre-existing user-owned tests (+15 tests over clean checkout) | Leave untracked |
| `lib/batch/reprocessing.ts`, `lib/batch/rule-facts.ts`, `lib/cases/rule-diff.ts`, `lib/cases/rule-vocabulary.ts`, `lib/wizard/access.ts` | Pre-existing user-owned modules | Leave untracked |
| `app/api/batch/runs/[id]/regrade/`, `app/api/case-rules/[id]/activate/`, `components/batch/RegradeRunButton.tsx`, `components/rules/RuleStudioEditor.tsx` | Pre-existing user-owned features | Leave untracked |
| `prisma/migrations/20260620210537_batch_triage_reprocessing/` | Pre-existing user-owned migration (the 8th local migration; 7 are tracked) | Leave untracked |
| `scripts/clinical-audit/**`, `scripts/prototype/**`, `scripts/analyse-rule-overlap.ts`, `scripts/shadow-regrade-corrections.ts`, `scripts/verify-independent.ts`, `scripts/verify-rule-reachability.ts` | Pre-existing user-owned scripts | Leave untracked |
| `outputs/canonical-v2-batch/*.xlsx` | Generated artifact from `export-canonical-v2-batch-contract` | Leave untracked (regenerable) |
| `docs/rule-studio/29`–`33`, `30-dependency-audit-*.json`, `security-evidence/` | **New, this session** | Committed as documentation/evidence |

## Ownership guarantees

- No `git reset --hard`, `git clean`, `git checkout -- .`, `git restore .`,
  `git add -A`, `git add .` or broad directory stage was executed.
- Every commit in this session used explicit-path staging.
- No untracked file was deleted or overwritten because it was outside Rule Studio.
- No local database, `node_modules`, `.next`, worktree, browser profile,
  downloaded export, secret or environment file was staged.
- Two tracked reports were restored with a **path-scoped**
  `git checkout -- <two explicit report paths>` after a generator overwrote them
  during investigation. No directory-wide restore was used.
