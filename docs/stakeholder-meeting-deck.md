# Stakeholder Meeting Deck

Use this as the exact content for your PPT.

Recommended deck length: `10 slides`

Tone:

- exploratory but serious
- workflow-first
- not over-claiming clinical completeness
- asking for validation and ownership

## Slide 1. Title

**Women’s Health Referral Grading MVP**

Subtitle:

- `Colposcopy + Gynaecology`
- `Workflow validation, clinical alignment, and next steps`

Presenter:

- `Nauman`

Speaker note:

> I’ve prepared an exploratory MVP based on the requirements and grading materials you shared. My goal today is to validate whether I’ve understood the workflow correctly and identify the shortest path to a safe pilot.

## Slide 2. My Understanding Of The Need

Title:

**What I Understood From Your Requirements**

Bullets:

- Gynaecology grading currently requires reading across multiple sources.
- The first major need is a `one-page summary` to reduce clicks.
- Colposcopy is more category-based and may be the easier first service to validate.
- Longer term, the aim is `AI-assisted grading` based on clinician-reviewed decisions.
- Data sovereignty, restricted access, and auditability are non-negotiable.

Speaker note:

> Before showing the product, I want to confirm this is the problem I think you are solving.

## Slide 3. What This MVP Was Built To Test

Title:

**What The MVP Is Designed To Validate**

Bullets:

- referral and case intake
- document ingestion and OCR
- evidence extraction
- one-page summary generation
- rules-based recommendation
- clinician confirmation / override
- booking and operational routing
- governance, access control, and audit

Speaker note:

> I built this as a workflow and validation product first, not as a claim that all clinical details are final.

## Slide 4. Current Workflow In The Product

Title:

**Current Workflow**

Flow:

1. Referral received
2. Documents uploaded and ingested
3. Evidence extracted
4. One-page summary reviewed
5. Recommendation generated
6. Clinician confirms or overrides
7. Booking / return / escalation workflow continues

Speaker note:

> I tried to structure the system around the grader’s actual journey rather than around a generic data-entry form.

## Slide 5. What Is Already Covered

Title:

**What The MVP Already Covers**

Two-column layout:

Left column `Colposcopy`

- template-style grading workspace
- booking-priority logic
- FCT / investigations / category / SMO-only
- Ovestin, NCSR notes, triage notes
- audit and restricted-access governance

Right column `Gynaecology`

- document-first case workflow
- one-page summary
- category-based grading support
- clinician decision capture
- operational workflow and audit trail

Speaker note:

> From a software point of view, the product foundation is already well developed. The main remaining need is clinical validation and environment activation.

## Slide 6. Category Coverage

Title:

**Category Coverage In The Current MVP**

Bullets:

- `Gynaecology`: AUB, PMB, fibroids, ovarian masses/cysts, pelvic pain, urogynaecology, fertility, PCOS, cervical polyp, paediatric gynae, pelvic tear, tubal ligation
- `Colposcopy`: primary HPV scenarios, HPV + cytology combinations, abnormal appearance, immune-deficient pathways, test-of-cure / re-referral scenarios

Speaker note:

> I translated the supplied categories into structured grading inputs so the workflow can be consistent. I’d like to validate whether these are the right minimum questions and outputs for each category.

## Slide 7. What Needs Your Validation

Title:

**What I Need To Validate With You**

Bullets:

- whether the summary contains the right information
- whether the grading outputs match service expectations
- whether the operational workflow matches real practice
- where NCSR is truly required
- what the right first pilot scope should be

Speaker note:

> This is where your domain expertise matters most. I do not want to harden the wrong assumptions.

## Slide 8. Validation Workbook

Title:

**Structured Validation Workbook**

Bullets:

- `Tab 1`: current understanding and assumptions
- `Tab 2`: clinical validation by category
- `Tab 3`: workflow and operations
- `Tab 4`: technical, integration, AI, hosting, and data sources

Footer:

- `Confirmed`
- `Assumed`
- `Unknown`

Speaker note:

> To make validation efficient, I prepared a pre-filled workbook based on your email, the documents you shared, and the current MVP. The aim is for your team to correct and confirm rather than start from a blank sheet.

## Slide 9. Decisions And Owners Needed

Title:

**Owners And Decisions Needed**

Bullets:

- clinical owner for `colposcopy`
- clinical owner for `gynaecology`
- operational / technical owner for environment and integration decisions

Decisions needed:

- which service should pilot first
- which redacted cases should be used for validation
- which integrations are mandatory for pilot
- whether AI assist is in pilot scope or not

Speaker note:

> If you can nominate owners for these streams, I can validate the MVP efficiently and avoid guessing.

## Slide 10. Recommended Next Step

Title:

**Recommended Next Step**

Bullets:

- validate with redacted real cases
- log only `Accepted`, `Fix required`, `Policy clarification`, or `External dependency`
- fix only true issues before pilot
- then activate environment and integrations

Speaker note:

> My recommendation is to validate on real cases first, then move into environment activation and a controlled pilot.

## Demo Order

Use this exact demo order:

1. `Dashboard`
2. `Cases`
3. one `Gynaecology` case:
   - `Documents`
   - `Evidence`
   - `Summary`
   - `Grade`
4. one `Colposcopy` case:
   - grading workspace
5. `Readiness`
6. `Admin`

## Exact Framing Sentence

Use this near the start:

> I treated this as an exploratory but serious MVP based on the requirements you shared. I’m not presenting it as clinically final without your validation.
