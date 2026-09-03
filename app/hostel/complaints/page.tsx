"use client";

// Hostel Complaints (Production migration, Phase C1) — real PostgreSQL/API
// cutover. hostelId/roomId are server-derived from the complainant's current
// active hostel assignment; assigned staff is always a real, active,
// in-school Staff.id — never a free-text "team" name.
import { useState } from "react";
import { ChevronLeft, ChevronRight, MessageSquareWarning, Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import {
  assignHostelComplaintRequest,
  closeHostelComplaintRequest,
  createHostelComplaintRequest,
  resolveHostelComplaintRequest,
  startHostelComplaintRequest,
  useHostelAssignments,
  useHostelComplaints,
} from "@/lib/hooks/api/use-hostel-api";
import { useStaffList } from "@/lib/hooks/api/use-staff-api";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { roleLabels } from "@/lib/permissions/roles";
import { timeAgo } from "@/lib/utils";
import type { HostelComplaintCategoryDto, HostelComplaintDto, HostelComplaintStatusDto, HostelIssuePriorityDto } from "@/lib/api/contracts";

const PAGE_SIZE = 20;

const categoryLabels: Record<HostelComplaintCategoryDto, string> = {
  electricity: "Electricity", water: "Water", furniture: "Furniture", cleaning: "Cleaning", bathroom: "Bathroom",
  wifi: "Wi-Fi", roommate: "Roommate issue", safety: "Safety", mess: "Mess", other: "Other",
};
const statusLabels: Record<HostelComplaintStatusDto, string> = { open: "Open", assigned: "Assigned", in_progress: "In progress", resolved: "Resolved", closed: "Closed" };
const statusTone: Record<HostelComplaintStatusDto, "success" | "warning" | "error" | "neutral" | "info"> = { open: "info", assigned: "warning", in_progress: "warning", resolved: "success", closed: "neutral" };
const priorityTone: Record<HostelIssuePriorityDto, "success" | "warning" | "error" | "neutral"> = { low: "neutral", normal: "neutral", high: "warning", urgent: "error" };

export default function HostelComplaintsPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 250);
  const [statusFilter, setStatusFilter] = useState<HostelComplaintStatusDto | "all">("all");
  const [page, setPage] = useState(1);
  const { data: rows, meta, loading, error, reload } = useHostelComplaints({
    search: debouncedSearch || undefined,
    status: statusFilter === "all" ? undefined : statusFilter,
    page,
    pageSize: PAGE_SIZE,
  });
  const { data: residents } = useHostelAssignments({ status: "active" });
  const { data: staff } = useStaffList({ status: "active", pageSize: 500 });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [assignFor, setAssignFor] = useState<HostelComplaintDto | null>(null);
  const [assignStaffId, setAssignStaffId] = useState("");
  const [resolveFor, setResolveFor] = useState<HostelComplaintDto | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [category, setCategory] = useState<HostelComplaintCategoryDto>("other");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<HostelIssuePriorityDto>("normal");
  const [formError, setFormError] = useState<string | null>(null);

  if (!capabilitiesLoading && !hasServerPermission("hostel.view") && !hasServerPermission("hostel.manage")) {
    return <PermissionDenied action="view hostel complaints" role={roleLabels[role]} backHref="/hostel" />;
  }
  const canManage = hasServerPermission("hostel.manage");
  const isFiltered = searchInput.trim().length > 0 || statusFilter !== "all";
  const totalPages = meta?.totalPages ?? 1;

  function resetForm() {
    setStudentId(""); setCategory("other"); setTitle(""); setDescription(""); setPriority("normal"); setFormError(null);
  }

  async function submit() {
    setFormError(null);
    if (!studentId) return setFormError("Select a resident.");
    if (!title.trim() || !description.trim()) return setFormError("Title and description are required.");
    const res = await createHostelComplaintRequest({ studentId, category, title: title.trim(), description: description.trim(), priority });
    if (!res.success) return setFormError(res.error.message);
    resetForm();
    setCreateOpen(false);
    reload();
  }

  async function doAssign() {
    if (!assignFor || !assignStaffId) return;
    setBusyId(assignFor.id);
    await assignHostelComplaintRequest(assignFor.id, { staffId: assignStaffId });
    setBusyId(null);
    setAssignFor(null);
    setAssignStaffId("");
    reload();
  }

  async function doResolve() {
    if (!resolveFor || !resolutionNotes.trim()) return;
    setBusyId(resolveFor.id);
    await resolveHostelComplaintRequest(resolveFor.id, { resolutionNotes: resolutionNotes.trim() });
    setBusyId(null);
    setResolveFor(null);
    setResolutionNotes("");
    reload();
  }

  async function doStart(c: HostelComplaintDto) {
    setBusyId(c.id);
    await startHostelComplaintRequest(c.id);
    setBusyId(null);
    reload();
  }

  async function doClose(c: HostelComplaintDto) {
    setBusyId(c.id);
    await closeHostelComplaintRequest(c.id);
    setBusyId(null);
    reload();
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-lg font-semibold text-foreground">Hostel complaints</h1><p className="text-xs text-muted-foreground">{meta ? `${meta.total} total` : ""}</p></div>
        {canManage && <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="size-3.5" /> New complaint</Button>}
      </div>

      {error && (
        <div className="rounded-lg border border-error/30 bg-error/5 p-md text-sm text-error" role="alert">
          Could not load complaints: {error}
          <Button variant="outline" size="sm" className="ml-sm" onClick={reload}>Retry</Button>
        </div>
      )}

      <div className="flex flex-col gap-sm sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={searchInput}
            onChange={(e) => { setSearchInput(e.target.value); setPage(1); }}
            placeholder="Search title, description or admission no…"
            aria-label="Search complaints"
            className="w-full rounded-md border border-border bg-surface py-1.5 pl-8 pr-3 text-sm text-foreground outline-none focus:border-primary"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as HostelComplaintStatusDto | "all"); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-44" aria-label="Filter by status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {(Object.keys(statusLabels) as HostelComplaintStatusDto[]).map((s) => <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading && rows.length === 0 ? (
        <p className="py-2xl text-center text-sm text-muted-foreground">Loading complaints…</p>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
          <MessageSquareWarning className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{isFiltered ? "No complaints match your search or filters." : "No hostel complaints yet."}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-sm">
          {rows.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{c.title} <span className="text-xs text-muted-foreground">· {categoryLabels[c.category]}</span></p>
                <p className="truncate text-xs text-muted-foreground">{c.description}</p>
                <p className="text-xs text-muted-foreground">{c.studentName} · {c.hostelName}{c.roomNumber ? ` Room ${c.roomNumber}` : ""}{c.assignedStaffName ? ` · ${c.assignedStaffName}` : ""} · {timeAgo(c.createdAt)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-xs">
                <Badge tone={priorityTone[c.priority]}>{c.priority}</Badge>
                <Badge tone={statusTone[c.status]}>{statusLabels[c.status]}</Badge>
                {canManage && (c.status === "open" || c.status === "assigned") && (
                  <Button size="sm" variant="outline" disabled={busyId === c.id} onClick={() => setAssignFor(c)}>{c.status === "open" ? "Assign" : "Reassign"}</Button>
                )}
                {canManage && c.status === "assigned" && <Button size="sm" variant="ghost" disabled={busyId === c.id} onClick={() => doStart(c)}>Start</Button>}
                {canManage && (c.status === "assigned" || c.status === "in_progress") && <Button size="sm" variant="ghost" disabled={busyId === c.id} onClick={() => setResolveFor(c)}>Resolve</Button>}
                {canManage && c.status === "resolved" && <Button size="sm" variant="ghost" disabled={busyId === c.id} onClick={() => doClose(c)}>Close</Button>}
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
        <DetailDrawer open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) resetForm(); }} title="New complaint" description="Real, active hostel resident only">
          <div className="flex flex-col gap-sm">
            <div>
              <Label htmlFor="complaint-student">Resident</Label>
              <Select value={studentId} onValueChange={setStudentId}>
                <SelectTrigger id="complaint-student"><SelectValue placeholder="Select resident" /></SelectTrigger>
                <SelectContent>{residents.map((r) => <SelectItem key={r.studentId} value={r.studentId}>{r.studentName} · {r.admissionNumber} · {r.hostelName} {r.roomNumber}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-sm">
              <div>
                <Label htmlFor="complaint-category">Category</Label>
                <Select value={category} onValueChange={(v) => setCategory(v as HostelComplaintCategoryDto)}>
                  <SelectTrigger id="complaint-category"><SelectValue /></SelectTrigger>
                  <SelectContent>{(Object.keys(categoryLabels) as HostelComplaintCategoryDto[]).map((c) => <SelectItem key={c} value={c}>{categoryLabels[c]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="complaint-priority">Priority</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as HostelIssuePriorityDto)}>
                  <SelectTrigger id="complaint-priority"><SelectValue /></SelectTrigger>
                  <SelectContent>{(["low", "normal", "high", "urgent"] as HostelIssuePriorityDto[]).map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label htmlFor="complaint-title">Title</Label><Input id="complaint-title" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
            <div><Label htmlFor="complaint-description">Description</Label><Textarea id="complaint-description" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
            {formError && <p className="text-sm text-error">{formError}</p>}
            <Button onClick={submit}>File complaint</Button>
          </div>
        </DetailDrawer>
      )}

      {canManage && (
        <DetailDrawer open={assignFor !== null} onOpenChange={(o) => { if (!o) { setAssignFor(null); setAssignStaffId(""); } }} title="Assign complaint" description="Real, active staff member">
          <div className="flex flex-col gap-md">
            <Select value={assignStaffId} onValueChange={setAssignStaffId}>
              <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
              <SelectContent>{staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
            <Button onClick={doAssign} disabled={!assignStaffId}>Assign</Button>
          </div>
        </DetailDrawer>
      )}

      {canManage && (
        <DetailDrawer open={resolveFor !== null} onOpenChange={(o) => { if (!o) { setResolveFor(null); setResolutionNotes(""); } }} title="Resolve complaint" description={resolveFor?.title}>
          <div className="flex flex-col gap-md">
            <div><Label htmlFor="resolution-notes">Resolution notes</Label><Textarea id="resolution-notes" value={resolutionNotes} onChange={(e) => setResolutionNotes(e.target.value)} /></div>
            <Button onClick={doResolve} disabled={!resolutionNotes.trim()}>Mark resolved</Button>
          </div>
        </DetailDrawer>
      )}
    </div>
  );
}
