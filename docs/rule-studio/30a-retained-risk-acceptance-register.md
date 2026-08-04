# Retained risk acceptance register

Companion to `30-dependency-remediation.md`. Generated 3 August 2026 against
commit `a033d84`, from a **read-only** `npm audit --json`. No dependency,
application, clinical-rule, database, publication or activation state was changed
to produce this document.

**Scope note.** R1–R5 are **dependency** findings from the npm audit. **R6**,
added 3 August 2026, is a **deployment/configuration** security finding raised
during deployed-versus-candidate reconnaissance; it is not an npm audit item and
does not appear in the audit JSON. Both are recorded here so the security/product
risk owner has one signable surface.

---

> ## ⚠ UNSIGNED ENTRIES ARE NOT ACCEPTED RISKS.
> ## THEY REMAIN RELEASE BLOCKERS UNTIL AN AUTHORISED HUMAN RISK OWNER RECORDS A DECISION, RATIONALE, SCOPE AND EXPIRY.

An entry with an empty **Decision**, **Approver** or **Approval date** field is
**pending**, not accepted. No entry in this register has been accepted. The
author of this document is an AI agent and **must not** be recorded as approver.
The approver must be the designated security/product risk owner — not the
developer who made the change, and not an AI.

---

## Audit baseline for this register

| Severity | Count |
|---|---:|
| Critical | **0** |
| High | 14 |
| Moderate | 3 |
| Low | 1 |
| **Total** | **18** |

These are the actual counts from a fresh read-only audit at `a033d84` and match
the figures recorded in report 30. Remediation history is in
`30-dependency-remediation.md`; before/after evidence is in
`30-dependency-audit-before.json` and `30-dependency-audit-after.json`.

**Scope correction.** `tmp` (GHSA-ph9p-34f9-6g65) is **not** a retained risk. It
was remediated in `e2bf41d` and no longer appears in the audit. It is therefore
excluded from R4 rather than carried as an open item.

**Note on counting.** The 18 findings map to 5 risk groups because npm audit
propagates a single advisory up the dependency tree. For example, the one
retained `nodemailer` advisory causes `@auth/core`, `@auth/prisma-adapter` and
`next-auth` to be listed as well; those three carry no advisory of their own.

---

## R1 — Nodemailer residual message-level `raw` advisory

