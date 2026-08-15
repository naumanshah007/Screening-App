-- Phase 3A: additive connector-instance configuration.
-- No clinical, episode, usage, or existing integration-validation table is rebuilt.
CREATE TABLE "IntegrationConnection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organisationId" TEXT NOT NULL,
    "connectorType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sourceSystem" TEXT NOT NULL,
    "sourceFacility" TEXT,
    "environment" TEXT NOT NULL DEFAULT 'DEMO',
    "state" TEXT NOT NULL DEFAULT 'NOT_CONFIGURED',
    "endpointJson" TEXT NOT NULL DEFAULT '{}',
    "authMethod" TEXT NOT NULL DEFAULT 'NONE',
    "credentialRef" TEXT,
    "certificateRef" TEXT,
    "mappingVersion" TEXT,
    "mappingJson" TEXT NOT NULL DEFAULT '{}',
    "scheduleJson" TEXT NOT NULL DEFAULT '{}',
    "timezone" TEXT NOT NULL DEFAULT 'Pacific/Auckland',
    "lastValidatedAt" DATETIME,
    "lastValidationStatus" TEXT,
    "lastValidationSummary" TEXT,
    "lastSuccessfulImportAt" DATETIME,
    "lastFailureAt" DATETIME,
    "archivedAt" DATETIME,
    "createdByUserId" TEXT NOT NULL,
    "updatedByUserId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "IntegrationConnection_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "IntegrationConnection_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "IntegrationConnection_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "IntegrationConnection_organisationId_name_key"
    ON "IntegrationConnection"("organisationId", "name");

CREATE INDEX "IntegrationConnection_organisationId_state_updatedAt_idx"
    ON "IntegrationConnection"("organisationId", "state", "updatedAt");

CREATE INDEX "IntegrationConnection_organisationId_connectorType_idx"
    ON "IntegrationConnection"("organisationId", "connectorType");

CREATE INDEX "IntegrationConnection_updatedByUserId_updatedAt_idx"
    ON "IntegrationConnection"("updatedByUserId", "updatedAt");
