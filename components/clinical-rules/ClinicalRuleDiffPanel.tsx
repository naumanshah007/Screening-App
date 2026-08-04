"use client";

import { useState } from "react";
import { GitCompare, Network } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import type { diffClinicalRuleSnapshots } from "@/lib/clinical-rules/diff";

type SnapshotDiff = ReturnType<typeof diffClinicalRuleSnapshots>;

type ComparedDiff = {
  before: { id: string; displayVersion: string };
  after: { id: string; displayVersion: string };
  diff: SnapshotDiff;
};

export function ClinicalRuleDiffPanel({
  currentVersionId,
  currentVersionDisplay,
  versions,
  initialComparison,
}: {
  currentVersionId: string;
  currentVersionDisplay: string;
  versions: Array<{ id: string; displayVersion: string; status: string }>;
  initialComparison?: ComparedDiff | null;
}) {
  const [compareVersionId, setCompareVersionId] = useState(initialComparison?.before.id ?? versions[0]?.id ?? "");
  const [comparison, setComparison] = useState<ComparedDiff | null>(initialComparison ?? null);
  const [loading, setLoading] = useState(false);

  async function compare() {
    if (!compareVersionId) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/clinical-rules/versions/${currentVersionId}/diff`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ compareVersionId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to compare versions");
      setComparison(result as ComparedDiff);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to compare versions");
    } finally {
      setLoading(false);
    }
  }

  if (versions.length === 0 && !comparison) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center">
        <GitCompare className="mx-auto h-8 w-8 text-brand-600" />
        <h3 className="mt-3 font-semibold">Initial source import</h3>
        <p className="mt-2 text-sm text-muted-foreground">Clone or publish another version to enable governed before/after comparison.</p>
      </div>
    );
  }

  const diff = comparison?.diff;
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-slate-50 p-4 sm:flex-row sm:items-end">
        <Select
          label="Compare from"
          value={compareVersionId}
          onChange={(event) => setCompareVersionId(event.target.value)}
          options={versions.map((version) => ({ value: version.id, label: `${version.displayVersion} · ${version.status}` }))}
        />
        <div className="pb-0.5 text-sm font-semibold text-muted-foreground">→ {currentVersionDisplay}</div>
        <Button loading={loading} disabled={!compareVersionId} onClick={() => void compare()} icon={<GitCompare className="h-4 w-4" />}>Compare</Button>
      </div>

      {diff && comparison && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <DiffMetric label="Rules" added={diff.summary.rulesAdded} changed={diff.summary.rulesChanged} removed={diff.summary.rulesRemoved} />
            <DiffMetric label="Nodes" added={diff.summary.nodesAdded} changed={diff.summary.nodesChanged} removed={diff.summary.nodesRemoved} />
            <DiffMetric label="Edges" added={diff.summary.edgesAdded} changed={diff.summary.edgesChanged} removed={diff.summary.edgesRemoved} />
            <DiffMetric label="Layouts" added={0} changed={diff.summary.layoutViewsChanged} removed={0} />
          </div>

          <div className="rounded-xl border border-border p-4">
            <div className="flex items-center gap-2 font-semibold"><Network className="h-4 w-4 text-brand-600" />Visual graph change map</div>
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground"><span><i className="mr-1 inline-block h-2.5 w-2.5 rounded bg-emerald-500" />Added</span><span><i className="mr-1 inline-block h-2.5 w-2.5 rounded bg-amber-500" />Modified</span><span><i className="mr-1 inline-block h-2.5 w-2.5 rounded bg-red-500" />Removed</span><span><i className="mr-1 inline-block h-2.5 w-2.5 rounded bg-slate-300" />Unchanged nodes are intentionally omitted</span></div>
            <div className="mt-4 grid gap-3 lg:grid-cols-3">
              <ChangeGroup title="Added nodes" colour="border-emerald-300 bg-emerald-50" items={diff.nodes.added.map((node) => ({ id: node.stableNodeId, label: node.label }))} />
              <ChangeGroup title="Modified nodes" colour="border-amber-300 bg-amber-50" items={diff.nodes.changed.map((node) => ({ id: node.id, label: node.fields.map((field) => field.field).join(", ") }))} />
              <ChangeGroup title="Removed nodes" colour="border-red-300 bg-red-50" items={diff.nodes.removed.map((node) => ({ id: node.stableNodeId, label: node.label }))} />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <ChangeTable title="Rule changes" added={diff.rules.added.map((rule) => rule.stableRuleId)} changed={diff.rules.changed.map((rule) => `${rule.id}: ${rule.fields.map((field) => field.field).join(", ")}`)} removed={diff.rules.removed.map((rule) => rule.stableRuleId)} />
            <ChangeTable title="Edge changes" added={diff.edges.added.map((edge) => edge.stableEdgeId)} changed={diff.edges.changed.map((edge) => `${edge.id}: ${edge.fields.map((field) => field.field).join(", ")}`)} removed={diff.edges.removed.map((edge) => edge.stableEdgeId)} />
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
              <div className="font-semibold">Affected synthetic cases</div>
              <p className="mt-2">Golden-case impact is reported only after both snapshots contain governed executable expressions and conformance-test identifiers. This source-text draft is blocked, so the studio does not infer case impact.</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function DiffMetric({ label, added, changed, removed }: { label: string; added: number; changed: number; removed: number }) {
  return <div className="rounded-xl border border-border bg-white p-4"><div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div><div className="mt-2 flex gap-3 text-sm"><span className="text-emerald-700">+{added}</span><span className="text-amber-700">~{changed}</span><span className="text-red-700">−{removed}</span></div></div>;
}

function ChangeGroup({ title, colour, items }: { title: string; colour: string; items: Array<{ id: string; label: string }> }) {
  return <div><div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</div><div className="mt-2 max-h-56 space-y-2 overflow-y-auto">{items.length === 0 ? <div className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">No changes</div> : items.map((item) => <div key={item.id} className={`rounded-lg border p-3 text-xs ${colour}`}><div className="break-all font-mono font-bold">{item.id}</div><div className="mt-1 line-clamp-2">{item.label}</div></div>)}</div></div>;
}

function ChangeTable({ title, added, changed, removed }: { title: string; added: string[]; changed: string[]; removed: string[] }) {
  const rows = [["Added", added, "text-emerald-700"], ["Modified", changed, "text-amber-700"], ["Removed", removed, "text-red-700"]] as const;
  return <div className="rounded-xl border border-border p-4"><div className="font-semibold">{title}</div><div className="mt-3 space-y-3">{rows.map(([label, items, colour]) => <div key={label}><div className={`text-xs font-bold ${colour}`}>{label} ({items.length})</div><div className="mt-1 max-h-32 overflow-y-auto text-xs leading-5 text-muted-foreground">{items.length ? items.map((item) => <div key={item} className="break-all">{item}</div>) : "None"}</div></div>)}</div></div>;
}
