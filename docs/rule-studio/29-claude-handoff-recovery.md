# Claude handoff recovery — forensic reconciliation of the interrupted session

Recovery date: 3 August 2026.

This report records the **observed** repository state after the previous session
(Codex) reached its usage limit mid-correction. It is software-conformance and
recovery evidence for an unpublished, source-derived draft. It is not clinical
validation, not medical approval, and not evidence for direct clinical action.

Method: the repository was inspected read-only before any file was modified.
Where a prior report and the repository disagree, **the repository wins** and the
discrepancy is recorded here rather than silently reconciled.

## 1. Reported versus observed

| Item | Reported to this session | Observed in repository | Verdict |
|---|---|---|---|
| Branch | `codex/versioned-clinical-rule-studio` | `codex/versioned-clinical-rule-studio` | MATCH |
| HEAD | uncertain; "do not assume `d1e2dce`" | `d1e2dceb2886cd9d01aa59871bc42ee2c799ea6c` | MATCH — `d1e2dce` **is** the branch HEAD, not detached |
| Commits after `ed49bf1` | several scoped commits | 10 commits, all present with real file contents | MATCH |
| Canonical V2 batch-import commit | reported | `894e7ae` present (`lib/batch/canonical-v2-import.ts` + 3 tests) | PRESENT |
| Evidence-report-generator commit | reported | `d1e2dce` present (343-line generator) | PRESENT |
| Final documentation commit | uncertain | **ABSENT** — the correction was uncommitted in the working tree | RECOVERED (see §3) |
| Staged files | 0 | 0 | MATCH |
| Modified tracked files | 48 at baseline | 49 | +1 = report 28 only (Codex, recovered); other 48 user-owned |
| Untracked top-level entries | 44 at baseline | 9 top-level dirs / 206 paths | Same set; `git status` collapses directories |
| Successor version | `CG-NCSP-3.1.0` | `CG-NCSP-3.1.0` | MATCH |
| Successor checksum | `3ab8657a…c824a` | `3ab8657a13e73bb0080f18399d9165c20e9af5796bdcf594bdc71170309c824a` | MATCH |
| Successor status | DRAFT, unpublished, inactive, parent-linked | DRAFT, revision 1, parent → `CG-NCSP-3.0.0` | MATCH |
| Successor evaluations | 18 SIMULATION | 18, all `evaluationMode = SIMULATION` | MATCH |
| Protected base `CG-NCSP-3.0.0` | DRAFT rev 3, checksum `f6d75166…`, 1 evaluation, 3 audit events | identical | MATCH |
| Activation records | 0 | 0 | MATCH |
| Live activations | 0 | 0 | MATCH |
| Published versions | 0 | 0 | MATCH |
| Source rules / unique IDs | 203 / 203 | 203 / 203 | MATCH |
| Canonical nodes / edges / views | 422 / 421 / 12 | 422 / 421 / 12 | MATCH |
| Clinician-only rules | 11 | 11 (7 rule-level + 4 branch-level) | MATCH |
| Tracked migrations | 7 | 7 tracked (8th is user-owned untracked) | MATCH |
| Semantic differential | 164 EXACT, 15 ALIAS, **0 metadata differences** | 68 EXACT, 12 ALIAS, **99 metadata differences** | **MISMATCH — see §4** |
| Test counts (1,219 / 1,222 / 1,239) | ambiguous | all three reconciled | RESOLVED — see §2 |

## 2. Test-count reconciliation

All three circulating totals are correct for different trees. Measured, not inferred:

| Total | Composition | Tree |
|---:|---|---|
| 1,219 | 104 engine + 205 batch + 910 rules | clean checkout **before** `894e7ae` |
| **1,222** | 104 engine + **208** batch + 910 rules | **clean checkout at `d1e2dce` — the authoritative final count** |
| 1,239 | 107 engine + 222 batch + 910 rules | current dirty working tree |

The dirty tree carries **+15 user-owned tests** that do not exist in a clean
checkout:

- `lib/engine/__tests__/access-control.test.ts` — 3 tests (untracked)
- `lib/batch/__tests__/rule-facts.test.ts` — 6 tests (untracked)
- `lib/batch/__tests__/rule-diff.test.ts` — 4 tests (untracked)
- `lib/batch/__tests__/reprocessing.test.ts` — 2 tests (untracked)
- 2 further batch tests from user-owned modifications to the tracked
  `dashboard-metrics.test.ts` / `decision-package.test.ts`

