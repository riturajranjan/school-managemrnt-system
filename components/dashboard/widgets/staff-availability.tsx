"use client";

// Real PostgreSQL/API cutover (Phase 9E.1) — reuses the canonical Phase 9E
// staff-attendance summary (useStaffAttendanceSummary / GET
// /api/staff-attendance/summary), the same data the real /attendance/staff
// page shows. "Not marked" is shown honestly — never folded into "absent".
import { Users } from "lucide-react";
import Link from "next/link";
import { useStaffAttendanceSummary } from "@/lib/hooks/api/use-staff-attendance-api";
import { usePermissions } from "@/components/providers/permissions-provider";
import { WidgetShell, widgetActionButtonClass } from "../widget-shell";
import { DeferredWidget } from "./deferred-widget";

export function StaffAvailabilityWidget() {
  const { can } = usePermissions();
  if (!can("staffAttendance.view")) {
    return <DeferredWidget title="Staff Availability" icon={Users} message="You don't have permission to view staff attendance." />;
  }
  return <StaffAvailabilityWidgetInner />;
}

function StaffAvailabilityWidgetInner() {
  const today = new Date().toISOString().slice(0, 10);
  const { data, loading, error } = useStaffAttendanceSummary(today);
  const status = loading ? "loading" : error ? "error" : "ready";

  return (
    <WidgetShell
      title="Staff Availability"
      icon={Users}
      status={status}
      error={error ? new Error(error) : undefined}
      isEmpty={status === "ready" && data?.totalActiveStaff === 0}
      emptyMessage="No active staff found."
      action={
        status === "ready" ? (
          <Link href="/attendance/staff" className={widgetActionButtonClass}>
            <Users className="size-3.5" aria-hidden="true" />
            View staff attendance
          </Link>
        ) : undefined
      }
    >
      {data && (
        <dl className="grid h-full grid-cols-2 gap-sm text-center">
          <div className="flex flex-col justify-center rounded-md border border-border p-sm">
            <dt className="text-xs text-muted-foreground">Present</dt>
            <dd className="text-lg font-semibold text-success">{data.present}</dd>
          </div>
          <div className="flex flex-col justify-center rounded-md border border-border p-sm">
            <dt className="text-xs text-muted-foreground">On leave</dt>
            <dd className="text-lg font-semibold text-info">{data.onLeave}</dd>
          </div>
          <div className="flex flex-col justify-center rounded-md border border-border p-sm">
            <dt className="text-xs text-muted-foreground">Late</dt>
            <dd className="text-lg font-semibold text-warning">{data.late}</dd>
          </div>
          <div className="flex flex-col justify-center rounded-md border border-border p-sm">
            <dt className="text-xs text-muted-foreground">Not marked</dt>
            <dd className="text-lg font-semibold text-muted-foreground">{data.notMarked}</dd>
          </div>
        </dl>
      )}
    </WidgetShell>
  );
}
