import Link from "next/link";
import { getFigureLabel, cn } from "@/lib/utils";

// Renders a guideline figure label as a link to the Clinical Guidance Library,
// pre-selecting that figure's pathway diagram (/guidelines?figure=FIGURE_X).
// Only FIGURE_1..FIGURE_10 have interactive diagrams; other values (e.g. TABLE_1)
// render as plain text.
export function FigureLink({
  figure,
  className,
  showIcon = false,
}: {
  figure?: string;
  className?: string;
  showIcon?: boolean;
}) {
  if (!figure) return null;
  const label = getFigureLabel(figure);
  const linkable = /^FIGURE_\d+$/.test(figure);

  if (!linkable) {
    return <span className={className}>{label}</span>;
  }

  return (
    <Link
      href={`/guidelines?figure=${figure}`}
      className={cn(
        "text-brand-600 hover:underline underline-offset-2 decoration-brand-600/40",
        className
      )}
      title="View this pathway diagram in the Clinical Guidance Library"
    >
      {label}
      {showIcon && <span aria-hidden className="ml-0.5 text-[0.85em]">↗</span>}
    </Link>
  );
}
