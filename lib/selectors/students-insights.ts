import type { Student } from "@/lib/types/students";

export function activeStudentCount(students: Student[]): number {
  return students.filter((s) => s.status === "active").length;
}

export function newAdmissionsThisMonth(students: Student[], nowIso = new Date().toISOString()): number {
  const now = new Date(nowIso).getTime();
  const monthMs = 30 * 24 * 60 * 60 * 1000;
  return students.filter((s) => now - new Date(s.admissionDate).getTime() <= monthMs).length;
}

export function genderSplit(students: Student[]): { boys: number; girls: number; other: number } {
  return students.reduce(
    (acc, s) => {
      if (s.profile.gender === "male") acc.boys += 1;
      else if (s.profile.gender === "female") acc.girls += 1;
      else acc.other += 1;
      return acc;
    },
    { boys: 0, girls: 0, other: 0 },
  );
}

export function attendanceRiskCount(students: Student[], threshold = 75): number {
  return students.filter((s) => s.status === "active" && s.attendance.presentPercent < threshold).length;
}

export function feeRiskCount(students: Student[]): number {
  return students.filter((s) => s.status === "active" && (s.fees.status === "overdue" || s.fees.status === "partial")).length;
}

export function missingDocumentStudentCount(students: Student[]): number {
  return students.filter((s) => s.documents.some((d) => d.status === "missing" || d.status === "re-upload-requested")).length;
}

export function transportUserCount(students: Student[]): number {
  return students.filter((s) => Boolean(s.transport)).length;
}

export function classDistribution(students: Student[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const s of students) map.set(s.classId, (map.get(s.classId) ?? 0) + 1);
  return map;
}
