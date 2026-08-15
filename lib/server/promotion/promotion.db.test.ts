// Promotion / Academic-Year Transition DB integration tests (Phase 8E). Real
// Postgres: candidate eligibility from a real published result (never
// recomputed), PASS/FAIL never auto-decide anything, PROMOTED/RETAINED both
// create a NEW target-session Enrollment (never mutate the historical one),
// old Enrollment/StudentExamResult/Report-Card stay byte-identical after
// promotion, target class/section/session validation, section-capacity
// enforcement (single-slot + concurrent), duplicate-promotion idempotency +
// concurrency safety, cross-school isolation, RBAC, safe DTO, audit event.
// Namespaced ("T8E").
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { createExam, createTerm, reconcileExamClasses, updateExam } from "@/lib/server/exams/service";
import { createScheduleEntry } from "@/lib/server/exams/schedule-service";
import { saveMarks, submitMarks, verifyMarks } from "@/lib/server/exams/marks-service";
import { createGradingScheme, reconcileGradingBands } from "@/lib/server/results/grading-service";
import { publishExamResults } from "@/lib/server/results/service";
import { getReportCard } from "@/lib/server/report-cards/service";
import { getPromotion, listPromotionCandidates, listPromotions, processPromotion } from "@/lib/server/promotion/service";
import type { OrgScope } from "@/lib/server/api/scope";
import { ROLE_PERMISSIONS } from "@/lib/server/authz/catalog";

let dbReady = false;
try {
  dbReady = Boolean(await prisma.role.findFirst({ where: { key: "SCHOOL_ADMIN", isSystem: true } }));
} catch {
  dbReady = false;
}

const NS = "T8E";
const stamp = Date.now().toString(36);

let tenantId = "", schoolId = "", branchA = "", sourceSessionId = "", targetSessionId = "", foreignSessionId = "";
let sourceClassId = "", sourceSectionId = "", targetClassId = "", targetSectionId = "", subjectId = "", adminUser = "", schemeId = "";
let scope: OrgScope;
let seq = 0;

async function makeUserWithRole(email: string, roleKey: string): Promise<string> {
  const u = await prisma.user.create({ data: { email, name: email, status: "ACTIVE" }, select: { id: true } });
  const m = await prisma.tenantMembership.create({ data: { userId: u.id, tenantId, status: "ACTIVE" }, select: { id: true } });
  const role = await prisma.role.findFirstOrThrow({ where: { key: roleKey, isSystem: true }, select: { id: true } });
  await prisma.roleAssignment.create({ data: { membershipId: m.id, roleId: role.id } });
  return u.id;
}

const STANDARD_BANDS = [
  { label: "A", minPercent: 71, maxPercent: 100, isPass: true },
  { label: "B", minPercent: 33, maxPercent: 70, isPass: true },
  { label: "F", minPercent: 0, maxPercent: 32, isPass: false },
];

/** A fresh student in a FRESH section of the shared source Class, with one
 *  VERIFIED, published paper on a fresh exam. Each call gets its own section
 *  (mirroring the Phase 8C/8D helper pattern) — an ExamScheduleEntry's roster
 *  is the WHOLE section, so sharing one section across calls would pull every
 *  earlier student into each new exam as an ungraded (INCOMPLETE) roster
 *  member and block publish. Returns everything a promotion needs. */
