# Independent clinical governance handoff

Prepared: 3 August 2026. Version under review: `CG-NCSP-3.1.0` (DRAFT).
Snapshot checksum: `3ab8657a13e73bb0080f18399d9165c20e9af5796bdcf594bdc71170309c824a`.

**Status: DRAFT — ENGINEERING VALIDATION PASSED — CLINICAL GOVERNANCE PENDING.**

This document *prepares* the governance gate. It does **not** perform it.

> **AI review is not clinical approval.** Every disposition below was derived at
> the software/oracle level. None has been clinically approved. No approval field
> in this document is pre-populated, and no AI agent may sign any of them.

The three source interpretations were resolved from the primary figure and the
controlling recommendation prose as a *software* correction. They remain
**pending independent governed clinical approval** before any publication may be
considered. A fourth item (GOV-04) is raised by this session as a newly detected
engine-versus-source divergence.

## How to record a decision

Use the Clinical Review workspace, not a manual database edit:

- UI: `/rules/clinical/{versionId}` → Clinical review tab
  (`components/clinical-rules/ClinicalGovernanceReviewWorkspace.tsx`)
- API: `POST /api/clinical-rules/versions/{id}/governance-review`

### Verified workflow controls

Each control below was verified against the implementation, not assumed.

| Control | Implementation | Verified |
|---|---|---|
| Proposal requires `rules:validate` | `route.ts` — permission selected by action | YES |
| Approval requires `rules:approve` | `route.ts` — `action === "APPROVE"` → `rules:approve` | YES |
| Approver cannot equal proposer | `assertSeparateGovernanceActors()` throws | YES (unit test) |
| A matching proposal must exist before approval | `"A matching proposal is required before approval."` | YES |
| Optimistic revision required | `expectedRevision` compared; 409 on conflict | YES |
| DRAFT versions only | `"Governance interpretation may only revise a draft successor."` | YES |
| Published / active / retired / archived rejected | non-DRAFT status rejected by the same guard | YES |
| Approval writes immutable audit evidence | `RuleVersionAuditEvent` written in transaction | YES |
| Approval does **not** alter the snapshot | sets `approvalStatus`, increments `revision` only | YES |
| Approval does **not** publish | no `publishedAt` write | YES |
| Approval does **not** activate | no `RuleSetActivation` write | YES |
| Weak dispositions / short comments rejected | Zod schema rejects `AUTO_APPROVE`, comments < min length | YES (unit test) |

Approval records an interpretation **inside the draft revision**. Publication and
activation remain separate, later, explicitly authorised steps that are out of
scope for this handoff.

---

## GOV-01 — Confirmed ASC-H, Type 1/2 TZ, no visible lesion

- **Case ID:** `F5-CONFIRMED-ASC-H-TREATMENT-RECOMMENDED`
- **Exact question:** When ASC-H is confirmed with a Type 1/2 transformation zone
  and no visible lesion, does the source establish a deterministic treatment
  terminal, or a specialist-led decision point in which diagnostic excision is
  *considered* and observation remains an informed option?
- **Source:** NCSP June 2023, Figure 5. Recommendations **R6.08**, **R6.09**.
  Prose printed p46 / PDF index 48; figure printed p47 / PDF index 49.
- **Figure branch:** Figure 5 box labelled "Treatment recommended".
- **Source prose interpretation:** R6.08 states diagnostic excision should be
  considered and expressly retains observation as an option. R6.09 makes deferral
  conditional on an informed participant and a documented colposcopist-led
  observation plan. The figure box abbreviates the prose; it does not establish
  that treatment was selected or completed.
- **Current canonical outcome:** `SPECIALIST_TREATMENT_DECISION_REQUIRED`
- **Prohibited inference:** `TREATMENT_SELECTED`; any treatment date; treatment
  completion.
- **Affected rule IDs:** `F5-01`, `F5-04`
- **Affected tests:** `CV2-F5-CONFIRMED-ASC-H-TREATMENT-RECOMMENDED`
- **Potential historical regrade effect:** presentation and reviewer-boundary
  wording may differ. No historical evaluation is rewritten. Interim safety stop
  required: **no**.
- **Precedence check:** the February 2026 addendum and March 2026 immune-deficiency
  guidance do not supersede this decision point.

**Reviewer decision options:** (a) confirm `SPECIALIST_TREATMENT_DECISION_REQUIRED`;
(b) require a deterministic treatment terminal; (c) require an additional safety
stop; (d) defer pending further source review.

