# Deployment And Pilot Runbook

This runbook is the shortest practical guide for taking the current product into a controlled demo / pilot state.

## 1. Demo / Pilot Objective

Use the current product to demonstrate:

- colposcopy grading workflow
- gynaecology referral grading workflow
- one-page summary generation
- deterministic recommendation with clinician confirmation
- governance, audit, access control, and admin readiness

## 2. What Must Be Configured

### Required for a clean demo

- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- enterprise feature flags enabled

The repo now defaults the enterprise feature flags to on in `.env.example`.

### Required for live-style pilot deployment

- managed database connection
- Azure storage connection
- SMTP settings
- NCSR endpoint and credential values
- AI provider settings if AI assist will be demonstrated live

## 3. Recommended Demo Path

Use the seeded data first.

Suggested order:

1. Login as `admin@cs.nz`
2. Open `Dashboard`
3. Open `Cases`
4. Open one `COLPOSCOPY` case
5. Walk through:
   - `Documents`
   - `Evidence`
   - `Summary`
   - `Grade`
6. Show the colposcopy grading sheet in the workspace
7. Open one `GYNAECOLOGY` case
8. Walk through the same flow and show the one-page summary
9. Open `Admin`
10. Show:
   - integration readiness
   - NCSR certification governance
   - user access management
   - security incidents

## 4. Demo Accounts

Seeded by `npm run db:seed`.

Current demo password:

- `admin123`

Main accounts:

- `admin@cs.nz`
- `colpo.cns@cs.nz`
- `gynae.grader@cs.nz`
- `coordinator@cs.nz`
- `integration.admin@cs.nz`

## 5. Real-Case Validation Workflow

When the clinical team supplies redacted real referral packs:

1. Create or open the target case
2. Upload the referral documents
3. Run ingest
4. Review extracted evidence
5. Generate the summary
6. Review and approve the summary
7. Run grading
8. Record clinician final decision
9. Capture mismatch notes if the result is not acceptable

Log each case as one of:

- `Accepted as correct`
- `Accepted with wording adjustment`
- `Rule mismatch`
- `Missing extracted evidence`
- `Needs service-policy clarification`

## 6. Pilot Success Criteria

The pilot should be considered successful if:

- clinicians can use the one-page summary instead of opening multiple source documents for most test cases
- colposcopy grading matches the service’s expected booking priority logic
- gynaecology grading is acceptable on the validated redacted sample set
- overrides are understandable and auditable
- the team can explain access, security, and governance in the product itself

## 7. Final Stop Rule

Do not continue general feature-building after the pilot starts.

Only allow:

- defects found in validation
- small wording fixes
- configuration/integration fixes
- explicit clinician-requested rule adjustments

Everything else should move to a later change backlog.
