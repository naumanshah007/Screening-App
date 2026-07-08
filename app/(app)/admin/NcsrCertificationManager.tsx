"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { SlideOver } from "@/components/ui/slide-over";
import { ManagerShell } from "@/components/admin/ManagerShell";
import { useConfirm } from "@/lib/hooks/useConfirm";
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
  return status === "ready" ? "low" : status === "warning" ? "high" : "urgent";
}

// ── Compact list row ────────────────────────────────────────────────────────
function CertificationListRow({ row, onManage }: { row: NcsrAccessStatusRow; onManage: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-foreground">{row.name ?? row.email}</div>
        <div className="truncate text-xs text-muted-foreground">{row.role} · {row.email}</div>
      </div>
      <div className="hidden items-center gap-2 sm:flex">
        <Badge variant={badgeVariant(row.access.status)}>{row.access.mode}</Badge>
        {row.access.certification?.expiresAt && (
          <span className="text-xs text-muted-foreground">
            exp {new Date(row.access.certification.expiresAt).toLocaleDateString("en-NZ")}
          </span>
        )}
      </div>
      <Button type="button" size="sm" variant="outline" onClick={onManage} className="flex-shrink-0">
        Manage
      </Button>
    </div>
  );
}

// ── Slide-over editor ───────────────────────────────────────────────────────
function CertificationEditor({
  row,
  confirm,
}: {
  row: NcsrAccessStatusRow;
  confirm: (o: { title?: string; description: string; confirmLabel?: string; variant?: "danger" | "primary" }) => Promise<boolean>;
}) {
  const router = useRouter();
  const [completedAt, setCompletedAt] = useState(
    toDateInput(row.access.certification?.completedAt) || defaultCompletedDate()
  );
  const [expiresAt, setExpiresAt] = useState(
    toDateInput(row.access.certification?.expiresAt) || (row.access.certification ? "" : defaultExpiryDate())
  );
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/ncsr-certifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: row.userId, completedAt, expiresAt: expiresAt || null, notes: notes || null }),
      });
      const payload = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) throw new Error(payload.error ?? "Unable to save certification");
      toast.success(payload.message ?? "Certification saved.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Unable to save certification");
    } finally {
      setLoading(false);
    }
  }

  async function handleRevoke() {
    const ok = await confirm({
      title: "Revoke training?",
      description: `Revoke NCSR access for ${row.name ?? row.email}? They will be blocked from pulling live registry history until re-certified.`,
      confirmLabel: "Revoke access",
    });
    if (!ok) return;
    setLoading(true);
    try {
      const response = await fetch("/api/admin/ncsr-certifications", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: row.userId, reason: notes || null }),
      });
      const payload = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) throw new Error(payload.error ?? "Unable to revoke certification");
      toast.success(payload.message ?? "Certification revoked.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Unable to revoke certification");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <Badge variant={badgeVariant(row.access.status)}>{row.access.mode}</Badge>
        <p className="mt-3 text-sm text-muted-foreground">{row.access.summary}</p>
        <p className="mt-1 text-xs text-muted-foreground">{row.access.detail}</p>
      </div>

      {(row.access.certification?.completedAt || row.access.certification?.expiresAt) && (
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          {row.access.certification?.completedAt && (
            <span>Completed {new Date(row.access.certification.completedAt).toLocaleDateString("en-NZ")}</span>
          )}
          {row.access.certification?.expiresAt && (
            <span>Expires {new Date(row.access.certification.expiresAt).toLocaleDateString("en-NZ")}</span>
          )}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Completed" type="date" value={completedAt} onChange={(e) => setCompletedAt(e.target.value)} />
        <Input
          label="Expires"
          type="date"
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
          hint="Leave blank if no expiry."
        />
      </div>
      <Textarea
        label="Admin note"
        rows={2}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Optional note about renewal, expiry, or validation."
      />

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
        <Button type="button" size="sm" loading={loading} onClick={handleSave}>
          {row.access.certification ? "Renew / update training" : "Record training"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="danger"
          disabled={loading || !row.access.certification}
          onClick={handleRevoke}
        >
          Revoke training
        </Button>
      </div>

      {row.access.nextStep && (
        <div className="rounded-lg border border-border bg-muted/40 px-3 py-3 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Next step:</span> {row.access.nextStep}
        </div>
      )}
    </div>
  );
}

export function NcsrCertificationManager({ rows }: { rows: NcsrAccessStatusRow[] }) {
  const { confirm, ConfirmComponent } = useConfirm();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = rows.find((r) => r.userId === selectedId) ?? null;

  function matchesFilter(row: NcsrAccessStatusRow, id: string) {
    return row.access.status === id;
  }

  return (
    <>
      <ManagerShell
        items={rows}
        getKey={(r) => r.userId}
        searchText={(r) => `${r.name ?? ""} ${r.email} ${r.role}`}
        searchPlaceholder="Search by name or email"
        filters={[
          { id: "blocked", label: "Blocked" },
          { id: "warning", label: "Expiring soon" },
          { id: "ready", label: "Certified" },
        ]}
        matchesFilter={matchesFilter}
        emptyIcon={ShieldCheck}
        emptyTitle="No users match"
        emptyDescription="Try a different search or filter."
        intro={
          <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            Record, renew, or revoke the confidentiality and safety training required before a user can
            pull live NCSR history. Saving updates the governed access state immediately.
          </div>
        }
        renderRow={(r) => <CertificationListRow row={r} onManage={() => setSelectedId(r.userId)} />}
      />

      <SlideOver
        open={selected != null}
        onClose={() => setSelectedId(null)}
        title={selected?.name ?? selected?.email ?? "User"}
        subtitle={selected ? `${selected.role} · ${selected.email}` : undefined}
        width="lg"
      >
        {selected && <CertificationEditor key={selected.userId} row={selected} confirm={confirm} />}
      </SlideOver>

      {ConfirmComponent}
    </>
  );
}
