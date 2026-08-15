"use client";

// Real PostgreSQL/API cutover (Phase 9A) — reuses the exact canonical Phase 5B
// attendance dashboard (useAttendanceDashboard / GET /api/attendance/dashboard),
// the same data the real /attendance hub page shows. No recomputation, no
// second attendance formula.
import { AlertTriangle, CalendarCheck, ClipboardCheck } from "lucide-react";
import Link from "next/link";
import { useAttendanceDashboard } from "@/lib/hooks/api/use-attendance";
import { RadialProgress } from "../mini-charts";
import { WidgetShell, widgetActionButtonClass } from "../widget-shell";

export function AttendanceWidget() {
  const { data, loading, error } = useAttendanceDashboard();
  const status = loading ? "loading" : error ? "error" : "ready";

  return (
    <WidgetShell
      title="Attendance"
      icon={CalendarCheck}
      status={status}
      error={error ? new Error(error) : undefined}
      isEmpty={status === "ready" && data?.presentTodayPct === null}
      emptyMessage="No attendance recorded yet today."
      action={
        status === "ready" ? (
          <Link href="/attendance" className={widgetActionButtonClass}>
            <ClipboardCheck className="size-3.5" aria-hidden="true" />
            View attendance
          </Link>
        ) : undefined
      }
    >
      {data && (
        <div className="flex h-full flex-col justify-between gap-sm">
          <div className="flex items-center gap-md">
            <RadialProgress percent={data.presentTodayPct ?? 0} toneClassName="text-success" size={64} strokeWidth={7} />
            <dl className="grid flex-1 grid-cols-3 gap-xs text-center">
              <div>
                <dt className="text-xs text-muted-foreground">Late</dt>
                <dd className="text-sm font-semibold text-foreground">{data.lateToday}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Below min</dt>
                <dd className="text-sm font-semibold text-foreground">{data.belowMinimumCount}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">At risk</dt>
                <dd className="text-sm font-semibold text-foreground">{data.consecutiveAbsenceRiskCount}</dd>
              </div>
            </dl>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-xs border-t border-border pt-xs text-xs">
            <span className="text-muted-foreground">
              <span className="font-medium text-foreground">{data.markedSections}</span>/{data.totalSections} sections marked
            </span>
            {data.pendingSections > 0 && (
              <span className="flex items-center gap-0.5 font-medium text-warning">
                <AlertTriangle className="size-3" aria-hidden="true" />
                {data.pendingSections} pending
              </span>
            )}
          </div>
        </div>
      )}
    </WidgetShell>
  );
}
