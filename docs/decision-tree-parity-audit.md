# Decision Tree Parity Audit

This audit compares the supplied 11 business reference images/table against the codebase. It does not validate the clinical content beyond those supplied sources, and it does not claim that any pathway is clinically complete unless the implementation can be traced in code.

## 1. Executive Summary

The app is directionally aligned as a workflow prototype: it has named pathway figures, structured HPV/cytology/histology enums, a wizard, referrals, recalls, audit records, visual decision trees, and an enterprise case grading/rules area. However, the source images/table are not implemented with parity. Several named functions exist but implement different or simplified logic from the supplied decision trees.

Strongest areas:

- Figure 3 has the broadest implementation for primary HPV screening, including HPV not detected, HPV 16/18, HPV Other, cytology, age >= 50, immunocompromised recall, and repeat-count concepts. It still has important branch and state gaps.
- Figure 7 has meaningful AG2/AC2 direct gynaecology routing and some glandular MDM/biopsy handling, but the UI cannot capture several engine-required MDM states.
- Figure 10 has a recognizable abnormal bleeding branch skeleton, but it is not workflow-ready because it compresses initial assessment and 6-8 week follow-up into one wizard run.
- Core audit/referral/recall records exist, but audit detail is too thin for clinical validation.

Risky or incomplete areas:

- Figures 1 and 2 are transition/invitation/history pathways in the source images, but the app mostly treats them as HPV-result management pathways.
- Figures 4 and 5 are normal-colposcopy follow-up pathways in the supplied images, but the app implements a generic colposcopy/histology and treatment flow instead.
- Figure 6 has a critical Test of Cure mismatch: HPV Other detected at first post-treatment co-test is sent to 12-month repeat, while the supplied image routes HPV detected/any cytology to colposcopy.
- Figure 8 and Table 1 total hysterectomy logic are largely absent. Existing code uses simplified vault HPV/cytology logic and a generic two-negative-co-test table.
- Figure 9 pregnancy routing is too broad and several key branches are reversed or skipped, including invasion impression -> biopsy.
- There are no repo-owned automated tests and no `test` script in `package.json:5-12`.

Fix before showing or piloting with business:

- Correct the critical rule mismatches in Figures 3, 4, 5, 6, 8, 9, 10, and Table 1, or explicitly mark those pathways out of scope/disabled in the UI.
- Add structured fields for screening history, prior abnormal history, Test of Cure state, post-hysterectomy history/specimen/excision state, pregnancy/postpartum state, visible lesion, and staged follow-up.
- Add rule tests for every critical/high branch in the supplied images/table.
- Update stale visual decision trees and GP labels so business users do not see incorrect pathway names or simplified diagrams as authoritative.
- Expand audit logs to include input facts, decision version, branch path, source of history, and clinician override.

Clinical validation rather than code defect:

- Referral priority labels and timing where the image specifies destination but not priority.
- Local Healthcare Pathways handling in Figure 10.
- Extra engine branches not present in the supplied images, such as some CIN2/3, unsatisfactory, and oncology escalation handling.
- Whether HPV 16/18 should require cytology entry before colposcopy in the local workflow.

External dependency:

- NCSR/history access is likely required for prior high-grade history, prior low-grade returned/not returned status, prior AIS, Test of Cure completion, specialist discharge, and hysterectomy history. Current NCSR integration is a stub unless configured and is not fed into screening pathway rules.

## 2. Source Images/Table Reviewed

- Figure 1 - Transition to HPV primary screening.
- Figure 2 - Transition to HPV primary screening for previous high-grade results not returned to regular screening.
- Figure 3 - HPV primary screening pathway for asymptomatic participants.
- Figure 4 - Normal colposcopy after HPV detected + negative/ASC-US/LSIL cytology.
- Figure 5 - Normal colposcopy after HPV detected + cytology >= ASC-H.
- Figure 6 - Test of Cure following treatment for HSIL/CIN2/3.
- Figure 7 - Atypical and abnormal glandular abnormalities.
- Figure 8 - Screening after total hysterectomy.
- Figure 9 - Pregnant participant with possible/definite high-grade in situ cytology.
- Figure 10 - Abnormal vaginal bleeding.
- Table 1 - Vaginal screening after total hysterectomy.

## 3. Repository Areas Inspected

- Database schema/models: `prisma/schema.prisma:48-113`, `prisma/schema.prisma:409-458`, `prisma/schema.prisma:462-529`, `prisma/schema.prisma:669-778`, `prisma/schema.prisma:800-842`, `prisma/schema.prisma:867-930`.
- Core clinical engine: `lib/engine/decision-engine.ts:20-1885`.
- Engine input/output types: `lib/engine/types.ts:4-133`.
- Wizard questions and answer mapping: `lib/wizard/steps.ts:56-572`.
- Wizard completion and persistence: `app/api/pathway/sessions/[id]/complete/route.ts:90-238`.
- Manual rules preview endpoint: `app/api/rules/evaluate/route.ts:14-38`.
- Manual session creation endpoint: `app/api/sessions/route.ts:79-150`.
- GP/manual entry screen: `app/(app)/gp/page.tsx:54-65`, `app/(app)/gp/page.tsx:261-304`.
- Visual decision tree definitions: `lib/decision-trees/index.ts:39-320`.
- Enterprise case rules and grading: `lib/cases/rule-policy.ts`, `lib/cases/rule-evaluator.ts`, `lib/cases/rule-fixtures.ts`, `lib/cases/rule-regression.ts`, `lib/cases/grading.ts:160-215`, `lib/cases/fact-extraction.ts`.
- Case decision/override handling: `lib/cases/decision.ts`, `app/api/cases/[id]/decision/route.ts`.
- Case rule API: `app/api/cases/[id]/rules/evaluate/route.ts`.
- Case grading UI: `app/(app)/cases/[id]/grade/ColposcopyGradeSheetForm.tsx`, `app/(app)/cases/[id]/grade/GynaecologyGradeWorkbenchForm.tsx`.
- NCSR/history integration: `app/api/cases/[id]/ncsr-pull/route.ts`, `app/(app)/cases/[id]/ncsr/NcsrPullClient.tsx`, `lib/integrations/colposcopy-registry/client.ts`, `lib/integrations/colposcopy-registry/access.ts`.
- Seed/demo data: `prisma/seed.ts`.
- Existing documentation reviewed for conflicts/overclaim: `docs/clinical-parity-matrix.md`, `docs/production-readiness-gap-analysis.md`.
- Test coverage: `package.json:5-12`; `rg --files -g '*test*' -g '*spec*' -g '!node_modules/**' -g '!.next/**'` found no repo-owned tests.

## 4. Figure-by-Figure Analysis

### Figure 1 — Transition to HPV primary screening

#### Requirement extracted from image/table

- If participant is never screened, under-screened, or overdue: invite now.
- If participant is regularly screened with normal results, prior low-grade results only, or prior high-grade results with successful Test of Cure completion: invite at next scheduled visit.
- Both invitation branches lead to HPV screening test at next scheduled visit, then Figure 3.

#### Required app fields

- Screening status: never screened, under-screened, overdue, regularly screened.
- Prior normal/low-grade/high-grade history.
- Test of Cure completed successfully.
- Next scheduled visit date.
- Invitation action, date, source, and audit status.
- Source of history, likely manual/NCSR.

#### Current implementation found

- `evaluateFigure1()` exists at `lib/engine/decision-engine.ts:20`.
- The function requires `hpvResult` and branches on HPV/cytology at `lib/engine/decision-engine.ts:23-121`.
- Patient has only `isFirstTimeHPVTransition`, `previousScreeningType`, and `lastCytologyDate` at `prisma/schema.prisma:422-425`.
- Wizard asks first HPV transition at `lib/wizard/steps.ts:97-110`.
- Visual Figure 1 is an HPV-result diagram, not the supplied invitation diagram: `lib/decision-trees/index.ts:39-63`.

#### Gaps or risks

- Critical: The source Figure 1 invitation pathway is not implemented; `evaluateFigure1()` manages HPV results instead of screening-status invitation timing.
- High: No structured `never screened`, `under-screened`, `overdue`, `regular screening`, `prior low-grade only`, or `Test of Cure complete` fields.
- High: No invitation workflow or audit event for "invite now" vs "invite at next scheduled visit".
- Medium: Existing Figure 1 title and diagram can imply parity with the supplied image when the logic differs.
- Medium: NCSR/history access is likely needed but not integrated into this rule.

#### Decision

Implemented but possibly wrong.

#### Recommended action

- Add fields for screening status, prior low/high-grade history, Test of Cure complete, and next scheduled visit.
- Add a Figure 1 invitation rule or mark Figure 1 invitation outside app scope.
- Add tests for never screened/under-screened/overdue and regular screening/Test of Cure complete.
- Add validation log item for history source.
- Mark NCSR/history as an external dependency if the business expects automatic status detection.

### Figure 2 — Transition to HPV primary screening for previous high-grade results not returned to regular screening

#### Requirement extracted from image/table

- Previous possible/definite HSIL or atypical glandular cells, excluding atypical endometrial cells:
  - Refer to colposcopy if recommended in last cytology report and not already occurred, or complete a Test of Cure.
  - Then regular interval screening via Figure 3.
- Previous AIS and no total hysterectomy:
  - Refer to R2.08 post-treatment follow-up.
- Previous atypical endometrial cells not returned to 3-year cytology screening:
  - If report was more than 3 years ago: primary HPV screening at next scheduled visit via Figure 3.
  - If already seen at specialist services and discharged to primary care: primary HPV screening via Figure 3.
  - Otherwise: refer to specialist gynaecologist services.

#### Required app fields

- Prior possible/definite HSIL.
- Prior atypical glandular cells excluding AG2.
- Prior atypical endometrial cells and report date.
- Prior AIS.
- Total hysterectomy status.
- Whether recommended colposcopy already occurred.
- Whether Test of Cure is complete.
- Specialist service seen/discharged status.
- Destination: colposcopy, Test of Cure, specialist gynaecology, R2.08, Figure 3.

#### Current implementation found

- `evaluateFigure2()` exists at `lib/engine/decision-engine.ts:137`.
- AG2/history direct gynaecology routing is implemented at `lib/engine/decision-engine.ts:141-155`.
- The rest of the function branches on current `hpvResult`/`cytologyResult` at `lib/engine/decision-engine.ts:158-213`.
- `MedicalHistory` has broad `previousHighGradeLesion`, `previousTreatment`, `treatmentDate`, and `atypicalEndometrialHistory` at `prisma/schema.prisma:669-680`.
- Wizard asks only AG2 history for transition at `lib/wizard/steps.ts:208-221`.

#### Gaps or risks

- Critical: Prior high-grade/not-returned transition workflow is not implemented; current Figure 2 behaves like current HPV-result triage.
- Critical: No AIS without total hysterectomy -> R2.08 post-treatment follow-up branch.
- High: No field for prior high-grade colposcopy recommended/completed.
- High: No Test of Cure complete/incomplete state for this transition decision.
- High: No AG2 report date or specialist discharge status, so the "more than 3 years" and "otherwise specialist gynaecologist" branches cannot be traced.
- Medium: Existing visual Figure 2 is stale and describes ongoing HPV recall, not the supplied transition image: `lib/decision-trees/index.ts:67-91`.

