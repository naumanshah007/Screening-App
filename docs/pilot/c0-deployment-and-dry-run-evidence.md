# C0 deployment and synthetic pilot dry-run evidence

Date: 15 August 2026 (Pacific/Auckland)

Status: engineering evidence prepared from the accepted Sprint B commit `187bd1ae2410ee79d475fc3224aa39001dbccfe5`. This is not customer, privacy, security, clinical, infrastructure, or production approval. It does not authorise real PHI, customer UAT, production deployment, or activation of canonical clinical content.

## Scope and stop line

The rehearsal used generated identities and seeded synthetic records only. It did not contact `screening.privexa.co`, change the production database, provision hosted infrastructure, send a referral, write to a hospital/source system, or activate Rule Studio content. The environment was deleted after the run.

The C0 launcher required an explicitly named database beneath the operating-system temporary directory. It started an authenticated network libSQL server and a Next.js application with:

- `CERVIGRADE_RUNTIME_MODE=PILOT`
- `PILOT_AUTH_MODE=LOCAL_MFA`
- explicit 15-minute idle and 60-minute re-authentication values
- an explicit synthetic retention-policy reference
- a generated application secret and generated database signing keys kept in process/temporary files
- demo mode and demo database bootstrap disabled
- the existing batch/review workflow enabled only inside the synthetic C0 launcher

The network libSQL service was loopback-only and disposable. It exercised remote URL and token handling, but it is not a hosted, durable, New Zealand-resident pilot environment. Dedicated infrastructure remains an external gate.

## Deployment path and root cause

### Prisma 7 failure

The host environment supplied `RUST_LOG=warn`. With Prisma 7.9.1 and a new SQLite target, the schema engine reports its expected missing-database/create signal at INFO level. Suppressing that structured result left the JavaScript wrapper with an empty engine response and the generic message `Error: Schema engine error:`.

The failure reproduced five times with the ambient value. `RUST_LOG=error` and `warn` failed; `info`, `debug`, and `trace` succeeded. A schema-engine probe confirmed `--datasource` was present, ruling out a missing datasource argument. `scripts/pilot/run-prisma-migrate-deploy.ts` now requires an explicit file URL and invokes the real Prisma CLI with `RUST_LOG=info`.

### Remote libSQL path

Prisma Migrate does not accept a `libsql:`, HTTP, or WebSocket datasource. The governed remote runner therefore uses the same ordered Prisma migration files and Prisma-compatible checksums/history over an authenticated libSQL client. It requires a change/approval reference, refuses file targets, refuses loopback unless C0 explicitly opts in, validates that applied history is an exact checksum-matching prefix at or beyond accepted Sprint A, applies each pending migration atomically, and revalidates the complete chain.

This tooling resolves the engineering uncertainty; it does not supply the external approval reference or hosted target.

## Exact deployment rehearsal

Command: `npm run pilot:c0:deployment:rehearse`

1. Archive accepted Sprint A `9b0e9de1e897951895adf251e6ce86d18f5f5e19` without changing a worktree.
2. Use the real Prisma CLI to deploy its 19 migrations to a new SQLite database.
3. Insert a synthetic organisation sentinel at the accepted Sprint A schema.
4. Copy the database and run `npm run pilot:prisma:migrate:deploy`; Prisma applies exactly `20260815193000_sprint_b_real_data_security_boundary` and reports the schema up to date.
5. Copy the Sprint A database again, start authenticated loopback libSQL, prove missing and invalid tokens fail, and run the governed remote migration path.
6. Verify 20 migrations, final migration identity, checksums/history, existing sentinel survival, `User.sessionVersion`, protected-audit triggers, `PRAGMA integrity_check=ok`, and no foreign-key violations.
7. Start Prisma Client through the remote libSQL adapter and read the upgraded sentinel and user table.
8. Evaluate the full PILOT runtime boundary and compare every migration-file digest before and after.

Observed result: PASS. Nineteen migrations before, twenty after, existing data survived, missing/invalid tokens were rejected, application client read succeeded, audit tampering was rejected, and no migration file changed.

## Synthetic workflow rehearsal

The Browser-driven run used ten converted `@example.invalid` identities, a generated-strength shared synthetic password, and valid TOTP secrets. No converted identity retained `isDemoAccount=true`; the unenrolled account was restricted to authenticator setup.

Observed results:

