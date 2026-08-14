"use client";

// Real attendance marking (Phase 5). Same visual design as before (toolbar
// selectors, status badges, list/grid/seating views, sticky save bar) — now
// backed by /api/attendance/* keyed on real Section + Enrollment. No mock store,
// no localStorage. Period/subject attendance needs the Timetable module (future),
// so non-daily modes show an honest unavailable state rather than mock data.
import { useMemo, useState } from "react";
import { CheckCheck, Grid3x3, LayoutList, Rows3, Send } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SeatingView } from "./seating-view";
import {
  createAttendanceSessionRequest,
  createPeriodSessionRequest,
  saveAttendanceRecordsRequest,
  submitAttendanceSessionRequest,
  useAttendanceSections,
  useAttendanceSession,
  usePeriodLessons,
} from "@/lib/hooks/api/use-attendance";
import type { AttendanceMode, AttendanceStatus } from "@/lib/types/attendance";
import { attendanceStatusLabels, attendanceStatusTone } from "@/lib/types/attendance";
import type { AttendanceRosterEntryDto, AttendanceSessionViewDto } from "@/lib/api/contracts";
import { cn } from "@/lib/utils";

const statusCycle: AttendanceStatus[] = ["present", "absent", "late", "excused", "half-day", "medical-leave", "official-duty"];
type ViewMode = "list" | "grid" | "seating";