#### Decision

Implemented but possibly wrong.

#### Recommended action

- Add prior abnormal history fields and source/audit fields.
- Add Figure 2 transition rules before current HPV-result logic or move current logic to the correct figure.
- Add tests for HSIL/atypical glandular, AIS/no hysterectomy, AG2 >3 years, AG2 discharged, and AG2 otherwise specialist gynaecology.
- Request business/clinical confirmation for how R2.08 should appear in the app.
- Mark NCSR/history access as external dependency.

### Figure 3 — HPV primary screening pathway for asymptomatic participants

#### Requirement extracted from image/table

- Primary HPV screening test can be swab taken sample or LBC.
- HPV not detected -> return for screening in 5 years, or 3 years if immune deficient.
- HPV 16/18 -> cytology reported if LBC, then colposcopy.
- HPV detected Other -> cytology; if swab taken sample, return visit with clinical examination.
- HPV Other with negative/ASC-US/LSIL -> first repeat HPV test in 12 months, recommend LBC.
- First repeat:
  - HPV not detected -> return for screening in 5 years or 3 years if immune deficient.
  - HPV 16/18 -> cytology reported if LBC, then colposcopy.
  - HPV Other -> cytology; if possible/definite high grade -> colposcopy.
  - HPV Other with negative/ASC-US/LSIL -> age >= 50 -> colposcopy; age < 50 -> second repeat HPV test in 12 months, recommend LBC.
- Second repeat:
  - HPV not detected -> return for screening.
  - HPV detected any type -> cytology and colposcopy.
- Possible/definite high-grade cytology includes ASC-H, HSIL, SCC, atypical glandular cells, AIS, and adenocarcinoma.
- Specialist referral for atypical or malignant endometrial cells is noted separately.

#### Required app fields

- HPV result: not detected, 16/18, other, inadequate.
- Cytology result: negative, ASC-US, LSIL, ASC-H, HSIL, SCC, glandular/endometrial/AIS/adenocarcinoma.
- Sample type: LBC vs swab.
- Swab return visit/clinical exam complete.
- Repeat stage: baseline, first repeat, second repeat.
- Age >= 50.
- Immune deficient.
- Cytology-reported-if-LBC state.
- Referral/recall destination and interval.

#### Current implementation found

- `evaluateFigure3()` exists at `lib/engine/decision-engine.ts:218`.
- SWAB return-visit gate is implemented at `lib/engine/decision-engine.ts:245-264`.
- HPV not detected with immunocompromised modifier is implemented at `lib/engine/decision-engine.ts:279-314`.
- HPV 16/18 and HPV Other branches are implemented at `lib/engine/decision-engine.ts:334-540`.
- Age >= 50 branch for persistent HPV Other with negative cytology exists at `lib/engine/decision-engine.ts:441-461`.
- Wizard captures sample type, swab return visit, HPV, cytology, pregnancy, Test of Cure, and colposcopy inputs at `lib/wizard/steps.ts:223-458`.
- `answersToInputFields()` maps `swabReturnVisitCompleted` at `lib/wizard/steps.ts:531-533`, but completion route does not pass that field into `ClinicalInput` at `app/api/pathway/sessions/[id]/complete/route.ts:90-118`.

#### Gaps or risks

- Critical: `swabReturnVisitCompleted` is mapped by the wizard but not passed to the engine in the completion route, so SWAB decisions can be blocked or mis-evaluated.
- High: HPV 16/18 without cytology is held pending at `lib/engine/decision-engine.ts:336-346`; the source image routes HPV 16/18 to colposcopy with cytology reported if LBC.
- High: Repeat-stage state is inferred using `consecutiveNegativeCoTestCount`, not explicit first/second repeat state.
- High: Repeat logic is most complete for HPV Other + negative cytology but less explicit for ASC-US/LSIL at first and second repeat.
- High: Second repeat "HPV detected any type -> cytology -> colposcopy" is not modeled as a clear stage transition for all HPV/cytology combinations.
- Medium: Manual `/api/rules/evaluate` does not pass patient age or Figure 10/pregnancy fields and only has a limited input shape: `app/api/rules/evaluate/route.ts:14-34`.
- Medium: Visual Figure 3 is simplified/stale and includes "Repeat HPV - 6 Weeks" code labels not matching the source image: `lib/decision-trees/index.ts:95-123`.

#### Decision

Implemented but possibly wrong.

#### Recommended action

- Pass `swabReturnVisitCompleted` through the completion route.
- Add explicit repeat-stage field and tests for baseline/first/second repeat.
- Add rules/tests for ASC-US and LSIL at first and second repeat.
- Request clinical confirmation on HPV 16/18 with pending cytology vs immediate colposcopy workflow.
- Update visual tree and audit branch path.

### Figure 4 — Normal colposcopy after HPV detected any type and cytology negative/ASC-US/LSIL

#### Requirement extracted from image/table

- Entry: HPV detected any type with cytology negative/ASC-US/LSIL.
- Normal colposcopy.
- Repeat HPV test in 12 months in community care, LBC.
- If HPV not detected -> return to regular interval screening.
- If HPV 16/18 -> colposcopy.
- If HPV Other -> cytology:
  - Cytology >= ASC-H -> colposcopy.
  - Cytology negative/ASC-US/LSIL -> check immune deficient.
    - Immune deficient -> colposcopy.
    - Not immune deficient -> repeat HPV test in 12 months in community care, LBC.
- Second repeat:
  - HPV not detected -> return to regular interval screening.
  - HPV detected any type/any cytology -> colposcopy.

#### Required app fields

- Prior referral reason: HPV detected any type + cytology negative/ASC-US/LSIL.
- Normal colposcopy state.
- Repeat HPV result and cytology after normal colposcopy.
- First vs second repeat after normal colposcopy.
- Immune deficient.
- LBC sample recommendation.
- Colposcopy destination and regular interval screening outcome.

#### Current implementation found

- `evaluateFigure4()` exists at `lib/engine/decision-engine.ts:557`.
- Normal colposcopy returns 12-month co-test at `lib/engine/decision-engine.ts:572-613`.
- Function also contains generic LSIL/biopsy/high-grade/invasion handling at `lib/engine/decision-engine.ts:616-710`.
- DB has `ColposcopyFinding.visibleLesion`, impression, biopsy, and MDM fields at `prisma/schema.prisma:755-778`.
- Wizard completion does not create a `ColposcopyFinding`; it only creates `TestResult`, referral, recall, state history, and audit at `app/api/pathway/sessions/[id]/complete/route.ts:164-238`.

#### Gaps or risks

- Critical: The supplied Figure 4 post-normal-colposcopy surveillance tree is not implemented; the app returns 12-month recall whenever impression is normal.
- Critical: No rule evaluates the repeat HPV/cytology results after normal colposcopy to decide return to regular screening vs colposcopy.
- High: No explicit first/second repeat state after normal colposcopy.
- High: Immune deficient branch after negative/ASC-US/LSIL cytology is not implemented in this Figure 4 context.
- High: Normal colposcopy is not persistently stored as `ColposcopyFinding` by the wizard completion route.
- Medium: Enterprise fact mapping does not map `negative` cytology to a "Normal cytology" fact, while prior-normal-colposcopy case rules expect normal cytology-style facts: `lib/cases/grading.ts:171-189`.

#### Decision

Implemented but possibly wrong.

#### Recommended action

- Add post-normal-colposcopy state and repeat-stage tracking.
- Add Figure 4 rules for HPV not detected, HPV 16/18, HPV Other + cytology >= ASC-H, immune deficient, and second repeat.
- Persist colposcopy findings.
- Add tests for every Figure 4 branch.
- Mark any NCSR dependency for previous normal colposcopy/repeat state.

### Figure 5 — Normal colposcopy after HPV detected any type and cytology >= ASC-H

#### Requirement extracted from image/table

- Entry: HPV detected any type and cytology >= ASC-H.
- Colposcopy.
- MDM case review:
  - Downgraded to LSIL -> follow pathway for LSIL.
  - Upgraded to HSIL -> follow pathway for HSIL and treatment recommended.
  - Confirmed ASC-H -> determine next step based on result.
- Confirmed ASC-H:
  - Treatment deferred.
  - Abnormal cytology, HPV detected, and/or visible lesion -> treatment recommended; consider type 2 excision TZ.
  - HPV not detected and no visible lesion -> Test of Cure/co-testing.
  - HPV detected, normal colposcopy, negative cytology -> repeat colposcopy, HPV, and cytology in 12 months.

#### Required app fields

- Prior HPV detected any type and cytology >= ASC-H.
- Normal colposcopy.
- MDM review outcome: downgraded LSIL, upgraded HSIL, confirmed ASC-H.
- Treatment deferred.
- HPV result after MDM/follow-up.
- Cytology result after MDM/follow-up.
- Visible lesion.
- Transformation zone and type 2 excision consideration.
- Test of Cure/co-testing destination.
- Repeat colposcopy/HPV/cytology in 12 months.

#### Current implementation found

- `evaluateFigure5()` exists at `lib/engine/decision-engine.ts:715`.
- It is biopsy/TZ driven, handling CIN2, CIN3, AIS, SCC, adenocarcinoma, and Type 3 TZ at `lib/engine/decision-engine.ts:718-814`.
- The generic router sends CIN2/CIN3/AIS/cancer/currentFigure Figure 5 to `evaluateFigure5()` at `lib/engine/decision-engine.ts:1841-1858`.
- Wizard MDM options are generic treatment options, not the Figure 5 downgrade/upgrade/confirmed ASC-H options: `lib/wizard/steps.ts:438-458`.

#### Gaps or risks

- Critical: The supplied Figure 5 normal-colposcopy + MDM pathway is not implemented.
- Critical: Normal colposcopy with high-grade cytology can fall into Figure 4 normal-colposcopy 12-month recall rather than Figure 5 MDM review.
- High: MDM outcomes downgraded LSIL, upgraded HSIL, confirmed ASC-H are not captured.
- High: Treatment deferred and visible lesion branches are not modeled.
- High: Test of Cure/co-testing vs repeat colposcopy/HPV/cytology in 12 months is not implemented.
- Medium: Existing Figure 5 diagram is a high-grade colposcopy/treatment diagram rather than the supplied normal-colposcopy MDM tree: `lib/decision-trees/index.ts:155-175`.

#### Decision

Implemented but possibly wrong.

#### Recommended action

- Add Figure 5-specific MDM outcome fields and UI options.
- Add normal-colposcopy/high-grade entry routing before generic Figure 4 handling.
- Add visible lesion, treatment deferred, HPV/cytology follow-up, and Test of Cure/co-testing branches.
- Add tests for downgraded LSIL, upgraded HSIL, confirmed ASC-H with each downstream result.
- Request clinical confirmation for "consider type 2 excision TZ" operational wording.

### Figure 6 — Test of Cure following treatment for HSIL/CIN2/3

#### Requirement extracted from image/table

