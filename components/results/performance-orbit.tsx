"use client";

import { useId, useState } from "react";
import { useReducedMotion } from "framer-motion";
import type { StatusTone } from "@/lib/types/common";
import { toneClasses } from "@/components/dashboard/tone";
import { cn } from "@/lib/utils";

export type OrbitDimension = { key: string; label: string; score: number; tone: StatusTone; detail: string };

/** Lightweight, optional companion to the subject-wise results table (never a replacement
 * for it) — a small radial glance at how a result breaks down across subject clusters,
 * attendance, and improvement. Static (no continuous animation), respects
 * prefers-reduced-motion by skipping the entrance transition entirely. */
export function PerformanceOrbit({ dimensions }: { dimensions: OrbitDimension[] }) {
  const reduceMotion = useReducedMotion();
  const [active, setActive] = useState<string | null>(null);
  const titleId = useId();
  const size = 220;
  const center = size / 2;
  const radius = 78;

  if (dimensions.length === 0) return null;

  const activeDimension = dimensions.find((d) => d.key === active);

  return (
    <div className="flex flex-col items-center gap-sm">
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-labelledby={titleId} className="max-w-full">
        <title id={titleId}>Performance breakdown by area</title>
        <circle cx={center} cy={center} r={radius} className="fill-none stroke-border" strokeWidth={1} />
        {dimensions.map((dim, i) => {
          const angle = (i / dimensions.length) * 2 * Math.PI - Math.PI / 2;
          const x = center + radius * Math.cos(angle);
          const y = center + radius * Math.sin(angle);
          const nodeSize = 10 + (dim.score / 100) * 14;
          const isActive = active === dim.key;
          return (
            <g key={dim.key}>
              <line x1={center} y1={center} x2={x} y2={y} className="stroke-border" strokeWidth={1} />
              <circle
                cx={x}
                cy={y}
                r={nodeSize}
                tabIndex={0}
                role="button"
                aria-label={`${dim.label}: ${dim.score} out of 100. ${dim.detail}`}
                onMouseEnter={() => setActive(dim.key)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(dim.key)}
                onBlur={() => setActive(null)}
                onClick={() => setActive(isActive ? null : dim.key)}
                className={cn("cursor-pointer fill-current stroke-surface outline-none transition-[r]", toneClasses[dim.tone].text, !reduceMotion && "duration-150")}
                strokeWidth={2}
              />
              <text x={x} y={y + nodeSize + 12} textAnchor="middle" className="fill-current text-[9px] font-medium text-muted-foreground">
                {dim.label}
              </text>
            </g>
          );
        })}
        <circle cx={center} cy={center} r={22} className="fill-surface stroke-border" strokeWidth={1} />
        <text x={center} y={center + 4} textAnchor="middle" className="fill-current text-[11px] font-bold text-foreground">
          {Math.round(dimensions.reduce((sum, d) => sum + d.score, 0) / dimensions.length)}
        </text>
      </svg>
      <p className="min-h-8 text-center text-xs text-muted-foreground">{activeDimension ? `${activeDimension.label}: ${activeDimension.detail}` : "Hover or focus a node for details"}</p>
    </div>
  );
}
