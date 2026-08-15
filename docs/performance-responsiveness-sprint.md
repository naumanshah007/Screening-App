# Performance and responsiveness sprint

Date: 16 August 2026
Accepted baseline: `98ccade3e05e06a87edb1411d2eeb4b355c2ce69`

## Outcome

The work addressed the measured read-path and navigation bottlenecks without changing clinical rules, governed recommendations, authority decisions, security enforcement, audit meaning, episode integrity, usage integrity, connector behavior, or deployment behavior.

The comparison uses three deliberately separate datasets:

1. The deployed site (`screening.privexa.co`) for the real pre-change network/runtime baseline.
2. An optimized Next.js production build for database/query instrumentation.
3. The accepted baseline and optimized production builds against copies of the same local database, including 244 active queue items and 122 completed decisions, for controlled before/after comparisons.

No Next.js development-mode number is used as a performance result. The optimized code was not deployed during this sprint, so the deployed-after result remains a rollout verification item.

## Initial bottleneck ranking

1. **Deployment/runtime-to-database latency floor.** Warm deployed TTFB was 960–2,012 ms while the same route code and database shape completed locally in tens of milliseconds. The inspected Vercel functions were in `bom1` (Mumbai).
2. **Repeated authenticated-layout reads.** Every full route performed three account reads, two Review Queue counts, and repeated governed-rules presentation reads. The shared portion was seven operations before page-specific work.
3. **Review Queue over-fetching.** The deployed page rendered 218 complete clinical/evaluation objects and transferred 178,092 compressed bytes.
4. **Users & Access readiness computation.** Password-hash comparisons ran on every render and synchronously delayed unrelated completion reporting; controlled baseline completion averaged 1,390 ms.
5. **Dashboard and Analytics read fan-out.** Command Centre performed 26 database operations and Analytics performed 41. Dashboard also read overlapping item sets for separate secondary widgets.

This ranking was recorded before broad optimization. Changes were then limited to these contributors and one measured global bundle leak.

## Deployed baseline

Authenticated full-document requests were measured three times per route with compression enabled. Browser client-navigation checks independently confirmed the same route ranking; visible route content arrived between roughly 1.3 and 2.8 seconds in that browser run.

| Route | TTFB (ms) | Complete (ms) | Compressed HTML (bytes) |
|---|---:|---:|---:|
| Command Centre | 1,409 | 1,661 | 18,080 |
| Pull Cases | 1,062 | 1,272 | 16,251 |
| Review Queue | 1,598 | 2,679 | 178,092 |
| Completed Decisions | 1,073 | 1,356 | 15,793 |
| Guidelines | 1,036 | 1,271 | 14,113 |
| Analytics | 1,158 | 1,380 | 21,235 |
| Usage & Activity | 1,039 | 1,291 | 22,520 |
| Users & Access | 2,012 | 2,282 | 12,479 |
| Integration Centre | 960 | 1,224 | 17,758 |
| Rule Studio | 1,157 | 1,427 | 13,585 |
| Clinical Governance | 1,166 | 1,670 | 31,260 |
| System Operations | 1,062 | 1,356 | 11,325 |

The browser detected a DOM response to every click by the 75 ms observation point. Review Queue, Completed Decisions, Governance, Integration Centre, and Rule Studio had not changed URL at that point, so they were the clearest cases for a dedicated pending indicator and stable route skeleton.

## Controlled production-build before/after

These are server completion and compressed HTML measurements from optimized production builds, not dev mode. Baseline and optimized builds used copies of the same representative database. Five baseline samples and ten optimized samples were taken per route. System Operations was additionally checked with 20 interleaved samples to remove run-order noise.

