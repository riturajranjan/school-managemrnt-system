"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OfflineBanner } from "@/components/transport/offline-banner";
import { useCurrentDriver } from "@/lib/hooks/use-transport";
import { useSisStore } from "@/lib/hooks/use-store";
import { trackPendingSync, useIsOnline, usePendingSync } from "@/lib/offline/offline-status";
import { updateVehicle } from "@/lib/services/vehicle-service";
import { setTripStatus } from "@/lib/services/trip-service";

const CHECKLIST_ITEMS = [
  { key: "vehicleCheck", label: "Vehicle exterior and tyres checked" },
  { key: "gpsStatus", label: "GPS device is powered on and reporting" },
  {
    key: "emergencyEquipment",
    label: "First-aid kit and fire extinguisher onboard",
  },
  { key: "documentReadiness", label: "Vehicle documents and license carried" },
  { key: "driverFitness", label: "I confirm I am fit to drive today" },
] as const;

function ChecklistContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tripId = searchParams.get("tripId");
  const driver = useCurrentDriver();
  const db = useSisStore();
  const online = useIsOnline();
  const pending = usePendingSync();

  const trip = db.transportTrips.find((t) => t.id === tripId);
  const vehicle = db.vehicles.find((v) => v.id === trip?.vehicleId);

  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [odometerKm, setOdometerKm] = useState(vehicle?.odometerKm ?? 0);
  const [fuelLevel, setFuelLevel] = useState<
    "full" | "three-quarter" | "half" | "low"
  >("full");

  if (!trip || !driver) {
    return (
      <div className="mx-auto flex  flex-col items-center gap-sm py-2xl text-center">
        <p className="text-sm text-muted-foreground">Trip not found.</p>
      </div>
    );
  }

  const allChecked = CHECKLIST_ITEMS.every((item) => checked[item.key]);

  return (
    <div className="mx-auto flex w-full flex-col gap-md pb-24 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">
          Pre-trip checklist
        </h1>
        <p className="text-xs text-muted-foreground">
          {vehicle?.registrationNumber ?? "Vehicle"} · Complete every check
          before starting
        </p>
      </div>

      <OfflineBanner online={online} pendingCount={pending.length} />

      <div className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
        {CHECKLIST_ITEMS.map((item) => (
          <label
            key={item.key}
            className="flex items-center gap-sm text-sm text-foreground">
            <Checkbox
              checked={!!checked[item.key]}
              onCheckedChange={(v) =>
                setChecked((current) => ({
                  ...current,
                  [item.key]: v === true,
                }))
              }
            />
            {item.label}
          </label>
        ))}

        <div>
          <Label htmlFor="odometer">Odometer reading (km)</Label>
          <Input
            id="odometer"
            type="number"
            min={0}
            value={odometerKm}
            onChange={(e) => setOdometerKm(Number(e.target.value))}
            className="h-12 text-base"
          />
        </div>

        <div>
          <Label>Fuel level</Label>
          <div className="grid grid-cols-4 gap-xs">
            {(["full", "three-quarter", "half", "low"] as const).map(
              (level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setFuelLevel(level)}
                  className={`min-h-11 rounded-md border px-1 text-xs font-medium capitalize transition-colors ${fuelLevel === level ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
                  {level.replace("-", " ")}
                </button>
              ),
            )}
          </div>
        </div>
      </div>

      <Button
        className="h-12 text-base"
        disabled={!allChecked}
        onClick={() => {
          const actor = { name: driver.name, role: "Driver" };
          if (vehicle) updateVehicle(vehicle.id, { odometerKm }, actor);
          setTripStatus(
            trip.id,
            "boarding",
            actor,
            `Pre-trip checklist completed. Fuel: ${fuelLevel}. Odometer: ${odometerKm}km.`,
          );
          if (!online) trackPendingSync("Pre-trip checklist");
          router.push(`/driver/trip/${trip.id}`);
        }}>
        <CheckCircle2 className="size-4" />
        Start trip
      </Button>
    </div>
  );
}

export default function DriverChecklistPage() {
  return (
    <Suspense fallback={null}>
      <ChecklistContent />
    </Suspense>
  );
}
