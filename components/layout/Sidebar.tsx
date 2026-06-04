"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard, ClipboardList, Users, GitBranch, BookOpen,
  BarChart2, Activity, Shield, Settings, UserCog, FileSearch,
  Stethoscope, HeartPulse, LogOut, ChevronLeft, ChevronRight,
  Menu, X, Database,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getDefaultAppRouteForRole, isAuthorizedForRoute } from "@/lib/auth/permissions";
import { getWorkspaceContext } from "@/lib/workspace/context";
import { ThemeToggle } from "./ThemeToggle";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

type NavLink = { href: string; label: string; icon: React.ElementType };
type NavSection = { id: string; label: string; links: NavLink[] };

const ICONS: Record<string, React.ElementType> = {
  "/dashboard":  LayoutDashboard,
  "/cases":      ClipboardList,
  "/coordinator": Users,
  "/analytics":  BarChart2,
  "/readiness":  Activity,
  "/guidelines": BookOpen,
  "/rules":      GitBranch,
  "/patients":   Users,
  "/pathway":    HeartPulse,
  "/gp":         Stethoscope,
  "/admin":      Settings,
  "/audit":      FileSearch,
  "/batch":      Database,
};

function getIcon(href: string): React.ElementType {
  return ICONS[href] ?? LayoutDashboard;
}

function buildSidebarSections(args: { userRole?: string; showCases: boolean; showBatch: boolean }): NavSection[] {
  const { userRole, showCases, showBatch } = args;

  function link(href: string, label: string): NavLink {
    return { href, label, icon: getIcon(href) };
  }

  const dash = isAuthorizedForRoute("/dashboard", userRole) ? [link("/dashboard", "Dashboard")] : [];
  const cases = showCases && isAuthorizedForRoute("/cases", userRole) ? [link("/cases", "Cases")] : [];
  const rules = showCases && isAuthorizedForRoute("/rules", userRole) ? [link("/rules", "Rules")] : [];
  const analytics = isAuthorizedForRoute("/analytics", userRole) ? [link("/analytics", "Analytics")] : [];
  const readiness = isAuthorizedForRoute("/readiness", userRole) ? [link("/readiness", "Readiness")] : [];
  const audit = isAuthorizedForRoute("/audit", userRole) ? [link("/audit", "Audit")] : [];
  const coordinator = isAuthorizedForRoute("/coordinator", userRole) ? [link("/coordinator", "Coordinator")] : [];
  const admin = isAuthorizedForRoute("/admin", userRole) ? [link("/admin", "Admin")] : [];
  // Batch Processing is the primary product feature — shown first when enabled
  const batch = showBatch ? [link("/batch", "Batch Processing")] : [];

  switch (userRole) {
    case "ADMIN":
      return [
        ...(batch.length > 0 ? [{ id: "pipeline", label: "Decision Support", links: batch }] : []),
        { id: "workspace", label: "Workspace", links: [...dash, ...cases, ...coordinator, ...analytics, ...readiness] },
        { id: "governance", label: "Governance", links: [...rules, link("/guidelines", "Guidelines")] },
        // Manual pathway is secondary to batch
        { id: "manual", label: "Manual Tools", links: [link("/patients", "Patients"), link("/pathway", "Pathway"), link("/gp", "GP")] },
        { id: "admin", label: "Administration", links: [...admin, ...audit] },
      ];
    case "COORDINATOR":
      return [
        ...(batch.length > 0 ? [{ id: "pipeline", label: "Decision Support", links: batch }] : []),
        { id: "workspace", label: "Workspace", links: [...dash, ...cases, ...coordinator, ...analytics, ...readiness] },
        { id: "reference", label: "Reference", links: [link("/guidelines", "Guidelines"), link("/patients", "Patients")] },
      ];
    case "COLPO_CNS":
    case "COLPOSCOPIST":
      return [
        ...(batch.length > 0 ? [{ id: "pipeline", label: "Decision Support", links: batch }] : []),
        { id: "workspace", label: "Workspace", links: [...dash, ...cases, ...coordinator, ...analytics, ...readiness] },
        { id: "governance", label: "Governance", links: [...rules, link("/guidelines", "Guidelines")] },
        { id: "manual", label: "Manual Tools", links: [link("/patients", "Patients"), link("/pathway", "Pathway")] },
      ];
    case "GYNAE_GRADER":
    case "SMO_REVIEWER":
      return [
        ...(batch.length > 0 ? [{ id: "pipeline", label: "Decision Support", links: batch }] : []),
        { id: "workspace", label: "Workspace", links: [...dash, ...cases, ...coordinator, ...analytics, ...readiness] },
        { id: "governance", label: "Governance", links: [...rules, link("/guidelines", "Guidelines")] },
        { id: "manual", label: "Manual Tools", links: [link("/patients", "Patients")] },
      ];
    case "GP":
      return [
        { id: "workspace", label: "Workspace", links: dash },
        { id: "clinical", label: "Clinical Tools", links: [link("/gp", "GP Referral"), link("/guidelines", "Guidelines"), link("/pathway", "Pathway")] },
      ];
    case "INTEGRATION_ADMIN":
      return [
        ...(batch.length > 0 ? [{ id: "pipeline", label: "Decision Support", links: batch }] : []),
        { id: "operations", label: "Operations", links: [...readiness, ...analytics, ...audit, ...admin] },
      ];
    default:
      return [
        ...(batch.length > 0 ? [{ id: "pipeline", label: "Decision Support", links: batch }] : []),
        { id: "workspace", label: "Workspace", links: [...dash, ...cases, ...analytics] },
        { id: "reference", label: "Reference", links: [link("/guidelines", "Guidelines")] },
      ];
  }
}

