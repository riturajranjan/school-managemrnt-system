// Report Cards DB integration tests (Phase 8D). Real Postgres: a report card is
// a pure presentation of the Phase 8C published StudentExamResult snapshot — no
// recomputation, no second result engine. Covers: requires a real publication
// (RESULT_NOT_PUBLISHED honest 404), correct exam/student isolation, ABSENT/
// EXEMPT preserved (never zero), historical class/section snapshot survives a
// later section transfer, historical safety after grading-scheme edit / Subject
// archive / student unenrollment / student class transfer, cross-school and
// cross-session isolation, RBAC, safe DTO shape. Namespaced ("T8D").
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { createExam, createTerm, reconcileExamClasses, updateExam } from "@/lib/server/exams/service";
import { createScheduleEntry } from "@/lib/server/exams/schedule-service";
import { saveMarks, submitMarks, verifyMarks } from "@/lib/server/exams/marks-service";
import { createGradingScheme, reconcileGradingBands } from "@/lib/server/results/grading-service";
import { publishExamResults } from "@/lib/server/results/service";
import { getReportCard, getReportCardRoster, listPublishedExams } from "@/lib/server/report-cards/service";
import type { OrgScope } from "@/lib/server/api/scope";
import { ROLE_PERMISSIONS } from "@/lib/server/authz/catalog";

let dbReady = false;
try {
  dbReady = Boolean(await prisma.role.findFirst({ where: { key: "SCHOOL_ADMIN", isSystem: true } }));
} catch {
  dbReady = false;
}

const NS = "T8D";
const stamp = Date.now().toString(36);

let tenantId = "", schoolId = "", branchA = "", sessionId = "", classId = "", classId2 = "", subjectId = "", adminUser = "";
let scope: OrgScope;
let sectionSeq = 0;

async function makeUserWithRole(email: string, roleKey: string): Promise<string> {
  const u = await prisma.user.create({ data: { email, name: email, status: "ACTIVE" }, select: { id: true } });
  const m = await prisma.tenantMembership.create({ data: { userId: u.id, tenantId, status: "ACTIVE" }, select: { id: true } });
  const role = await prisma.role.findFirstOrThrow({ where: { key: roleKey, isSystem: true }, select: { id: true } });
  await prisma.roleAssignment.create({ data: { membershipId: m.id, roleId: role.id } });
  return u.id;
}

const STANDARD_BANDS = [
  { label: "A1", minPercent: 91, maxPercent: 100, isPass: true },
  { label: "A2", minPercent: 81, maxPercent: 90, isPass: true },
  { label: "B1", minPercent: 71, maxPercent: 80, isPass: true },
  { label: "C", minPercent: 33, maxPercent: 70, isPass: true },
  { label: "F", minPercent: 0, maxPercent: 32, isPass: false },
];

async function mkGradingScheme(bands = STANDARD_BANDS) {
  const scheme = await createGradingScheme(scope, { name: `Scheme ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` });
  return reconcileGradingBands(scope, scheme.id, { bands });
}

/** Fresh Section + fresh Student/Enrollment + one VERIFIED paper for that
 *  student, mirroring results.db.test.ts's mkVerifiedExam. */
async function mkVerifiedExam(marksObtained: number, opts: { maxMarks?: number; gradingSchemeId?: string; markStatus?: "marked" | "absent" | "exempt" } = {}) {
  sectionSeq += 1;
  const term = await createTerm(scope, { name: `Term ${sectionSeq}`, code: `T${sectionSeq}-${stamp}` });
  const exam = await createExam(scope, { examTermId: term.id, name: "Unit Test", code: `UT${sectionSeq}-${stamp}`, startsOn: "2026-08-24", endsOn: "2026-08-28" });
  if (opts.gradingSchemeId) await updateExam(scope, exam.id, { gradingSchemeId: opts.gradingSchemeId });
  await reconcileExamClasses(scope, exam.id, { classIds: [classId] });
  const section = (await prisma.section.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, classId, name: `F${sectionSeq}`, status: "ACTIVE" }, select: { id: true } })).id;
  const student = (await prisma.student.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, admissionNumber: `${NS}-${stamp}-${sectionSeq}`, firstName: "S", lastName: `${sectionSeq}`, dateOfBirth: new Date("2015-01-01"), admissionDate: new Date("2024-04-01"), status: "ACTIVE" }, select: { id: true } })).id;
  const enrollment = await prisma.enrollment.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, classId, sectionId: section, studentId: student, status: "ENROLLED" }, select: { id: true } });
  const entry = await createScheduleEntry(scope, exam.id, { sectionId: section, subjectId, examDate: "2026-08-24", startTime: "09:00", endTime: "10:00", ...opts });
  await saveMarks(scope, exam.id, entry.id, { records: [{ studentId: student, status: opts.markStatus ?? "marked", marksObtained: opts.markStatus === "marked" || !opts.markStatus ? marksObtained : undefined }] });
  await submitMarks(scope, exam.id, entry.id);
  await verifyMarks(scope, exam.id, entry.id);
  return { examId: exam.id, entryId: entry.id, section, student, enrollmentId: enrollment.id };
}

