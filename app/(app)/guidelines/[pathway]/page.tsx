import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { getCurrentGuidelines } from "@/lib/clinical-rules/current-guidelines";
import { buildPathwayGraph } from "@/lib/clinical-rules/pathway-view-model";
import { PageIntro } from "@/components/layout/PageIntro";
import { PathwayViewer } from "@/components/pathway/PathwayViewer";
import { AuthorityChip } from "../AuthorityChip";

export default async function GuidelinePathwayPage({
  params,
  searchParams,
}: {
  params: Promise<{ pathway: string }>;
  /**
   * `?rules=F3-01,F3-07&controlling=F3-07` opens the pathway with a case
   * overlay, so "Why this recommendation?" in Case Review lands on the diagram
   * with the traversed rules and the controlling rule already highlighted.
   */
  searchParams: Promise<{ rules?: string; controlling?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const guidelines = await getCurrentGuidelines();
  if (!guidelines) notFound();

  const query = await searchParams;
  const traversedRuleIds = (query.rules ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const controllingRuleId = query.controlling?.trim() || null;
  const caseOverlay =
    traversedRuleIds.length > 0 || controllingRuleId
      ? { traversedRuleIds, controllingRuleId }
      : undefined;

  const key = (await params).pathway;
  const index = guidelines.pathways.findIndex((pathway) => pathway.key === key);
  if (index < 0) notFound();

  const summary = guidelines.pathways[index];
  const graph = buildPathwayGraph(guidelines.snapshot, key);
  const previous = index > 0 ? guidelines.pathways[index - 1] : null;
  const next =
    index < guidelines.pathways.length - 1 ? guidelines.pathways[index + 1] : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="page-aura flex-shrink-0 border-b border-border bg-card px-6 pb-4 pt-5">
        <PageIntro
          eyebrow="Current guidelines"
          title={summary.title}
          description={summary.description}
          breadcrumb={[{ label: "Guidelines", href: "/guidelines" }, { label: summary.title }]}
          trailing={<AuthorityChip authority={guidelines.authority} />}
        />
      </div>

      <div className="min-h-0 flex-1 p-4">
        <PathwayViewer
          graph={graph}
          className="h-full"
          caseOverlay={caseOverlay}
          // The master view carries 203 decisions; sections start collapsed so
          // the first paint is readable rather than a wall of cards. A case
          // overlay needs its rules visible, so collapsing is skipped then.
          initialCollapsed={graph.viewType === "MASTER" && !caseOverlay}
          governance={{
            rulesetId: guidelines.governance.rulesetId,
            revision: guidelines.governance.revision,
            checksum: guidelines.governance.checksum,
            lifecycle: guidelines.governance.lifecycle,
            sourcePackageVersion: guidelines.governance.sourcePackageVersion,
          }}
          navLinks={{
            previous: previous
              ? { href: `/guidelines/${previous.key}`, label: previous.title }
              : null,
            next: next ? { href: `/guidelines/${next.key}`, label: next.title } : null,
          }}
        />
      </div>
    </div>
  );
}
