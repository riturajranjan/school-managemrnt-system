"use client";

import { CalendarCheck, CalendarX, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { usePermissions } from "@/components/providers/permissions-provider";
import { markAttendance } from "@/lib/services/students-service";
import type { Student } from "@/lib/types/students";

export function AttendanceTab({ student }: { student: Student }) {
  const { can } = usePermissions();
  const { attendance } = student;

  return (
    <div className="flex flex-col gap-md">
      {can("students.edit") && (
        <div className="flex flex-wrap items-center gap-xs rounded-lg border border-border p-sm">
          <span className="text-sm font-medium text-foreground">Mark today:</span>
          <Button size="sm" variant="outline" onClick={() => markAttendance(student.id, "present", "Class Teacher")}>
            <CalendarCheck className="size-3.5" /> Present
          </Button>
          <Button size="sm" variant="outline" onClick={() => markAttendance(student.id, "absent", "Class Teacher")}>
            <CalendarX className="size-3.5" /> Absent
          </Button>
          <Button size="sm" variant="outline" onClick={() => markAttendance(student.id, "late", "Class Teacher")}>
            <Clock className="size-3.5" /> Late
          </Button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Present" value={`${attendance.presentPercent}%`} tone={attendance.presentPercent < 75 ? "error" : "success"} />
        <StatTile label="Present days" value={String(attendance.presentDays)} tone="success" />
        <StatTile label="Absent days" value={String(attendance.absentDays)} tone="error" />
        <StatTile label="Late days" value={String(attendance.lateDays)} tone="warning" />
      </div>

      <div className="rounded-lg border border-border p-sm">
        <h3 className="mb-sm text-sm font-semibold text-foreground">Last 7 days</h3>
        <div className="flex h-16 items-end gap-1">
          {attendance.trend7Day.map((value, i) => (
            <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1">
              <div className="w-full rounded-sm bg-info" style={{ height: `${Math.max(4, (value / 100) * 56)}px` }} title={`${value}%`} />
              <span className="text-[9px] text-muted-foreground">{value}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
