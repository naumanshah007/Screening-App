# 07 — Proposed Cutover Runbook (Phase 14)

**PROPOSAL ONLY. NOT EXECUTED. No step below has been performed.**

Strategy: doc 04 Option 3 + 4 — **organisation-scoped activation, new cases only, existing cases pinned, regrade by explicit reviewer action.**

Scope of this runbook: activation for **one named pilot organisation**. Global activation is a separate, later runbook that reuses these steps once the pilot's metrics are accepted.

Roles (name real people before T-7; a role with no name is an unowned step):
- **CRO** — Clinical Risk Owner (signs H1–H6)
- **CA1 / CA2** — two independent clinical approvers
- **ADM** — activating administrator, distinct from CA1/CA2
- **ENG** — on-call engineer
- **OPS** — on-call rollback operator + named deputy

---

## T-7 days — Evidence and sign-off

1. **ENG** pin the commit SHA. Record it. Every subsequent gate refers to this SHA, never to a branch name (EXEC-00).
2. **ENG** land the engineering blockers as separate, individually reviewable commits:
   - OUT-01 remove regex urgency from the authority path
   - OUT-02 interval parser with safety-stop-on-failure
   - OUT-03 overlay inert under canonical + Admin notice
   - IN-02 `DERIVED_ROUTER` fact source
   - EXEC-03 export provenance corrected
   - ACT-05 activation cache TTL 0 in production
   - A11 alias-registry fix
   - ACT-01 **production activation guard removal — its own commit, nothing else in the diff**
3. **ENG** run migration `ALTER TYPE "RuleEvaluationMode" ADD VALUE 'LIVE_PRODUCTION'` in `VALIDATION`. Verify `enum_range`.
4. **ENG** run the **full** acceptance suite (doc 06, gate groups A–F) in `VALIDATION`. Publish artefacts.
5. **ENG** stand up monitors (SEC-03 / G5) and confirm they emit.
6. **OPS + ENG** **rehearse rollback end-to-end in `VALIDATION` and record the wall-clock time** (F2). If it exceeds 5 minutes, stop and fix before proceeding.
7. **ENG** rehearse database restore (G4). Record the time.
8. **Security:** close R6 in the production environment and evidence it (G1, SEC-01). Obtain signed R1–R5 acceptances (G2). Complete authenticated production-readiness QA (G3).
9. **CRO** sign H1–H7. **In particular H3** — the acknowledgement that canonical is a within-pathway decision layer over a retained legacy router.
10. **CRO + ENG** agree the rollback trigger thresholds **numerically** (G6) and the named operators (G7).
11. **Communications:** brief the pilot organisation's reviewers. They must be told, before the day, that (a) the safety-stop and clinician-only rate will rise sharply (GOV-04), (b) bleeding cases will newly stop for missing work-up information (IN-03), (c) the queue will contain both legacy and canonical decisions and how to tell them apart, and (d) how to raise a concern.

**Stop condition:** any unsigned item in step 8 or 9 → do not proceed.

## T-24 hours — Freeze and prepare

12. Change freeze on `main`. No unrelated deploys.
13. **Verified database backup**, with a restore-time estimate from step 7. Record the backup ID.
14. Confirm no large batch run is scheduled to straddle T-0. If one is in flight, it completes on legacy (doc 03).
15. Snapshot row counts and checksums of `RuleEvaluation`, `BatchReviewItem`, `ScreeningSession`, `WizardSession`, `AuditLog` — this is the **D1 baseline** for proving nothing historical moved.
16. Re-run gate group A against the pinned SHA. Confirm still green.
17. Confirm **OPS** and deputy are available for the T+24h window.

## T-1 hour — Final checks

18. Confirm CG-NCSP-3.1.0 is **VALIDATED with two APPROVAL events from distinct actors** (ACT-03 / F4).
19. Confirm production monitors are green and alerting.
20. Confirm the pilot `organisationKey` is set and correct. **Re-read it aloud.** A wrong key here means a global activation.
21. **ADM** confirm the legacy pin version (ACT-04, `CG-LEGACY-1.0.0`) exists and is `PUBLISHED`, so canonical activation has a predecessor to deactivate and rollback has a real target.
22. Go / no-go call: **CRO, ADM, ENG, OPS**. Any single no-go stops the cutover.

## T-0 — Deployment

