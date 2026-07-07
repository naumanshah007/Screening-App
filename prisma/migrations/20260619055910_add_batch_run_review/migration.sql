-- AlterTable
ALTER TABLE "ReferralCase" ADD COLUMN "deletedAt" DATETIME;
ALTER TABLE "ReferralCase" ADD COLUMN "deletedByUserId" TEXT;

-- CreateTable
CREATE TABLE "AccessCertification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "systemName" TEXT NOT NULL,
    "certificationType" TEXT NOT NULL,
    "completedAt" DATETIME NOT NULL,
    "expiresAt" DATETIME,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AccessCertification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IntegrationValidation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "integrationId" TEXT NOT NULL,
    "environment" TEXT NOT NULL DEFAULT 'current',
    "outcome" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "notes" TEXT,
    "validatedAt" DATETIME NOT NULL,
    "expiresAt" DATETIME,
    "validatedByUserId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "IntegrationValidation_validatedByUserId_fkey" FOREIGN KEY ("validatedByUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SecurityIncident" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "dueAt" DATETIME,
    "lastReminderAt" DATETIME,
    "sourcePreset" TEXT,
    "sourceEntity" TEXT,
    "sourceAction" TEXT,
    "sourceUserId" TEXT,
    "auditFilterJson" TEXT,
    "openedByUserId" TEXT NOT NULL,
    "assignedToUserId" TEXT,
    "acknowledgedAt" DATETIME,
    "resolvedAt" DATETIME,
    "resolutionNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SecurityIncident_openedByUserId_fkey" FOREIGN KEY ("openedByUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SecurityIncident_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PatientConsent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'GIVEN',
    "givenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "givenByUserId" TEXT,
    "withdrawnAt" DATETIME,
    "expiresAt" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PatientConsent_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BatchRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "sourceSystem" TEXT,
    "sourceFileName" TEXT,
    "engineVersion" TEXT NOT NULL,
    "totalCases" INTEGER NOT NULL,
    "pendingCount" INTEGER NOT NULL DEFAULT 0,
    "acceptedCount" INTEGER NOT NULL DEFAULT 0,
    "rejectedCount" INTEGER NOT NULL DEFAULT 0,
    "needsInfoCount" INTEGER NOT NULL DEFAULT 0,
    "reviewRequiredCount" INTEGER NOT NULL DEFAULT 0,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BatchRun_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BatchReviewItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchRunId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "label" TEXT,
    "externalPatientId" TEXT,
    "patientAge" INTEGER,
    "ethnicityPrimary" TEXT,
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

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "exportEvent" BOOLEAN NOT NULL DEFAULT false,
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "correlationId" TEXT,
    "sessionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_AuditLog" ("action", "createdAt", "entity", "entityId", "exportEvent", "id", "ipAddress", "newValue", "oldValue", "userAgent", "userId") SELECT "action", "createdAt", "entity", "entityId", "exportEvent", "id", "ipAddress", "newValue", "oldValue", "userAgent", "userId" FROM "AuditLog";
DROP TABLE "AuditLog";
ALTER TABLE "new_AuditLog" RENAME TO "AuditLog";
CREATE INDEX "AuditLog_entity_action_idx" ON "AuditLog"("entity", "action");
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");
CREATE INDEX "AuditLog_entityId_idx" ON "AuditLog"("entityId");
CREATE INDEX "AuditLog_severity_createdAt_idx" ON "AuditLog"("severity", "createdAt");
CREATE INDEX "AuditLog_correlationId_idx" ON "AuditLog"("correlationId");
CREATE TABLE "new_Patient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nhi" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "dateOfBirth" DATETIME NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "gpPracticeId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "isFirstTimeHPVTransition" BOOLEAN NOT NULL DEFAULT false,
    "previousScreeningType" TEXT,
    "lastCytologyDate" DATETIME,
    "isPostHysterectomy" BOOLEAN NOT NULL DEFAULT false,
    "hysterectomyDate" DATETIME,
    "hysterectomyType" TEXT,
    "ethnicityPrimary" TEXT,
    "ethnicityOther" TEXT,
    "interpreterRequired" BOOLEAN NOT NULL DEFAULT false,
    "preferredLanguage" TEXT,
    "nhiValidatedAt" DATETIME,
    "deletedAt" DATETIME,
    "deletedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Patient_gpPracticeId_fkey" FOREIGN KEY ("gpPracticeId") REFERENCES "GPPractice" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Patient" ("address", "createdAt", "dateOfBirth", "email", "firstName", "gpPracticeId", "hysterectomyDate", "hysterectomyType", "id", "isFirstTimeHPVTransition", "isPostHysterectomy", "lastCytologyDate", "lastName", "nhi", "phone", "previousScreeningType", "status", "updatedAt") SELECT "address", "createdAt", "dateOfBirth", "email", "firstName", "gpPracticeId", "hysterectomyDate", "hysterectomyType", "id", "isFirstTimeHPVTransition", "isPostHysterectomy", "lastCytologyDate", "lastName", "nhi", "phone", "previousScreeningType", "status", "updatedAt" FROM "Patient";
DROP TABLE "Patient";
ALTER TABLE "new_Patient" RENAME TO "Patient";
CREATE UNIQUE INDEX "Patient_nhi_key" ON "Patient"("nhi");
CREATE INDEX "Patient_nhi_idx" ON "Patient"("nhi");
CREATE INDEX "Patient_status_idx" ON "Patient"("status");
CREATE INDEX "Patient_deletedAt_idx" ON "Patient"("deletedAt");
CREATE INDEX "Patient_ethnicityPrimary_idx" ON "Patient"("ethnicityPrimary");
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
    "gpPracticeId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_gpPracticeId_fkey" FOREIGN KEY ("gpPracticeId") REFERENCES "GPPractice" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("createdAt", "email", "emailVerified", "failedAttempts", "gpPracticeId", "id", "image", "lastLoginAt", "lockedUntil", "name", "passwordHash", "role", "twoFAEnabled", "twoFASecret", "updatedAt") SELECT "createdAt", "email", "emailVerified", "failedAttempts", "gpPracticeId", "id", "image", "lastLoginAt", "lockedUntil", "name", "passwordHash", "role", "twoFAEnabled", "twoFASecret", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "AccessCertification_userId_systemName_active_idx" ON "AccessCertification"("userId", "systemName", "active");

-- CreateIndex
CREATE INDEX "AccessCertification_systemName_active_expiresAt_idx" ON "AccessCertification"("systemName", "active", "expiresAt");

-- CreateIndex
CREATE INDEX "IntegrationValidation_integrationId_validatedAt_idx" ON "IntegrationValidation"("integrationId", "validatedAt");

-- CreateIndex
CREATE INDEX "IntegrationValidation_validatedByUserId_validatedAt_idx" ON "IntegrationValidation"("validatedByUserId", "validatedAt");

-- CreateIndex
CREATE INDEX "SecurityIncident_status_severity_createdAt_idx" ON "SecurityIncident"("status", "severity", "createdAt");

-- CreateIndex
CREATE INDEX "SecurityIncident_assignedToUserId_status_idx" ON "SecurityIncident"("assignedToUserId", "status");

-- CreateIndex
CREATE INDEX "SecurityIncident_sourcePreset_status_idx" ON "SecurityIncident"("sourcePreset", "status");

-- CreateIndex
CREATE INDEX "SecurityIncident_status_dueAt_idx" ON "SecurityIncident"("status", "dueAt");

-- CreateIndex
CREATE INDEX "PatientConsent_patientId_purpose_status_idx" ON "PatientConsent"("patientId", "purpose", "status");

-- CreateIndex
CREATE INDEX "PatientConsent_status_expiresAt_idx" ON "PatientConsent"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "BatchRun_createdByUserId_createdAt_idx" ON "BatchRun"("createdByUserId", "createdAt");

-- CreateIndex
CREATE INDEX "BatchRun_source_createdAt_idx" ON "BatchRun"("source", "createdAt");

-- CreateIndex
CREATE INDEX "BatchReviewItem_batchRunId_disposition_idx" ON "BatchReviewItem"("batchRunId", "disposition");

-- CreateIndex
CREATE INDEX "BatchReviewItem_batchRunId_reviewRequired_idx" ON "BatchReviewItem"("batchRunId", "reviewRequired");

-- CreateIndex
CREATE INDEX "BatchReviewItem_reviewedByUserId_reviewedAt_idx" ON "BatchReviewItem"("reviewedByUserId", "reviewedAt");

-- CreateIndex
CREATE INDEX "ReferralCase_deletedAt_idx" ON "ReferralCase"("deletedAt");
