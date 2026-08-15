// Report Cards (Phase 8D) — a pure PRESENTATION layer over an already-published,
// immutable ExamResultPublication/StudentExamResult snapshot (Phase 8C). This
// file NEVER recomputes marks, grades or percentages, and NEVER reads live
// ExamMark/GradingScheme data — every academic value is read straight off the
// frozen StudentExamResult row (including the historical classId/className/
// sectionId/sectionName captured at publish time, see lib/server/results/
// service.ts). An unpublished exam has no report cards: callers get a fail-
// closed RESULT_NOT_PUBLISHED rather than a live preview rendered as official.
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import type { OrgScope } from "@/lib/server/api/scope";
import type { ExamResultStatus, ExamSubjectResultDto, ExamType, ReportCardDto, ReportCardExamSummaryDto, ReportCardRosterEntryDto } from "@/lib/api/contracts";

function requireSession(scope: OrgScope): string {
  if (!scope.academicSessionId) throw new HttpError("INVALID_SESSION", "Select an academic session first");
  return scope.academicSessionId;
}

const dateOnly = (d: Date) => d.toISOString().slice(0, 10);
const typeToUi = (t: string): ExamType => t.toLowerCase().replace(/_/g, "-") as ExamType;

type PublicationWithExam = {
  id: string;
  publishedAt: Date;
  publishedByName: string | null;
  studentCount: number;
  exam: { id: string; name: string; code: string; type: string; startsOn: Date; endsOn: Date; term: { id: string; name: string } };
};

async function requirePublication(scope: OrgScope, examId: string): Promise<PublicationWithExam> {
  const publication = await prisma.examResultPublication.findFirst({
    where: { examId, schoolId: scope.schoolId, academicSessionId: requireSession(scope) },
    select: {
      id: true, publishedAt: true, publishedByName: true, studentCount: true,
      exam: { select: { id: true, name: true, code: true, type: true, startsOn: true, endsOn: true, term: { select: { id: true, name: true } } } },
    },
  });
  if (!publication) {
    // Distinguish "exam doesn't exist / isn't yours" from "exam exists but has
    // no published results yet" so the UI can show an honest, specific state.
    const exam = await prisma.exam.findFirst({ where: { id: examId, schoolId: scope.schoolId, academicSessionId: requireSession(scope) }, select: { id: true } });
    if (!exam) throw new HttpError("EXAM_NOT_FOUND", "Exam not found");
    throw new HttpError("RESULT_NOT_PUBLISHED", "Results for this exam have not been published yet — report cards are not available.");
  }
  return publication;
}

function examSummary(pub: PublicationWithExam): ReportCardExamSummaryDto {
  return {
    examId: pub.exam.id, examName: pub.exam.name, examCode: pub.exam.code, termName: pub.exam.term.name,
    startsOn: dateOnly(pub.exam.startsOn), endsOn: dateOnly(pub.exam.endsOn),
    publishedAt: pub.publishedAt.toISOString(), publishedByName: pub.publishedByName, studentCount: pub.studentCount,
  };
}

/** Every published exam in scope, most recent first — powers the Report Cards hub. */
export async function listPublishedExams(scope: OrgScope): Promise<ReportCardExamSummaryDto[]> {
  const publications = await prisma.examResultPublication.findMany({
    where: { schoolId: scope.schoolId, academicSessionId: requireSession(scope) },
    orderBy: [{ publishedAt: "desc" }],
    select: {
      id: true, publishedAt: true, publishedByName: true, studentCount: true,
      exam: { select: { id: true, name: true, code: true, type: true, startsOn: true, endsOn: true, term: { select: { id: true, name: true } } } },
    },
  });
  return publications.map(examSummary);
}

/** The published-result roster for one exam, optionally text-searched. */
export async function getReportCardRoster(scope: OrgScope, examId: string, search?: string): Promise<{ exam: ReportCardExamSummaryDto; students: ReportCardRosterEntryDto[] }> {
  const pub = await requirePublication(scope, examId);
  const q = search?.trim();
  const rows = await prisma.studentExamResult.findMany({
    where: {
      publicationId: pub.id,
      ...(q ? { student: { OR: [{ firstName: { contains: q, mode: "insensitive" } }, { lastName: { contains: q, mode: "insensitive" } }, { admissionNumber: { contains: q, mode: "insensitive" } }] } } : {}),
    },
    select: {
      studentId: true, className: true, sectionName: true,
      totalMaxMarks: true, totalMarksObtained: true, percentage: true, grade: true, status: true,
      student: { select: { admissionNumber: true, rollNumber: true, firstName: true, lastName: true } },
    },
  });
  const students: ReportCardRosterEntryDto[] = rows.map((r) => ({
    studentId: r.studentId, admissionNumber: r.student.admissionNumber, rollNumber: r.student.rollNumber,
    name: `${r.student.firstName} ${r.student.lastName}`.trim(), className: r.className, sectionName: r.sectionName,
    totalMaxMarks: r.totalMaxMarks, totalMarksObtained: r.totalMarksObtained, percentage: r.percentage, grade: r.grade,
    status: r.status.toLowerCase() as ExamResultStatus,
  }));
  students.sort((a, b) => (a.rollNumber ?? "").localeCompare(b.rollNumber ?? "", undefined, { numeric: true }) || a.name.localeCompare(b.name));
  return { exam: examSummary(pub), students };
}

/** The full official report card for one student — school header, historical
 *  class/section, the frozen subject breakdown and overall summary. */
export async function getReportCard(scope: OrgScope, examId: string, studentId: string): Promise<ReportCardDto> {
  const pub = await requirePublication(scope, examId);
  const [result, school] = await Promise.all([
    prisma.studentExamResult.findFirst({
      where: { publicationId: pub.id, studentId },
      select: {
        className: true, sectionName: true, subjectResults: true,
        totalMaxMarks: true, totalMarksObtained: true, percentage: true, grade: true, status: true,
        student: { select: { admissionNumber: true, rollNumber: true, firstName: true, lastName: true } },
      },
    }),
    prisma.school.findUnique({ where: { id: scope.schoolId }, select: { name: true, branding: { select: { logoUrl: true } } } }),
  ]);
  if (!result) throw new HttpError("STUDENT_RESULT_NOT_FOUND", "No published result for this student on this exam.");

  return {
    exam: { id: pub.exam.id, name: pub.exam.name, code: pub.exam.code, type: typeToUi(pub.exam.type), startsOn: dateOnly(pub.exam.startsOn), endsOn: dateOnly(pub.exam.endsOn), term: pub.exam.term },
    publishedAt: pub.publishedAt.toISOString(), publishedByName: pub.publishedByName,
    school: { name: school?.name ?? "", logoUrl: school?.branding?.logoUrl ?? null },
    student: { id: studentId, name: `${result.student.firstName} ${result.student.lastName}`.trim(), admissionNumber: result.student.admissionNumber, rollNumber: result.student.rollNumber },
    classContext: { className: result.className, sectionName: result.sectionName },
    subjects: result.subjectResults as unknown as ExamSubjectResultDto[],
    summary: { totalMaxMarks: result.totalMaxMarks, totalMarksObtained: result.totalMarksObtained, percentage: result.percentage, grade: result.grade, status: result.status.toLowerCase() as ExamResultStatus },
  };
}
