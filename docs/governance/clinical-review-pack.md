# CG-NCSP clinical governance review pack

Prepared for the named clinical approvers, risk owner and activation operators who must record the decisions below. **Nothing in this document is an approval.** Every decision field is empty and is completed inside CerviGrade, where it is bound to an authenticated identity, to the draft successor's revision, and to its exact content checksum.

## Before any decision can be recorded

Clinical interpretations may only be recorded against a **draft successor**. The server refuses anything else: *"Governance interpretation may only revise a draft successor."* CG-NCSP-3.1.0 is ACTIVE and is deciding new cases, so it cannot carry the register.

1. Open **Rule Studio** and clone CG-NCSP-3.1.0 into a new draft, choosing the version
   identifier and change summary — both are written to the permanent audit trail under
   the identity of whoever performs the clone.
2. Open **Governance**. The approval centre resolves the newest draft automatically and
   will then address the successor rather than the active version.
3. Work through the clinical interpretations, then the activation gates.

Two constraints apply throughout, and both are enforced by the server:

- **A proposer cannot approve their own interpretation.** Two distinct authenticated
  clinical approvers are required.
- **Decisions are bound to the draft's checksum.** Editing the draft's content after a
  decision invalidates that decision; it does not silently carry over.

Decisions recorded by demonstration accounts are marked as demonstration attestations and are excluded from real activation gates.

## Part A — Clinical interpretations (16)

Each case is a point where the source guidance admits more than one reading, and a
named clinician must decide which reading the governed rules will carry.

Available dispositions:

- `SOURCE_SUPPORTS_OPTION_A`
- `SOURCE_SUPPORTS_OPTION_B`
- `KEEP_GOVERNANCE_STOP`
- `REQUIRE_EXTERNAL_CLINICAL_ADVICE`
- `RULEBOOK_CORRECTION_REQUIRED`
- `ORACLE_CORRECTION_REQUIRED`

### 1. Confirmed ASC-H: excision considered versus observation

`F5-CONFIRMED-ASC-H-TREATMENT-RECOMMENDED`

| | |
|---|---|
| **Source** | Figure 5; primary prose p46/PDF 48; figure p47/PDF 49 |
| **Recommendations** | R6.08, R6.09 |
| **Figure branch** | Confirmed ASC-H → treatment decision |
| **Affected rules** | F5-01, F5-04 |
| **Affected tests** | CV2-F5-CONFIRMED-ASC-H-TREATMENT-RECOMMENDED |

**What the source says.** Figure 5 and R6.08–R6.09 preserve specialist choice: diagnostic excision is considered and observation remains available after informed discussion.

**What the current comparison oracle does.** The comparison oracle collapses the branch to a deterministic treatment terminal.

**What the governed rules do.** F5-01/F5-04 retain MDM review and the documented specialist choice between diagnostic excision and observation.

**The competing interpretation.** A deterministic treatment terminal versus a specialist decision in which diagnostic excision is considered and observation remains available.

**Proposed final behaviour.** Adopt the governed Figure 5 branch and correct the oracle; never auto-finalise treatment.

**Safety impact.** Prevents autonomous treatment selection while preserving escalation and specialist review.

**Effect on pathways.** Keeps treatment selection and completion as separately recorded facts and prevents autonomous treatment finalisation.

**Test evidence.** CV2-F5-CONFIRMED-ASC-H-TREATMENT-RECOMMENDED; governed snapshot validation and source-verification suites.

**Disposition supported by the source analysis:** `ORACLE_CORRECTION_REQUIRED`

> This is the engineering reading of the source, not a clinical decision.
> It carries no weight in the ledger until a named approver records it.

| Approver decision | |
|---|---|
| Disposition | _(to be recorded in the app)_ |
| Reviewer comments | _(minimum 10 characters, recorded in the app)_ |
| Approver | _(authenticated identity, recorded in the app)_ |
| Date | _(recorded in the app)_ |

---

### 2. Figure 5 observation: co-test surveillance provenance

`F5-TREATMENT-DEFERRED-HPV-NOT-DETECTED-TOC`

| | |
|---|---|
| **Source** | Figure 5; primary prose p46/PDF 48; figure p47/PDF 49 |
| **Recommendations** | R6.09 |
| **Figure branch** | Observation → reassuring six-month result → repeat co-test |
| **Affected rules** | F5-05, F5-08 |
| **Affected tests** | CV2-F5-TREATMENT-DEFERRED-HPV-NOT-DETECTED-TOC |

**What the source says.** Figure 5 and R6.09 define a two-stage co-test surveillance sequence after observation without implying prior treatment.

**What the current comparison oracle does.** The comparison oracle routes the reassuring result into ordinary post-treatment Test of Cure.

**What the governed rules do.** F5-05/F5-08 preserve Figure 5 surveillance provenance and require the subsequent reassuring co-test before regular screening.

**The competing interpretation.** Ordinary post-treatment Figure 6 Test of Cure versus Figure 5 specialist co-testing surveillance without inferred prior treatment.

**Proposed final behaviour.** Adopt the governed Figure 5 surveillance sequence and correct the oracle.

**Safety impact.** Avoids fabricating a treatment history and prevents premature return to routine screening.

**Effect on pathways.** Preserves the two-stage negative sequence and Figure 5 provenance; it does not fabricate treatment or a treatment date.

