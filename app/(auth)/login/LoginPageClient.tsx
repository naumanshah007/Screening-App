"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Eye, EyeOff, ShieldCheck, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { PrivexaMark } from "@/components/marketing/PrivexaMark";

const DEMO_ACCOUNTS = [
  { username: "admin",       role: "Platform admin",       color: "bg-purple-50 text-purple-700 border-purple-200" },
  { username: "clinician",   role: "GP / Cervical tools",  color: "bg-teal-50   text-teal-700   border-teal-200" },
  { username: "coordinator", role: "Coordinator",           color: "bg-sky-50    text-sky-700    border-sky-200" },
  { username: "specialist",  role: "Specialist reviewer",  color: "bg-amber-50  text-amber-700  border-amber-200" },
];

export function LoginPageClient({
  passwordUpdated = false,
  reauthRequired = false,
  callbackUrl = null,
}: {
  passwordUpdated?: boolean;
  reauthRequired?: boolean;
  callbackUrl?: string | null;
}) {
  const router = useRouter();
  const destination = callbackUrl || "/dashboard";
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
        window.location.href = destination;
      }
    } finally {
      setLoading(false);
    }
  }

  function quickFill(acct: (typeof DEMO_ACCOUNTS)[number]) {
    setUsername(acct.username);
    setPassword("admin123");
    setError("");
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
              Women&apos;s Health<br />
              <span className="text-gradient-brand">Grading Platform</span>
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

          {/* Demo accounts */}
          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-xs text-muted-foreground mb-2">Demo accounts — click to fill:</p>
            <div className="flex flex-wrap gap-2">
              {DEMO_ACCOUNTS.map((acct) => (
                <button
                  key={acct.username}
                  type="button"
                  onClick={() => quickFill(acct)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-opacity hover:opacity-80 ${acct.color}`}
                >
                  <span className="font-mono font-semibold">{acct.username}</span>
                  <span className="opacity-60">· {acct.role}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2 font-mono">
              All demo accounts · password: <strong>admin123</strong>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
