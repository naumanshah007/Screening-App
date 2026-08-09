# Engineering closure and human gates

Date: 9 August 2026 (NZST)  
Ruleset: `CG-NCSP-3.1.0`  
Engineering position: ready for human clinical/governance approval, **not ready for activation**

This addendum supersedes the engineering-status statements in document 16 where later work is explicitly recorded below. It does not supersede any unsigned clinical, governance, risk, licensing or security gate.

## Authority boundary

The implemented decision path remains:

`referral -> normalisation -> Legacy router/age gates/figure selection -> authority selector -> Legacy or governed within-pathway recommendation -> decision adapter -> reviewer workflow -> immutable persistence/audit`

Legacy remains authoritative unless all lifecycle checks pass. `CG-NCSP-3.1.0` remains `DRAFT / SHADOW / SIMULATION`; it is not for direct clinical action. Reviewer confirmation remains required. The Production activation blocker and absent live-production flag were deliberately left intact.

## Engineering closure evidence

- Governed artifact: 203 rules, 422 nodes, 421 edges and 12 synchronized views.
- Manifest checksum: `3ab8657a13e73bb0080f18399d9165c20e9af5796bdcf594bdc71170309c824a`.
- Source JSON SHA-256: `ffd329ed25896667efb92b0a4db50742785e2d65e98a5b30bc5ef7f5f7de16aa`.
- Corpus: 179 source-derived semantic cases; Table 1: 21 combinations.
- Guidelines now render the committed governed snapshot through the read-only graph studio. The 12 views, graph identity, lifecycle, checksum and decision-support boundary are visible. Legacy routing and operational grading remain separate tabs.
- Automatic monitoring now aggregates real `RuleEvaluation`, `AuditLog`, `ClinicianDecision` and `ReferralCase` records. It covers evaluations, evaluation/adapter/authority failures, Legacy disagreement and urgent disagreement, missing-information stops, overrides, reversals, timing ambiguity, queue anomalies, de-escalation blocks and database failures. No historic values or trends are fabricated.
- Resolver and adapter failures produce append-only audit evidence and fail closed to Legacy. Shadow comparisons are recorded only when real evaluations occur.
- Candidate thresholds are explicitly labelled `PROPOSED / UNSIGNED / RISK OWNER APPROVAL REQUIRED`; no autonomous authority rollback was introduced.
- Local synthetic authenticated QA covered Command Centre, Pull Cases, preparation, Review Queue, urgent Case Review, Guidelines and Analytics at 1440, 1280, 1024 and 768 pixels. No page-level horizontal overflow was observed.

## Persistence classification

Safe Vercel configuration and build-log inspection established that Production selects remote `libsql` and has an authentication token configured. The selected adapter is shared rather than a local or `/tmp` file. Production is therefore classified `SHARED_DURABLE_CONFIRMED` without writing a canary or mutating clinical data.

The current Preview branch exposes branch-scoped Turso variable names, but a usable selected remote value could not be established from the available encrypted environment material. Preview durability remains `UNKNOWN`. Canonical activation is prohibited there until a dedicated shared non-Production database is confirmed.

## Manual rollback procedure

1. An authorised operator creates a governed rollback activation to the published Legacy pin (or deactivates canonical so the resolver fails to Legacy if the pin is not yet available).
2. Confirm new authority resolutions return Legacy.
3. Confirm a new de-identified case stores Legacy engine/ruleset provenance.
4. Confirm cases evaluated during the canonical window remain pinned to canonical.
5. Confirm no `RuleEvaluation`, decision or audit row was deleted or rewritten.
6. Confirm no database restore, data migration or redeploy occurred.
7. Confirm the rollback/deactivation audit event, operator, reason and scope.
8. Review monitoring and the affected canonical cohort for clinical safety-netting.

The mechanism has DB-backed automated coverage. An isolated local rehearsal completed in approximately **1.3 seconds observed wall-clock time**, within the five-minute target. That is **not** a shared-environment rehearsal or a claim about operator RTO. The activation gate remains open until the full procedure is timed in the dedicated shared non-Production environment, with the signed operator/deputy and signed thresholds.

## Clinical change sign-off ledger

No row below is approved until a named approver and date are entered by the appropriate human.

