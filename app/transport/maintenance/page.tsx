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
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useTransportMaintenance, useTransportVehicles, scheduleMaintenanceRequest, startMaintenanceRequest, completeMaintenanceRequest } from "@/lib/hooks/api/use-transport-api";
import { roleLabels } from "@/lib/permissions/roles";
import type { TransportMaintenanceRecordDto, TransportMaintenanceStatusDto, TransportMaintenanceTypeDto } from "@/lib/api/contracts";
import { formatDate } from "@/lib/utils";

const typeLabels: Record<TransportMaintenanceTypeDto, string> = { "routine-service": "Routine service", repair: "Repair", inspection: "Inspection", tyre: "Tyre", battery: "Battery", other: "Other" };
const statusLabels: Record<TransportMaintenanceStatusDto, string> = { scheduled: "Scheduled", "in-progress": "In progress", completed: "Completed", cancelled: "Cancelled" };
const typeOptions = Object.keys(typeLabels) as TransportMaintenanceTypeDto[];
const statusTone: Record<TransportMaintenanceStatusDto, "success" | "warning" | "error" | "neutral"> = { scheduled: "neutral", "in-progress": "warning", completed: "success", cancelled: "neutral" };
const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export default function MaintenancePage() {
  const { data, loading, error, reload } = useTransportMaintenance();
  const { data: vehicles } = useTransportVehicles();
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const records = data?.records ?? [];

  const [createOpen, setCreateOpen] = useState(false);
  const [vehicleId, setVehicleId] = useState("");
  const [type, setType] = useState<TransportMaintenanceTypeDto>("routine-service");
  const [scheduledDate, setScheduledDate] = useState(new Date().toISOString().slice(0, 10));
  const [vendor, setVendor] = useState("");
  const [busy, setBusy] = useState(false);

  const [completeTarget, setCompleteTarget] = useState<TransportMaintenanceRecordDto | null>(null);
  const [partsCost, setPartsCost] = useState(0);
  const [labourCost, setLabourCost] = useState(0);

  if (!capabilitiesLoading && !hasServerPermission("transport.view")) {
    return <PermissionDenied action="view transport maintenance" role={roleLabels[role]} backHref="/transport" />;
  }
  const canManage = hasServerPermission("transport.manage");

  const columns: ColumnDef<TransportMaintenanceRecordDto>[] = [
    {
      id: "vehicle",
      header: "Vehicle",
      alwaysVisible: true,
      sortValue: (m) => m.vehicleRegistration,
      cell: (m) => (
        <div>
          <p className="text-sm font-medium text-foreground">{m.vehicleRegistration}</p>
          <p className="text-xs capitalize text-muted-foreground">{typeLabels[m.type]}</p>
        </div>
      ),
    },
    { id: "scheduled", header: "Scheduled", cell: (m) => <span className="text-sm text-muted-foreground">{formatDate(m.scheduledDate)}</span> },
    { id: "cost", header: "Cost", align: "right", cell: (m) => <span className="text-sm text-foreground">{rupees(m.totalCost)}</span> },
    {
      id: "status",
      header: "Status",
      align: "right",
      cell: (m) => (
        <div className="flex items-center justify-end gap-1">
          {m.overdue && <Badge tone="error">Overdue</Badge>}
          <Badge tone={statusTone[m.status]}>{statusLabels[m.status]}</Badge>
        </div>
      ),
    },
  ];

  async function start(id: string) {
    setBusy(true);
    const result = await startMaintenanceRequest(id);
    setBusy(false);
    if (result.success) reload();
  }

  const rowActions: RowAction<TransportMaintenanceRecordDto>[] = canManage
    ? [
        { key: "start", label: "Start work", hidden: (m) => m.status !== "scheduled", onSelect: (m) => void start(m.id) },
        {
          key: "complete",
          label: "Complete",
          hidden: (m) => m.status === "completed" || m.status === "cancelled",
          onSelect: (m) => {
            setCompleteTarget(m);
            setPartsCost(0);
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

      {error ? (
        <div className="rounded-lg border border-error/30 bg-error/5 p-md text-sm text-error" role="alert">
          Could not load maintenance records: {error}
          <Button variant="outline" size="sm" className="ml-sm" onClick={reload}>
            Retry
          </Button>
        </div>
      ) : loading && !data ? (
        <div className="rounded-lg border border-border bg-surface p-2xl text-center text-sm text-muted-foreground">Loading maintenance records…</div>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 gap-sm sm:grid-cols-3">
            <StatTile label="Scheduled / in progress" value={String(data.insights.scheduledOrInProgressCount)} tone="neutral" />
            <StatTile label="Overdue" value={String(data.insights.overdueCount)} tone={data.insights.overdueCount > 0 ? "error" : "success"} />
            <StatTile label="Completed cost this month" value={rupees(data.insights.completedCostThisMonth)} tone="neutral" />
          </div>

          <DataTable
            columns={columns}
            rows={records}
            getRowId={(m) => m.id}
            caption="Maintenance records"
            rowActions={rowActions}
            renderMobileCard={(m) => (
              <div className="surface-3d flex flex-col gap-1 rounded-lg border border-border bg-surface p-sm">
                <div className="flex items-center justify-between gap-xs">
                  <p className="truncate text-sm font-semibold text-foreground">{m.vehicleRegistration}</p>
                  <Badge tone={statusTone[m.status]}>{statusLabels[m.status]}</Badge>
                </div>
                <p className="text-xs capitalize text-muted-foreground">
                  {typeLabels[m.type]} · {formatDate(m.scheduledDate)}
                </p>
              </div>
            )}
            emptyIcon={Wrench}
            emptyTitle="No maintenance records"
          />
        </>
      ) : null}

      <DetailDrawer open={createOpen} onOpenChange={setCreateOpen} title="Schedule maintenance" description="Creates a scheduled work order for a vehicle">
        <div className="flex flex-col gap-sm">
          <div>
            <Label>Vehicle</Label>
            <Select value={vehicleId} onValueChange={setVehicleId}>
              <SelectTrigger aria-label="Vehicle">
                <SelectValue placeholder="Select vehicle" />
              </SelectTrigger>
              <SelectContent>
                {(vehicles ?? []).map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.registrationNumber}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as TransportMaintenanceTypeDto)}>
              <SelectTrigger aria-label="Maintenance type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {typeOptions.map((t) => (
                  <SelectItem key={t} value={t}>
                    {typeLabels[t]}
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
            disabled={!vehicleId || busy}
            onClick={async () => {
              setBusy(true);
              const result = await scheduleMaintenanceRequest({ vehicleId, type, scheduledDate, vendor: vendor.trim() || undefined });
              setBusy(false);
              if (result.success) {
                setCreateOpen(false);
                setVehicleId("");
                setVendor("");
                reload();
              }
            }}
          >
            Schedule
          </Button>
        </div>
      </DetailDrawer>

      <DetailDrawer open={!!completeTarget} onOpenChange={(open) => !open && setCompleteTarget(null)} title="Complete maintenance" description={completeTarget?.vehicleRegistration}>
        <div className="flex flex-col gap-sm">
          <div>
            <Label htmlFor="maint-cost">Parts cost (₹)</Label>
            <Input id="maint-cost" type="number" min={0} value={partsCost} onChange={(e) => setPartsCost(Number(e.target.value))} />
          </div>
          <div>
            <Label htmlFor="maint-labour">Labour cost (₹)</Label>
            <Input id="maint-labour" type="number" min={0} value={labourCost} onChange={(e) => setLabourCost(Number(e.target.value))} />
          </div>
          <Button
            disabled={busy}
            onClick={async () => {
              if (!completeTarget) return;
              setBusy(true);
              const result = await completeMaintenanceRequest(completeTarget.id, { partsCost, labourCost });
              setBusy(false);
              if (result.success) {
                setCompleteTarget(null);
                reload();
              }
            }}
          >
            Mark completed
          </Button>
        </div>
      </DetailDrawer>
    </div>
  );
}
