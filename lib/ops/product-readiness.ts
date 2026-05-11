import { getAiProviderStatus } from "@/lib/ai/provider";
import { getDatabaseRuntimeSummary } from "@/lib/config/database";
import {
  getDocumentStorageHealthCheck,
  getDocumentStorageRuntimeSummary,
} from "@/lib/documents/storage";
import { featureFlags } from "@/lib/features";
import { getNcsrCertificationSummary } from "@/lib/integrations/colposcopy-registry/access";
import { isNcsrConfigured } from "@/lib/integrations/colposcopy-registry/client";
import { getNotificationRuntimeSummary } from "@/lib/notifications";

export type ProductReadinessState = "ready" | "warning" | "blocked";
export type ProductReadinessOwner = "product" | "shared" | "customer";

export type ProductReadinessStep = {
  id: string;
  title: string;
  state: ProductReadinessState;
  owner: ProductReadinessOwner;
  summary: string;
  doneItems: string[];
  remainingItems: string[];
};

export type ProductReadinessReport = {
  overallState: ProductReadinessState;
  currentTry: "TRY_1" | "TRY_2" | "TRY_3";
  nextAction: string;
  steps: ProductReadinessStep[];
};

function combineState(states: ProductReadinessState[]): ProductReadinessState {
  if (states.includes("blocked")) return "blocked";
  if (states.includes("warning")) return "warning";
  return "ready";
}

function resolveCurrentTry(steps: ProductReadinessStep[]): ProductReadinessReport["currentTry"] {
  const try1Done =
    steps.find((step) => step.id === "clinical-parity-lock")?.state === "ready" &&
    steps.find((step) => step.id === "real-case-validation")?.state === "ready";
  const try2Done =
    steps.find((step) => step.id === "environment-cutover")?.state === "ready" &&
    steps.find((step) => step.id === "live-integrations")?.state === "ready";

  if (!try1Done) return "TRY_1";
  if (!try2Done) return "TRY_2";
  return "TRY_3";
}

function nextActionFromTry(currentTry: ProductReadinessReport["currentTry"]) {
  switch (currentTry) {
    case "TRY_1":
      return "Run the clinical validation pass using redacted real cases and lock the parity matrix with the service.";
    case "TRY_2":
      return "Activate the real deployment environment and turn on approved live integrations.";
    case "TRY_3":
      return "Run the controlled pilot, fix only pilot findings, and stop feature expansion.";
  }
}

