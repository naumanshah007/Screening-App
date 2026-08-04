# Deployed build identity — evidence and inference

Target: `https://screening.privexa.co`. Reconnaissance date: 3 August 2026.
All observations read-only, rate-limited, publicly served surfaces only.

**Corrected 4 August 2026** against the Vercel dashboard. The 3 August inference
was wrong. Read the correction below before any other section of this document.

---

## ⚠ CORRECTION — 4 August 2026 (supersedes the 3 August conclusion)

### What was previously inferred

`418e3b8` was recorded as **STRONGLY_INFERRED** to be the active Production
commit, and the deployed hostname was recorded as appearing to track
`origin/codex/versioned-clinical-rule-studio`.

### What the dashboard verified

`418e3b8` was **never Production**. It was a **Preview** deployment built from
`codex/versioned-clinical-rule-studio`. Preview deployments do not serve
`screening.privexa.co`.

The active Production deployment is **`main` at `fb933c3`**.

### Verified deployment identity

| Item | Value | Confidence |
|---|---|---|
| Vercel project | `cervical-screening-app` (team `nauman-shahs-projects`, Hobby) | **VERIFIED** |
| Connected repository | `naumanshah007/Screening-App` (GitHub) | **VERIFIED** |
| **Production Branch** | **`main`** | **VERIFIED** |
| **Active Production commit** | **`fb933c3`** — `Admin UX phase 2+3: onboarding, NCSR, integration validation, automation` | **VERIFIED** |
| Active Production deployment | `az2UHKSaXg49Upho6U1BgakTJojs` — Production · Current · Ready | **VERIFIED** |
| **Production trigger** | **Manual redeploy** of an earlier `main` deployment (`Redeploy of 5YZSUhZ8`) — not a fresh Git push | **VERIFIED** |
| Production deployment date | 2026-08-02 (UI shows relative time only; build clock ≈09:07–09:09 UTC, duration 1m 34s) | VERIFIED (date), APPROXIMATE (time) |
| Production auto-deploy on `main` | **Enabled** — "Every commit pushed to the `main` branch will create a Production Deployment" | **VERIFIED** |
| Preview deployments | **Enabled** for all unassigned branches | **VERIFIED** |
| Preview protection | **Vercel Authentication — Standard Protection**: preview and generated deployment URLs require Vercel login | **VERIFIED** (configuration) |
| Custom Production domains | **Publicly accessible** — Standard Protection exempts them | **VERIFIED** (configuration + observed public reachability) |
| Password Protection | Not enabled (Pro-plan feature) | **VERIFIED** |
| Ignored Build Step | `Automatic` — no custom script, no branch filters | **VERIFIED** |
| Deploy hooks | **None configured** | **VERIFIED** |
| Deployment Checks | None configured | **VERIFIED** |
| Latest Rule Studio Preview | `C5nFUkkzS2r92dKAjXY2gyCpAYUg` — branch `codex/versioned-clinical-rule-studio`, commit **`418e3b8`**, Ready, 2026-08-02, custom-domain assignment *Skipped* | **VERIFIED** |
| Build ID `HZKNUX6TfkW88sakoDj6n` | Still VERIFIED as the served build ID; it belongs to the **Production** deployment of `fb933c3`, not to `418e3b8` | **VERIFIED** (observed), **CORRECTED** (attribution) |

### Why the inference failed

Four independent factors combined, and each one alone would have been survivable:

1. **Deployment timestamps overlapped.** The Production redeploy and the
   `418e3b8` Preview were both created on 2026-08-02, minutes apart. The asset
   `last-modified` of 2026-08-02T09:14:01Z was consistent with both.
2. **`418e3b8` was the only matching locally known remote commit.** It sat inside
   the derived build window and was the exact parent of the first Rule Studio
   commit, which made it look like a uniquely determined answer.
3. **Local `origin/main` was stale.** The last fetch was 2026-07-07 22:05, so the
   local clone's `origin/main` was `578b4b0` (June). The eleven `main` commits of
   7–8 July — including `fb933c3` itself — did not exist locally, so the true
   production commit was **not in the candidate set** the inference searched.
