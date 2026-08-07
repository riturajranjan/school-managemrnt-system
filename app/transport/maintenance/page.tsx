"use client";

import { useState } from "react";
import { Plus, Wrench } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef, RowAction } from "@/components/data-table/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatTile } from "@/components/ui/stat-tile";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useMaintenanceRecords, useVehicles } from "@/lib/hooks/use-transport";
import { formatMoney, moneyFromMajor } from "@/lib/finance/money";
import { useSisStore } from "@/lib/hooks/use-store";
import { maintenanceInsights } from "@/lib/selectors/maintenance-insights";
import { completeMaintenance, scheduleMaintenance, setMaintenanceStatus } from "@/lib/services/maintenance-service";
import { maintenanceStatusLabels, maintenanceTypeLabels, type MaintenanceRecord, type MaintenanceStatus, type MaintenanceType } from "@/lib/types/transport";
import { formatDate } from "@/lib/utils";

const ACTOR = { name: "Mechanic", role: "Mechanic" };
const typeOptions = Object.keys(maintenanceTypeLabels) as MaintenanceType[];

const statusTone: Record<MaintenanceStatus, "success" | "warning" | "error" | "neutral"> = {
  scheduled: "neutral",
  "due-soon": "warning",
  overdue: "error",
  "in-progress": "warning",
  completed: "success",
  cancelled: "neutral",
};

