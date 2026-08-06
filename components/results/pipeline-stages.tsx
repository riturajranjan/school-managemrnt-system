import { CheckCircle2 } from "lucide-react";
import type { PipelineStage } from "@/lib/selectors/results-pipeline";
import { cn } from "@/lib/utils";

const dotTone: Record<PipelineStage["status"], string> = {
  complete: "bg-success",
  "in-progress": "bg-warning",
  "not-started": "bg-border",
  blocked: "bg-error",
};

/** Compact segmented strip used inside a row/card — a scannable "how far along" read
 * without repeating full stage labels for every exam. */
export function PipelineStrip({ stages, className }: { stages: PipelineStage[]; className?: string }) {
  return (
    <div className={cn("flex items-center gap-1", className)} role="img" aria-label={`Pipeline: ${stages.map((s) => `${s.label} ${s.status}`).join(", ")}`}>
      {stages.map((stage) => (
        <span key={stage.key} title={`${stage.label}: ${stage.status.replace("-", " ")}`} className={cn("h-1.5 flex-1 rounded-full", dotTone[stage.status])} />
      ))}
    </div>
  );
}

/** Full labeled pipeline used on the per-exam results page — kept as a shared
 * component so the Results hub and per-exam page present one consistent identity. */
export function PipelineStages({ stages, className }: { stages: PipelineStage[]; className?: string }) {
  return (
    <div className={cn("scrollbar-none flex items-center gap-1 overflow-x-auto rounded-lg border border-border bg-surface p-sm", className)}>
      {stages.map((stage, i) => (
        <div key={stage.key} className="flex shrink-0 items-center gap-1">
          <div
            className={cn(
              "flex items-center gap-1.5 rounded-pill px-sm py-1.5 text-xs font-medium",
              stage.status === "complete" ? "bg-success/12 text-success" : stage.status === "in-progress" ? "bg-warning/12 text-warning" : "bg-surface-secondary text-muted-foreground",
            )}
          >
            {stage.status === "complete" ? <CheckCircle2 className="size-3.5" /> : <span className="flex size-3.5 items-center justify-center rounded-pill border border-current text-[9px]">{i + 1}</span>}
            {stage.label}
          </div>
          {i < stages.length - 1 && <span className="h-px w-3 shrink-0 bg-border" aria-hidden="true" />}
        </div>
      ))}
    </div>
  );
}