export async function getProductReadinessReport(): Promise<ProductReadinessReport> {
  const databaseRuntime = getDatabaseRuntimeSummary();
  const storageRuntime = getDocumentStorageRuntimeSummary();
  const storageHealth = await getDocumentStorageHealthCheck();
  const notificationRuntime = getNotificationRuntimeSummary();
  const aiStatus = getAiProviderStatus();
  const ncsrConfigured = isNcsrConfigured();
  const ncsrCertificationSummary = featureFlags.restrictedColpoIntegration
    ? await getNcsrCertificationSummary()
    : null;

  const clinicalParityLock: ProductReadinessStep = {
    id: "clinical-parity-lock",
    title: "Clinical parity lock",
    state: "warning",
    owner: "shared",
    summary:
      "The repo now has a fixed parity matrix, but the clinical team still needs to accept it as the final scope baseline.",
    doneItems: [
      "Colposcopy template fields are mapped into the grading workspace.",
      "Gynaecology and colposcopy requirements are documented in the parity matrix.",
      "The finish pack now defines what should and should not reopen.",
    ],
    remainingItems: [
      "Walk the parity matrix with the service leads.",
      "Mark any disputed rule rows as policy clarification or defect.",
    ],
  };

  const realCaseValidation: ProductReadinessStep = {
    id: "real-case-validation",
    title: "Real-case validation",
    state: "warning",
    owner: "customer",
    summary:
      "The product workflow is ready for validation, but real redacted referral packs still need to be supplied and reviewed with clinicians.",
    doneItems: [
      "Documents -> Evidence -> Summary -> Grade workflow is live.",
      "A Try 1 checklist and validation log template are in the repo.",
      "Seeded demo cases are available for dry-run demonstration.",
    ],
    remainingItems: [
      "Obtain redacted colposcopy and gynaecology referral cases.",
      "Run the validation walkthrough and record accepted vs fix-required outcomes.",
    ],
  };

  const environmentState = combineState([
    databaseRuntime.mode === "remote-libsql" ? "ready" : "warning",
    storageHealth.status === "ready"
      ? "ready"
      : storageHealth.status === "blocked"
        ? "blocked"
        : "warning",
    notificationRuntime.configured ? "ready" : "warning",
  ]);

  const environmentCutover: ProductReadinessStep = {
    id: "environment-cutover",
    title: "Enterprise environment cutover",
    state: environmentState,
    owner: "shared",
    summary:
      environmentState === "ready"
        ? "Database, storage, and notification runtime are aligned for enterprise deployment."
        : "The product code supports enterprise runtime paths, but the live deployment still needs final environment configuration.",
    doneItems: [
      `Database runtime: ${databaseRuntime.mode === "remote-libsql" ? "managed remote configured" : "still local/demo shaped"}.`,
      `Document storage: ${storageRuntime.implementation === "live" ? "production provider selected" : "development/local mode"}.`,
      `Notifications: ${notificationRuntime.mode === "smtp" ? "SMTP configured" : "development log mode only"}.`,
    ],
    remainingItems: [
      ...(databaseRuntime.mode === "remote-libsql"
        ? []
        : ["Configure the managed database target for the live deployment."]),
      ...(storageHealth.status === "ready"
        ? []
        : ["Validate the live document storage provider in the target environment."]),
      ...(notificationRuntime.configured
        ? []
        : ["Provide SMTP settings for real reminder and workflow email delivery."]),
    ],
  };

  const aiState: ProductReadinessState = !featureFlags.aiAssist
    ? "blocked"
    : aiStatus.isStub
      ? "warning"
      : aiStatus.provider === "anthropic"
        ? "warning"
        : "ready";
  const ncsrReadyUsers =
    (ncsrCertificationSummary?.readyCount ?? 0) +
    (ncsrCertificationSummary?.warningCount ?? 0);
  const ncsrState: ProductReadinessState = !featureFlags.restrictedColpoIntegration
    ? "blocked"
    : !ncsrConfigured
      ? "blocked"
      : ncsrReadyUsers > 0
        ? "warning"
        : "blocked";

  const liveIntegrations: ProductReadinessStep = {
    id: "live-integrations",
    title: "Live integrations activation",
    state: combineState([aiState, ncsrState]),
    owner: "customer",
    summary:
      "The app supports live NCSR and AI paths, but real completion depends on credentials, runtime selection, and service approval.",
    doneItems: [
      `AI assist mode: ${aiStatus.isStub ? "stub/demo" : `${aiStatus.provider} configured`}.`,
      `NCSR mode: ${ncsrConfigured ? "credentials present in runtime" : "stub/not configured"}.`,
      "Governance, certification, and integration-readiness screens are already in the product.",
    ],
    remainingItems: [
      ...(aiState === "ready"
        ? []
        : ["Configure and approve the live AI provider mode for real service use."]),
      "Activate the NCSR integration with approved credentials and authorised trained users.",
    ],
  };

  const operationalPack: ProductReadinessStep = {
    id: "operational-pack",
    title: "Operational pack",
    state: "ready",
    owner: "product",
    summary:
      "The runbook, validation checklist, parity matrix, seeded roles, and governance tooling now exist as the operational handoff pack.",
    doneItems: [
      "Deployment and pilot runbook is in the repo.",
      "Try 1 checklist and validation log template are in the repo.",
      "Admin, access, certification, and incident workflows are built into the product.",
    ],
    remainingItems: [
      "Review the runbook with the pilot users and make only wording adjustments if needed.",
    ],
  };

  const pilotSignoff: ProductReadinessStep = {
    id: "pilot-signoff",
    title: "Pilot sign-off",
    state: "warning",
    owner: "customer",
    summary:
      "The product is pilot-shaped, but pilot execution and formal sign-off still depend on the service team.",
    doneItems: [
      "Seeded cases, admin controls, audit, and readiness tooling are available.",
      "The stop rule is documented: only pilot findings should drive further changes.",
    ],
    remainingItems: [
      "Run the controlled pilot.",
      "Fix pilot findings only.",
      "Obtain sign-off or a short post-pilot fix list.",
    ],
  };

  const steps = [
    clinicalParityLock,
    realCaseValidation,
    environmentCutover,
    liveIntegrations,
    operationalPack,
    pilotSignoff,
  ];

  const currentTry = resolveCurrentTry(steps);

  return {
    overallState: combineState(steps.map((step) => step.state)),
    currentTry,
    nextAction: nextActionFromTry(currentTry),
    steps,
  };
}
