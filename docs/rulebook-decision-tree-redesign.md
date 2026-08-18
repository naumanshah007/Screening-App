# Rulebook Redesign — One Canonical Ordered Decision Graph

Status: revised proposal, pre-implementation
Scope: the admin-editable triage rulebook at `/rules` (`CaseRuleSetRelease`), which drives batch
grading, case grading and the reviewer worklist.
Supersedes: the first draft of this document, whose core equivalence claim was wrong (see §2).

---

## 1. Executive summary

The product direction is unchanged: **one canonical, end-to-end clinical rulebook that clinicians
author as a hierarchy, compiled to an immutable flat rule list for execution.**

Three things changed after running the Phase 0 analysis against the real 81 rules:

1. **The target model is an *ordered decision graph*, not a mutually exclusive tree.** 98% of the
   current rules depend on an earlier rule not having matched. A strict tree cannot represent them
   without duplication. Sibling branches need explicit local priority and a mandatory fallback.
2. **The default view is a collapsed hierarchy, not a canvas of 120 nodes.** View mode and Edit
   mode are separate.
3. **Phase 0b found 24 rules in the live rulebook that no case can ever match** — 19 shadowed by an
   earlier rule, 5 unreachable because the extraction pipeline cannot emit a required fact. **11
   change the urgency a patient receives.** A further 9 rules work in one grading pipeline and are
   dead in the other. This is a current clinical defect, independent of the redesign, and it
   outranks the redesign in priority. See §3.

**Figures superseded twice — use §3 only.** Phase 0's headline ("21 unreachable, 14 grade-changing")
searched an unconstrained label space. The first Phase 0b pass ("18 shadowed, 58 reachable") unioned
the two grading pipelines and concealed pipeline-specific defects. §3 supersedes both, verified by
exhaustive enumeration and an independent SAT encoding. §16 lists every corrected statement.

Reproduce all figures in this document with:

```bash
npx tsx scripts/analyse-rule-overlap.ts
```

---

## 1b. Scope — what `/rules` actually governs

**The 81 COL/GYN rules are the local referral-grading overlay. They are not the rulebook derived
from Figures 1–10 and Table 1.** Earlier revisions of this document conflated them. They are two
different execution models living in two different places:

| | National clinical pathway | Local triage overlay |
|---|---|---|
| Where | `lib/engine/decision-engine.ts` (1,742 lines, hand-written) | `lib/cases/rule-policy.ts` (81 rules) |
| Ids | `F1-…`–`F10-…`, `T1-…`, addendum `A26-…` | `COL-…`, `GYN-…` |
| Question | *What should happen to this participant?* | *Given a referral is needed, how does this service queue and book it?* |
| Terminals | recalls, invitations, discharge, Test of Cure, MDM, specialist review, safety escalation, referral | priority + booking target only |
| Executes | point-in-time decision **and** longitudinal workflow | first-match-wins flat list |
| Editable in `/rules` today | no | yes |

The source rulebook already treats national pathway and local booking priority as separate
concerns. The redesign must preserve that separation, not flatten it.

### Answers to the four scope questions

**Is `/rules` editing only local referral grading, or the complete NCSP pathway rulebook?**
Today: only local referral grading. Target: **one user-facing map** exposing both layers, with the
national pathway and the local overlay independently versioned and independently editable.
Editing a booking target must never silently alter a national pathway decision — proven by the
`editing the local overlay does not alter the national pathway` test in §17.

**Which source pathways compile to the current first-match evaluator?**
Only terminals whose action is a **referral** *and* whose automation boundary is compilable
*and* which declare the target pipeline. In Figure 4 that is 4 of 10 terminals. The other 6 are
excluded by the compiler with a recorded reason.

**Which pathways require a workflow executor?**
Every terminal emitting a `recall`, `screeningInvitation`, `discharge` or `transitionToPathway` —
i.e. anything spanning more than one event. Figure 6 (Test of Cure) and Figure 10 (abnormal
bleeding, 6–8 week review) are almost entirely workflow. These must **not** be modelled as though
the whole sequence happens in one evaluation.

**Which pathways remain review-only?**
Terminals with boundary `CLINICIAN_LED`, `SPECIALIST_LED`, `MANDATORY_MDM` or `SHARED_DECISION` —
for example Figure 7's mandatory-MDM branches and Figure 5's specialist-judgement branches. These
are never compiled and never autonomously finalised.

### How one map exposes several logic types without pretending they are one

The canvas shows one graph. Each terminal renders its **action kind** and **automation boundary** as
a visible chip — `↻ recall 12m`, `→ referral P3/180d`, `⚑ MDM required`, `? information needed` —
so a reader can see at a glance which parts are deterministic, which are review-only and which
schedule future work. Only the referral chips carry an editable local priority. The layer a given
edit touches is always stated before it is applied.

---

## 2. The correction: first-match-wins is not a tree

The first draft claimed *"a first-match-wins ordered rule list is exactly a depth-first flattening
of a tree."* That is only true when sibling branches are mutually exclusive. Measured against the
actual rulebook, it is false almost everywhere.

| Measure | Colposcopy | Gynaecology | Total |
|---|---|---|---|
| Rules | 43 | 38 | 81 |
| Rule pairs examined | 903 | 703 | 1,606 |
| Pairs that can co-match a single case | 679 | 651 | 1,330 |
| ...with **differing** outcomes → order-dependent | 668 | 651 | **1,319** |
| Rules that rely on an earlier rule not matching | 42 of 43 | 37 of 38 | **79 of 81 (98%)** |

Overlap is not an edge case in this rulebook. It is the dominant structure, because the list is
built as *specific rules first, broad catch-alls later* — `COL-004` is literally titled
"HPV 16/18 positive (any cytology, no higher rule matched)".

### Rules that cannot be a mutually exclusive tree without duplication or explicit priority

Three distinct causes, all present:

**a) Cross-cutting rules — no context label, so they apply in every context (26 rules).**
Under a context-first tree these must either be hoisted above the context split or duplicated into
every branch.

- Colposcopy (19): `COL-003 004 005 007 008 009 015 016 017 027 028 030 031 034 040 041 042 043 044`
- Gynaecology (7): `GYN-009 016 024 032 035 036 038`

**b) Rules spanning multiple contexts — would duplicate into each context subtree (7 rules, all gynaecology).**

| Rule | Contexts spanned |
|---|---|
| `GYN-012` | Abnormal uterine bleeding + Pelvic pain + Fibroids + Cervical polyp + Urogynaecology + Ovarian cyst + Endometriosis |
| `GYN-022` | Abnormal uterine bleeding + Uterine polyp on USS |
| `GYN-023` | Pelvic pain + Endometrioma + Endometriosis |
| `GYN-025` | Pelvic pain + Previous endometriosis + Endometrioma |
| `GYN-027` | Urogynaecology + Symptomatic prolapse + Asymptomatic prolapse |
| `GYN-033` | Fibroids + Abnormal uterine bleeding |
| `GYN-037` | Abnormal uterine bleeding + Uterine polyp on USS |

**c) Rules carrying cross-cutting modifiers — the same exception repeated across unrelated subtrees (17 rules).**

- `Immune deficient` appears in 9 colposcopy rules: `COL-017 027 028 037 038 039 042 043 044`
- Gynaecology (8): `GYN-010` (Fertility), `GYN-015` and `GYN-037` (Persistent bleeding >3 months,
  Medical management trialled), `GYN-017` (Recurrent symptoms), `GYN-029` and `GYN-030`
  (Prior conservative management), `GYN-031` (Patient under 16), `GYN-038` (New clinical
  information, Re-grading requested, Upgraded urgency)

**Conclusion.** The canonical model must provide *all three* of: explicit local priority between
siblings, modifier nodes for cross-cutting exceptions, and shared subtrees for multi-context rules.
Without them, converting the 81 rules to a strict tree would require an estimated 3–5× rule
duplication and would reintroduce exactly the maintenance problem this redesign exists to remove.

---

## 3. Phase 0b — exact reachability verification

Phase 0's heuristic search reported "21 unreachable colposcopy rules, 14 grade-changing". That
figure searched an *unconstrained* label space and did not distinguish between kinds of
unreachability. Phase 0b replaces it with an exact decision procedure over the **legal** fact
domain. The corrected findings are below; the Phase 0 figure is superseded.

```bash
npx tsx scripts/verify-rule-reachability.ts --write     # register → docs/clinical-audit/
npx tsx scripts/shadow-regrade-corrections.ts 20000     # correction comparison
```

### 3.1 The legal fact domain

Overlap and reachability figures are meaningless unless generated cases respect the real data
model. Facts reach the evaluator by **two disjoint routes**, with very different domains:

| | Path A — batch | Path B — case |
|---|---|---|
| Sole fact source | `buildBatchRuleFacts` (`lib/batch/rule-facts.ts:72`) | `buildEvaluationFacts` (`lib/cases/grading.ts:284`) = persisted `ExtractedFact` ∪ `buildMappedFieldFacts` ∪ free-text extraction |
| Producible labels | **18** | **75** |
| Mutual exclusion | **Hard.** Every label comes from a single-select enum: HPV is one of 3, cytology one of 7, histology one of 2 | **None survives.** Field chains are single-select, but every label they emit is *also* producible by the regex extractor in `fact-extraction.ts`, so free text can reintroduce any combination |

A rule is operationally reachable if it is reachable on **either** path. The two never mix —
`gradeCanonicalCase` uses only Path A; `gradeCase` uses only Path B.

**11 labels referenced by rules are emitted by no producer at all:**
`Abnormal smear`, `DIE confirmed on imaging`, `Mesh-tape complication`, `New clinical information`,
`Re-grading requested`, `Repeat ASCUS/LSIL`, `Repeat no cytology`, `Sling complication`,
`TVT complication`, `Third HPV positive result`, `Upgraded urgency`.

`rule-policy.ts:97` already anticipates part of this: *"Repeat-count rules … require the
fact-extraction layer to detect and emit these labels."* They never shipped.

### 3.2 Method

- **Boundary-complete numerics.** For every threshold, the domain is generated as the full
  equivalence-class set around each cut point — `bound−1`, `bound−0.1`, `bound`, `bound+0.1`,
  `bound+1`, plus `0` and the absent state. Interval arithmetic over these classes is complete: any
  other value is behaviourally identical to one in the set.
