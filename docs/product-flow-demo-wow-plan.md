# Product Flow & Demo Readiness Plan

## 1. Executive Summary

The product is directionally strong for a business and clinical stakeholder demo. Its best story is not "the app replaces clinical judgement"; it is "the app turns referral packs, extracted evidence, structured clinical facts, deterministic rules, clinician review, booking, and audit into one governed workflow."

Current product strength:

- The enterprise referral workflow is already coherent: dashboard, case queue, case hub, documents, evidence, one-page summary, guided triage, grading, clinician confirmation, booking, audit, rules governance, and readiness.
- The rule engine is now a credible validation harness against Figures 1-10 and Table 1, with explicit safety states instead of silent guessing.
- The app is honest about dependencies such as NCSR/history, integration readiness, summary approval, and clinician sign-off.
- The guided triage page is the strongest demo surface because it keeps the workflow, summary, recommendation, and final decision close together.

Current flow weakness:

- There are too many possible entry points for a short demo: dashboard, cases, guided triage, grade, summary, GP portal, legacy pathway wizard, guidelines, admin, readiness, rules, and audit.
- Some screens mix enterprise case workflow with older screening-session or manual pathway tooling, which could make the product feel less focused if shown without framing.
- The recommendation and rule trace are valuable but can feel buried inside dense grading content.
- The visual decision trees are clearly marked "under validation", but some are simplified and should not be presented as authoritative pathway parity.
- Audit and governance are strong but need to be surfaced deliberately in the demo rather than discovered late.

Best demo positioning:

Use the app as a clinical operations MVP and rule-validation workbench. The narrative should be: "Here is how we reduce reading burden, make recommendations traceable, show missing information honestly, keep clinicians in control, and generate governance evidence for validation."

Improve before demo:

- Curate the demo route around the enterprise case workflow: `/dashboard` -> `/cases` -> `/cases/[id]/triage` -> `/cases/[id]/grade` -> `/audit` -> `/readiness`.
- Prepare seeded cases that show one clean colposcopy workflow, one missing-history/NCSR dependency, one clinician override, and one gynaecology summary workflow.
- Make the "under validation / clinician final decision required" message visible at the start of the demo and on recommendation surfaces.
- Avoid leading with `/gp` or `/pathway`; show them only if asked, and describe them as legacy/manual validation tools.

Wait for clinical validation:

- Clinical completeness claims.
- Production safety claims.
- NCSR-backed history completeness.
- Live pilot use with real cases.
- Final Table 1 pilot scope and any service-specific deviations from the supplied figures.

## 2. Current Product Flow Map