**Test evidence.** CV2-F5-TREATMENT-DEFERRED-HPV-NOT-DETECTED-TOC; longitudinal sequence and source-verification tests.

**Disposition supported by the source analysis:** `ORACLE_CORRECTION_REQUIRED`

> This is the engineering reading of the source, not a clinical decision.
> It carries no weight in the ledger until a named approver records it.

| Approver decision | |
|---|---|
| Disposition | _(to be recorded in the app)_ |
| Reviewer comments | _(minimum 10 characters, recorded in the app)_ |
| Approver | _(authenticated identity, recorded in the app)_ |
| Date | _(recorded in the app)_ |

---

### 3. Test of Cure: first versus second consecutive low-grade result

`F6-18M-HPV-NOT-DETECTED-LOW-GRADE-REPEAT`

| | |
|---|---|
| **Source** | R8.06–R8.08 p55/PDF 57; Figure 6 p56/PDF 58 |
| **Recommendations** | R8.06, R8.07, R8.08 |
| **Figure branch** | HPV not detected → low-grade cytology → sequence count |
| **Affected rules** | F6-07, F6-09, F6-14 |
| **Affected tests** | CV2-F6-18M-HPV-NOT-DETECTED-LOW-GRADE-REPEAT |

**What the source says.** R8.06–R8.08 and Figure 6 distinguish a first low-grade result from two consecutive low-grade results.

**What the current comparison oracle does.** The comparison oracle can collapse the first and second consecutive low-grade states.

**What the governed rules do.** F6-07/F6-09/F6-14 require longitudinal sequence evidence before colposcopy is selected.

**The competing interpretation.** Repeat after a first low-grade result versus colposcopy once two consecutive low-grade results are recorded.

**Proposed final behaviour.** Adopt the governed sequence-aware branch and correct the oracle.

**Safety impact.** Prevents premature escalation after a first result and under-escalation after a confirmed second consecutive result.

**Effect on pathways.** Requires longitudinal sequence evidence and prevents a first low-grade result from being collapsed into the second-consecutive branch.

**Test evidence.** CV2-F6-18M-HPV-NOT-DETECTED-LOW-GRADE-REPEAT; Figure 6 sequence and conformance tests.

**Disposition supported by the source analysis:** `ORACLE_CORRECTION_REQUIRED`

> This is the engineering reading of the source, not a clinical decision.
> It carries no weight in the ledger until a named approver records it.

| Approver decision | |
|---|---|
| Disposition | _(to be recorded in the app)_ |
| Reviewer comments | _(minimum 10 characters, recorded in the app)_ |
| Approver | _(authenticated identity, recorded in the app)_ |
| Date | _(recorded in the app)_ |

---

### 4. HPV Other with cytology pending: sample type routing

`ROUTER-002`

| | |
|---|---|
| **Source** | Figure 3; LEGACY-006 evidence register |
| **Recommendations** | F3-SAMPLE-TYPE-REQUIRED |
| **Figure branch** | HPV Other → no cytology result → sample type unknown |
| **Affected rules** |  |
| **Affected tests** | source-router-regression: missing sample type, figure3 baseline regression |

**What the source says.** Determine whether the sample was clinician-taken or self-collected before asking for cytology or arranging a return visit.

**What the current comparison oracle does.** Previously requested cytology even when an unknown sample could have been self-collected and unable to produce cytology.

**What the governed rules do.** Stops for the missing sample-type fact before selecting the within-pathway recommendation.

**The competing interpretation.** Keep the historical default that assumes cytology is obtainable.

**Proposed final behaviour.** Approve the scoped router correction: request sample type only on the HPV Other/cytology-pending branch.

**Safety impact.** Neutral-to-safer clarification; never delays a known high-grade result and never changes HPV-not-detected recall.

**Effect on pathways.** Figure 3 routing only; no governed recommendation changes.

**Test evidence.** Three focused router probes plus the complete engine and semantic conformance suites pass.

**Disposition supported by the source analysis:** `SOURCE_SUPPORTS_OPTION_A`

> This is the engineering reading of the source, not a clinical decision.
> It carries no weight in the ledger until a named approver records it.

| Approver decision | |
|---|---|
| Disposition | _(to be recorded in the app)_ |
| Reviewer comments | _(minimum 10 characters, recorded in the app)_ |
| Approver | _(authenticated identity, recorded in the app)_ |
| Date | _(recorded in the app)_ |

---

### 5. Pregnancy with malignant squamous cytology routes to Figure 9

`ROUTER-003`

| | |
|---|---|
| **Source** | Figure 9; R11.07–R11.09; malignant-cytology classification |
| **Recommendations** | F9-INITIAL-COLPOSCOPY, F9-14 |
| **Figure branch** | Pregnancy + SCC cytology |
| **Affected rules** | F9-14 |
| **Affected tests** | source-router-regression: pregnancy SCC escalation, PREGNANCY-MALIGNANT-CYTOLOGY |

**What the source says.** Malignant cytology in pregnancy requires urgent experienced colposcopy and oncology/MDT assessment as appropriate.

**What the current comparison oracle does.** Before correction, SCC missed the Figure 9 gate and fell through to an HPV-information request; it now routes to Figure 9 and P1 colposcopy.

**What the governed rules do.** F9-14 adds urgent experienced colposcopy and explicit oncology/MDT assessment as appropriate.

