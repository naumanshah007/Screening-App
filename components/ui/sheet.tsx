"use client";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { useEffect, useRef } from "react";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  side?: "right" | "left" | "bottom";
  size?: "sm" | "md" | "lg" | "xl";
  footer?: React.ReactNode;
}

const sideClasses = {
  right:  "right-0 top-0 h-full animate-slide-right",
  left:   "left-0 top-0 h-full",
  bottom: "bottom-0 left-0 w-full animate-slide-up",
};

const sizeClasses = {
  sm:  "w-full sm:max-w-sm",
  md:  "w-full sm:max-w-md",
  lg:  "w-full sm:max-w-lg",
  xl:  "w-full sm:max-w-2xl",
};

export function Sheet({ open, onClose, title, description, children, side = "right", size = "md", footer }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
      prev?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby={title ? "sheet-title" : undefined}>
      <div
        className="absolute inset-0 bg-foreground/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        className={cn(
          "absolute bg-card border-border shadow-overlay flex flex-col",
          side === "right" || side === "left" ? "border-l" : "border-t",
          sideClasses[side],
          side !== "bottom" ? sizeClasses[size] : "max-h-[85dvh] rounded-t-2xl",
          "focus:outline-none"
        )}
      >
        {(!!title || !!onClose) && (
          <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-border flex-shrink-0">
            <div>
              {title && <h2 id="sheet-title" className="text-lg font-semibold text-foreground">{title}</h2>}
              {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex-shrink-0"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted/40 flex-shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
