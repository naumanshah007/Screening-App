import { cn } from "@/lib/utils";

/**
 * The standard content surface. Every card, chart container and table wrapper
 * in the product should be a Panel, so radius, border, padding and elevation
 * are identical everywhere.
 *
 * Replaces the page-local `Panel` that was defined inside the dashboard and the
 * ad-hoc `Card` + custom shadow combinations used elsewhere.
 */
export function Panel({
  title,
  description,
  action,
  children,
  padded = true,
  className,
  as: Tag = "section",
}: {
  title?: string;
  description?: string;
  /** Right-aligned control in the header — a link, filter or menu. */
  action?: React.ReactNode;
  children: React.ReactNode;
  /** Set false when the child manages its own padding (e.g. a full-bleed table). */
  padded?: boolean;
  className?: string;
  as?: "section" | "div" | "article";
}) {
  const hasHeader = Boolean(title || action);

  return (
    <Tag
      className={cn(
        "rounded-xl border border-border bg-card shadow-card",
        padded && "p-4",
        className
      )}
    >
      {hasHeader && (
        <div className={cn("mb-3 flex items-start justify-between gap-3", !padded && "p-4 pb-0")}>
          <div className="min-w-0">
            {title && (
              <h2 className="text-[0.9375rem] font-semibold leading-tight text-foreground">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{description}</p>
            )}
          </div>
          {action && <div className="flex-shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </Tag>
  );
}

/**
 * A quiet inset region inside a Panel — used for secondary detail, key/value
 * blocks and nested summaries.
 */
export function PanelInset({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-border/70 bg-surface-raised p-3", className)}>
      {children}
    </div>
  );
}
