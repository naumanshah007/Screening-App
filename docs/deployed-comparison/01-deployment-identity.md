# Deployed build identity — evidence and inference

Target: `https://screening.privexa.co`. Reconnaissance date: 3 August 2026.
All observations read-only, rate-limited, publicly served surfaces only.

## Conclusion

| Item | Value | Confidence |
|---|---|---|
| Deployed Git commit | **`418e3b8`** — `feat(batch): rebase demo dataset across NZ regions` | **STRONGLY_INFERRED** |
| Deployed branch lineage | `origin/codex/versioned-clinical-rule-studio` — **not** `origin/main` | **VERIFIED** (ref containment) |
| Build ID | `HZKNUX6TfkW88sakoDj6n` | VERIFIED |
| Build era | 2026-08-02T09:14:01Z | VERIFIED (asset), STRONGLY_INFERRED (deploy) |
| Canonical Rule Studio present? | **No** | STRONGLY_INFERRED |
| Engine version | Not exposed | UNKNOWN |
| Deployed schema generation | Not observable unauthenticated | UNKNOWN |
| Exact commit proven? | **No.** The SHA is not exposed anywhere | — |

The commit is **inferred, not verified**. It is not printed by the application,
not exposed via a version endpoint, and not recoverable from source maps.

## Timeline evidence (all UTC)

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

## ⚠ Release-safety implication — read before pushing the branch

The deployed production hostname appears to track
**`origin/codex/versioned-clinical-rule-studio`** — the same branch that carries
the unreviewed Rule Studio work.

If Vercel is configured to deploy that branch (production or a branch alias),
then **pushing this branch could auto-deploy the Rule Studio programme to
`screening.privexa.co`** without any further human step. That would bypass the
outstanding authenticated QA, the GOV-01…GOV-04 clinical governance decisions and
the R1–R5 security risk sign-off, all of which are recorded as release blockers.

This materially affects the previously planned sequence, in which "push the
branch" was treated as a safe pre-review step. **Confirm the Vercel
project's Git integration and production-branch configuration before any push.**
This is an inference from ref containment plus deploy timing and must be
confirmed against the Vercel project settings, which are outside this repository.

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
