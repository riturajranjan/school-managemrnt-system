"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { Plus } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef } from "@/components/data-table/types";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { TimelineList } from "@/components/timeline/timeline-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FieldError, Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { subjectTypeLabels, subjectTypeTone } from "@/components/academics/subjects/subject-meta";
import { usePermissions } from "@/components/providers/permissions-provider";
import { findClass } from "@/lib/data/seed/reference";
import { teacherById } from "@/lib/data/seed/academics";
import { useSisStore } from "@/lib/hooks/use-store";
import { subjectFormSchema, type SubjectFormValues } from "@/lib/schemas/academics-form";
import { createSubject } from "@/lib/services/subjects-service";
import { progressStatusTone, type Subject } from "@/lib/types/academics";

const subjectTypeOptions: Subject["type"][] = ["core", "elective", "optional", "practical", "language", "co-curricular"];

export default function SubjectsPage() {
  const db = useSisStore();
  const { can } = usePermissions();
  const [createOpen, setCreateOpen] = useState(false);
  const [detailSubject, setDetailSubject] = useState<Subject | null>(null);

  const form = useForm<SubjectFormValues>({
    resolver: zodResolver(subjectFormSchema),
    defaultValues: { type: "core", gradeRangeStart: 1, gradeRangeEnd: 10, credit: 4, passingMarks: 33, maxMarks: 100, theoryMarks: 100, practicalMarks: 0, color: "#18b0c8" },
  });

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
    { id: "maxMarks", header: "Max marks", cell: (s) => <span className="text-sm text-foreground">{s.maxMarks}</span>, defaultVisible: false },
    { id: "status", header: "Status", align: "right", cell: (s) => <Badge tone={s.status === "active" ? "success" : "neutral"}>{s.status}</Badge> },
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
        renderMobileCard={(s) => (
          <button
            type="button"
            onClick={() => setDetailSubject(s)}
            className="surface-3d flex w-full items-center gap-sm rounded-lg border border-border bg-surface p-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99]"
          >
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
          <Button type="submit">Create subject</Button>
        </form>
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
            </div>

            <div>
              <h3 className="mb-xs text-sm font-semibold text-foreground">Classes &amp; teachers</h3>
              <ul className="flex flex-col gap-1">
                {db.subjectAssignments
                  .filter((a) => a.subjectId === detailSubject.id)
                  .map((a) => (
                    <li key={a.id} className="flex items-center justify-between text-sm">
                      <span className="text-foreground">{findClass(a.classId)?.name}</span>
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
