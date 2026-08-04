# Release-hardening clean-checkout verification

Verification date: 2026-08-03. Clean worktree: `/tmp/cervigrade-release-hardening-bCY2Ym/worktree`. The source package was copied into the temporary checkout without being added to Git. Application code and reproducibility helpers were verified at `d1e2dce`; the final documentation-only commit may advance HEAD without changing these results.

## Reproduction result

| Gate | Result |
|---|---|
| `npm ci` | PASS; 742 packages installed. Audit remained 30 findings (2 low, 7 moderate, 19 high, 2 critical). |
| Empty isolated SQLite database | PASS; `/tmp/cervigrade-release-hardening-bCY2Ym/qa.sqlite`. |
| Migrations | PASS; 7/7 applied and schema up to date. |
| Prisma generation | PASS. Generation is required before a standalone `npm run typecheck` after `npm ci`. |
| Source import | PASS; `CG-NCSP-3.0.0` first run `CREATED`, second run `UNCHANGED`. |
| Successor import | PASS; `CG-NCSP-3.1.0` first run `CREATED`, second run `UNCHANGED`. |
| Input-gap simulation | PASS; first run created 18 append-only simulations, second run reused all 18. |
| Evaluated identity guard | PASS; changed evaluated identity rejected; successor cloning test passed. |
| TypeScript | PASS. |
| Lint | PASS with 0 errors and 19 existing warnings in the clean checkout. |
| Engine tests | PASS 104/104. |
| Batch tests | PASS 208/208, including 3 canonical V2 row-import and formula-neutralisation tests. |
| Rule Studio/conformance tests | PASS 910/910. |
| Total | PASS 1,222/1,222. |
| Production build | PASS; one existing Turbopack file-tracing warning for document storage. |
| Prisma validation/status | PASS; schema valid and all 7 migrations applied. |
| Schema diff | PASS; fresh migration schema and `lib/database/current-schema.sql` produced no SQL difference. |
| Authenticated browser | PASS with documented native-shell limits; final fresh tab had zero console warning/error entries. |

The first post-`npm ci` TypeScript attempt was intentionally recorded: it failed before Prisma client generation with two implicit-`any` symptoms in a generated-client-dependent page. Running `npx prisma generate` restored the expected types, after which TypeScript and the build passed. This is an installation-order requirement, not a rules-engine failure.

## Isolated database state

| Version | Status | Revision | Checksum | Evaluations | Audit events | Published |
|---|---|---:|---|---:|---:|---|
| `CG-NCSP-3.0.0` | DRAFT | 1 | `2997a909b98f9d8960cc3697cf125d5b0e106d4f0be9a0ee789404e54486a96b` | 0 | 1 | No |
| `CG-NCSP-3.1.0` | DRAFT | 1 | `3ab8657a13e73bb0080f18399d9165c20e9af5796bdcf594bdc71170309c824a` | 18 | 1 | No |

`CG-NCSP-3.1.0` links to `CG-NCSP-3.0.0`. Activation records: 0. Live activation records: 0. The legacy engine remains authoritative; canonical evaluation is `SHADOW` or `SIMULATION` only.

The developer database was also rechecked after the clean run. Its protected `CG-NCSP-3.0.0` remains DRAFT revision 3 with checksum `f6d75166bc2ba78f97542f4c2997ba70ad615955219d8d99ab82e424f504ae52`, one evaluation, three audit events, no publication timestamp and zero activations. It was not overwritten. The local `CG-NCSP-3.1.0` remains DRAFT with 18 simulations and zero activations.

## Exact command sequence

The source directory must be present at `docs/clinical-sources/source-v2.1/` in the clean checkout. Use a new explicit temporary path and database; do not point these commands at a live database.

```bash
git worktree add --detach /tmp/cervigrade-release-checkout <final-head>
cp -R /absolute/source/repository/docs/clinical-sources /tmp/cervigrade-release-checkout/docs/
cd /tmp/cervigrade-release-checkout
npm ci
touch /tmp/cervigrade-release-checkout-qa.sqlite
export DATABASE_URL='file:/tmp/cervigrade-release-checkout-qa.sqlite'
npx prisma migrate deploy
npx prisma generate
npm run demo:reset
npm run rules:import:v2.1
npm run rules:import:v2.1
npm run rules:import:v2.1:successor
npm run rules:import:v2.1:successor
npm run rules:simulate:v2-input-gaps
npm run rules:simulate:v2-input-gaps
npm run typecheck
npm run lint -- --max-warnings=100
npm run test:all
npm run test:rules
npm run build
npx prisma validate
npx prisma migrate status
```

The independent differential and report commands used in this run were:

```bash
npx tsx scripts/rule-studio/run-canonical-v2-differential.ts
npx tsx scripts/rule-studio/generate-release-hardening-reports.ts
npx tsx scripts/rule-studio/persist-canonical-v2-input-gap-simulations.ts
```

Authenticated browser QA used a production build on an isolated loopback port and the seeded demo administrator. It exercised version list, master/pathway views, search, selection, highlighting, inspector, Clinical Review, responsive widths, exports, print dispatch and evaluated-snapshot locking.

## Boundary

- DRAFT — engineering validation passed — governed clinical review pending.
- Provisional recommendation.
- Reviewer confirmation required.
- Not for direct clinical action.
- Demo environment.
- Simulated export package.
- No publication and no activation occurred.
