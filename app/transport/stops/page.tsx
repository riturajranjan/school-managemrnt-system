"use client";

import { useState } from "react";
import { AlertTriangle, MapPinned, Plus } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef, RowAction } from "@/components/data-table/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useTransportStops } from "@/lib/hooks/use-transport";
import { useSisStore } from "@/lib/hooks/use-store";
import { createStop, flagUnsafeStop, setStopStatus } from "@/lib/services/stop-service";
import { stopStatusLabels, type StopStatus, type TransportStop } from "@/lib/types/transport";

const ACTOR = { name: "Transport Administrator", role: "Transport Administrator" };

const statusTone: Record<StopStatus, "success" | "warning" | "error" | "neutral"> = {
  active: "success",
  temporary: "warning",
  unsafe: "error",
  alternate: "neutral",
  inactive: "neutral",
};

export default function StopsPage() {
  const stops = useTransportStops();
  const db = useSisStore();
  const { can } = usePermissions();
  const canManage = can("transport.manageStops");

  const [detail, setDetail] = useState<TransportStop | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [flagOpen, setFlagOpen] = useState<TransportStop | null>(null);
  const [flagNotes, setFlagNotes] = useState("");

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [address, setAddress] = useState("");
  const [landmark, setLandmark] = useState("");
  const [error, setError] = useState<string | null>(null);

  function routesForStop(stopId: string) {
    const routeIds = new Set(db.routeStops.filter((rs) => rs.stopId === stopId).map((rs) => rs.routeId));
    return db.transportRoutes.filter((r) => routeIds.has(r.id));
  }

  function studentsForStop(stopId: string) {
    return db.studentTransportAssignments.filter((a) => (a.pickupStopId === stopId || a.dropStopId === stopId) && a.status === "active");
  }

  const columns: ColumnDef<TransportStop>[] = [
    {
      id: "name",
      header: "Stop",
      alwaysVisible: true,
      sortValue: (s) => s.name,
      cell: (s) => (
        <button type="button" onClick={() => setDetail(s)} className="text-left">
          <p className="text-sm font-medium text-foreground underline-offset-2 hover:underline">{s.name}</p>
          <p className="text-xs text-muted-foreground">{s.code}</p>
        </button>
      ),
    },
    { id: "routes", header: "Routes", align: "right", cell: (s) => <span className="text-sm text-muted-foreground">{routesForStop(s.id).length}</span> },
    { id: "students", header: "Students", align: "right", cell: (s) => <span className="text-sm text-muted-foreground">{studentsForStop(s.id).length}</span> },
    { id: "status", header: "Status", align: "right", cell: (s) => <Badge tone={statusTone[s.status]}>{stopStatusLabels[s.status]}</Badge> },
  ];

  const rowActions: RowAction<TransportStop>[] = canManage
    ? [
        { key: "flag", label: "Flag unsafe", icon: <AlertTriangle className="size-3.5" />, hidden: (s) => s.status === "unsafe", destructive: true, onSelect: (s) => setFlagOpen(s) },
        { key: "restore", label: "Restore to active", hidden: (s) => s.status === "active", onSelect: (s) => setStopStatus(s.id, "active", ACTOR) },
      ]
    : [];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Stops</h1>
          <p className="text-xs text-muted-foreground">Pickup and drop points shared across routes</p>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-3.5" />
            Add stop
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={[...stops].sort((a, b) => a.name.localeCompare(b.name))}
        getRowId={(s) => s.id}
        caption="Stops"
        rowActions={rowActions}
        renderMobileCard={(s) => (
          <button type="button" onClick={() => setDetail(s)} className="surface-3d flex w-full flex-col gap-1 rounded-lg border border-border bg-surface p-sm text-left">
            <div className="flex items-center justify-between gap-xs">
              <p className="truncate text-sm font-semibold text-foreground">{s.name}</p>
              <Badge tone={statusTone[s.status]}>{stopStatusLabels[s.status]}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {s.code} · {routesForStop(s.id).length} route(s) · {studentsForStop(s.id).length} student(s)
            </p>
          </button>
        )}
        emptyIcon={MapPinned}
        emptyTitle="No stops configured"
      />

      <DetailDrawer open={!!detail} onOpenChange={(open) => !open && setDetail(null)} title={detail?.name ?? ""} description={detail?.code}>
        {detail && (
          <div className="flex flex-col gap-md">
            <div>
              <p className="text-xs text-muted-foreground">Address</p>
              <p className="text-sm text-foreground">{detail.address}</p>
              {detail.landmark && <p className="text-xs text-muted-foreground">Landmark: {detail.landmark}</p>}
            </div>
            {detail.safetyNotes && (
              <div className="flex items-start gap-1.5 rounded-md border border-error/30 bg-error/8 p-sm text-xs text-error">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                {detail.safetyNotes}
              </div>
            )}
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Routes using this stop</p>
              {routesForStop(detail.id).length === 0 ? (
                <p className="text-sm text-muted-foreground">No routes use this stop.</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {routesForStop(detail.id).map((r) => (
                    <li key={r.id} className="text-sm text-foreground">
                      {r.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Students assigned ({studentsForStop(detail.id).length})</p>
              {studentsForStop(detail.id).length === 0 ? (
                <p className="text-sm text-muted-foreground">No students assigned.</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {studentsForStop(detail.id)
                    .slice(0, 15)
                    .map((a) => {
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
          </div>
        )}
      </DetailDrawer>

      <DetailDrawer
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setError(null);
        }}
        title="Add stop"
        description="A reusable pickup/drop point that can be added to any route"
      >
        <div className="flex flex-col gap-sm">
          {error && <p className="text-xs text-error">{error}</p>}
          <div>
            <Label htmlFor="stop-name">Stop name</Label>
            <Input id="stop-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="stop-code">Stop code</Label>
            <Input id="stop-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="STP-013" />
          </div>
          <div>
            <Label htmlFor="stop-address">Address</Label>
            <Input id="stop-address" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="stop-landmark">Landmark</Label>
            <Input id="stop-landmark" value={landmark} onChange={(e) => setLandmark(e.target.value)} placeholder="Optional" />
          </div>
          <Button
            disabled={!name.trim() || !code.trim() || !address.trim()}
            onClick={() => {
              const result = createStop({ name: name.trim(), code: code.trim(), address: address.trim(), landmark: landmark.trim() || undefined, latitude: 12.97, longitude: 77.6, geofenceRadiusMeters: 150, branch: "main", status: "active" }, ACTOR);
              if (!result.ok) {
                setError(result.error);
                return;
              }
              setCreateOpen(false);
              setName("");
              setCode("");
              setAddress("");
              setLandmark("");
            }}
          >
            Add stop
          </Button>
        </div>
      </DetailDrawer>

      <DetailDrawer open={!!flagOpen} onOpenChange={(open) => !open && setFlagOpen(null)} title="Flag stop unsafe" description={flagOpen?.name}>
        <div className="flex flex-col gap-sm">
          <div>
            <Label htmlFor="flag-notes">Safety notes</Label>
            <Input id="flag-notes" value={flagNotes} onChange={(e) => setFlagNotes(e.target.value)} placeholder="Explain why this stop is unsafe" />
          </div>
          <Button
            variant="destructive"
            disabled={!flagNotes.trim()}
            onClick={() => {
              if (flagOpen) flagUnsafeStop(flagOpen.id, flagNotes.trim(), ACTOR);
              setFlagOpen(null);
              setFlagNotes("");
            }}
          >
            Flag unsafe
          </Button>
        </div>
      </DetailDrawer>
    </div>
  );
}
