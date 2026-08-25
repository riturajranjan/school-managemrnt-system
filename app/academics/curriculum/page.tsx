"use client";

// Curriculum & syllabus tracking (Phase 9C.1) — real PostgreSQL/API cutover.
// Content (Curriculum -> Unit -> Chapter -> Topic) is real, authored once per
// real Class+Subject; progress is real, tracked per real Section via
// CurriculumTopicProgress — never a persisted/fabricated percentage. Layout,
// stat tiles and the Learning Path Timeline preserved from the mock version;
// "Notes" (no backing model) removed, a Section selector and minimal
// create-content affordances added since real schools need a real way to
// create curriculum, not just seed data.
import { useState } from "react";
import { AlertTriangle, BookOpenCheck, Plus, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatTile } from "@/components/ui/stat-tile";
import { LearningPathTimeline } from "@/components/academics/curriculum/learning-path-timeline";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { roleLabels } from "@/lib/permissions/roles";
import { useClasses, useSections } from "@/lib/hooks/api/use-academics-foundation";
import { useClassSubjects } from "@/lib/hooks/api/use-academics-subjects";
import { createCurriculumRequest, useCurriculum, useCurriculumInsights, useCurriculumList, useSectionCurriculum } from "@/lib/hooks/api/use-curriculum-api";

