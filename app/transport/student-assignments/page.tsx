"use client";

// Student transport assignments (Phase 9M) — real PostgreSQL/API cutover.
// Bulk assign resolves eligible students server-side from real Enrollment —
// the class picker only tells the server WHICH class, never the student list.
import { useState } from "react";
import { Plus, UsersRound } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef, RowAction } from "@/components/data-table/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useClasses } from "@/lib/hooks/api/use-academics-foundation";
import { useStudentList } from "@/lib/hooks/api/use-students";
import {
  assignStudentTransportRequest,
  bulkAssignStudentTransportRequest,
  useRouteStops,
  useStudentTransportAssignments,
  useTransportRoutes,
  withdrawStudentTransportRequest,
} from "@/lib/hooks/api/use-transport-api";
import { roleLabels } from "@/lib/permissions/roles";
import type { StudentTransportAssignmentDto, StudentTransportStatusDto } from "@/lib/api/contracts";

const statusTone: Record<StudentTransportStatusDto, "success" | "warning" | "error" | "neutral"> = { active: "success", suspended: "warning", withdrawn: "error" };

export default function StudentAssignmentsPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data: assignments, loading, error, reload } = useStudentTransportAssignments();
  const { data: students } = useStudentList({ status: ["active"], pageSize: 150 });
  const { data: routes } = useTransportRoutes({ status: "active" });
  const { data: classes } = useClasses();

  const [createOpen, setCreateOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [studentId, setStudentId] = useState("");
  const [routeId, setRouteId] = useState("");
  const [pickupStopId, setPickupStopId] = useState("");
  const { data: selectedRouteStops } = useRouteStops(routeId || undefined);

  const [bulkClassId, setBulkClassId] = useState("");
  const [bulkRouteId, setBulkRouteId] = useState("");
  const [bulkStopId, setBulkStopId] = useState("");
  const { data: bulkRouteStops } = useRouteStops(bulkRouteId || undefined);
  const [bulkResult, setBulkResult] = useState<{ assignedCount: number; skippedCount: number } | null>(null);

  if (!capabilitiesLoading && !hasServerPermission("transport.view")) {
    return <PermissionDenied action="view student transport assignments" role={roleLabels[role]} backHref="/" />;
  }
  const canManage = hasServerPermission("transport.manage");

  const columns: ColumnDef<StudentTransportAssignmentDto>[] = [
    {
      id: "student", header: "Student", alwaysVisible: true, sortValue: (a) => a.studentName,
      cell: (a) => (
        <div>
          <p className="text-sm font-medium text-foreground">{a.studentName}</p>
          <p className="text-xs text-muted-foreground">{a.routeName}</p>
        </div>
      ),
    },
    { id: "stop", header: "Pickup stop", cell: (a) => <span className="text-sm text-muted-foreground">{a.pickupStopName}</span> },
    { id: "status", header: "Status", align: "right", cell: (a) => <Badge tone={statusTone[a.status]}>{a.status}</Badge> },
  ];

  const rowActions: RowAction<StudentTransportAssignmentDto>[] = canManage
    ? [{ key: "withdraw", label: "Withdraw", hidden: (a) => a.status !== "active", destructive: true, onSelect: async (a) => { await withdrawStudentTransportRequest(a.id, { reason: "Withdrawn by transport office" }); reload(); } }]
    : [];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Student transport assignments</h1>
          <p className="text-xs text-muted-foreground">Assign students to routes and stops</p>
        </div>
        {canManage && (
          <div className="flex items-center gap-xs">
            <Button size="sm" variant="outline" onClick={() => setBulkOpen(true)}>Bulk assign</Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="size-3.5" />
              Assign student
            </Button>
          </div>
        )}
      </div>

      {error ? (
        <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">{error}</p>
      ) : loading && assignments.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Loading…</p>
      ) : (
        <DataTable
          columns={columns}
          rows={[...assignments].sort((a, b) => b.createdAt.localeCompare(a.createdAt))}
          getRowId={(a) => a.id}
          caption="Student transport assignments"
          rowActions={rowActions}
          renderMobileCard={(a) => (
            <div className="surface-3d flex flex-col gap-1 rounded-lg border border-border bg-surface p-sm">
              <div className="flex items-center justify-between gap-xs">
                <p className="truncate text-sm font-semibold text-foreground">{a.studentName}</p>
                <Badge tone={statusTone[a.status]}>{a.status}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{a.routeName} · {a.pickupStopName}</p>
            </div>
          )}
          emptyIcon={UsersRound}
          emptyTitle="No transport assignments yet"
        />
      )}

      <DetailDrawer open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) setSaveError(null); }} title="Assign student transport" description="Validated against real route/stop data">
        <div className="flex flex-col gap-sm">
          {saveError && <p className="text-xs text-error">{saveError}</p>}
          <div>
            <Label>Student</Label>
            <Select value={studentId} onValueChange={setStudentId}>
              <SelectTrigger aria-label="Student"><SelectValue placeholder="Select student" /></SelectTrigger>
              <SelectContent>
                {students.map((s) => <SelectItem key={s.id} value={s.id}>{s.fullName}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Route</Label>
            <Select value={routeId} onValueChange={(v) => { setRouteId(v); setPickupStopId(""); }}>
              <SelectTrigger aria-label="Route"><SelectValue placeholder="Select route" /></SelectTrigger>
              <SelectContent>
                {routes.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Pickup / drop stop</Label>
            <Select value={pickupStopId} onValueChange={setPickupStopId} disabled={!routeId}>
              <SelectTrigger aria-label="Stop"><SelectValue placeholder="Select stop" /></SelectTrigger>
              <SelectContent>
                {(selectedRouteStops ?? []).map((rs) => <SelectItem key={rs.stopId} value={rs.stopId}>{rs.stopName}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button
            disabled={!studentId || !routeId || !pickupStopId}
            onClick={async () => {
              const res = await assignStudentTransportRequest({ studentId, routeId, pickupStopId });
              if (!res.success) { setSaveError(res.error.message); return; }
              setCreateOpen(false);
              setStudentId(""); setRouteId(""); setPickupStopId("");
              reload();
            }}
          >
            Assign transport
          </Button>
        </div>
      </DetailDrawer>

      <DetailDrawer open={bulkOpen} onOpenChange={(open) => { setBulkOpen(open); if (!open) setBulkResult(null); }} title="Bulk assign by class" description="Assigns every actively enrolled student in the class">
        <div className="flex flex-col gap-sm">
          {bulkResult && <p className="text-xs text-success">{bulkResult.assignedCount} assigned, {bulkResult.skippedCount} skipped (already assigned).</p>}
          <div>
            <Label>Class</Label>
            <Select value={bulkClassId} onValueChange={setBulkClassId}>
              <SelectTrigger aria-label="Class"><SelectValue placeholder="Select class" /></SelectTrigger>
              <SelectContent>
                {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Route</Label>
            <Select value={bulkRouteId} onValueChange={(v) => { setBulkRouteId(v); setBulkStopId(""); }}>
              <SelectTrigger aria-label="Bulk route"><SelectValue placeholder="Select route" /></SelectTrigger>
              <SelectContent>
                {routes.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Stop</Label>
            <Select value={bulkStopId} onValueChange={setBulkStopId} disabled={!bulkRouteId}>
              <SelectTrigger aria-label="Bulk stop"><SelectValue placeholder="Select stop" /></SelectTrigger>
              <SelectContent>
                {(bulkRouteStops ?? []).map((rs) => <SelectItem key={rs.stopId} value={rs.stopId}>{rs.stopName}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button
            disabled={!bulkClassId || !bulkRouteId || !bulkStopId}
            onClick={async () => {
              const res = await bulkAssignStudentTransportRequest({ classId: bulkClassId, routeId: bulkRouteId, pickupStopId: bulkStopId });
              if (res.success) { setBulkResult(res.data); reload(); }
            }}
          >
            Run bulk assignment
          </Button>
        </div>
      </DetailDrawer>
    </div>
  );
}
