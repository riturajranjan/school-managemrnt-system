"use client";

// Vehicle detail (Phase 9M) — real PostgreSQL/API cutover. Documents/health/
// seat-chart/maintenance/fuel tabs from the old mock are dropped — none of
// that data exists yet (deliberately deferred, see the phase report).
import Link from "next/link";
import { use } from "react";
import { ArrowLeft, Bus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { setVehicleStatusRequest, useTransportTrips, useTransportVehicle } from "@/lib/hooks/api/use-transport-api";
import { roleLabels } from "@/lib/permissions/roles";
import type { TransportVehicleStatusDto } from "@/lib/api/contracts";
import { formatDate } from "@/lib/utils";

const statusTone: Record<TransportVehicleStatusDto, "success" | "warning" | "error" | "neutral"> = { active: "success", inactive: "neutral", maintenance: "warning", archived: "neutral" };
const typeLabels = { bus: "Bus", "mini-bus": "Mini bus", van: "Van", car: "Car", "electric-vehicle": "Electric vehicle", "contract-vehicle": "Contract vehicle", custom: "Custom" } as const;

export default function VehicleDetailPage({ params }: { params: Promise<{ vehicleId: string }> }) {
  const { vehicleId } = use(params);
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data: vehicle, loading, error, reload } = useTransportVehicle(vehicleId);
  const { data: vehicleTrips } = useTransportTrips({ vehicleId });

  if (!capabilitiesLoading && !hasServerPermission("transport.view")) return <PermissionDenied action="view this vehicle" role={roleLabels[role]} backHref="/transport/vehicles" />;
  if (loading) return <p className="py-2xl text-center text-sm text-muted-foreground">Loading…</p>;
  if (error || !vehicle) {
    return (
      <div className="flex flex-col items-center gap-sm py-2xl text-center">
        <p className="text-sm font-medium text-foreground">{error ?? "Vehicle not found"}</p>
        <Button asChild variant="outline"><Link href="/transport/vehicles">Back to vehicles</Link></Button>
      </div>
    );
  }
  const canManage = hasServerPermission("transport.manage");

  async function setStatus(status: TransportVehicleStatusDto) {
    await setVehicleStatusRequest(vehicleId, { status });
    reload();
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-sm">
        <Button asChild size="icon" variant="ghost" aria-label="Back"><Link href="/transport/vehicles"><ArrowLeft className="size-4" /></Link></Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold text-foreground">{vehicle.registrationNumber}</h1>
          <p className="truncate text-xs text-muted-foreground">{vehicle.displayName ?? typeLabels[vehicle.type]}</p>
        </div>
        <Badge tone={statusTone[vehicle.status]}>{vehicle.status}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-sm text-sm sm:grid-cols-4">
        <Field label="Type" value={typeLabels[vehicle.type]} />
        <Field label="Capacity" value={String(vehicle.capacity)} />
        <Field label="Make / model" value={[vehicle.make, vehicle.model].filter(Boolean).join(" ") || "—"} />
        <Field label="Added" value={formatDate(vehicle.createdAt)} />
      </div>

      {canManage && (
        <div className="flex flex-wrap gap-xs">
          <Button asChild size="sm" variant="outline"><Link href={`/transport/vehicles/${vehicleId}`}>Edit</Link></Button>
          {vehicle.status !== "active" && <Button size="sm" variant="ghost" onClick={() => setStatus("active")}>Mark active</Button>}
          {vehicle.status !== "maintenance" && <Button size="sm" variant="ghost" onClick={() => setStatus("maintenance")}>Send to maintenance</Button>}
          {vehicle.status !== "archived" && <Button size="sm" variant="ghost" onClick={() => setStatus("archived")}>Archive</Button>}
        </div>
      )}

      <div className="rounded-lg border border-border p-sm">
        <h2 className="mb-sm flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <Bus className="size-4" /> Recent trips
        </h2>
        {vehicleTrips.length === 0 ? (
          <p className="text-sm text-muted-foreground">No trips recorded for this vehicle yet.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {vehicleTrips.map((t) => (
              <li key={t.id}>
                <Link href={`/transport/trips/${t.id}`} className="flex items-center justify-between rounded-md border border-border p-sm text-sm hover:border-primary/40">
                  <span className="text-foreground">{t.routeName} · {formatDate(t.date)}</span>
                  <Badge tone="neutral">{t.status}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="truncate text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}
