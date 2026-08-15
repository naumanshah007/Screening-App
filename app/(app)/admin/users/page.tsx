import { redirect } from "next/navigation";
import { Suspense } from "react";

import { getServerSession } from "@/lib/auth/server-session";
import { listAdminUsers } from "@/lib/admin/user-management";
import { isDemoModeEnabled } from "@/lib/config/demo-mode";
import { evaluateHandoverReadiness } from "@/lib/ops/handover-readiness";
import { PageIntro } from "@/components/layout/PageIntro";
import { PageShell } from "@/components/system";
import { AdminUsersClient } from "./AdminUsersClient";
import { DemoModeStatusPanel } from "./DemoModeStatusPanel";
import { Skeleton } from "@/components/ui/skeleton";

// Account state and demo-mode configuration are both runtime facts; this page
// must never be served from a cache that predates a change to either.
export const dynamic = "force-dynamic";

async function HandoverStatus({ demoMode }: { demoMode: boolean }) {
  const handover = await evaluateHandoverReadiness();
  return <DemoModeStatusPanel demoMode={demoMode} handover={handover} />;
}

function HandoverStatusLoading() {
  return (
    <div
      className="rounded-xl border border-border bg-card p-5"
      role="status"
      aria-label="Checking handover readiness"
      data-navigation-feedback
    >
      <span className="sr-only">Checking handover readiness…</span>
      <div className="space-y-3" aria-hidden="true">
        <Skeleton className="h-5 w-56" />
        <Skeleton className="h-4 w-full max-w-xl" />
        <Skeleton className="h-16 w-full rounded-lg" />
      </div>
    </div>
  );
}

export default async function AdminUsersPage() {
  const session = await getServerSession();
  const user = session?.user as { id?: string; role?: string } | undefined;

  // User administration is ADMIN-only. INTEGRATION_ADMIN can reach /admin but
  // must not manage accounts or reset credentials.
  if (user?.role !== "ADMIN") redirect("/dashboard");

  const users = await listAdminUsers();
  const demoMode = isDemoModeEnabled();

  return (
    <PageShell>
      <PageIntro
        title="User management"
        description="Accounts, roles, access status and credential resets. Every action here is recorded in the immutable audit log."
      />

      <Suspense fallback={<HandoverStatusLoading />}>
        <HandoverStatus demoMode={demoMode} />
      </Suspense>

      {/*
        Two-factor status, stated once at page level rather than as a red badge
        on every row.

        Enforcement is genuinely disabled for demonstration accounts, so a
        per-row "2FA gap" on each of them reported an environment policy as if it
        were an individual account defect — it made a correctly-configured demo
        look broken. This does not fake the state: it says plainly that
        enforcement is off. A genuine per-account problem on a non-demo user
        still surfaces on its own row.
      */}
      {demoMode && (
        <div className="rounded-lg border border-border bg-muted/40 px-4 py-3">
          <p className="text-sm font-medium text-foreground">Demo environment</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            Two-factor authentication enforcement is disabled for demonstration
            accounts. Production security status is reported normally when
            DEMO_MODE is off.
          </p>
        </div>
      )}

      <AdminUsersClient
        demoMode={demoMode}
        currentUserId={user?.id ?? null}
        users={users.map((record) => ({
          id: record.id,
          name: record.name,
          email: record.email,
          role: record.role,
          isActive: record.isActive,
          isDemoAccount: record.isDemoAccount,
          lastLoginAt: record.lastLoginAt?.toISOString() ?? null,
          createdAt: record.createdAt.toISOString(),
          passwordChangeRequired: record.passwordChangeRequired,
          passwordChangedAt: record.passwordChangedAt?.toISOString() ?? null,
          lockedUntil: record.lockedUntil?.toISOString() ?? null,
        }))}
      />
    </PageShell>
  );
}
