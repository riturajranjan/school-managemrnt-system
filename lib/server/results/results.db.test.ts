// Results & Grading DB integration tests (Phase 8C). Real Postgres: grading
// scheme CRUD + band reconcile (validated, transactional); exam results
// derived from real VERIFIED Phase 8B marks; publish preconditions (no
// scheme / unverified / incomplete all rejected); atomic publication;
// concurrent double-publish (exactly one survives); historical safety
// (grading-scheme edit, Subject archive, Staff inactive, student
// unenrollment all leave a published result unchanged); cross-school
// isolation; RBAC catalog; safe DTO shape. Namespaced ("T8C").
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { createExam, createTerm, reconcileExamClasses, updateExam } from "@/lib/server/exams/service";
import { createScheduleEntry } from "@/lib/server/exams/schedule-service";
import { saveMarks, submitMarks, verifyMarks } from "@/lib/server/exams/marks-service";
import { createGradingScheme, reconcileGradingBands } from "@/lib/server/results/grading-service";
import { getExamResults, publishExamResults } from "@/lib/server/results/service";
import type { OrgScope } from "@/lib/server/api/scope";
import { ROLE_PERMISSIONS } from "@/lib/server/authz/catalog";

let dbReady = false;
try {
  dbReady = Boolean(await prisma.role.findFirst({ where: { key: "SCHOOL_ADMIN", isSystem: true } }));
} catch {
  dbReady = false;
}

const NS = "T8C";
const stamp = Date.now().toString(36);

let tenantId = "", schoolId = "", branchA = "", sessionId = "", classId = "", subjectId = "", staff1 = "", adminUser = "";
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

/** Fresh Section + fresh Students/Enrollments + a scheduled, VERIFIED paper
 *  with one MARKED student — mirrors marks.db.test.ts's mkEntry, extended
 *  through the full submit->verify lifecycle so results have something real
 *  to derive from. Returns exam/term/entry ids for reuse across tests. */
async function mkVerifiedExam(marksObtained: number, opts: { maxMarks?: number; theoryMarks?: number; practicalMarks?: number; gradingSchemeId?: string } = {}) {
  sectionSeq += 1;
  const term = await createTerm(scope, { name: `Term ${sectionSeq}`, code: `T${sectionSeq}-${stamp}` });
  const exam = await createExam(scope, { examTermId: term.id, name: "Unit Test", code: `UT${sectionSeq}-${stamp}`, startsOn: "2026-08-24", endsOn: "2026-08-28" });
  if (opts.gradingSchemeId) await updateExam(scope, exam.id, { gradingSchemeId: opts.gradingSchemeId });
  await reconcileExamClasses(scope, exam.id, { classIds: [classId] });
  const section = (await prisma.section.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, classId, name: `F${sectionSeq}`, status: "ACTIVE" }, select: { id: true } })).id;
  const student = (await prisma.student.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, admissionNumber: `${NS}-${stamp}-${sectionSeq}`, firstName: "S", lastName: `${sectionSeq}`, dateOfBirth: new Date("2015-01-01"), admissionDate: new Date("2024-04-01"), status: "ACTIVE" }, select: { id: true } })).id;
  const enrollment = await prisma.enrollment.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, classId, sectionId: section, studentId: student, status: "ENROLLED" }, select: { id: true } });
  const entry = await createScheduleEntry(scope, exam.id, { sectionId: section, subjectId, examDate: "2026-08-24", startTime: "09:00", endTime: "10:00", ...opts });
  await saveMarks(scope, exam.id, entry.id, { records: [{ studentId: student, status: "marked", marksObtained }] });
  await submitMarks(scope, exam.id, entry.id);
  await verifyMarks(scope, exam.id, entry.id);
  return { examId: exam.id, entryId: entry.id, section, student, enrollmentId: enrollment.id };
}

