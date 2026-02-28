"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

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

function cautionClass(tag?: string): string {
  if (!tag) return "bg-gray-100 text-gray-600";
  const lower = tag.toLowerCase();
  if (lower.includes("urgent")) return "bg-red-100 text-red-700";
  if (lower.includes("high")) return "bg-purple-100 text-purple-700";
  if (lower.includes("gynaecology")) return "bg-blue-100 text-blue-700";
  if (lower.includes("treatment")) return "bg-orange-100 text-orange-700";
  return "bg-amber-100 text-amber-700";
}

// ─── Option Card Component ────────────────────────────────────────────────────

function AnswerOptionCard({
  option,
  selected,
  autoFilled,
  onClick,
  animating,
}: {
  option: OptionCard;
  selected: boolean;
  autoFilled?: boolean;
  onClick: () => void;
  animating: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={animating}
      className={cn(
        "w-full text-left rounded-2xl border-2 px-5 py-4 transition-all duration-200 cursor-pointer",
        "focus:outline-none focus:ring-2 focus:ring-offset-2",
        selected
          ? "border-[#0D9488] bg-teal-50 focus:ring-[#0D9488] shadow-md"
          : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm focus:ring-gray-300",
        animating && selected ? "scale-98 opacity-80" : ""
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {/* Radio indicator */}
          <div
            className={cn(
              "mt-0.5 h-5 w-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center",
              selected ? "border-[#0D9488] bg-[#0D9488]" : "border-gray-300"
            )}
          >
            {selected && <div className="h-2 w-2 rounded-full bg-white" />}
          </div>

          <div className="flex-1 min-w-0">
            <p className={cn("font-semibold", selected ? "text-[#0D9488]" : "text-gray-800")}>
              {option.label}
            </p>
            {option.hint && (
              <p className="text-sm text-gray-500 mt-0.5">{option.hint}</p>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {option.cautionTag && (
            <span className={cn("rounded-full text-xs font-medium px-2 py-0.5", cautionClass(option.cautionTag))}>
              {option.cautionTag}
            </span>
          )}
          {autoFilled && (
            <span className="rounded-full text-xs font-medium px-2 py-0.5 bg-teal-50 text-teal-700 border border-teal-200">
              📋 Pre-filled
            </span>
          )}
          {selected && !autoFilled && (
            <span className="text-[#0D9488] text-lg">✓</span>
          )}
        </div>
      </div>
    </button>
  );
}

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

  // Load session
  const loadSession = useCallback(async () => {
    try {
      const res = await fetch(`/api/pathway/sessions/${sessionId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load session");
      setSessionData(data);
      setProgress(data.progress);

      if (data.isComplete) {
        // Auto-complete and redirect
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
  }, [sessionId]);

  const completeAndRedirect = async (sid: string) => {
    setCompleting(true);
    try {
      const res = await fetch(`/api/pathway/sessions/${sid}/complete`, { method: "POST" });
      if (res.ok) {
        router.push(`/pathway/${sid}/result`);
      }
    } catch {
      setCompleting(false);
    }
  };

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const handleSelect = useCallback(async (option: OptionCard) => {
    if (!currentStep || submitting || animating) return;
    setSelectedValue(option.value);

    // Short visual delay before advancing
    setAnimating(true);
    await new Promise((r) => setTimeout(r, 400));

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

      // Move to next step with fade transition
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
  }, [currentStep, submitting, animating, sessionId, router]);

  const handleBack = useCallback(async () => {
    if (!sessionData) return;
    // Find last answered step
    const allAnswered = sessionData.allSteps
      .filter((s) => s.isAnswered)
      .slice(-1)[0];
    if (!allAnswered || allAnswered.id === currentStep?.id) return;

    // Go back by finding the last answered step that's different from current
    const answeredSteps = sessionData.allSteps.filter((s) => s.isAnswered && s.id !== currentStep?.id);
    const prevStep = answeredSteps[answeredSteps.length - 1];
    if (!prevStep) return;

    // Find the step definition
    const stepDef = sessionData.allSteps.find((s) => s.id === prevStep.id);
    if (!stepDef) return;

    // Reload to get the correct step
    await loadSession();
  }, [sessionData, currentStep, loadSession]);

  if (loading || completing) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="h-12 w-12 rounded-full border-4 border-gray-200 border-t-[#0D9488] animate-spin" />
        <p className="text-sm text-gray-500">
          {completing ? "Generating clinical decision…" : "Loading wizard…"}
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-lg mx-auto py-12 px-4 text-center space-y-4">
        <div className="text-3xl text-red-400">⚠</div>
        <p className="text-gray-700 font-medium">{error}</p>
        <Button variant="outline" onClick={() => router.push("/pathway")}>
          ← Back to Pathway Wizard
        </Button>
      </div>
    );
  }

  if (!sessionData || !currentStep) return null;

  const patient = sessionData.patient;
  const answeredCount = sessionData.allSteps.filter((s) => s.isAnswered).length;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "linear-gradient(135deg, #f8fafc 0%, #f0f9f8 100%)" }}>
      {/* Top progress bar */}
      <div className="w-full h-1.5 bg-gray-200">
        <div
          className="h-full bg-[#0D9488] transition-all duration-500"
          style={{ width: `${progress.percent}%` }}
        />
      </div>

      {/* Patient context strip */}
      <div className="border-b border-gray-200 bg-white px-6 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-800">
                {patient.firstName} {patient.lastName}
              </p>
              <p className="text-xs text-gray-500 font-mono">{patient.nhi}</p>
            </div>
            <div className="flex gap-1.5">
              {patient.isFirstTimeHPVTransition && (
                <span className="rounded-full bg-purple-100 text-purple-700 text-xs font-medium px-2 py-0.5">
                  HPV Transition
                </span>
              )}
              {patient.isPostHysterectomy && (
                <span className="rounded-full bg-blue-100 text-blue-700 text-xs font-medium px-2 py-0.5">
                  Post-Hysterectomy
                </span>
              )}
            </div>
          </div>

          <div className="text-right">
            <p className="text-xs text-gray-500">Step {answeredCount + 1} of {progress.total}</p>
            <p className="text-xs font-semibold text-[#0D9488]">{progress.percent}% complete</p>
          </div>
        </div>
      </div>

      {/* Main question area */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-10">
        <div
          className={cn(
            "w-full max-w-2xl space-y-6 transition-all duration-300",
            animating ? "opacity-60 translate-y-1" : "opacity-100 translate-y-0"
          )}
        >
          {/* Auto-filled notice */}
          {isAutoFilledStep && (
            <div className="flex items-center gap-2 rounded-xl bg-teal-50 border border-teal-200 px-4 py-2.5">
              <span className="text-teal-600">📋</span>
              <p className="text-sm text-teal-800">
                This answer was <strong>pre-filled from existing records</strong>. You can change it if needed.
              </p>
            </div>
          )}

          {/* Question */}
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-gray-900 leading-snug">
              {currentStep.question}
            </h2>
            {currentStep.hint && (
              <p className="text-sm text-gray-500 leading-relaxed">{currentStep.hint}</p>
            )}
          </div>

          {/* Answer options */}
          {currentStep.options && currentStep.options.length > 0 && (
            <div className="grid gap-3">
              {currentStep.options.map((option) => (
                <AnswerOptionCard
                  key={option.value}
                  option={option}
                  selected={selectedValue === option.value}
                  autoFilled={isAutoFilledStep && selectedValue === option.value}
                  onClick={() => handleSelect(option)}
                  animating={animating}
                />
              ))}
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={handleBack}
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              ← Back
            </button>

            <div className="flex items-center gap-1.5">
              {sessionData.allSteps
                .map((s, i) => (
                  <div
                    key={s.id}
                    className={cn(
                      "rounded-full transition-all",
                      s.id === currentStep.id
                        ? "h-2.5 w-2.5 bg-[#0D9488]"
                        : s.isAnswered
                        ? "h-2 w-2 bg-teal-300"
                        : "h-2 w-2 bg-gray-200"
                    )}
                  />
                ))}
            </div>

            <div className="w-16" />
          </div>
        </div>
      </div>
    </div>
  );
}
