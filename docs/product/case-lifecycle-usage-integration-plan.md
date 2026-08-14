# Case lifecycle, usage metering and the Integration Centre

An implementation plan for the three proposed capabilities, checked against the
code as it stands rather than against the idea of it.

The research is sound and the three capabilities really are one problem. But
five things in the current codebase change how it has to be built, and one of
them changes the order.

---

## 1. What the code actually looks like today

| Claim in the plan | What exists now |
|---|---|
| Cases can be fingerprinted on source identifiers | **No episode identifiers exist anywhere.** `BatchReviewItem` carries `nhi`, `externalPatientId`, `receivedDate`, `rowNumber`. There is no accession number, specimen ID, message control ID, or per-item source system — `sourceSystem` sits on `BatchRun`, one level up. `SourceMetadata` in `lib/batch/types.ts` has no slot for them, the template columns do not define them, and no adapter parses them. |
| Usage can be metered per organisation | **There is no Organisation model.** `organisationKey` is a nullable free-text string on `RuleSetActivation` only, used to scope which ruleset is active. Nothing else in the schema is tenant-scoped. `GPPractice` is a referrer, not a customer. |
| "Updated result" fits the immutable history | **It fits extremely well.** `RuleEvaluation` already has `previousEvaluationId`, `subsequentEvaluations` and `regradeReason`, plus `CaseAuthorityPin` so an existing case keeps its original authority. An updated episode is a regrade, and the chain already exists. |
| The connector catalogue is a starting point for configuration | `CONNECTOR_CATALOG` in `lib/batch/integration-types.ts` is a **static array in source**. There is no persistence, no per-connection record, no credential store and no test path. The file's own header says credentials will be "server-side only… never exposed to the frontend" — that promise has to be designed for, not inherited. |
| Duplicate detection can be demonstrated | **Not currently.** `lib/batch/realistic-dataset.ts` defines six deliberate `RETURNING_PATIENTS` with fixed NHIs, which is a good seed — but every generated case gets `caseId: crypto.randomUUID()`, so each pull mints brand-new identity. Until the generator emits stable episode keys, "48 new · 12 already in review" can never appear on screen. |

Two further constraints that bear directly on the plan:

**`RuleEvaluation` cannot be backfilled.** The immutability trigger is
`BEFORE UPDATE ON "RuleEvaluation"` with no column list, so *every* update
aborts. Adding an `organisationId` column is fine (schema change, no row
rewrite) but existing rows could never be populated. Derive organisation
through `batchRunId` / `caseId` instead and leave the immutable table alone.

**HL7 v2 MLLP cannot run on the current host.** MLLP is a persistent TCP
listener. This deploys to Vercel serverless functions, which cannot hold a
socket open. FHIR and PMS polling are feasible — `vercel.json` already declares
a cron — but an HL7 v2 feed needs a separate long-running ingestion service.
That is an infrastructure decision, not a UI one, and it should be settled
before the HL7 connector is designed.

---

## 2. One change to the running order

The plan lists the organisation model fourth. It has to be first.

Episode fingerprints include the source organisation. Usage events are billed
per organisation. Integration connections are configured per organisation. Each
of the three capabilities writes rows that are meaningless without a tenant, and
two of those tables are append-only by design — so a tenant added later cannot
be backfilled onto the history the pilot generates.

The revised order:

**Phase 0** Organisation scope
**Phase 1** Episode identity and lifecycle
**Phase 2** Usage ledger
**Phase 3a** Integration Centre — configuration, health, audit
**Phase 3b** Integration Centre — credentials and live connection tests

Phase 3b is separated deliberately: 3a is ordinary product work, 3b requires a
security decision that has not been made yet (§7).

One distinction worth fixing in the vocabulary now, because it is baked into
every table below. "Organisation" is used in the research for two different
things: the **customer** whose usage is billed, and the **source facility** the
data came from. A lab sends results to a service; they are not the same party.
`Organisation` is the tenant. The origin stays as `sourceSystem` /
`sourceFacility` on the episode.

---

## 3. Phase 0 — Organisation scope

