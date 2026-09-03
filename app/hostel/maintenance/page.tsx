"use client";

// Hostel Maintenance (Production migration, Phase C1) — real PostgreSQL/API
// cutover. Facility-level, NOT tied to a resident. No vendor/invoice/cost —
// see the schema's own doc comment for why (mirrors AssetMaintenanceRecord).
import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Search, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import {
  assignHostelMaintenanceRequest,
  cancelHostelMaintenanceRequest,
  completeHostelMaintenanceRequest,
  createHostelMaintenanceRequestRequest,
  startHostelMaintenanceRequest,
  useHostelMaintenanceRequests,
  useHostelRooms,
  useHostels,
} from "@/lib/hooks/api/use-hostel-api";
import { useStaffList } from "@/lib/hooks/api/use-staff-api";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { roleLabels } from "@/lib/permissions/roles";
import { timeAgo } from "@/lib/utils";
import type { HostelIssuePriorityDto, HostelMaintenanceRequestDto, HostelMaintenanceStatusDto } from "@/lib/api/contracts";

const PAGE_SIZE = 20;

const statusLabels: Record<HostelMaintenanceStatusDto, string> = { open: "Open", assigned: "Assigned", in_progress: "In progress", completed: "Completed", cancelled: "Cancelled" };
const statusTone: Record<HostelMaintenanceStatusDto, "success" | "warning" | "error" | "neutral" | "info"> = { open: "info", assigned: "warning", in_progress: "warning", completed: "success", cancelled: "neutral" };
const priorityTone: Record<HostelIssuePriorityDto, "success" | "warning" | "error" | "neutral"> = { low: "neutral", normal: "neutral", high: "warning", urgent: "error" };

