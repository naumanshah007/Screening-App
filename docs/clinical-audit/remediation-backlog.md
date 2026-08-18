# CerviGrade clinical-parity remediation backlog

This backlog is evidence from the audit, not an implementation plan approved for clinical use. Production changes require clinical-owner sign-off, controlled rule releases, privacy/security review, and independent re-verification against the primary sources. The current product remains a proof of concept.

## Release gates

| Gate | Required evidence before the gate can pass |
|---|---|
| Conference demonstration | Synthetic/de-identified data only; every decision visibly labelled **“provisional recommendation — reviewer confirmation required — not for direct clinical action”**; critical failing examples excluded from any claim of accuracy; no live integration claim. |
| Begin formal clinical validation | Signed canonical oracle; zero unresolved critical safety defects; current addendum and immune guidance implemented; all required source facts representable; clinician-only states non-final; complete trace/version provenance; independent test review. |
| Pilot readiness | Formal validation completed; zero critical/high conformance defects; end-to-end UI/API/batch/persistence parity demonstrated; local operational priorities separately governed; privacy, security, usability, monitoring, rollback and incident-response controls approved. |

## 1. Critical safety defects

| Priority | Work item | Defects | Acceptance evidence |
|---|---|---|---|
| P0 | Correct router precedence so obtained abnormal results and symptomatic investigation cannot be intercepted by routine age eligibility. Replace unconditional age-75 discharge with exact-date, exit-test and history criteria. | AUD-003, AUD-018 | HPV 16/18 at every relevant age reaches colposcopy; symptoms always win; age-exit boundary tests include missing/abnormal history and exact birthdays; clinical-owner approval. |
| P0 | Preserve high-grade cytology when HPV is invalid or unsuitable; model HPV validity separately and apply source timing. | AUD-006, AUD-007 | Invalid/unsuitable + HSIL reaches colposcopy; invalid/unsuitable remain distinguishable; ASAP timing has no invented three-month delay; conflicting-result property tests pass. |
| P0 | Implement the six controlling 2026 post-gynaecological-cancer branches, including non-deterministic follow-up outside NCSP. | AUD-013 | Each addendum branch is representable, source-versioned, executable and separately tested; outside-NCSP cases hard-stop for clinician decision. |
| P0 | Add explicit recurrent/persistent postcoital bleeding, persistent unexplained intermenstrual bleeding and postmenopausal bleeding pathways. | AUD-005, AUD-014 | R15.02/R15.05/R15.06 golden, negative, missing-data and precedence tests pass; referral is never delayed for co-test/blood where prohibited. |

## 2. Source-governance ambiguities and rule ownership

| Priority | Work item | Defects | Acceptance evidence |
|---|---|---|---|
| P0 | Have the NCSP clinical owner review and sign the 179 canonical branch objects, the page map, supersession decisions and every clinician-only boundary. | all | Signed rule IDs and source snapshots; documented reviewer, date, version, rationale and unresolved ambiguity; no rule expectation derived from product code. |
| P0 | Publish one effective ruleset that explicitly applies 2026 R6.05, R8.03, R8.06, R9.14 and cancer-history updates over the 2023 base. | AUD-009–AUD-013 | Every decision carries effective source/version/recommendation/page; superseded 2023 branches are retained historically but cannot control new decisions. |
| P1 | Govern current immune-deficiency classification, including named exclusions, dose/duration thresholds, non-exhaustive medicine lists and case-by-case categories. | AUD-002, AUD-008 | Approved classification vocabulary and clinician-review rules; guidance version recorded on every interval decision. |
| P1 | Separate national destination/timeframe from local P1/P2/P3 booking policy. Obtain an approved local source before assigning priority. | AUD-019 | National recommendation is unchanged when local rules are absent; local priority has its own owner, version, effective date, trace and test suite. |
| P1 | Replace generic/inexact guideline citations with verifiable source references. | parity matrix | Recommendation displays and exports contain source title/version, printed page, PDF page and recommendation number or explicit source ambiguity. |

## 3. Data-model changes

