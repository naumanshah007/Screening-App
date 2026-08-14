"use client";

import { SlideOver } from "@/components/ui/slide-over";
import { cn } from "@/lib/utils";

/**
 * The standard drill-in surface: click a row, inspect it without losing the
 * list. Wraps `ui/slide-over.tsx` so the worklist, completed decisions and
 * audit trail all open the same panel with the same header, width and footer.
 */
export function DetailDrawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = "xl",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: "md" | "lg" | "xl" | "2xl";
}) {
  return (
    <SlideOver open={open} onClose={onClose} title={title} subtitle={subtitle} footer={footer} width={width}>
      <div className="space-y-5">{children}</div>
    </SlideOver>
  );
}

/** A titled group inside a drawer. */
export function DrawerSection({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

/**
 * A section that is collapsed by default.
 *
 * Technical evidence — raw identifiers, checksums, canonical snapshots, the full
 * ruleset bibliography — must stay reachable for audit, but a clinician should
 * not scroll past hundreds of lines of it to reach the reviewer controls. Uses
 * native <details> so it is keyboard accessible and expandable without state.
 */
export function DrawerDisclosure({
  title,
  caption,
  children,
  defaultOpen = false,
  className,
}: {
  title: string;
  caption?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  return (
    <details
      open={defaultOpen}
      className={cn(
        "group rounded-lg border border-border bg-card/40 px-3 py-2",
        className
      )}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className="min-w-0">
          <span className="block text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">
            {title}
          </span>
          {caption && (
            <span className="block text-[0.6875rem] text-muted-foreground/80">
              {caption}
            </span>
          )}
        </span>
        <span
          aria-hidden
          className="text-xs text-muted-foreground transition-transform group-open:rotate-90"
        >
          ›
        </span>
      </summary>
      <div className="mt-2.5 space-y-2">{children}</div>
    </details>
  );
}

/**
 * A key/value list. Uses <dl> so the label–value relationship is exposed to
 * assistive technology rather than being purely visual.
 */
export function DrawerFields({
  fields,
  columns = 2,
  className,
}: {
  fields: { label: string; value: React.ReactNode }[];
  columns?: 1 | 2;
  className?: string;
}) {
  return (
    <dl
      className={cn(
        "grid gap-x-4 gap-y-3 rounded-lg border border-border/70 bg-surface-raised p-3",
        columns === 2 ? "grid-cols-2" : "grid-cols-1",
        className
      )}
    >
      {fields.map((field) => (
        <div key={field.label} className="min-w-0">
          <dt className="text-[0.6875rem] font-medium uppercase tracking-wider text-muted-foreground">
            {field.label}
          </dt>
          <dd className="mt-0.5 break-words text-sm text-foreground">{field.value}</dd>
        </div>
      ))}
    </dl>
  );
}
