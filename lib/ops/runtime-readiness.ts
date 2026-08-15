import { execFile } from "node:child_process";
import { promisify } from "node:util";

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
  getIntegrationValidationStateMap,
  type EnterpriseIntegrationId,
  type IntegrationValidationState,
} from "@/lib/ops/integration-validations";
import { evaluateRuntimeBoundary } from "@/lib/config/runtime-boundary";
import { PILOT_GOVERNANCE_BASELINE } from "@/lib/ops/pilot-readiness";

const execFileAsync = promisify(execFile);

export type RuntimeReadinessStatus = "ready" | "warning" | "blocked" | "info";

export type RuntimeReadinessCheck = {
  id: string;
  title: string;
  status: RuntimeReadinessStatus;
  summary: string;
  detail: string;
  recommendedAction?: string;
};

export type RuntimeReadinessReport = {
  overallStatus: RuntimeReadinessStatus;
  checks: RuntimeReadinessCheck[];
};

async function withValidationCheck(
  check: RuntimeReadinessCheck,
  integrationId: EnterpriseIntegrationId,
  validationStateMap: Map<EnterpriseIntegrationId, IntegrationValidationState>
): Promise<RuntimeReadinessCheck> {
  const validation =
    validationStateMap.get(integrationId) ?? buildIntegrationValidationState(null);

  if (check.status === "info") {
    return check;
  }

  if (validation.kind === "none") {
    return {
      ...check,
      status: (check.status === "ready" ? "warning" : check.status) as RuntimeReadinessStatus,
      detail: `${check.detail} ${validation.detail}`,
      recommendedAction: check.recommendedAction ?? validation.recommendedAction,
    };
  }

  if (validation.kind === "failed") {
    return {
      ...check,
      status: "blocked" as const,
      detail: `${check.detail} ${validation.detail}`,
      recommendedAction: validation.recommendedAction,
    };
  }

  if (validation.kind === "expired" || validation.kind === "warning") {
    return {
      ...check,
      status: (check.status === "blocked" ? "blocked" : "warning") as RuntimeReadinessStatus,
      detail: `${check.detail} ${validation.detail}`,
      recommendedAction: validation.recommendedAction ?? check.recommendedAction,
    };
  }

  return {
    ...check,
    detail: `${check.detail} ${validation.detail}`,
  };
}

async function commandAvailable(command: string) {
  try {
    await execFileAsync("which", [command], { timeout: 2_000 });
    return true;
  } catch {
    return false;
  }
}

function computeOverallStatus(
  checks: RuntimeReadinessCheck[]
): RuntimeReadinessStatus {
  if (checks.some((check) => check.status === "blocked")) {
    return "blocked";
  }

  if (checks.some((check) => check.status === "warning")) {
    return "warning";
  }

  if (checks.some((check) => check.status === "ready")) {
    return "ready";
  }

  return "info";
}

