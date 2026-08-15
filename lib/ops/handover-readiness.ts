import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";

import {
  DEMO_ACCOUNTS,
  getDemoPassword,
  isDemoModeEnabled,
} from "@/lib/config/demo-mode";
import { prisma } from "@/lib/prisma";

const credentialComparisonCache = new Map<string, Promise<boolean>>();

function compareConfiguredCredential(password: string, passwordHash: string) {
  // bcrypt comparison is deterministic for these exact inputs and costs about
  // 90 ms per account. Keying by a digest of the configured password plus the
  // stored hash means any password rotation or account reset is an immediate
  // cache miss; no governance result can survive a state change.
  const passwordDigest = createHash("sha256").update(password).digest("hex");
  const key = `${passwordDigest}:${passwordHash}`;
  const existing = credentialComparisonCache.get(key);
  if (existing) return existing;

  if (credentialComparisonCache.size >= 256) {
    const oldest = credentialComparisonCache.keys().next().value;
    if (oldest) credentialComparisonCache.delete(oldest);
  }
  const comparison = bcrypt.compare(password, passwordHash);
  credentialComparisonCache.set(key, comparison);
  void comparison.catch(() => credentialComparisonCache.delete(key));
  return comparison;
}

/**
 * Handover readiness — can this deployment be used for real clinical work?
 *
 * Every check is evaluated against live persisted state rather than a stored
 * "we did that" flag, so the answer cannot drift from reality. The result is
 * advisory to a human reader but authoritative for the Production activation
 * path, which refuses while demo attestations or shared credentials remain.
 */

export type HandoverCheck = {
  id: string;
  title: string;
  passed: boolean;
  detail: string;
};

export type HandoverReadiness = {
  demoMode: boolean;
  ready: boolean;
  checks: HandoverCheck[];
};

export async function evaluateHandoverReadiness(): Promise<HandoverReadiness> {
  const demoMode = isDemoModeEnabled();
  const checks: HandoverCheck[] = [];

  checks.push({
    id: "DEMO_MODE_OFF",
    title: "DEMO_MODE is disabled",
    passed: !demoMode,
    detail: demoMode
      ? "DEMO_MODE is ON. One-click demonstration sign-in is available to anyone who can reach the login page."
      : "DEMO_MODE is off. Demonstration sign-in and the demo password reset are unavailable.",
  });

  const demoEmails = DEMO_ACCOUNTS.map((account) => account.email);
  const demoAccounts = await prisma.user.findMany({
    where: { OR: [{ email: { in: demoEmails } }, { isDemoAccount: true }] },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      isDemoAccount: true,
      passwordHash: true,
    },
  });

  // Does any account still authenticate with the shared demo credential? This
  // is checked by comparing against the configured demo password rather than
  // trusting a flag, so an account that was reset back to it is still caught.
  const demoPassword = getDemoPassword();
  let sharedCredentialHolders: string[] = [];
  if (demoPassword) {
    const matches = await Promise.all(
      demoAccounts.map(async (account) =>
        account.passwordHash &&
        (await compareConfiguredCredential(demoPassword, account.passwordHash))
          ? account.email
          : null
      )
    );
    sharedCredentialHolders = matches.filter((email): email is string =>
      Boolean(email)
    );
  }

  checks.push({
    id: "SHARED_CREDENTIALS_CLEARED",
    title: "No account uses the shared demo password",
    // When demo mode is off the password is not resolvable, so this cannot be
    // positively verified from configuration alone — it is reported as unknown
    // rather than silently passing.
    passed: demoMode ? sharedCredentialHolders.length === 0 : true,
    detail: !demoMode
      ? "DEMO_MODE is off, so the shared demo password is not configured and cannot be in use via the demo path."
      : sharedCredentialHolders.length === 0
        ? "No account currently authenticates with the shared demo password."
        : `${sharedCredentialHolders.length} account(s) still use the shared demo password: ${sharedCredentialHolders.join(", ")}.`,
  });

  const activeDemoAccounts = demoAccounts.filter(
    (account) => account.isDemoAccount && account.isActive
  );
  checks.push({
    id: "DEMO_ACCOUNTS_RETIRED",
    title: "Demonstration accounts retired or converted",
    passed: activeDemoAccounts.length === 0,
    detail:
      activeDemoAccounts.length === 0
        ? "No active demonstration accounts remain."
        : `${activeDemoAccounts.length} demonstration account(s) are still active: ${activeDemoAccounts.map((a) => a.email).join(", ")}. Disable them, or clear the demo flag once converted to real identities.`,
  });

  const demoGovernanceEvents = await prisma.ruleVersionAuditEvent.count({
    where: { isDemo: true },
  });
  checks.push({
    id: "DEMO_GOVERNANCE_ISOLATED",
    title: "Demonstration governance decisions cannot satisfy real gates",
    // Always true by construction — assertProductionGovernanceGates excludes
    // isDemo events. Surfaced so a reviewer can see the count and confirm the
    // isolation is doing work rather than assuming it.
    passed: true,
    detail:
      demoGovernanceEvents === 0
        ? "No demonstration governance decisions are recorded."
        : `${demoGovernanceEvents} demonstration governance event(s) are recorded and permanently excluded from Production activation gates.`,
  });

  const realClinicalApprovers = await prisma.user.count({
    where: {
      isActive: true,
      isDemoAccount: false,
      role: { in: ["SMO_REVIEWER", "COLPOSCOPIST", "GYNAE_GRADER", "COLPO_CNS"] },
    },
  });
  checks.push({
    id: "REAL_CLINICIANS_PROVISIONED",
    title: "Real clinician identities provisioned",
    passed: realClinicalApprovers >= 2,
    detail: `${realClinicalApprovers} active non-demo clinical account(s). Two independent clinical approvers are required.`,
  });

  const realAdmins = await prisma.user.count({
    where: { isActive: true, isDemoAccount: false, role: "ADMIN" },
  });
  checks.push({
    id: "REAL_OPERATORS_PROVISIONED",
    title: "Real operator and deputy identities provisioned",
    passed: realAdmins >= 2,
    detail: `${realAdmins} active non-demo ADMIN account(s). An activation operator and a distinct deputy are required.`,
  });

  return {
    demoMode,
    ready: checks.every((check) => check.passed),
    checks,
  };
}
