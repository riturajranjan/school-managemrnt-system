// Main Dashboard aggregation (Phase 9A). One server-side aggregation layer so
// the frontend composes real DTOs, never mock + real. Attendance is the exact
// canonical Phase 5B DTO (getDashboard), reused verbatim — never recomputed.
// Today's Timetable is real only for an actor with a real teaching Staff
// profile (never a fabricated "personal" timetable for an admin/principal
// without one) and shares its query path with My Day. Upcoming exams are
// personalized for a teaching actor, school-wide otherwise.
import type { OrgScope } from "@/lib/server/api/scope";
import type { SchoolDashboardSummaryDto } from "@/lib/api/contracts";
import { serverToday } from "@/lib/server/attendance/service";
import { weekdayOf } from "@/lib/server/attendance/period-service";
import { getDashboard as getAttendanceDashboard } from "@/lib/server/attendance/reports";
import { getCurrentStaffProfile } from "@/lib/server/staff/service";
import { getEnrichedDayTimetable } from "@/lib/server/my-day/service";
import { listUpcomingExams } from "@/lib/server/exams/upcoming-service";

export async function getDashboardSummary(scope: OrgScope): Promise<SchoolDashboardSummaryDto> {
  const today = serverToday();
  const weekday = weekdayOf(today);
  const staff = await getCurrentStaffProfile(scope);
  const isTeaching = Boolean(staff && staff.isTeaching);

  const [attendance, todaysEntries, upcomingExams] = await Promise.all([
    getAttendanceDashboard(scope),
    isTeaching ? getEnrichedDayTimetable(scope, staff!.id, weekday) : Promise.resolve([]),
    listUpcomingExams(scope, isTeaching ? { staffId: staff!.id } : {}),
  ]);

  return {
    date: today,
    weekday,
    attendance,
    todaysTimetable: { available: isTeaching, entries: todaysEntries },
    upcomingExams,
  };
}