```prisma
model Organisation {
  id        String   @id @default(cuid())
  key       String   @unique   // reuses the existing RuleSetActivation.organisationKey values
  name      String
  shortName String?
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

`key` deliberately matches the string `RuleSetActivation.organisationKey`
already carries, so organisation-scoped rulesets keep working unchanged and the
existing precedence logic in `lib/clinical-rules/current-ruleset.ts` needs no
edit.

Add `organisationId` to `BatchRun`, `User`, and the new tables in Phases 1–3.
Do **not** add it to `RuleEvaluation` (see §1).

Single-tenant deployments get one seeded organisation, so nothing becomes
nullable-forever and no code path has to handle "no organisation".

**Tests.** Every new query is organisation-scoped; a test asserts that a query
without an organisation filter cannot return another organisation's rows. This
is the cheapest point in the product's life to make that guarantee.

---

## 4. Phase 1 — Episode identity and lifecycle

### The two-tier key, and why only one of them may act

The research proposes one fingerprint. It needs to be two, because they carry
very different confidence and must have very different consequences.

**Strong key** — `hash(organisationId, sourceSystem, sourceEpisodeKey)`, where
`sourceEpisodeKey` is the accession number, specimen ID or message control ID.
Deterministic. Only a strong-key match may classify a case as
`ALREADY_IN_REVIEW`, `COMPLETED` or `UPDATED`.

**Weak key** — `hash(organisationId, nhi, testType, collectionDate)`. A
heuristic. It may only ever produce `POSSIBLE_DUPLICATE`, which is advisory: the
case stays selectable, and the reviewer decides.

This distinction is a clinical-safety requirement, not a nicety. Suppressing a
screening result on a fuzzy match is how a real result gets lost, and the same
patient legitimately has repeat tests, surveillance results and amended reports.
**A weak match must never withhold a case.**

### Nothing arrives and disappears

Every arrival is recorded even when it is not re-processed:

```prisma
model ScreeningEpisode {
  id                String   @id @default(cuid())
  organisationId    String
  sourceSystem      String
  sourceEpisodeKey  String?
  nhi               String?
  testType          String?
  collectedOn       DateTime?
  strongFingerprint String?  @unique
  weakFingerprint   String
  state             EpisodeState
  firstSeenAt       DateTime @default(now())
  lastSeenAt        DateTime
  observations      EpisodeObservation[]
  @@index([organisationId, weakFingerprint])
}

