import { auth } from "@/lib/auth";
import { Sidebar } from "@/components/layout/Sidebar";
import { isFeatureEnabled } from "@/lib/features";
import { isAuthorizedForRoute } from "@/lib/auth/permissions";
import { getReviewQueueCounts } from "@/lib/batch/persistence";
import { redirect } from "next/navigation";

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
      />
      <main
        id="main-content"
        className="flex-1 overflow-y-auto focus:outline-none"
        tabIndex={-1}
      >
        {children}
      </main>
    </div>
  );
}
