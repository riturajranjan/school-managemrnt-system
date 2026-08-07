"use client";

import { computeBounds, projectToViewport, vehicleLiveStateLabels, type VehicleLiveState } from "@/lib/selectors/live-tracking";
import { cn } from "@/lib/utils";

export type LiveMapVehicle = { vehicleId: string; registrationNumber: string; latitude: number; longitude: number; liveState: VehicleLiveState };
export type LiveMapStop = { stopId: string; name: string; latitude: number; longitude: number };

// References the same theme-aware CSS custom properties as the rest of the
// app (see app/globals.css) rather than fixed hex, so markers keep correct
// contrast in both light and dark mode instead of a light-mode-only palette.
const stateColor: Record<VehicleLiveState, string> = {
  "not-started": "var(--muted-foreground)",
  boarding: "var(--warning)",
  "in-transit": "var(--success)",
  "at-stop": "var(--info)",
  delayed: "var(--warning)",
  "off-route": "var(--error)",
  breakdown: "var(--error)",
  emergency: "var(--error)",
  completed: "var(--muted-foreground)",
  "gps-offline": "var(--muted-foreground)",
  cancelled: "var(--muted-foreground)",
};

/** A lightweight, self-contained SVG scatter-map — not a tile-based map,
 * since this demo has no map-tile provider or API key configured. Every
 * marker position is a real projected lat/long, and every state color is
 * data-driven, not decorative. */
export function LiveMap({ vehicles, stops, selectedVehicleId, onSelectVehicle }: { vehicles: LiveMapVehicle[]; stops: LiveMapStop[]; selectedVehicleId?: string; onSelectVehicle?: (vehicleId: string) => void }) {
  const allPoints = [...vehicles.map((v) => ({ latitude: v.latitude, longitude: v.longitude })), ...stops.map((s) => ({ latitude: s.latitude, longitude: s.longitude }))];
  const bounds = computeBounds(allPoints);

  return (
    <svg viewBox="0 0 100 100" className="h-full w-full rounded-lg bg-surface-secondary" role="img" aria-label="Live fleet map">
      <rect x={0} y={0} width={100} height={100} className="fill-surface-secondary" />
      {stops.map((stop) => {
        const { x, y } = projectToViewport(stop.latitude, stop.longitude, bounds);
        return (
          <g key={stop.stopId}>
            <circle cx={x} cy={y} r={0.9} className="fill-muted-foreground/50" />
          </g>
        );
      })}
      {vehicles.map((vehicle) => {
        const { x, y } = projectToViewport(vehicle.latitude, vehicle.longitude, bounds);
        const isSelected = vehicle.vehicleId === selectedVehicleId;
        return (
          <g
            key={vehicle.vehicleId}
            onClick={() => onSelectVehicle?.(vehicle.vehicleId)}
            onKeyDown={(e) => {
              if (!onSelectVehicle) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelectVehicle(vehicle.vehicleId);
              }
            }}
            className={cn("cursor-pointer", onSelectVehicle && "outline-none focus-visible:opacity-80")}
            role={onSelectVehicle ? "button" : undefined}
            tabIndex={onSelectVehicle ? 0 : undefined}
            aria-label={`${vehicle.registrationNumber} — ${vehicleLiveStateLabels[vehicle.liveState]}`}
          >
            {isSelected && <circle cx={x} cy={y} r={3.2} fill="none" stroke={stateColor[vehicle.liveState]} strokeWidth={0.4} opacity={0.5} />}
            <circle cx={x} cy={y} r={1.8} fill={stateColor[vehicle.liveState]} stroke="var(--surface-secondary)" strokeWidth={0.3} />
          </g>
        );
      })}
    </svg>
  );
}