`894e7ae` added exactly the 3 canonical V2 row-import and formula-neutralisation
tests that move batch 205 → 208.

## 3. The interrupted correction (recovered)

The previous session was editing
`docs/rule-studio/28-release-hardening-clean-checkout.md` when it stopped. The
edit was present in the working tree, unstaged and uncommitted. It was verified
against measured evidence and found **correct**, then committed as `8b56781`:

- verified application HEAD `5c07f54` → `d1e2dce`
- batch suite `205` → `208`
- clean-checkout total `1,219` → `1,222`

No other Codex change was left uncommitted. Every reported feature was confirmed
to exist as real code, not merely as a claim in a Markdown report (§5).

## 4. Material discrepancy: report 22 was stale

**Finding.** `docs/rule-studio/22-canonical-v2-differential-verification.md` as
committed claimed `EXACT_AGREEMENT=164, ACTION_EQUIVALENT_PRESENTATION_ALIAS=15`
and **zero** metadata differences. Re-running its generator against the actual
code produces `EXACT_AGREEMENT=68, ACTION_EQUIVALENT_PRESENTATION_ALIAS=12,
METADATA_DIFFERENCE=99`.

**This is not a working-tree artifact.** It was reproduced identically in a clean
`git worktree` at `d1e2dce` with a fresh `npm ci`. The committed report was
generated from a build state that no longer exists and was never regenerated.

**Characterisation of the 99 differences** (from the regenerated machine-readable
results):

| Property | Value |
|---|---:|
| Cases with a metadata difference | 99 / 179 |
| Distinct mismatching field | `clinicianOnly` **only** |
| Direction: expected `false` → actual `true` (more restrictive, fail-safe) | **99** |
| Direction: expected `true` → actual `false` (safety relaxation) | **0** |
| Action-class mismatches across all 179 cases | **0** |
| `IMPLEMENTATION_DEFECT` | **0** |
| `GOVERNANCE_STOP` | **0** |
| Input-representation gaps still closed | 18 / 18 |

**Root cause.** `lib/clinical-rules/evaluator.ts` resolves `clinicianOnly` as:

```
outcomeBranch?.clinicianOnly
  ?? controllingRule.clinicianOnly
  ?? (conditionExpression.type === "SOURCE_TEXT"
      || /clinician|mdm|specialist/i.test(`${automationBoundary} ${reviewerRequirement}`))
```

187 of 203 compiled rules leave `clinicianOnly` undefined, so the regex fallback
decides. Because `reviewerRequirement` is `"CLINICIAN_REVIEW"` for most rules,
the pattern `/clinician/i` matches and the rule is treated as clinician-only.
Worked example — `F3-01` (routine 5-yearly recall, HPV not detected):
`clinicianOnly: undefined`, `automationBoundary: "Deterministic provisional"`,
`reviewerRequirement: "CLINICIAN_REVIEW"` → evaluates to `true`.

The fallback therefore conflates two distinct concepts:

- **reviewer confirmation required** — the universal safety posture that applies
  to every provisional recommendation in this product; and
- **clinician-only rule** — the 11 rules (7 rule-level + 4 branch-level, count
  independently confirmed against the snapshot) that must never autonomously
  record treatment, biopsy, excision, MDM agreement, specialist approval or
  clinical completion.

**Disposition — deliberately not "fixed" in this session.** Narrowing the
fallback would flip ~99 cases from `clinicianOnly = true` to `false`, which
**relaxes a safety boundary**. That is a clinical-governance decision about which
rules genuinely bound autonomous finalisation, not an engineering cleanup, and it
must not be made autonomously by an AI agent. It is escalated as governance item
**GOV-04** in `31-clinical-governance-handoff.md`.

The current behaviour is fail-safe: it over-restricts, never under-restricts, and
routing is unaffected (0/179 action-class differences).

**Report 22 is regenerated** so that the committed evidence matches the code. It
is left as pure generator output and is **not** hand-edited — hand-editing it
would recreate exactly the report-versus-code drift documented here. Its existing
gate text already states that any metadata difference remains a publication
blocker, which is now accurate.

## 5. Implementation verified as real code

