# Feature and workflow comparison — production `fb933c3` vs candidate `8eed086`

Date: 4 August 2026. Machine-readable companion: `08-feature-workflow-comparison.csv`.

This phase matters because the candidate branch was created from an **older
`main`** (`578b4b0`, 20 June) and is missing **11 commits** of later production
work, including the Admin UX programme the deployed build is named after.

## Route surface

| Metric | Value |
|---|---:|
| Production routes (`page.tsx` + `route.ts`) | **91** |
| Candidate routes | **110** |
| **Production-only routes** | **0** |
| **Candidate-only routes** | **19** |

The candidate route surface is a strict **superset**. The 11 missing `main`
commits changed *existing components*; they added no new routes. So the divergence
is invisible at route level and only appears at component and engine level — which
is precisely why a route-diff alone would have missed the safety regression.

### The 19 candidate-only routes

`(app)/rules/clinical`, `(app)/rules/clinical/[id]`, and 17 API routes under
`api/clinical-rules/*` (versions, publish, approve, activate, retire, rollback,
archive, audit, diff, export, validate, governance-review, active, evaluate) plus
`api/batch/review/[id]/canonical-facts` and
`api/batch/runs/[id]/clinical-regrade`.

This is the first executable confirmation that the deployed build has no Rule
Studio surface — previously only inferred from the Git timeline.

## Classification summary

| Classification | Count |
|---|---:|
| `PRESENT_IN_BOTH_SAME` | 12 |
| `PRESENT_IN_BOTH_CHANGED` | 7 |
| **`PRODUCTION_ONLY`** | **13** |
| `CANDIDATE_ONLY` | 3 |
| `CANDIDATE_ADDS_GOVERNANCE` | 2 |
| `CANDIDATE_ADDS_PROVENANCE` | 3 |
| `CANDIDATE_ADDS_SAFETY` | 2 |
| **`CANDIDATE_REGRESSION`** | **1** |
| `INTEGRATION_REQUIRED` | 1 |
| `UNVERIFIED` | 1 |

## Production-only functionality the candidate is missing

All thirteen come from the 11 unmerged `main` commits:

| Feature | Source commit |
|---|---|
| Onboarding | `fb933c3` |
| NCSR certification management (phase 2+3) | `fb933c3` |
| Integration validation manager (phase 2+3) | `fb933c3` |
| Security incident automation card | `fb933c3` |
| Admin list-and-detail pattern | `f6e2f89` |
| Admin tabbed navigation | `2715baa` |
| NCSR governance in Integrations tab | `b4bff62` |
| Clickable figure links | `c9f4a25` |
| Batch stat-card drill-down | `c9f4a25` |
| Batch pathway diagram | `c9f4a25` |
| Guideline diagram node-overlap fix (all 10) | `11e0def` |
| Guideline-figure overlay engine + rule catalog | `8bea36e` |
| Booking-rule side-by-side form editor | `aeb77c1` |

## The one candidate regression

**R1 age-gate safety fix (`ea4e7e3`) is absent from the candidate.** Nine of
twelve router-level probes differ and every difference is less safe. Full detail
and the probe table: `07-special-set-matrices.md` §7.

This is fork-point staleness — **the candidate modified no file under
`lib/engine/`** — so integration onto current `main` resolves it automatically.
It is classified `CANDIDATE_REGRESSION` rather than a stale-branch note because
the branch *as it stands today* would regress patient safety if built and served.

## Candidate-only functionality

- **Governance**: full clinical rule version lifecycle API (publish, approve,
  activate, retire, rollback, archive, validate, governance review, audit, diff,
  export) and the Rule Studio workspace.
- **Provenance**: version + checksum on every evaluation, immutable evaluated
  snapshots enforced by three database triggers, governed regrade provenance.
- **Safety**: SHADOW/SIMULATION evaluation mode with legacy retained as
  authoritative, and `CanonicalClinicalFactsV2` capture that closes 16 of the 18
  deployed input-contract gaps.

## Integration-required and unverified

- **NCSR / PAS / FHIR / HL7 live behaviour** — `INTEGRATION_REQUIRED`. Neither
  worktree contacted an external system; this cannot be settled locally.
- **Authenticated deployed behaviour** — `UNVERIFIED`. `DEPLOYED_EXECUTION_BLOCKED`
  still stands; no sign-in was attempted and the R6 demo credentials were not
  used.
