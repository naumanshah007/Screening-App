# Clinical Parity Matrix

This matrix compares the supplied requirement artifacts against the current product.

Sources reviewed:

- `Gynaecology Grading - Guideline.pdf`
- `COLP Grading Guide`
- `Current colposcopy grading template.jfif`
- current repo implementation

Status legend:

- `Built` means present in the current product flow
- `Partial` means present but still needs clinical validation or exact service sign-off
- `External` means the code path exists or is planned, but real completion depends on credentials, environment, or clinical team input

## A. Gynaecology Requirement

| Requirement | Current status | Notes |
| --- | --- | --- |
| One-page summary to minimise clicks | Built | Present in the case flow: `documents -> evidence -> summary` |
| Document ingestion for referral packs | Built | OCR and document ingestion are implemented |
| Abnormal uterine bleeding grading | Partial | Implemented in rules, still needs real-case clinical validation |
| Post-menopausal bleeding grading | Partial | Implemented in rules, still needs real-case validation |
| Fibroids grading | Partial | Implemented in rules, still needs real-case validation |
| Ovarian masses / cysts grading | Partial | Implemented in rules, still needs real-case validation |
| Pelvic pain grading | Partial | Implemented in rules, still needs real-case validation |
| Urogynaecology grading | Partial | Implemented in rules, still needs real-case validation |
| Fertility | Partial | Implemented in rules, still needs real-case validation |
| PCOS | Partial | Implemented in rules, still needs real-case validation |
| Paediatric gynaecology / structural anomalies | Partial | Implemented in rules, still needs real-case validation |
| Cervical polyp | Partial | Implemented in rules, still needs real-case validation |
| Tubal ligation | Partial | Implemented in rules, still needs real-case validation |
| Pelvic tear | Partial | Implemented in rules, still needs real-case validation |
| Reject / re-refer logic | Built | Workflow and governance support this |
| P1 / P1-HSC / P2 / P2-HSC / P3 / P5 | Built | Present in enterprise case model and workflow |
| AI learns from clinician grading | Partial | capture is present; live training loop is not yet signed off for production |

## B. Colposcopy Requirement

| Requirement | Current status | Notes |
| --- | --- | --- |
| Colposcopy booking-priority guide | Partial | implemented in rules/workflow; still needs explicit sign-off against the exact service interpretation |
| Colposcopy grading form in workflow | Built | form is now in the grade workspace, not just intake |
| Status reason | Built | present |
| Priority | Built | present |
| FCT / faster cancer treatment flag | Built | present |
| Investigations | Built | present |
| Category | Built | present |
| Clinic | Built | present |
| HPV test / type / cytology sample | Built | present |
| Referrer reason | Built | present |
| Genotype detail | Built | present |
| Assessment of referral | Built | present |
| Booking priority | Built | present |
| Type | Built | present |
| To be seen by / SMO only | Built | present |
| Ovestin options | Built | present |
| NCSR / referral notes | Built | present |
| Internal triage notes | Built | present |
| NCSR data use for accurate grading | External | code path and governance exist; live completion depends on Health NZ credentials and approval |

## C. Enterprise Requirement

| Requirement | Current status | Notes |
| --- | --- | --- |
| Role-based access | Built | implemented across app and APIs |
| MFA for privileged roles | Built | implemented |
| Admin user management | Built | implemented |
| Audit trail | Built | implemented |
| Security incident workflow | Built | implemented |
| Governance and integration readiness visibility | Built | implemented |
| Azure-backed document storage | Partial | code path exists; live environment still needs configuration |
| Managed production database | External | repo is still defaulting to local runtime for development |
| SMTP delivery | Partial | code path exists; live SMTP values still needed |
| AI provider for production assist | External | requires approved runtime selection and service sign-off |

## D. What Is Still Truly Left

These are the items that should still be treated as remaining finish work:

1. clinical sign-off that the current rules and fields are acceptable
2. redacted real-case validation against live service expectations
3. real deployment configuration
4. real NCSR credentialed activation
5. approved AI runtime activation, if they want AI assist live
6. pilot execution and sign-off

## E. What Should Not Be Reopened

The following areas are already sufficiently built and should not reopen the scope unless pilot findings demand it:

- case workflow shell
- document ingestion and OCR
- summary generation
- rule release governance
- clinician override capture
- booking workflow and SLA
- admin, MFA, audit, and security incident tooling
