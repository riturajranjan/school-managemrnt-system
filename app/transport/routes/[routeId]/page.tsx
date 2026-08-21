"use client";

// Route detail (Phase 9M) — real PostgreSQL/API cutover. Stops (add/reorder/
// remove), current vehicle + driver/attendant (real Staff), and students
// assigned to this route.
import Link from "next/link";
import { use, useState } from "react";
import { ArrowLeft, Bus, MapPinned, Plus, Trash2, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import {
  setRouteAssignmentRequest,
  setRouteStopsRequest,
  updateRouteRequest,
  useRouteAssignment,
  useRouteStops,
  useStudentTransportAssignments,
  useTransportRoute,
  useTransportStops,
  useTransportVehicles,
} from "@/lib/hooks/api/use-transport-api";
import { useStaffList } from "@/lib/hooks/api/use-staff-api";
import { roleLabels } from "@/lib/permissions/roles";
import type { TransportRouteStatusDto } from "@/lib/api/contracts";

const statusTone: Record<TransportRouteStatusDto, "success" | "warning" | "neutral"> = { draft: "neutral", active: "success", paused: "warning", archived: "neutral" };

export default function RouteDetailPage({ params }: { params: Promise<{ routeId: string }> }) {
  const { routeId } = use(params);
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data: route, loading, error, reload } = useTransportRoute(routeId);
  const { data: stopsData, reload: reloadStops } = useRouteStops(routeId);
  const stops = stopsData ?? [];
  const { data: assignment, reload: reloadAssignment } = useRouteAssignment(routeId);
  const { data: allStops } = useTransportStops({ status: "active" });
  const { data: vehicles } = useTransportVehicles({ status: "active" });
  const { data: staff } = useStaffList({ status: "active", pageSize: 200 });
  const { data: studentAssignments } = useStudentTransportAssignments({ routeId, status: "active" });

  const [stopsDraft, setStopsDraft] = useState<{ stopId: string; sequence: number }[]>([]);
  const [addStopId, setAddStopId] = useState("");
  const [stopsOpen, setStopsOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [vehicleId, setVehicleId] = useState("");
  const [driverStaffId, setDriverStaffId] = useState("");
  const [attendantStaffId, setAttendantStaffId] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);

  if (!capabilitiesLoading && !hasServerPermission("transport.view")) return <PermissionDenied action="view this route" role={roleLabels[role]} backHref="/transport/routes" />;
  if (loading) return <p className="py-2xl text-center text-sm text-muted-foreground">Loading…</p>;
  if (error || !route) {
    return (
      <div className="flex flex-col items-center gap-sm py-2xl text-center">
        <p className="text-sm font-medium text-foreground">{error ?? "Route not found"}</p>
        <Button asChild variant="outline"><Link href="/transport/routes">Back to routes</Link></Button>
      </div>
    );
  }
  const canManage = hasServerPermission("transport.manage");
  const stopName = (stopId: string) => allStops.find((s) => s.id === stopId)?.name ?? stops.find((s) => s.stopId === stopId)?.stopName ?? stopId;

  async function setStatus(status: TransportRouteStatusDto) {
    await updateRouteRequest(routeId, { status });
    reload();
  }

  async function saveStops() {
    setSaveError(null);
    const res = await setRouteStopsRequest(routeId, { stops: stopsDraft });
    if (!res.success) { setSaveError(res.error.message); return; }
    setStopsOpen(false);
    reloadStops();
  }

  async function saveAssignment() {
    setSaveError(null);
    const res = await setRouteAssignmentRequest(routeId, { vehicleId, driverStaffId: driverStaffId || undefined, attendantStaffId: attendantStaffId || undefined });
    if (!res.success) { setSaveError(res.error.message); return; }
    setAssignOpen(false);
    setVehicleId(""); setDriverStaffId(""); setAttendantStaffId("");
    reloadAssignment();
    reload();
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-sm">
        <Button asChild size="icon" variant="ghost" aria-label="Back"><Link href="/transport/routes"><ArrowLeft className="size-4" /></Link></Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold text-foreground">{route.name}</h1>
          <p className="truncate text-xs text-muted-foreground">{route.code} · {route.shift} · {route.direction}</p>
        </div>
        <Badge tone={statusTone[route.status]}>{route.status}</Badge>
      </div>

      {canManage && (
        <div className="flex flex-wrap gap-xs">
          {route.status !== "active" && <Button size="sm" variant="ghost" onClick={() => setStatus("active")}>Activate</Button>}
          {route.status !== "paused" && route.status === "active" && <Button size="sm" variant="ghost" onClick={() => setStatus("paused")}>Pause</Button>}
          {route.status !== "archived" && <Button size="sm" variant="ghost" onClick={() => setStatus("archived")}>Archive</Button>}
        </div>
      )}

      <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
        <div className="rounded-lg border border-border p-sm">
          <div className="mb-sm flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground"><Bus className="size-4" /> Vehicle &amp; crew</h2>
            {canManage && <Button size="sm" variant="outline" onClick={() => setAssignOpen(true)}>{assignment ? "Reassign" : "Assign"}</Button>}
          </div>
          {assignment ? (
            <dl className="grid grid-cols-2 gap-sm text-sm">
              <Field label="Vehicle" value={assignment.vehicleRegistration} />
              <Field label="Driver" value={assignment.driverName ?? "—"} />
              <Field label="Attendant" value={assignment.attendantName ?? "—"} />
              <Field label="Since" value={assignment.effectiveFrom} />
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">No vehicle assigned yet.</p>
          )}
        </div>

        <div className="rounded-lg border border-border p-sm">
          <div className="mb-sm flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground"><MapPinned className="size-4" /> Stops ({stops.length})</h2>
            {canManage && (
              <Button
                size="sm" variant="outline"
                onClick={() => { setStopsDraft(stops.map((s) => ({ stopId: s.stopId, sequence: s.sequence }))); setStopsOpen(true); }}
              >
                Edit
              </Button>
            )}
          </div>
          {stops.length === 0 ? (
            <p className="text-sm text-muted-foreground">No stops added yet.</p>
          ) : (
            <ol className="flex flex-col gap-1">
              {stops.map((s) => (
                <li key={s.id} className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{s.sequence}. {s.stopName}</span>
                  {s.pickupTime && <span className="text-xs text-muted-foreground">{s.pickupTime}</span>}
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="rounded-lg border border-border p-sm sm:col-span-2">
          <h2 className="mb-sm flex items-center gap-1.5 text-sm font-semibold text-foreground"><UsersRound className="size-4" /> Students ({studentAssignments.length})</h2>
          {studentAssignments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No students assigned to this route yet.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {studentAssignments.slice(0, 20).map((a) => (
                <li key={a.id} className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{a.studentName}</span>
                  <span className="text-xs text-muted-foreground">{a.pickupStopName}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <DetailDrawer open={assignOpen} onOpenChange={(o) => { setAssignOpen(o); if (!o) setSaveError(null); }} title="Assign vehicle & crew" description="Ends the current assignment and starts a new one">
        <div className="flex flex-col gap-sm">
          {saveError && <p className="text-xs text-error">{saveError}</p>}
          <div>
            <Label>Vehicle</Label>
            <Select value={vehicleId} onValueChange={setVehicleId}>
              <SelectTrigger aria-label="Vehicle"><SelectValue placeholder="Select vehicle" /></SelectTrigger>
              <SelectContent>
                {vehicles.map((v) => <SelectItem key={v.id} value={v.id}>{v.registrationNumber}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Driver (optional)</Label>
            <Select value={driverStaffId} onValueChange={setDriverStaffId}>
              <SelectTrigger aria-label="Driver"><SelectValue placeholder="Select staff" /></SelectTrigger>
              <SelectContent>
                {staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Attendant (optional)</Label>
            <Select value={attendantStaffId} onValueChange={setAttendantStaffId}>
              <SelectTrigger aria-label="Attendant"><SelectValue placeholder="Select staff" /></SelectTrigger>
              <SelectContent>
                {staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button disabled={!vehicleId} onClick={saveAssignment}>Save assignment</Button>
        </div>
      </DetailDrawer>

      <DetailDrawer open={stopsOpen} onOpenChange={(o) => { setStopsOpen(o); if (!o) setSaveError(null); }} title="Edit stops" description="Ordered pickup/drop sequence for this route">
        <div className="flex flex-col gap-sm">
          {saveError && <p className="text-xs text-error">{saveError}</p>}
          <ul className="flex flex-col gap-1">
            {stopsDraft.map((s, i) => (
              <li key={s.stopId} className="flex items-center gap-xs">
                <Input
                  type="number" className="w-16" value={s.sequence}
                  onChange={(e) => setStopsDraft((prev) => prev.map((p, idx) => (idx === i ? { ...p, sequence: Number(e.target.value) || 0 } : p)))}
                  aria-label={`Sequence for ${stopName(s.stopId)}`}
                />
                <span className="flex-1 text-sm text-foreground">{stopName(s.stopId)}</span>
                <Button size="icon" variant="ghost" aria-label="Remove stop" onClick={() => setStopsDraft((prev) => prev.filter((_, idx) => idx !== i))}>
                  <Trash2 className="size-3.5" />
                </Button>
              </li>
            ))}
          </ul>
          <div className="flex items-end gap-xs">
            <div className="flex-1">
              <Label>Add stop</Label>
              <Select value={addStopId} onValueChange={setAddStopId}>
                <SelectTrigger aria-label="Add stop"><SelectValue placeholder="Select stop" /></SelectTrigger>
                <SelectContent>
                  {allStops.filter((s) => !stopsDraft.some((d) => d.stopId === s.id)).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline" disabled={!addStopId}
              onClick={() => { setStopsDraft((prev) => [...prev, { stopId: addStopId, sequence: prev.length + 1 }]); setAddStopId(""); }}
            >
              <Plus className="size-3.5" /> Add
            </Button>
          </div>
          <Button onClick={saveStops}>Save stops</Button>
        </div>
      </DetailDrawer>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}
