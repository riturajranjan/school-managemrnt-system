"use client";

// Vehicles (Phase 9M) — real PostgreSQL/API cutover. No fake "health score"
// (depended on mock maintenance/document data that doesn't exist) — dropped,
// not replaced with an invented number.
import Link from "next/link";
import { Bus, Plus } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef } from "@/components/data-table/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useTransportVehicles } from "@/lib/hooks/api/use-transport-api";
import { roleLabels } from "@/lib/permissions/roles";
import type { TransportVehicleDto, TransportVehicleStatusDto, TransportVehicleTypeDto } from "@/lib/api/contracts";

const statusTone: Record<TransportVehicleStatusDto, "success" | "warning" | "error" | "neutral"> = { active: "success", inactive: "neutral", maintenance: "warning", archived: "neutral" };
const typeLabels: Record<TransportVehicleTypeDto, string> = { bus: "Bus", "mini-bus": "Mini bus", van: "Van", car: "Car", "electric-vehicle": "Electric vehicle", "contract-vehicle": "Contract vehicle", custom: "Custom" };

export default function VehiclesPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data: vehicles, loading, error } = useTransportVehicles();

  if (!capabilitiesLoading && !hasServerPermission("transport.view")) {
    return <PermissionDenied action="view transport vehicles" role={roleLabels[role]} backHref="/" />;
  }
  const canManage = hasServerPermission("transport.manage");

  const columns: ColumnDef<TransportVehicleDto>[] = [
    {
      id: "registration",
      header: "Vehicle",
      alwaysVisible: true,
      sortValue: (v) => v.registrationNumber,
      cell: (v) => (
        <Link href={`/transport/vehicles/${v.id}`} className="min-w-0">
          <p className="text-sm font-medium text-foreground underline-offset-2 hover:underline">{v.registrationNumber}</p>
          <p className="text-xs text-muted-foreground">{[v.displayName, v.make, v.model].filter(Boolean).join(" · ") || "—"}</p>
        </Link>
      ),
    },
    { id: "type", header: "Type", cell: (v) => <Badge tone="info">{typeLabels[v.type]}</Badge> },
    { id: "capacity", header: "Capacity", align: "right", cell: (v) => <span className="text-sm text-foreground">{v.capacity}</span> },
    { id: "status", header: "Status", align: "right", cell: (v) => <Badge tone={statusTone[v.status]}>{v.status}</Badge> },
  ];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Vehicles</h1>
          <p className="text-xs text-muted-foreground">Fleet registry</p>
        </div>
        {canManage && (
          <Button asChild size="sm">
            <Link href="/transport/vehicles/new">
              <Plus className="size-3.5" />
              Add vehicle
            </Link>
          </Button>
        )}
      </div>

      {error ? (
        <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">{error}</p>
      ) : loading && vehicles.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Loading…</p>
      ) : (
        <DataTable
          columns={columns}
          rows={[...vehicles].sort((a, b) => a.registrationNumber.localeCompare(b.registrationNumber))}
          getRowId={(v) => v.id}
          caption="Vehicles"
          renderMobileCard={(v) => (
            <Link href={`/transport/vehicles/${v.id}`} className="surface-3d flex flex-col gap-1 rounded-lg border border-border bg-surface p-sm">
              <div className="flex items-center justify-between gap-xs">
                <p className="truncate text-sm font-semibold text-foreground">{v.registrationNumber}</p>
                <Badge tone={statusTone[v.status]}>{v.status}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{typeLabels[v.type]} · {v.capacity} seats</p>
            </Link>
          )}
          emptyIcon={Bus}
          emptyTitle="No vehicles yet"
        />
      )}
    </div>
  );
}