- **Exact decision procedure.** For each rule *R*, decide whether a legal fact vector exists with
  *R* true and every preceding rule false. Complete branch-and-bound: fix *R*'s required and
  forbidden labels, enumerate every choice across its `any` groups and every satisfying numeric
  class, then repeatedly pick the first blocking earlier rule and branch over every way to falsify
  it (drop one of its required labels, add one of its forbidden labels, empty one of its `any`
  groups, or move its numeric value out of range). Search-space reduction is sound because a label
  not required by *R* is only ever worth adding to break an earlier rule's `absent` constraint,
  which is exactly one of the branch options.
- **Independent confirmation.** Every SAT witness is replayed through the real
  `evaluateCaseRuleRelease`. The script **throws** if the evaluator disagrees with the solver in
  either direction. All 81 rules are decided — no budget exhaustion, no unproven cases.

### 3.3 Independent verification, and why the union view was wrong

Replaying a SAT witness through the live evaluator proves *reachability*. It proves nothing about
an UNSAT finding, which otherwise rests entirely on one algorithm and one legal-domain encoding.
`scripts/verify-independent.ts` therefore re-decides every rule by two means that share no code
with the branch-and-bound:

- **Path A — exhaustive enumeration.** The batch state space is the cross product of single-select
  enums plus six independent booleans: **17,408 legal states**, every one evaluated through the real
  `evaluateCaseRuleRelease`. No solver, no encoding. Complete by construction.
- **Path B — independent CNF + DPLL.** A separate Tseitin encoding and a separately implemented
  solver. Every SAT witness is replayed through the live evaluator, which threw on first run and
  exposed a bug in the CNF encoding (the chosen numeric equivalence class was not carried into
  `valueNumber`, so threshold rules silently failed). A defect would now have to be replicated in
  two unrelated algorithms to survive.

Reporting reachability as a *union* over the two pipelines — as the previous revision did — hides
real defects. A rule can be perfectly reachable in the case pipeline and impossible in batch, and
the rulebook is expected to serve both.

### 3.4 Pipeline reachability matrix

Full matrix: `docs/clinical-audit/07-pipeline-reachability.{csv,json}`.

| Combined status | Count | Meaning |
|---|---|---|
| Reachable in both pipelines | 12 | Works everywhere |
| Reachable — case pipeline only applies (gynaecology) | 36 | Batch grades colposcopy only (`lib/batch/persistence.ts:103`) |
| **Case-only — unreachable in batch** | 7 | `COL-008 009 010 019 022 024 026` |
| **Batch-only — unreachable in case** | 2 | `COL-031`, `COL-033` |
| **Shadowed in every pipeline** | 19 | Cannot fire anywhere |
| Operationally unreachable in both | 3 | `COL-034`, `COL-039`, `COL-044` |
| Operationally unreachable (gynaecology) | 2 | `GYN-035`, `GYN-038` |

**New finding the union view concealed: `COL-008`, `COL-009` and `COL-010` can never fire in the
batch pipeline.** All three require `Cancer suspicion cytology`, but `deriveBatchHighSuspicion`
(`lib/batch/rule-facts.ts:98`) sets the high-suspicion flag whenever cytology is SCC — so `COL-001`,
the case-flag rule, always wins first. They work in the case pipeline and are dead in batch. The
same batch/case asymmetry makes `COL-031` and `COL-033` batch-only.

**Shadowed count rises from 18 to 19** once measured per pipeline: `COL-030` is shadowed in batch
and not producible in case, which the union view scored as reachable.

### 3.5 Unavoidable-blocker proofs

Every shadowed rule now carries a human-readable proof so a reviewer can audit the finding without
trusting either solver. Example, generated verbatim:

```
COL-035 — Previous normal colposcopy re-referral — HPV 16/18, no cytology
   COL-035 requires Previous normal colposcopy + HPV 16/18; requires absence of
     Cancer suspicion cytology, HSIL, ASC-H, Glandular abnormality, ASC-US, LSIL, Normal cytology.
   COL-004 requires one of (HPV 16/18).
   Every legal input satisfying COL-035 therefore also satisfies COL-004.
   COL-004 precedes COL-035 in the ordered list.
   No exclusion available to COL-035 can falsify COL-004.
   Therefore COL-035 can never win.
```

**Of the 19 shadowed, 11 change urgency and 8 do not.** The 8 reach the same priority and timeframe
by a different rule, so no patient is affected — but the recorded category, rationale and
`matchedRuleCode` are wrong, corrupting the audit trail and any reporting keyed on rule code.

### 3.6 Clinical discrepancy register — the 11 urgency-changing rules

Full machine-readable register: `docs/clinical-audit/06-reachability-register.{csv,json}`.
Every row's example facts are a solver-produced witness confirmed against the live evaluator.

| Rule | Source | Intended | Actual | Winner | Urgency | Example facts |
|---|---|---|---|---|---|---|
| `COL-017` HPV Other with immune deficiency | COLP guide, immune deficiency rows | P2 / 30d | **P3 / 90d** | COL-027 | **decreases** ⚠ | HPV Other, Immune deficient |
| `COL-023` Post-treatment HPV 16/18 — normal/low-grade | Post-treatment rows | P3 / 90d | **P2 / 30d** | COL-004 | increases | Post-treatment assessment, HPV 16/18 |
| `COL-025` HPV Other surveillance — long-cycle | Surveillance rows | P3 / 180d | **P3 / 90d** | COL-024 | increases | HPV surveillance, HPV Other |
| `COL-035` Prev. normal colposcopy — HPV 16/18, no cytology | Re-referral rows | P3 / 180d | **P2 / 30d** | COL-004 | increases | Previous normal colposcopy, HPV 16/18 |
| `COL-036` Prev. normal colposcopy — HPV 16/18, normal/low-grade | Re-referral rows | P3 / 180d | **P2 / 30d** | COL-004 | increases | Previous normal colposcopy, HPV 16/18, Normal cytology |
| `COL-037` Prev. normal colposcopy — immune-deficient HPV Other | Re-referral rows | P3 / 180d | **P3 / 90d** | COL-027 | increases | Previous normal colposcopy, HPV Other, Immune deficient |
| `COL-038` Prev. normal colposcopy — HPV Other, repeat normal/low-grade | Re-referral rows | P3 / 180d | **P3 / 90d** | COL-007 | increases | Previous normal colposcopy, HPV Other, Normal cytology |
| `COL-040` Prev. LSIL histology — HPV 16/18, no cytology | Re-referral rows | P3 / 90d | **P2 / 30d** | COL-004 | increases | Previous LSIL histology, HPV 16/18 |
| `COL-041` Prev. LSIL histology — HPV 16/18, normal/low-grade | Re-referral rows | P3 / 180d | **P2 / 30d** | COL-004 | increases | Previous LSIL histology, HPV 16/18, Normal cytology |
| `COL-042` Prev. LSIL histology — immune-deficient HPV Other | Re-referral rows | P3 / 180d | **P3 / 90d** | COL-027 | increases | Previous LSIL histology, HPV Other, Immune deficient |
| `COL-043` Prev. LSIL histology — HPV Other, repeat normal/low-grade | Re-referral rows | P3 / 180d | **P3 / 90d** | COL-007 | increases | Previous LSIL histology, HPV Other, Normal cytology |

**Risk asymmetry matters.** Ten of the eleven *increase* urgency — patients are seen sooner than
the rulebook intends. That is over-triage: it consumes clinic capacity and inflates the P2 queue,
but no patient is under-served. **`COL-017` is the exception and the only under-triage**: an
immune-deficient HPV Other patient the rulebook intends to see within 30 days is booked at 90.
It needs a different retrospective-review decision from the other ten.

**`COL-017` may also be intentional.** `rule-policy.ts:94` calls it the *"30d fallback"* that
COL-027/028 must precede — implying the author expected COL-027/028 to supersede it. If that is the
intent, COL-017 is not a defect but an undeclared dead fallback, and the fix is to mark it
intentionally inactive rather than to make it reachable. **This is a clinical decision, not an
engineering one**, and it is the single most important question in §15.

### 3.7 Operationally unreachable — 5 rules, a different defect class

These cannot be fixed by reordering or narrowing. No case can reach them because the extraction
layer never emits a required fact.

| Rule | Intended | Missing capability |
|---|---|---|
| `COL-034` Third HPV Other — normal or low-grade cytology | P3 / 180d | `Third HPV positive result` — no producer |
| `COL-039` Prev. normal colposcopy — HPV Other, repeat no cytology | P3 / 180d | `Repeat no cytology` — no producer |
| `COL-044` Prev. LSIL histology — HPV Other, repeat no cytology | P3 / 180d | `Repeat no cytology` — no producer |
| `GYN-035` TVT or sling complication | P2 / 30d | `TVT complication`, `Sling complication`, `Mesh-tape complication` — no producer |
| `GYN-038` Re-grading required — new clinical information | — | `New clinical information`, `Re-grading requested`, `Upgraded urgency` — no producer |

The remedy is extraction work (add the regex patterns or structured fields), not a rule edit.
`GYN-035` is notable: mesh and sling complications are a recognised urgent urogynaecology pathway,
and the rulebook cannot currently route them at all.

### 3.8 Correction strategy — reordering alone is unsafe

Per the requirement not to default to reordering, four candidate strategies were implemented and
verified. `scripts/shadow-regrade-corrections.ts` measures each. Three findings:

1. **The corrections are not independent.** Several catch-alls stack in front of the same specific
   rule. Narrowing `COL-027` alone leaves `COL-037`/`COL-042` blocked behind `COL-007`, and once
   `COL-007` is narrowed they are blocked behind `COL-017`. The set must be iterated to a fixpoint
   and re-verified exactly at each step — three iterations were needed here.
2. **Reordering creates new shadows.** Moving `COL-017` earlier to honour its 30-day intent made it
   shadow `COL-037` and `COL-042`, converting a fixed defect into two new ones. Narrowing —
   adding explicit `absent` exclusions to the catch-all — is the safer instrument because its blast
   radius is exactly the excluded context.
