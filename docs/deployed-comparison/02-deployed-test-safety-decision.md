# Deployed test-execution safety decision

Date: 3 August 2026. Target: `https://screening.privexa.co`.
**Corrected 4 August 2026** — the deployed baseline identity changed; the
execution decision did not.

## ⚠ CORRECTION — 4 August 2026

The build identity this document relied on has been corrected. See
`01-deployment-identity.md` §CORRECTION.

| | Previously recorded | Verified 4 August 2026 |
|---|---|---|
| Deployed commit | `418e3b8` (STRONGLY_INFERRED) | **`fb933c3`** (VERIFIED) |
| Deployed branch | `codex/versioned-clinical-rule-studio` | **`main`** |
| Role of `418e3b8` | believed Production | **Preview deployment only** |
| Deployment trigger | assumed Git push | **manual redeploy** |

**Effect on this decision: none.** `DEPLOYED_EXECUTION_BLOCKED` stands, and the
reasoning strengthens rather than weakens:

- Every one of the twelve safety criteria below was assessed against the *live
  deployed surface*, not against a commit. Correcting which commit produced that
  surface does not change what the surface exposes.
- The R6 public demo-credential exposure is unchanged and remains
  `OPEN_SECURITY_REMEDIATION_REQUIRED`.
- The refusal to enter credentials is unchanged.

**Effect on the fallback path: it is now unblocked.** The "what would unlock the
reproduction comparison" section below asked for exactly one thing — dashboard
confirmation of the deployed commit. That has now been supplied. The baseline is
`fb933c3`, which is the tip of `origin/main` and is reproducible locally in an
isolated worktree with an isolated database and **no production writes at all**.

## Decision

# `DEPLOYED_EXECUTION_BLOCKED`

No case was submitted to the deployed application. No record was created. No
sign-in was attempted.

A weaker classification (`DEPLOYED_EXECUTION_REQUIRES_HUMAN_APPROVAL`) was
considered and rejected: human approval alone would not make execution safe,
because the preconditions that make writes recoverable — a dedicated test tenant
and a documented cleanup path — are **absent**, not merely unapproved.

## Decision criteria

| Question | Answer | Evidence |
|---|---|---|
| Is it clearly a demo environment? | **No — ambiguous.** A "Live in demo" badge appears on the marketing landing page and the login page publishes demo accounts, but the hostname is production, and none of the required "Demo environment" safety wording appears on public surfaces. | Public HTML |
| Is there a dedicated demo tenant? | **No evidence of one.** | No tenant selector or documented test tenant found |
| Are all records synthetic? | **Cannot be established.** | Requires authenticated inspection |
| Does case creation persist data? | **Unknown — must be assumed yes.** | Not observable unauthenticated |
| Can test records be removed safely? | **No documented cleanup path.** | None found in repository or deployment |
| Would a test case trigger side effects? | **Cannot be excluded.** The candidate codebase contains an SMTP notification path (`lib/notifications.ts`) and simulated export/PAS representations. Whether the deployment has SMTP configured is **not observable**. | `lib/notifications.ts`; deployment config not visible |
| Is a no-notification test mode available? | **None found.** | — |
| Is there a read-only preview endpoint? | **None found.** All `/api/*` return 401. | Route probes |
| Is there a simulation endpoint? | **None found unauthenticated.** | Route probes |
| Is there a batch dry-run endpoint? | **None found.** | Route probes |
| Is there a non-persisting wizard preview? | **Not determinable.** | Requires authentication |
| Is there a staging deployment for this build? | **None identified.** | Only the production hostname was provided |

Twelve criteria: none resolves to a clear "safe". Six are outright negative and
six are unknown. Under the programme's own rule — *do not create persistent
records until the environment is positively confirmed as a demo environment or a
dedicated test tenant* — this is a block.

## Second, independent blocker

Even with write authority, execution requires authentication, and I do not enter
passwords into login forms — including the demo credentials the deployment
publishes on its own public login page. Authenticated execution therefore
requires a human operator regardless of the write-safety decision.

## Third, structural blocker

The comparison as designed is **not achievable even with full access**, because
the deployed build has no canonical engine to compare against.

