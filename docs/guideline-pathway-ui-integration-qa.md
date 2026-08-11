# Current Guidelines premium tree — integration onto production main

Integration branch: `feat/current-guidelines-premium-tree-integration`
Base: `origin/main` @ **15edc93** — verified as the live Production commit.

## Production truth (verified, not assumed)

| Item | Value | How verified |
|---|---|---|
| origin/main | `15edc937c609bde0e14780122842881ba30b447f` | `git fetch` + `git rev-parse` |
| Production SHA | `15edc93` | GitHub deployments API, `environment=Production`, newest record |
| Serving branch | `main` | same |
| screening.privexa.co | `dpl_CkoMwZ522Bz8ejF9AqQxgyjyW7PU` | `vercel inspect` alias list |
| Baseline test total | **1452 pass / 0 fail** | `npm run test:all` on clean `15edc93` |

The previously reported base `8957fcc` was **72 commits behind** origin/main and was never
Production. It was not used as the integration base and its worktree was not modified.

## Governed dataset (re-verified on current data)

Loaded from the committed, checksum-verified artefact
`lib/clinical-rules/governed-snapshots/cg-ncsp-3.1.0.json` — not a runtime rebuild.

| Metric | Value |
|---|---|
| Ruleset | CG-NCSP-3.1.0 |
| Rules | **203** |
| Nodes | **422** |
| Edges | **421** |
| Views | **12** |
| Table 1 combinations | **21** (out-degree of `node:section:table-1`) |
| Snapshot checksum | `3ab8657a13e73bb0080f18399d9165c20e9af5796bdcf594bdc71170309c824a` |

Counts are asserted by test, not hard-coded in application code.

## What was reconciled, not copied

Main is substantially newer than the approved development branch. These decisions preserve
the newer production features:

| Development-branch artefact | Outcome on main | Why |
|---|---|---|
| `lib/clinical-rules/current-guidelines.ts` (bespoke authority + prisma resolution) | **Dropped** | Main has `authority.ts` / `authority-display.ts` with environment gates, no caching, fail-safe to LEGACY. Superior and already governed. |
| `app/(app)/guidelines/AuthorityChip.tsx` | **Dropped** | Main has `ClinicalAuthorityBadge`, which only reads canonical in a live evaluation mode. |
| `GuidelinesUnavailable.tsx` | **Dropped** | Snapshot is a committed artefact, always available. |
| Runtime snapshot build (`buildSuccessorSnapshotFromV21Package`) | **Replaced** with `loadGovernedSnapshot` | Main made the external source package optional; tests must pass on a clean checkout. |
| Legacy/canonical Guidelines tabs | **Restructured** | Clinicians see one system; the legacy router moved to `/guidelines/technical-router` as technical provenance. |
| `tests/ui/authority-wiring.test.ts` Guidelines assertions | **Rewritten, not deleted** | Same guarantees, checked where they now live; force-dynamic list extended to the two new authority-reporting pages. |

Preserved untouched: activation centre, authority layer, pinning, monitoring, governance
review, R6 demo-seed gating, router, evaluator, governed snapshots, prisma schema.

## Prohibited-zone check

No file changed under `lib/clinical-rules/{authority,activation-governance,evaluator,lifecycle,pinning,graded-decision,monitoring,governed-snapshots,schema,importer,source-package,successor}`, `lib/engine/`, `prisma/`, `lib/features.ts`, or `app/api/clinical-rules/`.

## Visual QA — all 12 governed pathways

Inspected in the running integrated app at 1440×900, signed in as an admin.

| # | Pathway | Nodes | Structure | Overlaps | Clipped | Result |
|---|---|---|---|---|---|---|
| 0 | NCSP Master Decision Tree | 422 (16 shown collapsed) | `[1,15]` sections in governed order | 0 | 0 | **PASS** |
| 1 | Global Router and Safety Gates | 60 | `[1,3,28,28]` | 0 | 0 | **PASS** |
| 2 | Transition to HPV Primary Screening | 29 | `[1,2,13,13]` | 0 | 0 | **PASS** |
| 3 | Primary HPV Screening | 49 | `[1,2,23,23]` | 0 | 0 | **PASS** |
| 4 | Normal Colposcopy after Low-Grade Cytology | 40 | `[1,3,18,18]` | 0 | 0 | **PASS** |
| 5 | Normal Colposcopy after High-Grade Cytology | 39 | `[1,2,18,18]` | 0 | 0 | **PASS** |
| 6 | HSIL Treatment and Test of Cure | 37 | `[1,2,17,17]` | 0 | 0 | **PASS** |
| 7 | Glandular Abnormalities and AIS | 41 | `[1,2,19,19]` | 0 | 0 | **PASS** |
| 8 | Total Hysterectomy and Vaginal Vault Follow-Up | 84 | `[1,3,40,40]`, zoom 0.958, 0 canvas overflow | 0 | 0 | **PASS** |
| 9 | Pregnancy Pathway | 30 | `[1,1,14,14]` | 0 | 0 | **PASS** |
| 10 | Abnormal Vaginal Bleeding | 32 | `[1,1,15,15]` | 0 | 0 | **PASS** |
| 11 | Special Populations and Immune-Deficiency Overlays | 48 | `[1,3,22,22]` | 0 | 0 | **PASS** |