**The competing interpretation.** Treat SCC as outside the pregnancy pathway until HPV is supplied.

**Proposed final behaviour.** Approve the router correction independently; adjudicate the remaining oncology/MDT action in the separate F9-14 card.

**Safety impact.** Strictly more urgent than the historical under-escalation; the remaining MDT element is not silently claimed as closed.

**Effect on pathways.** Legacy pathway selection only; canonical F9-14 remains a distinct approval.

**Test evidence.** Unconditional SCC router regression passes; the narrowed F9-14 divergence remains explicitly asserted.

**Disposition supported by the source analysis:** `SOURCE_SUPPORTS_OPTION_A`

> This is the engineering reading of the source, not a clinical decision.
> It carries no weight in the ledger until a named approver records it.

| Approver decision | |
|---|---|
| Disposition | _(to be recorded in the app)_ |
| Reviewer comments | _(minimum 10 characters, recorded in the app)_ |
| Approver | _(authenticated identity, recorded in the app)_ |
| Date | _(recorded in the app)_ |

---

### 6. Age at Figure 3 baseline is not a routing defect

`ROUTER-001`

| | |
|---|---|
| **Source** | Figure 3 baseline and first-repeat age branch |
| **Recommendations** | F3-FIRST-REPEAT-AGE-REQUIRED |
| **Figure branch** | Baseline versus FIRST_REPEAT age dependency |
| **Affected rules** |  |
| **Affected tests** | source-router-regression: baseline age independence, source-router-regression: first-repeat age required |

**What the source says.** The ≥50-year fork applies at FIRST_REPEAT, not at baseline.

**What the current comparison oracle does.** Baseline is age-independent; FIRST_REPEAT already stops when age is absent.

**What the governed rules do.** The governed pathway uses age only at the source-defined branch point.

**The competing interpretation.** Add an age prompt at baseline despite no source-defined fork.

**Proposed final behaviour.** Record ROUTER-001 as NOT A DEFECT; make no clinical engine change.

**Safety impact.** Avoids adding an unsupported prompt while pinning the real age-dependent branch.

**Effect on pathways.** No runtime change.

**Test evidence.** Separate baseline and FIRST_REPEAT regressions pass with no todo tests.

**Disposition supported by the source analysis:** `SOURCE_SUPPORTS_OPTION_A`

> This is the engineering reading of the source, not a clinical decision.
> It carries no weight in the ledger until a named approver records it.

| Approver decision | |
|---|---|
| Disposition | _(to be recorded in the app)_ |
| Reviewer comments | _(minimum 10 characters, recorded in the app)_ |
| Approver | _(authenticated identity, recorded in the app)_ |
| Date | _(recorded in the app)_ |

---

### 7. Pregnancy malignant cytology: oncology/MDT action

`F9-14-ONCOLOGY-MDT`

| | |
|---|---|
| **Source** | NCSP June 2023 v1.1 R11.07–R11.09; Figure 9 |
| **Recommendations** | F9-14 |
| **Figure branch** | Pregnancy + cytology suspicious/definite invasive cancer |
| **Affected rules** | F9-14 |
| **Affected tests** | PREGNANCY-MALIGNANT-CYTOLOGY, F9-14 governed rule validation |

**What the source says.** Urgent experienced colposcopy and oncology/MDT assessment as appropriate; do not defer to routine postpartum review.

**What the current comparison oracle does.** After ROUTER-003, routes urgently to P1 colposcopy but does not encode the oncology/MDT element.

**What the governed rules do.** F9-14 explicitly includes oncology/MDT assessment as appropriate.

**The competing interpretation.** Colposcopy referral alone is sufficient until diagnosis is confirmed.

**Proposed final behaviour.** Prefer F9-14 as written, subject to a clinician confirming the operational trigger and ownership for oncology/MDT.

**Safety impact.** Potentially closes a residual under-specification in a malignant-cytology pathway; requires a genuine clinical signature.

**Effect on pathways.** Figure 9 within-pathway recommendation and downstream referral workflow.

**Test evidence.** The divergence is intentionally retained and asserted; no adapter invents the MDT action.

**Disposition supported by the source analysis:** `REQUIRE_EXTERNAL_CLINICAL_ADVICE`

> This is the engineering reading of the source, not a clinical decision.
> It carries no weight in the ledger until a named approver records it.

| Approver decision | |
|---|---|
| Disposition | _(to be recorded in the app)_ |
| Reviewer comments | _(minimum 10 characters, recorded in the app)_ |
| Approver | _(authenticated identity, recorded in the app)_ |
| Date | _(recorded in the app)_ |

---

### 8. Cytology pending must remain an explicit safety stop

`LEGACY-005`

| | |
|---|---|
| **Source** | Figure 3; legacy defect register LEGACY-005 |
| **Recommendations** | F3-CYTOLOGY-PENDING-INCOMPLETE |
| **Figure branch** | HPV result present + cytology pending/incomplete |
| **Affected rules** |  |
| **Affected tests** | legacy-defect-regression LEGACY-005, missing-information conformance |

**What the source says.** Do not issue a terminal recommendation until the pathway-defining cytology information is available.

**What the current comparison oracle does.** Returns an incomplete-result outcome but historically collapses distinct missing states.

