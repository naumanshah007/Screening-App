# CG-NCSP-3.1.0 — Production activation gate status and handoff

Generated from code, not from narrative. Sources:
`lib/clinical-rules/activation-governance.ts`, `lib/clinical-rules/lifecycle.ts`,
`lib/clinical-rules/authority.ts`, `lib/auth/permissions.ts`,
`lib/clinical-rules/governance-review.ts`.

---

## A. Where the product/owner approval can and cannot be recorded

**The governance model has no product-owner or non-clinical-owner role.** Every gate in
`ACTIVATION_GATE_DEFINITIONS` is scoped `roles: ["ADMIN"]` (SHARED-REHEARSAL additionally
allows `INTEGRATION_ADMIN`). There is no gate, permission or audit event type that represents
"product owner sign-off" as distinct from an ADMIN acting.

Four gates are *owner-accountability* in nature and are the closest legitimate home for a
product/risk-owner decision:

| Gate | Question as written in code |
|---|---|
| `ROLLBACK-THRESHOLDS` | "Does the **risk owner** approve the proposed T+0 rollback thresholds?" |
| `RISK-ACCEPTANCE` | "Has the **accountable risk owner** accepted or rejected the documented residual risk?" |
| `LICENSING` | "May the derived clinical artefacts be stored and rendered in CerviGrade?" |
| `R6-CREDENTIAL` | "Has the **credential owner** confirmed rotation/revocation or accepted the residual risk?" |

**Why I did not record them for you.** `recordActivationGateDecision` writes
`actorUserId` from the authenticated session and mirrors it into `AuditLog`. For me to submit
any gate I would have to authenticate as a human account; the resulting evidence would name
that person while the decision was actually made by an agent. That destroys exactly the
attribution the gate exists to create. These four are yours to click, signed in as yourself.

---

## B. The remaining approvals, precisely

### B1. Lifecycle preconditions (before any gate matters)

`activateClinicalRuleVersion` requires status `PUBLISHED` (or already `ACTIVE`) and a
checksum. The path is `DRAFT → VALIDATED → APPROVED ×2 → PUBLISHED`.

`approveClinicalRuleVersion` enforces, in code:
- version must be `VALIDATED`;
- **the draft creator cannot approve it** (`createdById !== actorUserId`);
- **the same approver cannot approve twice** — approvals are matched on the *current
  revision **and** checksum*, so any edit invalidates prior approvals.

→ **Two distinct authenticated humans must approve**, neither being the draft creator.

### B2. The eleven activation gates — all must be `APPROVE`

| # | Gate | Who must act | Nature |
|---|---|---|---|
| 1 | `GOV-01` Clinical interpretation register | ADMIN | Clinical — see B3 |
| 2 | `GOV-02` Independent clinical approvals | 2 distinct clinical approvers | **Clinical** |
| 3 | `GOV-03` Activation separation of duties | ADMIN | Process |
| 4 | `GOV-04-OPERATING-POINT` Reviewer capacity / operating point | ADMIN | Operational |
| 5 | `ROLLBACK-THRESHOLDS` | **Risk owner** | Owner attestation |
| 6 | `LICENSING` | Legal / owner | Owner attestation |
| 7 | `RISK-ACCEPTANCE` | **Accountable risk owner** | Owner attestation |
| 8 | `R6-CREDENTIAL` | **Credential owner** | Owner attestation |
| 9 | `ACTIVATION-OPERATOR` | names a specific ADMIN (`subjectUserId`) | Assignment |
| 10 | `DEPUTY-OPERATOR` | names a *different* ADMIN | Assignment |
| 11 | `SHARED-REHEARSAL` | ADMIN or INTEGRATION_ADMIN | Evidence — see D |

### B3. GOV-01 sub-gate — 23 clinical interpretation cards

`assertProductionGovernanceGates` additionally requires **every** case in
`CLINICAL_GOVERNANCE_CASES` to carry a `GOVERNANCE_INTERPRETATION_APPROVED` event whose
`checksum` equals the version checksum **and** whose `approvalStatus` is
`APPROVED_IN_DRAFT_REVISION`. There are **23** such cards, including
`ROUTER-001/002/003`, `F5-CONFIRMED-ASC-H-TREATMENT-RECOMMENDED`,
`F9-14-ONCOLOGY-MDT`, `INPUT-GAP-STAGE-1A1`, `TIMING-POLICY`, `REGRADE-POLICY`.
These are clinical adjudications, not technical ones.

### B4. Deployment-level switch

`assertProductionActivationPermitted` throws unless
`CLINICAL_AUTHORITY_LIVE_PRODUCTION` ∈ {1,true,yes,on} **in the Production environment**.
This is a Vercel Production environment variable — a deployment secret change, deliberately
separate from any in-app action, and it requires a redeploy to take effect.

