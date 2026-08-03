# Dependency security remediation

Date: 3 August 2026. Base commit: `d1e2dce`. Remediation commit: `e2bf41d`.

Software-security evidence for an unpublished, source-derived draft. Not clinical
validation and not a production-readiness claim.

## Outcome

| Severity | Before | After | Change |
|---|---:|---:|---:|
| Critical | 2 | **0** | −2 |
| High | 19 | 14 | −5 |
| Moderate | 7 | 3 | −4 |
| Low | 2 | 1 | −1 |
| **Total** | **30** | **18** | **−12** |

**Zero critical runtime findings remain.** 16 packages were fully resolved.

Machine-readable evidence:

- `docs/rule-studio/30-dependency-audit-before.json`
- `docs/rule-studio/30-dependency-audit-after.json`
- `docs/rule-studio/security-evidence/audit-before.json`
- `docs/rule-studio/security-evidence/outdated-after.json`

## Method and constraints observed

- `npm audit fix --force` was **never** run.
- No major framework migration was accepted merely because audit proposed it.
- **No downgrade was accepted.** Audit proposed `next@9.3.3`, `prisma@7.8.0` and
  `exceljs@3.4.0`; all three are regressions and were rejected.
- Upgrades were applied in reviewable groups, with typecheck and the full test
  suite run after each group.
- The clinical snapshot checksum was confirmed unchanged throughout:
  `3ab8657a13e73bb0080f18399d9165c20e9af5796bdcf594bdc71170309c824a`.

## Group A — authentication (both criticals)

| Package | From | To | Effect |
|---|---|---|---|
| `next-auth` | 5.0.0-beta.30 | 5.0.0-beta.32 | CRITICAL resolved |
| `@auth/core` (transitive) | — | 0.41.3 | CRITICAL resolved |
| `@auth/prisma-adapter` | 2.11.1 | 2.11.3 | HIGH resolved |

Advisories closed include `getToken()` uncaught exception on malformed input and
configuration errors causing existence disclosure.

Verified after upgrade: typecheck PASS; 1,239/1,239 tests PASS; production build
PASS. `@auth/core` re-resolved cleanly under the adapter and `next-auth`.

## Group B — Next.js runtime

| Package | From | To |
|---|---|---|
| `next` | 16.2.1 | **16.2.12** |

16.2.12 is the smallest supported patch in the current compatible line — same
major and minor, no migration. It closes **23** advisories, all of which capped
at `<16.2.11` or lower, including:

- Middleware / Proxy bypass via segment-prefetch routes (and its incomplete-fix
  follow-up), dynamic route parameter injection, Turbopack single-locale, and
  Pages Router i18n
- Cache poisoning in RSC responses and cache-busting collisions; cache confusion
  of response bodies (including invalid UTF-8 sequences)
- Cross-site scripting in App Router applications using CSP nonces, and in
  `beforeInteractive` scripts
- SSRF in Server Actions on custom servers, in rewrites via attacker-controlled
  destination hostname, and via WebSocket upgrades
- Denial of Service in Server Components, Server Actions, Image Optimization
  (including SVGs), and Cache Components connection exhaustion
- Unauthenticated disclosure of internal Server Function endpoints

After the upgrade `next` carries **no direct advisory of its own**. It remains
listed in audit output only because it bundles `postcss` and `sharp` (see
Retained findings).

Verified: production build PASS on 16.2.12 with only the pre-existing Turbopack
file-tracing warning for document storage; all route handlers, Rule Studio,
batch and completed-decision pages compile.

## Group C — Prisma / tooling

| Package | From | To |
|---|---|---|
| `prisma` (CLI) | 7.5.0 | 7.9.1 |
| `@prisma/client` | 7.5.0 | 7.9.1 |

CLI and client were deliberately kept aligned; the transitive fix pass moved the
CLI alone to 7.9.1 and the client was explicitly raised to match.

Verified: `prisma generate` PASS, `prisma validate` PASS, `prisma migrate status`
PASS (schema up to date), immutability triggers intact, import idempotency
retained.

## Group D — conditional / runtime utility

| Package | From | To | Note |
|---|---|---|---|
| `nodemailer` | 7.0.13 | **8.0.11** | 5 of 6 advisories closed |

`nodemailer` is genuinely runtime-reachable — `lib/notifications.ts:166`
constructs an SMTP transport for recall notifications.

8.0.11 is the **highest version inside the vendor-supported peer range**.
`next-auth` and `@auth/core` both declare
`peerDependencies.nodemailer: "^7.0.7 || ^8.0.5"`. Moving to 9.x would place the
tree outside that declared range and is therefore not applied.

Closed: SMTP command injection via unsanitized `envelope.size`; SMTP command
injection via CRLF in transport name (EHLO/HELO); CRLF injection in `List-*`
header comments; `jsonTransport` bypass of `disableFileAccess`/`disableUrlAccess`;
improper TLS certificate validation in OAuth2 token fetch.

