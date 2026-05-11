import { auth } from "@/lib/auth";
import { Sidebar } from "@/components/layout/Sidebar";
import { isFeatureEnabled } from "@/lib/features";
import { redirect } from "next/navigation";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");
  const user = session.user as { name?: string; role?: string; email?: string };
  const showCases = isFeatureEnabled("casesV2");

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      <Sidebar
        userRole={user.role}
        userName={user.name}
        userEmail={user.email}
        showCases={showCases}
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