3. **A plausible-looking narrowing can break the rule it edits.** Excluding `HPV surveillance` from
   `COL-024` — the obvious first attempt — makes it self-contradictory and *unreachable*, because
   `COL-024` requires that label. The correct exclusion is `HPV Other`. Only exact re-verification
   caught this.

**Verified candidate (`C6-COMPOSITE`)** — narrow `COL-004`, `COL-007`, `COL-027`, `COL-017` with
the re-referral/post-treatment contexts, and `COL-024` with `HPV Other`:

| Measure | Before | After |
|---|---|---|
| Reachable colposcopy rules | 22 of 43 | **33 of 43** |
| Shadowed | 19 | 8 |
| ...urgency-changing | 11 | **1** (`COL-017`, pending the intent decision in §3.6) |
| Operationally unreachable | 3 | 3 (unchanged — needs extraction work) |
| Cases changed in the synthetic population | — | **0 of 20,000** — see the caveat below |

The 6 remaining shadows are the category-only cases; they need merging or context exclusions to fix
the provenance, but no patient outcome depends on them.

### 3.9 Population coverage — why this went unnoticed

The shadow regrade exposed a second problem:

> **The synthetic batch population exercises only 7 of 43 colposcopy rules.**
> Matched: `COL-001, COL-003, COL-004, COL-005, COL-007, COL-016, COL-032`. The other 36 never fire.

No archetype in `lib/batch/realistic-dataset.ts` sets `normalColposcopy` or a `CIN1` histology, so
the re-referral contexts these defects live in are never generated. **Zero collateral change in
that population proves only that **no difference was observed in the limited synthetic domain those
archetypes cover**. It is not evidence of safety and not evidence of no effect.** The demo and test data are
structurally incapable of detecting any of these defects — which is why they survived.

**This means the impact numbers in §3.6 are unquantified in patient terms.** A historical replay
against a representative retrospective clinical dataset — from a pilot partner, or production
history where such history lawfully exists — is a mandatory gate before any correction is
activated, and the
regression fixture set needs archetypes covering the re-referral and surveillance contexts.

### 3.10 Required sequence before the redesign baseline

1. Freeze the current release and record its `compiledHash`. It has **no** `sourceGraphHash` — it
   was never authored as a graph, and assigning one would fabricate provenance.
2. ✅ Exact reachability for all 81 rules — complete, zero unproven.
3. ✅ Legal fact domain derived from the intake and normalisation pipeline.
4. ✅ Witness stored for every reachable rule (`06-reachability-register.json`).
5. ✅ Formal evidence for every unreachable rule, classified by cause.
6. ✅ Discrepancy register produced (§3.4).
7. ⬜ Shadow replay against a representative retrospective clinical dataset — blocked on access to
   pilot-partner or lawfully available production history. Until then, functional correctness is
   established but real-population impact is not.
8. ⬜ Clinical decision per discrepancy, starting with the `COL-017` intent question.
9. ⬜ Dedicated correction release with its own hashes, reports and sign-offs.
10. ⬜ Permanent reachability and witness tests in CI (§9 gate G1, checks V14/V21).
11. ⬜ Only then use the corrected release as the redesign baseline.

Steps 7–11 are not started. No rule has been modified; `lib/cases/rule-policy.ts` is untouched and
the candidate corrections exist only as transforms inside the analysis script.

---

## 4. Revised domain model

New module `lib/cases/rule-graph.ts`. `rule-policy.ts` types are unchanged apart from one additive
optional `provenance` field on `CaseRuleDefinition`.

### 4.1 Node types

| Node | Purpose | Executes? |
|---|---|---|
| `start` | Single entry point to the rulebook | routing only |
| `decision` | Asks about a clinical fact; owns ordered outgoing edges | yes |
| `modifier` | Applies a cross-cutting exception or risk adjustment to everything below it | yes |
| `outcome` | Terminal — produces service, priority, timeframe, recommendation | yes |
| `fallback` | Terminal for "nothing else matched"; flags the case for review | yes |
| `reference` | Attaches guideline citation or note; no execution effect | no |

**Conditions live on edges leaving a `decision` node**, never on the node itself. Each edge carries
an explicit integer `priority`; siblings are evaluated in ascending priority order. Every `decision`
node must have exactly one terminal edge with condition `{ op: "otherwise" }` — this is the
mandatory fallback, pinned last and non-reorderable in the UI.

`fallback` is the node type a fallback edge normally points at; the edge may also point at a further
`decision` node when the "everything else" case needs more questions. The validator enforces that
every path terminates at an `outcome` or `fallback`.

**Every node and edge has a permanent `id`** minted at creation (`nd_` / `ed_` + ULID) that never
changes. Labels, conditions and positions are all mutable; ids are not. Provenance, diffing and
historical replay key on ids only.

### 4.2 Shared subtrees (the graph part)

A `decision` node may be referenced by more than one parent edge. This is what lets `GYN-023`
(Pelvic pain + Endometrioma + Endometriosis) exist once and be reached from three contexts instead
of being duplicated three times. The structure is a rooted DAG, not a tree.

Cycles are forbidden and rejected by the validator. Provenance records the *full path taken*, so a
shared subtree reached from two contexts compiles to two distinct rules with two distinct node
paths — the flat output stays flat, and every graded case still traces to exactly one path.

### 4.3 Canonical clinical state — a layer the graph never skips

The graph must not evaluate raw labels. Free-text extraction can emit `HPV 16/18` and `HPV Other`
together, or `Normal cytology` and `HSIL` together, from one referral letter (§3.1). An ordered
graph would happily pick a winner for such an input, but the input is not clinically valid and
picking a winner silently is the wrong behaviour.

```
  structured fields  ─┐
  persisted facts    ─┼─►  CANONICALISER  ─►  conflict / uncertainty checks  ─►  rule graph
  free-text extract  ─┘         │                        │
                                │                        ├─ contradictory high-impact findings
                          one value per                  │     → SAFETY STOP, mandatory review
                          clinical field,                ├─ field missing vs not-performed
                          facts as a set                 └─ low-confidence extraction → flagged
```

The canonicaliser produces a `CanonicalClinicalState`: at most one value per single-valued clinical
field, plus a set of independent facts, plus an explicit *known / missing / not-performed* status
per field. Contradictions between high-impact findings (two HPV results, two cytology grades,
incompatible contexts) resolve to a **safety stop**, not to branch priority. This is a prerequisite
for the editor presenting decisions as structured clinical fields while the runtime evaluates
labels — without it the two models diverge.

### 4.4 Typed predicates — clinical fields and flat facts are different things

The previous revision overloaded one `field` key to mean both a flat fact label
(`{ op: "present", field: "Immune deficient" }`) and a structured clinical variable
(`{ op: "anyOf", field: "cytology", … }`). That ambiguity produces unsafe UI controls and unsafe
compilation. They are now distinct kinds, keyed on **stable vocabulary ids**, never on
clinician-facing text:

```ts
export type FieldId = string;   // "fld_cytology"      — stable, never renamed
export type ValueId = string;   // "val_cyt_ascus"
export type FactId  = string;   // "fact_immune_deficient"

export type Predicate =
  | { kind: "flag"; name: "highSuspicionCancer" }
  | { kind: "factPresent"; factId: FactId }
  | { kind: "factAbsent"; factId: FactId }
  | { kind: "fieldEquals"; fieldId: FieldId; valueId: ValueId }
  | { kind: "fieldIn"; fieldId: FieldId; valueIds: ValueId[] }
  /** No value of the field is present — "not reported". */
  | { kind: "fieldMissing"; fieldId: FieldId }
  /** Some value of the field is present, whichever it is. */
  | { kind: "fieldKnown"; fieldId: FieldId }
  | { kind: "numberRange"; fieldId: FieldId; min?: number; max?: number }
  | { kind: "otherwise" };
```

**`fieldMissing` is not `factAbsent`.** The first draft of the example encoded "no cytology
reported" as `absent "Normal cytology"` — which is also true of an ASC-US case, so the low-grade
branch became unreachable behind it. `fieldMissing(fld_cytology)` compiles to *every* cytology value
absent. The distinction is now proven by an executable test (§4.7, property 2).

Display labels live beside the ids and may be edited freely; they are never executable.

### 4.5 Unified edge model

Every control-flow transition is an edge. The previous revision hid three of them inside node
properties — `modifier.passThroughTo`, `modifier.redirect.to`, `reference.attachedTo` — which would
have made them invisible to cycle detection, reachability, in-degree counts, layout, deletion impact
and provenance. Roles distinguish behaviour:

```ts
export type EdgeRole =
  | "decisionBranch"        // ordinary condition branch
  | "otherwise"             // mandatory fallback; always highest priority number
  | "modifierMatch"         // a modifier clause fired
  | "modifierPassThrough";  // no clause fired

export type Edge = {
  id: string;
  from: string;
  to: string;
  label: string;            // clinician-facing, e.g. "HPV 16/18"
  role: EdgeRole;
  predicate: Predicate;
  priority: number;         // ascending; unique among siblings; otherwise is highest
  note?: string;
};
```

**`reference` is no longer a node type.** Guideline citations attach as *metadata* on a node or
edge. Modelling them as executable nodes put them in conflict with the orphan-node and reachability
validators for no benefit.

```ts
export type OutcomeSpec = {
  serviceLine: ServiceLine;
  priority: TriagePriority;
  targetDays?: number;
  category: string;
  outcome: string;
  rationale: string;
  requiresSmoReview?: boolean;
};
```

### 4.6 Node and graph schema

