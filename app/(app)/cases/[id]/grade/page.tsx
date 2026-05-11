import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, GitBranch, TriangleAlert } from "lucide-react";
import { auth } from "@/lib/auth";
import { WorkflowGovernancePanel } from "@/components/cases/WorkflowGovernancePanel";
import { ClinicalValidationBanner } from "@/components/cases/ClinicalValidationBanner";
import { RecommendationSafetyPanel } from "@/components/cases/RecommendationSafetyPanel";
import { PageIntro } from "@/components/layout/PageIntro";
import { Button } from "@/components/ui/button";
import {
  Badge,
  PriorityBadge,
  ServiceLineBadge,
  StatusBadge,
  WorkflowBadge,
} from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  buildOperationalState,
  isOperationalWorkflowBookable,
} from "@/lib/cases/operational";
import {
  buildCaseGovernanceSignals,
  getAiAssistDisabledReason,
  getGovernanceSignalsForArea,
} from "@/lib/cases/governance";
import { getStoredClinicianDecision } from "@/lib/cases/decision";
import {
  getCaseSlaSnapshot,
  getPrioritySlaRule,
  getServiceSlaSummary,
  getSlaBadgeVariant,
} from "@/lib/cases/sla";
import { getReferralCaseById } from "@/lib/cases/service";
import {
  getCaseEvaluationFactsPreview,
  getStoredRuleDecision,
  parseGradeRecommendationPayload,
} from "@/lib/cases/grading";
import {
  getStoredClinicalSummary,
  parseClinicalSummaryPayload,
} from "@/lib/cases/summary";
import { isFeatureEnabled } from "@/lib/features";
import { getNcsrUserAccessStatus } from "@/lib/integrations/colposcopy-registry/access";
import { getServiceIntegrationStatuses } from "@/lib/ops/integration-status";
import { prisma } from "@/lib/prisma";
import { formatClinicalReferenceText, formatDate, formatDateTime } from "@/lib/utils";
import { getWorkspaceContext } from "@/lib/workspace/context";
import { BookingUpdateForm } from "./BookingUpdateForm";
import { ColposcopyGradeSheetForm } from "./ColposcopyGradeSheetForm";
import { DecisionSaveForm } from "./DecisionSaveForm";
import { GradeEvaluateButton } from "./GradeEvaluateButton";
import { AiAssistButton } from "./AiAssistButton";
import { GynaecologyGradeWorkbenchForm } from "./GynaecologyGradeWorkbenchForm";

type StoredEvidencePayload = {
  lines: string[];
};

function parseEvidencePayload(json: string): StoredEvidencePayload {
  return JSON.parse(json) as StoredEvidencePayload;
}

