"use client";

// Real PostgreSQL/API cutover (Phase 9A) — real upcoming ExamScheduleEntry
// rows only (GET /api/dashboard). The old mock's holiday/meeting/celebration/
// ptm/deadline event categories had no real backing and are dropped rather
// than fabricated; this is honestly "Upcoming Exams" now, not a full campus
// events calendar (no real Event/Calendar model exists yet — see AGENTS
// notes for Phase 9A). Personalized to the actor's own teaching subjects when
// they have a real teaching Staff profile, school-wide otherwise.
import { CalendarDays, Clock, GraduationCap } from "lucide-react";
import { useState } from "react";
import type { UpcomingExamDto } from "@/lib/api/contracts";
import { useSchoolDashboard } from "@/lib/hooks/api/use-dashboard-api";
import { DetailDrawer } from "../detail-drawer";
import { WidgetShell } from "../widget-shell";

export function UpcomingEventsWidget() {
  const { data, loading, error } = useSchoolDashboard();
  const status = loading ? "loading" : error ? "error" : "ready";
  const [selected, setSelected] = useState<UpcomingExamDto | null>(null);

  const exams = data?.upcomingExams ?? [];

  return (
    <>
      <WidgetShell
        title="Upcoming Exams"
        icon={CalendarDays}
        status={status}
        error={error ? new Error(error) : undefined}
        isEmpty={status === "ready" && exams.length === 0}
        emptyMessage="No exams scheduled yet."
      >
        <ul className="flex h-full flex-col gap-0.5 overflow-y-auto">
          {exams.slice(0, 5).map((exam) => (
            <li key={`${exam.examId}-${exam.subject?.id ?? "school"}`}>
              <button
                type="button"
                onClick={() => setSelected(exam)}
                className="flex w-full min-h-11 items-center gap-sm rounded-md px-xs py-1 text-left outline-none transition-colors hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-ring"
              >
                <GraduationCap className="size-4 shrink-0 text-info" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                  {exam.examName}
                  {exam.subject ? ` — ${exam.subject.name}` : ""}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">{exam.examDate}</span>
              </button>
            </li>
          ))}
        </ul>
      </WidgetShell>

      <DetailDrawer open={selected !== null} onOpenChange={(open) => !open && setSelected(null)} title={selected?.examName ?? "Exam"}>
        {selected && (
          <div className="flex flex-col gap-md">
            <span className="flex w-fit items-center gap-1 rounded-pill bg-info/15 px-sm py-0.5 text-xs font-semibold uppercase tracking-wide text-info">
              <GraduationCap className="size-3.5 shrink-0" aria-hidden="true" />
              {selected.termName}
            </span>
            <dl className="flex flex-col gap-xs text-sm">
              <div className="flex justify-between border-b border-border py-xs">
                <dt className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="size-3.5 shrink-0" aria-hidden="true" />
                  Date
                </dt>
                <dd className="text-foreground">{selected.examDate}</dd>
              </div>
              {selected.section && (
                <div className="flex justify-between border-b border-border py-xs">
                  <dt className="text-muted-foreground">Class</dt>
                  <dd className="text-foreground">{selected.section.className}-{selected.section.name}</dd>
                </div>
              )}
              {selected.subject && (
                <div className="flex justify-between border-b border-border py-xs">
                  <dt className="text-muted-foreground">Subject</dt>
                  <dd className="text-foreground">{selected.subject.name}</dd>
                </div>
              )}
            </dl>
          </div>
        )}
      </DetailDrawer>
    </>
  );
}