- Admin: PILOT sign-in, patient read, audit read/export, recovery-code generation, one-time recovery login (eight to seven codes), all-session revocation, and re-authentication redirect passed.
- Integration Admin: integration centre and audit read passed; patient and completed-decision routes redirected to an unauthorised surface.
- Scoped GP: only its configured practice appeared; a direct cross-practice patient identifier did not reveal the patient; batch access was denied.
- Unenrolled GP: password-only session was confined to Account Security; patient access redirected; authenticator setup succeeded; the setup session was invalidated; fresh MFA sign-in restored only scoped patient access.
- Coordinator: 14 synthetic records were received, parsed, reconciled, selected, prepared, and saved to the Review Queue. Repeating the intake classified all 14 as possible duplicates for explicit human resolution; it did not silently merge or discard them.
- Reviewer: a pending item moved to Needs Information with recorded owner/reason, was returned to review with a resolution note, and another item was accepted. A second stale tab attempted the same final action and received HTTP 409; the queue refreshed with the conflict message.
- Completed decision/export: the accepted decision appeared only in the reviewer’s completed scope. The integration-ready package preview remained labelled simulated/not for direct clinical action, and a CSV package download completed.
- Audit reconstruction: admin audit showed the security/workflow trail and a JSON audit export completed.

No downstream clinical system was configured or mutated.

## Security operations evidence

| Control | Evidence | Result |
| --- | --- | --- |
| MFA enrolment | Restricted account prepared a valid secret, verified a TOTP, had its setup session revoked, and re-authenticated | PASS |
| MFA recovery | Generated recovery code authenticated once; stored count fell from 8 to 7; compare-and-swap prevents concurrent reuse | PASS |
| Idle expiry | deterministic boundary test rejects activity older than configured idle window | PASS |
| Absolute re-authentication | deterministic boundary test rejects sessions beyond the configured re-auth window | PASS |
| Logout | each role ended via the audited logout flow | PASS |
| All-session revocation | `sessionVersion` increment redirected the current session to `login?reauth=1` | PASS |
| Disabled/compromised user | admin disabled the synthetic Coordinator; subsequent correct-password/TOTP sign-in was refused and audited | PASS |
| Demo refusal | old demo-roster identity was refused in PILOT; source and tests reject both flagged and roster identities | PASS |
| Audit read/export | Admin and Integration Admin read; other roles lacked the route; admin JSON export downloaded | PASS |
| Audit update/delete | protected row triggers refused both operations | PASS |
| Safe logging | server output contained routes/statuses and framework traces, but no supplied password, TOTP secret, recovery code, token, patient name, NHI, or payload | PASS |
| SSRF | automated suite retains URL resolution, private/link-local/metadata address, credential-forwarding, and redirect controls | PASS |

## Audit, data minimisation, and PHI logging

Protected audit entries have an integrity digest and `protectedAt`; database triggers reject ordinary update/delete. This is tamper resistance, not provider-independent immutability. A database owner could bypass it, so WORM anchoring remains external.

The intake stores a receipt/manifest and canonical decision inputs needed for reconciliation and traceability. It does not add raw uploaded file contents to logs or audit metadata. Display identity is held in dedicated columns rather than duplicated into `BatchReviewItem.caseJson`. Central sanitisation removes credential/PHI-shaped keys and redacts NHI, email, and bearer-like text before bounded logging.

## Retention, deletion, backup, and restore

No retention duration was invented. PILOT startup requires a policy identifier, while deletion, legal hold, and disposal still require customer/privacy/legal decisions. Demo reset is prohibited in PILOT and is not a deletion tool.

`npm run pilot:recovery:rehearse` created a new schema, synthetic user sentinel, and protected audit event; made a backup; deleted the operational source; restored a replacement; verified integrity/FKs/sentinel/protected evidence; started authenticated network libSQL over the restored file; and used Prisma Client to read the restored user and audit event. Result: PASS. Managed provider backup schedules, immutable backup identity, residency, encryption/key ownership, RPO/RTO acceptance, and a provider restore remain external.

## Export and authority boundary

Exports are human-initiated. Decision packages are prepared only from reviewer-confirmed decisions and remain explicitly simulated/not for direct clinical action. Audit export is restricted to Admin and Integration Admin. DLP, approved recipients, secure transfer, disposal, and any real downstream handoff remain customer/operator decisions.

`VALIDATION` and shadow evidence remain non-actionable. C0 neither changed nor activated clinical rules. The `16 / 2 / 11` canonical governance baseline remains a separate human gate. There is no autonomous referral, source-system write, pathway closure, or clinical-system mutation.

## Evidence commands

```bash
npm run pilot:migrations:verify
npm run pilot:c0:deployment:rehearse
npm run pilot:recovery:rehearse
npm run test:security
npm run test:all
npm run lint
npm run typecheck
npm run build
git diff --check
```

## External limitations

This run did not create hosted pilot infrastructure, prove New Zealand residency, exercise provider-managed backup, anchor audit evidence to WORM storage, integrate hospital SSO, obtain a privacy/security/clinical approval, define a real-data cohort, approve retention/deletion, or approve a production migration. See `c0-external-gate-readiness-register.md`.
