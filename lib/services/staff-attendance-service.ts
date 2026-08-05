import { setState } from "@/lib/data/store";
import type { StaffAttendance } from "@/lib/types/attendance";

export function checkIn(staffId: string, time: string) {
  setState((db) => ({
    ...db,
    staffAttendance: db.staffAttendance.map((a) => (a.staffId === staffId ? { ...a, checkIn: time, status: "present" as const } : a)),
  }));
}

export function checkOut(staffId: string, time: string) {
  setState((db) => ({ ...db, staffAttendance: db.staffAttendance.map((a) => (a.staffId === staffId ? { ...a, checkOut: time } : a)) }));
}

export function correctAttendance(staffId: string, patch: Partial<StaffAttendance>, correctedBy: string) {
  setState((db) => ({
    ...db,
    staffAttendance: db.staffAttendance.map((a) => (a.staffId === staffId ? { ...a, ...patch, source: "manual", correctedBy } : a)),
  }));
}
