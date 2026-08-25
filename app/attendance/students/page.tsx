"use client";

import { AttendanceMarker } from "@/components/attendance/attendance-marker";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { roleLabels } from "@/lib/permissions/roles";

export default function StudentAttendancePage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  if (!capabilitiesLoading && !hasServerPermission("attendance.view")) {
    return <PermissionDenied action="view daily attendance" role={roleLabels[role]} backHref="/attendance" />;
  }
  return (
    <div className="flex flex-col gap-md">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Mark attendance</h1>
        <p className="text-xs text-muted-foreground">Daily attendance by class and section</p>
      </div>
      <AttendanceMarker mode="daily" />
    </div>
  );
}