| Route | Before total (ms) | After total (ms) | Change | Before bytes | After bytes | Payload change |
|---|---:|---:|---:|---:|---:|---:|
| Command Centre | 43.2 | 40.6 | -6.0% | 27,520 | 26,434 | -3.9% |
| Pull Cases | 27.6 | 21.9 | -20.7% | 17,606 | 17,294 | -1.8% |
| Review Queue | 94.6 | 35.3 | -62.7% | 32,648 | 21,504 | -34.1% |
| Completed Decisions | 49.1 | 32.6 | -33.6% | 20,578 | 18,707 | -9.1% |
| Guidelines | 28.8 | 20.2 | -29.9% | 15,994 | 15,769 | -1.4% |
| Analytics | 36.5 | 30.1 | -17.5% | 34,490 | 33,744 | -2.2% |
| Usage & Activity | 23.9 | 20.2 | -15.5% | 24,838 | 23,745 | -4.4% |
| Users & Access (warm) | 1,390.2 | 17.5 | -98.7% | 16,004 | 15,805 | -1.2% |
| Integration Centre | 22.9 | 15.5 | -32.3% | 15,157 | 15,114 | -0.3% |
| Rule Studio | 16.9 | 14.0 | -17.2% | 12,199 | 12,028 | -1.4% |
| Clinical Governance | fixture redirected | 14.0 | n/a | fixture redirected | 8,622 | n/a |
| System Operations | 50.7 | 32.2 | -36.5% | 18,327 | 18,346 | +0.1% |

The optimized Users & Access result is 17.5 ms on a warm process. On a newly started process its first full streamed response was 586 ms, still below the 1.5 second heavy-admin target; exact password/hash results are then memoized. A changed password or hash has a different cache key immediately.

Clinical Governance redirected to Rule Studio in the baseline local fixture because that fixture intentionally had no governed ruleset. Its deployed baseline and optimized standalone measurement are reported, but a false same-fixture percentage is not calculated.

## Database operations

Instrumentation records model, operation, and duration only; it never logs arguments, identifiers, credentials, or clinical payloads. “DB time” is the sum of individual operation durations, so parallel operations can overlap and the sum can exceed request wall time. The after run used the larger representative queue; the earlier query-instrumentation run used the small seed. Query counts are directly comparable; duration columns describe their respective fixtures rather than pretending to be an identical remote-database benchmark.

| Route | Queries before | Queries after | Summed DB ms before | Summed DB ms after | Largest after contributor |
|---|---:|---:|---:|---:|---|
| Command Centre | 26 | 19 | 56.73 | 96.23 | `BatchReviewItem.findMany`, 25.58 ms across 3 reads |
| Pull Cases | 8 | 5 | 2.31 | 1.81 | governed-rules presentation, 0.90 ms |
| Review Queue | 12 | 8 | 11.25 | 18.43 | governed-rules presentation, 9.29 ms |
| Completed Decisions | 9 | 6 | 4.79 | 14.12 | list/filter projections, 6.73 ms across 2 reads |
| Guidelines | 10 | 5 | 3.21 | 1.64 | account reads, 0.84 ms |
| Analytics | 41 | 38 | 214.94 | 195.33 | referral counts, 35.03 ms across 9 reads |
| Usage & Activity | 14 | 11 | 13.65 | 18.09 | bounded usage lists, 6.54 ms across 3 reads |
| Users & Access | 12 | 9 | 926.94 | 5.01 | user lists, 1.84 ms across 2 reads |
| Integration Centre | 9 | 6 | 2.51 | 2.99 | governed-rules presentation, 1.19 ms |
| Rule Studio | 8 | 5 | 2.67 | 3.18 | governed-rules presentation, 1.25 ms |
| Clinical Governance | 8 | 5 | 1.99 | 1.44 | account reads, 0.78 ms |
| System Operations | 26 | 23 | 35.61 | 54.02 | audit counts, 7.53 ms across 3 reads |

The apparent 923 ms `User.findMany` baseline duration on Users & Access was event-loop delay while password comparisons ran, not slow SQLite work. Isolating and memoizing the exact comparison reduced the observed database operation to 1.84 ms total.

