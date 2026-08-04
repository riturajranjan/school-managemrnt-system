"use client";

import { motion, useMotionValue, useReducedMotion } from "framer-motion";
import { RotateCcw } from "lucide-react";
import type { CampusZone } from "../data/types";

const CELL_SIZE = 88;

const STATUS_FILL: Record<CampusZone["status"], string> = {
  normal: "bg-surface-secondary border-border",
  busy: "bg-info/20 border-info/40",
  alert: "bg-error/20 border-error/40",
};

const STATUS_EDGE: Record<CampusZone["status"], string> = {
  normal: "border-b-muted-foreground/30",
  busy: "border-b-info/50",
  alert: "border-b-error/50",
};

// The heavy piece: real CSS 3D (perspective + rotateX + per-block translateZ),
// drag-to-rotate. Deferred behind next/dynamic + the preview/expand toggle in
// campus-overview-3d.tsx so it never loads on first paint.
export function CampusStage3D({ zones }: { zones: CampusZone[] }) {
  const rotateZ = useMotionValue(-8);
  const reduceMotion = useReducedMotion();
  const maxCol = Math.max(...zones.map((z) => z.col));
  const maxRow = Math.max(...zones.map((z) => z.row));
  const stageWidth = (maxCol + 1) * CELL_SIZE;
  const stageHeight = (maxRow + 1) * CELL_SIZE;

  return (
    <div className="flex flex-col gap-sm">
      <div
        className="relative flex h-72 items-center justify-center overflow-hidden rounded-lg bg-surface-secondary/40 sm:h-80"
        style={{ perspective: 1400 }}
      >
        <motion.div
          drag={reduceMotion ? false : "x"}
          dragElastic={0}
          dragMomentum={false}
          onPan={(_, info) => rotateZ.set(rotateZ.get() + info.delta.x * 0.3)}
          className="relative cursor-grab touch-none active:cursor-grabbing"
          style={{
            width: stageWidth,
            height: stageHeight,
            transformStyle: "preserve-3d",
            rotateX: 55,
            rotateZ,
          }}
        >
          {/* Ground plane */}
          <div
            className="absolute rounded-md border border-border bg-surface"
            style={{ width: stageWidth, height: stageHeight, transform: "translateZ(0px)" }}
          />
          {zones.map((zone) => (
            <div
              key={zone.id}
              className="absolute flex flex-col items-center justify-center"
              style={{
                width: CELL_SIZE - 10,
                height: CELL_SIZE - 10,
                left: zone.col * CELL_SIZE + 5,
                top: zone.row * CELL_SIZE + 5,
                transform: `translateZ(${zone.height}px)`,
                transformStyle: "preserve-3d",
              }}
            >
              <div
                className={`flex size-full flex-col items-center justify-center gap-0.5 rounded-md border-2 border-b-[6px] text-center shadow-[0_10px_18px_-6px_rgba(2,10,20,0.45)] ${STATUS_FILL[zone.status]} ${STATUS_EDGE[zone.status]}`}
              >
                <span className="px-1 text-xs font-semibold leading-tight text-foreground">{zone.name}</span>
                <span className="text-xs font-bold text-foreground">{zone.occupancyPercent}%</span>
              </div>
            </div>
          ))}
        </motion.div>

        <button
          type="button"
          onClick={() => rotateZ.set(-8)}
          className="absolute bottom-sm right-sm flex min-h-11 items-center gap-xs rounded-pill border border-border bg-surface px-sm text-xs font-medium text-muted-foreground outline-none transition-colors active:scale-[0.97] hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-ring sm:min-h-0 sm:py-1"
        >
          <RotateCcw className="size-3.5" aria-hidden="true" />
          Reset view
        </button>
      </div>
      <p className="text-center text-xs text-muted-foreground">Drag to rotate</p>
    </div>
  );
}