| Field | Value |
|---|---|
| Proposer (name, role, `rules:validate`) | ☐ _______________________ |
| Proposed disposition | ☐ _______________________ |
| Independent approver (name, role, `rules:approve`) | ☐ _______________________ |
| Approval decision | ☐ _______________________ |
| Date | ☐ _______________________ |
| Signature / identity reference | ☐ _______________________ |
| Final governance disposition | ☐ PENDING |

---

## GOV-02 — Figure 5 observation followed by reassuring six-month results

- **Case ID:** `F5-TREATMENT-DEFERRED-HPV-NOT-DETECTED-TOC`
- **Exact question:** After observation is selected under Figure 5 and the
  six-month co-test is reassuring, does the participant enter Figure 5 specialist
  co-test surveillance, or ordinary post-treatment Figure 6 Test of Cure?
- **Source:** NCSP June 2023, Figure 5. Recommendation **R6.09**.
  Prose printed p46 / PDF index 48; figure printed p47 / PDF index 49.
- **Figure branch:** Figure 5 branch labelled "Test of Cure (co-testing)".
- **Source prose interpretation:** R6.09 requires repeat HPV, cytology and
  colposcopy at six months after observation is selected. If HPV is not detected,
  cytology is negative and the impression is unchanged, R6.09 requires another
  co-test at 12 months. Only a **second** HPV-not-detected / negative co-test
  returns the participant to regular screening. The Figure 5 label does not
  assert that HSIL treatment occurred.
- **Current canonical outcome:** `FIGURE_5_COTEST_SURVEILLANCE`, preserving
  Figure 5 provenance and requiring the two-stage negative sequence.
- **Prohibited inference:** prior HSIL treatment; treatment date; ordinary
  Figure 6 eligibility derived from the label "Test of Cure".
- **Affected rule IDs:** `F5-05`, `F5-08`
- **Affected tests:** `CV2-F5-TREATMENT-DEFERRED-HPV-NOT-DETECTED-TOC`
- **Potential historical regrade effect:** provenance and sequence wording may
  change; the prior evaluation remains immutable. Interim safety stop required:
  **no**.
- **Precedence check:** the 2026 documents do not replace R6.09.

**Reviewer decision options:** (a) confirm `FIGURE_5_COTEST_SURVEILLANCE`;
(b) route to ordinary Figure 6 Test of Cure; (c) require an additional safety
stop; (d) defer pending further source review.

| Field | Value |
|---|---|
| Proposer (name, role, `rules:validate`) | ☐ _______________________ |
| Proposed disposition | ☐ _______________________ |
| Independent approver (name, role, `rules:approve`) | ☐ _______________________ |
| Approval decision | ☐ _______________________ |
| Date | ☐ _______________________ |
| Signature / identity reference | ☐ _______________________ |
| Final governance disposition | ☐ PENDING |

---

## GOV-03 — First versus second consecutive low-grade cytology during Test of Cure

- **Case ID:** `F6-18M-HPV-NOT-DETECTED-LOW-GRADE-REPEAT`
- **Exact question:** During post-HSIL Test of Cure with HPV not detected, does a
  **first** low-grade cytology result repeat co-testing, and does only the
  **second consecutive** low-grade result route to colposcopy?
- **Source:** NCSP June 2023, Figure 6. Recommendations **R8.06**, **R8.07**,
  **R8.08**. Prose printed p55 / PDF index 57; figure printed p56 / PDF index 58.
- **Figure branch:** Figure 6 low-grade cytology arrows.
- **Source prose interpretation:** R8.07 sends any HPV-positive post-treatment
  result with negative/ASC-US/LSIL cytology to colposcopy. For HPV-negative
  results, R8.07 requires colposcopy after **two consecutive** low-grade cytology
  results; the Figure 6 arrows retain repeat co-testing for the first. R8.08
  separately sends ASC-H/HSIL or glandular cytology to colposcopy regardless of
  HPV status.
- **Current canonical outcome:** first HPV-not-detected low-grade → repeat
  co-testing; second consecutive low-grade → colposcopy; HPV detected →
  colposcopy; high-grade/glandular → colposcopy.
- **Prohibited inference:** that any single low-grade result automatically
  completes Test of Cure, or that it always requires colposcopy.
- **Missing longitudinal sequence history remains a review stop.**
- **Affected rule IDs:** `F6-07`, `F6-09`, `F6-14`
- **Affected tests:** `CV2-F6-18M-HPV-NOT-DETECTED-LOW-GRADE-REPEAT`
- **Potential historical regrade effect:** a regrade may differ where
  consecutive-result provenance is present. Interim safety stop required: **no**.

**Reviewer decision options:** (a) confirm the first/second distinction;
(b) require colposcopy on the first low-grade result; (c) require an additional
safety stop where sequence history is absent; (d) defer pending further source
review.

