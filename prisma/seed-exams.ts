// Phase 8A seed — a real ExamTerm + Exam + ExamClass + a few ExamScheduleEntry
// rows built on real Class/Section/Subject/ClassSubject (never fabricated ids).
// Idempotent: term/exam keyed by code; class assignment by (examId,classId);
// schedule entries by the real DB conflict uniques. No marks/results seeded.
import type { PrismaClient } from "../lib/generated/prisma/client";

type Ids = { tenantId: string; schoolId: string; branchId: string; academicSessionId: string };

export async function seedExams(prisma: PrismaClient, ids: Ids) {
  const { tenantId, schoolId, academicSessionId } = ids;

  // 1) Term (idempotent by code).
  let term = await prisma.examTerm.findFirst({ where: { schoolId, academicSessionId, code: "T1" }, select: { id: true } });
  let termCreated = false;
  if (!term) {
    term = await prisma.examTerm.create({ data: { tenantId, schoolId, academicSessionId, name: "Term 1", code: "T1", order: 0 }, select: { id: true } });
    termCreated = true;
  }

  // 2) Exam (idempotent by code).
  let exam = await prisma.exam.findFirst({ where: { schoolId, academicSessionId, code: "T1-UT1" }, select: { id: true } });
  let examCreated = false;
  if (!exam) {
    exam = await prisma.exam.create({
      data: {
        tenantId, schoolId, academicSessionId, examTermId: term.id, name: "Unit Test 1", code: "T1-UT1", type: "UNIT_TEST",
        description: "First unit test of the term.", startsOn: new Date("2026-08-24T00:00:00.000Z"), endsOn: new Date("2026-08-28T00:00:00.000Z"),
        scope: "INTERNAL", mode: "OFFLINE", status: "SCHEDULED",
      },
      select: { id: true },
    });
    examCreated = true;
  }

  // 3) Class applicability — every real class in this session (idempotent).
  const classes = await prisma.class.findMany({ where: { schoolId, academicSessionId }, select: { id: true } });
  let classesAssigned = 0;
  for (const c of classes) {
    const existing = await prisma.examClass.findUnique({ where: { examId_classId: { examId: exam.id, classId: c.id } }, select: { id: true } });
    if (existing) continue;
    await prisma.examClass.create({ data: { tenantId, schoolId, academicSessionId, examId: exam.id, classId: c.id } });
    classesAssigned++;
  }

  // 4) A few schedule entries — one subject per section that has ClassSubjects,
  //    on consecutive days within the exam window, snapshotting Subject marks.
  const sections = await prisma.section.findMany({
    where: { schoolId, academicSessionId, class: { classSubjects: { some: {} } } },
    select: { id: true, branchId: true, classId: true },
    take: 3,
  });
  let entriesCreated = 0;
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const cs = await prisma.classSubject.findFirst({ where: { classId: section.classId }, orderBy: { order: "asc" }, select: { subject: { select: { id: true, maxMarks: true, passingMarks: true, theoryMarks: true, practicalMarks: true } } } });
    if (!cs) continue;
    const examDate = new Date("2026-08-24T00:00:00.000Z");
    examDate.setUTCDate(examDate.getUTCDate() + i);
    const exists = await prisma.examScheduleEntry.findFirst({ where: { examId: exam.id, sectionId: section.id, subjectId: cs.subject.id }, select: { id: true } });
    if (exists) continue;
    await prisma.examScheduleEntry.create({
      data: {
        tenantId, schoolId, branchId: section.branchId, academicSessionId, examId: exam.id, sectionId: section.id, subjectId: cs.subject.id,
        examDate, startMinutes: 540, endMinutes: 660, // 09:00–11:00
        maxMarks: cs.subject.maxMarks, passingMarks: cs.subject.passingMarks, theoryMarks: cs.subject.theoryMarks, practicalMarks: cs.subject.practicalMarks,
      },
    });
    entriesCreated++;
  }

  console.log(`  P8A:      term(+${termCreated ? 1 : 0}) exam(+${examCreated ? 1 : 0}) classes(+${classesAssigned}) schedule(+${entriesCreated})`);
}
