import { auth } from "@/lib/auth";
import { Sidebar } from "@/components/layout/Sidebar";
import { isFeatureEnabled } from "@/lib/features";
import { isAuthorizedForRoute } from "@/lib/auth/permissions";
import { getReviewQueueCounts } from "@/lib/batch/persistence";
import { getClinicalAuthorityDisplay } from "@/lib/clinical-rules/authority-display";
import { redirect } from "next/navigation";

// The clinical authority indicator must never be served from a build-time
// render: it reports which engine is authoritative right now, and a stale
// value here would misstate that on every page.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");
  const user = session.user as { name?: string; role?: string; email?: string };
  const showCases = isFeatureEnabled("casesV2");
  const showBatch = isFeatureEnabled("batchDemo");

  // Live count for the Review Queue nav badge (only when the user can see it).
  const reviewCounts =
    showBatch && isAuthorizedForRoute("/review", user.role)
      ? await getReviewQueueCounts()
      : { pending: 0, urgent: 0 };

  // Which engine is clinically authoritative right now. Read-only, never throws.
  const clinicalAuthority = await getClinicalAuthorityDisplay();

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      <Sidebar
        userRole={user.role}
        userName={user.name}
        userEmail={user.email}
        showCases={showCases}
        showBatch={showBatch}
        reviewPending={reviewCounts.pending}
        reviewUrgent={reviewCounts.urgent}
        clinicalAuthority={clinicalAuthority}
      />
      <main
        id="main-content"
        className="min-w-0 flex-1 overflow-y-auto focus:outline-none"
        tabIndex={-1}
      >
        {children}
      </main>
    </div>
  );
}
