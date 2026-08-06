import type { ExamAttendanceRecord, ExamSubject } from "@/lib/types/exams";
import type { StudentMark } from "@/lib/types/marks";

export type MarksSummary = {
  totalStudents: number;
  enteredCount: number;
  missingStudentIds: string[];
  highest: number;
  lowest: number;
  average: number;
  passedCount: number;
  failedCount: number;
  failedStudentIds: string[];
  /** Entered but more than 2 standard deviations from the mean — worth a second look, not necessarily wrong. */
  unusualStudentIds: string[];
};

export function computeMarksSummary(
  roster: { id: string }[],
  marks: StudentMark[],
  attendance: ExamAttendanceRecord[],
  examSubject: Pick<ExamSubject, "id" | "passingMarks">,
): MarksSummary {
  const attendanceByStudent = new Map(attendance.map((a) => [a.studentId, a.status]));
  const exemptStatuses = new Set(["absent", "exempted", "malpractice", "withheld"]);
  const expected = roster.filter((s) => !exemptStatuses.has(attendanceByStudent.get(s.id) ?? ""));

  const entries = expected
    .map((s) => ({ studentId: s.id, total: marks.find((m) => m.studentId === s.id)?.total }))
    .filter((e): e is { studentId: string; total: number } => e.total !== undefined);

  const missingStudentIds = expected.filter((s) => !entries.some((e) => e.studentId === s.id)).map((s) => s.id);
  const totals = entries.map((e) => e.total);
  const average = totals.length > 0 ? totals.reduce((sum, t) => sum + t, 0) / totals.length : 0;
  const variance = totals.length > 0 ? totals.reduce((sum, t) => sum + (t - average) ** 2, 0) / totals.length : 0;
  const stdDev = Math.sqrt(variance);

  const failedStudentIds = entries.filter((e) => e.total < examSubject.passingMarks).map((e) => e.studentId);
  const unusualStudentIds = stdDev > 0 ? entries.filter((e) => Math.abs(e.total - average) > 2 * stdDev).map((e) => e.studentId) : [];

  return {
    totalStudents: roster.length,
    enteredCount: entries.length,
    missingStudentIds,
    highest: totals.length > 0 ? Math.max(...totals) : 0,
    lowest: totals.length > 0 ? Math.min(...totals) : 0,
    average: Math.round(average * 10) / 10,
    passedCount: entries.length - failedStudentIds.length,
    failedCount: failedStudentIds.length,
    failedStudentIds,
    unusualStudentIds,
  };
}