| Step | Current screen/file | User action | Value shown | Friction/risk |
| --- | --- | --- | --- | --- |
| 1. Login | `app/(auth)/login/LoginPageClient.tsx` | Choose a seeded demo account and sign in. | Demonstrates role-based access and a controlled workspace. | Quick-fill accounts are useful, but not all enterprise roles are obvious. Use a prepared account and avoid login troubleshooting during demo. |
| 2. Dashboard | `app/(app)/dashboard/page.tsx` | Review workload, role-focused queue, urgent/overdue status, and pathway stats. | Shows operational control: what needs summary, grading, booking, or review. | Dashboard mixes enterprise referral queues with pathway/session analytics. Too much time here can dilute the story. |
| 3. Case queue | `app/(app)/cases/page.tsx` | Filter/select a colposcopy or gynaecology referral case. | Shows real service operations: status, priority, SLA, routing, and queue management. | Filters and route labels are dense; demo needs a named case ready to open. |
| 4. Case hub | `app/(app)/cases/[id]/page.tsx`, `components/cases/WorkflowGuide.tsx`, `components/cases/WorkflowGovernancePanel.tsx` | Open a case and use the workflow guide to move through documents, evidence, summary, recommendation, decision, and booking. | This is the best "product spine"; it makes the app feel like a serious workflow tool. | Multiple buttons compete for attention. The presenter should use Guided Triage as the main path. |
| 5. Document upload/ingest | `app/(app)/cases/[id]/documents/page.tsx`, `DocumentUploadForm`, `DocumentIngestButton` | Show uploaded referral pack and ingest status. | Demonstrates source document handling and readiness checks before automation. | Live upload/OCR can fail or take time. Use pre-ingested documents for demo; show upload only briefly. |
| 6. Evidence review | `app/(app)/cases/[id]/evidence/page.tsx`, `lib/cases/evidence.ts` | Review extracted facts, source quotes, page references, and confidence. | Strong traceability: business can see why the summary/rules have facts to use. | If facts are sparse, the screen feels unfinished. Seed richer evidence and source quotes. |
| 7. One-page summary | `app/(app)/cases/[id]/summary/page.tsx`, `SummaryGenerateButton`, `SummaryReviewForm`, `lib/cases/summary.ts` | Generate/review/approve clinical summary. | Major value moment: a clinician does not need to re-read a full referral pack. | Summary approval blocks grading, which is safe but can stall demo if case is not pre-approved. |
| 8. Guided triage | `app/(app)/cases/[id]/triage/page.tsx`, `TriageActionBar` | Review patient, workflow status, summary, recommendation, rationale, and final decision in one place. | Best demo experience: workflow context plus clinical decision support without losing operational status. | Rule trace is summarized here; for detailed branch path, jump to grade page. |
| 9. Grading workspace | `app/(app)/cases/[id]/grade/page.tsx`, `ColposcopyGradeSheetForm`, `GynaecologyGradeWorkbenchForm`, `GradeEvaluateButton`, `DecisionSaveForm`, `BookingUpdateForm` | Run deterministic recommendation, inspect signals/rationale/rule trace, confirm or override, and update booking. | Shows clinical safety: summary approval gate, rule release, rationale, evidence used, override reason, booking/SLA. | Dense page. It can look technical unless presenter focuses on recommendation, warnings, trace, and clinician confirmation. |
| 10. NCSR/history surface | `app/(app)/cases/[id]/ncsr/page.tsx`, `NcsrPullClient`, `lib/integrations/colposcopy-registry/*` | Show external registry dependency and access controls. | Honest external-history story: the app does not fake NCSR. | If shown too early it may look like a blocker. Frame it as an integration readiness/control. |
| 11. Rules governance | `app/(app)/rules/page.tsx`, `lib/cases/rule-releases.ts`, `lib/cases/rule-regression.ts` | Show active rule releases, source of truth, regression status, review/publish controls. | Enterprise validation story: deterministic rules are versioned and governed. | The rules page is detailed; use it after showing a case, not before. |
| 12. Guideline library | `app/(app)/guidelines/page.tsx`, `lib/decision-trees/index.ts`, `components/clinical/FlowDiagram.tsx` | Show colposcopy/gynaecology tables and cervical pathway figures. | Useful reference and stakeholder confidence. | Figures are simplified and marked under validation. Do not present them as full source-equivalent diagrams. |
| 13. Audit investigation | `app/(app)/audit/page.tsx`, `lib/security/audit-investigations.ts` | Filter and export audit events. | Strong governance moment: decisions and activity are reviewable/exportable. | Audit is admin-only and can feel disconnected from case flow unless seeded with meaningful recent events. |
| 14. Admin/readiness | `app/(app)/admin/page.tsx`, `app/(app)/readiness/page.tsx`, `lib/ops/product-readiness.ts`, `lib/ops/runtime-readiness.ts` | Review users, rule history, integration status, incidents, launch readiness. | Shows enterprise maturity: access, integrations, security, readiness, external dependencies. | Admin dashboard has many sections. Use the readiness page for the cleanest story. |
| 15. Legacy/manual tools | `app/(app)/gp/page.tsx`, `app/(app)/pathway/page.tsx`, `lib/wizard/steps.ts` | Manual or guided cervical pathway evaluation. | Helpful for validation and manual entry scenarios. | Can distract from the main enterprise workflow. Use only if asked; label as separate from referral grading. |

## 3. Ideal Demo Story

Opening sentence:

"This is a workflow MVP and rule-validation product, not a clinically signed-off production system yet. The value we are testing is whether the app can reduce reading burden, make deterministic pathway recommendations traceable, show missing information honestly, and keep the clinician as the final decision-maker."

Recommended 10-15 minute route:

