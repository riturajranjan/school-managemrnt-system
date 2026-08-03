"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Building2, Maximize2, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";
import { fetchCampusOverview } from "../data/mock-data";
import { useWidgetData } from "../use-widget-data";
import { WidgetShell } from "../widget-shell";
import type { CampusZone } from "../data/types";

// The interactive CSS-3D stage is dynamically imported (client-only, no SSR)
// so it never ships on first paint — only once the user opts into "Expand".
const CampusStage3D = dynamic(() => import("./campus-stage-3d").then((m) => m.CampusStage3D), {
  ssr: false,
  loading: () => (
    <div className="skeleton flex h-72 items-center justify-center rounded-lg text-sm text-muted-foreground sm:h-80">
      Loading 3D view…
    </div>
  ),
});

const PREVIEW_FILL: Record<CampusZone["status"], string> = {
  normal: "bg-surface-secondary text-foreground",
  busy: "bg-info/15 text-info",
  alert: "bg-error/15 text-error",
};

export function CampusOverview3DWidget() {
  const state = useWidgetData(fetchCampusOverview);
  const [expanded, setExpanded] = useState(false);
  const reduceMotion = useReducedMotion();

  return (
    <>
      <WidgetShell
        title="3D Campus Overview"
        icon={Building2}
        status={state.status}
        error={state.status === "error" ? state.error : undefined}
        onRetry={state.retry}
        isEmpty={state.status === "ready" && state.data.zones.length === 0}
        emptyMessage="No campus zones configured yet."
        action={
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="flex items-center gap-xs rounded-md px-sm py-1 text-xs font-medium text-primary outline-none transition-colors hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Maximize2 className="size-3.5" aria-hidden="true" />
            Expand
          </button>
        }
      >
        {state.status === "ready" && (
          <div className="flex h-full flex-col gap-sm">
            <div className="flex items-baseline gap-sm">
              <span className="text-2xl font-bold text-foreground">{state.data.occupancyPercent}%</span>
              <span className="text-xs text-muted-foreground">
                campus occupancy · {state.data.activeZones}/{state.data.totalZones} zones active
              </span>
            </div>
            {/* Lightweight flat preview — no 3D transforms, cheap to render on first paint. */}
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="grid flex-1 grid-cols-3 gap-1.5 rounded-md p-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Expand 3D campus view"
            >
              {state.data.zones.map((zone) => (
                <div
                  key={zone.id}
                  style={{ gridColumnStart: zone.col + 1, gridRowStart: zone.row + 1 }}
                  className={`flex flex-col items-center justify-center gap-0.5 rounded-md px-1 py-sm text-center ${PREVIEW_FILL[zone.status]}`}
                >
                  <span className="truncate text-[10px] font-medium leading-tight">{zone.name}</span>
                  <span className="text-xs font-bold">{zone.occupancyPercent}%</span>
                </div>
              ))}
            </button>
          </div>
        )}
      </WidgetShell>

      <Dialog.Root open={expanded} onOpenChange={setExpanded}>
        <AnimatePresence>
          {expanded && (
            <Dialog.Portal forceMount>
              <Dialog.Overlay asChild>
                <motion.div
                  className="fixed inset-0 z-50 bg-black/50"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reduceMotion ? 0 : 0.15 }}
                />
              </Dialog.Overlay>
              <Dialog.Content asChild forceMount>
                <motion.div
                  className="glass fixed inset-x-0 top-1/2 z-50 mx-auto w-[calc(100%_-_2rem)] max-w-[40rem] -translate-y-1/2 overflow-hidden rounded-lg shadow-floating"
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: reduceMotion ? 0 : 0.15, ease: "easeOut" }}
                >
                  <div className="flex items-center justify-between border-b border-border px-md py-sm">
                    <Dialog.Title className="text-sm font-semibold text-foreground">3D Campus Overview</Dialog.Title>
                    <Dialog.Close
                      className="flex size-9 items-center justify-center rounded-pill text-muted-foreground outline-none transition-colors hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label="Close"
                    >
                      <X className="size-[18px]" aria-hidden="true" />
                    </Dialog.Close>
                  </div>
                  <Dialog.Description className="sr-only">
                    Interactive 3D view of campus zone occupancy. Drag to rotate.
                  </Dialog.Description>
                  <div className="p-md">
                    {state.status === "ready" && <CampusStage3D zones={state.data.zones} />}
                  </div>
                </motion.div>
              </Dialog.Content>
            </Dialog.Portal>
          )}
        </AnimatePresence>
      </Dialog.Root>
    </>
  );
}
