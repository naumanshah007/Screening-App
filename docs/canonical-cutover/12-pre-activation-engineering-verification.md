# 12 — Pre-Activation Engineering Verification

Evidence for the implementation phase. **Canonical clinical authority remains OFF.**

---

## 1. Identity

| Item | Value |
|---|---|
| Production (`origin/main`) | `fb933c3768b76084ad0ebe91eacee93cfac08444` |
| Candidate branch tip at start | `ab1eb0ea2e76ca262ec3cb6b4402c9e0d3a2c789` |
| Commit named in the brief (`94250e1`) | ancestor of the tip, **not** the tip — 3 commits behind |
| Implementation branch | `feat/canonical-authority-layer` |
| Starting HEAD | `ab1eb0e` |
| Local `main` | **11 commits behind `origin/main` — not used** |

## 2. Test results

Run per suite with `tsx --test --test-reporter=tap`.

| Suite | Baseline (`ab1eb0e`) | After implementation |
|---|---|---|
| `lib/engine` | 147 / 144 pass / 0 fail / 3 todo | **152 / 149 / 0 / 3** |
| `lib/batch` | 208 / 208 / 0 | **216 / 216 / 0** |
| `lib/clinical-rules` | 910 / 910 / 0 | **963 / 963 / 0** |
| `tests/security` | 3 / 3 / 0 | **3 / 3 / 0** |
| `tests/clinical-conformance` | 6 / 6 / 0 | **6 / 6 / 0** |
| **Total** | **1,274 / 1,271 / 0 fail / 3 todo** | **1,340 / 1,337 / 0 fail / 3 todo** |

**+66 tests, 0 failures, 0 regressions.** The baseline 1,271 matches the figure reported in the brief exactly.

The 3 `todo` entries are pre-existing router defects (`ROUTER-001/002/003`), explicitly marked in `source-router-regression.test.ts` as *"also fails on production fb933c3"*. They are unchanged by this work.

`tsc --noEmit`: clean. `eslint`: 0 errors, 20 warnings (all pre-existing, none in files added here). `npm run build`: compiled successfully.

## 3. Clean-checkout result — **a blocking finding**

A fresh detached worktree at `26b6f0b`, `npm ci`, `prisma generate`:

| Suite | Clean checkout | After restoring the source package |
|---|---|---|
| `lib/engine` | 152 / 149 / 0 fail | 152 / 149 / 0 |
| `lib/batch` | 216 / 216 / 0 | 216 / 216 / 0 |
| `lib/clinical-rules` | 963 / **63 pass / 900 FAIL** | **963 / 963 / 0** |
| `tests/security` | 3 / 3 / 0 | 3 / 3 / 0 |
| `tests/clinical-conformance` | 6 / 6 / 0 | 6 / 6 / 0 |
| Build | ✓ | ✓ |

> ### Finding VERIFY-01 — the governed clinical source package is not in version control
>
> **Severity: HIGH. BLOCKS_CANONICAL_ACTIVATION.**
>
> `docs/clinical-sources/source-v2.1` (39 MB) is **untracked**. Every failure above is
> `Unable to locate the v2.1 rule package`.
>
> Consequences:
>
> 1. **The clean-checkout claim is not currently true.** "1,271 tests passing in a clean checkout" holds only when a 39 MB untracked directory happens to be present on the machine. On genuinely clean infrastructure — CI, a new engineer's laptop, a release build — 900 tests fail.
> 2. **The canonical snapshot cannot be rebuilt from the repository.** The snapshot is checksummed, but the *source it is derived from* is outside version control, so the checksum cannot be independently reproduced from a clean checkout. For a national screening ruleset that is a governance gap, not a convenience one.
> 3. **No acceptance gate in [06](06-acceptance-test-plan.md) can be evidenced reproducibly** until this is fixed.
>
> This was not introduced by this work — it is a property of the candidate branch. It was not previously reported because every prior run happened in a working tree where the package was present.
>
> **Required before activation:** commit the package (or a deterministic, checksummed extract sufficient to rebuild the snapshot) to version control, or store it in a pinned, checksum-verified artefact the build fetches. Whichever is chosen, `sourceJsonSha256` must be verifiable from a clean checkout. This decision has a licensing dimension — the package contains NCSP guideline PDFs — so it needs an owner, not just an engineer.

## 4. Safety-state confirmation