1. Start at `/dashboard`.
   - Say: "The first screen is operational. It tells a coordinator or reviewer what needs attention today: cases needing documents, summary, grading, urgent review, or booking."
   - Click: Open the role-focused queue or "Open cases".
   - Do not say: "The app has clinically validated all recommendations."
   - Prepare: A dashboard with non-empty ready-for-summary, ready-for-grading, urgent, and overdue counts.
   - Risk: Too many metrics. Avoid pathway distribution unless asked.

2. Open `/cases`.
   - Say: "This is the referral queue. It supports colposcopy and gynaecology workflows, not just a single screening calculator."
   - Click: A named colposcopy case that is pre-ingested, summary-approved, and ready for grading.
   - Do not say: "The queue is integrated with all live hospital systems."
   - Prepare: A clean case with visible service line, SLA, status, and route.
   - Risk: Filters can slow the demo. Use a bookmarked case or known row.

3. Open the case hub, then Guided Triage.
   - Say: "The workflow guide is deliberate: documents, evidence, summary, recommendation, final decision, booking. It prevents jumping straight to a recommendation without source material."
   - Click: "Open Guided Triage".
   - Do not say: "Clinicians no longer need to review evidence."
   - Prepare: Completed workflow steps visible.
   - Risk: If the case has missing documents or unapproved summary, the story stalls. Use a ready case.

4. Show documents and evidence briefly.
   - Say: "Here are the source documents and extracted facts. The point is traceability, not black-box automation."
   - Click: Documents, then Evidence, or use the Guided Triage links if already visible.
   - Do not say: "OCR extraction is perfect."
   - Prepare: At least one referral, one lab/result-style document, extracted facts, page references, and source quotes.
   - Risk: Sparse facts look weak. Seed the evidence deliberately.

5. Show the one-page summary.
   - Say: "This is the major workload-reduction point: the reviewer gets a one-page case summary, warnings, next actions, and approval status."
   - Click: Summary.
   - Do not say: "This summary is automatically clinically accepted."
   - Prepare: Approved summary with meaningful sections and warnings where appropriate.
   - Risk: If summary is unapproved, grading is blocked. That is safe, but not for the primary demo case.

6. Show the rule recommendation and trace.
   - Say: "The recommendation is provisional. It records the rule release, rationale, matched rule trace, evidence used, missing information, and warnings."
   - Click: Grade panel; if needed click Evaluate Rules on a prepared case.
   - Do not say: "The rule engine is clinically complete." Say: "It is implemented against the supplied decision trees and is ready for clinical validation."
   - Prepare: A decision with clear branch path and a visible rule release.
   - Risk: Trace is detailed. Explain only the matched path and why it matters.

7. Show missing information or external dependency on a second case.
   - Say: "The safer behavior is that the system stops when it lacks history, NCSR, visible lesion, histology, or MDM facts. It does not guess."
   - Click: A second case with missing history/NCSR or insufficient information.
   - Do not say: "The app can infer all missing clinical facts."
   - Prepare: Case returns `EXTERNAL_HISTORY_REQUIRED`, `INSUFFICIENT_INFORMATION`, or `CLINICIAN_REVIEW_REQUIRED`.
   - Risk: Stakeholders may hear "blocked" as failure. Frame it as safety and validation readiness.

8. Show clinician confirmation or override.
   - Say: "The final clinical decision is explicit. If the clinician changes the recommendation, the override reason is required and retained."
   - Click: Clinician Confirmation on Grade or Guided Triage.
   - Do not say: "The clinician is just approving the computer."
   - Prepare: One accepted case and one override case.
   - Risk: If no decision is saved, the moment is weaker.

9. Show booking/SLA.
   - Say: "Once the final decision is saved, the workflow becomes operational: route, priority, SLA, and booking readiness."
   - Click: Booking and SLA panel.
   - Do not say: "This replaces local booking policy." Say: "It makes the agreed booking route visible."
   - Prepare: Bookable final decision with target date and notes.
   - Risk: If the final outcome is not bookable, explain why.

10. Show audit.
    - Say: "For governance, this is not just a screen. The system stores who did what, when, and exports audit evidence."
    - Click: `/audit`, use a recent case or decision preset.
    - Do not say: "This is a full production compliance sign-off."
    - Prepare: Recent audit events for summary, recommendation, clinician decision, override, and export links.
    - Risk: Empty audit table undermines trust. Seed recent events.

