"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
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

function ValidationEditor({ row }: { row: ValidationRow }) {
  const router = useRouter();
  const [outcome, setOutcome] = useState<"PASSED" | "WARNING" | "FAILED">(
    defaultOutcome(row.validation.kind)
  );
  const [validatedAt, setValidatedAt] = useState(
    toDateInput(row.validation.record?.validatedAt) || new Date().toISOString().slice(0, 10)
  );
  const [expiresAt, setExpiresAt] = useState(
    toDateInput(row.validation.record?.expiresAt)
  );
  const [summary, setSummary] = useState(row.validation.record?.summary ?? "");
  const [notes, setNotes] = useState(row.validation.record?.notes ?? "");
  const [environment, setEnvironment] = useState(
    row.validation.record?.environment ?? "current"
  );
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/admin/integration-validations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to record validation");
      }

      setMessage(payload.message ?? "Validation recorded.");
      router.refresh();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Unable to record validation"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-foreground">{row.title}</div>
          <div className="mt-1 flex flex-wrap gap-2">
            <Badge variant="info">{row.integration.mode}</Badge>
            <Badge variant={badgeVariant(row.validation.kind)}>
              {row.validation.label}
            </Badge>
          </div>
        </div>
      </div>

      <div className="mt-3 text-sm text-muted-foreground">{row.integration.summary}</div>
      <div className="mt-1 text-xs text-muted-foreground">{row.integration.detail}</div>
      <div className="mt-2 text-xs text-muted-foreground">{row.validation.detail}</div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <Select
          label="Outcome"
          value={outcome}
          onChange={(event) =>
            setOutcome(event.target.value as "PASSED" | "WARNING" | "FAILED")
          }
          options={[
            { value: "PASSED", label: "Passed" },
            { value: "WARNING", label: "Pass with caution" },
            { value: "FAILED", label: "Failed" },
          ]}
        />
        <Input
          label="Validated"
          type="date"
          value={validatedAt}
          onChange={(event) => setValidatedAt(event.target.value)}
        />
        <Input
          label="Review again"
          type="date"
          value={expiresAt}
          onChange={(event) => setExpiresAt(event.target.value)}
          hint="Optional expiry or review date."
        />
        <Input
          label="Environment"
          value={environment}
          onChange={(event) => setEnvironment(event.target.value)}
          placeholder="current, demo, staging, production"
        />
        <div className="xl:col-span-1 flex items-end">
          <Button
            type="button"
            loading={loading}
            onClick={handleSave}
            className="w-full"
          >
            Record validation
          </Button>
        </div>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Textarea
          label="Validation summary"
          rows={2}
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
          placeholder="What was tested and what was the result?"
        />
        <Textarea
          label="Follow-up notes"
          rows={2}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Any caveats, scope limits, or next step."
        />
      </div>

      {message && <div className="mt-3 text-xs text-success">{message}</div>}
      {error && <div className="mt-3 text-xs text-destructive">{error}</div>}
      {row.validation.recommendedAction && (
        <div className="mt-3 rounded-lg border border-border bg-muted/40 px-3 py-3 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Next step:</span>{" "}
          {row.validation.recommendedAction}
        </div>
      )}
    </div>
  );
}

export function IntegrationValidationManager({ rows }: { rows: ValidationRow[] }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-muted/40 px-4 py-4 text-sm text-muted-foreground">
        Record the outcome of a controlled integration check here. This is the governance layer
        that distinguishes “configured” from “validated for use”.
      </div>

      {rows.map((row) => (
        <ValidationEditor key={row.id} row={row} />
      ))}
    </div>
  );
}
