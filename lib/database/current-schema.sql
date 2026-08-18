-- CreateTable
CREATE TABLE "User" (
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

-- CreateTable
CREATE TABLE "ReferralCase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "serviceLine" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "referralSource" TEXT,
    "externalCaseId" TEXT,
    "referralReason" TEXT,
    "currentPriority" TEXT,
    "currentCategory" TEXT,
    "targetDueAt" DATETIME,
    "bookedForAt" DATETIME,
    "bookedAt" DATETIME,
    "bookingNotes" TEXT,
    "assignedToUserId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "highSuspicionCancer" BOOLEAN NOT NULL DEFAULT false,
    "smoOnly" BOOLEAN NOT NULL DEFAULT false,
    "regradeOfCaseId" TEXT,
    "triageNotes" TEXT,
    "fctStatus" TEXT,
    "hpvTestResult" TEXT,
    "hpvType" TEXT,
    "cytologySample" TEXT,
    "referrerReasonCode" TEXT,
    "assessmentOfReferral" TEXT,
    "bookingPriorityNote" TEXT,
    "referralType" TEXT,
    "ovestinInstruction" TEXT,
    "ncsrNoteAdded" BOOLEAN,
    "referralNoteAdded" BOOLEAN,
    "internalTriageNotes" TEXT,
    "gynaecologyCategory" TEXT,
    "ussAvailable" BOOLEAN,
    "ussFindings" TEXT,
    "deletedAt" DATETIME,
    "deletedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReferralCase_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ReferralCase_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ReferralCase_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReferralDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'OTHER',
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "uploadedByUserId" TEXT,
    "ocrStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "parseStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "pageCount" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReferralDocument_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ReferralCase" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReferralDocument_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClinicalSummary" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "summaryJson" TEXT NOT NULL,
    "renderedMarkdown" TEXT NOT NULL,
    "generatedBy" TEXT NOT NULL,
    "approvedByUserId" TEXT,
    "approvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ClinicalSummary_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ReferralCase" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClinicalSummary_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CaseRuleSetRelease" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "serviceLine" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "definitionJson" TEXT NOT NULL,
    "schemaVersion" TEXT NOT NULL DEFAULT '1.0',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" DATETIME,
    "publishedByUserId" TEXT,
    "reviewedByUserId" TEXT,
    "reviewedAt" DATETIME,
    "changeNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CaseRuleSetRelease_publishedByUserId_fkey" FOREIGN KEY ("publishedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CaseRuleSetRelease_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RuleDecision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "ruleSetReleaseId" TEXT,
    "priority" TEXT,
    "category" TEXT,
    "outcome" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "evidenceJson" TEXT NOT NULL,
    "traceJson" TEXT NOT NULL,
    "generatedBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RuleDecision_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ReferralCase" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RuleDecision_ruleSetReleaseId_fkey" FOREIGN KEY ("ruleSetReleaseId") REFERENCES "CaseRuleSetRelease" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClinicianDecision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "decidedByUserId" TEXT NOT NULL,
    "finalPriority" TEXT,
    "finalCategory" TEXT,
    "finalOutcome" TEXT NOT NULL,
    "overrideReason" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ClinicianDecision_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ReferralCase" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClinicianDecision_decidedByUserId_fkey" FOREIGN KEY ("decidedByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DocumentPage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "extractedText" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DocumentPage_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "ReferralDocument" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExtractedFact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "documentPageId" TEXT NOT NULL,
    "factType" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "valueText" TEXT NOT NULL,
    "valueDate" DATETIME,
    "valueNumber" REAL,
    "confidence" REAL,
    "sourceQuote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExtractedFact_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ReferralCase" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExtractedFact_documentPageId_fkey" FOREIGN KEY ("documentPageId") REFERENCES "DocumentPage" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "scope" TEXT NOT NULL DEFAULT 'GLOBAL',
    "organisationKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ClinicalRuleVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ruleSetId" TEXT NOT NULL,
    "versionMajor" INTEGER NOT NULL,
    "versionMinor" INTEGER NOT NULL,
    "versionPatch" INTEGER NOT NULL,
    "displayVersion" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "parentVersionId" TEXT,
    "sourcePackageVersion" TEXT,
    "sourceGuidelineSummary" TEXT NOT NULL,
    "snapshotJson" TEXT NOT NULL,
    "checksum" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "changeSummary" TEXT,
    "changeClassification" TEXT NOT NULL DEFAULT 'CLINICAL_LOGIC',
    "validationJson" TEXT,
    "createdById" TEXT,
    "approvedById" TEXT,
    "publishedById" TEXT,
    "validatedAt" DATETIME,
    "publishedAt" DATETIME,
    "activatedAt" DATETIME,
    "retiredAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ClinicalRuleVersion_ruleSetId_fkey" FOREIGN KEY ("ruleSetId") REFERENCES "ClinicalRuleSet" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ClinicalRuleVersion_parentVersionId_fkey" FOREIGN KEY ("parentVersionId") REFERENCES "ClinicalRuleVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ClinicalRuleVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ClinicalRuleVersion_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ClinicalRuleVersion_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RuleSetActivation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ruleSetId" TEXT NOT NULL,
    "ruleVersionId" TEXT NOT NULL,
    "organisationKey" TEXT,
    "environment" TEXT NOT NULL DEFAULT 'DEMO',
    "isDefault" BOOLEAN NOT NULL DEFAULT true,
    "activatedById" TEXT,
    "activatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deactivatedAt" DATETIME,
    "reason" TEXT NOT NULL,
    CONSTRAINT "RuleSetActivation_ruleSetId_fkey" FOREIGN KEY ("ruleSetId") REFERENCES "ClinicalRuleSet" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RuleSetActivation_ruleVersionId_fkey" FOREIGN KEY ("ruleVersionId") REFERENCES "ClinicalRuleVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RuleSetActivation_activatedById_fkey" FOREIGN KEY ("activatedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RuleEvaluation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT,
    "batchRunId" TEXT,
    "ruleSetId" TEXT NOT NULL,
    "ruleVersionId" TEXT NOT NULL,
    "ruleVersionDisplay" TEXT NOT NULL,
    "rulesetChecksum" TEXT NOT NULL,
    "engineVersion" TEXT NOT NULL,
    "evaluationMode" TEXT NOT NULL DEFAULT 'LIVE_DEMO',
    "evaluatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "canonicalInputSnapshot" TEXT NOT NULL,
    "matchedRuleIds" TEXT NOT NULL,
    "branchPath" TEXT NOT NULL,
    "provisionalRecommendation" TEXT NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "urgency" TEXT,
    "referralDestination" TEXT,
    "repeatInterval" TEXT,
    "missingInformation" TEXT NOT NULL,
    "reviewerRequirement" TEXT NOT NULL,
    "mandatoryReviewerConfirmation" BOOLEAN NOT NULL DEFAULT true,
    "clinicianOnly" BOOLEAN NOT NULL DEFAULT false,
    "sourceReferences" TEXT NOT NULL,
    "evaluationTrace" TEXT NOT NULL,
    "previousEvaluationId" TEXT,
    "regradeReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RuleEvaluation_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ReferralCase" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RuleEvaluation_batchRunId_fkey" FOREIGN KEY ("batchRunId") REFERENCES "BatchRun" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RuleEvaluation_ruleSetId_fkey" FOREIGN KEY ("ruleSetId") REFERENCES "ClinicalRuleSet" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RuleEvaluation_ruleVersionId_fkey" FOREIGN KEY ("ruleVersionId") REFERENCES "ClinicalRuleVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RuleEvaluation_previousEvaluationId_fkey" FOREIGN KEY ("previousEvaluationId") REFERENCES "RuleEvaluation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RuleVersionAuditEvent" (
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RuleVersionAuditEvent_ruleSetId_fkey" FOREIGN KEY ("ruleSetId") REFERENCES "ClinicalRuleSet" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RuleVersionAuditEvent_ruleVersionId_fkey" FOREIGN KEY ("ruleVersionId") REFERENCES "ClinicalRuleVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RuleVersionAuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WizardSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "determinedFigure" TEXT,
    "decisionJson" TEXT,
    "ruleEvaluationId" TEXT,
    "screeningSessionId" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WizardSession_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WizardSession_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WizardSession_ruleEvaluationId_fkey" FOREIGN KEY ("ruleEvaluationId") REFERENCES "RuleEvaluation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WizardAnswer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "wizardSessionId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "answerValue" TEXT NOT NULL,
    "answerLabel" TEXT NOT NULL,
    "isAutoFilled" BOOLEAN NOT NULL DEFAULT false,
    "stepNumber" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WizardAnswer_wizardSessionId_fkey" FOREIGN KEY ("wizardSessionId") REFERENCES "WizardSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CaseInvestigation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "result" TEXT,
    "notes" TEXT,
    "investigationDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CaseInvestigation_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ReferralCase" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "correlationId" TEXT,
    "sessionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
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
CREATE TABLE "AIRecommendation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "inputJson" TEXT NOT NULL,
    "outputJson" TEXT NOT NULL,
    "suggestedPriority" TEXT,
    "suggestedCategory" TEXT,
    "suggestedOutcome" TEXT,
    "rationale" TEXT,
    "confidence" REAL,
    "citations" TEXT,
    "concordantWithRule" BOOLEAN,
    "concordantWithClinician" BOOLEAN,
    "generatedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AIRecommendation_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ReferralCase" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BatchRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    CONSTRAINT "BatchRun_pinnedRuleVersionId_fkey" FOREIGN KEY ("pinnedRuleVersionId") REFERENCES "ClinicalRuleVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
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
    "ruleEvaluationId" TEXT,
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
    CONSTRAINT "BatchReviewItem_ruleEvaluationId_fkey" FOREIGN KEY ("ruleEvaluationId") REFERENCES "RuleEvaluation" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BatchReviewItem_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

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
CREATE INDEX "Patient_deletedAt_idx" ON "Patient"("deletedAt");

-- CreateIndex
CREATE INDEX "Patient_ethnicityPrimary_idx" ON "Patient"("ethnicityPrimary");

-- CreateIndex
CREATE INDEX "ReferralCase_serviceLine_status_receivedAt_idx" ON "ReferralCase"("serviceLine", "status", "receivedAt");

-- CreateIndex
CREATE INDEX "ReferralCase_patientId_serviceLine_createdAt_idx" ON "ReferralCase"("patientId", "serviceLine", "createdAt");

-- CreateIndex
CREATE INDEX "ReferralCase_assignedToUserId_status_idx" ON "ReferralCase"("assignedToUserId", "status");

-- CreateIndex
CREATE INDEX "ReferralCase_currentPriority_status_receivedAt_idx" ON "ReferralCase"("currentPriority", "status", "receivedAt");

-- CreateIndex
CREATE INDEX "ReferralCase_targetDueAt_status_idx" ON "ReferralCase"("targetDueAt", "status");

-- CreateIndex
CREATE INDEX "ReferralCase_bookedForAt_status_idx" ON "ReferralCase"("bookedForAt", "status");

-- CreateIndex
CREATE INDEX "ReferralCase_deletedAt_idx" ON "ReferralCase"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralDocument_storageKey_key" ON "ReferralDocument"("storageKey");

-- CreateIndex
CREATE INDEX "ReferralDocument_caseId_type_createdAt_idx" ON "ReferralDocument"("caseId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "ReferralDocument_uploadedByUserId_createdAt_idx" ON "ReferralDocument"("uploadedByUserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicalSummary_caseId_key" ON "ClinicalSummary"("caseId");

-- CreateIndex
CREATE INDEX "ClinicalSummary_status_updatedAt_idx" ON "ClinicalSummary"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "ClinicalSummary_approvedByUserId_approvedAt_idx" ON "ClinicalSummary"("approvedByUserId", "approvedAt");

-- CreateIndex
CREATE INDEX "CaseRuleSetRelease_serviceLine_isActive_publishedAt_idx" ON "CaseRuleSetRelease"("serviceLine", "isActive", "publishedAt");

-- CreateIndex
CREATE INDEX "CaseRuleSetRelease_reviewedByUserId_reviewedAt_idx" ON "CaseRuleSetRelease"("reviewedByUserId", "reviewedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CaseRuleSetRelease_serviceLine_version_key" ON "CaseRuleSetRelease"("serviceLine", "version");

-- CreateIndex
CREATE UNIQUE INDEX "RuleDecision_caseId_key" ON "RuleDecision"("caseId");

-- CreateIndex
CREATE INDEX "RuleDecision_priority_updatedAt_idx" ON "RuleDecision"("priority", "updatedAt");

-- CreateIndex
CREATE INDEX "RuleDecision_ruleSetReleaseId_updatedAt_idx" ON "RuleDecision"("ruleSetReleaseId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicianDecision_caseId_key" ON "ClinicianDecision"("caseId");

-- CreateIndex
CREATE INDEX "ClinicianDecision_finalPriority_updatedAt_idx" ON "ClinicianDecision"("finalPriority", "updatedAt");

-- CreateIndex
CREATE INDEX "ClinicianDecision_decidedByUserId_updatedAt_idx" ON "ClinicianDecision"("decidedByUserId", "updatedAt");

-- CreateIndex
CREATE INDEX "DocumentPage_documentId_createdAt_idx" ON "DocumentPage"("documentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentPage_documentId_pageNumber_key" ON "DocumentPage"("documentId", "pageNumber");

-- CreateIndex
CREATE INDEX "ExtractedFact_caseId_factType_idx" ON "ExtractedFact"("caseId", "factType");

-- CreateIndex
CREATE INDEX "ExtractedFact_documentPageId_idx" ON "ExtractedFact"("documentPageId");

-- CreateIndex
CREATE UNIQUE INDEX "MedicalHistory_patientId_key" ON "MedicalHistory"("patientId");

-- CreateIndex
CREATE INDEX "ScreeningSession_patientId_status_createdAt_idx" ON "ScreeningSession"("patientId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Referral_priority_status_createdAt_idx" ON "Referral"("priority", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Recall_dueDate_status_idx" ON "Recall"("dueDate", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicalRuleSet_key_key" ON "ClinicalRuleSet"("key");

-- CreateIndex
CREATE INDEX "ClinicalRuleSet_scope_organisationKey_idx" ON "ClinicalRuleSet"("scope", "organisationKey");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicalRuleVersion_ruleSetId_displayVersion_key" ON "ClinicalRuleVersion"("ruleSetId", "displayVersion");

-- CreateIndex
CREATE INDEX "ClinicalRuleVersion_ruleSetId_status_createdAt_idx" ON "ClinicalRuleVersion"("ruleSetId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ClinicalRuleVersion_parentVersionId_idx" ON "ClinicalRuleVersion"("parentVersionId");

-- CreateIndex
CREATE INDEX "ClinicalRuleVersion_checksum_idx" ON "ClinicalRuleVersion"("checksum");

-- CreateIndex
CREATE INDEX "RuleSetActivation_ruleSetId_organisationKey_environment_deactivatedAt_idx" ON "RuleSetActivation"("ruleSetId", "organisationKey", "environment", "deactivatedAt");

-- CreateIndex
CREATE INDEX "RuleSetActivation_ruleVersionId_activatedAt_idx" ON "RuleSetActivation"("ruleVersionId", "activatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RuleSetActivation_one_default_idx" ON "RuleSetActivation"("ruleSetId", ifnull("organisationKey", ''), "environment") WHERE "isDefault" = 1 AND "deactivatedAt" IS NULL;

-- CreateIndex
CREATE INDEX "RuleEvaluation_caseId_evaluatedAt_idx" ON "RuleEvaluation"("caseId", "evaluatedAt");

-- CreateIndex
CREATE INDEX "RuleEvaluation_batchRunId_evaluatedAt_idx" ON "RuleEvaluation"("batchRunId", "evaluatedAt");

-- CreateIndex
CREATE INDEX "RuleEvaluation_ruleVersionId_evaluatedAt_idx" ON "RuleEvaluation"("ruleVersionId", "evaluatedAt");

-- CreateIndex
CREATE INDEX "RuleEvaluation_previousEvaluationId_idx" ON "RuleEvaluation"("previousEvaluationId");

-- CreateIndex
CREATE INDEX "RuleVersionAuditEvent_ruleSetId_createdAt_idx" ON "RuleVersionAuditEvent"("ruleSetId", "createdAt");

-- CreateIndex
CREATE INDEX "RuleVersionAuditEvent_ruleVersionId_createdAt_idx" ON "RuleVersionAuditEvent"("ruleVersionId", "createdAt");

-- CreateIndex
CREATE INDEX "RuleVersionAuditEvent_actorUserId_createdAt_idx" ON "RuleVersionAuditEvent"("actorUserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WizardSession_screeningSessionId_key" ON "WizardSession"("screeningSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "WizardSession_ruleEvaluationId_key" ON "WizardSession"("ruleEvaluationId");

-- CreateIndex
CREATE INDEX "WizardSession_patientId_status_idx" ON "WizardSession"("patientId", "status");

-- CreateIndex
CREATE INDEX "WizardSession_createdById_idx" ON "WizardSession"("createdById");

-- CreateIndex
CREATE INDEX "WizardAnswer_wizardSessionId_idx" ON "WizardAnswer"("wizardSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "WizardAnswer_wizardSessionId_stepId_key" ON "WizardAnswer"("wizardSessionId", "stepId");

-- CreateIndex
CREATE INDEX "CaseInvestigation_caseId_createdAt_idx" ON "CaseInvestigation"("caseId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entity_action_idx" ON "AuditLog"("entity", "action");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityId_idx" ON "AuditLog"("entityId");

-- CreateIndex
CREATE INDEX "AuditLog_severity_createdAt_idx" ON "AuditLog"("severity", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_correlationId_idx" ON "AuditLog"("correlationId");

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
CREATE INDEX "BatchReviewItem_nhi_createdAt_idx" ON "BatchReviewItem"("nhi", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BatchReviewItem_ruleEvaluationId_key" ON "BatchReviewItem"("ruleEvaluationId");

-- CreateIndex
CREATE INDEX "AIRecommendation_caseId_createdAt_idx" ON "AIRecommendation"("caseId", "createdAt");

-- CreateIndex
CREATE INDEX "AIRecommendation_suggestedPriority_createdAt_idx" ON "AIRecommendation"("suggestedPriority", "createdAt");

-- CreateIndex
CREATE INDEX "AIRecommendation_concordantWithRule_concordantWithClinician_idx" ON "AIRecommendation"("concordantWithRule", "concordantWithClinician");

-- Immutable published snapshot safeguards.
CREATE TRIGGER "ClinicalRuleVersion_immutable_snapshot_update"
BEFORE UPDATE OF "ruleSetId", "versionMajor", "versionMinor", "versionPatch", "displayVersion", "snapshotJson", "checksum"
ON "ClinicalRuleVersion"
WHEN OLD."status" IN ('PUBLISHED', 'ACTIVE', 'RETIRED', 'ARCHIVED')
BEGIN
  SELECT RAISE(ABORT, 'Published clinical rule versions are immutable');
END;

CREATE TRIGGER "ClinicalRuleVersion_immutable_delete"
BEFORE DELETE ON "ClinicalRuleVersion"
WHEN OLD."status" <> 'DRAFT'
BEGIN
  SELECT RAISE(ABORT, 'Only unreferenced draft clinical rule versions may be deleted');
END;

CREATE TRIGGER "RuleEvaluation_immutable_update"
BEFORE UPDATE ON "RuleEvaluation"
BEGIN
  SELECT RAISE(ABORT, 'Clinical rule evaluations are immutable');
END;

CREATE TRIGGER "RuleEvaluation_immutable_delete"
BEFORE DELETE ON "RuleEvaluation"
BEGIN
  SELECT RAISE(ABORT, 'Clinical rule evaluations are immutable');
END;

CREATE TRIGGER "RuleVersionAuditEvent_immutable_update"
BEFORE UPDATE ON "RuleVersionAuditEvent"
BEGIN
  SELECT RAISE(ABORT, 'Clinical rule audit events are immutable');
END;

CREATE TRIGGER "RuleVersionAuditEvent_immutable_delete"
BEFORE DELETE ON "RuleVersionAuditEvent"
BEGIN
  SELECT RAISE(ABORT, 'Clinical rule audit events are immutable');
END;

CREATE TRIGGER "ClinicalRuleVersion_evaluated_snapshot_update"
BEFORE UPDATE OF "ruleSetId", "versionMajor", "versionMinor", "versionPatch", "displayVersion", "snapshotJson", "checksum"
ON "ClinicalRuleVersion"
WHEN EXISTS (
  SELECT 1 FROM "RuleEvaluation" WHERE "ruleVersionId" = OLD."id" LIMIT 1
)
BEGIN
  SELECT RAISE(ABORT, 'Evaluated clinical rule version identities are immutable');
END;
