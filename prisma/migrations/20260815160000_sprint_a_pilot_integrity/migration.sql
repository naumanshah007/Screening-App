-- Pilot intake accounting and receipt metadata. Existing runs predate the
-- manifest, so their zero counts are intentionally not reconstructed.
ALTER TABLE "BatchRun" ADD COLUMN "deliveryKey" TEXT;
ALTER TABLE "BatchRun" ADD COLUMN "intakeStatus" TEXT NOT NULL DEFAULT 'COMPLETED';
ALTER TABLE "BatchRun" ADD COLUMN "sourceRecordCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "BatchRun" ADD COLUMN "parsedRecordCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "BatchRun" ADD COLUMN "skippedRecordCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "BatchRun" ADD COLUMN "intakeManifestJson" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "BatchRun" ADD COLUMN "outcomeManifestJson" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "BatchRun" ADD COLUMN "completedAt" DATETIME;
UPDATE "BatchRun" SET "completedAt" = "updatedAt" WHERE "completedAt" IS NULL;

-- Work-management metadata for NEEDS_INFO. These fields deliberately do not
-- alter the stored clinical input or governed evaluation.
ALTER TABLE "BatchReviewItem" ADD COLUMN "informationOwnerUserId" TEXT;
ALTER TABLE "BatchReviewItem" ADD COLUMN "informationOwnerName" TEXT;
ALTER TABLE "BatchReviewItem" ADD COLUMN "informationRequestedAt" DATETIME;
ALTER TABLE "BatchReviewItem" ADD COLUMN "informationReceivedAt" DATETIME;
ALTER TABLE "BatchReviewItem" ADD COLUMN "informationResolutionNote" TEXT;
