# Deployed test-execution safety decision

Date: 3 August 2026. Target: `https://screening.privexa.co`.

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

That path is **available but not yet unlocked**, because the commit is
STRONGLY_INFERRED, not verified. Executing a full clinical differential against a
*guessed* baseline and presenting it as deployed behaviour would be exactly the
kind of unfounded claim this programme forbids.

To unlock it, one of these is needed:

1. Confirmation of the deployed commit SHA from the Vercel dashboard (Deployments
   → the active production deployment → source commit). This is a single lookup
   and is the cheapest unblock.
2. Or a `/api/version`-style endpoint exposing the build SHA.
3. Or confirmation that `origin/codex/versioned-clinical-rule-studio@418e3b8` is
   the production deployment source.

With any of those, the reproduction comparison becomes sound and Phases 4–7 can
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
