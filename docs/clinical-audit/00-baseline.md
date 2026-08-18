# Clinical audit baseline

Recorded 2026-08-02 on `audit/full-ncsp-clinical-parity`, HEAD `578b4b046aed60ef68b950ffb5945e4bf6ec956b` (`fix: match demo flag parsing for schema bootstrap`). Repository package: `cervical-screening-app` 0.1.0; Node v25.1.0; npm 11.6.2; Next 16.2.1; React 19.2.0; Prisma 7.5.0; engine/rule release `business-figures-table1-v1`. No clinical feature flags were identified.

The pre-existing worktree was dirty before this audit (including application, Prisma schema/migration, and test changes). It was preserved. `npm ci` completed with peer/engine warnings and reported 29 dependency vulnerabilities. It did not generate Prisma Client, causing the first batch-test run to fail two module-load files. `npm run build` generated the client; the repeat batch run passed.

| Command | Result |
|---|---|
| `npm run lint` | pass; 0 errors, 18 warnings |
| `npm run typecheck` | pass |
| `npm run test:engine` | 107 pass, 0 fail |
| `npm run test:batch` after `npm ci` | 199 pass, 2 fail (missing generated Prisma Client) |
| `npm run test:batch` after build | 217 pass, 0 fail |
| `npm run build` | pass; 1 Turbopack tracing warning |

No dedicated API, browser/E2E, property-based, mutation, or coverage command is configured. Passing tests are implementation regression evidence, not clinical validation.
