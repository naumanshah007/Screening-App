# 18 — Controlled Production-head integration

Date: 9 August 2026 (NZST)  
Target ruleset: `CG-NCSP-3.1.0`  
Integration branch: `codex/canonical-controlled-integration`  
Production base: `2487ca8dd80d03f3cc18b42f88c25b8493a0cf73`

## Decision and release boundary

The approved product direction is now encoded as:

`referral → Legacy pathway router → governed pathway → authority selector → CG-NCSP-3.1.0 within-pathway recommendation when active → clinician review → immutable evaluation/audit`

Canonical is the target recommendation system. Legacy is a technical router and fail-safe fallback. They are not presented as equal guideline systems.

This branch was created from the actual Production HEAD and merged the reviewed feature history with a merge commit (`50b29a1`). The four Production overlap conflicts were resolved deliberately:

- unauthenticated login: retained the stricter R6 Production hotfix;
- bootstrap: retained the ban on remote/shared demo-account seeding from the implicit bootstrap path;
- security tests: retained the Production-head assertions;
- package scripts: retained the security suite and added the canonical/router/conformance/DB/UI suites.

No Production deployment, Production database write, clinical approval, publication, activation, live flag change, credential use, credential rotation or licensing decision was performed.

## Rollback boundaries retained

The feature history remains divided into independently reviewable commits for the shared design system, complete-screen UI migration, governed runtime/adapter/pinning, router corrections, monitoring, guideline visualisation, seed security and closure documentation. The Production security hotfix remains an earlier independent mainline boundary. This integration adds three further review boundaries:

1. authority-aware execution/persistence for new batch cases and in-flight workflow pinning;
2. canonical-first Guidelines and Case Review presentation derived from stored authority state;
3. clinical approval cards and enforced two-approver/separate-operator governance.

Reverting any presentation boundary does not activate or deactivate clinical authority. Runtime rollback remains an audited authority-row operation; no restore, history rewrite or bulk regrade is required.

## Verified governed artifact

The committed source-derived package was rebuilt and verified rather than accepted from historical prose:

| Property | Verified value |
|---|---:|
| Rules | 203 |
| Nodes | 422 |
| Edges | 421 |
| Governed views | 12 |
| Table 1 combinations | 21 |
| Semantic cases | 179 |
| Manifest checksum | `3ab8657a13e73bb0080f18399d9165c20e9af5796bdcf594bdc71170309c824a` |
| Source JSON SHA-256 | `ffd329ed25896667efb92b0a4db50742785e2d65e98a5b30bc5ef7f5f7de16aa` |

## Canonical-first information architecture

- **Clinical Guidelines** opens on the governed snapshot and exposes all synchronized pathway views through the read-only graph studio. Search, graph navigation, zoom/pan, node expansion, conditions, outcomes, timing, missing facts, rule IDs, source references, version and checksum come from the snapshot.
- The page reads the actual authority/lifecycle state at runtime. It does not hard-code `DRAFT` or claim authority from a build-time value.
- **Technical Reference → Legacy Pathway Router** describes only eligibility, precedence, pathway selection and the canonical hand-off. Superseded Legacy recommendation trees are no longer rendered as primary current guidance.
- **Case Review** renders the canonical provisional recommendation as the primary decision card only when its persisted evaluation mode is `LIVE_DEMO` or `LIVE_PRODUCTION` and the stored authority is canonical. Before activation it keeps Legacy primary and canonical visibly shadow-only.
- Under canonical authority, Legacy appears under technical provenance/pathway routing details and never as a competing within-pathway recommendation.
- **Rule Studio** remains the central versioned ruleset surface with graph, rules, sources, validation, governance, simulation, diff and append-only audit views.

## Runtime preparation closed

- Batch persistence now enters the same authority-sensitive path as the wizard instead of forcing every evaluation to `SHADOW`.
- Batch review rows store authority engine/reason and the Legacy router decision separately. The operative decision snapshot is canonical only after a legitimate live activation.
- Batch runs pin the activated ruleset at run creation; after the first operative evaluation the existing batch pin prevents mixed authorities in one worklist.
- Runtime environment selection is server-derived: Vercel Production → `PRODUCTION`, Preview → `VALIDATION`, tests → `TEST`, otherwise `DEMO`.
- A workflow created before an activation remains Legacy when completed afterwards. Activation therefore applies to new workflows only, in addition to the immutable evaluation pinning already in place.
- The Production activation blocker and explicit live-production flag gate remain intact.

## Approval closure instrument

Rule Studio now presents 16 concise, auditable evidence cards: GOV-01/02/03 plus ROUTER-002, ROUTER-003, ROUTER-001, F9-14 oncology/MDT, LEGACY-005/014/017/026, both input gaps, timing policy, regrade policy and GOV-04.

Each card displays source guidance, current Legacy behaviour, canonical behaviour, proposed final behaviour, safety impact, test evidence, alternative interpretation, pathway effect, approval state, approver and date. A proposer cannot approve the same interpretation. Approval writes a new draft revision and audit event; it does not publish or activate.

The governed version lifecycle now requires two distinct clinical `APPROVAL` audit events for the current revision and checksum before publication. The activating operator must be distinct from both clinical approvers. Revalidation cannot reuse stale approvals from an earlier revision.

## Status

Engineering work that does not require a human signature is complete on this controlled branch. The system is **not** `CERVIGRADE_READY_FOR_CONTROLLED_ACTIVATION` yet because the required human records and environment rehearsal do not exist.

Smallest remaining checkpoint:

1. Clinical lead records decisions for all 16 cards, including explicit ROUTER-001 “not a defect” confirmation where accepted.
2. A second independent clinical approver signs the current revision/checksum.
3. Governance/risk owner approves GOV-04, numeric rollback thresholds, operating capacity, timing/regrade policy, and names the activation operator/deputy.
4. Legal/content owner records governed-source licensing/redistribution approval.
5. Credential owner records R6 historical rotation/revocation or formal acceptance.
6. Platform owner confirms a dedicated shared durable Validation/Preview database and witnesses timed restore/rollback rehearsal.
7. Product owner grants explicit Production deployment/activation permission after steps 1–6 are evidenced.

Only then may a single-purpose change remove the Production activation blocker, the authorised secret process enable the live flag, and a limited **new-cases-only** activation enter the T+0 through T+24 hold points.
