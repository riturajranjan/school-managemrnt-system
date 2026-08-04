"use client";

import { CalendarCheck, ListChecks, TrendingDown, TrendingUp } from "lucide-react";
import { useState } from "react";
import { fetchAttendance } from "../data/mock-data";
import { DetailDrawer } from "../detail-drawer";
import { MiniBar, RadialProgress } from "../mini-charts";
import { useWidgetData } from "../use-widget-data";
import { WidgetShell, widgetActionButtonClass } from "../widget-shell";

export function AttendanceWidget() {
  const state = useWidgetData(fetchAttendance);
  const [detailOpen, setDetailOpen] = useState(false);

  const lowestGrade =
    state.status === "ready" && state.data.byGrade.length > 0
      ? state.data.byGrade.reduce((lowest, row) => (row.percent < lowest.percent ? row : lowest))
      : null;
  const deltaVsYesterday = state.status === "ready" ? state.data.overallPercent - state.data.yesterdayPercent : 0;

  return (
    <>
      <WidgetShell
        title="Attendance"
        icon={CalendarCheck}
        status={state.status}
        error={state.status === "error" ? state.error : undefined}
        onRetry={state.retry}
        isEmpty={state.status === "ready" && state.data.totalStudents === 0}
        emptyMessage="No attendance recorded yet today."
        action={
          state.status === "ready" ? (
            <button
              type="button"
              onClick={() => setDetailOpen(true)}
              className={widgetActionButtonClass}
            >
              <ListChecks className="size-3.5" aria-hidden="true" />
              View attendance
            </button>
          ) : undefined
        }
      >
        {state.status === "ready" && (
          <div className="flex h-full flex-col justify-between gap-sm">
            <div className="flex items-center gap-md">
              <RadialProgress percent={state.data.overallPercent} toneClassName="text-success" size={64} strokeWidth={7} />
              <dl className="grid flex-1 grid-cols-3 gap-xs text-center">
                <div>
                  <dt className="text-xs text-muted-foreground">Present</dt>
                  <dd className="text-sm font-semibold text-foreground">{state.data.present}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Absent</dt>
                  <dd className="text-sm font-semibold text-foreground">{state.data.absent}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Late</dt>
                  <dd className="text-sm font-semibold text-foreground">{state.data.late}</dd>
                </div>
              </dl>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-xs border-t border-border pt-xs text-xs">
              <span
                className={`flex items-center gap-0.5 font-medium ${deltaVsYesterday >= 0 ? "text-success" : "text-error"}`}
              >
                {deltaVsYesterday >= 0 ? (
                  <TrendingUp className="size-3" aria-hidden="true" />
                ) : (
                  <TrendingDown className="size-3" aria-hidden="true" />
                )}
                {deltaVsYesterday >= 0 ? "+" : ""}
                {deltaVsYesterday} pts vs yesterday
              </span>
              {lowestGrade && (
                <span className="text-muted-foreground">
                  Lowest: <span className="font-medium text-foreground">{lowestGrade.grade}</span> ({lowestGrade.percent}%)
                </span>
              )}
            </div>
          </div>
        )}
      </WidgetShell>

      <DetailDrawer
        open={detailOpen}
        onOpenChange={setDetailOpen}
        title="Attendance by class"
        description="Today's attendance percentage for every grade."
      >
        {state.status === "ready" && (
          <div className="flex flex-col gap-md">
            <dl className="grid grid-cols-2 gap-sm rounded-md bg-surface-secondary p-sm text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Today</dt>
                <dd className="font-semibold text-foreground">{state.data.overallPercent}%</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Yesterday</dt>
                <dd className="font-semibold text-foreground">{state.data.yesterdayPercent}%</dd>
              </div>
            </dl>
            {state.data.byGrade.map((row) => (
              <div key={row.grade} className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground">{row.grade}</span>
                  <span
                    className={row.grade === lowestGrade?.grade ? "font-semibold text-warning" : "text-muted-foreground"}
                  >
                    {row.percent}%
                  </span>
                </div>
                <MiniBar percent={row.percent} toneClassName={row.grade === lowestGrade?.grade ? "bg-warning" : "bg-success"} />
              </div>
            ))}
          </div>
        )}
      </DetailDrawer>
    </>
  );
}
