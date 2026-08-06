"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, type UseFormReturn } from "react-hook-form";
import { Archive, ArchiveRestore, Copy, Eye, FlaskConical, MoreHorizontal, PencilLine, Plus, UserPlus } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef, RowAction } from "@/components/data-table/types";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { TimelineList } from "@/components/timeline/timeline-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { FieldError, Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { subjectTypeLabels, subjectTypeTone } from "@/components/academics/subjects/subject-meta";
import { usePermissions } from "@/components/providers/permissions-provider";
import { findClass } from "@/lib/data/seed/reference";
import { teacherById } from "@/lib/data/seed/academics";
import { useManagedClasses, useTeachers } from "@/lib/hooks/use-academics";
import { useSisStore } from "@/lib/hooks/use-store";
import { curriculumCompletionPercent } from "@/lib/selectors/academics-insights";
import { subjectFormSchema, type SubjectFormValues } from "@/lib/schemas/academics-form";
import { createAssignment, createSubject, duplicateSubject, setSubjectStatus, updateSubject } from "@/lib/services/subjects-service";
import { progressStatusTone, type Subject } from "@/lib/types/academics";

const subjectTypeOptions: Subject["type"][] = ["core", "elective", "optional", "practical", "language", "co-curricular"];

function SubjectFormFields({ form }: { form: UseFormReturn<SubjectFormValues> }) {
  return (
    <>
      <div>
        <Label htmlFor="subject-name">Subject name</Label>
        <Input id="subject-name" {...form.register("name")} />
        <FieldError>{form.formState.errors.name?.message}</FieldError>
      </div>
      <div className="grid grid-cols-2 gap-sm">
        <div>
          <Label htmlFor="subject-code">Code</Label>
          <Input id="subject-code" {...form.register("code")} />
        </div>
        <div>
          <Label htmlFor="subject-short">Short name</Label>
          <Input id="subject-short" {...form.register("shortName")} />
        </div>
      </div>
      <div>
        <Label htmlFor="subject-dept">Department</Label>
        <Input id="subject-dept" {...form.register("department")} />
      </div>
      <div>
        <Label>Type</Label>
        <Controller
          control={form.control}
          name="type"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger aria-label="Subject type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {subjectTypeOptions.map((t) => (
                  <SelectItem key={t} value={t}>
                    {subjectTypeLabels[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>
      <div className="grid grid-cols-2 gap-sm">
        <div>
          <Label htmlFor="subject-grade-start">Grade from</Label>
          <Input id="subject-grade-start" type="number" {...form.register("gradeRangeStart", { valueAsNumber: true })} />
        </div>
        <div>
          <Label htmlFor="subject-grade-end">Grade to</Label>
          <Input id="subject-grade-end" type="number" {...form.register("gradeRangeEnd", { valueAsNumber: true })} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-sm">
        <div>
          <Label htmlFor="subject-max">Max marks</Label>
          <Input id="subject-max" type="number" {...form.register("maxMarks", { valueAsNumber: true })} />
        </div>
        <div>
          <Label htmlFor="subject-pass">Passing marks</Label>
          <Input id="subject-pass" type="number" {...form.register("passingMarks", { valueAsNumber: true })} />
        </div>
      </div>
      <div>
        <Label htmlFor="subject-color">Colour</Label>
        <Input id="subject-color" type="color" {...form.register("color")} className="h-11 w-16 p-1" />
      </div>
    </>
  );
}

export default function SubjectsPage() {
  const db = useSisStore();
  const classes = useManagedClasses();
  const teachers = useTeachers();
  const { can } = usePermissions();
  const canManage = can("academics.manageSubjects");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailSubject, setDetailSubject] = useState<Subject | null>(null);
  const [editSubject, setEditSubject] = useState<Subject | null>(null);
  const [assignSubject, setAssignSubject] = useState<Subject | null>(null);
  const [assignClassId, setAssignClassId] = useState("");
  const [assignSectionId, setAssignSectionId] = useState("");
  const [assignTeacherId, setAssignTeacherId] = useState("");
  const [assignWeeklyPeriods, setAssignWeeklyPeriods] = useState(4);
  const [assignError, setAssignError] = useState("");

  const form = useForm<SubjectFormValues>({
    resolver: zodResolver(subjectFormSchema),
    defaultValues: { type: "core", gradeRangeStart: 1, gradeRangeEnd: 10, credit: 4, passingMarks: 33, maxMarks: 100, theoryMarks: 100, practicalMarks: 0, color: "#18b0c8" },
  });
  const editForm = useForm<SubjectFormValues>({ resolver: zodResolver(subjectFormSchema) });

  const assignClass = classes.find((c) => c.id === assignClassId);

  function openAssign(subject: Subject) {
    setAssignSubject(subject);
    setAssignClassId("");
    setAssignSectionId("");
    setAssignTeacherId("");
    setAssignWeeklyPeriods(4);
    setAssignError("");
  }

  function openEdit(subject: Subject) {
    setEditSubject(subject);
    editForm.reset(subject);
  }

  const columns: ColumnDef<Subject>[] = [
    {
      id: "name",
      header: "Subject",
      alwaysVisible: true,
      sortValue: (s) => s.name,
      cell: (s) => (
        <div className="flex items-center gap-sm">
          <span className="size-2.5 shrink-0 rounded-pill" style={{ backgroundColor: s.color }} aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-foreground">{s.name}</p>
            <p className="text-xs text-muted-foreground">{s.code}</p>
          </div>
        </div>
      ),
    },
    { id: "department", header: "Department", cell: (s) => <span className="text-sm text-foreground">{s.department}</span> },
    { id: "type", header: "Type", cell: (s) => <Badge tone={subjectTypeTone[s.type]}>{subjectTypeLabels[s.type]}</Badge> },
    { id: "grades", header: "Grade range", cell: (s) => <span className="text-sm text-foreground">{s.gradeRangeStart}–{s.gradeRangeEnd}</span> },
    {
      id: "classes",
      header: "Classes",
      cell: (s) => <span className="text-sm text-foreground">{new Set(db.subjectAssignments.filter((a) => a.subjectId === s.id).map((a) => a.classId)).size}</span>,
      defaultVisible: false,
    },
    {
      id: "teachers",
      header: "Teachers",
      cell: (s) => <span className="text-sm text-foreground">{new Set(db.subjectAssignments.filter((a) => a.subjectId === s.id).map((a) => a.primaryTeacherId)).size}</span>,
      defaultVisible: false,
    },
    {
      id: "weeklyPeriods",
      header: "Weekly periods",
      cell: (s) => <span className="text-sm text-foreground">{db.subjectAssignments.filter((a) => a.subjectId === s.id).reduce((sum, a) => sum + a.weeklyPeriods, 0)}</span>,
      defaultVisible: false,
    },
    {
      id: "curriculum",
      header: "Curriculum completion",
      cell: (s) => <span className="text-sm text-foreground">{curriculumCompletionPercent(db.curriculumUnits.filter((u) => u.subjectId === s.id))}%</span>,
      defaultVisible: false,
    },
    {
      id: "lab",
      header: "Lab requirement",
      cell: (s) => (s.type === "practical" ? <Badge tone="warning"><FlaskConical className="size-3" /> Required</Badge> : <span className="text-sm text-muted-foreground">—</span>),
      defaultVisible: false,
    },
    { id: "maxMarks", header: "Max marks", cell: (s) => <span className="text-sm text-foreground">{s.maxMarks}</span>, defaultVisible: false },
    { id: "status", header: "Status", align: "right", cell: (s) => <Badge tone={s.status === "active" ? "success" : "neutral"}>{s.status}</Badge> },
  ];

  const rowActions: RowAction<Subject>[] = [
    { key: "view", label: "View", icon: <Eye className="size-3.5" />, onSelect: setDetailSubject },
    ...(canManage
      ? [
          { key: "edit", label: "Edit", icon: <PencilLine className="size-3.5" />, onSelect: openEdit },
          { key: "assign-teacher", label: "Assign teacher", icon: <UserPlus className="size-3.5" />, onSelect: openAssign },
          { key: "assign-classes", label: "Assign classes", icon: <UserPlus className="size-3.5" />, onSelect: openAssign },
          { key: "duplicate", label: "Duplicate", icon: <Copy className="size-3.5" />, onSelect: (s: Subject) => duplicateSubject(s.id) },
          {
            key: "archive",
            label: "Archive",
            icon: <Archive className="size-3.5" />,
            hidden: (s: Subject) => s.status !== "active",
            destructive: true,
            onSelect: (s: Subject) => setSubjectStatus(s.id, "inactive"),
          },
          {
            key: "restore",
            label: "Restore",
            icon: <ArchiveRestore className="size-3.5" />,
            hidden: (s: Subject) => s.status !== "inactive",
            onSelect: (s: Subject) => setSubjectStatus(s.id, "active"),
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Subjects</h1>
          <p className="text-xs text-muted-foreground">Subject catalogue and class assignments</p>
        </div>
        {can("academics.manageSubjects") && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-3.5" />
            Add subject
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={db.subjects}
        getRowId={(s) => s.id}
        caption="Subjects"
        onRowClick={setDetailSubject}
        rowActions={rowActions}
        renderMobileCard={(s) => (
          <div className="surface-3d flex w-full items-center gap-sm rounded-lg border border-border bg-surface p-sm active:scale-[0.99]">
            <button type="button" onClick={() => setDetailSubject(s)} className="flex min-w-0 flex-1 items-center gap-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <span className="size-3 shrink-0 rounded-pill" style={{ backgroundColor: s.color }} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-xs">
                  <p className="truncate text-sm font-semibold text-foreground">{s.name}</p>
                  <Badge tone={subjectTypeTone[s.type]}>{subjectTypeLabels[s.type]}</Badge>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {s.code} · Grades {s.gradeRangeStart}–{s.gradeRangeEnd}
                </p>
              </div>
            </button>
            {rowActions.length > 1 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Actions for ${s.name}`}>
                    <MoreHorizontal className="size-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {rowActions
                    .filter((action) => !action.hidden?.(s))
                    .map((action) => (
                      <DropdownMenuItem key={action.key} onSelect={() => action.onSelect(s)} className={action.destructive ? "text-error" : undefined}>
                        {action.icon}
                        {action.label}
                      </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )}
        emptyTitle="No subjects yet"
      />

      <DetailDrawer open={createOpen} onOpenChange={setCreateOpen} title="Add subject" description="Define a new subject in the catalogue">
        <form
          onSubmit={form.handleSubmit((values) => {
            createSubject(values);
            setCreateOpen(false);
            form.reset();
          })}
          className="flex flex-col gap-sm"
        >
          <SubjectFormFields form={form} />
          <Button type="submit">Create subject</Button>
        </form>
      </DetailDrawer>

      <DetailDrawer open={editSubject !== null} onOpenChange={(open) => !open && setEditSubject(null)} title={`Edit ${editSubject?.name ?? ""}`} description="Update this subject's details">
        <form
          onSubmit={editForm.handleSubmit((values) => {
            if (!editSubject) return;
            updateSubject(editSubject.id, values);
            setEditSubject(null);
          })}
          className="flex flex-col gap-sm"
        >
          <SubjectFormFields form={editForm} />
          <Button type="submit">Save changes</Button>
        </form>
      </DetailDrawer>

      <DetailDrawer open={assignSubject !== null} onOpenChange={(open) => !open && setAssignSubject(null)} title={`Assign — ${assignSubject?.name ?? ""}`} description="Add this subject to a class section with a teacher">
        <div className="flex flex-col gap-sm">
          {assignError && (
            <p className="text-xs text-error">{assignError}</p>
          )}
          <div>
            <Label>Class</Label>
            <Select value={assignClassId} onValueChange={(v) => { setAssignClassId(v); setAssignSectionId(""); }}>
              <SelectTrigger aria-label="Class">
                <SelectValue placeholder="Select class" />
              </SelectTrigger>
              <SelectContent>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Section</Label>
            <Select value={assignSectionId} onValueChange={setAssignSectionId} disabled={!assignClass}>
              <SelectTrigger aria-label="Section">
                <SelectValue placeholder="Select section" />
              </SelectTrigger>
              <SelectContent>
                {assignClass?.sections.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    Section {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Teacher</Label>
            <Select value={assignTeacherId} onValueChange={setAssignTeacherId}>
              <SelectTrigger aria-label="Teacher">
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
            <Label htmlFor="assign-weekly-periods">Weekly periods</Label>
            <Input id="assign-weekly-periods" type="number" min={1} max={10} value={assignWeeklyPeriods} onChange={(e) => setAssignWeeklyPeriods(Number(e.target.value))} />
          </div>
          <Button
            onClick={() => {
              if (!assignSubject || !assignClass || !assignSectionId || !assignTeacherId) {
                setAssignError("Select a class, section, and teacher.");
                return;
              }
              const result = createAssignment(
                { classId: assignClass.id, sectionId: assignSectionId, subjectId: assignSubject.id, primaryTeacherId: assignTeacherId, weeklyPeriods: assignWeeklyPeriods, session: db.students[0]?.session ?? "2026-2027" },
                assignClass.order,
              );
              if ("errors" in result) {
                setAssignError(result.errors.join(" "));
                return;
              }
              setAssignError("");
              setAssignSubject(null);
            }}
          >
            Assign
          </Button>
        </div>
      </DetailDrawer>

      <DetailDrawer
        open={detailSubject !== null}
        onOpenChange={(open) => !open && setDetailSubject(null)}
        title={detailSubject?.name ?? ""}
        description={detailSubject ? `${detailSubject.code} · ${subjectTypeLabels[detailSubject.type]}` : ""}
      >
        {detailSubject && (
          <div className="flex flex-col gap-md">
            <div className="grid grid-cols-2 gap-sm text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Grade range</p>
                <p className="text-foreground">{detailSubject.gradeRangeStart}–{detailSubject.gradeRangeEnd}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Max / passing marks</p>
                <p className="text-foreground">{detailSubject.maxMarks} / {detailSubject.passingMarks}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Weekly periods</p>
                <p className="text-foreground">{db.subjectAssignments.filter((a) => a.subjectId === detailSubject.id).reduce((sum, a) => sum + a.weeklyPeriods, 0)} total across all sections</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Lab requirement</p>
                <p className="text-foreground">
                  {detailSubject.type === "practical" ? (
                    <span className="flex items-center gap-1 text-warning">
                      <FlaskConical className="size-3.5" /> Requires a laboratory
                    </span>
                  ) : (
                    "Not required"
                  )}
                </p>
              </div>
            </div>

            <div>
              <div className="mb-xs flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Classes &amp; teachers</h3>
                {canManage && (
                  <Button size="sm" variant="outline" onClick={() => { openAssign(detailSubject); setDetailSubject(null); }}>
                    <UserPlus className="size-3.5" />
                    Assign
                  </Button>
                )}
              </div>
              <ul className="flex flex-col gap-1">
                {db.subjectAssignments
                  .filter((a) => a.subjectId === detailSubject.id)
                  .map((a) => (
                    <li key={a.id} className="flex items-center justify-between text-sm">
                      <span className="text-foreground">
                        {findClass(a.classId)?.name} · {a.weeklyPeriods} periods/wk
                      </span>
                      <span className="text-xs text-muted-foreground">{teacherById(a.primaryTeacherId)?.name}</span>
                    </li>
                  ))}
                {db.subjectAssignments.filter((a) => a.subjectId === detailSubject.id).length === 0 && (
                  <p className="text-sm text-muted-foreground">Not assigned to any class yet.</p>
                )}
              </ul>
            </div>

            <div>
              <h3 className="mb-xs text-sm font-semibold text-foreground">Curriculum progress</h3>
              {db.curriculumUnits.filter((u) => u.subjectId === detailSubject.id).length === 0 ? (
                <p className="text-sm text-muted-foreground">No curriculum tracked for this subject yet.</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {db.curriculumUnits
                    .filter((u) => u.subjectId === detailSubject.id)
                    .map((u) => (
                      <li key={u.id} className="flex items-center justify-between text-sm">
                        <span className="text-foreground">
                          {findClass(u.classId)?.name} — {u.title}
                        </span>
                        <Badge tone={progressStatusTone[u.status]}>{u.status.replace("-", " ")}</Badge>
                      </li>
                    ))}
                </ul>
              )}
            </div>

            <div>
              <h3 className="mb-xs text-sm font-semibold text-foreground">Recent activity</h3>
              <TimelineList
                events={[
                  ...db.lessonPlans
                    .filter((p) => p.subjectId === detailSubject.id)
                    .slice(0, 5)
                    .map((p) => ({ id: p.id, subjectId: p.id, category: "academic" as const, title: `Lesson plan ${p.status}`, actorName: teacherById(p.teacherId)?.name ?? "Teacher", createdAt: p.updatedAt })),
                  ...db.homework
                    .filter((h) => h.subjectId === detailSubject.id)
                    .slice(0, 5)
                    .map((h) => ({ id: h.id, subjectId: h.id, category: "academic" as const, title: `Homework "${h.title}" ${h.status}`, actorName: teacherById(h.teacherId)?.name ?? "Teacher", createdAt: h.updatedAt })),
                ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())}
                emptyMessage="No recent activity for this subject."
              />
            </div>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}
