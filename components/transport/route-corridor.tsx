"use client";

import { AlertTriangle, Bus, School } from "lucide-react";
import { cn } from "@/lib/utils";

export type CorridorStop = { id: string; name: string; status: "pending" | "arrived" | "departed" | "skipped" };

/** The "Live Route Corridor" — a lightweight, data-driven isometric-style
 * visualization of one trip's progress from school to its last stop. Not a
 * geographic map (see LiveMap for that): this is a linear progress
 * corridor, the shape that best answers "how far along is this trip and
 * where's the delay/incident". No requestAnimationFrame loop and no
 * WebGL — the only motion is a single CSS transition on the vehicle
 * marker's position, which browsers already suspend for off-screen
 * elements, and which is disabled outright under prefers-reduced-motion. */
export function RouteCorridor({
  stops,
  hasDelay,
  hasIncident,
  onSelectStop,
  className,
}: {
  stops: CorridorStop[];
  hasDelay?: boolean;
  hasIncident?: boolean;
  onSelectStop?: (stopId: string) => void;
  className?: string;
}) {
  const departedCount = stops.filter((s) => s.status === "departed").length;
  const totalSegments = Math.max(1, stops.length);
  const progressPercent = Math.min(100, (departedCount / totalSegments) * 100);
  const vehiclePositionPercent = stops.length === 0 ? 0 : Math.min(96, (departedCount / totalSegments) * 100);

  return (
    <div className={cn("overflow-x-auto rounded-lg border border-border bg-surface p-md", className)}>
      <div className="relative min-w-[520px] pt-8">
        {/* Vehicle marker, tracks progress along the corridor */}
        <div
          className="absolute top-0 flex -translate-x-1/2 flex-col items-center transition-[left] duration-700 ease-out motion-reduce:transition-none"
          style={{ left: `${vehiclePositionPercent}%` }}
        >
          <span
            className={cn(
              "flex size-7 items-center justify-center rounded-md text-white shadow-[0_3px_6px_rgba(0,0,0,0.25)]",
              hasIncident ? "bg-error" : hasDelay ? "bg-warning" : "bg-primary",
            )}
            style={{ transform: "perspective(200px) rotateX(8deg)" }}
          >
            {hasIncident ? <AlertTriangle className="size-4" /> : <Bus className="size-4" />}
          </span>
          {(hasDelay || hasIncident) && <span className={cn("mt-0.5 rounded-pill px-1.5 py-0.5 text-[10px] font-semibold text-white", hasIncident ? "bg-error" : "bg-warning")}>{hasIncident ? "Incident" : "Delayed"}</span>}
        </div>

        {/* Corridor track */}
        <div className="relative mt-6 h-2 rounded-full bg-border">
          <div className="h-full rounded-full bg-primary/70 transition-[width] duration-700 ease-out motion-reduce:transition-none" style={{ width: `${progressPercent}%` }} />
        </div>

        {/* Nodes: school + stops */}
        <div className="mt-3 flex items-center justify-between">
          <div className="flex flex-col items-center gap-1">
            <span className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <School className="size-3.5" />
            </span>
            <span className="max-w-16 truncate text-center text-[10px] text-muted-foreground">School</span>
          </div>
          {stops.map((stop) => (
            <button
              key={stop.id}
              type="button"
              onClick={() => onSelectStop?.(stop.id)}
              className="flex flex-col items-center gap-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span
                className={cn(
                  "size-4 rounded-full border-2",
                  stop.status === "departed" && "border-primary bg-primary",
                  stop.status === "arrived" && "border-warning bg-warning/40",
                  stop.status === "skipped" && "border-error bg-error/20",
                  stop.status === "pending" && "border-border bg-surface",
                )}
              />
              <span className="max-w-16 truncate text-center text-[10px] text-muted-foreground">{stop.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
