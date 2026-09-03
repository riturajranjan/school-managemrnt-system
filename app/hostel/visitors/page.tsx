"use client";

// Hostel Visitors (Production migration, Phase C1) — RESIDENT/hostel visitor
// management, real PostgreSQL/API cutover. Deliberately separate from Front
// Desk Visitors (/front-desk/visitors) — a hostel visitor is always tied to
// one resident. hostelId/roomId are server-derived from the resident's
// current active assignment, never client-supplied.
import { useState } from "react";
import { ChevronLeft, ChevronRight, LogIn, LogOut, Plus, Search, UsersRound, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import {
  cancelHostelVisitorRequest,
  checkInHostelVisitorRequest,
  checkOutHostelVisitorRequest,
  createHostelVisitorRequest,
  useHostelAssignments,
  useHostelVisitors,
} from "@/lib/hooks/api/use-hostel-api";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { roleLabels } from "@/lib/permissions/roles";
import type { HostelVisitorStatusDto } from "@/lib/api/contracts";

const PAGE_SIZE = 20;

const statusLabels: Record<HostelVisitorStatusDto, string> = { expected: "Expected", checked_in: "Checked in", checked_out: "Checked out", cancelled: "Cancelled" };
const statusTone: Record<HostelVisitorStatusDto, "success" | "warning" | "error" | "neutral" | "info"> = { expected: "info", checked_in: "success", checked_out: "neutral", cancelled: "error" };

export default function HostelVisitorsPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 250);
  const [statusFilter, setStatusFilter] = useState<HostelVisitorStatusDto | "all">("all");
  const [page, setPage] = useState(1);
  const { data: rows, meta, loading, error, reload } = useHostelVisitors({
    search: debouncedSearch || undefined,
    status: statusFilter === "all" ? undefined : statusFilter,
    page,
    pageSize: PAGE_SIZE,
  });
  const { data: residents } = useHostelAssignments({ status: "active" });
  const [busyId, setBusyId] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [visitorName, setVisitorName] = useState("");
  const [relation, setRelation] = useState("");
  const [phone, setPhone] = useState("");
  const [purpose, setPurpose] = useState("");
  const [expectedAt, setExpectedAt] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  if (!capabilitiesLoading && !hasServerPermission("hostel.view") && !hasServerPermission("hostel.manage")) {
    return <PermissionDenied action="view hostel visitors" role={roleLabels[role]} backHref="/hostel" />;
  }
  const canManage = hasServerPermission("hostel.manage");
  const isFiltered = searchInput.trim().length > 0 || statusFilter !== "all";
  const totalPages = meta?.totalPages ?? 1;

  function resetForm() {
    setStudentId(""); setVisitorName(""); setRelation(""); setPhone(""); setPurpose(""); setExpectedAt(""); setFormError(null);
  }

  async function submit() {
    setFormError(null);
    if (!studentId) return setFormError("Select a resident.");
    if (!visitorName.trim() || !relation.trim() || !purpose.trim()) return setFormError("Visitor name, relation, and purpose are required.");
    const res = await createHostelVisitorRequest({ studentId, visitorName: visitorName.trim(), relation: relation.trim(), phone: phone.trim() || undefined, purpose: purpose.trim(), expectedAt: expectedAt || undefined });
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
        <div><h1 className="text-lg font-semibold text-foreground">Hostel visitors</h1><p className="text-xs text-muted-foreground">Visitor requests for hostel residents</p></div>
        {canManage && <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="size-3.5" /> New visitor</Button>}
      </div>

      {error && (
        <div className="rounded-lg border border-error/30 bg-error/5 p-md text-sm text-error" role="alert">
          Could not load visitors: {error}
          <Button variant="outline" size="sm" className="ml-sm" onClick={reload}>Retry</Button>
        </div>
      )}

      <div className="flex flex-col gap-sm sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={searchInput}
            onChange={(e) => { setSearchInput(e.target.value); setPage(1); }}
            placeholder="Search visitor or resident…"
            aria-label="Search visitors"
            className="w-full rounded-md border border-border bg-surface py-1.5 pl-8 pr-3 text-sm text-foreground outline-none focus:border-primary"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as HostelVisitorStatusDto | "all"); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-44" aria-label="Filter by status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {(Object.keys(statusLabels) as HostelVisitorStatusDto[]).map((s) => <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading && rows.length === 0 ? (
        <p className="py-2xl text-center text-sm text-muted-foreground">Loading visitors…</p>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
          <UsersRound className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{isFiltered ? "No visitors match your search or filters." : "No hostel visitors yet."}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-sm">
          {rows.map((v) => (
            <div key={v.id} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{v.visitorName} <span className="text-xs text-muted-foreground">({v.relation})</span></p>
                <p className="truncate text-xs text-muted-foreground">For {v.studentName} · {v.admissionNumber} · {v.hostelName} Room {v.roomNumber}</p>
                <p className="truncate text-xs text-muted-foreground">{v.purpose}{v.checkedInAt ? ` · in ${new Date(v.checkedInAt).toTimeString().slice(0, 5)}` : v.expectedAt ? ` · expected ${new Date(v.expectedAt).toLocaleString()}` : ""}</p>
              </div>
              <div className="flex shrink-0 items-center gap-xs">
                <Badge tone={statusTone[v.status]}>{statusLabels[v.status]}</Badge>
                {canManage && v.status === "expected" && (
                  <>
                    <Button size="sm" variant="outline" disabled={busyId === v.id} onClick={() => act(v.id, checkInHostelVisitorRequest)}><LogIn className="size-3.5" /> Check in</Button>
                    <Button size="sm" variant="ghost" disabled={busyId === v.id} onClick={() => act(v.id, cancelHostelVisitorRequest)}><X className="size-3.5" /></Button>
                  </>
                )}
                {canManage && v.status === "checked_in" && <Button size="sm" variant="ghost" disabled={busyId === v.id} onClick={() => act(v.id, checkOutHostelVisitorRequest)}><LogOut className="size-3.5" /> Check out</Button>}
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
        <DetailDrawer open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) resetForm(); }} title="New hostel visitor" description="Real, active hostel resident only">
          <div className="flex flex-col gap-sm">
            <div>
              <Label htmlFor="visitor-student">Resident</Label>
              <Select value={studentId} onValueChange={setStudentId}>
                <SelectTrigger id="visitor-student"><SelectValue placeholder="Select resident" /></SelectTrigger>
                <SelectContent>{residents.map((r) => <SelectItem key={r.studentId} value={r.studentId}>{r.studentName} · {r.admissionNumber} · {r.hostelName} {r.roomNumber}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-sm">
              <div><Label htmlFor="visitor-name">Visitor name</Label><Input id="visitor-name" value={visitorName} onChange={(e) => setVisitorName(e.target.value)} /></div>
              <div><Label htmlFor="visitor-relation">Relation</Label><Input id="visitor-relation" value={relation} onChange={(e) => setRelation(e.target.value)} placeholder="e.g. Father" /></div>
            </div>
            <div><Label htmlFor="visitor-phone">Phone (optional)</Label><Input id="visitor-phone" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            <div><Label htmlFor="visitor-purpose">Purpose</Label><Input id="visitor-purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} /></div>
            <div><Label htmlFor="visitor-expected">Expected time (optional)</Label><Input id="visitor-expected" type="datetime-local" value={expectedAt} onChange={(e) => setExpectedAt(e.target.value)} /></div>
            {formError && <p className="text-sm text-error">{formError}</p>}
            <Button onClick={submit}>Add visitor</Button>
          </div>
        </DetailDrawer>
      )}
    </div>
  );
}
