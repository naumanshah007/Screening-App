"use client";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function GlobalError({
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
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-danger-bg flex items-center justify-center">
          <AlertTriangle className="h-8 w-8 text-destructive" strokeWidth={1.5} />
        </div>
        <h1 className="text-xl font-semibold text-foreground">Something went wrong</h1>
        <p className="text-sm text-muted-foreground">
          An unexpected error occurred. Our team has been notified. Please try again.
        </p>
        {error.digest && (
          <details className="text-left">
            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">Technical details</summary>
            <pre className="mt-2 text-xs bg-muted p-3 rounded-lg overflow-auto text-foreground">
              {error.digest}
            </pre>
          </details>
        )}
        <Button onClick={reset} icon={<RefreshCw className="h-4 w-4" />}>Try again</Button>
      </div>
    </div>
  );
}
