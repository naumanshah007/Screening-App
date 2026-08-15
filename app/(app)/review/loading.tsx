import { Skeleton, SkeletonTable } from "@/components/ui/skeleton";

export default function ReviewQueueLoading() {
  return (
    <div className="space-y-6 p-6" role="status" aria-label="Loading Review Queue" data-navigation-feedback>
      <span className="sr-only">Loading Review Queue…</span>
      <div className="space-y-2" aria-hidden="true">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-full max-w-2xl" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-hidden="true">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="rounded-xl border border-border bg-card" aria-hidden="true">
        <SkeletonTable rows={8} cols={7} />
      </div>
    </div>
  );
}
