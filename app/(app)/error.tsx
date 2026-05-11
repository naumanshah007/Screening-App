"use client";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-6">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-danger-bg flex items-center justify-center">
          <AlertTriangle className="h-7 w-7 text-destructive" strokeWidth={1.5} />
        </div>
        <h2 className="text-lg font-semibold text-foreground">Page failed to load</h2>
        <p className="text-sm text-muted-foreground">
          Something went wrong rendering this page. Please try again or go back.
        </p>
        {error.digest && (
          <details className="text-left">
            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
              Error reference: {error.digest}
            </summary>
          </details>
        )}
        <div className="flex items-center justify-center gap-3">
          <Link href="/dashboard">
            <Button variant="outline" size="sm" icon={<ArrowLeft className="h-4 w-4" />}>
              Dashboard
            </Button>
          </Link>
          <Button size="sm" onClick={reset} icon={<RefreshCw className="h-4 w-4" />}>
            Try again
          </Button>
        </div>
      </div>
    </div>
  );
}
