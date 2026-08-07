"use client";

import { useState } from "react";
import { Plus, UserCog } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef, RowAction } from "@/components/data-table/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useTeachers } from "@/lib/hooks/use-academics";
import { useRouteStops, useTransportRoutes } from "@/lib/hooks/use-transport";
import { useSisStore } from "@/lib/hooks/use-store";
import { assignStaffTransport, setStaffAssignmentStatus } from "@/lib/services/staff-transport-service";
import { transportAssignmentStatusLabels, type StaffTransportAssignment, type TransportAssignmentStatus } from "@/lib/types/transport";

const ACTOR = { name: "Transport Administrator", role: "Transport Administrator" };

const statusTone: Record<TransportAssignmentStatus, "success" | "warning" | "error" | "neutral"> = {
  active: "success",
  suspended: "warning",
  withdrawn: "error",
  expired: "neutral",
};

export default function StaffAssignmentsPage() {
  const db = useSisStore();
  const teachers = useTeachers();
  const routes = useTransportRoutes();
  const { can } = usePermissions();
  const canManage = can("transport.assignStudents");

  const [createOpen, setCreateOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [staffId, setStaffId] = useState("");
  const [routeId, setRouteId] = useState("");
  const [pickupStopId, setPickupStopId] = useState("");

  const selectedRouteStops = useRouteStops(routeId);

  function routeName(id: string) {
    return routes.find((r) => r.id === id)?.name ?? id;
  }
  function stopName(id: string) {
    return db.transportStops.find((s) => s.id === id)?.name ?? id;
  }

  const columns: ColumnDef<StaffTransportAssignment>[] = [
    {
      id: "staff",
      header: "Staff member",
      alwaysVisible: true,
      sortValue: (a) => a.staffName,
      cell: (a) => (
        <div>
          <p className="text-sm font-medium text-foreground">{a.staffName}</p>
          <p className="text-xs text-muted-foreground">{routeName(a.routeId)}</p>
        </div>
      ),
    },
    { id: "stop", header: "Pickup stop", cell: (a) => <span className="text-sm text-muted-foreground">{stopName(a.pickupStopId)}</span> },
    { id: "status", header: "Status", align: "right", cell: (a) => <Badge tone={statusTone[a.status]}>{transportAssignmentStatusLabels[a.status]}</Badge> },
  ];

  const rowActions: RowAction<StaffTransportAssignment>[] = canManage
    ? [{ key: "withdraw", label: "Withdraw", hidden: (a) => a.status !== "active", destructive: true, onSelect: (a) => setStaffAssignmentStatus(a.id, "withdrawn", ACTOR, "Withdrawn by transport office") }]
    : [];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Staff transport assignments</h1>
          <p className="text-xs text-muted-foreground">Assign teachers and staff to routes</p>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-3.5" />
            Assign staff
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={[...db.staffTransportAssignments].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))}
        getRowId={(a) => a.id}
        caption="Staff transport assignments"
        rowActions={rowActions}
        renderMobileCard={(a) => (
          <div className="surface-3d flex flex-col gap-1 rounded-lg border border-border bg-surface p-sm">
            <div className="flex items-center justify-between gap-xs">
              <p className="truncate text-sm font-semibold text-foreground">{a.staffName}</p>
              <Badge tone={statusTone[a.status]}>{transportAssignmentStatusLabels[a.status]}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {routeName(a.routeId)} · {stopName(a.pickupStopId)}
            </p>
          </div>
        )}
        emptyIcon={UserCog}
        emptyTitle="No staff transport assignments"
      />

      <DetailDrawer
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setError(null);
        }}
        title="Assign staff transport"
        description="One active assignment per staff member"
      >
        <div className="flex flex-col gap-sm">
          {error && <p className="text-xs text-error">{error}</p>}
          <div>
            <Label>Staff member</Label>
            <Select value={staffId} onValueChange={setStaffId}>
              <SelectTrigger aria-label="Staff member">
                <SelectValue placeholder="Select staff member" />
              </SelectTrigger>
              <SelectContent>
                {teachers.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Route</Label>
            <Select
              value={routeId}
              onValueChange={(v) => {
                setRouteId(v);
                setPickupStopId("");
              }}
            >
              <SelectTrigger aria-label="Route">
                <SelectValue placeholder="Select route" />
              </SelectTrigger>
              <SelectContent>
                {routes
                  .filter((r) => r.status === "active")
                  .map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Pickup stop</Label>
            <Select value={pickupStopId} onValueChange={setPickupStopId} disabled={!routeId}>
              <SelectTrigger aria-label="Stop">
                <SelectValue placeholder="Select stop" />
              </SelectTrigger>
              <SelectContent>
                {selectedRouteStops.map((rs) => (
                  <SelectItem key={rs.stopId} value={rs.stopId}>
                    {stopName(rs.stopId)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            disabled={!staffId || !routeId || !pickupStopId}
            onClick={() => {
              const teacher = teachers.find((t) => t.id === staffId)!;
              const route = routes.find((r) => r.id === routeId)!;
              const result = assignStaffTransport({ staffName: teacher.name, staffId: teacher.id, routeId, pickupStopId, shift: route.shift, effectiveFrom: new Date().toISOString().slice(0, 10) }, ACTOR);
              if (!result.ok) {
                setError(result.error);
                return;
              }
              setCreateOpen(false);
              setStaffId("");
              setRouteId("");
              setPickupStopId("");
            }}
          >
            Assign staff
          </Button>
        </div>
      </DetailDrawer>
    </div>
  );
}
