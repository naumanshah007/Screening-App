"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  ChevronRight,
  ClipboardList,
  GitBranch,
  Info,
  Route,
  Search,
  ShieldCheck,
  UserRoundCheck,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { PageIntro } from "@/components/layout/PageIntro";
import { ClinicalAuthorityBadge } from "@/components/clinical-rules/ClinicalAuthorityBadge";
import type {
  GuidelineCatalogue,
  GuidelineVersionHistoryEntry,
} from "@/lib/clinical-rules/guideline-catalogue";

type Props = {
  catalogue: GuidelineCatalogue;
  history: GuidelineVersionHistoryEntry[];
};

export function GuidelinesHome({ catalogue, history }: Props) {
  const [query, setQuery] = useState("");
  const { authority, governance, canonicalIsAuthoritative } = catalogue;

  const pathways = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return catalogue.pathways;
    return catalogue.pathways.filter((pathway) =>
      [pathway.title, pathway.description, pathway.sections.join(" "), pathway.ruleIds.join(" ")]
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }, [catalogue.pathways, query]);

  const master = pathways.find((pathway) => pathway.viewType === "MASTER");
  const clinical = pathways.filter((pathway) => pathway.viewType !== "MASTER");

  return (
    <div className="animate-fade-in space-y-6 p-6">
      <div className="page-aura">
        <PageIntro
          eyebrow="Clinical guidance"
          title={catalogue.title}
          description={catalogue.subtitle}
          trailing={
            <ClinicalAuthorityBadge
              // This page is read as clinical guidance, so the badge names the
              // ruleset the way a clinician would and leaves the checksum to
              // the technical provenance section below.
              presentation="clinical"
              authorityEngine={authority.authorityEngine}
              ruleSetVersion={authority.canonicalVersion}
              ruleSetChecksum={authority.canonicalChecksum}
              evaluationMode={
                authority.canonicalMode === "NOT_EVALUATED" ? null : authority.canonicalMode
              }
              routerEngine={authority.routerEngine}
            />
          }
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatusCard
          icon={<ShieldCheck className="h-4 w-4" />}
          title="Validated and version-controlled"
          body="Every pathway below is generated from the current governed guideline content."
        />
        <StatusCard
          icon={<GitBranch className="h-4 w-4" />}
          title={`${catalogue.pathways.length} governed pathways`}
          body={`${governance.counts.rules} clinical decision points across the screening programme.`}
        />
        <StatusCard
          icon={<UserRoundCheck className="h-4 w-4" />}
          title="Reviewer confirmation required"
          body="Recommendations are provisional and are confirmed by a clinician before action."
        />
      </div>

      {/*
        Authority truth. The Guidelines surface is canonical-first, but it must
        never imply canonical decides recommendations when it does not: the real
        resolved authority drives this message.
      */}
      {!canonicalIsAuthoritative && (
        <div
          role="note"
          className="flex items-start gap-3 rounded-xl border px-4 py-3 text-sm"
          style={{
            background: "var(--pw-monitor-bg)",
            borderColor: "var(--pw-monitor-border)",
            color: "var(--pw-monitor-fg)",
          }}
        >
          <Info
            className="mt-0.5 h-4 w-4 shrink-0"
            style={{ color: "var(--pw-monitor-accent)" }}
            aria-hidden
          />
          <p className="leading-6">
            This is the current governed guideline content, but it is not yet deciding cases:
            recommendations are still produced by the{" "}
            <strong>previous grading rules</strong>.
            {authority.canonicalStatus
              ? ` ${governance.rulesetId} is ${authority.canonicalStatus.toLowerCase()}${
                  governance.evaluationMode && governance.evaluationMode !== "NOT_EVALUATED"
                    ? ` and runs in ${governance.evaluationMode.toLowerCase().replace(/_/g, " ")} mode`
                    : ""
                }.`
              : ""}
          </p>
        </div>
      )}

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

      {/*
        Two different kinds of "additional reference" were sitting in one list:
        a local service policy a clinician may need to follow, and an engineering
        provenance note they never do. Grouping them together implied the router
        was guidance of the same kind as the booking policy.
      */}
      <section aria-labelledby="local-policy-heading">
        <h2 id="local-policy-heading" className="text-h3 text-foreground">
          Local operational policy
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          How Health NZ Counties Manukau books and prioritises appointments. This sits on top of the
          national guidelines above — it schedules care, it does not decide the clinical
          recommendation.
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <ReferenceLink
            href="/guidelines/operational"
            icon={<ClipboardList className="h-4 w-4" />}
            title="Local colposcopy booking &amp; grading policy"
            detail="Counties Manukau booking priorities and service SLAs — local service policy"
          />
        </div>
      </section>

      <section aria-labelledby="technical-reference-heading">
        <h2 id="technical-reference-heading" className="text-h3 text-foreground">
          Technical references
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Provenance for auditors and administrators. Not clinical guidance.
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <ReferenceLink
            href="/guidelines/technical-router"
            icon={<Route className="h-4 w-4" />}
            title="Pathway router reference"
            detail="How a pathway is selected before the governed rules produce a recommendation"
          />
        </div>
      </section>

      <details className="group rounded-xl border border-border bg-card">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold text-foreground focus-visible:ring-2 focus-visible:ring-ring">
          <ChevronRight
            className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-90"
            aria-hidden
          />
          Technical provenance and governance record
        </summary>
        <div className="space-y-5 border-t border-border px-4 py-4">
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Meta label="Ruleset ID" value={governance.rulesetId} mono />
            <Meta label="Lifecycle" value={governance.lifecycle} />
            <Meta label="Evaluation mode" value={governance.evaluationMode} />
            <Meta label="Source package" value={`v${governance.sourcePackageVersion}`} />
            <Meta label="Rules" value={String(governance.counts.rules)} />
            <Meta label="Nodes" value={String(governance.counts.nodes)} />
            <Meta label="Edges" value={String(governance.counts.edges)} />
            <Meta label="Views" value={String(governance.counts.views)} />
          </dl>

          <div>
            <p className="text-label text-muted-foreground">Snapshot checksum</p>
            <p className="mt-1 break-all rounded-lg border border-border bg-muted px-3 py-2 font-mono text-[11px] text-muted-foreground">
              SHA-256 {governance.checksum || "—"}
            </p>
          </div>

          <div>
            <p className="text-label text-muted-foreground">Clinical sources</p>
            <ul className="mt-2 space-y-1.5">
              {governance.sources.map((source) => (
                <li key={source.file} className="text-sm leading-6 text-muted-foreground">
                  <span className="font-medium text-foreground">{source.document}</span> ·{" "}
                  {source.version} · {source.published} — {source.role}
                </li>
              ))}
            </ul>
          </div>

          {history.length > 0 && (
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
          )}

          <p className="text-xs leading-6 text-muted-foreground">
            {governance.safetyNotices.join(" · ")}
          </p>

          <Link
            href="/rules/clinical"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent-color hover:underline"
          >
            Open governance record in Rule Studio
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

function ReferenceLink({
  href,
  icon,
  title,
  detail,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5 transition-colors hover:border-accent-color focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="shrink-0 text-accent-color" aria-hidden>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">{detail}</span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
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

function PathwayCard({ pathway }: { pathway: GuidelineCatalogue["pathways"][number] }) {
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
      className={cn("rounded-md px-2 py-0.5 text-[11px] font-medium")}
      style={{
        background: tone === "urgent" ? "var(--pw-urgent-bg)" : "var(--pw-review-bg)",
        color: tone === "urgent" ? "var(--pw-urgent-accent)" : "var(--pw-review-accent)",
      }}
    >
      {children}
    </span>
  );
}
