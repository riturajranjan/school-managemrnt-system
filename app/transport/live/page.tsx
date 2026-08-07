"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, MapPinned, Phone, RefreshCw, Route, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { LiveMap, type LiveMapStop, type LiveMapVehicle } from "@/components/transport/live-map";
import { useSisStore } from "@/lib/hooks/use-store";
import { simulateNextGpsTick } from "@/lib/services/gps-service";
import { computeVehicleLiveState, isGpsStale, latestGpsPosition, vehicleLiveStateLabels, type VehicleLiveState } from "@/lib/selectors/live-tracking";
import { formatDate } from "@/lib/utils";

const liveStateTone: Record<VehicleLiveState, "success" | "warning" | "error" | "neutral"> = {
  "not-started": "neutral",
  boarding: "warning",
  "in-transit": "success",
  "at-stop": "success",
  delayed: "warning",
  "off-route": "error",
  breakdown: "error",
  emergency: "error",
  completed: "neutral",
  "gps-offline": "neutral",
  cancelled: "neutral",
};

export default function LiveTrackingPage() {
  const db = useSisStore();
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | undefined>();
  const [tick, setTick] = useState(0);

  const today = new Date().toISOString().slice(0, 10);
  const todaysTrips = useMemo(() => db.transportTrips.filter((t) => t.date === today), [db.transportTrips, today]);

  const vehicleRows = useMemo(
    () =>
      todaysTrips.map((trip) => {
        const vehicle = db.vehicles.find((v) => v.id === trip.vehicleId);
        const route = db.transportRoutes.find((r) => r.id === trip.routeId);
        const position = latestGpsPosition(db, trip.vehicleId);
        const liveState = computeVehicleLiveState(db, trip);
        return { trip, vehicle, route, position, liveState };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [todaysTrips, db, tick],
  );

  const mapVehicles: LiveMapVehicle[] = vehicleRows
    .filter((r) => r.position && r.vehicle)
    .map((r) => ({ vehicleId: r.vehicle!.id, registrationNumber: r.vehicle!.registrationNumber, latitude: r.position!.latitude, longitude: r.position!.longitude, liveState: r.liveState }));
  const mapStops: LiveMapStop[] = db.transportStops.map((s) => ({ stopId: s.id, name: s.name, latitude: s.latitude, longitude: s.longitude }));

  const selected = vehicleRows.find((r) => r.vehicle?.id === selectedVehicleId);
  const delayedCount = vehicleRows.filter((r) => r.liveState === "delayed" || r.liveState === "off-route").length;
  const offlineCount = vehicleRows.filter((r) => r.liveState === "gps-offline").length;

  return (
    <div className="flex h-full flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Live tracking</h1>
          <p className="text-xs text-muted-foreground">{formatDate(today)} · {vehicleRows.length} trip(s) today</p>
        </div>
        <div className="flex items-center gap-xs">
          {(delayedCount > 0 || offlineCount > 0) && (
            <span className="flex items-center gap-1 text-xs text-warning">
              <AlertTriangle className="size-3.5" />
              {delayedCount + offlineCount} need attention
            </span>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              simulateNextGpsTick({ name: "Dispatcher", role: "Dispatcher" });
              setTick((t) => t + 1);
            }}
          >
            <RefreshCw className="size-3.5" />
            Simulate GPS update
          </Button>
        </div>
      </div>

      <div className="grid flex-1 grid-cols-1 gap-md lg:grid-cols-3">
        <div className="order-1 h-64 lg:order-1 lg:col-span-2 lg:h-full lg:min-h-[420px]">
          <LiveMap vehicles={mapVehicles} stops={mapStops} selectedVehicleId={selectedVehicleId} onSelectVehicle={setSelectedVehicleId} />
        </div>

        <div className="order-2 flex flex-col gap-xs lg:order-2 lg:col-span-1">
          {vehicleRows.length === 0 ? (
            <div className="flex flex-col items-center gap-xs rounded-lg border border-dashed border-border p-lg text-center">
              <MapPinned className="size-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No trips scheduled for today.</p>
            </div>
          ) : (
            vehicleRows.map((row) => {
              const stale = row.position ? isGpsStale(row.position.recordedAt) : true;
              return (
                <button
                  key={row.trip.id}
                  type="button"
                  onClick={() => setSelectedVehicleId(row.vehicle?.id)}
                  className={`surface-3d flex items-center justify-between gap-xs rounded-lg border p-sm text-left transition-colors ${selectedVehicleId === row.vehicle?.id ? "border-primary/60 bg-primary/5" : "border-border bg-surface"}`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{row.vehicle?.registrationNumber ?? "—"}</p>
                    <p className="truncate text-xs text-muted-foreground">{row.route?.name ?? row.trip.routeId}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-0.5">
                    <Badge tone={liveStateTone[row.liveState]}>{vehicleLiveStateLabels[row.liveState]}</Badge>
                    {row.position && <span className="text-[10px] text-muted-foreground">{stale ? "Stale" : `${row.position.speedKmh} km/h`}</span>}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      <DetailDrawer open={!!selected} onOpenChange={(open) => !open && setSelectedVehicleId(undefined)} title={selected?.vehicle?.registrationNumber ?? ""} description={selected?.route?.name}>
        {selected && (
          <div className="flex flex-col gap-md">
            <div className="flex items-center justify-between">
              <Badge tone={liveStateTone[selected.liveState]}>{vehicleLiveStateLabels[selected.liveState]}</Badge>
              <span className="text-xs text-muted-foreground">{selected.position ? `Updated ${formatDate(selected.position.recordedAt)} · ${isGpsStale(selected.position.recordedAt) ? "stale" : "live"}` : "No GPS signal"}</span>
            </div>

            <div className="grid grid-cols-2 gap-sm text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Students onboard</p>
                <p className="font-medium text-foreground">
                  {selected.trip.studentsBoarded}/{selected.trip.studentsExpected}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Speed</p>
                <p className="font-medium text-foreground">{selected.position ? `${selected.position.speedKmh} km/h` : "—"}</p>
              </div>
            </div>

            <div className="flex flex-col gap-xs">
              <Link href={`/transport/trips/${selected.trip.id}`} className="flex items-center gap-1.5 text-sm text-primary underline-offset-2 hover:underline">
                <Route className="size-3.5" /> View full trip
              </Link>
              <Link href={`/transport/vehicles/${selected.vehicle?.id}`} className="flex items-center gap-1.5 text-sm text-primary underline-offset-2 hover:underline">
                <Users className="size-3.5" /> View vehicle & students
              </Link>
              {selected.trip.driverId && (
                <a href={`tel:${db.drivers.find((d) => d.id === selected.trip.driverId)?.phone ?? ""}`} className="flex items-center gap-1.5 text-sm text-primary underline-offset-2 hover:underline">
                  <Phone className="size-3.5" /> Call driver
                </a>
              )}
            </div>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}
