# C0 RBAC and sensitive-data access matrix

Status: engineering evidence only. Server/API checks are authoritative; navigation visibility is not an access control.

| Capability / data | Admin | Integration Admin | Coordinator | Clinical reviewer | Scoped GP |
| --- | --- | --- | --- | --- | --- |
| Patient list/detail | All configured organisation records | Denied | Allowed | Allowed | Own `gpPracticeId` only; cross-practice ID is not found |
| Patient create/edit | Create/edit | Denied | Create/edit | Depends on clinical role; SMO is read-only | Create for own practice; no practice selection; edit denied |
| Case data | Full operational access | Denied | View/create/edit/book | View/grade; exact capabilities depend on clinical role | Denied |
| Intake/batch | View/manage | Denied | View/manage | View/manage, but hidden from the normal reviewer navigation | Denied |
| Review Queue | View and final decisions | Denied | View and Needs Information operations; no accept/reject grade | View and final decisions; stale/concurrent writes fail | Denied |
| Completed decisions | All | Denied | All | Own reviewer-confirmed decisions only | Denied |
| Decision package export | All confirmed decisions | Denied | All confirmed decisions | Own confirmed decisions only | Denied |
| Audit investigation/export | Read/export | Read/export | Denied | Denied | Denied |
| Integration configuration | Manage | Manage | Denied | Denied | Denied |
| User/credential administration | Manage | Denied | Denied | Denied | Denied |
| Clinical rule governance | Broad technical permissions; human governance still applies | View/export only | No activation authority | Role-dependent validate/approve; separation-of-duties gates still apply | Denied |
| Analytics | Allowed | Denied | Allowed | Allowed | Denied |

## Authentication and session conditions

- Every PILOT identity must be active, non-demo, and MFA-enrolled before leaving Account Security.
- Password changes/resets, role or enabled-state changes, authenticator reset/enrolment, and “sign out all sessions” increment `sessionVersion`; stale JWTs fail on their next request.
- Recovery codes are hashed, shown only at creation, accepted as one-time second factors, consumed with compare-and-swap, and audited without logging the code.
- Idle and absolute re-authentication values have no hidden defaults in PILOT; missing/invalid values block the runtime.

## Sensitive-data boundaries

- Patient/case reads, exports, audit reads/exports, authentication/security changes, and administration actions are audited.
- Raw PHI, credentials, bearer tokens, TOTP secrets, and recovery codes are excluded from audit detail and central logging.
- Integration Admin is intentionally non-clinical: the Browser dry-run proved patient and decision paths redirect to an unauthorised surface while integration/audit paths remain available.
- GP scope is applied in list/detail/create server queries. The Browser dry-run proved a known patient identifier from another practice did not reveal a record.
- No role receives autonomous permission to mutate an external clinical system.
