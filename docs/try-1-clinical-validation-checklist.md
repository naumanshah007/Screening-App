# Try 1 Clinical Validation Checklist

This is the exact checklist for the next phase.

The purpose of `Try 1` is to stop open-ended product building and decide:

- what is already acceptable
- what is a true defect
- what is an external dependency
- what should be deferred

## Try 1 Goal

Finish these two closure steps:

1. `Clinical parity lock`
2. `Real-case validation`

Try 1 is complete when:

- the clinical team has reviewed the current product against their own workflow
- redacted real cases have been tested
- the output for each reviewed case is marked as accepted, fix required, or policy clarification needed

## Who Should Be In The Room

Minimum:

- 1 colposcopy clinical reviewer
- 1 gynaecology grading reviewer
- 1 operational / coordinator reviewer
- you as product owner / presenter

Ideal:

- someone who understands NCSR access restrictions
- someone from booking / waitlist operations

## What To Bring

- the seeded demo environment
- at least `3` redacted colposcopy referral examples
- at least `5` redacted gynaecology referral examples
- the supplied guideline documents
- the current colposcopy grading template
- [clinical-parity-matrix.md](./clinical-parity-matrix.md)
- [validation-log-template.md](./validation-log-template.md)

## Case Mix To Request

### Colposcopy

Request at least:

- `HPV 16/18` high-priority case
- `HPV other` lower-priority case
- one `re-referral / prior normal colposcopy` case

### Gynaecology

Request at least:

- `AUB`
- `PMB`
- `fibroids`
- `ovarian mass/cyst`
- `pelvic pain` or `urogynae`

If they can provide more, add:

- `cervical polyp`
- `fertility`
- `PCOS`
- `paediatric gynae`
- `tubal ligation`

## Exact Walkthrough Per Case

For each real redacted case, do this in order:

1. Open or create the case.
2. Upload the referral pack.
3. Run document ingest.
4. Review extracted evidence.
5. Generate the one-page summary.
6. Review the summary with the clinician.
7. Approve or edit the summary.
8. Run grading.
9. Compare the recommendation with the clinician's expected outcome.
10. Record the final clinician decision.

## Questions To Ask For Every Case

### Summary quality

- Did the summary contain the information needed to grade?
- Was anything important missing?
- Was anything misleading or over-emphasized?
- Did it reduce the need to open multiple PDFs?

### Grading quality

- Was the recommended priority correct?
- Was the recommended category correct?
- Was the outcome correct?
- Was the rationale understandable?
- If not correct, was the issue:
  `rule mismatch`, `missing evidence`, `wrong extraction`, or `service policy difference`?

### Workflow quality

- Did the reviewer know what to do next at each step?
- Did the colposcopy workspace match the way they actually grade?
- Did the gynaecology workspace feel usable from a real referral?

## Decision Labels

Use only these labels in Try 1:

- `Accepted`
- `Accepted with wording tweak`
- `Fix required`
- `Policy clarification needed`
- `External dependency`

Do not create new labels during the session.

## What Counts As A Fix

A real fix is one of these:

- wrong rule output
- missing field needed for grading
- missing extracted evidence that should have been captured
- unclear summary wording that changes clinical interpretation
- broken workflow step

These do **not** count as product defects:

- live NCSR not enabled because credentials are not yet provided
- live AI provider not activated yet
- production infrastructure not yet configured

## End Of Try 1 Review

At the end of the session, classify all findings into exactly three buckets:

### Bucket A. Must fix before pilot

Examples:

- incorrect grading priority
- missing booking-critical colposcopy field
- summary missing core information repeatedly

### Bucket B. Fix if quick

Examples:

- wording cleanup
- label mismatch
- layout or guidance text improvement

### Bucket C. External / deferred

Examples:

- NCSR live credential activation
- SMTP production config
- AI approval decision

## Try 1 Stop Rule

Try 1 must stop after:

- all prepared cases are reviewed, or
- the team identifies `5` clear must-fix items, whichever comes first

Do not turn Try 1 into another design session.

The output of Try 1 should be:

- a signed-off parity view
- a short must-fix list
- a short external-dependency list

If that output exists, move to `Try 2`.