23. Deploy the pinned SHA to production. **Deployment alone changes no clinical behaviour** — with no `PRODUCTION` activation row, `resolveClinicalAuthority` returns LEGACY. This is the design's key property: deploy and activate are separable, and this step is reversible by a normal redeploy.
24. Production migration: add the `LIVE_PRODUCTION` enum value. Verify.
25. **Smoke tests, legacy authority still in force:**
   - login and session works
   - the 12 router probes reproduce production results (B1)
   - one synthetic wizard case end-to-end → correct legacy result
   - one synthetic batch row → worklist → export
   - audit rows written
   - monitors emitting
26. **Hold for 60 minutes on legacy under the new code.** Confirm zero error-rate change. This isolates *deployment* defects from *activation* defects — without this hold, a rollback cannot distinguish them.

## T+0 — Activation

27. **ADM** publish CG-NCSP-3.1.0 (`PUBLICATION` event, reason recorded).
28. **ADM** activate: `environment: PRODUCTION`, `organisationKey: <pilot>`, reason recorded, production confirmation token.
29. Verify immediately:
   - `RuleSetActivation` row created, `isDefault`, `deactivatedAt` null
   - predecessor deactivated in the same transaction
   - `ACTIVATION` + `DEACTIVATION` audit events present
   - **another organisation still resolves to LEGACY** (F7 — verify in production, not just in test)
30. **Synthetic canonical case**, pilot org, known expected output: verify recommendation, `matchedRuleIds`, version display, checksum, **integer recall date present and correct**, provenance badge renders, audit row written with `evaluationMode = LIVE_PRODUCTION`.
31. **Do not release the synthetic case into the reviewer queue.** Mark and exclude it.

## T+15 minutes

32. Adapter parse-failure count — **any non-zero → rollback**.
33. Null `nextScreeningDue` on recall-required decisions — **any → rollback**.
34. Error rate vs the T-0 baseline.
35. First real canonical decisions reviewed by a clinician **before** any act on them. Confirm provenance badge and missing-information labels are legible.
36. Cross-org leakage check repeated.

## T+1 hour

37. Safety-stop and `clinicianOnly` rate vs the signed GOV-04 operating point (**±5 pp**, A10).
38. Reviewer queue depth vs the pre-agreed capacity threshold.
39. Spot-check ≥10 canonical decisions against the oracle. **Any case where canonical is less urgent than legacy on the same facts → immediate rollback.**
40. Confirm no legacy case changed authority (D4) and no batch run went mixed (D5).
41. Reviewer check-in call — ask directly whether anything looked wrong.

## T+24 hours

42. Re-run the D1 baseline comparison. **Historical records rewritten must be 0.**
43. Full discrepancy review of every canonical decision in the window.
44. Reviewer workload report vs the accepted operating point.
45. Export provenance audit (D6): every package's checksum matches its deciding authority.
46. **CRO + ADM + ENG + OPS** review. Decide: continue pilot / expand / roll back.

## Rollback decision point — continuous from T+0 to T+24h, then daily

**Any one of these triggers rollback. Not a discussion — a trigger.**

| Trigger | Threshold |
|---|---|
| Canonical less urgent than legacy on identical facts | **any 1 case** |
| Adapter parse failure | **any 1** |
| Null recall date on a recall-required decision | **any 1** |
| Cross-org authority leakage | **any 1** |
| Clinician-reported harm or near-miss | **any 1** |
| Safety-stop rate above the agreed capacity threshold | as signed (G6) |
| Error rate above baseline | as signed (G6) |
| Discretionary call by CRO or on-call clinical lead | at will |

**Rollback procedure** (doc 04): **OPS** executes `activateClinicalRuleVersion({ id: <legacy pin>, environment: PRODUCTION, organisationKey: <pilot>, rollback: true, reason })`. Target ≤5 minutes. Then:

- verify a new evaluation now resolves to LEGACY;
- verify **cases decided during the canonical window remain pinned to canonical** and were not altered;
- verify **0 records deleted, 0 rewritten, 0 audit rows lost**;
- no deploy, no restore, no migration, no restart;
- **the deployed code stays deployed** — only the authority moves;
- notify reviewers immediately that the authority has reverted and what that means for cases already in their queue;
- identify the affected cohort by `ruleVersionId` + `evaluatedAt` range (both indexed) and hand it to clinical safety-netting. **Do not bulk-regrade.**

## After a rollback

Do not re-activate on the same day. Root-cause first, fix, re-run the full acceptance suite against a new pinned SHA, re-sign, and re-enter this runbook at T-7.
