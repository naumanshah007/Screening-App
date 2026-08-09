# Final report — active Production vs Rule Studio candidate

Date: 4 August 2026.

# Conclusion

# `CANDIDATE_REQUIRES_ENGINEERING_CORRECTION`

The candidate is **clinically superior to the deployed build** on the source
oracle — it corrects 22 of 26 confirmed deployed defects and closes 16 of 18
input-contract gaps, with zero clinical regressions on the 179-case corpus. It is
**not** ready to land, for one reason that is fully understood and mechanically
resolvable: the branch forked before the R1 age-gate safety fix and, as it stands
today, would reintroduce a patient-safety defect that production has already
fixed.

**No production activation is recommended.** Legacy remains authoritative;
CG-NCSP-3.0.0 and CG-NCSP-3.1.0 remain DRAFT, unpublished and inactive.

---

## 1. Corrected deployment identity

| Item | Value | Confidence |
|---|---|---|
| Vercel project | `cervical-screening-app` (Hobby) | VERIFIED |
| Production Branch | **`main`** | VERIFIED |
| Active Production commit | **`fb933c3`** | VERIFIED |
| Trigger | Manual redeploy (`Redeploy of 5YZSUhZ8`) | VERIFIED |
| Production auto-deploy on `main` | Enabled | VERIFIED |
| Preview deployments | Enabled, all unassigned branches | VERIFIED |
| Preview protection | Vercel Authentication, Standard Protection | VERIFIED (configuration) |
| Custom production domains | Public | VERIFIED |
| `418e3b8` | **Preview only — never Production** | VERIFIED |
| Push safety | `VERIFIED_PREVIEW_ONLY_AND_PROTECTED` | VERIFIED |

The 3 August `STRONGLY_INFERRED` identity was **wrong**. Correction trail and
root-cause analysis: `01-deployment-identity.md` §CORRECTION;
`03-remote-ref-recovery.md`. Root cause: local `origin/main` was 28 days stale, so
the true production commit was absent from the candidate set the inference
searched.

## 2. Production reproduction

`PRODUCTION_REPRODUCTION_SUCCEEDED`. Isolated worktree at `fb933c3`, isolated
SQLite database, 5 migrations, no production data or environment values.
Typecheck clean, lint 0 errors, **333/333 tests pass**, production build succeeds.
Details: `04-production-reproduction.md`.

## 3. Semantic comparison totals (179 independent source cases)

| Metric | Value |
|---|---:|
| Corpus size | **179** |
| Production-executable | **161** |
| Production input-contract gaps | **18** |
| Production matches source | **126 / 179** |
| Current legacy matches source | **126 / 179** |
| **Canonical matches source** | **171 / 179** |
| Production vs current legacy differences | **0 / 161** |
| `THREE_WAY_EXACT_AGREEMENT` | **124** |
| `CANDIDATE_FIXES_CONFIRMED_LEGACY_DEFECT` | **31** |
| `CANDIDATE_ADDS_PREVIOUSLY_UNSUPPORTED_STATE` | **16** |
| `REQUIRES_CLINICAL_REVIEW` | **4** |
| `DEPLOYED_INPUT_CONTRACT_GAP` (unresolved) | **2** |
| `GOV04_CLINICIAN_ONLY_OVERRESTRICTION` | **2** |
| `CANDIDATE_REGRESSION` (corpus scope) | **0** |
| `UNEXPLAINED` | **0** |

Zero unexplained differences. Every one of the 179 cases is accounted for.

**System B is a proven stand-in for deployed legacy behaviour** — identical on all
161 executable cases. The earlier scope document assumed this; it is now
demonstrated.

## 4. The 26 legacy defects

All 26 matched. **All 26 are present in the deployed production build** — they are
real, live defects, not local artefacts. Canonical corrects **22**; four
(`LEGACY-005`, `-014`, `-017`, `-026`) remain unresolved and require clinical
review. All 26 change user-visible recommendations, and all 26 are flagged
regrade-impacting. **No historical regrade was performed.**

