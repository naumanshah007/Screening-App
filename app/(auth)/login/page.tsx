import { LoginPageClient } from "./LoginPageClient";

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

  return (
    <LoginPageClient
      passwordUpdated={params.passwordUpdated === "1"}
      reauthRequired={params.reauth === "1"}
      callbackUrl={params.callbackUrl ?? null}
    />
  );
}
