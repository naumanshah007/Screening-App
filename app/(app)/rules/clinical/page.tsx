import Link from "next/link";
import { redirect } from "next/navigation";
import { GitBranch, ShieldCheck } from "lucide-react";

import { auth } from "@/lib/auth";
import { canPerformClinicalRuleAction } from "@/lib/clinical-rules/governance";
import { listClinicalRuleVersions } from "@/lib/clinical-rules/lifecycle";
import { parseSnapshot } from "@/lib/clinical-rules/schema";
import { PageIntro } from "@/components/layout/PageIntro";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClinicalRuleVersionActions } from "@/components/clinical-rules/ClinicalRuleVersionActions";
import { formatDateTime } from "@/lib/utils";

function statusVariant(status: string): "low" | "high" | "urgent" | "info" | "default" {
  if (status === "ACTIVE") return "low";
  if (status === "VALIDATED" || status === "PUBLISHED") return "info";
  if (status === "DRAFT" || status === "VALIDATING") return "high";
  return "default";
}

export default async function ClinicalRuleVersionsPage() {
  const session = await auth();
  const user = session?.user as { role?: string } | undefined;
  if (!canPerformClinicalRuleAction(user?.role, "view")) redirect("/dashboard");
  const versions = await listClinicalRuleVersions();

  return (
    <div className="space-y-6 p-6 animate-fade-in">
      <div className="page-aura">
        <PageIntro
          eyebrow="National clinical logic"
          title="Versioned Clinical Rule Studio"
          description="One canonical NCSP graph per version, with synchronized master/pathway views, immutable publication, controlled demo activation, and evaluation provenance."
          actions={[
            { href: "/rules", label: "Operational booking rules" },
          ]}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="flex items-start gap-4 p-5">
            <div className="rounded-xl bg-navy-700 p-3 text-white"><GitBranch className="h-5 w-5" /></div>
            <div>
              <h2 className="font-semibold text-foreground">National graph and local workflow remain separate</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">This studio governs source-derived NCSP clinical destinations. The existing Case Rule Releases continue to govern local booking priority, queue, service, and target-day overlays. A local overlay cannot silently change or relabel a national clinical branch.</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-5 w-5 text-brand-600" /> Safety wording</div>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">Provisional recommendation · Reviewer confirmation required · Not for direct clinical action · Demo environment · Simulated export package</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        {versions.map((version) => {
          const snapshot = parseSnapshot(JSON.parse(version.snapshotJson));
          const validation = version.validationJson
            ? (JSON.parse(version.validationJson) as { valid?: boolean; counts?: { errors?: number } })
            : null;
          return (
            <Card key={version.id}>
              <CardHeader>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle>{version.displayVersion}</CardTitle>
                    <Badge variant={statusVariant(version.status)}>{version.status}</Badge>
                    <Badge variant="default">{version.ruleSet.scope}</Badge>
                    {validation && <Badge variant={validation.valid ? "low" : "urgent"}>{validation.valid ? "Validation passed" : `${validation.counts?.errors ?? 0} blockers`}</Badge>}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{version.changeSummary ?? "No change summary recorded"}</p>
                </div>
                <Link href={`/rules/clinical/${version.id}`} className="rounded-lg bg-navy-700 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-800">Open studio</Link>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
                  <div><div className="text-muted-foreground">Rules / graph</div><div className="mt-1 font-semibold">{snapshot.rules.length} / {snapshot.nodes.length} nodes</div></div>
                  <div><div className="text-muted-foreground">Views</div><div className="mt-1 font-semibold">{snapshot.views.length} synchronized</div></div>
                  <div><div className="text-muted-foreground">Clinical sources</div><div className="mt-1 font-semibold">v{version.sourcePackageVersion ?? "—"}</div></div>
                  <div><div className="text-muted-foreground">Parent</div><div className="mt-1 font-semibold">{version.parentVersion?.displayVersion ?? "Initial import"}</div></div>
                  <div><div className="text-muted-foreground">Evaluations</div><div className="mt-1 font-semibold">{version._count.evaluations}</div></div>
                  <div><div className="text-muted-foreground">Created by</div><div className="mt-1 font-semibold">{version.createdBy?.name ?? version.createdBy?.email ?? "System import"}</div></div>
                  <div><div className="text-muted-foreground">Approved by</div><div className="mt-1 font-semibold">{version.approvedBy?.name ?? version.approvedBy?.email ?? "Not approved"}</div></div>
                  <div><div className="text-muted-foreground">Classification</div><div className="mt-1 font-semibold">{version.changeClassification.replace(/_/g, " ")}</div></div>
                  <div className="sm:col-span-2"><div className="text-muted-foreground">Active environments</div><div className="mt-1 font-semibold">{version.activations.filter((activation) => !activation.deactivatedAt).map((activation) => `${activation.environment}${activation.organisationKey ? ` · ${activation.organisationKey}` : " · global"}`).join(", ") || "Not active"}</div></div>
                  <div className="sm:col-span-2"><div className="text-muted-foreground">Source summary</div><div className="mt-1 font-semibold">{version.sourceGuidelineSummary}</div></div>
                  <div className="sm:col-span-2 xl:col-span-4"><div className="text-muted-foreground">Checksum</div><div className="mt-1 break-all font-mono text-xs">{version.checksum ?? "Not calculated"}</div></div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                  <div className="text-xs text-muted-foreground">Created {formatDateTime(version.createdAt)}{version.publishedAt ? ` · Published ${formatDateTime(version.publishedAt)}` : ""}</div>
                  <ClinicalRuleVersionActions
                    id={version.id}
                    status={version.status}
                    sourceSummary={version.sourceGuidelineSummary}
                    canEdit={canPerformClinicalRuleAction(user?.role, "edit")}
                    canValidate={canPerformClinicalRuleAction(user?.role, "validate")}
                    canApprove={canPerformClinicalRuleAction(user?.role, "approve")}
                    canPublish={canPerformClinicalRuleAction(user?.role, "publish")}
                    canActivate={canPerformClinicalRuleAction(user?.role, "activate")}
                    canRollback={canPerformClinicalRuleAction(user?.role, "rollback")}
                    canExport={canPerformClinicalRuleAction(user?.role, "export")}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
