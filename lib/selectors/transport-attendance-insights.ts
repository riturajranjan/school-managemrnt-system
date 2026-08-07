import type { Db } from "@/lib/data/store";
import type { TransportAttendance } from "@/lib/types/transport";

export type RouteAttendanceSummary = { routeId: string; routeName: string; expected: number; boarded: number; dropped: number; missed: number };

export function routeAttendanceSummary(db: Db, date: string): RouteAttendanceSummary[] {
  return db.transportRoutes.map((route) => {
    const rows = db.transportAttendance.filter((a) => a.routeId === route.id && a.date === date);
    return {
      routeId: route.id,
      routeName: route.name,
      expected: rows.length,
      boarded: rows.filter((a) => a.pickupStatus === "boarded" || a.pickupStatus === "alternate-pickup").length,
      dropped: rows.filter((a) => a.dropStatus === "dropped").length,
      missed: rows.filter((a) => a.pickupStatus === "missed").length,
    };
  });
}

export type StopAttendanceSummary = { stopId: string; stopName: string; expected: number; boarded: number; missed: number };

export function stopAttendanceSummary(db: Db, date: string): StopAttendanceSummary[] {
  const rows = db.transportAttendance.filter((a) => a.date === date);
  const byStop = new Map<string, TransportAttendance[]>();
  for (const row of rows) {
    const tripStudent = db.tripStudents.find((ts) => ts.tripId === row.tripId && ts.studentId === row.studentId);
    if (!tripStudent) continue;
    byStop.set(tripStudent.stopId, [...(byStop.get(tripStudent.stopId) ?? []), row]);
  }
  return Array.from(byStop.entries()).map(([stopId, entries]) => ({
    stopId,
    stopName: db.transportStops.find((s) => s.id === stopId)?.name ?? stopId,
    expected: entries.length,
    boarded: entries.filter((a) => a.pickupStatus === "boarded" || a.pickupStatus === "alternate-pickup").length,
    missed: entries.filter((a) => a.pickupStatus === "missed").length,
  }));
}

export function attendanceForDate(db: Db, date: string): TransportAttendance[] {
  return db.transportAttendance.filter((a) => a.date === date);
}