11. Show readiness and rules governance.
    - Say: "This is how we separate product readiness from clinical validation and external dependencies."
    - Click: `/readiness`, then optionally `/rules`.
    - Do not say: "All integrations are live." Say: "The system shows what is ready, what is pending, and what needs external activation."
    - Prepare: Readiness state that clearly distinguishes product-owned vs customer/external items.
    - Risk: Admin dashboard is broad. Prefer `/readiness` for the clean close.

12. Close with the ask.
    - Say: "The next best step is not more broad feature work. It is a controlled Try 1 validation with redacted real cases, named clinical owners, and a validation log against accepted, changed, and unsafe recommendations."
    - Ask for: redacted real cases, clinical validation owners, Table 1 pilot-scope decision, NCSR/history access plan, and agreement on acceptance criteria.

## 4. Wow Moments

| Wow moment | Where it appears | Why business cares | Improvement needed |
| --- | --- | --- | --- |
| One workflow from referral pack to final booking route | `WorkflowGuide`, `/cases/[id]/triage`, `/cases/[id]/grade` | Shows reduced handoffs and a repeatable operating model. | Demo script plus seeded case; small copy polish to call it "case workflow". |
| One-page clinical summary | `/cases/[id]/summary` | Reduces time spent reading referral packs and makes review easier. | Seed richer summaries; add stronger evidence/source count if time allows. |
| Extracted facts with source quotes | `/cases/[id]/evidence` | Builds trust that recommendations are evidence-backed. | Seed source quotes and high-value facts; avoid showing empty evidence. |
| Provisional recommendation with clinician confirmation | `/cases/[id]/grade`, `/cases/[id]/triage` | Shows decision support without replacing clinician accountability. | Make "provisional" and "clinician final decision required" more prominent. |
| Rule release and matched trace | `/cases/[id]/grade`, `/rules` | Proves the rules are versioned, testable, and auditable. | Bring matched branch path higher in the grade screen or demo it directly. |
| Missing information safety outcome | Engine outputs surfaced in grade/triage | Shows the product is safer than a calculator that guesses. | Seed one case with missing NCSR/history or visible lesion and frame it as safety. |
| External dependency transparency | `/cases/[id]/ncsr`, governance panels, `/readiness` | Makes NCSR/history dependency explicit and non-embarrassing. | Use one concise panel in demo; do not dwell on integration gaps. |
| Clinician override with reason | `DecisionSaveForm`, clinician confirmation panel | Shows human-in-the-loop governance and medico-legal defensibility. | Seed one override example with a clinically sensible reason. |
| Audit export | `/audit`, `/api/audit/export` | Gives service managers and governance owners confidence. | Seed meaningful recent events and show JSON/CSV export links briefly. |
| Readiness stop line | `/readiness`, `docs/deployment-and-pilot-runbook.md` | Separates demo readiness from pilot readiness and clinical validation. | Use this as the close, not the opening. |

## 5. Demo Risks

| Risk | Why it matters | Mitigation before demo |
| --- | --- | --- |
| The demo starts in a legacy/manual pathway tool | Business may think the product is only a calculator. | Start in `/dashboard` and `/cases`; keep `/gp` and `/pathway` out of the core demo. |
| Rule visuals look authoritative despite being simplified | Could create clinical trust issues. | When showing `/guidelines`, state that visual figures are under validation and rule output/tests are the source for current implementation review. |
| Empty evidence, summary, or audit screens | Makes the product feel unfinished. | Seed documents, extracted facts, approved summaries, decisions, audit events, and overrides. |
| Dense grade screen overwhelms stakeholders | Important value gets hidden in fields and panels. | Use Guided Triage first; on Grade show only recommendation, trace, clinician confirmation, booking/SLA. |
| Missing information is interpreted as failure | Stakeholders may not see safety value. | Present it as "honest stop condition" and show the exact missing fact/external dependency. |
| NCSR not live appears as product weakness | History dependency is expected in screening workflows. | Frame NCSR as a governed external dependency, not fake data. Show readiness/access controls. |
| Summary generation or ingest takes too long live | Demo timing suffers. | Use pre-generated and pre-approved seed cases; demonstrate the button without relying on it live. |
| Login/demo account confusion | Wastes time and weakens confidence. | Use one known account and keep credentials ready from `docs/deployment-and-pilot-runbook.md`. |
| Clinical audience asks if recommendations are signed off | Overclaim risk. | Repeat: "implemented against supplied figures, awaiting clinical validation." |
| Pilot readiness is confused with demo readiness | Business may expect live use too soon. | Close with validation plan, not production claim. |

