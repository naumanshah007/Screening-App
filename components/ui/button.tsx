"use client";
import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";
import { Loader2 } from "lucide-react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "outline" | "success";
  size?: "sm" | "md" | "lg" | "icon";
  loading?: boolean;
}

const variantClasses: Record<string, string> = {
  primary:   "bg-brand-600 hover:bg-brand-700 text-white shadow-sm shadow-brand-900/10",
  secondary: "bg-navy-600 hover:bg-navy-700 text-white shadow-sm",
  danger:    "bg-red-600 hover:bg-red-700 text-white shadow-sm",
  ghost:     "bg-transparent hover:bg-slate-100 text-slate-600 hover:text-slate-900",
  outline:   "border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-sm",
  success:   "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm",
};

const sizeClasses: Record<string, string> = {
  sm:   "h-8  px-3   text-xs  gap-1.5",
  md:   "h-9  px-4   text-sm  gap-2",
  lg:   "h-11 px-6   text-sm  gap-2",
  icon: "h-9  w-9    text-sm",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center rounded-lg font-medium transition-all duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "active:scale-[0.98]",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : children}
    </button>
  )
);
Button.displayName = "Button";