```ts
/** Guideline citations are metadata, not executable nodes. */
export type Citation = { id: string; label: string; citation: string };

export type GraphNode =
  | { id: string; kind: "start"; label: string; citations?: Citation[] }
  | { id: string; kind: "decision"; label: string; fieldId?: FieldId; help?: string; citations?: Citation[] }
  | { id: string; kind: "modifier"; label: string; clauses: ModifierClause[]; citations?: Citation[] }
  | { id: string; kind: "outcome"; code: string; label: string; impact: string; spec: OutcomeSpec; citations?: Citation[] }
  | { id: string; kind: "fallback"; code: string; label: string; spec: OutcomeSpec; requiresReview: true };

export type ModifierClause = {
  id: string;
  label: string;                    // "Immune deficient"
  predicate: Predicate;
  priority: number;
  /** Applied to every outcome reached below this clause's edge. */
  transform:
    | { kind: "setPriority"; priority: TriagePriority }
    | { kind: "setTargetDays"; targetDays: number }
    | { kind: "setOutcome"; spec: Partial<OutcomeSpec> };
  // Redirect is expressed as an ordinary `modifierMatch` edge, not a transform,
  // so it participates in cycle detection and reachability like any other edge.
};

export type RuleGraph = {
  schema: "rule-graph-v1";
  rootId: string;
  nodes: Record<string, GraphNode>;
  edges: Record<string, Edge>;
  vocabulary: {
    fields: Record<FieldId, { label: string; values: Record<ValueId, { label: string; factLabel: string }> }>;
    facts: Record<FactId, { label: string; factLabel: string }>;
  };
  defaultOutcome: Record<ServiceLine, OutcomeSpec>;
  sourceOfTruth: string[];
  notes: string[];
};
```

### 4.7 Executable example — golden fixture, not illustrative JSON

The previous revision's example JSON was wrong, in exactly the way this whole redesign exists to
prevent. It encoded "no cytology reported" as `absent "Normal cytology"` — but an ASC-US case also
has `Normal cytology` absent, so the first branch swallowed the low-grade branch and made it
unreachable. It also omitted the root, service, context and terminal edges, and the `COL-017`
outcome it claimed to model.

**The example is now an executable fixture with a passing test suite**, not prose:

```
scripts/prototype/rule-graph-golden.test.ts        # graph + compiler + assertions
npx tsx --test scripts/prototype/rule-graph-golden.test.ts
```

It contains a complete graph — start, context split, HPV decisions, immune-deficiency branch,
cytology decision, five outcome nodes, a fallback, and every connecting edge — plus a compact
reference compiler, and it proves the four properties required before Phase 1 is approved:

| Test | Proves |
|---|---|
| property 1 | HPV Other + immune deficiency + **missing** cytology → `COL-027`, 90 days |
| property 2 | HPV Other + immune deficiency + **ASC-US** → `COL-028`, 180 days — does *not* take the missing-cytology branch. Same for LSIL. |
| property 3 | Previous-normal-colposcopy → `COL-035`; previous-LSIL-histology → `COL-041`; both at 180 days, neither swallowed by the catch-all |
| property 4 | The broad `HPV 16/18` catch-all keeps its own witness (`COL-004`, 30 days) while every other outcome retains a winning witness |
| determinism | Recompiling the same graph is byte-identical |
| provenance | Every compiled rule carries a unique `compiledRuleInstanceId`, terminal node id and node path |
| regression guard | Reproduces the naive `absent "Normal cytology"` encoding and asserts it mis-routes ASC-US — so the bug cannot silently return |

The key encoding, which is what makes property 2 pass:

```ts
// "No cytology reported" — every cytology value absent.
{ kind: "fieldMissing", fieldId: "fld_cytology" }
// compiles to: absentFactLabels: ["Normal cytology","ASC-US","LSIL","ASC-H",
//                                 "HSIL","Glandular abnormality","Cancer suspicion cytology"]

// NOT this, which is also true of an ASC-US case:
{ kind: "factAbsent", factId: "fact_normal_cytology" }
```

**`COL-017` is deliberately excluded from the fixture** pending the clinical adjudication in §15
question 1. Encoding either reading — defect or intentional 30-day fallback — would prejudge a
decision that is the clinical owner's to make.

## 5. Compiler semantics

`compileGraph(graph, compilerVersion): CompileResult`. Pure; same graph + same compiler version ⇒
byte-identical output. Output is canonically serialised (sorted keys, fixed number formatting) and
hashed, so `compiledHash` is a meaningful identity.

### 5.1 Invariants

The compiler must hold these, and each is asserted by a property test rather than assumed:

| # | Invariant |
|---|---|
| I1 | **Order preservation.** Emission is a depth-first walk taking sibling edges in ascending `priority`. A path emitted earlier is evaluated earlier. |
| I2 | **Otherwise is last.** Every `decision` node has exactly one `otherwise` edge and it has the highest priority number among its siblings. |
| I3 | **Totality.** Every path terminates at an `outcome` or `fallback`; no input can fall off the graph. |
| I4 | **No arbitrary negation.** The compiler never needs the complement of a condition (§5.3). |
| I5 | **Determinism.** `compile(g)` is byte-identical across runs and processes. |
| I6 | **Instance uniqueness.** Every compiled rule has a distinct `compiledRuleInstanceId` (§6). |
| I7 | **Semantic equivalence.** For every canonical clinical state, walking the graph and evaluating the compiled list select the same terminal node. Verified by differential property testing over generated states, not by inspection. |

### 5.2 Ordered decisions, otherwise, shared subtrees, cross-product

```
compileGraph(graph):
  assertAcyclic(graph)                      // DAG over ALL edges, including modifier edges
  rules = []

  walk(nodeId, ctx):                        // ctx = { predicates, transforms, nodePath, edgePath }
    node = graph.nodes[nodeId]

    if node.kind in {"outcome", "fallback"}:
       spec = applyTransforms(node.spec, ctx.transforms)
       for condSet in fold(ctx.predicates):        // fold may yield >1 — see below
          rules.push({ code: node.code, ...condSet, recommendation: spec,
                       provenance: { terminalNodeId: node.id, nodePath, edgePath,
                                     compiledRuleInstanceId: hash(...) } })
       return

    for edge in outgoing(node) sorted by priority ascending:
       walk(edge.to, ctx.push(edge))
```

- **Ordered decisions** compile directly: sibling order becomes list order (I1).
- **`otherwise`** contributes no predicate, so its path condition is whatever the ancestors imposed.
  Because it always sorts last among siblings (I2), its compiled rules follow its siblings'.
- **Shared subtrees** are walked once per incoming path. The same terminal node reached from two
  contexts yields two compiled rules with different `nodePath`, different accumulated conditions and
  different `compiledRuleInstanceId` — the same clinical `code`, which §6 explicitly allows.
- **Cross-product expansion.** A path accumulating more than one `fieldIn`/`anyOf` group exceeds
  what the evaluator's `compound` kind supports (one `any` group). The compiler emits the cross
  product as separate `fact_all` rules, indexed by `expansionIndex`. V16 caps this (§8).
- **`fieldMissing`** compiles to every value label of that field in `absentFactLabels` — the §4.7
  correction.
- **Two `numberRange` on the same field** intersect. On different fields, the path cannot compile;
  the validator rejects it with the offending node ids (V15).

### 5.3 Modifier compilation — without complementing conditions

The previous revision's pseudocode used `withNegatedClauses(node.clauses)` for the pass-through
path. That is not safe: the target evaluator cannot represent the complement of an arbitrary
condition — not the negation of an `anyOf` group, not a range, not a conjunction, and certainly not
the negation of several overlapping clauses at once.

Modifiers therefore compile **by ordering, exactly like decision branches**:

```
"modifier":
   for clause in node.clauses sorted by priority ascending:
      walk(modifierMatchEdge(clause).to, ctx.push(clause).withTransform(clause.transform))
   walk(passThroughEdge.to, ctx)          // UNCONDITIONAL — no negation anywhere
```

1. Emit every rule beneath clause 1, then clause 2, and so on.
2. Then emit the pass-through subtree **unconditionally**, with no added condition.
3. First-match ordering does the rest: a case matching clause 1 hits clause 1's rules first; a case
   matching none falls through to the pass-through rules.

**The obligation this creates.** The pass-through rules are unguarded, so they will claim any case
that reaches them. If a modifier clause's subtree is *not exhaustive* — if some case satisfies the
clause but reaches no outcome beneath it — that case falls through to the pass-through rules and is
graded as though the modifier never applied. Validator **V25** therefore requires every modifier
clause subtree to be exhaustive, including its own `otherwise`, and the compiler asserts it.

This is the same class of hazard as §3's catch-alls, which is why it gets an explicit validator
rather than a comment.

## 6. Provenance and compiled rule identity

A shared outcome node reached from several paths, and cross-product expansion, both produce
**several compiled rules carrying the same clinical code**. Anything assuming `matchedRuleCode`
identifies one predicate is therefore wrong. Identity is split in two:

| Identifier | Stable across | Purpose |
|---|---|---|
| `code` (`COL-027`) | restructuring, reordering, releases | Clinical and external reporting. Many compiled rules may share one code. |
| `compiledRuleInstanceId` | one release + one path + one expansion | Uniquely identifies the predicate that actually executed. |

```ts
compiledRuleInstanceId = sha256(releaseId + terminalNodeId + edgePath.join(">") + expansionIndex)

provenance?: {
  compiledRuleInstanceId: string;
  terminalNodeId: string;
  nodePath: string[];
  edgePath: string[];
  localPriorityPath: number[];
  compilerVersion: string;
};
```

`CaseRuleDefinition` gains this one additive optional field; the evaluator ignores it.
`RuleDecision` gains columns so every graded case traces to the exact authored node:

| Column | Purpose |
|---|---|
| `ruleSetReleaseId` | *(exists)* which release graded this case |
| `compiledRuleInstanceId` | which compiled predicate executed |
| `sourceTerminalNodeId` | which outcome node produced the grade |
| `sourceNodePathJson` | the full path walked, for "show me why" on the canvas |
| `compilerVersion` | which compiler produced the rule |

Only `sourceTerminalNodeId` is indexed; the path is a short id array.

---

## 7. Persistence and release lifecycle

### 7.1 Resolving one graph vs `serviceLine`

The previous revision described one end-to-end graph *and* kept `CaseRuleSetRelease.serviceLine` as
a mandatory scalar with one `definitionJson`. Those are incompatible: it left "is a release the
whole rulebook, or one service line?" unanswered.

**Decision: a parent rulebook release owning per-service compiled artifacts.** One authored graph,
two compiled outputs, one atomic activation.

```
CaseRulebookRelease                    ← one source graph, one lifecycle, one activation
├── sourceGraphJson / sourceGraphHash
├── graphSchemaVersion / compilerVersion
├── validationReportJson / equivalenceReportJson
├── lifecycle + approvals + activation record
└── artifacts: CaseRuleSetRelease[]    ← unchanged format, one per service line
    ├── COLPOSCOPY   → definitionJson (compiled) + compiledHash
    └── GYNAECOLOGY  → definitionJson (compiled) + compiledHash
```

