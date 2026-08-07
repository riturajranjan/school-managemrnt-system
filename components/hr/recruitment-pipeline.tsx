"use client";

import { motion, useReducedMotion } from "framer-motion";
import { CANDIDATE_PIPELINE, candidateStageLabels, type CandidateStage } from "@/lib/types/hr";

/** Dimensional recruitment funnel — layered stage cards with a subtle depth
 * gradient. On mobile it scrolls horizontally (swipe-safe). */
export function RecruitmentPipeline({ counts, onSelect, activeStage }: { counts: Record<CandidateStage, number>; onSelect?: (stage: CandidateStage) => void; activeStage?: CandidateStage }) {
  const reduce = useReducedMotion();
  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex min-w-max items-stretch gap-2">
        {CANDIDATE_PIPELINE.map((stage, i) => {
          const active = activeStage === stage;
          return (
            <motion.button
              key={stage}
              type="button"
              onClick={() => onSelect?.(stage)}
              initial={reduce ? false : { opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: reduce ? 0 : i * 0.05, duration: 0.25 }}
              className={`surface-3d flex min-w-[104px] flex-col gap-1 rounded-lg border p-sm text-left outline-none transition-transform focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:-translate-y-0.5 ${
                active ? "border-primary bg-primary/5" : "border-border bg-surface"
              }`}
              style={{ background: active ? undefined : `linear-gradient(160deg, var(--color-surface), color-mix(in srgb, var(--color-primary) ${i * 2}%, var(--color-surface)))` }}
            >
              <span className="text-[11px] font-medium text-muted-foreground">{candidateStageLabels[stage]}</span>
              <span className="text-xl font-bold text-foreground">{counts[stage] ?? 0}</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
