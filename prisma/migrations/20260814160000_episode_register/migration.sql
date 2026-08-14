-- AlterTable
ALTER TABLE "BatchReviewItem" ADD COLUMN "episodeId" TEXT;

-- CreateTable
CREATE TABLE "ScreeningEpisode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "strongFingerprint" TEXT,
    "weakFingerprint" TEXT NOT NULL,
    "sourceEpisodeKey" TEXT,
    "sourceFacility" TEXT,
    "nhi" TEXT,
    "testType" TEXT,
    "collectedOn" DATETIME,
    "clinicalPayloadDigest" TEXT,
    "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "EpisodeObservation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "episodeId" TEXT NOT NULL,
    "batchRunId" TEXT,
    "classification" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "batchReviewItemId" TEXT,
    "rawPayloadDigest" TEXT,
    "clinicalPayloadDigest" TEXT,
    "observedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EpisodeObservation_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "ScreeningEpisode" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ScreeningEpisode_strongFingerprint_key" ON "ScreeningEpisode"("strongFingerprint");

-- CreateIndex
CREATE INDEX "ScreeningEpisode_organisationId_weakFingerprint_idx" ON "ScreeningEpisode"("organisationId", "weakFingerprint");

-- CreateIndex
CREATE INDEX "ScreeningEpisode_organisationId_lastSeenAt_idx" ON "ScreeningEpisode"("organisationId", "lastSeenAt");

-- CreateIndex
CREATE INDEX "EpisodeObservation_episodeId_observedAt_idx" ON "EpisodeObservation"("episodeId", "observedAt");

-- CreateIndex
CREATE INDEX "EpisodeObservation_batchRunId_idx" ON "EpisodeObservation"("batchRunId");

