import { cn } from "@/lib/utils";

interface CardProps { className?: string; children: React.ReactNode; onClick?: () => void; }

export function Card({ className, children, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-white border border-slate-200/80 rounded-xl shadow-sm",
        onClick && "cursor-pointer hover:shadow-md hover:border-slate-300 transition-all duration-150",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children }: CardProps) {
  return <div className={cn("px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3", className)}>{children}</div>;
}

export function CardTitle({ className, children }: CardProps) {
  return <h2 className={cn("text-sm font-semibold text-slate-800 tracking-tight", className)}>{children}</h2>;
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
  variant?: "default" | "urgent" | "warning" | "success";
  icon?: React.ReactNode;
  href?: string;
}

const statBorderVariant: Record<string, string> = {
  default: "border-l-brand-600",
  urgent:  "border-l-red-500",
  warning: "border-l-amber-500",
  success: "border-l-emerald-500",
};

export function StatCard({ label, value, subtext, delta, deltaDirection = "neutral", variant = "default", icon }: StatCardProps) {
  const deltaColor = { up: "text-emerald-600", down: "text-red-600", neutral: "text-slate-500" }[deltaDirection];
  const deltaIcon  = { up: "↑", down: "↓", neutral: "" }[deltaDirection];
  return (
    <Card className={cn("border-l-4", statBorderVariant[variant])}>
      <CardContent className="py-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</p>
            <p className="text-3xl font-bold text-slate-900 mt-1 tracking-tight">{value}</p>
            <div className="flex items-center gap-2 mt-1">
              {subtext && <p className="text-xs text-slate-400">{subtext}</p>}
              {delta && (
                <span className={cn("text-xs font-medium", deltaColor)}>
                  {deltaIcon} {delta}
                </span>
              )}
            </div>
          </div>
          {icon && (
            <div className="p-2.5 rounded-xl bg-slate-50 text-slate-400 flex-shrink-0">
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
