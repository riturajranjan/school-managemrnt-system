import type { ReactNode } from "react";
import { paperAspect, type PaperSize } from "@/lib/types/documents";
import { cn } from "@/lib/utils";

/** A print-aware preview surface. Holds the EXACT paper/card aspect ratio and
 * commits to a white "paper" look regardless of the app theme — print documents
 * are never auto-inverted in dark mode. The frame scales to its container width
 * while preserving the ratio; children render at a fixed base font that scales
 * with the container via the padding/relative sizing chosen by callers. */
export function PaperFrame({ size, children, className, maxWidth = 640 }: { size: PaperSize; children: ReactNode; className?: string; maxWidth?: number }) {
  const ratio = paperAspect[size];
  return (
    <div className={cn("mx-auto w-full", className)} style={{ maxWidth }}>
      <div
        className="relative w-full overflow-hidden rounded-md bg-white text-neutral-900 shadow-lg ring-1 ring-black/10"
        style={{ aspectRatio: String(ratio) }}
      >
        {children}
      </div>
    </div>
  );
}
