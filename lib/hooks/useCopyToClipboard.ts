"use client";
import { useState, useCallback } from "react";
import { toast } from "sonner";

export function useCopyToClipboard(successMessage = "Copied to clipboard") {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(successMessage);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  }, [successMessage]);

  return { copy, copied };
}
