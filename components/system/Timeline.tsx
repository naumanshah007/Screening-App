import { cn } from "@/lib/utils";

export type TimelineTone = "neutral" | "brand" | "success" | "warn" | "danger";

const MARKER_TONE: Record<TimelineTone, string> = {
  neutral: "border-border bg-card text-muted-foreground",
  brand: "border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-700 dark:bg-brand-900/40 dark:text-brand-300",
  success:
    "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  warn: "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  danger: "border-destructive/40 bg-destructive/10 text-destructive",
};

export type TimelineEvent = {
  id: string;
  title: React.ReactNode;
  /** Pre-formatted timestamp. Format at the call site so server and client agree. */
  timestamp?: string;
  actor?: string;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: TimelineTone;
  /** Expanded detail, e.g. a before/after diff or checksum block. */
  detail?: React.ReactNode;
};

/**
 * Vertical event timeline, shared by the audit trail and the batch run stepper.
 *
 * Renders only events that were actually recorded. Do not pad the list with
 * inferred or expected-but-missing steps — a gap in the audit trail is
 * information, and filling it would misrepresent the record.
 */
export function Timeline({
  events,
  className,
}: {
  events: TimelineEvent[];
  className?: string;
}) {
  return (
    <ol className={cn("relative space-y-0", className)}>
      {events.map((event, index) => {
        const isLast = index === events.length - 1;
        return (
          <li key={event.id} className="relative flex gap-3 pb-5 last:pb-0">
            {/* Connector */}
            {!isLast && (
              <span
                className="absolute left-[13px] top-7 bottom-0 w-px bg-border"
                aria-hidden
              />
            )}

            <span
              className={cn(
                "relative z-10 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border",
                MARKER_TONE[event.tone ?? "neutral"]
              )}
              aria-hidden
            >
              {event.icon ?? <span className="h-1.5 w-1.5 rounded-full bg-current" />}
            </span>

            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <p className="text-sm font-medium leading-tight text-foreground">{event.title}</p>
                {event.timestamp && (
                  <time className="text-xs tabular-nums text-muted-foreground">
                    {event.timestamp}
                  </time>
                )}
              </div>
              {event.actor && (
                <p className="mt-0.5 text-xs text-muted-foreground">{event.actor}</p>
              )}
              {event.description && (
                <div className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {event.description}
                </div>
              )}
              {event.detail && <div className="mt-2">{event.detail}</div>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export type StepState = "complete" | "current" | "upcoming" | "failed";

/**
 * Horizontal progress stepper for a batch run.
 *
 * Each step's state comes from stored run status. A step is "current" only when
 * the run genuinely sits there; never advance the stepper optimistically.
 */
export function StepTimeline({
  steps,
  className,
}: {
  steps: { id: string; label: string; state: StepState; caption?: string }[];
  className?: string;
}) {
  return (
    <ol className={cn("flex flex-wrap items-start gap-x-2 gap-y-4", className)}>
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        return (
          <li key={step.id} className="flex flex-1 items-start gap-2 min-w-[140px]">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full border text-[0.6875rem] font-semibold",
                  step.state === "complete" &&
                    "border-brand-600 bg-brand-600 text-white",
                  step.state === "current" &&
                    "border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300",
                  step.state === "upcoming" && "border-border bg-card text-muted-foreground",
                  step.state === "failed" && "border-destructive bg-destructive text-white"
                )}
                aria-hidden
              >
                {step.state === "complete" ? "✓" : step.state === "failed" ? "!" : index + 1}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "text-xs font-medium leading-tight",
                  step.state === "upcoming" ? "text-muted-foreground" : "text-foreground"
                )}
              >
                {step.label}
                <span className="sr-only"> — {step.state}</span>
              </p>
              {step.caption && (
                <p className="mt-0.5 text-[0.6875rem] leading-tight text-muted-foreground">
                  {step.caption}
                </p>
              )}
              {!isLast && <span className="sr-only">then</span>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