| Field | Value |
|---|---|
| **Risk ID** | R1 |
| **Affected package / chain** | `nodemailer`; propagates to `@auth/core` → `@auth/prisma-adapter`, and `next-auth` |
| **Installed version** | `nodemailer@8.0.11` |
| **Severity** | HIGH |
| **Advisory** | [GHSA-p6gq-j5cr-w38f](https://github.com/advisories/GHSA-p6gq-j5cr-w38f) — message-level `raw` option bypasses `disableFileAccess`/`disableUrlAccess`, enabling arbitrary file read and full-response SSRF in the delivered message. Vulnerable range `<=9.0.0` |
| **Dependency type** | DIRECT (also transitive via the auth packages) |
| **Reachability class** | **RUNTIME** |
| **Affected application feature** | Recall/notification email delivery — `lib/notifications.ts` |
| **Exploit preconditions** | Caller must supply the `raw` message option, or otherwise control the structure of the message object passed to `sendMail`. Requires SMTP to be configured. |
| **Current exposure** | **Low but non-zero.** The repository contains exactly one `sendMail` call (`lib/notifications.ts:176`), which passes an object literal of `{from, to, subject, text}`. The `raw` option does not appear anywhere in the codebase, so the vulnerable path is not constructed today. This reduces reachability; **it does not erase the advisory.** |
| **Remediation version** | `nodemailer@9.0.1` or later |
| **Reason not applied** | 9.x is outside the version range currently supported by the authentication packages |
| **Compatibility / peer constraint** | `next-auth` and `@auth/core` both declare `peerDependencies.nodemailer: "^7.0.7 \|\| ^8.0.5"` (optional). 8.0.11 is the **highest version inside the supported range**. Installing 9.x would place the tree outside the vendor-supported matrix. |
| **Compensating controls** | (a) No `raw` option used anywhere in the repository; (b) the message object is constructed literally in application code, not from request input; (c) SMTP is inert without `SMTP_HOST`/`SMTP_PORT` — `hasSmtpConfig()` short-circuits to an audited dev log; (d) 5 of the 6 nodemailer advisories were closed by the 7.0.13 → 8.0.11 upgrade, including two SMTP command-injection issues and an OAuth2 TLS validation issue. |
| **Tests supporting controls** | No test currently asserts the absence of the `raw` option. **Control is verified by code inspection only.** A regression test pinning the `sendMail` call shape is recommended before acceptance. |
| **Residual risk** | Arbitrary file read / SSRF becomes reachable if any future change introduces a `raw` message, or allows caller-controlled message construction. Detection today relies on review, not on an automated guard. |
| **Proposed risk owner** | Security/product risk owner (designated) |
| **Decision** | ☐ ACCEPT ☐ REMEDIATE ☐ DEFER_WITH_EXPIRY ☐ FEATURE_DISABLE_REQUIRED ☐ EXTERNAL_REVIEW_REQUIRED |
| **Acceptance rationale** | ☐ _______________________ |
| **Acceptance scope** | ☐ _______________________ |
| **Review-by date** | ☐ _______________________ |
| **Expiry date** | ☐ _______________________ |
| **Reopening trigger** | **Reopen immediately** when any of: (1) `next-auth`/`@auth/core` widen their supported nodemailer peer range; (2) a raw-message or MIME-passthrough feature is introduced; (3) email content, recipients or headers become user-controlled; (4) a new nodemailer advisory affects 8.0.11. |
| **Approver name** | ☐ _______________________ |
| **Approver role** | ☐ _______________________ |
| **Approver signature / recorded identity** | ☐ _______________________ |
| **Approval date** | ☐ _______________________ |
| **Evidence links** | `30-dependency-remediation.md` §Group D, §R1; `30-dependency-audit-after.json`; `lib/notifications.ts:160-185` |
| **Status** | **PENDING_SECURITY_RISK_DECISION** |

---

## R2 — Next.js transitive PostCSS / Sharp findings

| Field | Value |
|---|---|
| **Risk ID** | R2 |
| **Affected package / chain** | `next` → `postcss`; `next` → `sharp` |
| **Installed version** | `next@16.2.12`; `postcss@8.5.25`; `sharp@0.34.5` |
| **Severity** | HIGH (both chains) |
| **Advisory** | **postcss** (range `<=8.5.17`): [GHSA-6g55-p6wh-862q](https://github.com/advisories/GHSA-6g55-p6wh-862q) arbitrary file read / information disclosure (HIGH); [GHSA-r28c-9q8g-f849](https://github.com/advisories/GHSA-r28c-9q8g-f849) path traversal in previous-source-map auto-loading (HIGH); [GHSA-qx2v-qp2m-jg93](https://github.com/advisories/GHSA-qx2v-qp2m-jg93) XSS via unescaped `</style>` (MODERATE). **sharp** (range `<0.35.0`): [GHSA-f88m-g3jw-g9cj](https://github.com/advisories/GHSA-f88m-g3jw-g9cj) inherited libvips CVE-2026-33327, CVE-2026-33328, CVE-2026-35590, CVE-2026-35591 (HIGH) |
| **Dependency type** | `next` is DIRECT; `postcss` and `sharp` are **inherited through the framework** — neither is declared in `package.json`. After the 16.2.12 upgrade, `next` itself carries **no direct advisory**; it is listed solely because it bundles these two. |
| **Reachability class** | `postcss`: **BUILD-TIME**. `sharp`: **CONDITIONAL-RUNTIME** (Next image optimization) |
| **Affected application feature** | `postcss`: CSS pipeline during `next build`, processing first-party stylesheets (`app/globals.css`). `sharp`: Next Image Optimization API |
| **Exploit preconditions** | `postcss`: requires attacker-controlled CSS or source-map input into the build — the build consumes only first-party stylesheets from the repository. `sharp`: requires attacker-controlled image input to reach libvips decoding via the image optimizer. |
| **Current exposure** | **Requires deployment confirmation by the risk owner.** From the repository alone: the build processes only first-party CSS, so the postcss chain is not reachable by external input at build time. Whether the `sharp`/image-optimizer path is reachable depends on whether remote or user-supplied image sources are enabled in the deployed configuration — this **cannot be determined from the repository** and must be confirmed against the actual deployment. |
| **Remediation version** | Upstream — a Next.js patch release that re-pins `postcss >=8.5.18` and `sharp >=0.35.0`. No first-party remediation exists. |
| **Reason not applied** | The only fix audit offers is `next@9.3.3`, a downgrade across seven majors. **Rejected as a regression.** These are transitive pins owned by the framework, not by this project. |
| **Compatibility / peer constraint** | Versions are controlled by the installed Next.js release. Overriding them independently (e.g. via `overrides`) is unsupported by the framework and untested here. |
| **Compensating controls** | (a) 16.2.12 is the current in-line patch and already closed 23 direct Next advisories; (b) the build consumes only first-party stylesheets; (c) no first-party code calls `postcss` or `sharp` directly. |
| **Tests supporting controls** | Production build passes on 16.2.12 (`33-claude-clean-checkout-verification.md`). No test exercises image-optimizer input validation. |
| **Residual risk** | Inherited framework exposure that this project cannot close on its own. Persists until upstream re-pins. |
| **Proposed risk owner** | Security/product risk owner (designated) |
| **Decision** | ☐ ACCEPT ☐ REMEDIATE ☐ DEFER_WITH_EXPIRY ☐ FEATURE_DISABLE_REQUIRED ☐ EXTERNAL_REVIEW_REQUIRED |
| **Acceptance rationale** | ☐ _______________________ |
| **Acceptance scope** | ☐ _______________________ |
| **Review-by date** | ☐ _______________________ |
| **Expiry date** | ☐ _______________________ |
| **Reopening trigger** | Retest on the **next supported Next.js patch release**; or if remote/user-supplied image sources are enabled; or if third-party CSS enters the build. |
| **Approver name** | ☐ _______________________ |
| **Approver role** | ☐ _______________________ |
| **Approver signature / recorded identity** | ☐ _______________________ |
| **Approval date** | ☐ _______________________ |
| **Evidence links** | `30-dependency-remediation.md` §Group B, §R2; `30-dependency-audit-after.json` |
| **Status** | **PENDING_SECURITY_RISK_DECISION** |

---

## R3 — Prisma Studio / tooling findings

| Field | Value |
|---|---|
| **Risk ID** | R3 |
| **Affected package / chain** | `prisma` → `@prisma/studio-core` → `@visx/grid`, `@visx/responsive`, `@visx/shape` → `lodash` |
| **Installed version** | `prisma@7.9.1`; `@prisma/client@7.9.1`; `lodash@4.17.23` |
| **Severity** | HIGH |
| **Advisory** | [GHSA-r5fr-rjxr-66jc](https://github.com/advisories/GHSA-r5fr-rjxr-66jc) lodash code injection via `_.template` import key names (HIGH); [GHSA-f23m-r3pf-42rh](https://github.com/advisories/GHSA-f23m-r3pf-42rh) prototype pollution via array path bypass in `_.unset` (MODERATE). Range `<=4.17.23` |
| **Dependency type** | `prisma` is DIRECT; the Studio/visx/lodash subtree is transitive |
| **Reachability class** | **DEVELOPMENT-ONLY** for the vulnerable code path — with an important qualifier below |
| **Affected application feature** | Prisma Studio, invoked manually via `npm run db:studio`. No application route, server action, API handler or clinical-engine module imports `@prisma/studio-core`, `@visx/*` or `lodash`. |
| **Exploit preconditions** | Requires executing Prisma Studio and feeding it attacker-controlled template/key input. Not reachable through the deployed web application. |
| **Current exposure** | **Requires confirmation by the risk owner.** Two facts must be weighed together: (1) the vulnerable code path is exercised only by `prisma studio`, which is a manual developer command and is **not** part of `npm start` (`next start`) or `npm run build`; **but** (2) `prisma` is declared in **`dependencies`, not `devDependencies`**, so the Studio subtree **is installed in a production `npm ci` tree** even though it is never executed there. Whether that installed-but-unexecuted code is acceptable depends on the deployment's image-hardening policy and must be confirmed against the actual deployment. |
| **Remediation version** | A Prisma release that re-pins `@prisma/studio-core` / `@visx/*` off vulnerable `lodash` |
| **Reason not applied** | Audit's proposed fix is `prisma@7.8.0` — a **downgrade** from the 7.9.1 deliberately installed during remediation. **Rejected.** |
| **Compatibility / peer constraint** | Prisma CLI and `@prisma/client` **must remain version-aligned**; both are pinned at 7.9.1. Any change must move them together. |
| **Compensating controls** | (a) Prisma Studio is never started by `build` or `start`; (b) no first-party import of the vulnerable subtree; (c) CLI/client alignment maintained and verified. |
| **Tests supporting controls** | `prisma validate`, `prisma migrate status` and all three schema diffs pass at 7.9.1 (`33-claude-clean-checkout-verification.md`). No test asserts Studio is absent from production images. |
| **Residual risk** | Vulnerable code is present in the production dependency tree but not executed. Risk is developer-machine and build-image surface, not request-path surface. |
| **Proposed risk owner** | Security/product risk owner (designated) |
| **Decision** | ☐ ACCEPT ☐ REMEDIATE ☐ DEFER_WITH_EXPIRY ☐ FEATURE_DISABLE_REQUIRED ☐ EXTERNAL_REVIEW_REQUIRED |
| **Acceptance rationale** | ☐ _______________________ |
| **Acceptance scope** | ☐ _______________________ |
| **Review-by date** | ☐ _______________________ |
| **Expiry date** | ☐ _______________________ |
| **Reopening trigger** | Retest on the **next supported Prisma patch**; or if Prisma Studio is ever exposed beyond a developer machine; or if `prisma` is required at request time. |
| **Approver name** | ☐ _______________________ |
| **Approver role** | ☐ _______________________ |
| **Approver signature / recorded identity** | ☐ _______________________ |
| **Approval date** | ☐ _______________________ |
| **Evidence links** | `30-dependency-remediation.md` §Group C, §R3; `package.json` (`prisma` under `dependencies`) |
| **Status** | **PENDING_SECURITY_RISK_DECISION** |

---

## R4 — ExcelJS / uuid findings

> `tmp` was remediated in `e2bf41d` and is **not** part of this entry.

| Field | Value |
|---|---|
| **Risk ID** | R4 |
| **Affected package / chain** | `exceljs` → `uuid` |
| **Installed version** | `exceljs@4.4.0`; `uuid@8.3.2` |
| **Severity** | MODERATE |
| **Advisory** | [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq) — missing buffer bounds check in uuid v3/v5/v6 when `buf` is provided. Range `<11.1.1` |
| **Dependency type** | `exceljs` DIRECT; `uuid` transitive |
| **Reachability class** | **CONDITIONAL-RUNTIME (client-side)** for workbook import; **BUILD/SCRIPT** for template generation |
| **Affected application feature** | Workbook import via `lib/batch/adapters/xlsx-adapter.ts`, invoked from `app/(app)/batch/BatchPageClient.tsx`; batch template generation via `scripts/generate-batch-template.ts` and the canonical V2 contract export |
| **Exploit preconditions** | Requires calling uuid v3/v5/v6 **with an explicit `buf` argument**. ExcelJS does not pass `buf`, and the affected uuid versions are not invoked with a caller-supplied buffer anywhere in this codebase. |
| **Current exposure** | **Very low.** The precondition (`buf` supplied) is not met. Additionally, `BatchPageClient.tsx` is a `"use client"` component and `loadFile(file: File)` parses the workbook **in the authenticated user's own browser**, on a file that user selected — the batch pipeline does **not** accept third-party XLSX uploads server-side. |
| **Untrusted XLSX accepted?** | **Not server-side.** No `formData()` handler exists under `app/api/batch`; the only `formData()` use in the API is `app/api/cases/[id]/documents/route.ts`, which is a separate document path. Workbook parsing is client-side and user-initiated by an authenticated clinical user. |
| **File-size / parsing limits** | **None found.** No `maxFileSize`, `MAX_ROWS` or equivalent guard exists in `lib/batch` or the API. A malformed or very large workbook is bounded only by the browser tab. This is a gap the risk owner should note. |
| **Remediation version** | `uuid >=11.1.1`, reachable only via an ExcelJS release that re-pins it |
| **Reason not applied** | Audit's only offered fix is `exceljs@3.4.0` — a **major downgrade** from 4.4.0. **Rejected.** Per the release-hardening constraints an ExcelJS downgrade requires proving XLSX import, template generation, the validation workbook, formula neutralisation and existing workbook compatibility; that evidence does not exist and the downgrade is not justified by a moderate finding whose precondition is unmet. |
| **Compatibility / peer constraint** | `uuid` version is pinned by the installed ExcelJS release. |
| **Compensating controls** | (a) Formula neutralisation on ingested cells, preventing spreadsheet-formula execution in exported/rendered output; (b) workbook validation and column mapping in the adapter; (c) client-side, user-initiated parsing only; (d) authenticated access required to reach the batch surface. |
| **Tests supporting controls** | `lib/batch/__tests__/canonical-v2-import.test.ts` — *"CSV cells that could execute as formulas are neutralised"*; *"canonical V2 batch rows reject duplicate or malformed facts"*. `lib/batch/__tests__/xlsx-adapter.test.ts` — 11 tests covering sheet selection, header/column detection, unmapped columns and error handling on unusable sheets. All pass within the 1,222-test clean-checkout run. |
| **Residual risk** | Moderate advisory remains present but unreachable under current call patterns. Absence of explicit file-size/row limits is an independent robustness gap, not an exploit of this advisory. |
| **Proposed risk owner** | Security/product risk owner (designated) |
| **Decision** | ☐ ACCEPT ☐ REMEDIATE ☐ DEFER_WITH_EXPIRY ☐ FEATURE_DISABLE_REQUIRED ☐ EXTERNAL_REVIEW_REQUIRED |
| **Acceptance rationale** | ☐ _______________________ |
| **Acceptance scope** | ☐ _______________________ |
| **Review-by date** | ☐ _______________________ |
| **Expiry date** | ☐ _______________________ |
| **Reopening trigger** | Retest when a **compatible fixed ExcelJS release** re-pins `uuid >=11.1.1`; or if server-side/untrusted XLSX ingestion is introduced; or if uuid v3/v5/v6 is ever called with an explicit `buf`. |
| **Approver name** | ☐ _______________________ |
| **Approver role** | ☐ _______________________ |
| **Approver signature / recorded identity** | ☐ _______________________ |
| **Approval date** | ☐ _______________________ |
| **Evidence links** | `30-dependency-remediation.md` §R4; `lib/batch/adapters/xlsx-adapter.ts`; `app/(app)/batch/BatchPageClient.tsx` |
| **Status** | **PENDING_SECURITY_RISK_DECISION** |

---

## R5 — ESLint / esbuild and other development-only findings

| Field | Value |
|---|---|
| **Risk ID** | R5 |
| **Affected package / chain** | `@eslint/eslintrc` → `js-yaml`; `esbuild` |
| **Installed version** | `js-yaml@4.1.1`; `esbuild@0.27.4` |
| **Severity** | HIGH (`js-yaml`), MODERATE (`@eslint/eslintrc`), LOW (`esbuild`) |
| **Advisory** | [GHSA-52cp-r559-cp3m](https://github.com/advisories/GHSA-52cp-r559-cp3m) js-yaml merge-key chains force quadratic CPU consumption (HIGH); [GHSA-h67p-54hq-rp68](https://github.com/advisories/GHSA-h67p-54hq-rp68) quadratic-complexity DoS in merge key handling (MODERATE); range `4.0.0 - 4.2.0`. [GHSA-g7r4-m6w7-qqqr](https://github.com/advisories/GHSA-g7r4-m6w7-qqqr) esbuild arbitrary file read when running the development server (LOW); range `0.27.3 - 0.28.0` |
| **Dependency type** | Transitive |
| **Reachability class** | **DEVELOPMENT / BUILD-ONLY** |
| **Affected application feature** | `js-yaml`: ESLint configuration loading during `npm run lint`. `esbuild`: local development server tooling. Neither is present in the production build output or on any request path. |
| **Exploit preconditions** | `js-yaml`: requires linting a YAML config containing adversarial merge-key chains. `esbuild`: requires an attacker to reach a running **development** server. |
| **Current exposure** | **Requires confirmation by the risk owner.** From the repository alone, exposure is limited to developer machines: **there is no CI configuration in this repository** — no `.github/workflows`, `.gitlab-ci.yml`, `Jenkinsfile` or `.circleci`. Therefore the questions of whether CI processes untrusted branches or pull requests, and what build-agent isolation exists, **cannot be answered from the repository** and must be answered by the risk owner against the actual CI/CD platform in use. |
| **CI processes untrusted branches/PRs?** | ☐ To be confirmed by risk owner — not determinable from this repository |
| **Build-agent isolation controls** | ☐ To be confirmed by risk owner — not determinable from this repository |
| **Remediation version** | `js-yaml >4.2.0` via an `@eslint/eslintrc` release; `esbuild >0.28.0` |
| **Reason not applied** | Both are pinned by their parent tooling packages; the non-breaking transitive fix pass did not move them. No supported first-party upgrade path exists without changing the ESLint toolchain. |
| **Compatibility / peer constraint** | Versions controlled by the installed ESLint / bundler toolchain. |
| **Compensating controls** | (a) Not present in production build output; (b) lint runs on first-party configuration only; (c) the esbuild advisory requires a dev server, which is not run in production. |
| **Tests supporting controls** | Lint passes with 0 errors and 19 warnings in the clean checkout; production build passes without these packages on any request path. |
| **Residual risk** | Developer-machine and build-pipeline surface. Severity is **not** discounted for being dev-only; it is classified by reachability. Real exposure depends on CI configuration outside this repository. |
| **Proposed risk owner** | Security/product risk owner (designated) |
| **Decision** | ☐ ACCEPT ☐ REMEDIATE ☐ DEFER_WITH_EXPIRY ☐ FEATURE_DISABLE_REQUIRED ☐ EXTERNAL_REVIEW_REQUIRED |
| **Acceptance rationale** | ☐ _______________________ |
| **Acceptance scope** | ☐ _______________________ |
| **Review-by date** | ☐ _______________________ |
| **Expiry date** | ☐ _______________________ |
| **Reopening trigger** | Retest on the **next compatible ESLint/esbuild patch**; or if CI begins building untrusted branches or forked pull requests; or if a development server is ever exposed beyond localhost. |
| **Approver name** | ☐ _______________________ |
| **Approver role** | ☐ _______________________ |
| **Approver signature / recorded identity** | ☐ _______________________ |
| **Approval date** | ☐ _______________________ |
| **Evidence links** | `30-dependency-remediation.md` §R5; `30-dependency-audit-after.json` |
| **Status** | **PENDING_SECURITY_RISK_DECISION** |

---

---

## R6 — Public demo credential exposure

> **Not a dependency finding.** R6 is a **deployment / configuration** finding
> raised on 3 August 2026 during deployed-versus-candidate reconnaissance. It is
> recorded here so the risk owner has a single signable surface, but it is
> distinct in kind from R1–R5 and is **not** an npm audit item. It does not
> appear in `30-dependency-audit-before.json` or `-after.json`.

| Field | Value |
|---|---|
| **Risk ID** | R6 |
| **Finding** | `PUBLIC_DEMO_CREDENTIAL_EXPOSURE` |
| **Affected asset** | `https://screening.privexa.co/login` — internet-facing production hostname |
| **Affected component** | Login page demo-account convenience block (application code, present in both the deployed build and the local candidate) |
| **Severity** | **HIGH** |
| **Advisory identifier** | None — first-party configuration/design finding, not a CVE or GHSA |
| **Dependency type** | Not applicable — first-party |
| **Reachability class** | **RUNTIME, UNAUTHENTICATED, INTERNET-FACING** |
| **Affected application feature** | Authentication / sign-in |
| **Exploit preconditions** | **None.** No authentication, no special tooling, no prior access. The credentials render in the unauthenticated HTML of a public page. |
| **Current exposure** | **Immediate and live.** Working credentials for four roles — including a **platform administrator** role — are published in plain text on the public login page, with click-to-fill buttons. Anyone who loads the page can sign in at administrator level. |
| **Credential handling in this register** | The literal password is **deliberately not recorded** in this repository or any report. No credential, cookie, session token or authentication material has been committed to Git. Verified by a pre-commit scan of staged content. |
| **Verified by** | Direct read of the unauthenticated `/login` HTML on 3 August 2026. **No sign-in was attempted** and no session was created. |
| **Introduced by the Rule Studio programme?** | **No.** The same block exists in the local candidate build and in the inferred deployed build `418e3b8`, which predates the Rule Studio work entirely. This is pre-existing product behaviour, not a candidate regression. |
| **Remediation required** | (a) **Rotate all exposed passwords**; (b) **remove the credential block from the public login UI**; (c) **review and disable unused demo accounts**; (d) **restrict the demo deployment** using Vercel Authentication, an IP/SSO allowlist or equivalent access control; (e) **verify that no real data and no production integrations** (SMTP, PAS, FHIR/HL7, webhooks) are reachable through those accounts. |
| **Reason not applied** | Remediation is **not authorised in this session.** The instruction was to record the finding and explicitly not to attempt remediation unless separately assigned. |
| **Compatibility constraint** | None. Remediation is a product/configuration decision, not a dependency constraint. |
| **Compensating controls** | **None identified.** Strong transport and header posture (HSTS, CSP, `X-Frame-Options: DENY`) does not mitigate published credentials. No rate limiting, MFA enforcement or IP restriction was observed on the public login surface. |
| **Tests supporting controls** | **None.** No test asserts that credentials are absent from the login page. A regression test asserting this is recommended as part of remediation. |
| **Residual risk** | Unauthenticated administrator access to an internet-facing clinical-decision-support prototype. Downstream impact depends on whether those accounts can reach real data or live integrations — **an open question the risk owner must answer.** |
| **Related findings** | Compounds the deployed-execution safety decision in `docs/deployed-comparison/02-deployed-test-safety-decision.md`: a publicly writable clinical-looking system with no documented test tenant or cleanup path. |
| **Proposed risk owner** | Security/product risk owner (designated) |
| **Decision** | ☐ ACCEPT ☐ REMEDIATE ☐ DEFER_WITH_EXPIRY ☐ FEATURE_DISABLE_REQUIRED ☐ EXTERNAL_REVIEW_REQUIRED |
| **Acceptance rationale** | ☐ _______________________ |
| **Acceptance scope** | ☐ _______________________ |
| **Review-by date** | ☐ _______________________ |
| **Expiry date** | ☐ _______________________ |
| **Reopening trigger** | Not applicable while open. After remediation, reopen if any credential is reintroduced to a public surface, if demo accounts are re-enabled without access restriction, or if the demo deployment is exposed without authentication. |
| **Approver name** | ☐ _______________________ |
| **Approver role** | ☐ _______________________ |
| **Approver signature / recorded identity** | ☐ _______________________ |
| **Approval date** | ☐ _______________________ |
| **Evidence links** | `docs/deployed-comparison/01-deployment-identity.md` §Security finding; `01-deployment-identity.json` `securityObservations.publicDemoCredentialExposure` |
| **Status** | **OPEN_SECURITY_REMEDIATION_REQUIRED** |

---

## Summary

| Metric | Count |
|---|---:|
| Total risk entries | **6** (R1–R5 dependency, R6 deployment) |
| Retained **dependency** risk groups | **5** |
| Open **deployment/configuration** findings | **1** |
| Accepted | **0** |
| Deferred with expiry (signed) | 0 |
| Remediate (signed decision) | 0 |
| External review required (signed) | 0 |
| **Unsigned** | **6** |
| Expired | 0 |
| Reopened | 0 |
| Open security remediation required (unsigned, R6) | **1** |

**All six entries remain pending. Nothing in this register has been accepted.**

The four "signed" rows count **recorded risk-owner decisions**, of which there
are none. R6 carries status `OPEN_SECURITY_REMEDIATION_REQUIRED` because the
finding itself demands remediation — that is a property of the finding, **not** a
signed decision, and R6's Decision field is blank like the others.

| Risk | Reachability | Severity | Status |
|---|---|---|---|
| R1 Nodemailer `raw` advisory | Runtime | HIGH | PENDING_SECURITY_RISK_DECISION |
| R2 Next.js → postcss / sharp | Build-time / conditional-runtime | HIGH | PENDING_SECURITY_RISK_DECISION |
| R3 Prisma Studio → lodash | Development-only (installed in prod tree) | HIGH | PENDING_SECURITY_RISK_DECISION |
| R4 ExcelJS → uuid | Conditional-runtime (client-side) | MODERATE | PENDING_SECURITY_RISK_DECISION |
| R5 ESLint / esbuild | Development / build-only | HIGH / LOW | PENDING_SECURITY_RISK_DECISION |
| **R6 Public demo credential exposure** | **Runtime, unauthenticated, internet-facing** | **HIGH** | **OPEN_SECURITY_REMEDIATION_REQUIRED** |

## Items requiring information the repository cannot supply

The risk owner must supply these before signing; they are **not** determinable
from source:

1. **R2** — whether remote or user-supplied image sources are enabled in the
   deployed Next.js image-optimizer configuration.
2. **R3** — whether production images are permitted to contain the installed but
   unexecuted Prisma Studio subtree (`prisma` is a production dependency).
3. **R5** — whether CI builds untrusted branches or forked pull requests, and
   what build-agent isolation applies. No CI configuration exists in this
   repository.
4. **R1** — whether a regression test pinning the `sendMail` call shape should be
   required as a precondition of acceptance.

## Release gate

This register is one of four outstanding gates. It does not affect and is not
affected by the clinical governance gate.

- Retained dependency risks R1–R5: **UNSIGNED — release blockers**
- **R6 public demo credential exposure: OPEN — live exposure on an
  internet-facing host. Remediation required; not authorised in this session.**
- Clinical governance GOV-01…GOV-04: **PENDING** independent clinical reviewers
  (`31-clinical-governance-handoff.md`)
- Authenticated browser QA: **PENDING** a signed-in human operator
  (`33-claude-clean-checkout-verification.md`)
- **Vercel production-branch configuration: UNVERIFIED.** The deployed hostname
  appears to track `codex/versioned-clinical-rule-studio`. If so, pushing that
  branch could auto-deploy the unreviewed Rule Studio work and bypass every gate
  above. Confirm before any push
  (`docs/deployed-comparison/01-deployment-identity.md`).
- Branch push / PR / merge: **PENDING** all gates above

`CG-NCSP-3.1.0` — DRAFT · Unpublished · Inactive · Live activations 0 · Legacy
engine authoritative · Canonical SHADOW / SIMULATION.

Provisional recommendation. Reviewer confirmation required. Not for direct
clinical action. Demo environment. Simulated export package.