## 5. The 18 input-contract gaps

**16 resolved**, 2 unresolved (stage-1A1 and non-cervical-cancer hysterectomy
overlays). No mapping was invented for any state the deployed contract cannot
express.

## 6. Table 1

21/21 executable, production 19/21, canonical **21/21**. Two corrections.

## 7. GOV-04

Source oracle requires clinician-only on **53/179**; canonical sets it on
**152/179**. **99 over-restrictions, 0 under-restrictions.** Fail-safe in
direction, but it erodes most of the automation value. This is a clinical-
governance decision for the risk owner, not an engineering defect.

## 8. Feature and workflow differences

| Metric | Value |
|---|---:|
| Production-only routes | **0** |
| Candidate-only routes | **19** |
| `PRODUCTION_ONLY` features | **13** |
| Candidate-only / governance / provenance / safety additions | **10** |
| `CANDIDATE_REGRESSION` | **1** |

**Production-only functionality** (all from the 11 unmerged `main` commits):
onboarding, NCSR certification management, integration validation, security
incident automation, admin list-and-detail, admin tabs, NCSR governance
placement, clickable figure links, batch stat-card drill-down, batch pathway
diagram, guideline diagram layout fix, guideline-figure overlay engine + rule
catalog, booking-rule form editor.

**Candidate-only functionality**: Rule Studio workspace, 17 clinical-rule
lifecycle API routes, governance review, immutable evaluated snapshots (three DB
triggers), version + checksum provenance, SHADOW/SIMULATION shadow comparison,
governed regrade provenance, canonical facts V2 capture, graph administration.

## 9. Candidate regressions

**One, and it is safety-critical.**

The R1 age-gate fix (`ea4e7e3`, 2 July) is absent from the candidate. **9 of 12
router-level probes differ; every difference is less safe:**

- 23 y with HSIL + HPV Other → production refers to colposcopy (HIGH); candidate
  returns `AGE-UNDER-25`, LOW risk, **no referral**
- 23 y glandular AG3 → production `F7-GLANDULAR-COLPOSCOPY`; candidate
  `AGE-UNDER-25`, **no referral**
- 72 y HPV 16/18 and HPV Other → production `AGE-70-74-HPV-DETECTED-COLP` (HIGH);
  candidate `AGE-70-74-DEFERRED`, LOW, **no referral**
- 76 y AG1 and 76 y HPV 16/18 → production refers to colposcopy; candidate
  `AGE-75-DISCHARGE`, **no referral**

**Correct characterisation:** fork-point staleness, not a code change. The
candidate modified **no** file under `lib/engine/`. Integration onto current
`main` resolves it automatically. But the branch as it stands would regress
patient safety if built and served, so it is recorded as a regression, not a
footnote.

The 179-case corpus reports zero regressions because it calls the figure
evaluators directly and never reaches the router. **The corpus alone would have
missed this.** That is the most important methodological finding of this exercise.

## 10. Unexplained differences

**Zero.** Four cases are `REQUIRES_CLINICAL_REVIEW` — a stated disposition, not an
unexplained one:

| Case | Question for the reviewer |
|---|---|
| `F3-CYTOLOGY-PENDING-INCOMPLETE` | Canonical emits `SAFETY_STOP`; source expects the distinct `INCOMPLETE_RESULT` disposition |
| `F5-TREATMENT-DEFERRED-HPV-DETECTED-NORMAL-12M` | Production emits an unmapped `F5-CONFIRMED-ASCH-…` code; canonical offers colposcopy/repeat |
| `F7-NO-LESION-AG2-CONFIRMED-INVESTIGATE` | Both emit `GYNAECOLOGY`; source expects `GYNAECOLOGY_INVESTIGATION` |
| `F9-NORMAL-TZ-MDM-CONFIRMS-HIGH-GRADE-REVIEW` | Production `MDM_REVIEW`, canonical `COLPOSCOPY`, source `PREGNANCY_COLPOSCOPY_REVIEW` |

