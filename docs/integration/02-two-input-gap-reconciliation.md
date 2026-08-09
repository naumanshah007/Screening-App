# Reconciliation — "18/18 gaps closed" vs "16/18"

Date: 4 August 2026.

## The discrepancy, resolved

Both figures are correct. They measure different things, and the earlier reports
did not distinguish them.

| Measurement | Value | Meaning |
|---|:--:|---|
| **Representation** | **18 / 18** | The state is expressible in `CanonicalClinicalFactsV2`, evaluates without error, and selects a governed rule |
| **Agreement with the source oracle** | **16 / 18** | The resulting action class also matches the oracle's expected action class |

The prior `20-input-gap-closure.md` claim of 18/18 was a **representation** claim
and stands. The production comparison's 16/18 is an **agreement** claim and also
stands. Neither supersedes the other.

Evidence for representation:

```
total legacy-gap fixtures      : 18
evaluable (no error)           : 18
with a governed matched rule   : 18
with outstanding missingInformation : 0
```

**The 18/18 headline must henceforth be qualified as representation**, and
agreement reported separately. Reporting 18/18 unqualified is what made the two
numbers look contradictory.

## The two non-agreeing cases

### Case 1 — `F8-CANCER-STAGE1A1-LOCAL-EXCISION-TOC-COMPLETE-REGULAR`

| Field | Value |
|---|---|
| Source | Figure 8, p. 5 — "Screening after gynaecological cancer update" |
| Expected action class | `ROUTINE_SCREENING` |
| Production representable | **No** — `DEPLOYED_INPUT_CONTRACT_GAP` |
| Current legacy representable | **No** |
| Canonical representable | **Yes** — matched rule `A26-08`, no missing information |
| Canonical recommendation | *"Return to regular cervical screening after successful treatment and completed Test of Cure."* |
| Canonical timing | Regular screening interval |
| Canonical destination | Primary/community care or programme follow-up |
| Canonical action classes | `["ROUTINE_RECALL", "TEST_OF_CURE"]` |
| Agreement | **No** |

**Root cause — comparison mapping / expected-result normalization.** Two separate
mapper issues, neither in the evaluator:

1. The oracle labels this `ROUTINE_SCREENING`; `canonicalActionClasses` emits
   `ROUTINE_RECALL` for "regular interval / regular screening" and has no
   `ROUTINE_SCREENING` output at all. The two labels are not linked.
2. `canonicalActionClasses` also tags `TEST_OF_CURE` because the *narrative*
   contains "completed Test of Cure". The regex fires on descriptive text about a
   finished ToC rather than on a ToC *action*, adding a spurious class.

**The canonical clinical content is correct.** "Return to regular cervical
screening" is exactly what the source directs for a completed Test of Cure after
stage 1A1 local excision.

**Correction required:** either link `ROUTINE_SCREENING` and `ROUTINE_RECALL` in
the alias registry for this context, or tighten the mapper so the narrative
mention of a completed ToC does not emit `TEST_OF_CURE`.

**Status: `GOVERNANCE_BLOCKER — clinical adjudication required`.** Not applied.
Whether `ROUTINE_SCREENING` and `ROUTINE_RECALL` are the same disposition in the
post-cancer Figure 8 overlay is a clinical judgement, not an engineering one, and
this programme has just demonstrated the cost of a permissive alias.

**Test ID:** `F8-CANCER-STAGE1A1-LOCAL-EXCISION-TOC-COMPLETE-REGULAR` in
`docs/deployed-comparison/06-three-way-results.json`.

---

### Case 2 — `F8-NONCERVICAL-CANCER-HYSTERECTOMY-HSIL-INCOMPLETE-TOC`

| Field | Value |
|---|---|
| Source | Figure 8, p. 5 — "Screening after gynaecological cancer update" |
| Expected action class | `CONTINUE_TOC` |
| Production representable | **No** — `DEPLOYED_INPUT_CONTRACT_GAP` |
| Current legacy representable | **No** |
| Canonical representable | **Yes** — matched rule `A26-11`, no missing information |
| Canonical recommendation | *"Undertake ToC; cease after two HPV-not-detected/negative-cytology co-tests 12 months apart"* |
| Canonical timing | 12 months apart |
| Canonical destination | Primary/community care or programme follow-up |
| Canonical action classes | `["TEST_OF_CURE"]` |
| Agreement | **No** |

**Root cause — comparison mapping granularity.** `canonicalActionClasses` emits
`CONTINUE_TOC` only when the text matches `/continue Test of Cure|complete Test of
Cure/i`. This recommendation says *"Undertake ToC"*, so only the broader
`TEST_OF_CURE` class is emitted. The oracle expects the narrower `CONTINUE_TOC`
because the participant's Test of Cure is incomplete.

**The canonical clinical content is correct.** For a participant with an
incomplete Test of Cure, "undertake ToC, cease after two negative co-tests 12
months apart" is the same instruction as "continue Test of Cure".

**Correction required:** make the mapper context-sensitive — when the input facts
carry an incomplete Test of Cure, `TEST_OF_CURE` should narrow to `CONTINUE_TOC`.

**Status: `GOVERNANCE_BLOCKER — clinical adjudication required`.** Not applied.
`TEST_OF_CURE` versus `CONTINUE_TOC` is adjacent to the
`TREATMENT` ≠ `TOC_COMPLETE` non-equivalence the brief protects, so widening it
without clinical sign-off is exactly the wrong instinct.

**Test ID:** `F8-NONCERVICAL-CANCER-HYSTERECTOMY-HSIL-INCOMPLETE-TOC` in
`docs/deployed-comparison/06-three-way-results.json`.

---

## Where the defect is **not**

Ruled out by evidence for both cases:

| Candidate location | Ruled out because |
|---|---|
| `CanonicalClinicalFactsV2` schema | both fixtures construct and evaluate cleanly |
| V2 fixture construction | both produce a governed rule match (`A26-08`, `A26-11`) |
| Source-oracle mapping | both carry correct source references and expectations |
| Evaluator logic | both emit clinically correct recommendation text, timing and destination |
| Longitudinal-state representation | neither reports missing information |
| **Comparison mapping / expected-result normalization** | **← the actual location, both cases** |
| Report generation | counts follow correctly from the mapping |

## Conclusion

**Do not restore an unqualified 18/18 claim.**

- Representation: **18/18** — may be stated, with the word "representation".
- Agreement: **16/18** — until the two label equivalences are clinically
  adjudicated and the mapper corrected.

Both outstanding items are engineering corrections *gated on* a clinical
decision, so they remain visible governance blockers rather than being fixed to
make a number look better.
