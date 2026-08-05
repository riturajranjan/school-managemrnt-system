"use client";

import { motion, useReducedMotion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { admissionStageDefinitions, forwardStageOrder, type AdmissionStageKey } from "@/lib/types/admissions";
import { cn } from "@/lib/utils";
import { stageTone } from "./stage-meta";
import { toneClasses } from "@/components/dashboard/tone";

export function PipelineBoard({
  counts,
  selectedStage,
  onSelectStage,
}: {
  counts: Record<AdmissionStageKey, number>;
  selectedStage: AdmissionStageKey | null;
  onSelectStage: (stage: AdmissionStageKey | null) => void;
}) {
  const reduceMotion = useReducedMotion();
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0) || 1;

  return (
    <div
      role="tablist"
      aria-label="Admission pipeline stages"
      className="scrollbar-none -mx-1 flex snap-x snap-mandatory gap-sm overflow-x-auto px-1 pb-1 sm:mx-0 sm:snap-none sm:flex-wrap sm:px-0"
    >
      {admissionStageDefinitions.map((stage, index) => {
        const count = counts[stage.key] ?? 0;
        const isSelected = selectedStage === stage.key;
        const isForward = forwardStageOrder.includes(stage.key);
        const forwardIndex = forwardStageOrder.indexOf(stage.key);
        const previousCount = isForward && forwardIndex > 0 ? counts[forwardStageOrder[forwardIndex - 1]] ?? 0 : 0;
        const isDropOff = isForward && forwardIndex > 0 && previousCount > 0 && count < previousCount * 0.5;
        const tone = stageTone[stage.key];

        return (
          <button
            key={stage.key}
            role="tab"
            aria-selected={isSelected}
            type="button"
            onClick={() => onSelectStage(isSelected ? null : stage.key)}
            className={cn(
              "surface-3d relative flex min-h-[44px] w-36 shrink-0 snap-start flex-col gap-1 rounded-lg border bg-surface px-sm py-sm text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring sm:w-auto sm:min-w-[9.5rem] sm:flex-1",
              isSelected ? "border-accent/60" : "border-border hover:border-border",
            )}
            style={{ zIndex: index }}
          >
            {isSelected && (
              <motion.span
                layoutId="pipeline-active-highlight"
                className="pointer-events-none absolute inset-0 rounded-lg ring-2 ring-accent/70"
                transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
            <motion.div
              animate={isSelected ? { y: reduceMotion ? 0 : -3 } : { y: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.16, ease: "easeOut" }}
              className="flex flex-col gap-1"
            >
              <div className="flex items-center justify-between gap-1">
                <span className="truncate text-xs font-medium text-muted-foreground">{stage.label}</span>
                {isDropOff && (
                  <span title="Notable drop-off from the previous stage">
                    <AlertTriangle className="size-3 shrink-0 text-warning" aria-hidden="true" />
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold text-foreground">{count}</span>
                <span className="text-[10px] text-muted-foreground">{Math.round((count / total) * 100)}%</span>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-pill bg-surface-secondary">
                <div className={cn("h-full rounded-pill", toneClasses[tone].dot)} style={{ width: `${Math.max(4, (count / total) * 100)}%` }} />
              </div>
            </motion.div>
          </button>
        );
      })}
    </div>
  );
}
