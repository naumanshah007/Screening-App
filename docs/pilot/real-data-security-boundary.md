# Real-data pilot security boundary

Status: software controls implemented for isolated verification. This document is not pilot approval and does not authorise production deployment or real PHI use.

## Operating modes

`CERVIGRADE_RUNTIME_MODE` accepts exactly `DEVELOPMENT`, `DEMO`, `VALIDATION`, or `PILOT`.

| Mode | Permitted data/posture | Enforcement |
| --- | --- | --- |
| `DEVELOPMENT` | Synthetic local development only | Local database and developer conveniences may be used. Protected audit triggers are not applied to newly created development evidence. |
| `DEMO` | Synthetic demonstration data only | Requires `DEMO_MODE=true`. Demo login/reset remain available. |
| `VALIDATION` | Synthetic or formally approved de-identified validation data; non-actionable | This is the conservative fallback for a production build with no explicit runtime mode. Outputs remain visibly non-actionable and simulated handoff remains human-controlled. |
| `PILOT` | Real data only after every external gate below is evidenced | Must be explicit. Missing security configuration blocks sign-in. Demo flags, credentials, seeded demo identities, local database fallback, and unsupported SSO all fail closed. |

A production build never implies pilot authority. `PILOT` requires all of:

- `CERVIGRADE_RUNTIME_MODE=PILOT`
- `DEMO_MODE=false` and no `DEMO_PASSWORD`, `DEMO_SEED_PASSWORD`, or enabled `BOOTSTRAP_DEMO_DB`
- an authenticated managed remote libSQL target
- `PILOT_AUTH_MODE=LOCAL_MFA` in this build
- explicit positive `PILOT_IDLE_TIMEOUT_MINUTES` and `PILOT_REAUTH_MINUTES` approved by the customer security owner
- `PILOT_RETENTION_POLICY_ID` referencing an approved retention/deletion policy

`PILOT_AUTH_MODE=HOSPITAL_SSO_MFA` is recognized but blocked. No SSO provider was fabricated. IdP integration, claims/role mapping, MFA enforcement evidence, break-glass handling, and customer acceptance remain external work.

## Authentication and sessions

The supportable pilot path is password plus TOTP authenticator. An unenrolled real account may authenticate only into password/authenticator enrolment. It cannot reach patient, case, batch, review, export, audit, or administration data. Enabling MFA increments `User.sessionVersion`; the enrolment session is invalid and the user must sign in again with a TOTP code.

JWTs carry the database session version. Password changes/resets, role changes, enable/disable, MFA reset, and explicit “sign out all sessions” increment it. The next request rejects any stale JWT. Deleted/disabled identities and demo identities in pilot are rejected on every session refresh. Pilot idle and absolute re-authentication windows are enforced from explicitly approved configuration. Normal logout discards the NextAuth cookie and records a security audit event.

## Authorization and sensitive access

Server-side permissions are authoritative; navigation hiding is secondary.

- Integration administrators can manage integration configuration and read/export audit evidence. They cannot read patient, case, batch, review, completed-decision, or clinical analytics data.
- GP patient access is constrained to `User.gpPracticeId` for list/detail/create. Cross-practice object identifiers resolve as not found. GP accounts cannot use case APIs.
- Clinical and coordinator permissions retain the existing single-organisation pilot workflow.
- Batch preview/classification and persistence require explicit batch permissions. Review/finality continues to require grading permissions and existing stale/concurrency checks.
- Completed-decision detail/export retains reviewer-own scope for clinical reviewers and all-scope only for administrator/coordinator roles.
- Audit read/export remains administrator/integration-administrator only and is itself audited.
- User and credential administration remains administrator only. Integration connectivity remains organisation-scoped and preserves SSRF controls.

The current product has one configured organisation. This sprint does not claim a multi-tenant expansion.

## Audit evidence and logging

Security events, patient/case reads, patient changes, simulated exports, audit reads/exports, MFA changes, session revocation, and user-administration actions use protected audit entries. Entries contain actor, action, resource identifier, timestamp, existing request IP/user-agent context when available, and metadata that excludes raw PHI/credentials.

Protected rows have a SHA-256 integrity digest and `protectedAt` timestamp. SQLite/libSQL triggers refuse ordinary update/delete when the digest is present. This is application/database tamper resistance and corruption evidence—not external cryptographic immutability. A database owner can bypass local controls. External WORM/immutable anchoring is therefore `EXTERNAL GATE — NOT YET SATISFIED`.

Central safe logging removes credential/PHI-shaped keys, redacts NHI/email/bearer patterns, bounds output, and never serializes stack/cause. Missing SMTP in demo/development logs only a channel/reference metadata event, never recipient, subject, or message content. Missing SMTP in pilot blocks delivery instead of logging the message.

## Data minimisation and lifecycle

The deterministic clinical input, governed decision/evaluation, intake manifests, receipts/hashes, episode provenance, reviewer state, and audit evidence remain required. `BatchReviewItem.caseJson` no longer duplicates display identity and episode identifiers already held in dedicated columns; reconstruction merges those columns at read time. Raw uploaded file contents are not added to audit/log records.

No retention duration is invented. Pilot startup requires a policy reference, but automated clinical deletion is not implemented without customer/privacy/legal approval. `demo:reset` refuses production, remote/shared databases, and every `PILOT` runtime. It must never be used for pilot deletion. Operational deletion must preserve audit/legal-hold evidence and follow the approved policy. Human-controlled CSV/JSON and simulated package exports remain the only handoff model.

## Shadow and clinical authority

`VALIDATION` is persistently labeled non-actionable. Simulated package output remains labeled simulated/not for direct clinical action. No code in this sprint activates `CG-NCSP-3.1.0`, changes a clinical rule, writes to a source clinical system, polls FHIR, sends an autonomous referral, or closes a downstream pathway.

The recovered `16 / 2 / 11` baseline means 16 interpretation cards, two distinct authenticated clinical approvals (neither the draft creator), and 11 canonical activation gates. Source: `docs/canonical-activation-gate-status.md`. These belong to the separate canonical governance stream and remain unsatisfied by pilot configuration.

## External gates

Each item is `EXTERNAL GATE — NOT YET SATISFIED` until evidence is attached by the responsible human/customer/provider:

- customer privacy impact assessment and privacy approval
- New Zealand data-residency and hosting approval
- customer security and operator approval
- clinical governance approval for the pilot operating protocol
- dedicated pilot infrastructure, DNS, network and access-protection provisioning
- hospital SSO/IdP configuration and MFA evidence if SSO is selected
- managed backup credentials, schedule, retention and provider restore evidence
- external immutable/WORM audit anchoring
- customer-approved retention, deletion and legal-hold policy
- real-data data-sharing/processing authority and named pilot cohort
- production/staging migration and deployment approval

Software controls implemented does not mean the pilot is approved.