- Entry: treatment for HSIL/CIN2/3.
- HPV and cytology 6 months post treatment.
- HPV not detected + cytology negative -> repeat cytology and HPV testing in 12 months.
- Second HPV not detected + cytology negative -> return to regular screening.
- HPV detected any cytology -> colposcopy.
- HPV not detected + cytology abnormal -> cytology result decision:
  - Possible/definite high grade -> colposcopy.
  - Low grade -> repeat cytology and HPV testing in 12 months.
- Continue Test of Cure until successful completion where repeat negative results occur.

#### Required app fields

- Treatment for HSIL/CIN2/3.
- Treatment date and 6-month post-treatment eligibility.
- HPV result.
- Cytology result.
- Test of Cure stage/sequence.
- Low-grade vs high-grade cytology.
- Consecutive negative co-test count.
- Referral to colposcopy or return to regular screening.

#### Current implementation found

- `evaluateFigure6()` exists at `lib/engine/decision-engine.ts:819`.
- It handles negative/negative first and second co-test at `lib/engine/decision-engine.ts:839-876`.
- It handles HPV Other with first repeat at 12 months and second persistent HPV Other to colposcopy at `lib/engine/decision-engine.ts:879-912`.
- HPV 16/18 or high-grade cytology goes to urgent colposcopy at `lib/engine/decision-engine.ts:915-929`.
- Wizard has a Test of Cure flag at `lib/wizard/steps.ts:334-349`.
- There is no treatment-date eligibility validation in `ClinicalInput` or the Figure 6 evaluator.

#### Gaps or risks

- Critical: Source Figure 6 routes HPV detected/any cytology to colposcopy; code routes first HPV_OTHER post-treatment to 12-month repeat at `lib/engine/decision-engine.ts:879-912`.
- High: Cytology abnormal with HPV not detected is not fully split into low-grade repeat vs possible/definite high-grade colposcopy.
- High: Treatment date/6-month post-treatment timing is not validated.
- High: Test of Cure state is inferred from generic counters rather than explicit ToC stage.
- Medium: Core screening wizard has no clinician override reason for deviating from a recommendation.
- High: No automated Figure 6 tests.

#### Decision

Implemented but possibly wrong.

#### Recommended action

- Correct HPV detected/any cytology ToC branch or request clinical confirmation if local policy differs from the supplied image.
- Add treatment date and explicit ToC stage.
- Add low-grade/high-grade abnormal cytology handling with tests.
- Add tests for first negative, second negative, HPV detected any cytology, HPV not detected + low-grade cytology, HPV not detected + high-grade cytology.
- Add validation log item for treatment date and source.

### Figure 7 — Atypical and abnormal glandular abnormalities

#### Requirement extracted from image/table

- AG1: atypical endocervical cells.
- AG2: atypical endometrial cells.
- AG3: atypical glandular cells NOS.
- AG4: atypical endocervical cells favouring a neoplastic process.
- AG5: atypical glandular cells favouring a neoplastic process.
- AIS: adenocarcinoma in situ.
- AC1: endocervical adenocarcinoma.
- AC2: endometrial adenocarcinoma.
- AC3: extrauterine adenocarcinoma.
- AC4: adenocarcinoma NOS.
- AG2 and AC2 -> refer to gynaecology.
- AG1, AG3-AG5, AC1, AC3, AC4 -> colposcopy.
- After colposcopy:
  - Visible lesion yes -> biopsy.
    - AIS -> Type 3 excision.
    - Consistent with cancer -> refer to gynaecological oncologist.
  - Visible lesion no -> MDM case review.
    - Cytology confirmed, not AG2 -> Type 3 excision.
    - AG2 cytology confirmed -> investigate further for other gynaecological malignancies.
    - Cytology not confirmed -> repeat colposcopy in 6 months.

#### Required app fields

- Cytology subtype AG1-AG5, AIS, AC1-AC4.
- Visible lesion yes/no.
- Biopsy taken and biopsy result: AIS, consistent with cancer.
- MDM outcome: cytology confirmed not AG2, AG2 cytology confirmed, cytology not confirmed.
- Referral destination: gynaecology, colposcopy, gynaecological oncologist.
- Type 3 excision recommendation.
- Repeat colposcopy in 6 months.
- Audit and override.

#### Current implementation found

- Cytology enums include AG1-AG5 and AC1-AC4 at `lib/engine/types.ts:6-22` and `prisma/schema.prisma:55-72`.
- Histology supports AIS and adenocarcinoma at `lib/engine/types.ts:24-32`.
- `evaluateFigure7()` exists at `lib/engine/decision-engine.ts:950`.
- AG2/AC2 direct gynaecology is implemented at `lib/engine/decision-engine.ts:956-980`.
- Visible-lesion biopsy handling is inferred from `colposcopicImpression` at `lib/engine/decision-engine.ts:983-1091`.
- No-visible-lesion MDM outcome branches exist at `lib/engine/decision-engine.ts:1094-1163`.
- DB has `visibleLesion`, but `ClinicalInput` does not: `prisma/schema.prisma:763-774`, `lib/engine/types.ts:98-102`.
- Wizard MDM options do not include the engine's Figure 7-specific MDM outcome values: `lib/wizard/steps.ts:438-458`.

#### Gaps or risks

- Critical: Figure 7 MDM outcomes expected by the engine are not capturable in the wizard.
- Critical: The MDM step is only visible for AIS/SCC/adenocarcinoma/invasion biopsy cases, not for normal colposcopy/no visible lesion where Figure 7 requires MDM.
- High: `visibleLesion` exists in DB but not in `ClinicalInput`; the engine infers it from colposcopic impression.
- High: Wizard completion does not persist `ColposcopyFinding`.
- High: Cytology labels in the wizard do not match the supplied AG/AC definitions closely enough for validation, for example `AG4 - AIS` and `AC2` high-grade adenocarcinoma wording at `lib/wizard/steps.ts:279-287`.
- High: Visual Figure 7 sends AC2-AC4 to gynaecology, while the source sends only AG2/AC2 to gynaecology: `lib/decision-trees/index.ts:205-225`.
- High: Engine has extra branches not justified by the supplied Figure 7, including CIN2/3 treatment/surveillance, low-grade/normal biopsy MDM, unsatisfactory colposcopy, and AG5/AC4 initial oncology assessment.

#### Decision

Implemented but possibly wrong.

#### Recommended action

- Add a real visible-lesion field into `ClinicalInput`, wizard, persistence, and audit.
- Add Figure 7-specific MDM outcome options and visibility.
- Align AG/AC labels to the supplied image.
- Persist colposcopy findings.
- Add tests for AG2, AC2, AG1/3/4/5/AC1/3/4, visible lesion + AIS, visible lesion + cancer, no lesion + all MDM outcomes.
- Request clinical confirmation for extra code branches not present in the image.

### Figure 8 — Screening after total hysterectomy

#### Requirement extracted from image/table

- Entry: total hysterectomy.
- Negative or unknown prior screening history, prior low-grade returned to regular screening, or treated HSIL/CIN2/3/AIS with Test of Cure complete:
  - Hysterectomy -> assess cervical histology.
  - No cervical pathology -> if screening history known, no further screening; if unknown, HPV test.
  - Unexpected LSIL -> HPV test.
  - Unexpected HSIL/CIN2/3 or AIS -> high-grade post-hysterectomy branch.
  - HPV not detected -> no further screening.
  - HPV detected any type -> follow primary HPV pathway Figure 3.
- Previous low-grade cytology/history not returned to regular screening:
  - Normal/LSIL histology -> HPV test.
  - HSIL/CIN2/3 or AIS -> assess complete excision.
  - Complete excision -> Test of Cure until successful completion.
  - Incomplete excision -> colposcopy.
- Not treated or incomplete Test of Cure for HSIL/CIN2/3 or atypical glandular cytology cells/AIS:
  - No cervical pathology or LSIL/CIN1 -> Test of Cure until successful completion.
  - HSIL/CIN2/3 or AIS -> complete excision decision.
  - Complete -> Test of Cure; incomplete -> colposcopy.

#### Required app fields

- Total vs subtotal hysterectomy.
- Prior screening history category and known/unknown status.
- Prior low-grade returned/not returned.
- Prior HSIL/CIN2/3/AIS and Test of Cure complete/incomplete.
- Prior atypical glandular/AIS untreated/incomplete.
- Cervical histology in hysterectomy specimen.
- Unexpected cervical pathology.
- Complete excision status.
- HPV test result after hysterectomy.
- Destination: no further screening, Figure 3, Test of Cure, colposcopy.

#### Current implementation found

- `evaluateFigure8()` exists at `lib/engine/decision-engine.ts:1252`.
- It only branches on hysterectomy type, HPV result, and high-grade cytology at `lib/engine/decision-engine.ts:1253-1325`.
- HPV not detected returns routine 5-year recall at `lib/engine/decision-engine.ts:1284-1296`.
- HPV 16/18/high-grade returns urgent specialist at `lib/engine/decision-engine.ts:1299-1312`; HPV Other returns repeat vault test at `lib/engine/decision-engine.ts:1315-1325`.
- Patient model has broad hysterectomy fields at `prisma/schema.prisma:427-430`.
- Wizard captures hysterectomy yes/no and type at `lib/wizard/steps.ts:56-80`, and maps type at `lib/wizard/steps.ts:522-528`.
- Completion route does not pass `hysterectomyType` into `ClinicalInput`: `app/api/pathway/sessions/[id]/complete/route.ts:90-118`.

#### Gaps or risks

- Critical: Supplied Figure 8 is not implemented; current logic is simplified post-hysterectomy HPV/vault triage.
- Critical: Source HPV not detected after indicated post-hysterectomy HPV test -> no further screening; code returns 5-year recall.
- Critical: Source HPV detected any type -> follow Figure 3; code routes HPV 16/18/high-grade to urgent specialist and HPV Other to 12-month vault repeat.
- Critical: No rule for cervical histology after hysterectomy or complete/incomplete excision.
- High: No structured prior-history categories, screening-history-known flag, or Test of Cure completion.
- High: Patient registration captures only `isPostHysterectomy`, not total/subtotal or Figure 8 history fields.
- Medium: Visual Figure 8 is vault cytology surveillance, not the supplied history/histology pathway: `lib/decision-trees/index.ts:229-249`.

#### Decision

Implemented but possibly wrong.

#### Recommended action

- Add Figure 8/Table 1 structured fields for hysterectomy pathway.
- Correct HPV not detected and HPV detected outcomes to match supplied Figure 8, or request clinical confirmation if local policy differs.
- Pass and persist hysterectomy type.
- Add rules for prior history, cervical histology, complete excision, Test of Cure, and colposcopy.
- Add tests for each Figure 8 branch.
- Mark prior history/histology source as NCSR/manual external dependency.

### Figure 9 — Pregnant participant with possible/definite high-grade in situ cytology

#### Requirement extracted from image/table

- Entry: pregnant participant with ASC-H, HSIL, atypical glandular cells, or AIS cytology.
- Initial action: colposcopy.
- Normal TZ/no visible lesion -> MDM case review:
  - Downgraded to negative -> follow HPV primary screening Figure 3.
  - Downgraded to LSIL/ASC-US -> follow LSIL pathway.
  - Confirmed possible/definite high-grade -> colposcopy review in 6 months or at 6-12 weeks postpartum.
