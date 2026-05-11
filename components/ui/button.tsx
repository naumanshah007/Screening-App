"use client";
import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";
import { Loader2 } from "lucide-react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "outline" | "success" | "warning";
  size?: "xs" | "sm" | "md" | "lg" | "icon";
  loading?: boolean;
  icon?: React.ReactNode;
  iconEnd?: React.ReactNode;
}

const variantClasses: Record<string, string> = {
  primary:   "bg-brand-600 hover:bg-brand-700 text-white shadow-sm shadow-brand-900/10 border border-transparent",
  secondary: "bg-navy-600 hover:bg-navy-700 text-white shadow-sm border border-transparent",
  danger:    "bg-destructive hover:bg-destructive/80 text-white shadow-sm border border-transparent",
  ghost:     "bg-transparent hover:bg-muted text-muted-foreground hover:text-foreground border border-transparent",
  outline:   "border border-border bg-card hover:bg-muted text-foreground shadow-sm",
  success:   "bg-success hover:bg-success/80 text-white shadow-sm border border-transparent",
  warning:   "bg-warn hover:bg-warn/80 text-white shadow-sm border border-transparent",
};

const sizeClasses: Record<string, string> = {
  xs:   "h-7  px-2.5 text-xs  gap-1   rounded-md",
  sm:   "h-8  px-3   text-xs  gap-1.5 rounded-lg",
  md:   "h-9  px-4   text-sm  gap-2   rounded-lg",
  lg:   "h-11 px-6   text-sm  gap-2   rounded-xl",
  icon: "h-9  w-9    text-sm  rounded-lg",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, disabled, children, icon, iconEnd, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center font-medium transition-all duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "active:scale-[0.98] select-none whitespace-nowrap",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : (
        <>
          {icon && <span className="flex-shrink-0" aria-hidden>{icon}</span>}
          {children}
          {iconEnd && <span className="flex-shrink-0" aria-hidden>{iconEnd}</span>}
        </>
      )}
    </button>
  )
);
Button.displayName = "Button";
