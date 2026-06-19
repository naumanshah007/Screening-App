import Link from "next/link";
import { ArrowRight, CheckCircle2, Circle, Clock3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { SummaryStatus } from "@prisma/client";

type WorkflowGuideProps = {
  caseId: string;
  documentCount: number;
  parsedDocumentCount: number;
  extractedFactCount: number;
  hasSummary: boolean;
  summaryStatus?: SummaryStatus | null;
  hasRuleDecision: boolean;
  hasClinicianDecision: boolean;
  isBooked: boolean;
};

type WorkflowStep = {
  id: string;
  label: string;
  description: string;
  screenLabel: string;
  href: string;
  status: "complete" | "active" | "pending";
};

function stepStatusClass(status: WorkflowStep["status"]) {
  switch (status) {
    case "complete":
      return "border-success/30 bg-success/5";
    case "active":
      return "border-info/30 bg-info/5";
    default:
      return "border-border bg-card";
  }
}

function StepIcon({ status }: { status: WorkflowStep["status"] }) {
  if (status === "complete") {
    return <CheckCircle2 className="h-4 w-4 text-success" />;
  }

  if (status === "active") {
    return <Clock3 className="h-4 w-4 text-sky-600" />;
  }

  return <Circle className="h-4 w-4 text-slate-300" />;
}

function buildSteps(args: WorkflowGuideProps): WorkflowStep[] {
  const hasDocuments = args.documentCount > 0;
  const hasEvidence = args.parsedDocumentCount > 0 || args.extractedFactCount > 0;
  const summaryApproved = args.summaryStatus === "APPROVED";

  const completionFlags = [
    hasDocuments,
    hasEvidence,
    summaryApproved,
    args.hasRuleDecision,
    args.hasClinicianDecision || args.isBooked,
  ];
  const firstIncompleteIndex = completionFlags.findIndex((flag) => !flag);

  return [
    {
      id: "documents",
      label: "1. Add referral pack",
      description:
        "Upload the referral, clinic letters, lab results, and radiology so the case has the full source record.",
      screenLabel: "Documents",
      href: `/cases/${args.caseId}/documents`,
      status: hasDocuments ? "complete" : firstIncompleteIndex === 0 ? "active" : "pending",
    },
    {
      id: "evidence",
      label: "2. Extract evidence",
      description:
        "The system reads the uploaded files and pulls out the key clinical facts needed for grading.",
      screenLabel: "Evidence",
      href: `/cases/${args.caseId}/evidence`,
      status: hasEvidence ? "complete" : firstIncompleteIndex === 1 ? "active" : "pending",
    },
    {
      id: "summary",
      label: "3. Review one-page summary",
      description:
        "Generate a single-screen summary so the grader can review the case without opening multiple documents.",
      screenLabel: "Summary",
      href: `/cases/${args.caseId}/summary`,
      status: summaryApproved
        ? "complete"
        : firstIncompleteIndex === 2 || (args.hasSummary && !summaryApproved)
          ? "active"
          : "pending",
    },
    {
      id: "recommendation",
      label: "4. Get provisional recommendation",
      description:
        "Decision support compares the case evidence against the published grading rules and proposes a provisional outcome.",
      screenLabel: "Triage Workspace",
      href: `/cases/${args.caseId}/triage`,
      status: args.hasRuleDecision
        ? "complete"
        : firstIncompleteIndex === 3
          ? "active"
          : "pending",
    },
    {
      id: "decision",
      label: "5. Confirm final outcome",
      description:
        "A clinician confirms or overrides the recommendation, then the coordinator books the patient if the case is bookable.",
      screenLabel: args.isBooked ? "Booking" : "Grade",
      href: `/cases/${args.caseId}/grade`,
      status: args.hasClinicianDecision || args.isBooked
        ? "complete"
        : firstIncompleteIndex === 4
          ? "active"
          : "pending",
    },
  ];
}

export function WorkflowGuide(props: WorkflowGuideProps) {
  const steps = buildSteps(props);
  const activeStep =
    steps.find((step) => step.status === "active") ??
    steps[steps.length - 1];

  return (
    <Card>
      <CardHeader>
        <CardTitle>How This Case Moves Through The System</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          This product follows the same pattern every time: gather the source files,
          extract evidence, build a one-page summary, generate a provisional recommendation,
          then let a clinician confirm the final outcome.
        </div>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-5">
          {steps.map((step) => (
            <div
              key={step.id}
              className={cn(
                "rounded-xl border px-4 py-4 transition-colors",
                stepStatusClass(step.status)
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <StepIcon status={step.status} />
                    <p className="text-sm font-semibold text-foreground">
                      {step.label}
                    </p>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              </div>
              <Link
                href={step.href}
                className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                Open {step.screenLabel}
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-info/30 bg-info/5 px-4 py-3">
          <div className="text-sm">
            <div className="font-semibold text-sky-900">What should happen next</div>
            <div className="mt-1 text-foreground">
              {activeStep.label.replace(/^\d+\.\s*/, "")}: {activeStep.description}
            </div>
          </div>
          <Link
            href={activeStep.href}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-sky-600 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-sky-700"
          >
            Continue to {activeStep.screenLabel}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
