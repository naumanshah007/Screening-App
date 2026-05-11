# Enterprise Implementation Pack

This document turns the current `cervical-screening-app` demo into a concrete implementation plan for an enterprise product that supports both:

- `Colposcopy grading`
- `Gynaecology referral grading`

It is written for this repository as it exists today:

- Frontend: Next.js App Router
- Backend: Next.js route handlers
- Persistence: Prisma
- Current focus: cervical screening workflow, decision support, referral queue

## 1. Product Goal

Build a production-grade platform that:

- accepts referrals and supporting documents
- creates a one-page summary for grading
- applies deterministic clinical rules
- provides AI-assisted summary and grading recommendations
- captures clinician approval and override
- enforces audit, privacy, and access controls suitable for Health NZ use

## 2. Current Repo Role

Keep the current product as `Legacy Cervical Module`.

Reuse from the current app:

- authentication and base app shell
- patient register
- referral queue concepts
- audit logging
- current clinical workflow patterns

Do not treat the current hard-coded cervical decision engine as the final architecture.

## 3. Target Architecture

### Application Shape

- `Web app`: Next.js front end for case intake, summary review, grading, queues, admin
- `API layer`: Next.js route handlers for CRUD and orchestration
- `Worker layer`: asynchronous document OCR, parsing, summary generation, AI assist, notifications
- `Database`: Postgres for transactional data
- `Document storage`: sovereign object storage
- `Search/evidence index`: extracted facts and retrieval-ready document chunks

### Domain Split

- `legacy-cervical`: current screening workflow kept behind a feature flag
- `colposcopy`: enterprise grading workspace and rules
- `gynaecology`: referral triage workspace, summary, and rules
- `shared`: cases, documents, evidence, audit, users, queues, analytics

## 4. Target Folder Tree

```text
app/
  (app)/
    dashboard/page.tsx
    analytics/page.tsx
    cases/
      page.tsx
      new/page.tsx
      [id]/
        page.tsx
        documents/page.tsx
        summary/page.tsx
        grade/page.tsx
        history/page.tsx
    services/
      colposcopy/
        queue/page.tsx
        rules/page.tsx
      gynaecology/
        queue/page.tsx
        rules/page.tsx
    admin/
      rules/page.tsx
      integrations/page.tsx
      access/page.tsx
      audit/page.tsx
  api/
    cases/
      route.ts
      [id]/route.ts
      [id]/ingest/route.ts
      [id]/regrade/route.ts
      [id]/facts/route.ts
      [id]/decision/route.ts
      [id]/documents/
        route.ts
        upload-url/route.ts
      [id]/summary/
        generate/route.ts
        approve/route.ts
      [id]/rules/
        evaluate/route.ts
      [id]/ai/
        recommend/route.ts
    queues/
      colposcopy/route.ts
      gynaecology/route.ts
    rulesets/
      route.ts
      [id]/review/route.ts
      [id]/publish/route.ts
    analytics/
      concordance/route.ts
      service-performance/route.ts
      backlog/route.ts
    legacy/
      cervical/
        ...

components/
  cases/
    CaseHeader.tsx
    CaseStatusPill.tsx
    CaseTimeline.tsx
  documents/
    DocumentList.tsx
    DocumentViewer.tsx
    EvidenceDrawer.tsx
  summary/
    SummaryPanel.tsx
    SummarySection.tsx
    MissingDataBanner.tsx
  grading/
    DecisionReviewCard.tsx
    RuleTracePanel.tsx
    ColposcopyForm.tsx
    GynaecologyForm.tsx
  queues/
    CaseQueueTable.tsx
    SlaChip.tsx
    QueueFilters.tsx
  admin/
    RuleReleaseTable.tsx
    AccessCertificationTable.tsx

lib/
  cases/
    types.ts
    service.ts
    validators.ts
  documents/
    types.ts
    storage.ts
    ocr.ts
    classifier.ts
    parser.ts
    chunker.ts
    evidence.ts
  summaries/
    generator.ts
    renderer.ts
    templates/
      gynaecology-summary.ts
      colposcopy-summary.ts
  clinical/
    shared/
      types.ts
      priorities.ts
      evidence-trace.ts
    rules/
      engine.ts
      release-loader.ts
      fixtures.ts
      colposcopy/
        rules.ts
        fixtures.ts
      gynaecology/
        rules.ts
        fixtures.ts
      legacy-cervical/
        decision-engine.ts
        types.ts
    ai/
      recommend.ts
      prompts.ts
      citations.ts
      evaluation.ts
  workers/
    queue.ts
    jobs/
      ingest-case.ts
      classify-document.ts
      extract-facts.ts
      generate-summary.ts
      generate-ai-recommendation.ts
  auth/
    roles.ts
    permissions.ts
  audit/
    events.ts
    service.ts
  integrations/
    colposcopy-registry/
      client.ts
      sync.ts
    labs/
      client.ts
    radiology/
      client.ts
    letters/
      client.ts

prisma/
  schema.prisma
  seed.ts
  migrations/
```

