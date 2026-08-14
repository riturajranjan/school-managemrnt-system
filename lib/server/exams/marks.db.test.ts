// Marks entry DB integration tests (Phase 8B). Real Postgres: roster from real
// Enrollment; marks validated against the ExamScheduleEntry SNAPSHOT (never live
// Subject); explicit status (PENDING/MARKED/ABSENT/EXEMPT — absence is never
// zero, zero is a valid score); theory/practical component validation + server-
// computed total vs. single marksObtained path; duplicate-in-request rejection;
// bulk atomicity (no partial success); teacher ownership via real
// TeachingAssignment (own subject allowed, another teacher's rejected, admin
// bypasses); Draft → Submitted → Verified lifecycle + locking; historical safety
// (Subject change/archive, Staff inactive, Student unenrollment all keep
// recorded marks readable/unchanged); schedule-entry delete guard; isolation;
// concurrency (get-or-create sheet race, same-student write race, save-vs-submit
// race); RBAC catalog; safe DTO shape. Namespaced ("T8B").
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { createExam, createTerm, reconcileExamClasses } from "@/lib/server/exams/service";
import { createScheduleEntry, deleteScheduleEntry } from "@/lib/server/exams/schedule-service";
import { getMarksRoster, saveMarks, submitMarks, verifyMarks } from "@/lib/server/exams/marks-service";
import type { OrgScope } from "@/lib/server/api/scope";
import { ROLE_PERMISSIONS } from "@/lib/server/authz/catalog";

let dbReady = false;
try {
  dbReady = Boolean(await prisma.role.findFirst({ where: { key: "SCHOOL_ADMIN", isSystem: true } }));
} catch {
  dbReady = false;
}

const NS = "T8B";
const stamp = Date.now().toString(36);

let tenantId = "", schoolId = "", branchA = "", sessionId = "", classId = "", subjectId = "";
let staff1 = "", staff2 = "", examId = "";
let scopeAdmin: OrgScope, scopeTeacher1: OrgScope, scopeTeacher2: OrgScope;
let adminUser = "", teacher1User = "", teacher2User = "";
let sectionSeq = 0;

async function makeUserWithRole(email: string, roleKey: string): Promise<string> {
  const u = await prisma.user.create({ data: { email, name: email, status: "ACTIVE" }, select: { id: true } });
  const m = await prisma.tenantMembership.create({ data: { userId: u.id, tenantId, status: "ACTIVE" }, select: { id: true } });
  const role = await prisma.role.findFirstOrThrow({ where: { key: roleKey, isSystem: true }, select: { id: true } });
  await prisma.roleAssignment.create({ data: { membershipId: m.id, roleId: role.id } });
  return u.id;
}

/** Fresh Section + fresh Students/Enrollments + a scheduled paper, so unrelated
 *  test cases never collide on either the "one paper per section per day"
 *  global uniqueness OR the "one Enrollment per student per session" uniqueness
 *  (Enrollment.@@unique([academicSessionId, studentId]) — a student can only be
 *  enrolled once per session, so each test needs its own students, not shared
 *  ones re-enrolled into a new section). */
async function mkEntry(overrides: Partial<{ maxMarks: number; passingMarks: number; theoryMarks: number; practicalMarks: number }> = {}) {
  sectionSeq += 1;
  const section = (await prisma.section.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, classId, name: `F${sectionSeq}`, status: "ACTIVE" }, select: { id: true } })).id;
  const enrolled: { studentId: string; enrollmentId: string }[] = [];
  for (const k of ["a", "b", "c"]) {
    const sid = (await prisma.student.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, admissionNumber: `${NS}-${stamp}-${sectionSeq}${k}`, firstName: k.toUpperCase(), lastName: "T", dateOfBirth: new Date("2015-01-01"), admissionDate: new Date("2024-04-01"), status: "ACTIVE" }, select: { id: true } })).id;
    const en = await prisma.enrollment.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, classId, sectionId: section, studentId: sid, status: "ENROLLED" }, select: { id: true } });
    enrolled.push({ studentId: sid, enrollmentId: en.id });
  }
  await prisma.teachingAssignment.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, sectionId: section, subjectId, staffId: staff1 } });
  const entry = await createScheduleEntry(scopeAdmin, examId, {
    sectionId: section, subjectId, examDate: "2026-08-24", startTime: "09:00", endTime: "10:00", ...overrides,
  });
  return { section, entry, enrolled };
}

