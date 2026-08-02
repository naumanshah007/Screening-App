# Legacy and canonical shadow comparison

Generated 2026-08-02. The legacy engine remains authoritative. The canonical `CG-NCSP-3.0.0` revision-3 snapshot is an unactivated draft used only for simulation and shadow evidence.

## Result

Four source-derived high-risk comparisons are locked into executable tests. All four deliberately differ from the current legacy result. The tests fail if a difference silently disappears, ensuring that divergence requires an explicit review rather than being hidden by a passing aggregate.

| Shadow case | Canonical draft | Current legacy result | Disposition |
|---|---|---|---|
| Age 72 exit test, HPV 16/18 detected, LBC | `F3-16`: refer to colposcopy | `AGE-70-74-DEFERRED`: defer exit and offer final screen | Retain mismatch; independently review before any cutover |
| HPV not detected, immune status not verified | Stop automated routing for missing governed information | `F3-HPV-NOT-DETECTED-5Y` | Retain mismatch; legacy false flag must not prove immune competence |
| Active Test of Cure, negative co-test, no treatment date | `F6-12`: do not issue terminal ToC disposition; request records | `F6-FIRST-NEGATIVE-REPEAT-12M` with treatment date only listed as missing | Retain mismatch; treatment anchor is a safety prerequisite |
| Pregnancy with SCC cytology | `F9-14`: urgent experienced colposcopy and oncology/MDT assessment | `F9-QUALIFYING-CYTOLOGY-REQUIRED`: insufficient pathway information | Retain mismatch; malignant route must outrank ordinary pregnancy routing |

Canonical expected outcomes come from the verified v2.1 source package. Legacy outputs are recorded only after those expectations are fixed.

## Historical baseline retained

The independent legacy parity audit remains unchanged because production logic was not modified:

- 599 clinical-conformance tests: 475 pass, 124 retained failures.
- 179 current-source terminal branches with source-derived probes.
- 91/179 (50.8%) strict exact or action-equivalent branch coverage.
- 123/179 (68.7%) coarse golden-action agreement.
- 4 CRITICAL and 16 HIGH consolidated confirmed defects (`AUD-001` through `AUD-020`).

The new Rule Studio suite is separate evidence: 638/638 tests pass, including 462 governed executable case IDs and the four direct shadow comparisons. Passing the draft suite does not close the legacy failures or prove end-to-end parity.

## Authority and persistence boundary

- Wizard and batch production decisions continue to use the legacy engine result as the displayed authority.
- Canonical evaluations are limited to `SHADOW` or `SIMULATION` unless a separately governed active version exists.
- Shadow traces retain ruleset ID, version ID, display version, checksum, engine version, matched rule IDs, branch path, source references, provisional recommendation, and the legacy comparison.
- Every canonical result requires reviewer confirmation; clinician-only branches cannot autonomously finalise.
- No existing decision, evaluation snapshot, schema history, or production clinical result was rewritten for this comparison.

## Cutover implication

There is no cutover recommendation. Each mismatch needs independent clinical disposition, the remaining source-text rules need an explicit governance decision, and end-to-end source-parity evidence must be rerun before publication or activation can even be considered.