## Implemented changes

- Added request-scoped React deduplication for server-component session reads. The proxy still validates every request and still enforces account disablement, revocation, enrollment, and RBAC.
- Added request-scoped presentation deduplication for the governed-rules badge. Clinical evaluation continues to call the authoritative resolver directly.
- Removed Review Queue counts from the blocking layout path. An authenticated, authorized private endpoint now refreshes the decorative badge asynchronously.
- Added a `useLinkStatus` pending spinner and stable route skeletons. The five daily-workflow destinations use explicit prefetch; large admin destinations retain automatic/viewport-sensitive prefetch.
- Added 50-row server pagination to Review Queue and Completed Decisions. Review details are fetched in one bounded query for visible IDs; Completed Decisions uses a list-only projection and keeps the full record for detail routes.
- Merged overlapping Command Centre item reads and narrowed recent-decision projections without changing metric definitions.
- Streamed Users & Access handover readiness separately and memoized only exact configured-password/hash comparisons.
- Removed eager Integration Centre audit and connectivity history. Cards receive latest evidence only; immutable history loads from an authorized GET when its drawer opens.
- Parallelized five independent waits: one Pull Cases rules/session wait, three System Operations setup waits, and one Integration Centre evidence pair.
- Added two measured, additive indexes: `(disposition, reviewRequired, createdAt)` and `(disposition, reviewedAt)`. Query plans now use the new indexes for queue mandatory-review counts and disposition-filtered completed reads; the clinically ordered queue still needs a temporary sort because its existing CASE-based priority order is intentionally preserved.
- Kept React Flow/chart JavaScript route-scoped. Removed React Flow CSS from the root layout: ordinary-route CSS fell from 160,679 to 145,266 bytes, a 15,413 byte (9.6%) reduction.

No N+1 query was present in the measured major routes, so none was claimed as removed. Existing Audit Trail (25/100 maximum), Usage & Activity (25/100 maximum), and Intake Sessions (50) reads were already bounded. The measured user directory was small and did not justify introducing pagination solely for theoretical savings.

## Browser QA

The optimized production build was exercised as an authenticated administrator in the in-app browser:

- Command Centre → Pull Cases → Review Queue → Completed Decisions → Guidelines → Command Centre completed with the expected headings and no application error.
- Usage & Activity, Users & Access, Governance/Rule Studio fallback, Integration Centre, Rule Studio, and System Operations completed separately with no application error.
- The 244-item Review Queue displayed 50 items and truthful “1–50 of 244” pagination.
- The sidebar badge loaded asynchronously and displayed `99+` for 243 pending review items without blocking initial route HTML.
- Priority destinations were already available from prefetch in the local run; source and contract tests confirm the pending indicator and route skeleton path for uncached navigation.

The in-app browser does not expose viewport emulation, and OS-level Computer Use permission was not granted. Mobile behavior therefore has a responsive source/contract test (mobile open/close drawer at the `xl` breakpoint) but no claimed mobile viewport screenshot. This is the only browser-QA limitation.

## Region observation

`REGION/LATENCY ISSUE = YES`.

The deployed Vercel functions were inspected in `bom1`. Warm deployed TTFB was approximately 0.96–2.01 seconds while controlled production-build responses were generally 14–54 ms locally. That gap is too large to attribute to component rendering alone and indicates that deployment/runtime/network/server-to-database latency is material.

The database URL is encrypted configuration and was not exposed, so this sprint does not claim a Turso primary/replica region it could not verify. Before rollout, verify that the database read region is aligned with the application’s real user and function region. No infrastructure was moved in this sprint.

## Safety boundary

- Clinical logic changed: **No**
- Security controls weakened: **No**
- Audit semantics changed: **No**
- Clinical authority caching introduced: **No**
- Evidence deleted: **No**
- Integration or deployment behavior changed: **No**
