# Remote-ref recovery record

Date: 4 August 2026. Authorised operation: `git fetch --prune origin` (remote-ref
update only). No checkout, no merge, no rebase, no reset, no push.

## Why a fetch was required

The 3 August deployment-identity inference failed principally because the local
clone's remote-tracking refs were stale. The true production commit did not exist
in the local object store, so it could not appear in any candidate set. This
document records the recovery so the failure mode is auditable.

## Pre-fetch state (recorded before the fetch)

| Item | Value |
|---|---|
| Current branch | `codex/versioned-clinical-rule-studio` |
| HEAD | `8eed086816f878dff73989188c9a29f2a2e445a3` |
| Working tree | 48 modified, 45 untracked, **0 staged** |
| Last fetch (`.git/FETCH_HEAD` mtime) | **2026-07-07 22:05** |

Local heads before fetch:

```
578b4b046aed60ef68b950ffb5945e4bf6ec956b  refs/heads/audit/full-ncsp-clinical-parity
60ce12f9273c88ee2fb4b0e43d5650e53a2018a0  refs/heads/codex/clickable-case-navigation
8eed086816f878dff73989188c9a29f2a2e445a3  refs/heads/codex/versioned-clinical-rule-studio
578b4b046aed60ef68b950ffb5945e4bf6ec956b  refs/heads/main
```

Remote-tracking tips before fetch:

| Ref | Commit | Committed | Subject |
|---|---|---|---|
| `origin/main` | `578b4b0` | 2026-06-20T09:22:19+12:00 | `fix: match demo flag parsing for schema bootstrap` |
| `origin/codex/versioned-clinical-rule-studio` | `418e3b8` | 2026-08-02T21:06:44+12:00 | `feat(batch): rebase demo dataset across NZ regions` |

Staleness at this point: **28 days**, spanning eleven `main` commits including the
one actually serving production.

## Fetch

```
git fetch --prune origin
From https://github.com/naumanshah007/Screening-App
   578b4b0..fb933c3  main       -> origin/main
```

Only `origin/main` moved. Nothing was pruned. `origin/codex/versioned-clinical-rule-studio`
remained at `418e3b8`, confirming that the 26 local Rule Studio commits have
never been pushed.

## Post-fetch state

| Item | Value |
|---|---|
| `origin/main` | **`fb933c3768b76084ad0ebe91eacee93cfac08444`** |
| Committed | 2026-07-08T18:24:45+12:00 (2026-07-08T06:24:45Z) |
| Subject | `Admin UX phase 2+3: onboarding, NCSR, integration validation, automation` |

## Confirmations

### Does `fb933c3` now exist locally?

**Yes.** Absent before the fetch (`fatal: Not a valid object name`), present
after. Contents:

```
fb933c3 Admin UX phase 2+3: onboarding, NCSR, integration validation, automation
 app/(app)/admin/CreateUserForm.tsx                 | 232 +++++++++++--------
 app/(app)/admin/IntegrationValidationManager.tsx   | 168 ++++++--------
 app/(app)/admin/NcsrCertificationManager.tsx       | 250 ++++++++++-----------
 app/(app)/admin/SecurityIncidentAutomationCard.tsx |  36 +--
 4 files changed, 349 insertions(+), 337 deletions(-)
```

### Is it still the active Production commit?

**Yes.** The Vercel dashboard records the current Production deployment
(`az2UHKSaXg49Upho6U1BgakTJojs`, Ready · Current) with source branch `main` and
source commit `fb933c3`.

### Has `origin/main` advanced beyond `fb933c3`?

**No.** `fb933c3` *is* the tip of `origin/main`.

```
git branch -r --contains fb933c3
  origin/HEAD -> origin/main
  origin/main
```

This is a materially better position than feared: the deployed baseline and the
integration target are the same commit, so reproducing production and planning
integration do not require two different reference points.

### Exact divergence

```
git merge-base origin/main codex/versioned-clinical-rule-studio
578b4b046aed60ef68b950ffb5945e4bf6ec956b

git rev-list --left-right --count origin/main...codex/versioned-clinical-rule-studio
11      27
```

| Direction | Count | Meaning |
|---|---:|---|
| Unique to `origin/main` | **11** | Production work the candidate branch does **not** have |
| Unique to candidate | **27** | Rule Studio programme + `418e3b8`, unpushed |
| Merge base | `578b4b0` | Both lines fork from the 20 June commit |

#### The 11 commits the candidate is missing

| Commit | Subject |
|---|---|
| `fb933c3` | Admin UX phase 2+3: onboarding, NCSR, integration validation, automation |
| `f6e2f89` | Admin UX phase 1: list-and-detail pattern for Users and Incidents |
| `b4bff62` | Move NCSR governance to Integrations tab for INTEGRATION_ADMIN visibility |
| `2715baa` | Simplify navigation and reorganize Admin into tabs |
| `c9f4a25` | Add stat-card drill-down, clickable figure links, and pathway diagram in batch view |
| `11e0def` | Fix overlapping nodes across all 10 guideline pathway diagrams |
| `3e37429` | Merge origin/main (batch persistence, decisions export, schema) into local main |
| `8bea36e` | Add guideline-figure overlay engine core (Phase 2, mechanism only) |
| `aeb77c1` | Add side-by-side form editor for booking rule drafts (Phase 1) |
| `2de3005` | Add guideline audit, fix plan, and external correlation docs |
| `ea4e7e3` | **Fix unsafe age-gate ordering in decision engine (R1)** |

`ea4e7e3` is clinically significant: a decision-engine safety fix that exists in
production but **not** in the candidate branch. It is called out here so it is not
lost in the feature comparison. See `09-main-divergence-and-integration-plan.md`.

## Working-tree integrity

Unchanged by the fetch, as expected — a fetch touches only remote-tracking refs.

| Metric | Before | After |
|---|---:|---:|
| Modified | 48 | 48 |
| Untracked | 45 | 45 |
| Staged | 0 | 0 |

No branch was checked out, no merge or rebase was performed, and the pre-existing
user-owned changes in the primary working tree were preserved.

## Lesson recorded

Any future claim about deployed identity must first establish that remote refs
are current. A `git fetch` costs seconds; the stale-ref assumption cost a
disproven conclusion in three documents.