model EpisodeObservation {
  id                String   @id @default(cuid())
  episodeId         String
  batchRunId        String
  classification    EpisodeClassification
  batchReviewItemId String?          // null when not processed
  outcome           String           // what happened, e.g. "not reprocessed — completed 12 Aug"
  payloadDigest     String           // detects genuinely changed content
  observedAt        DateTime @default(now())
}
```

`EpisodeObservation` is the safety record. A result that arrived and was
correctly not reprocessed still leaves a row saying so — otherwise a suppressed
result is indistinguishable from a lost one, which is exactly the failure a
hospital will ask about.

`payloadDigest` is what separates a true duplicate from an updated result: same
strong key, different digest means new clinical information, and that becomes a
regrade on the existing `RuleEvaluation` chain with the prior decision
preserved.

### Lifecycle, without re-implementing what exists

```
RECEIVED → VALIDATED → ROUTED → EVALUATED → IN_REVIEW → REVIEWED → COMPLETED
```

Side states: `DUPLICATE`, `UPDATED`, `FAILED_IMPORT`.

`NEEDS_INFORMATION` is deliberately **not** a lifecycle state. It is already a
`BatchReviewDisposition`, set by a reviewer. Duplicating it as a pipeline state
would create two sources of truth for the same fact and they would drift.
Lifecycle describes where a case is in the pipeline; disposition describes what
a clinician decided. Keep them separate.

### What has to change to carry the identifiers

The identifiers do not exist yet, so they have to be threaded end to end:

1. `SourceMetadata` in `lib/batch/types.ts` — add `sourceEpisodeKey`,
   `sourceFacility`, `testType`, `collectedOn`.
2. `lib/batch/template-columns.ts` — add accession/specimen columns with
   aliases, so uploads can supply them. This file drives both validation and
   the generated template, so both follow automatically.
3. Adapters (`csv`, `xlsx`, `json`) — parse the new columns.
4. `BatchReviewItem` — add `episodeId`.
5. **`lib/batch/realistic-dataset.ts` and `demo-dataset.ts` — emit stable
   episode keys.** Without this the feature cannot be demonstrated at all. The
   six existing `RETURNING_PATIENTS` are the natural seed: give them fixed
   accession numbers so a second pull genuinely re-presents the same episodes,
   and give one of them a changed result so `UPDATED` appears too.

### Where classification runs

In the preview path in `app/api/batch/process/route.ts`, which already returns
an un-persisted preview. Classification is a read; it fits the existing
"nothing is persisted here" contract, so the counts can appear on Pull Cases
before anything is committed. `ScreeningEpisode` and `EpisodeObservation` are
written at persistence time in `lib/batch/persistence.ts`.

### Surfaces

Pull Cases summary becomes `70 received · 48 new · 12 already in review · 8
completed · 2 updated`, with a per-row chip. A completed match shows
"Previously processed 12 Aug 2026" with a link to the decision rather than a
silent drop. An updated match offers "New information received — evaluate as a
new revision".

---

## 5. Phase 2 — Usage ledger

```prisma
model UsageEvent {
  id                  String   @id @default(cuid())
  organisationId      String
  episodeId           String
  batchReviewItemId   String?
  ruleEvaluationId    String?
  eventType           UsageEventType     // TRIAGE | REGRADE | UPDATE_REEVALUATION
  billable            Boolean
  billableReason      BillableReason
  rulesetVersion      String
  rulesetChecksum     String
  source              String
  isDemo              Boolean  @default(false)
  supersedesEventId   String?            // corrections append, never update
  occurredAt          DateTime @default(now())
  @@index([organisationId, occurredAt])
  @@index([episodeId])
}
```

Two decisions this encodes:

**`billableReason` is a closed enum, not free text.** An invoice dispute is
answered by reading the reason column, and free text cannot be aggregated or
audited. Starting set: `FIRST_TRIAGE_OF_EPISODE`, `EXCLUDED_DUPLICATE`,
`EXCLUDED_PREVIEW`, `EXCLUDED_FAILED_IMPORT`, `EXCLUDED_DEMO`,
`EXCLUDED_TECHNICAL_RETRY`, `EXCLUDED_REGRADE_SAME_EPISODE`.

**Corrections append.** Give `UsageEvent` the same immutability triggers as
`RuleEvaluation` — the pattern is already in `lib/database/current-schema.sql`
and the tests for it already exist. A wrongly-billed event is corrected by
appending a reversal that points at it through `supersedesEventId`. A billing
ledger you can quietly edit is not evidence.

`isDemo` reuses the existing `demoProvenance()` helper, so demo traffic is
excluded by the same mechanism that already excludes demo attestations from
production governance gates.

The Admin **Usage & Activity** screen reports from this ledger only — never by
counting `BatchReviewItem` or `RuleEvaluation` rows. Build the ledger now and
leave prices off the screen; the write path is what is expensive to retrofit,
not the display.

---

## 6. Phase 3a — Integration Centre: configuration, health, audit

```prisma
model IntegrationConnection {
  id             String   @id @default(cuid())
  organisationId String
  connectorId    String            // matches CONNECTOR_CATALOG ids
  name           String
  state          ConnectionState   // NOT_CONFIGURED | CONFIGURED | CONNECTION_VERIFIED
                                   // | MAPPING_VERIFIED | ACTIVE | CONNECTION_ERROR | PAUSED
  configJson     String            // endpoints, facility codes, schedule — NO secrets
  mappingJson    String
  credentialRef  String?           // the NAME of a secret, never a value
  lastSuccessAt  DateTime?
  lastErrorAt    DateTime?
  lastErrorText  String?
  @@unique([organisationId, connectorId, name])
}