## 11. Integration risk

| Item | Finding |
|---|---|
| Divergence | 11 main-only / 27 candidate-only, no patch-equivalent commits |
| Overlapping files | **2** |
| **Dry-run merge conflicts** | **1** — `app/(app)/admin/page.tsx` |
| Migration ordering | **No risk** — main added none, candidate's 2 append cleanly |
| Lockfile | 3 added packages, 6 bumps incl. `nodemailer` 7→8; regenerate, do not hand-merge |
| User-owned files | 48 modified + 45 untracked in the primary tree — integrate in a clean worktree only |
| **Recommended strategy** | **B — branch from `origin/main`, merge the candidate** |

Full plan, commit sequence and test gates: `09-main-divergence-and-integration-plan.md`.

## 12. Security implications

- **R6 — public demo credential exposure** remains `OPEN_SECURITY_REMEDIATION_REQUIRED`
  on `screening.privexa.co`. Standard Protection exempts custom production
  domains, so no branch push changes it. Present in both builds; not a candidate
  regression. Unsigned.
- **R1–R5 dependency risks** remain unsigned. The candidate's 6 dependency bumps
  address some; re-audit after integration.
- **Deployment-configuration risk moved, it did not vanish.** Auto-deploy on
  `main` is enabled: the merge to `main` is the production event, not the push.
- **No credential, cookie, token or environment value** was entered, read,
  printed or committed at any point.

## 13. Clinical-governance implications

- Legacy remains authoritative. Canonical remains SHADOW/SIMULATION.
- CG-NCSP-3.0.0 and CG-NCSP-3.1.0 remain **DRAFT, unpublished, inactive**:
  **0 publications, 0 activations, 0 live activations.** All 19 stored
  `RuleEvaluation` rows are `evaluationMode = SIMULATION`.
- The 26 defects are all regrade-impacting. A regrade policy decision is owed
  before any authority cutover. **No regrade was performed.**
- GOV-04's 99 over-restrictions need a clinical decision on the operating point.
- Four cases need clinical adjudication before the canonical engine could be
  considered complete against the source.
- **A repository alias-registry defect was found and not fixed**: the existing
  `equivalent()` in `conformance-runner.ts` collapses
  `FIGURE_5_COTEST_SURVEILLANCE` into `TEST_OF_CURE`, a conflation this
  comparison's brief forbids. It was not used here. It can mask a genuine
  Figure 5 / Figure 6 confusion in the conformance suite and should be reviewed.

## 14. Exact next engineering action

**Create `integration/rule-studio-on-main-fb933c3` from `origin/main` in a clean
worktree and merge `codex/versioned-clinical-rule-studio` into it.** Resolve the
single `app/(app)/admin/page.tsx` conflict by keeping main's tab structure and
re-adding the Rule Studio entry. Regenerate the lockfile. Then run the test plan
in `09-…§Required test plan`, with **`scripts/comparison/emit-router.ts`
reproducing production's 12/12 age-gate results as a hard gate**.

Do not merge that branch to `main` — that is a production deployment and is
governed by GOV-01…GOV-04 and R1–R6.

## Human decisions still owed

1. **R6** — accept, remediate, defer or escalate. Unsigned.
2. **R1–R5** — dependency risk acceptance. Unsigned.
3. **GOV-01…GOV-04** — including whether 152/179 clinician-only is the intended
   operating point.
4. **Regrade policy** for the 26 defects.
5. **Clinical adjudication** of `LEGACY-005`, `-014`, `-017`, `-026`.
6. **Authorisation to create the integration branch.**
7. Whether to add a `/api/version` endpoint — its absence is what made the
   original identity ambiguity possible.