export function AttendanceMarker({ mode }: { mode: AttendanceMode }) {
  const { data: sections, loading: sectionsLoading, error: sectionsError } = useAttendanceSections();
  const classes = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of sections) m.set(s.classId, s.className);
    return [...m.entries()].map(([id, name]) => ({ id, name }));
  }, [sections]);

  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [view, setView] = useState<ViewMode>("list");
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeClassId = classId || classes[0]?.id || "";
  const sectionsForClass = useMemo(() => sections.filter((s) => s.classId === activeClassId), [sections, activeClassId]);
  const activeSectionId = sectionId || sectionsForClass[0]?.id || "";

  const daily = mode === "daily";
  const isPeriod = mode === "period";

  // Daily data path (Phase 5).
  const { data: dailyView, loading: dailyLoading, error: dailyError, reload: reloadDaily } = useAttendanceSession(daily ? activeSectionId : undefined, daily ? date : undefined);

  // Period data path (Phase 7C): real scheduled lessons → get-or-create session.
  const { data: lessons, loading: lessonsLoading, error: lessonsError } = usePeriodLessons(isPeriod ? activeSectionId : undefined, isPeriod ? date : undefined);
  const [lessonId, setLessonId] = useState("");
  const [periodView, setPeriodView] = useState<AttendanceSessionViewDto | null>(null);
  const [periodLoading, setPeriodLoading] = useState(false);

  async function selectLesson(entryId: string) {
    setLessonId(entryId); setStatuses({}); setPeriodView(null); setError(null);
    if (!entryId) return;
    setPeriodLoading(true);
    const res = await createPeriodSessionRequest(entryId, date);
    setPeriodLoading(false);
    if (!res.success) { setError(res.error.message); return; }
    setPeriodView(res.data);
  }
  async function reloadPeriod() {
    if (!lessonId) return;
    const res = await createPeriodSessionRequest(lessonId, date);
    if (res.success) setPeriodView(res.data);
  }

  const sessionView = daily ? dailyView : periodView;
  const rosterLoading = daily ? dailyLoading : periodLoading || lessonsLoading;
  const rosterError = daily ? dailyError : lessonsError;
  const reload = daily ? reloadDaily : reloadPeriod;
  const roster: AttendanceRosterEntryDto[] = useMemo(() => sessionView?.roster ?? [], [sessionView]);

  function statusFor(studentId: string): AttendanceStatus {
    if (statuses[studentId]) return statuses[studentId];
    const entry = roster.find((r) => r.studentId === studentId);
    return (entry?.status as AttendanceStatus) ?? "not-marked";
  }
  const setStatus = (studentId: string, status: AttendanceStatus) => setStatuses((p) => ({ ...p, [studentId]: status }));
  function cycleStatus(studentId: string) {
    const idx = statusCycle.indexOf(statusFor(studentId));
    setStatus(studentId, statusCycle[(idx + 1) % statusCycle.length]);
  }
  function markAllPresent() {
    const next: Record<string, AttendanceStatus> = {};
    for (const r of roster) next[r.studentId] = "present";
    setStatuses(next);
  }

  const presentCount = roster.filter((r) => statusFor(r.studentId) === "present" || statusFor(r.studentId) === "late").length;
  const absentCount = roster.filter((r) => statusFor(r.studentId) === "absent").length;
  const unmarkedCount = roster.filter((r) => statusFor(r.studentId) === "not-marked").length;

  async function handleSave() {
    if (!activeSectionId || roster.length === 0) return;
    setSaving(true); setError(null); setSaved(null);
    // Unmarked defaults to present (preserves prior UX).
    const records = roster.map((r) => {
      const s = statusFor(r.studentId);
      return { studentId: r.studentId, status: s === "not-marked" ? "present" : s, remarks: notes[r.studentId] || null };
    });
    // Resolve the session id: daily → get-or-create by section+date; period → the
    // session already opened for the selected real lesson.
    let sessionId: string;
    if (daily) {
      const create = await createAttendanceSessionRequest(activeSectionId, date);
      if (!create.success || !create.data.session) { setSaving(false); setError(create.success ? "Could not create session" : create.error.message); return; }
      sessionId = create.data.session.id;
    } else {
      if (!periodView?.session) { setSaving(false); setError("Select a scheduled lesson first."); return; }
      sessionId = periodView.session.id;
    }
    const save = await saveAttendanceRecordsRequest(sessionId, records);
    if (!save.success) { setSaving(false); setError(save.error.message); return; }
    const submit = await submitAttendanceSessionRequest(sessionId);
    setSaving(false);
    if (!submit.success) { setError(submit.error.message); return; }
    setStatuses({}); setSaved("Saved and submitted."); reload();
  }

  if (!daily && !isPeriod) {
    return <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">This attendance mode isn&apos;t available yet.</p>;
  }

  return (
    <div className="flex flex-col gap-md pb-24 sm:pb-0">
      <div className="flex flex-wrap items-center gap-sm rounded-lg border border-border bg-surface p-sm">
        <Select value={activeClassId} onValueChange={(v) => { setClassId(v); setSectionId(""); setStatuses({}); setLessonId(""); setPeriodView(null); }}>
          <SelectTrigger className="w-36" aria-label="Class"><SelectValue placeholder="Class" /></SelectTrigger>
          <SelectContent>{classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={activeSectionId} onValueChange={(v) => { setSectionId(v); setStatuses({}); setLessonId(""); setPeriodView(null); }}>
          <SelectTrigger className="w-32" aria-label="Section"><SelectValue placeholder="Section" /></SelectTrigger>
          <SelectContent>{sectionsForClass.map((s) => <SelectItem key={s.id} value={s.id}>Section {s.name}</SelectItem>)}</SelectContent>
        </Select>
        <Input type="date" value={date} onChange={(e) => { setDate(e.target.value); setStatuses({}); setLessonId(""); setPeriodView(null); }} className="w-40" />
        {isPeriod && (
          <Select value={lessonId} onValueChange={(v) => void selectLesson(v)}>
            <SelectTrigger className="w-56" aria-label="Lesson"><SelectValue placeholder={(lessons ?? []).length ? "Select lesson" : "No lessons scheduled"} /></SelectTrigger>
            <SelectContent>{(lessons ?? []).map((l) => <SelectItem key={l.timetableEntryId} value={l.timetableEntryId}>{l.period.name} · {l.subject.name} · {l.teacher.name}</SelectItem>)}</SelectContent>
          </Select>
        )}

        <div className="ml-auto flex items-center gap-1 rounded-md bg-surface-secondary p-1">
          {(["list", "grid", "seating"] as ViewMode[]).map((v) => (
            <button key={v} type="button" onClick={() => setView(v)} className={cn("flex size-11 items-center justify-center rounded-md transition-colors sm:size-8", view === v ? "bg-surface shadow-card text-foreground" : "text-muted-foreground")} aria-label={`${v} view`} aria-pressed={view === v}>
              {v === "list" ? <LayoutList className="size-4" /> : v === "grid" ? <Grid3x3 className="size-4" /> : <Rows3 className="size-4" />}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-sm">
        <Badge tone="success">{presentCount} present</Badge>
        <Badge tone="error">{absentCount} absent</Badge>
        <Badge tone="neutral">{unmarkedCount} unmarked</Badge>
        <Button size="sm" variant="outline" onClick={markAllPresent} disabled={roster.length === 0}>
          <CheckCheck className="size-3.5" /> Mark all present
        </Button>
        {sessionView?.session?.status === "submitted" && <Badge tone="info">Submitted</Badge>}
        {sessionView?.session?.status === "locked" && <Badge tone="warning">Locked</Badge>}
      </div>

      {error && <p className="rounded-md border border-error/30 bg-error/10 p-sm text-xs text-error">{error}</p>}
      {(sectionsError || rosterError) && <p className="rounded-md border border-error/30 bg-error/10 p-sm text-xs text-error">{sectionsError ?? rosterError}</p>}

      {sectionsLoading || rosterLoading ? (
        <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Loading…</p>
      ) : !activeSectionId ? (
        <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Select a class and section to begin.</p>
      ) : isPeriod && (lessons ?? []).length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">No scheduled lessons for this section on this date.</p>
      ) : isPeriod && !periodView ? (
        <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Select a scheduled lesson to mark attendance.</p>
      ) : roster.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">No enrolled students in this section.</p>
      ) : view === "seating" ? (
        <SeatingView students={roster.map((r) => ({ id: r.studentId, name: r.name }))} statusFor={statusFor} onToggle={cycleStatus} />
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 gap-sm sm:grid-cols-3 lg:grid-cols-4">
          {roster.map((r) => <StudentStatusCard key={r.studentId} name={r.name} status={statusFor(r.studentId)} onChange={(s) => setStatus(r.studentId, s)} />)}
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {roster.map((r) => (
            <StudentStatusRow key={r.studentId} name={r.name} status={statusFor(r.studentId)} note={notes[r.studentId] ?? ""} onChange={(s) => setStatus(r.studentId, s)} onNoteChange={(note) => setNotes((p) => ({ ...p, [r.studentId]: note }))} />
          ))}
        </div>
      )}

      {roster.length > 0 && (
        <div className="sticky bottom-[calc(var(--mobile-bottom-nav-height)_+_env(safe-area-inset-bottom))] z-10 flex flex-wrap items-center gap-sm rounded-lg border border-border bg-surface p-sm shadow-floating sm:static sm:shadow-none">
          <Button onClick={() => void handleSave()} disabled={saving || sessionView?.session?.status === "locked"}>
            <Send className="size-3.5" /> Save &amp; submit attendance
          </Button>
          {saved && <span className="text-xs text-muted-foreground">{saved}</span>}
        </div>
      )}
    </div>
  );
}

function StudentStatusRow({ name, status, note, onChange, onNoteChange }: { name: string; status: AttendanceStatus; note: string; onChange: (s: AttendanceStatus) => void; onNoteChange: (n: string) => void }) {
  const [noteOpen, setNoteOpen] = useState(false);
  return (
    <div className="flex flex-col gap-xs rounded-md border border-border bg-surface p-sm">
      <div className="flex flex-wrap items-center gap-sm">
        <Avatar className="size-8"><AvatarFallback>{initials(name)}</AvatarFallback></Avatar>
        <span className="min-w-0 flex-1 truncate text-sm text-foreground">{name}</span>
        <button type="button" onClick={() => setNoteOpen((v) => !v)} className={cn("flex min-h-11 items-center gap-1 rounded-md px-sm text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring sm:min-h-8", note ? "text-primary" : "text-muted-foreground hover:bg-surface-secondary")}>
          {note ? "Note ✓" : "+ Note"}
        </button>
        <StatusButtons status={status} onChange={onChange} />
      </div>
      {noteOpen && <Input value={note} onChange={(e) => onNoteChange(e.target.value)} placeholder="e.g. Late arrival — bus delay" className="h-9" autoFocus />}
    </div>
  );
}

function StudentStatusCard({ name, status, onChange }: { name: string; status: AttendanceStatus; onChange: (s: AttendanceStatus) => void }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg border border-border bg-surface p-sm text-center">
      <Avatar className="size-10"><AvatarFallback>{initials(name)}</AvatarFallback></Avatar>
      <span className="line-clamp-1 text-xs font-medium text-foreground">{name.split(" ")[0]}</span>
      <StatusButtons status={status} onChange={onChange} compact />
    </div>
  );
}