| Priority | Work item | Defects | Acceptance evidence |
|---|---|---|---|
| P0 | Replace default-false clinical booleans with explicit tri-state or classified values where unknown changes the route. | AUD-001, AUD-002, AUD-008 | Database/API types distinguish unknown, negative and positive; migrations preserve unknown; no coercion path chooses routine recall. |
| P0 | Add structured HPV validity/unsuitable reason, cytology adequacy and combined-result provenance. | AUD-006, AUD-007 | Lab facts remain independent and contradictory/pending states cannot become a confident terminal output. |
| P0 | Model immutable Test-of-Cure episodes: treatment event/date, disease type, margin status, co-test events/dates, sequence, intervening abnormalities and reset state. | AUD-004, AUD-011, AUD-017 | ToC stage is derived from persisted events; no manual marker alone can complete ToC; two-negative sequence and intervals are proven. |
| P0 | Add cancer history, cancer type/stage, procedure, total/subtotal hysterectomy, specimen pathology, excision completeness and programme enrolment. | AUD-013 | All six addendum cancer-history branches and every Table 1/Figure 8 branch are representable without free-text inference. |
| P0 | Add bleeding chronology/type, episode count, persistence, menopausal status and source-authenticated examination/co-test facts. | AUD-005, AUD-014 | Single PCB, recurrent PCB, persistent IMB and PMB are distinguishable; missing facts remain unknown. |
| P1 | Add CIN2 active-surveillance episode data: age at diagnosis, TZ, reviewed histology, exclusion of CIN3/invasion, participant agreement, six-month reviews, biopsy outcomes and elapsed duration. | AUD-010 | Eligibility and all surveillance terminal branches can be reconstructed from dated evidence. |
| P1 | Add AIS excision and margin details and required 6/18-month follow-up events. | AUD-012 | Current R9.14 route and completion state are reconstructable. |
| P1 | Add tri-state in-utero DES exposure and evidence/provenance. | AUD-016 | DES is preserved through every channel and invokes an approved clinician-review pathway. |
| P1 | Calculate age from date of birth and the clinical event date, not an integer supplied to the engine or `365.25` approximation. | AUD-003, AUD-010, AUD-011, AUD-018 | Exact below/on/above birthday tests pass for 25, 50, 70 and 75, including leap-day births. |

## 4. API and batch changes

| Priority | Work item | Defects | Acceptance evidence |
|---|---|---|---|
| P0 | Remove default-false conversions and fabricated bleeding work-up fields from ingestion. | AUD-002, AUD-005, AUD-008, AUD-014 | Unknown remains unknown; each clinical fact has source/provenance; current failing batch-integrity tests pass without weakened assertions. |
| P0 | Extend API and canonical batch contracts for all fields listed in the data-model section; reject impossible combinations and preserve pending status. | AUD-006–AUD-014, AUD-016 | Schema-parity tests cover valid, missing, invalid and contradictory payloads; no lossy mapper. |
| P1 | Make single-case and batch decisions use the same canonical clinical input, effective rule version and national engine. Keep operational triage separately labelled. | AUD-020 | Identical canonical input/version produces identical national clinical output; divergence blocks acceptance and is audited. |
| P1 | Version all source mappings and reject unrecognised values instead of normalising them into a known category. | AUD-001, AUD-006, AUD-007 | Import report identifies source field/value, mapping version and rejection reason; no silent category collapse. |

## 5. UI changes

| Priority | Work item | Defects | Acceptance evidence |
|---|---|---|---|
| P0 | Capture required facts with explicit **Yes / No / Unknown / Pending** choices and do not preselect a clinical answer. | AUD-001, AUD-002, AUD-004, AUD-005, AUD-008, AUD-014, AUD-016 | UI reachability tests demonstrate every required fact and hard-stop; unknown is visible in result/review views. |
| P0 | Present clinician-only branches as work to be reviewed, never as autonomous final recommendations or bulk-acceptable ordinary cases. | AUD-010, AUD-013, AUD-015 | Controls require named authorised reviewer, evidence and confirmation; bulk action excludes unresolved clinician-only cases. |
| P1 | Add a source trace view: winning rule, excluded nearest neighbour, input facts, missing facts, controlling source/version, superseded source and local-priority layer. | AUD-019, AUD-020 | Reviewer can reproduce why the route won and distinguish national recommendation from local triage. |
| P1 | Improve longitudinal ToC and surveillance views to show dated event sequences instead of editable stage labels. | AUD-004, AUD-010, AUD-017 | UI sequence matches persisted events and exposes gaps/contradictions before completion. |

## 6. Persistence changes

