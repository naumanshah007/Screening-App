"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RiskBadge, PriorityBadge, StatusBadge } from "@/components/ui/badge";
import { useSession } from "next-auth/react";
import { cn, getFigureLabel } from "@/lib/utils";
import {
  AlertTriangle, ArrowLeft, Calendar, ClipboardList,
  BookOpen, ChevronRight, CheckCircle, FileText,
  GitBranch, Bell, Printer
} from "lucide-react";
import { FlowDiagram } from "@/components/clinical/FlowDiagram";
import { getFigureById } from "@/lib/decision-trees";

// ─── Types ────────────────────────────────────────────────────────────────────

type ClinicalDecision = {
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

type PatientInfo = {
  id: string;
  nhi: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  email?: string | null;
  name: string;
};

type SessionResult = {
  decision: ClinicalDecision;
  patient: PatientInfo;
  screeningSessionId: string;
  referral?: { id: string; priority: string; type: string } | null;
  recall?: { id: string; dueDate: string } | null;
  alreadyComplete?: boolean;
};

// ─── Risk configuration ───────────────────────────────────────────────────────

const riskConfig: Record<string, {
  bg: string; border: string; borderLeft: string;
  title: string; icon: React.ReactNode;
}> = {
  URGENT: {
    bg: "bg-red-50", border: "border-red-200", borderLeft: "border-l-red-500",
    title: "text-red-900",
    icon: <AlertTriangle className="h-6 w-6 text-red-600" />,
  },
  HIGH: {
    bg: "bg-amber-50", border: "border-amber-200", borderLeft: "border-l-amber-500",
    title: "text-amber-900",
    icon: <AlertTriangle className="h-6 w-6 text-amber-600" />,
  },
  MEDIUM: {
    bg: "bg-violet-50", border: "border-violet-200", borderLeft: "border-l-violet-500",
    title: "text-violet-900",
    icon: <ClipboardList className="h-6 w-6 text-violet-600" />,
  },
  LOW: {
    bg: "bg-emerald-50", border: "border-emerald-200", borderLeft: "border-l-emerald-500",
    title: "text-emerald-900",
    icon: <CheckCircle className="h-6 w-6 text-emerald-600" />,
  },
};

// ─── Notify Button ────────────────────────────────────────────────────────────

function NotifyButton({
  label, icon: Icon, onClick, disabled, sent,
}: {
  label: string;
  icon: React.ElementType;
  onClick: () => void;
  disabled: boolean;
  sent: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || sent}
      className={cn(
        "flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition-all",
        sent
          ? "border-emerald-200 bg-emerald-50 text-emerald-700 cursor-default"
          : "border-slate-200 bg-white text-slate-700 hover:border-brand-500 hover:text-brand-700 hover:shadow-sm",
        (disabled || sent) && "opacity-50 cursor-not-allowed"
      )}
    >
      {sent ? (
        <CheckCircle className="h-4 w-4 text-emerald-600" />
      ) : (
        <Icon className="h-4 w-4" />
      )}
      {sent ? `${label} notified` : `Notify ${label}`}
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function WizardResultPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);
  const router = useRouter();
  const { data: authSession } = useSession();

  const [result, setResult] = useState<SessionResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState("");
  const [notifying, setNotifying] = useState(false);
  const [sentChannels, setSentChannels] = useState<Set<string>>(new Set());
  const [guidelineOpen, setGuidelineOpen] = useState(false);

  useEffect(() => {
    const loadResult = async () => {
      try {
        const sessionRes = await fetch(`/api/pathway/sessions/${sessionId}`);
        const sessionData = await sessionRes.json();

        if (sessionData.session?.status === "COMPLETE" && sessionData.session?.decisionJson) {
          setResult({
            decision: sessionData.session.decisionJson,
            patient: {
              ...sessionData.patient,
              name: `${sessionData.patient.firstName} ${sessionData.patient.lastName}`,
            },
            screeningSessionId: sessionData.session.screeningSessionId ?? "",
            alreadyComplete: true,
          });
          setLoading(false);
          return;
        }

        setCompleting(true);
        const completeRes = await fetch(`/api/pathway/sessions/${sessionId}/complete`, {
          method: "POST",
        });
        const completeData = await completeRes.json();

        if (!completeRes.ok) throw new Error(completeData.error ?? "Failed to complete session");

        setResult({
          decision: completeData.decision,
          patient: completeData.patient,
          screeningSessionId: completeData.screeningSessionId,
          referral: completeData.referral,
          recall: completeData.recall,
        });
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load decision");
      } finally {
        setLoading(false);
        setCompleting(false);
      }
    };

    loadResult();
  }, [sessionId]);

  const handleNotify = async (channel: "patient" | "gp" | "coordinator") => {
    setNotifying(true);
    try {
      const res = await fetch(`/api/pathway/sessions/${sessionId}/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notifyPatient: channel === "patient",
          notifyGP: channel === "gp",
          notifyCoordinator: channel === "coordinator",
        }),
      });
      const data = await res.json();
      if (res.ok && data.sent?.length > 0) {
        setSentChannels((prev) => new Set([...prev, ...data.sent]));
      }
    } catch {
      // non-fatal
    } finally {
      setNotifying(false);
    }
  };

  if (loading || completing) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-gradient-to-br from-slate-50 to-brand-50/20">
        <div className="h-12 w-12 rounded-full border-4 border-slate-200 border-t-brand-600 animate-spin" />
        <p className="text-sm text-slate-500">
          {completing ? "Generating clinical decision…" : "Loading result…"}
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-4">
        <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center">
          <AlertTriangle className="h-7 w-7 text-red-500" />
        </div>
        <p className="text-slate-700 font-medium text-center">{error}</p>
        <Button variant="outline" onClick={() => router.push(`/pathway/${sessionId}`)}>
          <ArrowLeft className="h-4 w-4" />
          Back to Wizard
        </Button>
      </div>
    );
  }

  if (!result) return null;

  const { decision, patient } = result;
  const risk = (decision.riskLevel ?? "LOW") as keyof typeof riskConfig;
  const cfg = riskConfig[risk] ?? riskConfig.LOW;
  const figureLabel = getFigureLabel(decision.figure);

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
        }
      `}</style>

      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-brand-50/20 p-6 animate-fade-in">
        <div className="max-w-3xl mx-auto space-y-5">

          {/* Nav */}
          <div className="no-print flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => router.push(`/patients/${patient.id}`)}>
                <ArrowLeft className="h-4 w-4" />
                Patient record
              </Button>
              <span className="text-slate-300">/</span>
              <span className="text-sm text-slate-500">{patient.firstName} {patient.lastName}</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4" />
              Print
            </Button>
          </div>

          {/* Hero decision card */}
          <div className={cn(
            "rounded-2xl border-l-4 p-6 shadow-sm",
            cfg.bg, cfg.border, cfg.borderLeft
          )}>
            <div className="flex items-start gap-4">
              <div className="p-2.5 rounded-xl bg-white/60 flex-shrink-0 shadow-sm">
                {cfg.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <RiskBadge risk={risk} size="md" />
                  <span className="text-sm font-medium text-slate-600">{figureLabel}</span>
                </div>
                <h1 className={cn("text-xl font-bold leading-snug mb-3", cfg.title)}>
                  {decision.recommendation}
                </h1>
                {decision.recommendationCode && (
                  <span className="inline-block text-[11px] font-mono text-slate-400 bg-white/60 px-2 py-0.5 rounded-md">
                    {decision.recommendationCode}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Clinical warnings */}
          {decision.clinicalWarnings && decision.clinicalWarnings.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 space-y-2">
              <p className="text-xs font-semibold text-amber-800 uppercase tracking-wider flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5" />
                Clinical Warnings
              </p>
              <ul className="space-y-1.5">
                {decision.clinicalWarnings.map((w, i) => (
                  <li key={i} className="text-sm text-amber-800 flex items-start gap-2">
                    <span className="w-1 h-1 rounded-full bg-amber-500 mt-2 flex-shrink-0" />
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Next action */}
          {decision.nextAction && (
            <Card>
              <CardContent className="py-5">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-brand-50 flex-shrink-0">
                    <ChevronRight className="h-5 w-5 text-brand-600" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Next Action</p>
                    <p className="text-sm font-semibold text-slate-900">{decision.nextAction}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Referral */}
            {decision.referralRequired && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-brand-600" />
                    Referral Required
                  </CardTitle>
                  {result.referral && <StatusBadge status="PENDING" />}
                </CardHeader>
                <CardContent className="pt-3 pb-5">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Priority</span>
                      <PriorityBadge priority={decision.referralPriority} showDays />
                    </div>
                    {decision.referralType && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Type</span>
                        <span className="font-medium text-slate-900">{decision.referralType}</span>
                      </div>
                    )}
                    {decision.referralReason && (
                      <p className="text-xs text-slate-500 mt-2 pt-2 border-t border-slate-100 leading-relaxed">
                        {decision.referralReason}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Recall */}
            {decision.recallRequired && decision.recallIntervalMonths && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-brand-600" />
                    Recall Scheduled
                  </CardTitle>
                  {result.recall && <StatusBadge status="PENDING" />}
                </CardHeader>
                <CardContent className="pt-3 pb-5">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Interval</span>
                      <span className="font-semibold text-slate-900">
                        {decision.recallIntervalMonths >= 12
                          ? `${Math.round(decision.recallIntervalMonths / 12)} year${decision.recallIntervalMonths >= 24 ? "s" : ""}`
                          : `${decision.recallIntervalMonths} months`}
                      </span>
                    </div>
                    {result.recall && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Due date</span>
                        <span className="font-medium text-slate-900">
                          {new Date(result.recall.dueDate).toLocaleDateString("en-NZ", { day: "numeric", month: "long", year: "numeric" })}
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Decision Pathway diagram — always visible */}
          {(() => {
            const fig = getFigureById(decision.figure);
            if (!fig) return null;
            return (
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                {/* Header */}
                <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-100 bg-slate-50/60">
                  <div className="p-1.5 rounded-lg bg-brand-50">
                    <GitBranch className="h-4 w-4 text-brand-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 leading-tight">Decision Pathway</p>
                    <p className="text-xs text-slate-500 truncate">{fig.title} · {fig.subtitle}</p>
                  </div>
                  {decision.recommendationCode && (
                    <span className="text-[10px] font-mono text-slate-400 bg-white border border-slate-200 px-2 py-0.5 rounded-md flex-shrink-0">
                      {decision.recommendationCode}
                    </span>
                  )}
                </div>

                {/* Interactive diagram */}
                <FlowDiagram
                  figure={fig}
                  activeCode={decision.recommendationCode}
                  height={460}
                  className="rounded-none border-0"
                />
              </div>
            );
          })()}

          {/* Guideline reference */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <button
              onClick={() => setGuidelineOpen(o => !o)}
              className="w-full flex items-center gap-2 px-5 py-4 hover:bg-slate-50 transition-colors text-left"
              aria-expanded={guidelineOpen}
            >
              <BookOpen className="h-4 w-4 text-slate-400" />
              <span className="text-sm font-medium text-slate-700 flex-1">Guideline reference &amp; clinical rationale</span>
              <ChevronRight className={cn("h-4 w-4 text-slate-400 transition-transform duration-200", guidelineOpen && "rotate-90")} />
            </button>
            {guidelineOpen && (
              <div className="px-5 pb-5 space-y-4 border-t border-slate-100 pt-4 animate-slide-down">
                {decision.recommendationCode && (
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Recommendation Code</p>
                    <p className="font-mono text-sm text-slate-700">{decision.recommendationCode}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Pathway</p>
                  <p className="text-sm text-slate-700">{figureLabel}</p>
                </div>
                {decision.rationale && (
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Rationale</p>
                    <p className="text-sm text-slate-700 leading-relaxed">{decision.rationale}</p>
                  </div>
                )}
                {decision.guidelineReference && (
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Guideline</p>
                    <p className="text-sm text-slate-600">{decision.guidelineReference}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Notifications */}
          <Card className="no-print">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-brand-600" />
                Send Notifications
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-slate-500 mb-4">
                Notify relevant parties about this clinical decision.
                {!decision.referralRequired && " Coordinator notifications require a referral."}
              </p>
              <div className="flex flex-wrap gap-3">
                <NotifyButton
                  label="Patient"
                  icon={FileText}
                  onClick={() => handleNotify("patient")}
                  disabled={notifying || !patient.email}
                  sent={sentChannels.has("patient")}
                />
                <NotifyButton
                  label="GP"
                  icon={GitBranch}
                  onClick={() => handleNotify("gp")}
                  disabled={notifying}
                  sent={sentChannels.has("gp")}
                />
                <NotifyButton
                  label="Coordinator"
                  icon={ClipboardList}
                  onClick={() => handleNotify("coordinator")}
                  disabled={notifying || !decision.referralRequired}
                  sent={sentChannels.has("coordinator")}
                />
              </div>
              {!patient.email && (
                <p className="text-xs text-amber-600 mt-3 flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  No email address on file — patient notification unavailable.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex flex-wrap gap-3 pt-2 no-print">
            <Button variant="primary" size="lg" onClick={() => router.push(`/patients/${patient.id}`)}>
              <FileText className="h-4 w-4" />
              View full patient record
            </Button>
            <Button variant="outline" size="lg" onClick={() => router.push("/pathway")}>
              Start another pathway
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
