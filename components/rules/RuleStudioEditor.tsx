"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Code2,
  Copy,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";

import { Badge, PriorityBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import type { CaseRuleDefinition } from "@/lib/cases/rule-policy";
import { RULE_KINDS, TRIAGE_PRIORITIES } from "@/lib/cases/rule-vocabulary";
import { cn } from "@/lib/utils";

type Recommendation = CaseRuleDefinition["recommendation"];

type EditableDefinition = {
  releaseKind: string;
  serviceLine: "COLPOSCOPY" | "GYNAECOLOGY";
  sourceOfTruth: string[];
  notes: string[];
  defaultRecommendation: Recommendation;
  rules: CaseRuleDefinition[];
};

const CONDITION_LABELS: Record<CaseRuleDefinition["kind"], string> = {
  case_flag: "High-suspicion case flag",
  fact_any: "Any selected signal",
  fact_all: "All selected signals",
  compound: "Grouped signals",
  fact_threshold: "Signal plus number",
};

function splitLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function joinLines(value: string[]) {
  return value.join("\n");
}

function recommendationIsComplete(rec: Recommendation) {
  return (
    rec.category.trim().length > 0 &&
    rec.outcome.trim().length > 0 &&
    rec.rationale.trim().length > 0
  );
}

function ruleHasCondition(rule: CaseRuleDefinition) {
  if (rule.kind === "case_flag") return true;
  if (rule.kind === "fact_any" || rule.kind === "fact_all") {
    return rule.factLabels.length > 0;
  }
  if (rule.kind === "fact_threshold") {
    return (
      rule.signalLabels.length > 0 &&
      rule.thresholdLabel.trim().length > 0 &&
      Number.isFinite(rule.thresholdMin)
    );
  }
  return Boolean(
    rule.allFactLabels?.length ||
      rule.anyFactLabels?.length ||
      rule.absentFactLabels?.length ||
      rule.thresholdLabel
  );
}

function conditionSummary(rule: CaseRuleDefinition) {
  if (rule.kind === "case_flag") {
    return "High suspicion cancer flag";
  }

  if (rule.kind === "fact_any") {
    return rule.factLabels.length
      ? `Any of: ${rule.factLabels.join(", ")}`
      : "No signals selected";
  }

  if (rule.kind === "fact_all") {
    return rule.factLabels.length
      ? `All of: ${rule.factLabels.join(", ")}`
      : "No signals selected";
  }

  if (rule.kind === "fact_threshold") {
    const signals = rule.signalLabels.length
      ? rule.signalLabels.join(", ")
      : "No signal";
    const threshold = rule.thresholdLabel
      ? `${rule.thresholdLabel} >= ${rule.thresholdMin}`
      : "No threshold";
    return `${signals}; ${threshold}`;
  }

  const segments: string[] = [];
  if (rule.allFactLabels?.length) {
    segments.push(`All: ${rule.allFactLabels.join(", ")}`);
  }
  if (rule.anyFactLabels?.length) {
    segments.push(`Any: ${rule.anyFactLabels.join(", ")}`);
  }
  if (rule.absentFactLabels?.length) {
    segments.push(`Absent: ${rule.absentFactLabels.join(", ")}`);
  }
  if (rule.thresholdLabel) {
    const range = [
      rule.thresholdMin !== undefined ? `min ${rule.thresholdMin}` : "",
      rule.thresholdMax !== undefined ? `max ${rule.thresholdMax}` : "",
    ]
      .filter(Boolean)
      .join(", ");
    segments.push(`${rule.thresholdLabel}${range ? ` (${range})` : ""}`);
  }
  return segments.length ? segments.join("; ") : "No condition set";
}

function ruleIssues(rule: CaseRuleDefinition, index: number) {
  const label = rule.code.trim() || `Rule ${index + 1}`;
  const issues: string[] = [];

  if (!rule.code.trim()) issues.push(`Rule ${index + 1} needs a code`);
  if (!rule.title.trim()) issues.push(`${label} needs a title`);
  if (!rule.impact.trim()) issues.push(`${label} needs an impact summary`);
  if (!ruleHasCondition(rule)) issues.push(`${label} needs a matching condition`);
  if (!recommendationIsComplete(rule.recommendation)) {
    issues.push(`${label} needs complete outcome text`);
  }

  return issues;
}

function draftIssues(args: {
  name: string;
  changeNotes: string;
  sourceOfTruth: string[];
  defaultRec: Recommendation;
  rules: CaseRuleDefinition[];
}) {
  const issues: string[] = [];
  if (!args.name.trim()) issues.push("Release name is required");
  if (!args.changeNotes.trim()) {
    issues.push("Change notes are required before review");
  }
  if (args.sourceOfTruth.length === 0) {
    issues.push("At least one source reference is required");
  }
  if (!recommendationIsComplete(args.defaultRec)) {
    issues.push("Default outcome needs category, outcome, and rationale");
  }

  const seenCodes = new Set<string>();
  args.rules.forEach((rule, index) => {
    const code = rule.code.trim().toUpperCase();
    if (code) {
      if (seenCodes.has(code)) {
        issues.push(`Rule code ${rule.code} is duplicated`);
      }
      seenCodes.add(code);
    }
    issues.push(...ruleIssues(rule, index));
  });

  return issues;
}

function FactPicker({
  label,
  hint,
  options,
  selected,
  onChange,
}: {
  label: string;
  hint?: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const available = options.filter((option) => !selected.includes(option));

  return (
    <div className="space-y-2">
      <div>
        <div className="text-sm font-medium text-foreground">{label}</div>
        {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {selected.length === 0 ? (
          <span className="text-xs text-muted-foreground">No signals selected</span>
        ) : (
          selected.map((item) => (
            <span
              key={item}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-foreground"
            >
              {item}
              <button
                type="button"
                onClick={() => onChange(selected.filter((value) => value !== item))}
                aria-label={`Remove ${item}`}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))
        )}
      </div>
      {available.length > 0 && (
        <Select
          value=""
          onChange={(event) => {
            if (event.target.value) onChange([...selected, event.target.value]);
          }}
        >
          <option value="">Add signal...</option>
          {available.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>
      )}
    </div>
  );
}

function RecommendationFields({
  rec,
  onChange,
}: {
  rec: Recommendation;
  onChange: (next: Recommendation) => void;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Select
        label="Priority"
        value={rec.priority}
        onChange={(event) =>
          onChange({ ...rec, priority: event.target.value as Recommendation["priority"] })
        }
      >
        {TRIAGE_PRIORITIES.map((priority) => (
          <option key={priority} value={priority}>
            {priority}
          </option>
        ))}
      </Select>
      <Input
        label="Target days"
        type="number"
        value={rec.targetDays ?? ""}
        placeholder="Optional"
        onChange={(event) =>
          onChange({
            ...rec,
            targetDays: event.target.value ? Number(event.target.value) : undefined,
          })
        }
      />
      <div className="md:col-span-2">
        <Input
          label="Category"
          value={rec.category}
          onChange={(event) => onChange({ ...rec, category: event.target.value })}
        />
      </div>
      <div className="md:col-span-2">
        <Input
          label="Outcome"
          value={rec.outcome}
          onChange={(event) => onChange({ ...rec, outcome: event.target.value })}
        />
      </div>
      <div className="md:col-span-2">
        <Textarea
          label="Rationale"
          rows={3}
          value={rec.rationale}
          onChange={(event) => onChange({ ...rec, rationale: event.target.value })}
        />
      </div>
      <label className="flex items-center gap-2 text-sm font-medium text-foreground">
        <input
          type="checkbox"
          checked={Boolean(rec.requiresSmoReview)}
          onChange={(event) =>
            onChange({ ...rec, requiresSmoReview: event.target.checked })
          }
          className="h-4 w-4 rounded border-border"
        />
        Requires SMO review
      </label>
    </div>
  );
}

function coerceKind(
  rule: CaseRuleDefinition,
  kind: CaseRuleDefinition["kind"]
): CaseRuleDefinition {
  const base = {
    code: rule.code,
    title: rule.title,
    impact: rule.impact,
    recommendation: rule.recommendation,
  };

  switch (kind) {
    case "case_flag":
      return {
        ...base,
        kind,
        flagName: "highSuspicionCancer",
        flagLabel: "Case flag: high suspicion cancer",
      };
    case "fact_any":
    case "fact_all":
      return { ...base, kind, factLabels: [] };
    case "compound":
      return {
        ...base,
        kind,
        allFactLabels: [],
        anyFactLabels: [],
        absentFactLabels: [],
      };
    case "fact_threshold":
      return {
        ...base,
        kind,
        signalLabels: [],
        thresholdLabel: "",
        thresholdMin: 0,
      };
  }
}

function blankRule(position: number): CaseRuleDefinition {
  return {
    code: `NEW-${position}`,
    title: "New rule",
    impact: "",
    kind: "fact_any",
    factLabels: [],
    recommendation: {
      priority: "P3",
      category: "",
      outcome: "",
      rationale: "",
    },
  };
}

function RuleList({
  rules,
  selectedIndex,
  onSelect,
}: {
  rules: CaseRuleDefinition[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}) {
  return (
    <div className="space-y-2">
      {rules.map((rule, index) => {
        const issues = ruleIssues(rule, index);
        const selected = selectedIndex === index;
        return (
          <button
            key={`${rule.code}-${index}`}
            type="button"
            onClick={() => onSelect(index)}
            className={cn(
              "w-full rounded-lg border px-3 py-3 text-left transition-colors",
              selected
                ? "border-brand-500 bg-brand-50/50 dark:bg-brand-950/30"
                : "border-border bg-card hover:bg-muted/40"
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="default">{rule.code || "No code"}</Badge>
                  <span className="text-xs text-muted-foreground">
                    #{index + 1}
                  </span>
                </div>
                <div className="mt-1 truncate text-sm font-medium text-foreground">
                  {rule.title || "Untitled rule"}
                </div>
              </div>
              {issues.length === 0 ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-success" />
              ) : (
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-warn" />
              )}
            </div>
            <div className="mt-2 line-clamp-2 text-xs text-muted-foreground">
              {conditionSummary(rule)}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <PriorityBadge priority={rule.recommendation.priority} />
              {rule.recommendation.targetDays !== undefined && (
                <span className="text-xs text-muted-foreground">
                  {rule.recommendation.targetDays} days
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function RuleEditor({
  rule,
  index,
  total,
  factLabels,
  thresholdLabels,
  onChange,
  onDelete,
  onDuplicate,
  onMove,
}: {
  rule: CaseRuleDefinition;
  index: number;
  total: number;
  factLabels: string[];
  thresholdLabels: string[];
  onChange: (next: CaseRuleDefinition) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  const update = (patch: Partial<CaseRuleDefinition>) =>
    onChange({ ...rule, ...patch } as CaseRuleDefinition);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Selected rule
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge variant="default">#{index + 1}</Badge>
            <Badge variant="info">{CONDITION_LABELS[rule.kind]}</Badge>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <Button
            size="xs"
            variant="ghost"
            disabled={index === 0}
            onClick={() => onMove(-1)}
            aria-label="Move rule earlier"
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button
            size="xs"
            variant="ghost"
            disabled={index === total - 1}
            onClick={() => onMove(1)}
            aria-label="Move rule later"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
          <Button size="xs" variant="ghost" onClick={onDuplicate}>
            <Copy className="h-4 w-4" />
            Duplicate
          </Button>
          <Button
            size="xs"
            variant="ghost"
            disabled={total <= 1}
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
            Delete
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <Input
            label="Rule code"
            value={rule.code}
            onChange={(event) => update({ code: event.target.value })}
            className="font-mono"
          />
          <div className="md:col-span-2">
            <Input
              label="Rule title"
              value={rule.title}
              onChange={(event) => update({ title: event.target.value })}
            />
          </div>
          <div className="md:col-span-3">
            <Textarea
              label="Reviewer impact summary"
              rows={3}
              value={rule.impact}
              onChange={(event) => update({ impact: event.target.value })}
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-foreground">
              Matching condition
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Rules are evaluated in list order. Put urgent or narrow rules earlier.
            </div>
          </div>
          <Select
            value={rule.kind}
            onChange={(event) =>
              onChange(coerceKind(rule, event.target.value as CaseRuleDefinition["kind"]))
            }
            className="w-full md:w-72"
            aria-label="Condition type"
          >
            {RULE_KINDS.map((kind) => (
              <option key={kind.value} value={kind.value}>
                {CONDITION_LABELS[kind.value]}
              </option>
            ))}
          </Select>
        </div>

        {rule.kind === "case_flag" && (
          <div className="rounded-lg border border-border bg-card px-3 py-3 text-sm text-muted-foreground">
            Applies when the case has the high-suspicion cancer flag.
          </div>
        )}

        {(rule.kind === "fact_any" || rule.kind === "fact_all") && (
          <FactPicker
            label={rule.kind === "fact_any" ? "Applies when any selected signal is present" : "Applies when all selected signals are present"}
            options={factLabels}
            selected={rule.factLabels}
            onChange={(factLabelsNext) => update({ factLabels: factLabelsNext })}
          />
        )}

        {rule.kind === "compound" && (
          <div className="grid gap-4">
            <FactPicker
              label="Required signals"
              hint="Every selected signal must be present."
              options={factLabels}
              selected={rule.allFactLabels ?? []}
              onChange={(value) => update({ allFactLabels: value })}
            />
            <FactPicker
              label="Optional signal group"
              hint="At least one selected signal must be present."
              options={factLabels}
              selected={rule.anyFactLabels ?? []}
              onChange={(value) => update({ anyFactLabels: value })}
            />
            <FactPicker
              label="Excluding signals"
              hint="The rule will not match when any selected signal is present."
              options={factLabels}
              selected={rule.absentFactLabels ?? []}
              onChange={(value) => update({ absentFactLabels: value })}
            />
            <div className="grid gap-3 md:grid-cols-3">
              <Select
                label="Numeric field"
                value={rule.thresholdLabel ?? ""}
                onChange={(event) =>
                  update({ thresholdLabel: event.target.value || undefined })
                }
              >
                <option value="">None</option>
                {thresholdLabels.map((threshold) => (
                  <option key={threshold} value={threshold}>
                    {threshold}
                  </option>
                ))}
              </Select>
              <Input
                label="Minimum"
                type="number"
                value={rule.thresholdMin ?? ""}
                onChange={(event) =>
                  update({
                    thresholdMin: event.target.value
                      ? Number(event.target.value)
                      : undefined,
                  })
                }
              />
              <Input
                label="Maximum"
                type="number"
                value={rule.thresholdMax ?? ""}
                onChange={(event) =>
                  update({
                    thresholdMax: event.target.value
                      ? Number(event.target.value)
                      : undefined,
                  })
                }
              />
            </div>
          </div>
        )}

        {rule.kind === "fact_threshold" && (
          <div className="grid gap-4">
            <FactPicker
              label="Signal group"
              options={factLabels}
              selected={rule.signalLabels}
              onChange={(value) => update({ signalLabels: value })}
            />
            <div className="grid gap-3 md:grid-cols-2">
              <Select
                label="Numeric field"
                value={rule.thresholdLabel}
                onChange={(event) => update({ thresholdLabel: event.target.value })}
              >
                <option value="">Select field</option>
                {thresholdLabels.map((threshold) => (
                  <option key={threshold} value={threshold}>
                    {threshold}
                  </option>
                ))}
              </Select>
              <Input
                label="Minimum value"
                type="number"
                value={rule.thresholdMin}
                onChange={(event) =>
                  update({ thresholdMin: Number(event.target.value) })
                }
              />
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <div>
          <div className="text-sm font-semibold text-foreground">
            Outcome when matched
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            This is what downstream grading and review queues will see.
          </div>
        </div>
        <RecommendationFields
          rec={rule.recommendation}
          onChange={(recommendation) => update({ recommendation })}
        />
      </div>
    </div>
  );
}

export function RuleStudioEditor({
  releaseId,
  factLabels,
  thresholdLabels,
  initialName,
  initialDescription,
  initialChangeNotes,
  initialDefinition,
}: {
  releaseId: string;
  factLabels: string[];
  thresholdLabels: string[];
  initialName: string;
  initialDescription: string;
  initialChangeNotes: string;
  initialDefinition: EditableDefinition;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [changeNotes, setChangeNotes] = useState(initialChangeNotes);
  const [sourceOfTruthText, setSourceOfTruthText] = useState(
    joinLines(initialDefinition.sourceOfTruth)
  );
  const [notesText, setNotesText] = useState(joinLines(initialDefinition.notes));
  const [defaultRec, setDefaultRec] = useState<Recommendation>(
    initialDefinition.defaultRecommendation
  );
  const [rules, setRules] = useState<CaseRuleDefinition[]>(
    initialDefinition.rules.length > 0 ? initialDefinition.rules : [blankRule(1)]
  );
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showJson, setShowJson] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const sourceOfTruth = useMemo(
    () => splitLines(sourceOfTruthText),
    [sourceOfTruthText]
  );
  const notes = useMemo(() => splitLines(notesText), [notesText]);
  const issues = useMemo(
    () =>
      draftIssues({
        name,
        changeNotes,
        sourceOfTruth,
        defaultRec,
        rules,
      }),
    [name, changeNotes, sourceOfTruth, defaultRec, rules]
  );

  const definitionJson = useMemo(
    () =>
      JSON.stringify(
        {
          releaseKind: initialDefinition.releaseKind,
          serviceLine: initialDefinition.serviceLine,
          sourceOfTruth,
          notes,
          defaultRecommendation: defaultRec,
          rules,
        },
        null,
        2
      ),
    [initialDefinition.releaseKind, initialDefinition.serviceLine, sourceOfTruth, notes, defaultRec, rules]
  );

  const selectedRule = rules[Math.min(selectedIndex, rules.length - 1)];

  const setRuleAt = useCallback((index: number, next: CaseRuleDefinition) => {
    setRules((previous) =>
      previous.map((rule, ruleIndex) => (ruleIndex === index ? next : rule))
    );
  }, []);

  const addRule = useCallback(() => {
    setRules((previous) => {
      const next = [...previous, blankRule(previous.length + 1)];
      setSelectedIndex(next.length - 1);
      return next;
    });
  }, []);

  const deleteRule = useCallback((index: number) => {
    setRules((previous) => {
      if (previous.length <= 1) return previous;
      const next = previous.filter((_, ruleIndex) => ruleIndex !== index);
      setSelectedIndex(Math.max(0, Math.min(index, next.length - 1)));
      return next;
    });
  }, []);

  const duplicateRule = useCallback((index: number) => {
    setRules((previous) => {
      const duplicated = {
        ...previous[index],
        code: `${previous[index].code}-COPY`,
        title: `${previous[index].title} copy`,
      } as CaseRuleDefinition;
      const next = [
        ...previous.slice(0, index + 1),
        duplicated,
        ...previous.slice(index + 1),
      ];
      setSelectedIndex(index + 1);
      return next;
    });
  }, []);

  const moveRule = useCallback((index: number, direction: -1 | 1) => {
    setRules((previous) => {
      const target = index + direction;
      if (target < 0 || target >= previous.length) return previous;
      const next = [...previous];
      [next[index], next[target]] = [next[target], next[index]];
      setSelectedIndex(target);
      return next;
    });
  }, []);

  async function save() {
    setError(null);
    setMessage(null);

    if (issues.length > 0) {
      setError("Resolve validation issues before saving the draft.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/case-rules/${releaseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          changeNotes,
          definitionJson,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to save draft");
      }

      setMessage("Draft saved. Review state cleared until clinical review runs again.");
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save draft");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <Input
            label="Release name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <Input
            label="Short description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
          <div className="md:col-span-2">
            <Textarea
              label="Change notes for reviewer"
              rows={3}
              value={changeNotes}
              onChange={(event) => setChangeNotes(event.target.value)}
              required
            />
          </div>
          <div className="md:col-span-2">
            <Textarea
              label="Source references"
              rows={3}
              value={sourceOfTruthText}
              onChange={(event) => setSourceOfTruthText(event.target.value)}
              hint="One source per line."
              required
            />
          </div>
          <div className="md:col-span-2">
            <Textarea
              label="Reviewer notes"
              rows={3}
              value={notesText}
              onChange={(event) => setNotesText(event.target.value)}
              hint="Optional, one note per line."
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
        <div>
          <div className="text-sm font-semibold text-foreground">
            Default outcome
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Used when no rule matches the incoming evidence.
          </div>
        </div>
        <RecommendationFields rec={defaultRec} onChange={setDefaultRec} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(260px,0.85fr)_minmax(0,1.65fr)]">
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-foreground">
                Rules
              </div>
              <div className="text-xs text-muted-foreground">
                {rules.length} total
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={addRule}>
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>
          <RuleList
            rules={rules}
            selectedIndex={selectedIndex}
            onSelect={setSelectedIndex}
          />
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          {selectedRule && (
            <RuleEditor
              rule={selectedRule}
              index={selectedIndex}
              total={rules.length}
              factLabels={factLabels}
              thresholdLabels={thresholdLabels}
              onChange={(next) => setRuleAt(selectedIndex, next)}
              onDelete={() => deleteRule(selectedIndex)}
              onDuplicate={() => duplicateRule(selectedIndex)}
              onMove={(direction) => moveRule(selectedIndex, direction)}
            />
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-foreground">
              Draft validation
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Saving performs schema validation; review and activation remain blocked if regression fixtures fail.
            </div>
          </div>
          <Badge variant={issues.length === 0 ? "low" : "high"}>
            {issues.length === 0 ? "Ready to save" : `${issues.length} issue${issues.length === 1 ? "" : "s"}`}
          </Badge>
        </div>
        {issues.length > 0 ? (
          <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
            {issues.slice(0, 8).map((issue) => (
              <li key={issue} className="flex gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-warn" />
                <span>{issue}</span>
              </li>
            ))}
            {issues.length > 8 && (
              <li className="text-xs text-muted-foreground">
                {issues.length - 8} more issues hidden.
              </li>
            )}
          </ul>
        ) : (
          <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-success" />
            Draft fields are complete.
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border">
        <button
          type="button"
          onClick={() => setShowJson((value) => !value)}
          className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <Code2 className="h-4 w-4" />
          Developer export {showJson ? "Hide" : "Show"}
        </button>
        {showJson && (
          <pre className="overflow-x-auto border-t border-border bg-slate-950 p-4 text-xs text-slate-100">
            {definitionJson}
          </pre>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="success" loading={loading} onClick={save}>
          <Save className="h-4 w-4" />
          Save draft
        </Button>
        {message && <span className="text-sm text-success">{message}</span>}
        {error && <span className="text-sm text-destructive">{error}</span>}
      </div>
    </div>
  );
}