**What the governed rules do.** Produces an explicit fail-safe safety stop with missing-information provenance.

**The competing interpretation.** Preserve the less explicit incomplete-result handling.

**Proposed final behaviour.** Adopt the canonical safety stop for new cases; separately decide whether the historic cohort needs review.

**Safety impact.** More conservative; prevents a recommendation from incomplete evidence.

**Effect on pathways.** Figure 3 only; no retrospective regrade without policy approval.

**Test evidence.** Registered high-severity defect and missing-fact safety-stop tests pass.

**Disposition supported by the source analysis:** `SOURCE_SUPPORTS_OPTION_A`

> This is the engineering reading of the source, not a clinical decision.
> It carries no weight in the ledger until a named approver records it.

| Approver decision | |
|---|---|
| Disposition | _(to be recorded in the app)_ |
| Reviewer comments | _(minimum 10 characters, recorded in the app)_ |
| Approver | _(authenticated identity, recorded in the app)_ |
| Date | _(recorded in the app)_ |

---

### 9. Figure 5 treatment-deferred HPV-detected surveillance

`LEGACY-014`

| | |
|---|---|
| **Source** | Figure 5; R6.09; legacy defect register LEGACY-014 |
| **Recommendations** | F5-07 |
| **Figure branch** | Treatment deferred + HPV detected + normal cytology/colposcopy |
| **Affected rules** | F5-07 |
| **Affected tests** | legacy-defect-regression LEGACY-014, Figure 5 conformance |

**What the source says.** Continue specialist Figure 5 surveillance with repeat colposcopy, HPV and cytology.

**What the current comparison oracle does.** Returns a legacy 12-month code that the independent comparison cannot map cleanly.

**What the governed rules do.** F5-07 retains specialist surveillance and does not infer completed treatment.

**The competing interpretation.** Retain the legacy coded 12-month outcome as clinically equivalent.

**Proposed final behaviour.** Prefer F5-07, subject to confirmation that the surveillance interval and service ownership match local clinical practice.

**Safety impact.** Prevents pathway provenance loss; timing remains a signed clinical-policy question.

**Effect on pathways.** Figure 5 surveillance and timing.

**Test evidence.** Difference remains classified and cannot silently pass as equivalent.

**Disposition supported by the source analysis:** `REQUIRE_EXTERNAL_CLINICAL_ADVICE`

> This is the engineering reading of the source, not a clinical decision.
> It carries no weight in the ledger until a named approver records it.

| Approver decision | |
|---|---|
| Disposition | _(to be recorded in the app)_ |
| Reviewer comments | _(minimum 10 characters, recorded in the app)_ |
| Approver | _(authenticated identity, recorded in the app)_ |
| Date | _(recorded in the app)_ |

---

### 10. Confirmed AG2 with no visible lesion: specialist investigation

`LEGACY-017`

| | |
|---|---|
| **Source** | Figure 7 glandular pathway; legacy defect register LEGACY-017 |
| **Recommendations** | F7-05 |
| **Figure branch** | No lesion + confirmed AG2 |
| **Affected rules** | F7-05 |
| **Affected tests** | legacy-defect-regression LEGACY-017, Figure 7 conformance |

**What the source says.** Investigate other gynaecological malignancies under specialist direction.

**What the current comparison oracle does.** Routes to a generic gynaecology investigation outcome.

**What the governed rules do.** F7-05 makes the malignancy-investigation intent explicit.

**The competing interpretation.** Treat the generic legacy destination as fully sufficient.

**Proposed final behaviour.** Prefer the governed F7-05 wording; clinician to confirm the receiving service and operational referral action.

**Safety impact.** Clarifies cancer investigation intent without autonomously diagnosing or selecting treatment.

**Effect on pathways.** Figure 7 specialist destination.

**Test evidence.** Difference is registered; Figure 7 source and semantic tests remain green.

**Disposition supported by the source analysis:** `REQUIRE_EXTERNAL_CLINICAL_ADVICE`

> This is the engineering reading of the source, not a clinical decision.
> It carries no weight in the ledger until a named approver records it.

| Approver decision | |
|---|---|
| Disposition | _(to be recorded in the app)_ |
| Reviewer comments | _(minimum 10 characters, recorded in the app)_ |
| Approver | _(authenticated identity, recorded in the app)_ |
| Date | _(recorded in the app)_ |

---

### 11. Pregnancy normal TZ with MDM-confirmed high grade

`LEGACY-026`

| | |
|---|---|
| **Source** | Figure 9; legacy defect register LEGACY-026 |
| **Recommendations** | F9 MDM review |
| **Figure branch** | Pregnancy + normal TZ + MDM confirms high-grade disease |
| **Affected rules** |  |
| **Affected tests** | legacy-defect-regression LEGACY-026, Figure 9 conformance |

**What the source says.** Pregnancy management remains specialist/MDM-led with high-grade disease explicitly carried forward.

**What the current comparison oracle does.** Returns an MDM review destination.

**What the governed rules do.** Also preserves specialist review but the comparison outcome is not yet mapped as a proven equivalence.

**The competing interpretation.** Treat both MDM labels as equivalent without independent validation.

**Proposed final behaviour.** Keep a governance stop until a clinician confirms the exact post-MDM action and timing; do not infer equivalence from labels.

**Safety impact.** Fail-safe; prevents an ambiguous pregnancy high-grade branch from being auto-finalised.

