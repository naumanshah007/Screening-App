import { notFound } from "next/navigation";
import { isFeatureEnabled } from "@/lib/features";
import { getReferralCaseById } from "@/lib/cases/service";
import { getStoredClinicalSummary, parseClinicalSummaryPayload } from "@/lib/cases/summary";
import { getStoredRuleDecision, parseGradeRecommendationPayload } from "@/lib/cases/grading";
import { getStoredClinicianDecision } from "@/lib/cases/decision";
import { getCaseSlaSnapshot } from "@/lib/cases/sla";
import { formatDate, formatDateTime } from "@/lib/utils";
import { PrintButton } from "./PrintButton";

export default async function SummaryPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!isFeatureEnabled("casesV2")) {
    notFound();
  }

  const { id } = await params;
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
  const slaSnapshot = getCaseSlaSnapshot({
    targetDueAt: referralCase.targetDueAt,
    bookedForAt: referralCase.bookedForAt,
    status: referralCase.status,
  });

  const patient = referralCase.patient;
  const clinicianFinalPriority = clinicianDecision?.finalPriority;
  const displayPriority = clinicianFinalPriority ?? rulePayload?.recommendation.priority;
  const displayOutcome = clinicianDecision?.finalOutcome ?? rulePayload?.recommendation.outcome;
  const displayCategory = clinicianDecision?.finalCategory ?? rulePayload?.recommendation.category;
  const isOverridden =
    clinicianDecision &&
    rulePayload &&
    clinicianDecision.finalPriority !== rulePayload.recommendation.priority;
  const printedAt = new Date().toLocaleString("en-NZ", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="min-h-screen bg-card">
      {/* Print controls — hidden when printing */}
      <div className="print:hidden fixed top-0 left-0 right-0 z-10 bg-slate-900 text-white px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">Print preview</span>
          <span className="text-muted-foreground text-xs">
            {patient.firstName} {patient.lastName} · {patient.nhi}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <a
            href={`/cases/${id}/summary`}
            className="text-sm text-muted-foreground/50 hover:text-white transition-colors"
          >
            ← Back
          </a>
          <PrintButton />
        </div>
      </div>

      {/* Printable content */}
      <div className="print:pt-0 pt-16 max-w-3xl mx-auto px-8 py-8 print:px-6 print:py-4">

        {/* Header */}
        <div className="border-b-2 border-slate-900 pb-4 mb-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">
                Health NZ · Counties Manukau
              </div>
              <h1 className="text-2xl font-bold text-foreground">
                CerviGrade Referral Summary
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Referral Case · {referralCase.serviceLine === "COLPOSCOPY" ? "Colposcopy" : "Gynaecology"}
              </p>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <p>Printed: {printedAt}</p>
              <p className="mt-0.5 font-mono">Case ID: {referralCase.id.slice(0, 8).toUpperCase()}</p>
            </div>
          </div>
        </div>

        {/* Patient demographics */}
        <section className="mb-6">
          <h2 className="text-sm font-bold text-foreground uppercase tracking-wide mb-3">
            Patient Details
          </h2>
          <div className="grid grid-cols-3 gap-x-6 gap-y-2 text-sm">
            <div>
              <span className="text-muted-foreground">Name</span>
              <p className="font-semibold text-foreground">
                {patient.firstName} {patient.lastName}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">NHI</span>
              <p className="font-semibold font-mono text-foreground">{patient.nhi}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Date of birth</span>
              <p className="font-semibold text-foreground">
                {formatDate(patient.dateOfBirth)}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Received</span>
              <p className="font-semibold text-foreground">
                {formatDate(referralCase.receivedAt)}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Service line</span>
              <p className="font-semibold text-foreground">
                {referralCase.serviceLine === "COLPOSCOPY" ? "Colposcopy" : "Gynaecology"}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Referral source</span>
              <p className="font-semibold text-foreground">
                {referralCase.referralSource ?? "—"}
              </p>
            </div>
          </div>
        </section>

        {/* Grading decision */}
        <section className="mb-6 rounded-lg border-2 border-slate-900 p-4">
          <h2 className="text-sm font-bold text-foreground uppercase tracking-wide mb-3">
            Triage Decision
          </h2>
          <div className="grid grid-cols-3 gap-x-6 gap-y-2 text-sm">
            <div>
              <span className="text-muted-foreground">Priority</span>
              <p className="text-xl font-black text-foreground">
                {displayPriority?.replace("_", " ") ?? "Not graded"}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Category</span>
              <p className="font-semibold text-foreground">{displayCategory ?? "—"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">SLA target</span>
              <p className="font-semibold text-foreground">
                {formatDate(referralCase.targetDueAt)} ({slaSnapshot.label})
              </p>
            </div>
            <div className="col-span-3">
              <span className="text-muted-foreground">Outcome</span>
              <p className="font-semibold text-foreground">{displayOutcome ?? "—"}</p>
            </div>
            {clinicianDecision && (
              <div className="col-span-3">
                <span className="text-muted-foreground">Graded by</span>
                <p className="font-semibold text-foreground">
                  {clinicianDecision.decidedBy.name ?? clinicianDecision.decidedBy.email}
                  {" · "}{formatDateTime(clinicianDecision.updatedAt)}
                  {isOverridden && (
                    <span className="ml-2 text-warn">(Rule overridden)</span>
                  )}
                </p>
              </div>
            )}
            {clinicianDecision?.overrideReason && (
              <div className="col-span-3">
                <span className="text-muted-foreground">Override reason</span>
                <p className="font-semibold text-foreground">{clinicianDecision.overrideReason}</p>
              </div>
            )}
            {referralCase.bookedForAt && (
              <div className="col-span-3">
                <span className="text-muted-foreground">Booked for</span>
                <p className="font-semibold text-foreground">
                  {formatDateTime(referralCase.bookedForAt)}
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Clinical summary sections */}
        {summaryPayload ? (
          <section className="mb-6">
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wide mb-3">
              Clinical Summary
            </h2>
            {(summaryPayload.warnings ?? []).length > 0 && (
              <div className="mb-4 rounded border border-amber-300 bg-warn/5 px-3 py-2 text-sm text-foreground">
                <p className="font-semibold">Warnings</p>
                <ul className="mt-1 space-y-0.5">
                  {(summaryPayload.warnings ?? []).map((w) => (
                    <li key={w}>• {w}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="space-y-4">
              {(summaryPayload.sections ?? []).map((section) => (
                <div key={section.id}>
                  <h3 className="text-sm font-semibold text-foreground border-b border-border pb-1 mb-2">
                    {section.title}
                  </h3>
                  <ul className="space-y-1">
                    {(section.bullets ?? []).map((bullet) => (
                      <li key={bullet} className="text-sm text-muted-foreground flex gap-2">
                        <span className="flex-shrink-0 text-muted-foreground">•</span>
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="mt-4 text-xs text-muted-foreground">
              Summary generated by {summaryPayload.generatedBy}
              {summary?.approvedBy && (
                <> · Approved by {summary.approvedBy.name ?? summary.approvedBy.email}
                  {summary.approvedAt && <> at {formatDateTime(summary.approvedAt)}</>}
                </>
              )}
            </div>
          </section>
        ) : (
          <section className="mb-6">
            <p className="text-sm text-muted-foreground italic">
              No clinical summary has been generated for this case.
            </p>
          </section>
        )}

        {/* Rule rationale */}
        {rulePayload && (
          <section className="mb-6">
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wide mb-3">
              Deterministic Rule Rationale
            </h2>
            <ul className="space-y-1">
              {(rulePayload.rationale ?? []).map((line) => (
                <li key={line} className="text-sm text-muted-foreground flex gap-2">
                  <span className="flex-shrink-0 text-muted-foreground">•</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            {rulePayload.ruleRelease && (
              <p className="mt-2 text-xs text-muted-foreground">
                Rule release: {rulePayload.ruleRelease.name} v{rulePayload.ruleRelease.version}
              </p>
            )}
          </section>
        )}

        {/* Referral reason */}
        {referralCase.referralReason && (
          <section className="mb-6">
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wide mb-2">
              Referral Reason
            </h2>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {referralCase.referralReason}
            </p>
          </section>
        )}

        {/* Colposcopy triage fields */}
        {referralCase.serviceLine === "COLPOSCOPY" && (
          referralCase.fctStatus || referralCase.hpvTestResult || referralCase.cytologySample
        ) && (
          <section className="mb-6">
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wide mb-3">
              Colposcopy Triage Details
            </h2>
            <div className="grid grid-cols-3 gap-x-6 gap-y-2 text-sm">
              {referralCase.fctStatus && (
                <div>
                  <span className="text-muted-foreground">FCT status</span>
                  <p className="font-semibold text-foreground">{referralCase.fctStatus}</p>
                </div>
              )}
              {referralCase.hpvTestResult && (
                <div>
                  <span className="text-muted-foreground">HPV test result</span>
                  <p className="font-semibold text-foreground">{referralCase.hpvTestResult}</p>
                </div>
              )}
              {referralCase.hpvType && (
                <div>
                  <span className="text-muted-foreground">HPV type</span>
                  <p className="font-semibold text-foreground">{referralCase.hpvType}</p>
                </div>
              )}
              {referralCase.cytologySample && (
                <div>
                  <span className="text-muted-foreground">Cytology</span>
                  <p className="font-semibold text-foreground">{referralCase.cytologySample}</p>
                </div>
              )}
              {referralCase.assessmentOfReferral && (
                <div>
                  <span className="text-muted-foreground">Assessment</span>
                  <p className="font-semibold text-foreground">{referralCase.assessmentOfReferral}</p>
                </div>
              )}
              {referralCase.ovestinInstruction && (
                <div>
                  <span className="text-muted-foreground">Ovestin</span>
                  <p className="font-semibold text-foreground">{referralCase.ovestinInstruction}</p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Footer */}
        <div className="border-t border-border pt-4 mt-8 text-xs text-muted-foreground flex justify-between">
          <span>CerviGrade · Health NZ Counties Manukau · CONFIDENTIAL</span>
          <span>{patient.nhi} · {formatDate(new Date())}</span>
        </div>
      </div>
    </div>
  );
}
