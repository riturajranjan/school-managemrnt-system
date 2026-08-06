import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

/** Numeric + percentage + a compact progress bar, escalating to a warning tone at 90%
 * and a full-state alert at 100% — used anywhere class/section capacity is shown so the
 * signal is consistent across the class list, cards, and workspace. */
export function CapacityBar({ enrolled, capacity, compact = false }: { enrolled: number; capacity: number; compact?: boolean }) {
  const percent = capacity === 0 ? 0 : Math.round((enrolled / capacity) * 100);
  const isFull = capacity > 0 && enrolled >= capacity;
  const isWarning = !isFull && percent >= 90;

  return (
    <div className={cn("flex flex-col gap-0.5", compact ? "w-24" : "w-full")}>
      <div className="flex items-center justify-between gap-1">
        <span className={cn("text-xs font-medium", isFull ? "text-error" : isWarning ? "text-warning" : "text-foreground")}>
          {enrolled}/{capacity}
        </span>
        <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
          {isFull && <AlertTriangle className="size-2.5 text-error" aria-hidden="true" />}
          {percent}%
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-pill bg-surface-secondary" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={`Capacity ${enrolled} of ${capacity}`}>
        <div
          className={cn("h-full rounded-pill transition-[width]", isFull ? "bg-error" : isWarning ? "bg-warning" : "bg-primary")}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
    </div>
  );
}
