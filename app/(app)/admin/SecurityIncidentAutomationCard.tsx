"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SecurityIncidentAutomationCard({
  secretConfigured,
  secretSource,
  reminderCooldownHours,
  lastRunAt,
  runs7d,
  automatedReminders7d,
}: {
  secretConfigured: boolean;
  secretSource: string | null;
  reminderCooldownHours: number;
  lastRunAt: Date | null;
  runs7d: number;
  automatedReminders7d: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  async function runAutomation() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/security-incidents/run", {
        method: "POST",
      });

      const payload = (await response.json()) as {
        error?: string;
        summary?: {
          dueSoonReminders: number;
          overdueReminders: number;
          skippedCooldown: number;
        };
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to run automation");
      }

      toast.success(
        `Run complete — ${payload.summary?.overdueReminders ?? 0} overdue and ${payload.summary?.dueSoonReminders ?? 0} due-soon reminder(s) sent.`
      );
      router.refresh();
    } catch (runError) {
      toast.error(runError instanceof Error ? runError.message : "Unable to run automation");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-muted/40 px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">
            Incident automation
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Runs due-soon and overdue reminder checks for open security incidents.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={secretConfigured ? "low" : "high"}>
            {secretConfigured ? "Job secret configured" : "Job secret missing"}
          </Badge>
          {secretSource && (
            <Badge variant="default">{secretSource}</Badge>
          )}
          <Badge variant="default">
            Cooldown {reminderCooldownHours}h
          </Badge>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-border bg-card px-3 py-3">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Last run
          </div>
          <div className="mt-2 text-sm font-semibold text-foreground">
            {lastRunAt ? lastRunAt.toLocaleString("en-NZ") : "Not run yet"}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card px-3 py-3">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Runs in 7 days
          </div>
          <div className="mt-2 text-sm font-semibold text-foreground">
            {runs7d}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card px-3 py-3">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Automated reminders in 7 days
          </div>
          <div className="mt-2 text-sm font-semibold text-foreground">
            {automatedReminders7d}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button type="button" loading={loading} onClick={runAutomation}>
          Run automation now
        </Button>
        <button
          type="button"
          onClick={() => setShowDetails((s) => !s)}
          aria-expanded={showDetails}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronRight className={cn("h-3 w-3 transition-transform", showDetails && "rotate-90")} />
          Developer details
        </button>
      </div>

      {showDetails && (
        <div className="mt-2 text-xs text-muted-foreground">
          Scheduler endpoint: <code>GET /api/admin/security-incidents/run</code>
        </div>
      )}
    </div>
  );
}
