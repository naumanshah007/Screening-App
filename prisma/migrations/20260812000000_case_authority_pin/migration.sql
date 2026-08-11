-- CreateTable
CREATE TABLE "CaseAuthorityPin" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "authorityEngine" TEXT NOT NULL,
    "ruleVersionId" TEXT,
    "ruleVersionDisplay" TEXT,
    "rulesetChecksum" TEXT,
    "engineVersion" TEXT NOT NULL,
    "evaluationId" TEXT,
    "evaluationMode" TEXT,
    "pinnedAt" DATETIME NOT NULL,
    "origin" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CaseAuthorityPin_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ReferralCase" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CaseAuthorityPin_caseId_key" ON "CaseAuthorityPin"("caseId");

-- CreateIndex
CREATE INDEX "CaseAuthorityPin_authorityEngine_pinnedAt_idx" ON "CaseAuthorityPin"("authorityEngine", "pinnedAt");