beforeAll(async () => {
  if (!dbReady) return;
  tenantId = (await prisma.tenant.create({ data: { name: `${NS} T`, slug: `t8b-${stamp}` }, select: { id: true } })).id;
  schoolId = (await prisma.school.create({ data: { tenantId, name: `${NS} S`, code: `${NS}-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  branchA = (await prisma.branch.create({ data: { schoolId, name: "A", code: `${NS}-A`, status: "ACTIVE" }, select: { id: true } })).id;
  sessionId = (await prisma.academicSession.create({ data: { schoolId, name: "26-27", code: `${NS}-S`, startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31"), status: "ACTIVE" }, select: { id: true } })).id;
  classId = (await prisma.class.create({ data: { tenantId, schoolId, academicSessionId: sessionId, name: "Grade 5", order: 5 }, select: { id: true } })).id;
  subjectId = (await prisma.subject.create({ data: { tenantId, schoolId, code: `${NS}-M`, name: "Math", shortName: "M", department: "Math", type: "CORE", maxMarks: 100, passingMarks: 33, theoryMarks: 100, practicalMarks: 0 }, select: { id: true } })).id;
  await prisma.classSubject.create({ data: { tenantId, schoolId, academicSessionId: sessionId, classId, subjectId } });
  staff1 = (await prisma.staff.create({ data: { tenantId, schoolId, branchId: branchA, employeeCode: `${NS}-T1`, firstName: "Tara", isTeaching: true, status: "ACTIVE" }, select: { id: true } })).id;
  staff2 = (await prisma.staff.create({ data: { tenantId, schoolId, branchId: branchA, employeeCode: `${NS}-T2`, firstName: "Ravi", isTeaching: true, status: "ACTIVE" }, select: { id: true } })).id;

  adminUser = await makeUserWithRole(`t8b-admin-${stamp}@x.test`, "SCHOOL_ADMIN");
  teacher1User = await makeUserWithRole(`t8b-t1-${stamp}@x.test`, "TEACHER");
  teacher2User = await makeUserWithRole(`t8b-t2-${stamp}@x.test`, "TEACHER");
  await prisma.staff.update({ where: { id: staff1 }, data: { userId: teacher1User } });
  await prisma.staff.update({ where: { id: staff2 }, data: { userId: teacher2User } });

  scopeAdmin = { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, actor: { id: adminUser, name: "Admin" } };
  scopeTeacher1 = { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, actor: { id: teacher1User, name: "T1" } };
  scopeTeacher2 = { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, actor: { id: teacher2User, name: "T2" } };

  const term = await createTerm(scopeAdmin, { name: "Term 1", code: "T1" });
  const exam = await createExam(scopeAdmin, { examTermId: term.id, name: "Unit Test", code: "UT1", startsOn: "2026-08-24", endsOn: "2026-08-28" });
  examId = exam.id;
  await reconcileExamClasses(scopeAdmin, examId, { classIds: [classId] });
});

afterAll(async () => {
  if (!dbReady || !tenantId) return;
  await prisma.auditEvent.deleteMany({ where: { tenantId } });
  await prisma.staff.updateMany({ where: { tenantId }, data: { userId: null } });
  await prisma.user.deleteMany({ where: { id: { in: [adminUser, teacher1User, teacher2User] } } });
  await prisma.tenant.delete({ where: { id: tenantId } });
});

describe.skipIf(!dbReady)("marks roster (DB)", () => {
  it("builds the roster from real Enrollment; all PENDING before anything is entered", async () => {
    const { entry, enrolled } = await mkEntry();
    const roster = await getMarksRoster(scopeAdmin, examId, entry.id);
    expect(roster.students.map((s) => s.studentId).sort()).toEqual(enrolled.map((e) => e.studentId).sort());
    expect(roster.students.every((s) => s.status === "pending" && s.theoryMarks === null && s.practicalMarks === null && s.marksObtained === null)).toBe(true);
    expect(roster.sheet.status).toBe("draft");
    expect(roster.summary).toMatchObject({ totalStudents: 3, enteredCount: 0, pendingCount: 3 });
  });

  it("get-or-create is idempotent: viewing twice reuses the same sheet", async () => {
    const { entry } = await mkEntry();
    const r1 = await getMarksRoster(scopeAdmin, examId, entry.id);
    const r2 = await getMarksRoster(scopeAdmin, examId, entry.id);
    expect(r1.sheet.id).toBe(r2.sheet.id);
    const count = await prisma.examMarkSheet.count({ where: { examScheduleEntryId: entry.id } });
    expect(count).toBe(1);
  });
});

describe.skipIf(!dbReady)("marks validation (DB)", () => {
  it("zero is a valid, persisted score — never coerced to null/absent", async () => {
    const { entry, enrolled } = await mkEntry({ maxMarks: 100, theoryMarks: 100, practicalMarks: 0 });
    const roster = await saveMarks(scopeAdmin, examId, entry.id, { records: [{ studentId: enrolled[0].studentId, status: "marked", marksObtained: 0 }] });
    const row = roster.students.find((s) => s.studentId === enrolled[0].studentId)!;
    expect(row.status).toBe("marked");
    expect(row.marksObtained).toBe(0);
  });

  it("rejects marks exceeding the snapshotted max (no-split path)", async () => {
    const { entry, enrolled } = await mkEntry({ maxMarks: 100, theoryMarks: 100, practicalMarks: 0 });
    await expect(saveMarks(scopeAdmin, examId, entry.id, { records: [{ studentId: enrolled[0].studentId, status: "marked", marksObtained: 101 }] })).rejects.toMatchObject({ code: "MARKS_EXCEED_MAXIMUM" });
  });

  it("rejects negative marks", async () => {
    const { entry, enrolled } = await mkEntry({ maxMarks: 100, theoryMarks: 100, practicalMarks: 0 });
    await expect(saveMarks(scopeAdmin, examId, entry.id, { records: [{ studentId: enrolled[0].studentId, status: "marked", marksObtained: -1 }] })).rejects.toMatchObject({ code: "INVALID_MARKS" });
  });

  it("split paper: validates theory/practical independently and computes the total server-side", async () => {
    const { entry, enrolled } = await mkEntry({ maxMarks: 100, theoryMarks: 70, practicalMarks: 30 });
    const roster = await saveMarks(scopeAdmin, examId, entry.id, { records: [{ studentId: enrolled[0].studentId, status: "marked", theoryMarks: 65, practicalMarks: 25 }] });
    const row = roster.students.find((s) => s.studentId === enrolled[0].studentId)!;
    expect(row.theoryMarks).toBe(65);
    expect(row.practicalMarks).toBe(25);
    expect(row.marksObtained).toBe(90); // server-computed, never client-supplied
    await expect(saveMarks(scopeAdmin, examId, entry.id, { records: [{ studentId: enrolled[1].studentId, status: "marked", theoryMarks: 71, practicalMarks: 10 }] })).rejects.toMatchObject({ code: "MARKS_EXCEED_MAXIMUM" });
    await expect(saveMarks(scopeAdmin, examId, entry.id, { records: [{ studentId: enrolled[1].studentId, status: "marked", theoryMarks: 60 }] })).rejects.toMatchObject({ code: "INVALID_MARK_COMPONENTS" }); // missing practical
    await expect(saveMarks(scopeAdmin, examId, entry.id, { records: [{ studentId: enrolled[1].studentId, status: "marked", marksObtained: 90 }] })).rejects.toMatchObject({ code: "INVALID_MARK_COMPONENTS" }); // wrong shape for a split paper
  });

  it("ABSENT/EXEMPT carry null marks — never zero — and reject numeric input alongside them", async () => {
    const { entry, enrolled } = await mkEntry();
    const roster = await saveMarks(scopeAdmin, examId, entry.id, {
      records: [{ studentId: enrolled[0].studentId, status: "absent" }, { studentId: enrolled[1].studentId, status: "exempt" }],
    });
    const absent = roster.students.find((s) => s.studentId === enrolled[0].studentId)!;
    const exempt = roster.students.find((s) => s.studentId === enrolled[1].studentId)!;
    expect(absent).toMatchObject({ status: "absent", marksObtained: null, theoryMarks: null, practicalMarks: null });
    expect(exempt).toMatchObject({ status: "exempt", marksObtained: null, theoryMarks: null, practicalMarks: null });
    await expect(saveMarks(scopeAdmin, examId, entry.id, { records: [{ studentId: enrolled[2].studentId, status: "absent", marksObtained: 10 }] })).rejects.toMatchObject({ code: "INVALID_MARK_COMPONENTS" });
  });

  it("STUDENT_NOT_ELIGIBLE_FOR_EXAM: a student outside the paper's section is rejected", async () => {
    const { entry } = await mkEntry();
    const outsider = (await prisma.student.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, admissionNumber: `${NS}-${stamp}-out`, firstName: "Out", lastName: "Side", dateOfBirth: new Date("2015-01-01"), admissionDate: new Date("2024-04-01"), status: "ACTIVE" }, select: { id: true } })).id;
    await expect(saveMarks(scopeAdmin, examId, entry.id, { records: [{ studentId: outsider, status: "marked", marksObtained: 50 }] })).rejects.toMatchObject({ code: "STUDENT_NOT_ELIGIBLE_FOR_EXAM" });
  });

  it("DUPLICATE_STUDENT_MARK: the same student twice in one request is rejected", async () => {
    const { entry, enrolled } = await mkEntry();
    await expect(
      saveMarks(scopeAdmin, examId, entry.id, { records: [{ studentId: enrolled[0].studentId, status: "marked", marksObtained: 10 }, { studentId: enrolled[0].studentId, status: "marked", marksObtained: 20 }] }),
    ).rejects.toMatchObject({ code: "DUPLICATE_STUDENT_MARK" });
  });

  it("bulk atomicity: one invalid row aborts the WHOLE request — zero rows change", async () => {
    const { entry, enrolled } = await mkEntry({ maxMarks: 100, theoryMarks: 100, practicalMarks: 0 });
    const before = await prisma.examMark.count({ where: { markSheet: { examScheduleEntryId: entry.id } } });
    await expect(
      saveMarks(scopeAdmin, examId, entry.id, {
        records: [
          { studentId: enrolled[0].studentId, status: "marked", marksObtained: 80 },
          { studentId: enrolled[1].studentId, status: "marked", marksObtained: 999 }, // invalid — over max
        ],
      }),
    ).rejects.toMatchObject({ code: "MARKS_EXCEED_MAXIMUM" });
    const after = await prisma.examMark.count({ where: { markSheet: { examScheduleEntryId: entry.id } } });
    expect(after).toBe(before); // the valid row was NOT partially committed
  });
});

describe.skipIf(!dbReady)("teacher ownership (DB)", () => {
  it("the assigned teacher may enter marks for their own section+subject", async () => {
    const { entry, enrolled } = await mkEntry(); // mkEntry grants staff1/teacher1 a TeachingAssignment on the fresh section
    const roster = await saveMarks(scopeTeacher1, examId, entry.id, { records: [{ studentId: enrolled[0].studentId, status: "marked", marksObtained: 70 }] });
    expect(roster.students.find((s) => s.studentId === enrolled[0].studentId)?.marksObtained).toBe(70);
  });

  it("TEACHER_NOT_ASSIGNED: a teacher with no TeachingAssignment on this section+subject is rejected", async () => {
    const { entry, enrolled } = await mkEntry();
    await expect(saveMarks(scopeTeacher2, examId, entry.id, { records: [{ studentId: enrolled[0].studentId, status: "marked", marksObtained: 70 }] })).rejects.toMatchObject({ code: "TEACHER_NOT_ASSIGNED" });
  });

  it("SCHOOL_ADMIN bypasses teacher-ownership entirely", async () => {
    const { entry, enrolled } = await mkEntry();
    const roster = await saveMarks(scopeAdmin, examId, entry.id, { records: [{ studentId: enrolled[0].studentId, status: "marked", marksObtained: 60 }] });
    expect(roster.students.find((s) => s.studentId === enrolled[0].studentId)?.marksObtained).toBe(60);
  });
});

describe.skipIf(!dbReady)("lifecycle: draft → submitted → verified (DB)", () => {
  it("teacher submits; further teacher edits are blocked; admin may still correct before verify", async () => {
    const { entry, enrolled } = await mkEntry();
    await saveMarks(scopeTeacher1, examId, entry.id, { records: [{ studentId: enrolled[0].studentId, status: "marked", marksObtained: 55 }] });
    const submitted = await submitMarks(scopeTeacher1, examId, entry.id);
    expect(submitted.sheet.status).toBe("submitted");
    await expect(saveMarks(scopeTeacher1, examId, entry.id, { records: [{ studentId: enrolled[0].studentId, status: "marked", marksObtained: 56 }] })).rejects.toMatchObject({ code: "MARKS_ALREADY_SUBMITTED" });
    const corrected = await saveMarks(scopeAdmin, examId, entry.id, { records: [{ studentId: enrolled[0].studentId, status: "marked", marksObtained: 57 }] });
    expect(corrected.students.find((s) => s.studentId === enrolled[0].studentId)?.marksObtained).toBe(57);
  });

  it("cannot verify a DRAFT sheet; verify locks it; further edits are rejected as MARKS_LOCKED", async () => {
    const { entry, enrolled } = await mkEntry();
    await expect(verifyMarks(scopeAdmin, examId, entry.id)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await saveMarks(scopeAdmin, examId, entry.id, { records: [{ studentId: enrolled[0].studentId, status: "marked", marksObtained: 40 }] });
    await submitMarks(scopeAdmin, examId, entry.id);
    const verified = await verifyMarks(scopeAdmin, examId, entry.id);
    expect(verified.sheet.status).toBe("verified");
    await expect(saveMarks(scopeAdmin, examId, entry.id, { records: [{ studentId: enrolled[0].studentId, status: "marked", marksObtained: 41 }] })).rejects.toMatchObject({ code: "MARKS_LOCKED" });
    await expect(verifyMarks(scopeAdmin, examId, entry.id)).rejects.toMatchObject({ code: "MARKS_LOCKED" }); // re-verify is a no-op-that-fails, not silent success
  });

  it("verify is FORBIDDEN for a teacher (marks.verify is SCHOOL_ADMIN/PRINCIPAL only)", async () => {
    const { entry, enrolled } = await mkEntry();
    await saveMarks(scopeTeacher1, examId, entry.id, { records: [{ studentId: enrolled[0].studentId, status: "marked", marksObtained: 40 }] });
    await submitMarks(scopeTeacher1, examId, entry.id);
    await expect(verifyMarks(scopeTeacher1, examId, entry.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe.skipIf(!dbReady)("historical safety (DB)", () => {
  it("Subject default change / archive does not alter an already-recorded mark or its paper's caps", async () => {
    const { entry, enrolled } = await mkEntry({ maxMarks: 100, theoryMarks: 100, practicalMarks: 0 });
    await saveMarks(scopeAdmin, examId, entry.id, { records: [{ studentId: enrolled[0].studentId, status: "marked", marksObtained: 90 }] });
    await prisma.subject.update({ where: { id: subjectId }, data: { maxMarks: 40, status: "ARCHIVED" } });
    const roster = await getMarksRoster(scopeAdmin, examId, entry.id);
    expect(roster.entry.maxMarks).toBe(100); // unchanged despite Subject default now being 40
    expect(roster.students.find((s) => s.studentId === enrolled[0].studentId)?.marksObtained).toBe(90);
    await prisma.subject.update({ where: { id: subjectId }, data: { maxMarks: 100, status: "ACTIVE" } });
  });

  it("Staff going INACTIVE does not affect already-recorded marks", async () => {
    const { entry, enrolled } = await mkEntry();
    await saveMarks(scopeTeacher1, examId, entry.id, { records: [{ studentId: enrolled[0].studentId, status: "marked", marksObtained: 33 }] });
    await prisma.staff.update({ where: { id: staff1 }, data: { status: "INACTIVE" } });
    const roster = await getMarksRoster(scopeAdmin, examId, entry.id);
    expect(roster.students.find((s) => s.studentId === enrolled[0].studentId)?.marksObtained).toBe(33);
    await prisma.staff.update({ where: { id: staff1 }, data: { status: "ACTIVE" } });
  });

  it("a student unenrolled after being marked stays visible with their mark intact (historical, not silently dropped)", async () => {
    const { entry, enrolled } = await mkEntry();
    await saveMarks(scopeAdmin, examId, entry.id, { records: [{ studentId: enrolled[0].studentId, status: "marked", marksObtained: 44 }] });
    await prisma.enrollment.update({ where: { id: enrolled[0].enrollmentId }, data: { status: "WITHDRAWN" } });
    const roster = await getMarksRoster(scopeAdmin, examId, entry.id);
    const row = roster.students.find((s) => s.studentId === enrolled[0].studentId);
    expect(row).toBeDefined();
    expect(row?.currentlyEnrolled).toBe(false);
    expect(row?.marksObtained).toBe(44);
    expect(roster.summary.totalStudents).toBe(3); // 2 currently-enrolled + 1 historical
  });
});

describe.skipIf(!dbReady)("schedule-entry delete guard (DB)", () => {
  it("a paper with recorded marks cannot be deleted; one with none can", async () => {
    const { entry, enrolled } = await mkEntry();
    await saveMarks(scopeAdmin, examId, entry.id, { records: [{ studentId: enrolled[0].studentId, status: "marked", marksObtained: 50 }] });
    await expect(deleteScheduleEntry(scopeAdmin, examId, entry.id)).rejects.toMatchObject({ code: "CONFLICT" });

    const { entry: emptyEntry } = await mkEntry();
    await getMarksRoster(scopeAdmin, examId, emptyEntry.id); // creates a DRAFT sheet with zero recorded marks
    await expect(deleteScheduleEntry(scopeAdmin, examId, emptyEntry.id)).resolves.toMatchObject({ id: emptyEntry.id });
  });
});

describe.skipIf(!dbReady)("isolation (DB)", () => {
  it("a foreign exam/entry is not found from another school's scope", async () => {
    const { entry } = await mkEntry();
    const foreignSchool = (await prisma.school.create({ data: { tenantId, name: `${NS} SB`, code: `${NS}-SB-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
    const foreignBranch = (await prisma.branch.create({ data: { schoolId: foreignSchool, name: "B", code: `${NS}-BB`, status: "ACTIVE" }, select: { id: true } })).id;
    const foreignSession = (await prisma.academicSession.create({ data: { schoolId: foreignSchool, name: "26-27", code: `${NS}-SBS`, startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31"), status: "ACTIVE" }, select: { id: true } })).id;
    const scopeForeign: OrgScope = { tenantId, schoolId: foreignSchool, branchId: foreignBranch, academicSessionId: foreignSession, actor: { id: adminUser, name: "Admin" } };
    await expect(getMarksRoster(scopeForeign, examId, entry.id)).rejects.toMatchObject({ code: "EXAM_NOT_FOUND" });
  });
});

describe.skipIf(!dbReady)("concurrency (DB)", () => {
  it("Race A: two concurrent roster views → exactly one ExamMarkSheet row", async () => {
    const { entry } = await mkEntry();
    await Promise.all([getMarksRoster(scopeAdmin, examId, entry.id), getMarksRoster(scopeAdmin, examId, entry.id)]);
    const count = await prisma.examMarkSheet.count({ where: { examScheduleEntryId: entry.id } });
    expect(count).toBe(1);
  });

  it("Race B: two concurrent saves for the SAME student → one canonical row, no duplicates", async () => {
    const { entry, enrolled } = await mkEntry();
    const results = await Promise.allSettled([
      saveMarks(scopeAdmin, examId, entry.id, { records: [{ studentId: enrolled[0].studentId, status: "marked", marksObtained: 10 }] }),
      saveMarks(scopeAdmin, examId, entry.id, { records: [{ studentId: enrolled[0].studentId, status: "marked", marksObtained: 20 }] }),
    ]);
    expect(results.every((r) => r.status === "fulfilled")).toBe(true);
    const sheet = await prisma.examMarkSheet.findUniqueOrThrow({ where: { examScheduleEntryId: entry.id }, select: { id: true } });
    const count = await prisma.examMark.count({ where: { markSheetId: sheet.id, studentId: enrolled[0].studentId } });
    expect(count).toBe(1);
  });

  it("Race C: a save racing with submit fails safely — no corrupted mixed state", async () => {
    const { entry, enrolled } = await mkEntry();
    await saveMarks(scopeAdmin, examId, entry.id, { records: [{ studentId: enrolled[0].studentId, status: "marked", marksObtained: 30 }] });
    const results = await Promise.allSettled([
      submitMarks(scopeAdmin, examId, entry.id),
      saveMarks(scopeAdmin, examId, entry.id, { records: [{ studentId: enrolled[1].studentId, status: "marked", marksObtained: 35 }] }),
    ]);
    // Both a) both succeed (save landed first) or b) the save loses to the submit
    // (MARKS_ALREADY_SUBMITTED) — either way the sheet ends up SUBMITTED and no
    // exception besides the expected typed HttpError ever escapes.
    for (const r of results) if (r.status === "rejected") expect((r.reason as { code?: string }).code).toBe("MARKS_ALREADY_SUBMITTED");
    const sheet = await prisma.examMarkSheet.findUniqueOrThrow({ where: { examScheduleEntryId: entry.id }, select: { status: true } });
    expect(sheet.status).toBe("SUBMITTED");
  });
});

describe.skipIf(!dbReady)("RBAC + DTO safety (DB)", () => {
  it("marks.enter: SCHOOL_ADMIN + TEACHER; marks.verify: SCHOOL_ADMIN + PRINCIPAL only", () => {
    expect(ROLE_PERMISSIONS.SCHOOL_ADMIN).toContain("marks.enter");
    expect(ROLE_PERMISSIONS.SCHOOL_ADMIN).toContain("marks.verify");
    expect(ROLE_PERMISSIONS.TEACHER).toContain("marks.enter");
    expect(ROLE_PERMISSIONS.TEACHER).not.toContain("marks.verify");
    expect(ROLE_PERMISSIONS.PRINCIPAL).toContain("marks.verify");
    expect(ROLE_PERMISSIONS.PRINCIPAL).not.toContain("marks.enter");
  });

  it("roster DTO exposes only safe display fields per student", async () => {
    const { entry } = await mkEntry();
    const roster = await getMarksRoster(scopeAdmin, examId, entry.id);
    const keys = Object.keys(roster.students[0]).sort();
    expect(keys).toEqual(["admissionNumber", "currentlyEnrolled", "enrollmentId", "enteredAt", "enteredByName", "marksObtained", "name", "practicalMarks", "remarks", "rollNumber", "status", "studentId", "theoryMarks"]);
  });
});