## 5. Feature Flags

Add these environment flags from the start:

- `ENABLE_LEGACY_CERVICAL=true`
- `ENABLE_CASES_V2=false`
- `ENABLE_DOCUMENT_INGEST=false`
- `ENABLE_COLPOSCOPY_MODULE=false`
- `ENABLE_GYNAECOLOGY_MODULE=false`
- `ENABLE_AI_ASSIST=false`
- `ENABLE_RESTRICTED_COLPO_INTEGRATION=false`

## 6. Prisma Implementation Pack

### 6.1 Core New Enums

- `ServiceLine`
- `CaseStatus`
- `TriagePriority`
- `DocumentType`
- `SummaryStatus`
- `RecommendationStatus`

### 6.2 Core New Models

- `ReferralCase`
- `ReferralDocument`
- `DocumentPage`
- `ExtractedFact`
- `ClinicalSummary`
- `RuleSetRelease`
- `RuleDecision`
- `AIRecommendation`
- `ClinicianDecision`
- `AccessCertification`

### 6.3 Existing Models To Extend

Extend `User`:

- add role values for `GYNAE_GRADER`, `COLPO_CNS`, `SMO_REVIEWER`, `INTEGRATION_ADMIN`
- add relations for case assignment, document uploads, summary approvals

Extend `Patient`:

- keep as enterprise master patient record
- add relation to `ReferralCase[]`

Keep but reclassify existing models:

- `ScreeningSession`, `TestResult`, `ColposcopyFinding`, `Recall`, `WizardSession`
- keep for the legacy cervical module

### 6.4 Migration Order

Migration 1: `enterprise_case_foundation`

- add enums
- add `ReferralCase`
- link `Patient -> ReferralCase`
- extend `User` roles and relations

Migration 2: `document_ingestion_foundation`

- add `ReferralDocument`
- add `DocumentPage`
- add storage metadata

Migration 3: `evidence_and_summary`

- add `ExtractedFact`
- add `ClinicalSummary`

Migration 4: `rules_and_decisions`

- add `RuleSetRelease`
- add `RuleDecision`
- add `ClinicianDecision`

Migration 5: `ai_and_access_controls`

- add `AIRecommendation`
- add `AccessCertification`

## 7. API Build Pack

### Phase A APIs

- `POST /api/cases`
- `GET /api/cases`
- `GET /api/cases/[id]`
- `POST /api/cases/[id]/documents/upload-url`
- `POST /api/cases/[id]/documents`

### Phase B APIs

- `POST /api/cases/[id]/ingest`
- `GET /api/cases/[id]/facts`
- `POST /api/cases/[id]/summary/generate`
- `POST /api/cases/[id]/summary/approve`

### Phase C APIs

- `POST /api/cases/[id]/rules/evaluate`
- `POST /api/cases/[id]/decision`
- `POST /api/cases/[id]/regrade`

### Phase D APIs

- `POST /api/cases/[id]/ai/recommend`
- `GET /api/analytics/concordance`
- `GET /api/queues/colposcopy`
- `GET /api/queues/gynaecology`
- `POST /api/rulesets/[id]/review`
- `POST /api/rulesets/[id]/publish`

## 8. UI Build Pack

### New Pages

- `cases/page.tsx`: master queue with service, status, priority, assignee filters
- `cases/new/page.tsx`: case intake wizard
- `cases/[id]/page.tsx`: case overview
- `cases/[id]/documents/page.tsx`: attachments and ingestion status
- `cases/[id]/summary/page.tsx`: one-page summary with citations
- `cases/[id]/grade/page.tsx`: final grading workspace
- `services/colposcopy/queue/page.tsx`: colposcopy operational queue
- `services/gynaecology/queue/page.tsx`: gynaecology operational queue
- `admin/rules/page.tsx`: rule release workflow
- `analytics/page.tsx`: backlog, timeliness, concordance

### Legacy Pages To Keep Temporarily

- `app/(app)/gp/page.tsx`
- `app/(app)/pathway/page.tsx`
- `app/(app)/pathway/[sessionId]/page.tsx`
- `app/(app)/guidelines/page.tsx`

## 9. Rules Engine Refactor Pack

### New Files

