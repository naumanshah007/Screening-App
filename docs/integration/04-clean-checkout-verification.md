# Clean-checkout verification — integration branch

Date: 4 August 2026.
Verified commit: `300c3d62d87e6d6baa7182430dc15be66ac67652`
(`integration/rule-studio-on-latest-main`, based on `origin/main` @ `fb933c3`).

A second detached worktree was created from the final integration commit and
verified from scratch. `git status --porcelain` reported **0 lines** at checkout,
so everything below was reproduced from committed history plus the external
source package.

## Result

# `CLEAN_CHECKOUT_VERIFIED`

## Environment

| Item | Value |
|---|---|
| Worktree | `/tmp/cervigrade-cleancheckout-*` (detached at `300c3d6`) |
| Install | `npm ci` from the committed lockfile — 769 packages, exit 0 |
| Database | new empty SQLite, `file:./isolated-test.db` |
| Environment | locally generated throwaway values only |
| External source package | copied in, **not committed** (repository policy) |
| Node / npm | v25.1.0 / 11.6.2 |

## Verification results

| Check | Result |
|---|---|
| `npx prisma generate` | **PASS** |
| `npx prisma migrate deploy` | **PASS** — all migrations applied to a fresh database |
| `npx prisma validate` | **PASS** |
| `npx prisma migrate status` | **PASS** — 7 migrations, schema up to date |
| `npm run typecheck` | **PASS** — 0 errors |
| `npm run lint -- --max-warnings=100` | **PASS** — 19 problems, **0 errors** |
| `npm run test:engine` | **PASS — 147 tests: 144 pass, 0 fail, 3 todo** |
| `npm run test:batch` | **PASS — 208/208** |
| `npm run test:rules` | **PASS — 910/910** |
| `npm run test:router` | **PASS — 17 tests: 14 pass, 0 fail, 3 todo** |
| Conformance alias non-equivalence | **PASS — 6/6** |
| `npm run build` | **PASS** — compiled in 8.6s, 50 static pages generated |
| `git diff --check` | **PASS** — clean |

**Total: 1,271 tests, 0 failures, 3 documented `todo` (ROUTER-001…003).**

The 3 `todo` entries are pre-existing production defects, not integration
regressions — they fail identically on the reproduced production build. See
`05-router-defect-register.md`.

## Comparison to the pre-integration baselines

| Suite | Production `fb933c3` | Standalone candidate | **Integrated** |
|---|---:|---:|---:|
| `test:engine` | 130 | 104 | **147** |
| `test:batch` | 203 | 208 | **208** |
| `test:rules` | n/a (script absent) | 910 | **910** |
| Router probes differing from production | 0 (baseline) | **9 / 12** | **0 / 12** |

The engine count rises above both inputs because the integration keeps main's 26
engine tests (age-eligibility + overlay) **and** adds the 17 new router probes.

## Route surface

| Item | Value |
|---|---:|
| Built page routes | 40 |
| `clinical-rules` API route handlers built | 15 |

Production and Rule Studio surfaces both built: `/admin`, `/batch`, `/review`,
`/decisions`, `/guidelines`, `/readiness` **and** `/rules/clinical`.

## Safety verification

| Check | Result |
|---|---|
| Secrets in build output | **None.** The throwaway `NEXTAUTH_SECRET` does not appear anywhere in `.next`. Matches on "password" are UI validation strings only. |
| Production data used | **None.** Fresh empty database. |
| Published rule versions | **0** |
| Live activations | **0** |
| Rule evaluations written | **0** in the clean database |
| Authority cutover | **None.** Legacy remains authoritative. |
| Immutability triggers created | **7** — `ClinicalRuleVersion` (3), `RuleEvaluation` (2), `RuleVersionAuditEvent` (2) |
| Data-destructive migrations | **None.** The `DROP TABLE` statements are the standard Prisma SQLite table-rebuild idiom (`CREATE new_X` → `INSERT INTO new_X … SELECT` → `DROP TABLE X` → `RENAME`), preserving rows across the rebuild. |
| Canonical snapshot checksum | `3ab8657a13e73bb0…` — **identical before and after integration**, so CG-NCSP-3.1.0 was not mutated |

## Phase 11 — authenticated local QA

# `PENDING — NOT PERFORMED`

Recorded as **pending, not passed**, exactly as instructed.

Authenticated QA requires a login. No approved authenticated local session was
available, and the public demo credentials were **not** used — that is the R6
finding, which remains `OPEN_SECURITY_REMEDIATION_REQUIRED`, and using them would
both contradict the standing boundary and exercise the very exposure under
remediation.

What was verified without authentication:

- The production build compiles and generates all 50 pages.
- Both production Admin UX routes and Rule Studio routes are present in the build
  output.
- 15 `clinical-rules` API route handlers are built.
- No secret material is present in the client bundle.

Still requiring a human-authenticated pass:

Admin UX, onboarding, NCSR, integration validation, automation, Overview, Cases,
New Referral, Batch, Review Queue, completed decisions, Rule Studio, graph views,
simulation, Clinical Review, risk register, evaluated-draft read-only behaviour,
version/checksum provenance display, SVG/PNG export, console cleanliness.
