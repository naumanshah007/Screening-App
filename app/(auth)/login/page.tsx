import { isDemoModeEnabled, listDemoAccounts } from "@/lib/config/demo-mode";
import { LoginPageClient } from "./LoginPageClient";

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

  // Resolved on the server. The client never decides whether demo mode is on,
  // and receives only identity/role labels — no credential material.
  const demoAccounts = isDemoModeEnabled()
    ? listDemoAccounts().map((account) => ({
        key: account.key,
        label: account.label,
        description: account.description,
        role: account.role,
      }))
    : [];

  return (
    <LoginPageClient
      passwordUpdated={params.passwordUpdated === "1"}
      reauthRequired={params.reauth === "1"}
      callbackUrl={params.callbackUrl ?? null}
      demoAccounts={demoAccounts}
    />
  );
}
