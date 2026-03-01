"use client";

import { useState, useRef, useEffect } from "react";
import { BookOpen } from "lucide-react";
import { FlowDiagram } from "@/components/clinical/FlowDiagram";
import { ALL_FIGURES } from "@/lib/decision-trees";
import { cn } from "@/lib/utils";

export default function GuidelinesPage() {
  const [selectedId, setSelectedId] = useState(ALL_FIGURES[0].id);
  const selected = ALL_FIGURES.find(f => f.id === selectedId) ?? ALL_FIGURES[0];

  // Measure the diagram panel height dynamically so the SVG fills it exactly
  const panelRef  = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(520);

  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setHeight(Math.max(300, entry.contentRect.height - 1));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="flex h-full min-h-0">
      {/* ── Sidebar figure list ─────────────────────────────────────────────── */}
      <div className="w-64 border-r border-slate-200 bg-white flex flex-col flex-shrink-0 overflow-y-auto">
        <div className="px-4 py-4 border-b border-slate-200 flex-shrink-0">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-brand-600" />
            <h2 className="text-sm font-semibold text-slate-800">NZ Guidelines</h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">Cervical Screening Pathways</p>
        </div>
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {ALL_FIGURES.map(fig => (
            <button
              key={fig.id}
              onClick={() => setSelectedId(fig.id)}
              className={cn(
                "w-full text-left px-3 py-2.5 rounded-lg text-xs transition-all",
                selectedId === fig.id
                  ? "bg-brand-600 text-white"
                  : "text-slate-600 hover:bg-slate-100",
              )}
            >
              <p className="font-semibold leading-snug">{fig.title}</p>
              <p className={cn("truncate mt-0.5", selectedId === fig.id ? "text-white/70" : "text-slate-400")}>
                {fig.subtitle}
              </p>
            </button>
          ))}
        </nav>
      </div>

      {/* ── Diagram panel ───────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        {/* Header */}
        <div className="border-b border-slate-200 bg-white px-6 py-4 flex-shrink-0">
          <h1 className="text-lg font-semibold text-slate-900">{selected.title}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{selected.subtitle}</p>
        </div>

        {/* Diagram — fills remaining height */}
        <div ref={panelRef} className="flex-1 min-h-0 bg-surface p-4">
          <FlowDiagram
            key={selected.id}
            figure={selected}
            height={height}
            className="h-full shadow-sm"
          />
        </div>
      </div>
    </div>
  );
}
