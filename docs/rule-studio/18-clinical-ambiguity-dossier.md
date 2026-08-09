# Primary-source dossier for the three former ambiguities

All three cases are resolvable from the visually inspected figure plus the controlling recommendation prose. The successor models the source-supported decision state and never turns a recommendation, option or future action into a completed intervention.

## A. Confirmed ASC-H with Type 1/2 TZ and no visible lesion

- Case: `F5-CONFIRMED-ASC-H-TREATMENT-RECOMMENDED`
- Source: Figure 5; recommendations R6.08, R6.09; prose p46/PDF 48; figure p47/PDF 49.
- Prior conflict: The earlier oracle represented the figure label as a deterministic TREATMENT terminal.
- Disposition: `ORACLE_CORRECTION_REQUIRED`
- Source-supported model: SPECIALIST_TREATMENT_DECISION_REQUIRED; diagnostic excision considered, with observation available after informed specialist discussion.
- Must not infer: TREATMENT_SELECTED or treatment completed.

| Evidence view | Interpretation |
|---|---|
| Recommendation prose | R6.08 says diagnostic excision should be considered and expressly retains observation as an option. |
| Figure / sequence | R6.09 makes deferral conditional on an informed participant and a documented colposcopist-led observation plan. |
| Figure / sequence | The Figure 5 box 'Treatment recommended' abbreviates the prose and does not establish treatment completion. |
| Precedence check | The 2026 addendum and immune guidance do not supersede this decision point. |

Affected rules: `F5-01`, `F5-04`. Affected tests: `CV2-F5-CONFIRMED-ASC-H-TREATMENT-RECOMMENDED`.

Historical impact: Presentation and reviewer-boundary regrade may differ; no historical evaluation is rewritten. Interim safety stop required: **no**.

## B. Figure 5 observation after a reassuring six-month co-test

- Case: `F5-TREATMENT-DEFERRED-HPV-NOT-DETECTED-TOC`
- Source: Figure 5; recommendations R6.09; prose p46/PDF 48; figure p47/PDF 49.
- Prior conflict: The earlier oracle interpreted the figure label as ordinary post-treatment Figure 6 Test of Cure.
- Disposition: `ORACLE_CORRECTION_REQUIRED`
- Source-supported model: FIGURE_5_COTEST_SURVEILLANCE with Figure 5 provenance and a two-stage negative sequence.
- Must not infer: prior HSIL treatment, treatment date, or ordinary Figure 6 eligibility.

| Evidence view | Interpretation |
|---|---|
| Recommendation prose | R6.09 requires repeat HPV, cytology and colposcopy at six months after observation is selected. |
| Figure / sequence | If HPV is not detected, cytology is negative and the impression is unchanged, R6.09 requires another co-test in 12 months. |
| Figure / sequence | Only a second HPV-not-detected/negative co-test returns the participant to regular screening. |
| Precedence check | The Figure 5 'Test of Cure (co-testing)' label does not say that HSIL treatment occurred; the 2026 documents do not replace R6.09. |

Affected rules: `F5-05`, `F5-08`. Affected tests: `CV2-F5-TREATMENT-DEFERRED-HPV-NOT-DETECTED-TOC`.

Historical impact: A regrade may change provenance and sequence wording; the prior evaluation remains immutable. Interim safety stop required: **no**.

## C. Low-grade cytology during Test of Cure

- Case: `F6-18M-HPV-NOT-DETECTED-LOW-GRADE-REPEAT`
- Source: Figure 6; recommendations R8.06, R8.07, R8.08; prose p55/PDF 57; figure p56/PDF 58.
- Prior conflict: The earlier oracle did not distinguish a first low-grade result from the second consecutive low-grade result.
- Disposition: `ORACLE_CORRECTION_REQUIRED`
- Source-supported model: First HPV-negative low-grade cytology repeats co-testing; second consecutive low-grade cytology routes to colposcopy.
- Must not infer: that any single low-grade result automatically completes Test of Cure or always requires colposcopy.

| Evidence view | Interpretation |
|---|---|
| Recommendation prose | R8.07 sends any HPV-positive post-treatment result with negative/ASC-US/LSIL cytology to colposcopy. |
| Figure / sequence | For HPV-negative results, R8.07 requires colposcopy after two consecutive low-grade cytology results. |
| Figure / sequence | The Figure 6 arrows retain repeat co-testing for the first HPV-negative low-grade result. |
| Precedence check | R8.08 separately sends ASC-H/HSIL or glandular cytology to colposcopy regardless of HPV status. |

Affected rules: `F6-07`, `F6-09`, `F6-14`. Affected tests: `CV2-F6-18M-HPV-NOT-DETECTED-LOW-GRADE-REPEAT`.

Historical impact: A regrade may differ if consecutive-result provenance is present; missing sequence history remains a review stop. Interim safety stop required: **no**.

## Governance boundary

These evidence dispositions close the software/oracle ambiguity, but they do not publish or activate the successor. Independent governed clinical review of the source interpretation and generated tests remains the publication gate.