- Abnormal TZ/visible lesion -> colposcopic impression:
  - LSIL, HSIL/CIN2/3, or AIS -> colposcopy review in 6 months or at 6-12 weeks postpartum.
  - Invasion -> biopsy.
  - Biopsy positive for invasion -> refer to Gynaecological Oncologist.
  - Biopsy negative for invasion -> MDM case review.

#### Required app fields

- Pregnancy status.
- Qualifying high-grade cytology.
- Colposcopy performed.
- Normal vs abnormal TZ and/or visible lesion.
- Colposcopic impression including AIS and invasion.
- Biopsy taken and invasion positive/negative.
- MDM outcome: downgraded negative, downgraded LSIL/ASC-US, confirmed high-grade.
- EDD/delivery/postpartum date or review timing.
- Oncology referral.

#### Current implementation found

- `evaluateFigure9()` exists at `lib/engine/decision-engine.ts:1333`.
- Router sends any `isPregnant` or explicit Figure 9 case to Figure 9 at `lib/engine/decision-engine.ts:1798-1805`.
- No-colposcopic-impression or normal impression returns MDM pending at `lib/engine/decision-engine.ts:1360-1423`.
- Invasion impression or invasive biopsy returns urgent oncology at `lib/engine/decision-engine.ts:1336-1357`.
- Abnormal TZ/colposcopic abnormality branch sends LSIL/HSIL/unsatisfactory impression to biopsy at `lib/engine/decision-engine.ts:1463-1477`.
- Wizard asks pregnancy for high-grade cytology or HPV 16/18 at `lib/wizard/steps.ts:298-315`.
- `ColposcopicImpression` enum has no AIS value: `prisma/schema.prisma:85-90`.

#### Gaps or risks

- Critical: Initial Figure 9 entry can route to MDM pending instead of first colposcopy when no colposcopy findings exist.
- Critical: Invasion impression skips required biopsy and goes directly to oncology.
- Critical: Abnormal TZ with LSIL/HSIL/AIS impression should route to colposcopy review, not biopsy, unless invasion is suspected.
- High: Entry criteria are too broad; any pregnancy routes to Figure 9 regardless of qualifying cytology.
- High: Wizard allows pregnancy route for HPV 16/18 alone, which is not the Figure 9 source entry criterion.
- High: AIS colposcopic impression cannot be captured.
- Medium: No postpartum date/timing field; app uses a generic 6-month recall.
- Medium: Wizard completion does not persist structured colposcopy findings.

#### Decision

Implemented but possibly wrong.

#### Recommended action

- Gate Figure 9 on pregnancy plus qualifying cytology.
- Return initial eligible pregnant cases to colposcopy before MDM.
- Add abnormal/normal TZ, visible lesion, AIS impression, biopsy positive/negative invasion, and postpartum timing fields.
- Correct invasion -> biopsy -> oncology/MDM branch.
- Add tests for every Figure 9 branch.
- Request clinical confirmation for biopsy behavior in pregnancy before hard-coding beyond the supplied image.

### Figure 10 — Abnormal vaginal bleeding

#### Requirement extracted from image/table

- Entry: abnormal vaginal bleeding, inter-menstrual or post-coital.
- Refer for gynaecological assessment without delay if signs/symptoms of cervical cancer.
- Initial workup: menstrual, contraceptive, sexual history; speculum exam; pelvic exam; co-test.
- Abnormal cervix:
  - Suspicion of cancer yes -> co-test and colposcopy.
  - Suspicion of cancer no -> treat per Healthcare Pathways or refer to gynaecology, then assess bleeding resolution at 6-8 weeks.
- Normal cervix:
  - Suspect oral contraceptive problem -> adjust oral contraceptive, then assess bleeding resolution at 6-8 weeks.
  - No OCP issue -> investigations per Healthcare Pathways or local gynaecology; if STI identified, treat STI.
- Bleeding resolved in 6-8 weeks -> continue regular cervical screening if >=25 or commence at age 25.
- Bleeding not resolved -> refer to gynaecology.

#### Required app fields

- Abnormal vaginal bleeding present.
- Bleeding type: inter-menstrual, post-coital, both.
- Signs/symptoms of cervical cancer.
- Menstrual, contraceptive, sexual history captured.
- Speculum and pelvic exam completion.
- Co-test completion and result.
- Abnormal cervix.
- Suspicion of cancer.
- OCP problem suspected and adjustment date.
- STI identified and treatment date.
- 6-8 week review due date and bleeding resolved outcome.
- Age >= 25.
- Gynaecology/colposcopy destination.

#### Current implementation found

- Figure 10 input fields are in `ClinicalInput` at `lib/engine/types.ts:82-88`.
- `evaluateFigure10()` exists at `lib/engine/decision-engine.ts:1501`.
- It implements abnormal cervix/cancer, OCP, STI, no-STI, bleeding resolved/unresolved, and initial assessment at `lib/engine/decision-engine.ts:1510-1716`.
- Wizard asks abnormal bleeding questions at `lib/wizard/steps.ts:112-206` and maps them at `lib/wizard/steps.ts:540-558`.
- The router enters Figure 10 after the age gate at `lib/engine/decision-engine.ts:1746-1814`.
- The GP page labels Figure 10 as "Post-hysterectomy Follow-up" at `app/(app)/gp/page.tsx:54-65`.

#### Gaps or risks

- Critical: The wizard requires `bleeding_resolved` during the same workflow for branches that should first produce an interim treat/adjust/investigate and 6-8 week review plan.
- High: Figure 10 requires co-test as part of initial workup, but wizard hides sample type, HPV, and cytology when abnormal bleeding is present: `lib/wizard/steps.ts:223-264`, `lib/wizard/steps.ts:266-295`.
- High: Cancer-symptom escalation is only modeled under abnormal cervix, while the image note is broader.
- High: Resolved bleeding branches hard-code 36-month recall, while the image says continue regular cervical screening if >=25 or commence at 25.
- High: Manual GP entry can force Figure 10 but cannot provide Figure 10-specific fields and has the wrong label.
- Medium: Bleeding type, history completion, exam completion, co-test completion, treatment dates, and 6-8 week due date are not structured.
- Medium: Visual Figure 10 is stale and shows 3-month recall codes rather than the source flow: `lib/decision-trees/index.ts:277-301`.

#### Decision

Implemented but possibly wrong.

#### Recommended action

- Split Figure 10 into an initial assessment workflow and a 6-8 week follow-up workflow/task.
- Capture bleeding type, cancer symptoms, history/exam/co-test completion, STI/OCP treatment, review due date, and resolution.
- Expose Figure 10 fields in GP/manual API or remove the ability to force Figure 10 from GP form.
- Correct GP label and visual tree.
- Add branch tests for abnormal cervix/cancer, abnormal cervix/no cancer, OCP, STI, no STI, resolved, unresolved.
- Request business confirmation on how local Healthcare Pathways should be represented.

### Table 1 — Vaginal screening after total hysterectomy

#### Requirement extracted from image/table

- Table 1 requires follow-up after total hysterectomy based on prior screening history, indication for hysterectomy, cervical pathology in specimen, and excision completeness.
- Negative/previous ASC-US/LSIL returned to regular screening + benign indication:
  - No cervical pathology -> no further screening.
  - LSIL/CIN1 excised or not -> HPV test, follow Figure 3.
  - HSIL/CIN2/3 or AIS completely excised -> Test of Cure.
  - HSIL/CIN2/3 or AIS incompletely excised -> colposcopy.
- Previous ASC-US/LSIL not returned to regular screening + benign indication:
  - No pathology or LSIL/CIN1 -> HPV test, follow Figure 3.
  - HSIL/AIS complete -> Test of Cure.
  - HSIL/AIS incomplete -> colposcopy.
- Treated HSIL/CIN2/3 with completed Test of Cure + benign indication:
  - No pathology -> no further screening.
  - LSIL/CIN1 -> HPV test, follow Figure 3.
  - HSIL/AIS complete -> Test of Cure.
  - HSIL/AIS incomplete -> colposcopy.
- Abnormal screening with diagnosed HSIL/CIN2/3 or AIS before hysterectomy, untreated/incompletely treated:
  - No pathology or low grade -> Test of Cure.
  - HSIL/AIS complete -> Test of Cure.
  - HSIL/AIS incomplete -> colposcopy.
- Previous treatment for HSIL/CIN2/3 or AIS with incomplete Test of Cure:
  - No pathology/low grade or HSIL/AIS complete -> Test of Cure.
  - HSIL/AIS incomplete -> colposcopy.
- No known screening history:
  - No pathology or low grade -> HPV at 6 months post hysterectomy.
  - HSIL/AIS complete -> Test of Cure.
  - HSIL/AIS incomplete -> colposcopy.

#### Required app fields

- Total hysterectomy confirmed.
- Hysterectomy date.
- Prior screening history category.
- Indication for hysterectomy.
- Cervical pathology in specimen.
- Excision completeness.
- Test of Cure complete/incomplete.
- HPV at 6 months post hysterectomy.
- Destination: no further screening, Figure 3, Test of Cure, colposcopy.
- Evidence source and audit trail.

#### Current implementation found

- `PathwayFigure.TABLE_1` exists at `lib/engine/types.ts:38-49` and `prisma/schema.prisma:102-113`.
- `evaluateTable1()` only checks `consecutiveNegativeCoTestCount >= 2` and otherwise delegates to Figure 3: `lib/engine/decision-engine.ts:1721-1741`.
- Post-hysterectomy patients route to Figure 8 before Table 1 at `lib/engine/decision-engine.ts:1825-1828`; Table 1 routing is later at `lib/engine/decision-engine.ts:1871-1874`.
- Required Table 1 axes are absent from `ClinicalInput`: `lib/engine/types.ts:54-103`.
- Wizard captures only hysterectomy yes/no and type: `lib/wizard/steps.ts:56-80`.

#### Gaps or risks

- Critical: Supplied Table 1 is not implemented.
- Critical: Actual post-hysterectomy patients cannot practically reach Table 1 because Figure 8 routing happens first.
- Critical: No structured fields exist for the Table 1 decision axes.
- High: No complete excision -> Test of Cure or incomplete excision -> colposcopy rule.
- High: No no-known-history -> HPV at 6 months post hysterectomy rule.
- High: Total/subtotal hysterectomy wiring is inconsistent between wizard, completion route, and patient API.
- Medium: No Table 1 demo data or tests.

#### Decision

Implemented but possibly wrong.

#### Recommended action

- Replace `evaluateTable1()` with a Table 1-specific evaluator.
- Make Table 1/Figure 8 post-hysterectomy routing explicit and consistent.
- Add fields for prior history category, hysterectomy indication, specimen pathology, excision completeness, ToC status, and history source.
- Add tests for every row group in Table 1.
- Treat prior history/Test of Cure completeness as NCSR or clinically validated manual-entry dependency.

## 5. Cross-Figure Logic Conflicts