export default function MaintenancePage() {
  const records = useMaintenanceRecords();
  const vehicles = useVehicles();
  const db = useSisStore();
  const { can } = usePermissions();
  const canManage = can("transport.manageMaintenance");

  const insights = maintenanceInsights(db);

  const [createOpen, setCreateOpen] = useState(false);
  const [vehicleId, setVehicleId] = useState("");
  const [type, setType] = useState<MaintenanceType>("routine-service");
  const [scheduledDate, setScheduledDate] = useState(new Date().toISOString().slice(0, 10));
  const [vendor, setVendor] = useState("");

  const [completeTarget, setCompleteTarget] = useState<MaintenanceRecord | null>(null);
  const [cost, setCost] = useState(0);
  const [labourCost, setLabourCost] = useState(0);

  function vehicleName(id: string) {
    return vehicles.find((v) => v.id === id)?.registrationNumber ?? id;
  }

  const columns: ColumnDef<MaintenanceRecord>[] = [
    {
      id: "vehicle",
      header: "Vehicle",
      alwaysVisible: true,
      sortValue: (m) => vehicleName(m.vehicleId),
      cell: (m) => (
        <div>
          <p className="text-sm font-medium text-foreground">{vehicleName(m.vehicleId)}</p>
          <p className="text-xs capitalize text-muted-foreground">{maintenanceTypeLabels[m.type]}</p>
        </div>
      ),
    },
    { id: "scheduled", header: "Scheduled", cell: (m) => <span className="text-sm text-muted-foreground">{formatDate(m.scheduledDate)}</span> },
    { id: "cost", header: "Cost", align: "right", cell: (m) => <span className="text-sm text-foreground">{formatMoney({ minorUnits: m.cost.minorUnits + m.labourCost.minorUnits, currency: "INR" })}</span> },
    { id: "status", header: "Status", align: "right", cell: (m) => <Badge tone={statusTone[m.status]}>{maintenanceStatusLabels[m.status]}</Badge> },
  ];

  const rowActions: RowAction<MaintenanceRecord>[] = canManage
    ? [
        { key: "start", label: "Start work", hidden: (m) => m.status === "in-progress" || m.status === "completed" || m.status === "cancelled", onSelect: (m) => setMaintenanceStatus(m.id, "in-progress", ACTOR) },
        {
          key: "complete",
          label: "Complete",
          hidden: (m) => m.status === "completed" || m.status === "cancelled",
          onSelect: (m) => {
            setCompleteTarget(m);
            setCost(0);
            setLabourCost(0);
          },
        },
      ]
    : [];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Maintenance</h1>
          <p className="text-xs text-muted-foreground">Service schedule, repairs and cost tracking</p>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-3.5" />
            Schedule maintenance
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Due this week" value={String(insights.dueThisWeek.length)} tone={insights.dueThisWeek.length > 0 ? "warning" : "success"} />
        <StatTile label="Overdue" value={String(insights.overdue.length)} tone={insights.overdue.length > 0 ? "error" : "success"} />
        <StatTile label="Vehicles unavailable" value={String(insights.vehiclesUnavailable.length)} tone={insights.vehiclesUnavailable.length > 0 ? "warning" : "success"} />
        <StatTile label="Actual cost (completed)" value={formatMoney(insights.actualCost, { compact: true })} tone="neutral" />
      </div>

      {insights.repeatBreakdownVehicles.length > 0 && (
        <div className="rounded-lg border border-error/30 bg-error/8 p-sm text-sm text-error">
          {insights.repeatBreakdownVehicles.length} vehicle(s) with repeat breakdowns: {insights.repeatBreakdownVehicles.map((r) => vehicleName(r.vehicleId)).join(", ")}
        </div>
      )}

      <DataTable
        columns={columns}
        rows={[...records].sort((a, b) => (a.scheduledDate < b.scheduledDate ? 1 : -1))}
        getRowId={(m) => m.id}
        caption="Maintenance records"
        rowActions={rowActions}
        renderMobileCard={(m) => (
          <div className="surface-3d flex flex-col gap-1 rounded-lg border border-border bg-surface p-sm">
            <div className="flex items-center justify-between gap-xs">
              <p className="truncate text-sm font-semibold text-foreground">{vehicleName(m.vehicleId)}</p>
              <Badge tone={statusTone[m.status]}>{maintenanceStatusLabels[m.status]}</Badge>
            </div>
            <p className="text-xs capitalize text-muted-foreground">
              {maintenanceTypeLabels[m.type]} · {formatDate(m.scheduledDate)}
            </p>
          </div>
        )}
        emptyIcon={Wrench}
        emptyTitle="No maintenance records"
      />

      <DetailDrawer open={createOpen} onOpenChange={setCreateOpen} title="Schedule maintenance" description="Creates a scheduled work order for a vehicle">
        <div className="flex flex-col gap-sm">
          <div>
            <Label>Vehicle</Label>
            <Select value={vehicleId} onValueChange={setVehicleId}>
              <SelectTrigger aria-label="Vehicle">
                <SelectValue placeholder="Select vehicle" />
              </SelectTrigger>
              <SelectContent>
                {vehicles.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.registrationNumber}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as MaintenanceType)}>
              <SelectTrigger aria-label="Maintenance type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {typeOptions.map((t) => (
                  <SelectItem key={t} value={t}>
                    {maintenanceTypeLabels[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="maint-date">Scheduled date</Label>
            <Input id="maint-date" type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="maint-vendor">Vendor</Label>
            <Input id="maint-vendor" value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="Optional" />
          </div>
          <Button
            disabled={!vehicleId}
            onClick={() => {
              scheduleMaintenance({ vehicleId, type, scheduledDate, vendor: vendor.trim() || undefined, cost: moneyFromMajor(0, "INR"), labourCost: moneyFromMajor(0, "INR"), parts: [] }, ACTOR);
              setCreateOpen(false);
              setVehicleId("");
              setVendor("");
            }}
          >
            Schedule
          </Button>
        </div>
      </DetailDrawer>

      <DetailDrawer open={!!completeTarget} onOpenChange={(open) => !open && setCompleteTarget(null)} title="Complete maintenance" description={completeTarget ? vehicleName(completeTarget.vehicleId) : undefined}>
        <div className="flex flex-col gap-sm">
          <div>
            <Label htmlFor="maint-cost">Parts cost (₹)</Label>
            <Input id="maint-cost" type="number" min={0} value={cost} onChange={(e) => setCost(Number(e.target.value))} />
          </div>
          <div>
            <Label htmlFor="maint-labour">Labour cost (₹)</Label>
            <Input id="maint-labour" type="number" min={0} value={labourCost} onChange={(e) => setLabourCost(Number(e.target.value))} />
          </div>
          <Button
            onClick={() => {
              if (completeTarget) completeMaintenance(completeTarget.id, { cost: moneyFromMajor(cost, "INR"), labourCost: moneyFromMajor(labourCost, "INR") }, ACTOR);
              setCompleteTarget(null);
            }}
          >
            Mark completed
          </Button>
        </div>
      </DetailDrawer>
    </div>
  );
}
