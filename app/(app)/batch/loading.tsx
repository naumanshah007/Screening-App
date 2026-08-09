import { Skeleton } from "@/components/ui/skeleton";
import { PageShell } from "@/components/system";

export default function BatchLoading() {
  return (
    <PageShell>
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>

      {/* Banner */}
      <Skeleton className="h-16 w-full rounded-xl" />

      {/* Table skeleton */}
      <div className="border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <Skeleton className="h-5 w-40" />
        </div>
        <div className="p-5 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    </PageShell>
  );
}
