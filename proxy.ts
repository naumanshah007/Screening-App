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

    const passwordChangeRequired = Boolean(
      (req.auth.user as { requiresPasswordChange?: boolean } | undefined)
        ?.requiresPasswordChange
    );
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

    return NextResponse.next();
  }

  // App routes: require session
  if (!req.auth) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", req.url);
    return NextResponse.redirect(loginUrl);
  }

  const passwordChangeRequired = Boolean(
    (req.auth.user as { requiresPasswordChange?: boolean } | undefined)
      ?.requiresPasswordChange
  );
  if (
    passwordChangeRequired &&
    !pathname.startsWith(PASSWORD_MANAGEMENT_PATH)
  ) {
    const passwordUrl = new URL(PASSWORD_MANAGEMENT_PATH, req.url);
    passwordUrl.searchParams.set("reason", "password-update-required");
    return NextResponse.redirect(passwordUrl);
  }

  const role = (req.auth.user as { role?: string } | undefined)?.role;

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
