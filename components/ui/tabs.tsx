"use client";
import { createContext, useContext, useState } from "react";
import { cn } from "@/lib/utils";

interface TabsContextValue {
  active: string;
  setActive: (id: string) => void;
}

const TabsContext = createContext<TabsContextValue>({ active: "", setActive: () => {} });

export function Tabs({
  defaultTab,
  children,
  className,
}: {
  defaultTab: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [active, setActive] = useState(defaultTab);
  return (
    <TabsContext.Provider value={{ active, setActive }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabList({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn(
        "flex gap-0 border-b border-border overflow-x-auto scrollbar-none",
        className
      )}
    >
      {children}
    </div>
  );
}

export function Tab({
  id,
  children,
  className,
  disabled,
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  const { active, setActive } = useContext(TabsContext);
  const isActive = active === id;
  return (
    <button
      role="tab"
      aria-selected={isActive}
      aria-controls={`panel-${id}`}
      id={`tab-${id}`}
      disabled={disabled}
      onClick={() => setActive(id)}
      className={cn(
        "relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
        isActive
          ? "text-accent-color border-b-2 border-accent-color -mb-px"
          : "text-muted-foreground hover:text-foreground",
        disabled && "opacity-40 cursor-not-allowed",
        className
      )}
    >
      {children}
    </button>
  );
}

export function TabPanel({
  id,
  children,
  className,
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { active } = useContext(TabsContext);
  if (active !== id) return null;
  return (
    <div
      role="tabpanel"
      id={`panel-${id}`}
      aria-labelledby={`tab-${id}`}
      className={cn("animate-fade-in", className)}
    >
      {children}
    </div>
  );
}
