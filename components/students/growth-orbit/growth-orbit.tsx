"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useMemo, useState } from "react";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { useInView } from "@/lib/hooks/use-in-view";
import type { PulseDimension, StudentPulse } from "@/lib/types/students";
import { cn } from "@/lib/utils";

const toneFill: Record<PulseDimension["tone"], string> = {
  success: "fill-success",
  info: "fill-info",
  warning: "fill-warning",
  error: "fill-error",
  neutral: "fill-muted-foreground",
};

const toneStroke: Record<PulseDimension["tone"], string> = {
  success: "stroke-success",
  info: "stroke-info",
  warning: "stroke-warning",
  error: "stroke-error",
  neutral: "stroke-muted-foreground",
};

const SIZE = 280;
const CENTER = SIZE / 2;
const ORBIT_RADIUS = 100;

function nodeRadius(score: number): number {
  return 16 + (score / 100) * 16;
}

export function StudentGrowthOrbit({ pulse }: { pulse: StudentPulse }) {
  const reduceMotion = useReducedMotion();
  const { ref, inView } = useInView<HTMLDivElement>();
  const [selected, setSelected] = useState<PulseDimension | null>(null);

  const riskDimension = useMemo(() => [...pulse.dimensions].sort((a, b) => a.score - b.score)[0], [pulse.dimensions]);

  const positioned = useMemo(
    () =>
      pulse.dimensions.map((dimension, index) => {
        const angle = (index / pulse.dimensions.length) * Math.PI * 2 - Math.PI / 2;
        return {
          dimension,
          x: CENTER + ORBIT_RADIUS * Math.cos(angle),
          y: CENTER + ORBIT_RADIUS * Math.sin(angle),
        };
      }),
    [pulse.dimensions],
  );

  const animateEntrance = !reduceMotion && inView;

  return (
    <div ref={ref} className="flex flex-col items-center gap-sm">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label={`Student growth orbit. Overall pulse ${pulse.overallScore} out of 100, status ${pulse.status.replace("-", " ")}.`}
        className="h-56 w-56 sm:h-64 sm:w-64"
      >
        <circle cx={CENTER} cy={CENTER} r={ORBIT_RADIUS} className="fill-none stroke-border" strokeWidth={1} strokeDasharray="2 4" />

        {positioned.map(({ dimension, x, y }) => (
          <line key={`line-${dimension.key}`} x1={CENTER} y1={CENTER} x2={x} y2={y} className="stroke-border" strokeWidth={1} />
        ))}

        <motion.circle
          cx={CENTER}
          cy={CENTER}
          r={44}
          className="fill-surface stroke-primary"
          strokeWidth={2}
          initial={animateEntrance ? { scale: 0.7, opacity: 0 } : false}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
        />
        <text x={CENTER} y={CENTER - 4} textAnchor="middle" className="fill-foreground text-[22px] font-bold">
          {pulse.overallScore}
        </text>
        <text x={CENTER} y={CENTER + 14} textAnchor="middle" className="fill-muted-foreground text-[9px] font-medium uppercase tracking-wide">
          {pulse.status.replace("-", " ")}
        </text>

        {positioned.map(({ dimension, x, y }, index) => {
          const r = nodeRadius(dimension.score);
          const isRisk = dimension.key === riskDimension.key;
          const isSelected = selected?.key === dimension.key;
          return (
            <g key={dimension.key}>
              {isRisk && (
                <circle
                  cx={x}
                  cy={y}
                  r={r + 5}
                  className={cn("fill-none", toneStroke[dimension.tone])}
                  strokeWidth={1.5}
                  opacity={0.5}
                  style={
                    !reduceMotion && inView
                      ? { animation: "growth-orbit-pulse 2.4s ease-in-out infinite" }
                      : undefined
                  }
                />
              )}
              <motion.circle
                cx={x}
                cy={y}
                r={r}
                className={cn(toneFill[dimension.tone], "cursor-pointer outline-none")}
                opacity={isSelected ? 1 : 0.85}
                stroke={isSelected ? "currentColor" : "transparent"}
                strokeWidth={isSelected ? 2 : 0}
                initial={animateEntrance ? { scale: 0, opacity: 0 } : false}
                animate={{ scale: 1, opacity: isSelected ? 1 : 0.85 }}
                transition={{ duration: 0.3, delay: animateEntrance ? index * 0.05 : 0 }}
                whileHover={reduceMotion ? undefined : { scale: 1.08 }}
                tabIndex={0}
                role="button"
                aria-label={`${dimension.label}: ${dimension.score} out of 100. ${dimension.summary}`}
                onClick={() => setSelected(dimension)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelected(dimension);
                  }
                }}
              />
              <text x={x} y={y + 3} textAnchor="middle" className="pointer-events-none fill-white text-[10px] font-bold">
                {dimension.score}
              </text>
              <text x={x} y={y + r + 12} textAnchor="middle" className="pointer-events-none fill-muted-foreground text-[9px] font-medium">
                {dimension.label}
              </text>
            </g>
          );
        })}
      </svg>

      <style jsx>{`
        @keyframes growth-orbit-pulse {
          0%,
          100% {
            opacity: 0.35;
          }
          50% {
            opacity: 0.75;
          }
        }
      `}</style>

      <DetailDrawer open={selected !== null} onOpenChange={(open) => !open && setSelected(null)} title={selected?.label ?? ""} description="Growth dimension detail">
        {selected && (
          <div className="flex flex-col gap-sm">
            <div className="flex items-baseline gap-sm">
              <span className="text-3xl font-bold text-foreground">{selected.score}</span>
              <span className="text-sm text-muted-foreground">/ 100 · trending {selected.trend}</span>
            </div>
            <p className="text-sm text-muted-foreground">{selected.summary}</p>
            {selected.key === riskDimension.key && (
              <p className="rounded-md border border-warning/30 bg-warning/10 p-sm text-xs text-warning">
                This is the current lowest-scoring dimension — {pulse.suggestedAction}
              </p>
            )}
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}
