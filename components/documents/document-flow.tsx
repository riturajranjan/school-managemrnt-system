"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Archive, CheckCircle2, FileCheck2, FileText, Layers, Printer, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { flowStageLabels, flowStageOrder, type FlowStage } from "@/lib/types/documents";
import { cn } from "@/lib/utils";

const STAGE_ICONS: Record<FlowStage, LucideIcon> = {
  source: Layers, template: FileText, preview: FileCheck2, generate: Sparkles, verify: CheckCircle2, print: Printer, archive: Archive,
};

/** Document Flow — a layered, dimensional pipeline. Clicking a stage filters the
 * dashboard (active stage highlighted). Framer Motion adds a subtle staged
 * entrance; respects reduced motion. Purely CSS/SVG depth — no WebGL. */
export function DocumentFlow({ counts, active, onSelect }: { counts: Record<FlowStage, number>; active?: FlowStage | null; onSelect?: (stage: FlowStage) => void }) {
  const reduce = useReducedMotion();
  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-max items-stretch gap-1 p-1" role="list" aria-label="Document flow stages">
        {flowStageOrder.map((stage, i) => {
          const Icon = STAGE_ICONS[stage];
          const isActive = active === stage;
          return (
            <div key={stage} className="flex items-center gap-1" role="listitem">
              <motion.button
                type="button"
                onClick={() => onSelect?.(stage)}
                aria-pressed={isActive}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
                animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
                transition={{ delay: reduce ? 0 : i * 0.05, duration: 0.3 }}
                className={cn(
                  "group relative flex w-24 flex-col items-center gap-1 rounded-lg border p-2 text-center transition sm:w-28",
                  isActive ? "border-primary bg-primary/10 shadow-md" : "border-border bg-surface hover:border-primary/40 hover:shadow-sm",
                )}
              >
                {/* Layered dimensional stack behind the node */}
                <span aria-hidden className="pointer-events-none absolute inset-x-2 -bottom-1 h-2 rounded-b-lg bg-border/50" />
                <span aria-hidden className="pointer-events-none absolute inset-x-3 -bottom-2 h-2 rounded-b-lg bg-border/30" />
                <span className={cn("flex size-8 items-center justify-center rounded-md", isActive ? "bg-primary text-primary-foreground" : "bg-surface-secondary text-muted-foreground group-hover:text-foreground")}>
                  <Icon className="size-4" />
                </span>
                <span className="text-[11px] font-medium leading-tight text-foreground">{flowStageLabels[stage]}</span>
                <span className="text-sm font-bold tabular-nums text-foreground">{counts[stage]}</span>
              </motion.button>
              {i < flowStageOrder.length - 1 && (
                <svg width="20" height="24" viewBox="0 0 20 24" className="shrink-0 text-border" aria-hidden>
                  <path d="M2 12 H14" stroke="currentColor" strokeWidth="2" fill="none" strokeDasharray="3 3" />
                  <path d="M12 7 L17 12 L12 17" stroke="currentColor" strokeWidth="2" fill="none" />
                </svg>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
