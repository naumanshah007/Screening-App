"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { CaseRuleDefinition, CaseRuleReleaseDefinition } from "@/lib/cases/rule-policy";

// Layman-friendly, side-by-side editor for a case rule release draft.
// Left = current/base rule (read-only, plain English). Right = editable outputs.
// Only the recommendation ("what happens") is editable here; the conditions
// ("when it fires") are shown read-only — editing trigger conditions is a
// deliberate, separately-scoped follow-up to keep this surface safe.

type Recommendation = CaseRuleReleaseDefinition["defaultRecommendation"];
type Priority = Recommendation["priority"];

const PRIORITY_OPTIONS: Priority[] = [
  "P1",
  "P1_HSC",
  "P2",
  "P2_HSC",
  "P3",
  "P5",
  "INFO_REQUIRED",
  "REJECT",
  "DECLINE",
];

// Higher = more clinically urgent. Used to detect safety-relaxing edits.
const PRIORITY_URGENCY: Record<string, number> = {
  P1: 8,
  P1_HSC: 7,
  P2: 6,
  P2_HSC: 5,
  P3: 4,
  P5: 3,
  INFO_REQUIRED: 2,
  REJECT: 1,
  DECLINE: 1,
};

function describeConditions(rule: CaseRuleDefinition): string {
  if (rule.kind === "case_flag") return `When: ${rule.flagLabel || rule.flagName}`;
  if (rule.kind === "fact_threshold")
    return `When: ${rule.signalLabels.join(" or ")} with ${rule.thresholdLabel} ≥ ${rule.thresholdMin}`;
  if (rule.kind === "fact_any") return `When: any of ${rule.factLabels.join(", ")}`;
  if (rule.kind === "fact_all") return `When: all of ${rule.factLabels.join(", ")}`;
  const segments: string[] = [];
  if (rule.allFactLabels?.length) segments.push(`all of ${rule.allFactLabels.join(", ")}`);
  if (rule.anyFactLabels?.length) segments.push(`any of ${rule.anyFactLabels.join(", ")}`);
  if (rule.absentFactLabels?.length) segments.push(`none of ${rule.absentFactLabels.join(", ")}`);
  if (rule.thresholdLabel) segments.push(`${rule.thresholdLabel} in range`);
  return `When: ${segments.join("; ") || "always"}`;
}

