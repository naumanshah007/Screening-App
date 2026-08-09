# Router-level defect register

Date: 4 August 2026. Scope: defects reachable through `evaluateClinicalDecision`,
the application entry point, rather than through the figure evaluators.

## Why this register exists

The 179-case clinical conformance corpus drives the figure evaluators directly
and never enters the router. The router owns age gating, the pregnancy/bleeding
precedence chain and the overlay wrapper. Everything in that layer was untested
by the corpus.

Building `lib/engine/__tests__/source-router-regression.test.ts` closed the gap
and immediately found two classes of problem: the R1 staleness (now resolved by
integration) and **three previously unrecorded defects that are live in
production today**.

## ROUTER-000 — R1 age-gate staleness — **RESOLVED**

| Field | Value |
|---|---|
| Symptom | 9 of 12 router probes less safe on the standalone candidate branch |
| Cause | Branch forked from `578b4b0`, before `ea4e7e3` |
| Present in production `fb933c3` | **No** — production has the fix |
| Present in this integration branch | **No** — resolved |
| Verification | router probes 0/12 differ from production |
| Status | **RESOLVED BY INTEGRATION** |

## New defects — present in the deployed production build

All three were confirmed by running the identical suite against the reproduced
production build at `fb933c3`: **14 pass / 3 fail, exactly the same three.** They
are therefore pre-existing live defects, not integration regressions.

They are marked `todo` in the committed suite so the gate stays green and honest.
**No assertion was weakened, and no clinical rule was changed to make them pass.**

---

### ROUTER-001 — missing age silently selects an age-dependent branch

| Field | Value |
|---|---|
| Test | `router: missing age where age changes routing must not silently pick a branch` |
| Observed | Omitting `patientAge` yields the same terminal action as supplying `patientAge: 52` for an HPV-Other / negative-cytology state |
| Expected | An information request, or a different disposition from the ≥50 branch |
| Source basis | Figure 3 branches on age ≥50 for HPV Other; the branch cannot be selected without an age |
| Clinical risk | A participant of unknown age is silently graded down one branch of a real age fork, with no missing-information flag |
| Present in production | **Yes** |
| Severity | **Medium-High** |
| Status | **OPEN** |

### ROUTER-002 — missing sample type collapses to a terminal 5-year interval

| Field | Value |
|---|---|
| Test | `router: missing sample type must not resolve to a terminal screening interval` |
| Observed | `sampleType: undefined` with HPV not detected yields `F3-HPV-NOT-DETECTED-5Y` |
| Expected | A safety stop — `F3-MISSING-SAMPLE-TYPE-SAFETY-STOP` is a source branch |
| Source basis | Sample type (LBC vs swab) is a required input for the Figure 3 baseline branch |
| Clinical risk | A participant with unknown sample type is given a **5-year recall** rather than being asked for the missing fact |
| Relationship | Router-level twin of **LEGACY-006** (`MISSING_DATA_COLLAPSE`), which the canonical engine already corrects at figure level |
| Present in production | **Yes** |
| Severity | **High** |
| Status | **OPEN** |

### ROUTER-003 — pregnancy with malignant cytology falls through the Figure 9 gate

| Field | Value |
|---|---|
| Test | `router: pregnancy with malignant cytology routes to the pregnancy pathway and escalates` |
| Observed | `isPregnant: true` with `cytologyResult: "SCC"` yields `F3-HPV-REQUIRED` (MEDIUM, no referral) |
| Expected | Route to Figure 9 and escalate |
| Cause | The router gate is `currentFigure === "FIGURE_9" \|\| (isPregnant && isPregnancyQualifyingCytology(cytologyResult))`. Malignant cytology does not satisfy the qualifying-cytology predicate, so the case falls through to Figure 3, which asks for an HPV result first. |
| Clinical risk | **A pregnant participant with malignant cytology is asked for an HPV test instead of being escalated.** |
| Present in production | **Yes** |
| Severity | **High** |
| Note | The canonical engine handles this correctly — `F9-14`, *"urgent experienced colposcopy and oncology/MDT"* — and the existing `PREGNANCY-MALIGNANT-CYTOLOGY` shadow-comparison case already documents legacy's `F9-QUALIFYING-CYTOLOGY-REQUIRED` divergence. This register records that the same divergence is reachable through the **router**, where a real user request lands. |
| Present in production | **Yes** |
| Status | **OPEN** |

---

## Summary

| Metric | Count |
|---|---:|
| Router probes in the committed suite | **17** |
| Passing | **14** |
| Failing | **0** |
| Known defects marked `todo` | **3** |
| Resolved by this integration | **1** (ROUTER-000) |
| **New live production defects discovered** | **3** |

## Relationship to the 26-defect register

