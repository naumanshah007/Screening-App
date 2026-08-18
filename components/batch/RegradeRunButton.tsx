"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

export function RegradeRunButton({ runId }: { runId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function regrade() {
    setLoading(true);
    setNote(null);
    try {
      const res = await fetch(`/api/batch/runs/${runId}/regrade`, { method: "POST" });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? `HTTP ${res.status}`);
      setNote(`Re-graded ${payload.regraded} pending · ${payload.changed} changed (v${payload.ruleVersion}).`);
      router.refresh();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Re-grade failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="outline" onClick={regrade} disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        Re-grade with current rules
      </Button>
      {note && <span className="text-xs text-muted-foreground">{note}</span>}
    </div>
  );
}
