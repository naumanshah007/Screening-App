import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { listAdminUsers } from "@/lib/admin/user-management";
import { isDemoModeEnabled } from "@/lib/config/demo-mode";
import { evaluateHandoverReadiness } from "@/lib/ops/handover-readiness";
import { PageIntro } from "@/components/layout/PageIntro";
import { PageShell } from "@/components/system";
import { AdminUsersClient } from "./AdminUsersClient";
import { DemoModeStatusPanel } from "./DemoModeStatusPanel";

// Account state and demo-mode configuration are both runtime facts; this page
// must never be served from a cache that predates a change to either.
export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;

  // User administration is ADMIN-only. INTEGRATION_ADMIN can reach /admin but
  // must not manage accounts or reset credentials.
  if (user?.role !== "ADMIN") redirect("/dashboard");

  const [users, handover] = await Promise.all([
    listAdminUsers(),
    evaluateHandoverReadiness(),
  ]);

  const demoMode = isDemoModeEnabled();

  return (
    <PageShell>
      <PageIntro
        title="User management"
        description="Accounts, roles, access status and credential resets. Every action here is recorded in the immutable audit log."
      />

      <DemoModeStatusPanel demoMode={demoMode} handover={handover} />

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