- Figure 8 vs Table 1: both govern total hysterectomy follow-up, but code has separate simplified implementations. Figure 8 routes before Table 1, making Table 1 unreachable for ordinary post-hysterectomy cases. Ask business: should Table 1 be the governing rule table for Figure 8 implementation?
- Figure 2 vs Figure 3: Figure 2 controls transition for prior high-grade/AIS/AG2 histories, but code routes first-time transition largely by `atypicalEndometrialHistory` and current HPV result. Ask business: is NCSR required before a patient can be safely routed from Figure 2 to Figure 3?
- Figure 3 vs Figure 4: Figure 3 sends persistent HPV/cytology combinations to colposcopy; Figure 4 then requires post-normal-colposcopy repeat HPV/cytology state. Code does not carry enough explicit state to know that the repeat belongs to Figure 4.
- Figure 5 vs Figure 6: Figure 5 can lead to treatment/Test of Cure, but current Figure 5 does not implement the normal-colposcopy high-grade MDM pathway and Figure 6 has a supplied-image mismatch for HPV detected/any cytology.
- Figure 7 vs general colposcopy routing: glandular cytology is routed to Figure 7 after first-time transition and after pregnancy/bleeding routing. A transition case with glandular cytology may be handled by Figure 1/2 before Figure 7. Ask business/clinical team which route has precedence.
- Figure 9 vs ordinary ASC-H/HSIL handling: any pregnancy currently triggers Figure 9, not only pregnancy plus qualifying high-grade cytology. Ask whether pregnancy pathway should be active only for ASC-H/HSIL/glandular/AIS.
- Figure 10 vs general gynaecology/AUB flow: enterprise case rules have AUB/IMB/PMB triage, while screening wizard Figure 10 is a staged investigation pathway. Ask whether abnormal vaginal bleeding is pilot scope in the screening app or should remain a separate gynaecology pathway.

## 6. Missing Structured Fields Matrix

| Field | Needed for figures | Present in DB? | Present in UI? | Present in rules? | Gap? | Severity |
| --- | --- | --- | --- | --- | --- | --- |
| screening status | Fig 1, Fig 2, Fig 8, Table 1 | No | No | No | Yes | Critical |
| never screened / under-screened / overdue | Fig 1 | No | No | No | Yes | Critical |
| regular screening | Fig 1, Fig 2, Fig 8, Table 1 | No | No | Partial text only | Yes | High |
| prior low-grade result | Fig 1, Fig 2, Fig 8, Table 1 | No | No | Partial current cytology only | Yes | High |
| prior high-grade result | Fig 1, Fig 2, Fig 8, Table 1 | Partial `previousHighGradeLesion` | No | No | Yes | High |
| Test of Cure complete/incomplete | Fig 1, Fig 2, Fig 6, Fig 8, Table 1 | No explicit completion state | Partial `is_test_of_cure` | Partial counters | Yes | Critical |
| total hysterectomy | Fig 8, Table 1 | Partial `isPostHysterectomy`, `hysterectomyType` | Partial wizard | Partial Figure 8 | Yes | High |
| screening history known/unknown | Fig 8, Table 1 | No | No | No | Yes | High |
| prior AIS | Fig 2, Fig 8, Table 1 | No history field | No | Partial current histology only | Yes | High |
| prior HSIL/CIN2/3 | Fig 2, Fig 6, Fig 8, Table 1 | Partial generic high-grade | No | Partial current histology only | Yes | High |
| prior atypical glandular cells | Fig 2, Fig 8 | No | No | Partial current cytology only | Yes | High |
| prior atypical endometrial cells | Fig 2, Fig 7 | Partial `atypicalEndometrialHistory` | Partial wizard | Partial AG2 routing | Yes | Medium |
| HPV 16/18 | Fig 3, Fig 4, Fig 6, Fig 8 | Yes | Yes | Yes | Some branch mismatches | High |
| HPV other | Fig 3, Fig 4, Fig 6, Fig 8 | Yes | Yes | Yes | Figure 6/8 mismatch | Critical |
| HPV not detected | Fig 3, Fig 4, Fig 6, Fig 8 | Yes | Yes | Yes | Figure 8 outcome mismatch | Critical |
| cytology negative | Fig 3, Fig 4, Fig 5, Fig 6 | Yes | Yes | Yes | Enterprise mapping gap | Medium |
| ASC-US | Fig 3, Fig 4, Fig 5, Fig 9 | Yes | Yes | Partial | Repeat-stage gaps | High |
| LSIL | Fig 3, Fig 4, Fig 5, Fig 9 | Yes | Yes | Partial | Repeat-stage gaps | High |
| ASC-H | Fig 3, Fig 5, Fig 9 | Yes | Yes | Partial | Figure 5/9 mismatch | Critical |
| HSIL | Fig 3, Fig 5, Fig 6, Fig 9 | Yes | Yes | Partial | Figure 5/9 mismatch | Critical |
| SCC | Fig 3, Fig 6, Fig 7 | Yes | Yes | Yes | Needs source confirmation outside image | Medium |
| atypical glandular cells | Fig 3, Fig 7, Fig 9 | Partial AG codes | Partial labels mismatch | Partial | Label/state gap | High |
| atypical endometrial cells | Fig 2, Fig 7 | Partial AG2 | Partial | Partial | Date/discharge missing | High |
| AIS | Fig 2, Fig 5, Fig 7, Fig 8, Fig 9, Table 1 | Histology only; no cytology AIS | Partial via labels | Partial | AIS impression/history missing | High |
| adenocarcinoma | Fig 3, Fig 7 | Histology AC codes partial | Partial labels mismatch | Partial | Needs terminology alignment | High |
| LBC vs swab | Fig 3, Fig 4 | Yes | Yes | Partial | SWAB plumbing gap | Critical |
| first repeat vs second repeat | Fig 3, Fig 4, Fig 6 | No explicit stage | No | Partial counters | Yes | High |
| immune deficient | Fig 3, Fig 4 | Partial `immunocompromised` | Yes | Partial | Figure 4 context missing | High |
| age >= 50 | Fig 3 | Derived age | No direct | Partial | Manual API lacks age | Medium |
| pregnancy | Fig 9 | No durable patient field | Wizard yes | Too broad | Yes | High |
| postpartum review timing | Fig 9 | No | No | Generic 6 months | Yes | High |
| normal colposcopy | Fig 4, Fig 5, Fig 7, Fig 9 | Partial impression | Wizard yes | Partial | Persistence/state gap | High |
| visible lesion | Fig 5, Fig 7, Fig 9 | Yes in `ColposcopyFinding` | No | No explicit input | Yes | High |
| transformation zone normal/abnormal | Fig 9 | Partial TZ type | Partial TZ type | Not same as normal/abnormal TZ | Yes | High |
| colposcopic impression | Fig 4, Fig 5, Fig 7, Fig 9 | Yes | Yes | Yes | AIS option missing | High |
| biopsy result | Fig 5, Fig 7, Fig 9 | Yes | Yes | Yes | Invasion positive/negative not explicit | High |
| invasion suspected | Fig 7, Fig 9, Fig 10 | Partial impression/cancer suspicion | Partial | Partial | Branch mismatches | Critical |
| MDM review outcome | Fig 5, Fig 7, Fig 9 | Generic string | Partial/generic | Partial but value mismatch | Yes | Critical |
| complete excision | Fig 5, Fig 8, Table 1 | No | No | No | Yes | Critical |
| abnormal vaginal bleeding | Fig 10 | WizardAnswer only | Yes | Yes | No durable structured model | Medium |
| post-coital bleeding | Fig 10 | No | No | No | Yes | Medium |
| inter-menstrual bleeding | Fig 10 | No | No | No | Yes | Medium |
| abnormal cervix | Fig 10 | WizardAnswer only | Yes | Yes | Durable field missing | Medium |
| suspicion of cancer | Fig 10 | WizardAnswer only; case `highSuspicionCancer` separate | Partial | Partial | Too narrow | High |
| STI identified | Fig 10 | WizardAnswer only | Yes | Yes | Follow-up staging missing | Medium |
| oral contraceptive problem | Fig 10 | WizardAnswer only | Yes | Yes | Follow-up staging missing | Medium |
| bleeding resolved in 6-8 weeks | Fig 10 | WizardAnswer only | Yes but same-run | Yes | Staged workflow missing | Critical |

## 7. Rules Coverage Matrix

