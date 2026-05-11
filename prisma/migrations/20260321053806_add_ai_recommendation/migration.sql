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
CREATE INDEX "CaseInvestigation_caseId_createdAt_idx" ON "CaseInvestigation"("caseId", "createdAt");

-- CreateIndex
CREATE INDEX "AIRecommendation_caseId_createdAt_idx" ON "AIRecommendation"("caseId", "createdAt");

-- CreateIndex
CREATE INDEX "AIRecommendation_suggestedPriority_createdAt_idx" ON "AIRecommendation"("suggestedPriority", "createdAt");

-- CreateIndex
CREATE INDEX "AIRecommendation_concordantWithRule_concordantWithClinician_idx" ON "AIRecommendation"("concordantWithRule", "concordantWithClinician");
