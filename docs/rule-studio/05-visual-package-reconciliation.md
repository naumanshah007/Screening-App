# Verified visual package v2.1.1 reconciliation

Generated 2026-08-02 for `CG-NCSP-3.0.0`. This is a visual-projection reconciliation, not clinical validation, publication approval, or production approval.

## Result

**PASS.** The clinical source remains the v2.1 canonical JSON with 203 unique rules. The later `CerviGrade_Verified_Pathway_Views_v2_1_1` package now controls the ten standalone pathway memberships, titles, descriptions, layout coordinates, legend labels, annotations, and master-to-pathway presentation metadata.

All 73 entries in `SHA256SUMS.txt` were independently hashed before use. `manifest.json`, `_meta.json`, each `*_rule_ids.json`, each Graphviz JSON projection, and `QA_VERIFICATION.json` were parsed and cross-checked. The package reports `PASS`, 203 mapped unique rule IDs, no unmapped or unknown rule IDs, ten verified pathway views, and all 21 Table 1 rules.

No condition, required clinical outcome, missing-data behaviour, source reference, canonical rule ID, canonical node ID, or canonical edge ID was changed by this phase. The graph remains 203 rules, 422 nodes, 421 edges, and 12 synchronized views.

## Precedence applied

1. Clinical conditions, outcomes, missing-data behaviour, safety boundaries and source references: `CerviGrade_NCSP_Master_Rules_v2_1.json`.
2. Standalone-view membership, presentation title/description, Graphviz-derived coordinates, legends, annotations and visual alignment: verified package v2.1.1.
3. PNG and SVG files were inspected as presentation evidence only; no executable condition was inferred from them.

The Graphviz node coordinates are projected into the existing canonical React Flow node IDs. View-only navigation, legends and annotations remain presentation metadata and do not become a second clinical-rule source.

## View reconciliation

| Canonical view | v2.1.1 source view | Prior rules | Verified rules | Membership change |
|---|---|---:|---:|---|
| `global-router-safety` | `01_global_router_safety` | 20 | 28 | Added `DES-01`–`DES-04`, `U25-01`–`U25-03`, `IMM-01` |
| `transition-hpv-primary` | `02_transition_to_hpv` | 13 | 13 | Unchanged |
| `primary-hpv-screening` | `03_primary_hpv_screening` | 36 | 23 | Added `IMM-01`; moved `A26-01`–`A26-14` to their corrected owning pathway views |
| `low-grade-post-colposcopy` | `04_normal_colposcopy_low_grade` | 16 | 18 | Added `A26-01`, `IMM-01` |
| `high-grade-post-colposcopy` | `05_normal_colposcopy_high_grade` | 12 | 18 | Added `A26-02`–`A26-05`, `A26-13`, `A26-14` |
| `hsil-treatment-test-of-cure` | `06_hsil_treatment_test_of_cure` | 16 | 17 | Added `A26-06` |
| `glandular-ais` | `07_glandular_abnormalities_ais` | 18 | 19 | Added `A26-07` |
| `hysterectomy-vaginal-vault` | `08_hysterectomy_vaginal_vault` | 35 | 40 | Added `A26-08`–`A26-12`; retained `T1-01`–`T1-21` |
| `pregnancy` | `09_pregnancy` | 14 | 14 | Unchanged |
| `bleeding-safety-overrides` | `10_abnormal_bleeding` | 15 | 15 | Unchanged |

The `special-populations-overlays` canonical overlay remains the twelfth application view. It has no separate standalone file in v2.1.1; every one of its rules is nevertheless represented by an explicit verified pathway membership and in the master view.

## Label, layout and annotation changes

- All ten titles and descriptions now come from the v2.1.1 manifest.
- Each verified standalone view carries its package version, source view ID, verification status, source-file list and coordinate provenance.
- Graphviz v2.1.1 positions are deterministically projected into React Flow coordinates while preserving the canonical `node:rule:*` and `node:outcome:*` IDs.
- The master coordinates are composed from the same verified pathway projections so the small-tree and master placements remain traceably aligned.
- Legend labels now explicitly distinguish routers, decisions, safety stops, clinician/MDM boundaries, endpoints/subflows, urgent routes, repeat timers and current overlay guidance.
- Figure 8 records the supplementary `08b_table1_21_cell_matrix` DOT/SVG/PNG as its readable 21-cell Table 1 presentation.
- The eight package-recorded visual patches are retained as master-view annotations, including repeat-negative intervals, Figure 4 Type 3 TZ sidecars, Figure 5/6 subflows, the Figure 8/Figure 10 cross-link and the pregnancy high-/low-risk split.

## Structural and visual checks

- 203/203 rules retained and mapped.
- 21/21 Table 1 rules retained.
- Zero unknown or unmatched rule IDs.
- Zero dangling canonical node or edge references.
- Every rule is in the master view and at least one verified pathway projection.
- All ten smaller views use the verified package memberships and coordinate evidence.
- Contact sheet, all ten standalone PNGs, master SVG/PNG and the separate Table 1 matrix are readable at source resolution.
- No clinical inconsistency was introduced or detected by the reconciliation.

## Current safety state

`CG-NCSP-3.0.0` remains a draft and is not published or active. At completion of Phase A its rule-compilation blockers are intentionally unchanged: 139 HIGH/CRITICAL source-text conditions and 139 missing executable conformance-test identifiers.
