// Result computation + publication (Phase 8C). Results are DERIVED, never a
// second editable marks store: every computation reads real Exam →
// ExamScheduleEntry → ExamMarkSheet → ExamMark and nothing else. Before
// publication, GET returns a LIVE preview (published: false) recomputed on
// every call. At publication, an immutable ExamResultPublication +
// StudentExamResult snapshot is written in one transaction — including the
// exact grading bands used — and every later GET prefers that frozen snapshot
// over live computation, so a subsequent grading-scheme edit, Subject/Staff
// change, or Enrollment change can never alter a historical published result.
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import type { OrgScope } from "@/lib/server/api/scope";
import type { ExamMarkStatus, ExamResultsDto, ExamSubjectResultDto, GradingBandDto, StudentExamResultDto } from "@/lib/api/contracts";
import { computeOverallResult, computeSubjectResult, resolveGrade, type GradingBandLike, type MarkForResult, type ScheduleEntryForResult } from "./engine";

function requireSession(scope: OrgScope): string {
  if (!scope.academicSessionId) throw new HttpError("INVALID_SESSION", "Select an academic session first");
  return scope.academicSessionId;
}

const MARK_STATUS_TO_UI: Record<string, ExamMarkStatus> = { PENDING: "pending", MARKED: "marked", ABSENT: "absent", EXEMPT: "exempt" };

type ExamWithGrading = { id: string; gradingSchemeId: string | null; gradingScheme: { id: string; name: string; bands: GradingBandDto[] } | null };

async function requireExamWithGrading(scope: OrgScope, examId: string): Promise<ExamWithGrading> {
  const e = await prisma.exam.findFirst({
    where: { id: examId, schoolId: scope.schoolId, academicSessionId: requireSession(scope) },
    select: { id: true, gradingSchemeId: true, gradingScheme: { select: { id: true, name: true, bands: { orderBy: { order: "asc" }, select: { id: true, label: true, minPercent: true, maxPercent: true, isPass: true, color: true, order: true } } } } },
  });
  if (!e) throw new HttpError("EXAM_NOT_FOUND", "Exam not found");
  return e;
}

// ── Roster: for every ExamScheduleEntry, current ENROLLED ∪ anyone already
// marked — exam-wide, batched (no N+1 per entry), mirroring the Phase 8B
// roster resolver's historical-safety principle. ─────────────────────────────

type StudentAgg = {
  studentId: string; enrollmentId: string | null; admissionNumber: string; rollNumber: string | null; name: string;
  entries: ScheduleEntryForResult[]; marks: Map<string, MarkForResult>;
};

/** The class/section a given ExamScheduleEntry was scheduled against — the
 *  historically-stable "class/section context of the exam" (Phase 8D report
 *  cards), independent of a student's later Enrollment changes. */
export type SectionContext = { classId: string; className: string; sectionId: string; sectionName: string };

