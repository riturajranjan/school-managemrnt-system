"use client";

// Attendants (Phase 9M) — real PostgreSQL/API cutover. A VIEW over real
// Staff currently on active attendant duty (via TransportRouteAssignment) —
// never a parallel Attendant identity.
import Link from "next/link";
import { Users } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef } from "@/components/data-table/types";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useCurrentTransportStaff } from "@/lib/hooks/api/use-transport-api";
import { roleLabels } from "@/lib/permissions/roles";
import type { CurrentTransportStaffDto } from "@/lib/api/contracts";

export default function AttendantsPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data: attendants, loading, error } = useCurrentTransportStaff("attendant");

  if (!capabilitiesLoading && !hasServerPermission("transport.view")) {
    return <PermissionDenied action="view attendants" role={roleLabels[role]} backHref="/" />;
  }

  const columns: ColumnDef<CurrentTransportStaffDto>[] = [
    {
      id: "name", header: "Attendant", alwaysVisible: true, sortValue: (a) => a.staffName,
      cell: (a) => (
        <Link href={`/hr/staff/${a.staffId}`} className="text-sm font-medium text-foreground underline-offset-2 hover:underline">
          {a.staffName}
        </Link>
      ),
    },
    { id: "route", header: "Route", cell: (a) => <Link href={`/transport/routes/${a.routeId}`} className="text-sm text-muted-foreground hover:underline">{a.routeName}</Link> },
  ];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Attendants</h1>
        <p className="text-xs text-muted-foreground">Staff currently on active attendant duty</p>
      </div>

      {error ? (
        <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">{error}</p>
      ) : loading && attendants.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Loading…</p>
      ) : (
        <DataTable
          columns={columns}
          rows={attendants}
          getRowId={(a) => `${a.staffId}-${a.routeId}`}
          caption="Attendants"
          renderMobileCard={(a) => (
            <Link href={`/hr/staff/${a.staffId}`} className="surface-3d flex flex-col gap-1 rounded-lg border border-border bg-surface p-sm">
              <p className="truncate text-sm font-semibold text-foreground">{a.staffName}</p>
              <p className="text-xs text-muted-foreground">{a.routeName}</p>
            </Link>
          )}
          emptyIcon={Users}
          emptyTitle="No attendants currently assigned"
        />
      )}
    </div>
  );
}
