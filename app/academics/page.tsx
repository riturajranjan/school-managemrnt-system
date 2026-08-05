"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpenCheck,
  CalendarClock,
  ClipboardList,
  FileWarning,
  Gauge,
  LayoutList,
  Presentation,
  UserX,
  Users,
} from "lucide-react";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { MiniBar } from "@/components/dashboard/mini-charts";
import { PulseGauge } from "@/components/dashboard/pulse-gauge";
import { toneClasses } from "@/components/dashboard/tone";
import type { PulseFactor } from "@/components/dashboard/data/types";
import { StatTile } from "@/components/ui/stat-tile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useShell } from "@/components/shell/shell-context";
import { MOCK_BRANCHES } from "@/components/shell/context-data";
import { findClass, findSection } from "@/lib/data/seed/reference";
import {
  curriculumCompletionPercent,
  homeworkCompletionPercent,
  lessonPlanAdherencePercent,
  missingLessonPlanCount,
  overdueHomeworkForReviewCount,
  pendingLessonPlanApprovals,
  substituteRequirementCount,
} from "@/lib/selectors/academics-insights";
import { presentPercentFor, unmarkedSectionsToday } from "@/lib/selectors/attendance-insights";
import { useAcademicEvents, useManagedClasses } from "@/lib/hooks/use-academics";
import { useTimetableConflicts } from "@/lib/hooks/use-timetable";
import { useSisStore } from "@/lib/hooks/use-store";
import { schoolClasses } from "@/lib/data/seed/reference";
import { formatDate } from "@/lib/utils";