**Effect on pathways.** Figure 9 high-grade pregnancy branch.

**Test evidence.** The unmapped difference remains explicit and blocks affected-pathway activation.

**Disposition supported by the source analysis:** `KEEP_GOVERNANCE_STOP`

> This is the engineering reading of the source, not a clinical decision.
> It carries no weight in the ledger until a named approver records it.

| Approver decision | |
|---|---|
| Disposition | _(to be recorded in the app)_ |
| Reviewer comments | _(minimum 10 characters, recorded in the app)_ |
| Approver | _(authenticated identity, recorded in the app)_ |
| Date | _(recorded in the app)_ |

---

### 12. Stage 1A1 cervical cancer history input gap

`INPUT-GAP-STAGE-1A1`

| | |
|---|---|
| **Source** | NCSP cancer-history applicability guidance; input compatibility IN-01 |
| **Recommendations** | SAFETY_STOP |
| **Figure branch** | Cancer history where stage/treatment/applicability cannot be represented by the deployed intake contract |
| **Affected rules** |  |
| **Affected tests** | canonical facts v2 input representation, missing-information safety stop |

**What the source says.** Cancer stage, treatment and follow-up context determine whether NCSP screening guidance applies.

**What the current comparison oracle does.** The legacy input contract lacks the required cancer stage and treatment facts.

**What the governed rules do.** Stops safely rather than fabricating stage, treatment or NCSP applicability.

**The competing interpretation.** Infer applicability from the available generic cancer flags.

**Proposed final behaviour.** Keep the safety stop until a clinician approves the required intake facts and routing destination.

**Safety impact.** Fail-safe but creates manual workload; guessing could misroute cancer follow-up.

**Effect on pathways.** Cancer-history cases only; can remain scoped out of activation.

**Test evidence.** 18/18 states represented; this is one of two explicitly unresolved states and cannot silently evaluate.

**Disposition supported by the source analysis:** `REQUIRE_EXTERNAL_CLINICAL_ADVICE`

> This is the engineering reading of the source, not a clinical decision.
> It carries no weight in the ledger until a named approver records it.

| Approver decision | |
|---|---|
| Disposition | _(to be recorded in the app)_ |
| Reviewer comments | _(minimum 10 characters, recorded in the app)_ |
| Approver | _(authenticated identity, recorded in the app)_ |
| Date | _(recorded in the app)_ |

---

### 13. Non-cervical-cancer hysterectomy overlay input gap

`INPUT-GAP-NON-CERVICAL-HYSTERECTOMY`

| | |
|---|---|
| **Source** | Figure 8/Table 1 and cancer-history applicability guidance; input compatibility IN-01 |
| **Recommendations** | SAFETY_STOP |
| **Figure branch** | Post-hysterectomy + non-cervical gynaecological cancer history |
| **Affected rules** |  |
| **Affected tests** | canonical facts v2 input representation, Table 1 21-cell coverage |

**What the source says.** Vault follow-up depends on hysterectomy indication, cervix status, cancer type and specialist follow-up context.

**What the current comparison oracle does.** The deployed input contract cannot distinguish the full non-cervical-cancer overlay.

**What the governed rules do.** Stops for missing cancer-type/applicability facts and never fabricates an overlay.

**The competing interpretation.** Derive the overlay from hysterectomy indication alone.

**Proposed final behaviour.** Keep the safety stop until the fact contract and specialist routing are clinically approved.

**Safety impact.** Fail-safe; avoids inappropriate routine recall or cessation after cancer treatment.

**Effect on pathways.** Figure 8/Table 1 plus cancer follow-up.

**Test evidence.** Table 1 is 21/21 covered; this cross-pathway overlay remains deliberately unresolved.

**Disposition supported by the source analysis:** `REQUIRE_EXTERNAL_CLINICAL_ADVICE`

> This is the engineering reading of the source, not a clinical decision.
> It carries no weight in the ledger until a named approver records it.

| Approver decision | |
|---|---|
| Disposition | _(to be recorded in the app)_ |
| Reviewer comments | _(minimum 10 characters, recorded in the app)_ |
| Approver | _(authenticated identity, recorded in the app)_ |
| Date | _(recorded in the app)_ |

---

### 14. Canonical timing and clinician-determined dates

`TIMING-POLICY`

| | |
|---|---|
| **Source** | Governed timing census; activation readiness GOV-04 evidence |
| **Recommendations** | 20/203 auto-schedulable, 183/203 clinician/external anchor |
| **Figure branch** | All recall-producing pathways |
| **Affected rules** |  |
| **Affected tests** | timing classification report, adapter interval safety tests, null-recall monitoring |

**What the source says.** Use an exact machine date only where the governed source provides an unambiguous interval and anchor; otherwise require clinician determination.

**What the current comparison oracle does.** Often supplies a recall interval through legacy recommendation codes and local workflow assumptions.

**What the governed rules do.** Only 20 of 203 rules permit machine scheduling; the remainder stop for clinician or external-anchor determination.

**The competing interpretation.** Infer dates from narrative or preserve every legacy interval automatically.

**Proposed final behaviour.** Approve explicit clinician-determined timing as the default and numeric monitoring thresholds before activation; never silently coerce prose into dates.

**Safety impact.** Fail-safe but materially increases clinical workload and can delay recall if capacity is insufficient.

