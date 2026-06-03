import { auth } from "@/lib/auth";
import { LandingPage } from "@/components/marketing/LandingPage";

/**
 * Public marketing landing page at `/`.
 *
 * Previously this route redirected (logged-in → /dashboard, else → /login).
 * It now renders the public landing for everyone; logged-in users get a
 * "Go to dashboard" CTA instead of an automatic redirect.
 */
export default async function Home() {
  // The landing page is public and must render even if the session/DB lookup
  // hiccups — a marketing page should never 500 on a transient auth error.
  let authed = false;
  try {
    const session = await auth();
    authed = !!session;
  } catch {
    authed = false;
  }
  return <LandingPage authed={authed} />;
}
