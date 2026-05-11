"use client";

import { useState, useEffect } from "react";
import {
  Sparkles, ChevronDown, ChevronUp, AlertCircle,
  CheckCircle2, WifiOff, Cpu, Server, Info
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge, PriorityBadge } from "@/components/ui/badge";
import type { TriagePriority } from "@prisma/client";

// ─── Types ────────────────────────────────────────────────────────────────────

type AiResult = {
  id: string;
  suggestedPriority: TriagePriority | null;
  suggestedCategory: string;
  suggestedOutcome: string;
  rationale: string;
  confidence: number;
  citations: string[];
  concordantWithRule: boolean;
  reasoning: string;
  provider: string;
  model: string;
  isStub: boolean;
};

type HealthStatus = {
  provider: string;
  model: string;
  isStub: boolean;
  healthy: boolean;
  latencyMs: number | null;
  message: string;
  modelPulled?: boolean;
  ollamaBaseUrl?: string | null;
};

// ─── Provider badge ───────────────────────────────────────────────────────────

function ProviderBadge({ provider, model, isStub }: { provider: string; model: string; isStub: boolean }) {
  if (isStub) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
        <Cpu className="h-2.5 w-2.5" />
        Demo mode
      </span>
    );
  }
  if (provider === "ollama") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">
        <Server className="h-2.5 w-2.5" />
        Local AI · {model}
      </span>
    );
  }
  if (provider === "anthropic") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-warn/10 px-2 py-0.5 text-[10px] font-medium text-warn">
        <Info className="h-2.5 w-2.5" />
        Anthropic (dev only)
      </span>
    );
  }
  return null;
}

// ─── Connectivity indicator ───────────────────────────────────────────────────

