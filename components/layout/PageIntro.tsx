import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/system";
import { cn } from "@/lib/utils";

type BreadcrumbItem = { label: string; href?: string };
type ActionItem = {
  href?: string;
  label: string;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "outline" | "ghost";
  icon?: React.ReactNode;
};

/**
 * Compatibility wrapper over the design system's `PageHeader`.
 *
 * PageIntro was the de-facto header on most screens before the system
 * existed. Rather than edit every call site, it now delegates to PageHeader so
 * those screens pick up the shared header automatically and there is exactly
 * one header implementation. Its own props are preserved.
 *
 * New screens should use `PageHeader` directly — it also offers meta and
 * filter slots, which this shape has no way to express.
 */
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
  const hasActions = Boolean(trailing) || actions.length > 0;

  return (
    <div className={cn("space-y-2", className)}>
      {breadcrumb && breadcrumb.length > 0 && (
        <nav aria-label="Breadcrumb" className="flex items-center gap-1">
          {breadcrumb.map((item, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && (
                <ChevronRight className="h-3 w-3 text-muted-foreground" aria-hidden />
              )}
              {item.href ? (
                <Link
                  href={item.href}
                  className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  {item.label}
                </Link>
              ) : (
                <span className="text-xs font-medium text-foreground">{item.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}

      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        actions={
          hasActions ? (
            <>
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
            </>
          ) : undefined
        }
      />
    </div>
  );
}
