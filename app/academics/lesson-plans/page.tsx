"use client";

// Lesson plans (Phase 9C.2) — real PostgreSQL/API cutover. Layout, table,
// filters and drawer preserved from the mock version; data source swapped to
// /api/lesson-plans/*. Class/Section/Subject selectors in the create form
// replaced with a single "real TeachingAssignment" picker (mirrors Homework's
// create form exactly — CREATE requires the actor's own real assignment, so
// an arbitrary Class->Section->Subject cascade would let someone request a
// combination they don't actually teach). "AI assist" stays honestly
// disabled — no simulated generation (see lib/services/lesson-plan-service.ts's
// old generateAiLessonPlanDraft, not used here). "Differentiation plan" (no
// real field) dropped from the drawer.
import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
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
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { roleLabels } from "@/lib/permissions/roles";
import { useAssignableTeaching } from "@/lib/hooks/api/use-homework-api";
import { useAssignableCurriculumTopics, useLessonPlan, useLessonPlanList } from "@/lib/hooks/api/use-lesson-plans-api";
import { useSubjects } from "@/lib/hooks/api/use-academics-subjects";
import { useUrlFilters } from "@/lib/hooks/use-url-filters";
import {
  approveLessonPlanRequest, createLessonPlanRequest, completeLessonPlanRequest, duplicateLessonPlanRequest,
  rejectLessonPlanRequest, submitLessonPlanRequest,
} from "@/lib/hooks/api/use-lesson-plans-api";
import type { LessonPlanListItemDto, LessonPlanStatusDto } from "@/lib/api/contracts";
import { formatDate } from "@/lib/utils";

const FILTER_DEFAULTS = { q: "", status: [] as string[], subject: [] as string[] };
const statusTone: Record<LessonPlanStatusDto, "neutral" | "info" | "success" | "error"> = { draft: "neutral", submitted: "info", approved: "success", rejected: "error", completed: "success" };

