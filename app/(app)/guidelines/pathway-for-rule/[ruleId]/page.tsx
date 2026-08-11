import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { getGuidelineSnapshot } from "@/lib/clinical-rules/guideline-catalogue";
import { findPathwayForRule } from "@/lib/clinical-rules/pathway-view-model";

/**
 * Resolves a governed rule id to the pathway that explains it, then forwards to
 * that pathway with the case overlay intact.
 *
 * Case Review links here rather than hard-coding a view, so the mapping follows
 * governed view membership and keeps working as views change. A rule with no
 * governed view membership 404s rather than guessing a pathway.
 */
export default async function PathwayForRulePage({
  params,
  searchParams,
}: {
  params: Promise<{ ruleId: string }>;
  searchParams: Promise<{ rules?: string; controlling?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { ruleId } = await params;
  const viewKey = findPathwayForRule(getGuidelineSnapshot(), decodeURIComponent(ruleId));
  if (!viewKey) notFound();

  const query = await searchParams;
  const forwarded = new URLSearchParams();
  if (query.rules) forwarded.set("rules", query.rules);
  if (query.controlling) forwarded.set("controlling", query.controlling);
  const suffix = forwarded.toString();

  redirect(`/guidelines/${viewKey}${suffix ? `?${suffix}` : ""}`);
}
