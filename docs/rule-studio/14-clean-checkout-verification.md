# Clean-checkout verification

Date: 2 August 2026

Verification input commit: `55a45d6` plus the two verification corrections committed with this report.

## Result

PASS. A detached checkout reproduced the versioned Rule Studio from committed history when supplied with the external v2.1 source package. Dependencies installed from the lockfile, all migrations applied to a new SQLite database, the generated Prisma client matched the migrated schema, import was idempotent, all 1,198 committed tests passed, the production build completed, and authenticated browser QA passed.

`CG-NCSP-3.0.0` remained `DRAFT`. It was not published or activated. The legacy engine remains the displayed clinical authority; canonical execution remains limited to `SHADOW` and `SIMULATION`.

This is software-conformance evidence only. It is not clinical validation, pilot readiness, production approval, or medical-device certification.

## Reproduction environment

- Detached worktree: `/tmp/cervigrade-clean-55a45d6`
- Starting commit: `55a45d6`
- External source evidence copied into the detached checkout only: `docs/clinical-sources/source-v2.1/`
- Package manager operation: `npm ci`
- Installed packages: 737
- Prisma / client: 7.5.0
- Node used by the repository commands: 25.1.0
- Fresh verification database: an isolated SQLite file outside the repository
- No database, source package, generated client, dependency directory, build output, or browser state was committed

`npm ci` reported the existing dependency-tree notices: a Nodemailer peer override, an engine warning for `@prisma/studio-core` under Node 25, several deprecated transitive packages, and 30 audit findings (2 low, 7 moderate, 19 high, 2 critical). Dependency remediation was outside this Rule Studio clinical-parity task and was not attempted automatically.

Prisma 7 emitted a generic schema-engine error when `migrate deploy` was pointed at a nonexistent SQLite file. Explicitly creating an empty isolated SQLite target first resolved it; all migrations then applied normally. This is recorded as an environment/bootstrap prerequisite, not hidden as a pass.

## Migration and schema verification

The first clean schema-diff run exposed an older Rule Studio migration hunk that accidentally copied uncommitted triage/reprocessing columns into `BatchReviewItem`. On an empty table SQLite permitted the copy, leaving the migrated schema wider than the committed Prisma model. The migration was corrected to preserve only committed batch fields plus `ruleEvaluationId`; its unrelated NHI index was also removed.

The final fresh-database result:

```text
Migrations discovered: 6
Migrations applied:    6
Migration status:      Database schema is up to date
Migrated DB -> Prisma: No difference detected
current-schema.sql -> Prisma: No difference detected
Prisma client generate: PASS
```

The corrected migration copy list uses only columns present in the pre-Rule-Studio batch migration, so it is safe for populated pre-existing `BatchReviewItem` rows. No local SQLite file is tracked.

## Source import and idempotency

The importer independently verified the supplied package, including its manifest and verified v2.1.1 view package.

| Measure | Result |
|---|---:|
| First import | `CREATED` |
| Second import | `UNCHANGED` |
| Product version | `CG-NCSP-3.0.0` |
| Status after both imports | `DRAFT` |
| Rule records | 203 |
| Unique rule IDs | 203 |
| Table 1 rules | 21 |
| QA closures | 18 |
| Tree coverage rows | 203 |
| Graph nodes | 422 |
| Graph edges | 421 |
| Synchronized views | 12 |
| Validation errors | 0 |
| Validation warnings | 0 |
| Snapshot checksum | `2997a909b98f9d8960cc3697cf125d5b0e106d4f0be9a0ee789404e54486a96b` |
| Source JSON SHA-256 | `ffd329502683b2ba9b308e9309e4c6cc970b3954ce1067bfdc5b82869ef886b1` |

### Existing local draft boundary

