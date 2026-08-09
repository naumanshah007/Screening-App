# Verification and cutover gate

## Current result

`CG-NCSP-3.0.0` is an imported, structurally valid `DRAFT`. It contains 203 canonical rules, 422 nodes, 421 edges, and 12 synchronized views. Its checksum is `f6d75166bc2ba78f97542f4c2997ba70ad615955219d8d99ab82e424f504ae52` at revision 3.

It is intentionally not published or active. All 139 HIGH/CRITICAL v2.1 rules now have a governed typed expression and executable conformance-test identifiers; three lower-priority Figure 3 invariants are also compiled. The validator reports zero errors and zero warnings under that defined software gate. This removes the prior 278 mechanical blockers but does not constitute independent clinical approval or authorization to cut over.

## Required work before governed activation

1. Obtain independent clinical review and sign-off of every source-to-AST translation; software tests are not that approval.
2. Decide and document whether the remaining 61 MEDIUM/LOW source-text rules must be compiled before publication.
3. Reconcile the full source-derived 179-branch end-to-end suite, including UI, API, batch, persistence, Review Queue and export paths.
4. Run draft simulation against the golden suite, parent version, active version, and legacy engine; review every changed outcome, urgency, timing, reviewer boundary, missing-data route, and unreachable rule.
5. Record a change summary and clinical-source summary, obtain an independent approver, publish the immutable checksum, and activate only in an approved non-production scope.
6. Continue shadow comparison until the agreed software-conformance threshold is met. This threshold is an engineering gate, not clinical validation.

## Guarded invariants

Validation explicitly guards HPV 16/18 colposcopy routing, the age 70–74 HPV-detected exit branch, Test-of-Cure completion sequence, successful vault Test-of-Cure cessation, urgent malignant cytology/glandular cancer routes, and repeat-stage validity/adequacy overlays. It also checks all 203 rules, all 21 Table 1 combinations, master/pathway coverage, dangling/orphan/cycle rules, terminal outcomes, source/local governance, and clinician-only reviewer boundaries.

## Production logic

The legacy clinical result remains authoritative in the proof-of-concept. The new engine is integrated as `SHADOW` for wizard and batch flows and as `SIMULATION` in the studio. No production clinical logic, schema history, completed decision, or existing evaluation snapshot is rewritten by importing this draft.
