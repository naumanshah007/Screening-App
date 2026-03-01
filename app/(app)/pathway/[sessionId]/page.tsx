"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, ChevronDown, AlertTriangle, CheckCircle } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type OptionCard = {
  value: string;
  label: string;
  hint?: string;
  cautionTag?: string;
};

type WizardStep = {
  id: string;
  question: string;
  hint?: string;
  type: string;
  options?: OptionCard[];
};

type WizardAnswer = {
  stepId: string;
  questionText: string;
  answerValue: string;
  answerLabel: string;
  isAutoFilled: boolean;
  stepNumber: number;
};

type StepSummary = {
  id: string;
  question: string;
  isAnswered: boolean;
  isAutoFilled: boolean;
};

type Progress = {
  current: number;
  total: number;
  percent: number;
};

type PatientInfo = {
  id: string;
  nhi: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  isFirstTimeHPVTransition: boolean;
  isPostHysterectomy: boolean;
  gpPractice?: { name: string } | null;
};

type SessionData = {
  session: { id: string; status: string; determinedFigure?: string };
  patient: PatientInfo;
  answers: WizardAnswer[];
  answersMap: Record<string, string>;
  nextStep: WizardStep | null;
  progress: Progress;
  allSteps: StepSummary[];
  isComplete: boolean;
};

// ─── Caution tag colours ──────────────────────────────────────────────────────

function cautionColorFromTag(tag?: string): "red" | "amber" {
  if (!tag) return "amber";
  const lower = tag.toLowerCase();
  if (lower.includes("urgent") || lower.includes("high") || lower.includes("invasive")) return "red";
  return "amber";
}

// Clinical warning messages for high-risk selections
const clinicalWarnings: Record<string, string> = {
  HPV_16_18:  "HPV 16/18 always requires colposcopy referral, regardless of cytology result.",
  HSIL:       "High-grade cytology — colposcopy referral required.",
  ASC_H:      "Cannot exclude HSIL — colposcopy pathway applies.",
  AG2:        "Atypical endometrial cells — direct gynaecology referral required (not colposcopy).",
  AC2:        "AC2 glandular abnormality — direct gynaecology referral required per Figure 7.",
  INVASION:   "Invasive disease suspected — urgent MDM and oncology referral required.",
  CIN3:       "CIN3 requires urgent treatment.",
};

