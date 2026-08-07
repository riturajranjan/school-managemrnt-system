"use client";

import { useState } from "react";
import { Plus, ScrollText, ShieldAlert } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef } from "@/components/data-table/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatTile } from "@/components/ui/stat-tile";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useDrivers, useVehicles } from "@/lib/hooks/use-transport";
import { useSisStore } from "@/lib/hooks/use-store";
import { documentCompliance, type DriverComplianceRow, type VehicleComplianceRow } from "@/lib/selectors/document-compliance";
import { addDriverDocument } from "@/lib/services/driver-service";
import { addVehicleDocument } from "@/lib/services/vehicle-service";
import { driverDocumentTypeLabels, vehicleDocumentTypeLabels, type DriverDocumentType, type TransportDocumentStatus, type VehicleDocumentType } from "@/lib/types/transport";
import { formatDate } from "@/lib/utils";

const ACTOR = { name: "Transport Administrator", role: "Transport Administrator" };
const vehicleDocTypes = Object.keys(vehicleDocumentTypeLabels) as VehicleDocumentType[];
const driverDocTypes = Object.keys(driverDocumentTypeLabels) as DriverDocumentType[];

const statusTone: Record<TransportDocumentStatus, "success" | "warning" | "error" | "neutral"> = {
  valid: "success",
  "expiring-soon": "warning",
  expired: "error",
  missing: "error",
  "under-review": "warning",
  rejected: "error",
};

