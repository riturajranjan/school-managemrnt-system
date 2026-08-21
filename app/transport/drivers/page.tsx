"use client";

// Drivers (Phase 9M) — real PostgreSQL/API cutover. A VIEW over real Staff
// currently on active driver duty (via TransportRouteAssignment) — never a
// parallel Driver identity. No fake "safety score" (depended on mock
// incident data that doesn't exist). To assign a NEW driver, use a route's
// "Assign vehicle & crew" action — any real, active Staff member is
// eligible, not just staff already listed here.
import Link from "next/link";
import { UserCog } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef } from "@/components/data-table/types";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useCurrentTransportStaff } from "@/lib/hooks/api/use-transport-api";
import { roleLabels } from "@/lib/permissions/roles";
import type { CurrentTransportStaffDto } from "@/lib/api/contracts";

export default function DriversPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data: drivers, loading, error } = useCurrentTransportStaff("driver");

  if (!capabilitiesLoading && !hasServerPermission("transport.view")) {
    return <PermissionDenied action="view drivers" role={roleLabels[role]} backHref="/" />;
  }

  const columns: ColumnDef<CurrentTransportStaffDto>[] = [
    {
      id: "name", header: "Driver", alwaysVisible: true, sortValue: (d) => d.staffName,
      cell: (d) => (
        <Link href={`/hr/staff/${d.staffId}`} className="text-sm font-medium text-foreground underline-offset-2 hover:underline">
          {d.staffName}
        </Link>
      ),
    },
    { id: "route", header: "Driving route", cell: (d) => <Link href={`/transport/routes/${d.routeId}`} className="text-sm text-muted-foreground hover:underline">{d.routeName}</Link> },
  ];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Drivers</h1>
        <p className="text-xs text-muted-foreground">Staff currently on active driving duty</p>
      </div>

      {error ? (
        <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">{error}</p>
      ) : loading && drivers.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Loading…</p>
      ) : (
        <DataTable
          columns={columns}
          rows={drivers}
          getRowId={(d) => `${d.staffId}-${d.routeId}`}
          caption="Drivers"
          renderMobileCard={(d) => (
            <Link href={`/hr/staff/${d.staffId}`} className="surface-3d flex flex-col gap-1 rounded-lg border border-border bg-surface p-sm">
              <p className="truncate text-sm font-semibold text-foreground">{d.staffName}</p>
              <p className="text-xs text-muted-foreground">{d.routeName}</p>
            </Link>
          )}
          emptyIcon={UserCog}
          emptyTitle="No drivers currently assigned"
        />
      )}
    </div>
  );
}
