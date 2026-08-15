import { auth } from "@/lib/auth";
import { Sidebar } from "@/components/layout/Sidebar";
import { isFeatureEnabled } from "@/lib/features";
import { isAuthorizedForRoute } from "@/lib/auth/permissions";
import { getReviewQueueCounts } from "@/lib/batch/persistence";
import { getClinicalAuthorityDisplay } from "@/lib/clinical-rules/authority-display";
import { redirect } from "next/navigation";
import { evaluateRuntimeBoundary } from "@/lib/config/runtime-boundary";

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
  const runtimeBoundary = evaluateRuntimeBoundary();
  const runtimeMessage =
    runtimeBoundary.mode === "PILOT"
      ? "Controlled pilot boundary · human review required · no automatic clinical-system mutation"
      : runtimeBoundary.mode === "VALIDATION"
        ? "Validation mode · outputs are non-actionable · no downstream clinical mutation"
        : runtimeBoundary.mode === "DEMO"
          ? "Demonstration mode · synthetic data only · not for clinical action"
          : "Development mode · synthetic data only";

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
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs font-medium text-amber-950">
          {runtimeMessage}
        </div>
        {children}
      </main>
    </div>
  );
}
