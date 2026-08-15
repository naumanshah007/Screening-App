import { Skeleton, SkeletonTable } from "@/components/ui/skeleton";

export default function CompletedDecisionsLoading() {
  return (
    <div className="space-y-6 p-6" role="status" aria-label="Loading Completed Decisions" data-navigation-feedback>
      <span className="sr-only">Loading Completed Decisions…</span>
      <div className="space-y-2" aria-hidden="true">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-full max-w-2xl" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3" aria-hidden="true">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="rounded-xl border border-border bg-card" aria-hidden="true">
        <SkeletonTable rows={7} cols={8} />
      </div>
    </div>
  );
}
