"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function useUnsavedChangesWarning(isDirty: boolean, message = "You have unsaved changes. Leave anyway?") {
  const router = useRouter();

  useEffect(() => {
    if (!isDirty) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = message;
      return message;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty, message]);
}
