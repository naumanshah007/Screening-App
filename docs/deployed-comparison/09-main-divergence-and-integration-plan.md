# Main divergence and integration plan

Date: 4 August 2026. Analysis only — **no integration was performed.** No merge,
no rebase, no cherry-pick, no branch created, no push.

## Divergence

```
git merge-base origin/main codex/versioned-clinical-rule-studio
578b4b046aed60ef68b950ffb5945e4bf6ec956b

git rev-list --left-right --count origin/main...codex/versioned-clinical-rule-studio
11      27

git log --left-right --cherry-pick --oneline origin/main...codex/versioned-clinical-rule-studio
11 <   (main-only)
27 >   (candidate-only)
```

`--cherry-pick` removes no commits from either side: **there are no
patch-equivalent commits**. The two lines of work are entirely disjoint in
content, which is the cleanest possible starting point.

`origin/main` is `fb933c3` — the active Production commit. The integration target
and the deployed baseline are the same commit.

## File-level overlap

| Metric | Count |
|---|---:|
| Files changed on the `main` side since the fork | **28** |
| Files changed on the candidate side since the fork | **152** (131 added, 21 modified) |
| **Files touched by both** | **2** |

The two overlapping files are `app/(app)/admin/page.tsx` and
`components/batch/BatchResultDetail.tsx`.

## Dry-run merge result

`git merge-tree --write-tree origin/main codex/versioned-clinical-rule-studio`
(computes a merge in the object database; changes no branch, no index and no
working tree — verified afterwards: branch still `codex/versioned-clinical-rule-studio`,
HEAD still `8eed086`).

| File | Result |
|---|---|
| `app/(app)/admin/page.tsx` | **CONFLICT (content)** |
| `components/batch/BatchResultDetail.tsx` | auto-merges cleanly |
| Everything else | clean |

**Exactly one conflicted file.** The conflict is the admin page shell — main
reorganised it into tabs (`2715baa`) and moved NCSR governance into an
Integrations tab (`b4bff62`), while the candidate added Rule Studio navigation.
This is a layout reconciliation, not a clinical-logic conflict.

## Risk analysis

### Clinical engine — resolved by integration, dangerous without it

**The candidate modified no file under `lib/engine/`.** All five engine-area
changes since the fork belong to `main`:

```
lib/engine/decision-engine.ts        (main only — includes the R1 age-gate fix)
lib/engine/overlay.ts                (main only)
lib/engine/rule-catalog.ts           (main only)
lib/engine/__tests__/age-eligibility.test.ts  (main only)
lib/engine/__tests__/overlay.test.ts (main only)
```

A merge therefore takes main's engine unchanged, and the R1 age-gate regression
documented in `07-special-set-matrices.md` §7 **disappears on integration**.

> **This makes the choice of strategy a patient-safety decision.** Any approach
> that rebuilds the candidate on the old base — squashing, cherry-picking onto
> `578b4b0`, or deploying the branch tip — reintroduces a fixed defect that
> currently sends 23-year-olds with HSIL and 72-year-olds with HPV 16/18 to
> low-risk reassurance instead of colposcopy.

### Schema and migrations — no ordering risk

| Side | Migrations added since fork |
|---|---:|
| `main` | **0** — main touched no Prisma file |
| Candidate | **2** — `20260802090000_versioned_clinical_rule_studio`, `20260803143000_clinical_evidence_immutability` |

The candidate's migrations append cleanly. `prisma/schema.prisma` is
candidate-only. **No migration-ordering conflict.**

### Package and lockfile — expect a lockfile conflict

The candidate modified `package.json` and `package-lock.json`; `main` did not.
So Git will not conflict — but the candidate's dependency changes must be
re-resolved against main's tree:

| Change | Packages |
|---|---|
| **Added** | `@xyflow/react`, `elkjs`, `html2canvas` (Rule Studio graph rendering) |
| **Removed** | none |
| **Bumped** | `@prisma/client` and `prisma` 7.5.0 → 7.9.1; `next` 16.2.1 → 16.2.12; `next-auth` beta.30 → beta.32; `@auth/prisma-adapter` 2.11.1 → 2.11.3; `nodemailer` 7.0.13 → 8.0.11 |

The `nodemailer` major bump (7 → 8) and the Prisma minor bump are the two worth
verifying against main's code, since main owns the notification and admin
surfaces the candidate did not touch. Regenerate the lockfile with `npm install`
after the merge rather than hand-resolving it.

### User-owned and mixed-file risk

The **primary working tree carries 48 modified and 45 untracked user-owned
paths** that are not part of either branch. None was staged, committed or altered
during this comparison. Integration must happen on a **new branch in a clean
worktree**, never in the primary working tree, or that work is at risk.

The external v2.1 clinical source package (`docs/clinical-sources/**`, 39 MB)
remains deliberately uncommitted per repository policy, and must be copied into
any verification checkout rather than merged.

## Recommended strategy

# B — new integration branch from current `origin/main`, merge the candidate

```
Recommended target branch:  integration/rule-studio-on-main-fb933c3
```

| Strategy | Verdict |
|---|---|
| A — cherry-pick 27 commits onto main | Rejected. 27 commits with no patch-equivalence, replayed one at a time, for a single conflicted file. Maximum risk for no benefit. |
| **B — branch from `origin/main`, merge candidate** | **Recommended.** One conflict. Preserves both histories. Automatically inherits main's engine, including the R1 fix. |
| C — rebase candidate in an isolated worktree | Rejected. Rewrites 27 commits and replays the conflict repeatedly. Loses the governance-evidence history the programme depends on. |
| D — reimplement clean adapters on main | Rejected as disproportionate. The overlap is 2 files; transplant is not unsafe here. |

### Commit sequence

1. `git worktree add /tmp/<unique> -b integration/rule-studio-on-main-fb933c3 origin/main`
2. `git merge codex/versioned-clinical-rule-studio` — expect the single conflict
3. Resolve `app/(app)/admin/page.tsx`: keep **main's** tab structure and
   Integrations placement; re-add the candidate's Rule Studio entry inside it
4. Review the auto-merge of `components/batch/BatchResultDetail.tsx` by eye
5. `npm install` to re-resolve the lockfile against main's tree; do not
   hand-merge `package-lock.json`
6. `npx prisma generate && npx prisma migrate deploy` on a fresh isolated database
7. Copy the external v2.1 source package into the worktree (do not commit)
8. Run the full test plan below
9. Commit the resolution; **do not push and do not merge to `main`**

### Required test plan for the integration branch

| Check | Gate |
|---|---|
| `npm run typecheck` | must pass |
| `npm run lint -- --max-warnings=100` | 0 errors |
| `npm run test:engine` | **must be ≥ 130** — main's 130 including the 13 age-gate goldens, plus any candidate additions. A drop below 130 means main's engine tests were lost. |
| `npm run test:batch` | ≥ 208 |
| `npm run test:rules` | 910 |
| `npm run build` | must pass |
| `npx prisma validate` / `migrate status` | must pass, 7 migrations |
| **`scripts/comparison/emit-router.ts`** | **must reproduce production's 12/12 age-gate results** — the explicit regression gate |
| `scripts/comparison/emit-legacy.ts` + `classify.mjs` | 161 executable, 0 `PRODUCTION_DIFFERS_FROM_CURRENT_LEGACY` |
| Admin UX smoke | onboarding, NCSR, integration validation, tabs all reachable |

The router probe is the gate that matters most: it is the only check in this list
that would have caught the R1 regression.

## What must not happen at integration time

Integration onto `main` is **not** a release. Automatic production deployment on
`main` is **enabled**, so a merge to `main` deploys to `screening.privexa.co` and
rewrites the production cron. GOV-01…GOV-04 and R1–R6 gate that merge. The
integration branch itself is safe; landing it is the governed step.
