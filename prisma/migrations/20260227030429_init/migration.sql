-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" DATETIME,
    "image" TEXT,
    "passwordHash" TEXT,
    "role" TEXT NOT NULL DEFAULT 'GP',
    "twoFASecret" TEXT,
    "twoFAEnabled" BOOLEAN NOT NULL DEFAULT false,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" DATETIME,
    "lastLoginAt" DATETIME,
    "gpPracticeId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_gpPracticeId_fkey" FOREIGN KEY ("gpPracticeId") REFERENCES "GPPractice" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Account" (
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    PRIMARY KEY ("provider", "providerAccountId"),
    CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" DATETIME NOT NULL,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" DATETIME NOT NULL,

    PRIMARY KEY ("identifier", "token")
);

-- CreateTable
CREATE TABLE "GPPractice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "dhbRegion" TEXT,
    "hpiNumber" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Patient" (
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Patient_gpPracticeId_fkey" FOREIGN KEY ("gpPracticeId") REFERENCES "GPPractice" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MedicalHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "previousHighGradeLesion" BOOLEAN NOT NULL DEFAULT false,
    "previousTreatment" TEXT,
    "treatmentDate" DATETIME,
    "immunocompromised" BOOLEAN NOT NULL DEFAULT false,
    "hiv" BOOLEAN NOT NULL DEFAULT false,
    "atypicalEndometrialHistory" BOOLEAN NOT NULL DEFAULT false,
    "otherRelevantHistory" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MedicalHistory_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScreeningSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "activeModule" TEXT,
    "activeModuleVersion" TEXT,
    "consecutiveNegativeCoTestCount" INTEGER NOT NULL DEFAULT 0,
    "consecutiveLowGradeCount" INTEGER NOT NULL DEFAULT 0,
    "unsatisfactoryCytologyCount" INTEGER NOT NULL DEFAULT 0,
    "currentRiskLevel" TEXT,
    "nextScreeningDue" DATETIME,
    "recommendation" TEXT,
    "recommendationCode" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ScreeningSession_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ScreeningSession_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TestResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "screeningSessionId" TEXT NOT NULL,
    "testDate" DATETIME NOT NULL,
    "labId" TEXT,
    "specimenId" TEXT,
    "sampleType" TEXT,
    "hpvResult" TEXT,
    "hpv16_18" BOOLEAN,
    "hpvOther" BOOLEAN,
    "cytologyResult" TEXT,
    "cytologyAdequacy" TEXT,
    "histologyResult" TEXT,
    "tzType" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TestResult_screeningSessionId_fkey" FOREIGN KEY ("screeningSessionId") REFERENCES "ScreeningSession" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ColposcopyFinding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "screeningSessionId" TEXT NOT NULL,
    "clinicianId" TEXT NOT NULL,
    "colposcopyDate" DATETIME NOT NULL,
    "tzType" TEXT,
    "visibleLesion" BOOLEAN NOT NULL DEFAULT false,
    "colposcopicImpression" TEXT,
    "acetowhiteChange" BOOLEAN NOT NULL DEFAULT false,
    "iodineNegative" BOOLEAN NOT NULL DEFAULT false,
    "atypicalVessels" BOOLEAN NOT NULL DEFAULT false,
    "biopsyTaken" BOOLEAN NOT NULL DEFAULT false,
    "biopsyResult" TEXT,
    "biopsySite" TEXT,
    "mdmReviewRequired" BOOLEAN NOT NULL DEFAULT false,
    "mdmOutcome" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ColposcopyFinding_screeningSessionId_fkey" FOREIGN KEY ("screeningSessionId") REFERENCES "ScreeningSession" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ColposcopyFinding_clinicianId_fkey" FOREIGN KEY ("clinicianId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PathwayStateHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "screeningSessionId" TEXT NOT NULL,
    "fromState" TEXT,
    "toState" TEXT NOT NULL,
    "transitionReason" TEXT,
    "triggeredByResultId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "pathwayFigure" TEXT,
    "riskLevel" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PathwayStateHistory_screeningSessionId_fkey" FOREIGN KEY ("screeningSessionId") REFERENCES "ScreeningSession" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PathwayStateHistory_triggeredByResultId_fkey" FOREIGN KEY ("triggeredByResultId") REFERENCES "TestResult" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PathwayStateHistory_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "screeningSessionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'P3',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "clinicalNotes" TEXT,
    "timelinessDays" INTEGER,
    "targetDays" INTEGER,
    "escalationSentAt" DATETIME,
    "appointmentDate" DATETIME,
    "letterSentAt" DATETIME,
    "responseReceivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Referral_screeningSessionId_fkey" FOREIGN KEY ("screeningSessionId") REFERENCES "ScreeningSession" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Recall" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "practiceId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "dueDate" DATETIME NOT NULL,
    "sentAt" DATETIME,
    "respondedAt" DATETIME,
    "reason" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Recall_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Recall_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "GPPractice" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClinicalRuleSet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "version" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "rulesJson" TEXT NOT NULL,
    "schemaVersion" TEXT NOT NULL DEFAULT '1.0',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" DATETIME,
    "publishedById" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" DATETIME,
    "changeNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ClinicalRuleSet_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ClinicalRuleSet_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "GPPractice_hpiNumber_key" ON "GPPractice"("hpiNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_nhi_key" ON "Patient"("nhi");

-- CreateIndex
CREATE INDEX "Patient_nhi_idx" ON "Patient"("nhi");

-- CreateIndex
CREATE INDEX "Patient_status_idx" ON "Patient"("status");

-- CreateIndex
CREATE UNIQUE INDEX "MedicalHistory_patientId_key" ON "MedicalHistory"("patientId");

-- CreateIndex
CREATE INDEX "ScreeningSession_patientId_status_createdAt_idx" ON "ScreeningSession"("patientId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Referral_priority_status_createdAt_idx" ON "Referral"("priority", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Recall_dueDate_status_idx" ON "Recall"("dueDate", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicalRuleSet_version_key" ON "ClinicalRuleSet"("version");

-- CreateIndex
CREATE INDEX "AuditLog_entity_action_idx" ON "AuditLog"("entity", "action");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityId_idx" ON "AuditLog"("entityId");