const highRiskValues = new Set([
  "HPV_16_18", "HSIL", "ASC_H", "SCC", "AG2", "AG3", "AG4", "AG5",
  "AC2", "AC3", "AC4", "INVASION", "CIN3", "AIS", "ADENOCARCINOMA",
]);

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function WizardPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const router = useRouter();

  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentStep, setCurrentStep] = useState<WizardStep | null>(null);
  const [selectedValue, setSelectedValue] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [progress, setProgress] = useState<Progress>({ current: 0, total: 0, percent: 0 });
  const [isAutoFilledStep, setIsAutoFilledStep] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [bannerExpanded, setBannerExpanded] = useState(false);

  const completeAndRedirect = useCallback(async (sid: string) => {
    setCompleting(true);
    try {
      const res = await fetch(`/api/pathway/sessions/${sid}/complete`, { method: "POST" });
      if (res.ok) router.push(`/pathway/${sid}/result`);
    } catch {
      setCompleting(false);
    }
  }, [router]);

  const loadSession = useCallback(async () => {
    try {
      const res = await fetch(`/api/pathway/sessions/${sessionId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load session");
      setSessionData(data);
      setProgress(data.progress);

      if (data.isComplete) {
        await completeAndRedirect(sessionId);
        return;
      }

      const step = data.nextStep;
      setCurrentStep(step);

      if (step) {
        const existingAnswer = data.answersMap[step.id];
        if (existingAnswer) {
          setSelectedValue(existingAnswer);
          const stepInfo = data.allSteps.find((s: StepSummary) => s.id === step.id);
          setIsAutoFilledStep(stepInfo?.isAutoFilled ?? false);
        } else {
          setSelectedValue(null);
          setIsAutoFilledStep(false);
        }
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load session");
    } finally {
      setLoading(false);
    }
  }, [sessionId, completeAndRedirect]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const handleSelect = useCallback(async (option: OptionCard) => {
    if (!currentStep || submitting || animating) return;
    setSelectedValue(option.value);
    setAnimating(true);
    await new Promise((r) => setTimeout(r, 350));

    setSubmitting(true);
    try {
      const res = await fetch(`/api/pathway/sessions/${sessionId}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stepId: currentStep.id,
          answerValue: option.value,
          answerLabel: option.label,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save answer");

      setProgress(data.progress);

      if (data.isComplete) {
        await completeAndRedirect(sessionId);
        return;
      }

      setAnimating(false);
      setCurrentStep(data.nextStep);
      setSelectedValue(null);
      setIsAutoFilledStep(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save answer");
      setAnimating(false);
    } finally {
      setSubmitting(false);
    }
  }, [currentStep, submitting, animating, sessionId, completeAndRedirect]);

  const handleBack = useCallback(async () => {
    if (!sessionData) return;
    const answeredSteps = sessionData.allSteps.filter(
      (s) => s.isAnswered && s.id !== currentStep?.id
    );
    if (!answeredSteps.length) {
      router.back();
      return;
    }
    await loadSession();
  }, [sessionData, currentStep, loadSession, router]);

  if (loading || completing) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-gradient-to-br from-slate-50 to-brand-50/20">
        <div className="h-12 w-12 rounded-full border-4 border-slate-200 border-t-brand-600 animate-spin" />
        <p className="text-sm text-slate-500">
          {completing ? "Generating clinical decision…" : "Loading wizard…"}
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
        <Button variant="outline" onClick={() => router.push("/pathway")}>
          <ArrowLeft className="h-4 w-4" />
          Back to Pathway Wizard
        </Button>
      </div>
    );
  }

  if (!sessionData || !currentStep) return null;

  const patient = sessionData.patient;
  const answeredCount = sessionData.allSteps.filter((s) => s.isAnswered).length;
  const showClinicalWarning = selectedValue && highRiskValues.has(selectedValue);
  const warningText = selectedValue ? clinicalWarnings[selectedValue] : null;

  // Determine option grid layout
  const optCount = currentStep.options?.length ?? 0;
  const gridClass = optCount <= 2
    ? "grid-cols-1 sm:grid-cols-2"
    : optCount === 3
    ? "grid-cols-1 sm:grid-cols-3"
    : "grid-cols-1 sm:grid-cols-2";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-brand-50/30 flex flex-col">
      {/* Patient banner */}
      <div className="border-b border-slate-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <button
          onClick={() => setBannerExpanded(e => !e)}
          className="w-full px-6 py-3 flex items-center gap-3 hover:bg-slate-50/80 transition-colors text-left"
          aria-expanded={bannerExpanded}
        >
          <div className="w-7 h-7 rounded-full bg-brand-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-[10px] font-bold">
              {patient.firstName?.[0] ?? ""}{patient.lastName?.[0] ?? ""}
            </span>
          </div>
          <div className="flex-1 min-w-0 flex items-center gap-3">
            <span className="text-sm font-semibold text-slate-900">
              {patient.firstName} {patient.lastName}
            </span>
            <span className="text-xs text-slate-400 font-mono">{patient.nhi}</span>
            {patient.isFirstTimeHPVTransition && (
              <span className="text-[10px] font-medium bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full border border-violet-200">
                HPV Transition
              </span>
            )}
            {patient.isPostHysterectomy && (
              <span className="text-[10px] font-medium bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full border border-sky-200">
                Post-Hysterectomy
              </span>
            )}
          </div>
          <div className="text-right flex-shrink-0 mr-2">
            <p className="text-xs text-slate-500">Step {answeredCount + 1} of {progress.total}</p>
          </div>
          <ChevronDown className={cn("h-4 w-4 text-slate-400 transition-transform duration-200", bannerExpanded && "rotate-180")} />
        </button>
        {bannerExpanded && (
          <div className="px-6 pb-3 flex gap-6 text-xs text-slate-500 animate-slide-down">
            <span>DOB: {patient.dateOfBirth ? new Date(patient.dateOfBirth).toLocaleDateString("en-NZ") : "—"}</span>
            <span>NHI: <span className="font-mono">{patient.nhi}</span></span>
            {patient.gpPractice && <span>Practice: {patient.gpPractice.name}</span>}
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-slate-100">
        <div
          className="h-1 bg-brand-500 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
          style={{ width: `${progress.percent}%` }}
          role="progressbar"
          aria-valuenow={progress.percent}
          aria-label={`Step ${answeredCount + 1} of ${progress.total}`}
        />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div
          className={cn(
            "w-full max-w-2xl transition-all duration-300",
            animating ? "opacity-50 translate-y-1" : "opacity-100 translate-y-0"
          )}
          key={currentStep.id}
        >
          {/* Step counter */}
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-6">
            Step {answeredCount + 1} of {progress.total}
          </p>

          {/* Auto-filled notice */}
          {isAutoFilledStep && (
            <div className="mb-5 flex gap-3 p-3.5 rounded-xl border border-brand-200 bg-brand-50 animate-slide-down">
              <CheckCircle className="h-4 w-4 text-brand-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-brand-800">
                This answer was <strong>pre-filled from existing records</strong>. You can change it if needed.
              </p>
            </div>
          )}

          {/* Question */}
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-tight mb-2">
            {currentStep.question}
          </h1>
          {currentStep.hint ? (
            <p className="text-base text-slate-500 mb-8 leading-relaxed">{currentStep.hint}</p>
          ) : (
            <div className="mb-8" />
          )}

          {/* Clinical warning */}
          {showClinicalWarning && (
            <div className="mb-6 flex gap-3 p-4 rounded-xl border border-amber-200 bg-amber-50 animate-slide-down">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800 font-medium">
                {warningText ?? "This result requires clinical attention — please review the pathway recommendation carefully."}
              </p>
            </div>
          )}

          {/* Option cards */}
          {currentStep.options && currentStep.options.length > 0 && (
            <div className={cn("grid gap-3", gridClass)}>
              {currentStep.options.map((opt) => {
                const isSelected = selectedValue === opt.value;
                const cautionColor = cautionColorFromTag(opt.cautionTag);
                return (
                  <button
                    key={opt.value}
                    onClick={() => handleSelect(opt)}
                    disabled={animating}
                    className={cn(
                      "relative text-left rounded-xl border-2 p-4 transition-all duration-150",
                      "hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600",
                      "disabled:cursor-not-allowed",
                      isSelected
                        ? "border-brand-600 bg-brand-50/60 shadow-sm"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                    )}
                    aria-pressed={isSelected}
                  >
                    {/* Radio indicator */}
                    <div className={cn(
                      "absolute top-3 left-3 w-4 h-4 rounded-full border-2 transition-all duration-150 flex items-center justify-center",
                      isSelected ? "border-brand-600 bg-brand-600" : "border-slate-300"
                    )}>
                      {isSelected && (
                        <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10" fill="none">
                          <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    {/* Caution tag — inline with label, not absolute */}
                    <div className="pl-7">
                      <div className="flex items-start justify-between gap-3 mb-1">
                        <p className={cn("text-sm font-semibold leading-snug", isSelected ? "text-brand-900" : "text-slate-900")}>
                          {opt.label}
                        </p>
                        {opt.cautionTag && (
                          <span className={cn(
                            "shrink-0 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mt-0.5",
                            cautionColor === "red" ? "bg-red-100 text-red-700 ring-1 ring-red-200" : "bg-amber-100 text-amber-700 ring-1 ring-amber-200"
                          )}>
                            {opt.cautionTag}
                          </span>
                        )}
                      </div>
                      {opt.hint && (
                        <p className={cn("text-xs leading-relaxed", isSelected ? "text-brand-700" : "text-slate-500")}>
                          {opt.hint}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Step dots */}
          <div className="flex items-center justify-center gap-1.5 mt-10">
            {sessionData.allSteps.map((s) => (
              <div
                key={s.id}
                className={cn(
                  "rounded-full transition-all",
                  s.id === currentStep.id
                    ? "h-2.5 w-2.5 bg-brand-600"
                    : s.isAnswered
                    ? "h-2 w-2 bg-brand-300"
                    : "h-2 w-2 bg-slate-200"
                )}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Footer navigation */}
      <div className="border-t border-slate-200 bg-white/90 backdrop-blur-sm px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
          <Button variant="ghost" onClick={handleBack} size="md">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          {selectedValue && !animating && (
            <p className="text-xs text-slate-400 hidden sm:block">Select an option to continue automatically</p>
          )}
          {animating && (
            <div className="flex items-center gap-2 text-xs text-brand-600">
              <div className="h-3.5 w-3.5 rounded-full border-2 border-brand-200 border-t-brand-600 animate-spin" />
              Saving…
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
