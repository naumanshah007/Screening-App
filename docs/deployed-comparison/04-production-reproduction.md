# Production baseline reproduction — `REPRODUCED_DEPLOYED_BUILD`

Date: 4 August 2026. Baseline: **`main` @ `fb933c3`** (verified active Production).

## Result

# `PRODUCTION_REPRODUCTION_SUCCEEDED`

The active Production commit builds, typechecks, lints and passes its own full
test suite in a clean isolated worktree with an isolated database. No production
data, no production environment variables, no external integrations.

## Isolation

| Property | Value |
|---|---|
| Worktree | `/tmp/cervigrade-production-fb933c3-20260804184326` (detached at `fb933c3`) |
| Database | `file:./isolated-test.db` — new, empty, created by migration |
| Environment | Locally generated throwaway values only. **No production env var was read, copied or used.** |
| Network / integrations | None. No SMTP, no PAS, no FHIR/HL7, no webhooks, no deployed host contact |
| Primary working tree | Untouched — the dirty repo was never used for testing |

The worktree reported `git status --porcelain` = 0 lines after checkout, so the
reproduction ran against exactly the committed state of `fb933c3`.

## Toolchain

| Item | Value | Note |
|---|---|---|
| Node (local) | **v25.1.0** | Vercel project is pinned to **24.x** |
| npm | 11.6.2 | |
| Install | `npm ci` from the commit's own `package-lock.json`, exit 0 | |
| Dependencies | 31 runtime, 12 dev | candidate has 34 runtime (+3) |
| Prisma | 7.5.0 client generated from the commit's own schema | |

**Compatibility note.** The reproduction ran on Node 25 while production builds on
Node 24. Everything passed, so no incompatibility was encountered, but the
toolchain is not byte-identical to the Vercel build environment. Nothing in the
results below depends on a Node-version-specific behaviour.

## Database and schema

| Item | Production `fb933c3` | Candidate `8eed086` |
|---|---:|---:|
| Migrations | **5** | **7** |
| `prisma validate` | valid | valid |
| `prisma migrate status` | up to date | up to date |

Production migrations: `20260227030429_init`, `20260227141535_add_wizard_session`,
`20260321053806_add_ai_recommendation`, `20260619055910_add_batch_run_review`,
`20260619061652_batch_item_identity`.

The candidate adds `20260802090000_versioned_clinical_rule_studio` and
`20260803143000_clinical_evidence_immutability`. **Main added no migrations since
the fork point**, so there is no migration-ordering conflict.

## Validation results — production `fb933c3`

| Check | Result |
|---|---|
| `npm run typecheck` | **PASS** — no errors |
| `npm run lint` | **PASS** — 19 problems, **0 errors**, 19 warnings (unused vars) |
| `npm run test:engine` | **PASS — 130/130** |
| `npm run test:batch` | **PASS — 203/203** |
| `npm run test:rules` | **script does not exist at this commit** (the Rule Studio suite is candidate-only) |
| `npm run build` | **PASS** — Next.js production build completed |
| `npx prisma validate` | **PASS** |
| `npx prisma migrate status` | **PASS** — schema up to date |

Total executable production tests: **333, all passing**.

## Engine implementation at `fb933c3`

| Item | Value |
|---|---|
| Entry point | `lib/engine/decision-engine.ts` → `evaluateClinicalDecision(input, overlay?)` |
| Figure evaluators | `evaluateFigure1…10`, `evaluateTable1` (11 exported) |
| Overlay layer | **`lib/engine/overlay.ts` present** — `applyGuidelineOverlay` wraps the base result |
| Rule catalog | **`lib/engine/rule-catalog.ts` present** |
| Input/decision types | `lib/engine/types.ts` — **byte-identical to the candidate** |
| Ruleset versioning | **None.** No `CG-NCSP` version, no checksum, no snapshot, no SHADOW/SIMULATION concept |
| Authority model | Legacy engine is the only engine; it is directly authoritative |

The identical `types.ts` is what makes a fair comparison possible: both systems
consume the same `ClinicalInput` and emit the same `ClinicalDecision` shape, so
differences are behavioural rather than structural.

## Recommendation codes and supported inputs

`fb933c3` emits recommendation codes in the legacy string form (`F3-1618-COLP`,
`AGE-70-74-HPV-DETECTED-COLP`, `T1-…`, `F8-…`). It has no provisional/confirmed
distinction, no reviewer-requirement field, no `clinicianOnly` flag, no matched
rule IDs, no source references and no evaluation trace.

Of the 179 independent source cases, `fb933c3` can express **161**; **18** are
`DEPLOYED_INPUT_CONTRACT_GAP` — states its `ClinicalInput` cannot encode at all
(CIN2 active surveillance, margin status, AIS margin follow-up, stage 1A1 cancer
overlays, and the four Figure 10 bleeding-persistence states). See
`06-three-way-comparison.md`.

## Feature surface (routes built)

The production build emits the app-router surface including `/admin`, `/batch`,
`/cases`, `/coordinator`, `/dashboard`, `/decisions`, `/gp`, `/guidelines`,
`/login`, `/pathway`, `/patients`, `/readiness`, `/review`, `/rules`,
`/rules/[id]`.

It does **not** contain `/rules/clinical` or `/rules/clinical/[id]` — the Rule
Studio surfaces. Those exist only in the candidate build. This is the first
directly observed, executable confirmation of what the unauthenticated
reconnaissance could only infer.

## Authentication and role model

Auth.js / NextAuth v5 with the role set defined in `prisma/schema.prisma`
(`GP`, `COORDINATOR`, `ADMIN`, `COLPOSCOPIST`, `GYNAE_GRADER`, `COLPO_CNS`,
`SMO_REVIEWER`, `INTEGRATION_ADMIN`). Unchanged between the two commits.

## External-integration side effects disabled for local testing

| Integration | Handling |
|---|---|
| SMTP / recall notifications | Not configured in the isolated env; no send path was exercised |
| PAS / NCSR / FHIR / HL7 | Not configured; no external call was made |
| Vercel cron `/api/admin/security-incidents/run` | Not invoked |
| Deployed host `screening.privexa.co` | **Not contacted at any point** |

## What was NOT done

- No candidate code was retrofitted into the production reproduction. The only
  files added to the production worktree were the **shared measuring instrument**
  (`guideline-oracle.ts`, `conformance-runner.ts`) and the emitter scripts. No
  engine, schema, route or library file was modified.
- No production test was weakened, skipped or edited to make it conform to
  candidate expectations.
- No production database, environment or deployment was read or written.