| Field | Value |
|---|---|
| Proposer (name, role, `rules:validate`) | ☐ _______________________ |
| Proposed disposition | ☐ _______________________ |
| Independent approver (name, role, `rules:approve`) | ☐ _______________________ |
| Approval decision | ☐ _______________________ |
| Date | ☐ _______________________ |
| Signature / identity reference | ☐ _______________________ |
| Final governance disposition | ☐ PENDING |

---

## GOV-04 — Clinician-only boundary is applied far more broadly than the source model

**Raised by this session.** This item is **new** and is not one of the original
three source ambiguities. It is an engine-versus-source divergence, not a
question about guideline meaning — but resolving it changes a safety boundary, so
it requires governance rather than an engineering decision.

- **Exact question:** Should the canonical engine treat a rule as *clinician-only*
  (never autonomously finalising) whenever its `reviewerRequirement` is
  `CLINICIAN_REVIEW`, or only for the 11 rules the source model marks as
  clinician-only?
- **Evidence:** the regenerated differential
  (`22-canonical-v2-differential-results.json`) reports **99 of 179** cases with a
  metadata difference. The single mismatching field in every one of the 99 is
  `clinicianOnly`.
- **Direction (measured):** all 99 are expected `false` → actual `true`, i.e.
  **more restrictive**. Safety relaxations: **0**. Action-class differences across
  all 179 cases: **0**. Implementation defects: **0**.
- **Root cause:** `lib/clinical-rules/evaluator.ts` falls back to
  `/clinician|mdm|specialist/i` tested against
  `` `${automationBoundary} ${reviewerRequirement}` `` when a rule leaves
  `clinicianOnly` undefined. 187 of 203 compiled rules leave it undefined, and
  `reviewerRequirement` is `CLINICIAN_REVIEW` for most of them, so the pattern
  matches. Worked example: `F3-01` (routine 5-yearly recall, HPV not detected)
  evaluates to `clinicianOnly = true`.
- **Source model:** exactly **11** clinician-only rules — 7 rule-level plus 4
  branch-level — independently confirmed against the compiled snapshot.
- **Why this was not "fixed" here:** narrowing the fallback would flip ~99 cases
  from `clinicianOnly = true` to `false`. That **relaxes** a safety boundary — the
  boundary that prevents autonomous recording of treatment, biopsy, excision, MDM
  agreement, specialist approval and clinical completion. Deciding which rules
  genuinely bound autonomous finalisation is a clinical-governance judgement. It
  was therefore escalated rather than applied.
- **Current behaviour is fail-safe:** it over-restricts, never under-restricts,
  and routing is unaffected.
- **Publication impact:** the differential's own gate text states that any
  metadata difference remains a publication blocker. GOV-04 is therefore an open
  publication blocker.

**Reviewer decision options:** (a) confirm the broad fail-safe behaviour as
intended and amend the oracle expectation; (b) restrict `clinicianOnly` to the 11
source-designated rules and record the boundary change; (c) require explicit
`clinicianOnly` on all 203 compiled rules so no fallback is ever used
(recommended by engineering as the option that removes the ambiguity rather than
resolving it by heuristic); (d) defer.

Any option that changes evaluated clinical behaviour requires a new semantic
successor — normally `CG-NCSP-3.2.0` — because `CG-NCSP-3.1.0` already carries 18
SIMULATION evaluations and its snapshot must not be mutated.

| Field | Value |
|---|---|
| Proposer (name, role, `rules:validate`) | ☐ _______________________ |
| Proposed disposition | ☐ _______________________ |
| Independent approver (name, role, `rules:approve`) | ☐ _______________________ |
| Approval decision | ☐ _______________________ |
| Date | ☐ _______________________ |
| Signature / identity reference | ☐ _______________________ |
| Final governance disposition | ☐ PENDING |

---

## Governance boundary

- These dispositions close the **software/oracle** ambiguity only.
- They do not publish and do not activate the successor.
- The legacy engine remains the displayed clinical authority.
- Canonical evaluation remains SHADOW / SIMULATION only.
- `CG-NCSP-3.0.0` and `CG-NCSP-3.1.0` remain DRAFT, unpublished and inactive.
- Any source-backed clinical change requires a new semantic successor (normally
  `CG-NCSP-3.2.0`) and only after an explicit governance decision.
- Clinician-only branches must never autonomously record treatment, biopsy,
  excision, MDM agreement, specialist approval or clinical completion.
- Unknown, absent, pending, conflicting and not applicable remain distinct.
- Provisional recommendation. Reviewer confirmation required.
- Not for direct clinical action. Demo environment. Simulated export package.

**Final status: DRAFT — ENGINEERING VALIDATION PASSED — CLINICAL GOVERNANCE PENDING.**
