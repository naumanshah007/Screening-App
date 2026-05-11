import { cn } from "@/lib/utils";

interface CardProps { className?: string; children: React.ReactNode; onClick?: () => void; }

export function Card({ className, children, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-card border border-border rounded-xl shadow-sm",
        onClick && "cursor-pointer hover:shadow-md hover:border-border-strong transition-all duration-150",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children }: CardProps) {
  return (
    <div className={cn("px-5 py-4 border-b border-border flex items-center justify-between gap-3", className)}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children }: CardProps) {
  return <h2 className={cn("text-sm font-semibold text-foreground tracking-tight", className)}>{children}</h2>;
}

export function CardContent({ className, children }: CardProps) {
  return <div className={cn("px-5 py-4", className)}>{children}</div>;
}

interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  delta?: string;
  deltaDirection?: "up" | "down" | "neutral";
  variant?: "default" | "urgent" | "warning" | "success" | "info";
  icon?: React.ReactNode;
  href?: string;
  onClick?: () => void;
}

const statBorderVariant: Record<string, string> = {
  default: "border-l-accent-color",
  urgent:  "border-l-red-500",
  warning: "border-l-amber-500",
  success: "border-l-emerald-500",
  info:    "border-l-sky-500",
};

const statIconBg: Record<string, string> = {
  default: "bg-brand-50 text-brand-600",
  urgent:  "bg-destructive/5 text-destructive",
  warning: "bg-warn/5 text-warn",
  success: "bg-success/5 text-success",
  info:    "bg-info/5 text-sky-600",
};

export function StatCard({
  label, value, subtext, delta, deltaDirection = "neutral",
  variant = "default", icon, onClick,
}: StatCardProps) {
  const deltaColor = {
    up:      "text-success",
    down:    "text-destructive",
    neutral: "text-muted-foreground",
  }[deltaDirection];
  const deltaIcon = { up: "↑", down: "↓", neutral: "" }[deltaDirection];

  return (
    <Card className={cn("border-l-4", statBorderVariant[variant])} onClick={onClick}>
      <CardContent className="py-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-label text-muted-foreground">{label}</p>
            <p className="text-3xl font-bold text-foreground mt-1.5 tracking-tight tabular-nums">{value}</p>
            <div className="flex items-center gap-2 mt-1">
              {subtext && <p className="text-xs text-muted-foreground">{subtext}</p>}
              {delta && (
                <span className={cn("text-xs font-medium", deltaColor)}>
                  {deltaIcon} {delta}
                </span>
              )}
            </div>
          </div>
          {icon && (
            <div className={cn("p-2.5 rounded-xl flex-shrink-0", statIconBg[variant])}>
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