// Returns true if `next` relaxes a safety control relative to `base`.
function isRelaxing(base: Recommendation, next: Recommendation): boolean {
  const lessUrgent =
    (PRIORITY_URGENCY[next.priority] ?? 0) < (PRIORITY_URGENCY[base.priority] ?? 0);
  const longerTarget =
    typeof next.targetDays === "number" &&
    typeof base.targetDays === "number" &&
    next.targetDays > base.targetDays;
  const reviewRemoved = base.requiresSmoReview === true && next.requiresSmoReview !== true;
  return lessUrgent || longerTarget || reviewRemoved;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function RuleCardEditor({
  releaseId,
  initialName,
  initialDescription,
  initialChangeNotes,
  baseDefinition,
}: {
  releaseId: string;
  initialName: string;
  initialDescription: string;
  initialChangeNotes: string;
  baseDefinition: CaseRuleReleaseDefinition;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [changeNotes, setChangeNotes] = useState(initialChangeNotes);
  const [definition, setDefinition] = useState<CaseRuleReleaseDefinition>(() => clone(baseDefinition));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const base = baseDefinition;

  // Which rules relax a safety control vs their base version.
  const relaxingCodes = useMemo(() => {
    const set = new Set<string>();
    if (isRelaxing(base.defaultRecommendation, definition.defaultRecommendation)) set.add("__default__");
    for (const rule of definition.rules) {
      const baseRule = base.rules.find((r) => r.code === rule.code);
      if (baseRule && isRelaxing(baseRule.recommendation, rule.recommendation)) set.add(rule.code);
    }
    return set;
  }, [base, definition]);

  const hasRelaxing = relaxingCodes.size > 0;

  function updateRecommendation(code: string | "__default__", patch: Partial<Recommendation>) {
    setDefinition((prev) => {
      const next = clone(prev);
      if (code === "__default__") {
        next.defaultRecommendation = { ...next.defaultRecommendation, ...patch };
      } else {
        const rule = next.rules.find((r) => r.code === code);
        if (rule) rule.recommendation = { ...rule.recommendation, ...patch };
      }
      return next;
    });
  }

  function updateRuleMeta(code: string, patch: { title?: string; impact?: string }) {
    setDefinition((prev) => {
      const next = clone(prev);
      const rule = next.rules.find((r) => r.code === code);
      if (rule) Object.assign(rule, patch);
      return next;
    });
  }

  async function handleSave() {
    if (hasRelaxing && !changeNotes.trim()) {
      setError("This change relaxes a safety control. Add change notes explaining why before saving.");
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/case-rules/${releaseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          changeNotes,
          definitionJson: JSON.stringify(definition),
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Unable to save draft");
      setMessage("Draft saved. Review state cleared until it is re-reviewed.");
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save draft");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3">
        <label className="text-sm font-medium text-foreground">
          Release name
          <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
        </label>
        <label className="text-sm font-medium text-foreground">
          Description
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1" rows={2} />
        </label>
        <label className="text-sm font-medium text-foreground">
          Change notes {hasRelaxing && <span className="text-danger">(required — this change relaxes a safety control)</span>}
          <Textarea value={changeNotes} onChange={(e) => setChangeNotes(e.target.value)} className="mt-1" rows={2} />
        </label>
      </div>

      {hasRelaxing && (
        <div className="flex items-start gap-2 rounded-lg border border-danger/40 bg-danger/5 px-4 py-3 text-sm text-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 text-danger" />
          <div>
            One or more edits <strong>relax a safety control</strong> (less urgent priority, longer target, or review removed).
            This draft still requires reviewer confirmation and a passing regression suite before it can be published.
          </div>
        </div>
      )}

      <RecommendationEditor
        heading="Default outcome (when no rule matches)"
        code="__default__"
        base={base.defaultRecommendation}
        current={definition.defaultRecommendation}
        conditions="When: no specific rule matches this case"
        relaxing={relaxingCodes.has("__default__")}
        onChange={(patch) => updateRecommendation("__default__", patch)}
      />

      {definition.rules.map((rule) => {
        const baseRule = base.rules.find((r) => r.code === rule.code);
        return (
          <div key={rule.code} className="rounded-xl border border-border">
            <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/30 px-4 py-2">
              <Badge variant="default">{rule.code}</Badge>
              <input
                value={rule.title}
                onChange={(e) => updateRuleMeta(rule.code, { title: e.target.value })}
                className="flex-1 min-w-40 bg-transparent text-sm font-medium text-foreground outline-none"
              />
            </div>
            <div className="px-4 py-3">
              <RecommendationEditor
                heading="Recommendation"
                code={rule.code}
                base={baseRule?.recommendation ?? rule.recommendation}
                current={rule.recommendation}
                conditions={describeConditions(rule)}
                relaxing={relaxingCodes.has(rule.code)}
                onChange={(patch) => updateRecommendation(rule.code, patch)}
              />
            </div>
          </div>
        );
      })}

      {error && <div className="rounded-lg border border-danger/40 bg-danger/5 px-4 py-2 text-sm text-danger">{error}</div>}
      {message && <div className="rounded-lg border border-success/40 bg-success/5 px-4 py-2 text-sm text-foreground">{message}</div>}

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={loading}>
          {loading ? "Saving…" : "Save draft"}
        </Button>
        <span className="text-xs text-muted-foreground">Saving clears review state until re-reviewed.</span>
      </div>
    </div>
  );
}

function RecommendationEditor({
  heading,
  base,
  current,
  conditions,
  relaxing,
  onChange,
}: {
  heading: string;
  code: string;
  base: Recommendation;
  current: Recommendation;
  conditions: string;
  relaxing: boolean;
  onChange: (patch: Partial<Recommendation>) => void;
}) {
  const changed = (field: keyof Recommendation) => JSON.stringify(base[field]) !== JSON.stringify(current[field]);

  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{heading}</div>
      <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">{conditions}</div>
      <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* LEFT — current base (read-only) */}
        <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
          <div className="text-xs font-semibold text-muted-foreground">Current (default)</div>
          <div><Badge variant="info">{base.priority}</Badge></div>
          <FieldRow label="Category" value={base.category} />
          <FieldRow label="Outcome" value={base.outcome} />
          <FieldRow label="Rationale" value={base.rationale} />
          <FieldRow label="SMO review" value={base.requiresSmoReview ? "Required" : "Not required"} />
          <FieldRow label="Target days" value={base.targetDays != null ? String(base.targetDays) : "By priority"} />
        </div>

        {/* RIGHT — editable */}
        <div className={`space-y-2 rounded-lg border p-3 ${relaxing ? "border-danger/50 bg-danger/5" : "border-brand-500/40 bg-brand-500/5"}`}>
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-foreground">Your change</div>
            {relaxing && <span className="text-xs font-medium text-danger">Relaxes safety</span>}
          </div>
          <label className="block text-xs text-muted-foreground">
            Priority
            <select
              value={current.priority}
              onChange={(e) => onChange({ priority: e.target.value as Priority })}
              className={`mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm text-foreground ${changed("priority") ? "border-brand-500" : "border-border"}`}
            >
              {PRIORITY_OPTIONS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </label>
          <EditRow label="Category" value={current.category} changed={changed("category")} onChange={(v) => onChange({ category: v })} />
          <EditRow label="Outcome" value={current.outcome} changed={changed("outcome")} onChange={(v) => onChange({ outcome: v })} />
          <EditRow label="Rationale" value={current.rationale} changed={changed("rationale")} onChange={(v) => onChange({ rationale: v })} textarea />
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={current.requiresSmoReview ?? false}
              onChange={(e) => onChange({ requiresSmoReview: e.target.checked })}
            />
            Requires SMO review
          </label>
          <label className="block text-xs text-muted-foreground">
            Target days (blank = by priority)
            <input
              type="number"
              min={0}
              value={current.targetDays ?? ""}
              onChange={(e) => onChange({ targetDays: e.target.value === "" ? undefined : Number(e.target.value) })}
              className={`mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm text-foreground ${changed("targetDays") ? "border-brand-500" : "border-border"}`}
            />
          </label>
        </div>
      </div>
    </div>
  );
}

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-xs">
      <span className="text-muted-foreground">{label}: </span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}

function EditRow({
  label,
  value,
  changed,
  onChange,
  textarea = false,
}: {
  label: string;
  value: string;
  changed: boolean;
  onChange: (value: string) => void;
  textarea?: boolean;
}) {
  const cls = `mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm text-foreground ${changed ? "border-brand-500" : "border-border"}`;
  return (
    <label className="block text-xs text-muted-foreground">
      {label}
      {textarea ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={2} className={cls} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} className={cls} />
      )}
    </label>
  );
}