model IntegrationConnectionEvent {
  id            String   @id @default(cuid())
  connectionId  String
  eventType     String   // CONFIG_CHANGED | TEST_RUN | ACTIVATED | PAUSED | CREDENTIAL_REPLACED
  actorUserId   String
  detailJson    String   // redacted by construction — see below
  createdAt     DateTime @default(now())
}
```

`CONNECTOR_CATALOG` stays as the catalogue of connector *types*; these rows are
the configured *instances*. The static file keeps its job.

The wizard runs Connection → Authentication → Mapping → Test → Schedule →
Activate, and the state machine only permits `ACTIVE` from `MAPPING_VERIFIED`.

**Test Connection is worth building in 3a even with no network access**, because
most of its value is offline: required-field coverage, mapping completeness
(`14/16 mapped`), schedule validity, and a clear `Ready for activation: NO`.
That is a genuine, shippable diagnostic. The live network checks land in 3b.

`detailJson` must be built by an allow-list of fields, the way
`buildUserAuditEntry` already is — never by serialising the whole config object,
which is how a credential ends up in an audit payload.

---

## 7. Phase 3b — Credentials, and the decision it needs

This phase should not start until the secret-storage question is answered,
because the answer changes the schema.

**Recommended: store a reference, never a value.** `credentialRef` holds the
*name* of an environment variable or secret-manager entry; the value is set in
Vercel's environment and read server-side at call time. The application database
then never contains a credential, which means a database dump, a backup, an
audit export or a Prisma query can never leak one. "Replace credential" becomes
an instruction plus a verification test rather than a form field.

The alternative — encrypting secrets at rest in the DB — needs a key management
story (where the key lives, how it rotates, who can read it) that this stack
does not currently have. It is the wrong first move for a pilot.

Either way the UI rule from the research holds and should be enforced by tests:
**Replace credential** and **Test connection**, never **Show credential**; the
API must never return a secret value, and no secret may reach a log or audit
payload.

Live test steps per connector, reported individually rather than as one
green/red: network reachable, authentication accepted, organisation recognised,
sample resource retrieved, required fields mapped.

**HL7 v2 stays blocked on infrastructure** until there is a host that can hold a
TCP listener (see §1). FHIR R4 and PMS polling can ship on the existing cron.

---

## 8. Sizing and risk

| Phase | Size | Main risk |
|---|---|---|
| 0 · Organisation | Small | Touching many queries at once; mitigated by doing it before there is history to migrate |
| 1 · Episode identity | **Large** | The identifiers do not exist anywhere yet — schema, template, three adapters, both demo generators, preview path and persistence all change together |
| 2 · Usage ledger | Medium | Getting `billableReason` right first time; the ledger is immutable, so the vocabulary is hard to change later |
| 3a · Integration config | Medium | Redaction discipline in the audit payload |
| 3b · Credentials + live tests | Medium | Blocked on §7; HL7 additionally blocked on hosting |

Phase 1 is the one most likely to be underestimated. The classification logic is
straightforward; threading a new identifier through every layer that produces a
case is not, and the demo generators must change or the feature is invisible.

---

## 9. Decisions needed before Phase 2 and Phase 3b

1. **Is an updated-result re-evaluation billable?** Same episode, new clinical
   information, a second governed evaluation and a second clinician review. It
   is defensible either way, and it is a pricing decision, not an engineering
   one. It must be settled before `BillableReason` is fixed, because the ledger
   is immutable.
2. **Secret storage:** environment/secret-manager reference (recommended) or
   encrypted-at-rest with a managed key.
3. **HL7 v2 ingestion host:** is a long-running service in scope for the pilot,
   or does the pilot run on file upload and FHIR only?
4. **Does one deployment ever serve more than one customer?** If the pilot is
   single-tenant forever, Phase 0 shrinks to a seeded constant. If not, it is
   load-bearing and Phase 0 is the right place to spend the effort.

---

## 10. What this deliberately does not touch

No clinical rule, no ruleset content, no evaluation logic, no authority
resolution, no case pinning, no review-queue decision logic, no safety stop, no
governance enforcement and no audit immutability. Episode classification runs
strictly *before* evaluation and decides only whether a case is presented for
processing; an updated episode enters the existing regrade chain rather than
creating a new one. The clinical layer stays as it is.
