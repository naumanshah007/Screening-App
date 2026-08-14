# Case lifecycle, usage metering and the Integration Centre

An implementation plan for the three proposed capabilities, checked against the
code as it stands rather than against the idea of it.

> **Status: Phase 0 is built.** Seven decisions were taken before it started and
> are recorded in §11. Three of them changed designs in this document; the
> affected sections have been revised rather than annotated, so what follows is
> the current design, not the original proposal.

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

## 3. Phase 0 — Organisation scope · **built**

```prisma
model Organisation {
  id        String     @id @default(cuid())
  key       String     @unique   // reuses the existing RuleSetActivation.organisationKey values
  name      String
  shortName String?
  isActive  Boolean    @default(true)
  batchRuns BatchRun[]
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt
}
```

`key` deliberately matches the string `RuleSetActivation.organisationKey`
already carries, so organisation-scoped rulesets keep working unchanged and the
precedence logic in `lib/clinical-rules/current-ruleset.ts` needed no edit.

`BatchRun.organisationId` is the only foreign key added. **`User` was
deliberately left alone**: in single-tenant operation every user resolves to the
same organisation, so the column would be pure redundancy, and populating it
means touching account creation, seeding and the demo identities — the tenant
plumbing the decision in §11.1 asked to avoid. It is added when a second tenant
is.

`RuleEvaluation` gets nothing (see §1); organisation is derived through
`batchRunId` / `caseId`.

### Resolution, and why it fails closed

`lib/organisation/current-organisation.ts` is the seam. There is no organisation
on the session, in the URL, or in any request — that is the point. Resolution
order:

1. `ORGANISATION_KEY` when set. A named organisation that is missing or disabled
   is an **error**, never a fallback to whatever else is in the table.
2. Otherwise the single active organisation, when there is exactly one.

Zero and more-than-one are both errors. Guessing when the answer is ambiguous is
how rows end up attributed to the wrong customer the first time a second one
appears.

Read paths use `getCurrentOrganisation()`, which returns null so a dashboard can
render an honest empty state. Write paths use `requireCurrentOrganisationId()`,
which throws. That asymmetry is deliberate: a run written without a tenant is
silently wrong and, because the episode and usage rows that will hang off it are
append-only, permanently uncorrectable. Refusing to write is the recoverable
outcome.

### Migration: two paths, on purpose

Prisma's SQLite migration rebuilds `BatchRun` — create, copy, drop, rename.
That is correct for a fresh or local database and is what
`prisma/migrations/20260814120000_organisation_scope` does.

It is the wrong thing to run against a live database whose `BatchRun` rows are
referenced by immutable `RuleEvaluation` records, because a rebuild drops the
table those keys point at. So `ensureOrganisationScope()` in
`lib/database/bootstrap.ts` takes the additive path instead: SQLite permits
`ADD COLUMN` with a `REFERENCES` clause as long as the column is nullable, which
this one is. Existing runs are backfilled to the seeded organisation — correct
rather than convenient, since a single-tenant deployment has exactly one
customer — and only rows with no organisation are touched, so nothing can be
reassigned later.

That is also why `organisationId` is nullable in the Prisma schema. It is
required in practice: every write supplies it, and the tests below assert it.

**Tests** — `tests/db/stack-07-organisation-scope.test.ts`: seeding is
idempotent and never overwrites an edited name; a named-but-absent organisation
fails closed with a message that says what to fix; a disabled organisation is
not resolved; ambiguity is surfaced rather than guessed; a run carries its
tenant; an organisation that owns runs cannot be deleted.

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
**A weak match must never withhold a case** — it is advisory only, and a test
asserts that a weak match leaves the case selectable (decision §11.7).

### Hashes decide; source identifiers explain

The fingerprints are stored alongside the identifiers they were derived from,
never instead of them (decision §11.6). `sourceSystem`, `sourceEpisodeKey`,
`nhi`, `testType` and `collectedOn` are kept in clear on the episode, and every
match must be explainable in those terms:

