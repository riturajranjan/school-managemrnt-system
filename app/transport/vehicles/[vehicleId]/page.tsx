"use client";

import Link from "next/link";
import { use, useState } from "react";
import { AlertTriangle, Fuel, Gauge, MapPinned, Plus, Route, ScrollText, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TransportAuditTrail } from "@/components/transport/audit-trail";
import { VehicleSeatChart } from "@/components/transport/vehicle-seat-chart";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useVehicle, useVehicleAssignments, useVehicleDocuments, useVehicleSeats } from "@/lib/hooks/use-transport";
import { useSisStore } from "@/lib/hooks/use-store";
import { formatMoney, sumMoney } from "@/lib/finance/money";
import { computeVehicleHealth } from "@/lib/selectors/vehicle-health";
import { addVehicleDocument, setVehicleStatus, updateVehicleDocument } from "@/lib/services/vehicle-service";
import {
  incidentSeverityLabels,
  transportDocumentStatusLabels,
  vehicleDocumentTypeLabels,
  vehicleStatusLabels,
  vehicleTypeLabels,
  type VehicleDocumentType,
  type VehicleStatus,
} from "@/lib/types/transport";
import { formatDate } from "@/lib/utils";

const ACTOR = { name: "Transport Administrator", role: "Transport Administrator" };
const docTypeOptions = Object.keys(vehicleDocumentTypeLabels) as VehicleDocumentType[];
const statusOptions = Object.keys(vehicleStatusLabels) as VehicleStatus[];

const docStatusTone: Record<string, "success" | "warning" | "error" | "neutral"> = {
  valid: "success",
  "expiring-soon": "warning",
  expired: "error",
  missing: "error",
  "under-review": "neutral",
  rejected: "error",
};

