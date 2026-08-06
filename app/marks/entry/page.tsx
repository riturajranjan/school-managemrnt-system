"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useRef, useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, Download, Lock, Unlock, Upload, UploadCloud } from "lucide-react";
import Papa from "papaparse";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useManagedClasses } from "@/lib/hooks/use-academics";
import { useExam, useExamAttendance, useExams, useExamSubjects, useGradingSchemes, useMarksEntrySessions, useStudentMarks } from "@/lib/hooks/use-exams";
import { useStudents } from "@/lib/hooks/use-students";
import { subjectById } from "@/lib/data/seed/academics";
import { gradeForPercent } from "@/lib/services/result-engine";
import { bulkFillComponent, lockMarksEntry, reopenMarksEntry, saveMark, setMarkRemark, submitMarksEntry, validateComponentValue } from "@/lib/services/marks-service";
import { marksComponentLabels, marksEntryStatusLabels, type MarksComponentKey } from "@/lib/types/marks";
import { downloadTextFile, timeAgo } from "@/lib/utils";

const ACTOR = { name: "Subject Teacher", role: "Teacher" };
const componentOrder: MarksComponentKey[] = ["theory", "practical", "internal", "project"];

function MarksEntryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const exams = useExams();
  const classes = useManagedClasses();
  const students = useStudents();
  const { can } = usePermissions();
  const canEnter = can("marks.enter");
  const canLock = can("marks.lock");

  const [examId, setExamId] = useState(searchParams.get("examId") ?? exams.find((e) => e.status !== "draft")?.id ?? "");
  const examSubjects = useExamSubjects(examId);
  const scheduled = useMemo(() => examSubjects.filter((s) => s.date).sort((a, b) => (a.date! < b.date! ? -1 : 1)), [examSubjects]);
  const [examSubjectId, setExamSubjectId] = useState(searchParams.get("examSubjectId") ?? scheduled[0]?.id ?? "");
  const examSubject = examSubjects.find((s) => s.id === examSubjectId) ?? scheduled[0];

  const exam = useExam(examId);
  const attendance = useExamAttendance(examId);
  const marks = useStudentMarks(examId);
  const sessions = useMarksEntrySessions(examId);
  const gradingSchemes = useGradingSchemes();

  const [density, setDensity] = useState<"comfortable" | "compact">("comfortable");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [errorsByCell, setErrorsByCell] = useState<Record<string, string[]>>({});
  const [confirmLock, setConfirmLock] = useState(false);
  const [confirmReopen, setConfirmReopen] = useState(false);
  const [mobileIndex, setMobileIndex] = useState(0);
  const cellRefs = useRef(new Map<string, HTMLInputElement | null>());

  if (!exam || !examSubject) {
    return (
      <div className="flex flex-col gap-md">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Marks entry</h1>
          <p className="text-xs text-muted-foreground">Select an exam to begin</p>
        </div>
        <Select
          value={examId}
          onValueChange={(v) => {
            setExamId(v);
            setExamSubjectId("");
          }}
        >
          <SelectTrigger className="w-72" aria-label="Select exam">
            <SelectValue placeholder="Select exam" />
          </SelectTrigger>
          <SelectContent>
            {exams
              .filter((e) => e.status !== "draft")
              .map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        {examId && scheduled.length === 0 && <p className="text-sm text-muted-foreground">This exam has no scheduled subjects yet.</p>}
      </div>
    );
  }

  const subject = subjectById(examSubject.subjectId);
  const schoolClass = classes.find((c) => c.id === examSubject.classId);
  const section = schoolClass?.sections.find((s) => s.id === examSubject.sectionId);
  const roster = students.filter((s) => s.sectionId === examSubject.sectionId).sort((a, b) => (a.rollNumber ?? "").localeCompare(b.rollNumber ?? ""));
  const session = sessions.find((s) => s.examSubjectId === examSubject.id);
  const isLocked = session?.status === "locked";
  const scheme = gradingSchemes.find((g) => g.id === exam.gradingSchemeId);

  const visibleComponents = componentOrder.filter((c) => {
    if (c === "theory") return examSubject.theoryMarks > 0;
    if (c === "practical") return examSubject.practicalMarks > 0;
    if (c === "internal") return examSubject.internalMarks > 0;
    return examSubject.projectMarks > 0;
  });
  const componentMax: Record<MarksComponentKey, number> = { theory: examSubject.theoryMarks, practical: examSubject.practicalMarks, internal: examSubject.internalMarks, project: examSubject.projectMarks };

  function attendanceStatusOf(studentId: string) {
    return attendance.find((a) => a.examSubjectId === examSubject!.id && a.studentId === studentId)?.status ?? "not-marked";
  }
  function markOf(studentId: string) {
    return marks.find((m) => m.examSubjectId === examSubject!.id && m.studentId === studentId);
  }
  function cellKey(studentId: string, component: MarksComponentKey) {
    return `${studentId}:${component}`;
  }
  function cellValue(studentId: string, component: MarksComponentKey): string {
    const key = cellKey(studentId, component);
    if (key in drafts) return drafts[key];
    const value = markOf(studentId)?.[component];
    return value === undefined ? "" : String(value);
  }

  function commitCell(studentId: string, component: MarksComponentKey) {
    const key = cellKey(studentId, component);
    const raw = drafts[key];
    if (raw === undefined) return;
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    if (raw.trim() === "") {
      setErrorsByCell((prev) => ({ ...prev, [key]: [] }));
      return;
    }
    const value = Number(raw);
    const validationErrors = validateComponentValue(value, componentMax[component]);
    if (validationErrors.length > 0) {
      setErrorsByCell((prev) => ({ ...prev, [key]: validationErrors }));
      return;
    }
    setErrorsByCell((prev) => ({ ...prev, [key]: [] }));
    saveMark(examId, examSubject!, studentId, { [component]: value }, ACTOR);
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>, studentIndex: number, componentIndex: number) {
    const text = e.clipboardData.getData("text");
    if (!text.includes("\t") && !text.includes("\n")) return; // single value — let default paste behaviour handle it
    e.preventDefault();
    const rows = text.trim().split("\n").map((r) => r.split("\t"));
    rows.forEach((row, rOffset) => {
      row.forEach((cell, cOffset) => {
        const student = roster[studentIndex + rOffset];
        const component = visibleComponents[componentIndex + cOffset];
        if (!student || !component) return;
        const value = Number(cell.trim());
        if (cell.trim() === "" || Number.isNaN(value)) return;
        const errs = validateComponentValue(value, componentMax[component]);
        if (errs.length === 0) saveMark(examId, examSubject!, student.id, { [component]: value }, ACTOR);
      });
    });
  }

  function moveFocus(studentIndex: number, componentIndex: number, dRow: number, dCol: number) {
    const targetStudent = roster[studentIndex + dRow];
    const targetComponent = visibleComponents[componentIndex + dCol];
    if (!targetStudent || !targetComponent) return;
    const key = cellKey(targetStudent.id, targetComponent);
    cellRefs.current.get(key)?.focus();
  }

  const enteredCount = roster.filter((s) => markOf(s.id)?.total !== undefined).length;
  const mobileStudent = roster[mobileIndex];

  return (
    <div className="flex flex-col gap-md pb-24 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Marks entry</h1>
          <p className="text-xs text-muted-foreground">Keyboard-first entry — Tab/Enter moves to the next field, values save automatically</p>
        </div>
        <div className="flex flex-wrap items-center gap-xs">
          <Button size="sm" variant="outline" onClick={() => setDensity((d) => (d === "comfortable" ? "compact" : "comfortable"))} className="hidden sm:inline-flex">
            {density === "comfortable" ? "Compact" : "Comfortable"}
          </Button>
          <Button size="sm" variant="outline" asChild>
            <a href={`/marks/import?examId=${examId}&examSubjectId=${examSubjectId}`}>
              <Upload className="size-3.5" />
              Import
            </a>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const rows = roster.map((s) => ({
                Roll: s.rollNumber ?? "",
                Student: `${s.profile.firstName} ${s.profile.lastName}`,
                ...Object.fromEntries(visibleComponents.map((c) => [marksComponentLabels[c], markOf(s.id)?.[c] ?? ""])),
                Total: markOf(s.id)?.total ?? "",
              }));
              downloadTextFile(`marks-${examSubject!.id}.csv`, Papa.unparse(rows));
            }}
          >
            <Download className="size-3.5" />
            Export
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-xs">
        <Select value={examId} onValueChange={(v) => { setExamId(v); setExamSubjectId(""); router.replace(`/marks/entry?examId=${v}`); }}>
          <SelectTrigger className="w-48" aria-label="Exam">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {exams.filter((e) => e.status !== "draft").map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={examSubjectId}
          onValueChange={(v) => {
            setExamSubjectId(v);
            setMobileIndex(0);
            router.replace(`/marks/entry?examId=${examId}&examSubjectId=${v}`);
          }}
        >
          <SelectTrigger className="w-64" aria-label="Class, section and subject">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {scheduled.map((s) => {
              const subj = subjectById(s.subjectId);
              const cls = classes.find((c) => c.id === s.classId);
              const sec = cls?.sections.find((sec) => sec.id === s.sectionId);
              return (
                <SelectItem key={s.id} value={s.id}>
                  {cls?.name}-{sec?.name} · {subj?.name}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm">
        <div>
          <p className="text-sm font-semibold text-foreground">
            {schoolClass?.name}-{section?.name} · {subject?.name}
          </p>
          <p className="text-xs text-muted-foreground">
            {enteredCount}/{roster.length} entered · {session ? marksEntryStatusLabels[session.status] : "Not started"}
            {session?.lastSavedAt ? ` · Saved ${timeAgo(session.lastSavedAt)}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-xs">
          <Badge tone={isLocked ? "neutral" : session?.status === "submitted" ? "info" : "warning"}>{session ? marksEntryStatusLabels[session.status] : "Not started"}</Badge>
          {canEnter && !isLocked && (
            <Button size="sm" variant="outline" onClick={() => submitMarksEntry(examId, examSubject.id, ACTOR)} disabled={enteredCount === 0}>
              <UploadCloud className="size-3.5" />
              Submit
            </Button>
          )}
          {canLock && !isLocked && (
            <Button size="sm" variant="outline" onClick={() => setConfirmLock(true)}>
              <Lock className="size-3.5" />
              Lock
            </Button>
          )}
          {canLock && isLocked && (
            <Button size="sm" variant="outline" onClick={() => setConfirmReopen(true)}>
              <Unlock className="size-3.5" />
              Reopen
            </Button>
          )}
        </div>
      </div>

      {/* Desktop / tablet spreadsheet-style grid */}
      <div className="hidden overflow-x-auto rounded-lg border border-border bg-surface md:block">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-secondary/60 text-left">
              <th className="sticky left-0 z-10 bg-surface-secondary/95 px-sm py-2 text-xs font-semibold text-muted-foreground backdrop-blur-sm">Roll</th>
              <th className="sticky left-14 z-10 min-w-40 bg-surface-secondary/95 px-sm py-2 text-xs font-semibold text-muted-foreground backdrop-blur-sm">Student</th>
              <th className="px-sm py-2 text-xs font-semibold text-muted-foreground">Attendance</th>
              {visibleComponents.map((c) => (
                <th key={c} className="px-sm py-2 text-xs font-semibold text-muted-foreground">
                  {marksComponentLabels[c]}
                  <span className="ml-1 font-normal">/{componentMax[c]}</span>
                  {canEnter && !isLocked && (
                    <button
                      type="button"
                      className="ml-1 text-[10px] font-medium text-primary underline-offset-2 hover:underline"
                      onClick={() => {
                        const value = window.prompt(`Fill all present students' ${marksComponentLabels[c]} with:`);
                        if (value === null || value.trim() === "") return;
                        const result = bulkFillComponent(examId, examSubject, roster.map((s) => s.id), c, Number(value), ACTOR);
                        if (!result.ok) window.alert(result.errors.join(" "));
                      }}
                    >
                      Fill
                    </button>
                  )}
                </th>
              ))}
              <th className="px-sm py-2 text-xs font-semibold text-muted-foreground">Total</th>
              <th className="px-sm py-2 text-xs font-semibold text-muted-foreground">Grade</th>
              <th className="px-sm py-2 text-xs font-semibold text-muted-foreground">Result</th>
              <th className="px-sm py-2 text-xs font-semibold text-muted-foreground">Remark</th>
              <th className="px-sm py-2 text-right text-xs font-semibold text-muted-foreground">Verification</th>
            </tr>
          </thead>
          <tbody>
            {roster.map((student, studentIndex) => {
              const attStatus = attendanceStatusOf(student.id);
              const isAbsent = attStatus === "absent" || attStatus === "malpractice" || attStatus === "withheld";
              const mark = markOf(student.id);
              const percent = mark?.total !== undefined && examSubject.maxMarks > 0 ? (mark.total / examSubject.maxMarks) * 100 : undefined;
              const grade = percent !== undefined && scheme ? gradeForPercent(scheme.ranges, percent) : undefined;
              const result = percent === undefined ? undefined : mark!.total! >= examSubject.passingMarks ? "Pass" : "Fail";
              return (
                <tr key={student.id} className={`border-b border-border last:border-0 ${density === "compact" ? "" : ""}`}>
                  <td className="sticky left-0 z-10 bg-surface px-sm py-1.5 text-xs text-muted-foreground">{student.rollNumber ?? "—"}</td>
                  <td className="sticky left-14 z-10 min-w-40 bg-surface px-sm py-1.5 text-sm text-foreground">
                    {student.profile.firstName} {student.profile.lastName}
                  </td>
                  <td className="px-sm py-1.5">
                    <Badge tone={isAbsent ? "error" : attStatus === "present" ? "success" : "neutral"}>{attStatus}</Badge>
                  </td>
                  {visibleComponents.map((component, componentIndex) => {
                    const key = cellKey(student.id, component);
                    const cellErrors = errorsByCell[key] ?? [];
                    return (
                      <td key={component} className="px-1 py-1">
                        <Input
                          ref={(el) => {
                            cellRefs.current.set(key, el);
                          }}
                          type="number"
                          inputMode="decimal"
                          disabled={!canEnter || isLocked || isAbsent}
                          value={cellValue(student.id, component)}
                          onChange={(e) => setDrafts((prev) => ({ ...prev, [key]: e.target.value }))}
                          onBlur={() => commitCell(student.id, component)}
                          onPaste={(e) => handlePaste(e, studentIndex, componentIndex)}
                          onKeyDown={(e) => {
                            if (e.key === "ArrowDown") { e.preventDefault(); commitCell(student.id, component); moveFocus(studentIndex, componentIndex, 1, 0); }
                            else if (e.key === "ArrowUp") { e.preventDefault(); commitCell(student.id, component); moveFocus(studentIndex, componentIndex, -1, 0); }
                            else if (e.key === "ArrowRight" && (e.target as HTMLInputElement).selectionStart === (e.target as HTMLInputElement).value.length) { moveFocus(studentIndex, componentIndex, 0, 1); }
                            else if (e.key === "ArrowLeft" && (e.target as HTMLInputElement).selectionStart === 0) { moveFocus(studentIndex, componentIndex, 0, -1); }
                            else if (e.key === "Enter") { e.preventDefault(); commitCell(student.id, component); moveFocus(studentIndex, componentIndex, 1, 0); }
                          }}
                          className={`h-9 w-20 text-sm ${cellErrors.length > 0 ? "border-error" : ""}`}
                          aria-label={`${marksComponentLabels[component]} marks for ${student.profile.firstName} ${student.profile.lastName}`}
                          aria-invalid={cellErrors.length > 0}
                        />
                        {cellErrors.length > 0 && <p className="mt-0.5 max-w-20 text-[10px] text-error">{cellErrors[0]}</p>}
                      </td>
                    );
                  })}
                  <td className="px-sm py-1.5 text-sm font-semibold text-foreground">{isAbsent ? "—" : (mark?.total ?? "—")}</td>
                  <td className="px-sm py-1.5">{grade ? <Badge tone="info">{grade.name}</Badge> : <span className="text-xs text-muted-foreground">—</span>}</td>
                  <td className="px-sm py-1.5">
                    {isAbsent ? (
                      <Badge tone="error">{attStatus}</Badge>
                    ) : result ? (
                      <Badge tone={result === "Pass" ? "success" : "error"}>{result}</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-sm py-1.5">
                    <Input
                      defaultValue={mark?.remark ?? ""}
                      onBlur={(e) => setMarkRemark(examSubject.id, student.id, e.target.value)}
                      disabled={!canEnter || isLocked}
                      className="h-9 w-32 text-xs"
                      aria-label={`Remark for ${student.profile.firstName}`}
                    />
                  </td>
                  <td className="px-sm py-1.5 text-right">
                    <Badge tone="neutral">Not verified</Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile: one student at a time */}
      <div className="flex flex-col gap-sm md:hidden">
        {mobileStudent && (
          <div className="rounded-lg border border-border bg-surface p-md">
            <div className="mb-sm flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {mobileStudent.profile.firstName} {mobileStudent.profile.lastName}
                </p>
                <p className="text-xs text-muted-foreground">
                  Roll {mobileStudent.rollNumber ?? "—"} · {mobileIndex + 1}/{roster.length}
                </p>
              </div>
              <Badge tone={attendanceStatusOf(mobileStudent.id) === "present" ? "success" : "error"}>{attendanceStatusOf(mobileStudent.id)}</Badge>
            </div>

            {attendanceStatusOf(mobileStudent.id) === "absent" ? (
              <p className="rounded-md border border-dashed border-border p-sm text-center text-sm text-muted-foreground">Marked absent — no marks to enter.</p>
            ) : (
              <div className="flex flex-col gap-sm">
                {visibleComponents.map((component) => {
                  const key = cellKey(mobileStudent.id, component);
                  const cellErrors = errorsByCell[key] ?? [];
                  return (
                    <div key={component}>
                      <label className="mb-xs block text-xs font-medium text-foreground">
                        {marksComponentLabels[component]} <span className="text-muted-foreground">/ {componentMax[component]}</span>
                      </label>
                      <Input
                        type="number"
                        inputMode="decimal"
                        disabled={!canEnter || isLocked}
                        value={cellValue(mobileStudent.id, component)}
                        onChange={(e) => setDrafts((prev) => ({ ...prev, [key]: e.target.value }))}
                        onBlur={() => commitCell(mobileStudent.id, component)}
                        className={`h-12 text-base ${cellErrors.length > 0 ? "border-error" : ""}`}
                      />
                      {cellErrors.length > 0 && <p className="mt-1 text-xs text-error">{cellErrors[0]}</p>}
                    </div>
                  );
                })}
                <Input
                  defaultValue={markOf(mobileStudent.id)?.remark ?? ""}
                  onBlur={(e) => setMarkRemark(examSubject.id, mobileStudent.id, e.target.value)}
                  placeholder="Remark (optional)"
                  disabled={!canEnter || isLocked}
                  className="h-11"
                />
              </div>
            )}

            <div className="mt-md flex items-center justify-between gap-sm">
              <Button variant="outline" onClick={() => setMobileIndex((i) => Math.max(0, i - 1))} disabled={mobileIndex === 0}>
                <ChevronLeft className="size-4" />
                Previous
              </Button>
              <Button onClick={() => setMobileIndex((i) => Math.min(roster.length - 1, i + 1))} disabled={mobileIndex === roster.length - 1}>
                Save &amp; next
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {roster.length === 0 && <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">No students enrolled in this section.</p>}

      {!canEnter && (
        <div className="flex items-center gap-sm rounded-lg border border-warning/30 bg-warning/8 px-sm py-sm text-sm text-warning">
          <AlertTriangle className="size-4 shrink-0" />
          You have read-only access to marks entry.
        </div>
      )}

      <ConfirmDialog
        open={confirmLock}
        onOpenChange={setConfirmLock}
        title="Lock marks entry?"
        description="Locks this subject's marks so they can move to verification. Only someone with reopen permission can undo this."
        confirmLabel="Lock"
        onConfirm={() => {
          lockMarksEntry(examId, examSubject.id, ACTOR);
          setConfirmLock(false);
        }}
      />
      <ConfirmDialog
        open={confirmReopen}
        onOpenChange={setConfirmReopen}
        title="Reopen marks entry?"
        description="This unlocks the subject for correction and is recorded in the audit log."
        confirmLabel="Reopen"
        onConfirm={() => {
          reopenMarksEntry(examId, examSubject.id, "Correction requested", ACTOR);
          setConfirmReopen(false);
        }}
      />
    </div>
  );
}

export default function MarksEntryPage() {
  return (
    <Suspense fallback={<div className="h-40" />}>
      <MarksEntryContent />
    </Suspense>
  );
}
