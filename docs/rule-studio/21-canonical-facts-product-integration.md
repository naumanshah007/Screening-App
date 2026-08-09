# Canonical facts product integration

The product now carries canonical V2 facts through shadow-only pathways while preserving the legacy decision as displayed authority.

## Data capture

The operating sequence is minimal routing facts → pathway selection → pathway-specific facts or explicit unknowns → canonical shadow evaluation. Existing wizard and batch inputs are adapted only from values actually supplied. In particular, abnormal-bleeding examinations, treatment, biopsy, excision, OCP adjustment and STI treatment are not invented from symptoms or recommendations.

The Review Queue shows the legacy decision and a separate Canonical V2 Shadow Comparison containing:

- ruleset version/checksum and evaluation mode;
- provisional shadow outcome and reviewer boundary;
- matched rules and exact branch path;
- missing/conflicting facts and provenance diagnostics;
- source references.

An authorised reviewer may add or correct one fact with explicit status, value and provenance. The server validates the fact against the pinned snapshot, creates a linked shadow evaluation with a reason, preserves the earlier evaluation and updates only a still-pending review item through an optimistic comparison. Completed decisions are rejected by this endpoint.

## Batch contract and templates

- `canonical-clinical-facts-v2-template.csv`
- `canonical-clinical-facts-v2-template.xlsx`
- `canonical-clinical-facts-v2-field-dictionary.csv`
- `canonical-clinical-facts-v2-validation-errors.csv`
- `canonical-clinical-facts-v2.schema.json`

The long-form batch schema records one fact per row with status, source, timestamps, verification and reference fields. It includes synthetic examples spanning HPV, CIN2, HSIL, AIS, cancer and bleeding pathways. Formula-like CSV cells are neutralized.

## Persistence and exports

`RuleEvaluation` stores the deterministic V2 input snapshot, ruleset version/checksum, engine version, mode, matched rules, branch path, missing facts, reviewer requirement, source references and trace/legacy comparison. Database triggers make evaluations append-only. Regrade creates a new evaluation linked by `previousEvaluationId` and requires a reason.

Review Queue reconstruction loads the persisted shadow evidence. Completed-decision simulated CSV, JSON, FHIR-like and HL7-style packages expose canonical shadow provenance and path separately while retaining the reviewer-confirmed legacy decision as authority. CSV output neutralizes formula injection.

## Compatibility and permissions

The existing evaluation API remains backward compatible with legacy-compatible fact maps. V2 requests require an explicit version pin and cannot submit both representations. All writes are server-validated. Review corrections require `cases:grade`; governance proposals require `rules:validate`; final interpretation approval requires `rules:approve` and a different actor.

This is a demo/shadow integration. Provisional recommendation · Reviewer confirmation required · Not for direct clinical action · Simulated export package.
