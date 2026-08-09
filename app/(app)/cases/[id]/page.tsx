import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageIntro } from "@/components/layout/PageIntro";
import {
  Badge,
  PriorityBadge,
  ServiceLineBadge,
  StatusBadge,
  WorkflowBadge,
} from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WorkflowGovernancePanel } from "@/components/cases/WorkflowGovernancePanel";
import { WorkflowGuide } from "@/components/cases/WorkflowGuide";
import { ClinicalValidationBanner } from "@/components/cases/ClinicalValidationBanner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { buildOperationalState } from "@/lib/cases/operational";
import {
  buildCaseGovernanceSignals,
  getGovernanceSignalsForArea,
} from "@/lib/cases/governance";
import { getReferralCaseById, recordReferralCaseRead } from "@/lib/cases/service";
import { isFeatureEnabled } from "@/lib/features";
import { getNcsrUserAccessStatus } from "@/lib/integrations/colposcopy-registry/access";
import { getServiceIntegrationStatuses } from "@/lib/ops/integration-status";
import { prisma } from "@/lib/prisma";
import { calculateAge, formatDate, formatDateTime } from "@/lib/utils";
import { getWorkspaceContext } from "@/lib/workspace/context";
import { PageShell } from "@/components/system";

function integrationBadgeVariant(status: "ready" | "warning" | "blocked" | "info") {
  switch (status) {
    case "ready":
      return "low";
    case "warning":
      return "high";
    case "blocked":
      return "urgent";
    default:
      return "default";
  }
}

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!isFeatureEnabled("casesV2")) {
    notFound();
  }

  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  const { id } = await params;
  const referralCase = await getReferralCaseById(id);

  if (!referralCase) {
    notFound();
  }

  await recordReferralCaseRead(id, user?.id);

  const patient = referralCase.patient;
  const workspace = getWorkspaceContext(user?.role, true);
  const integrationStatuses = await getServiceIntegrationStatuses(referralCase.serviceLine);
  const ncsrStatus = integrationStatuses.find((status) => status.id === "ncsr");
  const ncsrAccess =
    referralCase.serviceLine === "COLPOSCOPY"
      ? await getNcsrUserAccessStatus({
          userId: user?.id ?? null,
          role: user?.role,
        })
      : null;
  const investigations = await prisma.caseInvestigation.findMany({
    where: { caseId: id },
    orderBy: { createdAt: "desc" },
  });
  const showDocuments =
    isFeatureEnabled("casesV2") && isFeatureEnabled("documentIngest");
  const showSummary = isFeatureEnabled("casesV2");
  const showGrade = isFeatureEnabled("casesV2");
  const governanceSignals = getGovernanceSignalsForArea(
    buildCaseGovernanceSignals({
      serviceLine: referralCase.serviceLine,
      integrationStatuses,
      ncsrAccess,
    }),
    "case-overview"
  );
  const operationalState = buildOperationalState({
    priority:
      referralCase.clinicianDecision?.finalPriority ??
      referralCase.currentPriority ??
      referralCase.ruleDecision?.priority ??
      null,
    outcome:
      referralCase.clinicianDecision?.finalOutcome ??
      referralCase.ruleDecision?.outcome ??
      null,
    requiresSmoReview: referralCase.smoOnly,
  });

  return (
    <PageShell>
      <Link
        href="/cases"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-muted-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to cases
      </Link>
      <PageIntro
        eyebrow={workspace.label}
        title={`${patient.firstName} ${patient.lastName}`}
        description={`Case ${referralCase.id} · ${patient.nhi}. Use this overview to understand the live workflow, check what evidence and summary work are complete, and move the case into guided triage or final grading.`}
        trailing={
          <>
            {showGrade && (
              <Link href={`/cases/${referralCase.id}/triage`}>
                <Button size="sm">Open Guided Triage</Button>
              </Link>
            )}
            <Link href={`/cases/${referralCase.id}/edit`}>
              <Button variant="outline" size="sm">Edit case</Button>
            </Link>
            <Link href="/audit?days=30">
              <Button variant="outline" size="sm">View audit trail</Button>
            </Link>
            {showSummary && (
              <Link href={`/cases/${referralCase.id}/summary`}>
                <Button variant="outline" size="sm">Summary</Button>
              </Link>
            )}
            {showGrade && (
              <Link href={`/cases/${referralCase.id}/grade`}>
                <Button variant="outline" size="sm">Grade</Button>
              </Link>
            )}
            {showDocuments && (
              <>
                <Link href={`/cases/${referralCase.id}/documents`}>
                  <Button variant="outline" size="sm">View documents</Button>
                </Link>
                <Link href={`/cases/${referralCase.id}/evidence`}>
                  <Button variant="outline" size="sm">View evidence</Button>
                </Link>
              </>
            )}
            <ServiceLineBadge serviceLine={referralCase.serviceLine} />
            <StatusBadge status={referralCase.status} />
          </>
        }
      />

      <ClinicalValidationBanner />

      <WorkflowGuide
        caseId={referralCase.id}
        documentCount={referralCase.documents.length}
        parsedDocumentCount={
          referralCase.documents.filter((document) => document.parseStatus === "COMPLETE").length
        }
        extractedFactCount={referralCase.extractedFacts.length}
        hasSummary={Boolean(referralCase.summary)}
        summaryStatus={referralCase.summary?.status}
        hasRuleDecision={Boolean(referralCase.ruleDecision)}
        hasClinicianDecision={Boolean(referralCase.clinicianDecision)}
        isBooked={Boolean(referralCase.bookedForAt)}
      />

      <WorkflowGovernancePanel
        title="Case Governance"
        description="These checks explain any platform, restricted-access, or validation conditions that may affect how confidently this case can move through the workflow."
        signals={governanceSignals}
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Case Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <ServiceLineBadge serviceLine={referralCase.serviceLine} />
              <StatusBadge status={referralCase.status} />
              {referralCase.currentPriority ? (
                <PriorityBadge priority={referralCase.currentPriority} />
              ) : (
                <Badge>Priority not set</Badge>
              )}
              <WorkflowBadge workflow={operationalState.workflow} />
              {referralCase.highSuspicionCancer && <Badge variant="urgent">High suspicion cancer</Badge>}
              {referralCase.smoOnly && <Badge variant="info">SMO only</Badge>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">Referral reason</div>
                <div className="text-foreground font-medium">
                  {referralCase.referralReason ?? "Not recorded"}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Category</div>
                <div className="text-foreground font-medium">
                  {referralCase.currentCategory ?? "Not assigned"}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">External case id</div>
                <div className="text-foreground font-medium">
                  {referralCase.externalCaseId ?? "—"}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Referral source</div>
                <div className="text-foreground font-medium">
                  {referralCase.referralSource ?? "—"}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Assigned to</div>
                <div className="text-foreground font-medium">
                  {referralCase.assignedTo?.name ?? "Unassigned"}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Created by</div>
                <div className="text-foreground font-medium">
                  {referralCase.createdBy.name ?? referralCase.createdBy.email}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Received</div>
                <div className="text-foreground font-medium">
                  {formatDateTime(referralCase.receivedAt)}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Last updated</div>
                <div className="text-foreground font-medium">
                  {formatDateTime(referralCase.updatedAt)}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Target due</div>
                <div className="text-foreground font-medium">
                  {formatDate(referralCase.targetDueAt)}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Booked for</div>
                <div className="text-foreground font-medium">
                  {formatDateTime(referralCase.bookedForAt)}
                </div>
              </div>
            </div>

            <div>
              <div className="text-muted-foreground text-sm">Operational workflow</div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <WorkflowBadge workflow={operationalState.workflow} />
                {operationalState.requiresSmoReview && (
                  <Badge variant="info">SMO review required</Badge>
                )}
              </div>
              <div className="mt-2 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground whitespace-pre-wrap">
                {operationalState.reason ??
                  "This case is currently on a standard bookable workflow."}
              </div>
            </div>

            <div>
              <div className="text-muted-foreground text-sm">Triage notes</div>
              <div className="mt-1 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground whitespace-pre-wrap">
                {referralCase.triageNotes ?? "No triage notes recorded yet."}
              </div>
            </div>

            {/* NCSR pull banner for colposcopy cases */}
            {referralCase.serviceLine === "COLPOSCOPY" && isFeatureEnabled("colposcopyModule") && (
              <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/40 px-4 py-3">
                <div className="text-sm space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-foreground">National Colposcopy Screening Registry</span>
                    {ncsrStatus && (
                      <Badge variant={integrationBadgeVariant(ncsrStatus.status)}>
                        {ncsrStatus.mode}
                      </Badge>
                    )}
                  </div>
                  <div className="text-muted-foreground">
                    {ncsrStatus?.summary ?? "Pull patient colposcopy history from the national registry."}
                  </div>
                  {ncsrAccess && (
                    <div className="text-muted-foreground">
                      Your access:{" "}
                      <span className="font-medium text-foreground">{ncsrAccess.mode}</span>.
                    </div>
                  )}
                </div>
                <Link
                  href={`/cases/${referralCase.id}/ncsr`}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-sm font-medium text-white hover:bg-slate-700 transition-colors shrink-0"
                >
                  View NCSR History
                </Link>
              </div>
            )}

            {/* Colposcopy-specific triage details */}
            {referralCase.serviceLine === "COLPOSCOPY" && (referralCase.hpvTestResult || referralCase.fctStatus || referralCase.cytologySample) && (
              <div>
                <div className="text-muted-foreground text-sm font-medium mb-2">Colposcopy Triage Details</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                  {referralCase.fctStatus && (
                    <div><div className="text-muted-foreground">FCT Status</div><div className="text-foreground font-medium">{referralCase.fctStatus.replace(/_/g, " ")}</div></div>
                  )}
                  {referralCase.hpvTestResult && (
                    <div><div className="text-muted-foreground">HPV Test</div><div className="text-foreground font-medium">{referralCase.hpvTestResult.replace(/_/g, " ")}</div></div>
                  )}
                  {referralCase.hpvType && (
                    <div><div className="text-muted-foreground">HPV Type</div><div className="text-foreground font-medium">{referralCase.hpvType.replace(/_/g, " ")}</div></div>
                  )}
                  {referralCase.cytologySample && (
                    <div><div className="text-muted-foreground">Cytology</div><div className="text-foreground font-medium">{referralCase.cytologySample.replace(/_/g, " ").toUpperCase()}</div></div>
                  )}
                  {referralCase.assessmentOfReferral && (
                    <div><div className="text-muted-foreground">Assessment</div><div className="text-foreground font-medium">{referralCase.assessmentOfReferral}</div></div>
                  )}
                  {referralCase.ovestinInstruction && (
                    <div><div className="text-muted-foreground">Ovestin</div><div className="text-foreground font-medium">{referralCase.ovestinInstruction.replace(/_/g, " ")}</div></div>
                  )}
                </div>
              </div>
            )}

            {/* Gynaecology-specific triage details */}
            {referralCase.serviceLine === "GYNAECOLOGY" && (referralCase.gynaecologyCategory || referralCase.ussAvailable !== null) && (
              <div>
                <div className="text-muted-foreground text-sm font-medium mb-2">Gynaecology Triage Details</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                  {referralCase.gynaecologyCategory && (
                    <div><div className="text-muted-foreground">Condition</div><div className="text-foreground font-medium">{referralCase.gynaecologyCategory.replace(/_/g, " ").toUpperCase()}</div></div>
                  )}
                  <div><div className="text-muted-foreground">USS Available</div><div className="text-foreground font-medium">{referralCase.ussAvailable ? "Yes" : "No"}</div></div>
                  {referralCase.ussFindings && (
                    <div><div className="text-muted-foreground">USS Findings</div><div className="text-foreground font-medium">{referralCase.ussFindings}</div></div>
                  )}
                </div>
              </div>
            )}

            {/* Investigations */}
            {investigations.length > 0 && (
              <div>
                <div className="text-muted-foreground text-sm font-medium mb-2">Investigations</div>
                <div className="space-y-2">
                  {investigations.map((inv) => (
                    <div key={inv.id} className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-4 py-2.5 text-sm">
                      <Badge>{inv.type}</Badge>
                      <span className="text-foreground font-medium">{inv.result ?? "Pending"}</span>
                      {inv.notes && <span className="text-muted-foreground">{inv.notes}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Patient Snapshot</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <div className="text-muted-foreground">NHI</div>
                <div className="text-foreground font-medium font-mono">{patient.nhi}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Date of birth</div>
                <div className="text-foreground font-medium">
                  {formatDate(patient.dateOfBirth)} · {calculateAge(patient.dateOfBirth)} years
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Practice</div>
                <div className="text-foreground font-medium">
                  {patient.gpPractice?.name ?? "Not linked"}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Service Dependencies</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                These checks show whether the services behind this case are fully live, still local, or still waiting on external setup.
              </div>
              {integrationStatuses.map((integration) => (
                <div
                  key={integration.id}
                  className="rounded-lg border border-border px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-foreground">{integration.title}</div>
                      <div className="mt-1 text-sm text-muted-foreground">{integration.summary}</div>
                    </div>
                    <Badge variant={integrationBadgeVariant(integration.status)}>
                      {integration.mode}
                    </Badge>
                  </div>
                  {integration.nextStep && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      Next step: {integration.nextStep}
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
