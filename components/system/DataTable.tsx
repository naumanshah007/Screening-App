import { cn } from "@/lib/utils";

/**
 * The one table in the product. Replaces the duplicated `<table>` markup in the
 * batch worklist, completed decisions and audit trail, which had drifted apart
 * on header casing, row height, zebra striping and border colour.
 *
 * Server-rendered by design — sorting and filtering stay in the URL so results
 * always come from a real query.
 */
export type Column<T> = {
  /** Stable key, also used as the React key for cells. */
  key: string;
  header: React.ReactNode;
  /** Cell renderer. Receives the row and its index. */
  cell: (row: T, index: number) => React.ReactNode;
  align?: "left" | "right" | "center";
  /** Tailwind width class, e.g. "w-32". Omit to size to content. */
  width?: string;
  /** Hide below the `md` breakpoint to keep narrow viewports readable. */
  hideOnMobile?: boolean;
  /** Right-aligned numeric column: applies tabular figures. */
  numeric?: boolean;
};

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  empty,
  caption,
  dense = false,
  className,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  /** Rendered in place of the body when there are no rows. */
  empty?: React.ReactNode;
  /** Screen-reader description of the table's contents. */
  caption?: string;
  dense?: boolean;
  className?: string;
}) {
  if (rows.length === 0 && empty) {
    return <>{empty}</>;
  }

  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full border-collapse text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="border-b border-border">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(
                  "whitespace-nowrap px-3 py-2.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground",
                  column.align === "right" && "text-right",
                  column.align === "center" && "text-center",
                  column.align !== "right" && column.align !== "center" && "text-left",
                  column.width,
                  column.hideOnMobile && "hidden md:table-cell"
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={rowKey(row, index)}
              className="group border-b border-border/60 transition-colors last:border-0 hover:bg-muted/50"
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cn(
                    "px-3 align-middle text-foreground",
                    dense ? "py-2" : "py-3",
                    column.align === "right" && "text-right",
                    column.align === "center" && "text-center",
                    column.numeric && "tabular-nums",
                    column.hideOnMobile && "hidden md:table-cell"
                  )}
                >
                  {column.cell(row, index)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Row actions that stay hidden until the row is hovered or focused.
 *
 * Focus-within keeps them reachable by keyboard — hover alone would make them
 * unusable without a mouse.
 */
export function RowActions({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
      {children}
    </div>
  );
}

/** Primary + secondary text in a single table cell. */
export function CellStack({
  primary,
  secondary,
}: {
  primary: React.ReactNode;
  secondary?: React.ReactNode;
}) {
  return (
    <div className="min-w-0 leading-tight">
      <div className="truncate font-medium text-foreground">{primary}</div>
      {secondary && (
        <div className="mt-0.5 truncate text-xs text-muted-foreground">{secondary}</div>
      )}
    </div>
  );
}
