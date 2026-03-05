"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/patients", label: "Patients" },
  { href: "/pathway", label: "Pathway" },
  { href: "/gp", label: "GP" },
  { href: "/coordinator", label: "Coordinator" },
  { href: "/admin", label: "Admin" },
];

export function Sidebar({
  userRole,
  userName,
  userEmail,
}: {
  userRole?: string;
  userName?: string;
  userEmail?: string;
}) {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
      <div className="px-4 py-5 border-b border-slate-200">
        <div className="text-sm text-slate-500">{userRole ?? "User"}</div>
        <div className="font-semibold text-slate-900">{userName ?? "Signed in"}</div>
        <div className="text-xs text-slate-500 truncate">{userEmail}</div>
      </div>
      <nav className="flex-1 py-4">
        <ul className="space-y-1">
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={cn(
                    "block px-4 py-2 rounded-md text-sm font-medium",
                    active
                      ? "bg-emerald-50 text-emerald-700"
                      : "text-slate-700 hover:bg-slate-50"
                  )}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