async function mkPromotableStudent(marksObtained: number, opts: { markStatus?: "marked" | "absent" | "exempt" } = {}) {
  seq += 1;
  const term = await createTerm(scope, { name: `Term ${seq}`, code: `T${seq}-${stamp}` });
  const exam = await createExam(scope, { examTermId: term.id, name: "Annual Exam", code: `AE${seq}-${stamp}`, startsOn: "2026-08-24", endsOn: "2026-08-28" });
  await updateExam(scope, exam.id, { gradingSchemeId: schemeId });
  await reconcileExamClasses(scope, exam.id, { classIds: [sourceClassId] });
  const section = (await prisma.section.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sourceSessionId, classId: sourceClassId, name: `F${seq}`, status: "ACTIVE" }, select: { id: true } })).id;
  const student = (await prisma.student.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sourceSessionId, admissionNumber: `${NS}-${stamp}-${seq}`, firstName: "S", lastName: `${seq}`, dateOfBirth: new Date("2015-01-01"), admissionDate: new Date("2024-04-01"), status: "ACTIVE" }, select: { id: true } })).id;
  const enrollment = await prisma.enrollment.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sourceSessionId, classId: sourceClassId, sectionId: section, studentId: student, status: "ENROLLED" }, select: { id: true } });
  const entry = await createScheduleEntry(scope, exam.id, { sectionId: section, subjectId, examDate: "2026-08-24", startTime: "09:00", endTime: "10:00" });
  await saveMarks(scope, exam.id, entry.id, { records: [{ studentId: student, status: opts.markStatus ?? "marked", marksObtained: (opts.markStatus ?? "marked") === "marked" ? marksObtained : undefined }] });
  await submitMarks(scope, exam.id, entry.id);
  await verifyMarks(scope, exam.id, entry.id);
  const published = await publishExamResults(scope, exam.id);
  const resultRow = await prisma.studentExamResult.findFirstOrThrow({ where: { publicationId: (await prisma.examResultPublication.findUniqueOrThrow({ where: { examId: exam.id } })).id, studentId: student } });
  return { examId: exam.id, student, fromEnrollmentId: enrollment.id, sourceStudentResultId: resultRow.id, publishedPercentage: published.students[0].percentage };
}

