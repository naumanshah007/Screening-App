# Production activation centre

## Release identity

- Candidate: `CG-NCSP-3.1.0`
- Production authority before activation: `LEGACY`
- Canonical evaluation before activation: shadow/simulation only
- Approval centre: `/governance/clinical`
- Production activation is permitted only for the checksum displayed in that centre.

Engineering completion is not a clinical, legal, security-risk, credential-owner, or operational approval. The centre stores each human decision as an append-only `RuleVersionAuditEvent` with authenticated actor, role, timestamp, comment, release checksum, and any assigned operator identity.

## Clinical interpretation register

All 16 entries in `CLINICAL_GOVERNANCE_CASES` are displayed with source guidance, current Legacy behaviour, canonical behaviour, proposed final behaviour, safety impact, pathway, rule AST, and affected tests. A matching proposal by one actor and approval by another are required. Any later proposal, rejection, change request, or checksum change makes the card incomplete for Production activation.

## Operational gates

Production activation requires current-checksum approval of all of the following:

1. GOV-01 clinical interpretation register
2. GOV-02 two independent clinical approvals
3. GOV-03 activation separation of duties
4. GOV-04 operating point and reviewer capacity
5. rollback thresholds
6. source licensing and redistribution
7. residual security and operational risk
8. R6 historical credential exposure
9. primary Activation Operator
10. distinct Deputy Operator
11. shared activation and rollback rehearsal

The primary and deputy must be authenticated ADMIN users, must differ from each other, and must not be either clinical approver. Only the assigned primary operator may activate Production.

## Candidate T+0 rollback thresholds

These are proposed values, not approved values, until the accountable risk owner records APPROVE:

- any canonical evaluation failure in 15 minutes;
- any clinical-authority resolver failure in 15 minutes;
- any unexplained urgent disagreement;
- two unexplained recommendation reversals in 24 hours;
- clinician override rate above 20% over 20 consecutive reviewed cases;
- any confident recommendation with a missing mandatory fact;
- any machine-scheduled date from a clinician-timing-required rule;
- any failed `RuleEvaluation` or audit write.

## Licensing inventory

The licensing decision covers internal source JSON snapshots, generated rule graphs and pathway views, displayed source excerpts, manifest metadata, and derived clinical rule records. The accountable reviewer must record one of `APPROVED`, `NOT APPROVED`, or `REQUIRES LEGAL REVIEW`, with scope and evidence in the decision comment. Only `APPROVED` satisfies activation.

## R6 credential closure

Technical remediation is complete: no password is rendered or hard-coded, Production demo seeding fails closed, and the historical password is never tested. The remaining gate is an accountable credential-owner record of post-exposure rotation/revocation evidence or formal residual-risk acceptance.

## Shared rehearsal evidence

The shared rehearsal gate may be approved only after the A–L activation/rollback rehearsal has run on a dedicated, durable, non-Production database. Evidence must include activation and rollback audit events, authority resolution before/during/after, new-case-only pinning, preservation of immutable evaluations, failure-path observation, monitoring signals, and measured rollback RTO. An isolated process-local database does not satisfy this gate.

## Activation sequence

1. Complete and independently approve all 16 clinical interpretation cards.
2. Validate the final revision and record two independent clinical approvals for its checksum.
3. Publish the exact checksum.
4. Complete and approve all operational gates, including shared rehearsal, licensing, R6 and risk acceptance.
5. Assign primary and deputy operators.
6. The primary operator opens `/governance/clinical`, confirms every gate is green, and selects **Activate Production authority** with the approved change reference.
7. Verify the new Production activation, resolver state, audit event, monitoring signals and first new-case pin.

Validation, both final release approvals, and publication are exposed in the same approval centre; reviewers do not need to navigate back to Rule Studio to complete the lifecycle.

The primary or deputy operator can select **Roll back Production to Legacy** from the same centre. This deactivates the current Production row, restores the version to PUBLISHED when no other activation remains, writes `ROLLBACK_TO_LEGACY`, and is idempotent. It does not require the live-authority environment switch to remain enabled.

The resolver still requires both the explicit `CLINICAL_AUTHORITY_LIVE_PRODUCTION` deployment control and an active Production database row. Either one absent means Legacy authority. Existing cases retain their original authority pin. Rollback is uncached and takes effect for new cases without a cross-instance delay.

## 2026-08-09 dashboard schema incident

Production dashboard rendering failed because an older durable database lacked additive canonical-provenance columns used by recent-session queries. The repair added the missing nullable pin/evaluation columns and indexes without replacing tables or rows. The compatibility migration is idempotent and now runs after canonical table installation. The exact Production dashboard aggregations passed after repair while authority remained Legacy.
