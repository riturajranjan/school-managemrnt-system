"use client";

import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { CheckCheck, Lock, Unlock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useManagedClasses } from "@/lib/hooks/use-academics";
import { useExam, useExamAttendance, useExamSubjects } from "@/lib/hooks/use-exams";
import { useStudents } from "@/lib/hooks/use-students";
import { subjectById } from "@/lib/data/seed/academics";
import { lockAttendance, markAllPresent, reopenAttendance, setAttendanceNote, setAttendanceStatus } from "@/lib/services/exam-attendance-service";
import { examAttendanceStatusLabels, examAttendanceStatusTone, type ExamAttendanceStatus } from "@/lib/types/exams";
import { formatDate } from "@/lib/utils";

const statusOptions = Object.keys(examAttendanceStatusLabels) as ExamAttendanceStatus[];
const statusNeedsNote: ExamAttendanceStatus[] = ["medical", "malpractice", "withheld"];

export default function ExamAttendancePage() {
  const params = useParams<{ examId: string }>();
  const exam = useExam(params.examId);
  const examSubjects = useExamSubjects(params.examId);
  const attendance = useExamAttendance(params.examId);
  const classes = useManagedClasses();
  const students = useStudents();
  const { can } = usePermissions();
  const canManage = can("exams.manageAttendance");

  const scheduled = useMemo(() => examSubjects.filter((s) => s.date).sort((a, b) => (a.date! < b.date! ? -1 : 1)), [examSubjects]);
  const [selectedId, setSelectedId] = useState(scheduled[0]?.id ?? "");
  const [confirmReopen, setConfirmReopen] = useState(false);

  const selected = scheduled.find((s) => s.id === selectedId) ?? scheduled[0];
  const roster = useMemo(() => (selected ? students.filter((s) => s.sectionId === selected.sectionId).sort((a, b) => (a.rollNumber ?? "").localeCompare(b.rollNumber ?? "")) : []), [selected, students]);

  if (!exam) return null;

  if (scheduled.length === 0) {
    return <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Schedule this exam&apos;s subjects before marking attendance.</p>;
  }
  if (!selected) return null;

  const subject = subjectById(selected.subjectId);
  const schoolClass = classes.find((c) => c.id === selected.classId);
  const section = schoolClass?.sections.find((s) => s.id === selected.sectionId);
  const recordsForSelected = attendance.filter((a) => a.examSubjectId === selected.id);
  const markedCount = recordsForSelected.filter((a) => a.status !== "not-marked").length;
  const isLocked = recordsForSelected.length > 0 && recordsForSelected.every((a) => a.locked);

  function statusFor(studentId: string): ExamAttendanceStatus {
    return recordsForSelected.find((a) => a.studentId === studentId)?.status ?? "not-marked";
  }
  function noteFor(studentId: string): string {
    return recordsForSelected.find((a) => a.studentId === studentId)?.note ?? "";
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Attendance — {exam.name}</h1>
        <p className="text-xs text-muted-foreground">Mark exam attendance per subject — this feeds eligibility rules in the result engine</p>
      </div>

      <Select value={selectedId} onValueChange={setSelectedId}>
        <SelectTrigger className="w-full sm:w-80" aria-label="Select exam subject">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {scheduled.map((s) => {
            const subj = subjectById(s.subjectId);
            const cls = classes.find((c) => c.id === s.classId);
            const sec = cls?.sections.find((sec) => sec.id === s.sectionId);
            return (
              <SelectItem key={s.id} value={s.id}>
                {cls?.name}-{sec?.name} · {subj?.name} · {formatDate(s.date!)}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>

      <div className="flex flex-wrap items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm">
        <div>
          <p className="text-sm font-semibold text-foreground">
            {schoolClass?.name}-{section?.name} · {subject?.name}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatDate(selected.date!)} · {selected.startTime}–{selected.endTime} · {markedCount}/{roster.length} marked
          </p>
        </div>
        {canManage && (
          <div className="flex items-center gap-xs">
            {!isLocked ? (
              <>
                <Button size="sm" variant="outline" onClick={() => markAllPresent(exam.id, selected.id, roster.map((s) => s.id), { name: "Examination Controller", role: "Examination Controller" })}>
                  <CheckCheck className="size-3.5" />
                  Mark all present
                </Button>
                <Button size="sm" variant="outline" onClick={() => lockAttendance(exam.id, selected.id, { name: "Examination Controller", role: "Examination Controller" })} disabled={markedCount === 0}>
                  <Lock className="size-3.5" />
                  Lock
                </Button>
              </>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setConfirmReopen(true)}>
                <Unlock className="size-3.5" />
                Reopen
              </Button>
            )}
          </div>
        )}
      </div>

      {isLocked && <Badge tone="neutral">Attendance locked</Badge>}

      <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface">
        {roster.map((student) => {
          const status = statusFor(student.id);
          const needsNote = statusNeedsNote.includes(status);
          return (
            <li key={student.id} className="flex flex-col gap-sm p-sm sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {student.profile.firstName} {student.profile.lastName}
                </p>
                <p className="text-xs text-muted-foreground">Roll {student.rollNumber ?? "—"}</p>
              </div>
              <div className="flex flex-wrap items-center gap-xs">
                <Select value={status} onValueChange={(v) => setAttendanceStatus(exam.id, selected.id, student.id, v as ExamAttendanceStatus, { name: "Examination Controller", role: "Examination Controller" })} disabled={!canManage || isLocked}>
                  <SelectTrigger className="w-40" aria-label={`Attendance status for ${student.profile.firstName}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((s) => (
                      <SelectItem key={s} value={s}>
                        {examAttendanceStatusLabels[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Badge tone={examAttendanceStatusTone[status]}>{examAttendanceStatusLabels[status]}</Badge>
              </div>
              {needsNote && (
                <Input
                  value={noteFor(student.id)}
                  onChange={(e) => setAttendanceNote(selected.id, student.id, e.target.value)}
                  placeholder={status === "medical" ? "Medical note / certificate reference" : status === "malpractice" ? "Describe the malpractice incident" : "Reason for withholding"}
                  disabled={!canManage || isLocked}
                  className="sm:w-64"
                />
              )}
            </li>
          );
        })}
        {roster.length === 0 && <li className="p-sm text-sm text-muted-foreground">No students enrolled in this section.</li>}
      </ul>

      <ConfirmDialog
        open={confirmReopen}
        onOpenChange={setConfirmReopen}
        title="Reopen attendance?"
        description="This unlocks attendance for this subject so it can be corrected. The reopen is recorded in the audit log."
        confirmLabel="Reopen"
        onConfirm={() => {
          reopenAttendance(exam.id, selected.id, "Correction requested", { name: "Examination Controller", role: "Examination Controller" });
          setConfirmReopen(false);
        }}
      />
    </div>
  );
}