beforeAll(async () => {
  if (!dbReady) return;
  tenantId = (await prisma.tenant.create({ data: { name: `${NS} T`, slug: `t8e-${stamp}` }, select: { id: true } })).id;
  schoolId = (await prisma.school.create({ data: { tenantId, name: `${NS} S`, code: `${NS}-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  branchA = (await prisma.branch.create({ data: { schoolId, name: "A", code: `${NS}-A`, status: "ACTIVE" }, select: { id: true } })).id;
  sourceSessionId = (await prisma.academicSession.create({ data: { schoolId, name: "26-27", code: `${NS}-SRC`, startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31"), status: "ACTIVE", isCurrent: true }, select: { id: true } })).id;
  targetSessionId = (await prisma.academicSession.create({ data: { schoolId, name: "27-28", code: `${NS}-TGT`, startDate: new Date("2027-04-01"), endDate: new Date("2028-03-31"), status: "UPCOMING" }, select: { id: true } })).id;
  foreignSessionId = (await prisma.academicSession.create({ data: { schoolId, name: "28-29", code: `${NS}-FOR`, startDate: new Date("2028-04-01"), endDate: new Date("2029-03-31"), status: "DRAFT" }, select: { id: true } })).id;

  sourceClassId = (await prisma.class.create({ data: { tenantId, schoolId, academicSessionId: sourceSessionId, name: "Grade 5", order: 5 }, select: { id: true } })).id;
  const sourceSection = await prisma.section.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sourceSessionId, classId: sourceClassId, name: "A", status: "ACTIVE" }, select: { id: true } });
  sourceSectionId = sourceSection.id;

  targetClassId = (await prisma.class.create({ data: { tenantId, schoolId, academicSessionId: targetSessionId, name: "Grade 6", order: 6 }, select: { id: true } })).id;
  const targetSection = await prisma.section.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: targetSessionId, classId: targetClassId, name: "A", capacity: 40, status: "ACTIVE" }, select: { id: true } });
  targetSectionId = targetSection.id;

  subjectId = (await prisma.subject.create({ data: { tenantId, schoolId, code: `${NS}-M`, name: "Math", shortName: "M", department: "Math", type: "CORE", maxMarks: 100, passingMarks: 33, theoryMarks: 100, practicalMarks: 0 }, select: { id: true } })).id;
  await prisma.classSubject.create({ data: { tenantId, schoolId, academicSessionId: sourceSessionId, classId: sourceClassId, subjectId } });

  adminUser = await makeUserWithRole(`${NS.toLowerCase()}-admin-${stamp}@x.test`, "SCHOOL_ADMIN");
  scope = { tenantId, schoolId, branchId: branchA, academicSessionId: sourceSessionId, actor: { id: adminUser, name: `${NS} Tester` } };

  const scheme = await createGradingScheme(scope, { name: `Scheme ${stamp}` });
  await reconcileGradingBands(scope, scheme.id, { bands: STANDARD_BANDS });
  schemeId = scheme.id;
});

afterAll(async () => {
  if (!dbReady || !tenantId) return;
  await prisma.auditEvent.deleteMany({ where: { tenantId } });
  await prisma.user.deleteMany({ where: { id: adminUser } });
  await prisma.tenant.delete({ where: { id: tenantId } });
});

describe.skipIf(!dbReady)("candidates (DB)", () => {
  it("READY: a currently-enrolled student with a published result", async () => {
    const { examId, student } = await mkPromotableStudent(80);
    const candidates = await listPromotionCandidates(scope, { examId, targetAcademicSessionId: targetSessionId });
    const mine = candidates.find((c) => c.student.id === student)!;
    expect(mine.eligibility.state).toBe("ready");
    expect(mine.result?.status).toBe("pass");
    expect(mine.currentEnrollment?.className).toBe("Grade 5");
    expect(mine.existingPromotion).toBeNull();
  });

  it("blocked_result_unpublished: exam exists but has no publication yet", async () => {
    seq += 1;
    const term = await createTerm(scope, { name: `T ${seq}`, code: `TU${seq}-${stamp}` });
    const exam = await createExam(scope, { examTermId: term.id, name: "Unpublished", code: `UNP${seq}-${stamp}`, startsOn: "2026-08-24", endsOn: "2026-08-28" });
    await reconcileExamClasses(scope, exam.id, { classIds: [sourceClassId] });
    const student = (await prisma.student.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sourceSessionId, admissionNumber: `${NS}-${stamp}-u${seq}`, firstName: "U", lastName: "X", dateOfBirth: new Date("2015-01-01"), admissionDate: new Date("2024-04-01"), status: "ACTIVE" }, select: { id: true } })).id;
    await prisma.enrollment.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sourceSessionId, classId: sourceClassId, sectionId: sourceSectionId, studentId: student, status: "ENROLLED" } });

    const candidates = await listPromotionCandidates(scope, { examId: exam.id, targetAcademicSessionId: targetSessionId });
    const mine = candidates.find((c) => c.student.id === student)!;
    expect(mine.eligibility.state).toBe("blocked_result_unpublished");
    expect(mine.result).toBeNull();
  });

  it("blocked_result_incomplete: exam published, but this student has no result row in it", async () => {
    const { examId } = await mkPromotableStudent(50); // publishes the exam
    const outsider = (await prisma.student.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sourceSessionId, admissionNumber: `${NS}-${stamp}-o${seq}`, firstName: "O", lastName: "X", dateOfBirth: new Date("2015-01-01"), admissionDate: new Date("2024-04-01"), status: "ACTIVE" }, select: { id: true } })).id;
    await prisma.enrollment.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sourceSessionId, classId: sourceClassId, sectionId: sourceSectionId, studentId: outsider, status: "ENROLLED" } });

    const candidates = await listPromotionCandidates(scope, { examId, targetAcademicSessionId: targetSessionId });
    const mine = candidates.find((c) => c.student.id === outsider)!;
    expect(mine.eligibility.state).toBe("blocked_result_incomplete");
  });

  it("ABSENT result surfaces as an informational reason, not a blocked state", async () => {
    const { examId, student } = await mkPromotableStudent(0, { markStatus: "absent" });
    const candidates = await listPromotionCandidates(scope, { examId, targetAcademicSessionId: targetSessionId });
    const mine = candidates.find((c) => c.student.id === student)!;
    expect(mine.result?.status).toBe("absent");
    expect(mine.eligibility.state).toBe("ready"); // still an explicit admin decision, not auto-blocked
    expect(mine.eligibility.reasons.join(" ")).toMatch(/absent/i);
  });

  it("already_processed: a candidate with an existing decision for this exact transition", async () => {
    const { examId, student, sourceStudentResultId } = await mkPromotableStudent(60);
    await processPromotion(scope, { studentId: student, sourceStudentResultId, targetAcademicSessionId: targetSessionId, decision: "promoted", targetClassId, targetSectionId });
    const candidates = await listPromotionCandidates(scope, { examId, targetAcademicSessionId: targetSessionId });
    const mine = candidates.find((c) => c.student.id === student)!;
    expect(mine.eligibility.state).toBe("already_processed");
    expect(mine.existingPromotion?.decision).toBe("promoted");
  });
});

describe.skipIf(!dbReady)("PASS/FAIL never auto-decide (DB)", () => {
  it("a PASS result creates no StudentPromotion row on its own", async () => {
    const { student } = await mkPromotableStudent(90); // clear pass
    const count = await prisma.studentPromotion.count({ where: { studentId: student } });
    expect(count).toBe(0);
  });

  it("a FAIL result creates no StudentPromotion row on its own", async () => {
    const { student } = await mkPromotableStudent(10); // clear fail
    const count = await prisma.studentPromotion.count({ where: { studentId: student } });
    expect(count).toBe(0);
  });
});

describe.skipIf(!dbReady)("process — PROMOTED / RETAINED (DB)", () => {
  it("PROMOTED creates a new Enrollment in the target session and leaves the old one untouched", async () => {
    const { student, fromEnrollmentId, sourceStudentResultId } = await mkPromotableStudent(85);
    const result = await processPromotion(scope, { studentId: student, sourceStudentResultId, targetAcademicSessionId: targetSessionId, decision: "promoted", targetClassId, targetSectionId, notes: "Great year" });
    expect(result.decision).toBe("promoted");
    expect(result.notes).toBe("Great year");

    const newEnrollment = await prisma.enrollment.findFirstOrThrow({ where: { studentId: student, academicSessionId: targetSessionId } });
    expect(newEnrollment).toMatchObject({ classId: targetClassId, sectionId: targetSectionId, status: "ENROLLED" });

    const oldEnrollment = await prisma.enrollment.findUniqueOrThrow({ where: { id: fromEnrollmentId } });
    expect(oldEnrollment).toMatchObject({ academicSessionId: sourceSessionId, classId: sourceClassId, status: "ENROLLED" });
  });

  it("RETAINED also creates a next-session Enrollment (not a no-op) at whatever target class the admin chose", async () => {
    const { student, sourceStudentResultId } = await mkPromotableStudent(20); // fail
    const result = await processPromotion(scope, { studentId: student, sourceStudentResultId, targetAcademicSessionId: targetSessionId, decision: "retained", targetClassId, targetSectionId });
    expect(result.decision).toBe("retained");
    const newEnrollment = await prisma.enrollment.findFirst({ where: { studentId: student, academicSessionId: targetSessionId } });
    expect(newEnrollment).not.toBeNull();
  });

  it("audit event is recorded for both decisions", async () => {
    const a = await mkPromotableStudent(70);
    await processPromotion(scope, { studentId: a.student, sourceStudentResultId: a.sourceStudentResultId, targetAcademicSessionId: targetSessionId, decision: "promoted", targetClassId, targetSectionId });
    const promotedAudit = await prisma.auditEvent.findFirst({ where: { tenantId, action: "STUDENT_PROMOTED", entityId: a.student } });
    expect(promotedAudit).not.toBeNull();

    const b = await mkPromotableStudent(15);
    await processPromotion(scope, { studentId: b.student, sourceStudentResultId: b.sourceStudentResultId, targetAcademicSessionId: targetSessionId, decision: "retained", targetClassId, targetSectionId });
    const retainedAudit = await prisma.auditEvent.findFirst({ where: { tenantId, action: "STUDENT_RETAINED", entityId: b.student } });
    expect(retainedAudit).not.toBeNull();
  });
});

describe.skipIf(!dbReady)("historical safety — Report Card / StudentExamResult independence (DB)", () => {
  it("promotion never mutates the source StudentExamResult or its report card", async () => {
    const { examId, student, sourceStudentResultId } = await mkPromotableStudent(77);
    const beforeResult = await prisma.studentExamResult.findUniqueOrThrow({ where: { id: sourceStudentResultId } });
    const beforeCard = await getReportCard(scope, examId, student);

    await processPromotion(scope, { studentId: student, sourceStudentResultId, targetAcademicSessionId: targetSessionId, decision: "promoted", targetClassId, targetSectionId });

    const afterResult = await prisma.studentExamResult.findUniqueOrThrow({ where: { id: sourceStudentResultId } });
    expect(afterResult).toEqual(beforeResult);

    const afterCard = await getReportCard(scope, examId, student);
    expect(afterCard).toEqual(beforeCard);
    // Explicitly: Grade 5 -> Grade 6 promotion must not turn the Grade 5 card into Grade 6.
    expect(afterCard.classContext.className).toBe("Grade 5");
  });
});

describe.skipIf(!dbReady)("target validation (DB)", () => {
  it("INVALID_TARGET_SESSION when target === source session", async () => {
    const { student, sourceStudentResultId } = await mkPromotableStudent(60);
    await expect(processPromotion(scope, { studentId: student, sourceStudentResultId, targetAcademicSessionId: sourceSessionId, decision: "promoted", targetClassId, targetSectionId })).rejects.toMatchObject({ code: "INVALID_TARGET_SESSION" });
  });

  it("TARGET_CLASS_NOT_FOUND when the target class belongs to a different session", async () => {
    const { student, sourceStudentResultId } = await mkPromotableStudent(60);
    await expect(processPromotion(scope, { studentId: student, sourceStudentResultId, targetAcademicSessionId: targetSessionId, decision: "promoted", targetClassId: sourceClassId, targetSectionId })).rejects.toMatchObject({ code: "TARGET_CLASS_NOT_FOUND" });
  });

  it("TARGET_SECTION_NOT_FOUND when the target section belongs to a different class", async () => {
    const otherTargetClass = (await prisma.class.create({ data: { tenantId, schoolId, academicSessionId: targetSessionId, name: "Grade 7", order: 7 }, select: { id: true } })).id;
    const { student, sourceStudentResultId } = await mkPromotableStudent(60);
    await expect(processPromotion(scope, { studentId: student, sourceStudentResultId, targetAcademicSessionId: targetSessionId, decision: "promoted", targetClassId: otherTargetClass, targetSectionId })).rejects.toMatchObject({ code: "TARGET_SECTION_NOT_FOUND" });
  });

  it("NO_CURRENT_ENROLLMENT when the student has no active enrollment in the source session", async () => {
    const { student, fromEnrollmentId, sourceStudentResultId } = await mkPromotableStudent(60);
    await prisma.enrollment.update({ where: { id: fromEnrollmentId }, data: { status: "WITHDRAWN" } });
    await expect(processPromotion(scope, { studentId: student, sourceStudentResultId, targetAcademicSessionId: targetSessionId, decision: "promoted", targetClassId, targetSectionId })).rejects.toMatchObject({ code: "NO_CURRENT_ENROLLMENT" });
  });

  it("STUDENT_RESULT_NOT_FOUND when the result id does not belong to this student", async () => {
    const a = await mkPromotableStudent(60);
    const b = await mkPromotableStudent(60);
    await expect(processPromotion(scope, { studentId: a.student, sourceStudentResultId: b.sourceStudentResultId, targetAcademicSessionId: targetSessionId, decision: "promoted", targetClassId, targetSectionId })).rejects.toMatchObject({ code: "STUDENT_RESULT_NOT_FOUND" });
  });
});

describe.skipIf(!dbReady)("capacity (DB)", () => {
  it("SECTION_CAPACITY_EXCEEDED — sequential, single slot", async () => {
    const tightSection = await prisma.section.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: targetSessionId, classId: targetClassId, name: `Tight-${seq}`, capacity: 1, status: "ACTIVE" }, select: { id: true } });
    const a = await mkPromotableStudent(60);
    const b = await mkPromotableStudent(60);
    const first = await processPromotion(scope, { studentId: a.student, sourceStudentResultId: a.sourceStudentResultId, targetAcademicSessionId: targetSessionId, decision: "promoted", targetClassId, targetSectionId: tightSection.id });
    expect(first.decision).toBe("promoted");
    await expect(processPromotion(scope, { studentId: b.student, sourceStudentResultId: b.sourceStudentResultId, targetAcademicSessionId: targetSessionId, decision: "promoted", targetClassId, targetSectionId: tightSection.id })).rejects.toMatchObject({ code: "SECTION_CAPACITY_EXCEEDED" });
  });

  it("CONCURRENCY: two simultaneous promotions for different students into a one-slot section — exactly one succeeds", async () => {
    const tightSection = await prisma.section.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: targetSessionId, classId: targetClassId, name: `Tight2-${seq}`, capacity: 1, status: "ACTIVE" }, select: { id: true } });
    const a = await mkPromotableStudent(60);
    const b = await mkPromotableStudent(60);
    const results = await Promise.allSettled([
      processPromotion(scope, { studentId: a.student, sourceStudentResultId: a.sourceStudentResultId, targetAcademicSessionId: targetSessionId, decision: "promoted", targetClassId, targetSectionId: tightSection.id }),
      processPromotion(scope, { studentId: b.student, sourceStudentResultId: b.sourceStudentResultId, targetAcademicSessionId: targetSessionId, decision: "promoted", targetClassId, targetSectionId: tightSection.id }),
    ]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({ code: "SECTION_CAPACITY_EXCEEDED" });
    const enrolledCount = await prisma.enrollment.count({ where: { sectionId: tightSection.id, status: "ENROLLED" } });
    expect(enrolledCount).toBe(1);
  });
});

describe.skipIf(!dbReady)("idempotency + concurrency safety (DB)", () => {
  it("PROMOTION_ALREADY_PROCESSED on a repeat request for the same transition", async () => {
    const { student, sourceStudentResultId } = await mkPromotableStudent(60);
    await processPromotion(scope, { studentId: student, sourceStudentResultId, targetAcademicSessionId: targetSessionId, decision: "promoted", targetClassId, targetSectionId });
    await expect(processPromotion(scope, { studentId: student, sourceStudentResultId, targetAcademicSessionId: targetSessionId, decision: "promoted", targetClassId, targetSectionId })).rejects.toMatchObject({ code: "PROMOTION_ALREADY_PROCESSED" });
  });

  it("CONCURRENCY: two simultaneous promotion requests for the SAME student/transition — exactly one succeeds", async () => {
    const { student, sourceStudentResultId } = await mkPromotableStudent(60);
    const results = await Promise.allSettled([
      processPromotion(scope, { studentId: student, sourceStudentResultId, targetAcademicSessionId: targetSessionId, decision: "promoted", targetClassId, targetSectionId }),
      processPromotion(scope, { studentId: student, sourceStudentResultId, targetAcademicSessionId: targetSessionId, decision: "promoted", targetClassId, targetSectionId }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const count = await prisma.studentPromotion.count({ where: { studentId: student, fromAcademicSessionId: sourceSessionId, toAcademicSessionId: targetSessionId } });
    expect(count).toBe(1);
    const enrollmentCount = await prisma.enrollment.count({ where: { studentId: student, academicSessionId: targetSessionId } });
    expect(enrollmentCount).toBe(1);
  });
});

describe.skipIf(!dbReady)("isolation (DB)", () => {
  it("a foreign school's exam is not found for candidates listing", async () => {
    const { examId } = await mkPromotableStudent(60);
    const foreignSchool = (await prisma.school.create({ data: { tenantId, name: `${NS} SB`, code: `${NS}-SB-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
    const foreignBranch = (await prisma.branch.create({ data: { schoolId: foreignSchool, name: "B", code: `${NS}-BB`, status: "ACTIVE" }, select: { id: true } })).id;
    const foreignSession = (await prisma.academicSession.create({ data: { schoolId: foreignSchool, name: "26-27", code: `${NS}-SBS`, startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31"), status: "ACTIVE" }, select: { id: true } })).id;
    const foreignTargetSession = (await prisma.academicSession.create({ data: { schoolId: foreignSchool, name: "27-28", code: `${NS}-SBT`, startDate: new Date("2027-04-01"), endDate: new Date("2028-03-31"), status: "UPCOMING" }, select: { id: true } })).id;
    const foreignScope: OrgScope = { tenantId, schoolId: foreignSchool, branchId: foreignBranch, academicSessionId: foreignSession, actor: { id: "x", name: "X" } };
    // A real target session for the FOREIGN school (so target-session
    // validation passes) still can't see the original school's exam.
    await expect(listPromotionCandidates(foreignScope, { examId, targetAcademicSessionId: foreignTargetSession })).rejects.toMatchObject({ code: "EXAM_NOT_FOUND" });
  });

  it("INVALID_TARGET_SESSION for a target session belonging to a different school", async () => {
    const { student, sourceStudentResultId } = await mkPromotableStudent(60);
    const foreignSchool = (await prisma.school.create({ data: { tenantId, name: `${NS} SC`, code: `${NS}-SC-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
    const foreignSession = (await prisma.academicSession.create({ data: { schoolId: foreignSchool, name: "26-27", code: `${NS}-SCS`, startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31"), status: "ACTIVE" }, select: { id: true } })).id;
    await expect(processPromotion(scope, { studentId: student, sourceStudentResultId, targetAcademicSessionId: foreignSession, decision: "promoted", targetClassId, targetSectionId })).rejects.toMatchObject({ code: "INVALID_TARGET_SESSION" });
  });

  it("a real but never-selected third session is still a valid target (INVALID_TARGET_SESSION is about school, not 'nextness')", async () => {
    const { student, sourceStudentResultId } = await mkPromotableStudent(60);
    const cls = (await prisma.class.create({ data: { tenantId, schoolId, academicSessionId: foreignSessionId, name: "Grade 8", order: 8 }, select: { id: true } })).id;
    const sec = (await prisma.section.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: foreignSessionId, classId: cls, name: "A", status: "ACTIVE" }, select: { id: true } })).id;
    const result = await processPromotion(scope, { studentId: student, sourceStudentResultId, targetAcademicSessionId: foreignSessionId, decision: "promoted", targetClassId: cls, targetSectionId: sec });
    expect(result.toSession.id).toBe(foreignSessionId);
  });
});

describe.skipIf(!dbReady)("RBAC + history + DTO safety (DB)", () => {
  it("SCHOOL_ADMIN/PRINCIPAL get promotion.manage; TEACHER gets promotion.view only", () => {
    expect(ROLE_PERMISSIONS.SCHOOL_ADMIN).toContain("promotion.manage");
    expect(ROLE_PERMISSIONS.PRINCIPAL).toContain("promotion.manage");
    expect(ROLE_PERMISSIONS.TEACHER).toContain("promotion.view");
    expect(ROLE_PERMISSIONS.TEACHER).not.toContain("promotion.manage");
  });

  it("listPromotions returns real, filterable, paginated history; getPromotion round-trips it", async () => {
    const { student, sourceStudentResultId } = await mkPromotableStudent(88);
    const created = await processPromotion(scope, { studentId: student, sourceStudentResultId, targetAcademicSessionId: targetSessionId, decision: "promoted", targetClassId, targetSectionId, notes: "Top of class" });

    const { data } = await listPromotions(scope, { toAcademicSessionId: targetSessionId, decision: "promoted", search: created.student.admissionNumber });
    expect(data.some((p) => p.id === created.id)).toBe(true);

    const fetched = await getPromotion(scope, created.id);
    expect(fetched).toEqual(created);
  });

  it("promotion DTO exposes only safe fields", async () => {
    const { student, sourceStudentResultId } = await mkPromotableStudent(65);
    const created = await processPromotion(scope, { studentId: student, sourceStudentResultId, targetAcademicSessionId: targetSessionId, decision: "promoted", targetClassId, targetSectionId });
    expect(Object.keys(created).sort()).toEqual(["decision", "fromClassName", "fromSectionName", "fromSession", "id", "notes", "processedAt", "processedByName", "sourceExamId", "student", "targetClass", "targetSection", "toSession"]);
  });
});
