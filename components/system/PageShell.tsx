import { cn } from "@/lib/utils";

/**
 * The single page wrapper for every screen in the product.
 *
 * Replaces eight divergent wrappers that had accumulated across pages
 * (`space-y-6 p-6`, `page-aura p-6 lg:p-8 max-w-7xl mx-auto`,
 * `p-6 space-y-6 animate-fade-in`, `space-y-2`, …). Differing max-widths and
 * padding were the main reason screens felt like separate products.
 *
 * `width`:
 *   - "standard" (default) — most screens; comfortable reading measure
 *   - "wide"               — dense operational screens (worklists, dashboards)
 *   - "full"               — canvas screens that manage their own scrolling
 */
export function PageShell({
  children,
  width = "standard",
  className,
}: {
  children: React.ReactNode;
  width?: "standard" | "wide" | "full";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "animate-fade-in px-5 py-5 lg:px-7 lg:py-6",
        width === "standard" && "mx-auto w-full max-w-[1400px]",
        width === "wide" && "mx-auto w-full max-w-[1680px]",
        width === "full" && "w-full",
        className
      )}
    >
      <div className="space-y-5">{children}</div>
    </div>
  );
}

/**
 * A horizontal band within a page. Use between major groups of panels so
 * vertical rhythm stays uniform across screens.
 */
export function PageSection({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <section className={cn("space-y-3", className)}>{children}</section>;
}