No page-level horizontal overflow on any pathway. Governed order confirmed
(Figure 1 … Figure 10, `F3-01 … F3-22`, `T1-01 …`), asserted by test.

Table 1 rows render as facet lines (`Prior history: … / Indication: … / Specimen: …`) so the
discriminating clause stays visible — verified on screen for T1-01…T1-06.

### Not verified locally

The Rule Studio graph tab could not be exercised on the local QA database: the gated demo
seed does not create a `ClinicalRuleVersion` row, so `/rules/clinical` lists no version.
Its wiring is covered by the `Guidelines renders governed pathways through the shared
renderer` contract test, typecheck and build. It needs a look on the Preview, which has its
own database.

## Clinical findings — re-verified on current data

1. **Multi-outcome rules: still exactly 8** — `F3-05(3)`, `F3-10(3)`, `F3-19(2)`, `F4-04(3)`,
   `F4-07(2)`, `F7-02(2)`, `F10-06(2)`, `A26-08(3)`. The governed graph still stores one
   outcome node per rule. Handled by disclosure only: an "N branches" badge on the decision
   card and every governed branch listed in the detail drawer. No governed node added or
   removed.

2. **Edge labels: no derivable yes/no semantics.** 219 distinct edge labels, of which
   `"Source condition met"` appears **203 times** (every `rule → outcome` edge);
   `section → rule` edges carry the rule id and `root → section` edges the section title.
   There is no explicit governed field encoding a branch condition, so no labels were
   invented and neutral presentation was kept. The governed label is retained on the edge
   and surfaced on the highlighted path and in the drawer.

3. **Legacy session-result trace modernised, semantics untouched.**
   `/pathway/[sessionId]/result` keeps `FlowDiagram` and legacy recommendation codes, because
   legacy codes (`F1-NEG-5Y`, …) have no proven mapping to governed rule ids (`F3-01`, …) and
   inventing one would fabricate clinical equivalence. The shell, typography and chrome now
   match the governed viewer and it is labelled **"Legacy routing · decision trace"**, with a
   footer stating the trace is not rendered from the governed ruleset and a link to the
   current guidelines.

## Security

- The legacy weak demo password appears nowhere in this change. Repository-wide the literal
  occurs only in `tests/security/demo-seed-gating.test.ts` (which asserts it is **rejected**)
  and in a runbook doc — see the open item below.
- The local QA credential created during the previous run was neutralised: replaced with a
  discarded random secret and `passwordChangeRequired = 1`.
- The local QA database for this run was created through the **gated** path
  (`BOOTSTRAP_DEMO_DB=1` + a 32-character operator-supplied `DEMO_SEED_PASSWORD`), is
  gitignored, and its `.env` is not committed.
- `npm run test:security` — 16/16 pass, including "no hard-coded seed password remains" and
  "login source contains no password-shaped literal".
- No Production or Preview credential was changed. No historically exposed credential was
  tested.

**Open item (pre-existing, not introduced here):** `docs/deployment-and-pilot-runbook.md`
still advertises the old weak demo password, which the R6 gating now rejects. Worth a separate doc fix.

## Authority

Authority is resolved at request time by `getClinicalAuthorityDisplay()`. At the time of QA
it reports **LEGACY**, and the UI states plainly that case recommendations are still produced
by the existing grading engine. Nothing in this change activates canonical, alters an
activation record, changes a Production flag, or edits a clinical rule or the router.

## Gates

| Gate | Result |
|---|---|
| `npm run typecheck` | pass |
| `npm run lint -- --max-warnings=100` | 0 errors, 20 warnings — all pre-existing, none in new code |
| `npm run test:all` | **1482 pass / 0 fail / 0 todo** (baseline 1452, +28 pathway tests, +2 UI contract tests) |
| `npm run build` | pass — all five guideline routes built |
| `git diff --check` | clean |

Per-suite: engine 155 · batch 216 · rules 1016 · router 20 · security 16 · conformance 6 ·
db 31 · ui 22.