export default function HostelMaintenancePage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 250);
  const [statusFilter, setStatusFilter] = useState<HostelMaintenanceStatusDto | "all">("all");
  const [page, setPage] = useState(1);
  const { data: rows, meta, loading, error, reload } = useHostelMaintenanceRequests({
    search: debouncedSearch || undefined,
    status: statusFilter === "all" ? undefined : statusFilter,
    page,
    pageSize: PAGE_SIZE,
  });
  const { data: hostels } = useHostels({ status: "active" });
  const { data: staff } = useStaffList({ status: "active", pageSize: 500 });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [assignFor, setAssignFor] = useState<HostelMaintenanceRequestDto | null>(null);
  const [assignStaffId, setAssignStaffId] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [hostelId, setHostelId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<HostelIssuePriorityDto>("normal");
  const [formError, setFormError] = useState<string | null>(null);
  const { data: roomsForHostel } = useHostelRooms({ hostelId: hostelId || undefined, status: "active" });

  if (!capabilitiesLoading && !hasServerPermission("hostel.view") && !hasServerPermission("hostel.manage")) {
    return <PermissionDenied action="view hostel maintenance" role={roleLabels[role]} backHref="/hostel" />;
  }
  const canManage = hasServerPermission("hostel.manage");
  const isFiltered = searchInput.trim().length > 0 || statusFilter !== "all";
  const totalPages = meta?.totalPages ?? 1;

  function resetForm() {
    setHostelId(""); setRoomId(""); setTitle(""); setDescription(""); setPriority("normal"); setFormError(null);
  }

  async function submit() {
    setFormError(null);
    if (!hostelId) return setFormError("Select a hostel.");
    if (!title.trim() || !description.trim()) return setFormError("Title and description are required.");
    const res = await createHostelMaintenanceRequestRequest({ hostelId, roomId: roomId || undefined, title: title.trim(), description: description.trim(), priority });
    if (!res.success) return setFormError(res.error.message);
    resetForm();
    setCreateOpen(false);
    reload();
  }

  async function doAssign() {
    if (!assignFor || !assignStaffId) return;
    setBusyId(assignFor.id);
    await assignHostelMaintenanceRequest(assignFor.id, { staffId: assignStaffId });
    setBusyId(null);
    setAssignFor(null);
    setAssignStaffId("");
    reload();
  }

  async function doStart(m: HostelMaintenanceRequestDto) {
    setBusyId(m.id);
    await startHostelMaintenanceRequest(m.id);
    setBusyId(null);
    reload();
  }

  async function doComplete(m: HostelMaintenanceRequestDto) {
    setBusyId(m.id);
    await completeHostelMaintenanceRequest(m.id);
    setBusyId(null);
    reload();
  }

  async function doCancel(m: HostelMaintenanceRequestDto) {
    setBusyId(m.id);
    await cancelHostelMaintenanceRequest(m.id);
    setBusyId(null);
    reload();
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-lg font-semibold text-foreground">Hostel maintenance</h1><p className="text-xs text-muted-foreground">{meta ? `${meta.total} total` : ""}</p></div>
        {canManage && <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="size-3.5" /> Report issue</Button>}
      </div>

      {error && (
        <div className="rounded-lg border border-error/30 bg-error/5 p-md text-sm text-error" role="alert">
          Could not load maintenance requests: {error}
          <Button variant="outline" size="sm" className="ml-sm" onClick={reload}>Retry</Button>
        </div>
      )}

      <div className="flex flex-col gap-sm sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={searchInput}
            onChange={(e) => { setSearchInput(e.target.value); setPage(1); }}
            placeholder="Search title or description…"
            aria-label="Search maintenance requests"
            className="w-full rounded-md border border-border bg-surface py-1.5 pl-8 pr-3 text-sm text-foreground outline-none focus:border-primary"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as HostelMaintenanceStatusDto | "all"); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-44" aria-label="Filter by status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {(Object.keys(statusLabels) as HostelMaintenanceStatusDto[]).map((s) => <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading && rows.length === 0 ? (
        <p className="py-2xl text-center text-sm text-muted-foreground">Loading maintenance requests…</p>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
          <Wrench className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{isFiltered ? "No maintenance requests match your search or filters." : "No hostel maintenance requests yet."}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-sm">
          {rows.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{m.title}</p>
                <p className="truncate text-xs text-muted-foreground">{m.description}</p>
                <p className="text-xs text-muted-foreground">{m.hostelName}{m.roomNumber ? ` Room ${m.roomNumber}` : ""}{m.assignedStaffName ? ` · ${m.assignedStaffName}` : " · Unassigned"} · {timeAgo(m.createdAt)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-xs">
                <Badge tone={priorityTone[m.priority]}>{m.priority}</Badge>
                <Badge tone={statusTone[m.status]}>{statusLabels[m.status]}</Badge>
                {canManage && (m.status === "open" || m.status === "assigned") && (
                  <Button size="sm" variant="outline" disabled={busyId === m.id} onClick={() => setAssignFor(m)}>{m.status === "open" ? "Assign" : "Reassign"}</Button>
                )}
                {canManage && m.status === "assigned" && <Button size="sm" variant="ghost" disabled={busyId === m.id} onClick={() => doStart(m)}>Start</Button>}
                {canManage && (m.status === "assigned" || m.status === "in_progress") && <Button size="sm" variant="ghost" disabled={busyId === m.id} onClick={() => doComplete(m)}>Complete</Button>}
                {canManage && (m.status === "open" || m.status === "assigned") && <Button size="sm" variant="ghost" disabled={busyId === m.id} onClick={() => doCancel(m)}>Cancel</Button>}
              </div>
            </div>
          ))}
        </div>
      )}

      {meta && totalPages > 1 && (
        <div className="flex items-center justify-between gap-sm text-sm">
          <span className="text-muted-foreground">Page {meta.page} of {totalPages} · {meta.total} total</span>
          <div className="flex gap-xs">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="size-3.5" /> Prev</Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next <ChevronRight className="size-3.5" /></Button>
          </div>
        </div>
      )}

      {canManage && (
        <DetailDrawer open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) resetForm(); }} title="Report maintenance issue" description="Facility-level — not tied to a resident">
          <div className="flex flex-col gap-sm">
            <div>
              <Label htmlFor="maint-hostel">Hostel</Label>
              <Select value={hostelId} onValueChange={(v) => { setHostelId(v); setRoomId(""); }}>
                <SelectTrigger id="maint-hostel"><SelectValue placeholder="Select hostel" /></SelectTrigger>
                <SelectContent>{hostels.map((h) => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="maint-room">Room (optional)</Label>
              <Select value={roomId} onValueChange={setRoomId} disabled={!hostelId}>
                <SelectTrigger id="maint-room"><SelectValue placeholder="Whole hostel / common area" /></SelectTrigger>
                <SelectContent>{roomsForHostel.map((r) => <SelectItem key={r.id} value={r.id}>{r.roomNumber}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="maint-priority">Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as HostelIssuePriorityDto)}>
                <SelectTrigger id="maint-priority"><SelectValue /></SelectTrigger>
                <SelectContent>{(["low", "normal", "high", "urgent"] as HostelIssuePriorityDto[]).map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label htmlFor="maint-title">Title</Label><Input id="maint-title" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
            <div><Label htmlFor="maint-description">Description</Label><Textarea id="maint-description" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
            {formError && <p className="text-sm text-error">{formError}</p>}
            <Button onClick={submit}>Report issue</Button>
          </div>
        </DetailDrawer>
      )}

      {canManage && (
        <DetailDrawer open={assignFor !== null} onOpenChange={(o) => { if (!o) { setAssignFor(null); setAssignStaffId(""); } }} title="Assign maintenance" description="Real, active staff member">
          <div className="flex flex-col gap-md">
            <Select value={assignStaffId} onValueChange={setAssignStaffId}>
              <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
              <SelectContent>{staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
            <Button onClick={doAssign} disabled={!assignStaffId}>Assign</Button>
          </div>
        </DetailDrawer>
      )}
    </div>
  );
}
