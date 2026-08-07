"use client";

import { Bus, Phone, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RouteCorridor } from "@/components/transport/route-corridor";
import { useStudents } from "@/lib/hooks/use-students";
import { useSisStore } from "@/lib/hooks/use-store";
import {
  computeVehicleLiveState,
  vehicleLiveStateLabels,
} from "@/lib/selectors/live-tracking";
import { pickupStatusLabels, dropStatusLabels } from "@/lib/types/transport";

const TRANSPORT_OFFICE_PHONE = "+911234567890";

export default function StudentTransportPage() {
  const students = useStudents();
  const db = useSisStore();
  const today = new Date().toISOString().slice(0, 10);

  const student = students.find((s) => s.transport);

  if (!student) {
    return (
      <div className="mx-auto flex  flex-col items-center gap-sm py-2xl text-center">
        <Bus className="size-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          You are not registered for school transport.
        </p>
      </div>
    );
  }

  const assignment = db.studentTransportAssignments.find(
    (a) => a.studentId === student.id && a.status === "active",
  );
  const route = db.transportRoutes.find((r) => r.id === assignment?.routeId);
  const vehicle = db.vehicles.find((v) => v.id === route?.assignedVehicleId);
  const driver = db.drivers.find((d) => d.id === route?.primaryDriverId);
  const attendant = db.attendants.find((a) => a.id === route?.attendantId);
  const pickupStop = db.transportStops.find(
    (s) => s.id === assignment?.pickupStopId,
  );
  const dropStop = db.transportStops.find(
    (s) => s.id === assignment?.dropStopId,
  );
  const trip = db.transportTrips.find(
    (t) => t.routeId === route?.id && t.date === today,
  );
  const tripStudent = trip
    ? db.tripStudents.find(
        (ts) => ts.tripId === trip.id && ts.studentId === student.id,
      )
    : undefined;
  const tripStops = trip
    ? db.tripStops
        .filter((s) => s.tripId === trip.id)
        .sort((a, b) => a.sequence - b.sequence)
    : [];
  const liveState = trip ? computeVehicleLiveState(db, trip) : undefined;

  return (
    <div className="mx-auto flex w-full  flex-col gap-md pb-24 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">My transport</h1>
        <p className="text-xs text-muted-foreground">{route?.name ?? "—"}</p>
      </div>

      <div className="surface-3d rounded-lg border border-border bg-surface p-md">
        <div className="mb-sm flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            <Bus className="size-4" /> {vehicle?.registrationNumber ?? "—"}
          </span>
          {liveState && (
            <Badge
              tone={
                liveState === "off-route" ||
                liveState === "breakdown" ||
                liveState === "emergency"
                  ? "error"
                  : liveState === "delayed"
                    ? "warning"
                    : "success"
              }>
              {vehicleLiveStateLabels[liveState]}
            </Badge>
          )}
        </div>
        <dl className="grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Pickup stop</dt>
          <dd className="text-foreground">{pickupStop?.name ?? "—"}</dd>
          <dt className="text-muted-foreground">Pickup time</dt>
          <dd className="text-foreground">
            {student.transport?.pickupTime ?? "—"}
          </dd>
          <dt className="text-muted-foreground">Drop stop</dt>
          <dd className="text-foreground">{dropStop?.name ?? "—"}</dd>
          <dt className="text-muted-foreground">Drop time</dt>
          <dd className="text-foreground">
            {student.transport?.dropTime ?? "—"}
          </dd>
          <dt className="text-muted-foreground">Driver</dt>
          <dd className="text-foreground">{driver?.name ?? "—"}</dd>
          <dt className="text-muted-foreground">Attendant</dt>
          <dd className="text-foreground">{attendant?.name ?? "—"}</dd>
        </dl>
      </div>

      {trip && tripStops.length > 0 && (
        <RouteCorridor
          stops={tripStops.map((s) => ({
            id: s.id,
            name:
              db.transportStops.find((st) => st.id === s.stopId)?.name ??
              s.stopId,
            status: s.status,
          }))}
          hasDelay={trip.status === "delayed"}
        />
      )}

      {tripStudent && (
        <div className="flex items-center justify-between rounded-md border border-border p-sm text-sm">
          <span className="text-muted-foreground">Today&apos;s status</span>
          <span className="text-foreground">
            {pickupStatusLabels[tripStudent.pickupStatus]} ·{" "}
            {dropStatusLabels[tripStudent.dropStatus]}
          </span>
        </div>
      )}

      <div className="flex items-start gap-1.5 rounded-md border border-warning/30 bg-warning/8 p-sm text-xs text-warning">
        <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
        In an emergency, stay with your attendant and follow their instructions.
        Contact the transport office if needed.
      </div>

      <Button asChild variant="outline" size="sm">
        <a href={`tel:${TRANSPORT_OFFICE_PHONE}`}>
          <Phone className="size-3.5" />
          Contact transport office
        </a>
      </Button>
    </div>
  );
}