| Source | Branch / condition | Expected outcome | Code location | Status | Severity | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Figure 1 | Never screened, under-screened, or overdue | Invite now, then Figure 3 HPV test | No matching branch; `evaluateFigure1()` at `lib/engine/decision-engine.ts:20` requires HPV result | Missing | Critical | Invitation workflow absent |
| Figure 1 | Regular normal/low-grade/high-grade with successful ToC | Invite at next scheduled visit, then Figure 3 | No matching branch | Missing | High | Needs history and schedule state |
| Figure 1 | First HPV transition current HPV not detected | Not a Figure 1 image branch | `lib/engine/decision-engine.ts:35-47` | Implemented but possibly wrong | High | Code implements different pathway |
| Figure 2 | Prior HSIL/atypical glandular excluding AG2, colpo recommended not done | Refer to colposcopy | No matching prior-history branch | Missing | Critical | Current code uses HPV result |
| Figure 2 | Prior HSIL/atypical glandular excluding AG2 | Complete Test of Cure, then Figure 3 | No ToC completion rule | Missing | Critical | External history needed |
| Figure 2 | Prior AIS without total hysterectomy | R2.08 post-treatment follow-up | No matching branch | Missing | High | Needs business mapping for R2.08 |
| Figure 2 | Prior AG2 >3 years ago | Figure 3 | No AG2 report-date field | Missing | High | Current AG2 history routes gynaecology |
| Figure 2 | Prior AG2 discharged to primary care | Figure 3 | No discharged field | Missing | High | NCSR/specialist dependency |
| Figure 2 | Prior AG2 otherwise | Specialist gynaecologist services | `lib/engine/decision-engine.ts:141-155` | Partially implemented | Medium | Direct gynae exists, but exceptions missing |
| Figure 3 | HPV not detected | 5-year recall, 3-year if immune deficient | `lib/engine/decision-engine.ts:279-314` | Partially implemented | Low | Directionally matches source |
| Figure 3 | HPV 16/18 | Cytology reported if LBC, colposcopy | `lib/engine/decision-engine.ts:334-400` | Implemented but possibly wrong | High | Pending cytology can block referral |
| Figure 3 | HPV Other, cytology missing | Cytology/return clinical exam if swab | `lib/engine/decision-engine.ts:245-264`, `403-416` | Partially implemented | Critical | SWAB field not passed by completion route |
| Figure 3 | HPV Other + negative/ASC-US/LSIL baseline | First repeat in 12 months, recommend LBC | `lib/engine/decision-engine.ts:418-522` | Partially implemented | Medium | Negative and low-grade covered; explicit ASC-US/LSIL repeat state weak |
| Figure 3 | First repeat HPV not detected | Return to screening | `lib/engine/decision-engine.ts:279-314` | Partially implemented | Medium | Uses generic counter state |
| Figure 3 | First repeat HPV Other + negative/ASC-US/LSIL, age >= 50 | Colposcopy | `lib/engine/decision-engine.ts:441-461` | Partially implemented | High | Implemented for negative; not explicit ASC-US/LSIL |
| Figure 3 | Second repeat HPV detected any type | Cytology then colposcopy | `lib/engine/decision-engine.ts:421-439` | Partially implemented | High | Implemented mainly for HPV Other + negative |
| Figure 3 | Possible/definite high-grade cytology | Colposcopy | `lib/engine/decision-engine.ts:367-382`, `525-540` | Partially implemented | Medium | Glandular/endometrial special routing needs validation |
| Figure 4 | Normal colpo after HPV detected + negative/ASC-US/LSIL | Repeat HPV in 12 months LBC | `lib/engine/decision-engine.ts:572-613` | Partially implemented | Medium | First step only |
| Figure 4 | Repeat HPV not detected | Return to regular interval screening | No Figure 4 repeat branch | Missing | Critical | Current normal colpo always recall |
| Figure 4 | Repeat HPV 16/18 | Colposcopy | No Figure 4 repeat branch | Missing | Critical | Needs post-colpo repeat state |
| Figure 4 | Repeat HPV Other + cytology >= ASC-H | Colposcopy | No Figure 4 repeat branch | Missing | Critical | |
| Figure 4 | Repeat HPV Other + negative/ASC-US/LSIL + immune deficient | Colposcopy | No Figure 4 immune repeat branch | Missing | High | |
| Figure 4 | Second repeat HPV detected any type/any cytology | Colposcopy | No second-repeat branch | Missing | Critical | |
| Figure 5 | MDM downgraded to LSIL | Follow LSIL pathway | No Figure 5 MDM outcome | Missing | Critical | |
| Figure 5 | MDM upgraded to HSIL | Follow HSIL pathway; treatment recommended | No Figure 5 MDM outcome | Missing | Critical | |
| Figure 5 | Confirmed ASC-H, abnormal cytology/HPV/visible lesion | Treatment recommended; consider type 2 excision TZ | No matching branch | Missing | Critical | |
| Figure 5 | Confirmed ASC-H, HPV not detected/no lesion | Test of Cure/co-testing | No matching branch | Missing | High | |
| Figure 5 | Confirmed ASC-H, HPV detected/normal colpo/negative cytology | Repeat colpo, HPV, cytology in 12 months | No matching branch | Missing | High | |
| Figure 5 | CIN2/CIN3 biopsy | Treatment | `lib/engine/decision-engine.ts:736-767` | Implemented but different source branch | Medium | May be valid elsewhere, not source Figure 5 |
| Figure 6 | First post-treatment HPV not detected + cytology negative | Repeat co-test in 12 months | `lib/engine/decision-engine.ts:839-855` | Partially implemented | Low | Needs treatment date validation |
| Figure 6 | Second negative co-test | Return to regular screening | `lib/engine/decision-engine.ts:857-876` | Partially implemented | Low | Uses counters |
| Figure 6 | HPV detected any cytology | Colposcopy | `lib/engine/decision-engine.ts:879-912`, `915-929` | Implemented but possibly wrong | Critical | HPV Other first positive repeats instead |
| Figure 6 | HPV not detected + high-grade cytology | Colposcopy | `lib/engine/decision-engine.ts:915-929` | Partially implemented | High | If cytology is high-grade |
| Figure 6 | HPV not detected + low-grade cytology | Repeat co-test 12 months | `lib/engine/decision-engine.ts:932-942` | Partially implemented | Medium | Generic abnormal branch |
| Figure 7 | AG2/AC2 | Refer to gynaecology | `lib/engine/decision-engine.ts:956-980` | Partially implemented | Low | Core routing exists |
| Figure 7 | AG1/AG3-AG5/AC1/AC3/AC4 | Colposcopy | `lib/engine/decision-engine.ts:1182-1247` | Partially implemented | High | Some extra oncology/priority behavior not in image |
| Figure 7 | Visible lesion -> biopsy | Biopsy | `lib/engine/decision-engine.ts:983-1091` | Partially implemented | High | Visible lesion inferred, not structured |
| Figure 7 | Biopsy AIS | Type 3 excision | `lib/engine/decision-engine.ts:1007-1025` | Partially implemented | Medium | Recommends MDM/excision |
| Figure 7 | Biopsy cancer | Gynaecological oncologist | `lib/engine/decision-engine.ts:1027-1043` | Implemented | Low | |
| Figure 7 | No visible lesion -> MDM | MDM case review | `lib/engine/decision-engine.ts:1094-1163` | Partially implemented | Critical | UI cannot capture outcomes |
| Figure 7 | MDM confirmed not AG2 | Type 3 excision | `lib/engine/decision-engine.ts:1097-1111` | Partially implemented | Critical | Engine-only value |
| Figure 7 | MDM AG2 confirmed | Investigate other gynaecological malignancies | `lib/engine/decision-engine.ts:1114-1131` | Partially implemented | Critical | Engine-only value |
| Figure 7 | MDM cytology not confirmed | Repeat colposcopy 6 months | `lib/engine/decision-engine.ts:1134-1146` | Partially implemented | Critical | Engine-only value |
| Figure 8 | Known history + no cervical pathology | No further screening | No matching branch | Missing | Critical | |
| Figure 8 | Unknown history + no cervical pathology | HPV test | No matching branch | Missing | High | |
| Figure 8 | HPV not detected | No further screening | `lib/engine/decision-engine.ts:1284-1296` | Implemented but wrong | Critical | Code returns 5-year recall |
| Figure 8 | HPV detected any type | Follow Figure 3 | `lib/engine/decision-engine.ts:1299-1325` | Implemented but wrong | Critical | Code routes specialist/repeat vault |
| Figure 8 | HSIL/AIS histology + complete excision | Test of Cure | No matching branch | Missing | Critical | |
| Figure 8 | HSIL/AIS histology + incomplete excision | Colposcopy | No matching branch | Missing | Critical | |
| Figure 8 | No pathology/LSIL with untreated/incomplete ToC history | Test of Cure | No matching branch | Missing | Critical | |
| Figure 9 | Pregnant + ASC-H/HSIL/glandular/AIS | Initial colposcopy | `lib/engine/decision-engine.ts:1360-1423`, `1480-1493` | Implemented but wrong | Critical | No impression returns MDM, not colposcopy |
| Figure 9 | Normal TZ -> MDM downgraded negative | Figure 3 | `lib/engine/decision-engine.ts:1363-1374` | Partially implemented | Medium | Requires MDM value |
| Figure 9 | Normal TZ -> downgraded LSIL/ASC-US | LSIL pathway | `lib/engine/decision-engine.ts:1377-1388` | Partially implemented | Medium | |
| Figure 9 | Normal TZ -> confirmed high-grade | Colposcopy review 6 months or 6-12 weeks postpartum | `lib/engine/decision-engine.ts:1391-1406` | Partially implemented | High | No postpartum date |
| Figure 9 | Abnormal TZ LSIL/HSIL/AIS impression | Colposcopy review | `lib/engine/decision-engine.ts:1463-1477` | Implemented but wrong | Critical | Code says biopsy required |
| Figure 9 | Invasion impression | Biopsy | `lib/engine/decision-engine.ts:1336-1357` | Implemented but wrong | Critical | Code goes direct oncology |
| Figure 9 | Biopsy positive invasion | Gynae oncologist | `lib/engine/decision-engine.ts:1336-1357` | Partially implemented | Medium | Works for invasive histology |
| Figure 9 | Biopsy negative invasion | MDM case review | `lib/engine/decision-engine.ts:1429-1460` | Partially implemented | Medium | |
| Figure 10 | Initial abnormal bleeding | History, exams, co-test | `lib/engine/decision-engine.ts:1704-1716` | Partially implemented | High | UI hides co-test result fields |
| Figure 10 | Abnormal cervix + cancer suspicion | Co-test and colposcopy | `lib/engine/decision-engine.ts:1511-1530` | Partially implemented | High | Cancer symptoms only under abnormal cervix |
| Figure 10 | Abnormal cervix, no cancer | Treat/refer, review 6-8 weeks | `lib/engine/decision-engine.ts:1532-1574` | Partially implemented | Critical | Wizard forces resolved answer same run |
| Figure 10 | Suspect OCP | Adjust OCP, review 6-8 weeks | `lib/engine/decision-engine.ts:1579-1617` | Partially implemented | Critical | Staged workflow missing |
| Figure 10 | STI identified | Treat STI, review 6-8 weeks | `lib/engine/decision-engine.ts:1622-1660` | Partially implemented | Critical | Staged workflow missing |
| Figure 10 | Bleeding resolved | Continue/commence regular screening | `lib/engine/decision-engine.ts:1532-1544`, `1580-1591`, `1623-1634`, `1664-1675` | Implemented but possibly wrong | High | Hard-coded 36 months |
| Figure 10 | Bleeding not resolved | Refer to gynaecology | `lib/engine/decision-engine.ts:1547-1559`, `1594-1606`, `1637-1649`, `1678-1690` | Partially implemented | Medium | |
| Table 1 | Negative/returned regular + no pathology | No further screening | No matching branch | Missing | Critical | |
| Table 1 | Low-grade specimen groups | HPV test, follow Figure 3 | No matching branch | Missing | High | |
| Table 1 | HSIL/AIS complete excision | Test of Cure | No matching branch | Missing | Critical | |
| Table 1 | HSIL/AIS incomplete excision | Colposcopy | No matching branch | Missing | Critical | |
| Table 1 | No known history + no/low-grade pathology | HPV at 6 months post hysterectomy | No matching branch | Missing | High | |
| Table 1 | Two negative co-tests | Not supplied Table 1 branch | `lib/engine/decision-engine.ts:1721-1741` | Implemented but wrong | Critical | Current table logic is unrelated |

## 8. Test Coverage Gaps

Existing test status: no repo-owned test/spec files were found, and `package.json:5-12` has no `test` script.

| Scenario | Existing test? | Test file | Missing test needed |
| --- | --- | --- | --- |
| Figure 1 never screened/under-screened/overdue -> invite now | No | None | Add engine and wizard test once fields exist |
| Figure 1 regular screening/ToC complete -> invite next visit | No | None | Add transition invitation test |
| Figure 2 prior HSIL/AG excluding AG2 -> colposcopy or ToC | No | None | Add prior-history routing tests |
| Figure 2 prior AIS/no hysterectomy -> R2.08 | No | None | Add route test after business confirms R2.08 representation |
| Figure 2 AG2 >3 years/discharged/otherwise | No | None | Add three AG2 history tests |
| Figure 3 SWAB return visit passed through completion route | No | None | Add route-level wizard completion test |
| Figure 3 HPV16/18 with no cytology | No | None | Add rule test for expected immediate colposcopy vs pending cytology after confirmation |
| Figure 3 first/second repeat HPV Other with ASC-US/LSIL | No | None | Add repeat-stage tests |
| Figure 4 repeat after normal colposcopy HPV not detected | No | None | Add return-to-regular test |
| Figure 4 repeat HPV16/18 or HPV Other high-grade | No | None | Add colposcopy referral tests |
| Figure 4 immune deficient branch | No | None | Add immune-deficient colposcopy test |
| Figure 5 MDM downgrade/upgrade/confirmed ASC-H | No | None | Add all MDM outcome tests |
| Figure 5 confirmed ASC-H downstream outcomes | No | None | Add treatment/ToC/repeat colposcopy tests |
| Figure 6 HPV detected any cytology -> colposcopy | No | None | Add high-priority regression test |
| Figure 6 HPV not detected + low/high-grade cytology | No | None | Add abnormal cytology branch tests |
| Figure 7 AG2/AC2 direct gynaecology | No | None | Add rule tests |
| Figure 7 visible lesion biopsy AIS/cancer | No | None | Add biopsy branch tests |
| Figure 7 no visible lesion MDM outcomes | No | None | Add UI + engine tests for outcome values |
| Figure 8 HPV not detected -> no further screening | No | None | Add regression test |
| Figure 8 HPV detected any -> Figure 3 | No | None | Add regression test |
| Figure 8 complete/incomplete excision | No | None | Add ToC/colposcopy tests |
| Figure 9 initial pregnant high-grade -> colposcopy | No | None | Add regression test |
| Figure 9 invasion impression -> biopsy before oncology | No | None | Add regression test |
| Figure 9 abnormal TZ LSIL/HSIL/AIS -> review | No | None | Add pregnancy branch tests |
| Figure 10 initial workup creates staged 6-8 week review | No | None | Add route/workflow test |
| Figure 10 co-test fields visible/captured for bleeding | No | None | Add wizard visibility test |
| Figure 10 resolved/unresolved follow-up | No | None | Add follow-up outcome tests |
| Table 1 all post-hysterectomy row groups | No | None | Add table-driven tests for every row group |
| Audit includes branch inputs/source/override | No | None | Add audit payload tests |
| GP/manual Figure labels and field availability | No | None | Add UI or component tests after correction |

