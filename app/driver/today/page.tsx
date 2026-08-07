"use client";

import Link from "next/link";
import {
  AlertTriangle,
  Bus,
  CheckCircle2,
  ChevronRight,
  Phone,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCurrentDriver } from "@/lib/hooks/use-transport";
import { useSisStore } from "@/lib/hooks/use-store";
import { tripStatusLabels, type TripStatus } from "@/lib/types/transport";
import { formatDate } from "@/lib/utils";

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

const TRANSPORT_OFFICE_PHONE = "+911234567890";

export default function DriverTodayPage() {
  const driver = useCurrentDriver();
  const db = useSisStore();
  const today = new Date().toISOString().slice(0, 10);

  if (!driver) {
    return (
      <div className="mx-auto flex  flex-col items-center gap-sm py-2xl text-center">
        <p className="text-sm text-muted-foreground">
          No driver profile found for preview.
        </p>
      </div>
    );
  }

  const trips = db.transportTrips.filter(
    (t) => t.driverId === driver.id && t.date === today,
  );
  const route = db.transportRoutes.find((r) => r.primaryDriverId === driver.id);
  const vehicle = db.vehicles.find((v) => v.id === route?.assignedVehicleId);

  const documentAlerts = [
    ...db.driverDocuments.filter(
      (d) => d.driverId === driver.id && d.status !== "valid",
    ),
    ...(vehicle
      ? db.vehicleDocuments.filter(
          (d) => d.vehicleId === vehicle.id && d.status !== "valid",
        )
      : []),
  ];
  const openIncidents = db.transportIncidents.filter(
    (i) =>
      trips.some((t) => t.id === i.tripId) &&
      i.status !== "resolved" &&
      i.status !== "closed",
  );

  return (
    <div className="mx-auto flex w-full  flex-col gap-md pb-24 sm:pb-0">
      <div>
        <p className="text-xs text-muted-foreground">{formatDate(today)}</p>
        <h1 className="text-lg font-semibold text-foreground">
          Hello, {driver.name.split(" ")[0]}
        </h1>
      </div>

      {vehicle && (
        <Link
          href="/driver/vehicle"
          className="surface-3d flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-md">
          <div className="flex items-center gap-sm">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Bus className="size-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {vehicle.registrationNumber}
              </p>
              <p className="text-xs text-muted-foreground">
                {vehicle.fleetNumber}
              </p>
            </div>
          </div>
          <ChevronRight className="size-4 text-muted-foreground" />
        </Link>
      )}

      {(documentAlerts.length > 0 || openIncidents.length > 0) && (
        <div className="flex flex-col gap-1 rounded-lg border border-warning/30 bg-warning/8 p-sm text-xs text-warning">
          {documentAlerts.length > 0 && (
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="size-3.5 shrink-0" />{" "}
              {documentAlerts.length} document(s) need attention
            </span>
          )}
          {openIncidents.length > 0 && (
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="size-3.5 shrink-0" />{" "}
              {openIncidents.length} open incident(s) on today&apos;s trips
            </span>
          )}
        </div>
      )}

      <div className="flex flex-col gap-sm">
        <h2 className="text-sm font-semibold text-foreground">
          Today&apos;s trips
        </h2>
        {trips.length === 0 ? (
          <div className="flex flex-col items-center gap-xs rounded-lg border border-dashed border-border p-lg text-center">
            <CheckCircle2 className="size-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No trips scheduled for you today.
            </p>
          </div>
        ) : (
          trips.map((trip) => {
            const tripRoute = db.transportRoutes.find(
              (r) => r.id === trip.routeId,
            );
            const canStart = trip.status === "scheduled";
            const canContinue =
              trip.status === "boarding" ||
              trip.status === "in-progress" ||
              trip.status === "delayed" ||
              trip.status === "paused";
            return (
              <div
                key={trip.id}
                className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
                <div className="flex items-center justify-between gap-xs">
                  <p className="text-sm font-semibold text-foreground">
                    {tripRoute?.name ?? trip.routeId}
                  </p>
                  <Badge tone={statusTone[trip.status]}>
                    {tripStatusLabels[trip.status]}
                  </Badge>
                </div>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="size-3.5" /> {trip.studentsExpected}{" "}
                  student(s) expected
                </p>
                {canStart && (
                  <Button asChild size="sm">
                    <Link href={`/driver/checklist?tripId=${trip.id}`}>
                      Start pre-trip checklist
                    </Link>
                  </Button>
                )}
                {canContinue && (
                  <Button asChild size="sm">
                    <Link href={`/driver/trip/${trip.id}`}>Continue trip</Link>
                  </Button>
                )}
                {trip.status === "completed" && (
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/driver/trip/${trip.id}`}>View summary</Link>
                  </Button>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="flex flex-col gap-xs">
        <Button asChild variant="outline" size="sm">
          <Link href="/driver/incidents">Report an issue</Link>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <a href={`tel:${TRANSPORT_OFFICE_PHONE}`}>
            <Phone className="size-3.5" />
            Contact transport office
          </a>
        </Button>
      </div>
    </div>
  );
}