export default function CurriculumPage() {
  const { can, role, hasServerPermission, capabilitiesLoading } = usePermissions();
  // Content authoring (create curriculum, reschedule a unit) is a broad-manager
  // action server-side (SCHOOL_ADMIN/PRINCIPAL only); recording progress is
  // available to any curriculum.manage holder with a real TeachingAssignment,
  // teachers included — mirrors the server's assertCanManageContent vs
  // assertCanRecordProgress split exactly.
  const canManageContent = can("curriculum.manage") && role !== "teacher";
  const { data: classes } = useClasses();
  // Explicit user picks only; defaults are derived below (never written back
  // into state), so switching class/subject can't trigger a setState-in-effect
  // cascade — the "effective" selection is just the override-or-first-item.
  const [classIdOverride, setClassIdOverride] = useState<string | null>(null);
  const classId = classIdOverride ?? classes[0]?.id ?? "";
  const { data: classSubjectsRaw } = useClassSubjects(classId || undefined);
  const classSubjects = classSubjectsRaw ?? [];
  const [subjectIdOverride, setSubjectIdOverride] = useState<string | null>(null);
  const subjectId = classSubjects.some((s) => s.subjectId === subjectIdOverride) ? subjectIdOverride! : (classSubjects[0]?.subjectId ?? "");
  const { data: sections } = useSections(classId || undefined);
  const [sectionIdOverride, setSectionIdOverride] = useState<string | null>(null);
  const sectionId = sections.some((s) => s.id === sectionIdOverride) ? sectionIdOverride! : (sections[0]?.id ?? "");

  const { data: insights } = useCurriculumInsights();
  const { data: curriculaForSelection, loading: curriculumListLoading } = useCurriculumList(classId && subjectId ? { classId, subjectId } : {});
  const curriculumSummary = classId && subjectId ? curriculaForSelection[0] : undefined;
  const { data: curriculumDetail } = useCurriculum(curriculumSummary?.id);
  const { data: sectionCurriculum, reload: refetchSectionCurriculum } = useSectionCurriculum(sectionId || undefined, curriculumSummary ? subjectId : undefined);

  const view = sectionCurriculum ?? (curriculumDetail && curriculumSummary ? { curriculum: curriculumSummary, units: curriculumDetail.units, overallPercent: null as number | null } : null);

  const [creating, setCreating] = useState(false);
  async function handleCreateCurriculum() {
    if (!classId || !subjectId) return;
    const className = classes.find((c) => c.id === classId)?.name ?? "";
    const subjectName = classSubjects.find((s) => s.subjectId === subjectId)?.subjectName ?? "";
    setCreating(true);
    const result = await createCurriculumRequest({ classId, subjectId, title: `${className} — ${subjectName}` });
    setCreating(false);
    if (result.success) refetchSectionCurriculum();
  }

  if (!capabilitiesLoading && !hasServerPermission("curriculum.view")) {
    return <PermissionDenied action="view the curriculum" role={roleLabels[role]} backHref="/academics" />;
  }

  return (
    <div className="flex flex-col gap-md">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Curriculum &amp; syllabus tracking</h1>
        <p className="text-xs text-muted-foreground">Planned vs. actual progress across units and chapters</p>
      </div>

      <section className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Overall completion" value={insights ? `${insights.overallPercent ?? 0}%` : "—"} icon={TrendingUp} tone="success" />
        <StatTile label="Units tracked" value={insights ? String(insights.unitsTracked) : "—"} icon={BookOpenCheck} tone="info" />
        <StatTile label="Delayed units" value={insights ? String(insights.delayedUnits) : "—"} icon={AlertTriangle} tone="error" />
        <StatTile label="Classes tracked" value={insights ? String(insights.classesTracked) : "—"} icon={BookOpenCheck} tone="neutral" />
      </section>

      {insights && (insights.byClass.length > 0 || insights.bySubject.length > 0 || insights.byTeacher.length > 0) && (
        <div className="grid grid-cols-1 gap-md sm:grid-cols-3">
          <div className="rounded-lg border border-border p-sm">
            <h3 className="mb-xs text-sm font-semibold text-foreground">Completion by class</h3>
            <ul className="flex flex-col gap-1 text-sm">
              {insights.byClass.map((row) => (
                <li key={row.classId} className="flex items-center justify-between">
                  <span className="text-foreground">{row.className}</span>
                  <span className="text-muted-foreground">{row.percent ?? "—"}%</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border border-border p-sm">
            <h3 className="mb-xs text-sm font-semibold text-foreground">Completion by subject</h3>
            <ul className="flex flex-col gap-1 text-sm">
              {insights.bySubject.map((row) => (
                <li key={row.subjectId} className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-foreground">
                    <span className="size-1.5 shrink-0 rounded-pill" style={{ backgroundColor: row.subjectColor }} aria-hidden="true" />
                    {row.subjectName}
                  </span>
                  <span className="text-muted-foreground">{row.percent ?? "—"}%</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border border-border p-sm">
            <h3 className="mb-xs text-sm font-semibold text-foreground">Completion by teacher</h3>
            <ul className="flex flex-col gap-1 text-sm">
              {insights.byTeacher.map((row) => (
                <li key={row.staffId} className="flex items-center justify-between">
                  <span className="text-foreground">{row.staffName}</span>
                  <span className="text-muted-foreground">{row.percent ?? "—"}%</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {insights && insights.delayedUnits > 0 && (
        <div className="flex flex-wrap items-center gap-sm rounded-lg border border-error/30 bg-error/10 px-sm py-sm text-xs text-error">
          <AlertTriangle className="size-4 shrink-0" />
          <span className="font-medium">{insights.delayedUnits} unit{insights.delayedUnits === 1 ? "" : "s"} delayed across {insights.classesTracked} class{insights.classesTracked === 1 ? "" : "es"}.</span>
        </div>
      )}

      <div className="rounded-lg border border-border bg-surface p-md">
        <div className="mb-md flex flex-wrap items-center gap-sm">
          <h2 className="text-sm font-semibold text-foreground">Learning Path Timeline</h2>
          <div className="ml-auto flex flex-wrap items-center gap-sm">
            <Select value={classId} onValueChange={(v) => { setClassIdOverride(v); setSubjectIdOverride(null); setSectionIdOverride(null); }}>
              <SelectTrigger className="w-40" aria-label="Class">
                <SelectValue placeholder="Class" />
              </SelectTrigger>
              <SelectContent>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={subjectId} onValueChange={setSubjectIdOverride}>
              <SelectTrigger className="w-40" aria-label="Subject">
                <SelectValue placeholder="Subject" />
              </SelectTrigger>
              <SelectContent>
                {classSubjects.map((s) => (
                  <SelectItem key={s.subjectId} value={s.subjectId}>{s.subjectName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sectionId} onValueChange={setSectionIdOverride}>
              <SelectTrigger className="w-32" aria-label="Section">
                <SelectValue placeholder="Section" />
              </SelectTrigger>
              <SelectContent>
                {sections.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {!classId || !subjectId ? (
          <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Select a class and subject.</p>
        ) : curriculumListLoading && !curriculumSummary ? (
          <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Loading…</p>
        ) : !curriculumSummary ? (
          <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border p-md text-center">
            <p className="text-sm text-muted-foreground">No curriculum tracked yet for this class and subject.</p>
            {canManageContent && (
              <Button size="sm" variant="outline" disabled={creating} onClick={handleCreateCurriculum}>
                <Plus className="size-3.5" />
                Create curriculum
              </Button>
            )}
          </div>
        ) : curriculumSummary.status === "draft" ? (
          <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border p-md text-center">
            <p className="text-sm text-muted-foreground">This curriculum is still a draft. Add units, then activate it to start tracking section progress.</p>
            {canManageContent && <p className="text-xs text-muted-foreground">Manage content from the curriculum detail view.</p>}
          </div>
        ) : !sectionId ? (
          <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Select a section to view and record progress.</p>
        ) : view ? (
          <LearningPathTimeline units={view.units} sectionId={sectionId} canManageContent={canManageContent} canRecordProgress={can("curriculum.manage")} onProgressChange={refetchSectionCurriculum} />
        ) : (
          <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Loading…</p>
        )}
      </div>
    </div>
  );
}