function ConnectivityDot({ healthy, isStub }: { healthy: boolean | null; isStub: boolean }) {
  if (isStub) return <span className="h-2 w-2 rounded-full bg-muted-foreground/30 inline-block" />;
  if (healthy === null) return <span className="h-2 w-2 rounded-full bg-muted-foreground/30 animate-pulse inline-block" />;
  return (
    <span
      className={cn(
        "h-2 w-2 rounded-full inline-block",
        healthy ? "bg-success/50" : "bg-destructive/60"
      )}
    />
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AiAssistButton({
  caseId,
  disabledReason,
}: {
  caseId: string;
  disabledReason?: string | null;
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AiResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [health, setHealth] = useState<HealthStatus | null>(null);

  // Poll health on mount to pre-warm connectivity indicator
  useEffect(() => {
    let cancelled = false;
    async function checkHealth() {
      try {
        const res = await fetch("/api/ai/health");
        if (!cancelled && res.ok) {
          setHealth((await res.json()) as HealthStatus);
        }
      } catch {
        // Silently ignore — health check is best-effort
      }
    }
    void checkHealth();
    return () => { cancelled = true; };
  }, []);

  async function runAssist() {
    if (disabledReason) {
      setError(disabledReason);
      return;
    }

    setLoading(true);
    setError(null);
    setHint(null);
    setResult(null);

    try {
      const res = await fetch(`/api/cases/${caseId}/ai/recommend`, { method: "POST" });
      const data = await res.json() as AiResult & { error?: string; hint?: string };
      if (!res.ok) {
        setError(data.error ?? "AI assist failed");
        setHint(data.hint ?? null);
      } else {
        setResult(data);
        setExpanded(true);
        // Refresh health after a successful run
        const hRes = await fetch("/api/ai/health");
        if (hRes.ok) setHealth((await hRes.json()) as HealthStatus);
      }
    } catch {
      setError("Network error — could not reach AI service.");
    } finally {
      setLoading(false);
    }
  }

  const confidencePct = result ? Math.round((result.confidence ?? 0) * 100) : 0;
  const confidenceColor =
    confidencePct >= 80 ? "bg-success/50"
    : confidencePct >= 60 ? "bg-warn/60"
    : "bg-destructive/60";

  const providerLabel =
    health?.provider === "ollama"
      ? `Local AI · ${health.model}`
      : health?.provider === "anthropic"
        ? "Anthropic (dev)"
        : health?.isStub
          ? "Demo mode"
          : "AI Assist";

  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50/40 overflow-hidden">
      {/* Header bar */}
      <div className="px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-purple-600 flex-shrink-0" />
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold text-purple-900">AI Grading Assist</p>
              <ConnectivityDot healthy={health?.healthy ?? null} isStub={health?.isStub ?? false} />
            </div>
            <p className="text-xs text-purple-600">{providerLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {result && (
            <button
              onClick={() => setExpanded((e) => !e)}
              className="text-purple-600 hover:text-purple-800"
              aria-label={expanded ? "Collapse" : "Expand"}
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          )}
          <button
            onClick={runAssist}
            disabled={loading || Boolean(disabledReason)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              loading || disabledReason
                ? "bg-purple-200 text-purple-500 cursor-not-allowed"
                : "bg-purple-600 text-white hover:bg-purple-700"
            )}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {loading ? "Analysing…" : disabledReason ? "AI blocked" : result ? "Re-run" : "Run AI Assist"}
          </button>
        </div>
      </div>

      {disabledReason && (
        <div className="px-4 pb-2">
          <div className="flex items-start gap-2 rounded-lg border border-warn/30 bg-warn/5 px-3 py-2 text-xs text-foreground">
            <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
            <span>{disabledReason}</span>
          </div>
        </div>
      )}

      {/* Health message (Ollama not running, model not pulled, etc.) */}
      {health && !health.healthy && !health.isStub && (
        <div className="px-4 pb-2">
          <div className="flex items-start gap-2 rounded-lg border border-warn/30 bg-warn/5 px-3 py-2 text-xs text-foreground">
            <WifiOff className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
            <span>{health.message}</span>
          </div>
        </div>
      )}

      {/* Model not pulled warning */}
      {health?.healthy && health.modelPulled === false && (
        <div className="px-4 pb-2">
          <div className="flex items-start gap-2 rounded-lg border border-warn/30 bg-warn/5 px-3 py-2 text-xs text-foreground">
            <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
            <span>{health.message}</span>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="px-4 pb-3">
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <div>
              <p>{error}</p>
              {hint && <p className="mt-1 text-xs font-mono text-destructive">{hint}</p>}
            </div>
          </div>
        </div>
      )}

      {/* Stub mode notice */}
      {result?.isStub && expanded && (
        <div className="px-4 pb-2">
          <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
            <span>
              <strong>Demo mode:</strong> No AI server is configured. This output is a placeholder.
              Set <code className="font-mono">AI_PROVIDER=ollama</code> and start Ollama to enable
              real local AI inference.
            </span>
          </div>
        </div>
      )}

      {/* Result */}
      {result && expanded && (
        <div className="border-t border-brand-200 bg-card px-4 py-4 space-y-4">
          {/* Provider badge + priority */}
          <div className="flex flex-wrap items-center gap-2">
            {result.suggestedPriority && (
              <PriorityBadge priority={result.suggestedPriority} />
            )}
            {result.suggestedCategory && (
              <Badge variant="info">{result.suggestedCategory}</Badge>
            )}
            <Badge variant={result.concordantWithRule ? "low" : "high"}>
              {result.concordantWithRule ? "Agrees with rules" : "Differs from rules"}
            </Badge>
            <ProviderBadge
              provider={result.provider}
              model={result.model}
              isStub={result.isStub}
            />
          </div>

          {/* Confidence bar */}
          {!result.isStub && (
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-muted-foreground">AI confidence</span>
                <span className="text-xs font-semibold text-foreground">{confidencePct}%</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn("h-1.5 rounded-full transition-all", confidenceColor)}
                  style={{ width: `${confidencePct}%` }}
                />
              </div>
            </div>
          )}

          {/* Suggested outcome */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              Suggested outcome
            </p>
            <p className="text-sm text-foreground">{result.suggestedOutcome}</p>
          </div>

          {/* Rationale */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              Rationale
            </p>
            <p className="text-sm text-muted-foreground">{result.rationale}</p>
          </div>

          {/* Citations */}
          {result.citations && result.citations.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                Guideline citations
              </p>
              <ul className="space-y-1">
                {result.citations.map((c) => (
                  <li key={c} className="text-xs text-muted-foreground">• {c}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Reasoning */}
          {result.reasoning && !result.isStub && (
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer font-medium text-muted-foreground hover:text-foreground">
                Show full reasoning
              </summary>
              <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{result.reasoning}</p>
            </details>
          )}

          {/* Sovereignty notice for Ollama */}
          {result.provider === "ollama" && (
            <div className="flex items-center gap-1.5 text-[10px] text-success bg-success/5 rounded-md px-2.5 py-1.5">
              <CheckCircle2 className="h-3 w-3 flex-shrink-0" />
              Data processed on-premises · No patient data left the hospital network
            </div>
          )}

          {/* Advisory footer */}
          <p className="text-[10px] text-purple-400">
            AI recommendations are advisory only. Clinician confirmation is always required before any grading decision.
          </p>
        </div>
      )}
    </div>
  );
}
