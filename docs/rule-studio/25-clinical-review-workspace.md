# Clinical review workspace

The version detail page now includes a Clinical Review tab for the three evidence dossiers. It displays the case title, source pages, recommendation IDs, figure branch, affected canonical records, current typed AST, current outcome, competing interpretation, pathway effect, affected tests, latest comments, disposition and approval status.

Allowed dispositions are limited server-side to:

- `SOURCE_SUPPORTS_OPTION_A`
- `SOURCE_SUPPORTS_OPTION_B`
- `KEEP_GOVERNANCE_STOP`
- `REQUIRE_EXTERNAL_CLINICAL_ADVICE`
- `RULEBOOK_CORRECTION_REQUIRED`
- `ORACLE_CORRECTION_REQUIRED`

Proposals require `rules:validate`; approvals require `rules:approve`. The API requires a matching proposal and rejects an approver who is also the proposer. It also enforces optimistic revision matching.

Approval is permitted only for a DRAFT. It records a new draft revision plus immutable audit events; it does not mutate the checksum-protected snapshot, mark the version published, set `publicationPermitted`, or create an activation. Published, active, retired and archived versions cannot use the flow.

The three software/oracle ambiguities are already source-resolved in the successor as `ORACLE_CORRECTION_REQUIRED`, but their approval state begins `EVIDENCE_RESOLVED_GOVERNANCE_PENDING`. Independent reviewers must still record the governed decision. The version remains `DRAFT — ENGINEERING VALIDATION PASSED — CLINICAL GOVERNANCE PENDING` throughout this task.
