# Deployed-versus-candidate comparison — scope, safety and system definitions

Date: 3 August 2026. Repository HEAD at start: `e1e8f46172b2ea9f1c3b1e003d1da3922900b393`
on `codex/versioned-clinical-rule-studio`.

This is a deployed-versus-candidate comparison and regression assessment. It is
**not** a clinical validation, publication, activation or production-cutover task.
Nothing in this programme published or activated a ruleset, changed production
authority, or transmitted patient data.

## Headline outcome

**The three-way comparison could not be executed as designed.** Two independent
blockers were established by evidence, not assumption:

1. The deployed application's engine identity **cannot be verified** from any
   unauthenticated surface (§System A).
2. The deployed build **predates the entire Rule Studio programme** and contains
   no canonical engine at all, so "deployed versus `CG-NCSP-3.1.0`" is **not a
   like-for-like ruleset comparison** — the deployed system has no versioned
   ruleset concept to compare against.

Consequently the programme conclusion is
**`COMPARISON_INCOMPLETE_DUE_TO_DEPLOYMENT_ACCESS`**. See
`02-deployed-test-safety-decision.md` for the execution decision and
`01-deployment-identity.md` for the identity evidence.

## Method deviation, declared

The brief instructed creating a temporary clean worktree before comparison work.
That instruction exists to isolate test execution from the 48 user-owned dirty
files in the main tree. Because deployed execution is blocked, **no comparison
test execution occurred**, and the only artifacts produced are new files under
`docs/deployed-comparison/`, which touch no existing file. A 1.4 GB worktree was
therefore not created. The ownership boundary is preserved by explicit-path
staging instead; no broad stage, reset, clean or checkout was used. If direct
execution is later authorised, the worktree step should be performed then.

## The three systems

### SYSTEM A — DEPLOYED

| Field | Value | Confidence |
|---|---|---|
| System identifier | SYSTEM A — DEPLOYED | VERIFIED |
| Environment | Internet-facing production hostname | VERIFIED |
| URL | `https://screening.privexa.co` | VERIFIED |
| Hosting | Vercel (`server: Vercel`, `x-vercel-id: syd1::bom1::…`) | VERIFIED |
| Framework | Next.js (`x-powered-by: Next.js`, App Router RSC payloads) | VERIFIED |
| Build ID | `HZKNUX6TfkW88sakoDj6n` | VERIFIED |
| Application version | Not exposed | UNKNOWN |
| Git commit | **`418e3b8`** `feat(batch): rebase demo dataset across NZ regions` | **STRONGLY_INFERRED** |
| Build/deploy date | Static chunk `last-modified: 2026-08-02T09:14:01Z` | VERIFIED (asset), STRONGLY_INFERRED (deploy) |
| Engine version | Not exposed; no engine markers in public bundles | UNKNOWN |
| Ruleset version | **None** — no `CG-NCSP` versioned ruleset in the inferred build | STRONGLY_INFERRED |
| Checksum | Not applicable — no versioned snapshot in the inferred build | STRONGLY_INFERRED |
| Schema version / migration count | Not observable without authentication | UNKNOWN |
| Authority status | Legacy engine only (no canonical engine exists in the inferred build) | STRONGLY_INFERRED |
| Evaluation mode | Legacy direct evaluation; no SHADOW/SIMULATION concept present | STRONGLY_INFERRED |
| Database type | Not observable | UNKNOWN |
| Authentication | Auth.js / NextAuth v5 (`__Host-authjs.csrf-token`, `__Secure-authjs.callback-url`) | VERIFIED |
| Feature flags | Not observable | UNKNOWN |
| Tenant / demo status | Landing page shows a "Live in demo" badge; login page publishes demo accounts. **Not a documented dedicated test tenant.** | WEAKLY_INFERRED |
| Writes permitted? | **Not established.** No documented cleanup path, no dedicated test tenant, no dry-run/simulation endpoint found | UNKNOWN → treated as NOT PERMITTED |
| Evidence source | Read-only HTTP: headers, HTML, RSC payload, 13 public JS chunks, build manifest, route probes, static asset metadata |  |

