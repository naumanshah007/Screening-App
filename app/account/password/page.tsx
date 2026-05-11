import { redirect } from "next/navigation";
import { KeyRound, ShieldCheck } from "lucide-react";

import { auth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { getPasswordLifecycleSummary } from "@/lib/auth/password-policy";
import { PasswordChangeForm } from "./PasswordChangeForm";

export default async function AccountPasswordPage() {
  const session = await auth();
  const sessionUser = session?.user as
    | {
        id?: string;
        name?: string | null;
        email?: string | null;
        requiresPasswordChange?: boolean;
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
      passwordChangeRequired: true,
      passwordExpiresAt: true,
    },
  });

  if (!user) {
    redirect("/login");
  }

  const summary = getPasswordLifecycleSummary(user);

  return (
    <div className="min-h-screen bg-muted px-4 py-10">
      <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
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
                  Update your password before continuing
                </h1>
                <p className="max-w-xl text-sm leading-6 text-slate-200">
                  This step protects referral data and keeps the platform aligned
                  with enterprise access controls. Once you set a new password,
                  you will sign in again and return to your normal workspace.
                </p>
              </div>
            </div>

            <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-slate-100">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-cyan-200" />
                <span className="font-medium">{user.name ?? user.email}</span>
              </div>
              <div>
                <span className="text-slate-300">Why this is happening:</span>{" "}
                {summary.detail}
              </div>
              <div>
                <span className="text-slate-300">What happens next:</span> set a
                new password, sign in again, then continue with cases, summaries,
                and grading.
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader className="border-b border-slate-100">
            <div className="space-y-3">
              <Badge variant={summary.variant}>{summary.label}</Badge>
              <div>
                <CardTitle className="text-base">Password update required</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Use your current sign-in password once, then set the password
                  you want to keep using.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-xl border border-slate-200 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              <div className="font-medium text-foreground">Simple steps</div>
              <ol className="mt-2 list-decimal space-y-1 pl-5">
                <li>Enter your current password.</li>
                <li>Choose a new password with at least 8 characters.</li>
                <li>Confirm it and save.</li>
              </ol>
            </div>

            <PasswordChangeForm
              requiresImmediateChange={summary.requiresImmediateChange}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