> Matched on accession **A12345** from **Awanui Labs — Auckland**, collected 3 Aug 2026

never "matched on fingerprint `3f9ae1…`". A hash is a lookup index; it is not an
explanation, and a clinician asked to accept that two results are the same
episode is entitled to see why. The same applies to a dispute over a usage
event.

### Ingestion idempotency is a separate concern

Transport-level replay and clinical-episode identity are different questions and
must not share a key (decision §11.5). The same episode legitimately arrives
twice as different messages — an amended report is exactly that. The same
message legitimately arrives twice from a flaky transport. Conflating them
produces both false duplicates and missed updates.

```prisma
model IngestionReceipt {
  id             String   @id @default(cuid())
  organisationId String
  channel        String            // upload | fhir | hl7-gateway
  deliveryKey    String            // file hash, message control ID, delivery ID
  receivedAt     DateTime @default(now())
  batchRunId     String?
  @@unique([organisationId, channel, deliveryKey])
}
```

This is purely technical: it stops the same delivery being processed twice and
answers "did we already receive this file". It says nothing clinical. Episode
identity, below, is the clinical question and runs afterwards.

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

The event records **what happened**. It does not record what it costs. Those are
separated deliberately (decision §11.2): pricing changes over the life of a
contract, and an immutable ledger cannot carry a mutable opinion.

```prisma
model UsageEvent {
  id                String   @id @default(cuid())
  organisationId    String
  episodeId         String
  batchReviewItemId String?
  ruleEvaluationId  String?
  eventType         UsageEventType   // TRIAGE | REGRADE | UPDATE_REEVALUATION
  classification    EpisodeClassification  // why this event exists
  rulesetVersion    String
  rulesetChecksum   String
  source            String
  isDemo            Boolean  @default(false)
  occurredAt        DateTime @default(now())
  @@index([organisationId, occurredAt])
  @@index([episodeId])
}
```

There is no `billable` column and no `billableReason`. Billing is a **policy
applied over the ledger**, versioned separately:

```prisma
model BillingPolicyVersion {
  id         String   @id @default(cuid())
  key        String            // e.g. "pilot-2026"
  rulesJson  String            // which eventType/classification combinations bill
  effectiveFrom DateTime
  effectiveTo   DateTime?
}
```

An invoice for a period is produced by evaluating the policy that was in force
against the events that occurred. Re-running it is deterministic, a contract
change is a new policy version rather than a rewrite of history, and a dispute
is answered by showing both the events and the policy — neither of which had to
be edited.

**Initial policy:** an updated result on the same episode is **non-billable**
unless later contract terms say otherwise. Because that now lives in a policy
version rather than in the event schema, changing it later is a new row, not a
migration.

**The ledger is still append-only.** Give `UsageEvent` the same immutability
triggers as `RuleEvaluation` — the pattern is already in
`lib/database/current-schema.sql` and its tests exist. A wrongly-recorded event
is corrected by appending a reversal, never by editing. A usage ledger you can
quietly edit is not evidence.

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

**Decided (§11.3): store an opaque reference, never a value.** `credentialRef`
holds an opaque handle — it is not itself a secret and carries no meaning to
anyone who reads the database. The application database never contains a
credential, so a dump, a backup, an audit export or a stray Prisma query cannot
leak one. "Replace credential" becomes an instruction plus a verification test
rather than a form field.

**The resolver is provider-agnostic from the start**, even though Vercel's
environment is the first and only provider:

```ts
interface SecretProvider {
  readonly id: string;                                  // "vercel-env"
  resolve(ref: CredentialRef): Promise<string | null>;  // server-side only
  describe(ref: CredentialRef): Promise<{ lastUpdatedAt: Date | null }>;
}
```

