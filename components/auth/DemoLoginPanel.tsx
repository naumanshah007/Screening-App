"use client";

import { useState, useTransition } from "react";
import { FlaskConical, ShieldAlert, ArrowRight } from "lucide-react";

import { signInAsDemoUser } from "@/lib/auth/demo-login-action";
import { Alert } from "@/components/ui/alert";

export type DemoAccountOption = {
  key: string;
  label: string;
  description: string;
  role: string;
  landingPage: string;
};

/**
 * One-click demonstration sign-in, one card per application role.
 *
 * Renders only when the server has already decided DEMO_MODE is on — the
 * decision is never made client-side. Each button posts an opaque account key
 * to a server action; no credential is present in this component, in its props,
 * or in the bundle it ships.
 */
export function DemoLoginPanel({
  accounts,
}: {
  accounts: readonly DemoAccountOption[];
}) {
  const [pending, startTransition] = useTransition();
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [error, setError] = useState<string>("");

  function handleDemoSignIn(key: string) {
    setError("");
    setActiveKey(key);
    startTransition(async () => {
      // A successful sign-in redirects, so control does not return here.
      const result = await signInAsDemoUser(key);
      if (result && !result.ok) {
        setError(result.error);
        setActiveKey(null);
      }
    });
  }

  return (
    <section aria-labelledby="demo-users-heading">
      <div className="flex items-start gap-2.5">
        <FlaskConical
          className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning-fg"
          aria-hidden
        />
        <div className="min-w-0">
          <h2
            id="demo-users-heading"
            className="text-sm font-semibold tracking-tight text-foreground"
          >
            Demo users
          </h2>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            Demonstration / PoC accounts · synthetic data only · not a real
            clinical approval identity.
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="error" className="mt-3">
          {error}
        </Alert>
      )}

      <ul className="mt-3 space-y-1.5">
        {accounts.map((account) => {
          const isActive = pending && activeKey === account.key;
          return (
            <li key={account.key}>
              <button
                type="button"
                onClick={() => handleDemoSignIn(account.key)}
                disabled={pending}
                className="group flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2.5 text-left transition-colors hover:border-primary/50 hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">
                    Login as {account.label}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {account.description}
                  </span>
                  <span className="mt-0.5 block truncate font-mono text-[11px] text-muted-foreground">
                    {account.role} → {account.landingPage}
                  </span>
                </span>
                <ArrowRight
                  className={`h-3.5 w-3.5 flex-shrink-0 transition-transform ${
                    isActive
                      ? "animate-pulse"
                      : "text-muted-foreground group-hover:translate-x-0.5"
                  }`}
                  aria-hidden
                />
              </button>
            </li>
          );
        })}
      </ul>

      <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
        <ShieldAlert className="mt-px h-3 w-3 flex-shrink-0" aria-hidden />
        <span>
          Governance decisions made with these identities are recorded as
          demonstration attestations and cannot satisfy real activation gates.
        </span>
      </p>
    </section>
  );
}