export default function AcademicsPage() {
  const db = useSisStore();
  const classes = useManagedClasses();
  const events = useAcademicEvents();
  const conflicts = useTimetableConflicts();
  const { activeSession, activeBranchId } = useShell();
  const [pulseOpen, setPulseOpen] = useState(false);

  const branchName = MOCK_BRANCHES.find((b) => b.id === activeBranchId)?.name ?? "Main Campus";
  const activeClasses = classes.filter((c) => c.status === "active");
  const today = new Date().toISOString().slice(0, 10);
  const todaySessions = db.attendanceSessions.filter((s) => s.date.slice(0, 10) === today);
  const allSectionIds = schoolClasses.flatMap((c) => c.sections.map((s) => s.id));
  const unmarked = unmarkedSectionsToday(allSectionIds, db.attendanceSessions);

  const curriculumPct = curriculumCompletionPercent(db.curriculumUnits);
  const lessonAdherence = lessonPlanAdherencePercent(db.lessonPlans);
  const homeworkPct = homeworkCompletionPercent(db.homework, db.homeworkSubmissions);
  const attendancePct = presentPercentFor(todaySessions);
  const substituteNeeded = substituteRequirementCount(db);

  const pulseFactors: PulseFactor[] = [
    { key: "curriculum", label: "Curriculum completion", score: curriculumPct, displayValue: `${curriculumPct}%`, tone: curriculumPct >= 70 ? "success" : curriculumPct >= 40 ? "warning" : "error" },
    { key: "lessonPlans", label: "Lesson-plan adherence", score: lessonAdherence, displayValue: `${lessonAdherence}%`, tone: lessonAdherence >= 80 ? "success" : lessonAdherence >= 50 ? "warning" : "error" },
    { key: "attendance", label: "Attendance", score: attendancePct, displayValue: `${attendancePct}%`, tone: attendancePct >= 90 ? "success" : attendancePct >= 75 ? "warning" : "error" },
    { key: "homework", label: "Homework completion", score: homeworkPct, displayValue: `${homeworkPct}%`, tone: homeworkPct >= 70 ? "success" : homeworkPct >= 40 ? "warning" : "error" },
    {
      key: "timetable",
      label: "Timetable health",
      score: Math.max(0, 100 - conflicts.length * 5),
      displayValue: `${conflicts.length} conflicts`,
      tone: conflicts.length === 0 ? "success" : conflicts.length < 5 ? "warning" : "error",
    },
    {
      key: "staffAvailability",
      label: "Teacher availability",
      score: Math.max(0, 100 - substituteNeeded * 8),
      displayValue: `${substituteNeeded} unavailable`,
      tone: substituteNeeded === 0 ? "success" : substituteNeeded < 3 ? "warning" : "error",
    },
  ];
  const overallScore = Math.round(pulseFactors.reduce((sum, f) => sum + f.score, 0) / pulseFactors.length);
  const sortedByScore = [...pulseFactors].sort((a, b) => a.score - b.score);

  const nowMs = new Date().getTime();
  const upcomingEvents = useMemo(
    () => events.filter((e) => new Date(e.startDate).getTime() >= nowMs).sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()).slice(0, 5),
    [events, nowMs],
  );

  const exceptions = useMemo(() => {
    const items: { id: string; title: string; detail: string; severity: "critical" | "warning" }[] = [];
    const missingPlans = missingLessonPlanCount(db.lessonPlans);
    if (missingPlans > 0) items.push({ id: "missing-plans", title: "Missing lesson plans", detail: `${missingPlans} class(es) in the next 2 days have no lesson plan drafted.`, severity: "warning" });
    if (unmarked.length > 0) items.push({ id: "unmarked", title: "Unmarked attendance", detail: `${unmarked.length} section(s) haven't marked attendance today.`, severity: "critical" });
    if (conflicts.length > 0) items.push({ id: "conflicts", title: "Timetable conflicts", detail: `${conflicts.length} scheduling conflict(s) detected.`, severity: "critical" });
    const pendingApprovals = pendingLessonPlanApprovals(db.lessonPlans);
    if (pendingApprovals > 0) items.push({ id: "pending-approvals", title: "Lesson plans awaiting approval", detail: `${pendingApprovals} plan(s) submitted for review.`, severity: "warning" });
    const overdueReview = overdueHomeworkForReviewCount(db.homework, db.homeworkSubmissions);
    if (overdueReview > 0) items.push({ id: "homework-review", title: "Homework overdue for review", detail: `${overdueReview} assignment(s) have ungraded submissions.`, severity: "warning" });
    if (substituteNeeded > 0) items.push({ id: "substitutes", title: "Substitute teachers needed", detail: `${substituteNeeded} teacher(s) unavailable today.`, severity: "warning" });
    return items;
  }, [db.lessonPlans, db.homework, db.homeworkSubmissions, unmarked, conflicts, substituteNeeded]);

  return (
    <div className="flex flex-col gap-md">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Academics</h1>
          <p className="text-xs text-muted-foreground">
            {activeSession} · {branchName}
          </p>
        </div>
        <div className="flex flex-wrap gap-xs">
          <Button asChild variant="outline" size="sm">
            <Link href="/academics/homework/new">New homework</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/attendance/students">Mark attendance</Link>
          </Button>
        </div>
      </div>

      <section aria-label="Academic summary" className="grid grid-cols-2 gap-sm sm:grid-cols-3 lg:grid-cols-5">
        <StatTile label="Active classes" value={String(activeClasses.length)} icon={Presentation} tone="info" />
        <StatTile label="Teachers scheduled" value={String(db.teachers.filter((t) => t.status === "active").length)} icon={Users} tone="neutral" />
        <StatTile label="Attendance today" value={`${attendancePct}%`} icon={ClipboardList} tone={attendancePct >= 90 ? "success" : "warning"} />
        <StatTile label="Homework completion" value={`${homeworkPct}%`} icon={BookOpenCheck} tone={homeworkPct >= 70 ? "success" : "warning"} />
        <StatTile label="Timetable conflicts" value={String(conflicts.length)} icon={AlertTriangle} tone={conflicts.length === 0 ? "success" : "error"} />
      </section>

      <div className="grid grid-cols-1 gap-md lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-md">
          <div className="rounded-lg border border-border bg-surface p-md">
            <div className="mb-sm flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Exception feed</h2>
              <Badge tone={exceptions.length === 0 ? "success" : "warning"}>{exceptions.length} item(s)</Badge>
            </div>
            {exceptions.length === 0 ? (
              <p className="py-md text-center text-sm text-muted-foreground">No issues need attention right now.</p>
            ) : (
              <ul className="flex flex-col gap-sm">
                {exceptions.map((item) => (
                  <li key={item.id} className="flex items-start gap-sm rounded-md border border-border p-sm">
                    <AlertTriangle className={`mt-0.5 size-4 shrink-0 ${item.severity === "critical" ? "text-error" : "text-warning"}`} />
                    <div>
                      <p className="text-sm font-medium text-foreground">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-lg border border-border bg-surface p-md">
            <h2 className="mb-sm text-sm font-semibold text-foreground">Today&apos;s academic activity</h2>
            {todaySessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No attendance sessions recorded yet today.</p>
            ) : (
              <ul className="flex flex-col gap-1 text-sm">
                {todaySessions.slice(0, 6).map((s) => (
                  <li key={s.id} className="flex items-center justify-between">
                    <span className="text-foreground">
                      {findClass(s.classId)?.name}-{findSection(s.sectionId)?.section.name}
                    </span>
                    <span className="text-xs text-muted-foreground">{s.records.filter((r) => r.status === "present").length}/{s.records.length} present</span>
                  </li>
                ))}
              </ul>
            )}
            {db.teachers.filter((t) => t.status === "on-leave").length > 0 && (
              <div className="mt-sm flex items-center gap-sm rounded-md bg-warning/10 p-sm text-xs text-warning">
                <UserX className="size-3.5 shrink-0" />
                {db.teachers.filter((t) => t.status === "on-leave").map((t) => t.name).join(", ")} unavailable today
              </div>
            )}
          </div>

          <div className="rounded-lg border border-border bg-surface p-md">
            <h2 className="mb-sm flex items-center gap-1 text-sm font-semibold text-foreground">
              <CalendarClock className="size-4" /> Upcoming academic events
            </h2>
            <ul className="flex flex-col gap-1 text-sm">
              {upcomingEvents.map((e) => (
                <li key={e.id} className="flex items-center justify-between">
                  <span className="text-foreground">{e.title}</span>
                  <span className="text-xs text-muted-foreground">{formatDate(e.startDate)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex flex-col gap-md">
          <div className="rounded-lg border border-border bg-surface p-md">
            <div className="mb-sm flex items-center justify-between">
              <h2 className="flex items-center gap-1 text-sm font-semibold text-foreground">
                <Gauge className="size-4" /> Academic Pulse
              </h2>
              <button type="button" onClick={() => setPulseOpen(true)} className="flex items-center gap-1 text-xs font-medium text-primary">
                <LayoutList className="size-3.5" />
                Breakdown
              </button>
            </div>
            <div className="flex flex-col items-center gap-sm">
              <PulseGauge score={overallScore} factors={pulseFactors} />
              <p className="text-center text-xs text-muted-foreground">
                Strongest: <span className="font-medium text-foreground">{sortedByScore[sortedByScore.length - 1].label}</span> · Main concern:{" "}
                <span className="font-medium text-foreground">{sortedByScore[0].label}</span>
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface p-md">
            <h2 className="mb-sm flex items-center gap-1 text-sm font-semibold text-foreground">
              <FileWarning className="size-4" /> Curriculum &amp; lesson plans
            </h2>
            <div className="flex flex-col gap-sm text-sm">
              <div>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-muted-foreground">Curriculum completion</span>
                  <span className="text-foreground">{curriculumPct}%</span>
                </div>
                <MiniBar percent={curriculumPct} toneClassName={toneClasses[curriculumPct >= 70 ? "success" : "warning"].dot} />
              </div>
              <div>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-muted-foreground">Lesson-plan adherence</span>
                  <span className="text-foreground">{lessonAdherence}%</span>
                </div>
                <MiniBar percent={lessonAdherence} toneClassName={toneClasses[lessonAdherence >= 80 ? "success" : "warning"].dot} />
              </div>
              <Link href="/academics/lesson-plans" className="text-xs font-medium text-primary hover:underline">
                Review lesson plans →
              </Link>
            </div>
          </div>
        </div>
      </div>

      <DetailDrawer open={pulseOpen} onOpenChange={setPulseOpen} title="Academic Pulse breakdown" description="All factors contributing to the composite score">
        <div className="flex flex-col gap-md">
          {pulseFactors.map((factor) => (
            <div key={factor.key} className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">{factor.label}</span>
                <span className={toneClasses[factor.tone].text}>{factor.displayValue}</span>
              </div>
              <MiniBar percent={factor.score} toneClassName={toneClasses[factor.tone].dot} />
            </div>
          ))}
          <p className="rounded-md bg-surface-secondary px-sm py-xs text-xs text-foreground">
            {sortedByScore[0].label} needs the most attention this week — check {sortedByScore[0].key === "timetable" ? "the timetable conflict list" : sortedByScore[0].key === "attendance" ? "sections with unmarked attendance" : "the exception feed"}.
          </p>
        </div>
      </DetailDrawer>
    </div>
  );
}
