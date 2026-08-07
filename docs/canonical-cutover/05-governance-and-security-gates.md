# 05 — Clinical, Security and Operational Gates

Covers brief Phases 9, 10 and 12.

---

# Phase 9 — Clinical blockers

**Clinical questions are not decided here.** Items marked **[HUMAN CLINICAL DECISION]** require a named clinical risk owner's signature.

| Item | What it is | Classification | Notes |
|---|---|---|---|
| **GOV-01** | Confirmed ASC-H, Type 1/2 TZ, no visible lesion | **BLOCKS_ONLY_SPECIFIC_PATHWAY** (Figure 4/5 colposcopy branch) **[HUMAN CLINICAL DECISION]** | Canonical can activate with this pathway routed to a safety stop pending adjudication. |
| **GOV-02** | Figure 5 observation → reassuring six-month results | **BLOCKS_ONLY_SPECIFIC_PATHWAY** (Figure 5) **[HUMAN CLINICAL DECISION]** | As above. Note the related alias defect below. |
| **GOV-03** | First vs second consecutive low-grade cytology during Test of Cure | **BLOCKS_ONLY_SPECIFIC_PATHWAY** (Figure 6 ToC) **[HUMAN CLINICAL DECISION]** | As above. |
| **GOV-04** | Source oracle requires `clinicianOnly` on 53/179; canonical sets it on **152/179**. 99 over-restrictions, **0 under-restrictions**. | **CAN_BE_ACCEPTED_WITH_DOCUMENTED_POLICY** — but see below **[HUMAN CLINICAL DECISION]** | **Fail-safe in direction, so not a safety blocker.** It is a *viability* blocker: at 85% clinician-only, plus `mandatoryReviewerConfirmation` hardcoded `true` (`evaluator.ts:320`), plus IN-03's new bleeding-case stops, canonical authority delivers **near-zero automation**. Activating without deciding the operating point means knowingly shipping a system that will overwhelm reviewer capacity. The decision needed is not "is it safe" (it is) but "is the reviewer workload accepted, and at what operating point". |
| **LEGACY-005** | `F3-CYTOLOGY-PENDING-INCOMPLETE` — `MISSING_DATA_COLLAPSE`, HIGH, → SAFETY_STOP | **CAN_BE_ACCEPTED_WITH_DOCUMENTED_POLICY** **[HUMAN CLINICAL DECISION]** | Canonical is *more* conservative than legacy here. Safe to activate; the open question is the historical cohort (doc 03 HIST-03), not the forward behaviour. |
| **LEGACY-014** | `F5-TREATMENT-DEFERRED-HPV-DETECTED-NORMAL-12M` — wrong pathway, MEDIUM, canonical result `UNMAPPED_ACTUAL` | **BLOCKS_ONLY_SPECIFIC_PATHWAY** (Figure 5) **[HUMAN CLINICAL DECISION]** | `UNMAPPED_ACTUAL` means canonical produces a state the mapping does not recognise. Must be adjudicated or the Figure 5 branch must route to a stop. |
| **LEGACY-017** | `F7-NO-LESION-AG2-CONFIRMED-INVESTIGATE` → GYNAECOLOGY | **BLOCKS_ONLY_SPECIFIC_PATHWAY** (Figure 7) **[HUMAN CLINICAL DECISION]** | |
| **LEGACY-026** | `F9-NORMAL-TZ-MDM-CONFIRMS-HIGH-GRADE-REVIEW` → MDM_REVIEW | **BLOCKS_ONLY_SPECIFIC_PATHWAY** (Figure 9 pregnancy) **[HUMAN CLINICAL DECISION]** | Pregnancy pathway — low volume, high consequence. |
| **2 remaining input-gap adjudications** (stage-1A1; non-cervical-cancer hysterectomy overlay) | states the deployed contract cannot express | **BLOCKS_ONLY_SPECIFIC_PATHWAY** **[HUMAN CLINICAL DECISION]** | No mapping was invented. Absent → safety stop. Fail-safe. |
| **`clinicianOnly` operating point** | see GOV-04 | **BLOCKS_CANONICAL_ACTIVATION** **[HUMAN CLINICAL DECISION]** | Must be a signed number before activation, because reviewer capacity is a patient-safety control. |
| **Regrade policy for the 26 defects** | 22 corrected, 4 open; all regrade-impacting | **BLOCKS_CANONICAL_ACTIVATION** **[HUMAN CLINICAL DECISION]** | doc 03 HIST-03. Required *before*, not after. |
| **EXEC-01 / IN-02** — canonical has no router; `currentPathway` is legacy output relabelled as a clinical fact | architectural | **BLOCKS_CANONICAL_ACTIVATION** — engineering fix + **[HUMAN CLINICAL DECISION]** to accept the conditional model | The most consequential item in this assessment. The risk owner must not sign a document that says "canonical replaces legacy". |
| **OUT-01** — regex-inferred urgency | `inferUrgency()` derives priority from free text | **BLOCKS_CANONICAL_ACTIVATION** — **ENGINEERING_ONLY** | Ungoverned, unchecksummed clinical derivation. Must be encoded in the ruleset or taken from legacy. |
| **OUT-02** — free-text `repeatInterval` → recall date | parse failure ⇒ null `nextScreeningDue` ⇒ participant never recalled | **BLOCKS_CANONICAL_ACTIVATION** — **ENGINEERING_ONLY** | Highest-consequence adapter defect risk. Parse failure must be a safety stop. |
| **OUT-03** — guideline overlay keyed on legacy `recommendationCode` | admin-configured forced reviews and warnings silently stop applying | **BLOCKS_CANONICAL_ACTIVATION** — **ENGINEERING_ONLY** (+ a policy note) | Silent loss of a safety control is worse than an explicit removal. Recommend disabling the overlay under canonical authority, visibly. |
| **HIST-01** — `RuleDecision` upsert overwrites prior recommendations | separate cases stack | **NOT_RELEVANT_TO_CUTOVER** | Pre-existing defect, log separately. Do not fix inside the cutover change. |
| **Alias-registry defect** — `conformance-runner.ts` `equivalent()` collapses `FIGURE_5_COTEST_SURVEILLANCE` into `TEST_OF_CURE` | test-harness correctness | **ENGINEERING_ONLY — but gates the evidence** | It can mask a genuine Figure 5 / Figure 6 confusion. Since GOV-02 and LEGACY-014 are both Figure 5, the acceptance evidence for those two items is not trustworthy until this is fixed. Fix before the acceptance run. |
| **ACT-05** — 30 s in-memory activation cache across serverless instances | mixed authority window | **ENGINEERING_ONLY** | |
| **EXEC-03** — export carries shadow checksum beside a legacy decision | provenance mislabel | **ENGINEERING_ONLY** | Should be fixed regardless of cutover. |
| **EXEC-00** — brief names commit `94250e1`; branch tip is `ab1eb0e` | evidence hygiene | **ENGINEERING_ONLY** | Pin the SHA in every gate. |

