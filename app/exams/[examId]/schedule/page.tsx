"use client";

import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, CheckCircle2, DoorOpen, Lock, Sparkles, Unlock, UploadCloud, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { FieldHint, Label } from "@/components/ui/label";
import { Input, Textarea } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useManagedClasses, useTeachers } from "@/lib/hooks/use-academics";
import { useExam, useExamSubjects } from "@/lib/hooks/use-exams";
import { useSisStore } from "@/lib/hooks/use-store";
import { roomById, rooms, subjectById, teacherById } from "@/lib/data/seed/academics";
import { detectExamConflicts, summarizeExamConflicts } from "@/lib/selectors/exam-conflicts";
import { applyExamSchedule, copySchedulePattern, proposeExamSchedule, type ScheduleProposalEntry } from "@/lib/services/exam-schedule-service";
import { toggleExamSubjectLock, updateExamSubject } from "@/lib/services/exam-subject-service";
import { setExamStatus } from "@/lib/services/exam-service";
import { examConflictLabels, type ExamConflict, type ExamSubject } from "@/lib/types/exams";
import { formatDate } from "@/lib/utils";

type ViewType = "class" | "room" | "invigilator" | "calendar";

function sortByDateTime(a: ExamSubject, b: ExamSubject) {
  if (!a.date || !b.date) return a.date ? -1 : b.date ? 1 : 0;
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  return (a.startTime ?? "").localeCompare(b.startTime ?? "");
}

