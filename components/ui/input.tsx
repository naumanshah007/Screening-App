import { cn } from "@/lib/utils";
import { InputHTMLAttributes, TextareaHTMLAttributes, forwardRef, SelectHTMLAttributes } from "react";
import { AlertCircle } from "lucide-react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  warning?: string;
  hint?: string;
  icon?: React.ReactNode;
  trailing?: React.ReactNode;
  required?: boolean;
}

const fieldBase = cn(
  "w-full rounded-lg border text-sm transition-colors duration-150",
  "bg-card text-foreground placeholder:text-muted-foreground",
  "focus:outline-none focus:ring-2 focus:ring-ring focus:border-accent-color",
  "disabled:opacity-50 disabled:cursor-not-allowed"
);

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, warning, hint, icon, trailing, id, required, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    const feedback = error || warning;
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-foreground mb-1.5">
            {label}
            {required && <span className="text-destructive ml-1" aria-hidden>*</span>}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-muted-foreground">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            aria-invalid={!!error}
            aria-describedby={feedback ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
            className={cn(
              fieldBase,
              "px-3 py-2.5 h-10",
              error
                ? "border-destructive focus:ring-destructive/30 focus:border-destructive"
                : warning
                  ? "border-amber-500 focus:ring-amber-500/30 focus:border-amber-500"
                  : "border-border hover:border-border-strong",
              icon && "pl-9",
              trailing && "pr-9",
              className
            )}
            {...props}
          />
          {trailing && (
            <div className="absolute inset-y-0 right-3 flex items-center text-muted-foreground">
              {trailing}
            </div>
          )}
        </div>
        {error && (
          <p id={`${inputId}-error`} role="alert" className="mt-1.5 text-xs text-destructive flex items-center gap-1">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" aria-hidden />
            {error}
          </p>
        )}
        {!error && warning && (
          <p id={`${inputId}-error`} role="status" className="mt-1.5 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" aria-hidden />
            {warning}
          </p>
        )}
        {hint && !error && !warning && (
          <p id={`${inputId}-hint`} className="mt-1 text-xs text-muted-foreground">{hint}</p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, hint, id, required, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-foreground mb-1.5">
            {label}
            {required && <span className="text-destructive ml-1" aria-hidden>*</span>}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          className={cn(
            fieldBase,
            "px-3 py-2.5 resize-none",
            error
              ? "border-destructive focus:ring-destructive/30"
              : "border-border hover:border-border-strong",
            className
          )}
          {...props}
        />
        {error && (
          <p id={`${inputId}-error`} role="alert" className="mt-1.5 text-xs text-destructive flex items-center gap-1">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" aria-hidden />
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={`${inputId}-hint`} className="mt-1 text-xs text-muted-foreground">{hint}</p>
        )}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  warning?: string;
  hint?: string;
  options?: { value: string; label: string }[];
  placeholder?: string;
  required?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, warning, hint, id, children, options, placeholder, required, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    const feedback = error || warning;
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-foreground mb-1.5">
            {label}
            {required && <span className="text-destructive ml-1" aria-hidden>*</span>}
          </label>
        )}
        <select
          ref={ref}
          id={inputId}
          aria-invalid={!!error}
          aria-describedby={feedback ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          className={cn(
            fieldBase,
            "h-10 px-3",
            error
              ? "border-destructive focus:ring-destructive/30"
              : warning
                ? "border-amber-500 focus:ring-amber-500/30"
                : "border-border hover:border-border-strong",
            className
          )}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options
            ? options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)
            : children}
        </select>
        {error && (
          <p id={`${inputId}-error`} role="alert" className="mt-1.5 text-xs text-destructive flex items-center gap-1">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" aria-hidden />
            {error}
          </p>
        )}
        {!error && warning && (
          <p id={`${inputId}-error`} role="status" className="mt-1.5 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" aria-hidden />
            {warning}
          </p>
        )}
        {hint && !error && !warning && (
          <p id={`${inputId}-hint`} className="mt-1 text-xs text-muted-foreground">{hint}</p>
        )}
      </div>
    );
  }
);
Select.displayName = "Select";