const quickStatusColor: Record<"present" | "absent" | "late" | "excused", string> = { present: "bg-success", absent: "bg-error", late: "bg-warning", excused: "bg-info" };

function StatusButtons({ status, onChange, compact = false }: { status: AttendanceStatus; onChange: (s: AttendanceStatus) => void; compact?: boolean }) {
  const quick: ("present" | "absent" | "late" | "excused")[] = ["present", "absent", "late", "excused"];
  return (
    <div className={cn("flex flex-wrap gap-1", compact ? "justify-center" : "ml-auto")}>
      {quick.map((s) => (
        <button key={s} type="button" onClick={() => onChange(s)} className={cn("flex min-h-11 min-w-11 items-center justify-center rounded-md px-1.5 text-[11px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97] sm:min-h-8 sm:min-w-8", status === s ? `${quickStatusColor[s]} text-white` : "bg-surface-secondary text-muted-foreground hover:bg-border")} aria-pressed={status === s}>
          {s === "present" ? "P" : s === "absent" ? "A" : s === "late" ? "L" : "E"}
        </button>
      ))}
      <Select value={status === "not-marked" ? undefined : status} onValueChange={(v) => onChange(v as AttendanceStatus)}>
        <SelectTrigger className="h-11 w-11 border-none bg-transparent p-0 [&>svg]:hidden sm:h-8 sm:w-8" aria-label="More status options">
          <span className="sr-only">More</span>
          <span aria-hidden className="flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-border sm:size-8">⋯</span>
        </SelectTrigger>
        <SelectContent>
          {Object.entries(attendanceStatusLabels).filter(([key]) => key !== "not-marked").map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function initials(name: string): string {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
}

export function statusToneOf(status: AttendanceStatus) {
  return attendanceStatusTone[status];
}
