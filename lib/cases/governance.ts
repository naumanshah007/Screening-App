import type { ServiceLine } from "@prisma/client";

import type { NcsrAccessStatus } from "@/lib/integrations/colposcopy-registry/access";
import type { IntegrationStatus } from "@/lib/ops/integration-status";

export type GovernanceArea =
  | "documents"
  | "summary"
  | "grade"
  | "ai"
  | "case-overview";

export type CaseGovernanceSignal = {
  id: string;
  level: "warning" | "blocked";
  title: string;
  summary: string;
  detail: string;
  nextStep?: string;
  areas: GovernanceArea[];
};

export function buildCaseGovernanceSignals(args: {
  serviceLine: ServiceLine;
  integrationStatuses: IntegrationStatus[];
  ncsrAccess?: NcsrAccessStatus | null;
}) {
  const signals: CaseGovernanceSignal[] = [];

  const storageStatus = args.integrationStatuses.find(
    (status) => status.id === "storage"
  );
  if (storageStatus && storageStatus.status !== "ready" && storageStatus.status !== "info") {
    signals.push({
      id: "storage",
      level: storageStatus.status === "blocked" ? "blocked" : "warning",
      title: "Document handling is not fully cleared",
      summary: storageStatus.summary,
      detail: storageStatus.detail,
      nextStep: storageStatus.nextStep,
      areas: ["documents", "summary", "grade", "case-overview"],
    });
  }

  const aiStatus = args.integrationStatuses.find((status) => status.id === "ai");
  if (aiStatus && aiStatus.status !== "ready" && aiStatus.status !== "info") {
    signals.push({
      id: "ai",
      level: aiStatus.status === "blocked" ? "blocked" : "warning",
      title: "AI assist is not approved for routine use",
      summary: aiStatus.summary,
      detail: aiStatus.detail,
      nextStep: aiStatus.nextStep,
      areas: ["grade", "ai", "case-overview"],
    });
  }

  const ncsrStatus = args.integrationStatuses.find((status) => status.id === "ncsr");
  if (
    args.serviceLine === "COLPOSCOPY" &&
    ncsrStatus &&
    ncsrStatus.status !== "ready" &&
    ncsrStatus.status !== "info"
  ) {
    signals.push({
      id: "ncsr-integration",
      level: ncsrStatus.status === "blocked" ? "blocked" : "warning",
      title: "National colposcopy history pull is not fully available",
      summary: ncsrStatus.summary,
      detail: ncsrStatus.detail,
      nextStep: ncsrStatus.nextStep,
      areas: ["summary", "grade", "case-overview"],
    });
  }

  if (
    args.serviceLine === "COLPOSCOPY" &&
    args.ncsrAccess &&
    args.ncsrAccess.status !== "ready"
  ) {
    signals.push({
      id: "ncsr-access",
      level: args.ncsrAccess.status === "blocked" ? "blocked" : "warning",
      title: "Your restricted NCSR access needs attention",
      summary: args.ncsrAccess.summary,
      detail: args.ncsrAccess.detail,
      nextStep: args.ncsrAccess.nextStep,
      areas: ["summary", "grade", "case-overview"],
    });
  }

  return signals;
}

export function getGovernanceSignalsForArea(
  signals: CaseGovernanceSignal[],
  area: GovernanceArea
) {
  return signals.filter((signal) => signal.areas.includes(area));
}

export function getAiAssistDisabledReason(signals: CaseGovernanceSignal[]) {
  const signal = signals.find((item) => item.id === "ai");
  if (!signal) {
    return null;
  }

  return `${signal.summary} ${signal.nextStep ?? signal.detail}`.trim();
}