async function resolveExamRoster(examId: string): Promise<{ roster: Map<string, StudentAgg>; sectionByEntryId: Map<string, SectionContext> }> {
  const entries = await prisma.examScheduleEntry.findMany({
    where: { examId },
    orderBy: [{ examDate: "asc" }],
    select: {
      id: true, sectionId: true, subjectId: true, maxMarks: true, passingMarks: true, subject: { select: { name: true, code: true } },
      section: { select: { id: true, name: true, classId: true, class: { select: { name: true } } } },
    },
  });
  const roster = new Map<string, StudentAgg>();
  const sectionByEntryId = new Map<string, SectionContext>();
  for (const e of entries) sectionByEntryId.set(e.id, { classId: e.section.classId, className: e.section.class.name, sectionId: e.section.id, sectionName: e.section.name });
  if (entries.length === 0) return { roster, sectionByEntryId };

  const sectionIds = [...new Set(entries.map((e) => e.sectionId))];
  const entryIds = entries.map((e) => e.id);

  const [enrollments, marks] = await Promise.all([
    prisma.enrollment.findMany({
      where: { sectionId: { in: sectionIds }, status: "ENROLLED" },
      select: { id: true, sectionId: true, studentId: true, rollNumber: true, student: { select: { admissionNumber: true, rollNumber: true, firstName: true, lastName: true } } },
    }),
    prisma.examMark.findMany({
      where: { markSheet: { examScheduleEntryId: { in: entryIds } } },
      select: {
        studentId: true, enrollmentId: true, status: true, theoryMarks: true, practicalMarks: true, marksObtained: true,
        markSheet: { select: { examScheduleEntryId: true, status: true } },
        student: { select: { admissionNumber: true, rollNumber: true, firstName: true, lastName: true } },
      },
    }),
  ]);
  const enrollmentsBySection = new Map<string, typeof enrollments>();
  for (const en of enrollments) enrollmentsBySection.set(en.sectionId, [...(enrollmentsBySection.get(en.sectionId) ?? []), en]);
  const marksByEntry = new Map<string, typeof marks>();
  for (const m of marks) marksByEntry.set(m.markSheet.examScheduleEntryId, [...(marksByEntry.get(m.markSheet.examScheduleEntryId) ?? []), m]);
  const sheetStatusByEntry = new Map(entries.map((e) => [e.id, marksByEntry.get(e.id)?.[0]?.markSheet.status ?? null]));

  function ensure(studentId: string, seed: { enrollmentId: string | null; admissionNumber: string; rollNumber: string | null; name: string }): StudentAgg {
    let agg = roster.get(studentId);
    if (!agg) {
      agg = { studentId, ...seed, entries: [], marks: new Map() };
      roster.set(studentId, agg);
    }
    return agg;
  }

  for (const entry of entries) {
    const entryForResult: ScheduleEntryForResult = { id: entry.id, subjectId: entry.subjectId, subjectName: entry.subject.name, subjectCode: entry.subject.code, maxMarks: entry.maxMarks, passingMarks: entry.passingMarks };
    const sheetStatus = sheetStatusByEntry.get(entry.id) ?? null;

    for (const en of enrollmentsBySection.get(entry.sectionId) ?? []) {
      const agg = ensure(en.studentId, { enrollmentId: en.id, admissionNumber: en.student.admissionNumber, rollNumber: en.rollNumber ?? en.student.rollNumber, name: `${en.student.firstName} ${en.student.lastName}`.trim() });
      agg.entries.push(entryForResult);
      agg.marks.set(entry.id, { sheetStatus: sheetStatus as never, markStatus: null, theoryMarks: null, practicalMarks: null, marksObtained: null });
    }
    for (const m of marksByEntry.get(entry.id) ?? []) {
      const agg = ensure(m.studentId, { enrollmentId: m.enrollmentId, admissionNumber: m.student.admissionNumber, rollNumber: m.student.rollNumber, name: `${m.student.firstName} ${m.student.lastName}`.trim() });
      if (!agg.entries.some((e) => e.id === entry.id)) agg.entries.push(entryForResult); // historical: student may no longer be ENROLLED
      agg.marks.set(entry.id, { sheetStatus: m.markSheet.status as never, markStatus: MARK_STATUS_TO_UI[m.status], theoryMarks: m.theoryMarks, practicalMarks: m.practicalMarks, marksObtained: m.marksObtained });
    }
  }
  return { roster, sectionByEntryId };
}

/** The first schedule entry's section — normal case is every entry sharing one
 *  section; if a student's marks span more than one (rare — mid-exam transfer),
 *  the first (earliest exam date, per resolveExamRoster's ordering) wins. */
function resolveSectionContext(agg: StudentAgg, sectionByEntryId: Map<string, SectionContext>): SectionContext | null {
  const first = agg.entries[0];
  return first ? (sectionByEntryId.get(first.id) ?? null) : null;
}

function computeLiveStudentResults(roster: Map<string, StudentAgg>, bands: GradingBandLike[]): StudentExamResultDto[] {
  const out: StudentExamResultDto[] = [];
  for (const s of roster.values()) {
    const subjects: ExamSubjectResultDto[] = s.entries.map((e) => computeSubjectResult(e, s.marks.get(e.id) ?? { sheetStatus: null, markStatus: null, theoryMarks: null, practicalMarks: null, marksObtained: null }, bands));
    const overall = computeOverallResult(subjects, bands);
    out.push({
      studentId: s.studentId, enrollmentId: s.enrollmentId, admissionNumber: s.admissionNumber, rollNumber: s.rollNumber, name: s.name,
      totalMaxMarks: overall.totalMaxMarks, totalMarksObtained: overall.totalMarksObtained, percentage: overall.percentage, grade: overall.grade, status: overall.status, subjects,
    });
  }
  out.sort((a, b) => (a.rollNumber ?? "").localeCompare(b.rollNumber ?? "", undefined, { numeric: true }) || a.name.localeCompare(b.name));
  return out;
}

// ── Public reads ─────────────────────────────────────────────────────────────

