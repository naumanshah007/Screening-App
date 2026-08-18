# Rule-to-code parity matrix

| Rule | Classification | Evidence / consequence | Severity |
|---|---|---|---|
| F3 required sample type | INCORRECT_REVIEW_REQUIREMENT | `NOT_DETECTED` returns routine recall when sample type absent | HIGH |
| F3 immune status | UNSUPPORTED_BY_DATA_MODEL | non-optional boolean cannot represent unknown; false default can issue 5-year recall | HIGH |
| F3 age 70–74 HPV 16/18 | INCORRECT_CONDITION | router returns `AGE-70-74-DEFERRED` before genotype referral | CRITICAL |
| F6 missing treatment date | INCORRECT_REVIEW_REQUIREMENT | terminal ToC outputs retain missing date as a non-blocking field | HIGH |
| F10 cancer suspicion + pending co-test | EXACT_MATCH (limited) | referral required and urgent; wording also says co-test | MEDIUM |
| F10 batch workup | POSSIBLE_OVERREACH | mapper asserts exam/history/co-test captured without source evidence | HIGH |
| F1/F2 original sources | CLINICAL_GOVERNANCE_REQUIRED | source figures unavailable for full independent confirmation | HIGH |
| F4/F5/F7/F9 specialist branches | CLINICAL_GOVERNANCE_REQUIRED | MDM/biopsy/treatment are not safe autonomous terminal decisions | HIGH |
| Table 1 exhaustive cells | PARTIAL_IMPLEMENTATION | only generic hysterectomy evaluator; no independently proven row/cell suite | HIGH |

All High/Critical entries block external clinical validation and pilot use. Demo impact: show only as synthetic, provisional decision support with reviewer confirmation required.
