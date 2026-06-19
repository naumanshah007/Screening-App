"use client";

import { useState, useCallback, useRef } from "react";
import {
  FlaskConical, Share2, ShieldCheck, RefreshCw, CheckCircle2, Loader2,
  Wifi, Calendar, Terminal,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  generateRealisticCases,
  CONNECTOR_PRESETS,
  type ConnectorId,
} from "@/lib/batch/realistic-dataset";
import type { CanonicalBatchCase } from "@/lib/batch/types";

type RangePreset = "today" | "week" | "month" | "custom";

interface ConnectorMeta {
  id: ConnectorId;
  name: string;
  detail: string;
  protocol: string;
  icon: React.ElementType;
  lastSync: string;
  syncSteps: (n: number, range: string) => string[];
}

const CONNECTORS: ConnectorMeta[] = [
  {
    id: "hl7",
    name: "Awanui Labs — Auckland",
    detail: "Cytology & HPV results feed",
    protocol: "HL7v2 · ORU^R01",
    icon: FlaskConical,
    lastSync: "4 min ago",
    syncSteps: (n, range) => [
      "Opening Awanui Labs demo connector…",
      "Demo credential check · mapping profile loaded…",
      `Generating ORU^R01-style results received ${range}…`,
      `Prepared ${n} simulated HL7 messages`,
      "Parsing OBX / OBR segments…",
      "Mapping to NCSP canonical model…",
      `Validation passed · ${n} cases ready for triage`,
    ],
  },
  {
    id: "erms",
    name: "Counties Manukau eReferrals",
    detail: "Colposcopy & gynaecology referrals",
    protocol: "HealthLink EDI",
    icon: Share2,
    lastSync: "11 min ago",
    syncSteps: (n, range) => [
      "Opening Counties Manukau eReferral demo connector…",
      "Demo mailbox check · HealthLink EDI mapping loaded…",
      `Generating referrals received ${range}…`,
      `Prepared ${n} simulated eReferrals`,
      "Extracting structured referral fields…",
      "Mapping to NCSP canonical model…",
      `Validation passed · ${n} cases ready for triage`,
    ],
  },
  {
    id: "ncsr",
    name: "NCSR — National Screening",
    detail: "Cervical screening register history",
    protocol: "Te Whatu Ora · HISO 10029",
    icon: ShieldCheck,
    lastSync: "1 hr ago",
    syncSteps: (n, range) => [
      "Opening NCSR demo connector…",
      "Demo identity assertion · HISO mapping loaded…",
      `Generating screening-register records ${range}…`,
      `Prepared ${n} simulated participant records`,
      "Reconciling prior screening history…",
      "Mapping to NCSP canonical model…",
      `Validation passed · ${n} cases ready for triage`,
    ],
  },
];

const RANGE_PRESETS: { id: RangePreset; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "week", label: "This week" },
  { id: "month", label: "Last 30 days" },
  { id: "custom", label: "Custom range" },
];

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function resolveRange(preset: RangePreset, customStart: string, customEnd: string) {
  const end = new Date();
  const start = new Date();
  if (preset === "today") {
    start.setHours(0, 0, 0, 0);
  } else if (preset === "week") {
    start.setDate(end.getDate() - 7);
  } else if (preset === "month") {
    start.setDate(end.getDate() - 30);
  } else {
    return {
      start: customStart ? new Date(customStart) : new Date(end.getTime() - 7 * 86400000),
      end: customEnd ? new Date(customEnd) : end,
    };
  }
  return { start, end };
}

function rangeLabel(preset: RangePreset, start: Date, end: Date) {
  if (preset === "today") return "today";
  if (preset === "week") return "in the last 7 days";
  if (preset === "month") return "in the last 30 days";
  const fmt = (d: Date) => d.toLocaleDateString("en-NZ", { day: "numeric", month: "short" });
  return `${fmt(start)} – ${fmt(end)}`;
}

function caseCountForRange(preset: RangePreset, start: Date, end: Date): number {
  if (preset === "today") return 8 + Math.floor(Math.random() * 9); // 8–16
  if (preset === "week") return 28 + Math.floor(Math.random() * 21); // 28–48
  if (preset === "month") return 55 + Math.floor(Math.random() * 26); // 55–80
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000));
  return Math.min(120, Math.max(6, Math.round(days * 2.2)));
}

export function SourceConnectors({
  onLoaded,
  disabled,
}: {
  onLoaded: (cases: CanonicalBatchCase[], sourceSystem: string) => void;
  disabled?: boolean;
}) {
  const [preset, setPreset] = useState<RangePreset>("week");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [syncing, setSyncing] = useState<ConnectorId | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const cancelled = useRef(false);

  const runSync = useCallback(
    async (connector: ConnectorMeta) => {
      if (syncing) return;
      cancelled.current = false;
      setSyncing(connector.id);
      setLog([]);

      const { start, end } = resolveRange(preset, customStart, customEnd);
      const count = caseCountForRange(preset, start, end);
      const cases = generateRealisticCases({
        connector: connector.id,
        count,
        rangeStart: start,
        rangeEnd: end,
      });

      const steps = connector.syncSteps(cases.length, rangeLabel(preset, start, end));
      for (let i = 0; i < steps.length; i++) {
        if (cancelled.current) return;
        await sleep(i === 0 ? 350 : 360 + Math.random() * 320);
        setLog((prev) => [...prev, steps[i]]);
      }
      await sleep(450);
      if (cancelled.current) return;

      setSyncing(null);
      onLoaded(cases, CONNECTOR_PRESETS[connector.id].sourceSystem);
    },
    [syncing, preset, customStart, customEnd, onLoaded]
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
            Integration-ready demo payloads generated from synthetic NZ-real cases.
          </span>
        </div>

        {/* Date range */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" /> Received date range
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {RANGE_PRESETS.map((r) => (
              <button
                key={r.id}
                onClick={() => setPreset(r.id)}
                disabled={Boolean(syncing) || disabled}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50",
                  preset === r.id
                    ? "bg-brand-600 text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted/70"
                )}
              >
                {r.label}
              </button>
            ))}
            {preset === "custom" && (
              <div className="flex items-center gap-1.5 ml-1">
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground"
                />
                <span className="text-xs text-muted-foreground">to</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground"
                />
              </div>
            )}
          </div>
        </div>

        {/* Connector cards */}
        <div className="grid gap-3 md:grid-cols-3">
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
                <div className="flex items-center justify-between gap-2 mt-auto">
                  <span className="text-[11px] text-muted-foreground">Last simulated sync {c.lastSync}</span>
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