export default async function CaseGradePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!isFeatureEnabled("casesV2")) {
    notFound();
  }

  const { id } = await params;
  const session = await auth();
  const user = session?.user as { role?: string } | undefined;
  const [referralCase, decision, clinicianDecision, investigations, summary, evaluationFacts] = await Promise.all([
    getReferralCaseById(id),
    getStoredRuleDecision(id),
    getStoredClinicianDecision(id),
    prisma.caseInvestigation.findMany({
      where: { caseId: id },
      orderBy: [{ investigationDate: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        type: true,
        result: true,
        notes: true,
      },
    }),
    getStoredClinicalSummary(id),
    getCaseEvaluationFactsPreview(id),
  ]);

  if (!referralCase) {
    notFound();
  }

  const workspace = getWorkspaceContext(user?.role, true);
  const integrationStatuses = await getServiceIntegrationStatuses(referralCase.serviceLine);
  const ncsrAccess =
    referralCase.serviceLine === "COLPOSCOPY"
      ? await getNcsrUserAccessStatus({
          userId: (session?.user as { id?: string } | undefined)?.id ?? null,
          role: user?.role,
        })
      : null;
  const governanceSignals = buildCaseGovernanceSignals({
    serviceLine: referralCase.serviceLine,
    integrationStatuses,
    ncsrAccess,
  });
  const gradeGovernanceSignals = getGovernanceSignalsForArea(
    governanceSignals,
    "grade"
  );
  const aiAssistDisabledReason = getAiAssistDisabledReason(
    getGovernanceSignalsForArea(governanceSignals, "ai")
  );

  const payload = decision ? parseGradeRecommendationPayload(decision.traceJson) : null;
  const evidencePayload = decision ? parseEvidencePayload(decision.evidenceJson) : null;
  const summaryPayload = summary ? parseClinicalSummaryPayload(summary.summaryJson) : null;
  const gradingSignals = evaluationFacts ?? [];
  const releaseLabel =
    decision?.ruleSetRelease
      ? `${decision.ruleSetRelease.name} · v${decision.ruleSetRelease.version}`
      : payload?.ruleRelease
        ? `${payload.ruleRelease.name} · v${payload.ruleRelease.version}`
        : null;
  const summaryApprovalBlocker = !referralCase.summary
    ? "Generate and approve the clinical summary before deterministic grading."
    : referralCase.summary.status !== "APPROVED"
      ? "The clinical summary is not approved yet. Save review or approve it from the summary screen first."
      : null;
  const bookingDisabledReason = !clinicianDecision
    ? "Save a clinician decision before booking this case."
    : (() => {
        const workflow = buildOperationalState({
          priority: clinicianDecision.finalPriority,
          outcome: clinicianDecision.finalOutcome,
          requiresSmoReview: referralCase.smoOnly,
        });
        return isOperationalWorkflowBookable(workflow.workflow)
          ? null
          : workflow.reason ?? "This case is not bookable in its current clinician-approved state.";
      })();
  const slaRule = getPrioritySlaRule(
    {
      serviceLine: referralCase.serviceLine,
      priority: clinicianDecision?.finalPriority ?? payload?.recommendation.priority ?? null,
    }
  );
  const slaSnapshot = getCaseSlaSnapshot({
    targetDueAt: referralCase.targetDueAt,
    bookedForAt: referralCase.bookedForAt,
    status: referralCase.status,
  });
  const servicePolicySummary = getServiceSlaSummary(referralCase.serviceLine);
  const clinicianOverride =
    Boolean(clinicianDecision) &&
    Boolean(payload) &&
    (clinicianDecision?.finalPriority !== payload?.recommendation.priority ||
      (clinicianDecision?.finalCategory ?? "") !== payload?.recommendation.category ||
      clinicianDecision?.finalOutcome !== payload?.recommendation.outcome);
  const provisionalOperationalState = payload?.operational ?? null;
  const finalOperationalState = clinicianDecision
    ? buildOperationalState({
        priority: clinicianDecision.finalPriority,
        outcome: clinicianDecision.finalOutcome,
        requiresSmoReview: referralCase.smoOnly,
      })
    : provisionalOperationalState;

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <Link
        href={`/cases/${referralCase.id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-muted-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to case
      </Link>
      <PageIntro
        eyebrow={workspace.label}
        title="Grading Workspace"
        description={`${referralCase.patient.firstName} ${referralCase.patient.lastName} · ${referralCase.patient.nhi}. Review the approved summary, run the deterministic recommendation, then confirm the final clinical decision and booking path. ${servicePolicySummary}`}
        trailing={
          <>
            <Link href={`/cases/${referralCase.id}/documents`}>
              <Button variant="outline" size="sm">Documents</Button>
            </Link>
            <Link href={`/cases/${referralCase.id}/summary`}>
              <Button variant="outline" size="sm">Summary</Button>
            </Link>
            <Link href={`/cases/${referralCase.id}/evidence`}>
              <Button variant="outline" size="sm">Evidence</Button>
            </Link>
            <Link href="/audit?days=30">
              <Button variant="outline" size="sm">Audit</Button>
            </Link>
            <ServiceLineBadge serviceLine={referralCase.serviceLine} />
            <StatusBadge status={referralCase.status} />
            <GradeEvaluateButton
              caseId={referralCase.id}
              disabledReason={summaryApprovalBlocker}
            />
          </>
        }
      />

      <ClinicalValidationBanner />

      {summaryApprovalBlocker && (
        <Card>
          <CardContent className="py-4">
            <div className="rounded-xl border border-warn/30 bg-warn/5 px-4 py-4 text-sm text-foreground">
              {summaryApprovalBlocker}
            </div>
          </CardContent>
        </Card>
      )}

      <WorkflowGovernancePanel
        title="Grading Governance"
        description="These checks explain whether any restricted integration, platform dependency, or governance control may affect grading for this case."
        signals={gradeGovernanceSignals}
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 space-y-6">
            {referralCase.serviceLine === "COLPOSCOPY" && (
              <Card>
                <CardHeader>
                  <CardTitle>Colposcopy Grading Sheet</CardTitle>
                </CardHeader>
                <CardContent>
                  <ColposcopyGradeSheetForm
                    caseId={referralCase.id}
                    investigations={investigations}
                    initialValues={{
                      highSuspicionCancer: referralCase.highSuspicionCancer,
                      smoOnly: referralCase.smoOnly,
                      triageNotes: referralCase.triageNotes ?? "",
                      fctStatus: referralCase.fctStatus ?? "",
                      hpvTestResult: referralCase.hpvTestResult ?? "",
                      hpvType: referralCase.hpvType ?? "",
                      cytologySample: referralCase.cytologySample ?? "",
                      referrerReasonCode: referralCase.referrerReasonCode ?? "",
                      assessmentOfReferral: referralCase.assessmentOfReferral ?? "",
                      bookingPriorityNote: referralCase.bookingPriorityNote ?? "",
                      referralType: referralCase.referralType ?? "",
                      ovestinInstruction: referralCase.ovestinInstruction ?? "",
                      ncsrNoteAdded: referralCase.ncsrNoteAdded ?? false,
                      referralNoteAdded: referralCase.referralNoteAdded ?? false,
                      internalTriageNotes: referralCase.internalTriageNotes ?? "",
                    }}
                  />
                </CardContent>
              </Card>
            )}

            {referralCase.serviceLine === "GYNAECOLOGY" && (
              <Card>
                <CardHeader>
                  <CardTitle>Gynaecology Review Workbench</CardTitle>
                </CardHeader>
                <CardContent>
                  <GynaecologyGradeWorkbenchForm
                    caseId={referralCase.id}
                    investigations={investigations}
                    summaryPayload={summaryPayload}
                    summaryApproved={referralCase.summary?.status === "APPROVED"}
                    initialValues={{
                      highSuspicionCancer: referralCase.highSuspicionCancer,
                      smoOnly: referralCase.smoOnly,
                      gynaecologyCategory: referralCase.gynaecologyCategory ?? "",
                      ussAvailable: referralCase.ussAvailable ?? false,
                      ussFindings: referralCase.ussFindings ?? "",
                      triageNotes: referralCase.triageNotes ?? "",
                      internalTriageNotes: referralCase.internalTriageNotes ?? "",
                    }}
                  />
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Signals Feeding Recommendation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                  The grading engine combines extracted document evidence, structured workbench fields, and typed notes. Review these signals to confirm the case context makes sense before accepting the provisional outcome.
                </div>
                {gradingSignals.length === 0 ? (
                  <EmptyState
                    title="No rule-ready signals available yet"
                    description="The grading engine does not have enough usable inputs yet."
                    nextStep="Upload and ingest the referral pack, then complete the service-specific workbench fields so the recommendation engine can see the right signals."
                    action={{ href: `/cases/${referralCase.id}/documents`, label: "Open documents" }}
                    className="py-10"
                  />
                ) : (
                  <div className="space-y-3">
                    {gradingSignals.slice(0, 12).map((fact) => (
                      <div
                        key={`${fact.label}-${fact.valueText}-${fact.evidence}`}
                        className="rounded-lg border border-border px-4 py-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-medium text-foreground">{fact.label}</div>
                            <div className="text-sm text-muted-foreground">{fact.valueText}</div>
                          </div>
                          {fact.valueNumber !== undefined && (
                            <Badge variant="default">{fact.valueNumber}</Badge>
                          )}
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground">{fact.evidence}</div>
                      </div>
                    ))}
                    {gradingSignals.length > 12 && (
                      <div className="text-xs text-muted-foreground">
                        Showing 12 of {gradingSignals.length} detected signals. Open the evidence screen for the full supporting extracts.
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Provisional Recommendation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {!payload || !decision ? (
                  <EmptyState
                    icon={GitBranch}
                    eyebrow={workspace.label}
                    title="No rule decision generated yet"
                    description={
                      summaryApprovalBlocker ??
                      "Run the deterministic grading rules to produce a provisional recommendation and rule trace."
                    }
                    nextStep={
                      summaryApprovalBlocker
                        ? "Approve the clinical summary first, then return here and run the deterministic recommendation."
                        : "Run the recommendation engine, review the rationale and rule trace, then save the clinician decision."
                    }
                    action={
                      summaryApprovalBlocker
                        ? {
                            href: `/cases/${referralCase.id}/summary`,
                            label: "Open summary",
                          }
                        : undefined
                    }
                  />
                ) : (
                  <>
                    <div className="rounded-xl border border-border bg-muted/40 px-4 py-4">
                      <div className="flex flex-wrap gap-2 mb-3">
                        <PriorityBadge priority={payload.recommendation.priority} />
                        <Badge variant="info">{payload.recommendation.category}</Badge>
                        <WorkflowBadge workflow={payload.operational.workflow} />
                        {payload.operational.requiresSmoReview && (
                          <Badge variant="info">SMO only</Badge>
                        )}
                      </div>
                      <div className="text-lg font-semibold text-foreground">
                        {formatClinicalReferenceText(payload.recommendation.outcome)}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        Generated {formatDateTime(decision.updatedAt)} by {payload.generatedBy}
                      </div>
                      {releaseLabel && (
                        <div className="text-sm text-muted-foreground mt-1">
                          Release {releaseLabel}
                        </div>
                      )}
                      {payload.operational.reason && (
                        <div className="mt-3 rounded-lg border border-border bg-card px-3 py-3 text-sm text-muted-foreground">
                          {formatClinicalReferenceText(payload.operational.reason)}
                        </div>
                      )}
                    </div>

                    {(payload.warnings ?? []).length > 0 && (
                      <div className="rounded-xl border border-warn/30 bg-warn/5 px-4 py-4">
                        <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
                          <TriangleAlert className="h-4 w-4" />
                          Provisional warnings
                        </div>
                        <ul className="mt-3 space-y-2 text-sm text-foreground">
                          {(payload.warnings ?? []).map((warning) => (
                            <li key={warning}>• {formatClinicalReferenceText(warning)}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <RecommendationSafetyPanel
                      safetyOutcome={payload.safetyOutcome}
                      missingInformation={payload.missingInformation}
                      externalDependencies={payload.externalDependencies}
                      nextActions={payload.nextActions}
                    />

                    <div>
                      <h2 className="text-base font-semibold text-foreground mb-3">
                        Rationale
                      </h2>
                      <div className="rounded-xl border border-border bg-card">
                        <ul className="divide-y divide-border">
                          {(payload.rationale ?? []).map((line) => (
                            <li key={line} className="px-4 py-3 text-sm text-muted-foreground">
                              {formatClinicalReferenceText(line)}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div>
                      <h2 className="text-base font-semibold text-foreground mb-3">
                        Rule Trace
                      </h2>
                      <div className="space-y-3">
                        {(payload.trace ?? []).map((item) => (
                          <div
                            key={item.code}
                            className="rounded-xl border border-border bg-card px-4 py-4"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="font-semibold text-foreground">
                                  {item.code} · {item.title}
                                </div>
                                <div className="text-sm text-muted-foreground mt-1">
                                  {item.impact}
                                </div>
                              </div>
                              <Badge variant={item.matched ? "low" : "default"}>
                                {item.matched ? "Matched" : "Not matched"}
                              </Badge>
                            </div>
                            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                              {item.evidence.length > 0 ? (
                                item.evidence.map((evidence) => (
                                  <li key={evidence}>• {evidence}</li>
                                ))
                              ) : (
                                <li>No evidence lines captured for this rule.</li>
                              )}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            {isFeatureEnabled("aiAssist") && (
              <AiAssistButton
                caseId={referralCase.id}
                disabledReason={aiAssistDisabledReason}
              />
            )}

            <Card>
              <CardHeader>
                <CardTitle>Clinician Confirmation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {clinicianDecision ? (
                  <div className="rounded-xl border border-border bg-muted/40 px-4 py-4 space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {clinicianDecision.finalPriority && (
                        <PriorityBadge priority={clinicianDecision.finalPriority} />
                      )}
                      {clinicianDecision.finalCategory && (
                        <Badge variant="info">{clinicianDecision.finalCategory}</Badge>
                      )}
                      <Badge variant={clinicianOverride ? "high" : "low"}>
                        {clinicianOverride ? "Overridden" : "Accepted"}
                      </Badge>
                      {finalOperationalState && (
                        <WorkflowBadge workflow={finalOperationalState.workflow} />
                      )}
                      {finalOperationalState?.requiresSmoReview && (
                        <Badge variant="info">SMO only</Badge>
                      )}
                    </div>
                    <div className="text-sm font-medium text-foreground">
                      {clinicianDecision.finalOutcome}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Saved {formatDateTime(clinicianDecision.updatedAt)} by{" "}
                      {clinicianDecision.decidedBy.name ??
                        clinicianDecision.decidedBy.email}
                    </div>
                    {clinicianDecision.overrideReason && (
                      <div className="text-sm text-muted-foreground">
                        <span className="font-semibold text-foreground">
                          Override reason:
                        </span>{" "}
                        {clinicianDecision.overrideReason}
                      </div>
                    )}
                    {clinicianDecision.notes && (
                      <div className="text-sm text-muted-foreground">
                        <span className="font-semibold text-foreground">
                          Notes:
                        </span>{" "}
                        {clinicianDecision.notes}
                      </div>
                    )}
                    {finalOperationalState?.reason && (
                      <div className="text-sm text-muted-foreground">
                        <span className="font-semibold text-foreground">
                          Workflow reason:
                        </span>{" "}
                        {finalOperationalState.reason}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    No clinician decision has been saved yet.
                  </div>
                )}

                <DecisionSaveForm
                  caseId={referralCase.id}
                  recommendation={payload?.recommendation}
                  existingDecision={
                    clinicianDecision
                      ? {
                          finalPriority: clinicianDecision.finalPriority,
                          finalCategory: clinicianDecision.finalCategory,
                          finalOutcome: clinicianDecision.finalOutcome,
                          overrideReason: clinicianDecision.overrideReason,
                          notes: clinicianDecision.notes,
                        }
                      : null
                  }
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Booking And SLA</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-xl border border-border bg-muted/40 px-4 py-4 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={getSlaBadgeVariant(slaSnapshot.kind)}>
                      {slaSnapshot.label}
                    </Badge>
                    {slaRule && <Badge variant="default">{slaRule.label}</Badge>}
                    {finalOperationalState && (
                      <WorkflowBadge workflow={finalOperationalState.workflow} />
                    )}
                    {finalOperationalState?.requiresSmoReview && (
                      <Badge variant="info">SMO review required</Badge>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {servicePolicySummary}
                  </div>
                  {finalOperationalState?.reason && (
                    <div className="rounded-lg border border-border bg-card px-3 py-3 text-sm text-muted-foreground">
                      {finalOperationalState.reason}
                    </div>
                  )}
                  <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <div className="text-muted-foreground">Target due</div>
                      <div className="font-medium text-foreground">
                        {formatDate(referralCase.targetDueAt)}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Booked for</div>
                      <div className="font-medium text-foreground">
                        {formatDateTime(referralCase.bookedForAt)}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Booked at</div>
                      <div className="font-medium text-foreground">
                        {formatDateTime(referralCase.bookedAt)}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Case status</div>
                      <div className="font-medium text-foreground">
                        {referralCase.status}
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-sm">Current booking notes</div>
                    <div className="mt-1 rounded-lg border border-border bg-card px-3 py-3 text-sm text-muted-foreground whitespace-pre-wrap">
                      {referralCase.bookingNotes ?? "No booking notes saved yet."}
                    </div>
                  </div>
                </div>

                <BookingUpdateForm
                  caseId={referralCase.id}
                  initialBookedForAt={referralCase.bookedForAt}
                  initialBookingNotes={referralCase.bookingNotes}
                  disabled={Boolean(bookingDisabledReason)}
                  disabledMessage={bookingDisabledReason ?? undefined}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Evidence Used</CardTitle>
              </CardHeader>
              <CardContent>
                {evidencePayload && evidencePayload.lines.length > 0 ? (
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {evidencePayload.lines.map((line) => (
                      <li key={line}>• {line}</li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    No evidence lines were attached to this decision.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Next Actions</CardTitle>
              </CardHeader>
              <CardContent>
                {(payload?.nextActions ?? []).length > 0 ? (
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {(payload?.nextActions ?? []).map((action) => (
                      <li key={action}>• {formatClinicalReferenceText(action)}</li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    No next actions were generated.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Stored Narrative</CardTitle>
              </CardHeader>
              <CardContent>
                {decision ? (
                  <pre className="whitespace-pre-wrap text-xs text-muted-foreground rounded-lg border border-border bg-muted/40 p-3 overflow-x-auto">
                    {formatClinicalReferenceText(decision.rationale)}
                  </pre>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    No stored narrative is available until the recommendation is generated.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
    </div>
  );
}
