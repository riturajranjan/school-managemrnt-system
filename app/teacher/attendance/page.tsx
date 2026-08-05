"use client";

import { AttendanceMarker } from "@/components/attendance/attendance-marker";

export default function TeacherAttendancePage() {
  return (
    <div className="flex flex-col gap-md">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Mark attendance</h1>
        <p className="text-xs text-muted-foreground">For your assigned classes</p>
      </div>
      <AttendanceMarker mode="daily" />
    </div>
  );
}
