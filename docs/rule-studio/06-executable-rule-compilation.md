# Executable rule compilation

Generated 2026-08-02 for `CG-NCSP-3.0.0` revision 3. This is software-conformance evidence for an unactivated draft. It is not clinical validation, publication approval, pilot readiness, or production approval.

## Result

**PASS for the requested HIGH/CRITICAL compilation scope.** All 139 HIGH or CRITICAL v2.1 rules now use the governed typed Boolean AST and carry registered executable conformance-test identifiers. Three lower-priority Figure 3 rules (`F3-01`, `F3-02`, and `F3-15`) are also compiled because they are needed to prove the immune-status and age 70–74 exit-test invariants.

The compiled snapshot contains 203 rules, 422 nodes, 421 edges, and 12 synchronized views. It is stored as revision 3 with checksum `f6d75166bc2ba78f97542f4c2997ba70ad615955219d8d99ab82e424f504ae52`, status `DRAFT`. No publish, activation, rollback, retirement, or production cutover action was performed.

## Source and independence boundary

Compilation uses this precedence:

1. `CerviGrade_NCSP_Master_Rules_v2_1.json` supplies the canonical rule ID, source-derived condition, outcome, timing/destination, safety priority, missing-data direction, reviewer boundary, and source references.
2. The v2.1.1 verified visual package supplies view membership and presentation metadata only.
3. The legacy engine is comparison evidence only. It is never used to derive a canonical expected result.

The compiler is an explicit `Record<ruleId, GovernedRuleCompilation>` in `lib/clinical-rules/compiled-v2-1.ts`. It does not use `eval`, generated JavaScript strings, or code copied from the legacy engine.

## Governed expression model

Allowed expression nodes are `ALWAYS`, `NOT`, `ALL`, `ANY`, and typed `FACT` predicates. Allowed fact operators are `EQ`, `NEQ`, `IN`, `NOT_IN`, `EXISTS`, `MISSING`, `CONTAINS`, `GT`, `GTE`, `LT`, and `LTE`. Values are scalar strings, numbers, booleans or null, or arrays of those scalar types.

Every compiled rule has:

- an explicit stable rule ID;
- a typed condition tree;
- a derived required-fact list;
- a source-derived provisional outcome retained from the canonical package;
- positive, negative, and missing-fact executable cases;
- additional named boundary cases where the source has age, count, interval, or timing edges;
- mandatory reviewer confirmation and the original clinician-only boundary.

The canonical fact adapter translates only facts present in the legacy input contract. It does not invent absent data. In particular, legacy `immunocompromised: false` is not promoted to a verified immune-competent classification, missing sample type stays missing, and a missing treatment date stays missing.

## Compilation sequence and blocker burn-down

The initial validator reported 278 blockers: one source-text condition and one missing executable-test registration for each of 139 HIGH/CRITICAL rules.

| Compilation phase | HIGH/CRITICAL rules | Blockers after phase |
|---|---:|---:|
| Global router and safety | 18 | 242 |
| Figure 3 primary HPV and exit rules | 11 | 220 |
| Figure 10 symptoms and bleeding | 8 | 204 |
| Figure 6 treatment and Test of Cure | 14 | 176 |
| Figure 7 glandular/AIS | 18 | 140 |
| Table 1 and Figure 8 hysterectomy/vault | 24 | 92 |
| Figure 9 pregnancy | 11 | 70 |
| Figures 4 and 5 post-colposcopy | 17 | 36 |
| Figures 1 and 2 transition routes | 2 | 32 |
| DES, under-25, 2026 overlays and immune classifier | 16 | 0 |
| **Total** | **139** | **0** |

Figure 1 has no HIGH/CRITICAL source rule in the v2.1 package; the two rules in the combined Figure 1/Figure 2 phase are both Figure 2 rules.

## Explicit precedence

The evaluator sorts simultaneous matches by governed precedence, then source safety priority, then stable snapshot order. The highest groups are:

1. Specific malignant-disease routes.
2. Missing-data safety stops and clinician-only stops.
3. Symptom and cancer overlays.
4. Global pre-pathway routers.
5. Age 70–74 exit-test detected/not-detected branches.
6. Remaining CRITICAL, then HIGH, then lower-priority rules.

Global routers require `routingStage: BEFORE_PATHWAY_SELECTION`, preventing a general router from continually overriding an already selected pathway. Dedicated regression tests cover malignant cytology in pregnancy, exit-test HPV detection, missing Test-of-Cure treatment evidence, successful vault Test of Cure, and clinician-only finalisation.

## Validation evidence

- 139/139 HIGH/CRITICAL rules compiled.
- 142 total rules compiled, including the three lower-priority Figure 3 invariants.
- 462 unique executable conformance-test IDs registered.
- Validator: 0 errors, 0 warnings, 1 informational result.
- Import rerun: `UNCHANGED`, confirming the revision-3 snapshot is idempotent.
- Dedicated rule suite at this checkpoint: 638/638 pass.

Zero blockers means the repository's defined HIGH/CRITICAL software gate is satisfied. It does not mean all 203 rules are executable, that independent clinical approval has occurred, or that the draft can be activated.

