# Production Readiness Gap Analysis & Roadmap
**Cervical Screening Clinical Decision Support System**
**Audit Date:** 2026-04-19 · **Target:** Health NZ NCSP Enterprise Deployment
**Status:** Pre-demo audit. App is ~70% clinically complete, ~30% enterprise-ready.

---

## 0. TL;DR for the Demo

Demo this as a **clinical decision support prototype** with a strong NCSP 2023 pathway engine. Be honest that infrastructure, integrations, and compliance hardening are the next 12–16 week effort. The decision engine, RBAC, MFA, audit log model, and case workflow are real. NCSR, HL7/FHIR, OCR, AI, and SSO are stubbed. Hosting/data residency must move to NZ before any pilot.

**Do not show:** the committed `prisma/dev.db`, the committed `NEXTAUTH_SECRET` in `.env`, US-region Vercel hosting. Rotate the secret and remove the db from git history before the demo.

---

## 1. Critical Pre-Demo Fixes (do this week)

| # | Fix | File | Effort |
|---|-----|------|--------|
| 1 | Rotate `NEXTAUTH_SECRET`, purge `.env` from git history (BFG/filter-repo) | `.env` | 2h |
| 2 | Remove `prisma/dev.db` from git, add to `.gitignore` | `prisma/dev.db` | 1h |
| 3 | Add age 25–69 entry gate; 70–74 deferred; ≥75 discharge | `lib/wizard/steps.ts`, `lib/engine/decision-engine.ts` | 1d |
| 4 | Add ethnicity to Patient + wizard intake (prioritised codes) | `prisma/schema.prisma`, wizard | 1d |
| 5 | Wire Figure 8 (post-hysterectomy vault screening) into engine | `lib/engine/decision-engine.ts` | 1d |
| 6 | Verify Figure 4/5 TZ Type 3 exception branches with a clinician | engine + tests | 2d |
| 7 | Enforce SWAB → mandatory return-visit gate before recall/referral | engine | 0.5d |
| 8 | Set security headers (HSTS, CSP, X-Frame-Options) | `next.config.ts` | 2h |
| 9 | Make MFA mandatory for COORDINATOR; raise password min to 12 | `lib/auth/two-factor-policy.ts`, `lib/auth/password-policy.ts` | 2h |
| 10 | Disable AI/OCR/NCSR feature flags by default in prod | `lib/features.ts`, `.env` | 1h |

---

## 2. Clinical Gaps (vs NZ NCSP 2023 Guidelines)

### 2.1 Decision engine (`lib/engine/decision-engine.ts`)
**Implemented & correct:** Fig 1 transition, Fig 2 abnormal-cytology history (AG2 → gynaecology not colposcopy), Fig 3 primary HPV screening, immunocompromised 3-yr recall, persistent HPV-Other → colposcopy at 24mo and at age ≥50/12mo, Fig 9 pregnancy routing, Fig 10 abnormal bleeding, glandular/AIS/SCC urgent flags.

**Gaps:**
- **No age boundary enforcement** (25–69 entry, 70–74 defer, ≥75 discharge). Critical safety gap.
- **Figure 8 (vault screening, post-hysterectomy)** wizard flag exists but engine has no evaluator.
- **Figure 4/5 TZ Type 3 exception branches** present in wizard, not verified in engine paths.
- **Subtotal vs total hysterectomy** not distinguished — subtotal still has cervix.
- **CIN1 12-month co-test follow-up** branch in Figure 4 needs explicit verification.
- **Test of Cure consecutive-negative-co-test counter** present in schema (`consecutiveNegativeCoTestCount`); needs Figure 6 logic verification.
- **Discordant high-grade cytology + low-grade biopsy** — MDM trigger string present; logic needs verification.
- **SWAB sample** warns return visit needed but does not block decision.

### 2.2 Equity (NCSP 2023 explicitly mandates)
- **No ethnicity capture** → cannot apply Māori/Pacific equity recall intervals or stratified outreach.
- **No deprivation index, rural/remote flag, interpreter need.**
- **No vaccination status** (HPV immunisation history affects context).

### 2.3 Questionnaire quality (`lib/wizard/steps.ts`)
Logical flow, good clinical hints, correct conditional branching. Add: age, ethnicity, smoking, contraception, last HPV vaccination date, consent capture, hysterectomy type (total/subtotal).

---

## 3. Security & Compliance Gaps (HISO 10029 / Privacy Act 2020)

