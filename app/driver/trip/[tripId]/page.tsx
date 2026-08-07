"use client";

import Link from "next/link";
import { use, useState } from "react";
import { AlertOctagon, CheckCircle2, MapPin, Phone, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RouteCorridor } from "@/components/transport/route-corridor";
import { useCurrentDriver } from "@/lib/hooks/use-transport";
import { useSisStore } from "@/lib/hooks/use-store";
import { markTripStopStatus, setTripStatus } from "@/lib/services/trip-service";
import { updateVehicle } from "@/lib/services/vehicle-service";
import { tripStatusLabels, type TripStatus } from "@/lib/types/transport";

const DISPATCH_PHONE = "+911234567891";

const statusTone: Record<
  TripStatus,
  "success" | "warning" | "error" | "neutral"
> = {
  scheduled: "neutral",
  ready: "neutral",
  boarding: "warning",
  "in-progress": "success",
  delayed: "warning",
  paused: "warning",
  breakdown: "error",
  emergency: "error",
  completed: "success",
  cancelled: "neutral",
};

export default function DriverTripPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = use(params);
  const driver = useCurrentDriver();
  const db = useSisStore();
  const [endOdometer, setEndOdometer] = useState(0);
  const [vehicleIssue, setVehicleIssue] = useState("");
  const [lostItem, setLostItem] = useState("");

  const trip = db.transportTrips.find((t) => t.id === tripId);
  if (!trip || !driver) {
    return (
      <div className="mx-auto flex  flex-col items-center gap-sm py-2xl text-center">
        <p className="text-sm text-muted-foreground">Trip not found.</p>
      </div>
    );
  }

  const actor = { name: driver.name, role: "Driver" };
  const route = db.transportRoutes.find((r) => r.id === trip.routeId);
  const vehicle = db.vehicles.find((v) => v.id === trip.vehicleId);
  const tripStops = db.tripStops
    .filter((s) => s.tripId === trip.id)
    .sort((a, b) => a.sequence - b.sequence);
  const nextStop = tripStops.find(
    (s) => s.status === "pending" || s.status === "arrived",
  );
  const allDeparted =
    tripStops.length > 0 &&
    tripStops.every((s) => s.status === "departed" || s.status === "skipped");
  const stopName = (id: string) =>
    db.transportStops.find((s) => s.id === id)?.name ?? id;

  return (
    <div className="mx-auto flex w-full  flex-col gap-md pb-24 sm:pb-0">
      <div className="flex items-center justify-between gap-xs">
        <div>
          <h1 className="text-lg font-semibold text-foreground">
            {route?.name ?? trip.routeId}
          </h1>
          <p className="text-xs text-muted-foreground">
            {vehicle?.registrationNumber}
          </p>
        </div>
        <Badge tone={statusTone[trip.status]}>
          {tripStatusLabels[trip.status]}
        </Badge>
      </div>

      <RouteCorridor
        stops={tripStops.map((s) => ({
          id: s.id,
          name: stopName(s.stopId),
          status: s.status,
        }))}
        hasDelay={trip.status === "delayed"}
        className="min-w-0"
      />

      {!allDeparted && nextStop ? (
        <div className="surface-3d flex flex-col items-center gap-sm rounded-lg border border-border bg-surface p-lg text-center">
          <MapPin className="size-6 text-primary" />
          <p className="text-xs text-muted-foreground">Next stop</p>
          <p className="text-lg font-semibold text-foreground">
            {stopName(nextStop.stopId)}
          </p>
          <Button
            className="h-14 w-full text-base"
            onClick={() =>
              markTripStopStatus(
                nextStop.id,
                nextStop.status === "pending" ? "arrived" : "departed",
                actor,
              )
            }>
            {nextStop.status === "pending"
              ? "Mark arrived"
              : "Mark departed & continue"}
          </Button>
        </div>
      ) : (
        <div className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <CheckCircle2 className="size-4 text-success" /> All stops complete
            — end trip
          </h2>
          <div>
            <Label htmlFor="end-odometer">Ending odometer (km)</Label>
            <Input
              id="end-odometer"
              type="number"
              min={vehicle?.odometerKm ?? 0}
              value={endOdometer || vehicle?.odometerKm || 0}
              onChange={(e) => setEndOdometer(Number(e.target.value))}
              className="h-12 text-base"
            />
          </div>
          <div>
            <Label htmlFor="vehicle-issue">Vehicle issue (if any)</Label>
            <Input
              id="vehicle-issue"
              value={vehicleIssue}
              onChange={(e) => setVehicleIssue(e.target.value)}
              placeholder="Optional"
            />
          </div>
          <div>
            <Label htmlFor="lost-item">Lost item found (if any)</Label>
            <Input
              id="lost-item"
              value={lostItem}
              onChange={(e) => setLostItem(e.target.value)}
              placeholder="Optional"
            />
          </div>
          <Button
            className="h-12 text-base"
            onClick={() => {
              if (vehicle && endOdometer > 0)
                updateVehicle(vehicle.id, { odometerKm: endOdometer }, actor);
              const note = [
                vehicleIssue && `Vehicle issue: ${vehicleIssue}`,
                lostItem && `Lost item: ${lostItem}`,
              ]
                .filter(Boolean)
                .join(" ");
              setTripStatus(trip.id, "completed", actor, note || undefined);
            }}>
            Complete trip
          </Button>
        </div>
      )}

      <div className="flex items-center gap-1.5 text-sm text-foreground">
        <Users className="size-4 text-muted-foreground" />
        {trip.studentsBoarded}/{trip.studentsExpected} students boarded
      </div>

      <div className="grid grid-cols-2 gap-xs">
        <Button
          variant="destructive"
          onClick={() =>
            setTripStatus(
              trip.id,
              "emergency",
              actor,
              "Emergency declared by driver",
            )
          }>
          <AlertOctagon className="size-3.5" />
          Emergency
        </Button>
        <Button asChild variant="outline">
          <Link href={`/driver/incidents?tripId=${trip.id}`}>Report issue</Link>
        </Button>
      </div>
      <Button asChild variant="ghost" size="sm">
        <a href={`tel:${DISPATCH_PHONE}`}>
          <Phone className="size-3.5" />
          Call dispatcher
        </a>
      </Button>
    </div>
  );
}
