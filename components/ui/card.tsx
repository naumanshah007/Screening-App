import { cn } from "@/lib/utils";

interface CardProps {
  className?: string;
  children: React.ReactNode;
}

export function Card({ className, children }: CardProps) {
  return (
    <div className={cn("bg-white border border-gray-200 rounded-xl shadow-sm", className)}>
      {children}
    </div>
  );
}

export function CardHeader({ className, children }: CardProps) {
  return (
    <div className={cn("px-6 py-4 border-b border-gray-100", className)}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children }: CardProps) {
  return (
    <h2 className={cn("text-base font-semibold text-[#1E3A5F]", className)}>
      {children}
    </h2>
  );
}

export function CardContent({ className, children }: CardProps) {
  return (
    <div className={cn("px-6 py-4", className)}>
      {children}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  variant?: "default" | "urgent" | "warning";
  icon?: React.ReactNode;
}

export function StatCard({ label, value, subtext, variant = "default", icon }: StatCardProps) {
  const border = {
    default: "border-l-[#0D9488]",
    urgent: "border-l-red-500",
    warning: "border-l-amber-500",
  }[variant];

  return (
    <Card className={cn("border-l-4", border)}>
      <CardContent className="py-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">{label}</p>
            <p className="text-2xl font-bold text-[#1E3A5F] mt-1">{value}</p>
            {subtext && <p className="text-xs text-gray-400 mt-1">{subtext}</p>}
          </div>
          {icon && <div className="text-gray-300">{icon}</div>}
        </div>
      </CardContent>
    </Card>
  );
}
