# CerviGrade Screening App

CerviGrade is a governed cervical-screening decision-support application. Its primary workflow is:

Command Centre -> Pull Cases -> Review Queue -> Completed Decisions -> Simulated export package -> Audit Trail

Clinical safety posture: the product shows provisional recommendations only. Reviewer confirmation is required, simulated export packages are integration-ready previews, and demo output is not for direct clinical action.

## Demo Setup

```bash
npm install
cp .env.example .env
DEMO_SEED_PASSWORD='<operator-supplied local password>' npm run db:seed
DEMO_SEED_PASSWORD='<operator-supplied local password>' npm run demo:reset
npm run dev
```

Open `http://localhost:3000`.

Demo reset creates deterministic synthetic batch data:

- 1 persisted intake session
- 3 pending review items, including mandatory clinician review and urgent clinical priority examples
- 1 accepted decision
- 1 rejected decision with reason
- 1 needs-information decision
- 2 simulated package audit events

Demo users are printed by `npm run demo:reset`. The operator-supplied password is never printed. Both seed entry points refuse Production and remote/shared databases.

## Required Environment

Use `.env.example` as the safe template. Do not commit `.env`, database files, `.next`, `node_modules`, browser profiles, smoke artifacts, or generated secrets.

Key flags:

- `ENABLE_BATCH_DEMO=true` enables the buyer-demo flow.
- `DATABASE_URL=file:./prisma/dev.db` uses the local SQLite/libSQL development database.
- `AUTH_SECRET` and `NEXTAUTH_SECRET` must be unique per environment.
- `DEMO_SEED_PASSWORD` is required for local synthetic seeding and has no default.
- Real HL7, FHIR, PAS, NCSR, and eReferral integrations are not connected in this demo.

## Scripts

```bash
npm run lint
npm run typecheck
npm run test
npm run test:engine
npm run test:batch
npm run test:all
npm run build
npm run demo:reset
```

`npm test` remains the engine-only test command. Use `npm run test:all` before demo/pilot handoff.

## Deployment Notes

This app uses Next.js 16 and the repo's `proxy.ts` file for request-time route protection. Page and API handlers still enforce role and feature access directly, so authorization does not depend only on the proxy layer.

For hosted demo deployments:

- Use a clean database with synthetic data only.
- Set `ENABLE_BATCH_DEMO=true`.
- Set strong auth secrets in the platform secret store.
- Keep real integration credentials unset unless a separate integration workstream has been approved.
- Run `npm run demo:reset` after migrations/seeding to make the demo reproducible.

## Clinical authority architecture

`CG-NCSP-3.1.0` is the target governed within-pathway clinical recommendation ruleset. The Legacy engine remains a technical pathway router and the safe default authority until every clinical, governance, durability, monitoring, rollback, security and licensing gate is signed. Resolver, adapter or persistence failures fail closed to Legacy; stored evaluations are append-only and pinned. Once legitimately activated, canonical recommendations are primary for eligible new cases and Legacy routing appears as technical provenance.

Current controlled-integration evidence and the exact human sign-off checkpoint are recorded in [`docs/canonical-cutover/18-controlled-production-integration.md`](docs/canonical-cutover/18-controlled-production-integration.md). The full activation sequence remains in [`docs/canonical-cutover/07-cutover-runbook.md`](docs/canonical-cutover/07-cutover-runbook.md).

## Demo Script

1. Open Command Centre and show persisted intake, review, completed-decision, simulated export, and audit evidence metrics.
2. Pull Cases from the demo source and create the Review Queue.
3. Open Review Queue and confirm mandatory clinician review and urgent clinical priority are surfaced first.
4. Accept, reject, or mark needs-information with reviewer notes.
5. Open Completed Decisions and preview the simulated export package.
6. Download CSV/FHIR-like/HL7-style/JSON package formats if needed.
7. Open Audit Trail and show package preview/export evidence.

Avoid showing legacy manual pathway tools, raw rules/admin screens, or anything that implies production connectivity unless the buyer is technical and asks directly.