| Control | Status | Action |
|---------|--------|--------|
| Encryption at rest | ✗ none | Move to PostgreSQL + AES-256 column encryption for NHI/name/DOB |
| Data residency (NZ) | ✗ Vercel US | Migrate to Azure NZ North or AWS Sydney (with NZ data agreement) |
| Audit log immutability | ✗ DB-modifiable | Stream to write-once sink (CloudTrail / Azure Monitor / S3 object-lock) |
| SSO/SAML/OIDC | ✗ credentials only | Add SAML provider (DHB AD / Realme) for clinician identity |
| MFA coverage | Partial | Mandatory for ALL clinical roles, not just admin/colpo |
| Password policy | Weak (8 char) | 12+ chars or passphrase; align with NIST 800-63B |
| Session security | Defaults | IP pinning, refresh rotation, concurrent-session limit, revoke-on-password-change |
| Rate limiting | Auth only, in-memory | Distributed (Redis); apply to all APIs |
| Secret management | `.env` in git | Rotate; move to Doppler / AWS Secrets Manager / Azure Key Vault |
| Soft deletes / retention | ✗ hard deletes | Add `deletedAt`, retention policy (≥10 yr clinical, ≥7 yr audit) |
| Consent capture | ✗ | Patient + GP consent records with expiry, version |
| Data classification | ✗ | RED/AMBER/GREEN scheme; field-level tagging |
| DR/BCP | ✗ | RTO 4h / RPO 1h; cross-region backups; documented runbooks |
| Penetration test | ✗ | Pre-pilot pentest by CREST/CISA-certified firm |

---

## 4. Architecture & Scalability Gaps

- **SQLite in production** (`file:./prisma/dev.db`). Not viable for any pilot. Migrate to managed PostgreSQL.
- **No connection pooling, no caching layer (Redis), no CDN strategy beyond Vercel default.**
- **No observability:** no structured logging, metrics (Prometheus/OTel), tracing, error tracking (Sentry), health checks.
- **No CI/CD pipeline visible:** no test gate, no migration check, no secret scanning, no staged rollouts, no rollback plan.
- **No test suite at all.** Decision engine has no regression coverage — highest-risk gap. Target ≥80% on engine, integration tests for full case workflow, Playwright e2e for grading + booking flows.
- **No multi-tenancy / DHB isolation.** Single deployment assumption.
- **Migrations** exist but not gated in deploy pipeline.

---

## 5. Data Model Gaps (`prisma/schema.prisma`)

Add: `ethnicityPrimary`, `ethnicityOther[]`, `deprivationIndex`, `interpreterRequired`, `iwiAffiliation` on Patient. `hysterectomyType` enum. `nhiValidatedAt`, `hpiValidatedAt`. `deletedAt` + `deletedById` on all PHI tables. `consentRecords` table (purpose, scope, given/withdrawn timestamps, version). `dataExportLog` separate from AuditLog. `ruleVersionHistory` with diff + author. `severity` + `correlationId` on AuditLog.

---

## 6. Integration Gaps

| Integration | Status | Required For |
|-------------|--------|---------------|
| **NHI lookup + checksum** | Field only, no validation | Any pilot |
| **HPI provider directory** | Field only | Pilot |
| **NCSR pull/push** | Stubbed (`code: "STUB"`) | Pilot — needs Health NZ MoU + endpoints |
| **HL7v2 lab ingest (OBX/ORU)** | ✗ | Pilot — auto-ingest cytology/HPV results |
| **FHIR R4 (Observation, DiagnosticReport, ServiceRequest)** | ✗ | Interop with DHB systems |
| **ERMS / eReferral** | Internal only | Pilot — close referral loop |
| **HealthLink / EDI messaging** | ✗ | GP result notification |
| **GP2GP** | ✗ | Patient transfer |
| **SMS gateway** | ✗ | Patient recalls |
| **Realme / DHB AD SSO** | ✗ | Production |

---

## 7. UX / Accessibility Gaps

- **No WCAG 2.1 AA audit.** Need third-party audit before pilot.
- **No te reo Māori support.** Add i18next; commission professional translation; co-design with Māori health providers.
- **No plain-language readability check** on patient-facing copy.
- **No mobile testing record.** Touch-target sizing, screen-reader pass, focus management on modals.

---

## 8. Production-Ready Roadmap (12–16 weeks, 3–4 engineers)

