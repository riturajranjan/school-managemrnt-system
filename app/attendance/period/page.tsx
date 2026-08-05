"use client";

import { AttendanceMarker } from "@/components/attendance/attendance-marker";

export default function PeriodAttendancePage() {
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
