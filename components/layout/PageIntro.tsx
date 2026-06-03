import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";

type BreadcrumbItem = { label: string; href?: string };
type ActionItem = { href?: string; label: string; onClick?: () => void; variant?: "primary" | "secondary" | "outline" | "ghost"; icon?: React.ReactNode };

export function PageIntro({
  eyebrow,
  title,
  description,
  actions = [],
  trailing,
  breadcrumb,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ActionItem[];
  trailing?: React.ReactNode;
  breadcrumb?: BreadcrumbItem[];
  className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      {breadcrumb && breadcrumb.length > 0 && (
        <nav aria-label="Breadcrumb" className="flex items-center gap-1 mb-2">
          {breadcrumb.map((item, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground" aria-hidden />}
              {item.href ? (
                <Link href={item.href} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                  {item.label}
                </Link>
              ) : (
                <span className="text-xs text-foreground font-medium">{item.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex items-start justify-between gap-4">
        <div>
          {eyebrow && (
            <div className="mb-1.5 flex items-center gap-2">
              <span className="eyebrow-rule" aria-hidden />
              <span className="text-label text-accent-color">{eyebrow}</span>
            </div>
          )}
          <h1 className="text-h2 text-foreground tracking-tight">{title}</h1>
          {description && (
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground leading-relaxed">{description}</p>
          )}
        </div>
        {(trailing || actions.length > 0) && (
          <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
            {trailing}
            {actions.map((action, index) =>
              action.href ? (
                <Link key={action.href} href={action.href}>
                  <Button
                    variant={action.variant ?? (index === 0 ? "primary" : "outline")}
                    size="sm"
                    icon={action.icon}
                  >
                    {action.label}
                  </Button>
                </Link>
              ) : (
                <Button
                  key={index}
                  variant={action.variant ?? (index === 0 ? "primary" : "outline")}
                  size="sm"
                  icon={action.icon}
                  onClick={action.onClick}
                >
                  {action.label}
                </Button>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
