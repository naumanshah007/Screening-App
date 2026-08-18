# Data-field reachability

| Required fact | Engine type | Batch/API/UI/persistence | Audit finding |
|---|---:|---|---|
| Age/date of birth | age only | partial | No DOB/precise boundary calculation |
| Immune deficiency | yes, non-null boolean | defaults false | Unknown cannot be captured safely |
| HPV genotype/sample/cytology | yes | yes/partial | Invalid and pending states incomplete |
| Pregnancy / hysterectomy type | yes | partial | Indication/pathology/completeness incomplete workflow evidence |
| Bleeding/exam/cancer concern | yes | mapper fabricates fields | Source data not preserved faithfully |
| Prior history/ToC/treatment date | partly | partial | treatment date not batch-mapped; external history gaps |
| Colposcopy/TZ/lesion/biopsy/MDM | yes | partial | clinician-only provenance and review outcome incomplete |
| DES exposure/cancer history | no | no | Unsupported |
| Ethnicity | yes | yes | present for reporting, not validated clinical routing |

No evidence was found that every required fact is simultaneously captureable through UI, API, batch mapping, persistence and export. This is a pilot blocker.
