-- CreateTable
CREATE TABLE "Organisation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BatchRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT,
    "source" TEXT NOT NULL,
    "sourceSystem" TEXT,
    "sourceFileName" TEXT,
    "engineVersion" TEXT NOT NULL,
    "pinnedRuleVersionId" TEXT,
    "pinnedRuleVersionDisplay" TEXT,
    "pinnedRulesetChecksum" TEXT,
    "totalCases" INTEGER NOT NULL,
    "pendingCount" INTEGER NOT NULL DEFAULT 0,
    "acceptedCount" INTEGER NOT NULL DEFAULT 0,
    "rejectedCount" INTEGER NOT NULL DEFAULT 0,
    "needsInfoCount" INTEGER NOT NULL DEFAULT 0,
    "reviewRequiredCount" INTEGER NOT NULL DEFAULT 0,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BatchRun_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BatchRun_pinnedRuleVersionId_fkey" FOREIGN KEY ("pinnedRuleVersionId") REFERENCES "ClinicalRuleVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BatchRun_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_BatchRun" ("acceptedCount", "createdAt", "createdByUserId", "engineVersion", "id", "needsInfoCount", "pendingCount", "pinnedRuleVersionDisplay", "pinnedRuleVersionId", "pinnedRulesetChecksum", "rejectedCount", "reviewRequiredCount", "source", "sourceFileName", "sourceSystem", "totalCases", "updatedAt") SELECT "acceptedCount", "createdAt", "createdByUserId", "engineVersion", "id", "needsInfoCount", "pendingCount", "pinnedRuleVersionDisplay", "pinnedRuleVersionId", "pinnedRulesetChecksum", "rejectedCount", "reviewRequiredCount", "source", "sourceFileName", "sourceSystem", "totalCases", "updatedAt" FROM "BatchRun";
DROP TABLE "BatchRun";
ALTER TABLE "new_BatchRun" RENAME TO "BatchRun";
CREATE INDEX "BatchRun_createdByUserId_createdAt_idx" ON "BatchRun"("createdByUserId", "createdAt");
CREATE INDEX "BatchRun_source_createdAt_idx" ON "BatchRun"("source", "createdAt");
CREATE INDEX "BatchRun_organisationId_createdAt_idx" ON "BatchRun"("organisationId", "createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Organisation_key_key" ON "Organisation"("key");

-- CreateIndex
CREATE INDEX "Organisation_isActive_idx" ON "Organisation"("isActive");

