"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const DEMO_ACCOUNTS = [
  { username: "admin",       role: "Admin",       color: "bg-purple-100 text-purple-700 border-purple-200" },
  { username: "clinician",   role: "GP",           color: "bg-teal-100 text-teal-700 border-teal-200" },
  { username: "coordinator", role: "Coordinator",  color: "bg-blue-100 text-blue-700 border-blue-200" },
  { username: "specialist",  role: "Specialist",   color: "bg-amber-100 text-amber-700 border-amber-200" },
];

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await signIn("credentials", {
        email: username,   // auth.ts accepts username or full email
        password,
        redirect: false,
      });
      if (result?.error) {
        setError("Invalid username or password.");
      } else {
        router.push("/dashboard");
      }
    } finally {
      setLoading(false);
    }
  }

  function quickFill(acct: typeof DEMO_ACCOUNTS[number]) {
    setUsername(acct.username);
    setPassword("admin123");
    setError("");
  }

  return (
    <div className="min-h-screen bg-[#1E3A5F] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-[#0D9488] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-2xl font-bold">CS</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Cervical Screening</h1>
          <p className="text-blue-300 text-sm mt-1">Clinical Decision Support System</p>
        </div>

        {/* Login card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-lg font-semibold text-[#1E3A5F] mb-2">Sign in to your account</h2>

          {/* Quick-access chips */}
          <div className="mb-5">
            <p className="text-xs text-slate-400 mb-2">Quick access — click to fill:</p>
            <div className="flex flex-wrap gap-2">
              {DEMO_ACCOUNTS.map((acct) => (
                <button
                  key={acct.username}
                  type="button"
                  onClick={() => quickFill(acct)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-opacity hover:opacity-80 ${acct.color}`}
                >
                  <span className="font-mono font-semibold">{acct.username}</span>
                  <span className="opacity-60">· {acct.role}</span>
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg mb-4"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              placeholder="admin"
              autoCapitalize="none"
              spellCheck={false}
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="admin123"
            />
            <Button
              type="submit"
              className="w-full"
              disabled={loading}
              loading={loading}
              size="lg"
            >
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <div className="mt-5 pt-5 border-t border-gray-100 space-y-1">
            <p className="text-xs text-gray-500 text-center font-mono">
              All accounts · password: <strong>admin123</strong>
            </p>
            <p className="text-xs text-gray-400 text-center">
              NZ Cervical Screening Programme · Authorised Personnel Only
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
