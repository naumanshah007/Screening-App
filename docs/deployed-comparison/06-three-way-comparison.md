# Three-way clinical comparison — production vs current legacy vs canonical

Date: 4 August 2026.

| System | Identity |
|---|---|
| **A** | Locally reproduced **active Production** build — `main` @ `fb933c3` |
| **B** | **Current candidate** repository legacy engine — `codex/versioned-clinical-rule-studio` @ `8eed086` |
| **C** | **CG-NCSP-3.1.0** in **SIMULATION**, `CanonicalClinicalFactsV2` inputs, checksum `3ab8657a13e73bb0080f18399d9165c20e9af5796bdcf594bdc71170309c824a` |

System C ran **SIMULATION only**. It was evaluated from an in-memory snapshot
built from the external v2.1 source package. It did not publish, activate, create
a `RuleSetActivation`, or write a `RuleEvaluation` row. Legacy remains
authoritative; CG-NCSP-3.1.0 remains DRAFT, unpublished and inactive.

## Corpus

179 independent source-derived semantic cases from
`tests/clinical-conformance/support/guideline-oracle.ts` — the June 2023 NCSP
Figures 1–10 and Table 1 with the addendum and immune-deficiency guidance.

**Expected outcomes are taken only from the oracle.** No expected value is derived
from `fb933c3`, from the current legacy engine, from CG-NCSP-3.1.0, from
screenshots, or from deployed recommendation text.

## Method

Systems A and B were driven by the **same** probe builder and the **same** oracle,
copied unchanged into both worktrees. The engine binding differs per worktree —
that difference is the quantity under measurement. No engine code was modified in
either worktree.

### Alias registry

An explicit registry maps presentation-level synonyms only. Every non-equivalence
the brief forbids collapsing is asserted absent, and `classify.mjs` **throws** if
the registry ever violates one:

```
COLPOSCOPY                    ≠ URGENT_COLPOSCOPY
GYNAECOLOGY                   ≠ URGENT_GYNAECOLOGY
FIGURE_5_COTEST_SURVEILLANCE  ≠ TEST_OF_CURE
TREATMENT                     ≠ TOC_COMPLETE
MANDATORY_REVIEWER_CONFIRMATION ≠ CLINICIAN_ONLY
ROUTINE_RECALL                ≠ NO_FURTHER_SCREENING
```

> **Finding — pre-existing alias registry is unsafe for this purpose.** The
> repository's own `equivalent()` in `conformance-runner.ts` contains
> `FIGURE_5_COTEST_SURVEILLANCE: ["TEST_OF_CURE", "REPEAT_COTEST"]`, which
> collapses Figure 5 surveillance into Test of Cure — one of the exact
> conflations the comparison brief prohibits. It was **not** used here. It should
> be reviewed for the conformance suite as well, since it can mask a real
> Figure 5 / Figure 6 confusion. Logged as a follow-up, not fixed in this pass.

## Headline totals

| Metric | Value |
|---|---:|
| Corpus size | **179** |
| Production-executable cases | **161** |
| Production input-contract gaps | **18** |
| Production matches source | **126 / 179** |
| Current legacy matches source | **126 / 179** |
| Canonical matches source | **171 / 179** |
| Production vs current legacy — identical | **161 / 161 executable** |
| Production vs current legacy — differing | **0** |

## Classification totals

| Classification | Count |
|---|---:|
| `THREE_WAY_EXACT_AGREEMENT` | **124** |
| `CANDIDATE_FIXES_CONFIRMED_LEGACY_DEFECT` | **31** |
| `CANDIDATE_ADDS_PREVIOUSLY_UNSUPPORTED_STATE` | **16** |
| `REQUIRES_CLINICAL_REVIEW` | **4** |
| `DEPLOYED_INPUT_CONTRACT_GAP` | **2** |
| `GOV04_CLINICIAN_ONLY_OVERRESTRICTION` | **2** |
| `PRODUCTION_AND_CURRENT_LEGACY_AGREE` | 0 |
| `PRODUCTION_DIFFERS_FROM_CURRENT_LEGACY` | **0** |
| `CANDIDATE_SAFETY_IMPROVEMENT` | 0 |
| `PRESENTATION_ALIAS_ONLY` | 0 |
| `CANDIDATE_REGRESSION` | **0** *(on this corpus — see the router caveat below)* |
| `SOURCE_ORACLE_CONFLICT` | 0 |
| `UNEXPLAINED` | **0** |
| **Total** | **179** |

## Reading the result

**The deployed legacy engine and the candidate's legacy engine are behaviourally
identical on every one of the 161 executable cases.** System B is therefore a
faithful executable stand-in for deployed legacy behaviour on this corpus — the
assumption the earlier scope document made on inference alone is now demonstrated.

**The canonical engine is materially more correct against the source.** It matches
171/179 versus 126/179 for both legacy engines: 31 confirmed legacy defects
corrected and 16 previously inexpressible states now representable, with **zero**
canonical regressions on this corpus.

## Per-source-area breakdown

| Source area | Cases | Production OK | Current legacy OK | Canonical OK | Production gaps |
|---|---:|---:|---:|---:|---:|
| Figure 1 | 6 | 6 | 6 | 6 | 0 |
| Figure 2 | 7 | 6 | 6 | 7 | 0 |
| Figure 3 | 43 | 33 | 33 | 42 | 1 |
| Figure 4 | 21 | 17 | 17 | 21 | 0 |
| Figure 5 | 7 | **1** | **1** | 6 | 0 |
| Figure 6 | 18 | 10 | 10 | 18 | 6 |
| Figure 7 | 15 | 10 | 10 | 14 | 1 |
| Figure 8 | 18 | 9 | 9 | 15 | 6 |
| Table 1 | 21 | 19 | 19 | 21 | 0 |
| Figure 9 | 10 | 7 | 7 | 8 | 0 |
| Figure 10 | 13 | 8 | 8 | 13 | 4 |

**Figure 5 is the weakest area in production: 1 of 7 source branches correct.**
The canonical engine corrects 5 of the 6 failures. Figure 8 (9/18) and Figure 6
(10/18) are the next weakest.

## ⚠ Scope caveat — the corpus does not exercise the router

The 179 probes call the **figure evaluators** directly
(`evaluateFigure1…10`, `evaluateTable1`). They never reach
`evaluateClinicalDecision`, which is where age-gate routing, the pregnancy/
bleeding precedence chain and the overlay wrapper live.

The `CANDIDATE_REGRESSION = 0` total above is therefore **scoped to the figure
evaluators**. A separate router-level probe was built specifically to close this
blind spot, and it found nine differences — all of them the candidate being less
safe. See `07-special-set-matrices.md` §Router-level age gates. That result, not
this zero, is the operative regression finding.

## Machine-readable artefacts

- `06-three-way-results.json` — full per-case record, all captured fields
- `06-three-way-results.csv` — same data, one row per case
- Harness: `scripts/comparison/emit-legacy.ts`, `emit-canonical.ts`,
  `emit-router.ts`, `classify.mjs`
