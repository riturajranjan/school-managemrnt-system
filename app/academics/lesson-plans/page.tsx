"use client";

import { Suspense, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { Sparkles } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef } from "@/components/data-table/types";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { FilterBar } from "@/components/filters/filter-bar";
import type { FilterFieldConfig } from "@/components/filters/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FieldError, Label } from "@/components/ui/label";
import { Input, Textarea } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermissions } from "@/components/providers/permissions-provider";
import { findClass, findSection, schoolClasses } from "@/lib/data/seed/reference";
import { teacherById } from "@/lib/data/seed/academics";
import { useManagedClasses, useSubjects } from "@/lib/hooks/use-academics";
import { useSisStore } from "@/lib/hooks/use-store";
import { useUrlFilters } from "@/lib/hooks/use-url-filters";
import { lessonPlanFormSchema, type LessonPlanFormValues } from "@/lib/schemas/academics-form";
import {
  approveLessonPlan,
  createLessonPlan,
  duplicateLessonPlan,
  generateAiLessonPlanDraft,
  markLessonPlanCompleted,
  rejectLessonPlan,
  submitForApproval,
} from "@/lib/services/lesson-plan-service";
import { lessonPlanStatusTone, type LessonPlan } from "@/lib/types/academics";
import { formatDate } from "@/lib/utils";

const FILTER_DEFAULTS = { q: "", status: [] as string[], subject: [] as string[] };