## Summary

- **Hard activation blockers:** GOV-04 operating point; regrade policy; EXEC-01/IN-02 acceptance; OUT-01; OUT-02; OUT-03. (Three clinical, three engineering.)
- **Pathway-limited blockers:** GOV-01, GOV-02, GOV-03, LEGACY-014, LEGACY-017, LEGACY-026, the 2 input-gap adjudications. **A pathway-limited activation is possible**: activate canonical while routing the unadjudicated pathways to an explicit safety stop. This is a legitimate way to start delivering the 22 corrections without waiting on every clinical question — but it must be an explicit, documented scope, not an accident.
- **Not blocking:** LEGACY-005 (fail-safe forward), HIST-01 (different stack).

---

# Phase 10 — Security and operational gates

The three gates are genuinely different, and conflating them is how this kind of change goes wrong.

| Item | A. Merge code | B. Deploy code | C. **Activate clinical authority** |
|---|---|---|---|
| **R1** Nodemailer `raw` advisory (runtime, HIGH, unsigned) | no | **YES** — runtime dependency reachable from notifications | **YES** |
| **R2** Next.js → postcss/sharp (HIGH, unsigned) | no | **YES** | yes (transitively) |
| **R3** Prisma Studio / tooling | no | no | no |
| **R4** ExcelJS / uuid | no | **YES** if batch upload parses untrusted workbooks | yes |
| **R5** ESLint / esbuild (dev-only) | no | no | no |
| **R6** Public demo credential exposure | no | **YES** | **YES** |
| Authentication | no | **YES** | **YES** |
| Admin permissions | no | yes | **YES** |
| Ruleset activation permissions | no | no | **YES** |
| Audit integrity | no | yes | **YES** |
| Vercel deployment model | no | **YES** | **YES** (ACT-05) |
| Production cron | no | **YES** | yes |
| DB backup / restore | no | **YES** | **YES** |
| Logging | no | yes | **YES** |
| Monitoring | no | yes | **YES** |

## Detail

**R6 — public demo credential exposure.** Partially remediated on the candidate branch: `4a47c12` removed the credentials from the login page and `tests/security/login-no-credential-exposure.test.ts` guards the regression. `017a62f` records the status as **partial**. The register still carries `OPEN_SECURITY_REMEDIATION_REQUIRED` and the acceptance is **unsigned**. Removing the *display* does not invalidate the *credentials* — if those accounts still exist and still work against the production deployment, the exposure is live regardless of what the page renders.

> **Finding SEC-01 (BLOCKS C, BLOCKS B).** Confirm and evidence that the demo accounts are disabled or their secrets rotated in the production environment — not merely hidden from the login page. **Do not treat the UI commit as closing R6.** A clinical authority change must not be activated on a deployment with known-valid published credentials. *(No credential was read, entered, tested or printed during this assessment.)*

