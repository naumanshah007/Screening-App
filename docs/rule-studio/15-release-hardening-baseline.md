# Release-hardening baseline

Captured: 2026-08-03 06:26 NZST (2026-08-02T18:26:53Z)

This report freezes the starting state for the Canonical Input Expansion and Release-Candidate Hardening programme. It is software-conformance evidence for a source-derived draft. It is not clinical validation and is not evidence for direct clinical action.

## Repository identity and ownership boundary

| Item | Baseline |
|---|---|
| Branch | `codex/versioned-clinical-rule-studio` |
| Initial HEAD | `ed49bf1e4ad77089bf71d1d700d20a5e75b26161` |
| Requested historical base | `578b4b046aed60ef68b950ffb5945e4bf6ec956b` (present) |
| Origin branch HEAD | `418e3b8` |
| Staged entries | 0 |
| Modified tracked files | 48 |
| Untracked top-level status entries | 44 |

The complete path inventory remains recorded by `git status --short` and the earlier ownership reports `00-baseline.md`, `09-change-inventory.md`, and `13-mixed-file-reconciliation.md`. All 48 tracked modifications and 44 untracked entries pre-date this programme and remain user-owned or mixed. No broad staging, reset, checkout, clean, or overwrite operation is authorised.

## Toolchain

| Tool | Version |
|---|---|
| macOS kernel | Darwin 25.5.0 arm64 |
| Git | 2.51.2 |
| Node.js | 25.1.0 |
| npm | 11.6.2 |
| TypeScript | 5.9.3 |
| Prisma CLI/client | 7.5.0 / 7.5.0 |

## Verified source package

Source package:

`docs/clinical-sources/source-v2.1/CerviGrade_NCSP_Master_Rulebook_Package_v2_1/`

Verified visual package:

`docs/clinical-sources/source-v2.1/CerviGrade_Verified_Pathway_Views_v2_1_1/`

| Integrity check | Result |
|---|---:|
| Supplied v2.1 manifest entries | 11/11 SHA-256 verified |
| Verified visual manifest entries | 73/73 SHA-256 verified |
| Source JSON SHA-256 | `ffd329502683b2ba9b308e9309e4c6cc970b3954ce1067bfdc5b82869ef886b1` |
| Source rules | 203 |
| Unique stable rule IDs | 203 |
| Typed compiled rules | 203 |
| Registered executable conformance IDs | 653 |
| Table 1 rule IDs | 21 |
| Clinician-only rules | 11 |
| Canonical nodes | 422 |
| Canonical edges | 421 |
| Synchronized graph views | 12 |
| Verified v2.1.1 pathway views | 10 |
| Clean deterministic snapshot checksum | `2997a909b98f9d8960cc3697cf125d5b0e106d4f0be9a0ee789404e54486a96b` |

The verified visual QA register reports PASS, 203 mapped unique rule IDs, all 21 Table 1 rules, and all ten critical graph assertions true. Clinical content continues to be controlled by the source package; the visual package supplies verified graph projection and layout evidence.

## Existing local database state

| Item | Baseline |
|---|---|
| Ruleset version | `CG-NCSP-3.0.0` |
| Version ID | `cmsbcyszx0001nmv4xnjs0wtp` |
| Status | `DRAFT` |
| Revision | 3 |
| Stored checksum | `f6d75166bc2ba78f97542f4c2997ba70ad615955219d8d99ab82e424f504ae52` |
| Parent | none |
| Evaluations | 1 |
| Audit events | 3 |
| Publication timestamp | none |
| Activation timestamp | none |
| Activation records | 0 |
| Live activation records | 0 |

The evaluated `CG-NCSP-3.0.0` identity is protected and intentionally differs from the current clean source projection. It must not be refreshed or overwritten. A changed release-hardening projection must use a new semantic version and a parent link.

## Independent semantic evidence at baseline

| Disposition | Cases |
|---|---:|
| Concordant | 143 |
| Canonical action match with metadata/precedence difference | 15 |
| Source case not representable by legacy input | 18 |
| Canonical pathway/source ambiguity | 3 |
| **Independent source cases** | **179** |

The full shadow disposition separately records 110 agreements, 26 confirmed legacy defects, 7 presentation-only differences, 15 unresolved clinical-review cases, 18 unsupported legacy states, and 3 source ambiguities.

## Baseline verification

| Command | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS: 0 errors, 21 existing warnings |
| `npm run test:engine` (within `test:all`) | PASS: 107/107 |
| `npm run test:batch` | PASS: 218/218 |
| `npm run test:rules` | PASS: 890/890 |
| `npm run test:all` | PASS: 1,215 total |
| `npm run build` | PASS; one existing Turbopack storage trace warning |
| `npx prisma validate` | PASS |
| `npx prisma migrate status` | PASS: 7 migrations, schema up to date |
| `git diff --check` | PASS |
| Source/visual SHA-256 checks | PASS |

## Release boundary

- Legacy remains authoritative.
- Canonical evaluation remains shadow or simulation only.
- `CG-NCSP-3.0.0` remains unchanged, unpublished, and inactive.
- No national ruleset is active.
- Any successor must remain `DRAFT`, unpublished, and inactive.
- Provisional recommendation.
- Reviewer confirmation required.
- Not for direct clinical action.
- Demo environment.
- Simulated export package.
