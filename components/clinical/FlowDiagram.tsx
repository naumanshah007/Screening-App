"use client";

import { useMemo, useRef, useState, useCallback, useEffect } from "react";
import type { FigureDef, FlowNode, FlowEdge } from "@/lib/decision-trees";
import { cn } from "@/lib/utils";
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react";

// ─── Geometry constants ────────────────────────────────────────────────────────

const NODE_W  = 190;   // default node width
const NODE_H  = 64;    // default node height
const PAD     = 60;    // padding around outermost nodes
const MIN_F   = 0.25;  // min zoom relative to base
const MAX_F   = 4.0;   // max zoom relative to base

// ─── ViewBox type ─────────────────────────────────────────────────────────────

interface VB { x: number; y: number; w: number; h: number }

/** Compute a viewBox that tightly wraps all nodes with padding */
function autoVB(nodes: FlowNode[]): VB {
  if (!nodes.length) return { x: 0, y: 0, w: 800, h: 500 };
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const n of nodes) {
    const hw = (n.width  ?? NODE_W) / 2;
    const hh = (n.height ?? NODE_H) / 2;
    x0 = Math.min(x0, n.x - hw);
    y0 = Math.min(y0, n.y - hh);
    x1 = Math.max(x1, n.x + hw);
    y1 = Math.max(y1, n.y + hh);
  }
  return { x: x0 - PAD, y: y0 - PAD, w: x1 - x0 + PAD * 2, h: y1 - y0 + PAD * 2 };
}

// ─── Connection points ────────────────────────────────────────────────────────

interface Point { x: number; y: number }

function halfW(n: FlowNode) { return (n.width  ?? NODE_W) / 2; }
function halfH(n: FlowNode) { return (n.height ?? NODE_H) / 2; }

function getConnectionPoints(from: FlowNode, to: FlowNode): { from: Point; to: Point } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  // Prefer horizontal ports when target is mostly beside rather than below
  if (Math.abs(dy) < 80 && Math.abs(dx) > 80) {
    const fp = dx > 0
      ? { x: from.x + halfW(from), y: from.y }
      : { x: from.x - halfW(from), y: from.y };
    const tp = dx > 0
      ? { x: to.x - halfW(to), y: to.y }
      : { x: to.x + halfW(to), y: to.y };
    return { from: fp, to: tp };
  }

  // Default: bottom → top
  return {
    from: { x: from.x, y: from.y + halfH(from) },
    to:   { x: to.x,   y: to.y - halfH(to) },
  };
}

function buildBezier(p1: Point, p2: Point): string {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const horiz = Math.abs(dx) > Math.abs(dy);
  let cx1: number, cy1: number, cx2: number, cy2: number;
  if (horiz) {
    cx1 = p1.x + dx * 0.5; cy1 = p1.y;
    cx2 = p2.x - dx * 0.5; cy2 = p2.y;
  } else {
    const off = Math.max(40, Math.abs(dy) * 0.45);
    cx1 = p1.x; cy1 = p1.y + off;
    cx2 = p2.x; cy2 = p2.y - off;
  }
  return `M ${p1.x},${p1.y} C ${cx1},${cy1} ${cx2},${cy2} ${p2.x},${p2.y}`;
}

function midPoint(p1: Point, p2: Point, t = 0.5): Point {
  // Point on cubic bezier at parameter t (approximated via linear interpolation of endpoints)
  return { x: p1.x + (p2.x - p1.x) * t, y: p1.y + (p2.y - p1.y) * t };
}

// ─── Text wrapping ────────────────────────────────────────────────────────────

