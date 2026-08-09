ALTER TABLE "BatchReviewItem" ADD COLUMN "authorityEngine" TEXT NOT NULL DEFAULT 'LEGACY';
ALTER TABLE "BatchReviewItem" ADD COLUMN "authorityReason" TEXT;
ALTER TABLE "BatchReviewItem" ADD COLUMN "legacyDecisionJson" TEXT;
