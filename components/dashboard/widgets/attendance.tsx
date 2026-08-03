"use client";

import { CalendarCheck } from "lucide-react";
import { fetchAttendance } from "../data/mock-data";
import { RadialProgress } from "../mini-charts";
import { useWidgetData } from "../use-widget-data";
import { WidgetShell } from "../widget-shell";

export function AttendanceWidget() {
  const state = useWidgetData(fetchAttendance);

  return (
    <WidgetShell
      title="Attendance"
      icon={CalendarCheck}
      status={state.status}
      error={state.status === "error" ? state.error : undefined}
      onRetry={state.retry}
      isEmpty={state.status === "ready" && state.data.totalStudents === 0}
      emptyMessage="No attendance recorded yet today."
    >
      {state.status === "ready" && (
        <div className="flex h-full items-center gap-md">
          <RadialProgress percent={state.data.overallPercent} toneClassName="text-success" size={64} strokeWidth={7} />
          <dl className="grid flex-1 grid-cols-3 gap-xs text-center">
            <div>
              <dt className="text-[11px] text-muted-foreground">Present</dt>
              <dd className="text-sm font-semibold text-foreground">{state.data.present}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-muted-foreground">Absent</dt>
              <dd className="text-sm font-semibold text-foreground">{state.data.absent}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-muted-foreground">Late</dt>
              <dd className="text-sm font-semibold text-foreground">{state.data.late}</dd>
            </div>
          </dl>
        </div>
      )}
    </WidgetShell>
  );
}
