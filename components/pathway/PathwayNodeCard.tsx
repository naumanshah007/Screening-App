"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";

import { cn } from "@/lib/utils";
import type { PathwayNode } from "@/lib/clinical-rules/pathway-view-model";
import { NODE_TYPE_LABEL, TONE_STYLE } from "./tone";

export type PathwayFlowData = {
  node: PathwayNode;
  /** On the highlighted root-to-selection path. */
  onPath: boolean;
  /** Downstream of the selection. */
  downstream: boolean;
  /** Faded because a search or selection is focusing elsewhere. */
  dimmed: boolean;
  /** Matches the active search term. */
  matched: boolean;
  /** Part of the case being explained in Case Review. */
  traversed: boolean;
  /** The rule that actually produced the recommendation. */
  controlling: boolean;
  collapsed: boolean;
  hiddenChildren: number;
  onSelect: (id: string) => void;
  onToggleCollapse: (id: string) => void;
};

/**
 * Fixed 16px row. Card heights are computed in `measureNode`, so these rows
 * must not grow — long values truncate rather than wrap.
 */
function ChipRow({ children }: { children: React.ReactNode }) {
  return <div className="flex h-4 items-center gap-1 overflow-hidden">{children}</div>;
}

function Chip({
  children,
  tint,
  title,
}: {
  children: React.ReactNode;
  tint?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className="inline-flex max-w-full items-center gap-1 truncate rounded px-1.5 py-[1px] text-[10px] font-semibold uppercase tracking-[0.04em]"
      style={{
        color: tint ?? "var(--pw-card-muted)",
        background: tint ? "color-mix(in srgb, currentColor 12%, transparent)" : "transparent",
      }}
    >
      {children}
    </span>
  );
}

export const PathwayNodeCard = memo(function PathwayNodeCard({
  data,
  selected,
}: NodeProps & { data: PathwayFlowData }) {
  const {
    node,
    onPath,
    downstream,
    dimmed,
    matched,
    traversed,
    controlling,
    collapsed,
    hiddenChildren,
    onSelect,
    onToggleCollapse,
  } = data;
  const tone = TONE_STYLE[node.tone];
  const Icon = tone.icon;
  const isGroup = node.kind === "GROUP";
  const isEntry = node.kind === "ENTRY";
  const emphasised = selected || onPath || controlling;
  // Branch count belongs to the rule condition, so it is shown on the decision
  // card rather than repeated on its outcome.
  const showBranchChip = node.kind === "DECISION" && node.governedBranchCount > 1;

  return (
    <div
      className={cn(
        "group relative h-full w-full rounded-xl border text-left transition-[opacity,box-shadow,transform] duration-150",
        dimmed ? "opacity-25" : "opacity-100",
        emphasised ? "shadow-[0_6px_20px_-6px_rgba(15,23,42,0.28)]" : "shadow-[0_1px_2px_0_rgba(15,23,42,0.05)]"
      )}
      style={{
        background: tone.bg,
        borderColor: emphasised || matched ? tone.accent : tone.border,
        borderWidth: emphasised || matched ? 2 : 1,
        color: tone.fg,
      }}
    >
      {/* Left rail carries the tone so colour is never the only signal. */}
      <span
        aria-hidden
        className="absolute inset-y-2 left-0 w-[3px] rounded-full"
        style={{ background: tone.accent }}
      />

      <Handle
        type="target"
        position={Position.Left}
        isConnectable={false}
        className="!h-1.5 !w-1.5 !border-0 !opacity-0"
      />

      <button
        type="button"
        onClick={() => onSelect(node.id)}
        aria-label={`${NODE_TYPE_LABEL[node.nodeType ?? "DECISION"] ?? "Node"}: ${node.fullText}`}
        aria-pressed={selected}
        className="flex h-full w-full flex-col gap-1.5 rounded-xl px-3 py-2.5 pl-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pw-ring)] focus-visible:ring-offset-1"
      >
        <ChipRow>
          <Icon className="h-3 w-3 shrink-0" style={{ color: tone.accent }} aria-hidden />
          <Chip tint={tone.accent}>
            {node.nodeType ? NODE_TYPE_LABEL[node.nodeType] : "Pathway"}
          </Chip>
          {node.ruleId && node.kind === "DECISION" && (
            <span className="rounded bg-[color-mix(in_srgb,currentColor_8%,transparent)] px-1.5 py-[1px] font-mono text-[10px] font-bold">
              {node.ruleId}
            </span>
          )}
          {controlling && (
            <Chip tint="var(--pw-decision-accent)" title="Rule that produced this recommendation">
              Controlling
            </Chip>
          )}
          {traversed && !controlling && <Chip tint="var(--pw-monitor-accent)">On case path</Chip>}
        </ChipRow>

        {/* Line-height is explicit so it matches CARD_METRICS exactly. */}
        {node.facets ? (
          // Structured conditions render one facet per line so the clause that
          // distinguishes them (the last one) is never the part that is cut.
          <div className="min-w-0">
            {node.facets.map((facet) => (
              <p
                key={facet.label}
                className="truncate text-[12px] font-semibold leading-[18px]"
              >
                <span className="font-normal opacity-65">{facet.label}: </span>
                {facet.value}
              </p>
            ))}
          </div>
        ) : (
          <p
            className={cn(
              "min-w-0 font-semibold",
              isEntry
                ? "text-[14px] leading-[20px]"
                : isGroup
                  ? "text-[12.5px] leading-[18px]"
                  : "text-[12px] leading-[18px]"
            )}
            style={{
              display: "-webkit-box",
              WebkitLineClamp: isEntry || isGroup ? 2 : 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {node.title}
          </p>
        )}

        {(node.timing || showBranchChip) && (
          <div className="flex h-[15px] items-center gap-1 overflow-hidden">
            {node.timing && (
              <span
                className="truncate rounded px-1.5 text-[10.5px] font-semibold leading-[15px]"
                style={{
                  color: tone.accent,
                  background: "color-mix(in srgb, currentColor 10%, transparent)",
                }}
              >
                {node.timing}
              </span>
            )}
            {showBranchChip && (
              <Chip title="This governed rule carries several outcome branches">
                {node.governedBranchCount} branches
              </Chip>
            )}
          </div>
        )}
      </button>

      {isGroup && hiddenChildren > 0 && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleCollapse(node.id);
          }}
          aria-expanded={!collapsed}
          aria-label={`${collapsed ? "Expand" : "Collapse"} ${node.title} (${hiddenChildren} decisions)`}
          className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full border px-2 py-[1px] text-[10px] font-semibold shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pw-ring)]"
          style={{ background: "var(--pw-card)", borderColor: tone.border, color: tone.accent }}
        >
          {collapsed ? `+${hiddenChildren}` : "−"}
        </button>
      )}

      {downstream && !dimmed && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset"
          style={{ borderColor: tone.accent, boxShadow: `inset 0 0 0 1px ${tone.accent}33` }}
        />
      )}

      <Handle
        type="source"
        position={Position.Right}
        isConnectable={false}
        className="!h-1.5 !w-1.5 !border-0 !opacity-0"
      />
    </div>
  );
});
