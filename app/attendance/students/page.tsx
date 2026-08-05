"use client";

import { AttendanceMarker } from "@/components/attendance/attendance-marker";

export default function StudentAttendancePage() {
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