- **Activation is atomic at the parent.** A transaction flips the parent and both artifacts
  together, so no one ever runs colposcopy from one rulebook version and gynaecology from another —
  which the current per-service model permits today.
- **Rollback** re-activates a previous parent, restoring both artifacts as a set.
- **Versioning** is on the parent. Service artifacts inherit its version.
- **Historical replay** resolves a `RuleDecision` through its artifact to the parent, then to the
  source graph and node path.
- **`CaseRuleSetRelease` keeps its shape**, so `rule-evaluator`, `grading.ts`,
  `batch/persistence.ts` and every existing `RuleDecision` row keep working untouched. Legacy
  releases simply have no parent.

### 7.2 Mutable drafts are not releases

The previous revision used one mutable release row as both working copy and immutable activated
artifact, and had no lifecycle column at all. Split them:

```prisma
model RulebookDraft {                      // mutable
  id                   String   @id @default(cuid())
  baseReleaseId        String?              // what it was branched from
  graphJson            String
  revision             Int      @default(1) // optimistic lock; bumped every save
  status               DraftStatus          // WORKING | VALIDATED | IN_REVIEW | APPROVED
  validationSnapshot   String?              // frozen V-catalogue result at VALIDATED
  equivalenceSnapshot  String?              // frozen gate results at IN_REVIEW
  createdByUserId      String
  lastEditedByUserId   String
  approvedByUserId     String?
  approvedAtRevision   Int?                 // approval is bound to a revision
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  @@unique([baseReleaseId, status])         // at most one live working copy per base
}

model CaseRulebookRelease {                // immutable once activated
  id                    String   @id @default(cuid())
  version               String   @unique
  graphSchemaVersion    String
  sourceGraphJson       String
  sourceGraphHash       String
  compilerVersion       String
  validationReportJson  String
  equivalenceReportJson String
  baseReleaseId         String?
  sourceDraftId         String?
  createdByUserId       String
  reviewedByUserId      String
  reviewedAt            DateTime
  activatedByUserId     String
  activatedAt           DateTime
  isActive              Boolean  @default(false)
  artifacts             CaseRuleSetRelease[]
}
```

Concurrency and governance rules, stated rather than implied:

- **Optimistic locking.** A save carries the `revision` it read. A mismatch is a 409; the editor
  shows what changed and offers merge or reload. No silent last-write-wins.
- **One working copy per base release** by default, so two admins cannot unknowingly diverge. A
  second editor joins the existing draft rather than forking it.
- **Approval is bound to a revision.** Any edit after approval bumps `revision`, which no longer
  matches `approvedAtRevision`, so the approval is **automatically invalidated** and the draft
  returns to `WORKING`. This is enforced in the model, not by convention.
- **Validation snapshots are frozen** at the transition that produced them, so a reviewer reads the
  evidence that existed when the draft was validated, not a recomputation.
- **Four-eyes.** The required separation is **author ≠ clinical reviewer**. Whether the activator
  must be a third person is a separate policy flag (`requireDistinctActivator`), defaulting to the
  current behaviour (`reviewer ≠ activator`, `rule-releases.ts:263`).
- **Abandon / restore.** Only the draft's author or an admin may discard it; discarded drafts are
  soft-deleted and restorable for 30 days.

### 7.3 Lifecycle

```
  ┌──────────┐  edit a node   ┌──────────┐  V1–V19 pass  ┌───────────┐
  │  LIVE    │───────────────►│ WORKING  │──────────────►│ VALIDATED │
  │ (active) │                │ (draft)  │  §8 group A+B └───────────┘
  └──────────┘                └──────────┘                     │ send for review
       ▲                            │ discard                  ▼
       │                            ▼                    ┌───────────┐
       │                      (soft-deleted)             │ IN REVIEW │
       │                                                 └───────────┘
       │   activate — atomic across both artifacts             │ approve (author ≠ reviewer)
       │   §8 group C gates must pass                          ▼
       │                                                 ┌───────────┐
       └─────────────────────────────────────────────────│ APPROVED  │
              previous release stays immutable           └───────────┘
                                                    any edit here → revision bump
                                                    → approval auto-invalidated → WORKING
```

`lib/database/bootstrap.ts:105` already has an `ensureColumn` helper, so the demo and Vercel
bootstrap path is a small addition alongside the Prisma migration.

---

## 8. Validation catalogue — V1–V25, in three groups

The previous revision ran one undifferentiated list "on every save", labelled V24 a warning while
saying it blocks review, and treated V16 as a warning although an unbounded expansion makes
compilation unsafe. Checks are now grouped by when they can actually run, and severity is
consistent with the gate they belong to.

### Group A — edit-time structural checks (every save, must be fast)

| # | Check | Severity |
|---|---|---|
| V1 | Cycle in the graph (over **all** edge roles) | error |
| V2 | Node unreachable from root | error |
| V3 | Node with no incoming edge (orphan, non-root) | error |
| V4 | Decision node without an `otherwise` edge | error |
| V5 | `otherwise` edge not last by priority | error |
| V6 | Duplicate `priority` among sibling edges | error |
| V7 | Path that never terminates at outcome/fallback | error |
| V9 | Duplicate sibling predicates | error |
| V10 | Contradictory predicate on one path (`fieldMissing` + `fieldIn` on the same field) | error |
| V11 | Unknown `FieldId`, `ValueId`, `FactId` or operator | error |
| V12 | Outcome missing service, priority, category, outcome text or rationale | error |
| V19 | Outcome **node** id duplicated (distinct from a shared clinical `code`, which is legal) | error |
| V20 | Modifier clause whose transform is the identity | warning |
| V25 | Modifier clause subtree not exhaustive (§5.3) | error |

### Group B — compilation checks (on transition to VALIDATED)

| # | Check | Severity |
|---|---|---|
| V8 | Overlapping sibling predicates | **warning + acknowledgement** |
| V13 | Impossible path — accumulated predicates unsatisfiable | error |
| V15 | Two `numberRange` predicates on different fields in one path | error |
| V16 | Cross-product expansion exceeds the rule budget (default 500) | **error** — an unbounded expansion makes compilation and runtime unsafe, so it blocks rather than warns |
| V17 | Duplicated subtree (identical structure reachable twice) | warning |
| V18 | Depth beyond threshold (default 8) | warning |
| V21 | Active outcome node has no winning witness | error unless flagged `intentionallyInactive` |
| V22 | Outcome requires a fact no producer can emit (§3.1) | error |
| V23 | A broad explicit branch shadows a later specific branch (§8.1) | error |
| V26 | Compile is not byte-deterministic across two runs | error |

### Group C — release gates (before review and activation)

| # | Check | Severity |
|---|---|---|
| V24 | A changed node's affected historical population is unquantified | **error at the review gate** — it is not a warning; review cannot proceed without the number |
| G1–G4 | The four test gates in §9 | error |

**V8 stays a warning by design.** §2 proves overlap is the norm in this domain; blocking it would
make the rulebook unauthorable. The editor surfaces every overlapping *sibling* pair inline, naming
the winning branch — *"this branch also matches cases matching 'HPV Other'; 'Immune deficient' wins
because it has higher priority"* — and requires a per-overlap acknowledgement, stored in
`validationSnapshot` and shown to the reviewer. A single global "acknowledge all" is not offered.

### 8.1 Shadowing is still expressible — V21/V22/V23 are the enforcement

The previous revision claimed *"the class of bug in §3 cannot be authored."* **That was too strong
and is withdrawn.** Mandatory `otherwise` edges prevent *fallback* misordering, but nothing stops an
author creating a broad explicit branch:

```
priority 10 :  HPV Other                              → outcome A
priority 20 :  HPV Other + previous normal colposcopy → outcome B    ← unreachable
```

That is a plain `decisionBranch`, not an `otherwise`, and it swallows the specific branch exactly as
`COL-004` and `COL-007` do today. The correct claim:

> Mandatory local ordering and pinned fallbacks make precedence **visible** and prevent fallback
> misordering. **Exact compiled-output reachability validation (V21, V22, V23) is what prevents a
> broad explicit branch from silently shadowing a specific pathway.** The graph makes the problem
> auditable; the validators are what make it impossible to ship.

This is why V21–V23 are mandatory release-blocking checks rather than nice-to-haves, and why the
golden fixture's property 4 (§4.7) asserts that no outcome loses its winning witness.

---

## 9. Test matrix — four gates

| Gate | What it proves | Blocking? | Runtime |
|---|---|---|---|
| **G1 Structural** | The graph is internally valid | yes, at save | < 1s |
| **G2 Generated equivalence** | Behaviour vs the current engine over generated fact vectors | yes, at review | seconds |
| **G3 Golden scenarios** | Clinician-approved named cases still produce approved outcomes | yes, at review | < 1s |
| **G4 Historical shadow replay** | Real referrals regrade as expected | yes, at activation | minutes |

### G1 — Structural
The §8 catalogue. Errors block; warnings require acknowledgement.

### G2 — Generated equivalence
Enumerate the clinically meaningful cross product rather than the raw label powerset:

- Colposcopy: context (6) × HPV (4) × cytology (8) × immune deficient (2) × repeat stage (3)
  × post-treatment (2) ≈ 4,600 vectors
- Gynaecology: condition (13) × severity band (5) × prior management (2) × duration (3)
  × urgency modifiers (4) ≈ 1,600 vectors
- Plus randomised label subsets as fuzz

Every vector is classified into exactly one bucket:

| Bucket | Meaning | Blocks activation? |
|---|---|---|
| `exact_match` | Old and new agree on priority, timeframe, category, code | no |
| `approved_difference` | Differs, and a named clinician has signed off this delta | no |
| `unexplained_difference` | Differs, no sign-off | **yes** |
| `unmatched` | Fell through to the default/fallback in the new graph | **yes** |
| `multiply_matched` | The compiled output has two rules whose predicates both match and whose outcomes differ — i.e. a shadowing or ambiguity the graph made invisible. (Sibling *edges* always have unique explicit priority by V6; this bucket catches ambiguity across paths, not missing priority.) | **yes** |

No unexplained difference may be silently accepted. The report is stored on the release in
`equivalenceReportJson` and rendered in the reviewer's diff view.

