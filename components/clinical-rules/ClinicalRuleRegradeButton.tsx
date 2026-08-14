"use client";

import { useState } from "react";
import { GitCompare, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ClinicalRuleRegradeButton({
  runId,
  targetVersionId,
  targetVersionDisplay,
  pinnedVersionDisplay,
  newer,
}: {
  runId: string;
  targetVersionId: string;
  targetVersionDisplay: string;
  pinnedVersionDisplay?: string | null;
  newer: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>();

  async function regrade() {
    if (!reason.trim()) return;
    setLoading(true);
    setResult(undefined);
    try {
      const response = await fetch(`/api/batch/runs/${runId}/clinical-regrade`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ruleVersionId: targetVersionId, reason }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Unable to regrade open cases");
      setResult(`${payload.regraded} open cases regraded; ${payload.reused ?? 0} persisted regrades reused; ${payload.changed} before/after records changed. Original batch pin ${payload.pinnedVersionPreserved ?? "none"} preserved.`);
      setOpen(false);
      setReason("");
    } catch (error) {
      setResult(error instanceof Error ? error.message : "Unable to regrade open cases");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-purple-200 bg-purple-50 p-3 text-xs text-purple-950">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><span className="font-bold">{newer ? "A newer ruleset is available" : "A different active ruleset is available"}:</span> {targetVersionDisplay}. Batch pin: {pinnedVersionDisplay ?? "none"}.</div>
        <Button size="sm" variant="secondary" onClick={() => setOpen((value) => !value)} icon={open ? <X className="h-4 w-4" /> : <GitCompare className="h-4 w-4" />}>{open ? "Cancel" : `Regrade with ${targetVersionDisplay}`}</Button>
      </div>
      {open && <div className="mt-3 flex flex-col gap-2 rounded-lg border border-purple-200 bg-white p-3 sm:flex-row sm:items-end"><Input label="Required regrade reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Why must these open cases be regraded?" /><Button loading={loading} disabled={!reason.trim()} onClick={() => void regrade()}>Create linked evaluations</Button></div>}
      {result && <p className="mt-2 font-medium">{result}</p>}
      <p className="mt-2 text-[11px] leading-5 text-purple-800">Completed decisions are never changed. Each new evaluation links to its prior evaluation and the batch-level pinned version remains immutable.</p>
    </div>
  );
}
