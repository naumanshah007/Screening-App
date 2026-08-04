import { hasPermission, type Permission } from "@/lib/auth/permissions";

export type ClinicalRuleAction =
  | "view"
  | "edit"
  | "validate"
  | "approve"
  | "publish"
  | "activate"
  | "rollback"
  | "simulate"
  | "export";

const ACTION_PERMISSION: Record<ClinicalRuleAction, Permission> = {
  view: "rules:view",
  edit: "rules:edit",
  validate: "rules:validate",
  approve: "rules:approve",
  publish: "rules:publish",
  activate: "rules:activate",
  rollback: "rules:rollback",
  simulate: "rules:simulate",
  export: "rules:export",
};

export function canPerformClinicalRuleAction(
  role: string | null | undefined,
  action: ClinicalRuleAction
) {
  return hasPermission(role ?? undefined, ACTION_PERMISSION[action]);
}

export function requestAuditMetadata(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return {
    ipAddress: forwarded || request.headers.get("x-real-ip") || null,
    userAgent: request.headers.get("user-agent"),
  };
}
