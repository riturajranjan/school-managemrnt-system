"use client";

// Trips (Phase 9M) — real PostgreSQL/API cutover.
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
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { createTripRequest, useTransportRoutes, useTransportTrips } from "@/lib/hooks/api/use-transport-api";
import { roleLabels } from "@/lib/permissions/roles";
import type { TransportTripListItemDto, TransportTripStatusDto } from "@/lib/api/contracts";
import { formatDate } from "@/lib/utils";

const statusTone: Record<TransportTripStatusDto, "success" | "warning" | "error" | "neutral"> = { scheduled: "neutral", "in-progress": "success", completed: "success", cancelled: "neutral" };

export default function TripsPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data: trips, loading, error, reload } = useTransportTrips();
  const { data: routes } = useTransportRoutes({ status: "active" });

  const [createOpen, setCreateOpen] = useState(false);
  const [routeId, setRouteId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saveError, setSaveError] = useState<string | null>(null);

  if (!capabilitiesLoading && !hasServerPermission("transport.view")) {
    return <PermissionDenied action="view transport trips" role={roleLabels[role]} backHref="/" />;
  }
  const canManage = hasServerPermission("transport.manage");

  const columns: ColumnDef<TransportTripListItemDto>[] = [
    {
      id: "trip", header: "Trip", alwaysVisible: true, sortValue: (t) => t.routeName,
      cell: (t) => (
        <Link href={`/transport/trips/${t.id}`} className="min-w-0">
          <p className="text-sm font-medium text-foreground underline-offset-2 hover:underline">{t.routeName}</p>
          <p className="text-xs text-muted-foreground">{t.type}</p>
        </Link>
      ),
    },
    { id: "date", header: "Date", cell: (t) => <span className="text-sm text-muted-foreground">{formatDate(t.date)}</span> },
    { id: "vehicle", header: "Vehicle", cell: (t) => <span className="text-sm text-muted-foreground">{t.vehicleRegistration ?? "—"}</span>, defaultVisible: false },
    { id: "students", header: "Students", align: "right", cell: (t) => <span className="text-sm text-foreground">{t.studentsBoarded}/{t.studentsExpected}</span> },
    { id: "status", header: "Status", align: "right", cell: (t) => <Badge tone={statusTone[t.status]}>{t.status}</Badge> },
  ];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Trips</h1>
          <p className="text-xs text-muted-foreground">Daily trip operations, stop timelines and status</p>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => { setSaveError(null); setCreateOpen(true); }}>
            <Plus className="size-3.5" />
            Create trip
          </Button>
        )}
      </div>

      {error ? (
        <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">{error}</p>
      ) : loading && trips.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Loading…</p>
      ) : (
        <DataTable
          columns={columns}
          rows={[...trips].sort((a, b) => b.date.localeCompare(a.date))}
          getRowId={(t) => t.id}
          caption="Trips"
          renderMobileCard={(t) => (
            <Link href={`/transport/trips/${t.id}`} className="surface-3d flex flex-col gap-1 rounded-lg border border-border bg-surface p-sm">
              <div className="flex items-center justify-between gap-xs">
                <p className="truncate text-sm font-semibold text-foreground">{t.routeName}</p>
                <Badge tone={statusTone[t.status]}>{t.status}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{formatDate(t.date)} · {t.studentsBoarded}/{t.studentsExpected}</p>
            </Link>
          )}
          emptyIcon={ClipboardList}
          emptyTitle="No trips yet"
        />
      )}

      <DetailDrawer open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) setSaveError(null); }} title="Create trip" description="Seeds the stop timeline and student roster from the route">
        <div className="flex flex-col gap-sm">
          {saveError && <p className="text-xs text-error">{saveError}</p>}
          <div>
            <Label>Route</Label>
            <Select value={routeId} onValueChange={setRouteId}>
              <SelectTrigger aria-label="Route"><SelectValue placeholder="Select route" /></SelectTrigger>
              <SelectContent>
                {routes.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="trip-date">Date</Label>
            <Input id="trip-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <Button
            disabled={!routeId || !date}
            onClick={async () => {
              const res = await createTripRequest({ routeId, date });
              if (!res.success) { setSaveError(res.error.message); return; }
              setCreateOpen(false);
              setRouteId("");
              reload();
            }}
          >
            Create trip
          </Button>
        </div>
      </DetailDrawer>
    </div>
  );
}