`describe` exists so the UI can show `Client secret: •••••••••• · Updated 14 Aug
2026` without any path that returns the value. Adding a managed secret manager
later is a second implementation of this interface and a changed `providerId` on
the connection — not a schema migration and not a re-plumbing of every call
site. Encrypting secrets at rest in the application database stays rejected: it
needs a key management story (where the key lives, how it rotates, who can read
it) that this stack does not have.

Either way the UI rule from the research holds and should be enforced by tests:
**Replace credential** and **Test connection**, never **Show credential**; the
API must never return a secret value, and no secret may reach a log or audit
payload.

Live test steps per connector, reported individually rather than as one
green/red: network reachable, authentication accepted, organisation recognised,
sample resource retrieved, required fields mapped.

**HL7 v2 configuration and mapping ship; MLLP ingestion does not** (decision
§11.4). The connector is fully configurable in the product — endpoint, facility
codes, OBX mappings, the lot — and its offline test reports mapping coverage
like any other. What it does not do is open a socket. Real MLLP ingestion is out
of the initial pilot platform unless a customer specifically requires it, and
lands as an external long-running **HL7 Gateway** that authenticates to this
application and posts through the same ingestion path as any other channel. The
`IngestionReceipt.channel` value `hl7-gateway` exists for exactly that.

Configuring an HL7 connector must therefore say plainly that it is prepared but
not receiving, rather than sitting in a state that implies a live feed.

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

## 9. Open questions

None blocking. The four questions this document originally raised are answered
in §11.

The one thing still to settle is commercial rather than technical: **the price
per triage case, and whether an updated-result re-evaluation ever becomes
billable.** The initial policy is that it does not (§11.2), and because that now
lives in a `BillingPolicyVersion` row rather than in the event schema, changing
it is a new policy version rather than a migration. It does not block Phase 1 or
Phase 2.

---

## 10. Decisions of record

Taken before Phase 0 started. Three of them changed designs above; those
sections were revised rather than annotated.

| # | Decision | What it changed |
|---|---|---|
| 11.1 | Build a real Organisation model now, operate single-tenant, seed one organisation, no tenant-switching complexity | Phase 0 as built. `User.organisationId` deferred as tenant plumbing that buys nothing while there is one tenant |
| 11.2 | Separate the immutable usage event from billing policy. Updated-result billing is not frozen into the event schema. Initial policy: an updated result on the same episode is non-billable unless contract terms say otherwise | **Changed §5.** `billable` and `billableReason` removed from `UsageEvent`; added `BillingPolicyVersion` evaluated over the ledger |
| 11.3 | Opaque `credentialRef`, no secret values in the normal database, provider-agnostic resolver even though Vercel env is the first provider | **Changed §7.** Added the `SecretProvider` interface and `describe()` so the UI can show a last-updated date with no path that returns a value |
| 11.4 | Real MLLP ingestion is out of the initial pilot unless a customer requires it. Keep HL7 configuration and mapping; a future external long-running HL7 Gateway does ingestion | **Changed §7.** HL7 ships configurable but explicitly not receiving; `IngestionReceipt.channel` reserves `hl7-gateway` |
| 11.5 | Ingestion idempotency is separate from clinical episode identity | **Added to §4.** `IngestionReceipt` keyed on transport delivery, distinct from the episode fingerprints |
| 11.6 | Preserve explainable source identifiers alongside hashed fingerprints | **Added to §4.** Every match must be explainable as "accession A12345 from Awanui Labs", never as a hash |
| 11.7 | Weak duplicate matches are advisory only and must never suppress processing | Reinforced in §4 with a test obligation |

---

## 11. What this deliberately does not touch

No clinical rule, no ruleset content, no evaluation logic, no authority
resolution, no case pinning, no review-queue decision logic, no safety stop, no
governance enforcement and no audit immutability. Episode classification runs
strictly *before* evaluation and decides only whether a case is presented for
processing; an updated episode enters the existing regrade chain rather than
creating a new one. The clinical layer stays as it is.
