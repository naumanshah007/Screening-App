-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BatchReviewItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchRunId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "label" TEXT,
    "externalPatientId" TEXT,
    "patientAge" INTEGER,
    "ethnicityPrimary" TEXT,
    "patientName" TEXT,
    "nhi" TEXT,
    "gpPractice" TEXT,
    "receivedDate" DATETIME,
    "figure" TEXT NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "recommendationCode" TEXT NOT NULL,
    "recommendation" TEXT NOT NULL,
    "referralPriority" TEXT,
    "referralType" TEXT,
    "safetyOutcome" TEXT,
    "reviewRequired" BOOLEAN NOT NULL DEFAULT false,
    "engineStatus" TEXT NOT NULL DEFAULT 'success',
    "caseJson" TEXT NOT NULL,
    "inputJson" TEXT NOT NULL,
    "decisionJson" TEXT NOT NULL,
    "triagePriority" TEXT,
    "triageCategory" TEXT,
    "triageOutcome" TEXT,
    "triageTargetDays" INTEGER,
    "triageRuleCode" TEXT,
    "triageRuleReleaseId" TEXT,
    "triageRuleVersion" TEXT,
    "priorDecisionCount" INTEGER NOT NULL DEFAULT 0,
    "priorItemId" TEXT,
    "disposition" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedByUserId" TEXT,
    "reviewedAt" DATETIME,
    "reviewNote" TEXT,
    "overrideReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BatchReviewItem_batchRunId_fkey" FOREIGN KEY ("batchRunId") REFERENCES "BatchRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BatchReviewItem_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_BatchReviewItem" ("batchRunId", "caseJson", "createdAt", "decisionJson", "disposition", "engineStatus", "ethnicityPrimary", "externalPatientId", "figure", "gpPractice", "id", "inputJson", "label", "nhi", "overrideReason", "patientAge", "patientName", "receivedDate", "recommendation", "recommendationCode", "referralPriority", "referralType", "reviewNote", "reviewRequired", "reviewedAt", "reviewedByUserId", "riskLevel", "rowNumber", "safetyOutcome", "updatedAt") SELECT "batchRunId", "caseJson", "createdAt", "decisionJson", "disposition", "engineStatus", "ethnicityPrimary", "externalPatientId", "figure", "gpPractice", "id", "inputJson", "label", "nhi", "overrideReason", "patientAge", "patientName", "receivedDate", "recommendation", "recommendationCode", "referralPriority", "referralType", "reviewNote", "reviewRequired", "reviewedAt", "reviewedByUserId", "riskLevel", "rowNumber", "safetyOutcome", "updatedAt" FROM "BatchReviewItem";
DROP TABLE "BatchReviewItem";
ALTER TABLE "new_BatchReviewItem" RENAME TO "BatchReviewItem";
CREATE INDEX "BatchReviewItem_batchRunId_disposition_idx" ON "BatchReviewItem"("batchRunId", "disposition");
CREATE INDEX "BatchReviewItem_batchRunId_reviewRequired_idx" ON "BatchReviewItem"("batchRunId", "reviewRequired");
CREATE INDEX "BatchReviewItem_reviewedByUserId_reviewedAt_idx" ON "BatchReviewItem"("reviewedByUserId", "reviewedAt");
CREATE INDEX "BatchReviewItem_nhi_createdAt_idx" ON "BatchReviewItem"("nhi", "createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