function LessonPlansPageContent() {
  const { can, hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { filters, setFilters, clearAll } = useUrlFilters(FILTER_DEFAULTS);
  const { data: subjects } = useSubjects();
  const { data: plans, loading, error, reload } = useLessonPlanList({ status: filters.status[0], subjectId: filters.subject[0], search: filters.q || undefined });
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const { data: detailFull } = useLessonPlan(detailId ?? undefined);
  const [rejectReason, setRejectReason] = useState("");

  function closeDetail() {
    setDetailId(null);
    setRejectReason("");
  }
  async function afterAction() {
    closeDetail();
    reload();
  }

  if (!capabilitiesLoading && !hasServerPermission("lessonPlans.view")) {
    return <PermissionDenied action="view lesson plans" role={roleLabels[role]} backHref="/academics" />;
  }

  const filterFields: FilterFieldConfig[] = [
    { type: "multi-select", key: "status", label: "Status", options: ["draft", "submitted", "approved", "rejected", "completed"].map((s) => ({ value: s, label: s })) },
    { type: "multi-select", key: "subject", label: "Subject", options: subjects.map((s) => ({ value: s.id, label: s.name })) },
  ];

  const columns: ColumnDef<LessonPlanListItemDto>[] = [
    {
      id: "date", header: "Date", alwaysVisible: true, sortValue: (p) => new Date(p.plannedDate).getTime(),
      cell: (p) => (
        <div>
          <p className="text-sm font-medium text-foreground">{formatDate(p.plannedDate)}</p>
          {p.period && <p className="text-xs text-muted-foreground">Period {p.period}</p>}
        </div>
      ),
    },
    { id: "class", header: "Class", cell: (p) => <span className="text-sm text-foreground">{p.section.className}-{p.section.name}</span> },
    { id: "subject", header: "Subject", cell: (p) => <span className="text-sm text-foreground">{p.subject.name}</span> },
    { id: "teacher", header: "Teacher", cell: (p) => <span className="text-sm text-muted-foreground">{p.teacher.name}</span> },
    { id: "objective", header: "Objective", cell: (p) => <span className="line-clamp-1 text-xs text-muted-foreground">{p.learningObjective}</span>, defaultVisible: false },
    { id: "status", header: "Status", align: "right", cell: (p) => <Badge tone={statusTone[p.status]}>{p.status}</Badge> },
  ];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Lesson plans</h1>
          <p className="text-xs text-muted-foreground">Teacher planning, review and approval</p>
        </div>
        {can("lessonPlans.manage") && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Sparkles className="size-3.5" />
            New lesson plan
          </Button>
        )}
      </div>

      <FilterBar
        searchValue={filters.q}
        onSearchChange={(q) => setFilters({ q })}
        searchPlaceholder="Search by objective…"
        fields={filterFields}
        values={filters}
        onChange={(key, value) => setFilters({ [key]: value })}
        onClearAll={clearAll}
      />

      {error ? (
        <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">{error}</p>
      ) : (
        <DataTable
          columns={columns}
          rows={plans}
          getRowId={(p) => p.id}
          caption="Lesson plans"
          onRowClick={(p) => setDetailId(p.id)}
          renderMobileCard={(p) => (
            <button
              type="button"
              onClick={() => setDetailId(p.id)}
              className="surface-3d flex w-full flex-col gap-1 rounded-lg border border-border bg-surface p-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99]"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">{p.subject.name}</p>
                <Badge tone={statusTone[p.status]}>{p.status}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {p.section.className}-{p.section.name} · {formatDate(p.plannedDate)}{p.period ? ` · P${p.period}` : ""}
              </p>
              <p className="line-clamp-1 text-xs text-muted-foreground">{p.learningObjective}</p>
            </button>
          )}
          isFiltered={filters.q.length > 0 || filters.status.length > 0 || filters.subject.length > 0}
          emptyTitle={loading ? "Loading…" : "No lesson plans yet"}
        />
      )}

      <CreateLessonPlanDrawer open={createOpen} onOpenChange={setCreateOpen} onCreated={reload} />

      <DetailDrawer open={detailId !== null} onOpenChange={(open) => !open && closeDetail()} title="Lesson plan" description={detailFull ? `${formatDate(detailFull.plannedDate)}${detailFull.period ? ` · Period ${detailFull.period}` : ""}` : ""}>
        {detailFull && (
          <div className="flex flex-col gap-md">
            <Badge tone={statusTone[detailFull.status]} className="self-start">{detailFull.status}</Badge>
            <Field label="Class / Section" value={`${detailFull.section.className}-${detailFull.section.name}`} />
            <Field label="Subject" value={detailFull.subject.name} />
            <Field label="Teacher" value={detailFull.teacher.name} />
            <Field label="Learning objective" value={detailFull.learningObjective} />
            <Field label="Teaching method" value={detailFull.teachingMethod} />
            {detailFull.materials && <Field label="Materials" value={detailFull.materials} />}
            {detailFull.activity && <Field label="Activity" value={detailFull.activity} />}
            {detailFull.homeworkNote && <Field label="Homework" value={detailFull.homeworkNote} />}
            {detailFull.assessmentMethod && <Field label="Assessment" value={detailFull.assessmentMethod} />}
            {detailFull.topics.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground">Syllabus topics</p>
                <ul className="mt-1 flex flex-col gap-0.5 text-sm text-foreground">
                  {detailFull.topics.map((t) => (
                    <li key={t.id}>· {t.title} <span className="text-xs text-muted-foreground">({t.unitTitle} — {t.chapterTitle})</span></li>
                  ))}
                </ul>
              </div>
            )}
            {detailFull.reviewComment && <Field label="Reviewer comment" value={detailFull.reviewComment} />}

            <div className="flex flex-wrap gap-xs border-t border-border pt-sm">
              {detailFull.status === "draft" && can("lessonPlans.manage") && (
                <Button size="sm" onClick={async () => { await submitLessonPlanRequest(detailFull.id); afterAction(); }}>Submit for approval</Button>
              )}
              {detailFull.status === "submitted" && can("lessonPlans.manage") && (
                <>
                  <Button size="sm" onClick={async () => { await approveLessonPlanRequest(detailFull.id); afterAction(); }}>Approve</Button>
                  <Button size="sm" variant="outline" className="text-error" onClick={() => setRejectReason(" ")}>Reject</Button>
                </>
              )}
              {detailFull.status === "approved" && can("lessonPlans.manage") && (
                <Button size="sm" variant="outline" onClick={async () => { await completeLessonPlanRequest(detailFull.id); afterAction(); }}>Mark completed</Button>
              )}
              {can("lessonPlans.manage") && (
                <Button size="sm" variant="ghost" onClick={async () => { await duplicateLessonPlanRequest(detailFull.id, new Date().toISOString().slice(0, 10)); afterAction(); }}>Duplicate</Button>
              )}
            </div>

            {rejectReason !== "" && (
              <div className="flex flex-col gap-xs">
                <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Reason for rejection…" rows={3} />
                <Button
                  size="sm" variant="destructive" className="self-start"
                  onClick={async () => { await rejectLessonPlanRequest(detailFull.id, rejectReason.trim() || "Please revise and resubmit."); afterAction(); }}
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

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground">{value}</p>
    </div>
  );
}

const lessonPlanFieldsSchema = {
  required: (v: string) => v.trim().length > 0,
};

function CreateLessonPlanDrawer({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; onCreated: () => void }) {
  const { data: assignable } = useAssignableTeaching();
  const [assignmentKey, setAssignmentKey] = useState("");
  const [selected] = assignable.filter((a) => `${a.section.id}:${a.subject.id}` === assignmentKey);
  const { data: topics } = useAssignableCurriculumTopics(selected?.section.id, selected?.subject.id);
  const [topicIds, setTopicIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<{ title: string; learningObjective: string; teachingMethod: string; materials: string; activity: string; homeworkNote: string; assessmentMethod: string; plannedDate: string; period: number }>({
    defaultValues: { plannedDate: new Date().toISOString().slice(0, 10), period: 1 },
  });

  function toggleTopic(id: string) {
    setTopicIds((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  }

  return (
    <DetailDrawer open={open} onOpenChange={onOpenChange} title="New lesson plan" description="Draft a plan for one of your real teaching assignments">
      <form
        onSubmit={form.handleSubmit(async (values) => {
          if (!selected || !lessonPlanFieldsSchema.required(values.title) || !lessonPlanFieldsSchema.required(values.learningObjective) || !lessonPlanFieldsSchema.required(values.teachingMethod)) return;
          setSubmitting(true);
          const result = await createLessonPlanRequest({
            sectionId: selected.section.id, subjectId: selected.subject.id, title: values.title, learningObjective: values.learningObjective,
            teachingMethod: values.teachingMethod, materials: values.materials || undefined, activity: values.activity || undefined,
            homeworkNote: values.homeworkNote || undefined, assessmentMethod: values.assessmentMethod || undefined,
            plannedDate: values.plannedDate, period: values.period || undefined, topicIds: topicIds.length ? topicIds : undefined,
          });
          setSubmitting(false);
          if (result.success) {
            onOpenChange(false);
            form.reset();
            setTopicIds([]);
            setAssignmentKey("");
            onCreated();
          }
        })}
        className="flex flex-col gap-sm"
      >
        <div>
          <Label>Class / section · subject</Label>
          <Select value={assignmentKey} onValueChange={setAssignmentKey}>
            <SelectTrigger aria-label="Class / section · subject">
              <SelectValue placeholder="Select your teaching assignment" />
            </SelectTrigger>
            <SelectContent>
              {assignable.map((a) => (
                <SelectItem key={`${a.section.id}:${a.subject.id}`} value={`${a.section.id}:${a.subject.id}`}>
                  {a.section.className}-{a.section.name} · {a.subject.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {assignable.length === 0 && <p className="mt-1 text-xs text-muted-foreground">No real teaching assignments found for your account.</p>}
        </div>

        <div className="grid grid-cols-2 gap-sm">
          <div>
            <Label htmlFor="lp-date">Date</Label>
            <Input id="lp-date" type="date" {...form.register("plannedDate")} />
          </div>
          <div>
            <Label htmlFor="lp-period">Period</Label>
            <Input id="lp-period" type="number" min={1} max={12} {...form.register("period", { valueAsNumber: true })} />
          </div>
        </div>

        <div className="flex items-end gap-xs rounded-md border border-dashed border-border p-sm text-xs text-muted-foreground">
          <div className="flex-1">
            <Label>AI assist</Label>
            <p>AI lesson-plan generation is not configured yet.</p>
          </div>
          <Button type="button" variant="outline" disabled>
            <Sparkles className="size-3.5" />
            Generate
          </Button>
        </div>

        {selected && topics && topics.length > 0 && (
          <div>
            <Label>Syllabus topics (optional)</Label>
            <div className="flex flex-col gap-1 rounded-md border border-border p-sm">
              {topics.map((t) => (
                <label key={t.id} className="flex items-center gap-2 text-sm text-foreground">
                  <input type="checkbox" checked={topicIds.includes(t.id)} onChange={() => toggleTopic(t.id)} />
                  {t.title} <span className="text-xs text-muted-foreground">({t.unitTitle} — {t.chapterTitle})</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div>
          <Label htmlFor="lp-title">Title</Label>
          <Input id="lp-title" {...form.register("title")} />
          <FieldError>{!form.watch("title")?.trim() && form.formState.isSubmitted ? "Required" : undefined}</FieldError>
        </div>
        <div>
          <Label htmlFor="lp-objective">Learning objective</Label>
          <Textarea id="lp-objective" rows={2} {...form.register("learningObjective")} />
        </div>
        <div>
          <Label htmlFor="lp-method">Teaching method</Label>
          <Input id="lp-method" {...form.register("teachingMethod")} />
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
          <Input id="lp-homework" {...form.register("homeworkNote")} />
        </div>
        <div>
          <Label htmlFor="lp-assessment">Assessment method</Label>
          <Input id="lp-assessment" {...form.register("assessmentMethod")} />
        </div>

        <Button type="submit" disabled={!selected || submitting}>Save as draft</Button>
      </form>
    </DetailDrawer>
  );
}