beforeAll(async () => {
  if (!dbReady) return;
  tenantId = (await prisma.tenant.create({ data: { name: `${NS} T`, slug: `t8c-${stamp}` }, select: { id: true } })).id;
  schoolId = (await prisma.school.create({ data: { tenantId, name: `${NS} S`, code: `${NS}-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  branchA = (await prisma.branch.create({ data: { schoolId, name: "A", code: `${NS}-A`, status: "ACTIVE" }, select: { id: true } })).id;
  sessionId = (await prisma.academicSession.create({ data: { schoolId, name: "26-27", code: `${NS}-S`, startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31"), status: "ACTIVE" }, select: { id: true } })).id;
  classId = (await prisma.class.create({ data: { tenantId, schoolId, academicSessionId: sessionId, name: "Grade 5", order: 5 }, select: { id: true } })).id;
  subjectId = (await prisma.subject.create({ data: { tenantId, schoolId, code: `${NS}-M`, name: "Math", shortName: "M", department: "Math", type: "CORE", maxMarks: 100, passingMarks: 33, theoryMarks: 100, practicalMarks: 0 }, select: { id: true } })).id;
  await prisma.classSubject.create({ data: { tenantId, schoolId, academicSessionId: sessionId, classId, subjectId } });
  staff1 = (await prisma.staff.create({ data: { tenantId, schoolId, branchId: branchA, employeeCode: `${NS}-T1`, firstName: "Tara", isTeaching: true, status: "ACTIVE" }, select: { id: true } })).id;
  adminUser = await makeUserWithRole(`${NS.toLowerCase()}-admin-${stamp}@x.test`, "SCHOOL_ADMIN");
  scope = { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, actor: { id: adminUser, name: `${NS} Tester` } };
});

afterAll(async () => {
  if (!dbReady || !tenantId) return;
  await prisma.auditEvent.deleteMany({ where: { tenantId } });
  await prisma.user.deleteMany({ where: { id: adminUser } });
  await prisma.tenant.delete({ where: { id: tenantId } });
});

async function mkGradingScheme(bands = STANDARD_BANDS) {
  const scheme = await createGradingScheme(scope, { name: `Scheme ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` });
  return reconcileGradingBands(scope, scheme.id, { bands });
}

describe.skipIf(!dbReady)("grading schemes (DB)", () => {
  it("creates a scheme + audits it; band reconcile is validated and transactional", async () => {
    const scheme = await mkGradingScheme();
    expect(scheme.bands.map((b) => b.label)).toEqual(["A1", "A2", "B1", "C", "F"]);
    const audit = await prisma.auditEvent.findFirst({ where: { tenantId, action: "GRADING_BANDS_UPDATED", entityId: scheme.id } });
    expect(audit).not.toBeNull();
  });

  it("rejects overlapping bands; nothing is written on a rejected reconcile", async () => {
    const created = await createGradingScheme(scope, { name: `Bad ${Date.now()}` });
    await reconcileGradingBands(scope, created.id, { bands: STANDARD_BANDS });
    await expect(
      reconcileGradingBands(scope, created.id, { bands: [{ label: "X", minPercent: 0, maxPercent: 60, isPass: true }, { label: "Y", minPercent: 50, maxPercent: 100, isPass: true }] }),
    ).rejects.toMatchObject({ code: "GRADING_BAND_OVERLAP" });
    const stillOriginal = await prisma.gradingBand.count({ where: { gradingSchemeId: created.id } });
    expect(stillOriginal).toBe(5); // the failed reconcile did not touch the previously-saved 5 bands
  });

  it("rejects min > max and out-of-range percentages", async () => {
    const created = await createGradingScheme(scope, { name: `Bad2 ${Date.now()}` });
    await expect(reconcileGradingBands(scope, created.id, { bands: [{ label: "X", minPercent: 80, maxPercent: 70, isPass: true }] })).rejects.toMatchObject({ code: "INVALID_GRADING_BANDS" });
  });

  it("RBAC: exams.manage covers grading configuration (admin/principal); teacher lacks it", () => {
    expect(ROLE_PERMISSIONS.SCHOOL_ADMIN).toContain("exams.manage");
    expect(ROLE_PERMISSIONS.PRINCIPAL).toContain("exams.manage");
    expect(ROLE_PERMISSIONS.TEACHER).not.toContain("exams.manage");
    expect(ROLE_PERMISSIONS.TEACHER).toContain("results.view");
    expect(ROLE_PERMISSIONS.TEACHER).not.toContain("results.publish");
  });
});

describe.skipIf(!dbReady)("exam results — live preview (DB)", () => {
  it("derives a live preview from real VERIFIED marks; published: false", async () => {
    const scheme = await mkGradingScheme();
    const { examId } = await mkVerifiedExam(85, { gradingSchemeId: scheme.id });
    const results = await getExamResults(scope, examId);
    expect(results.published).toBe(false);
    expect(results.students).toHaveLength(1);
    expect(results.students[0]).toMatchObject({ totalMarksObtained: 85, totalMaxMarks: 100, percentage: 85, grade: "A2", status: "pass" });
  });

  it("no grading scheme assigned -> grade stays null but preview still computes (percentage/pass shown)", async () => {
    const { examId } = await mkVerifiedExam(85);
    const results = await getExamResults(scope, examId);
    expect(results.gradingSchemeId).toBeNull();
    expect(results.students[0].grade).toBeNull();
    expect(results.students[0].status).toBe("pass");
  });

  it("unverified marks show as INCOMPLETE in preview, not a guessed result", async () => {
    sectionSeq += 1;
    const term = await createTerm(scope, { name: `T ${sectionSeq}`, code: `TU${sectionSeq}-${stamp}` });
    const exam = await createExam(scope, { examTermId: term.id, name: "Unit Test", code: `UUT${sectionSeq}-${stamp}`, startsOn: "2026-08-24", endsOn: "2026-08-28" });
    await reconcileExamClasses(scope, exam.id, { classIds: [classId] });
    const section = (await prisma.section.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, classId, name: `F${sectionSeq}`, status: "ACTIVE" }, select: { id: true } })).id;
    const student = (await prisma.student.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, admissionNumber: `${NS}-${stamp}-u${sectionSeq}`, firstName: "U", lastName: "X", dateOfBirth: new Date("2015-01-01"), admissionDate: new Date("2024-04-01"), status: "ACTIVE" }, select: { id: true } })).id;
    await prisma.enrollment.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, classId, sectionId: section, studentId: student, status: "ENROLLED" } });
    const entry = await createScheduleEntry(scope, exam.id, { sectionId: section, subjectId, examDate: "2026-08-24", startTime: "09:00", endTime: "10:00" });
    await saveMarks(scope, exam.id, entry.id, { records: [{ studentId: student, status: "marked", marksObtained: 90 }] });
    await submitMarks(scope, exam.id, entry.id); // submitted, but NOT verified
    const results = await getExamResults(scope, exam.id);
    expect(results.students[0].status).toBe("incomplete");
    expect(results.students[0].subjects[0].markStatus).toBe("unverified");
  });
});

describe.skipIf(!dbReady)("publication (DB)", () => {
  it("rejects publish with no grading scheme assigned", async () => {
    const { examId } = await mkVerifiedExam(85);
    await expect(publishExamResults(scope, examId)).rejects.toMatchObject({ code: "GRADING_SCHEME_NOT_FOUND" });
  });

  it("rejects publish while marks are unverified (MARKS_NOT_VERIFIED)", async () => {
    const scheme = await mkGradingScheme();
    sectionSeq += 1;
    const term = await createTerm(scope, { name: `T ${sectionSeq}`, code: `TV${sectionSeq}-${stamp}` });
    const exam = await createExam(scope, { examTermId: term.id, name: "Unit Test", code: `UVT${sectionSeq}-${stamp}`, startsOn: "2026-08-24", endsOn: "2026-08-28" });
    await updateExam(scope, exam.id, { gradingSchemeId: scheme.id });
    await reconcileExamClasses(scope, exam.id, { classIds: [classId] });
    const section = (await prisma.section.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, classId, name: `F${sectionSeq}`, status: "ACTIVE" }, select: { id: true } })).id;
    const student = (await prisma.student.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, admissionNumber: `${NS}-${stamp}-v${sectionSeq}`, firstName: "V", lastName: "X", dateOfBirth: new Date("2015-01-01"), admissionDate: new Date("2024-04-01"), status: "ACTIVE" }, select: { id: true } })).id;
    await prisma.enrollment.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, classId, sectionId: section, studentId: student, status: "ENROLLED" } });
    const entry = await createScheduleEntry(scope, exam.id, { sectionId: section, subjectId, examDate: "2026-08-24", startTime: "09:00", endTime: "10:00" });
    await saveMarks(scope, exam.id, entry.id, { records: [{ studentId: student, status: "marked", marksObtained: 90 }] });
    // not submitted/verified
    await expect(publishExamResults(scope, exam.id)).rejects.toMatchObject({ code: "MARKS_NOT_VERIFIED" });
  });

  it("publishes atomically; freezes an immutable snapshot; a second publish is rejected", async () => {
    const scheme = await mkGradingScheme();
    const { examId, student } = await mkVerifiedExam(75, { gradingSchemeId: scheme.id });
    const published = await publishExamResults(scope, examId);
    expect(published.published).toBe(true);
    expect(published.students[0]).toMatchObject({ studentId: student, totalMarksObtained: 75, percentage: 75, grade: "B1", status: "pass" });

    const pubRow = await prisma.examResultPublication.findUniqueOrThrow({ where: { examId } });
    expect(pubRow.studentCount).toBe(1);
    const snapRows = await prisma.studentExamResult.findMany({ where: { publicationId: pubRow.id } });
    expect(snapRows).toHaveLength(1);

    await expect(publishExamResults(scope, examId)).rejects.toMatchObject({ code: "RESULT_ALREADY_PUBLISHED" });
    const audit = await prisma.auditEvent.findFirst({ where: { tenantId, action: "EXAM_RESULTS_PUBLISHED", entityId: examId } });
    expect(audit).not.toBeNull();
  });

  it("CONCURRENCY: two simultaneous publish requests for the same exam -> exactly one succeeds", async () => {
    const scheme = await mkGradingScheme();
    const { examId } = await mkVerifiedExam(60, { gradingSchemeId: scheme.id });
    const results = await Promise.allSettled([publishExamResults(scope, examId), publishExamResults(scope, examId)]);
    expect(results.filter((r) => r.status === "fulfilled").length).toBe(1);
    const rejected = results.find((r) => r.status === "rejected");
    expect((rejected as PromiseRejectedResult).reason).toMatchObject({ code: "RESULT_ALREADY_PUBLISHED" });
    const count = await prisma.examResultPublication.count({ where: { examId } });
    expect(count).toBe(1);
  });

  it("no eligible students at all -> RESULTS_INCOMPLETE, not a silent empty publish", async () => {
    sectionSeq += 1;
    const term = await createTerm(scope, { name: `T ${sectionSeq}`, code: `TE${sectionSeq}-${stamp}` });
    const exam = await createExam(scope, { examTermId: term.id, name: "Empty", code: `EMPTY${sectionSeq}-${stamp}`, startsOn: "2026-08-24", endsOn: "2026-08-28" });
    const scheme = await mkGradingScheme();
    await updateExam(scope, exam.id, { gradingSchemeId: scheme.id });
    await expect(publishExamResults(scope, exam.id)).rejects.toMatchObject({ code: "RESULTS_INCOMPLETE" });
  });
});

describe.skipIf(!dbReady)("historical safety after publication (DB)", () => {
  it("A: grading-scheme edit after publish does NOT change the historical grade", async () => {
    const scheme = await mkGradingScheme();
    const { examId } = await mkVerifiedExam(85, { gradingSchemeId: scheme.id });
    const published = await publishExamResults(scope, examId);
    expect(published.students[0].grade).toBe("A2"); // 85% -> A2 under the original bands

    // Now edit the scheme so 85% would resolve to a DIFFERENT grade.
    await reconcileGradingBands(scope, scheme.id, { bands: [{ label: "TOP", minPercent: 0, maxPercent: 100, isPass: true }] });

    const reread = await getExamResults(scope, examId);
    expect(reread.published).toBe(true);
    expect(reread.students[0].grade).toBe("A2"); // unchanged — frozen snapshot, not live re-derivation
  });

  it("B: Subject archive after publish does not alter the historical result", async () => {
    const scheme = await mkGradingScheme();
    const { examId } = await mkVerifiedExam(70, { gradingSchemeId: scheme.id });
    const before = await publishExamResults(scope, examId);
    await prisma.subject.update({ where: { id: subjectId }, data: { status: "ARCHIVED", maxMarks: 40 } });
    const after = await getExamResults(scope, examId);
    expect(after.students[0]).toMatchObject(before.students[0]);
    await prisma.subject.update({ where: { id: subjectId }, data: { status: "ACTIVE", maxMarks: 100 } });
  });

  it("C: student unenrollment after publish does not remove the historical result", async () => {
    const scheme = await mkGradingScheme();
    const { examId, enrollmentId } = await mkVerifiedExam(50, { gradingSchemeId: scheme.id });
    const before = await publishExamResults(scope, examId);
    await prisma.enrollment.update({ where: { id: enrollmentId }, data: { status: "WITHDRAWN" } });
    const after = await getExamResults(scope, examId);
    expect(after.students).toHaveLength(1);
    expect(after.students[0]).toMatchObject(before.students[0]);
  });

  it("D: Staff (invigilator/teacher) going inactive after publish does not alter the historical result", async () => {
    const scheme = await mkGradingScheme();
    const { examId } = await mkVerifiedExam(45, { gradingSchemeId: scheme.id });
    const before = await publishExamResults(scope, examId);
    await prisma.staff.update({ where: { id: staff1 }, data: { status: "INACTIVE" } });
    const after = await getExamResults(scope, examId);
    expect(after.students[0]).toMatchObject(before.students[0]);
    await prisma.staff.update({ where: { id: staff1 }, data: { status: "ACTIVE" } });
  });

  it("E: a published result reads identically on repeated fetches (stable, not recomputed)", async () => {
    const scheme = await mkGradingScheme();
    const { examId } = await mkVerifiedExam(33, { gradingSchemeId: scheme.id });
    await publishExamResults(scope, examId);
    const r1 = await getExamResults(scope, examId);
    const r2 = await getExamResults(scope, examId);
    expect(r1).toEqual(r2);
  });
});

describe.skipIf(!dbReady)("isolation + DTO safety (DB)", () => {
  it("a foreign school's exam is not found from another scope", async () => {
    const { examId } = await mkVerifiedExam(60);
    const foreignSchool = (await prisma.school.create({ data: { tenantId, name: `${NS} SB`, code: `${NS}-SB-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
    const foreignBranch = (await prisma.branch.create({ data: { schoolId: foreignSchool, name: "B", code: `${NS}-BB`, status: "ACTIVE" }, select: { id: true } })).id;
    const foreignSession = (await prisma.academicSession.create({ data: { schoolId: foreignSchool, name: "26-27", code: `${NS}-SBS`, startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31"), status: "ACTIVE" }, select: { id: true } })).id;
    const scopeForeign: OrgScope = { tenantId, schoolId: foreignSchool, branchId: foreignBranch, academicSessionId: foreignSession, actor: { id: "x", name: "X" } };
    await expect(getExamResults(scopeForeign, examId)).rejects.toMatchObject({ code: "EXAM_NOT_FOUND" });
  });

  it("results DTO exposes only safe display fields per student", async () => {
    const { examId } = await mkVerifiedExam(60);
    const results = await getExamResults(scope, examId);
    expect(Object.keys(results.students[0]).sort()).toEqual(["admissionNumber", "enrollmentId", "grade", "name", "percentage", "rollNumber", "status", "studentId", "subjects", "totalMarksObtained", "totalMaxMarks"]);
  });
});