These are **additional** to `docs/rule-studio/24-legacy-defect-register.json`,
which was derived from figure-level evaluation. ROUTER-002 is the router-level
twin of LEGACY-006; ROUTER-001 and ROUTER-003 have no figure-level counterpart
and would not have been found without entering the router.

---

# Re-analysis and disposition — 9 August 2026

Each defect was re-probed at the exact branch point it names, rather than at the
state the original test happened to use. **Two of the three were mis-located:
the engine was already correct at the real fork, and the probe was comparing two
states the source defines as identical.** One was real and is now fixed.

## ROUTER-001 — **NOT A DEFECT. CLOSED.**

The age ≥50 fork is at `FIRST_REPEAT`, not at baseline. Probed directly:

| State | age 52 | age 30 | age absent |
|---|---|---|---|
| `BASELINE` | `…NEG-ASCUS-LSIL-12M` | `…NEG-ASCUS-LSIL-12M` | `…NEG-ASCUS-LSIL-12M` |
| `FIRST_REPEAT` | `F3-FIRST-REPEAT-AGE50-COLP` | `F3-FIRST-REPEAT-UNDER50-SECOND-REPEAT` | `F3-FIRST-REPEAT-AGE-REQUIRED` |

At baseline the source gives every age the same 12-month repeat, so the original
probe compared two states the guideline defines as identical. At the real fork
the engine **already requests the age**. No engine change was made; the test was
retargeted to `FIRST_REPEAT`, and the baseline behaviour is now pinned by a
second test so a future reader does not "fix" it by adding an age request the
source does not call for.

## ROUTER-002 — **REAL, BUT MIS-LOCATED. FIXED.**

Sample type does not fork the HPV-not-detected branch at all — LBC, swab and
unknown all correctly return to routine 5-year recall. The original probe was
therefore testing a state where the answer cannot change.

The actual decision point is LEGACY-006's own wording: *"request sample type
before deciding whether cytology is available or a return visit is required."*
That is **HPV Other with no cytology yet**:

| Sample type | Before | After |
|---|---|---|
| `LBC` | `F3-HPV-OTHER-CYTOLOGY-REQUIRED` | unchanged |
| `SWAB` | `F3-SWAB-RETURN-REQUIRED` | unchanged |
| unknown | `F3-HPV-OTHER-CYTOLOGY-REQUIRED` | **`F3-SAMPLE-TYPE-REQUIRED`** |

With the sample type unknown the engine asked for a cytology result that a
self-collected swab **cannot physically produce**, while the participant in fact
needed a return visit with clinical examination.

The fix is scoped to exactly that ambiguity. Where a cytology result already
exists the sample must have been clinician-taken, so nothing is asked; high-grade
cytology is referred to colposcopy first and is never delayed by the question;
and the HPV-not-detected branch is untouched. An earlier, broader version of this
fix was caught by `figure3.test.ts` for exactly that reason and narrowed.

## ROUTER-003 — **REAL. FIXED.**

`"SCC"` was absent from `FIGURE_9_QUALIFYING_CYTOLOGY` while being present in
`isHighGradeCytology`. A pregnant participant with malignant cytology therefore
failed the Figure 9 gate, fell through to Figure 3 and was asked for an HPV
result. `"SCC"` is now in the list: the case routes to Figure 9 and returns
`F9-INITIAL-COLPOSCOPY` — HIGH, referral required, priority P1.

**Residual gap, for clinical decision, not an engine edit:** canonical `F9-14`
specifies *"urgent experienced colposcopy and oncology/MDT"*. Legacy now
escalates to colposcopy but does not express the oncology/MDT element. The
`PREGNANCY-MALIGNANT-CYTOLOGY` shadow comparison remains explicit and now pins
the narrowed divergence at `F9-INITIAL-COLPOSCOPY`.

## Post-fix suite state

| Metric | Before | After |
|---|---|---|
| Router probes | 17 | 20 |
| Failing | 0 | 0 |
| Marked `todo` | 3 | **0** |
| Whole suite | 1,441 tests / 6 todo | **1,447 tests / 0 todo / 0 fail** |

## Still required

1. **Clinical sign-off on the two fixes.** Both change routing in a deployed
   clinical tool and were made from the source expectations recorded here, not
   from clinical authority.
2. **Whether ROUTER-002 and ROUTER-003 are regrade-impacting.** **No regrade was
   performed** and no stored evaluation was altered.
3. **The ROUTER-003 residual** (oncology/MDT) — close in legacy, accept the
   divergence, or leave it to the canonical cutover.

## Constraints held

- No assertion was relaxed to make the suite pass. Two tests were **retargeted**
  to the branch point they claim to test, with the previous behaviour pinned by
  additional tests.
- No historical decision was regraded and no stored evaluation was altered.
- Clinical rules, authority selection and database semantics are unchanged;
  CG-NCSP-3.1.0 remains DRAFT and non-authoritative.
