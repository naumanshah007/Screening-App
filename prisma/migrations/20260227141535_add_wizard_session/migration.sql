-- CreateTable
CREATE TABLE "WizardSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "determinedFigure" TEXT,
    "decisionJson" TEXT,
    "screeningSessionId" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WizardSession_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WizardSession_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
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

-- CreateIndex
CREATE UNIQUE INDEX "WizardSession_screeningSessionId_key" ON "WizardSession"("screeningSessionId");

-- CreateIndex
CREATE INDEX "WizardSession_patientId_status_idx" ON "WizardSession"("patientId", "status");

-- CreateIndex
CREATE INDEX "WizardSession_createdById_idx" ON "WizardSession"("createdById");

-- CreateIndex
CREATE INDEX "WizardAnswer_wizardSessionId_idx" ON "WizardAnswer"("wizardSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "WizardAnswer_wizardSessionId_stepId_key" ON "WizardAnswer"("wizardSessionId", "stepId");
