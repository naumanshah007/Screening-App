"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard, ClipboardList, Users, GitBranch, BookOpen,
  BarChart2, Activity, Settings, FileSearch,
  Stethoscope, HeartPulse, LogOut, ChevronLeft, ChevronRight, ChevronDown,
  Menu, X, Database, ClipboardCheck, Inbox, FileCheck2,
  ShieldCheck, Cable,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getDefaultAppRouteForRole, isAuthorizedForRoute, isVisibleInDemoFlow } from "@/lib/auth/permissions";
import { ThemeToggle } from "./ThemeToggle";
import { ActiveClinicalAuthorityIndicator } from "@/components/clinical-rules/ClinicalAuthorityBadge";
import type { ClinicalAuthorityDisplay } from "@/lib/clinical-rules/authority-display";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

type NavBadge = { count: number; urgent: boolean };
type NavLink = { href: string; label: string; icon: React.ElementType; badge?: NavBadge };
type NavSection = { id: string; label: string; links: NavLink[]; collapsible?: boolean };

const ICONS: Record<string, React.ElementType> = {
  "/dashboard":  LayoutDashboard,
  "/cases":      ClipboardList,
  "/coordinator": Users,
  "/analytics":  BarChart2,
  "/admin/usage": Activity,
  "/admin/integrations": Cable,
  "/readiness":  Activity,
  "/guidelines": BookOpen,
  "/rules":      GitBranch,
  "/patients":   Users,
  "/pathway":    HeartPulse,
  "/gp":         Stethoscope,
  "/admin":      Settings,
  "/audit":      FileSearch,
  "/batch":      Database,
  "/batch/runs": ClipboardCheck,
  "/review":     Inbox,
  "/decisions":  FileCheck2,
  "/governance/clinical": ShieldCheck,
};

function getIcon(href: string): React.ElementType {
  return ICONS[href] ?? LayoutDashboard;
}

