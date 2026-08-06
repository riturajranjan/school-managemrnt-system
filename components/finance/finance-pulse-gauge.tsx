"use client";

import { useEffect, useState } from "react";
import type { FinancePulseComponent } from "@/lib/selectors/finance-pulse";

const SIZE = 200;
const STROKE = 16;
const RADIUS = (SIZE - STROKE) / 2;
const CENTER = SIZE / 2;
const CIRCUMFERENCE = Math.PI * RADIUS;

function toneForScore(score: number): { color: string; label: string } {
  if (score >= 80) return { color: "#16a34a", label: "Healthy" };
  if (score >= 60) return { color: "#d97706", label: "Needs attention" };
  return { color: "#dc2626", label: "At risk" };
}

/** A real, computed treasury-style gauge — the filled arc length is
 * literally `score / 100`, no decorative coin flips or looping shimmer.
 * Animates once to its value on mount (or snaps instantly under reduced
 * motion) and then holds still. */
export function FinancePulseGauge({ score, components }: { score: number; components: FinancePulseComponent[] }) {
  const [dash, setDash] = useState(0);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setDash((score / 100) * CIRCUMFERENCE));
    return () => cancelAnimationFrame(raf);
  }, [score]);

  const tone = toneForScore(score);

  return (
    <div className="flex flex-col items-center gap-sm">
      <div className="relative">
        <svg width={SIZE} height={SIZE / 2 + STROKE} viewBox={`0 0 ${SIZE} ${SIZE / 2 + STROKE}`} className="overflow-visible drop-shadow-[0_6px_14px_rgba(0,0,0,0.18)]">
          <defs>
            <linearGradient id="finance-pulse-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#dc2626" />
              <stop offset="50%" stopColor="#d97706" />
              <stop offset="100%" stopColor="#16a34a" />
            </linearGradient>
          </defs>
          <path d={`M ${STROKE / 2} ${CENTER} A ${RADIUS} ${RADIUS} 0 0 1 ${SIZE - STROKE / 2} ${CENTER}`} fill="none" className="stroke-border" strokeWidth={STROKE} strokeLinecap="round" />
          <path
            d={`M ${STROKE / 2} ${CENTER} A ${RADIUS} ${RADIUS} 0 0 1 ${SIZE - STROKE / 2} ${CENTER}`}
            fill="none"
            stroke="url(#finance-pulse-gradient)"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${CIRCUMFERENCE}`}
            className="transition-[stroke-dasharray] duration-700 ease-out motion-reduce:transition-none"
          />
        </svg>
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
          <span className="text-3xl font-bold tabular-nums text-foreground">{score}</span>
          <span className="text-[11px] font-medium" style={{ color: tone.color }}>
            {tone.label}
          </span>
        </div>
      </div>

      <div className="grid w-full grid-cols-2 gap-x-sm gap-y-1 text-[11px]">
        {components.map((component) => (
          <div key={component.key} className="flex items-center justify-between gap-1">
            <span className="truncate text-muted-foreground">{component.label}</span>
            <span className="font-medium text-foreground">{component.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