**Effect on pathways.** Recall generation, notifications, overdue analytics and reviewer workload.

**Test evidence.** Timing census: 18 exact + 2 range = 20/203; adapter parse failures and null recall are monitored rollback signals.

**Disposition supported by the source analysis:** `REQUIRE_EXTERNAL_CLINICAL_ADVICE`

> This is the engineering reading of the source, not a clinical decision.
> It carries no weight in the ledger until a named approver records it.

| Approver decision | |
|---|---|
| Disposition | _(to be recorded in the app)_ |
| Reviewer comments | _(minimum 10 characters, recorded in the app)_ |
| Approver | _(authenticated identity, recorded in the app)_ |
| Date | _(recorded in the app)_ |

---

### 15. Historical cohort and regrade policy

`REGRADE-POLICY`

| | |
|---|---|
| **Source** | Historical decision policy HIST-03; 26-defect register |
| **Recommendations** | NEW CASES ONLY, NO AUTOMATIC RETROSPECTIVE REGRADE |
| **Figure branch** | Existing evaluated cases across affected legacy pathways |
| **Affected rules** |  |
| **Affected tests** | authority pinning, append-only evaluation, explicit regrade provenance |

**What the source says.** Clinical history and the originally applied engine/ruleset must remain immutable; any look-back is a separate governed safety action.

**What the current comparison oracle does.** Existing cases retain their recorded decision; 22 of 26 classified differences are corrected prospectively by canonical.

**What the governed rules do.** New cases can use canonical authority while existing evaluated cases remain pinned; explicit regrade creates a new immutable evaluation.

**The competing interpretation.** Bulk regrade all historical cases or silently replace prior decisions.

**Proposed final behaviour.** Activate for new cases only, with no automatic retrospective regrade; require a signed cohort/look-back and safety-netting policy for any historical review.

**Safety impact.** Preserves provenance but requires a deliberate decision about participants affected by more-urgent canonical corrections.

**Effect on pathways.** All existing evaluated cases and any future safety-netting cohort.

**Test evidence.** DB-backed pinning, rollback and append-only history suites pass; zero historical overwrite paths are permitted.

**Disposition supported by the source analysis:** `SOURCE_SUPPORTS_OPTION_A`

> This is the engineering reading of the source, not a clinical decision.
> It carries no weight in the ledger until a named approver records it.

| Approver decision | |
|---|---|
| Disposition | _(to be recorded in the app)_ |
| Reviewer comments | _(minimum 10 characters, recorded in the app)_ |
| Approver | _(authenticated identity, recorded in the app)_ |
| Date | _(recorded in the app)_ |

---

### 16. Canonical operating point and reviewer capacity

`GOV-04`

| | |
|---|---|
| **Source** | 179-case semantic corpus and 203-rule timing census |
| **Recommendations** | 152/179 clinicianOnly, 20/203 auto-schedulable |
| **Figure branch** | All governed within-pathway recommendations |
| **Affected rules** |  |
| **Affected tests** | 179-case conformance corpus, monitoring aggregate tests, timing census |

**What the source says.** Ambiguous, missing, externally anchored or specialist-only decisions remain under clinician control.

**What the current comparison oracle does.** Provides higher automation through legacy codes and assumptions not always present in the governed source.

**What the governed rules do.** Requires clinician-only handling in 152/179 corpus cases, with 99 over-restrictions and 0 under-restrictions against the source oracle.

**The competing interpretation.** Activate without a numeric capacity threshold because the direction is conservative.

**Proposed final behaviour.** Risk owner must sign the acceptable clinician-only/safety-stop operating point, staffing capacity and numeric rollback thresholds before activation.

**Safety impact.** Fail-safe direction with a substantial workload and timeliness risk if the operating point exceeds reviewer capacity.

**Effect on pathways.** All canonical-authoritative cases and post-activation monitoring.

**Test evidence.** 152/179 clinician-only; oracle 53/179; 99 over-restrictions; 0 under-restrictions; 20/203 machine-schedulable rules.

**Disposition supported by the source analysis:** `REQUIRE_EXTERNAL_CLINICAL_ADVICE`

> This is the engineering reading of the source, not a clinical decision.
> It carries no weight in the ledger until a named approver records it.

| Approver decision | |
|---|---|
| Disposition | _(to be recorded in the app)_ |
| Reviewer comments | _(minimum 10 characters, recorded in the app)_ |
| Approver | _(authenticated identity, recorded in the app)_ |
| Date | _(recorded in the app)_ |


## Part B — Operational activation gates (11)

These are accountability decisions rather than clinical readings. Several name a
specific accountable person and cannot be satisfied by engineering evidence alone.

### 1. Clinical interpretation register

`GOV-01`

**Question to answer.** Have all mandatory clinical interpretation cards been adjudicated?

| | |
|---|---|
| **Evidence available** | Governance review ledger and source-backed differential evidence. |
| **Proposed decision** | Require every displayed clinical card to carry an approved disposition. |
| **Safety impact** | Prevents unresolved source interpretation from becoming live authority. |
| **Pathway** | All governed pathways |
| **Supporting tests** | Governance review and semantic conformance suites |
| **Engineering status** | ENFORCED |
| **Who may record it** | ADMIN |

