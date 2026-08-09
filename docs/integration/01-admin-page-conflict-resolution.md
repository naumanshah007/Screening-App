# Conflict resolution — `app/(app)/admin/page.tsx`

Date: 4 August 2026.
Branch: `integration/rule-studio-on-latest-main`, based on `origin/main` @ `fb933c3`.
Merged: `codex/versioned-clinical-rule-studio` @ `60d38c9`.

## Merge summary

```
git merge --no-commit --no-ff codex/versioned-clinical-rule-studio
Auto-merging app/(app)/admin/page.tsx
CONFLICT (content): Merge conflict in app/(app)/admin/page.tsx
Auto-merging components/batch/BatchResultDetail.tsx
```

| Path | Result |
|---|---|
| `app/(app)/admin/page.tsx` | **CONFLICT** — 4 hunks, resolved below |
| `components/batch/BatchResultDetail.tsx` | auto-merged, reviewed, accepted |
| 147 added / 20 modified files | clean |

## The four conflicting hunks

| # | `main` (production) | Candidate (Rule Studio) |
|---:|---|---|
| 1 | `clinicalRuleSet.count({ where: { isActive: true } })` and `auditLog.count(...)` | `clinicalRuleVersion.count({ where: { status: "ACTIVE" } })` and `auditLog.findMany(...)` |
| 2 | — | adds a `clinicalRuleVersion.findMany(...)` query for version history |
| 3 | adds the `tabs` / `activeTab` derivation | adds `AdminRuleSet` and `AdminAuditLog` Prisma payload types |
| 4 | adds the tab-bar JSX | adds the Rule Version History card JSX |

## A semantic conflict hidden beneath the textual one

Hunk 1 is not a formatting clash. **`main` queries `prisma.clinicalRuleSet.count({ where: { isActive: true } })`, and the Rule Studio schema redefines `ClinicalRuleSet` as a governed rule-set container with no `isActive` column** — activation moved onto `ClinicalRuleVersion` and `RuleSetActivation`.

Taking main's line verbatim would not have compiled against the merged schema. Choosing either whole side would therefore have been wrong: main's side breaks the build, the candidate's side silently drops main's tab structure.

## Resolution method

The file was reset to **main's version** as the resolution base, so no production
Admin UX could be lost by omission, and the Rule Studio surfaces were then added
back explicitly. Each hunk:

| # | Resolution |
|---:|---|
| 1 | Replaced the `clinicalRuleSet.isActive` count with `clinicalRuleVersion.count({ where: { status: "ACTIVE" } })` — the faithful equivalent of the production stat under the new schema. Kept **main's** `auditLog.count(...)`, since main's stat card consumes a count. Commented in place. |
| 2 | **Added** the candidate's `clinicalRuleVersion.findMany(...)` query and the matching `rulesets` destructuring entry. |
| 3 | **Kept main's** `tabs` / `activeTab` derivation **and added** the candidate's `AdminRuleSet` payload type. `AdminAuditLog` was not needed, because main's audit stat is a count rather than a list. |
| 4 | **Kept main's** tab bar unchanged and added a **new `clinical-rules` tab** carrying the candidate's Rule Version History card. The `AdminTab` union was widened to `"users" \| "security" \| "integrations" \| "clinical-rules"`. |

Nothing from `main` was replaced. The Rule Studio surface was added alongside it.

## Verification — no production feature silently removed

Checked in the resolved file before committing:

| Production Admin UX symbol | Present |
|---|:--:|
| `NcsrCertificationManager` | ✓ |
| `IntegrationValidationManager` | ✓ |
| `SecurityIncidentAutomationCard` | ✓ |
| `SecurityIncidentManager` | ✓ |
| `UserAccessManager` | ✓ |
| `CreateUserForm` | ✓ |
| `getRuntimeReadinessReport` | ✓ |
| `getEnterpriseIntegrationStatuses` | ✓ |
| `getNcsrCertificationSummary` | ✓ |
| `getIntegrationValidationStateMap` | ✓ |

| Rule Studio surface | Present |
|---|:--:|
| `clinicalRuleVersion` queries | ✓ |
| `AdminRuleSet` type | ✓ |
| `clinical-rules` tab | ✓ |
| `/rules/clinical` entry point | ✓ |

Conflict markers remaining: **0**. Unmerged paths: **0**.

## Behavioural note

The "Active Rules" stat now counts **ACTIVE clinical rule versions**, which is
**0** — correct, because CG-NCSP-3.0.0 and CG-NCSP-3.1.0 are DRAFT and nothing is
activated. Main's stat card renders the `urgent` variant when the count is zero.
That is an accurate reflection of the governance state, not a defect: no rule
version is live, and the legacy engine remains authoritative.

## Access control

No permission logic was changed. The page still requires `ADMIN` or
`INTEGRATION_ADMIN`, and the `canManageUsers` gate (ADMIN only) is untouched. The
new tab inherits the same page-level guard.
