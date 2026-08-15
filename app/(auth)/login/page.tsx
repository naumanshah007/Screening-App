import { isDemoModeEnabled, listDemoAccounts } from "@/lib/config/demo-mode";
import { getDefaultAppRouteForRole } from "@/lib/auth/permissions";
import { LoginPageClient } from "./LoginPageClient";
import { evaluateRuntimeBoundary } from "@/lib/config/runtime-boundary";

// The demo affordance depends on runtime environment state, so this route must
// never be statically cached with the decision baked in.
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    passwordUpdated?: string;
    reauth?: string;
    callbackUrl?: string;
  }>;
}) {
  const params = await searchParams;
  const boundary = evaluateRuntimeBoundary();

  // Resolved on the server. The client never decides whether demo mode is on,
  // and receives only identity/role labels — no credential material.
  const demoAccounts =
    boundary.mode === "DEMO" && boundary.ready && isDemoModeEnabled()
    ? listDemoAccounts().map((account) => ({
        key: account.key,
        label: account.label,
        description: account.description,
        role: account.role,
        // Derived from the application's own role→route map so the card cannot
        // advertise a landing page the app does not actually send them to.
        landingPage: getDefaultAppRouteForRole(account.role),
      }))
    : [];

  return (
    <LoginPageClient
      passwordUpdated={params.passwordUpdated === "1"}
      reauthRequired={params.reauth === "1"}
      callbackUrl={params.callbackUrl ?? null}
      demoAccounts={demoAccounts}
      runtimeMode={boundary.mode}
      configurationIssues={boundary.issues.map((issue) => issue.message)}
      showAuthenticatorCode={boundary.mode === "PILOT"}
    />
  );
}