export async function getExamResults(scope: OrgScope, examId: string): Promise<ExamResultsDto> {
  const exam = await requireExamWithGrading(scope, examId);
  const publication = await prisma.examResultPublication.findUnique({ where: { examId }, include: { results: { orderBy: [{ id: "asc" }] } } });

  if (publication) {
    const students: StudentExamResultDto[] = publication.results.map((r) => ({
      studentId: r.studentId, enrollmentId: r.enrollmentId, admissionNumber: "", rollNumber: null, name: "", // display fields aren't persisted per-row; joined below
      totalMaxMarks: r.totalMaxMarks, totalMarksObtained: r.totalMarksObtained, percentage: r.percentage, grade: r.grade, status: r.status.toLowerCase() as never,
      subjects: r.subjectResults as unknown as ExamSubjectResultDto[],
    }));
    // Join current student display fields (name/admission/roll are NOT part of
    // the frozen academic outcome — safe to read live; a name correction later
    // should still show correctly against a published historical result).
    const studentRows = await prisma.student.findMany({ where: { id: { in: students.map((s) => s.studentId) } }, select: { id: true, admissionNumber: true, rollNumber: true, firstName: true, lastName: true } });
    const byId = new Map(studentRows.map((s) => [s.id, s]));
    for (const s of students) {
      const row = byId.get(s.studentId);
      if (row) { s.admissionNumber = row.admissionNumber; s.rollNumber = row.rollNumber; s.name = `${row.firstName} ${row.lastName}`.trim(); }
    }
    students.sort((a, b) => (a.rollNumber ?? "").localeCompare(b.rollNumber ?? "", undefined, { numeric: true }) || a.name.localeCompare(b.name));
    return {
      examId, published: true, publishedAt: publication.publishedAt.toISOString(), publishedByName: publication.publishedByName,
      gradingSchemeId: publication.gradingSchemeId, gradingSchemeName: publication.gradingSchemeName,
      studentCount: students.length, incompleteCount: 0, students,
    };
  }

  const bands: GradingBandLike[] = exam.gradingScheme?.bands ?? [];
  const { roster } = await resolveExamRoster(examId);
  const students = computeLiveStudentResults(roster, bands);
  return {
    examId, published: false, publishedAt: null, publishedByName: null,
    gradingSchemeId: exam.gradingSchemeId, gradingSchemeName: exam.gradingScheme?.name ?? null,
    studentCount: students.length, incompleteCount: students.filter((s) => s.status === "incomplete").length, students,
  };
}

// ── Publish (atomic, concurrency-safe) ────────────────────────────────────────

export async function publishExamResults(scope: OrgScope, examId: string): Promise<ExamResultsDto> {
  const exam = await requireExamWithGrading(scope, examId);
  if (!exam.gradingScheme) throw new HttpError("GRADING_SCHEME_NOT_FOUND", "Assign a grading scheme to this exam before publishing results");
  const bands: GradingBandLike[] = exam.gradingScheme.bands;

  const { roster, sectionByEntryId } = await resolveExamRoster(examId);
  if (roster.size === 0) throw new HttpError("RESULTS_INCOMPLETE", "No students are eligible for this exam yet");
  const students = computeLiveStudentResults(roster, bands);

  const hasUnverified = students.some((s) => s.subjects.some((sub) => sub.markStatus === "unverified"));
  if (hasUnverified) throw new HttpError("MARKS_NOT_VERIFIED", "One or more papers still have unverified marks");
  const incomplete = students.filter((s) => s.status === "incomplete");
  if (incomplete.length > 0) throw new HttpError("RESULTS_INCOMPLETE", `${incomplete.length} student(s) have incomplete marks for this exam`);

  // Grade must resolve for every graded (pass/fail) student — fail closed on gaps.
  for (const s of students) {
    if ((s.status === "pass" || s.status === "fail") && s.percentage !== null && resolveGrade(s.percentage, bands) === null) {
      throw new HttpError("GRADING_BAND_OVERLAP", `The grading scheme does not resolve a single grade for ${s.percentage}% — fix the bands before publishing`);
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      const pub = await tx.examResultPublication.create({
        data: {
          tenantId: scope.tenantId, schoolId: scope.schoolId, academicSessionId: requireSession(scope), examId,
          gradingSchemeId: exam.gradingScheme!.id, gradingSchemeName: exam.gradingScheme!.name, gradingBandsSnapshot: bands as unknown as Prisma.InputJsonValue,
          studentCount: students.length, publishedByUserId: scope.actor.id, publishedByName: scope.actor.name,
        },
        select: { id: true },
      });
      await tx.studentExamResult.createMany({
        data: students.map((s) => {
          const agg = roster.get(s.studentId)!;
          const ctx = resolveSectionContext(agg, sectionByEntryId);
          return {
            publicationId: pub.id, studentId: s.studentId, enrollmentId: s.enrollmentId,
            totalMaxMarks: s.totalMaxMarks, totalMarksObtained: s.totalMarksObtained, percentage: s.percentage ?? 0, grade: s.grade,
            status: s.status.toUpperCase() as never, subjectResults: s.subjects as unknown as Prisma.InputJsonValue,
            classId: ctx?.classId ?? null, className: ctx?.className ?? null, sectionId: ctx?.sectionId ?? null, sectionName: ctx?.sectionName ?? null,
          };
        }),
      });
      await recordAudit(tx, scope, "EXAM_RESULTS_PUBLISHED", "Exam", examId, { gradingSchemeId: exam.gradingScheme!.id, studentCount: students.length, publicationId: pub.id });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new HttpError("RESULT_ALREADY_PUBLISHED", "Results for this exam have already been published");
    }
    throw e;
  }
  return getExamResults(scope, examId);
}
