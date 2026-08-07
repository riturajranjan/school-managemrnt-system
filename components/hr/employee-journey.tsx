"use client";

import { motion, useReducedMotion } from "framer-motion";
import { employeeStageLabels, type EmployeeStage } from "@/lib/types/hr";

const STAGES: EmployeeStage[] = ["candidate", "joined", "probation", "confirmed", "growth", "promotion", "transfer", "exit"];

/** Dimensional horizontal journey of raised nodes connected by a track. Pure
 * CSS/SVG + Framer Motion; no WebGL. The current stage is highlighted; passed
 * stages are filled, future stages muted. Scrolls horizontally on mobile. */
export function EmployeeJourney({ current }: { current: EmployeeStage }) {
  const reduce = useReducedMotion();
  const currentIndex = STAGES.indexOf(current);
  // Exit is a terminal branch; skip it unless the employee is actually exiting.
  const visible = current === "exit" ? STAGES : STAGES.filter((s) => s !== "exit");

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-max items-center gap-1 px-1">
        {visible.map((stage, i) => {
          const stageIndex = STAGES.indexOf(stage);
          const passed = stageIndex < currentIndex;
          const isCurrent = stage === current;
          return (
            <div key={stage} className="flex items-center gap-1">
              <motion.div
                initial={reduce ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: reduce ? 0 : i * 0.04, duration: 0.25 }}
                className="flex flex-col items-center gap-1"
              >
                <span
                  className={`flex size-9 items-center justify-center rounded-xl text-[11px] font-bold shadow-card transition-transform ${
                    isCurrent ? "-translate-y-0.5 bg-primary text-primary-foreground ring-2 ring-primary/30" : passed ? "bg-primary/15 text-primary" : "bg-surface-secondary text-muted-foreground"
                  }`}
                  style={isCurrent ? undefined : undefined}
                >
                  {stageIndex + 1}
                </span>
                <span className={`whitespace-nowrap text-[10px] font-medium ${isCurrent ? "text-foreground" : "text-muted-foreground"}`}>{employeeStageLabels[stage]}</span>
              </motion.div>
              {i < visible.length - 1 && <span className={`h-0.5 w-6 rounded-pill ${stageIndex < currentIndex ? "bg-primary/50" : "bg-border"}`} aria-hidden="true" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
