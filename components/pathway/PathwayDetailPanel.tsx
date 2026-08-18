"use client";

import { ChevronRight, ExternalLink, Info, ShieldAlert, X } from "lucide-react";

import { cn } from "@/lib/utils";
import type { PathwayGraph, PathwayNode } from "@/lib/clinical-rules/pathway-view-model";
import { NODE_TYPE_LABEL, REVIEWER_REQUIREMENT_LABEL, TONE_STYLE } from "./tone";

function Field({
  label,
  children,
  mono,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
}) {
  if (children === null || children === undefined || children === "") return null;
  return (
    <div>
      <dt className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </dt>
      <dd className={cn("mt-1 text-[13px] leading-[1.55] text-foreground", mono && "font-mono text-[11.5px] break-all")}>
        {children}
      </dd>
    </div>
  );
}

export function PathwayDetailPanel({
  graph,
  node,
  chain,
  onClose,
  onSelect,
  governance,
}: {
  graph: PathwayGraph;
  node: PathwayNode;
  /** Root-to-node id chain, rendered as the "how did we get here" trail. */
  chain: string[];
  onClose: () => void;
  onSelect: (id: string) => void;
  /** Version metadata, shown under Advanced rather than on every node. */
  governance?: {
    rulesetId: string;
    revision: number | string;
    checksum: string | null;
    lifecycle: string;
    sourcePackageVersion: string;
  };
}) {
  const tone = TONE_STYLE[node.tone];
  const Icon = tone.icon;
  const detail = node.detail;
  const byId = new Map(graph.nodes.map((candidate) => [candidate.id, candidate]));

  return (
    <aside
      aria-label="Pathway node detail"
      className="flex h-full w-full flex-col border-border bg-card lg:border-l"
    >
      <header
        className="flex items-start gap-3 border-b border-border px-4 py-3"
        style={{ background: tone.bg }}
      >
        <span
          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
          style={{ background: "color-mix(in srgb, var(--pw-card) 70%, transparent)" }}
        >
          <Icon className="h-4 w-4" style={{ color: tone.accent }} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p
            className="text-[10.5px] font-semibold uppercase tracking-[0.06em]"
            style={{ color: tone.accent }}
          >
            {node.nodeType ? NODE_TYPE_LABEL[node.nodeType] : "Pathway"}
            {node.ruleId && node.kind === "DECISION" ? ` · ${node.ruleId}` : ""}
          </p>
          <h2 className="mt-0.5 text-[14px] font-semibold leading-snug" style={{ color: tone.fg }}>
            {node.fullText}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close detail"
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pw-ring)]"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {/* How the guideline reached this node. */}
        {chain.length > 1 && (
          <section className="mb-5">
            <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              How the guideline reaches this
            </h3>
            <ol className="mt-2 space-y-1">
              {chain.map((id, index) => {
                const step = byId.get(id);
                if (!step) return null;
                const isLast = index === chain.length - 1;
                return (
                  <li key={id} className="flex items-start gap-1.5">
                    <ChevronRight
                      className="mt-[3px] h-3 w-3 shrink-0 text-muted-foreground"
                      style={{ marginLeft: index * 8 }}
                      aria-hidden
                    />
                    <button
                      type="button"
                      onClick={() => onSelect(id)}
                      disabled={isLast}
                      className={cn(
                        "min-w-0 flex-1 rounded text-left text-[12px] leading-snug transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pw-ring)]",
                        isLast
                          ? "font-semibold text-foreground"
                          : "text-muted-foreground hover:text-foreground hover:underline"
                      )}
                    >
                      {step.ruleId && step.kind === "DECISION" && (
                        <span className="mr-1 font-mono text-[10.5px] font-bold">{step.ruleId}</span>
                      )}
                      {step.title}
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>
        )}

        {detail ? (
          <dl className="space-y-4">
            <Field label="Governed condition">{detail.sourceConditionText}</Field>
            <Field label="Provisional outcome">{detail.provisionalOutcome}</Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Timing">{detail.timingDestination || "As specified by outcome"}</Field>
              <Field label="Care setting">{detail.careSetting}</Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Priority">{detail.safetyPriority}</Field>
              <Field label="Reviewer">
                {REVIEWER_REQUIREMENT_LABEL[detail.reviewerRequirement] ?? detail.reviewerRequirement}
              </Field>
            </div>

            {/* Safety property that must never be lost in a visual pass. */}
            <div className="rounded-lg border border-[var(--pw-review-border)] bg-[var(--pw-review-bg)] p-3">
              <p className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[var(--pw-review-accent)]">
                <ShieldAlert className="h-3.5 w-3.5" aria-hidden />
                If information is missing
              </p>
              <p className="mt-1.5 text-[12.5px] leading-[1.55] text-[var(--pw-review-fg)]">
                {detail.missingDataBehaviour}
              </p>
            </div>

            {detail.outcomeBranches.length > 0 && (
              <section>
                <h3 className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                  <Info className="h-3.5 w-3.5" aria-hidden />
                  Governed outcome branches ({detail.outcomeBranches.length})
                </h3>
                <p className="mt-1 text-[11.5px] leading-snug text-muted-foreground">
                  This rule carries several governed branches that the canonical graph stores as one
                  outcome node.
                </p>
                <ul className="mt-2 space-y-2">
                  {detail.outcomeBranches.map((branch) => (
                    <li
                      key={branch.id}
                      className="rounded-lg border border-border bg-muted/40 p-2.5"
                    >
                      <p className="font-mono text-[10.5px] font-bold text-muted-foreground">
                        {branch.id}
                      </p>
                      <p className="mt-1 text-[12.5px] leading-[1.5] text-foreground">
                        {branch.provisionalOutcome}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {[branch.timingDestination, branch.careSetting, branch.urgency]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <Field label="Required information">
              <div className="flex flex-wrap gap-1">
                {detail.requiredFacts.map((factName) => (
                  <span
                    key={factName}
                    className="rounded border border-border bg-muted px-1.5 py-[1px] font-mono text-[10.5px] text-muted-foreground"
                  >
                    {factName}
                  </span>
                ))}
              </div>
            </Field>

            <Field label="Source">
              <ul className="space-y-1">
                {detail.sourceReferences.map((reference, index) => (
                  <li key={`${reference.document}-${index}`} className="flex items-start gap-1.5">
                    <ExternalLink
                      className="mt-[3px] h-3 w-3 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                    <span>
                      {reference.document} · {reference.reference}
                    </span>
                  </li>
                ))}
              </ul>
            </Field>

            <Field label="Automation boundary">{detail.automationBoundary}</Field>
            <Field label="Implementation note">{detail.implementationNote}</Field>

            {governance && (
              <details className="rounded-lg border border-border bg-muted/30 p-3">
                <summary className="cursor-pointer list-none text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                  Governance &amp; provenance
                </summary>
                <dl className="mt-3 space-y-3">
                  <Field label="Ruleset ID" mono>
                    {governance.rulesetId}
                  </Field>
                  <Field label="Revision">{String(governance.revision)}</Field>
                  <Field label="Lifecycle">{governance.lifecycle}</Field>
                  <Field label="Source package">v{governance.sourcePackageVersion}</Field>
                  <Field label="Checksum" mono>
                    {governance.checksum ?? "—"}
                  </Field>
                  <Field label="Section">{`${detail.section} · ${detail.pathwayStage}`}</Field>
                  <Field label="Update status">{detail.updateStatus}</Field>
                  {detail.governedClassification && (
                    <Field label="Classification">{detail.governedClassification}</Field>
                  )}
                </dl>
              </details>
            )}
          </dl>
        ) : (
          <div className="space-y-4">
            <p className="text-[13px] leading-[1.6] text-muted-foreground">{node.fullText}</p>
            {node.kind === "ENTRY" && (
              <dl className="grid grid-cols-2 gap-4">
                <Field label="Decision points">{String(graph.counts.decisions)}</Field>
                <Field label="Outcomes">{String(graph.counts.outcomes)}</Field>
                <Field label="Safety stops">{String(graph.counts.urgent)}</Field>
                <Field label="Review points">{String(graph.counts.review)}</Field>
              </dl>
            )}
            {graph.sections.length > 0 && node.kind === "ENTRY" && (
              <Field label="Guideline sections">{graph.sections.join(" · ")}</Field>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