4. **A manual redeploy breaks the commit-time ordering assumption.** The
   reasoning assumed the newest asset corresponded to the newest commit. The
   production deployment was a *redeploy on 2 August of a commit authored on
   8 July*, so commit time and deploy time were 25 days apart.

The methodological lesson: an inference over a commit set that is not known to be
complete cannot be upgraded to STRONGLY_INFERRED. The staleness of `origin/main`
was the load-bearing error, and it was not checked.

### What this changes downstream

- The comparison baseline is **`fb933c3`**, not `418e3b8`.
- `fb933c3` is the **tip of `origin/main`**; `main` has not advanced beyond it.
- The candidate branch forks from `578b4b0` and is therefore missing the eleven
  `main` commits that include the deployed Admin UX work. See
  `03-remote-ref-recovery.md`.
- Push safety is **`VERIFIED_PREVIEW_ONLY_AND_PROTECTED`**, not unknown.
- **R6 remains OPEN** and is unaffected: Standard Protection exempts custom
  production domains, so the public demo-credential exposure on
  `screening.privexa.co` persists regardless of any branch push.

---

## Superseded conclusion (3 August 2026 inference — retained for audit trail)

> **This table is wrong and is retained only to preserve the correction trail.**
> `418e3b8` was a Preview deployment. See the correction above.

| Item | Value | Confidence |
|---|---|---|
| Deployed Git commit | ~~**`418e3b8`** — `feat(batch): rebase demo dataset across NZ regions`~~ **SUPERSEDED** | ~~STRONGLY_INFERRED~~ **DISPROVEN** |
| Deployed branch lineage | ~~`origin/codex/versioned-clinical-rule-studio` — **not** `origin/main`~~ **SUPERSEDED** | ~~VERIFIED (ref containment)~~ **DISPROVEN as deployment evidence** |
| Build ID | `HZKNUX6TfkW88sakoDj6n` | VERIFIED (attribution corrected above) |
| Build era | 2026-08-02T09:14:01Z | VERIFIED (asset) |
| Canonical Rule Studio present? | **No** | **VERIFIED** — `fb933c3` predates the Rule Studio programme entirely |
| Engine version | Not exposed | UNKNOWN |
| Deployed schema generation | Not observable unauthenticated | UNKNOWN (unauthenticated); now reproducible locally from `fb933c3` |
| Exact commit proven? | ~~**No.**~~ **Yes — from the Vercel dashboard, 4 August 2026** | **VERIFIED** |

The ref-containment reasoning below was *arithmetically* correct — `418e3b8` is
indeed contained only in `origin/codex/versioned-clinical-rule-studio` — but it
was applied to the wrong deployment. It described the Preview, not Production.

## Timeline evidence (all UTC) — SUPERSEDED reasoning

> **This timeline reconstructs the wrong deployment.** The window it derives is
> real, but the commit it selects (`418e3b8`) is the Preview. The true production
> source `fb933c3` was authored 2026-07-08T06:24:45Z and *redeployed* on
> 2026-08-02, so it falls outside any window bounded by commit authorship time —
> and it was absent from the local clone when this table was built.

| Time | Event |
|---|---|
| 2026-06-19T21:22:19Z | `578b4b0` — current `origin/main` HEAD |
| **2026-08-02T09:06:44Z** | **`418e3b8`** — last commit before the deployed asset |
| **2026-08-02T09:14:01Z** | **Deployed static chunk `last-modified`** (7m 17s later) |
| 2026-08-02T09:22:40Z | `30e8dfb` — *first* Rule Studio commit (8m 39s after the asset) |

The deployed build falls in a **15-minute, 56-second window** bounded below by
`418e3b8` and above by `30e8dfb`. Only one commit exists at or before that
boundary: `418e3b8`.

Corroborating structural evidence:

- `git log -1 --format='%p' 30e8dfb` → `418e3b8`. The inferred deployed commit is
  the **exact parent** of the first Rule Studio commit.
- `git ls-tree -r --name-only 418e3b8 | grep -c clinical-rules` → **0**
- `git ls-tree -r --name-only HEAD | grep -c clinical-rules` → **48**

### Caveat on the timestamp

