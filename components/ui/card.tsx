import { cn } from "@/lib/utils";

interface CardProps { className?: string; children: React.ReactNode; onClick?: () => void; }

export function Card({ className, children, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-card border border-border rounded-xl card-elevated",
        onClick && "cursor-pointer hover-lift hover:border-border-strong",
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

const statTopBar: Record<string, string> = {
  default: "from-teal-400 to-cyan-500",
  urgent:  "from-rose-400 to-red-500",
  warning: "from-amber-300 to-amber-500",
  success: "from-emerald-300 to-emerald-500",
  info:    "from-sky-400 to-cyan-500",
};

const statIconChip: Record<string, string> = {
  default: "chip-gradient-brand",
  urgent:  "chip-gradient-urgent",
  warning: "chip-gradient-warning",
  success: "chip-gradient-success",
  info:    "chip-gradient-info",
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
    <Card
      className={cn("group relative overflow-hidden hover-lift", onClick && "cursor-pointer")}
      onClick={onClick}
    >
      {/* Variant-colored gradient hairline along the top edge */}
      <span
        className={cn("pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r", statTopBar[variant])}
        aria-hidden
      />
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
            <div
              className={cn(
                "grid h-11 w-11 flex-shrink-0 place-items-center rounded-xl text-white shadow-sm transition-transform duration-300 group-hover:scale-105",
                statIconChip[variant]
              )}
            >
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