function LessonPlansPageContent() {
  const db = useSisStore();
  const { can } = usePermissions();
  const classes = useManagedClasses();
  const subjects = useSubjects();
  const { filters, setFilters, clearAll } = useUrlFilters(FILTER_DEFAULTS);
  const [createOpen, setCreateOpen] = useState(false);
  const [detail, setDetail] = useState<LessonPlan | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const filtered = useMemo(() => {
    return db.lessonPlans.filter((p) => {
      if (filters.status.length > 0 && !filters.status.includes(p.status)) return false;
      if (filters.subject.length > 0 && !filters.subject.includes(p.subjectId)) return false;
      if (filters.q) {
        const teacher = teacherById(p.teacherId)?.name ?? "";
        const haystack = `${teacher} ${p.learningObjective}`.toLowerCase();
        if (!haystack.includes(filters.q.toLowerCase())) return false;
      }
      return true;
    });
  }, [db.lessonPlans, filters]);

  const filterFields: FilterFieldConfig[] = [
    {
      type: "multi-select",
      key: "status",
      label: "Status",
      options: ["draft", "submitted", "approved", "rejected", "scheduled", "completed", "missed", "rescheduled"].map((s) => ({ value: s, label: s })),
    },
    { type: "multi-select", key: "subject", label: "Subject", options: subjects.map((s) => ({ value: s.id, label: s.name })) },
  ];

  const columns: ColumnDef<LessonPlan>[] = [
    {
      id: "date",
      header: "Date",
      alwaysVisible: true,
      sortValue: (p) => new Date(p.date).getTime(),
      cell: (p) => (
        <div>
          <p className="text-sm font-medium text-foreground">{formatDate(p.date)}</p>
          <p className="text-xs text-muted-foreground">Period {p.period}</p>
        </div>
      ),
    },
    { id: "class", header: "Class", cell: (p) => <span className="text-sm text-foreground">{findClass(p.classId)?.name}-{findSection(p.sectionId)?.section.name}</span> },
    { id: "subject", header: "Subject", cell: (p) => <span className="text-sm text-foreground">{subjects.find((s) => s.id === p.subjectId)?.name}</span> },
    { id: "teacher", header: "Teacher", cell: (p) => <span className="text-sm text-muted-foreground">{teacherById(p.teacherId)?.name}</span> },
    { id: "objective", header: "Objective", cell: (p) => <span className="line-clamp-1 text-xs text-muted-foreground">{p.learningObjective}</span>, defaultVisible: false },
    { id: "status", header: "Status", align: "right", cell: (p) => <Badge tone={lessonPlanStatusTone[p.status]}>{p.status}</Badge> },
  ];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Lesson plans</h1>
          <p className="text-xs text-muted-foreground">Teacher planning, review and approval</p>
        </div>
        {can("lessonPlans.create") && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Sparkles className="size-3.5" />
            New lesson plan
          </Button>
        )}
      </div>

      <FilterBar
        searchValue={filters.q}
        onSearchChange={(q) => setFilters({ q })}
        searchPlaceholder="Search by teacher or objective…"
        fields={filterFields}
        values={filters}
        onChange={(key, value) => setFilters({ [key]: value })}
        onClearAll={clearAll}
      />

      <DataTable
        columns={columns}
        rows={filtered}
        getRowId={(p) => p.id}
        caption="Lesson plans"
        onRowClick={setDetail}
        renderMobileCard={(p) => (
          <button
            type="button"
            onClick={() => setDetail(p)}
            className="surface-3d flex w-full flex-col gap-1 rounded-lg border border-border bg-surface p-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99]"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">{subjects.find((s) => s.id === p.subjectId)?.name}</p>
              <Badge tone={lessonPlanStatusTone[p.status]}>{p.status}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {findClass(p.classId)?.name}-{findSection(p.sectionId)?.section.name} · {formatDate(p.date)} · P{p.period}
            </p>
            <p className="line-clamp-1 text-xs text-muted-foreground">{p.learningObjective}</p>
          </button>
        )}
        isFiltered={filters.q.length > 0 || filters.status.length > 0 || filters.subject.length > 0}
        emptyTitle="No lesson plans yet"
      />

      <CreateLessonPlanDrawer open={createOpen} onOpenChange={setCreateOpen} classes={classes} subjects={subjects} />

      <DetailDrawer open={detail !== null} onOpenChange={(open) => !open && setDetail(null)} title="Lesson plan" description={detail ? `${formatDate(detail.date)} · Period ${detail.period}` : ""}>
        {detail && (
          <div className="flex flex-col gap-md">
            <Badge tone={lessonPlanStatusTone[detail.status]} className="self-start">
              {detail.status}
            </Badge>
            <Field label="Class / Section" value={`${findClass(detail.classId)?.name}-${findSection(detail.sectionId)?.section.name}`} />
            <Field label="Subject" value={subjects.find((s) => s.id === detail.subjectId)?.name} />
            <Field label="Teacher" value={teacherById(detail.teacherId)?.name} />
            <Field label="Learning objective" value={detail.learningObjective} />
            <Field label="Teaching method" value={detail.teachingMethod} />
            <Field label="Materials" value={detail.materials} />
            <Field label="Activity" value={detail.activity} />
            {detail.homework && <Field label="Homework" value={detail.homework} />}
            {detail.assessmentMethod && <Field label="Assessment" value={detail.assessmentMethod} />}
            {detail.differentiationPlan && <Field label="Differentiation" value={detail.differentiationPlan} />}
            {detail.reviewComment && <Field label="Reviewer comment" value={detail.reviewComment} />}

            <div className="flex flex-wrap gap-xs border-t border-border pt-sm">
              {detail.status === "draft" && can("lessonPlans.create") && (
                <Button size="sm" onClick={() => { submitForApproval(detail.id); setDetail(null); }}>
                  Submit for approval
                </Button>
              )}
              {detail.status === "submitted" && can("lessonPlans.approve") && (
                <>
                  <Button size="sm" onClick={() => { approveLessonPlan(detail.id, "Academic Coordinator"); setDetail(null); }}>
                    Approve
                  </Button>
                  <Button size="sm" variant="outline" className="text-error" onClick={() => setRejectReason(" ")}>
                    Reject
                  </Button>
                </>
              )}
              {(detail.status === "approved" || detail.status === "scheduled") && can("lessonPlans.create") && (
                <Button size="sm" variant="outline" onClick={() => { markLessonPlanCompleted(detail.id); setDetail(null); }}>
                  Mark completed
                </Button>
              )}
              {can("lessonPlans.create") && (
                <Button size="sm" variant="ghost" onClick={() => { duplicateLessonPlan(detail.id, new Date().toISOString()); setDetail(null); }}>
                  Duplicate
                </Button>
              )}
            </div>

            {rejectReason !== "" && (
              <div className="flex flex-col gap-xs">
                <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Reason for rejection…" rows={3} />
                <Button
                  size="sm"
                  variant="destructive"
                  className="self-start"
                  onClick={() => {
                    rejectLessonPlan(detail.id, "Academic Coordinator", rejectReason.trim() || "Please revise and resubmit.");
                    setRejectReason("");
                    setDetail(null);
                  }}
                >
                  Confirm rejection
                </Button>
              </div>
            )}
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}

export default function LessonPlansPage() {
  return (
    <Suspense fallback={<div className="h-40" />}>
      <LessonPlansPageContent />
    </Suspense>
  );
}

function Field({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground">{value}</p>
    </div>
  );
}

function CreateLessonPlanDrawer({
  open,
  onOpenChange,
  classes,
  subjects,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classes: ReturnType<typeof useManagedClasses>;
  subjects: ReturnType<typeof useSubjects>;
}) {
  const [aiTopic, setAiTopic] = useState("");
  const form = useForm<LessonPlanFormValues>({
    resolver: zodResolver(lessonPlanFormSchema),
    defaultValues: { period: 1, date: new Date().toISOString().slice(0, 10) },
  });
  const classId = form.watch("classId");
  const subjectId = form.watch("subjectId");
  const sections = schoolClasses.find((c) => c.id === classId)?.sections ?? [];

  function applyAiDraft() {
    const subjectName = subjects.find((s) => s.id === subjectId)?.name ?? "the subject";
    const draft = generateAiLessonPlanDraft(subjectName, aiTopic || "today's topic");
    form.setValue("learningObjective", draft.learningObjective);
    form.setValue("activity", draft.activity);
    form.setValue("homework", draft.homework);
    form.setValue("assessmentMethod", draft.assessmentMethod);
    form.setValue("differentiationPlan", draft.differentiationPlan);
    form.setValue("materials", draft.materials);
  }

  return (
    <DetailDrawer open={open} onOpenChange={onOpenChange} title="New lesson plan" description="Draft a plan manually or generate a starting point with AI assist">
      <form
        onSubmit={form.handleSubmit((values) => {
          createLessonPlan({ ...values, teacherId: "teacher-1" });
          onOpenChange(false);
          form.reset();
        })}
        className="flex flex-col gap-sm"
      >
        <div className="grid grid-cols-2 gap-sm">
          <div>
            <Label>Class</Label>
            <Controller
              control={form.control}
              name="classId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={(v) => { field.onChange(v); form.setValue("sectionId", ""); }}>
                  <SelectTrigger aria-label="Class">
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
              )}
            />
          </div>
          <div>
            <Label>Section</Label>
            <Controller
              control={form.control}
              name="sectionId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger aria-label="Section">
                    <SelectValue placeholder="Section" />
                  </SelectTrigger>
                  <SelectContent>
                    {sections.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>
        <div>
          <Label>Subject</Label>
          <Controller
            control={form.control}
            name="subjectId"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger aria-label="Subject">
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
            )}
          />
        </div>
        <div className="grid grid-cols-2 gap-sm">
          <div>
            <Label htmlFor="lp-date">Date</Label>
            <Input id="lp-date" type="date" {...form.register("date")} />
          </div>
          <div>
            <Label htmlFor="lp-period">Period</Label>
            <Input id="lp-period" type="number" min={1} max={10} {...form.register("period", { valueAsNumber: true })} />
          </div>
        </div>

        <div className="flex items-end gap-xs rounded-md border border-dashed border-border p-sm">
          <div className="flex-1">
            <Label htmlFor="ai-topic">AI assist — topic</Label>
            <Input id="ai-topic" value={aiTopic} onChange={(e) => setAiTopic(e.target.value)} placeholder="e.g. Fractions" />
          </div>
          <Button type="button" variant="outline" onClick={applyAiDraft}>
            <Sparkles className="size-3.5" />
            Generate
          </Button>
        </div>

        <div>
          <Label htmlFor="lp-objective">Learning objective</Label>
          <Textarea id="lp-objective" rows={2} {...form.register("learningObjective")} />
          <FieldError>{form.formState.errors.learningObjective?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="lp-method">Teaching method</Label>
          <Input id="lp-method" {...form.register("teachingMethod")} />
          <FieldError>{form.formState.errors.teachingMethod?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="lp-materials">Materials</Label>
          <Input id="lp-materials" {...form.register("materials")} />
        </div>
        <div>
          <Label htmlFor="lp-activity">Activity</Label>
          <Textarea id="lp-activity" rows={2} {...form.register("activity")} />
        </div>
        <div>
          <Label htmlFor="lp-homework">Homework</Label>
          <Input id="lp-homework" {...form.register("homework")} />
        </div>
        <div>
          <Label htmlFor="lp-assessment">Assessment method</Label>
          <Input id="lp-assessment" {...form.register("assessmentMethod")} />
        </div>
        <div>
          <Label htmlFor="lp-differentiation">Differentiation plan</Label>
          <Textarea id="lp-differentiation" rows={2} {...form.register("differentiationPlan")} />
        </div>

        <Button type="submit">Save as draft</Button>
      </form>
    </DetailDrawer>
  );
}
