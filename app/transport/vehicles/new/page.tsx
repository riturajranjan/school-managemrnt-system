"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermissions } from "@/components/providers/permissions-provider";
import { createVehicle } from "@/lib/services/vehicle-service";
import { fuelTypeLabels, ownershipTypeLabels, vehicleTypeLabels, type FuelType, type OwnershipType, type VehicleType } from "@/lib/types/transport";

const ACTOR = { name: "Transport Administrator", role: "Transport Administrator" };
const typeOptions = Object.keys(vehicleTypeLabels) as VehicleType[];
const fuelOptions = Object.keys(fuelTypeLabels) as FuelType[];
const ownershipOptions = Object.keys(ownershipTypeLabels) as OwnershipType[];

export default function NewVehiclePage() {
  const router = useRouter();
  const { can } = usePermissions();

  const [registrationNumber, setRegistrationNumber] = useState("");
  const [fleetNumber, setFleetNumber] = useState("");
  const [type, setType] = useState<VehicleType>("bus");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [capacity, setCapacity] = useState(42);
  const [fuelType, setFuelType] = useState<FuelType>("diesel");
  const [chassisNumber, setChassisNumber] = useState("");
  const [engineNumber, setEngineNumber] = useState("");
  const [odometerKm, setOdometerKm] = useState(0);
  const [ownershipType, setOwnershipType] = useState<OwnershipType>("owned");
  const [error, setError] = useState<string | null>(null);

  const canSubmit = registrationNumber.trim().length > 0 && fleetNumber.trim().length > 0 && make.trim().length > 0 && model.trim().length > 0 && capacity > 0;

  if (!can("transport.manageVehicles")) {
    return <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">You don&apos;t have permission to add vehicles.</p>;
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">New vehicle</h1>
        <p className="text-xs text-muted-foreground">Adds the vehicle to the fleet with a generated seating layout</p>
      </div>

      <div className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
        {error && <p className="text-xs text-error">{error}</p>}

        <div className="grid grid-cols-2 gap-sm">
          <div>
            <Label htmlFor="veh-reg">Registration number</Label>
            <Input id="veh-reg" value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} placeholder="KA-05-AB-1234" />
          </div>
          <div>
            <Label htmlFor="veh-fleet">Fleet number</Label>
            <Input id="veh-fleet" value={fleetNumber} onChange={(e) => setFleetNumber(e.target.value)} placeholder="BUS-06" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-sm">
          <div>
            <Label>Vehicle type</Label>
            <Select value={type} onValueChange={(v) => setType(v as VehicleType)}>
              <SelectTrigger aria-label="Vehicle type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {typeOptions.map((t) => (
                  <SelectItem key={t} value={t}>
                    {vehicleTypeLabels[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="veh-capacity">Capacity</Label>
            <Input id="veh-capacity" type="number" min={1} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-sm">
          <div>
            <Label htmlFor="veh-make">Make</Label>
            <Input id="veh-make" value={make} onChange={(e) => setMake(e.target.value)} placeholder="Tata" />
          </div>
          <div>
            <Label htmlFor="veh-model">Model</Label>
            <Input id="veh-model" value={model} onChange={(e) => setModel(e.target.value)} placeholder="Starbus" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-sm">
          <div>
            <Label htmlFor="veh-year">Year</Label>
            <Input id="veh-year" type="number" min={1990} max={new Date().getFullYear() + 1} value={year} onChange={(e) => setYear(Number(e.target.value))} />
          </div>
          <div>
            <Label>Fuel type</Label>
            <Select value={fuelType} onValueChange={(v) => setFuelType(v as FuelType)}>
              <SelectTrigger aria-label="Fuel type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {fuelOptions.map((f) => (
                  <SelectItem key={f} value={f}>
                    {fuelTypeLabels[f]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-sm">
          <div>
            <Label htmlFor="veh-chassis">Chassis number</Label>
            <Input id="veh-chassis" value={chassisNumber} onChange={(e) => setChassisNumber(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="veh-engine">Engine number</Label>
            <Input id="veh-engine" value={engineNumber} onChange={(e) => setEngineNumber(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-sm">
          <div>
            <Label htmlFor="veh-odometer">Odometer (km)</Label>
            <Input id="veh-odometer" type="number" min={0} value={odometerKm} onChange={(e) => setOdometerKm(Number(e.target.value))} />
          </div>
          <div>
            <Label>Ownership</Label>
            <Select value={ownershipType} onValueChange={(v) => setOwnershipType(v as OwnershipType)}>
              <SelectTrigger aria-label="Ownership type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ownershipOptions.map((o) => (
                  <SelectItem key={o} value={o}>
                    {ownershipTypeLabels[o]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-sm pt-1">
          <Button
            disabled={!canSubmit}
            onClick={() => {
              const result = createVehicle(
                {
                  registrationNumber: registrationNumber.trim(),
                  fleetNumber: fleetNumber.trim(),
                  type,
                  make: make.trim(),
                  model: model.trim(),
                  year,
                  capacity,
                  fuelType,
                  chassisNumber: chassisNumber.trim(),
                  engineNumber: engineNumber.trim(),
                  odometerKm,
                  branch: "main",
                  ownershipType,
                },
                ACTOR,
              );
              if (!result.ok || !result.vehicle) {
                setError(result.ok ? "Something went wrong." : result.error);
                return;
              }
              router.push(`/transport/vehicles/${result.vehicle.id}`);
            }}
          >
            Add vehicle
          </Button>
          <Button variant="ghost" onClick={() => router.push("/transport/vehicles")}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
