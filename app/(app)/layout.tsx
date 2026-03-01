import { auth } from "@/lib/auth";
import { Sidebar } from "@/components/layout/Sidebar";
import { redirect } from "next/navigation";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");
  const user = session.user as { name?: string; role?: string; email?: string };

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <Sidebar userRole={user.role} userName={user.name} userEmail={user.email} />
      <main className="flex-1 overflow-y-auto focus:outline-none">
        {children}
      </main>
    </div>
  );
}
