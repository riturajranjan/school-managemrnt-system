"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, BookOpenCheck, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatTile } from "@/components/ui/stat-tile";
import { LearningPathTimeline } from "@/components/academics/curriculum/learning-path-timeline";
import { findClass } from "@/lib/data/seed/reference";
import { teacherById } from "@/lib/data/seed/academics";
import { curriculumCompletionPercent, delayedUnitCount } from "@/lib/selectors/academics-insights";
import { useCurriculumUnits, useSubjects } from "@/lib/hooks/use-academics";
import { progressStatusLabels, progressStatusTone } from "@/lib/types/academics";

export default function CurriculumPage() {
  const units = useCurriculumUnits();
  const subjects = useSubjects();

  const trackedClassIds = useMemo(() => [...new Set(units.map((u) => u.classId))], [units]);
  const trackedSubjectIds = useMemo(() => [...new Set(units.map((u) => u.subjectId))], [units]);

  const [classId, setClassId] = useState(trackedClassIds[0] ?? "");
  const [subjectId, setSubjectId] = useState(trackedSubjectIds[0] ?? "");

  const selectedUnits = units.filter((u) => u.classId === classId && u.subjectId === subjectId);
  const delayedUnits = units.filter((u) => u.status === "delayed");

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
                <span className="text-foreground">{subjects.find((s) => s.id === row.subjectId)?.name}</span>
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
          <span className="font-medium">Delayed units:</span>
          {delayedUnits.slice(0, 4).map((u) => (
            <span key={u.id}>
              {findClass(u.classId)?.name} — {u.title}
            </span>
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
        <LearningPathTimeline units={selectedUnits} />
      </div>

      {selectedUnits.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedUnits.map((u) => (
            <Badge key={u.id} tone={progressStatusTone[u.status]}>
              {u.title}: {progressStatusLabels[u.status]}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
