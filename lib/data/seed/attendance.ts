import type { AttendanceRecord, AttendanceRule, AttendanceSession, LeaveRequest, StaffAttendance } from "@/lib/types/attendance";
import { schoolClasses } from "./reference";
import { teachers } from "./academics";
import { seededHelpers } from "./rng";

const helpers = seededHelpers(11072026);
const { int, bool, daysAgoIso } = helpers;

export const attendanceRules: AttendanceRule[] = [
  { id: "rule-min-percent", key: "minAttendancePercent", label: "Minimum attendance percentage", description: "Below this, a student is flagged as attendance-risk.", value: 75, unit: "percent", enabled: true },
  { id: "rule-late-threshold", key: "lateThresholdMinutes", label: "Late arrival threshold", description: "Arrivals later than this many minutes into the period count as late.", value: 10, unit: "minutes", enabled: true },
  { id: "rule-half-day", key: "halfDayThresholdMinutes", label: "Half-day rule", description: "Missing more than this many minutes of the day counts as a half day.", value: 180, unit: "minutes", enabled: true },
  { id: "rule-consecutive-absence", key: "consecutiveAbsenceAlert", label: "Consecutive absence rule", description: "Consecutive absences before an automatic alert is raised.", value: 3, unit: "days", enabled: true },
  { id: "rule-parent-alert", key: "parentAlertThreshold", label: "Parent alert threshold", description: "Absences within a month before parents are notified.", value: 4, unit: "count", enabled: true },
  { id: "rule-exam-eligibility", key: "examEligibilityPercent", label: "Exam eligibility threshold", description: "Minimum attendance percentage required to sit term exams.", value: 80, unit: "percent", enabled: true },
  { id: "rule-monthly-shortage", key: "monthlyShortageWarning", label: "Monthly shortage warning", description: "Attendance percentage in a month that triggers a shortage warning.", value: 70, unit: "percent", enabled: true },
  { id: "rule-edit-lock", key: "editLockHours", label: "Edit-lock duration", description: "Hours after submission during which attendance can still be edited.", value: 24, unit: "hours", enabled: true },
];

// Last 12 school days (Mon-Sat) per active section, seeded so the attendance
// analytics/reports pages have real trend data to show, not just today.
export function generateAttendanceSessions(students: { id: string; sectionId: string; status: string }[]): AttendanceSession[] {
  const sessions: AttendanceSession[] = [];
  const sectionIds = schoolClasses.flatMap((c) => c.sections.map((s) => s.id));

  for (const sectionId of sectionIds) {
    const sectionStudents = students.filter((s) => s.sectionId === sectionId && s.status === "active");
    if (sectionStudents.length === 0) continue;

    let daysGenerated = 0;
    let dayOffset = 0;
    while (daysGenerated < 12 && dayOffset < 20) {
      dayOffset += 1;
      const date = new Date();
      date.setUTCDate(date.getUTCDate() - dayOffset);
      const weekday = date.getUTCDay();
      if (weekday === 0) continue; // Sunday off

      const records: AttendanceRecord[] = sectionStudents.map((student) => {
        const roll = int(0, 99);
        if (roll < 88) return { studentId: student.id, status: "present" as const };
        if (roll < 94) return { studentId: student.id, status: "late" as const, lateMinutes: int(5, 25) };
        if (roll < 98) return { studentId: student.id, status: "absent" as const };
        return { studentId: student.id, status: "excused" as const, note: "Informed in advance" };
      });

      sessions.push({
        id: `att-${sectionId}-${dayOffset}`,
        classId: schoolClasses.find((c) => c.sections.some((s) => s.id === sectionId))!.id,
        sectionId,
        date: date.toISOString(),
        mode: "daily",
        markedBy: "Class Teacher",
        markedAt: date.toISOString(),
        locked: dayOffset > 1,
        notifiedParents: bool(0.7),
        records,
      });
      daysGenerated += 1;
    }
  }

  return sessions;
}

export const leaveRequests: LeaveRequest[] = [
  {
    id: "leave-1",
    applicantType: "staff",
    applicantId: teachers[11].id,
    applicantName: teachers[11].name,
    leaveType: "medical",
    startDate: daysAgoIso(-1),
    endDate: daysAgoIso(-4),
    halfDay: false,
    reason: "Scheduled minor surgery, recovery advised by physician.",
    submittedAt: daysAgoIso(6),
    status: "approved",
    reviewerName: "Principal",
  },
  {
    id: "leave-2",
    applicantType: "staff",
    applicantId: teachers[3].id,
    applicantName: teachers[3].name,
    leaveType: "casual",
    startDate: daysAgoIso(-2),
    endDate: daysAgoIso(-2),
    halfDay: true,
    reason: "Family function.",
    submittedAt: daysAgoIso(3),
    status: "submitted",
  },
  {
    id: "leave-3",
    applicantType: "staff",
    applicantId: teachers[6].id,
    applicantName: teachers[6].name,
    leaveType: "official-duty",
    startDate: daysAgoIso(-5),
    endDate: daysAgoIso(-5),
    halfDay: false,
    reason: "Attending district curriculum workshop.",
    submittedAt: daysAgoIso(4),
    status: "under-review",
  },
  {
    id: "leave-4",
    applicantType: "staff",
    applicantId: teachers[8].id,
    applicantName: teachers[8].name,
    leaveType: "sick",
    startDate: daysAgoIso(1),
    endDate: daysAgoIso(1),
    halfDay: false,
    reason: "Fever, unfit to travel.",
    submittedAt: daysAgoIso(1),
    status: "rejected",
    reviewerName: "Principal",
    reviewerNote: "Please resubmit with a medical certificate for retroactive leave.",
  },
];

// Today's staff attendance snapshot — the Staff Attendance dashboard is
// primarily "today" plus the leave-integration rows above.
export const staffAttendanceToday: StaffAttendance[] = teachers.map((teacher, index) => {
  const onLeave = teacher.status === "on-leave";
  const roll = int(0, 99);
  const status = onLeave ? "on-leave" : roll < 78 ? "present" : roll < 88 ? "late" : roll < 94 ? "not-checked-in" : "absent";
  return {
    id: `staff-att-${teacher.id}`,
    staffId: teacher.id,
    staffName: teacher.name,
    department: teacher.department,
    date: new Date().toISOString(),
    checkIn: status === "present" || status === "late" ? `0${7 + (index % 2)}:${String(int(0, 59)).padStart(2, "0")}` : undefined,
    checkOut: status === "present" ? `${15 + (index % 3)}:${String(int(0, 59)).padStart(2, "0")}` : undefined,
    shift: "Morning · 07:45 – 15:30",
    status: status as StaffAttendance["status"],
    lateMinutes: status === "late" ? int(5, 30) : undefined,
    source: bool(0.7) ? "biometric" : "manual",
  };
});
