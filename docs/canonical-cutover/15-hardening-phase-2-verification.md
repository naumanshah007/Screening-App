# 15 — Pre-Activation Hardening Phase 2 Verification

**Canonical clinical authority remains OFF.** CG-NCSP-3.1.0 stays DRAFT, unpublished, inactive, SHADOW/SIMULATION.

---

## 1. Identity

| Item | Value |
|---|---|
| Starting SHA (verified, not assumed) | `f044960e255989d5b79f8fea45e12aac535687c1` |
| Final SHA | see §9 |
| `origin/main` | `fb933c3768b76084ad0ebe91eacee93cfac08444` — **unchanged** |
| Branch | `feat/canonical-authority-layer` |

## 2. Test results

| Suite | Phase 1 end | Phase 2 end |
|---|---|---|
| `lib/engine` | 152 / 149 / 0 fail / 3 todo | **152 / 149 / 0 / 3** |
| `lib/batch` | 216 / 216 / 0 | **216 / 216 / 0** |
| `lib/clinical-rules` | 963 / 963 / 0 | **978 / 978 / 0** |
| `tests/security` | 3 / 3 / 0 | **3 / 3 / 0** |
| `tests/clinical-conformance` | 6 / 6 / 0 | **6 / 6 / 0** |
| `tests/db` *(new)* | — | **28 / 28 / 0** |
| **Total** | 1,340 / 1,337 | **1,383 / 1,380 / 0 fail / 3 todo** |

The 3 todos remain the pre-existing router defects (`ROUTER-001/002/003`), which also fail on production `fb933c3`.

**Other checks:** `prisma generate` ✓ · `typecheck` clean ✓ · `lint --max-warnings=100` 0 errors / 20 pre-existing warnings ✓ · `prisma validate` ✓ · `git diff --check` clean ✓ · `build` compiles ✓.

`prisma migrate status` reports `P1003: Database dev.db does not exist` — expected, because no local development database is provisioned in this worktree. Not a defect.

## 3. Gate results

| Gate | Result |
|---|---|
| Canonical semantic regressions | **0** — 179-case corpus green |
| Canonical less-urgent-than-legacy | **0** — asserted across all 203 rules |
| Router regressions | **0** |
| Unsafe missing-data regressions | **0** |
| Fabricated clinical facts | **0** |
| Free-text urgency derivations | **0** — `inferUrgency` deleted |
| Free-text interval parsing dependencies | **0** — closed literal table only |
| Figure 5/6 false equivalences | **0** |
| Glandular/urgent false equivalences | **0** |
| Unexplained clinical differences | **0** |
| Table 1 | **21/21** |
| Input representation | **18/18** |
| Historical governed recommendations destroyed | **0** |
| DB-backed authority failures | **0** — 14/14 scenarios |
| Pinning failures | **0** |
| Rollback history loss | **0** |
| `LIVE_PRODUCTION` rows outside a test DB | **0** |
| Publications | **0** |
| Activations | **0** (outside throwaway test databases) |
| Authority resolution nondeterminism | **0** over 25 concurrent resolutions |
| Cross-organisation authority leakage | **0** |

## 4. VERIFY-01 — resolved

`REPOSITORY_SELF_CONTAINED_WITH_DERIVED_GOVERNED_SNAPSHOT`. Clean checkout went from **900 failures to 0**. Full detail in [13](13-source-artifact-and-reproducibility.md).

## 5. STACK-01 — partially resolved

Governed evaluations proved untouchable three ways; this stack's replaced recommendations are now recoverable from the append-only audit log. `RuleDecision` immutability (STACK-01-B) remains open and belongs to the cases-v2 owner. Full detail in [14](14-third-stack-resolution.md).

## 6. Timing / recall capability — GOV-04 evidence

| Category | Rules | Share |
|---|---:|---:|
| `AUTO_SCHEDULABLE_EXACT` | 18 | 8.9% |
| `AUTO_SCHEDULABLE_BOUNDED` | 2 | 1.0% |
| `CLINICIAN_TIMING_REQUIRED` | 40 | 19.7% |
| `IMMEDIATE_OR_EVENT_DRIVEN` | 60 | 29.6% |
| `NO_RECALL_DATE_APPLICABLE` | 83 | 40.9% |
| **Total** | **203** | |

**Only 20 of 203 rules (9.9%) permit a machine-generated recall date.**

Proved for every rule: no prose parsing, no silent null, no invented timing, the governed timing text is always displayable, and the workflow knows whether a machine-generated date is permissible.

**Workflows that would break where canonical returns `CLINICIAN_TIMING_REQUIRED`:**

