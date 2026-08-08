import { cn } from "@/lib/utils";

/**
 * The single page header for the product.
 *
 * Supersedes `components/layout/PageIntro.tsx` (used on 28 of 34 pages) and the
 * dashboard's bespoke top bar, which had diverged. Keeps PageIntro's
 * eyebrow/title/description shape and adds slots those pages had been
 * improvising: primary actions, a filter row, and a meta strip.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  filters,
  meta,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  /** Primary/secondary buttons or links, right-aligned on wide screens. */
  actions?: React.ReactNode;
  /** Filter pills or range controls, rendered below the title block. */
  filters?: React.ReactNode;
  /** Small provenance/status strip, e.g. engine version or record counts. */
  meta?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 flex-1">
          {eyebrow && (
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-brand-600 dark:text-brand-400">
              {eyebrow}
            </p>
          )}
          <h1 className="mt-1 text-[1.875rem] font-semibold leading-tight tracking-tight text-foreground">
            {title}
          </h1>
          {description && (
            <p className="mt-1.5 max-w-3xl text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>

      {meta && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-border bg-card px-4 py-2.5 shadow-card">
          {meta}
        </div>
      )}

      {filters && <div className="flex flex-wrap items-center gap-2">{filters}</div>}
    </header>
  );
}

/** A labelled value for the PageHeader meta strip. */
export function HeaderMeta({
  label,
  value,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      {icon && (
        <span className="text-muted-foreground" aria-hidden>
          {icon}
        </span>
      )}
      <div className="leading-tight">
        <p className="text-[0.6875rem] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className="text-xs font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}