function breakLabel(label: string, maxChars = 20): string[] {
  if (label.length <= maxChars) return [label];
  const words = label.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const next = cur ? `${cur} ${word}` : word;
    if (next.length > maxChars && cur) { lines.push(cur); cur = word; }
    else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

// ─── Active path BFS ──────────────────────────────────────────────────────────

function buildActivePath(figure: FigureDef, activeCode: string) {
  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();

  const target = figure.nodes.find(n => n.codes?.includes(activeCode));
  if (!target) return { nodeIds, edgeIds };

  // Build child→[parents] map
  const parents = new Map<string, Array<{ nodeId: string; edgeId: string }>>();
  for (const edge of figure.edges) {
    if (!parents.has(edge.to)) parents.set(edge.to, []);
    parents.get(edge.to)!.push({ nodeId: edge.from, edgeId: edge.id });
  }

  // BFS backwards
  const queue = [target.id];
  nodeIds.add(target.id);
  while (queue.length) {
    const cur = queue.shift()!;
    for (const { nodeId, edgeId } of parents.get(cur) ?? []) {
      edgeIds.add(edgeId);
      if (!nodeIds.has(nodeId)) { nodeIds.add(nodeId); queue.push(nodeId); }
    }
  }
  return { nodeIds, edgeIds };
}

// ─── Node renderer ────────────────────────────────────────────────────────────

function RenderNode({ node, isActive }: { node: FlowNode; isActive: boolean }) {
  const w = node.width  ?? NODE_W;
  const h = node.height ?? NODE_H;
  const hw = w / 2;
  const hh = h / 2;

  const labelLines = breakLabel(node.label, node.type === "decision" ? 18 : 22);
  const LINE_H = 13;
  const totalTxtH = labelLines.length * LINE_H + (node.sublabel ? 12 : 0);
  const txtStartY = node.y - totalTxtH / 2 + LINE_H / 2;

  const txtFill = node.type === "start" ? "#ffffff" : isActive ? "#0d6e68" : "#1e293b";
  const subFill = node.type === "start" ? "rgba(255,255,255,0.6)" : isActive ? "#0d9488" : "#94a3b8";
  const filter  = isActive ? "url(#glow-active)" : "url(#shadow-sm)";

  function shape() {
    if (node.type === "start") {
      return (
        <rect
          x={node.x - hw} y={node.y - 22} width={w} height={44} rx={22}
          fill="#1e3a5f"
          stroke={isActive ? "#0d9488" : "none"}
          strokeWidth={isActive ? 2 : 0}
          filter={filter}
        />
      );
    }

    if (node.type === "decision") {
      const pts = [
        `${node.x},${node.y - hh}`,
        `${node.x + hw},${node.y}`,
        `${node.x},${node.y + hh}`,
        `${node.x - hw},${node.y}`,
      ].join(" ");
      return (
        <polygon
          points={pts}
          fill={isActive ? "#f0fdfa" : "white"}
          stroke={isActive ? "#0d9488" : "#475569"}
          strokeWidth={isActive ? 2.5 : 1.5}
          filter={filter}
        />
      );
    }

    if (node.type === "process") {
      return (
        <rect
          x={node.x - hw} y={node.y - hh} width={w} height={h} rx={8}
          fill={isActive ? "#f0fdfa" : "#f8fafc"}
          stroke={isActive ? "#0d9488" : "#94a3b8"}
          strokeWidth={isActive ? 2.5 : 1.5}
          filter={filter}
        />
      );
    }

    // outcome — colour by risk
    const fills  = { LOW: "#f0fdf4", MEDIUM: "#fffbeb", HIGH: "#fff7ed", URGENT: "#fef2f2" };
    const strokes = { LOW: "#16a34a", MEDIUM: "#d97706", HIGH: "#ea580c", URGENT: "#dc2626" };
    const fill   = fills[node.risk  ?? "LOW"];
    const stroke = isActive ? "#0d9488" : strokes[node.risk ?? "LOW"];

    return (
      <rect
        x={node.x - hw} y={node.y - hh} width={w} height={h} rx={10}
        fill={fill}
        stroke={stroke}
        strokeWidth={isActive ? 2.5 : 1.5}
        filter={filter}
      />
    );
  }

  return (
    <g>
      {shape()}
      {labelLines.map((line, i) => (
        <text
          key={i}
          x={node.x}
          y={txtStartY + i * LINE_H}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={node.type === "start" ? 11.5 : 11}
          fontWeight={600}
          fill={txtFill}
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          {line}
        </text>
      ))}
      {node.sublabel && (
        <text
          x={node.x}
          y={txtStartY + labelLines.length * LINE_H + 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={8.5}
          fill={subFill}
          fontFamily="ui-monospace, monospace"
          letterSpacing={0.4}
        >
          {node.sublabel}
        </text>
      )}
    </g>
  );
}

// ─── Edge renderer ────────────────────────────────────────────────────────────

function RenderEdge({
  edge, fromNode, toNode, isActive,
}: { edge: FlowEdge; fromNode: FlowNode; toNode: FlowNode; isActive: boolean }) {
  const pts  = getConnectionPoints(fromNode, toNode);
  const path = buildBezier(pts.from, pts.to);
  const mid  = midPoint(pts.from, pts.to);

  const color  = isActive ? "#0d9488" : "#cbd5e1";
  const weight = isActive ? 2 : 1.5;
  const marker = isActive ? "url(#arrow-active)" : "url(#arrow-default)";
  const labelLines = edge.label ? breakLabel(edge.label, 18) : [];
  const LBL_W = 82;
  const LBL_H = labelLines.length * 13 + 6;

  return (
    <g>
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={weight}
        strokeDasharray={edge.dashed ? "5,4" : undefined}
        markerEnd={marker}
      />
      {labelLines.length > 0 && (
        <g>
          <rect
            x={mid.x - LBL_W / 2}
            y={mid.y - LBL_H / 2}
            width={LBL_W}
            height={LBL_H}
            rx={4}
            fill="white"
            stroke={isActive ? "#0d9488" : "#e2e8f0"}
            strokeWidth={0.8}
            opacity={0.96}
          />
          {labelLines.map((line, i) => (
            <text
              key={i}
              x={mid.x}
              y={mid.y - ((labelLines.length - 1) * 13) / 2 + i * 13}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={9}
              fill={isActive ? "#0d6e68" : "#64748b"}
              fontWeight={isActive ? 600 : 400}
              fontFamily="system-ui, -apple-system, sans-serif"
            >
              {line}
            </text>
          ))}
        </g>
      )}
    </g>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface FlowDiagramProps {
  figure: FigureDef;
  activeCode?: string;
  className?: string;
  /** Height of the interactive viewport in px (default 480) */
  height?: number;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function FlowDiagram({ figure, activeCode, className, height = 480 }: FlowDiagramProps) {
  // ── Active path ────────────────────────────────────────────────────────────
  const { nodeIds: activeNodes, edgeIds: activeEdges } = useMemo(() => {
    if (!activeCode) return { nodeIds: new Set<string>(), edgeIds: new Set<string>() };
    return buildActivePath(figure, activeCode);
  }, [figure, activeCode]);

  const nodeMap = useMemo(() => {
    const m = new Map<string, FlowNode>();
    for (const n of figure.nodes) m.set(n.id, n);
    return m;
  }, [figure.nodes]);

  // ── ViewBox state (drives zoom & pan) ─────────────────────────────────────
  const baseVB   = useMemo(() => autoVB(figure.nodes), [figure.nodes]);
  const baseRef  = useRef(baseVB);
  const [vb, setVb] = useState<VB>(baseVB);
  const vbRef    = useRef(vb);

  // Reset when figure changes
  useEffect(() => {
    const b = autoVB(figure.nodes);
    baseRef.current = b;
    setVb(b);
  }, [figure.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep ref in sync
  useEffect(() => { vbRef.current = vb; }, [vb]);

  // ── Zoom helper ────────────────────────────────────────────────────────────
  // factor < 1  → zoom in (shrink viewBox), factor > 1 → zoom out (expand viewBox)
  const applyZoom = useCallback((factor: number, pivotX?: number, pivotY?: number) => {
    setVb(prev => {
      const b = baseRef.current;
      const px = pivotX ?? prev.x + prev.w / 2;
      const py = pivotY ?? prev.y + prev.h / 2;
      const newW = Math.max(b.w * MIN_F, Math.min(b.w * MAX_F, prev.w * factor));
      const newH = prev.h * (newW / prev.w);  // maintain aspect ratio
      const rx = (px - prev.x) / prev.w;
      const ry = (py - prev.y) / prev.h;
      return { x: px - rx * newW, y: py - ry * newH, w: newW, h: newH };
    });
  }, []);

  const resetView = useCallback(() => setVb(baseRef.current), []);

  // ── Mouse-wheel zoom ───────────────────────────────────────────────────────
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cur  = vbRef.current;
      const mx   = cur.x + ((e.clientX - rect.left)  / rect.width)  * cur.w;
      const my   = cur.y + ((e.clientY - rect.top)   / rect.height) * cur.h;
      const f    = e.deltaY > 0 ? 1.1 : 0.9;   // scroll down = zoom out
      setVb(prev => {
        const b = baseRef.current;
        const newW = Math.max(b.w * MIN_F, Math.min(b.w * MAX_F, prev.w * f));
        const newH = prev.h * (newW / prev.w);
        const rx = (mx - prev.x) / prev.w;
        const ry = (my - prev.y) / prev.h;
        return { x: mx - rx * newW, y: my - ry * newH, w: newW, h: newH };
      });
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);  // empty deps — uses refs only

  // ── Drag to pan ────────────────────────────────────────────────────────────
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ cx: number; cy: number; vb: VB } | null>(null);

  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    setDragging(true);
    dragRef.current = { cx: e.clientX, cy: e.clientY, vb: { ...vbRef.current } };
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging || !dragRef.current) return;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const saved = dragRef.current;
    const dx = ((e.clientX - saved.cx) / rect.width)  * saved.vb.w;
    const dy = ((e.clientY - saved.cy) / rect.height) * saved.vb.h;
    setVb({ ...saved.vb, x: saved.vb.x - dx, y: saved.vb.y - dy });
  };

  const stopDrag = () => { setDragging(false); dragRef.current = null; };

  // ── Touch pan/pinch ────────────────────────────────────────────────────────
  const touchRef = useRef<{ touches: Array<{ id: number; x: number; y: number }>; vb: VB } | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    const touches = Array.from(e.touches).map(t => ({ id: t.identifier, x: t.clientX, y: t.clientY }));
    touchRef.current = { touches, vb: { ...vbRef.current } };
  };

  const onTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    if (!touchRef.current || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const saved = touchRef.current;
    const cur = Array.from(e.touches).map(t => ({ id: t.identifier, x: t.clientX, y: t.clientY }));

    if (cur.length === 1 && saved.touches.length === 1) {
      // Single touch pan
      const dx = ((cur[0].x - saved.touches[0].x) / rect.width)  * saved.vb.w;
      const dy = ((cur[0].y - saved.touches[0].y) / rect.height) * saved.vb.h;
      setVb({ ...saved.vb, x: saved.vb.x - dx, y: saved.vb.y - dy });
    } else if (cur.length === 2 && saved.touches.length >= 2) {
      // Pinch zoom
      const prevDist = Math.hypot(
        saved.touches[1].x - saved.touches[0].x,
        saved.touches[1].y - saved.touches[0].y,
      );
      const curDist = Math.hypot(
        cur[1].x - cur[0].x, cur[1].y - cur[0].y,
      );
      if (prevDist === 0) return;
      const f = prevDist / curDist; // zoom in when fingers spread
      const midX = (cur[0].x + cur[1].x) / 2;
      const midY = (cur[0].y + cur[1].y) / 2;
      const mx   = saved.vb.x + ((midX - rect.left) / rect.width)  * saved.vb.w;
      const my   = saved.vb.y + ((midY - rect.top)  / rect.height) * saved.vb.h;
      const b    = baseRef.current;
      const newW = Math.max(b.w * MIN_F, Math.min(b.w * MAX_F, saved.vb.w * f));
      const newH = saved.vb.h * (newW / saved.vb.w);
      const rx   = (mx - saved.vb.x) / saved.vb.w;
      const ry   = (my - saved.vb.y) / saved.vb.h;
      setVb({ x: mx - rx * newW, y: my - ry * newH, w: newW, h: newH });
    }
  };

  const onTouchEnd = () => { touchRef.current = null; };

  // ── Render ─────────────────────────────────────────────────────────────────
  const vbStr = `${vb.x} ${vb.y} ${vb.w} ${vb.h}`;

  return (
    <div
      className={cn(
        "relative rounded-xl border border-slate-200 bg-white overflow-hidden select-none",
        className,
      )}
      style={{ height }}
    >
      {/* ── Zoom controls ── */}
      <div className="absolute top-3 right-3 z-10 flex flex-col gap-1.5 pointer-events-auto">
        <button
          onClick={() => applyZoom(0.72)}
          title="Zoom in"
          className="w-8 h-8 rounded-lg bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-600 hover:bg-slate-50 hover:border-brand-400 hover:text-brand-700 transition-all"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <button
          onClick={() => applyZoom(1.38)}
          title="Zoom out"
          className="w-8 h-8 rounded-lg bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-600 hover:bg-slate-50 hover:border-brand-400 hover:text-brand-700 transition-all"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <button
          onClick={resetView}
          title="Fit to screen"
          className="w-8 h-8 rounded-lg bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-600 hover:bg-slate-50 hover:border-brand-400 hover:text-brand-700 transition-all"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* ── Interaction hint ── */}
      <div className="absolute bottom-3 left-3 z-10 pointer-events-none">
        <span className="text-[10px] text-slate-400 bg-white/80 px-2 py-1 rounded-md">
          Scroll to zoom · Drag to pan
        </span>
      </div>

      {/* ── SVG ── */}
      <svg
        ref={svgRef}
        viewBox={vbStr}
        preserveAspectRatio="xMidYMid meet"
        width="100%"
        height="100%"
        style={{ cursor: dragging ? "grabbing" : "grab", display: "block" }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={stopDrag}
        onMouseLeave={stopDrag}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <marker id="arrow-default" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L0,6 L8,3 z" fill="#94a3b8" />
          </marker>
          <marker id="arrow-active" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L0,6 L8,3 z" fill="#0d9488" />
          </marker>
          <filter id="glow-active" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#0d9488" floodOpacity="0.35" />
          </filter>
          <filter id="shadow-sm" x="-10%" y="-10%" width="120%" height="130%">
            <feDropShadow dx="0" dy="1" stdDeviation="2.5" floodColor="#1e293b" floodOpacity="0.07" />
          </filter>
        </defs>

        {/* Edges rendered first (behind nodes) */}
        {figure.edges.map(edge => {
          const fn = nodeMap.get(edge.from);
          const tn = nodeMap.get(edge.to);
          if (!fn || !tn) return null;
          return (
            <RenderEdge
              key={edge.id}
              edge={edge}
              fromNode={fn}
              toNode={tn}
              isActive={activeEdges.has(edge.id)}
            />
          );
        })}

        {/* Nodes on top */}
        {figure.nodes.map(node => (
          <RenderNode
            key={node.id}
            node={node}
            isActive={activeNodes.has(node.id)}
          />
        ))}
      </svg>
    </div>
  );
}
