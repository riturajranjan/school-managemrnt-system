"use client";

// Routes (Phase 9M) — real PostgreSQL/API cutover.
import Link from "next/link";
import { Plus, Route as RouteIcon } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef } from "@/components/data-table/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useTransportRoutes } from "@/lib/hooks/api/use-transport-api";
import { roleLabels } from "@/lib/permissions/roles";
import type { TransportRouteListItemDto, TransportRouteStatusDto } from "@/lib/api/contracts";

const statusTone: Record<TransportRouteStatusDto, "success" | "warning" | "neutral"> = { draft: "neutral", active: "success", paused: "warning", archived: "neutral" };

export default function RoutesPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data: routes, loading, error } = useTransportRoutes();

  if (!capabilitiesLoading && !hasServerPermission("transport.view")) {
    return <PermissionDenied action="view transport routes" role={roleLabels[role]} backHref="/" />;
  }
  const canManage = hasServerPermission("transport.manage");

  const columns: ColumnDef<TransportRouteListItemDto>[] = [
    {
      id: "name", header: "Route", alwaysVisible: true, sortValue: (r) => r.name,
      cell: (r) => (
        <Link href={`/transport/routes/${r.id}`} className="min-w-0">
          <p className="text-sm font-medium text-foreground underline-offset-2 hover:underline">{r.name}</p>
          <p className="text-xs text-muted-foreground">{r.code}</p>
        </Link>
      ),
    },
    { id: "shift", header: "Shift", cell: (r) => <Badge tone="info">{r.shift}</Badge>, defaultVisible: false },
    { id: "vehicle", header: "Vehicle", cell: (r) => <span className="text-sm text-muted-foreground">{r.vehicle?.registrationNumber ?? "—"}</span> },
    { id: "driver", header: "Driver", cell: (r) => <span className="text-sm text-muted-foreground">{r.driver?.name ?? "—"}</span>, defaultVisible: false },
    { id: "students", header: "Students", align: "right", sortValue: (r) => r.studentCount, cell: (r) => <span className="text-sm text-foreground">{r.studentCount}{r.capacity ? `/${r.capacity}` : ""}</span> },
    { id: "status", header: "Status", align: "right", cell: (r) => <Badge tone={statusTone[r.status]}>{r.status}</Badge> },
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

      {error ? (
        <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">{error}</p>
      ) : loading && routes.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Loading…</p>
      ) : (
        <DataTable
          columns={columns}
          rows={[...routes].sort((a, b) => a.code.localeCompare(b.code))}
          getRowId={(r) => r.id}
          caption="Routes"
          renderMobileCard={(r) => (
            <Link href={`/transport/routes/${r.id}`} className="surface-3d flex flex-col gap-1 rounded-lg border border-border bg-surface p-sm">
              <div className="flex items-center justify-between gap-xs">
                <p className="truncate text-sm font-semibold text-foreground">{r.name}</p>
                <Badge tone={statusTone[r.status]}>{r.status}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{r.code} · {r.vehicle?.registrationNumber ?? "No vehicle"} · {r.studentCount} students</p>
            </Link>
          )}
          emptyIcon={RouteIcon}
          emptyTitle="No routes yet"
        />
      )}
    </div>
  );
}
