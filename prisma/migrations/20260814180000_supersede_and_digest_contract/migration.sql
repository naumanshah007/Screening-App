-- AlterTable
ALTER TABLE "BatchReviewItem" ADD COLUMN "supersededAt" DATETIME;
ALTER TABLE "BatchReviewItem" ADD COLUMN "supersededByItemId" TEXT;

