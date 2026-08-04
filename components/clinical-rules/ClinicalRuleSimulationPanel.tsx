"use client";

import { useState } from "react";
import { PlayCircle, ShieldAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";

const EXAMPLE_FACTS = {
  patientAge: 45,
  hpvResult: "HPV_OTHER",
  cytologyResult: "NEGATIVE",
  isPregnant: false,
  hasAbnormalVaginalBleeding: false,
};

export function ClinicalRuleSimulationPanel({ versionId }: { versionId: string }) {
  const [factsJson, setFactsJson] = useState(JSON.stringify(EXAMPLE_FACTS, null, 2));
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function simulate() {
    setPending(true);
    setError(undefined);
    try {
      const facts = JSON.parse(factsJson) as Record<string, unknown>;
      const response = await fetch("/api/clinical-rules/evaluate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ facts, ruleVersionId: versionId, evaluationMode: "SIMULATION" }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Simulation failed");
      setResult(body);
    } catch (simulationError) {
      setError(simulationError instanceof Error ? simulationError.message : "Simulation failed");
    } finally {
      setPending(false);
    }
  }

  const clinicalResult = result?.result as Record<string, unknown> | undefined;
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <div className="space-y-4">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
          <div className="flex items-center gap-2 font-bold"><ShieldAlert className="h-4 w-4" />Simulation safety boundary</div>
          <p className="mt-2">This creates an auditable SIMULATION evaluation. Source-text conditions remain unknown and route to clinician review; they are never treated as false or normal.</p>
        </div>
        <Textarea label="Synthetic fact map (JSON)" rows={18} value={factsJson} error={error} onChange={(event) => setFactsJson(event.target.value)} />
        <Button onClick={() => void simulate()} loading={pending} icon={<PlayCircle className="h-4 w-4" />}>Run simulation</Button>
      </div>
      <div>
        {!clinicalResult ? (
          <div className="flex min-h-[360px] items-center justify-center rounded-xl border border-dashed border-border bg-slate-50 p-8 text-center text-sm text-muted-foreground">Run a synthetic case to inspect the version-pinned result, trace and reviewer boundary.</div>
        ) : (
          <div className="space-y-4 rounded-xl border border-border p-5">
            <div className="flex flex-wrap gap-2"><Badge variant="high">Provisional recommendation</Badge><Badge variant="urgent">Reviewer confirmation required</Badge></div>
            <div><div className="text-xs uppercase tracking-wide text-muted-foreground">Recommendation</div><p className="mt-2 text-sm font-semibold leading-6">{String(clinicalResult.provisionalRecommendation)}</p></div>
            <div className="grid grid-cols-2 gap-3 text-sm"><div><div className="text-muted-foreground">Risk</div><div className="font-semibold">{String(clinicalResult.riskLevel)}</div></div><div><div className="text-muted-foreground">Version</div><div className="font-mono font-semibold">{String(clinicalResult.ruleVersionDisplay)}</div></div></div>
            <div><div className="text-muted-foreground text-sm">Checksum</div><div className="mt-1 break-all font-mono text-[11px]">{String(clinicalResult.ruleSetChecksum)}</div></div>
            <div><div className="text-muted-foreground text-sm">Matched rules</div><div className="mt-2 flex flex-wrap gap-2">{(clinicalResult.matchedRuleIds as string[]).length ? (clinicalResult.matchedRuleIds as string[]).map((ruleId) => <Badge key={ruleId}>{ruleId}</Badge>) : <Badge variant="high">No executable match</Badge>}</div></div>
            <div className="rounded-lg bg-slate-950 p-3 font-mono text-[11px] text-slate-100">Evaluation ID: {String(result?.evaluationId)}</div>
            <p className="text-xs leading-5 text-muted-foreground">Not for direct clinical action · Demo environment · Simulated export package</p>
          </div>
        )}
      </div>
    </div>
  );
}
