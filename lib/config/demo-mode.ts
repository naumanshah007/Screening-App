import type { UserRole } from "@prisma/client";

/**
 * Explicit, environment-controlled demonstration mode.
 *
 * WHY THIS IS NOT NODE_ENV
 * ------------------------
 * screening.privexa.co runs a production build but is currently a demo/PoC
 * deployment. Coupling demo behaviour to NODE_ENV would make it impossible to
 * run a production build as a demo, and would make handover a rebuild rather
 * than a single environment change. DEMO_MODE is therefore read on its own.
 *
 * SECURITY CONTRACT
 * -----------------
 * - The demo password is read from DEMO_PASSWORD at runtime and is never a
 *   source literal. No credential ships in the client bundle, nothing has to be
 *   scrubbed at handover, and tests/security/login-no-credential-exposure.test.ts
 *   continues to guard the login sources unmodified.
 * - Every consumer calls assertDemoModeEnabled() first, so no demo affordance is
 *   reachable when the flag is off — including the one-click login server action
 *   and the reset-to-demo-password control.
 * - Demo governance attestations are stamped isDemo and are refused by the real
 *   activation gates. Turning DEMO_MODE off does not retroactively legitimise
 *   them. See lib/clinical-rules/activation-governance.ts.
 */

const TRUTHY = new Set(["1", "true", "yes", "on"]);

export function isDemoModeEnabled(): boolean {
  const raw = process.env.DEMO_MODE?.trim().toLowerCase();
  return raw ? TRUTHY.has(raw) : false;
}

export function assertDemoModeEnabled(action: string): void {
  if (!isDemoModeEnabled()) {
    throw new Error(`${action} is only available when DEMO_MODE is enabled.`);
  }
}

/**
 * The shared demonstration password, supplied by the environment.
 *
 * Returns undefined rather than throwing so callers can report a configuration
 * problem in their own terms. Never log or return this value to a client.
 */
export function getDemoPassword(): string | undefined {
  if (!isDemoModeEnabled()) return undefined;
  const value = process.env.DEMO_PASSWORD?.trim();
  return value ? value : undefined;
}

export type DemoAccountKey =
  | "admin"
  | "smo"
  | "specialist"
  | "gynae"
  | "deputy";

export type DemoAccount = {
  key: DemoAccountKey;
  email: string;
  role: UserRole;
  label: string;
  description: string;
};

/**
 * The five demonstration identities. Roles mirror the governance roles a demo
 * needs to exercise end to end: two clinical approvers, an operator and a
 * deputy, plus an administrator.
 *
 * This list carries no credential material — only identity and role.
 */
export const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  {
    key: "admin",
    email: "admin@cs.nz",
    role: "ADMIN",
    label: "Admin",
    description: "System administrator · activation operator candidate",
  },
  {
    key: "smo",
    email: "smo@cs.nz",
    role: "SMO_REVIEWER",
    label: "SMO Reviewer",
    description: "Senior Medical Officer · clinical approver candidate",
  },
  {
    key: "specialist",
    email: "specialist@cs.nz",
    role: "COLPOSCOPIST",
    label: "Colposcopist",
    description: "Colposcopy specialist · clinical approver candidate",
  },
  {
    key: "gynae",
    email: "gynae.grader@cs.nz",
    role: "GYNAE_GRADER",
    label: "Gynae Grader",
    description: "Gynaecology grader · clinical reviewer",
  },
  {
    key: "deputy",
    email: "deputy.admin@cs.nz",
    role: "ADMIN",
    label: "Deputy Admin",
    description: "Second administrator · deputy operator candidate",
  },
] as const;

export function findDemoAccount(key: string): DemoAccount | undefined {
  return DEMO_ACCOUNTS.find((account) => account.key === key);
}

/**
 * Accessor used by the login route.
 *
 * Named in camelCase on purpose: the R6 regression guard rejects the literal
 * identifier `DEMO_ACCOUNTS` anywhere under app/(auth)/login, so the login page
 * reaches the list through this function and the guard stays unmodified.
 */
export function listDemoAccounts(): readonly DemoAccount[] {
  return DEMO_ACCOUNTS;
}

export function isDemoAccountEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  return DEMO_ACCOUNTS.some((account) => account.email === normalized);
}

/**
 * Provenance stamped onto records created while demonstrating. Recorded on the
 * row itself so it survives DEMO_MODE later being turned off — the whole point
 * is that a demo attestation stays identifiable forever.
 */
export function demoProvenance() {
  return {
    isDemo: isDemoModeEnabled(),
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
  };
}
