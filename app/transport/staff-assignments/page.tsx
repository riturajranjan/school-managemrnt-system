"use client";

// Staff transport assignments (Phase 9M) — real PostgreSQL/API cutover.
import { useState } from "react";
import { Plus, UserCog } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef, RowAction } from "@/components/data-table/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useStaffList } from "@/lib/hooks/api/use-staff-api";
import { assignStaffTransportRequest, useRouteStops, useStaffTransportAssignments, useTransportRoutes, withdrawStaffTransportRequest } from "@/lib/hooks/api/use-transport-api";
import { roleLabels } from "@/lib/permissions/roles";
import type { StaffTransportAssignmentDto, StudentTransportStatusDto } from "@/lib/api/contracts";

const statusTone: Record<StudentTransportStatusDto, "success" | "warning" | "error" | "neutral"> = { active: "success", suspended: "warning", withdrawn: "error" };

export default function StaffAssignmentsPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data: assignments, loading, error, reload } = useStaffTransportAssignments();
  const { data: staff } = useStaffList({ status: "active", pageSize: 200 });
  const { data: routes } = useTransportRoutes({ status: "active" });

  const [createOpen, setCreateOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [staffId, setStaffId] = useState("");
  const [routeId, setRouteId] = useState("");
  const [pickupStopId, setPickupStopId] = useState("");
  const { data: routeStops } = useRouteStops(routeId || undefined);

  if (!capabilitiesLoading && !hasServerPermission("transport.view")) {
    return <PermissionDenied action="view staff transport assignments" role={roleLabels[role]} backHref="/" />;
  }
  const canManage = hasServerPermission("transport.manage");

  const columns: ColumnDef<StaffTransportAssignmentDto>[] = [
    { id: "staff", header: "Staff", alwaysVisible: true, sortValue: (a) => a.staffName, cell: (a) => <p className="text-sm font-medium text-foreground">{a.staffName}</p> },
    { id: "route", header: "Route", cell: (a) => <span className="text-sm text-muted-foreground">{a.routeName}</span> },
    { id: "stop", header: "Pickup stop", cell: (a) => <span className="text-sm text-muted-foreground">{a.pickupStopName}</span>, defaultVisible: false },
    { id: "status", header: "Status", align: "right", cell: (a) => <Badge tone={statusTone[a.status]}>{a.status}</Badge> },
  ];

  const rowActions: RowAction<StaffTransportAssignmentDto>[] = canManage
    ? [{ key: "withdraw", label: "Withdraw", hidden: (a) => a.status !== "active", destructive: true, onSelect: async (a) => { await withdrawStaffTransportRequest(a.id); reload(); } }]
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

      {error ? (
        <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">{error}</p>
      ) : loading && assignments.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Loading…</p>
      ) : (
        <DataTable
          columns={columns}
          rows={[...assignments].sort((a, b) => b.createdAt.localeCompare(a.createdAt))}
          getRowId={(a) => a.id}
          caption="Staff transport assignments"
          rowActions={rowActions}
          renderMobileCard={(a) => (
            <div className="surface-3d flex flex-col gap-1 rounded-lg border border-border bg-surface p-sm">
              <div className="flex items-center justify-between gap-xs">
                <p className="truncate text-sm font-semibold text-foreground">{a.staffName}</p>
                <Badge tone={statusTone[a.status]}>{a.status}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{a.routeName} · {a.pickupStopName}</p>
            </div>
          )}
          emptyIcon={UserCog}
          emptyTitle="No staff transport assignments yet"
        />
      )}

      <DetailDrawer open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) setSaveError(null); }} title="Assign staff transport" description="Real Staff, route and stop">
        <div className="flex flex-col gap-sm">
          {saveError && <p className="text-xs text-error">{saveError}</p>}
          <div>
            <Label>Staff</Label>
            <Select value={staffId} onValueChange={setStaffId}>
              <SelectTrigger aria-label="Staff"><SelectValue placeholder="Select staff" /></SelectTrigger>
              <SelectContent>
                {staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Route</Label>
            <Select value={routeId} onValueChange={(v) => { setRouteId(v); setPickupStopId(""); }}>
              <SelectTrigger aria-label="Route"><SelectValue placeholder="Select route" /></SelectTrigger>
              <SelectContent>
                {routes.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Stop</Label>
            <Select value={pickupStopId} onValueChange={setPickupStopId} disabled={!routeId}>
              <SelectTrigger aria-label="Stop"><SelectValue placeholder="Select stop" /></SelectTrigger>
              <SelectContent>
                {(routeStops ?? []).map((rs) => <SelectItem key={rs.stopId} value={rs.stopId}>{rs.stopName}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button
            disabled={!staffId || !routeId || !pickupStopId}
            onClick={async () => {
              const res = await assignStaffTransportRequest({ staffId, routeId, pickupStopId });
              if (!res.success) { setSaveError(res.error.message); return; }
              setCreateOpen(false);
              setStaffId(""); setRouteId(""); setPickupStopId("");
              reload();
            }}
          >
            Assign transport
          </Button>
        </div>
      </DetailDrawer>
    </div>
  );
}
