"use client";

import { useState, useCallback, useRef } from "react";
import {
  RefreshCw, CheckCircle2, Loader2, Wifi, Terminal, Library,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CHCH_PUBLIC_DATASET } from "@/lib/batch/chch-public-dataset";
import type { CanonicalBatchCase } from "@/lib/batch/types";

const CHCH_PUBLIC_SOURCE_SYSTEM = "CHCH Public";

interface ConnectorMeta {
  id: string;
  name: string;
  detail: string;
  protocol: string;
  icon: React.ElementType;
  cases: CanonicalBatchCase[];
  sourceSystem: string;
  syncSteps: (n: number) => string[];
}

// A fixed, curated case set — the same 30 cases every pull, so an evaluator
// compares like with like across runs. Nothing is generated per pull, which is
// why there is no date-range control: the set does not vary by received date.
const CONNECTORS: ConnectorMeta[] = [
  {
    id: "chchPublic",
    name: "CHCH Public",
    detail: "Vendor-supplied evaluation case set",
    protocol: "Fixed dataset · 30 cases",
    icon: Library,
    cases: CHCH_PUBLIC_DATASET,
    sourceSystem: CHCH_PUBLIC_SOURCE_SYSTEM,
    syncSteps: (n) => [
      "Opening CHCH Public case library…",
      "Loading vendor-supplied evaluation dataset…",
      `Prepared ${n} fixed cases`,
      "Mapping to NCSP canonical model…",
      `Validation passed · ${n} cases ready for triage`,
    ],
  },
];

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function SourceConnectors({
  onLoaded,
  disabled,
}: {
  onLoaded: (cases: CanonicalBatchCase[], sourceSystem: string) => void;
  disabled?: boolean;
}) {
  const [syncing, setSyncing] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const cancelled = useRef(false);

  const runSync = useCallback(
    async (connector: ConnectorMeta) => {
      if (syncing) return;
      cancelled.current = false;
      setSyncing(connector.id);
      setLog([]);

      const cases = connector.cases;
      const steps = connector.syncSteps(cases.length);
      for (let i = 0; i < steps.length; i++) {
        if (cancelled.current) return;
        await sleep(i === 0 ? 350 : 360 + Math.random() * 320);
        setLog((prev) => [...prev, steps[i]]);
      }
      await sleep(450);
      if (cancelled.current) return;

      setSyncing(null);
      onLoaded(cases, connector.sourceSystem);
    },
    [syncing, onLoaded]
  );

  return (
    <Card>
      <CardContent className="py-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Wifi className="h-4 w-4 text-emerald-600" />
            <span className="text-sm font-semibold text-foreground">Demo source connectors</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Demo connector ready
            </span>
          </div>
          <span className="text-xs text-muted-foreground">
            Fixed evaluation dataset · identical on every pull.
          </span>
        </div>

        {/* Connector cards */}
        <div className="grid gap-3 md:grid-cols-2">
          {CONNECTORS.map((c) => {
            const Icon = c.icon;
            const isSyncing = syncing === c.id;
            return (
              <div
                key={c.id}
                className={cn(
                  "rounded-xl border bg-card p-4 flex flex-col gap-3 transition-colors",
                  isSyncing ? "border-brand-400 ring-1 ring-brand-400/30" : "border-border"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground leading-tight">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.detail}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-mono text-muted-foreground">{c.protocol}</span>
                  <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Simulated source
                  </span>
                </div>
                <div className="flex items-center justify-end gap-2 mt-auto">
                  <Button
                    size="sm"
                    variant={isSyncing ? "outline" : "primary"}
                    disabled={Boolean(syncing) || disabled}
                    onClick={() => runSync(c)}
                  >
                    {isSyncing ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Pulling…</>
                    ) : (
                      <><RefreshCw className="h-4 w-4" /> Pull cases</>
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Demo sync console */}
        {syncing && (
          <div className="rounded-lg border border-border bg-navy-950 dark:bg-black/60 px-4 py-3 font-mono text-xs text-emerald-300 space-y-1 max-h-48 overflow-y-auto">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
              <Terminal className="h-3.5 w-3.5" /> demo sync · {CONNECTORS.find((c) => c.id === syncing)?.name}
            </div>
            {log.map((line, i) => {
              const last = i === log.length - 1;
              const done = line.includes("ready for triage");
              return (
                <div key={i} className="flex items-start gap-2">
                  {done ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  ) : last ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0 mt-0.5" />
                  ) : (
                    <span className="text-emerald-500/60 shrink-0">›</span>
                  )}
                  <span className={cn(done && "text-emerald-200 font-semibold")}>{line}</span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
