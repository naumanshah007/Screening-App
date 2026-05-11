import type { ServiceLine } from "@prisma/client";

import { getAiProviderStatus } from "@/lib/ai/provider";
import { getDatabaseRuntimeSummary } from "@/lib/config/database";
import {
  getDocumentStorageHealthCheck,
  getDocumentStorageRuntimeSummary,
} from "@/lib/documents/storage";
import { featureFlags } from "@/lib/features";
import { getNcsrCertificationSummary } from "@/lib/integrations/colposcopy-registry/access";
import { isNcsrConfigured } from "@/lib/integrations/colposcopy-registry/client";
import {
  buildIntegrationValidationState,
  getLatestIntegrationValidation,
} from "@/lib/ops/integration-validations";

export type IntegrationHealth = "ready" | "warning" | "blocked" | "info";

export type IntegrationStatus = {
  id: "database" | "storage" | "ai" | "ncsr";
  title: string;
  status: IntegrationHealth;
  mode: string;
  summary: string;
  detail: string;
  nextStep?: string;
};

async function withValidationStatus(
  status: IntegrationStatus
): Promise<IntegrationStatus> {
  if (status.status === "info") {
    return status;
  }

  const validation = buildIntegrationValidationState(
    await getLatestIntegrationValidation(status.id)
  );

  if (validation.kind === "none") {
    return {
      ...status,
      status: status.status === "ready" ? "warning" : status.status,
      mode: `${status.mode} · unvalidated`,
      detail: `${status.detail} ${validation.detail}`,
      nextStep: status.nextStep ?? validation.recommendedAction,
    };
  }

  if (validation.kind === "failed") {
    return {
      ...status,
      status: "blocked",
      mode: `${status.mode} · validation failed`,
      detail: `${status.detail} ${validation.detail}`,
      nextStep: validation.recommendedAction,
    };
  }

  if (validation.kind === "expired" || validation.kind === "warning") {
    return {
      ...status,
      status: status.status === "blocked" ? "blocked" : "warning",
      mode: `${status.mode} · ${validation.label.toLowerCase()}`,
      detail: `${status.detail} ${validation.detail}`,
      nextStep: validation.recommendedAction ?? status.nextStep,
    };
  }

  return {
    ...status,
    mode: `${status.mode} · validated`,
    detail: `${status.detail} ${validation.detail}`,
  };
}

function getDatabaseStatus(): IntegrationStatus {
  const runtime = getDatabaseRuntimeSummary();

  return runtime.mode === "remote-libsql"
    ? {
        id: "database",
        title: "Managed database",
        status: "ready",
        mode: "Remote libsql",
        summary: "Managed remote database target is configured.",
        detail: `Runtime target: ${runtime.displayTarget}.`,
      }
    : {
        id: "database",
        title: "Managed database",
        status: "warning",
        mode: "Local file",
        summary: "The app is still running on a local file database.",
        detail:
          "This is fine for development and demos, but not for production or enterprise operations.",
        nextStep:
          "Move the deployment to the managed remote libsql target before production use.",
      };
}

async function getStorageStatus(): Promise<IntegrationStatus> {
  const storage = getDocumentStorageRuntimeSummary();
  const health = await getDocumentStorageHealthCheck();

  if (health.status === "warning" && storage.implementation === "development") {
    return {
      id: "storage",
      title: "Document storage",
      status: "warning",
      mode: "Local filesystem",
      summary: "Referral documents are still stored locally.",
      detail:
        "The storage abstraction is live, but the runtime is using development-only local file storage.",
      nextStep:
        "Switch to the NZ-hosted production storage provider before live deployment.",
    };
  }

  if (!storage.configured) {
    return {
      id: "storage",
      title: "Document storage",
      status: "blocked",
      mode: storage.providerName,
      summary: "A production storage provider is selected but not fully configured.",
      detail:
        "Required runtime configuration is missing, so document storage cannot be treated as enterprise-ready.",
      nextStep:
        "Provide the production storage connection settings for the selected provider.",
      };
  }

  return {
    id: "storage",
    title: "Document storage",
    status: health.status,
    mode: storage.providerName,
    summary: health.summary,
    detail: `${health.detail} Target ${storage.targetLabel}.`,
    nextStep:
      health.status === "warning" || health.status === "blocked"
        ? "Run a controlled upload and download test in the target environment before production use."
        : undefined,
  };
}

