import { notFound } from "next/navigation";
import Link from "next/link";
import {
  FileText,
  GitBranch,
  Stethoscope,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";
import { Badge, PriorityBadge, ServiceLineBadge, StatusBadge } from "@/components/ui/badge";
import { PageIntro } from "@/components/layout/PageIntro";
import { WorkflowGuide } from "@/components/cases/WorkflowGuide";
import { ClinicalValidationBanner } from "@/components/cases/ClinicalValidationBanner";
import { RecommendationSafetyPanel } from "@/components/cases/RecommendationSafetyPanel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { isFeatureEnabled } from "@/lib/features";
import { getReferralCaseById } from "@/lib/cases/service";
import { getStoredClinicalSummary, parseClinicalSummaryPayload } from "@/lib/cases/summary";
import { getStoredRuleDecision, parseGradeRecommendationPayload } from "@/lib/cases/grading";
import { getStoredClinicianDecision } from "@/lib/cases/decision";
import { getCaseSlaSnapshot } from "@/lib/cases/sla";
import { calculateAge, cn, formatClinicalReferenceText, formatDate, formatDateTime } from "@/lib/utils";
import { getWorkspaceContext } from "@/lib/workspace/context";
import { DecisionSaveForm } from "../grade/DecisionSaveForm";
import { AiAssistButton } from "../grade/AiAssistButton";
import { SummaryGenerateButton } from "../summary/SummaryGenerateButton";
import { TriageActionBar } from "./TriageActionBar";

export default async function TriagePage({
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

  const [referralCase, summary, ruleDecision, clinicianDecision] = await Promise.all([
    getReferralCaseById(id),
    getStoredClinicalSummary(id),
    getStoredRuleDecision(id),
    getStoredClinicianDecision(id),
  ]);

  if (!referralCase) {
    notFound();
  }

  const summaryPayload = summary ? parseClinicalSummaryPayload(summary.summaryJson) : null;
  const rulePayload = ruleDecision ? parseGradeRecommendationPayload(ruleDecision.traceJson) : null;
  const sla = getCaseSlaSnapshot({
    targetDueAt: referralCase.targetDueAt,
    bookedForAt: referralCase.bookedForAt,
    status: referralCase.status,
  });

  const patient = referralCase.patient;
  const age = patient.dateOfBirth ? calculateAge(patient.dateOfBirth) : null;
  const workspace = getWorkspaceContext(user?.role, true);
  const summaryApproved = summary?.status === "APPROVED";
  const hasRuleDecision = Boolean(ruleDecision);
  const hasClinicianDecision = Boolean(clinicianDecision);

  const recommendation = rulePayload?.recommendation;

  // Colposcopy triage fields to show
  const colpoFields = referralCase.serviceLine === "COLPOSCOPY" ? [
    referralCase.fctStatus && { label: "FCT Status", value: referralCase.fctStatus },
    referralCase.hpvTestResult && { label: "HPV Test", value: referralCase.hpvTestResult },
    referralCase.hpvType && { label: "HPV Type", value: referralCase.hpvType },
    referralCase.cytologySample && { label: "Cytology", value: referralCase.cytologySample },
    referralCase.assessmentOfReferral && { label: "Assessment", value: referralCase.assessmentOfReferral },
    referralCase.ovestinInstruction && { label: "Ovestin", value: referralCase.ovestinInstruction },
    referralCase.referralType && { label: "Referral type", value: referralCase.referralType },
  ].filter(Boolean) as { label: string; value: string }[] : [];

  const gynaeFields = referralCase.serviceLine === "GYNAECOLOGY" ? [
    referralCase.gynaecologyCategory && { label: "Condition category", value: referralCase.gynaecologyCategory },
    referralCase.ussAvailable !== null && referralCase.ussAvailable !== undefined
      ? { label: "USS available", value: referralCase.ussAvailable ? "Yes" : "No" }
      : null,
    referralCase.ussFindings && { label: "USS findings", value: referralCase.ussFindings },
  ].filter(Boolean) as { label: string; value: string }[] : [];

  return (
    <div className="flex flex-col h-full">
      {/* Sticky action bar */}
      <TriageActionBar
        caseId={id}
        patientName={`${patient.firstName} ${patient.lastName}`}
        nhi={patient.nhi}
        serviceLine={referralCase.serviceLine}
        status={referralCase.status}
        hasDocuments={referralCase.documents.length > 0}
        hasSummary={Boolean(summary)}
        summaryApproved={summaryApproved}
        hasRuleDecision={hasRuleDecision}
        hasClinicianDecision={hasClinicianDecision}
      />

      {/* Two-column triage layout */}
      <div className="page-aura shrink-0 border-b border-border bg-card px-6 py-5 space-y-4">
        <Link
          href={`/cases/${id}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to case
        </Link>
        <PageIntro
          eyebrow={workspace.label}
          title="Guided Triage"
          description={`${patient.firstName} ${patient.lastName} · ${patient.nhi}. Review the prepared evidence, confirm the summary, and move through recommendation to clinician decision without losing the live operational picture.`}
          trailing={
            <>
              <Link href={`/cases/${id}/summary`}>
                <Button variant="outline" size="sm">Full summary</Button>
              </Link>
              <Link href={`/cases/${id}/grade`}>
                <Button variant="outline" size="sm">Grade panel</Button>
              </Link>
              <Link href={`/cases/${id}/documents`}>
                <Button variant="outline" size="sm">Documents</Button>
              </Link>
              <Link href="/audit?days=30">
                <Button variant="outline" size="sm">Audit</Button>
              </Link>
              <ServiceLineBadge serviceLine={referralCase.serviceLine} />
              <StatusBadge status={referralCase.status} />
            </>
          }
        />
        <ClinicalValidationBanner />
      </div>
      <div className="flex-1 overflow-hidden">
        <div className="h-full grid grid-cols-1 xl:grid-cols-5 gap-0 divide-y xl:divide-y-0 xl:divide-x divide-border overflow-auto xl:overflow-hidden">

          {/* LEFT PANEL — clinical information */}
          <div className="xl:col-span-3 overflow-y-auto p-6 space-y-5">

            <WorkflowGuide
              caseId={id}
              documentCount={referralCase.documents.length}
              parsedDocumentCount={
                referralCase.documents.filter((document) => document.parseStatus === "COMPLETE").length
              }
              extractedFactCount={referralCase.extractedFacts.length}
              hasSummary={Boolean(summary)}
              summaryStatus={summary?.status}
              hasRuleDecision={hasRuleDecision}
              hasClinicianDecision={hasClinicianDecision}
              isBooked={Boolean(referralCase.bookedForAt)}
            />

            {/* Patient demographics */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide font-semibold">
                  Patient
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-foreground">
                      {patient.firstName} {patient.lastName}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      NHI <span className="font-mono font-semibold text-muted-foreground">{patient.nhi}</span>
                      {patient.dateOfBirth && (
                        <> · DOB {formatDate(patient.dateOfBirth)} ({age} yrs)</>
                      )}
                    </p>
                    {patient.gpPractice && (
                      <p className="text-sm text-muted-foreground mt-0.5">
                        GP Practice: {patient.gpPractice.name}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <ServiceLineBadge serviceLine={referralCase.serviceLine} />
                    <StatusBadge status={referralCase.status} />
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 text-sm border-t border-border pt-4">
                  <div>
                    <p className="text-muted-foreground">Received</p>
                    <p className="font-medium text-foreground">{formatDate(referralCase.receivedAt)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Referral source</p>
                    <p className="font-medium text-foreground">{referralCase.referralSource ?? "—"}</p>
                  </div>
                  {referralCase.referralReason && (
                    <div className="col-span-2 sm:col-span-3">
                      <p className="text-muted-foreground">Reason for referral</p>
                      <p className="font-medium text-foreground whitespace-pre-wrap">{referralCase.referralReason}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Service-line specific triage fields */}
            {(colpoFields.length > 0 || gynaeFields.length > 0) && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide font-semibold">
                    {referralCase.serviceLine === "COLPOSCOPY" ? "Colposcopy Triage" : "Gynaecology Details"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 text-sm">
                    {(colpoFields.length > 0 ? colpoFields : gynaeFields).map((f) => (
                      <div key={f.label}>
                        <dt className="text-muted-foreground">{f.label}</dt>
                        <dd className="font-medium text-foreground">{f.value}</dd>
                      </div>
                    ))}
                  </dl>
                  {referralCase.internalTriageNotes && (
                    <div className="mt-3 pt-3 border-t border-border text-sm">
                      <p className="text-muted-foreground mb-1">Internal triage notes</p>
                      <p className="text-foreground whitespace-pre-wrap">{referralCase.internalTriageNotes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Rule recommendation */}
            {rulePayload ? (
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide font-semibold flex items-center gap-1.5">
                      <GitBranch className="h-3.5 w-3.5" />
                      System Recommendation
                    </CardTitle>
                    {ruleDecision?.ruleSetRelease && (
                      <span className="text-xs text-muted-foreground">
                        {ruleDecision.ruleSetRelease.name} · v{ruleDecision.ruleSetRelease.version}
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-3">
                    <PriorityBadge priority={recommendation?.priority ?? undefined} />
                    <div className="text-sm">
                      <span className="font-semibold text-foreground">{recommendation?.category}</span>
                      {recommendation?.targetDays && (
                        <span className="ml-2 text-muted-foreground">
                          Target: {recommendation.targetDays} days
                        </span>
                      )}
                    </div>
                  </div>
                  {recommendation?.outcome && (
                    <p className="text-sm text-muted-foreground">{recommendation.outcome}</p>
                  )}
                  <div className="rounded-lg border border-border bg-muted/40 px-3 py-3 text-sm text-muted-foreground">
                    The system recommendation is a first pass based on the approved summary,
                    attached evidence, structured triage fields, and current guideline rules. A
                    clinician still confirms the final outcome.
                  </div>
                  {(rulePayload.rationale ?? []).length > 0 && (
                    <div className="rounded-lg bg-muted/40 border border-border p-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Rationale</p>
                      <ul className="space-y-1">
                        {(rulePayload.rationale ?? []).map((r) => (
                          <li key={r} className="text-sm text-muted-foreground flex gap-2">
                            <span className="text-muted-foreground shrink-0">•</span>
                            <span>{formatClinicalReferenceText(r)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <RecommendationSafetyPanel
                    safetyOutcome={rulePayload.safetyOutcome}
                    missingInformation={rulePayload.missingInformation}
                    externalDependencies={rulePayload.externalDependencies}
                    nextActions={rulePayload.nextActions}
                  />
                  {(rulePayload.trace ?? []).filter((t) => t.matched).length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {(rulePayload.trace ?? []).filter((t) => t.matched).map((r) => (
                        <Badge key={r.code} variant="info" className="text-xs font-mono">
                          {r.code}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-5 flex items-center gap-3 text-sm text-muted-foreground">
                  <GitBranch className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span>
                    No system recommendation yet.{" "}
                    {!summaryApproved
                      ? "Approve the clinical summary first, then evaluate rules."
                      : "Use the 'Evaluate Rules' button above to generate the first recommendation."}
                  </span>
                </CardContent>
              </Card>
            )}

            {/* Clinical summary sections */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide font-semibold flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5" />
                    Clinical Summary
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {summary?.status && (
                      <Badge variant={summaryApproved ? "info" : "default"}>
                        {summary.status}
                      </Badge>
                    )}
                    <SummaryGenerateButton caseId={id} />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {!summaryPayload ? (
                  <div className="py-4 text-center text-sm text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                    <p>No summary generated yet.</p>
                    <p className="text-muted-foreground text-xs mt-1">
                      Upload documents or fill in triage fields, then click &quot;Generate
                      Summary&quot; above.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {!summaryApproved && (
                      <div className="flex items-start gap-2 rounded-lg border border-warn/30 bg-warn/5 px-3 py-2.5 text-sm text-foreground">
                        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                        <span>
                          Summary not yet approved — rule grading is blocked.{" "}
                          <Link href={`/cases/${id}/summary`} className="underline font-medium">
                            Approve on the summary page →
                          </Link>
                        </span>
                      </div>
                    )}
                    {(summaryPayload.warnings ?? []).length > 0 && (
                      <div className="rounded-lg border border-warn/30 bg-warn/5 px-3 py-2.5 text-sm text-foreground">
                        <p className="font-semibold mb-1">Warnings</p>
                        <ul className="space-y-0.5">
                          {(summaryPayload.warnings ?? []).map((w) => (
                            <li key={w}>• {w}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {(summaryPayload.sections ?? []).map((section) => (
                      <div key={section.id}>
                        <h3 className="text-sm font-semibold text-foreground border-b border-border pb-1.5 mb-2">
                          {section.title}
                        </h3>
                        <ul className="space-y-1">
                          {(section.bullets ?? []).map((bullet) => (
                            <li key={bullet} className="text-sm text-muted-foreground flex gap-2">
                              <span className="text-muted-foreground shrink-0">•</span>
                              <span>{bullet}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                    {(summaryPayload.nextActions ?? []).length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-foreground border-b border-border pb-1.5 mb-2">
                          Next Actions
                        </h3>
                        <ul className="space-y-1">
                          {(summaryPayload.nextActions ?? []).map((a) => (
                            <li key={a} className="text-sm text-muted-foreground flex gap-2">
                              <ChevronRight className="h-4 w-4 text-success shrink-0" />
                              <span>{a}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {summary?.approvedBy && (
                      <p className="text-xs text-muted-foreground border-t border-border pt-3">
                        Approved by {summary.approvedBy.name ?? summary.approvedBy.email}
                        {summary.approvedAt && <> · {formatDateTime(summary.approvedAt)}</>}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* RIGHT PANEL — grading decisions */}
          <div className="xl:col-span-2 overflow-y-auto p-6 space-y-5 bg-muted/40">

            {/* SLA status */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide font-semibold flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  SLA Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                      sla.kind === "overdue" ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"
                    )}
                  >
                    {sla.kind === "overdue" ? (
                      <AlertTriangle className="h-4 w-4" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                  </div>
                  <div className="text-sm">
                    <p className="font-semibold text-foreground">{sla.label}</p>
                    <p className="text-muted-foreground">
                      Target: {referralCase.targetDueAt ? formatDate(referralCase.targetDueAt) : "Not set"}
                    </p>
                  </div>
                </div>
                {referralCase.bookedForAt && (
                  <div className="text-sm border-t border-border pt-3">
                    <p className="text-muted-foreground">Booked for</p>
                    <p className="font-semibold text-foreground">{formatDateTime(referralCase.bookedForAt)}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* AI Assist */}
            {isFeatureEnabled("casesV2") && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide font-semibold flex items-center gap-1.5">
                    <Stethoscope className="h-3.5 w-3.5" />
                    AI Grading Assist
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!summaryApproved ? (
                    <p className="text-sm text-muted-foreground">
                      Approve the clinical summary before running AI assist.
                    </p>
                  ) : (
                    <AiAssistButton caseId={id} />
                  )}
                </CardContent>
              </Card>
            )}

            {/* Clinician decision */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide font-semibold">
                    Clinician Decision
                  </CardTitle>
                  {hasClinicianDecision && (
                    <Badge variant="info" className="text-xs">
                      Decision saved
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <DecisionSaveForm
                  caseId={id}
                  recommendation={recommendation}
                  existingDecision={
                    clinicianDecision
                      ? {
                          finalPriority: clinicianDecision.finalPriority,
                          finalCategory: clinicianDecision.finalCategory,
                          finalOutcome: clinicianDecision.finalOutcome,
                          overrideReason: clinicianDecision.overrideReason,
                          notes: clinicianDecision.notes,
                        }
                      : undefined
                  }
                />
              </CardContent>
            </Card>

            {/* Quick links */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide font-semibold">
                  Case Links
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { href: `/cases/${id}`, label: "Case detail" },
                    { href: `/cases/${id}/summary`, label: "Full summary" },
                    { href: `/cases/${id}/grade`, label: "Grade panel" },
                    { href: `/cases/${id}/documents`, label: "Documents" },
                    { href: `/cases/${id}/evidence`, label: "Evidence" },
                    { href: `/cases/${id}/edit`, label: "Edit case" },
                    { href: `/cases/${id}/summary/print`, label: "Export PDF", target: "_blank" },
                  ].map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      target={link.target}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground hover:bg-muted/40 transition-colors justify-between"
                    >
                      <span>{link.label}</span>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>

          </div>
        </div>
      </div>
    </div>
  );
}