**R1–R5 acceptance is unsigned.** All five carry `PENDING_SECURITY_RISK_DECISION`. R1, R2 and R4 are runtime or conditional-runtime and gate **deployment**. None of them gates *merging*. Merging to an integration branch is safe and should not be held hostage to dependency-risk signatures.

**Ruleset activation permissions.** `rules:activate` and `rules:rollback` are ADMIN-only (`permissions.ts:52-53`) — correct. But note the composition: ADMIN holds `edit`, `approve`, `publish`, `activate` **and** `rollback` simultaneously. The creator≠approver rule (`lifecycle.ts:297`) is the *only* separation of duty, and it does not prevent one ADMIN from approving someone else's draft, publishing it, and activating it alone.

> **Finding SEC-02 (BLOCKS C).** Separation of duty is insufficient for a production clinical authority change. Require, as policy enforced at publish time (per ACT-03): two distinct clinical approvers, and an activating operator distinct from both. No schema change needed — assert over `RuleVersionAuditEvent`.

**Audit integrity.** Strong: dual-write to `RuleVersionAuditEvent` and `AuditLog` inside the same transaction, with IP and user agent, plus three DB triggers enforcing evaluation immutability. **Gap:** `AuditLog` has no tamper-evidence (no hash chain, no append-only DB grant). For a screening programme this is worth raising, but it is a pre-existing property, not a cutover blocker.

**Vercel / operational.**
- **Backup/restore evidence is required before C.** The rollback design deliberately does *not* need a restore — but "we never need it" is not a reason to activate without a tested restore. Evidence of a **restore rehearsal**, not just a backup schedule.
- **Cron:** confirm which scheduled jobs (recall generation, overdue-recall analytics, notifications) consume `nextScreeningDue`. These are the downstream victims of OUT-02, and a null recall date surfaces here first — which makes cron output the best early-warning monitor.
- **Logging/monitoring:** there is currently no metric for "canonical safety-stop rate" or "adapter parse failure". Both are rollback triggers (doc 04), so **both must exist before activation, or the rollback triggers are unmeasurable.**

> **Finding SEC-03 (BLOCKS C, ENGINEERING).** Ship the two monitors before activation: (1) adapter parse-failure count — alert on any non-zero; (2) safety-stop and `clinicianOnly` rate per hour against the agreed GOV-04 operating point. Without these, the doc 04 rollback thresholds cannot be evaluated and the rollback plan is decorative.

**Authenticated production-readiness QA has not been performed.** It gates B and C.

---

# Phase 12 — User interface impact

**Preference honoured: keep the existing CerviGrade application, replace the clinical rules underneath it.** That is achievable. The adapter (doc 02) preserves the `ClinicalDecision` shape, so every screen keeps working.

## Retained unchanged

Command Centre, Pull Cases, Review Queue, Completed Decisions, Audit Trail, Operational Analytics, Pilot Readiness, Rule Governance, Guidelines, Admin, NCSR, integrations, automation — **all retained**. No screen is removed, no navigation changes, no workflow is redesigned.

## Genuinely required UI changes (six, all additive)

| # | Change | Where | Why required |
|---|---|---|---|
| 1 | **Active ruleset / version indicator** — `CG-NCSP-3.1.0` + short checksum, persistent | global header or Command Centre | A clinician must be able to tell, without asking, which authority decided what they are looking at. Non-negotiable for a governed change. |
| 2 | **Per-decision provenance badge** — version, checksum, `matchedRuleIds`, `LEGACY` vs `CANONICAL` | Review Queue row + decision detail + Completed Decisions | Under Policy A the queue contains **both** authorities simultaneously. Without a badge, reviewers silently compare incomparable decisions. This is the highest-priority UI item. |
| 3 | **Missing-information rendering** — fact-name → human label via the shipped field dictionary | decision detail, `NEEDS_INFO` view | Canonical returns `preTreatmentHpvGenotype`; a reviewer needs "Pre-treatment HPV genotype". Without this, every safety stop is unactionable. |
| 4 | **Regrade action + regrade indicator** — "Regrade under current ruleset", mandatory reason, and a visible marker plus link to the superseded evaluation | case detail | Policy D has no UI today. Also the only way a reviewer can move a pinned legacy case forward. |
| 5 | **Activation status + rollback control** | Rule Governance / Rule Studio | Rollback must be executable in ≤5 min by an on-call operator under pressure. It cannot be a script. |
| 6 | **Reviewer warning banner** on canonical safety stops, distinguishing "missing information" from "conflicting information" from "no governed rule covers this" | decision detail | Canonical has three distinct stop reasons; legacy had one. Collapsing them loses the actionable part. |

Plus one **removal-with-notice**: if OUT-03 is resolved by disabling the guideline overlay under canonical authority, the Admin overlay screen must say so explicitly rather than accepting edits that will never apply.

## Explicitly out of scope

No product redesign, no new dashboards, no rule-authoring UX work, no navigation restructure. Six additive components and one notice.