## 6. Product Flow Improvements

### Must fix before demo

**1. Curate one primary demo route**

- Rationale: The product has many valid screens, but the demo must feel intentional.
- Suggested files: `app/(app)/dashboard/page.tsx`, `app/(app)/cases/page.tsx`, `app/(app)/cases/[id]/page.tsx`, `app/(app)/cases/[id]/triage/page.tsx`.
- Suggested approach: Use seeded case links or a "Demo-ready cases" queue/filter. If code is not changed, prepare bookmarks and a script.
- Complexity: Small.
- Risk if skipped: Stakeholders may see scattered features rather than one enterprise workflow.
- Classification: Demo-critical.

**2. Seed richer demo cases**

- Rationale: Empty or partial screens undermine the best product story.
- Suggested files: `prisma/seed.ts`, docs/demo notes if maintained.
- Suggested approach: Prepare one clean colposcopy case, one missing NCSR/history case, one clinician override case, one gynaecology summary case, and one governance/readiness example.
- Complexity: Medium.
- Risk if skipped: Evidence, summary, audit, and override screens may look thin.
- Classification: Demo-critical.

**3. Make validation status visible in the main case flow**

- Rationale: The app must stay honest and clinically safe.
- Suggested files: `components/cases/WorkflowGuide.tsx`, `app/(app)/cases/[id]/triage/page.tsx`, `app/(app)/cases/[id]/grade/page.tsx`.
- Suggested approach: Add a concise banner: "Workflow MVP - deterministic rules under clinical validation - clinician final decision required."
- Complexity: Small.
- Risk if skipped: Stakeholders may misunderstand the recommendation as signed-off production guidance.
- Classification: Demo-critical.

**4. Surface missing information and external dependencies clearly**

- Rationale: Safe stopping is a business strength, not an error.
- Suggested files: `app/(app)/cases/[id]/grade/page.tsx`, `app/(app)/cases/[id]/triage/page.tsx`, `components/clinical/DecisionCard.tsx`.
- Suggested approach: Put missing facts and external dependencies in a named safety panel near the recommendation.
- Complexity: Small to medium.
- Risk if skipped: Safety outcomes may be missed or interpreted as generic warnings.
- Classification: Demo-critical and pilot-critical.

**5. Avoid stale visual authority**

- Rationale: The visual diagrams are simplified and not the full source requirement.
- Suggested files: `app/(app)/guidelines/page.tsx`, `lib/decision-trees/index.ts`, `components/clinical/FlowDiagram.tsx`.
- Suggested approach: Keep "Under validation: simplified visual; rule output is source of truth" visible above the diagram, not only in subtitle.
- Complexity: Small.
- Risk if skipped: Clinical stakeholders may audit the diagram instead of the implemented rule trace.
- Classification: Demo-critical.

### High-impact polish before demo

**1. Make Guided Triage the hero workflow**

- Rationale: It is the most coherent single-screen product experience.
- Suggested files: `app/(app)/cases/[id]/triage/page.tsx`, `TriageActionBar`.
- Suggested approach: Add clearer section headings: "Evidence", "Approved summary", "Provisional recommendation", "Clinician decision", "Booking route".
- Complexity: Medium.
- Risk if skipped: Demo still works, but feels more like separate modules.
- Classification: Demo-polish.

**2. Improve recommendation card hierarchy**

- Rationale: Stakeholders need to see outcome, why, facts used, missing facts, and clinician responsibility quickly.
- Suggested files: `app/(app)/cases/[id]/grade/page.tsx`, `components/clinical/DecisionCard.tsx`.
- Suggested approach: Use a compact layout: provisional outcome, source figure/table, rule release, matched branch path, safety flags, next action.
- Complexity: Medium.
- Risk if skipped: The grade page remains impressive but dense.
- Classification: Demo-polish and pilot-critical.

