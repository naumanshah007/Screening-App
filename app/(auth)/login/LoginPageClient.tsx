"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Eye, EyeOff, ShieldCheck, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { PrivexaMark } from "@/components/marketing/PrivexaMark";
import {
  DemoLoginPanel,
  type DemoAccountOption,
} from "@/components/auth/DemoLoginPanel";

function getSafeCallbackDestination(callbackUrl: string | null): string | null {
  if (!callbackUrl || typeof window === "undefined") return null;

  try {
    const parsed = new URL(callbackUrl, window.location.origin);
    if (parsed.origin !== window.location.origin) return null;
    if (parsed.pathname === "/login" || parsed.pathname.startsWith("/api/")) {
      return null;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

async function getRoleDefaultDestination() {
  const response = await fetch("/api/app/default-route", {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) return "/dashboard";

  const payload = (await response.json().catch(() => null)) as {
    route?: unknown;
  } | null;
  return typeof payload?.route === "string" ? payload.route : "/dashboard";
}

export function LoginPageClient({
  passwordUpdated = false,
  reauthRequired = false,
  callbackUrl = null,
  demoAccounts = [],
}: {
  passwordUpdated?: boolean;
  reauthRequired?: boolean;
  callbackUrl?: string | null;
  demoAccounts?: readonly DemoAccountOption[];
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await signIn("credentials", {
        email: username,
        password,
        redirect: false,
      });
      if (result?.error) {
        setError("Incorrect username or password.");
      } else {
        const destination =
          getSafeCallbackDestination(callbackUrl) ??
          (await getRoleDefaultDestination());
        window.location.assign(destination);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Brand panel — premium midnight gateway (mirrors the public landing) */}
      <div className="privexa-landing font-body hidden lg:flex lg:w-[440px] xl:w-[520px] flex-col bg-midnight p-10 text-white relative overflow-hidden flex-shrink-0">
        <div className="aurora pointer-events-none absolute inset-0" aria-hidden />
        <div className="grid-overlay pointer-events-none absolute inset-0" aria-hidden />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" aria-hidden />
        <div className="relative z-10 flex-1 flex flex-col">
          <div className="flex items-center gap-3 mb-12">
            <PrivexaMark size={42} uid="login" />
            <div>
              <div className="font-semibold text-sm">CerviGrade</div>
              <div className="text-xs text-slate-300">Health NZ · Counties Manukau</div>
            </div>
          </div>
          <div className="flex-1 flex flex-col justify-center">
            <span className="glass-panel mb-5 inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-[13px] font-medium text-slate-200">
              <ShieldCheck className="h-3.5 w-3.5 text-cyan-300" aria-hidden />
              Secure clinical access
            </span>
            <h2 className="font-display text-[2.1rem] font-semibold leading-[1.1] tracking-tight mb-3">
              Cervical Referral<br />
              <span className="text-gradient-brand">Grading Tool</span>
            </h2>
            <p className="text-slate-300 text-sm leading-relaxed max-w-xs">
              Colposcopy, gynaecology, and cervical pathway support for authorised clinical staff.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <ShieldCheck className="h-4 w-4 flex-shrink-0" aria-hidden />
            Authorised personnel only · All access is audited
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center p-6 bg-bg">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <PrivexaMark size={38} uid="login-m" />
            <div>
              <div className="font-semibold text-sm text-foreground">CerviGrade</div>
              <div className="text-xs text-muted-foreground">Health NZ · Counties Manukau</div>
            </div>
          </div>

          <h1 className="text-h3 text-foreground mb-1">Sign in</h1>
          <p className="text-sm text-muted-foreground mb-6">Enter your credentials to access the platform.</p>

          {/* Banners */}
          {passwordUpdated && !error && (
            <Alert variant="success" className="mb-4">Password updated. Sign in with your new password to continue.</Alert>
          )}
          {reauthRequired && !error && !passwordUpdated && (
            <Alert variant="warning" className="mb-4">Your session timed out. Sign in again to continue.</Alert>
          )}
          {error && (
            <Alert variant="error" className="mb-4">{error}</Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <Input
              label="Username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              placeholder="Enter your username"
              autoCapitalize="none"
              spellCheck={false}
              icon={<Lock className="h-4 w-4" />}
            />
            <Input
              label="Password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="Enter your password"
              trailing={
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="p-0.5 rounded hover:opacity-70 transition-opacity"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
            />

            <Button type="submit" className="w-full" loading={loading} size="lg">
              Sign in
            </Button>
          </form>

          {demoAccounts.length > 0 && (
            <DemoLoginPanel accounts={demoAccounts} />
          )}

          {/*
            R6 remediation (4 August 2026).

            This surface previously rendered a role-account quick-fill block
            with a shared credential shown in plain text, on an unauthenticated
            route. On the production custom domain that route is publicly
            reachable — Vercel Standard Protection exempts custom production
            domains — so anyone loading the page could sign in at administrator
            level with no prior access.

            The block, the account list and the quick-fill handler have been
            removed. Credential material must never render on an
            unauthenticated surface, and this must not be reintroduced as a
            convenience. tests/security/login-no-credential-exposure.test.ts
            fails if it is.

            Historical credential rotation remains a separate, human-owned R6 gate.

            DEMO MODE (12 August 2026) — how the demo affordance above differs.

            The panel rendered when DEMO_MODE is on is NOT a reinstatement of the
            removed block. The distinction is that no credential exists on this
            surface at any point:

              - The account list carries identity and role only. No password is
                rendered, threaded as a prop, or present in the client bundle.
              - Sign-in posts an opaque key ("admin") to a server action, which
                resolves the credential from the environment server-side.
              - The password is supplied by DEMO_PASSWORD at runtime and is not a
                literal in any source file, so nothing needs scrubbing at handover.
              - DEMO_MODE is decided on the server; the client cannot enable it.

            Consequently the R6 guard above still passes unmodified, and setting
            DEMO_MODE=false removes the affordance entirely. What the guard was
            written to prevent — credential material reachable on an
            unauthenticated route — remains prevented.

            The residual exposure is different in kind and is accepted
            deliberately: while DEMO_MODE is on, anyone who can reach this page
            can obtain a session. That is why the deployment must sit behind
            access protection for as long as demo mode is enabled. See
            lib/ops/handover-readiness.ts.
          */}
        </div>
      </div>
    </div>
  );
}
