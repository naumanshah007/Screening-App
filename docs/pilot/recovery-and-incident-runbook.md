# Pilot recovery and incident runbook

Status: isolated synthetic loss/restore and authenticated application-read path verified. Managed pilot backup/restore and incident coordination remain external gates.

## Synthetic restore rehearsal

Prerequisites: repository dependencies installed; no real PHI; no production database URL needed. The command ignores the configured application database and uses an OS temporary directory.

```bash
npm run pilot:recovery:rehearse
npm run pilot:migrations:verify
```

The rehearsal creates the current schema, inserts a synthetic user sentinel and protected audit event, closes the source, creates a backup, deletes the operational source to simulate loss, and restores a replacement. It then starts authenticated network libSQL over the restored file and verifies:

- SQLite `integrity_check=ok`
- no foreign-key violations
- sentinel recovery
- protected audit update refusal
- protected audit delete refusal
- Prisma Client can read the restored user and protected audit evidence over the authenticated network path

All temporary credentials, keys, database files, and directories are removed. A PASS proves the application/schema-level recovery mechanism and remote-style application read, not a provider-managed backup service.

## Managed pilot restore — external procedure

Do not restore over production and do not download a real pilot backup to a developer device.

1. Obtain incident/change approval and identify the provider backup by immutable identifier and timestamp.
2. Provision a new isolated restore target in the approved New Zealand region with separate credentials and network controls.
3. Restore through the managed provider. Keep the current service target unchanged.
4. Apply no unapproved migration. Compare `_prisma_migrations`, schema version, row counts, intake reconciliation totals, receipt uniqueness, episode/usage referential checks, protected audit presence, and provider integrity results.
5. Run read-only synthetic smoke checks through an approved bastion/runtime. Do not export patient payloads into tickets or logs.
6. Record restore operator, approver, backup identifier, target identifier, start/end, validation evidence, and disposition in the incident/change system.
7. Repoint service traffic only after customer security/privacy/clinical approval. Retain the prior target until rollback expiry under the approved policy.

Required external evidence: provider credentials, backup schedule/retention, regional residency, encryption/key ownership, a provider-level rehearsal, RPO/RTO acceptance, and named approvers. Until present: `EXTERNAL GATE — NOT YET SATISFIED`.

## Credential and session containment

- Disable the affected account through Users & Access. Existing JWTs fail on the next request because `sessionVersion` changes.
- Reset the password and MFA if credential theft is suspected; both revoke sessions.
- The account owner can use Account Security → Sign out all sessions.
- Rotate `AUTH_SECRET` only as an approved environment-wide emergency action; it invalidates every JWT and requires a coordinated service restart.
- Rotate database, SMTP, storage, and integration secrets in their owning secret stores. Never paste values into audit details, logs, tickets, or chat.
- Keep integration testing read-only. Existing outbound policy must continue to block loopback, private/link-local/metadata and unsafe redirects.

## Incident sequence

1. Contain: disable identities, revoke sessions/credentials, and disable affected connectivity without deleting evidence.
2. Preserve: snapshot provider logs and protected audit evidence to the approved external evidence store. The repository does not yet provide WORM anchoring.
3. Assess: determine organisation, resources, time window, actions, exports, and clinical workflow impact from audit events. Do not copy PHI into ordinary incident notes.
4. Recover: use a new isolated restore target if data integrity is in doubt; never overwrite the only copy.
5. Validate: reconcile intake manifests, duplicates/receipts, review concurrency, Needs Information ownership, completed-decision authority, usage events, and audit integrity.
6. Resume only with security/privacy/clinical/operator approval and a documented rollback point.
7. Follow customer breach-notification and regulatory processes; the application does not decide legal notification thresholds.

## Deletion and export

There is no generic pilot wipe command. `demo:reset` is not a deletion mechanism and is prohibited in pilot. Deletion requires an approved policy, exact scoped targets, backup/legal-hold decision, referential impact review, and an auditable operator/approver record. Audit evidence must not be silently rewritten to conceal the deleted resource.

Exports remain human-initiated simulated handoff packages and audit exports. Their creation is audited. External delivery, DLP, recipient approval, secure transfer, and disposal remain operational/customer responsibilities.
