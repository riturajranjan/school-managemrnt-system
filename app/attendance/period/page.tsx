"use client";

import { AttendanceMarker } from "@/components/attendance/attendance-marker";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { roleLabels } from "@/lib/permissions/roles";

export default function PeriodAttendancePage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  if (!capabilitiesLoading && !hasServerPermission("attendance.view")) {
    return <PermissionDenied action="view period attendance" role={roleLabels[role]} backHref="/attendance" />;
  }
  return (
    <div className="flex flex-col gap-md">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Period attendance</h1>
        <p className="text-xs text-muted-foreground">Subject-wise attendance for a specific period</p>
      </div>
      <AttendanceMarker mode="period" />
    </div>
  );
}
