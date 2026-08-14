// Phase 8A/8B seed — a real ExamTerm + Exam + ExamClass + a few ExamScheduleEntry
// rows built on real Class/Section/Subject/ClassSubject (never fabricated ids),
// plus (8B) one DRAFT ExamMarkSheet with a couple of real marks so the entry/
// submit/verify flow has something to demo. Idempotent throughout: term/exam
// keyed by code; class assignment by (examId,classId); schedule entries by the
// real DB conflict uniques; mark sheet by its unique examScheduleEntryId; marks
// by (markSheetId,studentId). No results/grades/ranks/report cards seeded.
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

  // 5) Phase 8B — a small DRAFT mark sheet with a couple of real marks on the
  //    first schedule entry, so the entry/submit/verify flow has something to
  //    demo. No results/ranks/report cards — marks only, left in DRAFT.
  let sheetCreated = false;
  let marksCreated = 0;
  const firstEntry = await prisma.examScheduleEntry.findFirst({ where: { examId: exam.id }, orderBy: { examDate: "asc" }, select: { id: true, sectionId: true, maxMarks: true, theoryMarks: true, practicalMarks: true } });
  if (firstEntry) {
    let sheet = await prisma.examMarkSheet.findUnique({ where: { examScheduleEntryId: firstEntry.id }, select: { id: true } });
    if (!sheet) {
      sheet = await prisma.examMarkSheet.create({ data: { tenantId, schoolId, academicSessionId, examScheduleEntryId: firstEntry.id, status: "DRAFT" }, select: { id: true } });
      sheetCreated = true;
    }
    const roster = await prisma.enrollment.findMany({ where: { sectionId: firstEntry.sectionId, status: "ENROLLED" }, orderBy: { rollNumber: "asc" }, take: 2, select: { id: true, studentId: true } });
    const hasSplit = firstEntry.practicalMarks > 0;
    for (const en of roster) {
      const existing = await prisma.examMark.findUnique({ where: { markSheetId_studentId: { markSheetId: sheet.id, studentId: en.studentId } }, select: { id: true } });
      if (existing) continue;
      const theoryMarks = hasSplit ? Math.round(firstEntry.theoryMarks * 0.8) : null;
      const practicalMarks = hasSplit ? Math.round(firstEntry.practicalMarks * 0.8) : null;
      const marksObtained = hasSplit ? null : Math.round(firstEntry.maxMarks * 0.8);
      await prisma.examMark.create({
        data: {
          tenantId, schoolId, academicSessionId, markSheetId: sheet.id, studentId: en.studentId, enrollmentId: en.id,
          status: "MARKED", theoryMarks, practicalMarks, marksObtained, enteredByName: "Seed data", enteredAt: new Date(),
        },
      });
      marksCreated++;
    }
  }
  console.log(`  P8B:      markSheet(+${sheetCreated ? 1 : 0}) marks(+${marksCreated})`);

  // 6) Phase 8C — one real GradingScheme with a standard percentage-band set,
  //    assigned to the exam. Not published (most students in the demo school
  //    have no marks yet, so a real publish would correctly reject as
  //    incomplete) — deliberately left as a live preview to demo honestly.
  let schemeCreated = false;
  let scheme = await prisma.gradingScheme.findFirst({ where: { schoolId, academicSessionId, name: "CBSE Pattern" }, select: { id: true } });
  if (!scheme) {
    scheme = await prisma.gradingScheme.create({ data: { tenantId, schoolId, academicSessionId, name: "CBSE Pattern", status: "ACTIVE" }, select: { id: true } });
    await prisma.gradingBand.createMany({
      data: [
        { gradingSchemeId: scheme.id, label: "A1", minPercent: 91, maxPercent: 100, isPass: true, color: "#16a34a", order: 0 },
        { gradingSchemeId: scheme.id, label: "A2", minPercent: 81, maxPercent: 90, isPass: true, color: "#22c55e", order: 1 },
        { gradingSchemeId: scheme.id, label: "B1", minPercent: 71, maxPercent: 80, isPass: true, color: "#84cc16", order: 2 },
        { gradingSchemeId: scheme.id, label: "B2", minPercent: 61, maxPercent: 70, isPass: true, color: "#eab308", order: 3 },
        { gradingSchemeId: scheme.id, label: "C1", minPercent: 51, maxPercent: 60, isPass: true, color: "#f59e0b", order: 4 },
        { gradingSchemeId: scheme.id, label: "C2", minPercent: 33, maxPercent: 50, isPass: true, color: "#f97316", order: 5 },
        { gradingSchemeId: scheme.id, label: "D", minPercent: 0, maxPercent: 32, isPass: false, color: "#ef4444", order: 6 },
      ],
    });
    schemeCreated = true;
  }
  await prisma.exam.update({ where: { id: exam.id }, data: { gradingSchemeId: scheme.id } });
  console.log(`  P8C:      gradingScheme(+${schemeCreated ? 1 : 0})`);
}
