"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useTransportShiftPolicies, useTransportStops, useVehicles, useDrivers, useAttendants } from "@/lib/hooks/use-transport";
import { addStopToRoute, createRoute, setRouteStatus } from "@/lib/services/route-service";
import { routeDirectionLabels, routeTypeLabels, transportShiftLabels, vehicleTypeLabels, type RouteDirection, type RouteType, type TransportShift, type VehicleType } from "@/lib/types/transport";

const ACTOR = { name: "Transport Administrator", role: "Transport Administrator" };
const typeOptions = Object.keys(routeTypeLabels) as RouteType[];
const shiftOptions = Object.keys(transportShiftLabels) as TransportShift[];
const directionOptions = Object.keys(routeDirectionLabels) as RouteDirection[];
const vehicleTypeOptions = Object.keys(vehicleTypeLabels) as VehicleType[];

type DraftStop = { stopId: string; pickupTime: string; dropTime: string; waitingMinutes: number };

export default function NewRoutePage() {
  const router = useRouter();
  const { can } = usePermissions();
  const stops = useTransportStops();
  const shiftPolicies = useTransportShiftPolicies();
  const vehicles = useVehicles();
  const drivers = useDrivers();
  const attendants = useAttendants();

  const [name, setName] = useState("");
  const [shift, setShift] = useState<TransportShift>("morning");
  const [direction, setDirection] = useState<RouteDirection>("both");
  const [type, setType] = useState<RouteType>("morning-pickup");
  const [startPoint, setStartPoint] = useState("");
  const [endPoint, setEndPoint] = useState("Novyra Public School");
  const [distanceKm, setDistanceKm] = useState(10);
  const [estimatedDurationMinutes, setEstimatedDurationMinutes] = useState(30);
  const [vehicleType, setVehicleType] = useState<VehicleType>("bus");
  const [maxCapacity, setMaxCapacity] = useState(42);
  const [assignedVehicleId, setAssignedVehicleId] = useState<string>("");
  const [primaryDriverId, setPrimaryDriverId] = useState<string>("");
  const [backupDriverId, setBackupDriverId] = useState<string>("");
  const [attendantId, setAttendantId] = useState<string>("");
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));

  const [routeStops, setRouteStops] = useState<DraftStop[]>([]);
  const [newStopId, setNewStopId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const canSubmit = name.trim().length > 0 && startPoint.trim().length > 0 && endPoint.trim().length > 0 && maxCapacity > 0;

  function addStop() {
    if (!newStopId || routeStops.some((s) => s.stopId === newStopId)) return;
    const policy = shiftPolicies.find((p) => p.shift === shift);
    setRouteStops((current) => [...current, { stopId: newStopId, pickupTime: policy?.defaultPickupTime ?? "07:00", dropTime: policy?.defaultDropTime ?? "15:30", waitingMinutes: 3 }]);
    setNewStopId("");
  }

  function moveStop(index: number, direction: -1 | 1) {
    setRouteStops((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function updateStop(index: number, patch: Partial<DraftStop>) {
    setRouteStops((current) => current.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function submit(activate: boolean) {
    const result = createRoute(
      {
        name: name.trim(),
        branch: "main",
        shift,
        direction,
        type,
        startPoint: startPoint.trim(),
        endPoint: endPoint.trim(),
        distanceKm,
        estimatedDurationMinutes,
        vehicleType,
        maxCapacity,
        assignedVehicleId: assignedVehicleId || undefined,
        primaryDriverId: primaryDriverId || undefined,
        backupDriverId: backupDriverId || undefined,
        attendantId: attendantId || undefined,
        effectiveFrom,
        status: "draft",
      },
      ACTOR,
    );
    if (!result.ok || !result.route) {
      setError(result.ok ? "Something went wrong." : result.error);
      return;
    }

    routeStops.forEach((s, i) => {
      addStopToRoute(result.route!.id, { stopId: s.stopId, sequence: i + 1, pickupTime: s.pickupTime, dropTime: s.dropTime, waitingMinutes: s.waitingMinutes }, ACTOR);
    });

    if (activate) {
      const activation = setRouteStatus(result.route.id, "active", ACTOR);
      if (!activation.ok) {
        setError(`Route saved as draft — couldn't activate: ${activation.error}`);
        router.push(`/transport/routes/${result.route.id}`);
        return;
      }
    }

    router.push(`/transport/routes/${result.route.id}`);
  }

  if (!can("transport.manageRoutes")) {
    return <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">You don&apos;t have permission to create routes.</p>;
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">New route</h1>
        <p className="text-xs text-muted-foreground">Build the route, then save as draft or activate immediately</p>
      </div>

      <div className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
        {error && <p className="text-xs text-error">{error}</p>}
        <h2 className="text-sm font-semibold text-foreground">Basic info</h2>
        <div className="grid grid-cols-2 gap-sm">
          <div className="col-span-2">
            <Label htmlFor="route-name">Route name</Label>
            <Input id="route-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Route 7 — Electronic City" />
          </div>
          <div>
            <Label>Shift</Label>
            <Select value={shift} onValueChange={(v) => setShift(v as TransportShift)}>
              <SelectTrigger aria-label="Shift">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {shiftOptions.map((s) => (
                  <SelectItem key={s} value={s}>
                    {transportShiftLabels[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Route type</Label>
            <Select value={type} onValueChange={(v) => setType(v as RouteType)}>
              <SelectTrigger aria-label="Route type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {typeOptions.map((t) => (
                  <SelectItem key={t} value={t}>
                    {routeTypeLabels[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Direction</Label>
            <Select value={direction} onValueChange={(v) => setDirection(v as RouteDirection)}>
              <SelectTrigger aria-label="Direction">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {directionOptions.map((d) => (
                  <SelectItem key={d} value={d}>
                    {routeDirectionLabels[d]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="route-start">Start point</Label>
            <Input id="route-start" value={startPoint} onChange={(e) => setStartPoint(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="route-end">School endpoint</Label>
            <Input id="route-end" value={endPoint} onChange={(e) => setEndPoint(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="route-distance">Distance (km)</Label>
            <Input id="route-distance" type="number" min={0} value={distanceKm} onChange={(e) => setDistanceKm(Number(e.target.value))} />
          </div>
          <div>
            <Label htmlFor="route-duration">Duration (min)</Label>
            <Input id="route-duration" type="number" min={0} value={estimatedDurationMinutes} onChange={(e) => setEstimatedDurationMinutes(Number(e.target.value))} />
          </div>
          <div>
            <Label htmlFor="route-effective">Effective from</Label>
            <Input id="route-effective" type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
        <h2 className="text-sm font-semibold text-foreground">Vehicle & crew</h2>
        <div className="grid grid-cols-2 gap-sm">
          <div>
            <Label>Vehicle type required</Label>
            <Select value={vehicleType} onValueChange={(v) => setVehicleType(v as VehicleType)}>
              <SelectTrigger aria-label="Vehicle type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {vehicleTypeOptions.map((t) => (
                  <SelectItem key={t} value={t}>
                    {vehicleTypeLabels[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="route-capacity">Max capacity</Label>
            <Input id="route-capacity" type="number" min={1} value={maxCapacity} onChange={(e) => setMaxCapacity(Number(e.target.value))} />
          </div>
          <div>
            <Label>Vehicle</Label>
            <Select value={assignedVehicleId} onValueChange={setAssignedVehicleId}>
              <SelectTrigger aria-label="Vehicle">
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                {vehicles.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.registrationNumber} ({v.fleetNumber})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Attendant</Label>
            <Select value={attendantId} onValueChange={setAttendantId}>
              <SelectTrigger aria-label="Attendant">
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                {attendants.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Primary driver</Label>
            <Select value={primaryDriverId} onValueChange={setPrimaryDriverId}>
              <SelectTrigger aria-label="Primary driver">
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                {drivers.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Backup driver</Label>
            <Select value={backupDriverId} onValueChange={setBackupDriverId}>
              <SelectTrigger aria-label="Backup driver">
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                {drivers.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
        <h2 className="text-sm font-semibold text-foreground">Stops</h2>
        <div className="flex items-end gap-xs">
          <div className="min-w-0 flex-1">
            <Label>Add stop</Label>
            <Select value={newStopId} onValueChange={setNewStopId}>
              <SelectTrigger aria-label="Add stop">
                <SelectValue placeholder="Select a stop" />
              </SelectTrigger>
              <SelectContent>
                {stops
                  .filter((s) => !routeStops.some((rs) => rs.stopId === s.id))
                  .map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="secondary" size="sm" onClick={addStop} disabled={!newStopId}>
            <Plus className="size-3.5" />
            Add
          </Button>
        </div>

        {routeStops.length === 0 ? (
          <p className="text-sm text-muted-foreground">No stops added yet.</p>
        ) : (
          <ul className="flex flex-col gap-xs">
            {routeStops.map((rs, i) => {
              const stop = stops.find((s) => s.id === rs.stopId);
              return (
                <li key={rs.stopId} className="flex flex-col gap-xs rounded-md border border-border p-sm">
                  <div className="flex items-center justify-between gap-xs">
                    <span className="text-sm font-medium text-foreground">
                      {i + 1}. {stop?.name ?? rs.stopId}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => moveStop(i, -1)} disabled={i === 0} aria-label="Move up">
                        <ArrowUp className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => moveStop(i, 1)} disabled={i === routeStops.length - 1} aria-label="Move down">
                        <ArrowDown className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setRouteStops((current) => current.filter((_, idx) => idx !== i))} aria-label="Remove stop">
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-xs">
                    <Input type="time" value={rs.pickupTime} onChange={(e) => updateStop(i, { pickupTime: e.target.value })} aria-label="Pickup time" />
                    <Input type="time" value={rs.dropTime} onChange={(e) => updateStop(i, { dropTime: e.target.value })} aria-label="Drop time" />
                    <Input type="number" min={0} value={rs.waitingMinutes} onChange={(e) => updateStop(i, { waitingMinutes: Number(e.target.value) })} aria-label="Waiting minutes" placeholder="Wait (min)" />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex items-center gap-sm">
        <Button disabled={!canSubmit} onClick={() => submit(false)}>
          Save as draft
        </Button>
        <Button disabled={!canSubmit} variant="secondary" onClick={() => submit(true)}>
          Save & activate
        </Button>
        <Button variant="ghost" onClick={() => router.push("/transport/routes")}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
