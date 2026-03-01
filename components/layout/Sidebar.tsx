"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Users, GitBranch, ClipboardList,
  BarChart3, FileText, LogOut, Activity
} from "lucide-react";

const navSections = [
  {
    label: "Core",
    items: [
      { href: "/dashboard",   label: "Dashboard",     icon: LayoutDashboard, roles: ["GP","COORDINATOR","ADMIN"] },
      { href: "/patients",    label: "Patients",       icon: Users,           roles: ["GP","COORDINATOR","ADMIN"] },
      { href: "/pathway",     label: "Pathway Wizard", icon: GitBranch,       roles: ["GP","COORDINATOR","ADMIN"] },
    ]
  },
  {
    label: "Workflow",
    items: [
      { href: "/coordinator", label: "Referral Queue", icon: ClipboardList,   roles: ["COORDINATOR","ADMIN"] },
      { href: "/gp",          label: "GP Portal",      icon: Activity,        roles: ["GP","COORDINATOR","ADMIN"] },
    ]
  },
  {
    label: "Admin",
    items: [
      { href: "/admin",       label: "Analytics",      icon: BarChart3,       roles: ["ADMIN"] },
      { href: "/audit",       label: "Audit Log",      icon: FileText,        roles: ["ADMIN"] },
    ]
  }
];

interface SidebarProps {
  userRole?: string;
  userName?: string;
  userEmail?: string;
}

export function Sidebar({ userRole, userName, userEmail }: SidebarProps) {
  const pathname = usePathname();
  const initials = (userName ?? "U").split(" ").map(n => n[0]).join("").slice(0,2).toUpperCase();

  return (
    <aside className="w-60 bg-navy-800 min-h-screen flex flex-col flex-shrink-0 select-none">
      {/* Logo */}
      <div className="px-5 py-5 flex items-center gap-3 border-b border-white/[0.08]">
        <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <span className="text-white text-xs font-bold tracking-tight">CS</span>
        </div>
        <div className="min-w-0">
          <p className="text-white font-semibold text-sm truncate leading-tight">CervicalScreen</p>
          <p className="text-white/40 text-[10px] uppercase tracking-widest truncate">NZ Guidelines</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto" aria-label="Main navigation">
        {navSections.map(section => {
          const visible = section.items.filter(i => !userRole || i.roles.includes(userRole));
          if (!visible.length) return null;
          return (
            <div key={section.label}>
              <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/30">
                {section.label}
              </p>
              <div className="space-y-0.5">
                {visible.map(item => {
                  const active = pathname === item.href || pathname.startsWith(item.href + "/");
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                        active
                          ? "bg-brand-600 text-white shadow-sm"
                          : "text-white/60 hover:bg-white/[0.08] hover:text-white"
                      )}
                    >
                      <Icon className="h-4 w-4 flex-shrink-0" strokeWidth={active ? 2.5 : 2} />
                      <span className="truncate">{item.label}</span>
                      {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white/60 flex-shrink-0" aria-hidden />}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* User section */}
      <div className="px-3 py-3 border-t border-white/[0.08] flex-shrink-0">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors">
          <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-semibold">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate leading-tight">{userName ?? "User"}</p>
            <p className="text-white/40 text-xs truncate">{userRole ?? ""}</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="p-1.5 rounded-md text-white/30 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
