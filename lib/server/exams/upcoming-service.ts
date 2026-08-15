// Upcoming exams (Phase 9A) — a real, read-only projection of ExamScheduleEntry
// for the Main Dashboard and My Day. Never a mock event array: every row is a
// real scheduled paper, dated today or later, on a real (non-draft, non-
// archived) Exam. Shared by both callers so there is exactly one "what's
// upcoming" query, not two slightly-different reimplementations.
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import type { OrgScope } from "@/lib/server/api/scope";
import type { UpcomingExamDto } from "@/lib/api/contracts";
import { dateToUi, serverToday } from "@/lib/server/attendance/service";

function requireSession(scope: OrgScope): string {
  if (!scope.academicSessionId) throw new HttpError("INVALID_SESSION", "Select an academic session first");
  return scope.academicSessionId;
}

/**
 * Upcoming real exam papers.
 *
 * - `staffId` given: ONE row per real ExamScheduleEntry this teacher owns (via
 *   a real TeachingAssignment for that section+subject) — section/subject
 *   populated, so a teacher sees exactly which of their own papers is next.
 * - `staffId` omitted: a school-wide view collapsed to ONE row per Exam (the
 *   earliest upcoming date across all its papers) — section/subject are null
 *   since the view spans many sections, not one teacher's own lessons.
 */
export async function listUpcomingExams(scope: OrgScope, opts: { staffId?: string; limit?: number } = {}): Promise<UpcomingExamDto[]> {
  const today = serverToday();
  const limit = opts.limit ?? 10;

  const entries = await prisma.examScheduleEntry.findMany({
    where: {
      schoolId: scope.schoolId, academicSessionId: requireSession(scope),
      examDate: { gte: new Date(`${today}T00:00:00.000Z`) },
      exam: { status: { notIn: ["DRAFT", "ARCHIVED"] } },
    },
    orderBy: [{ examDate: "asc" }],
    select: {
      examId: true, examDate: true, sectionId: true, subjectId: true,
      exam: { select: { name: true, term: { select: { name: true } } } },
      section: { select: { id: true, name: true, classId: true, class: { select: { name: true } } } },
      subject: { select: { id: true, code: true, name: true, color: true } },
    },
    take: 500, // bounded working set for the in-memory ownership filter/collapse below — never unbounded
  });
  if (entries.length === 0) return [];

  let scoped = entries;
  if (opts.staffId) {
    const assignments = await prisma.teachingAssignment.findMany({ where: { staffId: opts.staffId, schoolId: scope.schoolId }, select: { sectionId: true, subjectId: true } });
    const owned = new Set(assignments.map((a) => `${a.sectionId}::${a.subjectId}`));
    scoped = entries.filter((e) => owned.has(`${e.sectionId}::${e.subjectId}`));
    return scoped.slice(0, limit).map((e) => ({
      examId: e.examId, examName: e.exam.name, examDate: dateToUi(e.examDate), termName: e.exam.term.name,
      section: { id: e.section.id, name: e.section.name, classId: e.section.classId, className: e.section.class.name },
      subject: { id: e.subject.id, code: e.subject.code, name: e.subject.name, color: e.subject.color },
    }));
  }

  // School-wide: collapse to one row per exam (earliest date — `entries` is
  // already sorted by examDate ascending, so the first occurrence wins).
  const seen = new Set<string>();
  const collapsed: UpcomingExamDto[] = [];
  for (const e of scoped) {
    if (seen.has(e.examId)) continue;
    seen.add(e.examId);
    collapsed.push({ examId: e.examId, examName: e.exam.name, examDate: dateToUi(e.examDate), termName: e.exam.term.name, section: null, subject: null });
    if (collapsed.length >= limit) break;
  }
  return collapsed;
}