| Workflow | Dependency | Effect |
|---|---|---|
| `ScreeningSession.nextScreeningDue` | `addMonths(now, recallIntervalMonths)` | no date set; the case must route to clinician determination |
| Recall generation / overdue-recall analytics | `nextScreeningDue` | the participant does not appear in recall reporting until a clinician sets a date |
| Recall notifications | `nextScreeningDue` | no automated notification |
| Batch worklist "next action" | recall interval | shows a clinician-determination stop instead of a date |

This is fail-safe — a stop is visible; a silent null would not be. But it means **canonical authority moves most follow-up scheduling from the system to clinicians**, which is a capacity question, not a code question. It belongs in front of the risk owner **together with** the GOV-04 152/179 clinician-only figure, because the two compound.

## 7. Missing-information behaviour

The five fact statuses are preserved distinctly by `canonicalClinicalFactsV2ToFactMap`:

| Status | Treatment | Collapsed? |
|---|---|---|
| `KNOWN` | value enters the fact map | — |
| `UNKNOWN` | not in the fact map; listed in `factsMissing` | no |
| `NOT_RECORDED` | not in the fact map; listed in `factsMissing` | **shares the missing channel with `UNKNOWN`** |
| `NOT_APPLICABLE` | not in the fact map; listed in `factsMissing` | **shares the missing channel** |
| `PENDING` | not in the fact map; listed in `factsMissing` | **shares the missing channel** |
| `CONFLICTING` | listed in `factsConflicting` **and** `factsMissing`; forces a `SPECIALIST_REVIEW` stop | no — distinct branch |

> ### Finding MISS-01 — four statuses share one downstream channel
>
> `UNKNOWN`, `NOT_RECORDED`, `NOT_APPLICABLE` and `PENDING` all resolve to "absent" and land in `factsMissing`. The *evaluation outcome* is identical for all four — a safety stop — so **no clinical interpretation currently changes**, and the direction is fail-safe.
>
> They are distinguishable where it matters most: the original status is preserved verbatim in the immutable `canonicalInputSnapshot`, so the distinction is never lost from the record, only from the evaluation channel.
>
> The gap is **reviewer-facing**: a reviewer told "hpvResult is missing" cannot tell from the evaluation whether it is unknown, not recorded, not applicable to this participant, or pending a lab result — which are four different actions. `NOT_APPLICABLE` is the sharpest case: chasing information that does not apply is wasted reviewer effort.
>
> **Classification: ENGINEERING, non-blocking for activation** (fail-safe, nothing collapsed that changes a clinical outcome), **blocking for reviewer usability at scale.** Fix belongs with the missing-information label work (C6), which is still outstanding.
>
> Fabricated clinical facts remain **0** in all paths.

## 8. Security status (R1–R6)

**No login was attempted. No credential value was read, printed or committed.**

**R1–R5.** `npm audit --omit=dev`: **15 runtime advisories — 13 high, 2 moderate**; 18 including dev. Direct runtime dependencies among them: `@auth/prisma-adapter` (high), `exceljs` (moderate). All five acceptances remain **unsigned**. Unchanged by this phase.

**R6 — decomposed as requested:**

| | Aspect | Status |
|---|---|---|
| **A** | Credentials displayed in the UI | **Remediated.** Removed at `4a47c12`; guarded by `tests/security/login-no-credential-exposure.test.ts` (3/3 passing). |
| **B** | Credentials still valid | **UNKNOWN — cannot be determined from the repository.** Requires checking the production user store. Not attempted. **This is the aspect that matters and it is unresolved.** |
| **C** | Credentials present in git history | **YES.** `4a47c12` removed them, and `74b9452` ("Prepare app for production deployment") introduced them. History rewriting is not proposed; **rotation is the correct remedy**, which folds into (B). |
| **D** | Credentials present in current source | **No hard-coded credential pair found in application source.** `prisma/seed.ts` and `scripts/demo-reset.ts` each create a user — seeded demo accounts must be included in the (B) check. |
| **E** | Preview protection | **UNKNOWN — not verifiable from the repository.** `vercel.json` carries only regions and a cron; deployment protection is a dashboard setting and there is no `.vercel` link in this worktree. |

**Gate mapping:**

| Item | Blocks merge | Blocks **deploy** | Blocks **canonical activation** |
|---|:-:|:-:|:-:|
| R1, R2, R4 (runtime, unsigned) | no | **yes** | yes |
| R3, R5 (dev-only) | no | no | no |
| R6-A (UI display) | no | resolved | resolved |
| R6-B (validity) | no | **yes** | **yes** |
| R6-C (history) | no | **yes** (via rotation) | yes |
| R6-E (preview protection) | no | **yes, for Preview** | n/a |

## 9. Clean checkout — Phase 11

Fresh detached worktree, `npm ci`, `prisma generate`, **no source package present**:

| Suite | Result |
|---|---|
| `lib/engine` | 152 / 149 pass / 0 fail / 3 todo |
| `lib/batch` | 216 / 216 / 0 |
| `lib/clinical-rules` | 978 / 973 / 0 fail / **5 skipped** |
| `tests/security` | 3 / 3 / 0 |
| `tests/clinical-conformance` | 6 / 6 / 0 |
| `tests/db` | 28 / 28 / 0 |
| **Total** | **1,383 / 1,375 / 0 fail / 3 todo / 5 skipped** |
| `build` | ✓ compiled |
| `typecheck` | ✓ clean |

### Classification: **`CLEAN_CHECKOUT_REPRODUCIBLE_EXCEPT_EXTERNAL_GOVERNED_SOURCE_ARTIFACT`**

**This is B, not a full pass.** Five source-verification tests skip without the external artefact.

**How a CI job or a reviewer obtains and verifies the artefact**, without relying on an undocumented local folder:

1. Obtain `source-v2.1` from the governed store chosen in [13](13-source-artifact-and-reproducibility.md) §6 — **that storage decision is still owed by a human** (redistribution rights are unknown).
2. Place it at either `docs/clinical-rules/source-v2.1` or `docs/clinical-sources/source-v2.1/CerviGrade_NCSP_Master_Rulebook_Package_v2_1`; both are probed by `isSourcePackageAvailable()`.
3. Run `npm run test:source-verification`. It rebuilds both snapshots from the package and asserts byte-identity with the committed fixtures plus manifest agreement on `sourceJsonSha256`.
4. The suite **skips with an explicit reason** if the artefact is absent, so a CI job that silently lacks it cannot report a false pass. A guard test keeps the skip condition honest.

**This must pass before CG-NCSP-3.1.0 is published.** Publication asserts that a checksummed snapshot faithfully represents the national source, and that assertion must be verifiable by someone other than the author.

## 10. Preview deployment — Phase 12 NOT performed

**No branch was pushed. No Preview was created.**

The brief authorises a push "only if engineering gates pass" and instructs: *"If there is any uncertainty, do not push and report instead."* There is uncertainty on two of the four items the brief requires me to confirm:

| Required confirmation | Can I confirm it? |
|---|---|
| Preview environment | Yes, by branch name — but only after pushing |
| Exact SHA | Yes |
| **Vercel Authentication enabled** | **No.** Deployment protection is a dashboard setting; `vercel.json` does not carry it and there is no `.vercel` project link in this worktree. |
| **No custom production domain** | **No.** Not determinable from the repository. |

Combined with **R6-B unresolved** — the demo credentials may still be valid — pushing could stand up a new deployment of the same authentication stack at a new URL whose protection status I cannot verify. If protection is off and the credentials are live, that reproduces the R6 exposure on a fresh URL.

**Required before a Preview push** (all are human/dashboard actions, not code):

1. Confirm Vercel Authentication (deployment protection) is enabled for Preview deployments on this project.
2. Confirm no production domain is aliased to Preview builds.
3. Resolve R6-B: confirm the demo accounts are disabled or their secrets rotated in every environment the Preview would authenticate against.

Once those three are confirmed, the push is a single command and the engineering gates are already green.

**`screening.privexa.co` is unchanged.** Nothing was deployed, promoted or aliased.

## 11. Remaining blockers

**Engineering**

| Item | Severity |
|---|---|
| C6 missing-information labels, incl. MISS-01 four-status reviewer channel | MEDIUM |
| E-group end-to-end workflow suites (Review Queue → completed → export) via HTTP | MEDIUM |
| STACK-01-B `RuleDecision` immutability (separate owner) | MEDIUM |
| Source-artefact storage decision (VERIFY-01 §6) | MEDIUM — blocks publication |
| Vercel SQLite persistence — `lib/config/database.ts` falls back to `file:/tmp/…` on Vercel, which is ephemeral per instance unless `TURSO_DATABASE_URL` is set in production. **Unverified.** If production really runs on `/tmp`, clinical data would not persist reliably across instances, which would be disqualifying for canonical activation. | **HIGH if confirmed** |

**Clinical / governance (unchanged by this phase, all open)**

GOV-04 operating point — now with two quantified inputs: 152/179 clinician-only **and** only 20/203 rules auto-schedulable · regrade policy for the 26 defects · written acceptance of the conditional within-pathway model · GOV-01/02/03 · LEGACY-005/-014/-017/-026 · the 2 input-gap adjudications · second-approver policy · source-package redistribution rights.

**Security**

R1–R5 unsigned · R6-B and R6-C (rotation) unresolved · R6-E preview protection unverified · authenticated production-readiness QA · backup/restore rehearsal · monitors.
