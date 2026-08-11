import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import {
  getGuidelineCatalogue,
  getGuidelineSnapshot,
} from "@/lib/clinical-rules/guideline-catalogue";
import { buildPathwayGraph } from "@/lib/clinical-rules/pathway-view-model";
import { PageIntro } from "@/components/layout/PageIntro";
import { ClinicalAuthorityBadge } from "@/components/clinical-rules/ClinicalAuthorityBadge";
import { PathwayViewer } from "@/components/pathway/PathwayViewer";

/** Reports live clinical authority, so it must not be statically rendered. */
export const dynamic = "force-dynamic";

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

  const catalogue = await getGuidelineCatalogue();
  const snapshot = getGuidelineSnapshot();

  const key = (await params).pathway;
  const index = catalogue.pathways.findIndex((pathway) => pathway.key === key);
  if (index < 0) notFound();

  const summary = catalogue.pathways[index];
  const graph = buildPathwayGraph(snapshot, key);
  const previous = index > 0 ? catalogue.pathways[index - 1] : null;
  const next = index < catalogue.pathways.length - 1 ? catalogue.pathways[index + 1] : null;

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

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="page-aura flex-shrink-0 border-b border-border bg-card px-6 pb-4 pt-5">
        <PageIntro
          eyebrow="Current guidelines"
          title={summary.title}
          description={summary.description}
          breadcrumb={[{ label: "Guidelines", href: "/guidelines" }, { label: summary.title }]}
          trailing={
            <ClinicalAuthorityBadge
              authorityEngine={catalogue.authority.authorityEngine}
              ruleSetVersion={catalogue.authority.canonicalVersion}
              ruleSetChecksum={catalogue.authority.canonicalChecksum}
              evaluationMode={
                catalogue.authority.canonicalMode === "NOT_EVALUATED"
                  ? null
                  : catalogue.authority.canonicalMode
              }
              routerEngine={catalogue.authority.routerEngine}
            />
          }
        />
      </div>

      <div className="min-h-0 flex-1 p-4">
        <PathwayViewer
          graph={graph}
          className="h-full"
          caseOverlay={caseOverlay}
          // The master view carries every governed decision; sections start
          // collapsed so the first paint is readable rather than a wall of
          // cards. A case overlay needs its rules visible, so it stays expanded.
          initialCollapsed={graph.viewType === "MASTER" && !caseOverlay}
          governance={{
            rulesetId: catalogue.governance.rulesetId,
            lifecycle: catalogue.governance.lifecycle,
            evaluationMode: catalogue.governance.evaluationMode,
            checksum: catalogue.governance.checksum,
            sourcePackageVersion: catalogue.governance.sourcePackageVersion,
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
