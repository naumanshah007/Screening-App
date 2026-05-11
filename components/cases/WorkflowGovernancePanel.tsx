import { AlertTriangle, ShieldAlert } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { CaseGovernanceSignal } from "@/lib/cases/governance";

function badgeVariant(level: "warning" | "blocked") {
  return level === "blocked" ? "urgent" : "high";
}

export function WorkflowGovernancePanel({
  title = "Governance Checks",
  description,
  signals,
}: {
  title?: string;
  description?: string;
  signals: CaseGovernanceSignal[];
}) {
  if (signals.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-brand-600" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {description && (
          <div className="rounded-xl border border-border bg-muted/40 px-4 py-4 text-sm text-muted-foreground">
            {description}
          </div>
        )}

        {signals.map((signal) => (
          <div
            key={signal.id}
            className="rounded-xl border border-border bg-card px-4 py-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="text-sm font-semibold text-foreground">
                  {signal.title}
                </div>
                <div className="text-sm text-muted-foreground">{signal.summary}</div>
              </div>
              <Badge variant={badgeVariant(signal.level)}>
                {signal.level === "blocked" ? "Blocked" : "Warning"}
              </Badge>
            </div>

            <div className="mt-3 flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-3 text-sm text-muted-foreground">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-warn" />
              <div>{signal.detail}</div>
            </div>

            {signal.nextStep && (
              <div className="mt-3 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Next step:</span>{" "}
                {signal.nextStep}
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
