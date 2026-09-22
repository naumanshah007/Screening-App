import { getServerSession } from "@/lib/auth/server-session";
import { Sidebar } from "@/components/layout/Sidebar";
import { isFeatureEnabled } from "@/lib/features";
import { getClinicalAuthorityDisplay } from "@/lib/clinical-rules/authority-display";
import { redirect } from "next/navigation";
import { evaluateRuntimeBoundary } from "@/lib/config/runtime-boundary";
import { isEvaluationAccount } from "@/lib/auth/evaluation-mode";

// The clinical authority indicator must never be served from a build-time
// render: it reports which engine is authoritative right now, and a stale
// value here would misstate that on every page.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();
  if (!session) redirect("/login");
  const user = session.user as { name?: string; role?: string; email?: string };
  const showCases = isFeatureEnabled("casesV2");
  const showBatch = isFeatureEnabled("batchDemo");
  // Resolved here because the allowlist is server configuration; the sidebar
  // is a client component and must be told, not left to work it out.
  const evaluationMode = isEvaluationAccount(user);

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

  // The evaluator is told what they are looking at, on every page. A
  // controlled evaluation of synthetic cases should never be mistaken for a
  // system operating on real patients.
  const bannerMessage = evaluationMode
    ? "Controlled clinical evaluation · synthetic cases supplied for review · not for clinical action"
    : runtimeMessage;

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      <Sidebar
        userRole={user.role}
        userName={user.name}
        userEmail={user.email}
        showCases={showCases}
        showBatch={showBatch}
        clinicalAuthority={clinicalAuthority}
        evaluationMode={evaluationMode}
      />
      <main
        id="main-content"
        className="min-w-0 flex-1 overflow-y-auto focus:outline-none"
        tabIndex={-1}
      >
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs font-medium text-amber-950">
          {bannerMessage}
        </div>
        {children}
      </main>
    </div>
  );
}
