"use client";

import Link from "next/link";
import { useState } from "react";
import { ClipboardList, Plus } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef } from "@/components/data-table/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useTransportRoutes, useTransportTrips } from "@/lib/hooks/use-transport";
import { useSisStore } from "@/lib/hooks/use-store";
import { createTripForRoute } from "@/lib/services/trip-service";
import { tripStatusLabels, type TransportTrip, type TripStatus } from "@/lib/types/transport";
import { formatDate } from "@/lib/utils";

const ACTOR = { name: "Dispatcher", role: "Dispatcher" };

const statusTone: Record<TripStatus, "success" | "warning" | "error" | "neutral"> = {
  scheduled: "neutral",
  ready: "neutral",
  boarding: "warning",
  "in-progress": "success",
  delayed: "warning",
  paused: "warning",
  breakdown: "error",
  emergency: "error",
  completed: "success",
  cancelled: "neutral",
};

export default function TripsPage() {
  const trips = useTransportTrips();
  const routes = useTransportRoutes();
  const db = useSisStore();
  const { can } = usePermissions();
  const canManage = can("transport.manageTrips");

  const [createOpen, setCreateOpen] = useState(false);
  const [routeId, setRouteId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);

  function vehicleFor(vehicleId: string) {
    return db.vehicles.find((v) => v.id === vehicleId);
  }

  const columns: ColumnDef<TransportTrip>[] = [
    {
      id: "trip",
      header: "Trip",
      alwaysVisible: true,
      sortValue: (t) => t.tripNumber,
      cell: (t) => (
        <Link href={`/transport/trips/${t.id}`} className="min-w-0">
          <p className="text-sm font-medium text-foreground underline-offset-2 hover:underline">{t.tripNumber}</p>
          <p className="text-xs text-muted-foreground">{routes.find((r) => r.id === t.routeId)?.name ?? t.routeId}</p>
        </Link>
      ),
    },
    { id: "date", header: "Date", cell: (t) => <span className="text-sm text-muted-foreground">{formatDate(t.date)}</span> },
    { id: "vehicle", header: "Vehicle", cell: (t) => <span className="text-sm text-muted-foreground">{vehicleFor(t.vehicleId)?.registrationNumber ?? "—"}</span>, defaultVisible: false },
    { id: "students", header: "Students", align: "right", cell: (t) => <span className="text-sm text-foreground">{t.studentsBoarded}/{t.studentsExpected}</span> },
    { id: "status", header: "Status", align: "right", cell: (t) => <Badge tone={statusTone[t.status]}>{tripStatusLabels[t.status]}</Badge> },
  ];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Trips</h1>
          <p className="text-xs text-muted-foreground">Daily trip operations, stop timelines and status</p>
        </div>
        {canManage && (
          <Button
            size="sm"
            onClick={() => {
              setError(null);
              setCreateOpen(true);
            }}
          >
            <Plus className="size-3.5" />
            Create trip
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={[...trips].sort((a, b) => (a.date < b.date ? 1 : b.date < a.date ? -1 : a.tripNumber.localeCompare(b.tripNumber)))}
        getRowId={(t) => t.id}
        caption="Trips"
        renderMobileCard={(t) => (
          <Link href={`/transport/trips/${t.id}`} className="surface-3d flex flex-col gap-1 rounded-lg border border-border bg-surface p-sm">
            <div className="flex items-center justify-between gap-xs">
              <p className="truncate text-sm font-semibold text-foreground">{t.tripNumber}</p>
              <Badge tone={statusTone[t.status]}>{tripStatusLabels[t.status]}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {routes.find((r) => r.id === t.routeId)?.name ?? t.routeId} · {formatDate(t.date)} · {t.studentsBoarded}/{t.studentsExpected}
            </p>
          </Link>
        )}
        emptyIcon={ClipboardList}
        emptyTitle="No trips yet"
      />

      <DetailDrawer
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setError(null);
        }}
        title="Create trip"
        description="Seeds the stop timeline and student roster from the route"
      >
        <div className="flex flex-col gap-sm">
          {error && <p className="text-xs text-error">{error}</p>}
          <div>
            <Label>Route</Label>
            <Select value={routeId} onValueChange={setRouteId}>
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
            <Label htmlFor="trip-date">Date</Label>
            <Input id="trip-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <Button
            disabled={!routeId || !date}
            onClick={() => {
              const result = createTripForRoute(routeId, date, ACTOR);
              if (!result.ok) {
                setError(result.error);
                return;
              }
              setCreateOpen(false);
              setRouteId("");
            }}
          >
            Create trip
          </Button>
        </div>
      </DetailDrawer>
    </div>
  );
}
