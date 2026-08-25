"use client";

// Subjects (Phase 6) — same visual design as before (DataTable + create/edit/
// assign/detail drawers) now fully PostgreSQL/API-backed via /api/academics/
// subjects + /api/academics/classes/[id]/subjects. No mock store, no localStorage.
// Subject assignment is CLASS-level (sections inherit); teacher assignment,
// curriculum tracking and lesson-plan/homework activity depend on future modules
// (Staff, Curriculum, Timetable) and show honest deferred states rather than mock.
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, type UseFormReturn } from "react-hook-form";
import { Archive, ArchiveRestore, Copy, Eye, FlaskConical, MoreHorizontal, PencilLine, Plus, Trash2, UserPlus } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef, RowAction } from "@/components/data-table/types";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { FieldError, Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { subjectTypeLabels, subjectTypeTone } from "@/components/academics/subjects/subject-meta";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { roleLabels } from "@/lib/permissions/roles";
import { useClasses } from "@/lib/hooks/api/use-academics-foundation";
import {
  assignClassSubjectRequest,
  createSubjectRequest,
  duplicateSubjectRequest,
  removeClassSubjectRequest,
  setSubjectStatusRequest,
  updateSubjectRequest,
  useSubjectClasses,
  useSubjects,
} from "@/lib/hooks/api/use-academics-subjects";
import { subjectFormSchema, type SubjectFormValues } from "@/lib/schemas/academics-form";
import type { SubjectDto, SubjectType } from "@/lib/api/contracts";

const subjectTypeOptions: SubjectType[] = ["core", "elective", "optional", "practical", "language", "co-curricular"];

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
          <FieldError>{form.formState.errors.code?.message}</FieldError>
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
  const { data: subjects, loading, error, reload } = useSubjects();
  const { can, hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const canManage = can("academics.manageSubjects");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailSubject, setDetailSubject] = useState<SubjectDto | null>(null);
  const [editSubject, setEditSubject] = useState<SubjectDto | null>(null);
  const [assignSubject, setAssignSubject] = useState<SubjectDto | null>(null);
  const [formError, setFormError] = useState("");

  const form = useForm<SubjectFormValues>({
    resolver: zodResolver(subjectFormSchema),
    defaultValues: { type: "core", gradeRangeStart: 1, gradeRangeEnd: 10, credit: 4, passingMarks: 33, maxMarks: 100, theoryMarks: 100, practicalMarks: 0, color: "#18b0c8" },
  });
  const editForm = useForm<SubjectFormValues>({ resolver: zodResolver(subjectFormSchema) });

  if (!capabilitiesLoading && !hasServerPermission("academics.view")) {
    return <PermissionDenied action="view subjects" role={roleLabels[role]} backHref="/academics" />;
  }

  function openEdit(subject: SubjectDto) {
    setEditSubject(subject);
    editForm.reset(subject);
  }
  async function archive(subject: SubjectDto, status: "active" | "inactive") {
    const res = await setSubjectStatusRequest(subject.id, status);
    if (res.success) reload();
  }
  async function duplicate(subject: SubjectDto) {
    const res = await duplicateSubjectRequest(subject.id);
    if (res.success) reload();
  }

  const columns: ColumnDef<SubjectDto>[] = [
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
      cell: (s) => <span className="text-sm text-foreground">{s.classCount}</span>,
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

  const rowActions: RowAction<SubjectDto>[] = [
    { key: "view", label: "View", icon: <Eye className="size-3.5" />, onSelect: setDetailSubject },
    ...(canManage
      ? [
          { key: "edit", label: "Edit", icon: <PencilLine className="size-3.5" />, onSelect: openEdit },
          { key: "assign-classes", label: "Assign to class", icon: <UserPlus className="size-3.5" />, onSelect: (s: SubjectDto) => setAssignSubject(s) },
          { key: "duplicate", label: "Duplicate", icon: <Copy className="size-3.5" />, onSelect: (s: SubjectDto) => void duplicate(s) },
          {
            key: "archive",
            label: "Archive",
            icon: <Archive className="size-3.5" />,
            hidden: (s: SubjectDto) => s.status !== "active",
            destructive: true,
            onSelect: (s: SubjectDto) => void archive(s, "inactive"),
          },
          {
            key: "restore",
            label: "Restore",
            icon: <ArchiveRestore className="size-3.5" />,
            hidden: (s: SubjectDto) => s.status !== "inactive",
            onSelect: (s: SubjectDto) => void archive(s, "active"),
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
        {canManage && (
          <Button size="sm" onClick={() => { setFormError(""); form.reset({ type: "core", gradeRangeStart: 1, gradeRangeEnd: 10, credit: 4, passingMarks: 33, maxMarks: 100, theoryMarks: 100, practicalMarks: 0, color: "#18b0c8" }); setCreateOpen(true); }}>
            <Plus className="size-3.5" />
            Add subject
          </Button>
        )}
      </div>

      {error && !loading && <p className="rounded-lg border border-dashed border-error/40 p-md text-center text-sm text-error">Could not load subjects: {error}</p>}
      {loading && <p className="py-2xl text-center text-sm text-muted-foreground">Loading subjects…</p>}

      {!loading && !error && (
        <DataTable
          columns={columns}
          rows={subjects}
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
      )}

      <DetailDrawer open={createOpen} onOpenChange={setCreateOpen} title="Add subject" description="Define a new subject in the catalogue">
        <form
          onSubmit={form.handleSubmit(async (values) => {
            setFormError("");
            const res = await createSubjectRequest(values);
            if (!res.success) { setFormError(res.error.message); return; }
            setCreateOpen(false);
            form.reset();
            reload();
          })}
          className="flex flex-col gap-sm"
        >
          {formError && <p className="text-xs text-error">{formError}</p>}
          <SubjectFormFields form={form} />
          <Button type="submit">Create subject</Button>
        </form>
      </DetailDrawer>

      <DetailDrawer open={editSubject !== null} onOpenChange={(open) => !open && setEditSubject(null)} title={`Edit ${editSubject?.name ?? ""}`} description="Update this subject's details">
        <form
          onSubmit={editForm.handleSubmit(async (values) => {
            if (!editSubject) return;
            setFormError("");
            const res = await updateSubjectRequest(editSubject.id, values);
            if (!res.success) { setFormError(res.error.message); return; }
            setEditSubject(null);
            reload();
          })}
          className="flex flex-col gap-sm"
        >
          {formError && <p className="text-xs text-error">{formError}</p>}
          <SubjectFormFields form={editForm} />
          <Button type="submit">Save changes</Button>
        </form>
      </DetailDrawer>

      <AssignClassDrawer subject={assignSubject} onClose={() => setAssignSubject(null)} onAssigned={reload} />

      <SubjectDetailDrawer
        subject={detailSubject}
        canManage={canManage}
        onClose={() => setDetailSubject(null)}
        onAssign={(s) => { setDetailSubject(null); setAssignSubject(s); }}
        onChanged={reload}
      />
    </div>
  );
}

/** Assign a subject to a class (class-level; sections inherit). Real ClassSubject. */
function AssignClassDrawer({ subject, onClose, onAssigned }: { subject: SubjectDto | null; onClose: () => void; onAssigned: () => void }) {
  const { data: classes } = useClasses();
  const [classId, setClassId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function assign() {
    if (!subject || !classId) { setError("Select a class."); return; }
    setBusy(true); setError("");
    const res = await assignClassSubjectRequest(classId, subject.id);
    setBusy(false);
    if (!res.success) { setError(res.error.message); return; }
    setClassId(""); onAssigned(); onClose();
  }

  return (
    <DetailDrawer open={subject !== null} onOpenChange={(open) => { if (!open) { setClassId(""); setError(""); onClose(); } }} title={`Assign — ${subject?.name ?? ""}`} description="Add this subject to a class. All sections of the class inherit it.">
      <div className="flex flex-col gap-sm">
        {error && <p className="text-xs text-error">{error}</p>}
        <div>
          <Label>Class</Label>
          <Select value={classId} onValueChange={setClassId}>
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
        <p className="text-xs text-muted-foreground">
          Teacher assignment and weekly periods arrive with the Staff and Timetable modules.
        </p>
        <Button disabled={busy || !classId} onClick={() => void assign()}>
          Assign
        </Button>
      </div>
    </DetailDrawer>
  );
}

function SubjectDetailDrawer({ subject, canManage, onClose, onAssign, onChanged }: { subject: SubjectDto | null; canManage: boolean; onClose: () => void; onAssign: (s: SubjectDto) => void; onChanged: () => void }) {
  const { data: assignedClasses, loading, reload } = useSubjectClasses(subject?.id);
  const rows = assignedClasses ?? [];

  async function remove(assignmentId: string, classId: string) {
    const res = await removeClassSubjectRequest(classId, assignmentId);
    if (res.success) { reload(); onChanged(); }
  }

  return (
    <DetailDrawer
      open={subject !== null}
      onOpenChange={(open) => !open && onClose()}
      title={subject?.name ?? ""}
      description={subject ? `${subject.code} · ${subjectTypeLabels[subject.type]}` : ""}
    >
      {subject && (
        <div className="flex flex-col gap-md">
          <div className="grid grid-cols-2 gap-sm text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Grade range</p>
              <p className="text-foreground">{subject.gradeRangeStart}–{subject.gradeRangeEnd}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Max / passing marks</p>
              <p className="text-foreground">{subject.maxMarks} / {subject.passingMarks}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Department</p>
              <p className="text-foreground">{subject.department}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Lab requirement</p>
              <p className="text-foreground">
                {subject.type === "practical" ? (
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
              <h3 className="text-sm font-semibold text-foreground">Classes</h3>
              {canManage && (
                <Button size="sm" variant="outline" onClick={() => onAssign(subject)}>
                  <UserPlus className="size-3.5" />
                  Assign
                </Button>
              )}
            </div>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">Not assigned to any class yet.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {rows.map((a) => (
                  <li key={a.id} className="flex items-center justify-between text-sm">
                    <span className="text-foreground">{a.className}</span>
                    {canManage && (
                      <Button size="sm" variant="ghost" className="text-error" onClick={() => void remove(a.id, a.classId)} aria-label={`Remove from ${a.className}`}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h3 className="mb-xs text-sm font-semibold text-foreground">Curriculum &amp; activity</h3>
            <p className="rounded-lg border border-dashed border-border p-sm text-center text-xs text-muted-foreground">
              Curriculum tracking, lesson plans and homework activity arrive with their respective modules.
            </p>
          </div>
        </div>
      )}
    </DetailDrawer>
  );
}
