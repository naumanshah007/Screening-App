"use client";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "@/lib/hooks/useTheme";
import { Toaster } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider defaultTheme="light">
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            classNames: {
              toast: "!rounded-xl !border !border-border !bg-card !text-foreground !shadow-overlay !text-sm",
              success: "!text-success",
              error: "!text-destructive",
              warning: "!text-warn",
              info: "!text-info",
              title: "!font-semibold",
              description: "!text-muted-foreground",
            },
          }}
          richColors
          closeButton
        />
      </ThemeProvider>
    </SessionProvider>
  );
}