beforeAll(async () => {
  if (!dbReady) return;
  tenantId = (await prisma.tenant.create({ data: { name: `${NS} T`, slug: `t8d-${stamp}` }, select: { id: true } })).id;
  schoolId = (await prisma.school.create({ data: { tenantId, name: `${NS} S`, code: `${NS}-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  branchA = (await prisma.branch.create({ data: { schoolId, name: "A", code: `${NS}-A`, status: "ACTIVE" }, select: { id: true } })).id;
  sessionId = (await prisma.academicSession.create({ data: { schoolId, name: "26-27", code: `${NS}-S`, startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31"), status: "ACTIVE" }, select: { id: true } })).id;
  classId = (await prisma.class.create({ data: { tenantId, schoolId, academicSessionId: sessionId, name: "Grade 5", order: 5 }, select: { id: true } })).id;
  classId2 = (await prisma.class.create({ data: { tenantId, schoolId, academicSessionId: sessionId, name: "Grade 6", order: 6 }, select: { id: true } })).id;
  subjectId = (await prisma.subject.create({ data: { tenantId, schoolId, code: `${NS}-M`, name: "Math", shortName: "M", department: "Math", type: "CORE", maxMarks: 100, passingMarks: 33, theoryMarks: 100, practicalMarks: 0 }, select: { id: true } })).id;
  await prisma.classSubject.create({ data: { tenantId, schoolId, academicSessionId: sessionId, classId, subjectId } });
  await prisma.classSubject.create({ data: { tenantId, schoolId, academicSessionId: sessionId, classId: classId2, subjectId } });
  adminUser = await makeUserWithRole(`${NS.toLowerCase()}-admin-${stamp}@x.test`, "SCHOOL_ADMIN");
  scope = { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, actor: { id: adminUser, name: `${NS} Tester` } };
});

afterAll(async () => {
  if (!dbReady || !tenantId) return;
  await prisma.auditEvent.deleteMany({ where: { tenantId } });
  await prisma.user.deleteMany({ where: { id: adminUser } });
  await prisma.tenant.delete({ where: { id: tenantId } });
});

describe.skipIf(!dbReady)("report card requires a real publication (DB)", () => {
  it("RESULT_NOT_PUBLISHED for an exam whose results have not been published", async () => {
    const { examId, student } = await mkVerifiedExam(80);
    await expect(getReportCardRoster(scope, examId)).rejects.toMatchObject({ code: "RESULT_NOT_PUBLISHED" });
    await expect(getReportCard(scope, examId, student)).rejects.toMatchObject({ code: "RESULT_NOT_PUBLISHED" });
  });

  it("EXAM_NOT_FOUND for a nonexistent/foreign exam id", async () => {
    await expect(getReportCardRoster(scope, "nonexistent-exam-id")).rejects.toMatchObject({ code: "EXAM_NOT_FOUND" });
  });

  it("STUDENT_RESULT_NOT_FOUND for a student with no published result on this exam", async () => {
    const scheme = await mkGradingScheme();
    const { examId } = await mkVerifiedExam(80, { gradingSchemeId: scheme.id });
    await publishExamResults(scope, examId);
    await expect(getReportCard(scope, examId, "some-other-student-id")).rejects.toMatchObject({ code: "STUDENT_RESULT_NOT_FOUND" });
  });
});

describe.skipIf(!dbReady)("report card content matches the published snapshot exactly (DB)", () => {
  it("subject row, summary, grade and status mirror StudentExamResult — not recomputed", async () => {
    const scheme = await mkGradingScheme();
    const { examId, student } = await mkVerifiedExam(75, { gradingSchemeId: scheme.id });
    const published = await publishExamResults(scope, examId);
    const card = await getReportCard(scope, examId, student);

    const snapshot = await prisma.studentExamResult.findFirstOrThrow({ where: { publicationId: (await prisma.examResultPublication.findUniqueOrThrow({ where: { examId } })).id, studentId: student } });
    expect(card.summary).toEqual({ totalMaxMarks: snapshot.totalMaxMarks, totalMarksObtained: snapshot.totalMarksObtained, percentage: snapshot.percentage, grade: snapshot.grade, status: snapshot.status.toLowerCase() });
    expect(card.summary).toMatchObject({ totalMarksObtained: 75, totalMaxMarks: 100, percentage: 75, grade: "B1", status: "pass" });
    expect(card.subjects).toEqual(snapshot.subjectResults);
    expect(published.students[0].grade).toBe(card.summary.grade); // same value as the exam-results view — no divergent computation
  });

  it("zero marks are shown as 0, not conflated with ABSENT", async () => {
    const scheme = await mkGradingScheme();
    const { examId, student } = await mkVerifiedExam(0, { gradingSchemeId: scheme.id });
    await publishExamResults(scope, examId);
    const card = await getReportCard(scope, examId, student);
    expect(card.subjects[0]).toMatchObject({ markStatus: "marked", marksObtained: 0, passStatus: "fail" });
    expect(card.summary.status).toBe("fail");
  });

  it("ABSENT is shown explicitly, never as zero marks", async () => {
    const scheme = await mkGradingScheme();
    const { examId, student } = await mkVerifiedExam(0, { gradingSchemeId: scheme.id, markStatus: "absent" });
    await publishExamResults(scope, examId);
    const card = await getReportCard(scope, examId, student);
    expect(card.subjects[0]).toMatchObject({ markStatus: "absent", marksObtained: null, passStatus: "absent" });
    expect(card.summary.status).toBe("absent");
  });

  it("EXEMPT is shown explicitly and excluded from the overall percentage", async () => {
    const scheme = await mkGradingScheme();
    // A student with ONLY an exempt paper is overall INCOMPLETE (engine.ts:
    // "zero non-exempt papers -> nothing to grade"), so pair the exempt paper
    // with a second, normally-graded subject to reach a publishable state.
    const { examId, student, section } = await mkVerifiedExam(0, { gradingSchemeId: scheme.id, markStatus: "exempt" });
    const subject2 = (await prisma.subject.create({ data: { tenantId, schoolId, code: `${NS}-EX-${stamp}`, name: "Exempt Co-subject", shortName: "EC", department: "Other", type: "CORE", maxMarks: 100, passingMarks: 33, theoryMarks: 100, practicalMarks: 0 }, select: { id: true } })).id;
    await prisma.classSubject.create({ data: { tenantId, schoolId, academicSessionId: sessionId, classId, subjectId: subject2 } });
    const entry2 = await createScheduleEntry(scope, examId, { sectionId: section, subjectId: subject2, examDate: "2026-08-25", startTime: "09:00", endTime: "10:00" });
    await saveMarks(scope, examId, entry2.id, { records: [{ studentId: student, status: "marked", marksObtained: 80 }] });
    await submitMarks(scope, examId, entry2.id);
    await verifyMarks(scope, examId, entry2.id);

    await publishExamResults(scope, examId);
    const card = await getReportCard(scope, examId, student);
    const exemptRow = card.subjects.find((s) => s.subjectId === subjectId);
    expect(exemptRow).toMatchObject({ markStatus: "exempt", marksObtained: null, passStatus: "exempt" });
    // Only the non-exempt subject (100 max) counts toward the overall total.
    expect(card.summary.totalMaxMarks).toBe(100);
    expect(card.summary.totalMarksObtained).toBe(80);
  });

  it("historical class/section context is captured at publish time from the exam schedule", async () => {
    const scheme = await mkGradingScheme();
    const { examId, student, section } = await mkVerifiedExam(60, { gradingSchemeId: scheme.id });
    await publishExamResults(scope, examId);
    const card = await getReportCard(scope, examId, student);
    const sectionRow = await prisma.section.findUniqueOrThrow({ where: { id: section }, select: { name: true, class: { select: { name: true } } } });
    expect(card.classContext).toEqual({ className: sectionRow.class.name, sectionName: sectionRow.name });
  });
});

describe.skipIf(!dbReady)("roster (DB)", () => {
  it("lists every published student for the exam, with class/section + summary", async () => {
    const scheme = await mkGradingScheme();
    const { examId, student } = await mkVerifiedExam(88, { gradingSchemeId: scheme.id });
    await publishExamResults(scope, examId);
    const { exam, students } = await getReportCardRoster(scope, examId);
    expect(exam.studentCount).toBe(1);
    expect(students).toHaveLength(1);
    expect(students[0]).toMatchObject({ studentId: student, percentage: 88, grade: "A2", status: "pass" });
    expect(students[0].className).not.toBeNull();
  });

  it("text search filters by name/admission number, server-side", async () => {
    const scheme = await mkGradingScheme();
    const { examId } = await mkVerifiedExam(50, { gradingSchemeId: scheme.id });
    await publishExamResults(scope, examId);
    const noMatch = await getReportCardRoster(scope, examId, "zzz-does-not-exist-zzz");
    expect(noMatch.students).toHaveLength(0);
    const match = await getReportCardRoster(scope, examId, "S ");
    expect(match.students.length).toBeGreaterThan(0);
  });

  it("listPublishedExams returns only exams with a real publication, most recent first", async () => {
    const scheme = await mkGradingScheme();
    const unpublished = await mkVerifiedExam(40, { gradingSchemeId: scheme.id });
    const { examId: publishedExamId } = await mkVerifiedExam(90, { gradingSchemeId: scheme.id });
    await publishExamResults(scope, publishedExamId);
    const list = await listPublishedExams(scope);
    expect(list.some((e) => e.examId === publishedExamId)).toBe(true);
    expect(list.some((e) => e.examId === unpublished.examId)).toBe(false);
  });
});

describe.skipIf(!dbReady)("historical safety after publication (DB)", () => {
  it("grading-scheme edit after publish does not change the report card's grade", async () => {
    const scheme = await mkGradingScheme();
    const { examId, student } = await mkVerifiedExam(85, { gradingSchemeId: scheme.id });
    await publishExamResults(scope, examId);
    const before = await getReportCard(scope, examId, student);
    expect(before.summary.grade).toBe("A2");

    await reconcileGradingBands(scope, scheme.id, { bands: [{ label: "TOP", minPercent: 0, maxPercent: 100, isPass: true }] });

    const after = await getReportCard(scope, examId, student);
    expect(after.summary.grade).toBe("A2"); // unchanged — frozen snapshot
  });

  it("Subject archive after publish does not alter the report card", async () => {
    const scheme = await mkGradingScheme();
    const { examId, student } = await mkVerifiedExam(70, { gradingSchemeId: scheme.id });
    await publishExamResults(scope, examId);
    const before = await getReportCard(scope, examId, student);
    await prisma.subject.update({ where: { id: subjectId }, data: { status: "ARCHIVED", maxMarks: 40 } });
    const after = await getReportCard(scope, examId, student);
    expect(after).toEqual(before);
    await prisma.subject.update({ where: { id: subjectId }, data: { status: "ACTIVE", maxMarks: 100 } });
  });

  it("student unenrollment after publish does not remove the report card", async () => {
    const scheme = await mkGradingScheme();
    const { examId, student, enrollmentId } = await mkVerifiedExam(55, { gradingSchemeId: scheme.id });
    await publishExamResults(scope, examId);
    const before = await getReportCard(scope, examId, student);
    await prisma.enrollment.update({ where: { id: enrollmentId }, data: { status: "WITHDRAWN" } });
    const after = await getReportCard(scope, examId, student);
    expect(after).toEqual(before);
  });

  it("student class/section transfer after publish does not alter the historical class context", async () => {
    const scheme = await mkGradingScheme();
    const { examId, student, enrollmentId, section } = await mkVerifiedExam(65, { gradingSchemeId: scheme.id });
    await publishExamResults(scope, examId);
    const before = await getReportCard(scope, examId, student);

    // Transfer the student to a brand-new class + section after publication.
    const newSection = (await prisma.section.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, classId: classId2, name: `X${sectionSeq}`, status: "ACTIVE" }, select: { id: true } })).id;
    await prisma.enrollment.update({ where: { id: enrollmentId }, data: { classId: classId2, sectionId: newSection } });

    const after = await getReportCard(scope, examId, student);
    expect(after.classContext).toEqual(before.classContext); // still the ORIGINAL exam-time class/section
    const oldSectionRow = await prisma.section.findUniqueOrThrow({ where: { id: section }, select: { name: true, class: { select: { name: true } } } });
    expect(after.classContext).toEqual({ className: oldSectionRow.class.name, sectionName: oldSectionRow.name });
  });
});

describe.skipIf(!dbReady)("isolation (DB)", () => {
  it("a foreign school's published exam is not visible from another scope", async () => {
    const scheme = await mkGradingScheme();
    const { examId } = await mkVerifiedExam(60, { gradingSchemeId: scheme.id });
    await publishExamResults(scope, examId);

    const foreignSchool = (await prisma.school.create({ data: { tenantId, name: `${NS} SB`, code: `${NS}-SB-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
    const foreignBranch = (await prisma.branch.create({ data: { schoolId: foreignSchool, name: "B", code: `${NS}-BB`, status: "ACTIVE" }, select: { id: true } })).id;
    const foreignSession = (await prisma.academicSession.create({ data: { schoolId: foreignSchool, name: "26-27", code: `${NS}-SBS`, startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31"), status: "ACTIVE" }, select: { id: true } })).id;
    const foreignScope: OrgScope = { tenantId, schoolId: foreignSchool, branchId: foreignBranch, academicSessionId: foreignSession, actor: { id: "x", name: "X" } };
    await expect(getReportCardRoster(foreignScope, examId)).rejects.toMatchObject({ code: "EXAM_NOT_FOUND" });

    const list = await listPublishedExams(foreignScope);
    expect(list.some((e) => e.examId === examId)).toBe(false);
  });

  it("a foreign academic session cannot see a session's published exam", async () => {
    const scheme = await mkGradingScheme();
    const { examId } = await mkVerifiedExam(60, { gradingSchemeId: scheme.id });
    await publishExamResults(scope, examId);
    const otherSession = (await prisma.academicSession.create({ data: { schoolId, name: "27-28", code: `${NS}-OS`, startDate: new Date("2027-04-01"), endDate: new Date("2028-03-31"), status: "ACTIVE" }, select: { id: true } })).id;
    const otherScope: OrgScope = { ...scope, academicSessionId: otherSession };
    await expect(getReportCardRoster(otherScope, examId)).rejects.toMatchObject({ code: "EXAM_NOT_FOUND" });
  });
});

describe.skipIf(!dbReady)("RBAC + DTO safety (DB)", () => {
  it("results.view (reused, no new report-card permission key) covers report-card read access", () => {
    expect(ROLE_PERMISSIONS.SCHOOL_ADMIN).toContain("results.view");
    expect(ROLE_PERMISSIONS.PRINCIPAL).toContain("results.view");
    expect(ROLE_PERMISSIONS.TEACHER).toContain("results.view");
  });

  it("report card DTO exposes only safe fields — no rank, no GPA/CGPA", async () => {
    const scheme = await mkGradingScheme();
    const { examId, student } = await mkVerifiedExam(60, { gradingSchemeId: scheme.id });
    await publishExamResults(scope, examId);
    const card = await getReportCard(scope, examId, student);
    expect(Object.keys(card).sort()).toEqual(["classContext", "exam", "publishedAt", "publishedByName", "school", "student", "subjects", "summary"]);
    expect(card).not.toHaveProperty("rank");
    expect(card).not.toHaveProperty("gpa");
    expect(card).not.toHaveProperty("cgpa");
  });
});