| Owner decision | |
|---|---|
| Decision | _(APPROVE / REJECT / REQUEST CHANGE — recorded in the app)_ |
| Comments | _(minimum 10 characters, recorded in the app)_ |
| Accountable owner | _(authenticated identity, recorded in the app)_ |

---

### 2. Independent clinical approvals

`GOV-02`

**Question to answer.** Have two different clinical approvers approved the final validated checksum?

| | |
|---|---|
| **Evidence available** | APPROVAL events scoped to the current revision and checksum. |
| **Proposed decision** | Require two distinct authenticated approvers. |
| **Safety impact** | Provides independent clinical review of the release identity. |
| **Pathway** | All governed pathways |
| **Supporting tests** | Lifecycle separation-of-duty tests |
| **Engineering status** | ENFORCED |
| **Who may record it** | ADMIN |

| Owner decision | |
|---|---|
| Decision | _(APPROVE / REJECT / REQUEST CHANGE — recorded in the app)_ |
| Comments | _(minimum 10 characters, recorded in the app)_ |
| Accountable owner | _(authenticated identity, recorded in the app)_ |

---

### 3. Activation separation of duties

`GOV-03`

**Question to answer.** Is the activation operator different from both clinical approvers?

| | |
|---|---|
| **Evidence available** | Authenticated operator assignment and lifecycle actor checks. |
| **Proposed decision** | Require an ADMIN operator who is not either clinical approver. |
| **Safety impact** | Prevents one person from approving and activating the same clinical release. |
| **Pathway** | Production activation |
| **Supporting tests** | Activation separation-of-duty tests |
| **Engineering status** | ENFORCED |
| **Who may record it** | ADMIN |

| Owner decision | |
|---|---|
| Decision | _(APPROVE / REJECT / REQUEST CHANGE — recorded in the app)_ |
| Comments | _(minimum 10 characters, recorded in the app)_ |
| Accountable owner | _(authenticated identity, recorded in the app)_ |

---

### 4. Operating point and reviewer capacity

`GOV-04-OPERATING-POINT`

**Question to answer.** Is the reviewer capacity and safe operating point accepted?

| | |
|---|---|
| **Evidence available** | Current monitoring signals; no fabricated historical baseline. |
| **Proposed decision** | Begin with conservative rollback-on-first-failure controls and review after a signed pilot baseline. |
| **Safety impact** | Avoids exceeding reviewer capacity or silently tolerating unsafe stops. |
| **Pathway** | All review queues |
| **Supporting tests** | Monitoring and missing-information suites |
| **Engineering status** | IMPLEMENTED |
| **Who may record it** | ADMIN |

| Owner decision | |
|---|---|
| Decision | _(APPROVE / REJECT / REQUEST CHANGE — recorded in the app)_ |
| Comments | _(minimum 10 characters, recorded in the app)_ |
| Accountable owner | _(authenticated identity, recorded in the app)_ |

---

### 5. Rollback thresholds

`ROLLBACK-THRESHOLDS`

**Question to answer.** Does the risk owner approve the proposed T+0 rollback thresholds?

| | |
|---|---|
| **Evidence available** | Live monitoring counters and documented candidate values. |
| **Proposed decision** | Approve the candidate set shown below or request a change. |
| **Safety impact** | Creates an objective and auditable rollback boundary. |
| **Pathway** | Production monitoring |
| **Supporting tests** | Monitoring, activation, rollback and persistence suites |
| **Engineering status** | PROPOSED_REQUIRES_RISK_OWNER_APPROVAL |
| **Who may record it** | ADMIN |

| Owner decision | |
|---|---|
| Decision | _(APPROVE / REJECT / REQUEST CHANGE — recorded in the app)_ |
| Comments | _(minimum 10 characters, recorded in the app)_ |
| Accountable owner | _(authenticated identity, recorded in the app)_ |

---

### 6. Source licensing and redistribution

`LICENSING`

**Question to answer.** May the derived clinical artefacts be stored and rendered in CerviGrade?

| | |
|---|---|
| **Evidence available** | Internal JSON snapshots, generated graphs/views, source excerpts and public guideline representations are inventoried. |
| **Proposed decision** | Record APPROVED, NOT APPROVED, or REQUIRES LEGAL REVIEW. |
| **Safety impact** | Prevents unapproved redistribution while preserving clinical provenance. |
| **Pathway** | Guidelines and Rule Studio |
| **Supporting tests** | Source manifest and deterministic rebuild verification |
| **Engineering status** | TECHNICAL_INVENTORY_COMPLETE |
| **Who may record it** | ADMIN |

| Owner decision | |
|---|---|
| Decision | _(APPROVE / REJECT / REQUEST CHANGE — recorded in the app)_ |
| Comments | _(minimum 10 characters, recorded in the app)_ |
| Accountable owner | _(authenticated identity, recorded in the app)_ |

---

### 7. Residual security and operational risk

`RISK-ACCEPTANCE`

**Question to answer.** Has the accountable risk owner accepted or rejected the documented residual risk?

| | |
|---|---|
| **Evidence available** | Security suite, dependency audit, durability checks and rehearsal evidence. |
| **Proposed decision** | Approve only after reviewing the current evidence and exceptions. |
| **Safety impact** | Makes residual release risk explicit and attributable. |
| **Pathway** | Whole platform |
| **Supporting tests** | Security and database suites |
| **Engineering status** | EVIDENCE_AVAILABLE |
| **Who may record it** | ADMIN |

