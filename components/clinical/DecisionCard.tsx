/**
 * DecisionCard — Fancy printable clinical decision card
 * Displayed at the end of the Pathway Wizard.
 */
"use client";

import { cn } from "@/lib/utils";
import { format, addDays } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DecisionCardProps = {
  decision: {
    figure: string;
    riskLevel: string;
    recommendation: string;
    recommendationCode: string;
    nextAction?: string;
    referralRequired?: boolean;
    referralType?: string;
    referralPriority?: string;
    referralReason?: string;
    recallRequired?: boolean;
    recallIntervalMonths?: number;
    clinicalWarnings?: string[];
    guidelineReference?: string;
    rationale?: string;
  };
  patient: {
    name: string;
    nhi: string;
    dateOfBirth: string;
    email?: string | null;
  };
  preparedBy: string;
  preparedByRole?: string;
  practiceName: string;
  referenceId: string;
  assessmentDate?: Date;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PRIORITY_DAYS: Record<string, number> = {
  P1: 20, P2: 42, P3: 84, P4: 168,
};

const FIGURE_LABELS: Record<string, string> = {
  FIGURE_1:  "Figure 1 — HPV Transition (First HPV Screen, No Prior Abnormality)",
  FIGURE_2:  "Figure 2 — HPV Transition (Previously Abnormal Cytology)",
  FIGURE_3:  "Figure 3 — Primary HPV Screening",
  FIGURE_4:  "Figure 4 — Colposcopy (Low-grade Findings)",
  FIGURE_5:  "Figure 5 — Colposcopy (High-grade Lesion Management: CIN2/3, AIS)",
  FIGURE_6:  "Figure 6 — Test of Cure (Post-treatment Follow-up)",
  FIGURE_7:  "Figure 7 — Management of Glandular Abnormalities (AG1–AG5 / AC1–AC4)",
  FIGURE_8:  "Figure 8 — Post-hysterectomy Vault Screening",
  FIGURE_9:  "Figure 9 — Pregnant Participant with High-grade Cytology (ASC-H / HSIL / AG / AIS)",
  FIGURE_10: "Figure 10 — Investigation of Abnormal Vaginal Bleeding",
  TABLE_1:   "Table 1 — Routine Case Management",
};

function riskConfig(level: string) {
  switch (level) {
    case "URGENT": return { label: "URGENT", bg: "bg-red-50",    border: "border-red-300",    text: "text-red-800",    icon: "⚠", badge: "bg-red-600 text-white" };
    case "HIGH":   return { label: "HIGH",   bg: "bg-purple-50", border: "border-purple-300", text: "text-purple-800", icon: "■", badge: "bg-purple-600 text-white" };
    case "MEDIUM": return { label: "MEDIUM", bg: "bg-amber-50",  border: "border-amber-300",  text: "text-amber-800",  icon: "▲", badge: "bg-amber-500 text-white" };
    default:       return { label: "LOW",    bg: "bg-green-50",  border: "border-green-300",  text: "text-green-800",  icon: "●", badge: "bg-green-600 text-white" };
  }
}

function priorityConfig(p?: string) {
  switch (p) {
    case "P1": return { label: "P1 — Urgent",   color: "bg-red-600 text-white",    days: 20 };
    case "P2": return { label: "P2 — Priority",  color: "bg-purple-600 text-white", days: 42 };
    case "P3": return { label: "P3 — Routine",   color: "bg-amber-500 text-white",  days: 84 };
    case "P4": return { label: "P4 — Deferred",  color: "bg-gray-500 text-white",   days: 168 };
    default:   return { label: "Routine",         color: "bg-gray-500 text-white",   days: 84 };
  }
}

// ─── DecisionCard Component ───────────────────────────────────────────────────

export function DecisionCard({
  decision,
  patient,
  preparedBy,
  preparedByRole,
  practiceName,
  referenceId,
  assessmentDate,
}: DecisionCardProps) {
  const date = assessmentDate ?? new Date();
  const risk = riskConfig(decision.riskLevel);
  const prio = priorityConfig(decision.referralPriority);
  const targetDays = decision.referralPriority ? PRIORITY_DAYS[decision.referralPriority] : 84;
  const targetDate = format(addDays(date, targetDays), "dd MMMM yyyy");

  return (
    <div
      id="decision-card"
      className={cn(
        "rounded-3xl border-2 overflow-hidden shadow-xl print:shadow-none print:rounded-none",
        risk.border
      )}
      style={{ background: "white", maxWidth: 720, width: "100%" }}
    >
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{ background: "#1E3A5F" }} className="px-8 py-5 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-white text-xl">🏥</span>
            <span className="text-white font-bold text-lg">{practiceName}</span>
          </div>
          <p className="text-blue-200 text-sm">Cervical Screening Clinical Decision</p>
        </div>
        <div className="text-right">
          <p className="text-white text-sm font-medium">
            {format(date, "dd MMMM yyyy")}
          </p>
          <p className="text-blue-300 text-xs mt-0.5">
            {format(date, "HH:mm")}
          </p>
        </div>
      </div>

      {/* ── Patient Section ──────────────────────────────────────────────────── */}
      <div className="px-8 py-5 border-b border-gray-200 bg-gray-50">
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
          <div>
            <span className="text-gray-500 text-xs uppercase tracking-wide">Patient</span>
            <p className="font-bold text-gray-900 text-base mt-0.5">{patient.name}</p>
          </div>
          <div>
            <span className="text-gray-500 text-xs uppercase tracking-wide">NHI</span>
            <p className="font-mono font-bold text-gray-900 text-base mt-0.5">{patient.nhi}</p>
          </div>
          <div>
            <span className="text-gray-500 text-xs uppercase tracking-wide">Date of Birth</span>
            <p className="font-semibold text-gray-800 mt-0.5">
              {new Date(patient.dateOfBirth).toLocaleDateString("en-NZ", {
                day: "2-digit", month: "long", year: "numeric",
              })}
            </p>
          </div>
          <div>
            <span className="text-gray-500 text-xs uppercase tracking-wide">Prepared by</span>
            <p className="font-semibold text-gray-800 mt-0.5">
              {preparedBy}{preparedByRole ? ` · ${preparedByRole}` : ""}
            </p>
          </div>
        </div>
      </div>

      {/* ── Main Content ─────────────────────────────────────────────────────── */}
      <div className="px-8 py-6 space-y-5">

        {/* Pathway Label */}
        <div>
          <span className="text-xs text-gray-500 uppercase tracking-wide">Pathway</span>
          <p className="text-base font-semibold text-gray-800 mt-0.5">
            {FIGURE_LABELS[decision.figure] ?? decision.figure}
          </p>
        </div>

        {/* Risk Level — prominent section */}
        <div className={cn("rounded-2xl border-2 px-6 py-4", risk.bg, risk.border)}>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs uppercase tracking-widest font-bold text-gray-500">Risk Level</span>
              <div className={cn("flex items-center gap-2 mt-1", risk.text)}>
                <span className="text-2xl">{risk.icon}</span>
                <span className="text-3xl font-extrabold tracking-wide">{risk.label}</span>
              </div>
            </div>
            <div className={cn("rounded-2xl px-4 py-2 text-center", risk.badge)}>
              <p className="text-xs font-bold uppercase tracking-widest">Clinical Priority</p>
              <p className="text-2xl font-black">{decision.referralPriority ?? "—"}</p>
            </div>
          </div>
        </div>

        {/* Recommendation */}
        <div className="space-y-1.5">
          <span className="text-xs text-gray-500 uppercase tracking-wide">Recommendation</span>
          <p className="text-lg font-bold text-gray-900 leading-snug">{decision.recommendation}</p>
          <div className="flex items-center gap-2">
            <code className="rounded-lg bg-gray-100 text-gray-700 text-sm font-mono px-3 py-1 border border-gray-200">
              {decision.recommendationCode}
            </code>
          </div>
          {decision.nextAction && (
            <div className="rounded-xl bg-teal-50 border border-teal-200 px-4 py-3 mt-2">
              <span className="text-xs font-bold text-teal-700 uppercase tracking-wide">Next Action</span>
              <p className="text-sm text-teal-900 font-medium mt-0.5">{decision.nextAction}</p>
            </div>
          )}
        </div>

        {/* Referral Card */}
        {decision.referralRequired && (
          <div className="rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
              <span className="text-gray-600">📋</span>
              <span className="text-sm font-bold text-gray-700 uppercase tracking-wide">Referral Required</span>
            </div>
            <div className="px-5 py-4 grid grid-cols-2 gap-4">
              <div>
                <span className="text-xs text-gray-500">Type</span>
                <p className="font-semibold text-gray-800 mt-0.5">{decision.referralType ?? "Colposcopy"}</p>
              </div>
              <div>
                <span className="text-xs text-gray-500">Priority</span>
                <div className="mt-0.5">
                  <span className={cn("rounded-full text-xs font-bold px-3 py-1", prio.color)}>
                    {prio.label}
                  </span>
                </div>
              </div>
              <div>
                <span className="text-xs text-gray-500">Target Timeframe</span>
                <p className="font-semibold text-gray-800 mt-0.5">Within {targetDays} working days</p>
              </div>
              <div>
                <span className="text-xs text-gray-500">Target Date</span>
                <p className="font-semibold text-gray-800 mt-0.5">{targetDate}</p>
              </div>
              {decision.referralReason && (
                <div className="col-span-2">
                  <span className="text-xs text-gray-500">Reason</span>
                  <p className="text-sm text-gray-700 mt-0.5">{decision.referralReason}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Recall Card */}
        {decision.recallRequired && decision.recallIntervalMonths && (
          <div className="rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
              <span className="text-gray-600">🗓</span>
              <span className="text-sm font-bold text-gray-700 uppercase tracking-wide">Recall Required</span>
            </div>
            <div className="px-5 py-4">
              <span className="text-xs text-gray-500">Next screening due</span>
              <p className="font-semibold text-gray-800 text-lg mt-0.5">
                In {decision.recallIntervalMonths} month{decision.recallIntervalMonths !== 1 ? "s" : ""}
              </p>
              <p className="text-sm text-gray-500 mt-0.5">
                Approximately {format(
                  new Date(date.getFullYear(), date.getMonth() + decision.recallIntervalMonths, date.getDate()),
                  "MMMM yyyy"
                )}
              </p>
            </div>
          </div>
        )}

        {/* Clinical Warnings */}
        {decision.clinicalWarnings && decision.clinicalWarnings.length > 0 && (
          <div className="rounded-2xl bg-amber-50 border border-amber-200 px-5 py-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-amber-600 text-lg">⚠</span>
              <span className="text-sm font-bold text-amber-800 uppercase tracking-wide">Clinical Warnings</span>
            </div>
            <ul className="space-y-1.5">
              {decision.clinicalWarnings.map((w, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-amber-800">
                  <span className="text-amber-500 mt-0.5 flex-shrink-0">•</span>
                  {w}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Rationale */}
        {decision.rationale && (
          <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-3">
            <span className="text-xs font-bold text-blue-700 uppercase tracking-wide">Rationale</span>
            <p className="text-sm text-blue-900 mt-0.5">{decision.rationale}</p>
          </div>
        )}

        {/* Guideline */}
        {decision.guidelineReference && (
          <p className="text-xs text-gray-400 italic">{decision.guidelineReference}</p>
        )}
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <div className="px-8 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
        <div className="text-xs text-gray-400">
          <p>Generated by the NZ Cervical Screening Clinical Decision Support System</p>
          <p>This decision is generated based on current guidelines and must be reviewed by a qualified clinician.</p>
        </div>
        <div className="text-right flex-shrink-0 ml-4">
          <p className="text-xs text-gray-500 font-mono">Ref: {referenceId.slice(0, 12)}…</p>
          <p className="text-xs text-gray-400">{format(date, "dd/MM/yyyy HH:mm")}</p>
        </div>
      </div>
    </div>
  );
}