function NavItem({ link, active, collapsed, primary }: {
  link: NavLink;
  active: boolean;
  collapsed: boolean;
  primary?: boolean;
}) {
  const Icon = link.icon;
  return (
    <li>
      <Link
        href={link.href}
        title={collapsed ? link.label : undefined}
        className={cn(
          "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          active
            ? "bg-gradient-to-r from-brand-50 to-brand-50/20 text-brand-700 dark:from-brand-900/40 dark:to-brand-900/5 dark:text-brand-300"
            : primary
              ? "text-brand-700 dark:text-brand-300 bg-brand-50/50 dark:bg-brand-950/30 hover:bg-brand-100/60 dark:hover:bg-brand-900/40"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          collapsed && "justify-center px-2"
        )}
      >
        {/* Active left accent bar */}
        {active && !collapsed && (
          <span
            className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-gradient-to-b from-teal-400 to-cyan-600"
            aria-hidden
          />
        )}
        <Icon
          className={cn(
            "h-4 w-4 flex-shrink-0 transition-transform duration-200",
            active ? "text-brand-600" : "group-hover:scale-110"
          )}
          strokeWidth={active ? 2.5 : 1.75}
          aria-hidden
        />
        {!collapsed && <span className="truncate">{link.label}</span>}
      </Link>
    </li>
  );
}

export function Sidebar({
  userRole,
  userName,
  userEmail,
  showCases = false,
  showBatch = false,
}: {
  userRole?: string;
  userName?: string;
  userEmail?: string;
  showCases?: boolean;
  showBatch?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const sections = buildSidebarSections({ userRole, showCases, showBatch })
    .map((s) => ({ ...s, links: s.links.filter((l, i, arr) => arr.findIndex((x) => x.href === l.href) === i) }))
    .filter((s) => s.links.length > 0);

  const homeHref = getDefaultAppRouteForRole(userRole);
  const initials = userName
    ? userName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "CG";

  async function handleSignOut() {
    setSigningOut(true);
    await signOut({ callbackUrl: "/login", redirect: false });
    router.replace("/login");
    router.refresh();
  }

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className={cn("flex items-center gap-2.5 px-4 py-4 border-b border-border", collapsed && "justify-center px-2")}>
        <Link href={homeHref} className="flex items-center gap-2.5 min-w-0">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-sm ring-1 ring-white/15">
            CG
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="font-semibold text-foreground text-sm leading-tight truncate">CerviGrade</div>
              <div className="text-[10px] text-muted-foreground leading-tight truncate">Cervical Referral Grading Tool</div>
            </div>
          )}
        </Link>
        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            className="ml-auto p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex-shrink-0 hidden xl:flex"
            aria-label="Collapse sidebar"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3" aria-label="Main navigation">
        <div className={cn("space-y-4 px-2")}>
          {sections.map((section) => (
            <div key={section.id}>
              {!collapsed && (
                <div className={cn(
                  "px-2 pb-1.5 text-label",
                  section.id === "pipeline"
                    ? "text-brand-600 dark:text-brand-400 font-semibold"
                    : "text-muted-foreground"
                )}>
                  {section.label}
                </div>
              )}
              <ul className="space-y-0.5" role="list">
                {section.links.map((link) => {
                  const active =
                    pathname === link.href ||
                    (link.href !== "/dashboard" && pathname.startsWith(link.href + "/"));
                  return (
                    <NavItem
                      key={link.href}
                      link={link}
                      active={active}
                      collapsed={collapsed}
                      primary={section.id === "pipeline"}
                    />
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </nav>

      {/* Bottom user section */}
      <div className="border-t border-border p-2 space-y-1">
        <div className={cn("flex items-center gap-2 px-2 py-2", collapsed && "justify-center")}>
          <div className="h-7 w-7 rounded-full bg-gradient-to-br from-navy-600 to-navy-800 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 ring-1 ring-white/10">
            {initials}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-foreground truncate">{userName ?? "User"}</div>
              <div className="text-xs text-muted-foreground truncate">{userRole ?? "User"}</div>
            </div>
          )}
          {!collapsed && <ThemeToggle />}
        </div>
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className={cn(
            "flex items-center gap-2 w-full rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            "text-muted-foreground hover:bg-muted hover:text-foreground",
            "disabled:opacity-50",
            collapsed && "justify-center px-2"
          )}
          title={collapsed ? "Sign out" : undefined}
        >
          <LogOut className="h-4 w-4 flex-shrink-0" aria-hidden />
          {!collapsed && <span>{signingOut ? "Signing out…" : "Sign out"}</span>}
        </button>
        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            className="flex items-center justify-center w-full p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Expand sidebar"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Mobile toggle button */}
      <button
        className="fixed top-3 left-3 z-50 xl:hidden flex items-center justify-center h-9 w-9 rounded-lg bg-card border border-border shadow-md text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 xl:hidden" aria-modal="true">
          <div
            className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <aside className="absolute left-0 top-0 h-full w-72 bg-card border-r border-border flex flex-col shadow-overlay">
            <button
              className="absolute top-3 right-3 p-1.5 rounded-lg text-muted-foreground hover:bg-muted"
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation"
            >
              <X className="h-5 w-5" />
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden xl:flex flex-col bg-card border-r border-border transition-all duration-200 flex-shrink-0",
          collapsed ? "w-[60px]" : "w-64"
        )}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
