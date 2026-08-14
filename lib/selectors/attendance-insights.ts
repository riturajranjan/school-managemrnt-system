import type { AttendanceSession } from "@/lib/types/attendance";

export function presentPercentFor(sessions: AttendanceSession[]): number {
  const allRecords = sessions.flatMap((s) => s.records);
  if (allRecords.length === 0) return 0;
  const present = allRecords.filter((r) => r.status === "present" || r.status === "late").length;
  return Math.round((present / allRecords.length) * 100);
}

export function unmarkedSectionsToday(allSectionIds: string[], sessions: AttendanceSession[]): string[] {
  const today = new Date().toISOString().slice(0, 10);
  const markedToday = new Set(sessions.filter((s) => s.date.slice(0, 10) === today && s.mode === "daily").map((s) => s.sectionId));
  return allSectionIds.filter((id) => !markedToday.has(id));
}

