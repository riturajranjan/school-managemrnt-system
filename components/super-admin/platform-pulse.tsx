"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { LayoutList } from "lucide-react";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { MiniBar } from "@/components/dashboard/mini-charts";
import { toneClasses } from "@/components/dashboard/tone";
import type { PulseFactor } from "@/lib/selectors/saas-brief";

/** Platform Pulse — a subtle orbit of tenant-health nodes around an aggregate
 * score. Data-driven (node distance/tone maps to each factor's score). No
 * decorative globe, no WebGL; respects reduced motion. */
export function PlatformPulse({ score, factors }: { score: number; factors: PulseFactor[] }) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const sorted = [...factors].sort((a, b) => a.score - b.score);
  const R = 82;

  return (
    <div className="rounded-lg border border-border bg-surface p-md">
      <div className="mb-sm flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Platform Pulse</h2>
        <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-1 text-xs font-medium text-primary"><LayoutList className="size-3.5" /> Breakdown</button>
      </div>
      <div className="flex flex-col items-center gap-sm">
        <div className="relative" style={{ width: 220, height: 220 }}>
          <svg className="absolute inset-0" width="220" height="220" viewBox="0 0 220 220" aria-hidden>
            <circle cx="110" cy="110" r={R} fill="none" stroke="var(--color-border,#e2e8f0)" strokeWidth="1" strokeDasharray="2 4" />
            {factors.map((f, i) => {
              const a = (i / factors.length) * Math.PI * 2 - Math.PI / 2;
              const x = 110 + Math.cos(a) * R, y = 110 + Math.sin(a) * R;
              return <line key={f.key} x1="110" y1="110" x2={x} y2={y} stroke="var(--color-border,#e2e8f0)" strokeWidth="1" />;
            })}
          </svg>
          {/* Centre score */}
          <div className="absolute left-1/2 top-1/2 flex size-20 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full bg-[linear-gradient(135deg,#022c43,#18b0c8)] text-white shadow-lg">
            <span className="text-2xl font-bold leading-none">{score}</span><span className="text-[9px] text-white/70">health</span>
          </div>
          {/* Orbit nodes */}
          {factors.map((f, i) => {
            const a = (i / factors.length) * Math.PI * 2 - Math.PI / 2;
            const x = 110 + Math.cos(a) * R, y = 110 + Math.sin(a) * R;
            return (
              <motion.div key={f.key}
                initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }} animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1 }} transition={{ delay: reduce ? 0 : i * 0.06 }}
                className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: x, top: y }}
                title={`${f.label}: ${f.displayValue}`}
              >
                <span className={`flex size-9 items-center justify-center rounded-full border text-[10px] font-bold ${toneClasses[f.tone].soft}`}>{f.score}</span>
              </motion.div>
            );
          })}
        </div>
        <p className="text-center text-xs text-muted-foreground">Aggregate operational health — not a churn prediction.</p>
        <p className="text-center text-xs text-muted-foreground">Strongest: <span className="font-medium text-foreground">{sorted[sorted.length - 1].label}</span> · Risk: <span className="font-medium text-foreground">{sorted[0].label}</span></p>
      </div>

      <DetailDrawer open={open} onOpenChange={setOpen} title="Platform Pulse breakdown" description="Aggregate operational factors">
        <div className="flex flex-col gap-md">
          <p className="rounded-md border border-border bg-surface-secondary/40 p-sm text-xs text-muted-foreground">Rule-based aggregate of active-tenant ratio, setup completion, subscription health, support load, usage-limit risk and platform configuration. Not a predictive or AI score.</p>
          {factors.map((f) => (
            <div key={f.key} className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-sm"><span className="font-medium text-foreground">{f.label}</span><span className={toneClasses[f.tone].text}>{f.displayValue}</span></div>
              <MiniBar percent={f.score} toneClassName={toneClasses[f.tone].dot} />
            </div>
          ))}
        </div>
      </DetailDrawer>
    </div>
  );
}