> **Corrected 4 August 2026:** the reasoning below is sound but was written about
> `418e3b8`. The verified deployed commit is **`fb933c3`**, which is *also* free
> of the Rule Studio programme — it is an ancestor-era `main` commit predating
> `30e8dfb` entirely. The structural blocker therefore still holds, and holds
> more strongly: `fb933c3` contains neither the canonical engine **nor** the
> `418e3b8` batch dataset rebase.

The inferred deployed commit `418e3b8` is the exact parent of the first Rule
Studio commit and contains zero `clinical-rules` files. There is no `CG-NCSP`
version, no checksum, no SHADOW/SIMULATION mode, no Clinical Review workspace and
no graph views in that build.

So a three-way A/B/C differential collapses to a two-way comparison:
*deployed legacy behaviour* versus *canonical candidate*. And System B — the
local legacy evaluator at HEAD — already serves as a faithful, executable stand-in
for the deployed legacy engine, **provided** the deployed build is confirmed as
`418e3b8`.

## What the fallback path would require

The brief's fallback is: identify the exact deployed commit, reproduce it
locally, and compare against that reproduction, labelled
`REPRODUCED_DEPLOYED_BUILD`.

> **UNLOCKED 4 August 2026.** Option 1 below was exercised: the Vercel dashboard
> confirmed the active production deployment's source commit. The baseline is
> **`main` at `fb933c3`**, not `418e3b8`. The reproduction comparison is now
> sound and proceeds against `REPRODUCED_DEPLOYED_BUILD = fb933c3`.

~~That path is **available but not yet unlocked**, because the commit is
STRONGLY_INFERRED, not verified.~~ Executing a full clinical differential against
a *guessed* baseline and presenting it as deployed behaviour would have been
exactly the kind of unfounded claim this programme forbids — which is why the
comparison was held until the dashboard lookup resolved it.

To unlock it, one of these was needed:

1. **✅ DONE — Confirmation of the deployed commit SHA from the Vercel dashboard**
   (Deployments → the active production deployment → source commit). This was the
   cheapest unblock and it is what resolved the question.
2. Or a `/api/version`-style endpoint exposing the build SHA. *(Still absent; a
   standing recommendation — its absence is what made this ambiguity possible.)*
3. ~~Or confirmation that `origin/codex/versioned-clinical-rule-studio@418e3b8` is
   the production deployment source.~~ **Disproven** — that commit was a Preview.

With option 1 supplied, the reproduction comparison becomes sound and Phases 4–7
run entirely locally against isolated databases, with **no production writes at
all**.

## What was NOT done, explicitly

- No sign-in, no session, no authenticated request.
- No case, patient, batch or wizard submission.
- No record created, modified or deleted in the deployed environment.
- No email, webhook, PAS, FHIR/HL7 or external notification triggered.
- No destructive action of any kind tested.
- No real or synthetic patient data transmitted to the deployment.
- No authenticated UI comparison — Phase 9 is
  **`PENDING_HUMAN_AUTHENTICATION`**, and no screenshot, pass result or UI
  finding is claimed for it.

## Human unblock checklist

Ordered by cost. Item 1 alone unlocks the majority of the programme.

1. **Confirm the deployed commit SHA** in the Vercel dashboard and record whether
   it is `418e3b8`.
2. **Confirm the Vercel production-branch configuration.** See the release-safety
   warning in `01-deployment-identity.md`: if production tracks
   `codex/versioned-clinical-rule-studio`, pushing that branch may auto-deploy
   the unreviewed Rule Studio work. Confirm before any push.
3. **State whether `screening.privexa.co` may receive test writes**, and if so
   whether a dedicated test tenant exists and how records are cleaned up.
4. **Decide on the published demo credentials** (`01-deployment-identity.md`,
   security finding) — this is a live exposure on an internet-facing host,
   independent of this comparison.
5. If authenticated UI comparison is wanted, **a human tester signs in and
   captures the paired screenshots** listed in the Phase 9 scope.

Until items 1–3 are answered, the programme remains
`COMPARISON_INCOMPLETE_DUE_TO_DEPLOYMENT_ACCESS`.

## Boundary confirmation

Legacy remains authoritative. Canonical remains SHADOW/SIMULATION. `CG-NCSP-3.0.0`
and `CG-NCSP-3.1.0` remain DRAFT, unpublished and inactive with zero live
activations. No publication, activation, authority cutover, push or pull request
occurred.

Provisional recommendation. Reviewer confirmation required. Not for direct
clinical action. Demo environment. Simulated export package.