## 9. Business Validation Questions

- Should Figure 1 invitation timing be in this app, or handled externally by NCSR/recall operations?
- Is NCSR required to determine previous high-grade, previous low-grade returned/not returned, AIS, AG2 dates, and Test of Cure completion?
- Should prior-history fields be manually entered when NCSR is unavailable, and who is accountable for that source?
- How should R2.08 post-treatment follow-up be represented in product terms?
- Should HPV 16/18 in Figure 3 route immediately to colposcopy with cytology reported if LBC, or should the app wait for cytology entry?
- Should pregnancy pathway be in phase 1/pilot scope?
- Should Figure 9 trigger only for pregnancy plus ASC-H/HSIL/glandular/AIS cytology?
- For Figure 7 AG2/AC2, should the app route directly to gynaecology and block colposcopy referral?
- Are extra Figure 7 engine branches not shown in the supplied image approved by clinical policy?
- Should total hysterectomy screening and Table 1 be implemented in phase 1?
- Should Table 1 be the source of truth for Figure 8 implementation?
- Should abnormal vaginal bleeding be treated as a separate staged pathway from routine screening?
- What exact local Healthcare Pathways text/actions should be shown in Figure 10?
- Should GP/manual entry allow forcing figures that require structured fields it cannot capture?
- What level of clinician override is required for screening wizard recommendations, and should override reason be mandatory?

## 10. Recommended Implementation Backlog

### Must fix before pilot

- Title: Correct Figure 6 HPV-detected Test of Cure routing
  - Reason: Current HPV Other first post-treatment result routes to repeat instead of colposcopy.
  - Affected figure/table: Figure 6.
  - Suggested files to change: `lib/engine/decision-engine.ts`, `lib/engine/types.ts`, `lib/wizard/steps.ts`.
  - Suggested tests to add: HPV detected any cytology -> colposcopy; HPV not detected + negative/low/high cytology.
  - Severity: Critical.

- Title: Implement or disable Figure 8/Table 1 hysterectomy logic
  - Reason: Current post-hysterectomy rules conflict with supplied Figure 8 and Table 1.
  - Affected figure/table: Figure 8, Table 1.
  - Suggested files to change: `lib/engine/decision-engine.ts`, `lib/engine/types.ts`, `prisma/schema.prisma`, `lib/wizard/steps.ts`, `app/api/pathway/sessions/[id]/complete/route.ts`.
  - Suggested tests to add: no further screening, HPV Figure 3, ToC, colposcopy, HPV at 6 months post hysterectomy.
  - Severity: Critical.

- Title: Add explicit repeat-stage and post-colposcopy state
  - Reason: Figures 3 and 4 require first vs second repeat state and normal-colposcopy surveillance state.
  - Affected figure/table: Figures 3 and 4.
  - Suggested files to change: `prisma/schema.prisma`, `lib/engine/types.ts`, `lib/engine/decision-engine.ts`, completion routes.
  - Suggested tests to add: first repeat/second repeat all HPV/cytology outcomes.
  - Severity: Critical.

- Title: Implement Figure 5 MDM normal-colposcopy pathway
  - Reason: Current Figure 5 is biopsy/treatment logic, not supplied MDM pathway.
  - Affected figure/table: Figure 5.
  - Suggested files to change: `lib/engine/decision-engine.ts`, `lib/wizard/steps.ts`, `prisma/schema.prisma`.
  - Suggested tests to add: downgraded LSIL, upgraded HSIL, confirmed ASC-H downstream branches.
  - Severity: Critical.

- Title: Correct Figure 9 pregnancy routing
  - Reason: Current routing is too broad and key branches skip required steps.
  - Affected figure/table: Figure 9.
  - Suggested files to change: `lib/engine/decision-engine.ts`, `lib/engine/types.ts`, `lib/wizard/steps.ts`, schema for postpartum timing.
  - Suggested tests to add: initial colposcopy, normal TZ MDM, abnormal TZ review, invasion biopsy, oncology after positive invasion.
  - Severity: Critical.

- Title: Split Figure 10 into staged initial and follow-up workflows
  - Reason: Same-run `bleeding_resolved` capture is not a safe representation of the 6-8 week pathway.
  - Affected figure/table: Figure 10.
  - Suggested files to change: `lib/wizard/steps.ts`, `lib/engine/decision-engine.ts`, `prisma/schema.prisma`, completion route, recall/task model if present.
  - Suggested tests to add: interim treatment/review task and follow-up resolved/unresolved decisions.
  - Severity: Critical.

- Title: Add branch-level automated rule tests
  - Reason: No test script or repo-owned test coverage exists.
  - Affected figure/table: All.
  - Suggested files to change: `package.json`, new test files under a repo test folder.
  - Suggested tests to add: every critical/high row in the rules coverage matrix.
  - Severity: Critical.

### Fix if quick

- Title: Pass `swabReturnVisitCompleted` and `hysterectomyType` through wizard completion
  - Reason: Already mapped in `answersToInputFields()` but not passed to `ClinicalInput`.
  - Affected figure/table: Figures 3, 8, Table 1.
  - Suggested files to change: `app/api/pathway/sessions/[id]/complete/route.ts`.
  - Suggested tests to add: completion route builds expected `ClinicalInput`.
  - Severity: High.

- Title: Correct GP/manual figure labels and field limitations
  - Reason: Figure 9/10 labels are wrong and manual form cannot capture required fields.
  - Affected figure/table: Figures 7-10.
  - Suggested files to change: `app/(app)/gp/page.tsx`.
  - Suggested tests to add: label snapshot/component test.
  - Severity: High.

- Title: Update visual decision trees or mark them simplified
  - Reason: Several diagrams conflict with supplied images.
  - Affected figure/table: Figures 1-10.
  - Suggested files to change: `lib/decision-trees/index.ts`, guidelines UI.
  - Suggested tests to add: code-label coverage test against engine recommendation codes.
  - Severity: Medium.

- Title: Persist `ColposcopyFinding` from wizard completion
  - Reason: DB supports the model but completion route does not create it.
  - Affected figure/table: Figures 4, 5, 7, 9.
  - Suggested files to change: `app/api/pathway/sessions/[id]/complete/route.ts`.
  - Suggested tests to add: colposcopy findings persistence test.
  - Severity: High.

- Title: Expand audit payload
  - Reason: Audit logs do not contain input facts, branch path, or history source.
  - Affected figure/table: All.
  - Suggested files to change: completion routes, audit model/use sites.
  - Suggested tests to add: audit payload includes decision inputs/source/override.
  - Severity: Medium.

### Clinical confirmation needed

- Title: Confirm HPV 16/18 cytology-pending behavior
  - Reason: Source image shows colposcopy with cytology reported if LBC; code waits for cytology when missing.
  - Affected figure/table: Figure 3.
  - Suggested files to change after confirmation: `lib/engine/decision-engine.ts`, wizard guidance.
  - Suggested tests to add: HPV 16/18 no cytology branch.
  - Severity: High.

- Title: Confirm extra Figure 7 branches
  - Reason: Engine has branches not present in supplied Figure 7.
  - Affected figure/table: Figure 7.
  - Suggested files to change after confirmation: `lib/engine/decision-engine.ts`, `lib/wizard/steps.ts`.
  - Suggested tests to add: each retained extra branch.
  - Severity: High.

- Title: Confirm Figure 10 Healthcare Pathways wording and referral priority
  - Reason: Source references local pathways without exact digital workflow details.
  - Affected figure/table: Figure 10.
  - Suggested files to change after confirmation: `lib/engine/decision-engine.ts`, wizard copy, referral creation.
  - Suggested tests to add: local pathway/referral outcomes.
  - Severity: Medium.

- Title: Confirm pilot scope for pregnancy and hysterectomy pathways
  - Reason: Figures 8, 9, and Table 1 require more history and follow-up state than currently exists.
  - Affected figure/table: Figures 8, 9, Table 1.
  - Suggested files to change after confirmation: routing/UI to include or disable scope.
  - Suggested tests to add: route enabled/disabled tests.
  - Severity: High.

### External dependency

- Title: NCSR/history integration for prior screening and Test of Cure state
  - Reason: Prior history determines Figures 1, 2, 8, and Table 1.
  - Affected figure/table: Figures 1, 2, 8, Table 1.
  - Suggested files to change: NCSR pull route/client, patient history model, rules input mapping.
  - Suggested tests to add: history-source mapping and missing-history fallback tests.
  - Severity: Critical.

- Title: Histology report/source capture for hysterectomy specimen
  - Reason: Table 1 and Figure 8 depend on specimen pathology and excision completeness.
  - Affected figure/table: Figure 8, Table 1.
  - Suggested files to change: document extraction, manual history form, schema.
  - Suggested tests to add: specimen pathology mapping tests.
  - Severity: Critical.

- Title: Service policy for R2.08 and specialist discharge
  - Reason: Figure 2 requires external pathway/specialist status.
  - Affected figure/table: Figure 2.
  - Suggested files to change: history model and routing once policy is supplied.
  - Suggested tests to add: specialist discharge and R2.08 route tests.
  - Severity: High.

## 11. Final Go/No-Go View

- Safe to demo as workflow MVP? Yes, only if clearly framed as a non-validated workflow prototype and risky pathways are not presented as clinically complete.
- Safe to pilot with real cases? No, only after critical/high pathway fixes, structured data capture, audit/override improvements, and automated regression tests are in place.
- Safe to claim clinically complete? No, unless formal clinical validation is completed against the governing guideline/business source and current conflicts are resolved.
- Next best step: confirm pilot scope and external history source, then fix the critical mismatches in Figure 6, Figure 8/Table 1, Figure 9, Figure 10, and the repeat/post-colposcopy state model before any real-case pilot.

