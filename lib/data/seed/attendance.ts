import type { AttendanceRecord, AttendanceSession, LeaveRequest } from "@/lib/types/attendance";
import { schoolClasses } from "./reference";
import { teachers } from "./academics";
import { seededHelpers } from "./rng";

const helpers = seededHelpers(11072026);
const { int, bool, daysAgoIso } = helpers;

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
