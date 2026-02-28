"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard",  label: "Dashboard",       icon: "◈", roles: ["GP", "COORDINATOR", "ADMIN"] },
  { href: "/patients",   label: "Patients",         icon: "♦", roles: ["GP", "COORDINATOR", "ADMIN"] },
  { href: "/pathway",    label: "Pathway Wizard",   icon: "◎", roles: ["GP", "COORDINATOR", "ADMIN"] },
  { href: "/gp",         label: "Enter Results",    icon: "✦", roles: ["GP", "COORDINATOR", "ADMIN"] },
  { href: "/coordinator",label: "Referral Queue",   icon: "◉", roles: ["COORDINATOR", "ADMIN"] },
  { href: "/admin",      label: "Admin",            icon: "⬡", roles: ["ADMIN"] },
  { href: "/audit",      label: "Audit Log",        icon: "▣", roles: ["ADMIN"] },
];

interface SidebarProps {
  userRole?: string;
  userName?: string;
}

export function Sidebar({ userRole, userName }: SidebarProps) {
  const pathname = usePathname();

  const visibleItems = navItems.filter(
    (item) => !userRole || item.roles.includes(userRole)
  );

  return (
    <aside className="w-64 bg-[#1E3A5F] min-h-screen flex flex-col">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#0D9488] rounded-lg flex items-center justify-center">
            <span className="text-white text-sm font-bold">CS</span>
          </div>
          <div>
            <p className="text-white font-semibold text-sm">Cervical Screening</p>
            <p className="text-blue-300 text-xs">Clinical Decision System</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1" aria-label="Main navigation">
        {visibleItems.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-[#0D9488] text-white"
                  : "text-blue-200 hover:bg-white/10 hover:text-white"
              )}
              aria-current={active ? "page" : undefined}
            >
              <span className="text-base" aria-hidden="true">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User info */}
      <div className="px-4 py-4 border-t border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#0D9488] flex items-center justify-center">
            <span className="text-white text-xs font-semibold">
              {userName?.charAt(0).toUpperCase() ?? "U"}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">{userName ?? "User"}</p>
            <p className="text-blue-300 text-xs">{userRole ?? "Unknown role"}</p>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="mt-3 w-full text-left text-xs text-blue-300 hover:text-white transition-colors"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
