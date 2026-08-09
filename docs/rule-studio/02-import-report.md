# NCSP v2.1 canonical import report

Generated: 2026-08-02T09:12:36.464Z

This is an engineering import report for a proof-of-concept using synthetic or de-identified test data. It is not clinical validation, pilot approval, or production readiness.

## Result

- Action: UNCHANGED
- Product ruleset: CG-NCSP-3.0.0
- Clinical source package: v2.1
- Ruleset family ID: cmsbcysze0000nmv4z6p9lqcu
- Rule version ID: cmsbcyszx0001nmv4xnjs0wtp
- Status: DRAFT
- Revision: 3
- SHA-256 snapshot checksum: `f6d75166bc2ba78f97542f4c2997ba70ad615955219d8d99ab82e424f504ae52`
- Source JSON SHA-256: `ffd329502683b2ba9b308e9309e4c6cc970b3954ce1067bfdc5b82869ef886b1`

## Source verification

- Source directory: `/Users/nauman/Documents/Screening/docs/clinical-sources/source-v2.1/CerviGrade_NCSP_Master_Rulebook_Package_v2_1`
- Rule records: 203
- Unique rule IDs: 203
- Table 1 rules: 21
- QA closures: 18 (QA-01 through QA-18)
- Tree coverage rows resolved: 203
- Required package artifacts present: 8
- Supplied manifest: all 11 package entries independently SHA-256 verified before import
- Workbook cross-check: all 21 sheets rendered and visually inspected; no formula-error tokens or illegible layouts found
- Verified visual package: 2.1.1 (PASS)
- Verified visual files: 73 SHA-256 entries
- Verified visual directory: `/Users/nauman/Documents/Screening/docs/clinical-sources/source-v2.1/CerviGrade_Verified_Pathway_Views_v2_1_1`

The JSON was used as the machine-readable bootstrap. Markdown, CSV, spreadsheet, SVG, PNG, QA-closure, and coverage artifacts were secondary cross-checks. The package was found under the repository-equivalent path `docs/clinical-sources/source-v2.1/CerviGrade_NCSP_Master_Rulebook_Package_v2_1`; the importer resolves that path without relocating source evidence.

## Canonical projection

- Rules: 203
- Nodes: 422
- Edges: 421
- Views: 12
- Safety distribution: 36 CRITICAL, 103 HIGH, 49 MEDIUM, 15 LOW

Every master/pathway view references canonical rule, node, and edge identifiers in the same version snapshot. The ten pathway memberships and Graphviz-derived coordinates follow the verified v2.1.1 visual package; layout metadata contains no copied clinical logic.

`CG-NCSP-3.0.0` is the first national product-ruleset sequence in this repository. Product version `CG-NCSP-3.0.0`, clinical source package `v2.1`, and engine contract `canonical-graph-v1` remain separate metadata.

## Validation gate

- Pass: yes
- Errors: 0
- Warnings: 0
- Information: 1

All 139 HIGH/CRITICAL v2.1 rules now have governed typed Boolean AST conditions and registered executable conformance-test identifiers. Three lower-priority Figure 3 rules are also compiled to preserve the HPV-not-detected three-/five-year and age 70–74 discharge invariants. Expected outcomes come from the verified source package; no expectation was derived from PNG text or the legacy production engine.

The prior 278 publication blockers are reduced to zero. This software-conformance result does not constitute independent clinical approval. The version remains an unactivated draft; publication and activation still require the lifecycle's separate approval and governance controls.

Required runtime wording:

- Provisional recommendation
- Reviewer confirmation required
- Not for direct clinical action
- Demo environment
- Simulated export package

Source workbook cross-check: :codex-file-citation{path="/Users/nauman/Documents/Screening/docs/clinical-sources/source-v2.1/CerviGrade_NCSP_Master_Rulebook_Package_v2_1/CerviGrade_NCSP_Master_Rulebook_v2_1.xlsx" purpose="source" artifact_kind="workbook"}