- `lib/clinical/rules/engine.ts`
- `lib/clinical/rules/release-loader.ts`
- `lib/clinical/shared/types.ts`
- `lib/clinical/shared/priorities.ts`
- `lib/clinical/rules/colposcopy/rules.ts`
- `lib/clinical/rules/gynaecology/rules.ts`

### Legacy Extraction

Move current cervical logic out of:

- `lib/engine/decision-engine.ts`
- `lib/engine/types.ts`

Into:

- `lib/clinical/rules/legacy-cervical/decision-engine.ts`
- `lib/clinical/rules/legacy-cervical/types.ts`

### Rules Engine Output Shape

Every rule evaluation should return:

- decision code
- service line
- priority
- category
- outcome
- rationale
- evidence references
- missing data
- reviewer escalation requirements

## 10. Document Intelligence Pack

### Worker Jobs

- `ingest-case`
- `classify-document`
- `extract-facts`
- `generate-summary`
- `generate-ai-recommendation`

### Extraction Targets

For gynaecology:

- ultrasound date
- endometrial thickness
- fibroid size
- ovarian mass descriptors
- tumour markers
- bleeding pattern
- prior medical management tried
- prior clinic history
- discharge findings

For colposcopy:

- HPV type
- cytology wording
- prior histology
- prior colposcopy status
- immune status
- abnormal appearance flags
- re-referral status

## 11. Colposcopy Module Pack

Implement exact workspace fields matching the current manual template:

- status reason
- priority
- faster cancer treatment flag
- clinic
- investigations
- category
- HPV test
- HPV type
- cytology sample
- referral reason
- genotype detail
- referral notes
- NCSR note status
- assessment of referral
- booking priority
- type
- SMO only
- Ovestin instructions
- triage notes

Do not map these back into generic `P1/P2/P3/P4` only. Preserve the actual booking windows from the approved triage guide.

## 12. Gynaecology Module Pack

Implement dedicated grading forms and rules for:

- abnormal uterine bleeding
- post-menopausal bleeding
- fibroids
- ovarian masses and cysts
- pelvic pain
- urogynaecology
- fertility
- PCOS
- paediatric gynaecology
- cervical polyp
- pelvic tear
- tubal ligation
- HSC P1 and P2-HSC
- reject and re-refer
- P5 virtual clinic

The module must support `cannot grade safely yet` states when required evidence is missing.

## 13. AI Copilot Pack

AI is not the first release. Add it after deterministic rules and summary quality are stable.

### Required Files

- `lib/clinical/ai/recommend.ts`
- `lib/clinical/ai/prompts.ts`
- `lib/clinical/ai/citations.ts`
- `lib/clinical/ai/evaluation.ts`

### Rules

- no AI output without source citations
- no AI-only final decision save
- every clinician override captured
- every AI version linked to prompt version and model name

## 14. Security And Compliance Pack

Add:

- SSO and MFA
- RBAC middleware
- immutable audit event writer
- restricted integration access checks
- document access logging
- redaction-safe observability
- storage encryption and retention policies

## 15. Testing Pack

### Test Layers

- unit tests for rules
- fixture tests for every approved guideline row
- API integration tests for case lifecycle
- UI tests for grader workflows
- worker tests for OCR/parser pipeline
- evaluation tests for AI recommendation quality

### Golden Dataset

Create:

- `tests/fixtures/colposcopy/*.json`
- `tests/fixtures/gynaecology/*.json`
- `tests/fixtures/documents/*.txt`

## 16. PR-by-PR Build Order

PR 1: schema v2 foundation, feature flags, base case APIs

PR 2: case queue UI and case overview

PR 3: sovereign document upload and document registration

PR 4: worker scaffold and ingestion status

PR 5: OCR/classification/extraction pipeline

PR 6: one-page summary v1

PR 7: rules engine v2 core and rule release loader

PR 8: colposcopy module v1

PR 9: colposcopy queue, booking windows, and re-referral logic

PR 10: gynaecology module v1

PR 11: gynaecology summary-assisted grading

PR 12: AI copilot recommendation mode

PR 13: analytics, concordance, and SLA dashboards

PR 14: security hardening and pilot controls

## 17. Definition Of Done

A feature is done only when:

- role checks are in place
- audit events are emitted
- fixture tests pass
- UI exposes evidence or missing-data states
- clinical output is traceable to approved rules or cited evidence
- analytics can measure usage and error rate

## 18. Immediate Start Order

Start with these repository changes first:

1. Add `docs/enterprise-implementation-pack.md`
2. Add schema enums and `ReferralCase`
3. Add `app/api/cases/route.ts`
4. Add `app/(app)/cases/page.tsx`
5. Add `lib/cases/service.ts`
6. Add feature flags and keep legacy pages intact

That sequence gives the repo a safe enterprise foundation without breaking the current MVP.
