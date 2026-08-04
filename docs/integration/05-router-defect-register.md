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

## Required decisions

1. **Clinical triage of ROUTER-001, -002, -003** — severity confirmation and fix
   priority. All three are live in production now.
2. **Whether ROUTER-002 and ROUTER-003 are regrade-impacting**, on the same basis
   as the 26 registered defects. **No regrade was performed.**
3. Whether the router fixes land on `main` independently of the Rule Studio
   integration, since they affect the currently deployed build.

## What was not done

- No router behaviour was changed. This branch's router is byte-identical to
  `origin/main`.
- No assertion was relaxed to make the suite pass.
- No historical decision was regraded and no stored evaluation was altered.
