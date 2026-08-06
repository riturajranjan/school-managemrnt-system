"use client";

import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { AlertTriangle, Lock, Plus, Trash2, Unlock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { FieldHint, Label } from "@/components/ui/label";
import { Input, Textarea } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useManagedClasses, useTeachers } from "@/lib/hooks/use-academics";
import { useExam, useExamClasses, useExamSubjects } from "@/lib/hooks/use-exams";
import { subjectById, subjectsForGrade, roomById, rooms } from "@/lib/data/seed/academics";
import { addExamSubject, removeExamSubject, toggleExamSubjectLock, updateExamSubject } from "@/lib/services/exam-subject-service";
import type { ExamSubject } from "@/lib/types/exams";

export default function ExamSubjectsPage() {
  const params = useParams<{ examId: string }>();
  const exam = useExam(params.examId);
  const examClasses = useExamClasses(params.examId);
  const examSubjects = useExamSubjects(params.examId);
  const classes = useManagedClasses();
  const teachers = useTeachers();
  const { can } = usePermissions();
  const canManage = can("exams.manageSubjects");

  const [addingFor, setAddingFor] = useState<string | null>(null);
  const [pickedSubjectId, setPickedSubjectId] = useState("");
  const [editSubject, setEditSubject] = useState<ExamSubject | null>(null);
  const [draft, setDraft] = useState<ExamSubject | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const sections = useMemo(
    () =>
      examClasses.map((ec) => {
        const schoolClass = classes.find((c) => c.id === ec.classId);
        const section = schoolClass?.sections.find((s) => s.id === ec.sectionId);
        const classOrder = schoolClass?.order ?? 0;
        const applicable = subjectsForGrade(classOrder);
        const configured = examSubjects.filter((s) => s.sectionId === ec.sectionId);
        const remaining = applicable.filter((subj) => !configured.some((c) => c.subjectId === subj.id));
        return { examClass: ec, className: schoolClass?.name ?? ec.classId, sectionName: section?.name ?? "", configured, remaining };
      }),
    [examClasses, classes, examSubjects],
  );

  if (!exam) return null;
  const examId = exam.id;

  function openEdit(subject: ExamSubject) {
    setEditSubject(subject);
    setDraft({ ...subject });
    setErrors([]);
  }

  function handleAdd(classId: string, sectionId: string) {
    if (!pickedSubjectId) return;
    const base = subjectById(pickedSubjectId);
    if (!base) return;
    const result = addExamSubject(examId, classId, sectionId, pickedSubjectId, {
      maxMarks: base.maxMarks,
      passingMarks: base.passingMarks,
      theoryMarks: base.theoryMarks,
      practicalMarks: base.practicalMarks,
    });
    if ("errors" in result) {
      setErrors(result.errors);
      return;
    }
    setAddingFor(null);
    setPickedSubjectId("");
    setErrors([]);
    openEdit(result.subject);
  }

  function handleSaveDraft() {
    if (!draft) return;
    const result = updateExamSubject(draft.id, draft);
    if (!result.valid) {
      setErrors(result.errors);
      return;
    }
    setErrors([]);
    setEditSubject(null);
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Subjects — {exam.name}</h1>
        <p className="text-xs text-muted-foreground">Marks structure, examiner and mark-entry assignments per class</p>
      </div>

      {sections.length === 0 && <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">No classes selected for this exam yet.</p>}

      {sections.map(({ examClass, className, sectionName, configured, remaining }) => (
        <div key={examClass.id} className="rounded-lg border border-border bg-surface p-md">
          <div className="mb-sm flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">
              {className} — Section {sectionName}
            </h2>
            <Badge tone={configured.length > 0 ? "success" : "neutral"}>{configured.length} subject{configured.length === 1 ? "" : "s"}</Badge>
          </div>

          <ul className="flex flex-col gap-1">
            {configured.map((s) => {
              const subj = subjectById(s.subjectId);
              const teacher = teachers.find((t) => t.id === s.markEntryTeacherId);
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => canManage && openEdit(s)}
                    className="surface-3d flex w-full items-center justify-between gap-sm rounded-md border border-border bg-surface p-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="flex items-center gap-sm">
                      <span className="size-2.5 shrink-0 rounded-pill" style={{ backgroundColor: subj?.color }} aria-hidden="true" />
                      <div>
                        <p className="text-sm font-medium text-foreground">{subj?.name ?? s.subjectId}</p>
                        <p className="text-xs text-muted-foreground">
                          Max {s.maxMarks} · Pass {s.passingMarks} · {teacher?.name ?? "No teacher assigned"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {s.locked && <Lock className="size-3.5 text-muted-foreground" aria-hidden="true" />}
                      <Badge tone="neutral">{s.theoryMarks}T / {s.practicalMarks}P</Badge>
                    </div>
                  </button>
                </li>
              );
            })}
            {configured.length === 0 && <li className="text-sm text-muted-foreground">No subjects configured yet.</li>}
          </ul>

          {canManage && (
            <div className="mt-sm">
              {addingFor === examClass.id ? (
                <div className="flex flex-wrap items-center gap-xs">
                  <Select value={pickedSubjectId} onValueChange={setPickedSubjectId}>
                    <SelectTrigger className="w-56" aria-label="Select subject to add">
                      <SelectValue placeholder="Select subject" />
                    </SelectTrigger>
                    <SelectContent>
                      {remaining.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={() => handleAdd(examClass.classId, examClass.sectionId)} disabled={!pickedSubjectId}>
                    Add
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setAddingFor(null)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setAddingFor(examClass.id)} disabled={remaining.length === 0}>
                  <Plus className="size-3.5" />
                  Add subject
                </Button>
              )}
              {remaining.length === 0 && addingFor !== examClass.id && <p className="mt-1 text-xs text-muted-foreground">All applicable subjects are configured.</p>}
            </div>
          )}
        </div>
      ))}

      <DetailDrawer
        open={editSubject !== null}
        onOpenChange={(open) => !open && setEditSubject(null)}
        title={editSubject ? subjectById(editSubject.subjectId)?.name ?? "" : ""}
        description="Marks structure and assignments"
      >
        {draft && (
          <div className="flex flex-col gap-sm">
            {errors.length > 0 && (
              <div className="flex flex-col gap-1 rounded-md border border-error/30 bg-error/8 p-sm text-xs text-error">
                <p className="flex items-center gap-1 font-medium">
                  <AlertTriangle className="size-3.5" /> Fix before saving
                </p>
                {errors.map((e, i) => (
                  <p key={i}>{e}</p>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-sm">
              <div>
                <Label htmlFor="max-marks">Maximum marks</Label>
                <Input id="max-marks" type="number" value={draft.maxMarks} onChange={(e) => setDraft({ ...draft, maxMarks: Number(e.target.value) })} />
              </div>
              <div>
                <Label htmlFor="pass-marks">Passing marks</Label>
                <Input id="pass-marks" type="number" value={draft.passingMarks} onChange={(e) => setDraft({ ...draft, passingMarks: Number(e.target.value) })} />
              </div>
              <div>
                <Label htmlFor="theory-marks">Theory</Label>
                <Input id="theory-marks" type="number" value={draft.theoryMarks} onChange={(e) => setDraft({ ...draft, theoryMarks: Number(e.target.value) })} />
              </div>
              <div>
                <Label htmlFor="practical-marks">Practical</Label>
                <Input id="practical-marks" type="number" value={draft.practicalMarks} onChange={(e) => setDraft({ ...draft, practicalMarks: Number(e.target.value) })} />
              </div>
              <div>
                <Label htmlFor="internal-marks">Internal</Label>
                <Input id="internal-marks" type="number" value={draft.internalMarks} onChange={(e) => setDraft({ ...draft, internalMarks: Number(e.target.value) })} />
              </div>
              <div>
                <Label htmlFor="project-marks">Project</Label>
                <Input id="project-marks" type="number" value={draft.projectMarks} onChange={(e) => setDraft({ ...draft, projectMarks: Number(e.target.value) })} />
              </div>
              <div>
                <Label htmlFor="grace-marks">Grace-mark limit</Label>
                <Input id="grace-marks" type="number" value={draft.graceMarksLimit} onChange={(e) => setDraft({ ...draft, graceMarksLimit: Number(e.target.value) })} />
              </div>
              <div>
                <Label htmlFor="weightage">Weightage %</Label>
                <Input id="weightage" type="number" value={draft.weightage} onChange={(e) => setDraft({ ...draft, weightage: Number(e.target.value) })} />
              </div>
            </div>
            <FieldHint>Theory + Practical + Internal + Project must add up to Maximum marks.</FieldHint>

            <div>
              <Label>Room</Label>
              <Select value={draft.roomId ?? ""} onValueChange={(v) => setDraft({ ...draft, roomId: v || undefined })}>
                <SelectTrigger aria-label="Room">
                  <SelectValue placeholder="Not assigned yet — set in Schedule" />
                </SelectTrigger>
                <SelectContent>
                  {rooms.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldHint>{roomById(draft.roomId) ? undefined : "Room and time are usually finalized in the Schedule builder."}</FieldHint>
            </div>

            <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
              <div>
                <Label>Examiner</Label>
                <Select value={draft.examinerId ?? ""} onValueChange={(v) => setDraft({ ...draft, examinerId: v || undefined })}>
                  <SelectTrigger aria-label="Examiner">
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
              </div>
              <div>
                <Label>Mark-entry teacher</Label>
                <Select value={draft.markEntryTeacherId ?? ""} onValueChange={(v) => setDraft({ ...draft, markEntryTeacherId: v || undefined })}>
                  <SelectTrigger aria-label="Mark-entry teacher">
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
              </div>
              <div>
                <Label>Verification teacher</Label>
                <Select value={draft.verificationTeacherId ?? ""} onValueChange={(v) => setDraft({ ...draft, verificationTeacherId: v || undefined })}>
                  <SelectTrigger aria-label="Verification teacher">
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
              </div>
            </div>

            <div>
              <Label htmlFor="instructions">Instructions</Label>
              <Textarea id="instructions" rows={2} value={draft.instructions ?? ""} onChange={(e) => setDraft({ ...draft, instructions: e.target.value })} />
            </div>

            {removeError && <p className="text-xs text-error">{removeError}</p>}

            <div className="flex items-center gap-sm">
              <Button onClick={handleSaveDraft} className="flex-1">
                Save changes
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
              <Button
                variant="outline"
                className="text-error"
                onClick={() => {
                  if (!editSubject) return;
                  const result = removeExamSubject(editSubject.id);
                  if (!result.ok) {
                    setRemoveError(result.error);
                    return;
                  }
                  setRemoveError(null);
                  setEditSubject(null);
                }}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}
