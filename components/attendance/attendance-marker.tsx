"use client";

import { useState } from "react";
import { CheckCheck, Grid3x3, LayoutList, Rows3, Send, WifiOff } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SeatingView } from "./seating-view";
import { useManagedClasses, useSubjects } from "@/lib/hooks/use-academics";
import { findSession } from "@/lib/services/attendance-service";
import { queueAttendanceSave, useOfflineQueueStatus } from "@/lib/services/offline-queue";
import { useSisStore } from "@/lib/hooks/use-store";
import type { AttendanceMode, AttendanceStatus } from "@/lib/types/attendance";
import { attendanceStatusLabels, attendanceStatusTone } from "@/lib/types/attendance";
import type { Student } from "@/lib/types/students";
import { cn, initialsOf, timeAgo } from "@/lib/utils";

type ViewMode = "list" | "grid" | "seating";
const statusCycle: AttendanceStatus[] = ["present", "absent", "late", "excused", "half-day", "medical-leave", "official-duty"];

export function AttendanceMarker({ mode }: { mode: AttendanceMode }) {
  const db = useSisStore();
  const classes = useManagedClasses();
  const subjects = useSubjects();
  const offline = useOfflineQueueStatus();

  const [classId, setClassId] = useState(classes[6]?.id ?? classes[0]?.id ?? "");
  const [sectionId, setSectionId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [period, setPeriod] = useState(1);
  const [subjectId, setSubjectId] = useState("");
  const [view, setView] = useState<ViewMode>("list");
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<"synced" | "queued" | null>(null);

  const schoolClass = classes.find((c) => c.id === classId);
  const sections = schoolClass?.sections ?? [];
  const activeSectionId = sectionId || sections[0]?.id || "";
  const students = db.students.filter((s) => s.sectionId === activeSectionId && s.status === "active");

  const existingSession = findSession(activeSectionId, date, mode, mode === "period" ? period : undefined);

  function statusFor(studentId: string): AttendanceStatus {
    if (statuses[studentId]) return statuses[studentId];
    const existing = existingSession?.records.find((r) => r.studentId === studentId);
    return existing?.status ?? "not-marked";
  }

  function setStatus(studentId: string, status: AttendanceStatus) {
    setStatuses((prev) => ({ ...prev, [studentId]: status }));
  }

  function cycleStatus(studentId: string) {
    const current = statusFor(studentId);
    const idx = statusCycle.indexOf(current);
    setStatus(studentId, statusCycle[(idx + 1) % statusCycle.length]);
  }

  function markAllPresent() {
    const next: Record<string, AttendanceStatus> = {};
    for (const student of students) next[student.id] = "present";
    setStatuses(next);
  }

  const presentCount = students.filter((s) => statusFor(s.id) === "present" || statusFor(s.id) === "late").length;
  const absentCount = students.filter((s) => statusFor(s.id) === "absent").length;
  const unmarkedCount = students.filter((s) => statusFor(s.id) === "not-marked").length;

  function handleSave() {
    const records = students.map((s) => ({ studentId: s.id, status: statusFor(s.id) === "not-marked" ? ("present" as AttendanceStatus) : statusFor(s.id), note: notes[s.id] }));
    const result = queueAttendanceSave({
      classId,
      sectionId: activeSectionId,
      date: new Date(date).toISOString(),
      mode,
      period: mode === "period" ? period : undefined,
      subjectId: mode === "period" ? subjectId : undefined,
      records,
      markedBy: "Class Teacher",
    });
    setSaved(result.synced ? "synced" : "queued");
    setStatuses({});
  }

  return (
    <div className="flex flex-col gap-md pb-24 sm:pb-0">
      {!offline.isOnline && (
        <div className="flex items-center gap-sm rounded-lg border border-warning/30 bg-warning/10 px-sm py-sm text-xs text-warning">
          <WifiOff className="size-4 shrink-0" />
          <span>You&apos;re offline — attendance will be saved locally and synced automatically when you&apos;re back online.</span>
        </div>
      )}
      {offline.pendingCount > 0 && (
        <div className="flex items-center justify-between gap-sm rounded-lg border border-info/30 bg-info/10 px-sm py-sm text-xs text-info">
          <span>{offline.pendingCount} attendance session(s) waiting to sync{offline.lastSyncedAt ? ` · last synced ${timeAgo(offline.lastSyncedAt)}` : ""}.</span>
          <Button size="sm" variant="outline" onClick={offline.retry}>
            Retry sync
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-sm rounded-lg border border-border bg-surface p-sm">
        <Select value={classId} onValueChange={(v) => { setClassId(v); setSectionId(""); }}>
          <SelectTrigger className="w-36" aria-label="Class">
            <SelectValue placeholder="Class" />
          </SelectTrigger>
          <SelectContent>
            {classes.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={activeSectionId} onValueChange={setSectionId}>
          <SelectTrigger className="w-32" aria-label="Section">
            <SelectValue placeholder="Section" />
          </SelectTrigger>
          <SelectContent>
            {sections.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                Section {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-40" />
        {mode === "period" && (
          <>
            <Select value={String(period)} onValueChange={(v) => setPeriod(Number(v))}>
              <SelectTrigger className="w-28" aria-label="Period">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((p) => (
                  <SelectItem key={p} value={String(p)}>
                    Period {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={subjectId} onValueChange={setSubjectId}>
              <SelectTrigger className="w-36" aria-label="Subject">
                <SelectValue placeholder="Subject" />
              </SelectTrigger>
              <SelectContent>
                {subjects.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}

        <div className="ml-auto flex items-center gap-1 rounded-md bg-surface-secondary p-1">
          {(["list", "grid", "seating"] as ViewMode[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={cn("flex size-11 items-center justify-center rounded-md transition-colors sm:size-8", view === v ? "bg-surface shadow-card text-foreground" : "text-muted-foreground")}
              aria-label={`${v} view`}
              aria-pressed={view === v}
            >
              {v === "list" ? <LayoutList className="size-4" /> : v === "grid" ? <Grid3x3 className="size-4" /> : <Rows3 className="size-4" />}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-sm">
        <Badge tone="success">{presentCount} present</Badge>
        <Badge tone="error">{absentCount} absent</Badge>
        <Badge tone="neutral">{unmarkedCount} unmarked</Badge>
        <Button size="sm" variant="outline" onClick={markAllPresent}>
          <CheckCheck className="size-3.5" />
          Mark all present
        </Button>
      </div>

      {students.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Select a class and section to begin.</p>
      ) : view === "seating" ? (
        <SeatingView students={students} statusFor={statusFor} onToggle={cycleStatus} />
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 gap-sm sm:grid-cols-3 lg:grid-cols-4">
          {students.map((s) => (
            <StudentStatusCard key={s.id} student={s} status={statusFor(s.id)} onChange={(status) => setStatus(s.id, status)} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {students.map((s) => (
            <StudentStatusRow
              key={s.id}
              student={s}
              status={statusFor(s.id)}
              note={notes[s.id] ?? ""}
              onChange={(status) => setStatus(s.id, status)}
              onNoteChange={(note) => setNotes((prev) => ({ ...prev, [s.id]: note }))}
            />
          ))}
        </div>
      )}

      {students.length > 0 && (
        <div className="sticky bottom-[calc(var(--mobile-bottom-nav-height)_+_env(safe-area-inset-bottom))] z-10 flex flex-wrap items-center gap-sm rounded-lg border border-border bg-surface p-sm shadow-floating sm:static sm:shadow-none">
          <Button onClick={handleSave}>
            <Send className="size-3.5" />
            Save &amp; submit attendance
          </Button>
          {saved && (
            <span className="text-xs text-muted-foreground">
              {saved === "synced" ? "Saved and synced." : "Saved locally — will sync when you're back online."}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function StudentStatusRow({
  student,
  status,
  note,
  onChange,
  onNoteChange,
}: {
  student: Student;
  status: AttendanceStatus;
  note: string;
  onChange: (status: AttendanceStatus) => void;
  onNoteChange: (note: string) => void;
}) {
  const [noteOpen, setNoteOpen] = useState(false);
  return (
    <div className="flex flex-col gap-xs rounded-md border border-border bg-surface p-sm">
      <div className="flex flex-wrap items-center gap-sm">
        <Avatar className="size-8">
          <AvatarFallback>{initialsOf(student.profile.firstName, student.profile.lastName)}</AvatarFallback>
        </Avatar>
        <span className="min-w-0 flex-1 truncate text-sm text-foreground">
          {student.profile.firstName} {student.profile.lastName}
        </span>
        <button
          type="button"
          onClick={() => setNoteOpen((v) => !v)}
          className={cn("flex min-h-11 items-center gap-1 rounded-md px-sm text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring sm:min-h-8", note ? "text-primary" : "text-muted-foreground hover:bg-surface-secondary")}
        >
          {note ? "Note ✓" : "+ Note"}
        </button>
        <StatusButtons status={status} onChange={onChange} />
      </div>
      {noteOpen && <Input value={note} onChange={(e) => onNoteChange(e.target.value)} placeholder="e.g. Late arrival — bus delay" className="h-9" autoFocus />}
    </div>
  );
}

function StudentStatusCard({ student, status, onChange }: { student: Student; status: AttendanceStatus; onChange: (status: AttendanceStatus) => void }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg border border-border bg-surface p-sm text-center">
      <Avatar className="size-10">
        <AvatarFallback>{initialsOf(student.profile.firstName, student.profile.lastName)}</AvatarFallback>
      </Avatar>
      <span className="line-clamp-1 text-xs font-medium text-foreground">{student.profile.firstName}</span>
      <StatusButtons status={status} onChange={onChange} compact />
    </div>
  );
}

const quickStatusColor: Record<"present" | "absent" | "late" | "excused", string> = {
  present: "bg-success",
  absent: "bg-error",
  late: "bg-warning",
  excused: "bg-info",
};

function StatusButtons({ status, onChange, compact = false }: { status: AttendanceStatus; onChange: (status: AttendanceStatus) => void; compact?: boolean }) {
  const quick: ("present" | "absent" | "late" | "excused")[] = ["present", "absent", "late", "excused"];
  return (
    <div className={cn("flex flex-wrap gap-1", compact ? "justify-center" : "ml-auto")}>
      {quick.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange(s)}
          className={cn(
            "flex min-h-11 min-w-11 items-center justify-center rounded-md px-1.5 text-[11px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97] sm:min-h-8 sm:min-w-8",
            status === s ? `${quickStatusColor[s]} text-white` : "bg-surface-secondary text-muted-foreground hover:bg-border",
          )}
          aria-pressed={status === s}
        >
          {s === "present" ? "P" : s === "absent" ? "A" : s === "late" ? "L" : "E"}
        </button>
      ))}
      <Select value={status} onValueChange={(v) => onChange(v as AttendanceStatus)}>
        <SelectTrigger className="h-11 w-11 border-none bg-transparent p-0 [&>svg]:hidden sm:h-8 sm:w-8" aria-label="More status options">
          <span className="sr-only">More</span>
          <span aria-hidden className="flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-border sm:size-8">
            ⋯
          </span>
        </SelectTrigger>
        <SelectContent>
          {Object.entries(attendanceStatusLabels)
            .filter(([key]) => key !== "not-marked")
            .map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function statusToneOf(status: AttendanceStatus) {
  return attendanceStatusTone[status];
}
