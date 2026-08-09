# Feature retention matrix — integration onto `origin/main` @ `fb933c3`

Date: 4 August 2026. Branch: `integration/rule-studio-on-latest-main`.

Every production-only feature identified in
`docs/deployed-comparison/08-feature-workflow-comparison.md` is classified below.
**No feature is left `UNVERIFIED`.**

## Production-only features (13) — all RETAINED

Verified by confirming the integrated tree's file is identical to `origin/main`
(`git diff --quiet origin/main -- <path>`), except the admin page shell which was
resolved by hand and separately verified symbol-by-symbol.

| # | Feature | Source commit | Evidence | Status |
|---:|---|---|---|---|
| 1 | Onboarding | `fb933c3` | admin page shell symbols verified present | **RETAINED** |
| 2 | NCSR certification management | `fb933c3` | `NcsrCertificationManager` + `getNcsrCertificationSummary` present | **RETAINED** |
| 3 | Integration validation manager | `fb933c3` | `IntegrationValidationManager` + `getIntegrationValidationStateMap` present | **RETAINED** |
| 4 | Security incident automation | `fb933c3` | `SecurityIncidentAutomationCard` present | **RETAINED** |
| 5 | Admin list-and-detail pattern | `f6e2f89` | `UserAccessManager`, `SecurityIncidentManager`, `ManagerShell` untouched | **RETAINED** |
| 6 | Admin tabbed navigation | `2715baa` | main's `tabs`/`activeTab` derivation kept verbatim; union widened only | **RETAINED** |
| 7 | NCSR governance in Integrations tab | `b4bff62` | integrations tab body unchanged | **RETAINED** |
| 8 | Clickable figure links | `c9f4a25` | `components/clinical/FigureLink.tsx` identical to main | **RETAINED** |
| 9 | Batch stat-card drill-down | `c9f4a25` | `BatchResultDetail.tsx` auto-merged, reviewed | **RETAINED** |
| 10 | Batch pathway diagram | `c9f4a25` | as above | **RETAINED** |
| 11 | Guideline diagram node-overlap fix (10 diagrams) | `11e0def` | `lib/decision-trees/index.ts` identical to main | **RETAINED** |
| 12 | **Guideline-figure overlay engine + rule catalog** | `8bea36e` | `lib/engine/overlay.ts`, `rule-catalog.ts` **identical to `origin/main`** | **RETAINED** |
| 13 | Booking-rule side-by-side form editor | `aeb77c1` | `components/rules/RuleCardEditor.tsx` identical to main | **RETAINED** |

### The safety-critical retention

| Item | Status |
|---|---|
| **R1 age-gate fix (`ea4e7e3`)** | **RETAINED** |

`lib/engine/decision-engine.ts`, `overlay.ts`, `rule-catalog.ts` and `types.ts`
are **byte-identical to `origin/main`** in the integrated tree. All three R1
recommendation codes are present (`AGE-70-74-HPV-DETECTED-COLP`,
`AGE-70-74-HPV-NOT-DETECTED-DISCHARGE`, `AGE-70-74-HPV-REQUIRED`), and main's 13
age-eligibility golden tests plus the overlay tests are present and passing.

**Router probe result: 0/12 differ from production, down from 9/12 on the
standalone candidate.** The regression is closed.

## Candidate features added

| Feature | Classification |
|---|---|
| Rule Studio workspace (`/rules/clinical`, `/rules/clinical/[id]`) | `CANDIDATE_ONLY` |
| 17 clinical-rule lifecycle API routes | `CANDIDATE_ADDS_GOVERNANCE` |
| Governance review workspace | `CANDIDATE_ADDS_GOVERNANCE` |
| Immutable evaluated snapshots (7 DB triggers) | `CANDIDATE_ADDS_PROVENANCE` |
| Version + checksum provenance | `CANDIDATE_ADDS_PROVENANCE` |
| Governed regrade provenance | `CANDIDATE_ADDS_PROVENANCE` |
| SHADOW/SIMULATION shadow comparison | `CANDIDATE_ADDS_SAFETY` |
| Canonical facts V2 capture | `CANDIDATE_ADDS_SAFETY` |
| Rule graph administration surfaces | `CANDIDATE_ONLY` |
| **Clinical Rules admin tab** | `CANDIDATE_ONLY` — added alongside main's tabs, replacing none |

## Intentionally replaced

| Item | Detail | Classification |
|---|---|---|
| "Active Rules" admin stat source | `clinicalRuleSet.isActive` → `clinicalRuleVersion.status = ACTIVE`. Forced, not optional: the Rule Studio schema removes `isActive` from that model. Semantically faithful; currently reads 0 because nothing is activated. | `INTENTIONALLY_REPLACED` |

## Requires manual integration

None.

## Regressions

**None.** The single `CANDIDATE_REGRESSION` from the comparison (the R1 age-gate
staleness) is resolved by this integration and verified by probe.

## Verification commands

```
git diff --quiet origin/main -- lib/engine/decision-engine.ts   # identical
git diff --quiet origin/main -- lib/engine/overlay.ts           # identical
git diff --quiet origin/main -- lib/engine/rule-catalog.ts      # identical
git diff --quiet origin/main -- lib/engine/types.ts             # identical
npm run test:router                                             # 14 pass, 0 fail, 3 todo
npx tsx scripts/comparison/emit-router.ts                       # 0/12 differ from production
```

## Not verified here

| Item | Status | Reason |
|---|---|---|
| NCSR / PAS / FHIR / HL7 live behaviour | `INTEGRATION_REQUIRED` | No external system was contacted; not resolvable locally |
| Authenticated browser QA | **PENDING** | See `04-clean-checkout-verification.md` §Phase 11 |