export default function ExamSchedulePage() {
  const params = useParams<{ examId: string }>();
  const db = useSisStore();
  const exam = useExam(params.examId);
  const examSubjects = useExamSubjects(params.examId);
  const classes = useManagedClasses();
  const teachers = useTeachers();
  const { can } = usePermissions();
  const canManage = can("exams.manageSchedule");

  const [view, setView] = useState<ViewType>("class");
  const [editSubject, setEditSubject] = useState<ExamSubject | null>(null);
  const [draft, setDraft] = useState<ExamSubject | null>(null);
  const [selectedConflict, setSelectedConflict] = useState<ExamConflict | null>(null);
  const [proposal, setProposal] = useState<ScheduleProposalEntry[] | null>(null);
  const [confirmPublish, setConfirmPublish] = useState(false);

  const allConflicts = useMemo(() => detectExamConflicts(db), [db]);
  const examConflicts = useMemo(() => {
    const subjectIds = new Set(examSubjects.map((s) => s.id));
    return allConflicts.filter((c) => c.examSubjectIds.some((id) => subjectIds.has(id)));
  }, [allConflicts, examSubjects]);
  const summary = summarizeExamConflicts(examConflicts);
  const conflictBySubjectId = new Map<string, ExamConflict>();
  for (const c of examConflicts) for (const id of c.examSubjectIds) if (!conflictBySubjectId.has(id)) conflictBySubjectId.set(id, c);

  const sectionsGrouped = useMemo(() => {
    const map = new Map<string, ExamSubject[]>();
    for (const s of examSubjects) map.set(s.sectionId, [...(map.get(s.sectionId) ?? []), s].sort(sortByDateTime));
    return Array.from(map.entries()).map(([sectionId, subjects]) => {
      const schoolClass = classes.find((c) => c.sections.some((sec) => sec.id === sectionId));
      const section = schoolClass?.sections.find((s) => s.id === sectionId);
      return { sectionId, label: `${schoolClass?.name ?? ""} — Section ${section?.name ?? ""}`, subjects };
    });
  }, [examSubjects, classes]);

  const roomsGrouped = useMemo(() => {
    const scheduled = examSubjects.filter((s) => s.roomId && s.date).sort(sortByDateTime);
    const map = new Map<string, ExamSubject[]>();
    for (const s of scheduled) map.set(s.roomId!, [...(map.get(s.roomId!) ?? []), s]);
    return Array.from(map.entries());
  }, [examSubjects]);

  const invigilatorsGrouped = useMemo(() => {
    const scheduled = examSubjects.filter((s) => s.invigilatorId && s.date).sort(sortByDateTime);
    const map = new Map<string, ExamSubject[]>();
    for (const s of scheduled) map.set(s.invigilatorId!, [...(map.get(s.invigilatorId!) ?? []), s]);
    return Array.from(map.entries());
  }, [examSubjects]);

  const calendarGrouped = useMemo(() => {
    const scheduled = examSubjects.filter((s) => s.date).sort(sortByDateTime);
    const map = new Map<string, ExamSubject[]>();
    for (const s of scheduled) map.set(s.date!, [...(map.get(s.date!) ?? []), s]);
    return Array.from(map.entries());
  }, [examSubjects]);

  if (!exam) return null;

  const unscheduledCount = examSubjects.filter((s) => !s.date).length;
  const allScheduled = examSubjects.length > 0 && unscheduledCount === 0;

  function openEdit(subject: ExamSubject) {
    setEditSubject(subject);
    setDraft({ ...subject });
  }

  function handleSave() {
    if (!draft) return;
    updateExamSubject(draft.id, draft);
    setEditSubject(null);
  }

  function subjectLabel(s: ExamSubject) {
    return subjectById(s.subjectId)?.name ?? s.subjectId;
  }

  function sectionLabel(sectionId: string) {
    const schoolClass = classes.find((c) => c.sections.some((sec) => sec.id === sectionId));
    const section = schoolClass?.sections.find((s) => s.id === sectionId);
    return `${schoolClass?.name ?? ""}-${section?.name ?? ""}`;
  }

  return (
    <div className="flex flex-col gap-md pb-24 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Schedule — {exam.name}</h1>
          <p className="text-xs text-muted-foreground">
            {examSubjects.length - unscheduledCount}/{examSubjects.length} subjects scheduled
          </p>
        </div>
        {canManage && (
          <div className="flex flex-wrap items-center gap-xs">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setProposal(proposeExamSchedule(exam.id, true))}
              disabled={unscheduledCount === 0}
            >
              <Sparkles className="size-3.5" />
              Auto-schedule remaining ({unscheduledCount})
            </Button>
            <Button size="sm" onClick={() => setConfirmPublish(true)} disabled={!allScheduled || summary.errors > 0}>
              <UploadCloud className="size-3.5" />
              Publish schedule
            </Button>
          </div>
        )}
      </div>

      {summary.total === 0 ? (
        <div className="flex items-center gap-sm rounded-lg border border-success/25 bg-success/8 px-sm py-sm text-sm text-success">
          <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
          No schedule conflicts detected.
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-surface p-sm">
          <div className="flex items-center gap-sm">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-pill bg-error/12 text-error">
              <AlertTriangle className="size-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {summary.total} conflict{summary.total === 1 ? "" : "s"} detected
              </p>
              <p className="text-xs text-muted-foreground">
                {summary.errors} to fix · {summary.warnings} worth reviewing
              </p>
            </div>
          </div>
          <ul className="mt-sm flex flex-col gap-1">
            {examConflicts.slice(0, 6).map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setSelectedConflict(c)}
                  className="flex w-full items-center gap-sm rounded-md border border-border px-sm py-1.5 text-left text-xs outline-none transition-colors hover:bg-surface-secondary/60 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Badge tone={c.severity === "error" ? "error" : "warning"}>{examConflictLabels[c.type]}</Badge>
                  <span className="min-w-0 flex-1 truncate text-foreground">{c.description}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="scrollbar-none flex items-center gap-1 overflow-x-auto rounded-md bg-surface-secondary p-1">
        {(["class", "room", "invigilator", "calendar"] as ViewType[]).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={`min-h-9 shrink-0 rounded-md px-sm text-xs font-medium capitalize transition-colors ${view === v ? "bg-surface shadow-card text-foreground" : "text-muted-foreground"}`}
          >
            {v === "class" ? "Class schedule" : v === "room" ? "Room schedule" : v === "invigilator" ? "Invigilator schedule" : "Calendar"}
          </button>
        ))}
      </div>

      {view === "class" &&
        sectionsGrouped.map(({ sectionId, label, subjects }) => (
          <div key={sectionId} className="rounded-lg border border-border bg-surface p-md">
            <div className="mb-sm flex flex-wrap items-center justify-between gap-xs">
              <h2 className="text-sm font-semibold text-foreground">{label}</h2>
              {canManage && sectionsGrouped.length > 1 && (
                <Select onValueChange={(fromSectionId) => copySchedulePattern(exam.id, fromSectionId, sectionId)}>
                  <SelectTrigger className="w-48" aria-label="Copy schedule from another section">
                    <SelectValue placeholder="Copy schedule from…" />
                  </SelectTrigger>
                  <SelectContent>
                    {sectionsGrouped.filter((s) => s.sectionId !== sectionId).map((s) => (
                      <SelectItem key={s.sectionId} value={s.sectionId}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <ul className="flex flex-col gap-1">
              {subjects.map((s) => {
                const conflict = conflictBySubjectId.get(s.id);
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => canManage && openEdit(s)}
                      className={`relative flex w-full items-center justify-between gap-sm overflow-hidden rounded-md border p-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        conflict ? "border-border" : "border-border"
                      }`}
                    >
                      {conflict && <span className={`absolute inset-y-0 left-0 w-0.5 ${conflict.severity === "error" ? "bg-error" : "bg-warning"}`} aria-hidden="true" />}
                      <div className="min-w-0 pl-1.5">
                        <p className="truncate text-sm font-medium text-foreground">{subjectLabel(s)}</p>
                        <p className="text-xs text-muted-foreground">
                          {s.date ? `${formatDate(s.date)} · ${s.startTime}–${s.endTime}` : "Not scheduled"} {s.roomId ? `· ${roomById(s.roomId)?.name}` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {s.locked && <Lock className="size-3.5 text-muted-foreground" aria-hidden="true" />}
                        {conflict && <AlertTriangle className={`size-3.5 ${conflict.severity === "error" ? "text-error" : "text-warning"}`} aria-hidden="true" />}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

      {view === "room" && (
        <div className="flex flex-col gap-sm">
          {roomsGrouped.length === 0 && <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">No rooms assigned yet.</p>}
          {roomsGrouped.map(([roomId, subjects]) => (
            <div key={roomId} className="rounded-lg border border-border bg-surface p-md">
              <h2 className="mb-sm flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <DoorOpen className="size-4 text-muted-foreground" /> {roomById(roomId)?.name}
              </h2>
              <ul className="flex flex-col divide-y divide-border text-sm">
                {subjects.map((s) => (
                  <li key={s.id} className="flex items-center justify-between py-1.5">
                    <span className="text-foreground">
                      {sectionLabel(s.sectionId)} · {subjectLabel(s)}
                    </span>
                    <span className="text-xs text-muted-foreground">{formatDate(s.date!)} · {s.startTime}–{s.endTime}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {view === "invigilator" && (
        <div className="flex flex-col gap-sm">
          {invigilatorsGrouped.length === 0 && <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">No invigilators assigned yet.</p>}
          {invigilatorsGrouped.map(([teacherId, subjects]) => (
            <div key={teacherId} className="rounded-lg border border-border bg-surface p-md">
              <h2 className="mb-sm flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <Users className="size-4 text-muted-foreground" /> {teacherById(teacherId)?.name}
              </h2>
              <ul className="flex flex-col divide-y divide-border text-sm">
                {subjects.map((s) => (
                  <li key={s.id} className="flex items-center justify-between py-1.5">
                    <span className="text-foreground">
                      {sectionLabel(s.sectionId)} · {subjectLabel(s)} · {roomById(s.roomId)?.name}
                    </span>
                    <span className="text-xs text-muted-foreground">{formatDate(s.date!)} · {s.startTime}–{s.endTime}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {view === "calendar" && (
        <div className="flex flex-col gap-sm">
          {calendarGrouped.length === 0 && <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Nothing scheduled yet.</p>}
          {calendarGrouped.map(([date, subjects]) => (
            <div key={date} className="rounded-lg border border-border bg-surface p-md">
              <h2 className="mb-sm flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <CalendarDays className="size-4 text-muted-foreground" /> {formatDate(date, { weekday: "long", day: "2-digit", month: "short", year: "numeric" })}
              </h2>
              <ul className="flex flex-col divide-y divide-border text-sm">
                {subjects.map((s) => (
                  <li key={s.id} className="flex items-center justify-between py-1.5">
                    <span className="text-foreground">
                      {sectionLabel(s.sectionId)} · {subjectLabel(s)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {s.startTime}–{s.endTime} · {roomById(s.roomId)?.name}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <DetailDrawer open={editSubject !== null} onOpenChange={(open) => !open && setEditSubject(null)} title={editSubject ? subjectLabel(editSubject) : ""} description={editSubject ? sectionLabel(editSubject.sectionId) : ""}>
        {draft && (
          <div className="flex flex-col gap-sm">
            <div className="grid grid-cols-3 gap-sm">
              <div>
                <Label htmlFor="sched-date">Date</Label>
                <Input id="sched-date" type="date" value={draft.date ?? ""} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="sched-start">Start</Label>
                <Input id="sched-start" type="time" value={draft.startTime ?? ""} onChange={(e) => setDraft({ ...draft, startTime: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="sched-end">End</Label>
                <Input id="sched-end" type="time" value={draft.endTime ?? ""} onChange={(e) => setDraft({ ...draft, endTime: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Room</Label>
              <Select value={draft.roomId ?? ""} onValueChange={(v) => setDraft({ ...draft, roomId: v || undefined })}>
                <SelectTrigger aria-label="Room">
                  <SelectValue placeholder="Select room" />
                </SelectTrigger>
                <SelectContent>
                  {rooms.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name} · {r.capacity} seats
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Invigilator</Label>
              <Select value={draft.invigilatorId ?? ""} onValueChange={(v) => setDraft({ ...draft, invigilatorId: v || undefined })}>
                <SelectTrigger aria-label="Invigilator">
                  <SelectValue placeholder="Select teacher" />
                </SelectTrigger>
                <SelectContent>
                  {teachers.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldHint>Defaults to the examiner if left unset.</FieldHint>
            </div>
            <div>
              <Label htmlFor="sched-instructions">Instructions</Label>
              <Textarea id="sched-instructions" rows={2} value={draft.instructions ?? ""} onChange={(e) => setDraft({ ...draft, instructions: e.target.value })} />
            </div>
            <div className="flex items-center gap-sm">
              <Button onClick={handleSave} className="flex-1">
                Save
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  if (!editSubject) return;
                  toggleExamSubjectLock(editSubject.id, { name: "Examination Controller", role: "Examination Controller" });
                  setDraft({ ...draft, locked: !draft.locked });
                }}
              >
                {draft.locked ? <Unlock className="size-3.5" /> : <Lock className="size-3.5" />}
              </Button>
            </div>
          </div>
        )}
      </DetailDrawer>

      <DetailDrawer open={selectedConflict !== null} onOpenChange={(open) => !open && setSelectedConflict(null)} title={selectedConflict ? examConflictLabels[selectedConflict.type] : ""} description="Schedule conflict">
        {selectedConflict && (
          <div className="flex flex-col gap-sm">
            <Badge tone={selectedConflict.severity === "error" ? "error" : "warning"} className="self-start">
              {selectedConflict.severity === "error" ? "Needs attention" : "Worth reviewing"}
            </Badge>
            <p className="text-sm text-foreground">{selectedConflict.description}</p>
            <div className="flex flex-col gap-1">
              {selectedConflict.examSubjectIds.map((id) => {
                const subject = examSubjects.find((s) => s.id === id) ?? db.examSubjects.find((s) => s.id === id);
                if (!subject) return null;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setSelectedConflict(null);
                      if (examSubjects.some((s) => s.id === id)) openEdit(subject);
                    }}
                    className="rounded-md border border-border p-sm text-left text-sm text-foreground outline-none hover:bg-surface-secondary/60 focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {sectionLabel(subject.sectionId)} · {subjectLabel(subject)} · {subject.date ? formatDate(subject.date) : "Unscheduled"}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </DetailDrawer>

      <ConfirmDialog
        open={proposal !== null}
        onOpenChange={(open) => !open && setProposal(null)}
        title="Apply generated schedule?"
        description={`This fills in date, time and room for ${proposal?.length ?? 0} unscheduled subject(s). You can still edit any of them afterward.`}
        confirmLabel="Apply schedule"
        onConfirm={() => {
          if (proposal) applyExamSchedule(exam.id, proposal, { name: "Examination Controller", role: "Examination Controller" });
          setProposal(null);
        }}
      />

      <ConfirmDialog
        open={confirmPublish}
        onOpenChange={setConfirmPublish}
        title="Publish this schedule?"
        description="Marks the exam as scheduled and makes the timetable visible to teachers and students."
        confirmLabel="Publish schedule"
        onConfirm={() => {
          setExamStatus(exam.id, "scheduled", { name: "Examination Controller", role: "Examination Controller" });
          setConfirmPublish(false);
        }}
      />
    </div>
  );
}
