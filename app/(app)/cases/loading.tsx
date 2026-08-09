import { Skeleton, SkeletonTable } from "@/components/ui/skeleton";
import { PageShell } from "@/components/system";

export default function CasesLoading() {
  return (
    <PageShell width="wide">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-5 space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-border bg-card">
        <div className="px-5 py-4 border-b border-border">
          <Skeleton className="h-5 w-20" />
        </div>
        <SkeletonTable rows={8} cols={7} />
      </div>
    </PageShell>
  );
}
