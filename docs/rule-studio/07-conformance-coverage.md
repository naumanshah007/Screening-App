# Governed conformance coverage

Generated 2026-08-02. This report measures the executable v2.1 Rule Studio scope. It must not be read as clinical validation or as a replacement for the independent 179-branch NCSP parity audit.

## Coverage result

| Measure | Result |
|---|---:|
| Canonical v2.1 rules | 203 |
| HIGH/CRITICAL rules | 139 |
| HIGH/CRITICAL rules with typed AST | 139/139 (100%) |
| Additional compiled lower-priority Figure 3 rules | 3 |
| Total rules with typed AST | 142/203 (70.0%) |
| Registered executable conformance IDs | 462 |
| Base positive/negative/missing cases | 426 |
| Additional boundary cases | 36 |
| Dedicated Rule Studio test suite | 638/638 pass |

Every compiled rule has a positive case, a nearest negative case, and a missing-fact case. Boundary cases cover age 24/25, 29/30, 49/50, 69/70/74/75, Test-of-Cure and vault co-test counts, 11/12-month intervals, CIN2 23/24-month limits, and postpartum week boundaries.

## Coverage by source section

| Source section | Compiled rules | CRITICAL | HIGH | MEDIUM/LOW | Executable IDs |
|---|---:|---:|---:|---:|---:|
| Global Router & Safety | 18 | 8 | 10 | 0 | 54 |
| Figure 1 | 0 | 0 | 0 | 0 | 0 |
| Figure 2 | 2 | 0 | 2 | 0 | 6 |
| Figure 3 | 14 | 3 | 8 | 3 | 54 |
| Figure 4 | 8 | 3 | 5 | 0 | 24 |
| Figure 5 | 9 | 1 | 8 | 0 | 27 |
| Figure 6 | 14 | 3 | 11 | 0 | 51 |
| Figure 7 | 18 | 4 | 14 | 0 | 54 |
| Table 1 | 14 | 0 | 14 | 0 | 42 |
| Figure 8 | 10 | 4 | 6 | 0 | 33 |
| Figure 9 | 11 | 4 | 7 | 0 | 36 |
| Figure 10 | 8 | 4 | 4 | 0 | 24 |
| Special populations | 6 | 2 | 4 | 0 | 20 |
| 2026 overlays | 9 | 0 | 9 | 0 | 34 |
| Immune-deficiency classifier | 1 | 0 | 1 | 0 | 3 |
| **Total** | **142** | **36** | **103** | **3** | **462** |

The 36 CRITICAL plus 103 HIGH rows equal the complete 139-rule publication-blocker scope.

## What the tests prove

- The typed AST returns TRUE for a source-derived qualifying fact set.
- A nearest fact change returns FALSE.
- Removal of an explicitly required fact returns UNKNOWN or the rule's governed missing-data stop.
- Each rule's declared test IDs exist in the executable registry.
- Every HIGH/CRITICAL source rule is compiled exactly once.
- Required precedence invariants choose the more specific safety route when multiple rules match.
- The imported draft validates structurally and remains unactivated.

## What the tests do not prove

- Independent clinical approval of the source-to-AST translation.
- Complete executable coverage of all 203 v2.1 rules. Sixty-one MEDIUM/LOW rules remain source-text expressions; only three lower-priority Figure 3 rules were added to the executable scope.
- End-to-end parity of the current production wizard, API, batch mapper, persistence, Review Queue, or export paths with all source branches.
- Closure of the legacy audit's 124 retained mismatches. Production logic was deliberately not changed.
- Clinical validation, pilot readiness, production readiness, or permission to publish/activate the draft.

The older audit's 179 terminal-branch oracle and this package's 203 canonical rule records are different measurement units. Their percentages must not be combined or presented as one clinical-coverage number.

## Remaining gates

Before any governed publication or activation, the source-to-AST translation requires independent clinical review, all remaining MEDIUM/LOW terminal behaviour needs an explicit governance decision, the full source-derived end-to-end suite must be reconciled, and every shadow difference must receive a documented disposition. Required result wording remains:

- Provisional recommendation
- Reviewer confirmation required
- Not for direct clinical action
- Demo environment
- Simulated export package

