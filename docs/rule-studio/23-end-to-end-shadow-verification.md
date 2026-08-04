# End-to-end canonical shadow verification

Legacy remains the displayed authority. `CG-NCSP-3.1.0` is evaluated only in `SHADOW` or `SIMULATION` and remains a DRAFT with no publication timestamp or activation.

| Pipeline | Version pin | Persisted evidence | Immutability / authority check |
|---|---|---|---|
| Single-case preview API | Explicit `ruleVersionId` required for V2 | Result returns checksum, matched rules, path, missing facts, reviewer boundary and sources | Request cannot contain both input representations; draft is simulation only. |
| Manual wizard completion | Shadow version resolved once at completion | V2 snapshot and linked `RuleEvaluation` stored; wizard keeps legacy decision JSON | OCP/STI/treatment and examination completion are not inferred. |
| Batch import/processing | One shadow version pinned to `BatchRun` | Each row stores a linked evaluation; run stores display version and checksum | No row re-resolves a version mid-run. |
| Batch persistence | Pinned version passed to every row | Mode, input, path, matches, sources, missing facts, reviewer requirement and legacy comparison | Evaluation rows are append-only. |
| Review Queue | Loads persisted evaluation | Shows provenance, missing/conflicting facts, legacy decision and canonical shadow | Explicit correction creates linked evaluation; completed items are rejected. |
| Completed decision | Retains its original review item and evaluation link | Provenance is displayed in decision-package preview | No completed decision is silently rewritten or regraded. |
| Simulated exports | Uses stored batch/evaluation pins | CSV/JSON/FHIR-like/HL7 packages include canonical shadow rules/path/checksum separately | Package remains simulated and reviewer-confirmed; formula cells are neutralized. |
| Explicit regrade | Caller selects target version and gives reason | New evaluation links to prior evaluation | Prior evaluation remains immutable. |

## Synthetic coverage

The V2-native 179-case corpus covers exit testing age 70–74, unknown immune status, missing sample type, invalid/unsuitable HPV, first/second unsatisfactory cytology, Figure 4 immune routing, both former Figure 5 ambiguity states, Figure 6 treatment-date and longitudinal low-grade states, CIN2 surveillance, AIS clear margins, cancer overlays, all six Table 1 history groups and 21 combinations, vault Test of Cure, pregnancy malignant cytology/postpartum follow-up, and the four required bleeding states.

Focused evidence includes canonical API contract tests, 179-case successor tests, batch contract tests, simulated package provenance tests, lifecycle/database constraint tests and the 18 persisted input-gap simulations. Full suite and clean-checkout results are recorded separately in the release-hardening clean-checkout report.

No active version was created, no production authority changed, and no live or completed record was regraded.