export default function VehicleDetailPage({ params }: { params: Promise<{ vehicleId: string }> }) {
  const { vehicleId } = use(params);
  const vehicle = useVehicle(vehicleId);
  const db = useSisStore();
  const seats = useVehicleSeats(vehicleId);
  const documents = useVehicleDocuments(vehicleId);
  const assignments = useVehicleAssignments(vehicleId);
  const { can } = usePermissions();
  const canManage = can("transport.manageVehicles");
  const canManageDocs = can("transport.manageDocuments") || canManage;

  const [docDrawerOpen, setDocDrawerOpen] = useState(false);
  const [docType, setDocType] = useState<VehicleDocumentType>("insurance");
  const [docNumber, setDocNumber] = useState("");
  const [docExpiry, setDocExpiry] = useState("");

  if (!vehicle) {
    return (
      <div className="flex flex-col items-center gap-sm py-2xl text-center">
        <p className="text-sm font-medium text-foreground">Vehicle not found</p>
        <Button asChild variant="outline">
          <Link href="/transport/vehicles">Back to vehicles</Link>
        </Button>
      </div>
    );
  }

  const health = computeVehicleHealth(db, vehicle);
  const occupiedSeats = seats.filter((s) => s.studentId).length;
  const routesForVehicle = db.transportRoutes.filter((r) => r.assignedVehicleId === vehicle.id || assignments.some((a) => a.routeId === r.id));
  const tripsForVehicle = db.transportTrips.filter((t) => t.vehicleId === vehicle.id);
  const maintenanceForVehicle = db.maintenanceRecords.filter((m) => m.vehicleId === vehicle.id);
  const fuelForVehicle = db.fuelRecords.filter((f) => f.vehicleId === vehicle.id);
  const incidentsForVehicle = db.transportIncidents.filter((i) => i.vehicleId === vehicle.id);
  const gpsPositions = db.gpsPositions.filter((p) => p.vehicleId === vehicle.id).sort((a, b) => (a.recordedAt < b.recordedAt ? 1 : -1));
  const gpsDevice = db.gpsDevices.find((g) => g.vehicleId === vehicle.id);

  const maintenanceCost = sumMoney(maintenanceForVehicle.map((m) => m.cost), "INR");
  const fuelCost = sumMoney(fuelForVehicle.map((f) => f.totalCost), "INR");

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">{vehicle.registrationNumber}</h1>
          <p className="text-xs text-muted-foreground">
            {vehicle.fleetNumber} · {vehicleTypeLabels[vehicle.type]} · {vehicle.make} {vehicle.model} ({vehicle.year})
          </p>
        </div>
        {canManage && (
          <Select value={vehicle.status} onValueChange={(v) => setVehicleStatus(vehicle.id, v as VehicleStatus, ACTOR)}>
            <SelectTrigger className="w-44" aria-label="Vehicle status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((s) => (
                <SelectItem key={s} value={s}>
                  {vehicleStatusLabels[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <div className="surface-3d rounded-lg border border-border bg-surface p-sm">
          <p className="text-xs text-muted-foreground">Vehicle Health</p>
          <p className={`text-xl font-bold ${health.score >= 80 ? "text-success" : health.score >= 60 ? "text-warning" : "text-error"}`}>{health.score}</p>
        </div>
        <div className="surface-3d rounded-lg border border-border bg-surface p-sm">
          <p className="text-xs text-muted-foreground">Seats occupied</p>
          <p className="text-xl font-bold text-foreground">
            {occupiedSeats}/{seats.length}
          </p>
        </div>
        <div className="surface-3d rounded-lg border border-border bg-surface p-sm">
          <p className="text-xs text-muted-foreground">Odometer</p>
          <p className="text-xl font-bold text-foreground">{vehicle.odometerKm.toLocaleString("en-IN")} km</p>
        </div>
        <div className="surface-3d rounded-lg border border-border bg-surface p-sm">
          <p className="text-xs text-muted-foreground">Status</p>
          <Badge tone={vehicle.status === "breakdown" || vehicle.status === "documents-expired" ? "error" : vehicle.status === "maintenance" ? "warning" : "success"}>{vehicleStatusLabels[vehicle.status]}</Badge>
        </div>
      </div>

      {(health.mainRisk || health.expiringDocument) && (
        <div className="flex flex-col gap-1 rounded-lg border border-warning/30 bg-warning/8 p-sm text-sm text-warning">
          {health.mainRisk && (
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="size-3.5 shrink-0" /> Main risk: {health.mainRisk}
            </span>
          )}
          {health.expiringDocument && <span className="pl-5 text-xs">{health.expiringDocument}</span>}
        </div>
      )}

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="trips">Trips</TabsTrigger>
          <TabsTrigger value="routes">Routes</TabsTrigger>
          <TabsTrigger value="students">Students</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
          <TabsTrigger value="fuel">Fuel</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="incidents">Incidents</TabsTrigger>
          <TabsTrigger value="gps">GPS history</TabsTrigger>
          <TabsTrigger value="costs">Costs</TabsTrigger>
          <TabsTrigger value="audit">Audit</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-md">
          <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
            <dl className="grid grid-cols-2 gap-y-2 rounded-lg border border-border p-sm text-sm">
              <dt className="text-muted-foreground">Chassis number</dt>
              <dd className="text-foreground">{vehicle.chassisNumber}</dd>
              <dt className="text-muted-foreground">Engine number</dt>
              <dd className="text-foreground">{vehicle.engineNumber}</dd>
              <dt className="text-muted-foreground">Fuel type</dt>
              <dd className="text-foreground capitalize">{vehicle.fuelType}</dd>
              <dt className="text-muted-foreground">Ownership</dt>
              <dd className="text-foreground capitalize">{vehicle.ownershipType}</dd>
              <dt className="text-muted-foreground">Branch</dt>
              <dd className="text-foreground">{vehicle.branch}</dd>
              <dt className="text-muted-foreground">GPS device</dt>
              <dd className="text-foreground">{gpsDevice ? `${gpsDevice.deviceIdentifier} (${gpsDevice.status})` : "Not configured"}</dd>
            </dl>
            <div className="rounded-lg border border-border p-sm">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Health breakdown</p>
              <div className="flex flex-col gap-1">
                {health.components.map((c) => (
                  <div key={c.key} className="flex items-center justify-between text-sm">
                    <span className="text-foreground">{c.label}</span>
                    <span className="font-medium text-foreground">{c.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="trips" className="mt-md">
          {tripsForVehicle.length === 0 ? (
            <EmptyRow icon={Route} text="No trips recorded for this vehicle yet." />
          ) : (
            <ul className="flex flex-col gap-xs">
              {tripsForVehicle.map((trip) => (
                <li key={trip.id}>
                  <Link href={`/transport/trips/${trip.id}`} className="flex items-center justify-between rounded-md border border-border p-sm hover:border-primary/40">
                    <span className="text-sm text-foreground">{trip.tripNumber}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(trip.date)} · {trip.studentsBoarded}/{trip.studentsExpected} boarded
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="routes" className="mt-md">
          {routesForVehicle.length === 0 ? (
            <EmptyRow icon={Route} text="This vehicle isn't assigned to a route." />
          ) : (
            <ul className="flex flex-col gap-xs">
              {routesForVehicle.map((route) => (
                <li key={route.id}>
                  <Link href={`/transport/routes/${route.id}`} className="flex items-center justify-between rounded-md border border-border p-sm hover:border-primary/40">
                    <span className="text-sm text-foreground">{route.name}</span>
                    <Badge tone="info">{route.code}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="students" className="mt-md">
          <VehicleSeatChart vehicle={vehicle} />
        </TabsContent>

        <TabsContent value="maintenance" className="mt-md">
          {maintenanceForVehicle.length === 0 ? (
            <EmptyRow icon={Wrench} text="No maintenance records yet." />
          ) : (
            <ul className="flex flex-col gap-xs">
              {maintenanceForVehicle.map((m) => (
                <li key={m.id} className="flex items-center justify-between rounded-md border border-border p-sm text-sm">
                  <span className="capitalize text-foreground">{m.type.replace(/-/g, " ")}</span>
                  <span className="text-xs text-muted-foreground">
                    {m.status} · {formatDate(m.scheduledDate)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/transport/maintenance" className="mt-sm inline-block text-xs text-primary underline-offset-2 hover:underline">
            Manage maintenance
          </Link>
        </TabsContent>

        <TabsContent value="fuel" className="mt-md">
          {fuelForVehicle.length === 0 ? (
            <EmptyRow icon={Fuel} text="No fuel entries yet." />
          ) : (
            <ul className="flex flex-col gap-xs">
              {fuelForVehicle.map((f) => (
                <li key={f.id} className="flex items-center justify-between rounded-md border border-border p-sm text-sm">
                  <span className="text-foreground">
                    {f.quantityLitres}L · {formatDate(f.date)}
                  </span>
                  <span className="text-xs font-medium text-foreground">{formatMoney(f.totalCost)}</span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/transport/fuel" className="mt-sm inline-block text-xs text-primary underline-offset-2 hover:underline">
            Manage fuel records
          </Link>
        </TabsContent>

        <TabsContent value="documents" className="mt-md">
          <div className="mb-sm flex items-center justify-end">
            {canManageDocs && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setDocType("insurance");
                  setDocNumber("");
                  setDocExpiry("");
                  setDocDrawerOpen(true);
                }}
              >
                <Plus className="size-3.5" />
                Add document
              </Button>
            )}
          </div>
          {documents.length === 0 ? (
            <EmptyRow icon={ScrollText} text="No documents on file." />
          ) : (
            <ul className="flex flex-col gap-xs">
              {documents.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm">
                  <div className="min-w-0">
                    <p className="text-sm font-medium capitalize text-foreground">{vehicleDocumentTypeLabels[d.type]}</p>
                    <p className="text-xs text-muted-foreground">
                      {d.documentNumber ?? "—"} {d.expiryDate ? `· Expires ${formatDate(d.expiryDate)}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Badge tone={docStatusTone[d.status]}>{transportDocumentStatusLabels[d.status]}</Badge>
                    {canManageDocs && d.status !== "valid" && (
                      <Button size="sm" variant="ghost" onClick={() => updateVehicleDocument(d.id, { status: "valid" }, ACTOR)}>
                        Mark valid
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="incidents" className="mt-md">
          {incidentsForVehicle.length === 0 ? (
            <EmptyRow icon={AlertTriangle} text="No incidents reported for this vehicle." />
          ) : (
            <ul className="flex flex-col gap-xs">
              {incidentsForVehicle.map((i) => (
                <li key={i.id}>
                  <Link href="/transport/incidents" className="flex items-center justify-between rounded-md border border-border p-sm hover:border-primary/40">
                    <span className="text-sm text-foreground">{i.incidentNumber}</span>
                    <Badge tone={i.severity === "critical" || i.severity === "high" ? "error" : i.severity === "medium" ? "warning" : "neutral"}>{incidentSeverityLabels[i.severity]}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="gps" className="mt-md">
          {gpsPositions.length === 0 ? (
            <EmptyRow icon={MapPinned} text="No GPS history available." />
          ) : (
            <ul className="flex flex-col gap-1">
              {gpsPositions.slice(0, 20).map((p) => (
                <li key={p.id} className="flex items-center justify-between rounded-md border border-border px-sm py-1.5 text-xs">
                  <span className="text-foreground">
                    {p.latitude.toFixed(4)}, {p.longitude.toFixed(4)}
                  </span>
                  <span className="text-muted-foreground">
                    {p.speedKmh} km/h · {formatDate(p.recordedAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="costs" className="mt-md">
          <div className="grid grid-cols-2 gap-sm sm:grid-cols-3">
            <div className="surface-3d rounded-lg border border-border bg-surface p-sm">
              <p className="text-xs text-muted-foreground">Maintenance cost</p>
              <p className="text-lg font-semibold text-foreground">{formatMoney(maintenanceCost)}</p>
            </div>
            <div className="surface-3d rounded-lg border border-border bg-surface p-sm">
              <p className="text-xs text-muted-foreground">Fuel cost</p>
              <p className="text-lg font-semibold text-foreground">{formatMoney(fuelCost)}</p>
            </div>
            <div className="surface-3d rounded-lg border border-border bg-surface p-sm">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-lg font-semibold text-foreground">{formatMoney(sumMoney([maintenanceCost, fuelCost], "INR"))}</p>
            </div>
          </div>
          <div className="mt-md flex items-center gap-1.5 text-xs text-muted-foreground">
            <Gauge className="size-3.5" />
            Costs are visible only to roles with transport.viewCosts.
          </div>
        </TabsContent>

        <TabsContent value="audit" className="mt-md">
          <TransportAuditTrail events={db.transportAuditLog.filter((e) => e.subjectId === vehicleId)} />
        </TabsContent>
      </Tabs>

      <DetailDrawer open={docDrawerOpen} onOpenChange={setDocDrawerOpen} title="Add document" description={vehicle.registrationNumber}>
        <div className="flex flex-col gap-sm">
          <div>
            <Label>Document type</Label>
            <Select value={docType} onValueChange={(v) => setDocType(v as VehicleDocumentType)}>
              <SelectTrigger aria-label="Document type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {docTypeOptions.map((t) => (
                  <SelectItem key={t} value={t}>
                    {vehicleDocumentTypeLabels[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="doc-number">Document number</Label>
            <Input id="doc-number" value={docNumber} onChange={(e) => setDocNumber(e.target.value)} placeholder="Optional" />
          </div>
          <div>
            <Label htmlFor="doc-expiry">Expiry date</Label>
            <Input id="doc-expiry" type="date" value={docExpiry} onChange={(e) => setDocExpiry(e.target.value)} />
          </div>
          <Button
            onClick={() => {
              addVehicleDocument({ vehicleId: vehicle.id, type: docType, documentNumber: docNumber.trim() || undefined, expiryDate: docExpiry || undefined, status: docExpiry ? "valid" : "missing" }, ACTOR);
              setDocDrawerOpen(false);
            }}
          >
            Add document
          </Button>
        </div>
      </DetailDrawer>
    </div>
  );
}

function EmptyRow({ icon: Icon, text }: { icon: typeof Wrench; text: string }) {
  return (
    <div className="flex flex-col items-center gap-xs rounded-lg border border-dashed border-border p-lg text-center">
      <Icon className="size-5 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
