-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RuleVersionAuditEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ruleSetId" TEXT NOT NULL,
    "ruleVersionId" TEXT,
    "actorUserId" TEXT,
    "eventType" TEXT NOT NULL,
    "reason" TEXT,
    "beforeJson" TEXT,
    "afterJson" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RuleVersionAuditEvent_ruleSetId_fkey" FOREIGN KEY ("ruleSetId") REFERENCES "ClinicalRuleSet" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RuleVersionAuditEvent_ruleVersionId_fkey" FOREIGN KEY ("ruleVersionId") REFERENCES "ClinicalRuleVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RuleVersionAuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_RuleVersionAuditEvent" ("actorUserId", "afterJson", "beforeJson", "createdAt", "eventType", "id", "ipAddress", "reason", "ruleSetId", "ruleVersionId", "userAgent") SELECT "actorUserId", "afterJson", "beforeJson", "createdAt", "eventType", "id", "ipAddress", "reason", "ruleSetId", "ruleVersionId", "userAgent" FROM "RuleVersionAuditEvent";
DROP TABLE "RuleVersionAuditEvent";
ALTER TABLE "new_RuleVersionAuditEvent" RENAME TO "RuleVersionAuditEvent";
CREATE INDEX "RuleVersionAuditEvent_ruleSetId_createdAt_idx" ON "RuleVersionAuditEvent"("ruleSetId", "createdAt");
CREATE INDEX "RuleVersionAuditEvent_ruleVersionId_createdAt_idx" ON "RuleVersionAuditEvent"("ruleVersionId", "createdAt");
CREATE INDEX "RuleVersionAuditEvent_actorUserId_createdAt_idx" ON "RuleVersionAuditEvent"("actorUserId", "createdAt");
CREATE INDEX "RuleVersionAuditEvent_isDemo_eventType_idx" ON "RuleVersionAuditEvent"("isDemo", "eventType");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" DATETIME,
    "image" TEXT,
    "passwordHash" TEXT,
    "passwordChangeRequired" BOOLEAN NOT NULL DEFAULT false,
    "passwordChangedAt" DATETIME,
    "passwordExpiresAt" DATETIME,
    "role" TEXT NOT NULL DEFAULT 'GP',
    "twoFASecret" TEXT,
    "twoFAEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFARecoveryCodesJson" TEXT,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" DATETIME,
    "lastLoginAt" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDemoAccount" BOOLEAN NOT NULL DEFAULT false,
    "gpPracticeId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_gpPracticeId_fkey" FOREIGN KEY ("gpPracticeId") REFERENCES "GPPractice" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("createdAt", "email", "emailVerified", "failedAttempts", "gpPracticeId", "id", "image", "lastLoginAt", "lockedUntil", "name", "passwordChangeRequired", "passwordChangedAt", "passwordExpiresAt", "passwordHash", "role", "twoFAEnabled", "twoFARecoveryCodesJson", "twoFASecret", "updatedAt") SELECT "createdAt", "email", "emailVerified", "failedAttempts", "gpPracticeId", "id", "image", "lastLoginAt", "lockedUntil", "name", "passwordChangeRequired", "passwordChangedAt", "passwordExpiresAt", "passwordHash", "role", "twoFAEnabled", "twoFARecoveryCodesJson", "twoFASecret", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

