/**
 * The controlled clinical evaluation boundary.
 *
 * An external evaluator is given one account so they can drive the whole
 * workflow themselves. That convenience must not hand them the ability to
 * change what is being evaluated: an evaluator who can edit a rule version, or
 * edit a supplied case, can invalidate their own evaluation without noticing,
 * and nothing in the resulting evidence would show it happened.
 *
 * This is a deny layer, applied on top of whatever the account's role allows.
 * It is deliberately not a role: roles grant capability, and the requirement
 * here is to remove capability from an account that must keep a broad
 * workflow. Denial is enforced server-side in getApiPermissionError and in the
 * route guards — hiding the buttons is presentation, not a boundary.
 */

import type { Permission } from "@/lib/auth/permissions";

const DEFAULT_EVALUATION_ACCOUNTS = ["chchadmin@cs.nz"];

/**
 * Accounts under the evaluation boundary.
 *
 * Configurable so a deployment can run its evaluation under a different
 * identity without a code change; the default covers the CHCH proof of
 * concept.
 */
export function evaluationAccountEmails(): string[] {
  const configured = process.env.CHCH_EVALUATION_ACCOUNTS?.trim();
  const list = configured ? configured.split(",") : DEFAULT_EVALUATION_ACCOUNTS;
  return list.map((email) => email.trim().toLowerCase()).filter(Boolean);
}

export function isEvaluationAccount(
  user: { email?: string | null } | null | undefined
): boolean {
  const email = user?.email?.trim().toLowerCase();
  if (!email) return false;
  return evaluationAccountEmails().includes(email);
}

/**
 * Capabilities withheld from an evaluation account.
 *
 * Three groups, each for its own reason:
 *
 *  - Rule governance. An evaluator who can edit, publish, activate or roll
 *    back a rule version can change the thing under evaluation mid-evaluation.
 *  - Administration. Account, organisation and integration administration are
 *    unrelated to reviewing cases and carry real blast radius.
 *  - Clinical record creation. The evaluation works from one fixed supplied
 *    dataset; creating patients, cases or documents adds clinical records that
 *    did not come from the clinician and would sit alongside theirs.
 *
 * `cases:grade` is deliberately absent — recording accept, reject and needs
 * information is the evaluation.
 */
export const EVALUATION_DENIED_PERMISSIONS: readonly Permission[] = [
  "rules:edit",
  "rules:publish",
  "rules:activate",
  "rules:rollback",
  "rules:approve",
  "rules:validate",
  "admin:users",
  "admin:settings",
  "integration:manage",
  "integration:ncsr_pull",
  "audit:export",
  "patients:create",
  "patients:edit",
  "cases:create",
  "cases:edit",
  "documents:upload",
  "documents:ingest",
  "summary:approve",
] as const;

const DENIED = new Set<string>(EVALUATION_DENIED_PERMISSIONS);

export function isDeniedInEvaluationMode(permission: Permission): boolean {
  return DENIED.has(permission);
}

/**
 * Route prefixes an evaluation account may not reach, whatever its role says.
 * Mirrors the denied permissions above — a page that cannot do anything useful
 * without a denied capability should not be reachable at all.
 */
export const EVALUATION_DENIED_ROUTE_PREFIXES = [
  "/rules",
  "/admin",
  "/audit",
  "/governance",
  "/patients",
  "/cases",
  "/pathway",
  "/readiness",
  "/coordinator",
] as const;

export function isRouteDeniedInEvaluationMode(pathname: string): boolean {
  return EVALUATION_DENIED_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

/**
 * Intake sources an evaluation account may use.
 *
 * The evaluation has exactly one clinical intake source. Upload and manual
 * entry are refused server-side rather than merely hidden, so that a crafted
 * request cannot introduce cases the clinician did not supply.
 */
export const EVALUATION_ALLOWED_SOURCE_TYPES = ["chchPublic"] as const;

export function isSourceTypeAllowedInEvaluationMode(sourceType: string): boolean {
  return (EVALUATION_ALLOWED_SOURCE_TYPES as readonly string[]).includes(sourceType);
}