function buildSidebarSections(args: {
  userRole?: string;
  showCases: boolean;
  showBatch: boolean;
  reviewPending: number;
  reviewUrgent: number;
}): NavSection[] {
  const { userRole, showCases, showBatch, reviewPending, reviewUrgent } = args;

  function link(href: string, label: string): NavLink {
    const badge: NavBadge | undefined =
      href === "/review" && reviewPending > 0
        ? { count: reviewPending, urgent: reviewUrgent > 0 }
        : undefined;
    return { href, label, icon: getIcon(href), badge };
  }
  function authed(href: string, label: string): NavLink[] {
    return isAuthorizedForRoute(href, userRole) ? [link(href, label)] : [];
  }

  // GP keeps a simple referrer-focused layout, plus the clinical reference.
  if (userRole === "GP") {
    return [
      {
        id: "triage",
        label: "Workspace",
        links: [link("/dashboard", "Command Centre"), link("/guidelines", "Guidelines")],
      },
    ];
  }

  const isAdmin = userRole === "ADMIN";
  const isIntegrationAdmin = userRole === "INTEGRATION_ADMIN";
  const canPullCases = showBatch && isVisibleInDemoFlow("/batch", userRole);
  const canUseReviewQueue = showBatch && isVisibleInDemoFlow("/review", userRole);

  // ── Workspace: the daily clinical spine ───────────────────────────────────
  //
  // Guidelines belongs here, not under Configuration: it is clinical reference
  // material a reviewer consults while working, not a setting they administer.
  const workspace = [
    ...authed("/dashboard", "Command Centre"),
    ...(canPullCases ? authed("/batch", "Pull Cases") : []),
    ...(canUseReviewQueue ? authed("/review", "Review Queue") : []),
    ...authed("/decisions", "Completed Decisions"),
    link("/guidelines", "Guidelines"),
  ];

  // ── Insights: monitoring and audit ────────────────────────────────────────
  //
  // Visibility follows the existing route guards rather than a role list of its
  // own, so hiding an item never grants access and never hides one a role is
  // genuinely entitled to.
  const insights = [
    ...authed("/analytics", "Analytics"),
    ...authed("/admin/usage", "Usage & Activity"),
    ...authed("/audit", "Audit Trail"),
  ];

  // ── Administration: who can use the product, and clinical governance ──────
  const administration = [
    // Points at /admin/users, the focused account-management surface, rather
    // than /admin, which is a mixed operations page (NCSR, security incidents,
    // integration validation). Two user-management surfaces existed; this makes
    // the one with enable/disable and demo-password controls the entry point.
    //
    // Gated on the "/admin/users" guard, not "/admin": account administration
    // is ADMIN-only, so reading the broader guard offered INTEGRATION_ADMIN a
    // link that bounced them straight back to /dashboard.
    ...authed("/admin/users", "Users & Access"),
    ...authed("/governance/clinical", "Governance"),
  ];

  // ── Advanced: technical and service-configuration tools ───────────────────
  //
  // Collapsed by default and never part of the normal clinical workflow. These
  // remain fully functional — relocated and renamed rather than removed.
  const advanced = [
    ...(isAdmin || isIntegrationAdmin ? authed("/admin/integrations", "Integration Centre") : []),
    ...((isAdmin || isIntegrationAdmin) && showCases
      ? authed("/rules", "Local Referral & Booking Rules")
      : []),
    ...(isAdmin || isIntegrationAdmin ? authed("/rules/clinical", "Rule Studio") : []),
    ...(isAdmin || isIntegrationAdmin ? authed("/readiness", "Deployment Readiness") : []),
    // /admin keeps security incidents, integration validation and NCSR
    // certification — genuinely separate from account management, which now
    // lives only at /admin/users. Without this entry that content would be
    // unreachable from the sidebar.
    ...(isAdmin || isIntegrationAdmin ? authed("/admin", "System Operations") : []),
    ...(isAdmin
      ? [
          ...(showBatch ? authed("/batch/runs", "Intake Sessions") : []),
          ...(showCases ? authed("/cases", "Manual Cases") : []),
          link("/patients", "Patient Registry"),
          link("/pathway", "Pathway Wizard"),
          link("/gp", "GP Referral"),
          link("/coordinator", "Referral Queue"),
        ]
      : []),
  ];

  return [
    ...(workspace.length ? [{ id: "triage", label: "Workspace", links: workspace }] : []),
    ...(insights.length ? [{ id: "insights", label: "Insights", links: insights }] : []),
    ...(administration.length
      ? [{ id: "administration", label: "Administration", links: administration }]
      : []),
    ...(advanced.length
      ? [{ id: "advanced", label: "Advanced", links: advanced, collapsible: true }]
      : []),
  ];
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
        {link.badge && (
          collapsed ? (
            <span
              className={cn(
                "absolute top-1 right-1 h-2 w-2 rounded-full ring-2 ring-card",
                link.badge.urgent ? "bg-amber-500" : "bg-brand-500"
              )}
              aria-hidden
            />
          ) : (
            <span
              className={cn(
                "ml-auto inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold leading-none",
                link.badge.urgent
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                  : "bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300"
              )}
              aria-label={`${link.badge.count} awaiting review`}
            >
              {link.badge.count > 99 ? "99+" : link.badge.count}
            </span>
          )
        )}
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
  reviewPending = 0,
  reviewUrgent = 0,
  clinicalAuthority,
}: {
  userRole?: string;
  userName?: string;
  userEmail?: string;
  showCases?: boolean;
  showBatch?: boolean;
  reviewPending?: number;
  reviewUrgent?: number;
  /** Which engine is clinically authoritative, shown persistently. */
  clinicalAuthority?: ClinicalAuthorityDisplay;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const sections = buildSidebarSections({ userRole, showCases, showBatch, reviewPending, reviewUrgent })
    .map((s) => ({ ...s, links: s.links.filter((l, i, arr) => arr.findIndex((x) => x.href === l.href) === i) }))
    .filter((s) => s.links.length > 0);

  // Highlight only the most-specific matching link (so /batch doesn't also light
  // up when viewing /batch/runs).
  const activeHref = sections
    .flatMap((s) => s.links.map((l) => l.href))
    .filter((h) => pathname === h || (h !== "/dashboard" && pathname.startsWith(h + "/")))
    .sort((a, b) => b.length - a.length)[0];

  const homeHref = getDefaultAppRouteForRole(userRole);
  const initials = userName
    ? userName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "CG";

  async function handleSignOut() {
    setSigningOut(true);
    await fetch("/api/account/logout", { method: "POST" }).catch(() => null);
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
          {sections.map((section) => {
            const sectionHasActive = section.links.some((l) => l.href === activeHref);
            // Collapsible groups (Advanced) hide their links until toggled — but
            // auto-open when the current page is one of them, and always show when
            // the whole sidebar is icon-collapsed (no label row to toggle).
            const open = !section.collapsible || collapsed || advancedOpen || sectionHasActive;
            return (
              <div key={section.id}>
                {!collapsed && (
                  section.collapsible ? (
                    <button
                      type="button"
                      onClick={() => setAdvancedOpen((o) => !o)}
                      aria-expanded={open}
                      className="flex w-full items-center gap-1 px-2 pb-1.5 text-label text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ChevronDown
                        className={cn("h-3 w-3 transition-transform duration-200", !open && "-rotate-90")}
                        aria-hidden
                      />
                      {section.label}
                    </button>
                  ) : (
                    <div className={cn(
                      "px-2 pb-1.5 text-label",
                      section.id === "triage"
                        ? "text-brand-600 dark:text-brand-400 font-semibold"
                        : "text-muted-foreground"
                    )}>
                      {section.label}
                    </div>
                  )
                )}
                {open && (
                  <ul className="space-y-0.5" role="list">
                    {section.links.map((link) => (
                      <NavItem
                        key={link.href}
                        link={link}
                        active={link.href === activeHref}
                        collapsed={collapsed}
                        primary={section.id === "triage"}
                      />
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </nav>

      {/* Clinical authority — persistent, so a reviewer can always tell which
          engine decided what they are looking at. */}
      {!collapsed && clinicalAuthority && (
        <div className="border-t border-border px-4 py-3">
          <ActiveClinicalAuthorityIndicator
            authorityEngine={clinicalAuthority.authorityEngine}
            ruleSetVersion={clinicalAuthority.canonicalVersion}
            canonicalStatus={clinicalAuthority.canonicalStatus}
          />
        </div>
      )}

      {/* Bottom user section */}
      <div className="border-t border-border p-2 space-y-1">
        <div className={cn("flex items-center gap-2 px-2 py-2", collapsed && "justify-center")}>
          <div className="h-7 w-7 rounded-full bg-gradient-to-br from-navy-600 to-navy-800 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 ring-1 ring-white/10">
            {initials}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-foreground truncate">{userName ?? "User"}</div>
              <div className="text-xs text-muted-foreground truncate">{userEmail ?? userRole ?? "User"}</div>
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
