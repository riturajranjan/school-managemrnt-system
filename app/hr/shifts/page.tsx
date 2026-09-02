"use client";

// Shifts (Production migration, Phase B, HR Sub-batch 4) — real
// PostgreSQL/API cutover. Relational ShiftAssignment (never an array of
// staff ids). Overlap prevention is concurrency-safe (row-locked) on the
// server — see lib/server/hr/shifts.ts. hr.view/hr.manage RBAC — no new
// permission.
import { useState } from "react";
import { CalendarClock, ChevronLeft, ChevronRight, Clock, Plus, Search, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { assignShiftRequest, createShiftRequest, setShiftStatusRequest, useShiftAssignments, useShifts } from "@/lib/hooks/api/use-hr-api";
import { useStaffList } from "@/lib/hooks/api/use-staff-api";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { roleLabels } from "@/lib/permissions/roles";
import type { ShiftDto, ShiftStatusDto } from "@/lib/api/contracts";
import { formatDate } from "@/lib/utils";

const PAGE_SIZE = 20;

const WEEKDAYS = [
  { code: "MON", label: "Mon" }, { code: "TUE", label: "Tue" }, { code: "WED", label: "Wed" }, { code: "THU", label: "Thu" },
  { code: "FRI", label: "Fri" }, { code: "SAT", label: "Sat" }, { code: "SUN", label: "Sun" },
];

export default function ShiftsPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 250);
  const [statusFilter, setStatusFilter] = useState<ShiftStatusDto | "all">("all");
  const [page, setPage] = useState(1);
  const { data: shifts, meta, loading, error, reload } = useShifts({
    search: debouncedSearch || undefined,
    status: statusFilter === "all" ? undefined : statusFilter,
    page,
    pageSize: PAGE_SIZE,
  });
  const { data: staff } = useStaffList({ status: "active", pageSize: 500 });
  const [createOpen, setCreateOpen] = useState(false);
  const [manageShift, setManageShift] = useState<ShiftDto | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [breakMinutes, setBreakMinutes] = useState("30");
  const [days, setDays] = useState<string[]>(["MON", "TUE", "WED", "THU", "FRI"]);
  const [formError, setFormError] = useState<string | null>(null);

  const [assignStaffId, setAssignStaffId] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const [effectiveUntil, setEffectiveUntil] = useState("");
  const [assignError, setAssignError] = useState<string | null>(null);

  const { data: assignments, reload: reloadAssignments } = useShiftAssignments(manageShift?.id);

  if (!capabilitiesLoading && !hasServerPermission("hr.view") && !hasServerPermission("hr.manage")) {
    return <PermissionDenied action="view shifts" role={roleLabels[role]} backHref="/hr" />;
  }
  const canManage = hasServerPermission("hr.manage");
  const isFiltered = searchInput.trim().length > 0 || statusFilter !== "all";
  const totalPages = meta?.totalPages ?? 1;

  function toMinutes(hhmm: string): number {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  }

  function resetForm() {
    setName(""); setStartTime("09:00"); setEndTime("17:00"); setBreakMinutes("30"); setDays(["MON", "TUE", "WED", "THU", "FRI"]); setFormError(null);
  }

  async function submit() {
    setFormError(null);
    if (!name.trim()) return setFormError("Name is required.");
    const res = await createShiftRequest({ name: name.trim(), startMinutes: toMinutes(startTime), endMinutes: toMinutes(endTime), breakMinutes: breakMinutes ? Number(breakMinutes) : undefined, workingDays: days });
    if (!res.success) return setFormError(res.error.message);
    resetForm();
    setCreateOpen(false);
    reload();
  }

  async function transition(shift: ShiftDto, status: ShiftStatusDto) {
    setBusyId(shift.id);
    await setShiftStatusRequest(shift.id, status);
    setBusyId(null);
    reload();
  }

  async function assign() {
    if (!manageShift || !assignStaffId) return;
    setAssignError(null);
    const res = await assignShiftRequest(manageShift.id, { staffId: assignStaffId, effectiveFrom, effectiveUntil: effectiveUntil || undefined });
    if (!res.success) return setAssignError(res.error.message);
    setAssignStaffId(""); setEffectiveUntil("");
    reloadAssignments();
    reload();
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Shifts</h1>
          <p className="text-xs text-muted-foreground">Shift definitions, timings and assignments</p>
        </div>
        {canManage && <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="size-3.5" /> New shift</Button>}
      </div>

      {error && (
        <div className="rounded-lg border border-error/30 bg-error/5 p-md text-sm text-error" role="alert">
          Could not load shifts: {error}
          <Button variant="outline" size="sm" className="ml-sm" onClick={reload}>Retry</Button>
        </div>
      )}

      <div className="flex flex-col gap-sm sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={searchInput}
            onChange={(e) => { setSearchInput(e.target.value); setPage(1); }}
            placeholder="Search shift name…"
            aria-label="Search shifts"
            className="w-full rounded-md border border-border bg-surface py-1.5 pl-8 pr-3 text-sm text-foreground outline-none focus:border-primary"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as ShiftStatusDto | "all"); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-40" aria-label="Filter by status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading && shifts.length === 0 ? (
        <p className="py-2xl text-center text-sm text-muted-foreground">Loading shifts…</p>
      ) : shifts.length === 0 ? (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
          <CalendarClock className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {isFiltered ? "No shifts match your search or filters." : "No shifts found."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
          {shifts.map((s) => (
            <div key={s.id} className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
              <div className="flex items-center justify-between gap-sm">
                <button className="flex min-w-0 items-center gap-sm text-left" onClick={() => setManageShift(s)}>
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"><CalendarClock className="size-4" /></span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground hover:underline">{s.name}</p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="size-3" /> {s.startTime}–{s.endTime} · {s.assignedCount} assigned</p>
                  </div>
                </button>
                <Badge tone={s.status === "active" ? "success" : "neutral"}>{s.status}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-sm text-center text-xs">
                <div className="rounded-md border border-border p-sm"><p className="text-muted-foreground">Break</p><p className="font-semibold text-foreground">{s.breakMinutes ?? 0}m</p></div>
                <div className="rounded-md border border-border p-sm"><p className="text-muted-foreground">Assigned</p><p className="font-semibold text-foreground">{s.assignedCount}</p></div>
              </div>
              <div className="flex flex-wrap gap-1">
                {WEEKDAYS.map((d) => (
                  <span key={d.code} className={`rounded-pill px-2 py-0.5 text-[11px] font-medium ${s.workingDays.includes(d.code) ? "bg-primary/10 text-primary" : "bg-surface-secondary text-muted-foreground line-through"}`}>{d.label}</span>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <Button size="sm" variant="outline" onClick={() => setManageShift(s)}><UserPlus className="size-3.5" /> Assignments</Button>
                {canManage && (
                  <Select value="" onValueChange={(v) => transition(s, v as ShiftStatusDto)}>
                    <SelectTrigger className="h-8 w-auto text-xs" disabled={busyId === s.id} aria-label="Change status"><SelectValue placeholder="Change status" /></SelectTrigger>
                    <SelectContent>{(s.status === "active" ? ["inactive"] : ["active"] as ShiftStatusDto[]).map((st) => <SelectItem key={st} value={st}>{st}</SelectItem>)}</SelectContent>
                  </Select>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {meta && totalPages > 1 && (
        <div className="flex items-center justify-between gap-sm text-sm">
          <span className="text-muted-foreground">Page {meta.page} of {totalPages} · {meta.total} total</span>
          <div className="flex gap-xs">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="size-3.5" /> Prev
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      )}

      {canManage && (
        <DetailDrawer open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) resetForm(); }} title="New shift" description="Create a real shift">
          <div className="flex flex-col gap-sm">
            <div><Label htmlFor="sh-name">Name</Label><Input id="sh-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Morning shift" /></div>
            <div className="grid grid-cols-2 gap-sm">
              <div><Label htmlFor="sh-start">Start time</Label><Input id="sh-start" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></div>
              <div><Label htmlFor="sh-end">End time</Label><Input id="sh-end" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></div>
            </div>
            <div><Label htmlFor="sh-break">Break (minutes)</Label><Input id="sh-break" type="number" min={0} value={breakMinutes} onChange={(e) => setBreakMinutes(e.target.value)} /></div>
            <div>
              <Label>Working days</Label>
              <div className="flex flex-wrap gap-xs">
                {WEEKDAYS.map((d) => {
                  const active = days.includes(d.code);
                  return (
                    <button key={d.code} type="button" onClick={() => setDays((prev) => (active ? prev.filter((x) => x !== d.code) : [...prev, d.code]))}
                      className={`rounded-pill px-sm py-1 text-xs font-medium ${active ? "bg-primary text-primary-foreground" : "bg-surface-secondary text-muted-foreground"}`}>
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>
            {formError && <p className="text-sm text-error">{formError}</p>}
            <Button onClick={submit}>Create shift</Button>
          </div>
        </DetailDrawer>
      )}

      <DetailDrawer open={Boolean(manageShift)} onOpenChange={(o) => { if (!o) { setManageShift(null); setAssignStaffId(""); setAssignError(null); } }} title={manageShift?.name ?? "Shift"} description="Staff assigned to this shift">
        {manageShift && (
          <div className="flex flex-col gap-md">
            {canManage && (
              <div className="flex flex-col gap-sm rounded-md border border-border p-sm">
                <p className="text-xs font-medium text-muted-foreground">Assign employee</p>
                <Select value={assignStaffId} onValueChange={setAssignStaffId}>
                  <SelectTrigger aria-label="Employee"><SelectValue placeholder="Select employee" /></SelectTrigger>
                  <SelectContent>{staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
                <div className="grid grid-cols-2 gap-sm">
                  <div><Label htmlFor="asg-from">Effective from</Label><Input id="asg-from" type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} /></div>
                  <div><Label htmlFor="asg-until">Effective until (optional)</Label><Input id="asg-until" type="date" value={effectiveUntil} onChange={(e) => setEffectiveUntil(e.target.value)} /></div>
                </div>
                {assignError && <p className="text-sm text-error">{assignError}</p>}
                <Button size="sm" disabled={!assignStaffId} onClick={assign}>Assign</Button>
              </div>
            )}
            <div className="flex flex-col gap-xs">
              {!assignments || assignments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No assignments yet.</p>
              ) : (
                assignments.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm text-sm">
                    <div className="min-w-0">
                      <p className="truncate text-foreground">{a.staffName} <span className="text-xs text-muted-foreground">· {a.employeeCode}</span></p>
                      <p className="truncate text-xs text-muted-foreground">{formatDate(a.effectiveFrom)} – {a.effectiveUntil ? formatDate(a.effectiveUntil) : "ongoing"}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}