### Phase 0 — Pre-demo hygiene (this week)
Section 1 fixes. Rotate secrets, age-gate, ethnicity capture, Figure 8, security headers, MFA expansion.

### Phase 1 — Foundation (Weeks 1–4)
- Migrate SQLite → PostgreSQL on Azure NZ North.
- Secret manager, encryption at rest, automated backups (RPO 1h), DR runbook.
- CI/CD pipeline: lint, type, test gates, migration check, secret scanning, staged deploy.
- Structured logging (pino) + error tracking (Sentry) + health endpoints.
- Test framework (Vitest + Playwright); seed decision-engine unit tests for all 10 figures.
- Soft deletes + retention policy implementation.

### Phase 2 — Compliance & Identity (Weeks 5–8)
- HISO 10029 control implementation matrix.
- SSO/SAML (Realme + DHB AD), MFA mandatory all clinical roles, session hardening.
- Audit log immutability — stream to object-locked S3 / Azure Monitor.
- Consent management UI + records.
- Pentest (CREST-certified) + remediation cycle.
- Privacy Impact Assessment (PIA) document.

### Phase 3 — Clinical Validation & Equity (Weeks 6–10, parallel)
- Independent clinical validation by NCSP advisor against all 10 figures, edge cases, pregnancy, immunocompromised, post-treatment, vault.
- Ethnicity-stratified recall logic.
- te reo Māori UI.
- WCAG 2.1 AA audit + remediation.
- Plain-language patient comms review.

### Phase 4 — Integrations (Weeks 8–14)
- NHI/HPI validation + lookup (Health NZ endpoints).
- NCSR live integration (post-MoU).
- HL7v2 lab ingest pipeline (Labnet / DHB labs).
- FHIR R4 export (Observation, DiagnosticReport, ServiceRequest).
- HealthLink GP messaging.
- SMS gateway (TXTNZ / equivalent) for patient recalls.

### Phase 5 — Pilot Readiness (Weeks 14–16)
- Load testing (100 concurrent users, 10k cases/month).
- User acceptance testing with pilot clinic.
- Operations runbook: incident response, escalation, on-call.
- Training materials: clinician guide, coordinator guide, admin runbook.
- Go/no-go review with Health NZ.

---

## 9. Demo Talking Points

**Lead with strengths:**
- NCSP 2023 pathway engine with Figures 1–10 modelled in code (`lib/engine/decision-engine.ts`).
- Conditional clinical wizard with proper branching and clinical hints.
- 8-role RBAC, TOTP MFA, recovery codes, account lockout.
- Audit log model, SLA/triage logic for referral cases, booking workflow.
- Document ingest, AI recommendation, NCSR integration architecture in place (stubbed pending credentials/approvals).

**Be honest about:**
- Pre-pilot infrastructure migration required (NZ residency, PostgreSQL, encryption).
- Independent clinical validation required before any patient-facing use.
- Live integrations require Health NZ MoU and endpoints.
- 12–16 week hardening programme to reach pilot readiness.

**Ask Health NZ for:**
- Clinical validator from NCSP for engine sign-off.
- NCSR sandbox endpoint + credentials.
- Lab partner for HL7v2 ingest pilot.
- Approved cloud region + data agreement.
- PIA template + HISO 10029 conformance checklist they accept.

---

## 10. Risk Register (Top 10)

1. **Clinical pathway error in production** — patient harm. Mitigation: independent clinician sign-off + full unit test coverage of engine before any go-live.
2. **PHI breach via SQLite/Vercel/committed secrets** — regulatory + reputational. Mitigation: Phase 0 + Phase 1.
3. **Audit trail tampering** — compliance failure. Mitigation: immutable log sink (Phase 2).
4. **Equity failure (Māori/Pacific outcomes)** — programme objective failure. Mitigation: ethnicity capture + stratified recalls + co-design (Phase 3).
5. **NCSR integration delays** — pilot blocked. Mitigation: start MoU process now.
6. **No regression coverage** — silent clinical regressions. Mitigation: Phase 1 test framework.
7. **Single point of failure (SQLite)** — outage. Mitigation: Phase 1 PostgreSQL.
8. **Accessibility non-compliance** — exclusion of users with disabilities. Mitigation: WCAG audit Phase 3.
9. **Lack of consent records** — Privacy Act breach. Mitigation: Phase 2 consent module.
10. **SSO absence blocks DHB onboarding** — adoption stalled. Mitigation: SAML in Phase 2.
