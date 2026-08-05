import type { AttendanceSession } from "@/lib/types/attendance";

export function presentPercentFor(sessions: AttendanceSession[]): number {
  const allRecords = sessions.flatMap((s) => s.records);
  if (allRecords.length === 0) return 0;
  const present = allRecords.filter((r) => r.status === "present" || r.status === "late").length;
  return Math.round((present / allRecords.length) * 100);
}

export function lateArrivalCount(sessions: AttendanceSession[]): number {
  return sessions.flatMap((s) => s.records).filter((r) => r.status === "late").length;
}

export function unmarkedSectionsToday(allSectionIds: string[], sessions: AttendanceSession[]): string[] {
  const today = new Date().toISOString().slice(0, 10);
  const markedToday = new Set(sessions.filter((s) => s.date.slice(0, 10) === today && s.mode === "daily").map((s) => s.sectionId));
  return allSectionIds.filter((id) => !markedToday.has(id));
}

export function dailyTrend(sessions: AttendanceSession[], days = 7): { date: string; percent: number }[] {
  const byDate = new Map<string, AttendanceSession[]>();
  for (const session of sessions) {
    const key = session.date.slice(0, 10);
    byDate.set(key, [...(byDate.get(key) ?? []), session]);
  }
  return [...byDate.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-days)
    .map(([date, sessionsForDate]) => ({ date, percent: presentPercentFor(sessionsForDate) }));
}

export function consecutiveAbsenceStudents(sessions: AttendanceSession[], threshold: number): Set<string> {
  const byStudent = new Map<string, AttendanceSession[]>();
  for (const session of sessions) {
    for (const record of session.records) {
      byStudent.set(record.studentId, [...(byStudent.get(record.studentId) ?? []), session]);
    }
  }
  const atRisk = new Set<string>();
  for (const [studentId, studentSessions] of byStudent) {
    const sorted = [...studentSessions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    let streak = 0;
    for (const session of sorted) {
      const record = session.records.find((r) => r.studentId === studentId);
      if (record?.status === "absent") {
        streak += 1;
        if (streak >= threshold) {
          atRisk.add(studentId);
          break;
        }
      } else {
        break;
      }
    }
  }
  return atRisk;
}
