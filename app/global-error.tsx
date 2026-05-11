"use client";
import { useEffect } from "react";
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
    <html lang="en">
      <body style={{ margin: 0, background: "#f0f5f9", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "24px", fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
        <div style={{ maxWidth: 448, width: "100%", textAlign: "center" }}>
          <div style={{ margin: "0 auto 16px", width: 64, height: 64, borderRadius: 16, background: "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <AlertTriangle style={{ width: 32, height: 32, color: "#dc2626" }} strokeWidth={1.5} />
          </div>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600, color: "#0f172a", margin: "0 0 8px" }}>Something went wrong</h1>
          <p style={{ fontSize: "0.875rem", color: "#64748b", margin: "0 0 16px" }}>
            A critical error occurred. Please refresh the page or contact support if the problem persists.
          </p>
          {error.digest && (
            <details style={{ textAlign: "left", marginBottom: 16 }}>
              <summary style={{ fontSize: "0.75rem", color: "#94a3b8", cursor: "pointer" }}>Technical details</summary>
              <pre style={{ marginTop: 8, fontSize: "0.75rem", background: "#f1f5f9", padding: 12, borderRadius: 8, overflow: "auto", color: "#0f172a" }}>
                {error.digest}
              </pre>
            </details>
          )}
          <button
            onClick={reset}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#0d9488", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: "0.875rem", fontWeight: 500, cursor: "pointer" }}
          >
            <RefreshCw style={{ width: 16, height: 16 }} />
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
