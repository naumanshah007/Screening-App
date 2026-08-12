"use server";

import { signIn } from "@/lib/auth";
import { getDefaultAppRouteForRole } from "@/lib/auth/permissions";
import {
  findDemoAccount,
  getDemoPassword,
  isDemoModeEnabled,
} from "@/lib/config/demo-mode";

/**
 * One-click demonstration sign-in.
 *
 * WHY A SERVER ACTION, AND WHY IT LIVES HERE
 * ------------------------------------------
 * The demo credential never leaves the server. The browser posts only an opaque
 * account key ("admin", "smo", …); this action resolves the credential from the
 * environment and authenticates server-side, so nothing credential-shaped is
 * serialised into the client bundle, into props, or into the DOM.
 *
 * It deliberately does NOT live in app/(auth)/login. The R6 regression guard
 * (tests/security/login-no-credential-exposure.test.ts) statically asserts that
 * no file in that directory contains credential-shaped code at all. Keeping the
 * guarded directory pristine means that blunt, reliable check keeps working
 * unmodified — adding this feature required no weakening of it.
 *
 * When DEMO_MODE is off this action refuses unconditionally, so the endpoint is
 * inert in a real deployment even if a stale client were to call it.
 */
export async function signInAsDemoUser(
  accountKey: string
): Promise<{ ok: false; error: string }> {
  if (!isDemoModeEnabled()) {
    return { ok: false, error: "Demo sign-in is not available." };
  }

  const account = findDemoAccount(accountKey);
  if (!account) {
    return { ok: false, error: "Unknown demonstration account." };
  }

  const secret = getDemoPassword();
  if (!secret) {
    return {
      ok: false,
      error: "DEMO_PASSWORD is not configured for this deployment.",
    };
  }

  try {
    // On success signIn redirects, which throws NEXT_REDIRECT. That must
    // propagate — it is how the browser navigates into the authenticated app.
    await signIn("credentials", {
      email: account.email,
      password: secret,
      // Send each identity to its own role landing page, resolved from the same
      // map the app uses after a manual sign-in — a demo login must exercise the
      // real role routing, not a shared shortcut to /dashboard.
      redirectTo: getDefaultAppRouteForRole(account.role),
    });
  } catch (error) {
    // Next's redirect signal is an control-flow exception, not a failure.
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      typeof (error as { digest?: unknown }).digest === "string" &&
      (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
    ) {
      throw error;
    }

    // Anything else means the demo account does not accept the configured
    // password — almost always because the accounts were seeded with a
    // different one. Report it plainly rather than surfacing a 500 page.
    return {
      ok: false,
      error:
        `Could not sign in as ${account.label}. The demonstration accounts do ` +
        "not match DEMO_PASSWORD for this deployment — run the demo password " +
        "reset to realign them.",
    };
  }

  return { ok: false, error: "Sign-in did not complete." };
}