| Item | Old behaviour | New behaviour / proposed disposition | Source basis | Safety consequence | Affected pathway | Test evidence | Requires clinical approval | Approver | Date | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| ROUTER-002 | HPV Other + absent cytology could request cytology before resolving whether the sample was self-collected | Resolve unknown sample type first; do not prescribe potentially impossible cytology | Governed global routing and sample-type prerequisites | Prevents impossible or falsely specific next action | Global router / Figure 3 entry | Router regression and rule suite | Yes | — | — | UNSIGNED |
| ROUTER-003 | Pregnancy + malignant SCC cytology could miss the Figure 9 qualifying gate | Route to Figure 9 and urgent experienced pregnancy colposcopy | Figure 9 pregnancy qualification and malignant cytology rules | Prevents under-routing a critical presentation | Figure 9 | Router regression and rule suite | Yes | — | — | UNSIGNED |
| ROUTER-001 | Baseline flow did not apply the alleged age fork | No change; retain as not a defect | Source baseline does not use that age fork | Avoids introducing unsupported logic | Baseline routing | Source re-analysis and regression coverage | Clinical confirmation | — | — | PROPOSED NOT A DEFECT |
| F9-14 residual | Legacy expresses urgent colposcopy without explicit oncology/MDT wording | Canonical includes urgent experienced colposcopy plus oncology/MDT wording; do not harmonise in code | Governed F9-14 source wording vs Legacy implementation | Clinical semantics differ and require adjudication | Figure 9 malignant cytology | Differential/shadow evidence | Yes | — | — | UNRESOLVED |
| LEGACY-005/014/017/026 | Legacy/canonical divergence retained | Clinical panel must accept, amend or reject each documented mapping | Defect ledger and governed source references | Determines whether canonical may be published | Listed defect pathways | Conformance/differential suites | Yes | — | — | UNRESOLVED |
| Two input gaps | Inputs are unavailable or ambiguous; system fails to reviewer/safety handling | Confirm required source-data policy or accept clinician-only handling | Input-gap ledger and source mapping | Prevents unknown from becoming normal/false | Affected governed branches | Input-gap reconciliation tests | Yes | — | — | UNRESOLVED |
| Timing policy | Legacy may express operational timing independently | Machine-schedule only governed unambiguous intervals; otherwise show `Clinician timing required` with source wording | Timing classification in governed snapshot | Prevents invented recall dates | All recall pathways | Timing/adapter tests | Yes | — | — | UNSIGNED |
| Regrade policy | Third-stack update semantics and ad-hoc re-evaluation risk historical ambiguity | Explicit regrade only; append a new evaluation, retain prior evaluation and link reason/actor | Document 03 Policy D and immutable evaluation model | Preserves history and makes safety-netting auditable | All pathways | DB pinning/regrade/history tests | Yes | — | — | UNSIGNED |

## Remaining governance and security gates

- `GOV-01` through `GOV-04`, including the operating point, must be signed.
- A clinical lead must adjudicate the rows above and the full defect/input-gap ledger.
- The regrade policy, timing policy and second-approver/separation-of-duty policy must be adopted.
- A risk owner must approve numeric rollback thresholds after reviewing a real pilot baseline.
- A named rollback operator and deputy must be recorded.
- Redistribution/licensing of the governed source artifact must be approved by the appropriate legal/content owner.
- Preview must use a confirmed dedicated shared durable database; backup/restore and rollback must be rehearsed there and timed.
- Historical demo-credential exposure remains R6-open until the credential owner confirms every affected Preview/Production credential has been rotated/revoked and records evidence. Do not test an old credential.
- The third `RuleDecision` stack remains outside canonical activation until its destructive-upsert risk is removed or formally blocked by an owner; canonical `RuleEvaluation` history itself is append-only.

## Smallest human checkpoint

1. Clinical lead: complete the approver/date/status cells for ROUTER-002, ROUTER-003, ROUTER-001, F9-14, LEGACY-005/014/017/026, the two input gaps and the timing/regrade policies.
2. Governance/risk owner: sign `GOV-01..04`, second-approver policy, numerical rollback thresholds, operator/deputy and any explicit risk acceptance.
3. Legal/content owner: approve governed-source redistribution/licensing.
4. Credential owner: attest to rotation/revocation for R6 with evidence.
5. Platform owner: provision/confirm the dedicated shared Preview database, then authorise and witness restore and rollback rehearsals.

Only after all five are complete may engineering remove the code-level Production activation blocker, set the live flag through the authorised secret process, perform a limited new-case activation and follow the T+0 through T+24 monitoring hold points in document 07.
