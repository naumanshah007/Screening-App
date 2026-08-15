-- Phase 3B: append-only, secret-free live connectivity evidence.
CREATE TABLE "IntegrationConnectivityCheck" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organisationId" TEXT NOT NULL,
  "integrationConnectionId" TEXT NOT NULL,
  "startedAt" DATETIME NOT NULL,
  "completedAt" DATETIME NOT NULL,
  "status" TEXT NOT NULL,
  "networkStatus" TEXT NOT NULL,
  "tlsStatus" TEXT NOT NULL,
  "authenticationStatus" TEXT NOT NULL,
  "protocolStatus" TEXT NOT NULL,
  "httpStatus" INTEGER,
  "latencyMs" INTEGER,
  "safeSummary" TEXT NOT NULL,
  "safeDetailsJson" TEXT NOT NULL DEFAULT '{}',
  "endpointHostname" TEXT,
  "connectorType" TEXT NOT NULL,
  "environment" TEXT NOT NULL,
  "performedByUserId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IntegrationConnectivityCheck_organisationId_fkey"
    FOREIGN KEY ("organisationId") REFERENCES "Organisation" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "IntegrationConnectivityCheck_integrationConnectionId_fkey"
    FOREIGN KEY ("integrationConnectionId") REFERENCES "IntegrationConnection" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "IntegrationConnectivityCheck_performedByUserId_fkey"
    FOREIGN KEY ("performedByUserId") REFERENCES "User" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "IntegrationConnectivityCheck_organisationId_completedAt_idx"
  ON "IntegrationConnectivityCheck"("organisationId", "completedAt");

CREATE INDEX "IntegrationConnectivityCheck_integrationConnectionId_completedAt_idx"
  ON "IntegrationConnectivityCheck"("integrationConnectionId", "completedAt");

CREATE INDEX "IntegrationConnectivityCheck_performedByUserId_completedAt_idx"
  ON "IntegrationConnectivityCheck"("performedByUserId", "completedAt");

CREATE TRIGGER "IntegrationConnectivityCheck_immutable_update"
BEFORE UPDATE ON "IntegrationConnectivityCheck"
BEGIN
  SELECT RAISE(ABORT, 'Integration connectivity checks are immutable');
END;

CREATE TRIGGER "IntegrationConnectivityCheck_immutable_delete"
BEFORE DELETE ON "IntegrationConnectivityCheck"
BEGIN
  SELECT RAISE(ABORT, 'Integration connectivity checks are immutable');
END;