### B5. Who can act — role reality

| Permission | Roles holding it |
|---|---|
| `rules:approve` | ADMIN, SMO_REVIEWER, COLPOSCOPIST, COLPO_CNS, GYNAE_GRADER |
| `rules:activate` | **ADMIN only** |
| `rules:rollback` | ADMIN only |

Holding `rules:approve` is a *permission*, not a clinical qualification. GOV-02 asks for
independent **clinical** approval; the appropriate approvers are the clinical roles
(SMO_REVIEWER / COLPOSCOPIST / GYNAE_GRADER / COLPO_CNS), not a platform administrator
approving in a clinical capacity.

### B6. Minimum distinct humans

- 2 × clinical approver (GOV-02, neither the draft creator)
- 1 × Activation Operator — ADMIN, **distinct from both approvers** (enforced twice:
  `assertProductionGovernanceGates` checks `subjectUserId === actorUserId`, and
  `activateClinicalRuleVersion` rejects an operator who is a matching approver)
- 1 × Deputy Operator — ADMIN, distinct from the primary

→ **At least 3, realistically 4 distinct authenticated accounts.**
**No single person can complete this chain, by design.** That includes you, and it includes me.

---

## C. What is already technically complete

| Item | State |
|---|---|
| Governed artefact | `cg-ncsp-3.1.0.json`, checksum `3ab8657a…c824a`, 203/422/421/12, 21 Table 1 combinations |
| Snapshot integrity | Checksum verified on load; mismatch throws |
| Engine/authority wiring | `resolveClinicalAuthority` with no caching, fail-safe to LEGACY |
| Pinning | Historical cases pin authority at case initiation (`lib/clinical-rules/pinning.ts`) |
| Separation of duties | Enforced in code and covered by lifecycle tests |
| Rollback operator control | `assertProductionRollbackOperator` restricts rollback to operator/deputy |
| Full suite | **1482 pass / 0 fail** on `9e5282d` |
| Guidelines UI | Merged to `main` and deployed to Production |

## D. SHARED-REHEARSAL — why it is not satisfiable today

The gate requires "the complete rehearsal passed on a **dedicated non-Production durable
database**", with recorded A–L observations, audit trail, immutable evaluations and a
measured RTO. Its engineering status is literally
`IMPLEMENTED_AWAITING_SHARED_INFRASTRUCTURE`.

Preview deployments resolve `DATABASE_URL` to `file:/tmp/cervical-screening-v2.db`
(`lib/config/database.ts`, `VERCEL_DATABASE_URL`). That is per-instance ephemeral storage,
not a shared durable database. A rehearsal run there would not demonstrate what the gate
asks and would be misleading evidence.

**Blocked on infrastructure, not on effort:** provision a durable non-Production database
(Turso/libSQL via `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN`, which the adapter already
supports) and point a Validation deployment at it. I can then drive the full rehearsal.

## E. Items 7–9 — status

| Asked | Status |
|---|---|
| 7. Activate for new cases only | **Not done.** Requires the assigned Activation Operator, authenticated, after gates 1–11 and the env switch. Not an action I can take. |
| 8. Synthetic Production canaries | **Not run.** Meaningful only after activation; running them pre-activation would report Legacy behaviour and prove nothing. |
| 9. New canonical / historical pinned | **Not verifiable yet.** The pinning code is in place and unit-tested; the live assertion requires activation to have occurred. |

Activation is *new-cases-only* by construction: `resolveClinicalAuthority` resolves authority
for a new case, and cases carrying a pin are never re-resolved. No additional flag is needed
to protect historical cases — but that is a code guarantee, not a substitute for the
post-activation canary.

---

## F. Suggested order of execution

1. You record `ROLLBACK-THRESHOLDS`, `RISK-ACCEPTANCE`, `LICENSING`, `R6-CREDENTIAL`
   signed in as yourself, in Clinical Governance & Activation.
2. Two clinical reviewers adjudicate the **23** GOV-01 cards, then both approve the
   validated version (GOV-02). Neither may be the draft creator.
3. Publish the version.
4. Assign `ACTIVATION-OPERATOR` and `DEPUTY-OPERATOR` — distinct ADMINs, neither an approver.
5. Provision the durable non-Production database; I run the shared rehearsal; record
   `SHARED-REHEARSAL`.
6. Record `GOV-03` and `GOV-04-OPERATING-POINT`.
7. Set `CLINICAL_AUTHORITY_LIVE_PRODUCTION=true` in the Vercel **Production** environment and
   redeploy.
8. The Activation Operator activates for `PRODUCTION`.
9. I run the synthetic canaries and the new-vs-pinned verification immediately afterwards.
