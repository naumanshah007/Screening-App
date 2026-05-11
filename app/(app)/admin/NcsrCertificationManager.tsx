"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import type { NcsrAccessStatusRow } from "@/lib/integrations/colposcopy-registry/access";

function toDateInput(value: string | null | undefined) {
  return value ? value.slice(0, 10) : "";
}

function defaultCompletedDate() {
  return new Date().toISOString().slice(0, 10);
}

function defaultExpiryDate() {
  const nextYear = new Date();
  nextYear.setFullYear(nextYear.getFullYear() + 1);
  return nextYear.toISOString().slice(0, 10);
}

function badgeVariant(status: "ready" | "warning" | "blocked") {
  switch (status) {
    case "ready":
      return "low";
    case "warning":
      return "high";
    default:
      return "urgent";
  }
}

function CertificationRow({ row }: { row: NcsrAccessStatusRow }) {
  const router = useRouter();
  const [completedAt, setCompletedAt] = useState(
    toDateInput(row.access.certification?.completedAt) || defaultCompletedDate()
  );
  const [expiresAt, setExpiresAt] = useState(
    toDateInput(row.access.certification?.expiresAt) ||
      (row.access.certification ? "" : defaultExpiryDate())
  );
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSave() {
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/ncsr-certifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: row.userId,
          completedAt,
          expiresAt: expiresAt || null,
          notes: notes || null,
        }),
      });

      const payload = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to save certification");
      }

      setMessage(payload.message ?? "Certification saved.");
      router.refresh();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save certification"
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleRevoke() {
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/ncsr-certifications", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: row.userId,
          reason: notes || null,
        }),
      });

      const payload = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to revoke certification");
      }

      setMessage(payload.message ?? "Certification revoked.");
      router.refresh();
    } catch (revokeError) {
      setError(
        revokeError instanceof Error
          ? revokeError.message
          : "Unable to revoke certification"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-foreground">
            {row.name ?? row.email}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {row.role} · {row.email}
          </div>
        </div>
        <Badge variant={badgeVariant(row.access.status)}>{row.access.mode}</Badge>
      </div>

      <div className="mt-3 text-sm text-muted-foreground">{row.access.summary}</div>
      <div className="mt-1 text-xs text-muted-foreground">{row.access.detail}</div>

      {(row.access.certification?.completedAt || row.access.certification?.expiresAt) && (
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
          {row.access.certification?.completedAt && (
            <span>Completed {new Date(row.access.certification.completedAt).toLocaleDateString("en-NZ")}</span>
          )}
          {row.access.certification?.expiresAt && (
            <span>Expires {new Date(row.access.certification.expiresAt).toLocaleDateString("en-NZ")}</span>
          )}
        </div>
      )}

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Input
          label="Completed"
          type="date"
          value={completedAt}
          onChange={(event) => setCompletedAt(event.target.value)}
        />
        <Input
          label="Expires"
          type="date"
          value={expiresAt}
          onChange={(event) => setExpiresAt(event.target.value)}
          hint="Leave blank if no expiry is recorded."
        />
        <div className="md:col-span-2">
          <Textarea
            label="Admin note"
            rows={2}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Optional note about renewal, expiry, or validation."
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          size="sm"
          loading={loading}
          onClick={handleSave}
        >
          {row.access.certification ? "Renew / update training" : "Record training"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          loading={false}
          disabled={loading || !row.access.certification}
          onClick={handleRevoke}
        >
          Revoke active training
        </Button>
      </div>

      {message && <div className="mt-3 text-xs text-success">{message}</div>}
      {error && <div className="mt-3 text-xs text-destructive">{error}</div>}
      {row.access.nextStep && (
        <div className="mt-3 rounded-lg border border-border bg-muted/40 px-3 py-3 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Next step:</span>{" "}
          {row.access.nextStep}
        </div>
      )}
    </div>
  );
}

export function NcsrCertificationManager({
  rows,
}: {
  rows: NcsrAccessStatusRow[];
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-muted/40 px-4 py-4 text-sm text-muted-foreground">
        Use this panel to record, renew, or revoke the confidentiality and safety training required
        before a user can pull live NCSR history. Saving here updates the governed access state used
        by the NCSR workflow immediately.
      </div>

      {rows.map((row) => (
        <CertificationRow key={row.userId} row={row} />
      ))}
    </div>
  );
}
