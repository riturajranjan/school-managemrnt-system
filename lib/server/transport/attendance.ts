// Transport Attendance — a real, read-only summary over TransportTripStudent
// for one date, grouped by route/stop/student. Deliberately NOT student
// academic attendance (Phase 5/7C), and deliberately NOT re-implementing the
// mock's richer 7+7 status vocabulary — only the real EXPECTED/BOARDED/
// ABSENT + ONBOARD/DROPPED enums exist. Marking happens on the trip detail
// page (markStudentBoarding/markStudentDrop, trips.ts) — this is a summary
// view only.
import { prisma } from "@/lib/db/prisma";
import type { OrgScope } from "@/lib/server/api/scope";
import type { TransportAttendanceDto } from "@/lib/api/contracts";

export async function getAttendanceForDate(scope: OrgScope, date: string): Promise<TransportAttendanceDto> {
  const dateObj = new Date(`${date}T00:00:00.000Z`);
  const rows = await prisma.transportTripStudent.findMany({
    where: { trip: { schoolId: scope.schoolId, date: dateObj, ...(scope.branchId ? { branchId: scope.branchId } : {}) } },
    select: {
      id: true, studentId: true, boardingStatus: true, dropStatus: true,
      student: { select: { firstName: true, lastName: true } },
      stop: { select: { id: true, name: true } },
      trip: { select: { routeId: true, route: { select: { name: true } } } },
    },
  });

  const byRoute = new Map<string, { routeName: string; expected: number; boarded: number; dropped: number; absent: number }>();
  const byStop = new Map<string, { stopName: string; expected: number; boarded: number; absent: number }>();
  const students: TransportAttendanceDto["students"] = [];

  for (const r of rows) {
    const route = byRoute.get(r.trip.routeId) ?? { routeName: r.trip.route.name, expected: 0, boarded: 0, dropped: 0, absent: 0 };
    route.expected += 1;
    if (r.boardingStatus === "BOARDED") route.boarded += 1;
    if (r.boardingStatus === "ABSENT") route.absent += 1;
    if (r.dropStatus === "DROPPED") route.dropped += 1;
    byRoute.set(r.trip.routeId, route);

    const stop = byStop.get(r.stop.id) ?? { stopName: r.stop.name, expected: 0, boarded: 0, absent: 0 };
    stop.expected += 1;
    if (r.boardingStatus === "BOARDED") stop.boarded += 1;
    if (r.boardingStatus === "ABSENT") stop.absent += 1;
    byStop.set(r.stop.id, stop);

    students.push({
      tripStudentId: r.id, studentId: r.studentId, studentName: `${r.student.firstName} ${r.student.lastName ?? ""}`.trim(), routeName: r.trip.route.name,
      boardingStatus: r.boardingStatus.toLowerCase() as TransportAttendanceDto["students"][number]["boardingStatus"],
      dropStatus: r.dropStatus.toLowerCase() as TransportAttendanceDto["students"][number]["dropStatus"],
    });
  }

  return {
    date,
    expected: rows.length,
    boarded: rows.filter((r) => r.boardingStatus === "BOARDED").length,
    missed: rows.filter((r) => r.boardingStatus === "ABSENT").length,
    byRoute: [...byRoute.entries()].map(([routeId, v]) => ({ routeId, ...v })),
    byStop: [...byStop.entries()].map(([stopId, v]) => ({ stopId, ...v })),
    students,
  };
}