Note that after the §3 fix lands, the baseline for G2 is the *corrected* 81 rules. Running G2
against today's uncorrected list would classify the 11 genuine bug-fixes as differences requiring
sign-off — which is why §3 should be fixed first.

### G3 — Golden clinical scenarios
A small named set the clinical owner reviews directly, in clinical language, not machine rows:

```
HPV 16/18 positive with negative cytology
HPV Other with LSIL
Immune-deficient patient with HPV Other, no cytology              ← COL-017 guard (§3.4)
Post-treatment surveillance with abnormal cytology
Post-treatment HPV 16/18, normal cytology                          ← COL-023 guard
Previous normal colposcopy re-referral, HPV 16/18, no cytology     ← COL-035 guard
Previous normal colposcopy re-referral, immune-deficient HPV Other ← COL-037 guard
Previous LSIL histology re-referral, HPV 16/18, normal cytology    ← COL-041 guard
HPV Other surveillance, normal cytology, long cycle                ← COL-025 guard
Third consecutive HPV Other with normal cytology                   ← COL-034 extraction guard
Mesh/sling complication                                            ← GYN-035 extraction guard
Suspected malignancy
Postmenopausal bleeding after failed initial management
Large fibroids with mass symptoms
Asymptomatic prolapse with no prior conservative management
```

The `← guard` scenarios are the Phase 0b findings turned into permanent regression cases. Each must
fail against today's uncorrected rulebook and pass against the corrected one — that is what stops
the §3 defect class from reappearing.

Stored as fixtures alongside `lib/cases/rule-fixtures.ts`, each with the approving clinician and
approval date.

### G4 — Historical shadow replay
Reuse `lib/batch/reprocessing.ts` to regrade a representative retrospective clinical dataset (pilot
partner data, or production history where lawfully available) against the candidate
release without mutating their stored decisions. Compare category, timeframe, service line,
recommendation, matched pathway, and the distribution of changes. Output a per-priority migration
matrix (how many P3→P2, P2→P3, etc.) for clinical sign-off.

---

## 10. UI

### 10.1 View mode is the default

Most users are trying to understand the rules, not change them. `/rules` opens the **Rulebook** in
read-only View mode. Edit mode is a deliberate, permission-gated switch.

### 10.2 Default screen — collapsed hierarchy, not a 120-node canvas

```
Referral Grading Rulebook                        [Live ·  v2026-08-02]  [ View | Edit ]
Search: ⌕ ______________________          Expand to depth: [1] [2] [3] [All]

│
├─ ⚑ Immediate cancer or emergency indicators                    4 outcomes   1,204 cases  ▸
│
├─ ◆ Colposcopy referrals                                       39 outcomes   8,431 cases  ▾
│   ├─ Screening context                                        22 outcomes   6,004 cases  ▸
│   ├─ HPV result                                               11 outcomes   1,890 cases  ▸
│   ├─ Cytology                                                  4 outcomes     501 cases  ▸
│   ├─ Previous history                                           2 outcomes     36 cases  ▸
│   └─ ⚙ Clinical modifiers (immune deficiency)                            applies to 9 ▸
│
└─ ◆ Gynaecology referrals                                      38 outcomes   6,772 cases  ▾
    ├─ Presenting condition                                     26 outcomes   5,110 cases  ▸
    ├─ Severity                                                  7 outcomes   1,204 cases  ▸
    ├─ Previous management                                        3 outcomes    401 cases  ▸
    └─ ⚙ Clinical modifiers                                                 applies to 8 ▸
```

Affordances:

- **Expand / collapse** per branch; **expand to depth** 1/2/3/All as a global control.
- **Focus mode** — open any branch as its own root; the rest of the graph is hidden.
- **Breadcrumbs** — `Rulebook › Colposcopy › Screening context › HPV Other › Immune deficient`,
  each segment clickable to zoom back out.
- **Search** by clinical term, node id, outcome code, priority or timeframe; results list with
  path context, Enter jumps and expands to that node.
- **Minimap** in the canvas view for orientation in large branches.
- **Show only matched path** — enter a sample patient (or pick a historical case) and the view
  collapses to just the path that case takes, with each branch annotated why it was or was not
  taken. This reuses the active-path logic already in `FlowDiagram.tsx:103`.
- **Case volume per node**, from `RuleDecision` provenance over a chosen batch run or date range.

### 10.3 Node inspector (View mode)

Selecting any node opens a read-only panel:

```
◆ Decision · nd_01HHPV                          Colposcopy › Screening context
─────────────────────────────────────────────────────────────────────────────
Clinical question   What is the HPV result?
Field               hpv_result

Branches (evaluated in order)
  1  HPV 16/18            → Cytology result?              2,104 cases
  2  HPV Other            → Immune deficiency adjustment   1,890 cases
  3  Not detected         → Return to screening              412 cases
  ⌄  Anything else        → Insufficient evidence             38 cases   (fallback)

Outcome if this path ends here    —
Rationale                         —
Guideline reference               COLP Grading Guide, HPV result rows
Provenance                        reached from 1 parent · 4 outgoing paths
Cases reaching this node          4,444 (batch run 2026-07-28)
Recent changes                    12 Jul 2026 · Dr Patel · reordered branches 2 and 3
                                                                    [ Edit branch ]
```

### 10.4 Edit mode — controlled forms, never raw expressions

A clinical user must never type `hpvType === "OTHER" && cytology IN ["LSIL","ASC-US"]`. The
condition builder is three controlled fields sourced from the existing vocabulary
(`lib/cases/rule-vocabulary.ts:63`):

```
Add branch
──────────────────────────────────────────────────────────
Clinical field   [ Cytology result            ▾ ]
Operator         [ Is one of                  ▾ ]
Values           [ LSIL ✕ ] [ ASC-US ✕ ]  [ + Add value ▾ ]
Branch label     [ Normal or low-grade cytology            ]
Evaluate         ( ) Before  (•) After  the "HPV 16/18" branch

Leads to         (•) A new question   ( ) An outcome   ( ) An existing branch ▾
```

Operators offered per field type: `Is present` / `Is absent` / `Is one of` / `Is all of` /
`Is between` (numeric only) / `Anything else`. Values come from the closed vocabulary, so an author
cannot create a branch the extraction layer can never satisfy.

Outcome editing is equally controlled:

```
Service         [ Colposcopy         ▾ ]
Priority        [ P2 — High priority ▾ ]
Timeframe       [ Within 30 days     ▾ ]  or  [ __ ] days
Recommendation  [ High-priority colposcopy within 30 days   ]
Rationale       [ free text                                 ]
Requires SMO review  [ ✓ ]
Guideline reference  [ free text                            ]
```

Free text is allowed for node labels, rationale, reviewer notes and guideline references. It is
never used to construct executable logic.

**Undo/redo** across the whole editing session, with a visible change stack. Every mutation is
recorded as a typed operation (`addBranch`, `reorderBranch`, `editCondition`, `deleteSubtree`, …)
so undo is exact and the working copy's change list is what the reviewer reads.

### 10.5 Deletion — impact dialog, never automatic

No automatic "promote first child". Deleting a node opens:

```
⚠ Delete "Immune deficiency adjustment"?

This change will:
  • Remove 4 outcome paths            COL-027, COL-028, COL-037, COL-042
  • Affect 138 cases from batch run 2026-07-28
  • Change 31 cases from 6 months to 3 months
  • Leave 1 pathway without a fallback   (validation V4 would fail)

Choose what happens:
  ( ) Delete this branch and everything below it
  ( ) Replace this branch with a single outcome     [ choose outcome ▾ ]
  ( ) Move selected child branches up to the parent  [ select… ]
  (•) Cancel
                                                  [ Cancel ]  [ Continue ]
```

The dialog will not offer an option that leaves the graph invalid; it shows the failing validation
check instead.

### 10.6 Reviewer diff

Node-level semantic diff on the canvas — green outline added, amber changed, red dashed removed —
keyed on node/edge **ids**, so a renamed label reads as a change rather than a delete plus an add.
Alongside it: the compiled rule diff, the §9 bucket counts, and the G4 priority migration matrix.

---

## 11. Editor technology — spike required before Phase 6

`FlowDiagram.tsx` is a 560-line dependency-free SVG viewer with zoom, pan, pinch, bezier routing
and active-path highlighting. It is a good fit for the **read-only** Phase 4 view. It is not
currently a graph *editor* — no selection model, keyboard navigation, connection handling, nested
subflows, undo/redo integration or auto-layout.

Run a two-to-three day spike before Phase 6 committing to one of:

1. Extend `FlowDiagram.tsx` in place.
2. Adopt React Flow for the editing canvas.
3. Adopt ELK / `elkjs` for automatic layered and compound layout, with either renderer.

Evaluation criteria, scored against a prototype of the real colposcopy branch:

| Criterion | Why it matters here |
|---|---|
| Accessibility — keyboard-only traversal, screen reader labels | clinical governance tool; must not be mouse-only |
| Undo/redo integration | §10.4 requires an exact typed-operation stack |
| Connection handling | shared subtrees (§4.2) mean multi-parent edges |
| Nested subflows / compound layout | collapse-expand of §10.2 needs container nodes |
| Large-graph performance | 120+ nodes, target 60fps pan/zoom |
| Auto-layout quality on a DAG | hand-placed x/y is not viable once nodes are user-added |
| Testability | node-level assertions in CI without a browser |
| Bundle size and maintenance cost | this is one page of a clinical app |
| Licence terms for the features actually required | must be confirmed before adoption, not assumed |

Do not expand the custom component into a general graph-editing framework before this comparison
concludes. Equally, do not adopt a dependency before confirming the licence and the accessibility
story — both are hard to reverse later.

---

## 12. Migration strategy

1. **Complete Phase 0c first, separately (§14).** Do **not** reorder the list. Phase 0b showed
   reordering creates new shadows and that a plausible narrowing can break the rule it edits
   (§3.8). The correction is: clinically adjudicate the 11 urgency-changing discrepancies, apply
   verified predicate **narrowing** where approved, separately implement the missing fact
   production for the 5 operationally unreachable rules, and **exact-reverify the complete rule set
   after every composite correction** — iterating to a fixpoint. Ship it as its own reviewed release
   with its own clinical sign-off, so the redesign starts from a correct baseline.
