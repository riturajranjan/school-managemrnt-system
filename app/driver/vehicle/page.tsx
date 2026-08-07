"use client";

import { Bus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useCurrentDriver } from "@/lib/hooks/use-transport";
import { useSisStore } from "@/lib/hooks/use-store";
import {
  transportDocumentStatusLabels,
  vehicleDocumentTypeLabels,
  vehicleStatusLabels,
  vehicleTypeLabels,
} from "@/lib/types/transport";
import { formatDate } from "@/lib/utils";

const docStatusTone: Record<
  string,
  "success" | "warning" | "error" | "neutral"
> = {
  valid: "success",
  "expiring-soon": "warning",
  expired: "error",
  missing: "error",
  "under-review": "neutral",
  rejected: "error",
};

export default function DriverVehiclePage() {
  const driver = useCurrentDriver();
  const db = useSisStore();

  const route = driver
    ? db.transportRoutes.find((r) => r.primaryDriverId === driver.id)
    : undefined;
  const vehicle = db.vehicles.find((v) => v.id === route?.assignedVehicleId);
  const documents = vehicle
    ? db.vehicleDocuments.filter((d) => d.vehicleId === vehicle.id)
    : [];

  if (!vehicle) {
    return (
      <div className="mx-auto flex  flex-col items-center gap-sm py-2xl text-center">
        <Bus className="size-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No vehicle assigned.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full flex-col gap-md pb-24 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">
          {vehicle.registrationNumber}
        </h1>
        <p className="text-xs text-muted-foreground">
          {vehicle.fleetNumber} · {vehicleTypeLabels[vehicle.type]}
        </p>
      </div>

      <div className="surface-3d rounded-lg border border-border bg-surface p-md">
        <dl className="grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Make/model</dt>
          <dd className="text-foreground">
            {vehicle.make} {vehicle.model}
          </dd>
          <dt className="text-muted-foreground">Capacity</dt>
          <dd className="text-foreground">{vehicle.capacity} seats</dd>
          <dt className="text-muted-foreground">Fuel type</dt>
          <dd className="text-foreground capitalize">{vehicle.fuelType}</dd>
          <dt className="text-muted-foreground">Odometer</dt>
          <dd className="text-foreground">
            {vehicle.odometerKm.toLocaleString("en-IN")} km
          </dd>
          <dt className="text-muted-foreground">Status</dt>
          <dd>
            <Badge
              tone={
                vehicle.status === "breakdown" ||
                vehicle.status === "documents-expired"
                  ? "error"
                  : "success"
              }>
              {vehicleStatusLabels[vehicle.status]}
            </Badge>
          </dd>
        </dl>
      </div>

      <div className="rounded-lg border border-border p-sm">
        <h2 className="mb-sm text-sm font-semibold text-foreground">
          Documents
        </h2>
        {documents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No documents on file.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {documents.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between text-sm">
                <div>
                  <p className="text-foreground">
                    {vehicleDocumentTypeLabels[d.type]}
                  </p>
                  {d.expiryDate && (
                    <p className="text-xs text-muted-foreground">
                      Expires {formatDate(d.expiryDate)}
                    </p>
                  )}
                </div>
                <Badge tone={docStatusTone[d.status]}>
                  {transportDocumentStatusLabels[d.status]}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
