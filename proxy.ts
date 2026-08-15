import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import {
  getDefaultAppRouteForRole,
  isAuthorizedForRoute,
} from "@/lib/auth/permissions";

// Routes that are always public (no session required)
const PUBLIC_PATHS = new Set([
  "/login",
  // Static synthetic CapabilityStatement used only for bounded Phase 3B
  // connectivity QA. It contains no session, patient, or clinical data.
  "/api/integration-test/fhir/metadata",
]);
const PUBLIC_PREFIXES = ["/api/auth"];
const PASSWORD_MANAGEMENT_PATH = "/account/password";
const PASSWORD_MANAGEMENT_API_PREFIX = "/api/account/password";
const SECURITY_ENROLMENT_PATH = "/account/security";
const SECURITY_ENROLMENT_API_PREFIX = "/api/account/2fa";

type SecuritySessionUser = {
  requiresPasswordChange?: boolean;
  requiresTwoFactorSetup?: boolean;
  authAssurance?: string | null;
  sessionInvalid?: boolean;
  sessionInvalidReason?: string | null;
  role?: string;
};

function isEnrolmentPath(pathname: string) {
  return (
    pathname.startsWith(PASSWORD_MANAGEMENT_PATH) ||
    pathname.startsWith(SECURITY_ENROLMENT_PATH)
  );
}

function isEnrolmentApi(pathname: string) {
  return (
    pathname.startsWith(PASSWORD_MANAGEMENT_API_PREFIX) ||
    pathname.startsWith(SECURITY_ENROLMENT_API_PREFIX) ||
    pathname.startsWith("/api/account/logout") ||
    pathname.startsWith("/api/account/sessions/revoke")
  );
}

function isPublic(pathname: string): boolean {
  // Public marketing landing — exact match only (every path startsWith "/").
  if (pathname === "/") return true;
  for (const p of PUBLIC_PATHS) {
    if (pathname === p) return true;
  }
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Allow public routes unconditionally
  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  // Development-only design harness. It renders design-system components with
  // synthetic data so layout can be reviewed without a database or a session.
  // Never reachable in a production build: this branch is compiled against
  // NODE_ENV, and the route itself calls notFound() outside development.
  if (
    process.env.NODE_ENV === "development" &&
    pathname.startsWith("/design-preview")
  ) {
    return NextResponse.next();
  }

  // API routes: require session, role check is handled inside the route handler
  if (pathname.startsWith("/api/")) {
    if (!req.auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const securityUser = req.auth.user as SecuritySessionUser | undefined;
    if (securityUser?.sessionInvalid) {
      return NextResponse.json(
        { error: "Session expired or revoked. Sign in again." },
        { status: 401 }
      );
    }

    const passwordChangeRequired = Boolean(securityUser?.requiresPasswordChange);
    if (
      passwordChangeRequired &&
      !pathname.startsWith(PASSWORD_MANAGEMENT_API_PREFIX)
    ) {
      return NextResponse.json(
        {
          error:
            "Password update required before this action can be used.",
        },
        { status: 423 }
      );
    }

    if (
      (securityUser?.requiresTwoFactorSetup ||
        securityUser?.authAssurance === "PASSWORD_ENROLLMENT") &&
      !isEnrolmentApi(pathname)
    ) {
      return NextResponse.json(
        { error: "Authenticator enrolment is required before accessing pilot data." },
        { status: 423 }
      );
    }

    return NextResponse.next();
  }

  // App routes: require session
  if (!req.auth) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", req.url);
    return NextResponse.redirect(loginUrl);
  }

  const securityUser = req.auth.user as SecuritySessionUser | undefined;
  if (securityUser?.sessionInvalid) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("reauth", "1");
    return NextResponse.redirect(loginUrl);
  }

  const passwordChangeRequired = Boolean(securityUser?.requiresPasswordChange);
  if (
    passwordChangeRequired &&
    !pathname.startsWith(PASSWORD_MANAGEMENT_PATH)
  ) {
    const passwordUrl = new URL(PASSWORD_MANAGEMENT_PATH, req.url);
    passwordUrl.searchParams.set("reason", "password-update-required");
    return NextResponse.redirect(passwordUrl);
  }

  if (
    (securityUser?.requiresTwoFactorSetup ||
      securityUser?.authAssurance === "PASSWORD_ENROLLMENT") &&
    !isEnrolmentPath(pathname)
  ) {
    const securityUrl = new URL(SECURITY_ENROLMENT_PATH, req.url);
    securityUrl.searchParams.set("reason", "authenticator-enrolment-required");
    return NextResponse.redirect(securityUrl);
  }

  const role = securityUser?.role;

  // RBAC: check route-level role requirements
  if (!isAuthorizedForRoute(pathname, role)) {
    const fallbackUrl = new URL(getDefaultAppRouteForRole(role), req.url);
    fallbackUrl.searchParams.set("error", "unauthorized");
    return NextResponse.redirect(fallbackUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, sitemap.xml, robots.txt
     * - Public assets in /public
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