function getAiStatus(): IntegrationStatus {
  const aiStatus = getAiProviderStatus();

  if (!featureFlags.aiAssist) {
    return {
      id: "ai",
      title: "AI assist",
      status: "info",
      mode: "Feature disabled",
      summary: "AI assist is currently hidden behind a feature flag.",
      detail:
        "Deterministic grading remains available, but AI summary and recommendation assist are not exposed to users.",
    };
  }

  if (aiStatus.isStub) {
    return {
      id: "ai",
      title: "AI assist",
      status: "warning",
      mode: "Stub mode",
      summary: "AI assist is enabled but not backed by a live model.",
      detail:
        "Users will see placeholder AI output until a real provider is configured.",
      nextStep:
        "Configure a local Ollama deployment for patient-data-safe production use.",
    };
  }

  if (aiStatus.provider === "anthropic") {
    return {
      id: "ai",
      title: "AI assist",
      status: "warning",
      mode: `${aiStatus.provider} · ${aiStatus.model}`,
      summary: "Cloud AI inference is configured.",
      detail:
        "This is acceptable for synthetic or evaluation workflows, but not the default enterprise path for patient data.",
      nextStep:
        "Use a local Ollama model for hospital deployment.",
    };
  }

  return {
    id: "ai",
    title: "AI assist",
    status: "ready",
    mode: `${aiStatus.provider} · ${aiStatus.model}`,
    summary: "AI assist is configured with a live provider.",
    detail:
      "The runtime is set up to serve AI summary or recommendation assist requests.",
  };
}

async function getNcsrStatus(): Promise<IntegrationStatus> {
  if (!featureFlags.restrictedColpoIntegration) {
    return {
      id: "ncsr",
      title: "National colposcopy registry",
      status: "info",
      mode: "Feature disabled",
      summary: "Restricted registry pull is not exposed in this deployment.",
      detail:
        "Colposcopy cases can still run, but NCSR-backed history pull is hidden.",
    };
  }

  const certificationSummary = await getNcsrCertificationSummary();

  if (!isNcsrConfigured()) {
    return {
      id: "ncsr",
      title: "National colposcopy registry",
      status: "blocked",
      mode: "Stub mode",
      summary: "NCSR access is enabled but not configured.",
      detail:
        "Required endpoint and API key are missing, so registry pull will remain in stub mode.",
      nextStep:
        "Provide the Health NZ NCSR endpoint and credentials after access approval.",
    };
  }

  if (certificationSummary.readyCount + certificationSummary.warningCount === 0) {
    return {
      id: "ncsr",
      title: "National colposcopy registry",
      status: "blocked",
      mode: "Configured · no certified users",
      summary: "NCSR credentials are present, but no authorised trained users are recorded.",
      detail:
        "The deployment can reach the registry, but live use should remain blocked until at least one approved user has current confidentiality training on file.",
      nextStep:
        "Record active NCSR confidentiality training for a COLPO_CNS, SMO_REVIEWER, ADMIN, or INTEGRATION_ADMIN user.",
    };
  }

  if (certificationSummary.warningCount > 0 || certificationSummary.blockedCount > 0) {
    return {
      id: "ncsr",
      title: "National colposcopy registry",
      status: "warning",
      mode: "Configured · governed access",
      summary: "NCSR credentials are present and at least one trained user can access the registry.",
      detail: `${certificationSummary.readyCount + certificationSummary.warningCount} user(s) can pull live history. ${certificationSummary.blockedCount} eligible user(s) are still missing or have expired training.`,
      nextStep:
        certificationSummary.warningCount > 0
          ? "Renew expiring user certifications before they lapse."
          : "Complete training for the remaining eligible users who still lack current certification.",
    };
  }

  return {
    id: "ncsr",
    title: "National colposcopy registry",
    status: "ready",
    mode: "Configured · certified",
    summary: "NCSR credentials are present and trained users are recorded.",
    detail:
      "The integration is configured, and the current deployment has approved users with active confidentiality training on file.",
    nextStep:
      "Run a restricted validation before relying on NCSR pull in live service flow.",
  };
}

export async function getEnterpriseIntegrationStatuses(): Promise<IntegrationStatus[]> {
  return [
    await withValidationStatus(getDatabaseStatus()),
    await withValidationStatus(await getStorageStatus()),
    await withValidationStatus(getAiStatus()),
    await withValidationStatus(await getNcsrStatus()),
  ];
}

export async function getServiceIntegrationStatuses(
  serviceLine: ServiceLine
): Promise<IntegrationStatus[]> {
  const statuses = [
    await withValidationStatus(getDatabaseStatus()),
    await withValidationStatus(await getStorageStatus()),
  ];

  if (featureFlags.aiAssist) {
    statuses.push(await withValidationStatus(getAiStatus()));
  }

  if (serviceLine === "COLPOSCOPY") {
    statuses.push(await withValidationStatus(await getNcsrStatus()));
  }

  return statuses;
}

export async function getIntegrationStatusById(id: IntegrationStatus["id"]) {
  const statuses = await getEnterpriseIntegrationStatuses();
  return statuses.find((status) => status.id === id);
}
