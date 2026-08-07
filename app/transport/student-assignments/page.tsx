"use client";

import { useState } from "react";
import { Plus, UsersRound } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef, RowAction } from "@/components/data-table/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useManagedClasses } from "@/lib/hooks/use-academics";
import { useRouteStops, useTransportRoutes } from "@/lib/hooks/use-transport";
import { useStudents } from "@/lib/hooks/use-students";
import { useSisStore } from "@/lib/hooks/use-store";
import { CURRENT_SESSION } from "@/lib/data/seed/reference";
import { assignStudentTransport, bulkAssignStudentsToRoute, withdrawStudentTransport } from "@/lib/services/student-transport-service";
import { transportAssignmentStatusLabels, transportShiftLabels, type StudentTransportAssignment, type TransportAssignmentStatus } from "@/lib/types/transport";

const ACTOR = { name: "Transport Administrator", role: "Transport Administrator" };

const statusTone: Record<TransportAssignmentStatus, "success" | "warning" | "error" | "neutral"> = {
  active: "success",
  suspended: "warning",
  withdrawn: "error",
  expired: "neutral",
};

export default function StudentAssignmentsPage() {
  const db = useSisStore();
  const students = useStudents();
  const routes = useTransportRoutes();
  const classes = useManagedClasses();
  const { can } = usePermissions();
  const canManage = can("transport.assignStudents");

  const [createOpen, setCreateOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [studentId, setStudentId] = useState("");
  const [routeId, setRouteId] = useState("");
  const [pickupStopId, setPickupStopId] = useState("");

  const [bulkClassId, setBulkClassId] = useState("");
  const [bulkRouteId, setBulkRouteId] = useState("");
  const [bulkStopId, setBulkStopId] = useState("");
  const [bulkResult, setBulkResult] = useState<{ assigned: number; skipped: number } | null>(null);

  const selectedRouteStops = useRouteStops(routeId);
  const bulkRouteStops = useRouteStops(bulkRouteId);

  function studentName(id: string) {
    const s = students.find((st) => st.id === id);
    return s ? `${s.profile.firstName} ${s.profile.lastName}` : id;
  }
  function routeName(id: string) {
    return routes.find((r) => r.id === id)?.name ?? id;
  }
  function stopName(id: string) {
    return db.transportStops.find((s) => s.id === id)?.name ?? id;
  }

  const columns: ColumnDef<StudentTransportAssignment>[] = [
    {
      id: "student",
      header: "Student",
      alwaysVisible: true,
      sortValue: (a) => studentName(a.studentId),
      cell: (a) => (
        <div>
          <p className="text-sm font-medium text-foreground">{studentName(a.studentId)}</p>
          <p className="text-xs text-muted-foreground">{routeName(a.routeId)}</p>
        </div>
      ),
    },
    { id: "stop", header: "Pickup stop", cell: (a) => <span className="text-sm text-muted-foreground">{stopName(a.pickupStopId)}</span> },
    { id: "shift", header: "Shift", cell: (a) => <Badge tone="info">{transportShiftLabels[a.shift]}</Badge>, defaultVisible: false },
    { id: "status", header: "Status", align: "right", cell: (a) => <Badge tone={statusTone[a.status]}>{transportAssignmentStatusLabels[a.status]}</Badge> },
  ];

  const rowActions: RowAction<StudentTransportAssignment>[] = canManage
    ? [{ key: "withdraw", label: "Withdraw", hidden: (a) => a.status !== "active", destructive: true, onSelect: (a) => withdrawStudentTransport(a.id, "Withdrawn by transport office", ACTOR) }]
    : [];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Student transport assignments</h1>
          <p className="text-xs text-muted-foreground">{CURRENT_SESSION} · Assign students to routes, stops and seats</p>
        </div>
        {canManage && (
          <div className="flex items-center gap-xs">
            <Button size="sm" variant="outline" onClick={() => setBulkOpen(true)}>
              Bulk assign
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="size-3.5" />
              Assign student
            </Button>
          </div>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={[...db.studentTransportAssignments].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))}
        getRowId={(a) => a.id}
        caption="Student transport assignments"
        rowActions={rowActions}
        renderMobileCard={(a) => (
          <div className="surface-3d flex flex-col gap-1 rounded-lg border border-border bg-surface p-sm">
            <div className="flex items-center justify-between gap-xs">
              <p className="truncate text-sm font-semibold text-foreground">{studentName(a.studentId)}</p>
              <Badge tone={statusTone[a.status]}>{transportAssignmentStatusLabels[a.status]}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {routeName(a.routeId)} · {stopName(a.pickupStopId)}
            </p>
          </div>
        )}
        emptyIcon={UsersRound}
        emptyTitle="No transport assignments yet"
      />

      <DetailDrawer
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setError(null);
        }}
        title="Assign student transport"
        description="Validated against route capacity, stops and shift"
      >
        <div className="flex flex-col gap-sm">
          {error && <p className="text-xs text-error">{error}</p>}
          <div>
            <Label>Student</Label>
            <Select value={studentId} onValueChange={setStudentId}>
              <SelectTrigger aria-label="Student">
                <SelectValue placeholder="Select student" />
              </SelectTrigger>
              <SelectContent>
                {students
                  .filter((s) => s.status === "active")
                  .slice(0, 150)
                  .map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.profile.firstName} {s.profile.lastName}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Route</Label>
            <Select
              value={routeId}
              onValueChange={(v) => {
                setRouteId(v);
                setPickupStopId("");
              }}
            >
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
            <Label>Pickup / drop stop</Label>
            <Select value={pickupStopId} onValueChange={setPickupStopId} disabled={!routeId}>
              <SelectTrigger aria-label="Stop">
                <SelectValue placeholder="Select stop" />
              </SelectTrigger>
              <SelectContent>
                {selectedRouteStops.map((rs) => (
                  <SelectItem key={rs.stopId} value={rs.stopId}>
                    {stopName(rs.stopId)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            disabled={!studentId || !routeId || !pickupStopId}
            onClick={() => {
              const route = routes.find((r) => r.id === routeId)!;
              const result = assignStudentTransport({ studentId, session: CURRENT_SESSION, routeId, pickupStopId, dropStopId: pickupStopId, shift: route.shift, vehicleId: route.assignedVehicleId, effectiveFrom: new Date().toISOString().slice(0, 10) }, ACTOR);
              if (!result.ok) {
                setError(result.error);
                return;
              }
              setCreateOpen(false);
              setStudentId("");
              setRouteId("");
              setPickupStopId("");
            }}
          >
            Assign transport
          </Button>
        </div>
      </DetailDrawer>

      <DetailDrawer
        open={bulkOpen}
        onOpenChange={(open) => {
          setBulkOpen(open);
          if (!open) setBulkResult(null);
        }}
        title="Bulk assign by class"
        description="Assigns every active student in the class to the selected route and stop"
      >
        <div className="flex flex-col gap-sm">
          {bulkResult && (
            <p className="text-xs text-success">
              {bulkResult.assigned} assigned, {bulkResult.skipped} skipped (capacity or duplicate).
            </p>
          )}
          <div>
            <Label>Class</Label>
            <Select value={bulkClassId} onValueChange={setBulkClassId}>
              <SelectTrigger aria-label="Class">
                <SelectValue placeholder="Select class" />
              </SelectTrigger>
              <SelectContent>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Route</Label>
            <Select
              value={bulkRouteId}
              onValueChange={(v) => {
                setBulkRouteId(v);
                setBulkStopId("");
              }}
            >
              <SelectTrigger aria-label="Bulk route">
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
            <Label>Stop</Label>
            <Select value={bulkStopId} onValueChange={setBulkStopId} disabled={!bulkRouteId}>
              <SelectTrigger aria-label="Bulk stop">
                <SelectValue placeholder="Select stop" />
              </SelectTrigger>
              <SelectContent>
                {bulkRouteStops.map((rs) => (
                  <SelectItem key={rs.stopId} value={rs.stopId}>
                    {stopName(rs.stopId)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            disabled={!bulkClassId || !bulkRouteId || !bulkStopId}
            onClick={() => {
              const classStudentIds = students.filter((s) => s.classId === bulkClassId && s.status === "active").map((s) => s.id);
              const result = bulkAssignStudentsToRoute(classStudentIds, bulkRouteId, bulkStopId, bulkStopId, CURRENT_SESSION, ACTOR);
              setBulkResult({ assigned: result.assigned.length, skipped: result.skipped.length });
            }}
          >
            Run bulk assignment
          </Button>
        </div>
      </DetailDrawer>
    </div>
  );
}
