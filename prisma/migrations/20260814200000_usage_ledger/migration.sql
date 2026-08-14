-- CreateTable
CREATE TABLE "UsageEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "classification" TEXT NOT NULL,
    "batchReviewItemId" TEXT,
    "ruleEvaluationId" TEXT,
    "batchRunId" TEXT,
    "rulesetVersion" TEXT,
    "rulesetChecksum" TEXT,
    "source" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "idempotencyKey" TEXT NOT NULL,
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "UsageEvent_idempotencyKey_key" ON "UsageEvent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "UsageEvent_organisationId_occurredAt_idx" ON "UsageEvent"("organisationId", "occurredAt");

-- CreateIndex
CREATE INDEX "UsageEvent_organisationId_eventType_occurredAt_idx" ON "UsageEvent"("organisationId", "eventType", "occurredAt");

-- CreateIndex
CREATE INDEX "UsageEvent_episodeId_idx" ON "UsageEvent"("episodeId");


-- Append-only, matching RuleEvaluation.
--
-- A usage ledger that can be quietly edited is not evidence. A wrongly-recorded
-- event is corrected by appending, never by changing what was written.
CREATE TRIGGER "UsageEvent_immutable_update"
BEFORE UPDATE ON "UsageEvent"
BEGIN
  SELECT RAISE(ABORT, 'Usage events are immutable');
END;

CREATE TRIGGER "UsageEvent_immutable_delete"
BEFORE DELETE ON "UsageEvent"
BEGIN
  SELECT RAISE(ABORT, 'Usage events are immutable');
END;