**3. Add a case-level audit shortcut**

- Rationale: Audit is a major enterprise wow moment but currently lives separately.
- Suggested files: `app/(app)/cases/[id]/page.tsx`, `app/(app)/cases/[id]/triage/page.tsx`, `app/(app)/audit/page.tsx`.
- Suggested approach: Add "View audit trail" link filtered by case/entity if supported, or script a direct admin audit view.
- Complexity: Medium.
- Risk if skipped: Audit value may be forgotten during demo.
- Classification: Demo-polish.

**4. Tighten admin/readiness story**

- Rationale: The readiness page is stronger than a broad admin dashboard for executive stakeholders.
- Suggested files: `app/(app)/readiness/page.tsx`, `lib/ops/product-readiness.ts`, `docs/deployment-and-pilot-runbook.md`.
- Suggested approach: Emphasize "ready / pending / blocked", owner, and next action. Keep admin dashboard as appendix.
- Complexity: Small.
- Risk if skipped: Admin looks broad and technical.
- Classification: Demo-polish.

**5. Prepare demo account labels**

- Rationale: Login should feel controlled and enterprise-ready.
- Suggested files: `app/(auth)/login/LoginPageClient.tsx`, `docs/deployment-and-pilot-runbook.md`.
- Suggested approach: Add/prepare labels for Coordinator, Clinical Reviewer, Service Manager/Admin, Integration Admin.
- Complexity: Small.
- Risk if skipped: Presenter may waste time selecting roles.
- Classification: Demo-polish.

### Must fix before real pilot

**1. Clinical validation workflow with acceptance logging**

- Rationale: Real pilot use requires evidence that recommendations were validated and disagreements logged.
- Suggested files: `docs/validation-log-template.md`, `app/(app)/readiness/page.tsx`, future validation workbench.
- Suggested approach: Run Try 1 validation with redacted real cases before live use.
- Complexity: Medium to large.
- Risk if skipped: Product cannot safely be treated as clinically reliable.
- Classification: Pilot-critical.

**2. NCSR/history integration decision**

- Rationale: Many figures require prior history, Test of Cure, hysterectomy, AIS/HSIL, and screening status.
- Suggested files: `app/(app)/cases/[id]/ncsr/page.tsx`, `lib/integrations/colposcopy-registry/*`, `lib/engine/types.ts`.
- Suggested approach: Confirm whether pilot uses live NCSR, manual history entry, or explicit external-history stop states.
- Complexity: Large if live integration; medium if manual validation workflow.
- Risk if skipped: History-dependent pathways cannot be piloted safely.
- Classification: Pilot-critical.

**3. Audit payload review and export for decisions**

- Rationale: Pilot governance needs searchable evidence: input facts, rule version, branch path, missing facts, external flags, override reason.
- Suggested files: `lib/audit.ts`, `app/(app)/audit/page.tsx`, API routes that save summary/rule/decision events.
- Suggested approach: Verify and expose decision-specific audit payloads, not just generic events.
- Complexity: Medium.
- Risk if skipped: Governance owners cannot easily validate decisions after the fact.
- Classification: Pilot-critical.

**4. Structured fact persistence parity**

- Rationale: Rules should depend on structured facts, not unreviewed text.
- Suggested files: `prisma/schema.prisma`, `lib/cases/grading.ts`, `lib/cases/rule-evaluator.ts`, `lib/engine/types.ts`.
- Suggested approach: Ensure all pilot-scope facts are stored, reviewable, and traceable to source/clinician input.
- Complexity: Large.
- Risk if skipped: Decisions may be hard to reproduce.
- Classification: Pilot-critical.

**5. Table 1 pilot-scope decision**

- Rationale: Post-hysterectomy logic is complex and may or may not be phase 1.
- Suggested files: `lib/engine/decision-engine.ts`, `lib/engine/__tests__/table1.test.ts`, `docs/decision-tree-rule-coverage.md`.
- Suggested approach: Confirm whether Table 1 is fully in pilot scope before adding exhaustive literal-row tests and workflows.
- Complexity: Medium.
- Risk if skipped: Total hysterectomy cases may be unsafe for pilot.
- Classification: Pilot-critical.