export default function TransportDocumentsPage() {
  const db = useSisStore();
  const vehicles = useVehicles();
  const drivers = useDrivers();
  const { can } = usePermissions();
  const canManage = can("transport.manageDocuments");

  const compliance = documentCompliance(db);

  const [addOpen, setAddOpen] = useState(false);
  const [subject, setSubject] = useState<"vehicle" | "driver">("vehicle");
  const [entityId, setEntityId] = useState("");
  const [vehicleDocType, setVehicleDocType] = useState<VehicleDocumentType>("insurance");
  const [driverDocType, setDriverDocType] = useState<DriverDocumentType>("license");
  const [documentNumber, setDocumentNumber] = useState("");
  const [expiryDate, setExpiryDate] = useState("");

  function vehicleName(id: string) {
    return vehicles.find((v) => v.id === id)?.registrationNumber ?? id;
  }
  function driverName(id: string) {
    return drivers.find((d) => d.id === id)?.name ?? id;
  }

  function submit() {
    if (!entityId) return;
    if (subject === "vehicle") {
      addVehicleDocument({ vehicleId: entityId, type: vehicleDocType, documentNumber: documentNumber.trim() || undefined, expiryDate: expiryDate || undefined, status: expiryDate ? "valid" : "under-review" }, ACTOR);
    } else {
      addDriverDocument({ driverId: entityId, type: driverDocType, documentNumber: documentNumber.trim() || undefined, expiryDate: expiryDate || undefined, status: expiryDate ? "valid" : "under-review" }, ACTOR);
    }
    setAddOpen(false);
    setEntityId("");
    setDocumentNumber("");
    setExpiryDate("");
  }

  const vehicleColumns: ColumnDef<VehicleComplianceRow>[] = [
    {
      id: "vehicle",
      header: "Vehicle",
      alwaysVisible: true,
      sortValue: (r) => vehicleName(r.vehicleId),
      cell: (r) => (
        <div>
          <p className="text-sm font-medium text-foreground">{vehicleName(r.vehicleId)}</p>
          {r.blocked && <p className="text-xs text-error">{r.blockedReasons.join(", ")}</p>}
        </div>
      ),
    },
    {
      id: "docs",
      header: "Documents",
      cell: (r) => (
        <div className="flex flex-wrap gap-1">
          {r.documents.map((d) => (
            <Badge key={d.id} tone={statusTone[d.effectiveStatus]}>
              {vehicleDocumentTypeLabels[d.type]}
              {d.expiryDate ? ` · ${formatDate(d.expiryDate)}` : ""}
            </Badge>
          ))}
        </div>
      ),
    },
    { id: "status", header: "Assignment", align: "right", cell: (r) => <Badge tone={r.blocked ? "error" : "success"}>{r.blocked ? "Blocked" : "Cleared"}</Badge> },
  ];

  const driverColumns: ColumnDef<DriverComplianceRow>[] = [
    {
      id: "driver",
      header: "Driver",
      alwaysVisible: true,
      sortValue: (r) => driverName(r.driverId),
      cell: (r) => (
        <div>
          <p className="text-sm font-medium text-foreground">{driverName(r.driverId)}</p>
          {r.blocked && <p className="text-xs text-error">{r.blockedReasons.join(", ")}</p>}
        </div>
      ),
    },
    {
      id: "docs",
      header: "Documents",
      cell: (r) => (
        <div className="flex flex-wrap gap-1">
          {r.documents.map((d) => (
            <Badge key={d.id} tone={statusTone[d.effectiveStatus]}>
              {driverDocumentTypeLabels[d.type]}
              {d.expiryDate ? ` · ${formatDate(d.expiryDate)}` : ""}
            </Badge>
          ))}
        </div>
      ),
    },
    { id: "status", header: "Assignment", align: "right", cell: (r) => <Badge tone={r.blocked ? "error" : "success"}>{r.blocked ? "Blocked" : "Cleared"}</Badge> },
  ];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Documents &amp; compliance</h1>
          <p className="text-xs text-muted-foreground">Vehicle and driver document expiry tracking</p>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="size-3.5" />
            Add document
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Expired documents" value={String(compliance.expiredCount)} tone={compliance.expiredCount > 0 ? "error" : "success"} />
        <StatTile label="Expiring soon" value={String(compliance.expiringSoonCount)} tone={compliance.expiringSoonCount > 0 ? "warning" : "success"} />
        <StatTile label="Vehicles blocked" value={String(compliance.blockedVehicles.length)} tone={compliance.blockedVehicles.length > 0 ? "error" : "success"} />
        <StatTile label="Drivers blocked" value={String(compliance.blockedDrivers.length)} tone={compliance.blockedDrivers.length > 0 ? "error" : "success"} />
      </div>

      {(compliance.blockedVehicles.length > 0 || compliance.blockedDrivers.length > 0) && (
        <div className="flex items-start gap-xs rounded-lg border border-error/30 bg-error/8 p-sm text-sm text-error">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" />
          <span>Vehicles/drivers with expired or missing critical documents should not be assigned to a live route until resolved.</span>
        </div>
      )}

      <Tabs defaultValue="vehicles">
        <TabsList>
          <TabsTrigger value="vehicles">Vehicles</TabsTrigger>
          <TabsTrigger value="drivers">Drivers</TabsTrigger>
        </TabsList>
        <TabsContent value="vehicles" className="mt-sm">
          <DataTable
            columns={vehicleColumns}
            rows={compliance.vehicleRows}
            getRowId={(r) => r.vehicleId}
            caption="Vehicle document compliance"
            renderMobileCard={(r) => (
              <div className="surface-3d flex flex-col gap-1 rounded-lg border border-border bg-surface p-sm">
                <div className="flex items-center justify-between gap-xs">
                  <p className="truncate text-sm font-semibold text-foreground">{vehicleName(r.vehicleId)}</p>
                  <Badge tone={r.blocked ? "error" : "success"}>{r.blocked ? "Blocked" : "Cleared"}</Badge>
                </div>
                {r.blocked && <p className="text-xs text-error">{r.blockedReasons.join(", ")}</p>}
              </div>
            )}
            emptyIcon={ScrollText}
            emptyTitle="No vehicles found"
          />
        </TabsContent>
        <TabsContent value="drivers" className="mt-sm">
          <DataTable
            columns={driverColumns}
            rows={compliance.driverRows}
            getRowId={(r) => r.driverId}
            caption="Driver document compliance"
            renderMobileCard={(r) => (
              <div className="surface-3d flex flex-col gap-1 rounded-lg border border-border bg-surface p-sm">
                <div className="flex items-center justify-between gap-xs">
                  <p className="truncate text-sm font-semibold text-foreground">{driverName(r.driverId)}</p>
                  <Badge tone={r.blocked ? "error" : "success"}>{r.blocked ? "Blocked" : "Cleared"}</Badge>
                </div>
                {r.blocked && <p className="text-xs text-error">{r.blockedReasons.join(", ")}</p>}
              </div>
            )}
            emptyIcon={ScrollText}
            emptyTitle="No drivers found"
          />
        </TabsContent>
      </Tabs>

      <DetailDrawer open={addOpen} onOpenChange={setAddOpen} title="Add document" description="Attach a compliance document to a vehicle or driver">
        <div className="flex flex-col gap-sm">
          <div>
            <Label>Subject</Label>
            <Select
              value={subject}
              onValueChange={(v) => {
                setSubject(v as "vehicle" | "driver");
                setEntityId("");
              }}
            >
              <SelectTrigger aria-label="Subject">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vehicle">Vehicle</SelectItem>
                <SelectItem value="driver">Driver</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{subject === "vehicle" ? "Vehicle" : "Driver"}</Label>
            <Select value={entityId} onValueChange={setEntityId}>
              <SelectTrigger aria-label={subject === "vehicle" ? "Vehicle" : "Driver"}>
                <SelectValue placeholder={`Select ${subject}`} />
              </SelectTrigger>
              <SelectContent>
                {subject === "vehicle"
                  ? vehicles.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.registrationNumber}
                      </SelectItem>
                    ))
                  : drivers.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Document type</Label>
            {subject === "vehicle" ? (
              <Select value={vehicleDocType} onValueChange={(v) => setVehicleDocType(v as VehicleDocumentType)}>
                <SelectTrigger aria-label="Vehicle document type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {vehicleDocTypes.map((t) => (
                    <SelectItem key={t} value={t}>
                      {vehicleDocumentTypeLabels[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Select value={driverDocType} onValueChange={(v) => setDriverDocType(v as DriverDocumentType)}>
                <SelectTrigger aria-label="Driver document type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {driverDocTypes.map((t) => (
                    <SelectItem key={t} value={t}>
                      {driverDocumentTypeLabels[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div>
            <Label htmlFor="doc-number">Document number</Label>
            <Input id="doc-number" value={documentNumber} onChange={(e) => setDocumentNumber(e.target.value)} placeholder="Optional" />
          </div>
          <div>
            <Label htmlFor="doc-expiry">Expiry date</Label>
            <Input id="doc-expiry" type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
          </div>
          <Button disabled={!entityId} onClick={submit}>
            Add document
          </Button>
        </div>
      </DetailDrawer>
    </div>
  );
}
