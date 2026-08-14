-- Phase 2 usage-ledger integrity closure.
--
-- ADDITIVE ONLY. The immutable UsageEvent, RuleEvaluation, AuditLog and
-- ScreeningEpisode tables are never rebuilt or copied.

-- Future writes must reference a durable episode in the same tenant. These
-- triggers intentionally do not rewrite or reject the 27 historical demo rows;
-- those remain raw evidence and are qualified by append-only corrections below.
CREATE TRIGGER "UsageEvent_episode_exists_insert"
BEFORE INSERT ON "UsageEvent"
WHEN NOT EXISTS (
  SELECT 1 FROM "ScreeningEpisode" WHERE "id" = NEW."episodeId"
)
BEGIN
  SELECT RAISE(ABORT, 'USAGE_EVENT_EPISODE_NOT_FOUND');
END;

CREATE TRIGGER "UsageEvent_episode_organisation_insert"
BEFORE INSERT ON "UsageEvent"
WHEN EXISTS (
  SELECT 1
  FROM "ScreeningEpisode"
  WHERE "id" = NEW."episodeId"
    AND "organisationId" <> NEW."organisationId"
)
BEGIN
  SELECT RAISE(ABORT, 'USAGE_EVENT_EPISODE_ORGANISATION_MISMATCH');
END;

-- EpisodeObservation currently cascades on episode deletion. That would erase
-- arrival evidence, and without a UsageEvent FK it would also orphan usage.
-- Block deletion only when immutable/arrival history references the episode;
-- an empty episode can still be removed if a failed registration created one.
CREATE TRIGGER "ScreeningEpisode_history_restrict_delete"
BEFORE DELETE ON "ScreeningEpisode"
WHEN EXISTS (
  SELECT 1 FROM "UsageEvent" WHERE "episodeId" = OLD."id"
) OR EXISTS (
  SELECT 1 FROM "EpisodeObservation" WHERE "episodeId" = OLD."id"
)
BEGIN
  SELECT RAISE(ABORT, 'SCREENING_EPISODE_HAS_HISTORY');
END;

CREATE TABLE "UsageEventCorrection" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "usageEventId" TEXT NOT NULL,
  "correctionType" TEXT NOT NULL
    CHECK ("correctionType" IN ('INVALIDATE')),
  "reasonCode" TEXT NOT NULL
    CHECK ("reasonCode" IN ('EPISODE_REGISTRATION_ROLLBACK')),
  "reasonDetail" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actorUserId" TEXT,
  "systemActor" TEXT,
  "organisationId" TEXT NOT NULL,
  "metadataJson" TEXT,
  CONSTRAINT "UsageEventCorrection_usageEventId_fkey"
    FOREIGN KEY ("usageEventId") REFERENCES "UsageEvent" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "UsageEventCorrection_usageEventId_correctionType_key"
  ON "UsageEventCorrection"("usageEventId", "correctionType");

CREATE INDEX "UsageEventCorrection_organisationId_createdAt_idx"
  ON "UsageEventCorrection"("organisationId", "createdAt");

CREATE INDEX "UsageEventCorrection_reasonCode_createdAt_idx"
  ON "UsageEventCorrection"("reasonCode", "createdAt");

CREATE TRIGGER "UsageEventCorrection_organisation_insert"
BEFORE INSERT ON "UsageEventCorrection"
WHEN EXISTS (
  SELECT 1
  FROM "UsageEvent"
  WHERE "id" = NEW."usageEventId"
    AND "organisationId" <> NEW."organisationId"
)
BEGIN
  SELECT RAISE(ABORT, 'USAGE_EVENT_CORRECTION_ORGANISATION_MISMATCH');
END;

CREATE TRIGGER "UsageEventCorrection_immutable_update"
BEFORE UPDATE ON "UsageEventCorrection"
BEGIN
  SELECT RAISE(ABORT, 'Usage event corrections are immutable');
END;

CREATE TRIGGER "UsageEventCorrection_immutable_delete"
BEFORE DELETE ON "UsageEventCorrection"
BEGIN
  SELECT RAISE(ABORT, 'Usage event corrections are immutable');
END;
