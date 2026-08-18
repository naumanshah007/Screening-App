"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  ChevronRight,
  ClipboardList,
  GitBranch,
  Search,
  ShieldCheck,
  UserRoundCheck,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { PageIntro } from "@/components/layout/PageIntro";
import type { CurrentGuidelines } from "@/lib/clinical-rules/current-guidelines";
import { AuthorityChip } from "./AuthorityChip";

type Props = {
  guidelines: Omit<CurrentGuidelines, "snapshot">;
  /** Governed versions, shown only inside the governance disclosure. */
  history: Array<{
    id: string;
    displayVersion: string;
    status: string;
    revision: number;
    updatedAt: string;
    evaluations: number;
    activeIn: string[];
  }>;
};

export function GuidelinesHome({ guidelines, history }: Props) {
  const [query, setQuery] = useState("");

  const pathways = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return guidelines.pathways;
    return guidelines.pathways.filter((pathway) =>
      [pathway.title, pathway.description, pathway.sections.join(" "), pathway.ruleIds.join(" ")]
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }, [guidelines.pathways, query]);

  const master = pathways.find((pathway) => pathway.viewType === "MASTER");
  const clinical = pathways.filter((pathway) => pathway.viewType !== "MASTER");

  return (
    <div className="animate-fade-in space-y-6 p-6">
      <div className="page-aura">
        <PageIntro
          eyebrow="Clinical guidance"
          title={guidelines.title}
          description={guidelines.subtitle}
          trailing={<AuthorityChip authority={guidelines.authority} />}
        />
      </div>

      {/* Status strip — plain language, no internal identifiers. */}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatusCard
          icon={<ShieldCheck className="h-4 w-4" />}
          title="Validated and version-controlled"
          body="Every pathway below is generated from the current governed guideline content."
        />
        <StatusCard
          icon={<GitBranch className="h-4 w-4" />}
          title={`${guidelines.pathways.length} governed pathways`}
          body={`${guidelines.governance.counts.rules} clinical decision points across the screening programme.`}
        />
        <StatusCard
          icon={<UserRoundCheck className="h-4 w-4" />}
          title="Reviewer confirmation required"
          body="Recommendations are provisional and are confirmed by a clinician before action."
        />
      </div>

      {!guidelines.authority.decidesRecommendations && (
        // `--color-info-bg` has no dark-theme override, so the pathway tokens
        // are used here — they are defined for both themes.
        <div
          role="note"
          className="flex items-start gap-3 rounded-xl border px-4 py-3 text-sm"
          style={{
            background: "var(--pw-monitor-bg)",
            borderColor: "var(--pw-monitor-border)",
            color: "var(--pw-monitor-fg)",
          }}
        >
          <AlertTriangle
            className="mt-0.5 h-4 w-4 shrink-0"
            style={{ color: "var(--pw-monitor-accent)" }}
            aria-hidden
          />
          <p className="leading-6">{guidelines.authority.description}</p>
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-xl">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search guidelines — pathway, clinical term or rule…"
          aria-label="Search guidelines"
          className="h-11 w-full rounded-xl border border-border bg-card pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {/* Pathways */}
      <section aria-labelledby="pathways-heading">
        <h2 id="pathways-heading" className="text-h3 text-foreground">
          Pathways
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Open a pathway to follow the decision points and see how each recommendation is reached.
        </p>

        {clinical.length === 0 && !master ? (
          <p className="mt-6 rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
            No pathways match “{query}”.
          </p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {clinical.map((pathway) => (
              <PathwayCard key={pathway.key} pathway={pathway} />
            ))}
          </div>
        )}

        {master && (
          <Link
            href={`/guidelines/${master.key}`}
            className="mt-3 flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5 transition-colors hover:border-accent-color focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <BookOpen className="h-4 w-4 shrink-0 text-accent-color" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-foreground">
                Complete decision tree
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                All {master.decisions} decision points in one map
              </span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        )}
      </section>

      {/* Local operational guides — clearly secondary to the national guidelines. */}
      <section aria-labelledby="operational-heading">
        <h2 id="operational-heading" className="text-h3 text-foreground">
          Local booking guides
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Health NZ Counties Manukau booking priorities. These sit alongside the national
          guidelines above and govern local scheduling, not clinical screening logic.
        </p>
        <Link
          href="/guidelines/operational"
          className="mt-3 flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5 transition-colors hover:border-accent-color focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ClipboardList className="h-4 w-4 shrink-0 text-accent-color" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-foreground">
              Colposcopy triage &amp; gynaecology grading
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              Booking priorities and service SLAs
            </span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        </Link>
      </section>

      {/* Governance — full internal identity, one disclosure away. */}
      <details className="group rounded-xl border border-border bg-card">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold text-foreground focus-visible:ring-2 focus-visible:ring-ring">
          <ChevronRight
            className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-90"
            aria-hidden
          />
          View governance details
        </summary>
        <div className="space-y-5 border-t border-border px-4 py-4">
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Meta label="Ruleset ID" value={guidelines.governance.rulesetId} mono />
            <Meta label="Revision" value={String(guidelines.governance.revision)} />
            <Meta label="Lifecycle" value={guidelines.governance.lifecycle} />
            <Meta
              label="Source package"
              value={`v${guidelines.governance.sourcePackageVersion}`}
            />
            <Meta label="Rules" value={String(guidelines.governance.counts.rules)} />
            <Meta label="Nodes" value={String(guidelines.governance.counts.nodes)} />
            <Meta label="Edges" value={String(guidelines.governance.counts.edges)} />
            <Meta label="Views" value={String(guidelines.governance.counts.views)} />
          </dl>

          <div>
            <p className="text-label text-muted-foreground">Snapshot checksum</p>
            <p className="mt-1 break-all rounded-lg border border-border bg-muted px-3 py-2 font-mono text-[11px] text-muted-foreground">
              SHA-256 {guidelines.governance.checksum}
            </p>
          </div>

          <div>
            <p className="text-label text-muted-foreground">Clinical sources</p>
            <ul className="mt-2 space-y-1.5">
              {guidelines.governance.sources.map((source) => (
                <li key={source.file} className="text-sm leading-6 text-muted-foreground">
                  <span className="font-medium text-foreground">{source.document}</span> ·{" "}
                  {source.version} · {source.published} — {source.role}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-label text-muted-foreground">Version history</p>
            <div className="mt-2 overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[34rem] text-left text-xs">
                <thead className="bg-muted/50">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-semibold">Version</th>
                    <th scope="col" className="px-3 py-2 font-semibold">Status</th>
                    <th scope="col" className="px-3 py-2 font-semibold">Revision</th>
                    <th scope="col" className="px-3 py-2 font-semibold">Evaluations</th>
                    <th scope="col" className="px-3 py-2 font-semibold">Active in</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {history.map((entry) => (
                    <tr key={entry.id}>
                      <td className="px-3 py-2 font-mono font-semibold text-foreground">
                        {entry.displayVersion}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{entry.status}</td>
                      <td className="px-3 py-2 text-muted-foreground">{entry.revision}</td>
                      <td className="px-3 py-2 text-muted-foreground">{entry.evaluations}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {entry.activeIn.length ? entry.activeIn.join(", ") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-xs leading-6 text-muted-foreground">
            {guidelines.governance.safetyNotices.join(" · ")}
          </p>

          <Link
            href="/rules/clinical"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent-color hover:underline"
          >
            Open Rule Studio
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      </details>
    </div>
  );
}

function StatusCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <span className="text-accent-color" aria-hidden>
          {icon}
        </span>
        {title}
      </p>
      <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{body}</p>
    </div>
  );
}

function Meta({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-label text-muted-foreground">{label}</dt>
      <dd className={cn("mt-1 text-sm text-foreground", mono && "font-mono text-xs")}>{value}</dd>
    </div>
  );
}

function PathwayCard({
  pathway,
}: {
  pathway: Props["guidelines"]["pathways"][number];
}) {
  return (
    <Link
      href={`/guidelines/${pathway.key}`}
      className="group flex flex-col rounded-xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-accent-color hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold leading-snug text-foreground">{pathway.title}</h3>
        <ArrowRight
          className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-accent-color"
          aria-hidden
        />
      </div>
      <p className="mt-1.5 line-clamp-2 flex-1 text-xs leading-5 text-muted-foreground">
        {pathway.description}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Stat label="decision points" value={pathway.decisions} />
        {pathway.urgent > 0 && <Tag tone="urgent">{pathway.urgent} safety stops</Tag>}
        {pathway.review > 0 && <Tag tone="review">{pathway.review} review points</Tag>}
      </div>
      {pathway.sections.length > 0 && (
        <p className="mt-2 truncate text-[11px] text-muted-foreground/80">
          {pathway.sections.join(" · ")}
        </p>
      )}
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
      <span className="font-bold text-foreground">{value}</span> {label}
    </span>
  );
}

function Tag({ tone, children }: { tone: "urgent" | "review"; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "rounded-md px-2 py-0.5 text-[11px] font-medium",
        tone === "urgent"
          ? "bg-[var(--pw-urgent-bg)] text-[var(--pw-urgent-accent)]"
          : "bg-[var(--pw-review-bg)] text-[var(--pw-review-accent)]"
      )}
    >
      {children}
    </span>
  );
}
