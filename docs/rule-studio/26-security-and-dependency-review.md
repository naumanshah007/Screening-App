# Security and dependency review

Review date: 2026-08-03. No uncontrolled `npm audit fix` or major framework/database/graph upgrade was run.

## Focused controls

| Threat | Control / result |
|---|---|
| AST injection / unsafe operators | Discriminated Zod AST only; no `eval`, `new Function`, executable strings or arbitrary operator. |
| Excessive recursion | Evaluator stops beyond 64 expression levels; collection fan-out is capped. |
| Cycles / graph DoS | Unexpected cycles, duplicate IDs, dangling endpoints, orphans and unknown view members block validation; snapshot collections have upper bounds. |
| Malformed package / checksum mismatch | Source manifests and SHA-256 are verified; runtime re-computes the snapshot checksum before evaluation. |
| Stale/concurrent edits | Expected revision is mandatory; stale writes return conflict. One live default activation is enforced by a partial unique index. |
| Unauthorised/cross-role action | Rule and case APIs use server-side RBAC. Governance proposal and approval permissions are separate. |
| Audit/evaluation mutation | Database triggers reject update/delete of rule evaluations and clinical-rule audit events. |
| Evaluated identity overwrite | Database trigger and importer guard require a new semantic version. |
| XSS / SVG export | React renders labels as text; SVG DOM export removes executable elements, event attributes and JavaScript URLs before serialization. |
| CSV formula injection | Canonical import and simulated decision export prefix formula-leading cells. |
| Malformed dates / contradictory facts | Zod datetime validation; contradictory V2 facts produce a visible specialist-review stop. |
| Replay/rollback races | Optimistic revision and single-live-activation constraint apply; rollback creates an activation record rather than deleting a newer version. |
| Completed decision rewrite | Correction endpoint rejects non-pending items; regrade creates a linked append-only evaluation. |

Focused tests cover recursion, collection limits, cycles, duplicates, formula injection, contradictory facts, immutable evaluations/audit, evaluated draft overwrite, linked regrade and two-person governance separation.

## Current npm audit

Current total: **30** findings — 2 low, 7 moderate, 19 high and 2 critical. This is a release blocker; it is not presented as a security pass.

`html2canvas` 1.4.1 was added for direct DOM rasterisation after browser QA reproduced a tainted-canvas failure in the previous SVG-to-canvas PNG path. The total audit count remained 30 and the package introduced no additional reported finding.

| Package | Severity | Dependency | Reachability | Fix classification |
|---|---|---|---|---|
| `@auth/core` | critical | transitive via Auth.js | runtime authentication | Patch available; requires auth regression testing. |
| `@auth/prisma-adapter` | high | direct | runtime authentication persistence | Patch available; test with Auth.js update. |
| `@babel/core` | low | transitive | lint/build only | Patch available. |
| `@chevrotain/cst-dts-gen` | high | transitive | Prisma CLI/dev only | Patch available through Prisma toolchain. |
| `@chevrotain/gast` | high | transitive | Prisma CLI/dev only | Patch available through Prisma toolchain. |
| `@eslint/eslintrc` | moderate | transitive | lint only | Patch available. |
| `@hono/node-server` | moderate | transitive | Prisma CLI/dev server only | Patch available through Prisma toolchain. |
| `@mrleebo/prisma-ast` | high | transitive | Prisma CLI/dev only | Patch available through Prisma toolchain. |
| `@prisma/dev` | high | transitive | Prisma CLI/dev only | Patch available; coordinate with Prisma. |
| `brace-expansion` | high | transitive | lint/build globbing; not application request path | Patch available in upstream dependency lines. |
| `chevrotain` | high | transitive | Prisma CLI/dev only | Patch available through Prisma toolchain. |
| `defu` | high | transitive | Prisma configuration/CLI | Patch available through Prisma. |
| `esbuild` | low | transitive via `tsx` | test/script execution only | Patch available. |
| `exceljs` | moderate | direct | runtime XLSX import/template path | Reported fix downgrades to 3.4.0 and is semver-major relative to dependency policy; requires compatibility tests. |
| `fast-xml-builder` | high | transitive via Azure XML | conditionally runtime reachable when Azure connector is used | Patch available upstream. |
| `fast-xml-parser` | moderate | transitive via Azure XML | conditionally runtime reachable when Azure connector is used | Patch available upstream. |
| `hono` | high | transitive | Prisma CLI/dev only in this application | Patch available through Prisma toolchain. |
| `js-yaml` | high | transitive | lint configuration only | Patch available. |
| `lodash` | high | transitive | Prisma AST tooling only | Patch available through Prisma toolchain. |
| `next` | high | direct | runtime framework | Patch available in the same major/minor line; requires full regression and browser QA. |
| `next-auth` | critical | direct | runtime authentication | Beta patch available; authentication/access-control regression is mandatory. |
| `nodemailer` | high | direct and Auth.js transitive | conditionally runtime reachable for email flows | Reported fixed version is a major upgrade; requires email/auth testing. |
| `picomatch` | high | transitive | lint/build globbing | Patch available upstream. |
| `postcss` | high | transitive | build-time CSS processing | Patch available through Next/Tailwind lines. |
| `prisma` | moderate | direct | schema/migration/generation tooling | Patch available; coordinate with client/toolchain versions. |
| `sharp` | high | transitive via Next | runtime image optimization where enabled | Patch available through Next dependency line. |
| `tmp` | high | transitive via ExcelJS | conditionally runtime reachable in workbook paths | Patch available upstream. |
| `uuid` | moderate | transitive via ExcelJS | conditionally runtime reachable in workbook paths | Audit proposes ExcelJS version change; compatibility review required. |
| `valibot` | moderate | transitive | Prisma CLI/dev only | Patch available through Prisma. |
| `ws` | high | transitive via libSQL client | conditionally runtime reachable for remote libSQL | Patch available upstream. |

No finding was classified as a false positive. Many are not runtime reachable in the deployed application path, but remain supply-chain/tooling risks. Before any publication decision, at minimum the critical Auth.js findings and runtime-reachable Next.js findings require controlled upgrades plus the full regression, access-control and browser suite.
