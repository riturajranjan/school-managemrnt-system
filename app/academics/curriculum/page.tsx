"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, BookOpenCheck, TrendingUp } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatTile } from "@/components/ui/stat-tile";
import { LearningPathTimeline } from "@/components/academics/curriculum/learning-path-timeline";
import { findClass } from "@/lib/data/seed/reference";
import { teacherById } from "@/lib/data/seed/academics";
import { curriculumCompletionPercent, delayedUnitCount } from "@/lib/selectors/academics-insights";
import { useCurriculumUnits, useSubjects } from "@/lib/hooks/use-academics";
import { progressStatusLabels, type ProgressStatus } from "@/lib/types/academics";
import { cn } from "@/lib/utils";

const filterableStatuses: ProgressStatus[] = ["not-started", "planned", "in-progress", "delayed", "needs-review", "completed"];

export default function CurriculumPage() {
  const units = useCurriculumUnits();
  const subjects = useSubjects();

  const trackedClassIds = useMemo(() => [...new Set(units.map((u) => u.classId))], [units]);
  const trackedSubjectIds = useMemo(() => [...new Set(units.map((u) => u.subjectId))], [units]);

  const [classId, setClassId] = useState(trackedClassIds[0] ?? "");
  const [subjectId, setSubjectId] = useState(trackedSubjectIds[0] ?? "");
  const [statusFilter, setStatusFilter] = useState<Set<ProgressStatus>>(new Set());

  const unitsForSelection = units.filter((u) => u.classId === classId && u.subjectId === subjectId);
  const selectedUnits = statusFilter.size === 0 ? unitsForSelection : unitsForSelection.filter((u) => statusFilter.has(u.status));
  const delayedUnits = units.filter((u) => u.status === "delayed");
  const delayedByClass = useMemo(() => {
    const counts = new Map<string, number>();
    for (const u of delayedUnits) counts.set(u.classId, (counts.get(u.classId) ?? 0) + 1);
    return [...counts.entries()].map(([id, count]) => ({ classId: id, count }));
  }, [delayedUnits]);

  function toggleStatusFilter(status: ProgressStatus) {
    setStatusFilter((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  }

  const byClass = trackedClassIds.map((id) => ({ classId: id, percent: curriculumCompletionPercent(units.filter((u) => u.classId === id)) }));
  const bySubject = trackedSubjectIds.map((id) => ({ subjectId: id, percent: curriculumCompletionPercent(units.filter((u) => u.subjectId === id)) }));
  const teacherIds = useMemo(() => [...new Set(units.map((u) => u.teacherId))], [units]);
  const byTeacher = teacherIds.map((id) => ({ teacherId: id, percent: curriculumCompletionPercent(units.filter((u) => u.teacherId === id)) }));

  return (
    <div className="flex flex-col gap-md">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Curriculum &amp; syllabus tracking</h1>
        <p className="text-xs text-muted-foreground">Planned vs. actual progress across units and chapters</p>
      </div>

      <section className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Overall completion" value={`${curriculumCompletionPercent(units)}%`} icon={TrendingUp} tone="success" />
        <StatTile label="Units tracked" value={String(units.length)} icon={BookOpenCheck} tone="info" />
        <StatTile label="Delayed units" value={String(delayedUnitCount(units))} icon={AlertTriangle} tone="error" />
        <StatTile label="Classes tracked" value={String(trackedClassIds.length)} icon={BookOpenCheck} tone="neutral" />
      </section>

      <div className="grid grid-cols-1 gap-md sm:grid-cols-3">
        <div className="rounded-lg border border-border p-sm">
          <h3 className="mb-xs text-sm font-semibold text-foreground">Completion by class</h3>
          <ul className="flex flex-col gap-1 text-sm">
            {byClass.map((row) => (
              <li key={row.classId} className="flex items-center justify-between">
                <span className="text-foreground">{findClass(row.classId)?.name}</span>
                <span className="text-muted-foreground">{row.percent}%</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border border-border p-sm">
          <h3 className="mb-xs text-sm font-semibold text-foreground">Completion by subject</h3>
          <ul className="flex flex-col gap-1 text-sm">
            {bySubject.map((row) => (
              <li key={row.subjectId} className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-foreground">
                  <span className="size-1.5 shrink-0 rounded-pill" style={{ backgroundColor: subjects.find((s) => s.id === row.subjectId)?.color }} aria-hidden="true" />
                  {subjects.find((s) => s.id === row.subjectId)?.name}
                </span>
                <span className="text-muted-foreground">{row.percent}%</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border border-border p-sm">
          <h3 className="mb-xs text-sm font-semibold text-foreground">Completion by teacher</h3>
          <ul className="flex flex-col gap-1 text-sm">
            {byTeacher.map((row) => (
              <li key={row.teacherId} className="flex items-center justify-between">
                <span className="text-foreground">{teacherById(row.teacherId)?.name}</span>
                <span className="text-muted-foreground">{row.percent}%</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {delayedUnits.length > 0 && (
        <div className="flex flex-wrap items-center gap-sm rounded-lg border border-error/30 bg-error/10 px-sm py-sm text-xs text-error">
          <AlertTriangle className="size-4 shrink-0" />
          <span className="font-medium">
            {delayedUnits.length} unit{delayedUnits.length === 1 ? "" : "s"} delayed across {delayedByClass.length} class{delayedByClass.length === 1 ? "" : "es"}:
          </span>
          {delayedByClass.map(({ classId: id, count }) => (
            <button
              key={id}
              type="button"
              onClick={() => setClassId(id)}
              className="rounded-pill border border-error/30 bg-surface px-sm py-0.5 font-medium text-error outline-none hover:bg-error/10 focus-visible:ring-2 focus-visible:ring-ring"
            >
              {findClass(id)?.name} ({count})
            </button>
          ))}
        </div>
      )}

      <div className="rounded-lg border border-border bg-surface p-md">
        <div className="mb-md flex flex-wrap items-center gap-sm">
          <h2 className="text-sm font-semibold text-foreground">Learning Path Timeline</h2>
          <div className="ml-auto flex items-center gap-sm">
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger className="w-40" aria-label="Class">
                <SelectValue placeholder="Class" />
              </SelectTrigger>
              <SelectContent>
                {trackedClassIds.map((id) => (
                  <SelectItem key={id} value={id}>
                    {findClass(id)?.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={subjectId} onValueChange={setSubjectId}>
              <SelectTrigger className="w-40" aria-label="Subject">
                <SelectValue placeholder="Subject" />
              </SelectTrigger>
              <SelectContent>
                {trackedSubjectIds.map((id) => (
                  <SelectItem key={id} value={id}>
                    {subjects.find((s) => s.id === id)?.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mb-sm flex flex-wrap items-center gap-1">
          <span className="text-xs text-muted-foreground">Filter by status:</span>
          {filterableStatuses.map((status) => {
            const active = statusFilter.has(status);
            const countForStatus = unitsForSelection.filter((u) => u.status === status).length;
            if (countForStatus === 0) return null;
            return (
              <button
                key={status}
                type="button"
                onClick={() => toggleStatusFilter(status)}
                aria-pressed={active}
                className={cn(
                  "rounded-pill px-sm py-1 text-[11px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                  active ? "bg-primary text-primary-foreground" : "bg-surface-secondary text-muted-foreground hover:text-foreground",
                )}
              >
                {progressStatusLabels[status]} ({countForStatus})
              </button>
            );
          })}
          {statusFilter.size > 0 && (
            <button type="button" onClick={() => setStatusFilter(new Set())} className="text-[11px] font-medium text-primary underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
              Clear
            </button>
          )}
        </div>
        <LearningPathTimeline units={selectedUnits} />
      </div>
    </div>
  );
}
