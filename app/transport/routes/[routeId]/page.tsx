"use client";

import Link from "next/link";
import { use } from "react";
import { Bus, History, MapPinned, UserCog, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TransportAuditTrail } from "@/components/transport/audit-trail";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useRouteStops, useTransportRoute } from "@/lib/hooks/use-transport";
import { useSisStore } from "@/lib/hooks/use-store";
import { setRouteStatus } from "@/lib/services/route-service";
import { routeDirectionLabels, routeStatusLabels, routeTypeLabels, transportShiftLabels, type RouteStatus } from "@/lib/types/transport";
import { formatDate } from "@/lib/utils";

const ACTOR = { name: "Transport Administrator", role: "Transport Administrator" };
const statusOptions = Object.keys(routeStatusLabels) as RouteStatus[];

const statusTone: Record<RouteStatus, "success" | "warning" | "error" | "neutral"> = {
  draft: "neutral",
  active: "success",
  paused: "warning",
  temporary: "warning",
  "under-review": "warning",
  archived: "neutral",
};

export default function RouteDetailPage({ params }: { params: Promise<{ routeId: string }> }) {
  const { routeId } = use(params);
  const route = useTransportRoute(routeId);
  const stops = useRouteStops(routeId);
  const db = useSisStore();
  const { can } = usePermissions();
  const canManage = can("transport.manageRoutes");

  if (!route) {
    return (
      <div className="flex flex-col items-center gap-sm py-2xl text-center">
        <p className="text-sm font-medium text-foreground">Route not found</p>
        <Button asChild variant="outline">
          <Link href="/transport/routes">Back to routes</Link>
        </Button>
      </div>
    );
  }

  const vehicle = db.vehicles.find((v) => v.id === route.assignedVehicleId);
  const primaryDriver = db.drivers.find((d) => d.id === route.primaryDriverId);
  const backupDriver = db.drivers.find((d) => d.id === route.backupDriverId);
  const attendant = db.attendants.find((a) => a.id === route.attendantId);
  const assignments = db.studentTransportAssignments.filter((a) => a.routeId === route.id && a.status === "active");

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">{route.name}</h1>
          <p className="text-xs text-muted-foreground">
            {route.code} · {routeTypeLabels[route.type]} · {transportShiftLabels[route.shift]} · {routeDirectionLabels[route.direction]}
          </p>
        </div>
        {canManage && (
          <Select value={route.status} onValueChange={(v) => setRouteStatus(route.id, v as RouteStatus, ACTOR)}>
            <SelectTrigger className="w-44" aria-label="Route status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((s) => (
                <SelectItem key={s} value={s}>
                  {routeStatusLabels[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <div className="surface-3d rounded-lg border border-border bg-surface p-sm">
          <p className="text-xs text-muted-foreground">Students</p>
          <p className="text-xl font-bold text-foreground">
            {assignments.length}/{route.maxCapacity}
          </p>
        </div>
        <div className="surface-3d rounded-lg border border-border bg-surface p-sm">
          <p className="text-xs text-muted-foreground">Distance</p>
          <p className="text-xl font-bold text-foreground">{route.distanceKm} km</p>
        </div>
        <div className="surface-3d rounded-lg border border-border bg-surface p-sm">
          <p className="text-xs text-muted-foreground">Duration</p>
          <p className="text-xl font-bold text-foreground">{route.estimatedDurationMinutes} min</p>
        </div>
        <div className="surface-3d rounded-lg border border-border bg-surface p-sm">
          <p className="text-xs text-muted-foreground">Status</p>
          <Badge tone={statusTone[route.status]}>{routeStatusLabels[route.status]}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-md lg:grid-cols-3">
        <div className="rounded-lg border border-border p-sm lg:col-span-1">
          <h2 className="mb-sm flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <Bus className="size-4" /> Vehicle & crew
          </h2>
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Vehicle</dt>
            <dd className="text-foreground">{vehicle ? <Link href={`/transport/vehicles/${vehicle.id}`} className="underline-offset-2 hover:underline">{vehicle.registrationNumber}</Link> : "Unassigned"}</dd>
            <dt className="text-muted-foreground">Primary driver</dt>
            <dd className="text-foreground">{primaryDriver ? <Link href={`/transport/drivers/${primaryDriver.id}`} className="underline-offset-2 hover:underline">{primaryDriver.name}</Link> : "Unassigned"}</dd>
            <dt className="text-muted-foreground">Backup driver</dt>
            <dd className="text-foreground">{backupDriver?.name ?? "Unassigned"}</dd>
            <dt className="text-muted-foreground">Attendant</dt>
            <dd className="text-foreground">{attendant?.name ?? "Unassigned"}</dd>
            <dt className="text-muted-foreground">Effective from</dt>
            <dd className="text-foreground">{formatDate(route.effectiveFrom)}</dd>
          </dl>
        </div>

        <div className="rounded-lg border border-border p-sm lg:col-span-2">
          <h2 className="mb-sm flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <MapPinned className="size-4" /> Stops
          </h2>
          {stops.length === 0 ? (
            <p className="text-sm text-muted-foreground">No stops configured.</p>
          ) : (
            <ol className="flex flex-col gap-1">
              {stops.map((rs, i) => {
                const stop = db.transportStops.find((s) => s.id === rs.stopId);
                return (
                  <li key={rs.id} className="flex items-center justify-between rounded-md border border-border px-sm py-1.5 text-sm">
                    <span className="text-foreground">
                      {i + 1}. {stop?.name ?? rs.stopId}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Pickup {rs.pickupTime ?? "—"} · Drop {rs.dropTime ?? "—"}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        <div className="rounded-lg border border-border p-sm lg:col-span-3">
          <h2 className="mb-sm flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <Users className="size-4" /> Students assigned ({assignments.length})
          </h2>
          {assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No students assigned to this route.</p>
          ) : (
            <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3">
              {assignments.map((a) => {
                const student = db.students.find((s) => s.id === a.studentId);
                return (
                  <li key={a.id} className="text-sm text-foreground">
                    {student ? `${student.profile.firstName} ${student.profile.lastName}` : a.studentId}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-border p-sm lg:col-span-3">
          <h2 className="mb-sm flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <History className="size-4" /> Audit trail
          </h2>
          <TransportAuditTrail events={db.transportAuditLog.filter((e) => e.subjectId === routeId)} />
        </div>
      </div>

      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <UserCog className="size-3.5" />
        Created by {route.createdBy} on {formatDate(route.createdAt)}
      </div>
    </div>
  );
}
