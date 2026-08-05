import { getSnapshot, setState } from "@/lib/data/store";
import type { AttendanceMode, AttendanceRecord, AttendanceSession, AttendanceStatus } from "@/lib/types/attendance";
import { generateId } from "@/lib/utils";

function sameDay(a: string, b: string) {
  return a.slice(0, 10) === b.slice(0, 10);
}

export function findSession(sectionId: string, date: string, mode: AttendanceMode, period?: number): AttendanceSession | undefined {
  return getSnapshot().attendanceSessions.find(
    (s) => s.sectionId === sectionId && sameDay(s.date, date) && s.mode === mode && (mode !== "period" || s.period === period),
  );
}

export function saveAttendanceSession(input: {
  classId: string;
  sectionId: string;
  date: string;
  mode: AttendanceMode;
  period?: number;
  subjectId?: string;
  records: AttendanceRecord[];
  markedBy: string;
}): AttendanceSession {
  const existing = findSession(input.sectionId, input.date, input.mode, input.period);
  const session: AttendanceSession = {
    id: existing?.id ?? generateId("att"),
    classId: input.classId,
    sectionId: input.sectionId,
    date: input.date,
    mode: input.mode,
    period: input.period,
    subjectId: input.subjectId,
    markedBy: input.markedBy,
    markedAt: new Date().toISOString(),
    locked: false,
    notifiedParents: false,
    records: input.records,
  };
  setState((db) => ({
    ...db,
    attendanceSessions: existing ? db.attendanceSessions.map((s) => (s.id === existing.id ? session : s)) : [session, ...db.attendanceSessions],
  }));
  return session;
}

export function updateRecordStatus(sessionId: string, studentId: string, status: AttendanceStatus, note?: string) {
  setState((db) => ({
    ...db,
    attendanceSessions: db.attendanceSessions.map((s) =>
      s.id === sessionId
        ? { ...s, records: s.records.map((r) => (r.studentId === studentId ? { ...r, status, note: note ?? r.note } : r)) }
        : s,
    ),
  }));
}

export function lockSession(sessionId: string) {
  setState((db) => ({ ...db, attendanceSessions: db.attendanceSessions.map((s) => (s.id === sessionId ? { ...s, locked: true } : s)) }));
}

export function isWithinEditWindow(session: AttendanceSession, editLockHours: number): boolean {
  const hoursSince = (Date.now() - new Date(session.markedAt).getTime()) / 3600000;
  return hoursSince <= editLockHours;
}

export function updateAttendanceRule(ruleId: string, patch: { value?: number; enabled?: boolean }) {
  setState((db) => ({ ...db, attendanceRules: db.attendanceRules.map((r) => (r.id === ruleId ? { ...r, ...patch } : r)) }));
}

export function notifyParentsForAbsences(sessionId: string) {
  setState((db) => ({ ...db, attendanceSessions: db.attendanceSessions.map((s) => (s.id === sessionId ? { ...s, notifiedParents: true } : s)) }));
}
