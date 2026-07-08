"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";
import type { LucideIcon } from "lucide-react";

export type ManagerFilter = { id: string; label: string };

// Shared list scaffold for admin managers: a search box, filter chips (with live
// counts), a result count, and an empty state — so every admin list has the same
// header UX. Callers supply how to search/filter/render each item.
export function ManagerShell<T>({
  items,
  getKey,
  searchText,
  searchPlaceholder = "Search…",
  filters = [],
  matchesFilter,
  renderRow,
  intro,
  emptyIcon,
  emptyTitle,
  emptyDescription,
}: {
  items: T[];
  getKey: (item: T) => string;
  searchText: (item: T) => string;
  searchPlaceholder?: string;
  filters?: ManagerFilter[];
  matchesFilter?: (item: T, filterId: string) => boolean;
  renderRow: (item: T) => ReactNode;
  intro?: ReactNode;
  emptyIcon: LucideIcon;
  emptyTitle: string;
  emptyDescription: string;
}) {
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      const textOk = !q || searchText(item).toLowerCase().includes(q);
      const filterOk =
        activeFilter === "all" || !matchesFilter || matchesFilter(item, activeFilter);
      return textOk && filterOk;
    });
  }, [items, query, activeFilter, searchText, matchesFilter]);

  const chips: (ManagerFilter & { count: number })[] = [
    { id: "all", label: "All", count: items.length },
    ...filters.map((f) => ({
      ...f,
      count: matchesFilter ? items.filter((i) => matchesFilter(i, f.id)).length : 0,
    })),
  ];

  return (
    <div className="space-y-4">
      {intro}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            aria-label={searchPlaceholder}
          />
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">
          {filtered.length} of {items.length}
        </span>
      </div>

      {filters.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => setActiveFilter(chip.id)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                activeFilter === chip.id
                  ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-border-strong"
              )}
            >
              {chip.label}
              <span className="ml-1 tabular-nums opacity-70">{chip.count}</span>
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} />
      ) : (
        <div className="space-y-2">{filtered.map((item) => (
          <div key={getKey(item)}>{renderRow(item)}</div>
        ))}</div>
      )}
    </div>
  );
}