Every reported feature was confirmed present as source, not inferred from a
report. All files exist at `d1e2dce`; representative anchors:

| Feature | File |
|---|---|
| CanonicalClinicalFactsV2 types + Zod validation | `lib/clinical-rules/canonical-facts-v2.ts` (338 lines) |
| Canonical V2 JSON Schema | `public/templates/canonical-clinical-facts-v2.schema.json` |
| V2-native 179-case corpus | `lib/clinical-rules/__tests__/support/canonical-v2-corpus.ts` |
| Successor `CG-NCSP-3.1.0` builder | `lib/clinical-rules/successor-v3-1.ts` (539 lines) |
| Successor importer | `scripts/import-ncsp-rulebook-v2-1-successor.ts` |
| Canonical V2 batch row import + formula neutralisation | `lib/batch/canonical-v2-import.ts` + 3 tests |
| Clinical Review workspace | `components/clinical-rules/ClinicalGovernanceReviewWorkspace.tsx` |
| Two-person proposal/approval separation | `lib/clinical-rules/governance-review.ts` |
| Governance review API | `app/api/clinical-rules/versions/[id]/governance-review/route.ts` |
| Canonical shadow evidence panel | `components/batch/CanonicalShadowEvidence.tsx` |
| Graph studio, exports, fullscreen, minimap | `components/clinical-rules/ClinicalRuleGraphStudio.tsx` (1,128 lines) |
| React Flow global stylesheet fix | `app/layout.tsx` (`fb3a967`) |
| Evaluated-draft read-only UI | `app/(app)/rules/clinical/[id]/page.tsx` (`5c07f54`) |
| Database immutability triggers | `prisma/migrations/20260803143000_clinical_evidence_immutability/migration.sql` |
| Security recursion/collection limits | `lib/clinical-rules/__tests__/security-hardening.test.ts` |
| Input-gap simulation command | `scripts/rule-studio/persist-canonical-v2-input-gap-simulations.ts` |
| Evidence report generator | `scripts/rule-studio/generate-release-hardening-reports.ts` |

Reports **16, 18 and 24** (and their JSON companions) were regenerated from
`generate-release-hardening-reports.ts` and are **byte-identical** to the
committed versions — 36 difference rows, 18 canonical input-contract gaps, 3
dossier cases, 26 legacy defects. Only report 22 had drifted.

## 6. Commit inventory since `ed49bf1`

| Commit | Subject |
|---|---|
| `f912c40` | feat(rule-studio): add canonical clinical facts v2 |
| `b84fc29` | feat(rule-studio): harden governance and clinical evidence |
| `da2e327` | feat(rule-studio): integrate canonical facts into shadow workflows |
| `0accf71` | fix(rule-studio): make batch contract export standalone |
| `fb3a967` | fix(rule-studio): load graph controls stylesheet |
| `64fd278` | fix(rule-studio): harden graph exports and fullscreen |
| `5c07f54` | fix(rule-studio): lock evaluated snapshots in editor |
| `5b03f80` | docs(rule-studio): add release-hardening evidence |
| `894e7ae` | feat(rule-studio): add canonical v2 batch import |
| `d1e2dce` | chore(rule-studio): add evidence report generator |

Added by this recovery session: `8b56781` (report-28 correction),
`e2bf41d` (dependency remediation), plus the documentation commit carrying this
report.

## 7. Ownership boundary preserved

No `git reset --hard`, `git clean`, `git checkout -- .`, `git restore .`,
`git add -A`, `git add .` or broad directory stage was run at any point. Every
commit used explicit-path staging. The developer database was never mutated: all
version queries in §1 were executed against a byte copy in a scratch directory.

The 48 tracked files dirty at the recorded baseline remain dirty and unstaged.
They are user-owned or mixed and are itemised in
`32-mixed-file-landing-review.md`.

## Release boundary (unchanged)

- Legacy remains the displayed clinical authority.
- Canonical evaluation remains SHADOW / SIMULATION only.
- `CG-NCSP-3.0.0` and `CG-NCSP-3.1.0` remain DRAFT, unpublished and inactive.
- Zero activation records; zero live activations.
- Provisional recommendation. Reviewer confirmation required.
- Not for direct clinical action. Demo environment. Simulated export package.
- Independent clinical governance remains required and remains pending.