`last-modified` on a content-hashed, `immutable` chunk records when **that asset**
was first built. An unchanged chunk can survive later deploys. The timestamp
therefore establishes a **build era**, not a guaranteed current deploy time. A
later deploy that did not alter this chunk would not move it. This is why the
identity is STRONGLY_INFERRED rather than VERIFIED.

### Branch containment (verified)

```
git branch -r --contains 418e3b8   →  origin/codex/versioned-clinical-rule-studio
git merge-base --is-ancestor 418e3b8 origin/main   →  NO
git merge-base --is-ancestor origin/main 418e3b8   →  YES
```

`418e3b8` is a **descendant of `origin/main`** and is contained **only** in
`origin/codex/versioned-clinical-rule-studio`. The deployment does **not**
correspond to `origin/main`, which is still at the June commit `578b4b0`.

## ⚠ Release-safety implication — CORRECTED 4 August 2026

> **Superseded text (3 August, retained for the audit trail):** *"The deployed
> production hostname appears to track `origin/codex/versioned-clinical-rule-studio`
> … pushing this branch could auto-deploy the Rule Studio programme to
> `screening.privexa.co`."* That inference was **wrong**, for the reasons given in
> the correction section above. It was, however, the correct call at the time:
> it blocked a push under uncertainty, and the uncertainty was real.

### Verified position

Push safety is **`VERIFIED_PREVIEW_ONLY_AND_PROTECTED`**.

- The Vercel **Production Branch is `main`**. Pushing
  `codex/versioned-clinical-rule-studio` creates a **Preview** deployment only.
- Preview and generated deployment URLs are gated by **Vercel Authentication
  (Standard Protection)** and require a Vercel team login.
- There are **no deploy hooks, no CI workflows, no ignored-build-step branch
  mapping and no promotion rules** that could route the branch to Production.
- The `vercel.json` cron (`/api/admin/security-incidents/run`, `0 0 * * *`) is
  created and updated **on production deployments only**, so a branch push does
  not alter production scheduled behaviour.

### What remains a genuine release risk

The risk moved; it did not disappear.

- **Auto-deploy on `main` is enabled.** Any later **merge to `main`** deploys
  straight to `screening.privexa.co` and rewrites the production cron. That is
  where GOV-01…GOV-04 and R1–R6 must gate, not at the push.
- **R6 is unaffected by any push.** Standard Protection exempts custom production
  domains, so the publicly exposed demo credentials on `screening.privexa.co`
  remain live and remain `OPEN_SECURITY_REMEDIATION_REQUIRED`.
- **Preview protection is configuration-verified, not empirically probed.** No
  unauthenticated request was made to a preview URL to confirm it returns 401.

## Reconnaissance record

### Response headers (root)

- `server: Vercel`; `x-powered-by: Next.js`; `x-vercel-id: syd1::bom1::…`
- `set-cookie: __Host-authjs.csrf-token=…`, `__Secure-authjs.callback-url=…`
  → Auth.js / NextAuth v5 cookie naming
- `strict-transport-security: max-age=63072000; includeSubDomains; preload`
- `content-security-policy: default-src 'self'; script-src 'self' 'unsafe-inline'
  'unsafe-eval'; … frame-ancestors 'none'; base-uri 'self'; form-action 'self'`
- `x-frame-options: DENY`; `x-content-type-options: nosniff`;
  `referrer-policy: strict-origin-when-cross-origin`
- `permissions-policy: camera=(), microphone=(), geolocation=(), payment=()`
- `cache-control: private, no-cache, no-store, max-age=0, must-revalidate`

Security header posture is strong. The two notable CSP weaknesses are
`'unsafe-inline'` and `'unsafe-eval'` in `script-src`.

### Route topology — and why it proves nothing about routes

| Path | Result |
|---|---|
| `/` | 200 — **marketing landing page**, not the login page |
| `/login` | 200 |
| `/dashboard`, `/rules`, `/rules/clinical`, `/review`, `/batch`, `/patients`, `/decisions`, `/guidelines`, `/readiness`, `/coordinator`, `/gp`, `/pathway` | 307 → `/login?callbackUrl=…` |
| `/definitely-not-a-real-route-zzz9` | **307 → `/login?callbackUrl=…`** |
| `/rules/clinical/nonexistent-zzz9` | **307 → `/login?callbackUrl=…`** |
| `/zzz-control-path` | **307 → `/login?callbackUrl=…`** |

