# Governance pack for confirmed legacy differences

This pack records **26** source-oracle differences in the still-authoritative legacy engine. It is a non-executing synthetic impact preview. No live or completed case was regraded, and the legacy implementation was not changed.

| ID | Source case | Area | Group | Risk | Expected | Legacy | Suggested action |
|---|---|---|---|---|---|---|---|
| `LEGACY-001` | `F3-BASELINE-HPV-OTHER-NEGATIVE-REPEAT-12M` | Figure 3 | `PRESENTATION_CODE_MISMATCH` | MEDIUM | REPEAT_HPV | UNMAPPED_ACTUAL:F3-HPV-OTHER-NEG-ASCUS-LSIL-12M | Explicit reviewer-authorised regrade only after successor governance approval; preserve history. |
| `LEGACY-002` | `F3-BASELINE-HPV-OTHER-ASC-US-REPEAT-12M` | Figure 3 | `PRESENTATION_CODE_MISMATCH` | MEDIUM | REPEAT_HPV | UNMAPPED_ACTUAL:F3-HPV-OTHER-NEG-ASCUS-LSIL-12M | Explicit reviewer-authorised regrade only after successor governance approval; preserve history. |
| `LEGACY-003` | `F3-BASELINE-HPV-OTHER-LSIL-REPEAT-12M` | Figure 3 | `PRESENTATION_CODE_MISMATCH` | MEDIUM | REPEAT_HPV | UNMAPPED_ACTUAL:F3-HPV-OTHER-NEG-ASCUS-LSIL-12M | Explicit reviewer-authorised regrade only after successor governance approval; preserve history. |
| `LEGACY-004` | `F3-INVALID-HPV-REPEAT-ASAP` | Figure 3 | `INCOMPLETE_LONGITUDINAL_STATE` | MEDIUM | REPEAT_ASAP | REPEAT_HPV | Explicit reviewer-authorised regrade only after successor governance approval; preserve history. |
| `LEGACY-005` | `F3-CYTOLOGY-PENDING-INCOMPLETE` | Figure 3 | `MISSING_DATA_COLLAPSE` | HIGH | INCOMPLETE_RESULT | SAFETY_STOP | Explicit reviewer-authorised regrade only after successor governance approval; preserve history. |
| `LEGACY-006` | `F3-MISSING-SAMPLE-TYPE-SAFETY-STOP` | Figure 3 | `MISSING_DATA_COLLAPSE` | HIGH | SAFETY_STOP | ROUTINE_RECALL | Explicit reviewer-authorised regrade only after successor governance approval; preserve history. |
| `LEGACY-007` | `F3-HPV-NOT-DETECTED-UNKNOWN-IMMUNE-SAFETY-STOP` | Figure 3 | `MISSING_DATA_COLLAPSE` | HIGH | SAFETY_STOP | ROUTINE_RECALL | Explicit reviewer-authorised regrade only after successor governance approval; preserve history. |
| `LEGACY-008` | `F4-REPEAT-HPV-NOT-DETECTED-REGULAR-5Y` | Figure 4 | `WRONG_INTERVAL` | MEDIUM | ROUTINE_RECALL | REPEAT_HPV | Explicit reviewer-authorised regrade only after successor governance approval; preserve history. |
| `LEGACY-009` | `F4-REPEAT-HPV-NOT-DETECTED-IMMUNE-3Y` | Figure 4 | `WRONG_INTERVAL` | MEDIUM | ROUTINE_RECALL | REPEAT_HPV | Explicit reviewer-authorised regrade only after successor governance approval; preserve history. |
| `LEGACY-010` | `F4-SECOND-REPEAT-NOT-DETECTED-REGULAR-5Y` | Figure 4 | `WRONG_INTERVAL` | MEDIUM | ROUTINE_RECALL | REPEAT_HPV | Explicit reviewer-authorised regrade only after successor governance approval; preserve history. |
| `LEGACY-011` | `F4-SECOND-REPEAT-NOT-DETECTED-IMMUNE-3Y` | Figure 4 | `WRONG_INTERVAL` | MEDIUM | ROUTINE_RECALL | REPEAT_HPV | Explicit reviewer-authorised regrade only after successor governance approval; preserve history. |
| `LEGACY-012` | `F5-MDM-DOWNGRADED-LSIL-PATHWAY` | Figure 5 | `WRONG_REFERRAL_OR_PATHWAY` | MEDIUM | ROUTE_LSIL | MDM_REVIEW | Explicit reviewer-authorised regrade only after successor governance approval; preserve history. |
| `LEGACY-013` | `F5-MDM-UPGRADED-HSIL-PATHWAY` | Figure 5 | `WRONG_REFERRAL_OR_PATHWAY` | HIGH | ROUTE_HSIL | COLPOSCOPY | Explicit reviewer-authorised regrade only after successor governance approval; preserve history. |
| `LEGACY-014` | `F5-TREATMENT-DEFERRED-HPV-DETECTED-NORMAL-12M` | Figure 5 | `WRONG_REFERRAL_OR_PATHWAY` | MEDIUM | REPEAT_COLPOSCOPY_COTEST | UNMAPPED_ACTUAL:F5-CONFIRMED-ASCH-HPV-DETECTED-NORMAL-NEG-12M | Explicit reviewer-authorised regrade only after successor governance approval; preserve history. |
| `LEGACY-015` | `F6-MISSING-TREATMENT-DATE-SAFETY-STOP` | Figure 6 | `MISSING_DATA_COLLAPSE` | HIGH | SAFETY_STOP | REPEAT_COTEST | Explicit reviewer-authorised regrade only after successor governance approval; preserve history. |
| `LEGACY-016` | `F7-NO-LESION-CYTOLOGY-CONFIRMED-TYPE3-EXCISION` | Figure 7 | `WRONG_REFERRAL_OR_PATHWAY` | HIGH | TYPE3_EXCISION | COLPOSCOPY | Explicit reviewer-authorised regrade only after successor governance approval; preserve history. |
| `LEGACY-017` | `F7-NO-LESION-AG2-CONFIRMED-INVESTIGATE` | Figure 7 | `WRONG_REFERRAL_OR_PATHWAY` | MEDIUM | GYNAECOLOGY_INVESTIGATION | GYNAECOLOGY | Explicit reviewer-authorised regrade only after successor governance approval; preserve history. |
| `LEGACY-018` | `F7-NO-LESION-CYTOLOGY-NOT-CONFIRMED-6M` | Figure 7 | `WRONG_REFERRAL_OR_PATHWAY` | MEDIUM | REPEAT_COLPOSCOPY | MDM_REVIEW | Explicit reviewer-authorised regrade only after successor governance approval; preserve history. |
| `LEGACY-019` | `F8-LOW-RISK-COMPLETE-HSIL-AIS-TOC` | Figure 8 | `INCOMPLETE_LONGITUDINAL_STATE` | HIGH | TEST_OF_CURE | NO_FURTHER_SCREENING | Explicit reviewer-authorised regrade only after successor governance approval; preserve history. |
| `LEGACY-020` | `F8-LOW-RISK-INCOMPLETE-HSIL-AIS-COLPOSCOPY` | Figure 8 | `WRONG_REFERRAL_OR_PATHWAY` | HIGH | COLPOSCOPY | NO_FURTHER_SCREENING | Explicit reviewer-authorised regrade only after successor governance approval; preserve history. |
| `LEGACY-021` | `F8-UNTREATED-HSIL-AIS-NO-LOW-PATH-TOC` | Figure 8 | `INCOMPLETE_LONGITUDINAL_STATE` | HIGH | TEST_OF_CURE | CONTINUE_TOC | Explicit reviewer-authorised regrade only after successor governance approval; preserve history. |
| `LEGACY-022` | `T1-HSIL-AIS-UNTREATED-INCOMPLETE-NO-OR-LOW-PATHOLOGY` | Table 1 | `INCOMPLETE_LONGITUDINAL_STATE` | HIGH | TEST_OF_CURE | CONTINUE_TOC | Explicit reviewer-authorised regrade only after successor governance approval; preserve history. |
| `LEGACY-023` | `T1-PREVIOUS-TREATMENT-INCOMPLETE-TOC-NO-OR-LOW-PATHOLOGY` | Table 1 | `INCOMPLETE_LONGITUDINAL_STATE` | MEDIUM | TEST_OF_CURE | CONTINUE_TOC | Explicit reviewer-authorised regrade only after successor governance approval; preserve history. |
| `LEGACY-024` | `F9-NORMAL-TZ-MDM-DOWNGRADE-NEGATIVE-F3` | Figure 9 | `WRONG_REFERRAL_OR_PATHWAY` | MEDIUM | ROUTE_FIGURE_3 | MDM_REVIEW | Explicit reviewer-authorised regrade only after successor governance approval; preserve history. |
| `LEGACY-025` | `F9-NORMAL-TZ-MDM-DOWNGRADE-LOW-GRADE` | Figure 9 | `WRONG_REFERRAL_OR_PATHWAY` | MEDIUM | ROUTE_LSIL | MDM_REVIEW | Explicit reviewer-authorised regrade only after successor governance approval; preserve history. |
| `LEGACY-026` | `F9-NORMAL-TZ-MDM-CONFIRMS-HIGH-GRADE-REVIEW` | Figure 9 | `WRONG_REFERRAL_OR_PATHWAY` | MEDIUM | PREGNANCY_COLPOSCOPY_REVIEW | MDM_REVIEW | Explicit reviewer-authorised regrade only after successor governance approval; preserve history. |

The JSON companion provides source expectations, canonical shadow output, fields and flows affected, stored-record impact, regrade implications, synthetic test IDs and exact source references.

## Safety boundary

This register does not change authority. Legacy remains displayed authority; CG-NCSP-3.1.0 remains an unpublished, inactive source-derived draft. Reviewer confirmation is required and the output is not for direct clinical action.
