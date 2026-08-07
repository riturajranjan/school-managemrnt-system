"use client";

import Link from "next/link";
import { Bus, Plus } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef } from "@/components/data-table/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useVehicles } from "@/lib/hooks/use-transport";
import { useSisStore } from "@/lib/hooks/use-store";
import { computeVehicleHealth } from "@/lib/selectors/vehicle-health";
import { vehicleStatusLabels, vehicleTypeLabels, type Vehicle, type VehicleStatus } from "@/lib/types/transport";

const statusTone: Record<VehicleStatus, "success" | "warning" | "error" | "neutral"> = {
  available: "success",
  assigned: "success",
  "in-service": "success",
  maintenance: "warning",
  breakdown: "error",
  "documents-expired": "error",
  inactive: "neutral",
  retired: "neutral",
};

export default function VehiclesPage() {
  const vehicles = useVehicles();
  const db = useSisStore();
  const { can } = usePermissions();
  const canManage = can("transport.manageVehicles");

  const columns: ColumnDef<Vehicle>[] = [
    {
      id: "registration",
      header: "Vehicle",
      alwaysVisible: true,
      sortValue: (v) => v.registrationNumber,
      cell: (v) => (
        <Link href={`/transport/vehicles/${v.id}`} className="min-w-0">
          <p className="text-sm font-medium text-foreground underline-offset-2 hover:underline">{v.registrationNumber}</p>
          <p className="text-xs text-muted-foreground">
            {v.fleetNumber} · {v.make} {v.model}
          </p>
        </Link>
      ),
    },
    { id: "type", header: "Type", cell: (v) => <Badge tone="info">{vehicleTypeLabels[v.type]}</Badge> },
    { id: "capacity", header: "Capacity", align: "right", cell: (v) => <span className="text-sm text-foreground">{v.capacity}</span> },
    {
      id: "health",
      header: "Health",
      align: "right",
      sortValue: (v) => computeVehicleHealth(db, v).score,
      cell: (v) => {
        const health = computeVehicleHealth(db, v);
        return <span className={`text-sm font-medium ${health.score >= 80 ? "text-success" : health.score >= 60 ? "text-warning" : "text-error"}`}>{health.score}</span>;
      },
    },
    { id: "odometer", header: "Odometer", align: "right", cell: (v) => <span className="text-sm text-muted-foreground">{v.odometerKm.toLocaleString("en-IN")} km</span>, defaultVisible: false },
    { id: "status", header: "Status", align: "right", cell: (v) => <Badge tone={statusTone[v.status]}>{vehicleStatusLabels[v.status]}</Badge> },
  ];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Vehicles</h1>
          <p className="text-xs text-muted-foreground">Fleet registry, seating, documents and health</p>
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

      <DataTable
        columns={columns}
        rows={[...vehicles].sort((a, b) => a.fleetNumber.localeCompare(b.fleetNumber))}
        getRowId={(v) => v.id}
        caption="Vehicles"
        renderMobileCard={(v) => {
          const health = computeVehicleHealth(db, v);
          return (
            <Link href={`/transport/vehicles/${v.id}`} className="surface-3d flex flex-col gap-1 rounded-lg border border-border bg-surface p-sm">
              <div className="flex items-center justify-between gap-xs">
                <p className="truncate text-sm font-semibold text-foreground">{v.registrationNumber}</p>
                <Badge tone={statusTone[v.status]}>{vehicleStatusLabels[v.status]}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {v.fleetNumber} · {vehicleTypeLabels[v.type]} · {v.capacity} seats
              </p>
              <p className={`text-sm font-medium ${health.score >= 80 ? "text-success" : health.score >= 60 ? "text-warning" : "text-error"}`}>Health {health.score}</p>
            </Link>
          );
        }}
        emptyIcon={Bus}
        emptyTitle="No vehicles yet"
      />
    </div>
  );
}