### Later roadmap

**1. Validation workbench**

- Rationale: Business can run validation sessions without spreadsheets.
- Suggested files: New validation routes, `docs/validation-log-template.md`.
- Complexity: Large.
- Risk if skipped: Validation is still possible manually.
- Classification: Later.

**2. Impact analytics**

- Rationale: Service managers will want time saved, cases routed, overrides, missing-info frequency, and SLA movement.
- Suggested files: `app/(app)/analytics/page.tsx`, reporting libs.
- Complexity: Medium.
- Risk if skipped: Demo still works, but value quantification is weaker.
- Classification: Later.

**3. Live integration expansion**

- Rationale: Production value increases with referral, document, NCSR, and booking integrations.
- Suggested files: integration libs and readiness pages.
- Complexity: Large.
- Risk if skipped: Pilot may rely on manual entry/export.
- Classification: Later/pilot-dependent.

**4. Case-level collaboration and tasking**

- Rationale: Coordinators, CNS, SMO reviewers, and graders need handoffs.
- Suggested files: case workflow/status modules.
- Complexity: Medium.
- Risk if skipped: Manual coordination remains outside the app.
- Classification: Later.

**5. Rule lifecycle UI for clinical owners**

- Rationale: Clinical owners need clearer review, validation, and sign-off controls.
- Suggested files: `app/(app)/rules/page.tsx`, rule release detail pages.
- Complexity: Medium.
- Risk if skipped: Rule governance remains admin/technical.
- Classification: Later.

## 7. UI / Copy Recommendations

Under-validation banner:

> Workflow MVP - rules under clinical validation. Recommendations are provisional and require clinician confirmation before any patient-facing action.

Decision card:

> Provisional recommendation based on the approved summary, structured case facts, rule release, and matched decision-tree branch. Review the evidence and confirm or override before booking.

Missing information state:

> The pathway cannot be safely completed because required information is missing: [facts]. Add the missing information or mark for clinician review. The system has not guessed this branch.

External dependency state:

> External history is required before this pathway can be completed. This may require NCSR or local clinical history review. Until confirmed, treat the recommendation as blocked for validation.

Clinician override:

> You are changing the provisional recommendation. Record the clinical reason so the final decision remains auditable.

Audit trail:

> Audit record includes actor, timestamp, rule release, input facts used, matched branch path, outcome, missing facts, external dependency flags, and override reason where applicable.

Validation readiness:

> Product build is ready for controlled validation. Clinical sign-off, external integrations, and pilot acceptance criteria remain separate stop-line decisions.

Visual decision-tree disclaimer:

> Simplified visual reference under validation. Use the rule trace, source requirements, and validation log for clinical parity review.

Dashboard copy:

> Today’s review queue: cases needing evidence, summary approval, deterministic recommendation, clinician decision, or booking action.

Case status labels:

> Needs evidence -> Ready for summary -> Summary approved -> Ready for grading -> Clinician decision saved -> Booking ready/booked -> Validation logged.

One-page summary heading:

> Clinician-reviewed one-page summary

Evidence traceability heading:

> Source facts used for summary and rules

Branch path heading:

> Matched decision-tree branch

Validation log export:

> Export validation evidence for clinical owner review.

## 8. Seed Data / Demo Data Needed

Clean colposcopy case:

- Documents uploaded and parsed.
- Extracted facts include HPV type, cytology, referral reason, previous history where relevant, source quotes, and page references.
- Summary generated and approved.
- Rule recommendation generated with clear matched trace.
- Clinician decision accepted.
- Booking/SLA visible.

Missing NCSR/history dependency case:

- Colposcopy case where prior high-grade/Test of Cure or screening history is required but unavailable.
- Recommendation should show `EXTERNAL_HISTORY_REQUIRED` or equivalent safety state.
- Governance panel should explain NCSR/history dependency.

Clinician override case:

- Recommendation generated.
- Final clinician decision differs from provisional recommendation.
- Override reason and notes present.
- Audit event available.

Gynaecology summary case:

- Gynaecology referral with documents, one-page summary, workbench facts, and final route/priority.
- Shows the app is not only a cervical screening calculator.

Admin/governance case:

- Recent audit events.
- Rule release active with regression passing.
- Readiness page showing product-owned items, shared/customer items, and external dependencies.
- NCSR certification/access example.

## 9. Final Recommendation

Safe to demo: yes, if the demo is framed as a workflow MVP and rule-validation product, uses curated seed cases, and does not claim clinical sign-off.

Must be fixed or prepared first:

- Curated demo route and bookmarked cases.
- Rich seed data for evidence, summary, recommendation, override, audit, and readiness.
- Visible under-validation/clinician-confirmation message in the case flow or in the presenter script.
- Clear handling of missing information and external-history dependency.
- Avoid showing legacy/manual pathway tools as the main product.

Safe to pilot with real cases: only after clinical validation, agreed pilot scope, NCSR/history strategy, audit payload review, and a controlled validation log process.

Best next step after demo:

Ask business/clinical stakeholders for redacted real cases, named clinical validation owners, Table 1 pilot-scope confirmation, NCSR/history access decision, and agreement to run Try 1 validation using the existing validation log.

## Implementation Update

Implemented demo-readiness changes only, scoped to the "Must fix before demo" items.

Files changed:

- `app/(app)/cases/page.tsx` — added a visible "Demo-ready cases" section linking directly to curated demo cases.
- `app/(app)/cases/[id]/page.tsx` — added workflow MVP / clinical validation banner and audit shortcut.
- `app/(app)/cases/[id]/triage/page.tsx` — added validation banner, audit shortcut, and recommendation safety panel.
- `app/(app)/cases/[id]/grade/page.tsx` — added validation banner, audit shortcut, and recommendation safety panel near the provisional recommendation.
- `components/cases/ClinicalValidationBanner.tsx` — added reusable under-validation / clinician-final-decision banner.
- `components/cases/RecommendationSafetyPanel.tsx` — added reusable missing-information / external-dependency safety panel.
- `lib/cases/grading.ts` — allowed stored recommendation payloads to include optional safety outcome, missing facts, and external dependencies.
- `app/(app)/guidelines/page.tsx` — strengthened simplified-visual / under-validation wording.
- `app/(app)/gp/page.tsx` and `app/(app)/pathway/page.tsx` — clarified these are manual validation tools, not the primary enterprise referral workflow.
- `prisma/seed.ts` — enriched demo seed cases, evidence, summaries, rule payloads, clinician decisions, and audit events.

Seed cases added/updated:

- `DEMO-01-CLEAN-COLPO` — clean colposcopy case with parsed evidence, approved summary, deterministic recommendation, accepted clinician decision, booking/SLA, and audit trail.
- `DEMO-02-MISSING-HISTORY` — missing-history/NCSR dependency case with `EXTERNAL_HISTORY_REQUIRED`, missing facts, external dependency flags, approved summary, evidence, and audit trail.
- `DEMO-03-CLINICIAN-OVERRIDE` — clinician override case with provisional P2 recommendation, final P3 clinician decision, override reason, evidence, summary, booking, and audit trail.
- `DEMO-04-GYNAE-SUMMARY` — gynaecology summary case with parsed ultrasound evidence, approved summary, gynaecology recommendation, clinician decision, and audit trail.
- Existing readiness/governance seed data continues to show integration validation warnings, NCSR certification/access state, security incidents, rule release governance, and audit exports.

Demo route now supported:

`/dashboard -> /cases -> Demo-ready cases -> Guided Triage -> Grade -> Audit -> Readiness`

What remains for pilot:

- Clinical validation with redacted real cases and a signed validation log.
- NCSR/live history strategy or explicit manual-history workflow.
- Decision-specific audit payload review with governance owners.
- Structured fact persistence review for all pilot-scope facts.
- Table 1 pilot-scope confirmation before exhaustive row-level pilot validation.

What remains for clinical validation:

- Confirm all source-figure branches against clinical owners.
- Confirm local service policy deviations, if any.
- Review all safety-stop outcomes and clinician override examples.
- Confirm final wording for patient-facing or booking-facing recommendations.