| Owner decision | |
|---|---|
| Decision | _(APPROVE / REJECT / REQUEST CHANGE — recorded in the app)_ |
| Comments | _(minimum 10 characters, recorded in the app)_ |
| Accountable owner | _(authenticated identity, recorded in the app)_ |

---

### 8. Historical credential exposure

`R6-CREDENTIAL`

**Question to answer.** Has the credential owner confirmed rotation/revocation or formally accepted the residual risk?

| | |
|---|---|
| **Evidence available** | No password is rendered or hard-coded; Production seeding fails closed. Historical password is never tested. |
| **Proposed decision** | Record post-exposure rotation/revocation evidence or formal acceptance. |
| **Safety impact** | Closes the remaining historical authentication exposure. |
| **Pathway** | Authentication |
| **Supporting tests** | 16 security regression tests |
| **Engineering status** | TECHNICAL_REMEDIATION_COMPLETE_OWNER_ATTESTATION_REQUIRED |
| **Who may record it** | ADMIN |

| Owner decision | |
|---|---|
| Decision | _(APPROVE / REJECT / REQUEST CHANGE — recorded in the app)_ |
| Comments | _(minimum 10 characters, recorded in the app)_ |
| Accountable owner | _(authenticated identity, recorded in the app)_ |

---

### 9. Activation Operator

`ACTIVATION-OPERATOR`

**Question to answer.** Who will execute the controlled Production activation?

| | |
|---|---|
| **Evidence available** | Selected authenticated ADMIN identity. |
| **Proposed decision** | Assign one operator distinct from both clinical approvers. |
| **Safety impact** | Creates accountable technical ownership for activation and rollback. |
| **Pathway** | Production activation |
| **Supporting tests** | Lifecycle actor-separation tests |
| **Engineering status** | ENFORCED |
| **Who may record it** | ADMIN |

| Owner decision | |
|---|---|
| Decision | _(APPROVE / REJECT / REQUEST CHANGE — recorded in the app)_ |
| Comments | _(minimum 10 characters, recorded in the app)_ |
| Accountable owner | _(authenticated identity, recorded in the app)_ |

---

### 10. Deputy Operator

`DEPUTY-OPERATOR`

**Question to answer.** Who is the distinct deputy for rollback coverage?

| | |
|---|---|
| **Evidence available** | Selected authenticated ADMIN identity. |
| **Proposed decision** | Assign a deputy different from the primary operator and clinical approvers. |
| **Safety impact** | Provides a second accountable rollback operator. |
| **Pathway** | Production activation |
| **Supporting tests** | Activation-gate tests |
| **Engineering status** | ENFORCED |
| **Who may record it** | ADMIN |

| Owner decision | |
|---|---|
| Decision | _(APPROVE / REJECT / REQUEST CHANGE — recorded in the app)_ |
| Comments | _(minimum 10 characters, recorded in the app)_ |
| Accountable owner | _(authenticated identity, recorded in the app)_ |

---

### 11. Shared activation and rollback rehearsal

`SHARED-REHEARSAL`

**Question to answer.** Has the complete rehearsal passed on a dedicated non-Production durable database?

| | |
|---|---|
| **Evidence available** | Recorded A–L observations, audit trail, immutable evaluations and measured RTO. |
| **Proposed decision** | Approve only after the shared rehearsal evidence is attached. |
| **Safety impact** | Demonstrates rollback and history preservation outside an isolated process. |
| **Pathway** | Validation environment |
| **Supporting tests** | Shared rehearsal plus isolated database suite |
| **Engineering status** | IMPLEMENTED_AWAITING_SHARED_INFRASTRUCTURE |
| **Who may record it** | ADMIN, INTEGRATION_ADMIN |

| Owner decision | |
|---|---|
| Decision | _(APPROVE / REJECT / REQUEST CHANGE — recorded in the app)_ |
| Comments | _(minimum 10 characters, recorded in the app)_ |
| Accountable owner | _(authenticated identity, recorded in the app)_ |


### Candidate rollback thresholds

Referenced by `ROLLBACK-THRESHOLDS` above. The risk owner approves this set or
requests a change.

| Signal | Candidate threshold |
|---|---|
| Canonical Evaluation Failure | 1 or more in any 15-minute window |
| Authority Resolver Failure | 1 or more in any 15-minute window |
| Urgent Disagreement | 1 or more unexplained events |
| Recommendation Reversal | 2 or more unexplained reversals in 24 hours |
| Clinician Override | Greater than 20% over 20 consecutive reviewed cases |
| Missing Information Failure | Any confident recommendation produced with a missing mandatory fact |
| Timing Ambiguity | Any machine-scheduled date from a clinician-timing-required rule |
| Persistence Failure | Any failed RuleEvaluation or audit write |


## What is not covered here

This pack covers the register and the gates. It does not authorise a Production
activation, and completing it does not perform one. Production activation is a
separate controlled step requiring an activation operator and a distinct deputy, both
different from the two clinical approvers.

_Generated from CLINICAL_GOVERNANCE_CASES (16) and ACTIVATION_GATE_DEFINITIONS (11) by `scripts/governance/build-review-pack.ts`. Regenerate after any change to those
definitions so the pack cannot describe a case differently from the ledger._
