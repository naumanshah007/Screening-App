import { notFound, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { getCurrentGuidelines } from "@/lib/clinical-rules/current-guidelines";
import { findPathwayForRule } from "@/lib/clinical-rules/pathway-view-model";

/**
 * Resolves a governed rule id to the pathway that explains it, then forwards to
 * that pathway with the case overlay intact.
 *
 * Case Review links here rather than hard-coding a view, so the mapping follows
 * the governed view membership and keeps working as views change.
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

  const guidelines = await getCurrentGuidelines();
  if (!guidelines) notFound();

  const { ruleId } = await params;
  const viewKey = findPathwayForRule(guidelines.snapshot, decodeURIComponent(ruleId));
  if (!viewKey) notFound();

  const query = await searchParams;
  const forwarded = new URLSearchParams();
  if (query.rules) forwarded.set("rules", query.rules);
  if (query.controlling) forwarded.set("controlling", query.controlling);
  const suffix = forwarded.toString();

  redirect(`/guidelines/${viewKey}${suffix ? `?${suffix}` : ""}`);
}