| Assertion | Verified how | Result |
|---|---|---|
| CG-NCSP-3.1.0 remains DRAFT | no publish/activate script was run; no database was connected | **DRAFT** |
| Publications created | none — `publishClinicalRuleVersion` never called | **0** |
| Activations created | none — `activateClinicalRuleVersion` never called | **0** |
| `LIVE_PRODUCTION` evaluations created | the mode is unreachable: blocker + no activation + flag off | **0** |
| Historical decisions modified | no database connection was opened at any point | **0** |
| Production deployment | none | **none** |
| Push to `main` | none | **none** |
| Production credentials used | none read, entered or printed | **none** |
| External clinical integrations triggered | none | **none** |

All tests are pure functions over the rebuilt snapshot. No test in this work opens a database connection.

## 5. Gate status against [06](06-acceptance-test-plan.md)

| Gate | Status |
|---|---|
| A11 alias-registry fix | **MET** — already landed upstream at `6c958f6`; guarded by `alias-non-equivalence.test.ts` (6/6). Verified, not re-fixed. |
| B1–B4 router probes and regressions | **MET** — 0 regressions; 3 pre-existing todos unchanged |
| B5 router identical under either authority | **MET** — routing is structurally legacy-only; asserted in `decision-adapter.test.ts` |
| C1 interval mapping | **PARTIAL — see §6.** 100% classification, not 100% conversion |
| C2 destination mapping | **MET** — 44/44 literals, fail-closed |
| C3 regex urgency removed | **MET** — `inferUrgency` deleted; 0 occurrences in the authority path |
| C4 never de-escalates | **MET** — asserted across all 203 rules |
| C5 deterministic recommendation code | **MET** |
| C6 missing-information labels | **NOT DONE** — needs the field-dictionary UI wiring |
| C7 overlay inert under canonical | **MET** — and the overlay is unwired; see [09](09-guideline-overlay-transition.md) |
| C8 fabricated facts = 0 | **MET** |
| C9 `DERIVED_ROUTER` provenance | **MET** |
| D2, D3, D4 immutability / regrade / pinning | **MET** at unit level; database-backed tests outstanding |
| D1 historical records rewritten = 0 | **MET** — 0, no database touched |
| E1–E9 workflow suites | **NOT DONE** — needs an integration environment |
| E10 existing suite | **MET** — 1,337 pass, 0 fail |
| E11 typecheck / lint / build | **MET** |
| F1, F2 lifecycle and rollback rehearsal | **NOT DONE** — needs a `VALIDATION` environment |
| F5 mixed-authority window = 0 s | **MET by construction** — the cache is removed |
| F7 cross-org isolation | **MET** at resolver level; database-backed test outstanding |
| G1–G8 security and operations | **NOT DONE** — all remain open |
| H1–H7 governance sign-off | **NOT DONE** — all remain open |

## 6. Honest gate exception

**C1 as literally worded ("structured interval mapping success = 100%") is not met, and should not be met.**

100% *classification* coverage is achieved: all 104 timing literals have an explicit reviewed entry, verified against the rebuilt snapshot, with no stale entries. 100% *conversion to `{value, unit}`* is not achieved, because only 8 of 104 literals state an unambiguous interval. Converting the rest would require fabricating clinical intervals or changing the governed ruleset.

The underlying safety requirements are fully met: no clinically significant interval depends on parsing prose, and a non-schedulable timing produces an explicit clinician determination rather than a silent null.

Reported here rather than folded into a green tick, per the brief's instruction to report an intentional gate violation separately rather than hide it.

## 7. Remaining blockers

**Clinical / governance (unchanged by this work, all still open):**
GOV-04 operating point · regrade policy for the 26 defects · written acceptance of the conditional within-pathway model · GOV-01/02/03 · LEGACY-005/-014/-017/-026 · the 2 input-gap adjudications · second-approver policy (ACT-03).

**Newly evidenced:** the low automated-recall coverage (§6) is material to the GOV-04 operating-point decision and should be put in front of the risk owner with it.

**Security / operational (all still open):**
R1–R5 unsigned · R6 not confirmed closed in the production environment · authenticated production-readiness QA · backup/restore rehearsal · monitors (SEC-03) · separation of duty (SEC-02).

**Engineering (new):**
VERIFY-01 source package not in version control (**blocking**) · C6 missing-information labels · database-backed pinning/activation tests · E-group workflow suites · F1/F2 rehearsals in a `VALIDATION` environment · STACK-01 (separate stack, separate owner).
