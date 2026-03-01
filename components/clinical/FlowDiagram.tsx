"use client";

import { useMemo } from "react";
import type { FigureDef, FlowNode, FlowEdge } from "@/lib/decision-trees";
import { cn } from "@/lib/utils";

// ─── Props ────────────────────────────────────────────────────────────────────

interface FlowDiagramProps {
  figure: FigureDef;
  activeCode?: string;      // recommendationCode to highlight path
  className?: string;
  compact?: boolean;        // smaller rendering
}

// ─── Connection point helpers ─────────────────────────────────────────────────

interface Point { x: number; y: number }

function nodeHalfW(n: FlowNode) { return (n.width ?? 180) / 2; }
function nodeHalfH(n: FlowNode) { return (n.height ?? 60) / 2; }

function getConnectionPoints(from: FlowNode, to: FlowNode): { from: Point; to: Point } {
  const dy = to.y - from.y;
  const dx = to.x - from.x;

  if (Math.abs(dy) < 80 && Math.abs(dx) > 100) {
    // Horizontal connection — use side ports
    const fromPort = dx > 0
      ? { x: from.x + nodeHalfW(from), y: from.y }
      : { x: from.x - nodeHalfW(from), y: from.y };
    const toPort = dx > 0
      ? { x: to.x - nodeHalfW(to), y: to.y }
      : { x: to.x + nodeHalfW(to), y: to.y };
    return { from: fromPort, to: toPort };
  }

  // Vertical connection (default) — bottom to top
  const fromBottom = { x: from.x, y: from.y + nodeHalfH(from) };
  const toTop      = { x: to.x,   y: to.y - nodeHalfH(to) };
  return { from: fromBottom, to: toTop };
}

function buildBezier(p1: Point, p2: Point): string {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const isHorizontalish = Math.abs(dx) > Math.abs(dy);

  let cx1: number, cy1: number, cx2: number, cy2: number;
  if (isHorizontalish) {
    cx1 = p1.x + dx * 0.5;
    cy1 = p1.y;
    cx2 = p2.x - dx * 0.5;
    cy2 = p2.y;
  } else {
    const offset = Math.max(40, Math.abs(dy) * 0.45);
    cx1 = p1.x;
    cy1 = p1.y + offset;
    cx2 = p2.x;
    cy2 = p2.y - offset;
  }
  return `M ${p1.x},${p1.y} C ${cx1},${cy1} ${cx2},${cy2} ${p2.x},${p2.y}`;
}

function midPoint(p1: Point, p2: Point): Point {
  return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
}

// ─── Text line-breaking ───────────────────────────────────────────────────────

function breakLabel(label: string, maxChars = 22): string[] {
  if (label.length <= maxChars) return [label];
  const words = label.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if ((current + (current ? ' ' : '') + word).length > maxChars) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// ─── Active path BFS ──────────────────────────────────────────────────────────

function buildActivePath(
  figure: FigureDef,
  activeCode: string
): { nodeIds: Set<string>; edgeIds: Set<string> } {
  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();

  // Find the outcome node that owns this code
  const target = figure.nodes.find(n => n.codes?.includes(activeCode));
  if (!target) return { nodeIds, edgeIds };

  // Build adjacency: child -> [parents]
  const parents = new Map<string, Array<{ nodeId: string; edgeId: string }>>();
  for (const edge of figure.edges) {
    if (!parents.has(edge.to)) parents.set(edge.to, []);
    parents.get(edge.to)!.push({ nodeId: edge.from, edgeId: edge.id });
  }

  // BFS backwards from target to start
  const queue = [target.id];
  nodeIds.add(target.id);
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const { nodeId, edgeId } of parents.get(current) ?? []) {
      edgeIds.add(edgeId);
      if (!nodeIds.has(nodeId)) {
        nodeIds.add(nodeId);
        queue.push(nodeId);
      }
    }
  }

  return { nodeIds, edgeIds };
}

// ─── Node rendering ───────────────────────────────────────────────────────────

interface NodeProps {
  node: FlowNode;
  isActive: boolean;
}

