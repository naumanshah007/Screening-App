-- Preserve the previous single-table placeholder while it is transformed into
-- a stable rule-set family plus immutable version snapshots.
CREATE TEMP TABLE "_ClinicalRuleSetLegacy" AS SELECT * FROM "ClinicalRuleSet";

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

-- Redefine tables to add referential provenance without changing frozen data.
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
INSERT INTO "new_BatchReviewItem" ("batchRunId", "caseJson", "createdAt", "decisionJson", "disposition", "engineStatus", "ethnicityPrimary", "externalPatientId", "figure", "gpPractice", "id", "inputJson", "label", "nhi", "overrideReason", "patientAge", "patientName", "priorDecisionCount", "priorItemId", "receivedDate", "recommendation", "recommendationCode", "referralPriority", "referralType", "reviewNote", "reviewRequired", "reviewedAt", "reviewedByUserId", "riskLevel", "rowNumber", "safetyOutcome", "triageCategory", "triageOutcome", "triagePriority", "triageRuleCode", "triageRuleReleaseId", "triageRuleVersion", "triageTargetDays", "updatedAt") SELECT "batchRunId", "caseJson", "createdAt", "decisionJson", "disposition", "engineStatus", "ethnicityPrimary", "externalPatientId", "figure", "gpPractice", "id", "inputJson", "label", "nhi", "overrideReason", "patientAge", "patientName", "priorDecisionCount", "priorItemId", "receivedDate", "recommendation", "recommendationCode", "referralPriority", "referralType", "reviewNote", "reviewRequired", "reviewedAt", "reviewedByUserId", "riskLevel", "rowNumber", "safetyOutcome", "triageCategory", "triageOutcome", "triagePriority", "triageRuleCode", "triageRuleReleaseId", "triageRuleVersion", "triageTargetDays", "updatedAt" FROM "BatchReviewItem";
DROP TABLE "BatchReviewItem";
ALTER TABLE "new_BatchReviewItem" RENAME TO "BatchReviewItem";