2. **Hand-author the spine** (~15 decision nodes): flag check → service → context/condition → the
   primary axis for each line. Sourced from `docs/implemented-cervical-screening-decision-tree.md`
   §"High-Level Routing Order" and the colposcopy/gynaecology grading guides.
3. **Auto-factor the corrected rules into the spine.** For each rule, walk it down the spine
   matching conditions to edges, create the remaining discriminating decision nodes, attach the
   outcome leaf. Cross-cutting rules (§2a) attach above the context split; multi-context rules
   (§2b) become shared subtrees; modifier-carrying rules (§2c) become modifier clauses.
4. **Run all four gates**, adjudicate every difference, record approvals in
   `equivalenceReportJson`.
5. **Commit the graph as the baseline** in `BASELINE_RULE_RELEASES` (`rule-releases.ts:61`) with
   `graphSchemaVersion = "rule-graph-v1"`.
6. **Old releases keep working.** They have `sourceGraphJson = null` and render read-only in the
   existing flat list view. Nothing about historical `RuleDecision` rows changes.

---

## 13. Risks and mitigations

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | The §3 fix itself changes grades for live cases | high | high | Ship separately with G4 shadow replay and clinical sign-off before the redesign starts |
| R2 | Auto-factoring produces a machine-shaped graph clinicians won't accept | medium | medium | Hand-author the spine first; factoring only fills leaves; clinician reviews shape before gates run |
| R3 | Cross-product expansion explodes the compiled rule count | low | medium | V16 budget warning; measured at 81 → est. 120–180 rules; hard cap configurable |
| R4 | Overlap warnings (V8) become noise clinicians click through | high | medium | Only surface overlaps between *siblings*, inline at the branch, with the winning branch named; require per-overlap acknowledgement, not a global one |
| R5 | Shared subtrees make the "one tree" mental model confusing | medium | medium | Render as an inline expandable reference chip; Focus mode shows all callers |
| R6 | Editor spike concludes we need React Flow, adding a dependency and time | medium | low | Spike is timeboxed and precedes Phase 6; Phases 0–5 do not depend on the outcome |
| R7 | A correction introduces a new shadow or breaks the rule it edits | **high** | high | Observed twice in §3.6. Every candidate is re-verified exactly and iterated to a fixpoint; V21–V23 make this a permanent CI gate |
| R11 | Impact of the corrections is unquantified in patient terms | **high** | high | The synthetic population exercises 7 of 43 rules (§3.9); real historical replay is a hard gate in Phase 0c, and new archetypes are required |
| R12 | `COL-017` is treated as a defect when it is a deliberate fallback (or vice versa) | medium | high | Escalated as §15 question 1; no correction ships until answered |
| R8 | Clinical review capacity becomes the bottleneck | high | high | G3 golden scenarios are designed to be the clinician-facing artifact; machine-generated deltas are pre-triaged into buckets |
| R9 | Provenance columns bloat `RuleDecision` | low | low | `sourceNodePathJson` is a short id array; index only `sourceTerminalNodeId` |
| R10 | Two rulebooks in flight (flat + graph) during migration | medium | medium | Graph releases are additive; the runtime only ever reads compiled `definitionJson` |

---

## 14. Phases and acceptance criteria

### Phase 0 — Rule overlap and semantic analysis  ✅ COMPLETE
- `scripts/analyse-rule-overlap.ts` exists and is reproducible.
- **Acceptance:** ✅ 1,319 order-dependent pairs and 79/81 order-dependent rules quantified;
  26 cross-cutting, 7 multi-context and 17 modifier-carrying rules enumerated by code.

### Phase 0b — Exact reachability verification  ✅ COMPLETE
- `scripts/verify-rule-reachability.ts` and `scripts/shadow-regrade-corrections.ts` are
  reproducible; register written to `docs/clinical-audit/06-reachability-register.{csv,json}`.
- **Acceptance:** ✅ legal fact domain derived from the actual producers (§3.1); boundary-complete
  numeric domains; all 81 rules decided with zero unproven; every SAT witness independently
  confirmed against `evaluateCaseRuleRelease`; findings classified as shadowed / operationally
  unreachable / reachable; discrepancy register produced with urgency direction per rule;
  correction strategies compared with exact re-verification (§3.6).

### Phase 0c — Clinical adjudication and correction release  ⬜ BLOCKED, DO FIRST
Blocked on production data access and clinical decisions. Nothing here is started.
- **Acceptance:**
  - `COL-017` intent resolved: defect, or intentionally-inactive fallback (§3.4).
  - Replay against a representative retrospective clinical dataset (pilot-partner data, or
    production history where it lawfully exists) for `C6-COMPOSITE`, with changed case ids,
    before/after outcomes and matched rules, urgency-increase and urgency-decrease counts,
    unchanged population and aggregate distribution enumerated.
  - Each of the 11 discrepancies individually signed off with a retrospective-review decision;
    the single under-triage case (`COL-017`) decided separately from the ten over-triage cases.
  - Exact re-verification of the corrected list: zero unintended shadows, zero new unreachable
    rules, all golden scenarios pass.
  - Extraction work scoped for the 5 operationally unreachable rules (§3.7), `GYN-035` first.
  - Regression archetypes added covering re-referral and surveillance contexts, so the population
    exercises more than 7 of 43 rules (§3.9).
  - Shipped as its own release with its own hashes, validation report and sign-offs. The current
    production release stays immutable; cases whose grade materially changes go to a controlled
    review queue rather than being silently overwritten.

### Phase 1 — Canonical schema, validators, compiler
- **Acceptance:** `rule-graph-v1` types published; all 25 validation checks (V1–V25, §8 groups A–C) implemented with unit
  tests including deliberate-failure fixtures; `compileGraph` is pure and byte-deterministic;
  round-trip test compiles the seeded graph and matches a stored golden output.

### Phase 2 — Provenance and immutable release artifacts
- **Acceptance:** migration adds the §7.1 columns and the §6 `RuleDecision` columns; both hashes
  computed and verified on write; a graded case can be traced from `RuleDecision` to its terminal
  node id and full node path; existing releases still load and grade unchanged.

### Phase 3 — Migration and equivalence harness
- **Acceptance:** the corrected 81 rules are represented as one graph; all four gates run in CI;
  G2 reports zero `unexplained_difference`, zero `unmatched`, zero `multiply_matched`; G3 golden
  scenarios approved by name and date; G4 replay signed off.

### Phase 4 — Read-only collapsible rulebook
- **Acceptance:** `/rules` opens the collapsed hierarchy; expand/collapse and depth 1/2/3/All work;
  node inspector shows question, branches, outcome, rationale, reference, provenance and case
  counts; keyboard traversal works; no editing affordances are reachable.

### Phase 5 — Search, focus mode, patient-path simulation, impact analytics
- **Acceptance:** search finds by clinical term, node id, outcome code, priority and timeframe;
  focus mode and breadcrumbs work; minimap renders; a sample or historical case collapses the view
  to its matched path with per-branch explanations; case volumes render per node for a selected run.

### Phase 6 — Controlled editing with undo/redo
- **Acceptance:** editor technology spike (§11) concluded and recorded; all edits go through
  controlled field/operator/value forms; no raw expression input exists; undo/redo is exact over
  typed operations; the deletion impact dialog (§10.5) is enforced with no automatic child
  promotion; §8 group A runs on every save, group B on VALIDATED, group C at the review gate.

### Phase 7 — Semantic diff, four-eyes review, shadow replay, activation
- **Acceptance:** node-id-keyed semantic diff renders on canvas; reviewer sees compiled diff plus
  §9 buckets plus the G4 migration matrix; activation blocked while any unexplained difference,
  unmatched case or multiply matched case remains; reviewer ≠ activator still enforced; History tab
  lists releases by date, author and change summary with Compare and Restore.

**No time estimate is offered for Phases 1–7.** The earlier 9–12 day figure is withdrawn: it was
based on the pure-tree model that §2 disproves, and it predates the Phase 0a work. Re-estimate
after Phase 0a and the §11 spike.

---

## 15. Open questions for the clinical owner

1. **`COL-017` — is it a defect or a deliberate dead fallback?** `rule-policy.ts:94` calls it the
   "30d fallback" behind COL-027/028. It is the only **under-triage** in the register: an
   immune-deficient HPV Other patient the rule intends to see in 30 days is booked at 90. If the
   fallback reading is correct, the fix is to mark it intentionally inactive; if not, it is the
   highest-risk item in this document. Nothing else in Phase 0c can be finalised until this is
   answered.
2. **The ten over-triage discrepancies** (§3.6) book patients sooner than intended — for example a
   previous-normal-colposcopy re-referral with HPV 16/18 and no cytology at 30 days instead of 6
   months. Who signs these off, and do cases already graded under the current release need
   retrospective review, or only prospective correction?
3. **`GYN-035`** — mesh and sling complications cannot be routed at all today because no producer
   emits those facts (§3.7). Is that an accepted gap, and what is the interim manual pathway?
4. Is a non-zero `approved_difference` count acceptable at launch, provided each item is
   individually signed off and recorded on the release?
5. Should clinical reviewers be able to edit nodes directly, or only comment and approve? Today
   `canEditCaseRuleDrafts` is ADMIN-only (`rule-governance.ts:9`) while review is clinician-only.
6. Must outcome codes (`COL-027`) stay stable forever for external reporting, or may the graph
   renumber them when branches are restructured?
7. For the 7 multi-context gynaecology rules (§2b): is a shared subtree reached from several
   contexts clinically acceptable, or must each context own a visibly separate copy?


---

## 16. Corrections log — statements removed or superseded

Every stale or contradictory claim from earlier revisions, and what replaced it. Kept so a reviewer
comparing revisions can see exactly what changed and why.