### SYSTEM B — LOCAL LEGACY

| Field | Value | Confidence |
|---|---|---|
| System identifier | SYSTEM B — LOCAL LEGACY | VERIFIED |
| Environment | Local repository, isolated SQLite | VERIFIED |
| Execution path | `lib/engine/` legacy evaluator at repository HEAD | VERIFIED |
| Git commit | `e1e8f46` | VERIFIED |
| Ruleset version | Legacy engine — not a versioned clinical snapshot | VERIFIED |
| Authority status | **Authoritative** — produces the displayed clinical decision | VERIFIED |
| Evaluation mode | Direct | VERIFIED |
| Migration count | 7 tracked migrations | VERIFIED |
| Writes permitted? | Yes, against isolated databases only | VERIFIED |

### SYSTEM C — CANONICAL CANDIDATE

| Field | Value | Confidence |
|---|---|---|
| System identifier | SYSTEM C — CANONICAL CANDIDATE | VERIFIED |
| Environment | Local repository, isolated SQLite | VERIFIED |
| Ruleset version | `CG-NCSP-3.1.0` | VERIFIED |
| Checksum | `3ab8657a13e73bb0080f18399d9165c20e9af5796bdcf594bdc71170309c824a` | VERIFIED |
| Parent version | `CG-NCSP-3.0.0` | VERIFIED |
| Status | DRAFT, unpublished, inactive | VERIFIED |
| Authority status | **Not authoritative** | VERIFIED |
| Evaluation mode | SHADOW / SIMULATION only | VERIFIED |
| Live activations | 0 | VERIFIED |
| Structure | 203 rules, 203 typed conditions, 422 nodes, 421 edges, 12 views, 21 Table 1 rules, 11 source-designated clinician-only rules | VERIFIED |

## Why System A cannot be compared as a ruleset

The inferred deployed commit `418e3b8` is the **exact parent** of `30e8dfb`, the
first Rule Studio commit. Verified by `git log -1 --format='%p' 30e8dfb`.

`git ls-tree -r --name-only 418e3b8` returns **0** files matching
`clinical-rules`; the same query at HEAD returns **48**. The deployed build
therefore contains:

- no canonical engine;
- no `ClinicalRuleSet` / `ClinicalRuleVersion` / `RuleSetActivation` /
  `RuleEvaluation` model layer;
- no `CG-NCSP` version identity or checksum;
- no Clinical Review workspace;
- no graph views;
- no SHADOW/SIMULATION evaluation mode.

A three-way semantic differential across A/B/C presumes all three evaluate the
same clinical inputs. System A has **no canonical engine to evaluate them with**.
The only meaningful A-versus-C comparison is *legacy-deployed versus canonical
candidate*, which requires executing cases against System A — and that is
blocked (`02-deployed-test-safety-decision.md`).

## Safety boundaries observed

- No ruleset published or activated; no `RuleSetActivation` created.
- Production authority unchanged; legacy remains authoritative.
- Canonical remains SHADOW/SIMULATION only.
- `CG-NCSP-3.0.0` and `CG-NCSP-3.1.0` unmodified; no evaluated snapshot
  overwritten.
- No completed decision regraded; no open case regraded.
- **No real patient information was used or transmitted.** No case data of any
  kind was submitted to the deployed application.
- No destructive action tested: no delete, archive, publish, activate, rollback,
  retire, clinical completion, live regrade, external notification, PAS
  submission or external export transmission.
- GOV-04 behaviour was not altered.
- Reconnaissance was read-only, rate-limited (~1 request/second), and confined to
  publicly served surfaces. No authentication bypass, no aggressive path
  enumeration, no brute force, no vulnerability exploitation.

## Required wording

Provisional recommendation. Reviewer confirmation required. Not for direct
clinical action. Demo environment. Simulated export package.

`CG-NCSP-3.1.0` is a source-derived draft requiring governed clinical review. It
is **not** clinically validated, medically approved, production ready, pilot
ready, or safe for autonomous use.
