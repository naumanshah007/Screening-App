import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from "lucide-react";

type AlertVariant = "info" | "success" | "warning" | "error";

interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  children: React.ReactNode;
  className?: string;
  onDismiss?: () => void;
}

const config: Record<AlertVariant, { icon: React.ElementType; classes: string }> = {
  info:    { icon: Info,          classes: "bg-info-bg border-info-border text-info" },
  success: { icon: CheckCircle2,  classes: "bg-success-bg border-success-border text-success" },
  warning: { icon: TriangleAlert, classes: "bg-warn-bg border-warn-border text-warn" },
  error:   { icon: AlertCircle,   classes: "bg-danger-bg border-danger-border text-destructive" },
};

export function Alert({ variant = "info", title, children, className, onDismiss }: AlertProps) {
  const { icon: Icon, classes } = config[variant];
  return (
    <div role="alert" className={cn("flex gap-3 rounded-xl border px-4 py-3 text-sm", classes, className)}>
      <Icon className="h-5 w-5 flex-shrink-0 mt-0.5" aria-hidden />
      <div className="flex-1 min-w-0">
        {title && <p className="font-semibold mb-0.5">{title}</p>}
        <div className="leading-relaxed">{children}</div>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="flex-shrink-0 p-0.5 rounded hover:opacity-70 transition-opacity"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
