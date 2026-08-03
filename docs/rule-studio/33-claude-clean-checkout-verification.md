# Claude clean-checkout verification

Verification date: 3 August 2026.

Verified application commit: **`e2bf41d`** (`fix(security): remediate supported
runtime dependency advisories`). The documentation-only commit that carries this
report advances HEAD without changing any result below.

Clean worktree: a detached `git worktree` created from `e2bf41d`. The external
clinical source package was copied into the worktree **without being committed**,
per existing repository policy. A new isolated SQLite database was used; the
developer database was never touched.

Software-conformance and security evidence for an unpublished, source-derived
draft. Not clinical validation, not medical approval, not a production-readiness
claim.

## Reproduction sequence

```
git worktree add --detach <tmp>/clean-worktree e2bf41d
cp -R docs/clinical-sources/source-v2.1 <tmp>/clean-worktree/docs/clinical-sources/
cd <tmp>/clean-worktree
npm ci
touch <tmp>/clean-worktree/isolated-verification.db
export DATABASE_URL='file:<tmp>/clean-worktree/isolated-verification.db'
npx prisma migrate deploy
npx prisma generate
npm run demo:reset
npm run rules:import:v2.1                 # x2
npm run rules:import:v2.1:successor       # x2
npm run rules:simulate:v2-input-gaps      # x2
npm run typecheck
npm run lint -- --max-warnings=100
npm run test:engine && npm run test:batch && npm run test:rules
npm run build
npx prisma validate
npx prisma migrate status
```

## Result

| Check | Result |
|---|---|
| `npm ci` | PASS |
| `npx prisma migrate deploy` | PASS — **7** migrations applied |
| `npx prisma generate` | PASS |
| `npm run demo:reset` | PASS |
| `npm run typecheck` | PASS |
| `npm run lint -- --max-warnings=100` | PASS — **0 errors, 19 warnings** |
| `npm run test:engine` | PASS **104/104** |
| `npm run test:batch` | PASS **208/208** |
| `npm run test:rules` | PASS **910/910** |
| **Total** | **PASS 1,222/1,222** |
| `npm run build` | PASS — 0 error lines; one pre-existing Turbopack file-tracing warning |
| `npx prisma validate` | PASS |
| `npx prisma migrate status` | PASS — schema up to date |

**1,222** is the count produced by the final committed HEAD and is the
authoritative final figure. It matches report 28 exactly. The dirty working tree
reports 1,239 because it carries 15 user-owned tests that do not exist in a clean
checkout; see `29-claude-handoff-recovery.md` §2.

The 19 lint warnings likewise match report 28; the dirty tree shows 21 because of
two untracked user-owned scripts.

## Import and simulation idempotency

| Run | Action | Result |
|---|---|---|
| `rules:import:v2.1` (1st) | base import | CREATED |
| `rules:import:v2.1` (2nd) | base import | **UNCHANGED** |
| `rules:import:v2.1:successor` (1st) | successor import | **CREATED**, `CG-NCSP-3.1.0`, DRAFT |
| `rules:import:v2.1:successor` (2nd) | successor import | **UNCHANGED**, checksum identical |
| `rules:simulate:v2-input-gaps` (1st) | simulation | created **18**, reused 0 |
| `rules:simulate:v2-input-gaps` (2nd) | simulation | created **0**, reused **18** |

Second-run reuse and idempotency confirmed for all three commands.

## Schema equivalence

All three diffs report **"No difference detected."**

| Diff | Result |
|---|---|
| migrations directory → Prisma schema | No difference |
| fresh migrated isolated DB → Prisma schema | No difference |
| `lib/database/current-schema.sql` → Prisma schema | No difference |

> **Tooling note.** Prisma 7.9 removed the `--from-url` / `--to-schema-datamodel`
> flags used by earlier evidence. The current invocation is
> `prisma migrate diff --from-migrations <dir> --to-schema <file>` and
> `--from-config-datasource --to-schema <file>`. Earlier reports' flag spelling is
> stale even though the underlying result is unchanged.

