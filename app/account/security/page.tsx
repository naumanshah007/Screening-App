import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck, Smartphone, KeyRound } from "lucide-react";

import { auth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { countRecoveryCodes } from "@/lib/auth/recovery-codes";
import { requiresTwoFactorForRole } from "@/lib/auth/two-factor-policy";
import { getPasswordLifecycleSummary } from "@/lib/auth/password-policy";
import { getSessionFreshnessSummary } from "@/lib/auth/session-policy";
import { RecoveryCodesPanel } from "./RecoveryCodesPanel";
import { TwoFactorSetupPanel } from "./TwoFactorSetupPanel";
import { SessionRevocationButton } from "./SessionRevocationButton";

export default async function AccountSecurityPage() {
  const session = await auth();
  const sessionUser = session?.user as
    | {
        id?: string;
        role?: string;
        authenticatedAt?: string | null;
      }
    | undefined;

  if (!sessionUser?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      name: true,
      email: true,
      role: true,
      twoFAEnabled: true,
      twoFARecoveryCodesJson: true,
      passwordChangeRequired: true,
      passwordExpiresAt: true,
    },
  });

  if (!user) {
    redirect("/login");
  }

  const passwordLifecycle = getPasswordLifecycleSummary(user);
  const twoFactorRequired = requiresTwoFactorForRole(user.role);
  const recoveryCodeCount = countRecoveryCodes(user.twoFARecoveryCodesJson);
  const sessionFreshness = getSessionFreshnessSummary({
    role: user.role,
    authenticatedAt: sessionUser.authenticatedAt ?? null,
  });

  return (
    <div className="min-h-screen bg-muted px-4 py-10">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="overflow-hidden border-0 bg-[#17324d] text-white shadow-xl">
          <CardContent className="flex h-full flex-col justify-between gap-10 px-8 py-8">
            <div className="space-y-4">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
                <ShieldCheck className="h-7 w-7" />
              </div>
              <div className="space-y-2">
                <p className="text-sm uppercase tracking-[0.18em] text-cyan-200">
                  Account Security
                </p>
                <h1 className="text-3xl font-semibold tracking-tight">
                  Protect this account before using enterprise workflows
                </h1>
                <p className="max-w-xl text-sm leading-6 text-slate-200">
                  Sensitive roles must use both a password and an authenticator app. This keeps
                  grading, administration, and restricted integrations safer without making the
                  workflow hard to follow. Recovery codes provide a backup if the authenticator app
                  is unavailable.
                </p>
              </div>
            </div>

            <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-slate-100">
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-cyan-200" />
                <span className="font-medium">{user.name ?? user.email}</span>
              </div>
              <div>
                <span className="text-slate-300">Role:</span> {user.role}
              </div>
              <div>
                <span className="text-slate-300">Two-factor requirement:</span>{" "}
                {twoFactorRequired ? "Required for this role" : "Optional but recommended"}
              </div>
              <div>
                <span className="text-slate-300">Current state:</span>{" "}
                {user.twoFAEnabled ? "Authenticator active" : "Authenticator not active yet"}
              </div>
              <div>
                <span className="text-slate-300">Session freshness:</span>{" "}
                {sessionFreshness.label}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="shadow-lg">
            <CardHeader className="border-b border-slate-100">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={user.twoFAEnabled ? "low" : twoFactorRequired ? "high" : "info"}>
                    {user.twoFAEnabled
                      ? "Authenticator active"
                      : twoFactorRequired
                        ? "Setup required"
                        : "Optional setup"}
                  </Badge>
                  <Badge variant="default">Role: {user.role}</Badge>
                </div>
                <div>
                  <CardTitle className="text-base">Authenticator setup</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Use an authenticator app to generate a fresh 6-digit code each time you sign in.
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <TwoFactorSetupPanel
                required={twoFactorRequired}
                enabled={user.twoFAEnabled}
              />
              {user.twoFAEnabled && (
                <div className="mt-4">
                  <RecoveryCodesPanel recoveryCodeCount={recoveryCodeCount} />
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-lg">
            <CardHeader className="border-b border-slate-100">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={sessionFreshness.variant}>
                    {sessionFreshness.label}
                  </Badge>
                  <Badge variant="default">Privileged session policy</Badge>
                </div>
                <div>
                  <CardTitle className="text-base">Session refresh window</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Privileged users should re-authenticate more often than standard users.
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-muted/40 px-4 py-4 text-sm text-muted-foreground">
                {sessionFreshness.detail}
              </div>
              <SessionRevocationButton />
            </CardContent>
          </Card>

          <Card className="shadow-lg">
            <CardHeader className="border-b border-slate-100">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-brand-600" />
                  <CardTitle className="text-base">Password status</CardTitle>
                </div>
                <p className="text-sm text-muted-foreground">
                  Password rotation and authenticator setup work together. Both may be required for
                  sensitive roles.
                </p>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={passwordLifecycle.variant}>{passwordLifecycle.label}</Badge>
              </div>
              <div className="rounded-xl border border-slate-200 bg-muted/40 px-4 py-4 text-sm text-muted-foreground">
                {passwordLifecycle.detail}
              </div>
              <Link href="/account/password">
                <Button variant="outline">Open password settings</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
