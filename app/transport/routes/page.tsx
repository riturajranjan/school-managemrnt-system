"use client";

import Link from "next/link";
import { Plus, Route as RouteIcon } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef } from "@/components/data-table/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useTransportRoutes } from "@/lib/hooks/use-transport";
import { useSisStore } from "@/lib/hooks/use-store";
import { routeStatusLabels, routeTypeLabels, transportShiftLabels, type RouteStatus, type TransportRoute } from "@/lib/types/transport";

const statusTone: Record<RouteStatus, "success" | "warning" | "error" | "neutral"> = {
  draft: "neutral",
  active: "success",
  paused: "warning",
  temporary: "warning",
  "under-review": "warning",
  archived: "neutral",
};

export default function RoutesPage() {
  const routes = useTransportRoutes();
  const db = useSisStore();
  const { can } = usePermissions();
  const canManage = can("transport.manageRoutes");

  function vehicleFor(routeId: string) {
    const route = db.transportRoutes.find((r) => r.id === routeId);
    return db.vehicles.find((v) => v.id === route?.assignedVehicleId);
  }

  function driverFor(routeId: string) {
    const route = db.transportRoutes.find((r) => r.id === routeId);
    return db.drivers.find((d) => d.id === route?.primaryDriverId);
  }

  function studentCount(routeId: string) {
    return db.studentTransportAssignments.filter((a) => a.routeId === routeId && a.status === "active").length;
  }

  const columns: ColumnDef<TransportRoute>[] = [
    {
      id: "name",
      header: "Route",
      alwaysVisible: true,
      sortValue: (r) => r.name,
      cell: (r) => (
        <Link href={`/transport/routes/${r.id}`} className="min-w-0">
          <p className="text-sm font-medium text-foreground underline-offset-2 hover:underline">{r.name}</p>
          <p className="text-xs text-muted-foreground">
            {r.code} · {routeTypeLabels[r.type]}
          </p>
        </Link>
      ),
    },
    { id: "shift", header: "Shift", cell: (r) => <Badge tone="info">{transportShiftLabels[r.shift]}</Badge>, defaultVisible: false },
    { id: "vehicle", header: "Vehicle", cell: (r) => <span className="text-sm text-muted-foreground">{vehicleFor(r.id)?.registrationNumber ?? "—"}</span> },
    { id: "driver", header: "Driver", cell: (r) => <span className="text-sm text-muted-foreground">{driverFor(r.id)?.name ?? "—"}</span>, defaultVisible: false },
    { id: "students", header: "Students", align: "right", sortValue: (r) => studentCount(r.id), cell: (r) => <span className="text-sm text-foreground">{studentCount(r.id)}/{r.maxCapacity}</span> },
    { id: "status", header: "Status", align: "right", cell: (r) => <Badge tone={statusTone[r.status]}>{routeStatusLabels[r.status]}</Badge> },
  ];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Routes</h1>
          <p className="text-xs text-muted-foreground">Route builder, stops, vehicle and driver assignment</p>
        </div>
        {canManage && (
          <Button asChild size="sm">
            <Link href="/transport/routes/new">
              <Plus className="size-3.5" />
              New route
            </Link>
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={[...routes].sort((a, b) => a.code.localeCompare(b.code))}
        getRowId={(r) => r.id}
        caption="Routes"
        renderMobileCard={(r) => (
          <Link href={`/transport/routes/${r.id}`} className="surface-3d flex flex-col gap-1 rounded-lg border border-border bg-surface p-sm">
            <div className="flex items-center justify-between gap-xs">
              <p className="truncate text-sm font-semibold text-foreground">{r.name}</p>
              <Badge tone={statusTone[r.status]}>{routeStatusLabels[r.status]}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {r.code} · {vehicleFor(r.id)?.registrationNumber ?? "No vehicle"} · {studentCount(r.id)}/{r.maxCapacity} students
            </p>
          </Link>
        )}
        emptyIcon={RouteIcon}
        emptyTitle="No routes yet"
      />
    </div>
  );
}
