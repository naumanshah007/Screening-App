import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { getDefaultAppRouteForRole } from "@/lib/auth/permissions";
import { LoginPageClient } from "./LoginPageClient";

function getSafeCallbackPath(callbackUrl: string | null | undefined): string | null {
  if (!callbackUrl) return null;

  try {
    const parsed = new URL(callbackUrl, "http://localhost");
    if (parsed.pathname === "/login" || parsed.pathname.startsWith("/api/")) {
      return null;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

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
  const session = await auth();

  if (session?.user) {
    const user = session.user as { role?: string };
    redirect(
      getSafeCallbackPath(params.callbackUrl) ??
        getDefaultAppRouteForRole(user.role)
    );
  }

  return (
    <LoginPageClient
      passwordUpdated={params.passwordUpdated === "1"}
      reauthRequired={params.reauth === "1"}
      callbackUrl={params.callbackUrl ?? null}
    />
  );
}
