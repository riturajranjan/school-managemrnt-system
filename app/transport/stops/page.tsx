"use client";

// Stops (Phase 9M) — real PostgreSQL/API cutover. No lat/long/geofence — the
// old mock silently hardcoded fake coordinates on every create.
import { useState } from "react";
import { AlertTriangle, MapPinned, Plus } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef, RowAction } from "@/components/data-table/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { createStopRequest, flagStopUnsafeRequest, setStopStatusRequest, useTransportStops } from "@/lib/hooks/api/use-transport-api";
import { roleLabels } from "@/lib/permissions/roles";
import type { TransportStopDto, TransportStopStatusDto } from "@/lib/api/contracts";

const statusTone: Record<TransportStopStatusDto, "success" | "warning" | "error" | "neutral"> = { active: "success", temporary: "warning", unsafe: "error", inactive: "neutral" };

export default function StopsPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data: stops, loading, error, reload } = useTransportStops();

  const [detail, setDetail] = useState<TransportStopDto | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [flagOpen, setFlagOpen] = useState<TransportStopDto | null>(null);
  const [flagNotes, setFlagNotes] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [address, setAddress] = useState("");
  const [landmark, setLandmark] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);

  if (!capabilitiesLoading && !hasServerPermission("transport.view")) {
    return <PermissionDenied action="view transport stops" role={roleLabels[role]} backHref="/" />;
  }
  const canManage = hasServerPermission("transport.manage");

  const columns: ColumnDef<TransportStopDto>[] = [
    {
      id: "name", header: "Stop", alwaysVisible: true, sortValue: (s) => s.name,
      cell: (s) => (
        <button type="button" onClick={() => setDetail(s)} className="text-left">
          <p className="text-sm font-medium text-foreground underline-offset-2 hover:underline">{s.name}</p>
          <p className="text-xs text-muted-foreground">{s.code}</p>
        </button>
      ),
    },
    { id: "routes", header: "Routes", align: "right", cell: (s) => <span className="text-sm text-muted-foreground">{s.routeCount}</span> },
    { id: "students", header: "Students", align: "right", cell: (s) => <span className="text-sm text-muted-foreground">{s.studentCount}</span> },
    { id: "status", header: "Status", align: "right", cell: (s) => <Badge tone={statusTone[s.status]}>{s.status}</Badge> },
  ];

  const rowActions: RowAction<TransportStopDto>[] = canManage
    ? [
        { key: "flag", label: "Flag unsafe", icon: <AlertTriangle className="size-3.5" />, hidden: (s) => s.status === "unsafe", destructive: true, onSelect: (s) => setFlagOpen(s) },
        { key: "restore", label: "Restore to active", hidden: (s) => s.status === "active", onSelect: async (s) => { await setStopStatusRequest(s.id, { status: "active" }); reload(); } },
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

      {error ? (
        <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">{error}</p>
      ) : loading && stops.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Loading…</p>
      ) : (
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
                <Badge tone={statusTone[s.status]}>{s.status}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{s.code} · {s.routeCount} route(s) · {s.studentCount} student(s)</p>
            </button>
          )}
          emptyIcon={MapPinned}
          emptyTitle="No stops configured"
        />
      )}

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
            <Field label="Routes using this stop" value={`${detail.routeCount}`} />
            <Field label="Students assigned" value={`${detail.studentCount}`} />
          </div>
        )}
      </DetailDrawer>

      <DetailDrawer open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) setSaveError(null); }} title="Add stop" description="A reusable pickup/drop point that can be added to any route">
        <div className="flex flex-col gap-sm">
          {saveError && <p className="text-xs text-error">{saveError}</p>}
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
            onClick={async () => {
              const res = await createStopRequest({ name: name.trim(), code: code.trim(), address: address.trim(), landmark: landmark.trim() || undefined });
              if (!res.success) { setSaveError(res.error.message); return; }
              setCreateOpen(false);
              setName(""); setCode(""); setAddress(""); setLandmark("");
              reload();
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
            onClick={async () => {
              if (flagOpen) await flagStopUnsafeRequest(flagOpen.id, { safetyNotes: flagNotes.trim() });
              setFlagOpen(null);
              setFlagNotes("");
              reload();
            }}
          >
            Flag unsafe
          </Button>
        </div>
      </DetailDrawer>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground">{value}</p>
    </div>
  );
}
