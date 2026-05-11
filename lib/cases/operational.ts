import type { TriagePriority } from "@prisma/client";

export type OperationalWorkflow =
  | "PENDING_REVIEW"
  | "BOOKABLE"
  | "VIRTUAL_CLINIC"
  | "RETURN_TO_GP"
  | "NEEDS_MORE_INFO";

export type OperationalState = {
  workflow: OperationalWorkflow;
  requiresSmoReview: boolean;
  reason: string | null;
};

const workflowPriorityMap: Record<
  Exclude<OperationalWorkflow, "PENDING_REVIEW">,
  TriagePriority[]
> = {
  BOOKABLE: ["P1", "P1_HSC", "P2", "P2_HSC", "P3"],
  VIRTUAL_CLINIC: ["P5"],
  RETURN_TO_GP: ["REJECT", "DECLINE"],
  NEEDS_MORE_INFO: ["INFO_REQUIRED"],
};

export function deriveOperationalWorkflow(priority?: TriagePriority | null) {
  if (!priority) {
    return "PENDING_REVIEW" as const;
  }

  if (priority === "P5") {
    return "VIRTUAL_CLINIC" as const;
  }

  if (priority === "REJECT" || priority === "DECLINE") {
    return "RETURN_TO_GP" as const;
  }

  if (priority === "INFO_REQUIRED") {
    return "NEEDS_MORE_INFO" as const;
  }

  return "BOOKABLE" as const;
}

export function getWorkflowPriorityValues(workflow: OperationalWorkflow) {
  if (workflow === "PENDING_REVIEW") {
    return [] satisfies TriagePriority[];
  }

  return workflowPriorityMap[workflow];
}

export function buildOperationalState(args: {
  priority?: TriagePriority | null;
  outcome?: string | null;
  requiresSmoReview?: boolean;
}) {
  const workflow = deriveOperationalWorkflow(args.priority);
  const reason =
    workflow === "BOOKABLE" ? null : args.outcome?.trim() ? args.outcome.trim() : null;

  return {
    workflow,
    requiresSmoReview: Boolean(args.requiresSmoReview),
    reason,
  } satisfies OperationalState;
}

export function isOperationalWorkflowBookable(workflow: OperationalWorkflow) {
  return workflow === "BOOKABLE";
}

export function getOperationalWorkflowLabel(workflow: OperationalWorkflow) {
  switch (workflow) {
    case "PENDING_REVIEW":
      return "Pending Review";
    case "BOOKABLE":
      return "Bookable";
    case "VIRTUAL_CLINIC":
      return "Virtual Clinic";
    case "RETURN_TO_GP":
      return "Return To GP";
    case "NEEDS_MORE_INFO":
      return "Needs More Info";
    default:
      return workflow;
  }
}