CREATE TABLE "new_BatchRun" (
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
INSERT INTO "new_BatchRun" ("acceptedCount", "createdAt", "createdByUserId", "engineVersion", "id", "needsInfoCount", "pendingCount", "rejectedCount", "reviewRequiredCount", "source", "sourceFileName", "sourceSystem", "totalCases", "updatedAt") SELECT "acceptedCount", "createdAt", "createdByUserId", "engineVersion", "id", "needsInfoCount", "pendingCount", "rejectedCount", "reviewRequiredCount", "source", "sourceFileName", "sourceSystem", "totalCases", "updatedAt" FROM "BatchRun";
DROP TABLE "BatchRun";
ALTER TABLE "new_BatchRun" RENAME TO "BatchRun";

CREATE TABLE "new_ClinicalRuleSet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "scope" TEXT NOT NULL DEFAULT 'GLOBAL',
    "organisationKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_ClinicalRuleSet" ("createdAt", "description", "id", "key", "name", "updatedAt")
SELECT "createdAt", "description", "id", 'legacy-' || lower(replace("version", '.', '-')), "name", "updatedAt" FROM "_ClinicalRuleSetLegacy";
DROP TABLE "ClinicalRuleSet";
ALTER TABLE "new_ClinicalRuleSet" RENAME TO "ClinicalRuleSet";

-- Preserve any earlier placeholder rows as readable migrated versions.
INSERT INTO "ClinicalRuleVersion" (
  "id", "ruleSetId", "versionMajor", "versionMinor", "versionPatch",
  "displayVersion", "status", "sourcePackageVersion", "sourceGuidelineSummary",
  "snapshotJson", "revision", "changeSummary", "changeClassification",
  "approvedById", "publishedById", "validatedAt", "publishedAt", "activatedAt",
  "createdAt", "updatedAt"
)
SELECT
  'migrated-version-' || "id", "id", 0, 0, 0,
  "version", CASE WHEN "isActive" = 1 THEN 'ACTIVE' WHEN "publishedAt" IS NOT NULL THEN 'PUBLISHED' ELSE 'DRAFT' END,
  "schemaVersion", 'Migrated from the pre-v3 ClinicalRuleSet placeholder',
  "rulesJson", 1, "changeNotes", 'CLINICAL_LOGIC',
  "reviewedById", "publishedById", "reviewedAt", "publishedAt",
  CASE WHEN "isActive" = 1 THEN COALESCE("publishedAt", "createdAt") ELSE NULL END,
  "createdAt", "updatedAt"
FROM "_ClinicalRuleSetLegacy";

INSERT INTO "RuleSetActivation" (
  "id", "ruleSetId", "ruleVersionId", "environment", "isDefault",
  "activatedById", "activatedAt", "reason"
)
SELECT
  'migrated-activation-' || "id", "id", 'migrated-version-' || "id", 'DEMO', 1,
  "publishedById", COALESCE("publishedAt", "createdAt"), 'Migrated active legacy clinical ruleset'
FROM "_ClinicalRuleSetLegacy" WHERE "isActive" = 1;

DROP TABLE "_ClinicalRuleSetLegacy";

CREATE TABLE "new_WizardSession" (
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
INSERT INTO "new_WizardSession" ("completedAt", "createdAt", "createdById", "decisionJson", "determinedFigure", "id", "patientId", "screeningSessionId", "startedAt", "status", "updatedAt") SELECT "completedAt", "createdAt", "createdById", "decisionJson", "determinedFigure", "id", "patientId", "screeningSessionId", "startedAt", "status", "updatedAt" FROM "WizardSession";
DROP TABLE "WizardSession";
ALTER TABLE "new_WizardSession" RENAME TO "WizardSession";

-- Recreate indexes for redefined tables.
CREATE UNIQUE INDEX "BatchReviewItem_ruleEvaluationId_key" ON "BatchReviewItem"("ruleEvaluationId");
CREATE INDEX "BatchReviewItem_batchRunId_disposition_idx" ON "BatchReviewItem"("batchRunId", "disposition");
CREATE INDEX "BatchReviewItem_batchRunId_reviewRequired_idx" ON "BatchReviewItem"("batchRunId", "reviewRequired");
CREATE INDEX "BatchReviewItem_reviewedByUserId_reviewedAt_idx" ON "BatchReviewItem"("reviewedByUserId", "reviewedAt");
CREATE INDEX "BatchReviewItem_nhi_createdAt_idx" ON "BatchReviewItem"("nhi", "createdAt");
CREATE INDEX "BatchRun_createdByUserId_createdAt_idx" ON "BatchRun"("createdByUserId", "createdAt");
CREATE INDEX "BatchRun_source_createdAt_idx" ON "BatchRun"("source", "createdAt");
CREATE UNIQUE INDEX "ClinicalRuleSet_key_key" ON "ClinicalRuleSet"("key");
CREATE INDEX "ClinicalRuleSet_scope_organisationKey_idx" ON "ClinicalRuleSet"("scope", "organisationKey");
CREATE UNIQUE INDEX "WizardSession_ruleEvaluationId_key" ON "WizardSession"("ruleEvaluationId");
CREATE UNIQUE INDEX "WizardSession_screeningSessionId_key" ON "WizardSession"("screeningSessionId");
CREATE INDEX "WizardSession_patientId_status_idx" ON "WizardSession"("patientId", "status");
CREATE INDEX "WizardSession_createdById_idx" ON "WizardSession"("createdById");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- Version, activation, evaluation, and audit indexes.
CREATE INDEX "ClinicalRuleVersion_ruleSetId_status_createdAt_idx" ON "ClinicalRuleVersion"("ruleSetId", "status", "createdAt");
CREATE INDEX "ClinicalRuleVersion_parentVersionId_idx" ON "ClinicalRuleVersion"("parentVersionId");
CREATE INDEX "ClinicalRuleVersion_checksum_idx" ON "ClinicalRuleVersion"("checksum");
CREATE UNIQUE INDEX "ClinicalRuleVersion_ruleSetId_displayVersion_key" ON "ClinicalRuleVersion"("ruleSetId", "displayVersion");
CREATE INDEX "RuleSetActivation_ruleSetId_organisationKey_environment_deactivatedAt_idx" ON "RuleSetActivation"("ruleSetId", "organisationKey", "environment", "deactivatedAt");
CREATE INDEX "RuleSetActivation_ruleVersionId_activatedAt_idx" ON "RuleSetActivation"("ruleVersionId", "activatedAt");
CREATE UNIQUE INDEX "RuleSetActivation_one_default_idx"
  ON "RuleSetActivation"("ruleSetId", ifnull("organisationKey", ''), "environment")
  WHERE "isDefault" = 1 AND "deactivatedAt" IS NULL;
CREATE INDEX "RuleEvaluation_caseId_evaluatedAt_idx" ON "RuleEvaluation"("caseId", "evaluatedAt");
CREATE INDEX "RuleEvaluation_batchRunId_evaluatedAt_idx" ON "RuleEvaluation"("batchRunId", "evaluatedAt");
CREATE INDEX "RuleEvaluation_ruleVersionId_evaluatedAt_idx" ON "RuleEvaluation"("ruleVersionId", "evaluatedAt");
CREATE INDEX "RuleEvaluation_previousEvaluationId_idx" ON "RuleEvaluation"("previousEvaluationId");
CREATE INDEX "RuleVersionAuditEvent_ruleSetId_createdAt_idx" ON "RuleVersionAuditEvent"("ruleSetId", "createdAt");
CREATE INDEX "RuleVersionAuditEvent_ruleVersionId_createdAt_idx" ON "RuleVersionAuditEvent"("ruleVersionId", "createdAt");
CREATE INDEX "RuleVersionAuditEvent_actorUserId_createdAt_idx" ON "RuleVersionAuditEvent"("actorUserId", "createdAt");

-- Database-level safety net: immutable snapshots remain immutable even if a
-- future caller bypasses the service layer.
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