## Clinical state in the isolated database

| Item | `CG-NCSP-3.0.0` | `CG-NCSP-3.1.0` |
|---|---|---|
| Status | DRAFT | DRAFT |
| Revision | 1 | 1 |
| Parent | none | → `CG-NCSP-3.0.0` |
| Checksum | `2997a909b98f9d8960cc3697cf125d5b0e106d4f0be9a0ee789404e54486a96b` | `3ab8657a13e73bb0080f18399d9165c20e9af5796bdcf594bdc71170309c824a` |
| Evaluations | 0 | 18, all `SIMULATION` |
| `publishedAt` | null | null |
| `activatedAt` | null | null |

| Boundary counter | Value |
|---|---:|
| Activation records | **0** |
| Live activation records | **0** |
| Published versions | **0** |

The clean-import `CG-NCSP-3.0.0` checksum `2997a909…96b` intentionally differs
from the developer database's evaluated `f6d75166…4ae52`. That divergence is
expected and must not be "corrected": the developer identity is an evaluated,
protected snapshot at revision 3 and must never be overwritten. The successor
checksum `3ab8657a…c824a` is identical in both databases.

## Structural conformance

| Item | Value |
|---|---:|
| Source rules | 203 |
| Unique stable rule IDs | 203 |
| Canonical nodes | 422 |
| Canonical edges | 421 |
| Synchronized graph views | 12 |
| Clinician-only rules in the source model | 11 (7 rule-level + 4 branch-level) |
| Independent source-oracle cases | 179 |
| Former input-representation gaps closed | 18 / 18 |
| Legacy defect register (non-executing) | 26 |

## Semantic differential at this HEAD

| Disposition | Cases |
|---|---:|
| EXACT_AGREEMENT | 68 |
| ACTION_EQUIVALENT_PRESENTATION_ALIAS | 12 |
| METADATA_DIFFERENCE | 99 |
| IMPLEMENTATION_DEFECT | **0** |
| GOVERNANCE_STOP | **0** |
| Action-class mismatches across all 179 cases | **0** |

All 99 metadata differences are on the single field `clinicianOnly`, and all 99
are in the **more restrictive** direction (expected `false` → actual `true`).
Safety relaxations: **0**.

This differs from the previously committed report 22, which claimed 164
EXACT_AGREEMENT and zero metadata differences. That report was stale; the
discrepancy reproduced identically in this clean checkout, so it is not a
working-tree artifact. Root cause, direction analysis and the decision **not** to
change engine semantics autonomously are recorded in
`29-claude-handoff-recovery.md` §4 and escalated as governance item **GOV-04** in
`31-clinical-governance-handoff.md`.

## Verified invariants

- Evaluated identity overwrite rejected — covered by
  `lib/clinical-rules/__tests__/database-constraints.test.ts` (isolated temp
  databases) within the passing 910-test rules suite.
- Successor cloning behaviour — covered by
  `lib/clinical-rules/__tests__/successor-v3-1.test.ts`, passing.
- Immutability triggers present in the migrated schema and in
  `current-schema.sql`, with all three schema diffs clean.
- Legacy engine remains the displayed clinical authority.
- Canonical evaluation remains SHADOW / SIMULATION only — the only evaluations in
  the isolated database are 18 `SIMULATION` records.
- No clinical snapshot checksum changed during dependency remediation.

## Release boundary

- `CG-NCSP-3.0.0` and `CG-NCSP-3.1.0` remain DRAFT, unpublished and inactive.
- Zero activation records; zero live activations; zero published versions.
- No publication, activation or authority cutover occurred.
- No historical regrade was performed and no completed decision was altered.
- Provisional recommendation. Reviewer confirmation required.
- Not for direct clinical action. Demo environment. Simulated export package.

**Status: DRAFT — ENGINEERING VALIDATION PASSED — CLINICAL GOVERNANCE PENDING.**
