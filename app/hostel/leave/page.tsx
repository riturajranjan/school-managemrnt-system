"use client";

// Hostel Leave (Production migration, Phase C1) — real PostgreSQL/API
// cutover. hostelId/roomId are always the resident's current active hostel
// assignment (server-derived, never client-supplied) — the resident picker
// below only ever offers current active residents.
import { useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Check, Plus, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import {
  approveHostelLeaveRequestRequest,
  cancelHostelLeaveRequestRequest,
  createHostelLeaveRequestRequest,
  rejectHostelLeaveRequestRequest,
  useHostelAssignments,
  useHostelLeaveRequests,
} from "@/lib/hooks/api/use-hostel-api";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { roleLabels } from "@/lib/permissions/roles";
import type { HostelLeaveStatusDto, HostelLeaveTypeDto } from "@/lib/api/contracts";
import { formatDate } from "@/lib/utils";

const PAGE_SIZE = 20;

const typeLabels: Record<HostelLeaveTypeDto, string> = { home: "Home visit", medical: "Medical", weekend: "Weekend", emergency: "Emergency", day_out: "Day out", other: "Other" };
const statusLabels: Record<HostelLeaveStatusDto, string> = { pending: "Pending", approved: "Approved", rejected: "Rejected", cancelled: "Cancelled" };
const statusTone: Record<HostelLeaveStatusDto, "success" | "warning" | "error" | "neutral" | "info"> = { pending: "warning", approved: "success", rejected: "error", cancelled: "neutral" };

export default function HostelLeavePage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 250);
  const [statusFilter, setStatusFilter] = useState<HostelLeaveStatusDto | "all">("all");
  const [page, setPage] = useState(1);
  const { data: rows, meta, loading, error, reload } = useHostelLeaveRequests({
    search: debouncedSearch || undefined,
    status: statusFilter === "all" ? undefined : statusFilter,
    page,
    pageSize: PAGE_SIZE,
  });
  const { data: residents } = useHostelAssignments({ status: "active" });
  const [busyId, setBusyId] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [leaveType, setLeaveType] = useState<HostelLeaveTypeDto>("home");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [reason, setReason] = useState("");
  const [remarks, setRemarks] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  if (!capabilitiesLoading && !hasServerPermission("hostel.view") && !hasServerPermission("hostel.manage")) {
    return <PermissionDenied action="view hostel leave" role={roleLabels[role]} backHref="/hostel" />;
  }
  const canManage = hasServerPermission("hostel.manage");
  const isFiltered = searchInput.trim().length > 0 || statusFilter !== "all";
  const totalPages = meta?.totalPages ?? 1;

  function resetForm() {
    setStudentId(""); setLeaveType("home"); setFromDate(""); setToDate(""); setReason(""); setRemarks(""); setFormError(null);
  }

  async function submit() {
    setFormError(null);
    if (!studentId) return setFormError("Select a resident.");
    if (!fromDate || !toDate) return setFormError("From and to dates are required.");
    if (fromDate > toDate) return setFormError("From date must be on or before the to date.");
    if (!reason.trim()) return setFormError("Reason is required.");
    const res = await createHostelLeaveRequestRequest({ studentId, leaveType, fromDate, toDate, reason: reason.trim(), remarks: remarks.trim() || undefined });
    if (!res.success) return setFormError(res.error.message);
    resetForm();
    setCreateOpen(false);
    reload();
  }

  async function act(id: string, fn: (id: string) => Promise<{ success: boolean }>) {
    setBusyId(id);
    await fn(id);
    setBusyId(null);
    reload();
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-lg font-semibold text-foreground">Hostel leave</h1><p className="text-xs text-muted-foreground">Home visits, day-outs and approvals</p></div>
        {canManage && <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="size-3.5" /> New request</Button>}
      </div>

      {error && (
        <div className="rounded-lg border border-error/30 bg-error/5 p-md text-sm text-error" role="alert">
          Could not load leave requests: {error}
          <Button variant="outline" size="sm" className="ml-sm" onClick={reload}>Retry</Button>
        </div>
      )}

      <div className="flex flex-col gap-sm sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={searchInput}
            onChange={(e) => { setSearchInput(e.target.value); setPage(1); }}
            placeholder="Search resident name or admission no…"
            aria-label="Search leave requests"
            className="w-full rounded-md border border-border bg-surface py-1.5 pl-8 pr-3 text-sm text-foreground outline-none focus:border-primary"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as HostelLeaveStatusDto | "all"); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-44" aria-label="Filter by status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {(Object.keys(statusLabels) as HostelLeaveStatusDto[]).map((s) => <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading && rows.length === 0 ? (
        <p className="py-2xl text-center text-sm text-muted-foreground">Loading leave requests…</p>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
          <CalendarDays className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{isFiltered ? "No leave requests match your search or filters." : "No hostel leave requests yet."}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-sm">
          {rows.map((l) => (
            <div key={l.id} className="rounded-lg border border-border bg-surface p-sm">
              <div className="flex items-start justify-between gap-sm">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{l.studentName} <span className="text-xs text-muted-foreground">· {l.admissionNumber}</span></p>
                  <p className="text-xs text-muted-foreground">{typeLabels[l.leaveType]} · {formatDate(l.fromDate)} → {formatDate(l.toDate)} · {l.hostelName} Room {l.roomNumber}</p>
                  <p className="text-xs text-muted-foreground">{l.reason}</p>
                  {l.reviewedByName && <p className="text-xs text-muted-foreground">Reviewed by {l.reviewedByName}{l.reviewNote ? ` — ${l.reviewNote}` : ""}</p>}
                </div>
                <Badge tone={statusTone[l.status]}>{statusLabels[l.status]}</Badge>
              </div>
              {canManage && l.status === "pending" && (
                <div className="mt-2 flex gap-xs">
                  <Button size="sm" variant="outline" disabled={busyId === l.id} onClick={() => act(l.id, approveHostelLeaveRequestRequest)}><Check className="size-3.5" /> Approve</Button>
                  <Button size="sm" variant="ghost" disabled={busyId === l.id} onClick={() => act(l.id, rejectHostelLeaveRequestRequest)}><X className="size-3.5" /> Reject</Button>
                  <Button size="sm" variant="ghost" disabled={busyId === l.id} onClick={() => act(l.id, cancelHostelLeaveRequestRequest)}>Cancel</Button>
                </div>
              )}
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
        <DetailDrawer open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) resetForm(); }} title="New leave request" description="Real, active hostel resident only">
          <div className="flex flex-col gap-sm">
            <div>
              <Label htmlFor="leave-student">Resident</Label>
              <Select value={studentId} onValueChange={setStudentId}>
                <SelectTrigger id="leave-student"><SelectValue placeholder="Select resident" /></SelectTrigger>
                <SelectContent>{residents.map((r) => <SelectItem key={r.studentId} value={r.studentId}>{r.studentName} · {r.admissionNumber} · {r.hostelName} {r.roomNumber}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="leave-type">Leave type</Label>
              <Select value={leaveType} onValueChange={(v) => setLeaveType(v as HostelLeaveTypeDto)}>
                <SelectTrigger id="leave-type"><SelectValue /></SelectTrigger>
                <SelectContent>{(Object.keys(typeLabels) as HostelLeaveTypeDto[]).map((t) => <SelectItem key={t} value={t}>{typeLabels[t]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-sm">
              <div><Label htmlFor="leave-from">From date</Label><Input id="leave-from" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} /></div>
              <div><Label htmlFor="leave-to">To date</Label><Input id="leave-to" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} /></div>
            </div>
            <div><Label htmlFor="leave-reason">Reason</Label><Textarea id="leave-reason" value={reason} onChange={(e) => setReason(e.target.value)} /></div>
            <div><Label htmlFor="leave-remarks">Remarks (optional)</Label><Textarea id="leave-remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} /></div>
            {formError && <p className="text-sm text-error">{formError}</p>}
            <Button onClick={submit}>Submit request</Button>
          </div>
        </DetailDrawer>
      )}
    </div>
  );
}
