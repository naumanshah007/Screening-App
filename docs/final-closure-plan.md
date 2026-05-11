# Final Closure Plan

This document defines the stop point for the current product.

The goal is not to keep expanding the system. The goal is to finish the product against the requirement described by the Counties Manukau Women's Health team:

- support `colposcopy grading`
- support `gynaecology referral grading`
- generate a `one-page summary` for the grader
- provide `rules-based grading`
- prepare for `AI-assisted grading`
- meet `enterprise operational expectations`

## Current Product Position

The repo already contains the following major capabilities:

- enterprise `ReferralCase` workflow with `documents -> evidence -> summary -> grade`
- OCR and document ingestion
- one-page clinical summary generation and review
- release-controlled rules engine for `COLPOSCOPY` and `GYNAECOLOGY`
- clinician confirmation and override capture
- booking and SLA tracking
- admin, security, MFA, audit, incidents, investigations, and governance screens
- Azure storage support
- NCSR access governance and certification management
- AI provider abstraction with on-premises `Ollama`, cloud dev-only `Anthropic`, and `stub`

This means the product is already beyond MVP. The remaining work is closure work.

## Remaining Steps

There are `6` remaining finish steps.

### 1. Clinical Parity Lock

Goal:
- freeze the final rule/form scope against the supplied colposcopy guide, colposcopy grading template, and gynaecology guideline.

Done means:
- every major row in the guideline/template is marked as `implemented`, `partially implemented`, or `external dependency`
- the clinical team agrees that the remaining items are truly external, not hidden build work

Repo deliverables:
- [clinical-parity-matrix.md](./clinical-parity-matrix.md)
- [try-1-clinical-validation-checklist.md](./try-1-clinical-validation-checklist.md)
- [validation-log-template.md](./validation-log-template.md)

### 2. Real-Case Validation

Goal:
- run redacted real referrals through the product and validate summary + grading output with clinicians.

Done means:
- the workflow is exercised using real referral packs
- mismatches are logged and either fixed or explicitly accepted

This cannot be completed from code alone because it depends on real cases from the service.

### 3. Enterprise Environment Cutover

Goal:
- move the product from local/demo runtime to controlled deployment configuration.

Done means:
- managed database is configured
- Azure storage is configured and validated
- SMTP is configured
- staging/production environment values are defined

This is partly code-complete and partly deployment-complete. The code path exists; the live environment still needs operator setup.

### 4. Live Integration Activation

Goal:
- replace stub/inactive dependencies with real approved integrations.

Done means:
- NCSR credentials and endpoint are supplied and tested
- AI provider is set to approved runtime mode
- governance sign-off exists for those live paths

This cannot be completed without external credentials and approvals.

### 5. Operational Pack

Goal:
- make the product usable by the service team without developer hand-holding.

Done means:
- there is a simple role-based operating guide
- admin and triage actions are documented
- demo credentials and first-run workflow are documented

Repo deliverables:
- [deployment-and-pilot-runbook.md](./deployment-and-pilot-runbook.md)

### 6. Pilot Sign-Off

Goal:
- run a controlled pilot and stop building except for pilot findings.

Done means:
- agreed pilot scope
- agreed success metrics
- final sign-off or a short pilot-fix list

This step depends on the customer team, not just the repo.

## Lowest-Possible Completion Plan

The shortest realistic path is `3 tries`.

### Try 1. Lock Scope And Validate Clinical Fit

Includes:
- Step 1 `Clinical Parity Lock`
- Step 2 `Real-Case Validation`

Stop criteria:
- parity matrix is accepted
- redacted real-case walkthrough is completed
- only true defects remain

### Try 2. Activate Enterprise Runtime

Includes:
- Step 3 `Enterprise Environment Cutover`
- Step 4 `Live Integration Activation`

Stop criteria:
- live environment values are supplied
- Azure storage validated
- NCSR and AI paths either live or explicitly deferred by the service

### Try 3. Pilot And Close

Includes:
- Step 5 `Operational Pack`
- Step 6 `Pilot Sign-Off`

Stop criteria:
- the team can operate the product from the runbook
- pilot is executed
- remaining work becomes a short pilot-fix list, not another roadmap

## True Finish Line

The product should be called finished for this requirement when:

- the clinical team accepts the parity matrix
- redacted real-case validation is completed
- deployment configuration is live
- required integrations are either live or explicitly deferred in writing
- the pilot run is complete

If those five conditions are met, product work should stop and move into normal production support / change control.