export async function getRuntimeReadinessReport(): Promise<RuntimeReadinessReport> {
  const runtimeBoundary = evaluateRuntimeBoundary();
  const databaseRuntime = getDatabaseRuntimeSummary();
  const aiStatus = getAiProviderStatus();
  const storageRuntime = getDocumentStorageRuntimeSummary();
  const storageHealth = await getDocumentStorageHealthCheck();
  const ncsrCertificationSummary = featureFlags.restrictedColpoIntegration
    ? await getNcsrCertificationSummary()
    : null;
  const validationStateMap = await getIntegrationValidationStateMap();
  const tesseractAvailable = await commandAvailable(
    process.env.TESSERACT_BINARY?.trim() || "tesseract"
  );
  const pdftoppmAvailable = await commandAvailable(
    process.env.PDFTOPPM_BINARY?.trim() || "pdftoppm"
  );

  const checks: RuntimeReadinessCheck[] = [
    runtimeBoundary.ready
      ? {
          id: "runtime-security-boundary",
          title: "Runtime security boundary",
          status: runtimeBoundary.mode === "PILOT" ? "ready" : "info",
          summary: `${runtimeBoundary.mode} mode is internally consistent.`,
          detail:
            runtimeBoundary.mode === "PILOT"
              ? "Demo credentials are excluded, local MFA is required, session windows are explicit, and managed database configuration is present. This does not constitute customer approval."
              : "Pilot data authority is not inferred from this runtime mode.",
        }
      : {
          id: "runtime-security-boundary",
          title: "Runtime security boundary",
          status: "blocked",
          summary: `${runtimeBoundary.mode} mode is blocked by security configuration.`,
          detail: runtimeBoundary.issues.map((issue) => issue.message).join(" "),
          recommendedAction:
            "Resolve every named configuration or external gate; do not bypass the runtime check.",
        },
    {
      id: "pilot-governance-baseline",
      title: "Canonical governance baseline",
      status: runtimeBoundary.mode === "PILOT" ? "blocked" : "info",
      summary: `${PILOT_GOVERNANCE_BASELINE.interpretationCards} interpretation cards / ${PILOT_GOVERNANCE_BASELINE.distinctClinicalApprovals} distinct clinical approvals / ${PILOT_GOVERNANCE_BASELINE.canonicalActivationGates} canonical activation gates.`,
      detail:
        "These are separate canonical-authority gates recovered from the repository. Pilot configuration does not satisfy or bypass them, and no draft ruleset is activated.",
      recommendedAction:
        "Complete and evidence governance in its separate approval stream before any canonical activation.",
    },
    await withValidationCheck(
      databaseRuntime.mode === "remote-libsql"
      ? {
          id: "database",
          title: "Database runtime",
          status: "ready",
          summary: "Managed remote libsql target is configured.",
          detail: `Connected using libsql adapter to ${databaseRuntime.displayTarget}.`,
        }
      : {
          id: "database",
          title: "Database runtime",
          status: "warning",
          summary: "Application is running on a local file database.",
          detail:
            "This is suitable for development and demos, not enterprise deployment.",
          recommendedAction:
            "Set DATABASE_URL or TURSO_DATABASE_URL to the managed remote libsql target and configure an auth token.",
        },
      "database",
      validationStateMap
    ),
    featureFlags.casesV2 &&
    featureFlags.documentIngest &&
    featureFlags.colposcopyModule &&
    featureFlags.gynaecologyModule
      ? {
          id: "workflow-flags",
          title: "Enterprise workflow modules",
          status: "ready",
          summary: "Enterprise case workflows are enabled.",
          detail:
            "Cases V2, document ingest, colposcopy, and gynaecology modules are all available.",
        }
      : {
          id: "workflow-flags",
          title: "Enterprise workflow modules",
          status: "warning",
          summary: "One or more enterprise workflow flags are still disabled.",
          detail: `casesV2=${featureFlags.casesV2}, documentIngest=${featureFlags.documentIngest}, colposcopyModule=${featureFlags.colposcopyModule}, gynaecologyModule=${featureFlags.gynaecologyModule}.`,
          recommendedAction:
            "Enable the enterprise workflow flags in the deployment environment before stakeholder review or production use.",
        },
    await withValidationCheck({
      id: "storage",
      title: "Document storage",
      status: storageHealth.status,
      summary: storageHealth.summary,
      detail: `${storageHealth.detail} Target ${storageRuntime.targetLabel}.`,
      recommendedAction:
        storageHealth.status === "warning" || storageHealth.status === "blocked"
          ? runtimeStorageAction(storageRuntime)
          : undefined,
    }, "storage", validationStateMap),
    tesseractAvailable && pdftoppmAvailable
      ? {
          id: "ocr",
          title: "OCR toolchain",
          status: "ready",
          summary: "Tesseract and PDF rasterisation tools are available.",
          detail:
            "Scanned images and textless PDFs can be OCRed during ingest.",
        }
      : {
          id: "ocr",
          title: "OCR toolchain",
          status: "blocked",
          summary: "OCR dependencies are missing from the runtime.",
          detail: `tesseract=${tesseractAvailable}, pdftoppm=${pdftoppmAvailable}. Both are required for scanned-document OCR.`,
          recommendedAction:
            "Install tesseract and poppler/pdftoppm in the deployment environment.",
        },
    await withValidationCheck(!featureFlags.aiAssist
      ? {
          id: "ai",
          title: "AI assist",
          status: "info",
          summary: "AI assist is currently disabled by feature flag.",
          detail:
            "Deterministic grading remains available, but AI summary/recommendation workflows are hidden.",
        }
      : aiStatus.isStub
        ? {
            id: "ai",
            title: "AI assist",
            status: "warning",
            summary: "AI assist is enabled but still running in stub mode.",
            detail:
              "No real inference provider is configured, so users will see placeholder AI output.",
            recommendedAction:
              "Configure AI_PROVIDER=ollama with a local model server for an enterprise-safe deployment path.",
          }
        : aiStatus.provider === "anthropic"
          ? {
              id: "ai",
              title: "AI assist",
              status: "warning",
              summary: "Anthropic cloud inference is configured.",
              detail:
                "This may be suitable for synthetic or evaluation data, but not for production patient data without governance approval.",
              recommendedAction:
                "Use a local Ollama deployment for patient-data-safe production workflows.",
            }
          : {
              id: "ai",
              title: "AI assist",
              status: "ready",
            summary: `AI assist is configured with provider ${aiStatus.provider}.`,
            detail: `Model ${aiStatus.model} will be used for AI assist requests.`,
            },
      "ai",
      validationStateMap),
    await withValidationCheck(!featureFlags.restrictedColpoIntegration
      ? {
          id: "ncsr",
          title: "Restricted colposcopy integration",
          status: "info",
          summary: "NCSR integration is currently disabled by feature flag.",
          detail:
            "The product can still run, but national colposcopy history pull is not exposed.",
        }
      : !isNcsrConfigured()
        ? {
            id: "ncsr",
            title: "Restricted colposcopy integration",
            status: "blocked",
            summary: "NCSR integration is enabled but not configured.",
            detail:
              "Required API base URL and API key are missing, so the integration will remain in stub mode.",
            recommendedAction:
              "Provide NCSR_API_BASE_URL and NCSR_API_KEY after Health NZ integration access is approved.",
          }
        : {
            id: "ncsr",
            title: "Restricted colposcopy integration",
            status:
              ncsrCertificationSummary &&
              ncsrCertificationSummary.readyCount + ncsrCertificationSummary.warningCount > 0
                ? "warning"
                : "blocked",
            summary:
              ncsrCertificationSummary &&
              ncsrCertificationSummary.readyCount + ncsrCertificationSummary.warningCount > 0
                ? "NCSR connection details are configured."
                : "NCSR connection details are configured, but no trained users are available.",
            detail:
              ncsrCertificationSummary &&
              ncsrCertificationSummary.readyCount + ncsrCertificationSummary.warningCount > 0
                ? `Credentials are present. ${ncsrCertificationSummary.readyCount + ncsrCertificationSummary.warningCount} authorised user(s) currently have training on file, but this path still needs end-to-end validation against the real restricted service.`
                : "Credentials are present, but all eligible users are missing or have expired confidentiality training records.",
            recommendedAction:
              ncsrCertificationSummary &&
              ncsrCertificationSummary.readyCount + ncsrCertificationSummary.warningCount > 0
                ? "Run a controlled validation with authorised users before treating the registry pull as production-ready."
                : "Record active NCSR confidentiality training for at least one authorised user before live validation.",
          },
      "ncsr",
      validationStateMap),
  ];

  return {
    overallStatus: computeOverallStatus(checks),
    checks,
  };
}

function runtimeStorageAction(
  runtime: ReturnType<typeof getDocumentStorageRuntimeSummary>
) {
  if (runtime.implementation === "development") {
    return "Switch DOCUMENT_STORAGE_PROVIDER to the NZ-hosted production provider when it is available.";
  }

  if (!runtime.configured) {
    return "Provide the production storage configuration and validate upload, download, and delete before production use.";
  }

  return "Validate the configured storage provider with a controlled upload and download test in the target environment.";
}
