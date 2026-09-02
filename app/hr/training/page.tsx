"use client";

// Training (Production migration, Phase B, HR Sub-batch 3) — real
// PostgreSQL/API cutover. Relational TrainingParticipant records (never an
// array of staff ids on the program). hr.view/hr.manage RBAC, no new
// permission. No score/result field — no genuine assessment engine exists;
// certificateIssued is a simple recorded fact HR can mark.
import Link from "next/link";
import { useState } from "react";
import { CalendarClock, ChevronLeft, ChevronRight, GraduationCap, ListChecks, Plus, Search, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatTile } from "@/components/ui/stat-tile";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import {
  assignTrainingParticipantRequest,
  createTrainingProgramRequest,
  setTrainingParticipantStatusRequest,
  setTrainingProgramStatusRequest,
  useTrainingParticipants,
  useTrainingPrograms,
  useTrainingProgramsSummary,
} from "@/lib/hooks/api/use-hr-api";
import { useStaffList } from "@/lib/hooks/api/use-staff-api";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { roleLabels } from "@/lib/permissions/roles";
import type { TrainingParticipantStatusDto, TrainingProgramDto, TrainingProgramStatusDto } from "@/lib/api/contracts";
import { formatDate } from "@/lib/utils";

const PAGE_SIZE = 20;

const programStatusLabels: Record<TrainingProgramStatusDto, string> = {
  draft: "Draft", scheduled: "Scheduled", "in-progress": "In progress", completed: "Completed", cancelled: "Cancelled", archived: "Archived",
};
const programStatusTone: Record<TrainingProgramStatusDto, "success" | "warning" | "error" | "neutral" | "info"> = {
  draft: "neutral", scheduled: "info", "in-progress": "warning", completed: "success", cancelled: "error", archived: "neutral",
};
/** Mirrors the server-authoritative TRAINING_PROGRAM_NEXT_STATUS in
 * lib/server/hr/training.ts — used here only to decide which actions to
 * show; the server independently re-validates every transition. */
const PROGRAM_NEXT_STATUS: Record<TrainingProgramStatusDto, TrainingProgramStatusDto[]> = {
  draft: ["scheduled", "cancelled", "archived"],
  scheduled: ["in-progress", "cancelled", "archived"],
  "in-progress": ["completed", "cancelled", "archived"],
  completed: ["archived"],
  cancelled: ["archived"],
  archived: [],
};

