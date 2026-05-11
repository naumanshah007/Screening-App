import Link from "next/link";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import { Button } from "./button";

interface EmptyStateProps {
  icon?: LucideIcon;
  eyebrow?: string;
  title: string;
  description?: string;
  nextStep?: string;
  action?: { label: string; onClick?: () => void; href?: string; variant?: "primary" | "outline" };
  secondaryAction?: { label: string; onClick?: () => void; href?: string };
  className?: string;
  size?: "sm" | "md" | "lg";
}

const sizeConfig = {
  sm: { wrapper: "py-10 px-4", icon: "w-10 h-10", iconSize: "h-5 w-5", title: "text-sm" },
  md: { wrapper: "py-16 px-6", icon: "w-14 h-14", iconSize: "h-7 w-7", title: "text-sm" },
  lg: { wrapper: "py-24 px-8", icon: "w-16 h-16", iconSize: "h-8 w-8", title: "text-base" },
};

export function EmptyState({
  icon: Icon,
  eyebrow,
  title,
  description,
  nextStep,
  action,
  secondaryAction,
  className,
  size = "md",
}: EmptyStateProps) {
  const s = sizeConfig[size];
  return (
    <div className={cn("flex flex-col items-center justify-center text-center", s.wrapper, className)}>
      {Icon && (
        <div className={cn("rounded-2xl bg-muted flex items-center justify-center mb-4 flex-shrink-0", s.icon)}>
          <Icon className={cn(s.iconSize, "text-muted-foreground")} strokeWidth={1.5} />
        </div>
      )}
      {eyebrow && (
        <div className="mb-1 text-label text-muted-foreground">{eyebrow}</div>
      )}
      <h3 className={cn("font-semibold text-foreground mb-1", s.title)}>{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">{description}</p>
      )}
      {nextStep && (
        <div className="mt-4 rounded-lg border border-border bg-muted px-4 py-3 text-xs text-muted-foreground max-w-sm text-left">
          <span className="font-semibold text-foreground">Next step:</span>{" "}{nextStep}
        </div>
      )}
      {(action || secondaryAction) && (
        <div className="mt-5 flex items-center gap-2 flex-wrap justify-center">
          {action?.href ? (
            <Link href={action.href}>
              <Button variant={action.variant ?? "outline"} size="sm">{action.label}</Button>
            </Link>
          ) : action ? (
            <Button variant={action.variant ?? "outline"} size="sm" onClick={action.onClick}>
              {action.label}
            </Button>
          ) : null}
          {secondaryAction?.href ? (
            <Link href={secondaryAction.href}>
              <Button variant="ghost" size="sm">{secondaryAction.label}</Button>
            </Link>
          ) : secondaryAction ? (
            <Button variant="ghost" size="sm" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