| Priority | Work item | Defects | Acceptance evidence |
|---|---|---|---|
| P0 | Persist an immutable decision package containing raw source facts, normalised input, evidence/provenance, rule release, exact source citations, trace, missing facts, output, actor and timestamp. | AUD-001–AUD-020 | Historic decisions are byte-stable after rule updates; re-evaluation creates a linked new snapshot and a human-readable diff. |
| P0 | Persist longitudinal treatment, screening, colposcopy/biopsy/MDM and co-test events as linked evidence, not only counters or declared stages. | AUD-004, AUD-010–AUD-013, AUD-017 | Persistence tests reconstruct every branch from events and reject completion when an anchor or prior event is missing. |
| P1 | Record overrides with actor, role, timestamp, reason, source evidence, before/after decision and authorisation. | AUD-015, AUD-020 | Override audit is immutable and exported; unauthorised or reasonless overrides fail. |

## 7. Specialist workflow changes

| Priority | Work item | Defects | Acceptance evidence |
|---|---|---|---|
| P0 | Define explicit clinician-only outcomes for visible lesions, MDM/MDT review, histology/biopsy interpretation, suspected invasion, specialist treatment and outside-NCSP cancer follow-up. | AUD-010, AUD-013, AUD-015, AUD-016 | Every source-marked clinician-only branch returns `CLINICIAN_REVIEW_REQUIRED` (or equivalent non-final state) until a documented specialist action exists. |
| P0 | Prevent bulk acceptance or ordinary completion of cases with clinician-only, missing-information, external-history or stale-rule outcomes. | AUD-015, AUD-020 | Authorisation and negative tests cover review page, API and batch bulk actions. |
| P1 | Reconcile the national clinical engine with editable booking-triage rules and surface divergence. | AUD-019, AUD-020 | Both outputs retain separate versions/owners; any incompatible combination is reviewed before booking. |

## 8. Test infrastructure

| Priority | Work item | Acceptance evidence |
|---|---|---|
| P0 | Clinically review and freeze the independent 179-branch oracle, then generate a golden, nearest-neighbour and missing-critical-data test for every branch. | Oracle review signature; all 537 source tests run; no expected value is imported from production code. |
| P0 | Retain the failing audit tests as regression tests while remediation occurs; never weaken an assertion merely to obtain green status. | Each fixed defect changes product behaviour or data support and closes a signed defect; test source citation is unchanged. |
| P0 | Add exact threshold/interval suites using DOB plus event dates: birthdays, leap years, month-end, 6 weeks, 3/6/12/18 months, 24 months, 3/5 years. | Boundary tests demonstrate below/on/above semantics and calendar arithmetic. |
| P1 | Add mutation testing around router precedence, missing-data guards and ToC sequence logic. | Mutations that remove a safety guard or reorder a high-risk route are killed. |
| P1 | Add database-backed API/UI/browser tests and immutable-history tests in an isolated synthetic environment. | UI/API/batch/persistence/review/export coverage is independently measured and no clinical fact changes across a boundary. |
| P1 | Report ordinary code coverage and clinical branch coverage separately. | CI publishes both; line/branch coverage is never labelled clinical coverage. |

## 9. Demo wording

| Priority | Work item | Acceptance evidence |
|---|---|---|
| P0 | Display **“provisional recommendation — reviewer confirmation required — not for direct clinical action”** on every decision, review item, detail view and export. | Snapshot/browser/export tests verify exact wording. |
| P0 | Label data and exports **synthetic/de-identified**, **simulated export package**, and **integration-ready preview**; do not claim live integration. | Export and presentation review passes; no real patient data or production endpoint is used. |
| P0 | Do not state or imply “clinically validated”, “NCSP compliant”, “safe for autonomous use”, “pilot-ready” or equivalent. | Communications and demo script are reviewed against the current conformance report. |

## 10. Pilot-readiness work

| Priority | Work item | Acceptance evidence |
|---|---|---|
| P0 | Close all critical and high clinical-parity defects and rerun the complete independent suite. | Zero critical/high parity mismatches; no missing/unsupported critical input; signed results. |
| P0 | Complete formal clinical safety case, hazard log, clinical governance approval and independent validation. | Named accountable clinical owner and approved validation protocol/report. |
| P0 | Complete privacy, security, access-control, audit, retention, rollback, incident-response and change-control reviews. | Approved operational evidence and tested rollback/monitoring. |
| P1 | Conduct supervised usability testing across screen takers, colposcopy, gynaecology/oncology, laboratory, review and booking roles. | Critical tasks and hand-offs pass agreed human-factors criteria; clinician-only boundaries are understood. |
| P1 | Validate local workflows and priority rules separately at each proposed pilot site. | Site-owned versioned policy and end-to-end dry runs; national pathway remains unchanged. |

No backlog item authorises direct clinical use. Passing this backlog would permit the next controlled validation decision; it would not by itself constitute clinical validation or pilot approval.
