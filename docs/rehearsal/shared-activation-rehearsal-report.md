# SHARED-REHEARSAL — activation and rollback rehearsal report

Harness: `scripts/rule-studio/shared-activation-rehearsal.ts`
Raw observations: `docs/rehearsal/shared-activation-rehearsal-observations.txt`
Result: **11 of 12 observations pass. SHARED-REHEARSAL is NOT recorded as approved.**

---

## Database used

| Property | Value |
|---|---|
| Target | `/Users/nauman/Documents/cervigrade-validation/validation.db` (dedicated) |
| Adapter | libsql |
| Mode | `local-file` |
| Is the Production database | **No** — Production resolves to a remote Turso host; hashes compared, values never printed |
| Is `file:/tmp/...` | **No** |
| Durable across processes | **Yes** — PID 20374 wrote; PIDs 20404 and 20428 (separate processes, after the writer exited) read the same state |

### Honest limitation

The gate asks for a **shared** durable database, i.e. state shared across serverless
instances. This rehearsal proves durability and sharing across **independent OS processes**,
not across Vercel serverless instances.

Reaching the remote/shared dimension is blocked on credentials, not effort:

- The existing non-Production `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` are stored as
  **Sensitive**; `vercel env pull` returns them empty, so they cannot be read and therefore
  cannot be re-scoped to another Validation branch from the CLI.
- The `turso` CLI is installed but not authenticated, so a fresh non-Production database
  cannot be provisioned here.

Either action requires a human: widen the existing variables' branch scope in the Vercel
dashboard, or authenticate the Turso CLI. Once a Validation deployment resolves to that
durable remote database, this same harness runs unchanged.

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
| G | Pre-existing Legacy case on re-evaluation after activation | **FAIL — see finding** |
| H | Rollback returns authority to Legacy | **PASS** |
| I | New case after rollback resolves to Legacy | **PASS** |
| J | Canonical case remains canonical historically after rollback | **PASS** |
| K | Immutability, audit, monitoring, fail-closed | **PASS** |
| L | Measured rollback RTO | **PASS — 17 ms** |

### F — persisted provenance (evidence)

```
evaluationId      cmsp2sfwn000ojov4a3e7ai7m
engine            canonical-graph-v2
ruleset           CG-NCSP-3.1.0
checksum          3ab8657a13e73bb0…
pathway           FIGURE_3            (selected by the legacy router)
controllingRuleId F1-01
evaluationMode    LIVE_DEMO
timestamp         2026-08-11T19:50:56.135Z
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

**17 ms**, by deactivating the activation row. No restore, no redeploy, no data migration.

---

## FINDING — G: a Legacy-era case is not pinned to Legacy

**Observed:** a case whose only clinical decision was made under Legacy, when re-evaluated
after canonical activation, resolves to **CANONICAL**, with
`pinned: false` and reason *"Not yet pinned; the current activation applies and this
evaluation establishes the pin."*

**Mechanism (not a defect in the harness):**
`getCaseAuthorityPin` looks for the earliest `RuleEvaluation` in a clinically *operative*
mode (`LIVE_DEMO`, `LIVE_PRODUCTION`). Legacy decisions are not written to `RuleEvaluation`,
so a Legacy-era case has no operative evaluation and the function returns an
`inferredLegacy` pin. `applyPin` treats `inferredLegacy` as **not pinned**, so current
authority applies.

**Consequences.** Forward-only behaviour is safe: new cases get canonical, and a case first
decided under canonical stays on that exact version after rollback (observation J passed).
The gap is specifically **re-evaluation / regrade of a Legacy-era case after activation**,
which will adopt canonical rather than remain on Legacy.

**Why this matters for the stated activation target.** The requirement "historical cases
remain pinned" holds for canonical-era cases and does **not** hold for Legacy-era cases.
Whether that is acceptable is a clinical governance decision, not a technical one:

- If a regrade *should* use current guidance, the behaviour is correct and the requirement
  needs rewording.
- If Legacy-era cases must stay on Legacy, `applyPin` needs an explicit Legacy pin — for
  example deriving a pin from the case's existing `RuleDecision` — before Production
  activation.

**This is why SHARED-REHEARSAL has not been recorded as approved.** Recording a pass while a
stated activation requirement is unmet would put a false attestation into the governance
record.

---

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
