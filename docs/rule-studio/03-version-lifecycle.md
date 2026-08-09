# Version lifecycle and operating model

This document describes the software governance controls for the CerviGrade proof-of-concept. It is not clinical validation, pilot approval, or production readiness.

## Canonical ownership

Each `ClinicalRuleVersion` contains one checksum-protected snapshot of rules, nodes, edges, source provenance, view membership, and per-view layout coordinates. The master tree, 10 principal pathways, special-populations overlay, evaluator, rule table, diff, and exports read that snapshot. A pathway view cannot own or copy a condition or outcome.

National NCSP logic and existing local booking-rule releases remain separate. A node classified as `LOCAL_CLINICAL_FORK` must retain its base source, show `locallyModified`, and include a governance reason before validation can pass.

## Lifecycle

1. `DRAFT`: editable with optimistic revision checks, autosave, and named checkpoints.
2. `VALIDATED`: editable but unpublished; any edit clears approval and requires revalidation.
3. `PUBLISHED`: immutable snapshot and checksum. A second user must have approved the validated draft before publication.
4. `ACTIVE`: atomically selected for an environment/organisation scope. Only one live default is permitted per scope.
5. `RETIRED`: inactive, immutable, readable, and retained for provenance.
6. `ARCHIVED`: retained read-only after retirement.

Published, active, retired, and archived versions cannot be edited or deleted. Further work begins by cloning a previously published snapshot to a new semantic-version draft. Database triggers independently reject snapshot mutation or deletion after draft status.

Activation and rollback create new `RuleSetActivation` records, deactivate the prior record, preserve both versions, invalidate the evaluator cache, and record actor, reason, time, environment, organisation scope, and before/after identifiers.

## Permissions

The studio uses the repository role model with distinct permissions for view, edit, validate, approve, publish, activate, rollback, simulate, and export. Retirement and archive require publication authority. Ordinary reviewers cannot activate a version.

## Evaluation provenance

Every versioned execution persists a `RuleEvaluation` with the rule-set/version IDs, display version, checksum, engine version, canonical inputs, matches, branch path, recommendation, risk/urgency, missing information, reviewer boundary, sources, and full trace.

- New batch runs pin the resolved clinical version and checksum at creation.
- Open items do not silently change when the active version changes.
- An authorised regrade requires a reason, creates a new linked evaluation, shows before/after changed fields, and retains the batch's original pin.
- Completed decisions never re-evaluate automatically.
- Wizard and batch orchestration continue using the legacy engine as the displayed result while the canonical draft is in shadow mode; the versioned shadow evaluation is persisted for comparison.

## Safety boundary

Source prose is represented as non-executable `SOURCE_TEXT`, never as inferred JavaScript. Missing or unknown facts use three-valued evaluation and cannot collapse to false/normal. When no governed executable rule controls the case, the evaluator stops with clinician review.

Required wording remains:

- Provisional recommendation
- Reviewer confirmation required
- Not for direct clinical action
- Demo environment
- Simulated export package
