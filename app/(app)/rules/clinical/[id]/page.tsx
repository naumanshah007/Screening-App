import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AlertTriangle, History, ShieldCheck } from "lucide-react";

import { auth } from "@/lib/auth";
import { canPerformClinicalRuleAction } from "@/lib/clinical-rules/governance";
import { getClinicalRuleVersionSnapshot } from "@/lib/clinical-rules/lifecycle";
import { diffClinicalRuleSnapshots } from "@/lib/clinical-rules/diff";
import { prisma } from "@/lib/prisma";
import { PageIntro } from "@/components/layout/PageIntro";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tab, TabList, TabPanel, Tabs } from "@/components/ui/tabs";
import { ClinicalRuleGraphStudio } from "@/components/clinical-rules/ClinicalRuleGraphStudio";
import { ClinicalRuleVersionActions } from "@/components/clinical-rules/ClinicalRuleVersionActions";
import { ClinicalRuleSimulationPanel } from "@/components/clinical-rules/ClinicalRuleSimulationPanel";
import { ClinicalRuleDiffPanel } from "@/components/clinical-rules/ClinicalRuleDiffPanel";
import { ClinicalGovernanceReviewWorkspace } from "@/components/clinical-rules/ClinicalGovernanceReviewWorkspace";
import { CLINICAL_GOVERNANCE_CASES } from "@/lib/clinical-rules/governance-review";
import { formatDateTime } from "@/lib/utils";

// Governed rule versions change through the lifecycle, not at build time.
export const dynamic = "force-dynamic";


