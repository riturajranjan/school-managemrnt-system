"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import { lifecycleLabels, lifecycleOrder, type TenantLifecycleStage } from "@/lib/types/saas";
import { cn } from "@/lib/utils";

const ALT: TenantLifecycleStage[] = ["payment-issue", "suspended", "churned"];

/** Tenant lifecycle as a connected, dimensional pipeline. Clicking a stage
 * calls onSelect. If the current stage is an alternative (payment-issue etc.)
 * it's shown as a highlighted off-track node. */
export function TenantJourney({ current, onSelect }: { current: TenantLifecycleStage; onSelect?: (s: TenantLifecycleStage) => void }) {
  const reduce = useReducedMotion();
  const isAlt = ALT.includes(current);
  const idx = lifecycleOrder.indexOf(current);
  return (
    <div className="flex flex-col gap-sm">
      <div className="overflow-x-auto">
        <div className="flex min-w-max items-center gap-1 p-1">
          {lifecycleOrder.map((s, i) => {
            const done = !isAlt && i < idx;
            const active = !isAlt && i === idx;
            return (
              <div key={s} className="flex items-center gap-1">
                <motion.button
                  type="button" onClick={() => onSelect?.(s)}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }} animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }} transition={{ delay: reduce ? 0 : i * 0.04 }}
                  className={cn("relative flex w-20 flex-col items-center gap-1 rounded-lg border p-2 text-center transition sm:w-24", active ? "border-primary bg-primary/10 shadow-md" : done ? "border-success/40 bg-success/5" : "border-border bg-surface hover:border-primary/40")}
                >
                  <span aria-hidden className="pointer-events-none absolute inset-x-2 -bottom-1 h-1.5 rounded-b-lg bg-border/40" />
                  <span className={cn("flex size-6 items-center justify-center rounded-full text-[11px] font-bold", done ? "bg-success text-white" : active ? "bg-primary text-primary-foreground" : "bg-surface-secondary text-muted-foreground")}>{done ? <Check className="size-3" /> : i + 1}</span>
                  <span className="text-[11px] font-medium leading-tight text-foreground">{lifecycleLabels[s]}</span>
                </motion.button>
                {i < lifecycleOrder.length - 1 && <svg width="14" height="18" viewBox="0 0 14 18" className="shrink-0 text-border" aria-hidden><path d="M1 9 H8" stroke="currentColor" strokeWidth="2" strokeDasharray="3 3" /><path d="M7 5 L11 9 L7 13" stroke="currentColor" strokeWidth="2" fill="none" /></svg>}
              </div>
            );
          })}
        </div>
      </div>
      {isAlt && (
        <div className="flex items-center gap-2 rounded-md border border-error/30 bg-error/8 p-sm text-sm text-error">
          <span className="flex size-6 items-center justify-center rounded-full bg-error text-[11px] font-bold text-white">!</span>
          This tenant is off the standard path — current stage: <span className="font-semibold">{lifecycleLabels[current]}</span>
        </div>
      )}
    </div>
  );
}