**Control test result: nonexistent paths also redirect.** The middleware gates
every unmatched path, so a 307 on `/rules/clinical` is **not** evidence that the
Rule Studio route exists in the deployment. No route-existence conclusion may be
drawn from this table. This is recorded explicitly because the opposite inference
would be the natural mistake.

Note `/` differs structurally from the local candidate, where `/` is not a
marketing page. This is a real, observable A-versus-C difference.

### API surface

| Path | Result |
|---|---|
| `/api/health`, `/api/version`, `/api/status` | 401 |
| `/health`, `/version` | 307 → `/login` |
| `/robots.txt` | Next.js 404 page with `<meta name="robots" content="noindex">` |

No public version or health endpoint. All API access is authenticated.

### Client bundle analysis

13 unique chunks referenced by `/` and `/login` were downloaded (752 KB total)
and searched:

| Marker | Chunks containing it |
|---|---:|
| `CG-NCSP` | 0 |
| `clinicianOnly` | 0 |
| `SHADOW` | 0 |
| `SIMULATION` | 0 |
| `rulesetChecksum` | 0 |
| `Provisional recommendation` | 0 |
| `Reviewer confirmation required` | 0 |
| `Not for direct clinical action` | 0 |
| `Simulated export` | 0 |
| Rule ID patterns (`F3-01`, `T1-01`, `A26-08`, …) | 0 distinct IDs |
| `canonical` | 2 (generic library usage, not engine identity) |

**Interpretation limit:** the clinical engine executes server-side. Its absence
from *public* client bundles is expected and is **not** evidence that the engine
is absent from the deployment. The genuine evidence for absence is the Git
timeline plus `ls-tree`, not the bundle scan. Bundles from authenticated routes
were not fetched.

### Source maps and manifests

- `…/chunks/03ejqqa83c7q1.js.map` → **404**; no `sourceMappingURL` in any chunk.
  Source maps are not exposed. Good practice; also removes an identity avenue.
- `/_next/static/HZKNUX6TfkW88sakoDj6n/_buildManifest.js` → 200, but contains only
  `"/_app"` and `"/_error"` (Pages-Router stub). App Router routes are **not**
  enumerated. No route inventory obtainable.
- `/_next/app-build-manifest.json`, `/_next/build-manifest.json` → 307 (gated).

### Metadata

`<meta name="description">`: *"…Decision support — a prototype under clinical
validation, not a certified medical device."*

The deployment self-describes as a prototype and explicitly disclaims certified
medical-device status. It does **not** carry the required "Demo environment",
"Reviewer confirmation required", "Not for direct clinical action" or "Simulated
export package" wording on its public surfaces.

## ⚠ Security finding — publicly exposed demo credentials

The internet-facing login page at `https://screening.privexa.co/login` renders,
in the public HTML with no authentication:

> `Demo accounts — click to fill:` … `All demo accounts · password: <REDACTED>`

with role-labelled buttons for admin, clinician, coordinator and specialist
reviewer accounts, and a shared password rendered in plain text.

The literal password is **deliberately not reproduced in this repository**, even
though the deployment publishes it, so that a working production credential is
not committed to Git. It is visible to anyone who loads the page.

- **Exposure:** anyone on the internet can read working credentials for four
  roles, including a platform-admin role, and sign in.
- **Verified by:** direct read of the unauthenticated `/login` HTML. Not tested —
  no sign-in was attempted.
- **Same behaviour exists in the local candidate build**, so this is a
  pre-existing product behaviour, not a regression introduced by the Rule Studio
  work.
- **Why it matters here:** it is the reason the environment *looks* like a demo,
  and it is simultaneously the reason production writes are unsafe — a
  publicly-writable clinical-looking system with no documented test tenant.

This finding is independent of the comparison programme and should be routed to
the security/product risk owner alongside R1–R5. It is **not** in the existing
retained-risk register, which covers dependency findings only.

## Machine-readable companion

`01-deployment-identity.json` carries the same fields for automated consumption.
No secrets, cookies or session tokens are recorded in either file.