function RenderNode({ node, isActive }: NodeProps) {
  const w = node.width ?? 180;
  const h = node.height ?? 60;
  const halfW = w / 2;
  const halfH = h / 2;

  const activeFilter = isActive ? 'url(#glow-active)' : undefined;

  const labelLines = breakLabel(node.label, 24);
  const lineHeight = 14;
  // Centre text block vertically
  const totalTextH = labelLines.length * lineHeight + (node.sublabel ? 14 : 0);
  const textStartY = node.y - totalTextH / 2 + lineHeight / 2;

  const textFill = node.type === 'start' ? '#ffffff' : '#1e293b';
  const subFill = node.type === 'start' ? 'rgba(255,255,255,0.65)' : '#94a3b8';

  function renderShape() {
    if (node.type === 'start') {
      return (
        <rect
          x={node.x - halfW}
          y={node.y - 22}
          width={w}
          height={44}
          rx={22}
          fill="#1e3a5f"
          filter={activeFilter}
        />
      );
    }

    if (node.type === 'decision') {
      // Diamond shape
      const pts = [
        `${node.x},${node.y - halfH}`,
        `${node.x + halfW},${node.y}`,
        `${node.x},${node.y + halfH}`,
        `${node.x - halfW},${node.y}`,
      ].join(' ');
      return (
        <polygon
          points={pts}
          fill="white"
          stroke={isActive ? '#0d9488' : '#475569'}
          strokeWidth={isActive ? 2.5 : 1.5}
          filter={activeFilter}
        />
      );
    }

    if (node.type === 'process') {
      return (
        <rect
          x={node.x - halfW}
          y={node.y - halfH}
          width={w}
          height={h}
          rx={8}
          fill="#f8fafc"
          stroke={isActive ? '#0d9488' : '#94a3b8'}
          strokeWidth={isActive ? 2.5 : 1.5}
          filter={activeFilter}
        />
      );
    }

    // outcome node — colour by risk
    let fill = '#f0fdf4';
    let stroke = '#16a34a';
    if (node.risk === 'MEDIUM') { fill = '#fffbeb'; stroke = '#d97706'; }
    if (node.risk === 'HIGH')   { fill = '#fff7ed'; stroke = '#ea580c'; }
    if (node.risk === 'URGENT') { fill = '#fef2f2'; stroke = '#dc2626'; }

    return (
      <rect
        x={node.x - halfW}
        y={node.y - halfH}
        width={w}
        height={h}
        rx={10}
        fill={fill}
        stroke={isActive ? '#0d9488' : stroke}
        strokeWidth={isActive ? 2.5 : 1.5}
        filter={activeFilter}
      />
    );
  }

  return (
    <g key={node.id}>
      {renderShape()}

      {/* Main label lines */}
      {labelLines.map((line, i) => (
        <text
          key={i}
          x={node.x}
          y={textStartY + i * lineHeight}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={node.type === 'start' ? 11 : 11}
          fontWeight={600}
          fill={isActive && node.type !== 'start' ? '#0d6e68' : textFill}
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          {line}
        </text>
      ))}

      {/* Sublabel / code */}
      {node.sublabel && (
        <text
          x={node.x}
          y={textStartY + labelLines.length * lineHeight + 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={9}
          fill={isActive ? '#0d9488' : subFill}
          fontFamily="ui-monospace, monospace"
          fontWeight={400}
        >
          {node.sublabel}
        </text>
      )}
    </g>
  );
}

// ─── Edge rendering ───────────────────────────────────────────────────────────

interface EdgeProps {
  edge: FlowEdge;
  fromNode: FlowNode;
  toNode: FlowNode;
  isActive: boolean;
}

function RenderEdge({ edge, fromNode, toNode, isActive }: EdgeProps) {
  const pts = getConnectionPoints(fromNode, toNode);
  const path = buildBezier(pts.from, pts.to);
  const mid = midPoint(pts.from, pts.to);

  const strokeColor = isActive ? '#0d9488' : '#cbd5e1';
  const strokeWidth = isActive ? 2 : 1.5;
  const markerEnd = isActive ? 'url(#arrow-active)' : 'url(#arrow-default)';

  const labelLines = edge.label ? breakLabel(edge.label, 18) : [];

  return (
    <g>
      <path
        d={path}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeDasharray={edge.dashed ? '5,4' : undefined}
        markerEnd={markerEnd}
      />

      {labelLines.length > 0 && (
        <g>
          {/* White bg rect behind label */}
          <rect
            x={mid.x - 38}
            y={mid.y - labelLines.length * 7 - 3}
            width={76}
            height={labelLines.length * 13 + 6}
            rx={4}
            fill="white"
            stroke={isActive ? '#0d9488' : '#e2e8f0'}
            strokeWidth={0.8}
            opacity={0.95}
          />
          {labelLines.map((line, i) => (
            <text
              key={i}
              x={mid.x}
              y={mid.y - (labelLines.length - 1) * 6.5 + i * 13 - (labelLines.length > 1 ? 6 : 0)}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={9.5}
              fill={isActive ? '#0d6e68' : '#64748b'}
              fontFamily="system-ui, -apple-system, sans-serif"
              fontWeight={isActive ? 600 : 400}
            >
              {line}
            </text>
          ))}
        </g>
      )}
    </g>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function FlowDiagram({ figure, activeCode, className }: FlowDiagramProps) {
  const { nodeIds: activeNodes, edgeIds: activeEdges } = useMemo(() => {
    if (!activeCode) return { nodeIds: new Set<string>(), edgeIds: new Set<string>() };
    return buildActivePath(figure, activeCode);
  }, [figure, activeCode]);

  const nodeMap = useMemo(() => {
    const m = new Map<string, FlowNode>();
    for (const n of figure.nodes) m.set(n.id, n);
    return m;
  }, [figure.nodes]);

  return (
    <div className={cn(
      "relative overflow-auto rounded-xl border border-slate-200 bg-white",
      className
    )}>
      <svg
        viewBox={figure.viewBox}
        className="w-full min-w-[600px]"
        style={{ minHeight: 400 }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Default arrow */}
          <marker
            id="arrow-default"
            markerWidth="8"
            markerHeight="8"
            refX="6"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L0,6 L8,3 z" fill="#94a3b8" />
          </marker>

          {/* Active (teal) arrow */}
          <marker
            id="arrow-active"
            markerWidth="8"
            markerHeight="8"
            refX="6"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L0,6 L8,3 z" fill="#0d9488" />
          </marker>

          {/* Glow filter for active nodes */}
          <filter id="glow-active" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#0d9488" floodOpacity="0.4" />
          </filter>

          {/* Subtle shadow for all nodes */}
          <filter id="shadow-sm" x="-10%" y="-10%" width="120%" height="130%">
            <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#1e293b" floodOpacity="0.08" />
          </filter>
        </defs>

        {/* Render edges first (behind nodes) */}
        {figure.edges.map(edge => {
          const fromNode = nodeMap.get(edge.from);
          const toNode = nodeMap.get(edge.to);
          if (!fromNode || !toNode) return null;
          return (
            <RenderEdge
              key={edge.id}
              edge={edge}
              fromNode={fromNode}
              toNode={toNode}
              isActive={activeEdges.has(edge.id)}
            />
          );
        })}

        {/* Render nodes on top */}
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
