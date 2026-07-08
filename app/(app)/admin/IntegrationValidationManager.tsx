"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { SlideOver } from "@/components/ui/slide-over";
import type { IntegrationStatus } from "@/lib/ops/integration-status";
import type {
  EnterpriseIntegrationId,
  IntegrationValidationState,
} from "@/lib/ops/integration-validations";

type ValidationRow = {
  id: EnterpriseIntegrationId;
  title: string;
  integration: IntegrationStatus;
  validation: IntegrationValidationState;
};

function toDateInput(value: Date | string | null | undefined) {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function badgeVariant(kind: IntegrationValidationState["kind"]) {
  switch (kind) {
    case "passed":
      return "low";
    case "warning":
    case "expired":
      return "high";
    case "failed":
      return "urgent";
    default:
      return "default";
  }
}

function defaultOutcome(kind: IntegrationValidationState["kind"]) {
  switch (kind) {
    case "warning":
    case "expired":
      return "WARNING";
    case "failed":
      return "FAILED";
    default:
      return "PASSED";
  }
}

function ValidationEditor({ row, onDone }: { row: ValidationRow; onDone: () => void }) {
  const router = useRouter();
  const [outcome, setOutcome] = useState<"PASSED" | "WARNING" | "FAILED">(defaultOutcome(row.validation.kind));
  const [validatedAt, setValidatedAt] = useState(
    toDateInput(row.validation.record?.validatedAt) || new Date().toISOString().slice(0, 10)
  );
  const [expiresAt, setExpiresAt] = useState(toDateInput(row.validation.record?.expiresAt));
  const [summary, setSummary] = useState(row.validation.record?.summary ?? "");
  const [notes, setNotes] = useState(row.validation.record?.notes ?? "");
  const [environment, setEnvironment] = useState(row.validation.record?.environment ?? "current");
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/integration-validations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          integrationId: row.id,
          environment,
          outcome,
          summary,
          notes,
          validatedAt,
          expiresAt: expiresAt || null,
        }),
      });
      const payload = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) throw new Error(payload.error ?? "Unable to record validation");
      toast.success(payload.message ?? "Validation recorded.");
      router.refresh();
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Unable to record validation");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <Badge variant="info">{row.integration.mode}</Badge>
        <p className="mt-3 text-sm text-muted-foreground">{row.integration.summary}</p>
        <p className="mt-1 text-xs text-muted-foreground">{row.integration.detail}</p>
        <p className="mt-2 text-xs text-muted-foreground">{row.validation.detail}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          label="Outcome"
          value={outcome}
          onChange={(e) => setOutcome(e.target.value as "PASSED" | "WARNING" | "FAILED")}
          options={[
            { value: "PASSED", label: "Passed" },
            { value: "WARNING", label: "Pass with caution" },
            { value: "FAILED", label: "Failed" },
          ]}
        />
        <Input label="Environment" value={environment} onChange={(e) => setEnvironment(e.target.value)} placeholder="current, demo, staging, production" />
        <Input label="Validated" type="date" value={validatedAt} onChange={(e) => setValidatedAt(e.target.value)} />
        <Input label="Review again" type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} hint="Optional expiry / review date." />
      </div>

      <Textarea label="Validation summary" rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="What was tested and what was the result?" />
      <Textarea label="Follow-up notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any caveats, scope limits, or next step." />

      {row.validation.recommendedAction && (
        <div className="rounded-lg border border-border bg-muted/40 px-3 py-3 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Next step:</span> {row.validation.recommendedAction}
        </div>
      )}

      <div className="flex justify-end border-t border-border pt-4">
        <Button type="button" loading={loading} onClick={handleSave}>
          Record validation
        </Button>
      </div>
    </div>
  );
}

export function IntegrationValidationManager({ rows }: { rows: ValidationRow[] }) {
  const [selectedId, setSelectedId] = useState<EnterpriseIntegrationId | null>(null);
  const selected = rows.find((r) => r.id === selectedId) ?? null;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        Record the outcome of a controlled integration check. This is the governance layer that
        distinguishes &ldquo;configured&rdquo; from &ldquo;validated for use&rdquo;.
      </div>

      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.id} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-foreground">{row.title}</div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <Badge variant="info">{row.integration.mode}</Badge>
                <Badge variant={badgeVariant(row.validation.kind)}>{row.validation.label}</Badge>
              </div>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={() => setSelectedId(row.id)} className="flex-shrink-0">
              Manage
            </Button>
          </div>
        ))}
      </div>

      <SlideOver
        open={selected != null}
        onClose={() => setSelectedId(null)}
        title={selected?.title ?? "Integration"}
        subtitle="Formal integration validation"
        width="lg"
      >
        {selected && <ValidationEditor key={selected.id} row={selected} onDone={() => setSelectedId(null)} />}
      </SlideOver>
    </div>
  );
}
