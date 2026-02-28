import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const user = session.user as { name?: string; role?: string };

  return (
    <div className="flex min-h-screen">
      <Sidebar userRole={user.role} userName={user.name ?? undefined} />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
