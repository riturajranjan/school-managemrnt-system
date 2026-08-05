"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Badge } from "@/components/ui/badge";
import { useInView } from "@/lib/hooks/use-in-view";
import { progressStatusLabels, progressStatusTone, type CurriculumUnit, type ProgressStatus } from "@/lib/types/academics";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

const nodeFill: Record<ProgressStatus, string> = {
  completed: "bg-success text-success-foreground",
  "in-progress": "bg-info text-info-foreground",
  planned: "bg-surface-secondary text-muted-foreground",
  "not-started": "bg-surface-secondary text-muted-foreground",
  delayed: "bg-error text-error-foreground",
  skipped: "bg-surface-secondary text-muted-foreground line-through",
  "needs-review": "bg-warning text-warning-foreground",
};

const lineTone: Record<ProgressStatus, string> = {
  completed: "bg-success",
  "in-progress": "bg-info",
  planned: "bg-border",
  "not-started": "bg-border",
  delayed: "bg-error",
  skipped: "bg-border",
  "needs-review": "bg-warning",
};

export function LearningPathTimeline({ units }: { units: CurriculumUnit[] }) {
  const reduceMotion = useReducedMotion();
  const { ref, inView } = useInView<HTMLDivElement>();
  const [selected, setSelected] = useState<CurriculumUnit | null>(null);
  const sorted = [...units].sort((a, b) => a.sequence - b.sequence);

  if (sorted.length === 0) {
    return <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">No curriculum units tracked yet.</p>;
  }

  return (
    <div ref={ref} className="flex flex-col gap-sm">
      <div className="scrollbar-none flex items-start gap-0 overflow-x-auto pb-sm">
        {sorted.map((unit, index) => (
          <div key={unit.id} className="flex shrink-0 items-center">
            {index > 0 && <div className={cn("h-1 w-6 sm:w-10", lineTone[sorted[index - 1].status])} aria-hidden="true" />}
            <motion.button
              type="button"
              onClick={() => setSelected(unit)}
              initial={!reduceMotion && inView ? { opacity: 0, y: 8 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: reduceMotion ? 0 : index * 0.04 }}
              className="flex w-28 shrink-0 flex-col items-center gap-1 rounded-lg px-1 py-2 text-center outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-32"
            >
              <span className={cn("flex size-10 items-center justify-center rounded-pill text-xs font-bold shadow-card sm:size-12", nodeFill[unit.status])}>
                {unit.sequence}
              </span>
              <span className="line-clamp-2 text-xs font-medium text-foreground">{unit.title}</span>
              <Badge tone={progressStatusTone[unit.status]} className="text-[10px]">
                {progressStatusLabels[unit.status]}
              </Badge>
            </motion.button>
          </div>
        ))}
      </div>

      <DetailDrawer open={selected !== null} onOpenChange={(open) => !open && setSelected(null)} title={selected?.title ?? ""} description={selected?.description}>
        {selected && (
          <div className="flex flex-col gap-md">
            <div className="grid grid-cols-2 gap-sm text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Planned</p>
                <p className="text-foreground">
                  {formatDate(selected.plannedStart)} – {formatDate(selected.plannedEnd)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Actual completion</p>
                <p className="text-foreground">{selected.actualCompletion ? formatDate(selected.actualCompletion) : "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Periods</p>
                <p className="text-foreground">
                  {selected.completedPeriods} / {selected.estimatedPeriods}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <Badge tone={progressStatusTone[selected.status]}>{progressStatusLabels[selected.status]}</Badge>
              </div>
            </div>

            <div>
              <h3 className="mb-xs text-sm font-semibold text-foreground">Chapters</h3>
              <ol className="flex flex-col gap-sm">
                {selected.chapters.map((chapter) => (
                  <li key={chapter.id} className="rounded-md border border-border p-sm">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-foreground">{chapter.title}</p>
                      <Badge tone={progressStatusTone[chapter.status]}>{progressStatusLabels[chapter.status]}</Badge>
                    </div>
                    {chapter.topics.length > 0 && (
                      <ul className="mt-1 flex flex-col gap-0.5 pl-sm text-xs text-muted-foreground">
                        {chapter.topics.map((topic) => (
                          <li key={topic.id}>· {topic.title}</li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}