Non-breaking transitive fixes applied in the same pass: `ws`, `tmp`, `picomatch`,
`brace-expansion`, `defu`, `hono`, `@hono/node-server`, `chevrotain`,
`@chevrotain/gast`, `@chevrotain/cst-dts-gen`, `@mrleebo/prisma-ast`,
`@prisma/dev`, `fast-xml-parser`, `fast-xml-builder`, `valibot`, `@babel/core`.

`ExcelJS` was **not** touched — see Retained findings.

## Retained findings, with reachability and compensating controls

None of the following is a critical finding. Each is retained deliberately, with
the exact constraint that blocks it.

### R1 — `nodemailer` HIGH, `GHSA-p6gq-j5cr-w38f` (range `<=9.0.0`)

Message-level `raw` option bypasses `disableFileAccess`/`disableUrlAccess`,
enabling arbitrary file read and full-response SSRF in the delivered message.

- **Constraint:** fixed only in 9.0.1+. `next-auth` and `@auth/core` declare the
  supported peer range `^7.0.7 || ^8.0.5`. Upgrading leaves the vendor-supported
  matrix.
- **Reachability: not reachable.** The codebase contains exactly one `sendMail`
  call (`lib/notifications.ts:176`). It passes an object literal of
  `{from, to, subject, text}`. The `raw` option is never used anywhere in the
  repository, and the message object is not attacker-constructed.
- **Compensating control:** SMTP is inert without `SMTP_HOST`/`SMTP_PORT`
  configuration; `hasSmtpConfig()` short-circuits to an audited dev log.
- **Propagation:** this single advisory is why `@auth/core`,
  `@auth/prisma-adapter` and `next-auth` reappear in the after-audit tree. They
  carry no advisory of their own.
- **Required future action:** raise to `nodemailer@9.0.1+` once `next-auth` /
  `@auth/core` widen their declared peer range.

### R2 — `next` → `postcss` (HIGH) and `sharp` (HIGH)

- **Constraint:** both are bundled inside Next 16.2.12. The only fix audit offers
  is `next@9.3.3`, a catastrophic downgrade across seven majors — rejected.
- **Reachability:** `postcss` (XSS via unescaped `</style>` in CSS stringify) is
  build-time only and processes first-party stylesheets. `sharp` (inherited
  libvips CVE-2026-33327/33328/35590/35591) backs Next image optimization.
- **Required future action:** adopt the next Next.js patch that re-pins these.

### R3 — `prisma` → `@prisma/studio-core` → `@visx/*` → `lodash` (HIGH)

- **Reachability: development tooling only.** This subtree exists solely for
  `prisma studio` (`npm run db:studio`) and is never imported by application
  runtime code, route handlers or the clinical engine.
- **Constraint:** audit's proposed fix is `prisma@7.8.0`, a **downgrade** from
  the 7.9.1 we deliberately installed — rejected.
- **Note:** these four entries are *newly listed* after remediation purely
  because the CLI moved 7.5.0 → 7.9.1. Severity is not discounted for being
  dev-only; it is classified accurately as non-runtime.

### R4 — `exceljs` → `uuid` (MODERATE)

- **Constraint:** the only offered fix is `exceljs@3.4.0`, a **major downgrade**
  from 4.4.0. Not applied. Per the release-hardening constraints, an ExcelJS
  downgrade requires proving XLSX import, template generation, the validation
  workbook, formula neutralisation and existing workbook compatibility. That
  evidence does not exist and the downgrade is not justified by a moderate
  finding.
- **Reachability:** the advisory is a missing buffer bounds check in uuid v3/v5/v6
  *when an explicit `buf` argument is supplied*. ExcelJS does not pass `buf`.

### R5 — `js-yaml`, `@eslint/eslintrc` (HIGH/MODERATE), `esbuild` (LOW)

- **Reachability: development tooling only** — ESLint configuration loading and
  the dev server. Not present in the production build output.

## Regression evidence after all dependency changes

| Check | Result |
|---|---|
| `npx prisma generate` | PASS |
| `npm run typecheck` | PASS |
| `npm run lint -- --max-warnings=100` | PASS — 0 errors, 21 warnings (dirty tree; 19 in clean checkout) |
| `npm run test:engine` | PASS 107/107 (dirty tree) |
| `npm run test:batch` | PASS 222/222 (dirty tree) |
| `npm run test:rules` | PASS 910/910 |
| `npm run test:all` | PASS 1,239/1,239 (dirty tree) — 1,222 in clean checkout |
| `npm run build` | PASS; one pre-existing Turbopack file-tracing warning |
| `npx prisma validate` | PASS |
| `npx prisma migrate status` | PASS; schema up to date |
| Canonical differential checksum | unchanged `3ab8657a…c824a` |

## Security gate statement

The security gate **passes for critical runtime findings**: zero critical
findings remain, and the two pre-existing criticals (`next-auth`, `@auth/core`)
are remediated with supported patch releases.

The gate is **not** claimed as fully clear. Fourteen high findings are retained
under R1–R5 above, each with an explicit constraint, reachability assessment and
required future action. R1 is the only retained finding in runtime-reachable
code, and it is unreachable in this codebase's call pattern.

No publication, activation or authority cutover occurred. The clinical snapshot
checksum is unchanged.