const participantStatusLabels: Record<TrainingParticipantStatusDto, string> = { assigned: "Assigned", "in-progress": "In progress", completed: "Completed", cancelled: "Cancelled" };
const participantStatusTone: Record<TrainingParticipantStatusDto, "success" | "warning" | "error" | "neutral" | "info"> = {
  assigned: "info", "in-progress": "warning", completed: "success", cancelled: "neutral",
};
const PARTICIPANT_NEXT_STATUS: Record<TrainingParticipantStatusDto, TrainingParticipantStatusDto[]> = {
  assigned: ["in-progress", "completed", "cancelled"],
  "in-progress": ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export default function TrainingPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 250);
  const [statusFilter, setStatusFilter] = useState<TrainingProgramStatusDto | "all">("all");
  const [page, setPage] = useState(1);

  const { data: programs, meta, loading, error, reload } = useTrainingPrograms({
    search: debouncedSearch || undefined,
    status: statusFilter === "all" ? undefined : statusFilter,
    page,
    pageSize: PAGE_SIZE,
  });
  const { data: programSummary } = useTrainingProgramsSummary();
  const { data: staff } = useStaffList({ status: "active", pageSize: 500 });
  const [createOpen, setCreateOpen] = useState(false);
  const [manageProgram, setManageProgram] = useState<TrainingProgramDto | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [assignStaffId, setAssignStaffId] = useState("");
  const [assignError, setAssignError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [trainerName, setTrainerName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const { data: participants, reload: reloadParticipants } = useTrainingParticipants(manageProgram?.id);

  if (!capabilitiesLoading && !hasServerPermission("hr.view") && !hasServerPermission("hr.manage")) {
    return <PermissionDenied action="view training" role={roleLabels[role]} backHref="/hr" />;
  }
  const canManage = hasServerPermission("hr.manage");
  const isFiltered = searchInput.trim().length > 0 || statusFilter !== "all";
  const totalPages = meta?.totalPages ?? 1;

  function resetForm() {
    setTitle(""); setDescription(""); setCategory(""); setTrainerName(""); setStartDate(""); setEndDate(""); setFormError(null);
  }

  async function submit() {
    setFormError(null);
    if (!title.trim() || !startDate) return setFormError("Title and start date are required.");
    const res = await createTrainingProgramRequest({
      title: title.trim(), description: description.trim() || undefined, category: category.trim() || undefined,
      trainerName: trainerName.trim() || undefined, startDate, endDate: endDate || undefined,
    });
    if (!res.success) return setFormError(res.error.message);
    resetForm();
    setCreateOpen(false);
    reload();
  }

  async function transitionProgram(program: TrainingProgramDto, status: TrainingProgramStatusDto) {
    setBusyId(program.id);
    await setTrainingProgramStatusRequest(program.id, status);
    setBusyId(null);
    reload();
  }

  async function assign() {
    if (!manageProgram || !assignStaffId) return;
    setAssignError(null);
    const res = await assignTrainingParticipantRequest(manageProgram.id, { staffId: assignStaffId });
    if (!res.success) return setAssignError(res.error.message);
    setAssignStaffId("");
    reloadParticipants();
    reload();
  }

  async function transitionParticipant(participantId: string, status: TrainingParticipantStatusDto) {
    setBusyId(participantId);
    await setTrainingParticipantStatusRequest(participantId, { status });
    setBusyId(null);
    reloadParticipants();
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Training &amp; development</h1>
          <p className="text-xs text-muted-foreground">Programs and participant assignments</p>
        </div>
        <div className="flex flex-wrap items-center gap-xs">
          <Button asChild size="sm" variant="outline"><Link href="/hr/training/courses"><ListChecks className="size-3.5" /> Courses</Link></Button>
          <Button asChild size="sm" variant="outline"><Link href="/hr/training/calendar"><CalendarClock className="size-3.5" /> Calendar</Link></Button>
          {canManage && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="size-3.5" /> New program
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Programs" value={programSummary ? String(programSummary.total) : "—"} icon={GraduationCap} tone="neutral" />
        <StatTile label="Scheduled" value={programSummary ? String(programSummary.scheduled) : "—"} icon={GraduationCap} tone="info" />
        <StatTile label="In progress" value={programSummary ? String(programSummary.inProgress) : "—"} icon={GraduationCap} tone="warning" />
        <StatTile label="Completed" value={programSummary ? String(programSummary.completed) : "—"} icon={GraduationCap} tone="success" />
      </div>

      {error && (
        <div className="rounded-lg border border-error/30 bg-error/5 p-md text-sm text-error" role="alert">
          Could not load training programs: {error}
          <Button variant="outline" size="sm" className="ml-sm" onClick={reload}>Retry</Button>
        </div>
      )}

      <div className="flex flex-col gap-sm sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={searchInput}
            onChange={(e) => { setSearchInput(e.target.value); setPage(1); }}
            placeholder="Search title, category, or trainer…"
            aria-label="Search training programs"
            className="w-full rounded-md border border-border bg-surface py-1.5 pl-8 pr-3 text-sm text-foreground outline-none focus:border-primary"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as TrainingProgramStatusDto | "all"); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-44" aria-label="Filter by status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {(Object.keys(programStatusLabels) as TrainingProgramStatusDto[]).map((s) => <SelectItem key={s} value={s}>{programStatusLabels[s]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm text-sm font-semibold text-foreground">Programs</h2>
        {loading && programs.length === 0 ? (
          <p className="py-md text-center text-sm text-muted-foreground">Loading programs…</p>
        ) : programs.length === 0 ? (
          <p className="py-md text-center text-sm text-muted-foreground">
            {isFiltered ? "No programs match your search or filters." : "No training programs found."}
          </p>
        ) : (
          <div className="flex flex-col gap-sm">
            {programs.map((p) => (
              <div key={p.id} className="flex flex-col gap-sm rounded-md border border-border p-sm sm:flex-row sm:items-center sm:justify-between">
                <button className="min-w-0 text-left" onClick={() => setManageProgram(p)}>
                  <p className="truncate text-sm font-medium text-foreground hover:underline">{p.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {p.category ? `${p.category} · ` : ""}{formatDate(p.startDate)}{p.endDate ? ` – ${formatDate(p.endDate)}` : ""}
                    {p.trainerName ? ` · ${p.trainerName}` : ""} · {p.participantCount} participant(s)
                  </p>
                </button>
                <div className="flex items-center gap-xs">
                  <Badge tone={programStatusTone[p.status]}>{programStatusLabels[p.status]}</Badge>
                  <Button size="sm" variant="outline" onClick={() => setManageProgram(p)}>Manage</Button>
                  {canManage && PROGRAM_NEXT_STATUS[p.status].length > 0 && (
                    <Select value="" onValueChange={(v) => transitionProgram(p, v as TrainingProgramStatusDto)}>
                      <SelectTrigger className="h-8 w-auto text-xs" disabled={busyId === p.id} aria-label="Change status">
                        <SelectValue placeholder="Change status" />
                      </SelectTrigger>
                      <SelectContent>
                        {PROGRAM_NEXT_STATUS[p.status].map((s) => <SelectItem key={s} value={s}>{programStatusLabels[s]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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
        <DetailDrawer open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) resetForm(); }} title="New training program" description="Create a real training program">
          <div className="flex flex-col gap-sm">
            <div>
              <Label htmlFor="tp-title">Title</Label>
              <Input id="tp-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Child protection refresher" />
            </div>
            <div>
              <Label htmlFor="tp-desc">Description (optional)</Label>
              <Textarea id="tp-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-sm">
              <div>
                <Label htmlFor="tp-category">Category (optional)</Label>
                <Input id="tp-category" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Compliance" />
              </div>
              <div>
                <Label htmlFor="tp-trainer">Trainer / provider (optional)</Label>
                <Input id="tp-trainer" value={trainerName} onChange={(e) => setTrainerName(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-sm">
              <div>
                <Label htmlFor="tp-start">Start date</Label>
                <Input id="tp-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="tp-end">End date (optional)</Label>
                <Input id="tp-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
            {formError && <p className="text-sm text-error">{formError}</p>}
            <Button onClick={submit}>Create program</Button>
          </div>
        </DetailDrawer>
      )}

      <DetailDrawer
        open={Boolean(manageProgram)}
        onOpenChange={(o) => { if (!o) { setManageProgram(null); setAssignStaffId(""); setAssignError(null); } }}
        title={manageProgram?.title ?? "Program"}
        description="Participants assigned to this training program"
      >
        {manageProgram && (
          <div className="flex flex-col gap-md">
            {canManage && (
              <div className="flex items-end gap-xs">
                <div className="flex-1">
                  <Label>Assign employee</Label>
                  <Select value={assignStaffId} onValueChange={setAssignStaffId}>
                    <SelectTrigger aria-label="Assign employee"><SelectValue placeholder="Select employee" /></SelectTrigger>
                    <SelectContent>{staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Button size="sm" disabled={!assignStaffId} onClick={assign}><UserPlus className="size-3.5" /> Assign</Button>
              </div>
            )}
            {assignError && <p className="text-sm text-error">{assignError}</p>}

            <div className="flex flex-col gap-xs">
              {!participants ? (
                <p className="text-sm text-muted-foreground">Loading participants…</p>
              ) : participants.length === 0 ? (
                <p className="text-sm text-muted-foreground">No participants assigned yet.</p>
              ) : (
                participants.map((pt) => (
                  <div key={pt.id} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm text-sm">
                    <div className="min-w-0">
                      <p className="truncate text-foreground">{pt.staffName} <span className="text-xs text-muted-foreground">· {pt.employeeCode}</span></p>
                      <p className="truncate text-xs text-muted-foreground">
                        {pt.completedAt ? `Completed ${formatDate(pt.completedAt)}` : "Not completed"}
                        {pt.certificateIssued ? " · Certificate issued" : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-xs">
                      <Badge tone={participantStatusTone[pt.status]}>{participantStatusLabels[pt.status]}</Badge>
                      {canManage && PARTICIPANT_NEXT_STATUS[pt.status].length > 0 && (
                        <Select value="" onValueChange={(v) => transitionParticipant(pt.id, v as TrainingParticipantStatusDto)}>
                          <SelectTrigger className="h-8 w-auto text-xs" disabled={busyId === pt.id} aria-label="Change status">
                            <SelectValue placeholder="Change status" />
                          </SelectTrigger>
                          <SelectContent>
                            {PARTICIPANT_NEXT_STATUS[pt.status].map((s) => <SelectItem key={s} value={s}>{participantStatusLabels[s]}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      )}
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
