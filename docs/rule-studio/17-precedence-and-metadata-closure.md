# Precedence and metadata closure

The 15 previously reported cases are closed in the unpublished `CG-NCSP-3.1.0` successor. Four required specificity/precedence changes and eleven required source-supported metadata or branch presentation changes. The protected `CG-NCSP-3.0.0` snapshot was not edited.

| Case | Prior defect | Source-supported successor closure |
|---|---|---|
| `F2-AIS-NO-TOTAL-HYSTERECTOMY-R208` | AIS destination was too generic | Retains the Figure 2 route and applies current R9.14 clear-margin care-setting metadata. |
| `F3-HPV-OTHER-FIRST-UNSAT-CYTOLOGY-REPEAT` | General result overlay controlled | Specific first-unsatisfactory branch outranks the overlay and repeats cytology within three months. |
| `F3-HPV-OTHER-SECOND-UNSAT-CYTOLOGY-COLPOSCOPY` | General result overlay controlled | Specific second-consecutive-unsatisfactory branch outranks the overlay and routes to colposcopy. |
| `F5-TREATMENT-DEFERRED-ABNORMAL-TREATMENT` | Observation overlay controlled | Abnormal cytology, HPV detection or visible lesion selects the specialist treatment-decision branch. Completion is not inferred. |
| `F6-AFTER-LOW-GRADE-NEGATIVE-CONTINUE-TOC` | Longitudinal timing incomplete | Records the 12-month interval and uses the explicit low-grade sequence count. |
| `F7-AC1-COLPOSCOPY` | Urgency absent | AC1 retains the specialist/colposcopy route with urgent malignant-cytology metadata. |
| `F7-AC3-COLPOSCOPY` | Urgency absent | AC3 retains the specialist/colposcopy route with urgent malignant-cytology metadata. |
| `F7-AC4-COLPOSCOPY` | Urgency absent | AC4 retains the specialist/colposcopy route with urgent malignant-cytology metadata. |
| `F7-VISIBLE-LESION-BIOPSY-AIS-TYPE3` | Referral/decision boundary incomplete | Preserves biopsy evidence and Type 3 diagnostic-excision specialist boundary. Biopsy/excision completion is not inferred. |
| `F9-ABNORMAL-TZ-LSIL-HSIL-AIS-REVIEW` | Broad pregnancy branch obscured the specific review branch | Specific abnormal-transformation-zone review controls while the general pregnancy overlay remains matched evidence. |
| `F10-CANCER-SIGNS-URGENT-GYNAECOLOGY` | Destination incomplete | Immediate/without-delay urgent gynaecology is explicit; no 6–8-week delay is applied. |
| `F10-ABNORMAL-CERVIX-NO-CANCER-LOCAL-REVIEW` | Reassessment timing absent | Local assessment/treatment decision remains clinician-only, followed by the source 6–8-week reassessment interval. |
| `F10-NORMAL-CERVIX-STI-TREAT-REVIEW` | Timing and completion boundary absent | STI treatment is a clinician-only recommendation; recorded treatment is required before 6–8-week reassessment. |
| `F10-NORMAL-CERVIX-NO-STI-LOCAL-PATHWAY` | Conditional timing absent | Local investigation/treatment is clinician-only; the 6–8-week interval applies only when local treatment is recorded. |
| `F10-REVIEW-BLEEDING-PERSISTS-GYNAECOLOGY` | Follow-up timing absent | Persistent symptoms after recorded reassessment route to gynaecology after the 6–8-week review. |

Verification is in `22-canonical-v2-differential-results.json`: all 179 cases have a governed route, with zero metadata, precedence or implementation defects. The general overlays were retained; specificity was added rather than deleting safety coverage.

Clinical governance review is still required before publication. This is software-conformance evidence for a source-derived draft, not direct clinical guidance.