| # | Removed statement | Replaced by |
|---|---|---|
| 1 | "A first-match-wins ordered rule list is exactly a depth-first flattening of a tree." | §2 — false for this rulebook: 1,319 order-dependent pairs, 79/81 rules order-dependent. Target model is an ordered DAG with explicit local priority. |
| 2 | "21 unreachable colposcopy rules, 14 grade-changing." | §3.4 — searched an unconstrained label space. Now 19 shadowed + 5 operationally unreachable, 11 urgency-changing. |
| 3 | "58 reachable, 18 shadowed" (union over pipelines). | §3.4 — unioning concealed pipeline-specific defects. `COL-008/009/010` are dead in batch; `COL-031/033` dead in case; shadowed rises to 19. |
| 4 | "Migration step 1: reorder the colposcopy list so the 21 unreachable rules become reachable." | §12 step 1 — reordering is disproven (§3.8). Replaced with clinical adjudication → verified predicate narrowing → separate extraction work → exact re-verification to a fixpoint. |
| 5 | "G2 would classify 14 genuine bug-fixes as differences." | §9 — 11. |
| 6 | "Phase 1: all 20 validation checks." / "Phase 6: V1–V20 run on every save." | §8 — V1–V25, grouped A (edit-time) / B (compilation) / C (release gates). Phases reference the groups. |
| 7 | "Freeze the current release; record `sourceGraphHash`/`compiledHash` for it." | §3.10 — a legacy release has no source graph; assigning it a `sourceGraphHash` would fabricate provenance. `compiledHash` only. |
| 8 | "The class of bug in §3 cannot be authored." | §8.1 — withdrawn. A broad *explicit* branch still shadows a later specific one. V21/V22/V23 are the enforcement; the graph provides visibility, not immunity. |
| 9 | Example JSON encoding "no cytology reported" as `absent "Normal cytology"`. | §4.7 — the encoding was wrong: an ASC-US case also has `Normal cytology` absent, so the low-grade branch was unreachable. Replaced by `fieldMissing`, with an executable fixture and a regression guard. |
| 10 | Example JSON missing root/service/context/terminal edges and the `COL-017` outcome. | §4.7 — complete executable fixture. `COL-017` deliberately excluded pending clinical adjudication. |
| 11 | `{ op: "present", field: "Immune deficient" }` and `{ op: "anyOf", field: "cytology" }` sharing one `field` key. | §4.4 — typed predicates over stable `FieldId`/`ValueId`/`FactId`; clinical fields and flat facts are distinct kinds. |
| 12 | Modifier pass-through compiled via `withNegatedClauses(...)`. | §5.3 — the evaluator cannot represent arbitrary condition complements. Compiles by ordering instead, with V25 requiring exhaustive clause subtrees. |
| 13 | `modifier.passThroughTo`, `modifier.redirect.to`, `reference.attachedTo` as node properties. | §4.5 — all control flow is edges with roles. `reference` is no longer a node type; citations are metadata. |
| 14 | One end-to-end graph *and* `CaseRuleSetRelease.serviceLine` as the release. | §7.1 — parent `CaseRulebookRelease` owning one source graph and per-service compiled artifacts; activation atomic across both. |
| 15 | A single mutable release row acting as both working copy and immutable artifact; no lifecycle column. | §7.2 — `RulebookDraft` (mutable, revisioned, optimistically locked, approval auto-invalidated on edit) separate from immutable `CaseRulebookRelease`. |
| 16 | `matchedRuleCode` implicitly identifying one predicate. | §6 — shared subtrees and cross-product expansion produce several compiled rules per clinical code. `compiledRuleInstanceId` added. |
| 17 | V16 (expansion budget) as a warning. | §8 group B — error. An unbounded expansion makes compilation and runtime unsafe. |
| 18 | V24 labelled a warning while stated to block review. | §8 group C — error at the review gate. |
| 19 | `multiply_matched` described as "branches without explicit priority between them". | §9 — sibling edges always have unique priority (V6). The bucket catches ambiguity **across paths** in compiled output. |
| 20 | "Historical replay against real production referrals." | §9/§14 — "a representative retrospective clinical dataset from a pilot partner, or production history where such history lawfully exists". |
| 21 | "Zero collateral change is evidence of safety." | §3.8/§3.9 — proves only that no difference was observed in the limited synthetic domain those archetypes cover. The population exercises 7 of 43 rules. |
| 22 | Phase estimate of 9–12 days for Phases 1–4. | §14 — withdrawn; predates Phase 0b and the §11 spike. |

### Still open, deliberately

- `COL-017`'s intent (§15 q1) — not encoded either way in the fixture.
- Real-population impact of the corrections — blocked on retrospective data access.
- Editor technology (§11) — timeboxed spike, precedes Phase 6.

---

## 17. Thin vertical architecture proof — results

Built on one bounded pathway, **Figure 4 (follow-up after normal colposcopy)**, transcribed from
`evaluateFigure4` (`lib/engine/decision-engine.ts:513`). Nothing live was modified.

```
scripts/prototype/vertical-proof/model.ts        four-layer types
scripts/prototype/vertical-proof/pathway-f4.ts   national pathway + local overlay
scripts/prototype/vertical-proof/engine.ts       direct interpreter + triage compiler
scripts/prototype/vertical-proof/vertical-proof.test.ts

npx tsx --test scripts/prototype/vertical-proof/vertical-proof.test.ts   # 16/16 pass
```

### 17.1 The four layers

| Layer | Artifact | Versioned by |
|---|---|---|
| 1 Clinical pathway graph | `FIGURE_4`, source ids `F4-01`–`F4-10`, addendum `A26-07` | `sourceVersion: NCSP-2023` |
| 2 Local triage overlay | `COLPOSCOPY_OVERLAY`, codes `COL-004/035/036/037/038/003` | `localPolicyVersion: CM-Health-local-2026.1` |
| 3 Canonical clinical state | `CanonicalClinicalState` with `known / missing / notPerformed / conflicted` per field, plus provenance and confidence | `canonical-state-v1` |
| 4 Workflow action model | 9 typed `ClinicalAction` kinds | — |

### 17.2 Most terminals are not referral grades

Figure 4 has 11 terminals. **4 are referrals.** The rest: 2 recalls, 1 discharge, 2 information
requests, 1 mandatory clinician review, 1 safety escalation. An `OutcomeSpec` of
{service, priority, timeframe, recommendation} cannot represent 7 of 11 — which is the concrete
evidence for the scope correction in §1b.

### 17.3 Automation boundary is enforced, not advisory

`EXECUTION_POLICY` maps each of the 8 boundaries to four permissions. **`autoFinalisable` is false
for every boundary in this prototype**, matching the source rulebook's position that outputs remain
provisional. The compiler refuses to compile any terminal whose boundary is not `compilable`, and
records why:

```
nd_f4_t10  CLINICIAN_LED  → "boundary CLINICIAN_LED is not compilable — needs a human"
nd_f4_t02  DETERMINISTIC  → "action recall is not a referral grade — needs the workflow executor"
nd_f4_t06  REVIEW_REQUIRED→ "action requestInformation is not a referral grade — …"
```

### 17.4 Direct interpreter versus compiled — the oracle worked

`evaluateRuleGraph(graph, canonicalState)` walks the graph directly. It does not call the compiler
and does not call `evaluateCaseRuleRelease`.

| Measure | Result |
|---|---|
| Exhaustive legal canonical states | **420** (5 HPV × 7 cytology × 3 stage × 2 colposcopy × 2 immune) |
| States reaching a compiled terminal | 74 |
| Direct vs compiled agreement | **74 / 74** |

**The differential test found a real defect on its first run.** The pathway refers *every* HPV 16/18
case (`F4-04`), but the overlay priced only two cytology cases — `COL-035` (no cytology) and
`COL-036` (normal/low-grade). An ASC-H/HSIL/SCC case reached the terminal and compiled to nothing,
falling through to the default. Testing compiled output against itself would never have shown this.

Two fixes, both applied: a **branch-local fallback overlay entry** (`COL-004`, the live rulebook's
general HPV 16/18 price), and a new validator `validateOverlayCoverage` that makes a missing
fallback a hard error. This is the §9 branch-totality requirement applied to the overlay layer, not
just to graph siblings.

### 17.5 Pipeline applicability

Declared applicability is now distinct from "present in the compiled artifact":

| Terminal | Declared | Classification |
|---|---|---|
| `nd_f4_t04 05 07 08` | BATCH, CASE, WORKFLOW | expected both |
| `nd_f4_t02 03 09` | WORKFLOW | expected workflow-only |
| `nd_f4_t01 06 10`, `nd_f4_conflict` | CASE, WORKFLOW | expected non-compiled — served by the review/workflow executor |

A witness is required only in a **declared** pipeline. A terminal absent from a pipeline it never
declared is not a defect — the correction the reviewer asked for after §3.4 reported `COL-008/009/010`
as batch-dead.

### 17.6 Provenance, both levels

```
terminal nd_f4_t08  (immune-deficient HPV Other → colposcopy)
  sourceRuleIds              ["F4-08"]
  sourceVersion              "NCSP-2023"
  controllingAddendumRuleIds ["A26-07"]        ← 2026 overlay controls the base guidance
  localOverlayRuleIds        ["COL-037"]
  localPolicyVersion         "CM-Health-local-2026.1"
  compiledRuleInstanceId     rel_…::nd_f4_t08::ed_…>ed_…::4
```

One pathway terminal, three overlay entries, three compiled rules, three distinct instance ids, one
shared `sourceRuleIds` — proving that `matchedRuleCode` alone cannot identify an executed predicate
and that the overlay prices without deciding.

### 17.7 Longitudinal execution is explicitly out of the graph

The graph is point-in-time. `recall`, `screeningInvitation` and `transitionToPathway` actions emit
*future work*; they do not advance the pathway within one evaluation. `CanonicalClinicalState.history`
carries persisted workflow state (`priorRecallsCompleted`, `lastEventAt`) so the next event re-enters
the correct subgraph. Test of Cure and the 6–8 week abnormal-bleeding review are therefore workflow
sequences, not single evaluations — the workflow executor itself is **not** built in this proof and
remains an open design item.

### 17.8 What this proof does not establish

- Only Figure 4. Figures 1–3 and 5–10 and Table 1 are not represented.
- The workflow executor is designed but not implemented.
- The overlay-to-pathway mapping in `pathway-f4.ts` is a faithful transcription of the *code*, not a
  clinically approved mapping. `COL-035`–`COL-038` are attached to Figure 4 terminals on structural
  grounds and need clinical confirmation.
- No real-population data. The 420 states are the exhaustive *legal* space, not an observed
  distribution.
