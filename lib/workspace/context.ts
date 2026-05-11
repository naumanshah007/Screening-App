export type WorkspaceShortcut = {
  href: string;
  label: string;
};

export type WorkspaceContext = {
  label: string;
  description: string;
  shortcuts: WorkspaceShortcut[];
};

function withSecurityShortcut(shortcuts: WorkspaceShortcut[]): WorkspaceShortcut[] {
  return [...shortcuts, { href: "/account/security", label: "Account security" }];
}

export function getWorkspaceContext(
  role?: string,
  showCases = false
): WorkspaceContext {
  switch (role) {
    case "ADMIN":
      return {
        label: "Enterprise workspace",
        description:
          "Oversee live service flow, clinical governance, and platform readiness across both services.",
        shortcuts: withSecurityShortcut([
          ...(showCases ? [{ href: "/cases", label: "Open cases" }] : []),
          { href: "/readiness", label: "Readiness" },
          { href: "/analytics", label: "View analytics" },
          { href: "/admin", label: "Open admin" },
        ]),
      };
    case "COORDINATOR":
      return {
        label: "Coordinator workspace",
        description:
          "Keep referrals moving by clearing pending review, resolving blockers, and managing queue flow.",
        shortcuts: withSecurityShortcut(showCases
          ? [
              { href: "/cases?workflow=PENDING_REVIEW", label: "Pending review" },
              { href: "/cases?workflow=NEEDS_MORE_INFO", label: "Resolve blockers" },
              { href: "/coordinator", label: "Coordinator queue" },
              { href: "/readiness", label: "Readiness" },
            ]
          : [{ href: "/coordinator", label: "Coordinator queue" }]),
      };
    case "COLPO_CNS":
      return {
        label: "Colposcopy triage workspace",
        description:
          "Prepare colposcopy cases, close information gaps, and escalate senior-review work when required.",
        shortcuts: withSecurityShortcut(showCases
          ? [
              { href: "/cases?serviceLine=COLPOSCOPY&workflow=PENDING_REVIEW", label: "Colposcopy queue" },
              { href: "/cases?serviceLine=COLPOSCOPY&workflow=NEEDS_MORE_INFO", label: "Missing info" },
              { href: "/cases?serviceLine=COLPOSCOPY&smoOnly=true", label: "SMO cases" },
              { href: "/readiness", label: "Readiness" },
            ]
          : [{ href: "/guidelines", label: "Guidelines" }]),
      };
    case "COLPOSCOPIST":
      return {
        label: "Colposcopy review workspace",
        description:
          "Review colposcopy recommendations, non-standard outcomes, and final operational routes.",
        shortcuts: withSecurityShortcut(showCases
          ? [
              { href: "/cases?serviceLine=COLPOSCOPY&workflow=PENDING_REVIEW", label: "Pending review" },
              { href: "/cases?serviceLine=COLPOSCOPY&workflow=VIRTUAL_CLINIC", label: "Virtual clinic" },
              { href: "/cases?serviceLine=COLPOSCOPY&workflow=RETURN_TO_GP", label: "Return to GP" },
              { href: "/readiness", label: "Readiness" },
            ]
          : [{ href: "/guidelines", label: "Guidelines" }]),
      };
    case "GYNAE_GRADER":
      return {
        label: "Gynaecology grading workspace",
        description:
          "Review one-page summaries, grade gynaecology referrals, and clear missing-information cases.",
        shortcuts: withSecurityShortcut(showCases
          ? [
              { href: "/cases?serviceLine=GYNAECOLOGY&workflow=PENDING_REVIEW", label: "Gynae queue" },
              { href: "/cases?serviceLine=GYNAECOLOGY&workflow=NEEDS_MORE_INFO", label: "Missing info" },
              { href: "/cases?serviceLine=GYNAECOLOGY&workflow=VIRTUAL_CLINIC", label: "Virtual clinic" },
              { href: "/readiness", label: "Readiness" },
            ]
          : [{ href: "/guidelines", label: "Guidelines" }]),
      };
    case "SMO_REVIEWER":
      return {
        label: "Senior review workspace",
        description:
          "Clear SMO-only bottlenecks and provide senior decisions for escalated cases across both services.",
        shortcuts: withSecurityShortcut(showCases
          ? [
              { href: "/cases?smoOnly=true", label: "All SMO cases" },
              { href: "/cases?serviceLine=COLPOSCOPY&smoOnly=true", label: "Colpo SMO" },
              { href: "/cases?serviceLine=GYNAECOLOGY&smoOnly=true", label: "Gynae SMO" },
              { href: "/readiness", label: "Readiness" },
            ]
          : [{ href: "/analytics", label: "Analytics" }]),
      };
    case "GP":
      return {
        label: "GP workspace",
        description:
          "Enter or review screening information, consult guidance, and use the pathway tools when needed.",
        shortcuts: withSecurityShortcut([
          { href: "/gp", label: "GP entry" },
          { href: "/guidelines", label: "Guidelines" },
          { href: "/pathway", label: "Pathway" },
        ]),
      };
    case "INTEGRATION_ADMIN":
      return {
        label: "Integration workspace",
        description:
          "Monitor runtime readiness, analytics, and enterprise integration controls.",
        shortcuts: withSecurityShortcut([
          { href: "/readiness", label: "Readiness" },
          { href: "/admin", label: "Admin" },
          { href: "/analytics", label: "Analytics" },
        ]),
      };
    default:
      return {
        label: "Clinical workspace",
        description:
          "Use the current role-specific workspace to move cases forward safely and keep the service queue understandable.",
        shortcuts: withSecurityShortcut([
          ...(showCases ? [{ href: "/cases", label: "Open cases" }] : []),
          { href: "/guidelines", label: "Guidelines" },
        ]),
      };
  }
}