## Implementation Update

This update records the implementation pass made after the audit. The rules engine now uses `business-figures-table1-v1` as the rule version and returns branch paths, missing facts, external dependency flags, and explicit safety outcomes instead of silently guessing.

### Figure 1 — Transition to HPV primary screening

- Implemented changes: Figure 1 is now an invitation decision only. Never screened, under-screened, or overdue participants route to invite now; regular screening, low-grade-only history, and high-grade history with successful Test of Cure route to next scheduled visit. Unknown history returns `EXTERNAL_HISTORY_REQUIRED`.
- Files changed: `lib/engine/decision-engine.ts`, `lib/engine/types.ts`, `lib/wizard/steps.ts`.
- Tests added: `lib/engine/__tests__/figure1.test.ts`.
- Remaining clinical confirmation needed: whether invitation timing belongs in this app or remains an external recall/NCSR function.
- Remaining external dependency: NCSR/history source for screening status.
- Remaining out-of-scope items: live invitation scheduling integration.

### Figure 2 — Previous high-grade results not returned to regular screening

- Implemented changes: Prior high-grade/glandular transition no longer collapses into HPV triage. Outstanding colposcopy recommendations route to colposcopy; incomplete Test of Cure routes to Test of Cure; AIS without hysterectomy returns service-defined post-treatment follow-up; AG2 older-than-3-years or specialist-discharge status routes to Figure 3, otherwise specialist gynaecology.
- Files changed: `lib/engine/decision-engine.ts`, `lib/engine/types.ts`, `lib/wizard/steps.ts`.
- Tests added: `lib/engine/__tests__/figure2.test.ts`.
- Remaining clinical confirmation needed: local handling/wording for R2.08 post-treatment follow-up.
- Remaining external dependency: NCSR/history, cytology report text, specialist discharge status.
- Remaining out-of-scope items: automated import of last cytology report recommendations.

### Figure 3 — HPV primary screening for asymptomatic participants

- Implemented changes: Added explicit repeat stage/context. HPV not detected returns 5 years or 3 years if immune deficient; HPV 16/18 routes to colposcopy even when cytology is pending; HPV Other branches across baseline, first repeat, age >= 50, second repeat, and high-grade cytology. SWAB return visit is passed through wizard/API.
- Files changed: `lib/engine/decision-engine.ts`, `lib/engine/types.ts`, `lib/wizard/steps.ts`, `app/api/pathway/sessions/[id]/complete/route.ts`, `app/api/rules/evaluate/route.ts`, `app/api/sessions/route.ts`.
- Tests added: `lib/engine/__tests__/figure3.test.ts`, `lib/engine/__tests__/routing-precedence.test.ts`.
- Remaining clinical confirmation needed: whether local workflow wants cytology reported before the final HPV 16/18 referral is displayed.
- Remaining external dependency: none for local rule calculation once inputs are present.
- Remaining out-of-scope items: lab integration for cytology-pending status.

### Figure 4 — Normal colposcopy after HPV detected with negative/ASC-US/LSIL cytology

- Implemented changes: Added post-normal-colposcopy low-grade repeat context. Normal colposcopy schedules 12-month HPV/LBC repeat; repeat HPV not detected returns to regular screening; HPV 16/18, high-grade cytology, immune deficient low-grade persistence, and second-repeat HPV detected route to colposcopy.
- Files changed: `lib/engine/decision-engine.ts`, `lib/engine/types.ts`, `lib/wizard/steps.ts`.
- Tests added: `lib/engine/__tests__/figure4.test.ts`.
- Remaining clinical confirmation needed: local wording for community-care LBC repeat.
- Remaining external dependency: colposcopy result availability.
- Remaining out-of-scope items: automated recall task template for community repeat.

### Figure 5 — Normal colposcopy after HPV detected with cytology >= ASC-H

- Implemented changes: Added Figure 5 MDM outcome handling. Downgraded LSIL follows LSIL pathway; upgraded HSIL recommends treatment; confirmed ASC-H routes by HPV result, visible lesion, normal colposcopy, and cytology to treatment, repeat colposcopy/HPV/cytology, or Test of Cure/co-testing.
- Files changed: `lib/engine/decision-engine.ts`, `lib/engine/types.ts`, `lib/wizard/steps.ts`.
- Tests added: `lib/engine/__tests__/figure5.test.ts`.
- Remaining clinical confirmation needed: exact service wording for “consider type 2 excision TZ”.
- Remaining external dependency: MDM outcome capture.
- Remaining out-of-scope items: procedure ordering workflow.

### Figure 6 — Test of Cure after HSIL/CIN2/3 treatment

- Implemented changes: Corrected the critical HPV-detected branch: HPV detected any type with any cytology now routes to colposcopy, including first post-treatment HPV Other. HPV not detected plus negative cytology repeats once, then returns to regular screening after the second negative; abnormal cytology branches by low-grade/high-grade.
- Files changed: `lib/engine/decision-engine.ts`, `lib/engine/types.ts`, `lib/wizard/steps.ts`.
- Tests added: `lib/engine/__tests__/figure6.test.ts`.
- Remaining clinical confirmation needed: whether any local policy differs from the supplied Figure 6.
- Remaining external dependency: treatment date and prior negative co-test count source.
- Remaining out-of-scope items: automatic Test of Cure completion certification.

### Figure 7 — Atypical and abnormal glandular abnormalities

- Implemented changes: AG2 and AC2 route to gynaecology; AG1, AG3-AG5, AC1, AC3, and AC4 route to colposcopy. Visible lesion now requires biopsy before AIS/cancer outcomes; no-visible-lesion branches require MDM with source-specific outcomes.
- Files changed: `lib/engine/decision-engine.ts`, `lib/engine/types.ts`, `lib/wizard/steps.ts`, `app/(app)/gp/page.tsx`, `components/clinical/DecisionCard.tsx`.
- Tests added: `lib/engine/__tests__/figure7.test.ts`.
- Remaining clinical confirmation needed: confirm AC3/AC4 colposcopy routing is acceptable locally because the supplied Figure 7 sends only AG2/AC2 directly to gynaecology.
- Remaining external dependency: MDM and biopsy result capture.
- Remaining out-of-scope items: oncology referral booking workflow beyond recommendation/referral record.

### Figure 8 — Screening after total hysterectomy

- Implemented changes: Replaced simplified vault logic with Figure 8/Table 1 history/specimen/excision logic. Known returned-regular/no pathology routes to no further screening; low-grade specimen routes to HPV/Figure 3; high-grade/AIS complete excision routes to Test of Cure; incomplete excision routes to colposcopy; post-hysterectomy HPV not detected can route to no further screening.
- Files changed: `lib/engine/decision-engine.ts`, `lib/engine/types.ts`, `lib/wizard/steps.ts`.
- Tests added: `lib/engine/__tests__/figure8.test.ts`, `lib/engine/__tests__/table1.test.ts`.
- Remaining clinical confirmation needed: pilot scope for total hysterectomy pathway.
- Remaining external dependency: hysterectomy indication, specimen pathology, excision status, and history source.
- Remaining out-of-scope items: document extraction from operative/histology reports.

### Figure 9 — Pregnant participant with possible/definite high-grade in situ cytology

- Implemented changes: Figure 9 now applies only when pregnant and cytology qualifies. Initial action is colposcopy. Normal TZ/no visible lesion requires MDM; confirmed high-grade routes to 6-month or postpartum review. Abnormal TZ/visible lesion with invasion requires biopsy before oncology; biopsy positive for invasion routes to gynaecological oncology.
- Files changed: `lib/engine/decision-engine.ts`, `lib/engine/types.ts`, `lib/wizard/steps.ts`, `app/(app)/gp/page.tsx`.
- Tests added: `lib/engine/__tests__/figure9.test.ts`, `lib/engine/__tests__/routing-precedence.test.ts`.
- Remaining clinical confirmation needed: exact postpartum review scheduling field requirements.
- Remaining external dependency: pregnancy status, expected delivery/postpartum timing, colposcopy/biopsy result.
- Remaining out-of-scope items: maternity system integration.

### Figure 10 — Abnormal vaginal bleeding

- Implemented changes: Figure 10 is split into initial assessment and 6-8 week review. Cancer symptoms route urgently to gynaecology. Initial assessment captures bleeding type, history/exam/co-test completion, cervix appearance, suspicion of cancer, OCP issue, STI state, and review-needed outcomes without forcing same-run resolution. Follow-up review handles resolved/unresolved bleeding.
- Files changed: `lib/engine/decision-engine.ts`, `lib/engine/types.ts`, `lib/wizard/steps.ts`, `app/(app)/gp/page.tsx`, `lib/decision-trees/index.ts`.
- Tests added: `lib/engine/__tests__/figure10.test.ts`, `lib/engine/__tests__/routing-precedence.test.ts`.
- Remaining clinical confirmation needed: local Healthcare Pathways wording and referral priority for non-cancer abnormal cervix/no-STI branches.
- Remaining external dependency: local gynaecology/Healthcare Pathways policy.
- Remaining out-of-scope items: automatic 6-8 week review appointment creation beyond recall.

### Table 1 — Vaginal screening after total hysterectomy

- Implemented changes: Added table-driven evaluator via the hysterectomy pathway using prior screening history, hysterectomy indication, specimen pathology, excision completeness, Test of Cure status, and post-hysterectomy HPV result.
- Files changed: `lib/engine/decision-engine.ts`, `lib/engine/types.ts`, `lib/wizard/steps.ts`.
- Tests added: `lib/engine/__tests__/table1.test.ts`.
- Remaining clinical confirmation needed: whether all Table 1 branches are in phase 1 pilot scope.
- Remaining external dependency: prior screening history and hysterectomy histology source.
- Remaining out-of-scope items: structured persistence migration for every Table 1 axis; current implementation persists via wizard answers, decision JSON, audit payload, and selected clinical models.

### Cross-cutting implementation changes

- Rule engine: `lib/engine/decision-engine.ts` now returns `ruleVersion`, `branchPath`, `missingInformation`, `externalDependencies`, `validationStatus`, and explicit safety outcomes.
- Data/input types: `lib/engine/types.ts` now includes structured fields for transition history, repeat context/stage, hysterectomy/Table 1 axes, colposcopy/MDM, pregnancy, Test of Cure, and abnormal bleeding.
- Wizard/API: `lib/wizard/steps.ts`, `app/api/pathway/sessions/[id]/complete/route.ts`, `app/api/rules/evaluate/route.ts`, and `app/api/sessions/route.ts` now pass the expanded structured facts into the engine.
- Persistence/audit: wizard completion now stores rule version on `ScreeningSession`, creates `ColposcopyFinding` when colposcopy facts are entered, stores the decision JSON, and writes an audit payload containing input facts, branch path, missing information, external dependencies, and safety outcome.
- Visual labels: `lib/decision-trees/index.ts`, `lib/utils.ts`, `components/clinical/DecisionCard.tsx`, and `app/(app)/gp/page.tsx` now use source-aligned figure labels; simplified diagrams are marked under validation.
- Tests: added table-driven engine tests for Figures 1-10, Table 1, and routing precedence.
- Verification: `npm test` passes with 58 tests; `npx tsc --noEmit` passes.
