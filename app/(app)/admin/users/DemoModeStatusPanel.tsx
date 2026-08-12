import { AlertTriangle, CheckCircle2, ShieldCheck, XCircle } from "lucide-react";

import type { HandoverReadiness } from "@/lib/ops/handover-readiness";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Demo mode status and handover readiness.
 *
 * Rendered prominently because the single most dangerous failure mode for this
 * deployment is someone assuming a demonstration environment is a real one.
 */
export function DemoModeStatusPanel({
  demoMode,
  handover,
}: {
  demoMode: boolean;
  handover: HandoverReadiness;
}) {
  return (
    <Card
      className={
        demoMode
          ? "border-warning-border bg-warning-bg/30"
          : "border-border"
      }
    >
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="flex items-start gap-2.5">
          {demoMode ? (
            <AlertTriangle
              className="mt-0.5 h-5 w-5 flex-shrink-0 text-warning-fg"
              aria-hidden
            />
          ) : (
            <ShieldCheck
              className="mt-0.5 h-5 w-5 flex-shrink-0 text-success-fg"
              aria-hidden
            />
          )}
          <div>
            <CardTitle className="text-base">
              Demo mode: {demoMode ? "ON" : "OFF"}
            </CardTitle>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {demoMode
                ? "This deployment uses demonstration credentials and must not be used for real clinical referrals."
                : "Demonstration credentials and one-click sign-in are disabled. Normal secure authentication only."}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <h3 className="text-sm font-semibold text-foreground">
          Handover readiness
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          All checks must pass before this deployment is used for real or pilot
          clinical operation.
        </p>

        <ul className="mt-3 space-y-2">
          {handover.checks.map((check) => (
            <li key={check.id} className="flex items-start gap-2">
              {check.passed ? (
                <CheckCircle2
                  className="mt-0.5 h-4 w-4 flex-shrink-0 text-success-fg"
                  aria-hidden
                />
              ) : (
                <XCircle
                  className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning-fg"
                  aria-hidden
                />
              )}
              <div className="min-w-0">
                <span className="block text-sm font-medium text-foreground">
                  {check.title}
                </span>
                <span className="block text-xs leading-relaxed text-muted-foreground">
                  {check.detail}
                </span>
              </div>
            </li>
          ))}
        </ul>

        <p className="mt-4 rounded-lg border border-border bg-surface px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          {handover.ready
            ? "All handover checks pass. This deployment is eligible for real or pilot operation."
            : "Handover is blocked until every check above passes. Demonstration governance decisions are permanently excluded from Production activation gates regardless of this state."}
        </p>
      </CardContent>
    </Card>
  );
}