The repository's pre-existing local demo database is intentionally different from the fresh-checkout database. It contains `CG-NCSP-3.0.0` revision 3 with checksum prefix `f6d75166bc2ba78f`, one prior evaluation, and three audit events. A source re-import of the new `2997a909…` snapshot was attempted after clean verification and was rejected before mutation by the governed importer:

```text
CG-NCSP-3.0.0 already exists with different content. Create a new semantic
version; never overwrite an edited, evaluated, or published version identity.
```

That is the expected safety behavior. The existing local draft and its evaluation were not deleted or rewritten, and its activation count remains zero. Moving that particular developer database to the newly compiled snapshot requires a separately governed semantic-version clone; it must not be achieved by bypassing the identity guard. This does not affect clean-checkout reproducibility, but it is an explicit existing-data upgrade boundary.

## Quality gates

| Command | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS with 0 errors and 19 existing warnings |
| `npm run test:all` | PASS: 104 engine + 204 batch + 890 Rule Studio = 1,198 |
| `npm run test:rules` | PASS: 890/890 in the explicitly repeated Rule Studio run |
| `npm run build` | PASS |
| `npx prisma migrate status` | PASS: database up to date |

The build emitted one existing Turbopack file-tracing warning for dynamic document storage resolution and worker `--localstorage-file` warnings. Compilation, TypeScript, page-data collection, and all 50 static-page generations completed.

One test-isolation defect was found and corrected during the first full run. The unknown-immune precedence test omitted `sampleType`, so the newly enforced missing-sample gate correctly won before the immune gate. Supplying `LBC` isolates the intended immune-status invariant without changing expected clinical behavior or production code. The corrected precedence file passes 7/7 and the complete suite passes.

## Browser QA

Authenticated browser QA used the clean production build and the isolated database seeded with synthetic demo data. The in-app browser was used because the request required rendered and interactive verification.

Verified:

- Version list: one `CG-NCSP-3.0.0` entry, `DRAFT`, validation passed, 203 rules, 422 nodes, 12 views, full checksum, and `Not active`.
- Master tree: rendered as an interactive clinical graph with 203 rules, 422 nodes, minimap, search, inspector, layout controls, and source/safety legend.
- All synchronized projections: master plus Global Router/Safety, transition, primary HPV, low-grade colposcopy, high-grade colposcopy, HSIL/Test of Cure, glandular/AIS, hysterectomy/vault, pregnancy, abnormal bleeding, and special-population/immune overlays. Every view rendered with its expected accessible graph title.
- Draft editing: the node inspector exposed enabled node type, label, short-label, explanatory-text, duplicate, delete-unused, and checkpoint controls. A display label accepted a temporary edit and was restored to its original value. The draft revision advanced from 1 to 3 while the checksum returned to the original value; no clinical condition or outcome changed.
- Validation: 0 errors, 0 warnings, 203 rules, 12 views, with the software-validation-only disclaimer visible.
- Simulation safety stop: incomplete synthetic facts returned clinician review rather than a confident outcome.
- Matched simulation: a complete Figure 3 HPV-not-detected/immune-competent input matched `F3-01`, returned the provisional five-year recommendation, and displayed `CG-NCSP-3.0.0`, the full checksum, reviewer confirmation, evaluation ID, and simulated-export boundary.
- Persisted simulation provenance: two `SIMULATION` evaluations were stored in the isolated database.
- Browser console: no warnings or errors during the authenticated Rule Studio session.
- Activation boundary: no publish or activation control was used.

Before authentication, Auth.js rejected a stale localhost cookie encrypted with a different prior test secret. Signing in to the isolated seeded account replaced that discarded session. This did not recur in the authenticated QA session and the browser console remained clean.

## Final safety-state query

```text
displayVersion:         CG-NCSP-3.0.0
status:                 DRAFT
publishedAt:            null
activatedAt:            null
live activation count:  0
canonical evaluations:  2 SIMULATION
legacy authority:       retained
```

No activation row was created. The clean verification database and detached worktree are temporary evidence artifacts and are removed after the report is committed.
