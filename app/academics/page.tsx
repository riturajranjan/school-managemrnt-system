"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, BookOpenCheck, ClipboardList, FileWarning, Gauge, LayoutList, Presentation, UserX, Users } from "lucide-react";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { MiniBar } from "@/components/dashboard/mini-charts";
import { PulseGauge } from "@/components/dashboard/pulse-gauge";
import { toneClasses } from "@/components/dashboard/tone";
import type { PulseFactor } from "@/components/dashboard/data/types";
import { StatTile } from "@/components/ui/stat-tile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useShell } from "@/components/shell/shell-context";
import { useAcademicsDashboard } from "@/lib/hooks/api/use-academics-dashboard";
import { formatDate } from "@/lib/utils";

export default function AcademicsPage() {
  const { data, loading, error, reload } = useAcademicsDashboard();
  const { activeSession, activeBranchName } = useShell();
  const [pulseOpen, setPulseOpen] = useState(false);
  const branchName = activeBranchName || "All branches";

  const curriculumPct = data?.curriculum.overallPercent ?? 0;
  // `presentTodayPct` is null when nothing has been marked yet today — an honest
  // empty state, not a real 0%. The Pulse factor still needs a numeric score, so
  // it falls back to 0 there; every literal display uses attendanceDisplay instead.
  const attendancePct = data?.attendance.presentTodayPct ?? 0;
  const attendanceDisplay = data?.attendance.presentTodayPct == null ? "—" : `${data.attendance.presentTodayPct}%`;
  const homeworkTotal = (data?.homework.draftCount ?? 0) + (data?.homework.publishedCount ?? 0);
  const homeworkPublishedPct = homeworkTotal > 0 ? Math.round(((data?.homework.publishedCount ?? 0) / homeworkTotal) * 100) : 100;
  const lessonPlanTotal = (data?.lessonPlans.pendingApprovalCount ?? 0) + (data?.lessonPlans.approvedCount ?? 0);
  const lessonPlanApprovedPct = lessonPlanTotal > 0 ? Math.round(((data?.lessonPlans.approvedCount ?? 0) / lessonPlanTotal) * 100) : 100;

  const pulseFactors: PulseFactor[] = [
    { key: "curriculum", label: "Curriculum completion", score: curriculumPct, displayValue: `${curriculumPct}%`, tone: curriculumPct >= 70 ? "success" : curriculumPct >= 40 ? "warning" : "error" },
    { key: "lessonPlans", label: "Lesson plans approved", score: lessonPlanApprovedPct, displayValue: `${lessonPlanApprovedPct}%`, tone: lessonPlanApprovedPct >= 80 ? "success" : lessonPlanApprovedPct >= 50 ? "warning" : "error" },
    { key: "attendance", label: "Attendance", score: attendancePct, displayValue: `${attendancePct}%`, tone: attendancePct >= 90 ? "success" : attendancePct >= 75 ? "warning" : "error" },
    { key: "homework", label: "Homework published", score: homeworkPublishedPct, displayValue: `${homeworkPublishedPct}%`, tone: homeworkPublishedPct >= 70 ? "success" : homeworkPublishedPct >= 40 ? "warning" : "error" },
  ];
  const overallScore = Math.round(pulseFactors.reduce((sum, f) => sum + f.score, 0) / pulseFactors.length);
  const sortedByScore = [...pulseFactors].sort((a, b) => a.score - b.score);

  const upcomingEvents = data?.upcomingEvents ?? [];

  const exceptions = useMemo(() => {
    if (!data) return [];
    const items: { id: string; title: string; detail: string; severity: "critical" | "warning" }[] = [];
    if (data.attendance.pendingSections > 0) {
      items.push({ id: "unmarked", title: "Unmarked attendance", detail: `${data.attendance.pendingSections} section(s) haven't marked attendance today.`, severity: "critical" });
    }
    if (data.lessonPlans.pendingApprovalCount > 0) {
      items.push({ id: "pending-approvals", title: "Lesson plans awaiting approval", detail: `${data.lessonPlans.pendingApprovalCount} plan(s) submitted for review.`, severity: "warning" });
    }
    if (data.homework.overdueOpenCount > 0) {
      items.push({ id: "homework-overdue", title: "Homework overdue for review", detail: `${data.homework.overdueOpenCount} assignment(s) are past due and not yet closed.`, severity: "warning" });
    }
    if (data.curriculum.delayedUnits > 0) {
      items.push({ id: "curriculum-delayed", title: "Curriculum units delayed", detail: `${data.curriculum.delayedUnits} unit(s) are past their planned end date.`, severity: "warning" });
    }
    if (data.teachingStaffOnLeaveToday > 0) {
      items.push({ id: "staff-leave", title: "Teachers on leave today", detail: `${data.teachingStaffOnLeaveToday} teacher(s) are on leave today.`, severity: "warning" });
    }
    return items;
  }, [data]);

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

      {error ? (
        <div className="rounded-lg border border-error/30 bg-error/5 p-md text-sm text-error" role="alert">
          Could not load the academics overview: {error}
          <Button variant="outline" size="sm" className="ml-sm" onClick={reload}>
            Retry
          </Button>
        </div>
      ) : loading && !data ? (
        <div className="rounded-lg border border-border bg-surface p-2xl text-center text-sm text-muted-foreground">Loading academics overview…</div>
      ) : data ? (
        <>
          <section aria-label="Academic summary" className="grid grid-cols-2 gap-sm sm:grid-cols-4">
            <StatTile label="Active classes" value={String(data.activeClasses)} icon={Presentation} tone="info" />
            <StatTile label="Teaching staff" value={String(data.teachingStaffCount)} icon={Users} tone="neutral" />
            <StatTile label="Attendance today" value={attendanceDisplay} icon={ClipboardList} tone={attendancePct >= 90 ? "success" : "warning"} />
            <StatTile label="Homework published" value={String(data.homework.publishedCount)} icon={BookOpenCheck} tone="neutral" />
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
                <ul className="flex flex-col gap-1 text-sm">
                  <li className="flex items-center justify-between">
                    <span className="text-foreground">Attendance sections marked</span>
                    <span className="text-xs text-muted-foreground">
                      {data.attendance.markedSections}/{data.attendance.totalSections}
                    </span>
                  </li>
                  <li className="flex items-center justify-between">
                    <span className="text-foreground">Present today</span>
                    <span className="text-xs text-muted-foreground">{attendanceDisplay}</span>
                  </li>
                  <li className="flex items-center justify-between">
                    <span className="text-foreground">Late arrivals</span>
                    <span className="text-xs text-muted-foreground">{data.attendance.lateToday}</span>
                  </li>
                </ul>
                {data.teachingStaffOnLeaveToday > 0 && (
                  <div className="mt-sm flex items-center gap-sm rounded-md bg-warning/10 p-sm text-xs text-warning">
                    <UserX className="size-3.5 shrink-0" />
                    {data.teachingStaffOnLeaveToday} teacher{data.teachingStaffOnLeaveToday === 1 ? "" : "s"} on leave today
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-border bg-surface p-md">
                <h2 className="mb-sm flex items-center gap-1 text-sm font-semibold text-foreground">
                  <ClipboardList className="size-4" /> Upcoming academic events
                </h2>
                {upcomingEvents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No academic events in the next 30 days.</p>
                ) : (
                  <ul className="flex flex-col gap-1 text-sm">
                    {upcomingEvents.map((e) => (
                      <li key={e.id} className="flex items-center justify-between">
                        <span className="text-foreground">{e.title}</span>
                        <span className="text-xs text-muted-foreground">{formatDate(e.startDate)}</span>
                      </li>
                    ))}
                  </ul>
                )}
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
                      <span className="text-muted-foreground">Lesson plans approved</span>
                      <span className="text-foreground">{lessonPlanApprovedPct}%</span>
                    </div>
                    <MiniBar percent={lessonPlanApprovedPct} toneClassName={toneClasses[lessonPlanApprovedPct >= 80 ? "success" : "warning"].dot} />
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
                {sortedByScore[0].label} needs the most attention this week — check the exception feed for details.
              </p>
            </div>
          </DetailDrawer>
        </>
      ) : null}
    </div>
  );
}
