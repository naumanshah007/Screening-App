# SHARED-REHEARSAL — activation and rollback rehearsal report

Harness: `scripts/rule-studio/shared-activation-rehearsal.ts`
Raw observations: `docs/rehearsal/shared-activation-rehearsal-observations.txt`
Result: **12 of 12 observations pass — SHARED_REHEARSAL_PASSED.**

---

## Database used

| Property | Value |
|---|---|
| Target | `libsql://screening2-naumanshah007.aws-ap-south-1.turso.io` (dedicated non-Production) |
| Adapter | libsql |
| Mode | **`remote-libsql`** — SHARED_REMOTE_LIBSQL confirmed |
| Auth configured | Yes |
| Is the Production database | **No** — Production is `screening-db-naumanshah007`; distinct database |
| Is `file:/tmp/...` | **No** |
| Persists across separate connections/processes | **Yes** — PID 30986 wrote; PIDs 31007 and 31040 (separate processes, after the writer exited) read the same state from the remote database |

### Scope

The rehearsal ran against the shared remote Turso database that backs the Validation
Preview deployment, so state is held in shared remote storage rather than in any single
process. Separate OS processes with independent connections observed each other's writes,
which is the property serverless instances rely on.

---

## Observations

| ID | Observation | Result |
|---|---|---|
| A | Starting authority is Legacy | **PASS** |
| B | Synthetic Legacy case created and evaluated | **PASS** |
| C | Rehearsal state prepared with two distinct synthetic approvers | **PASS** |
| D | CG-NCSP-3.1.0 activated in VALIDATION only (Production observed still LEGACY) | **PASS** |
| E | Referral → legacy router → pathway → canonical → provisional recommendation | **PASS** |
| F | Provenance persisted and verifiable | **PASS** |
| G | Pre-activation Legacy case remains Legacy after canonical activation | **PASS** |
| H | Rollback returns authority to Legacy | **PASS** |
| I | New case after rollback resolves to Legacy | **PASS** |
| J | Canonical case remains canonical historically after rollback | **PASS** |
| K | Immutability, audit, monitoring, fail-closed | **PASS** |
| L | Measured rollback RTO | **PASS — 2,767 ms** (remote round-trips) |

### F — persisted provenance (evidence)

```
evaluationId      cmspbdstt000fmuv4nh8fybsa
engine            canonical-graph-v2
ruleset           CG-NCSP-3.1.0
checksum          3ab8657a13e73bb0…
pathway           FIGURE_3            (selected by the legacy router)
controllingRuleId F1-01
evaluationMode    LIVE_DEMO
timestamp         2026-08-11T23:51:29.585Z
```

### K — control evidence

- `RuleEvaluation` delete **refused** by the database (immutability trigger).
- Version audit events recorded: `ACTIVATION`, `ROLLBACK_TO_LEGACY`.
- Audit log actions: `SUCCESSOR_CREATED`, `VALIDATION_PASSED`, `APPROVAL`, `PUBLICATION`,
  `ACTIVATION`, `ROLLBACK_TO_LEGACY`.
- Monitoring summary available across the activation and the rollback.
- A `PRODUCTION` activation attempt was **refused** (fail-closed) during the rehearsal.
- Rollback required **no database restore** — it deactivates the activation row.

### L — rollback RTO

**2,767 ms** against the remote shared database, by deactivating the activation row. No restore, no redeploy, no data migration. (The same rehearsal measured 17 ms on local storage; the difference is network round-trips.)

---

## RESOLVED — G: Legacy-era case pinning

**Original observation.** A case whose only clinical decision was made under Legacy resolved
to CANONICAL after activation, because `getCaseAuthorityPin` recognised only an operative
canonical `RuleEvaluation`, and a Legacy decision lives in `RuleDecision`.

**Fix.** An immutable `CaseAuthorityPin` record now persists the authority a case is bound to,
and `getCaseAuthorityPin` resolves in this order:

1. an explicit persisted `CaseAuthorityPin` — authoritative, written once;
2. the first clinically operative `RuleEvaluation` → CANONICAL pin;
3. an existing `RuleDecision` → **LEGACY pin**, carrying the original decision time;
4. no clinical history → not pinned; the current activation applies and this evaluation
   establishes the pin.

Every branch reads persisted case history. None reads the currently active authority.

**Backfill.** `scripts/rule-studio/backfill-case-authority-pins.ts` materialises pins from
existing history. It writes authority provenance only — never the recommendation, clinical
content, decision timestamp, reviewer or rule result. It is idempotent (re-checks inside the
transaction), transactional, auditable (`CASE_AUTHORITY_PIN_BACKFILL`), supports `--dry-run`,
and **fails closed**: a case whose history disagrees with an existing pin is reported and
left untouched.

**Verified in this rehearsal (observation G) and by 10 targeted tests** in
`tests/db/stack-02-case-authority-pinning.test.ts`. On the remote run G reported:
*"Pinned to legacy at first evaluation (2026-08-11T23:51:18.583Z); the current activation
does not apply to this case."*

## FINDING — publication was blocked by shadow evaluations

`publishClinicalRuleVersion` included `checksum` in its update, immediately after asserting
it was unchanged. SQLite's `ClinicalRuleVersion_evaluated_snapshot_update` trigger fires when
a guarded column appears in the SET list, not when its value changes, so **any version that
had ever been shadow-evaluated could never be published — and therefore never activated.**
The canonical engine writes SHADOW evaluations against the newest version continuously, so
this affected CG-NCSP-3.1.0 on every environment where shadow comparison had run.

Fixed by removing the redundant `checksum` write. The immutability guarantee is unchanged:
identity columns still cannot be altered (asserted by test), and the equality check still
enforces the invariant.

## Safety properties of this rehearsal

- Activation scoped to `VALIDATION` only; Production authority observed as `LEGACY`
  throughout (observation D).
- Synthetic identities on the reserved `.invalid` TLD
  (`rehearsal.creator@validation.invalid`, `…approver-a…`, `…approver-b…`, `…operator…`),
  so no rehearsal signature can be mistaken for a Production clinical approval.
- Synthetic subjects (`SYNTHETIC-REHEARSAL-001/002/003`) and a governed source-oracle
  fixture. No real participant data.
- The harness refuses to run when `VERCEL_ENV=production`, `NODE_ENV=production`, or when the
  resolved database is the known Production host.

## Related Production control change

`CLINICAL_AUTHORITY_LIVE_PRODUCTION` was found **enabled** in the Vercel Production
environment while CG-NCSP-3.1.0 is unapproved and unactivated — the opposite of the
documented "Default: OFF. Never defaults on, in any environment." It has been set to a
fail-closed value. The value itself was never printed. **A Production redeploy is required
for running instances to pick up the new value.**