export default async function ClinicalRuleVersionPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const user = session?.user as { role?: string } | undefined;
  if (!canPerformClinicalRuleAction(user?.role, "view")) redirect("/dashboard");
  const id = (await params).id;
  const loaded = await getClinicalRuleVersionSnapshot(id).catch(() => null);
  if (!loaded) notFound();
  const { version, snapshot } = loaded;
  const validation = version.validationJson
    ? (JSON.parse(version.validationJson) as { valid: boolean; generatedAt: string; counts: Record<string, number>; issues: Array<{ code: string; severity: string; category: string; message: string; ruleId?: string }> })
    : null;
  const auditEvents = await prisma.ruleVersionAuditEvent.findMany({
    where: { ruleVersionId: version.id },
    include: { actorUser: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const governanceCases = CLINICAL_GOVERNANCE_CASES.map((item) => {
    const latest = auditEvents.find((event) => {
      if (!event.eventType.startsWith("GOVERNANCE_INTERPRETATION_")) return false;
      try {
        return (JSON.parse(event.afterJson ?? "{}") as { caseId?: string }).caseId === item.caseId;
      } catch {
        return false;
      }
    });
    let details: { disposition?: string; approvalStatus?: string } = {};
    try {
      details = JSON.parse(latest?.afterJson ?? "{}");
    } catch {
      details = {};
    }
    return {
      ...item,
      rules: snapshot.rules
        .filter((rule) => (item.affectedRuleIds as readonly string[]).includes(rule.stableRuleId))
        .map((rule) => ({
          stableRuleId: rule.stableRuleId,
          conditionExpression: rule.conditionExpression,
          provisionalOutcome: rule.provisionalOutcome,
        })),
      approvalStatus: details.approvalStatus ?? "EVIDENCE_RESOLVED_GOVERNANCE_PENDING",
      recordedDisposition: details.disposition ?? null,
      reviewerComment: latest?.reason ?? null,
    };
  });
  const parent = version.parentVersionId
    ? await getClinicalRuleVersionSnapshot(version.parentVersionId).catch(() => null)
    : null;
  const parentDiff = parent ? diffClinicalRuleSnapshots(parent.snapshot, snapshot) : null;
  const comparisonVersions = await prisma.clinicalRuleVersion.findMany({
    where: { ruleSetId: version.ruleSetId, id: { not: version.id } },
    orderBy: [{ versionMajor: "desc" }, { versionMinor: "desc" }, { versionPatch: "desc" }],
    select: { id: true, displayVersion: true, status: true },
  });
  const initialComparison = parent && parentDiff
    ? { before: { id: parent.version.id, displayVersion: parent.version.displayVersion }, after: { id: version.id, displayVersion: version.displayVersion }, diff: parentDiff }
    : null;
  const evaluatedSnapshotLocked = version._count.evaluations > 0;
  const editable =
    canPerformClinicalRuleAction(user?.role, "edit") &&
    ["DRAFT", "VALIDATED"].includes(version.status) &&
    !evaluatedSnapshotLocked;

  return (
    <div className="space-y-6 p-6 animate-fade-in">
      <div className="page-aura">
        <PageIntro eyebrow="Versioned Clinical Rule Studio" title={version.displayVersion} description={version.changeSummary ?? version.ruleSet.name} actions={[{ href: "/rules/clinical", label: "All versions" }]} />
      </div>

      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant={version.status === "ACTIVE" ? "low" : version.status === "DRAFT" ? "high" : "info"}>{version.status}</Badge>
              <Badge variant="default">{version.changeClassification.replace(/_/g, " ")}</Badge>
              <Badge variant="default">source v{version.sourcePackageVersion ?? "—"}</Badge>
              {validation && <Badge variant={validation.valid ? "low" : "urgent"}>{validation.valid ? "Validated" : `${validation.counts.errors} blockers`}</Badge>}
            </div>
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
          <div className="grid gap-3 text-xs text-muted-foreground md:grid-cols-4">
            <div><span className="font-semibold text-foreground">Revision</span><br />{version.revision}</div>
            <div><span className="font-semibold text-foreground">Parent</span><br />{version.parentVersion?.displayVersion ?? "Initial source import"}</div>
            <div><span className="font-semibold text-foreground">Created</span><br />{formatDateTime(version.createdAt)}</div>
            <div><span className="font-semibold text-foreground">Evaluations</span><br />{version._count.evaluations}</div>
          </div>
          <div className="break-all rounded-lg border border-border bg-slate-50 px-3 py-2 font-mono text-[11px] text-slate-600">SHA-256 {version.checksum}</div>
        </CardContent>
      </Card>

      {evaluatedSnapshotLocked && (
        <div role="status" className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <div>
            <p className="font-semibold">Evaluated snapshot locked</p>
            <p className="mt-1 leading-6">
              This version has {version._count.evaluations} append-only evaluation{version._count.evaluations === 1 ? "" : "s"}, so its graph and rules are read only. Clone it under a new semantic version before making changes.
            </p>
          </div>
        </div>
      )}

      <Tabs defaultTab="overview" className="rounded-2xl border border-border bg-card shadow-sm">
        <TabList className="px-2">
          <Tab id="overview">Overview</Tab><Tab id="master">Master Tree</Tab><Tab id="views">Pathway Views</Tab><Tab id="rules">Rules</Tab><Tab id="sources">Sources</Tab><Tab id="validation">Validation</Tab><Tab id="governance">Clinical Review</Tab><Tab id="simulation">Simulation</Tab><Tab id="diff">Diff</Tab><Tab id="audit">Audit History</Tab>
        </TabList>

        <TabPanel id="overview" className="p-6">
          <div className="grid gap-5 lg:grid-cols-3">
            <Card className="lg:col-span-2"><CardHeader><CardTitle>Canonical snapshot</CardTitle></CardHeader><CardContent><div className="grid grid-cols-2 gap-4 text-sm lg:grid-cols-4"><Metric label="Rules" value={snapshot.rules.length} /><Metric label="Nodes" value={snapshot.nodes.length} /><Metric label="Edges" value={snapshot.edges.length} /><Metric label="Views" value={snapshot.views.length} /></div><p className="mt-5 text-sm leading-6 text-muted-foreground">Rules, graph identity, outcomes, sources, view membership and layout coordinates are checksum-protected in one snapshot. Pathway layouts differ, while clinical rule and node identities remain shared.</p></CardContent></Card>
            <Card><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-brand-600" />Safety boundary</CardTitle></CardHeader><CardContent><p className="text-sm leading-6 text-muted-foreground">Provisional recommendation. Reviewer confirmation required. Not for direct clinical action. Demo environment.</p></CardContent></Card>
            <Card className="lg:col-span-3"><CardHeader><CardTitle>Clinical source summary</CardTitle></CardHeader><CardContent><p className="text-sm leading-6 text-muted-foreground">{version.sourceGuidelineSummary}</p></CardContent></Card>
          </div>
        </TabPanel>

        <TabPanel id="master" className="p-4">
          <ClinicalRuleGraphStudio versionId={version.id} initialSnapshot={snapshot} initialRevision={version.revision} editable={editable} />
        </TabPanel>

        <TabPanel id="views" className="p-6">
          <div className="grid gap-4 lg:grid-cols-2">{[...snapshot.views].sort((a, b) => a.displayOrder - b.displayOrder).map((view) => <Card key={view.key}><CardHeader><div><CardTitle>{view.title}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{view.description}</p></div><Badge variant={view.viewType === "MASTER" ? "info" : "default"}>{view.viewType}</Badge></CardHeader><CardContent className="text-sm text-muted-foreground">{view.includedNodeIds.length} canonical nodes · {view.includedEdgeIds.length} canonical edges · layout only is view-specific</CardContent></Card>)}</div>
        </TabPanel>

        <TabPanel id="rules" className="p-6">
          <div className="max-h-[760px] overflow-auto rounded-xl border border-border"><table className="w-full min-w-[1100px] text-left text-xs"><thead className="sticky top-0 bg-navy-800 text-white"><tr><th className="p-3">Rule</th><th className="p-3">Section / stage</th><th className="p-3">Condition</th><th className="p-3">Provisional outcome</th><th className="p-3">Safety</th><th className="p-3">Source</th></tr></thead><tbody>{snapshot.rules.map((rule) => <tr key={rule.stableRuleId} className="border-t border-border align-top"><td className="p-3 font-mono font-bold">{rule.stableRuleId}</td><td className="p-3"><div className="font-semibold">{rule.section}</div><div className="mt-1 text-muted-foreground">{rule.pathwayStage}</div></td><td className="p-3 leading-5"><Badge variant={rule.conditionExpression.type === "SOURCE_TEXT" ? "high" : "low"}>{rule.conditionExpression.type}</Badge><div className="mt-2">{rule.sourceConditionText}</div></td><td className="p-3 leading-5">{rule.provisionalOutcome}</td><td className="p-3"><Badge variant={rule.safetyPriority === "CRITICAL" ? "urgent" : rule.safetyPriority === "HIGH" ? "high" : "default"}>{rule.safetyPriority}</Badge></td><td className="p-3 leading-5">{rule.sourceReferences.map((source) => `${source.document} · ${source.reference}`).join("; ")}</td></tr>)}</tbody></table></div>
        </TabPanel>

        <TabPanel id="sources" className="p-6">
          <div className="space-y-4">{snapshot.sources.map((source) => <Card key={`${source.priority}-${source.file}`}><CardHeader><div><CardTitle>{source.document}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{source.version} · {source.published}</p></div><Badge variant="info">Precedence {source.priority}</Badge></CardHeader><CardContent className="text-sm leading-6 text-muted-foreground"><p>{source.role}. {source.notes}</p><p className="mt-2 font-mono text-xs">{source.file}</p></CardContent></Card>)}</div>
        </TabPanel>

        <TabPanel id="validation" className="p-6">
          {!validation ? <div className="rounded-xl border border-dashed border-border p-8 text-center"><AlertTriangle className="mx-auto h-8 w-8 text-amber-600" /><h3 className="mt-3 font-semibold">Not validated</h3><p className="mt-2 text-sm text-muted-foreground">Run validation before approval or publication.</p></div> : <div><div className="grid gap-3 sm:grid-cols-4"><Metric label="Errors" value={validation.counts.errors} /><Metric label="Warnings" value={validation.counts.warnings} /><Metric label="Rules" value={validation.counts.rules} /><Metric label="Views" value={validation.counts.views} /></div><div className="mt-5 max-h-[640px] space-y-2 overflow-y-auto">{validation.issues.map((issue, index) => <div key={`${issue.code}-${issue.ruleId ?? index}`} className={issue.severity === "ERROR" ? "rounded-lg border border-red-200 bg-red-50 p-3 text-xs" : "rounded-lg border border-border p-3 text-xs"}><div className="flex flex-wrap gap-2 font-bold"><span>{issue.severity}</span><span>·</span><span>{issue.code}</span>{issue.ruleId && <Badge>{issue.ruleId}</Badge>}</div><p className="mt-2 leading-5">{issue.message}</p></div>)}</div></div>}
        </TabPanel>

        <TabPanel id="governance" className="p-6">
          <ClinicalGovernanceReviewWorkspace
            versionId={version.id}
            initialRevision={version.revision}
            status={version.status}
            canPropose={canPerformClinicalRuleAction(user?.role, "validate")}
            canApprove={canPerformClinicalRuleAction(user?.role, "approve")}
            cases={governanceCases}
          />
        </TabPanel>

        <TabPanel id="simulation" className="p-6"><ClinicalRuleSimulationPanel versionId={version.id} /></TabPanel>

        <TabPanel id="diff" className="p-6"><ClinicalRuleDiffPanel currentVersionId={version.id} currentVersionDisplay={version.displayVersion} versions={comparisonVersions} initialComparison={initialComparison} /></TabPanel>

        <TabPanel id="audit" className="p-6"><div className="space-y-3">{auditEvents.map((event) => <Card key={event.id}><CardContent className="flex items-start gap-4 p-4"><History className="mt-0.5 h-4 w-4 text-brand-600" /><div><div className="font-semibold">{event.eventType}</div><p className="mt-1 text-xs text-muted-foreground">{event.actorUser?.name ?? event.actorUser?.email ?? "System"} · {formatDateTime(event.createdAt)}</p>{event.reason && <p className="mt-2 text-sm">{event.reason}</p>}</div></CardContent></Card>)}</div></TabPanel>
      </Tabs>

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground"><Link href="/rules/clinical" className="font-semibold text-brand-700 hover:underline">← Version list</Link><span>Not for direct clinical action · Demo environment · Simulated export package</span></div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-xl border border-border bg-slate-50 p-4"><div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div><div className="mt-1 text-2xl font-bold text-navy-800">{value}</div></div>;
}
