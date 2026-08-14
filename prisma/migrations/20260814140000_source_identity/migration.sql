-- AlterTable
ALTER TABLE "BatchReviewItem" ADD COLUMN "clinicalPayloadDigest" TEXT;
ALTER TABLE "BatchReviewItem" ADD COLUMN "collectedOn" DATETIME;
ALTER TABLE "BatchReviewItem" ADD COLUMN "rawPayloadDigest" TEXT;
ALTER TABLE "BatchReviewItem" ADD COLUMN "sourceEpisodeKey" TEXT;
ALTER TABLE "BatchReviewItem" ADD COLUMN "sourceFacility" TEXT;
ALTER TABLE "BatchReviewItem" ADD COLUMN "testType" TEXT;

-- CreateTable
CREATE TABLE "IngestionReceipt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "deliveryKey" TEXT NOT NULL,
    "batchRunId" TEXT,
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "caseCount" INTEGER NOT NULL DEFAULT 0
);

-- CreateIndex
CREATE INDEX "IngestionReceipt_organisationId_receivedAt_idx" ON "IngestionReceipt"("organisationId", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "IngestionReceipt_organisationId_channel_deliveryKey_key" ON "IngestionReceipt"("organisationId", "channel", "deliveryKey");

-- CreateIndex
CREATE INDEX "BatchReviewItem_sourceEpisodeKey_idx" ON "BatchReviewItem"("sourceEpisodeKey");

