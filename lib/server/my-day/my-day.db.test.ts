// My Day + current-Staff resolution DB integration tests (Phase 9A). Real
// Postgres: User -> Staff.userId resolution (linked/unlinked/foreign/inactive/
// admin-without-staff); today's real TimetableEntry ordered + weekday-correct;
// real PERIOD AttendanceSession action state (not_marked/draft/submitted/
// locked); real pending ExamMarkSheet actions (owned via TeachingAssignment,
// VERIFIED excluded); real upcoming exams; teacher ownership isolation
// (Teacher A cannot see Teacher B's day); cross-school isolation; RBAC; safe
// DTO. Namespaced ("T9A").
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { getCurrentStaffProfile } from "@/lib/server/staff/service";
import { getMyDay } from "@/lib/server/my-day/service";
import { serverToday } from "@/lib/server/attendance/service";
import { weekdayOf } from "@/lib/server/attendance/period-service";
import { reconcilePeriods, listPeriods } from "@/lib/server/timetable/periods-service";
import { createEntry } from "@/lib/server/timetable/entries-service";
import { createOrGetPeriodSession } from "@/lib/server/attendance/period-service";
import { saveRecords, submitSession, lockSession } from "@/lib/server/attendance/service";
import { createTerm, createExam, reconcileExamClasses, setExamStatus } from "@/lib/server/exams/service";
import { createScheduleEntry } from "@/lib/server/exams/schedule-service";
import { saveMarks, submitMarks, verifyMarks } from "@/lib/server/exams/marks-service";
import type { OrgScope } from "@/lib/server/api/scope";
import { ROLE_PERMISSIONS } from "@/lib/server/authz/catalog";

let dbReady = false;
try {
  dbReady = Boolean(await prisma.role.findFirst({ where: { key: "SCHOOL_ADMIN", isSystem: true } }));
} catch {
  dbReady = false;
}

const NS = "T9A";
const stamp = Date.now().toString(36);
const today = serverToday();
const todayWeekday = weekdayOf(today);

let tenantId = "", schoolId = "", branchA = "", sessionId = "", classId = "", sectionId = "";
let subjectOwned = "", subjectOther = "";
let staff1 = "", staff2 = "";
let teacher1User = "", teacher2User = "", adminUser = "", unlinkedTeacherUser = "";
let scopeTeacher1: OrgScope, scopeTeacher2: OrgScope, scopeAdmin: OrgScope, scopeUnlinked: OrgScope;
let periodId = "";
let entryOwned = "";
let studentId = "";

async function makeUserWithRole(email: string, roleKey: string): Promise<string> {
  const u = await prisma.user.create({ data: { email, name: email, status: "ACTIVE" }, select: { id: true } });
  const m = await prisma.tenantMembership.create({ data: { userId: u.id, tenantId, status: "ACTIVE" }, select: { id: true } });
  const role = await prisma.role.findFirstOrThrow({ where: { key: roleKey, isSystem: true }, select: { id: true } });
  await prisma.roleAssignment.create({ data: { membershipId: m.id, roleId: role.id } });
  return u.id;
}

beforeAll(async () => {
  if (!dbReady) return;
  tenantId = (await prisma.tenant.create({ data: { name: `${NS} T`, slug: `t9a-${stamp}` }, select: { id: true } })).id;
  schoolId = (await prisma.school.create({ data: { tenantId, name: `${NS} S`, code: `${NS}-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  branchA = (await prisma.branch.create({ data: { schoolId, name: "A", code: `${NS}-A`, status: "ACTIVE" }, select: { id: true } })).id;
  sessionId = (await prisma.academicSession.create({ data: { schoolId, name: "26-27", code: `${NS}-S`, startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31"), status: "ACTIVE" }, select: { id: true } })).id;
  classId = (await prisma.class.create({ data: { tenantId, schoolId, academicSessionId: sessionId, name: "Grade 5", order: 5 }, select: { id: true } })).id;
  sectionId = (await prisma.section.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, classId, name: "A", status: "ACTIVE" }, select: { id: true } })).id;
  subjectOwned = (await prisma.subject.create({ data: { tenantId, schoolId, code: `${NS}-M`, name: "Math", shortName: "M", department: "Math", type: "CORE", maxMarks: 100, passingMarks: 33, theoryMarks: 100, practicalMarks: 0 }, select: { id: true } })).id;
  subjectOther = (await prisma.subject.create({ data: { tenantId, schoolId, code: `${NS}-E`, name: "English", shortName: "E", department: "Lang", type: "CORE", maxMarks: 100, passingMarks: 33, theoryMarks: 100, practicalMarks: 0 }, select: { id: true } })).id;
  await prisma.classSubject.create({ data: { tenantId, schoolId, academicSessionId: sessionId, classId, subjectId: subjectOwned } });
  await prisma.classSubject.create({ data: { tenantId, schoolId, academicSessionId: sessionId, classId, subjectId: subjectOther } });

  teacher1User = await makeUserWithRole(`${NS.toLowerCase()}-t1-${stamp}@x.test`, "TEACHER");
  teacher2User = await makeUserWithRole(`${NS.toLowerCase()}-t2-${stamp}@x.test`, "TEACHER");
  adminUser = await makeUserWithRole(`${NS.toLowerCase()}-admin-${stamp}@x.test`, "SCHOOL_ADMIN");
  unlinkedTeacherUser = await makeUserWithRole(`${NS.toLowerCase()}-unlinked-${stamp}@x.test`, "TEACHER");

  staff1 = (await prisma.staff.create({ data: { tenantId, schoolId, branchId: branchA, employeeCode: `${NS}-T1`, firstName: "Tara", lastName: "Rao", isTeaching: true, status: "ACTIVE", userId: teacher1User }, select: { id: true } })).id;
  staff2 = (await prisma.staff.create({ data: { tenantId, schoolId, branchId: branchA, employeeCode: `${NS}-T2`, firstName: "Rohan", lastName: "Iyer", isTeaching: true, status: "ACTIVE", userId: teacher2User }, select: { id: true } })).id;

  await prisma.teachingAssignment.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, sectionId, subjectId: subjectOwned, staffId: staff1 } });

  scopeTeacher1 = { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, actor: { id: teacher1User, name: "Tara Rao" } };
  scopeTeacher2 = { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, actor: { id: teacher2User, name: "Rohan Iyer" } };
  scopeAdmin = { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, actor: { id: adminUser, name: "Admin" } };
  scopeUnlinked = { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, actor: { id: unlinkedTeacherUser, name: "Unlinked" } };

  await prisma.schoolFeatureOverride.create({ data: { schoolId, tenantId, featureKey: "attendance", enabled: true } });

  await reconcilePeriods(scopeAdmin, { periods: [{ name: "P1", periodNumber: 1, startTime: "08:00", endTime: "08:45", type: "teaching" }] });
  periodId = (await listPeriods(scopeAdmin))[0].id;

  const entry = await createEntry(scopeAdmin, { sectionId, subjectId: subjectOwned, staffId: staff1, periodId, weekday: todayWeekday });
  entryOwned = entry.id;

  studentId = (await prisma.student.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, admissionNumber: `${NS}-${stamp}-1`, firstName: "S", lastName: "One", dateOfBirth: new Date("2015-01-01"), admissionDate: new Date("2024-04-01"), status: "ACTIVE" }, select: { id: true } })).id;
  await prisma.enrollment.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, classId, sectionId, studentId, status: "ENROLLED" } });
});

afterAll(async () => {
  if (!dbReady || !tenantId) return;
  await prisma.auditEvent.deleteMany({ where: { tenantId } });
  await prisma.tenant.delete({ where: { id: tenantId } });
});

describe.skipIf(!dbReady)("getCurrentStaffProfile (DB)", () => {
  it("resolves a real linked, ACTIVE, teaching Staff for the authenticated user", async () => {
    const profile = await getCurrentStaffProfile(scopeTeacher1);
    expect(profile).toMatchObject({ id: staff1, employeeCode: `${NS}-T1`, name: "Tara Rao", isTeaching: true });
  });

  it("returns null for a user with no linked Staff row (unlinked teacher)", async () => {
    expect(await getCurrentStaffProfile(scopeUnlinked)).toBeNull();
  });

  it("returns null for SCHOOL_ADMIN with no Staff row — does not throw", async () => {
    expect(await getCurrentStaffProfile(scopeAdmin)).toBeNull();
  });

  it("returns null once the Staff row goes INACTIVE", async () => {
    await prisma.staff.update({ where: { id: staff2 }, data: { status: "INACTIVE" } });
    expect(await getCurrentStaffProfile(scopeTeacher2)).toBeNull();
    await prisma.staff.update({ where: { id: staff2 }, data: { status: "ACTIVE" } });
  });

  it("a Staff row in a FOREIGN school never resolves, even for the same real user id", async () => {
    const foreignSchool = (await prisma.school.create({ data: { tenantId, name: `${NS} SB`, code: `${NS}-SB-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
    const foreignScope: OrgScope = { ...scopeTeacher1, schoolId: foreignSchool };
    expect(await getCurrentStaffProfile(foreignScope)).toBeNull();
  });
});

describe.skipIf(!dbReady)("getMyDay — timetable + attendance action (DB)", () => {
  it("returns today's real timetable entry with not_marked attendance by default", async () => {
    const day = await getMyDay(scopeTeacher1);
    expect(day.date).toBe(today);
    expect(day.weekday).toBe(todayWeekday);
    expect(day.staff).toMatchObject({ id: staff1 });
    const lesson = day.timetable.find((t) => t.timetableEntryId === entryOwned);
    expect(lesson).toMatchObject({ subject: { id: subjectOwned }, section: { id: sectionId }, attendance: { status: "not_marked" } });
    expect(day.attendance.pendingCount).toBeGreaterThanOrEqual(1);
  });

  it("reflects a real DRAFT/SUBMITTED/LOCKED PERIOD AttendanceSession as it progresses", async () => {
    const session = await createOrGetPeriodSession(scopeTeacher1, entryOwned, today, { id: teacher1User, name: "Tara Rao" });
    let day = await getMyDay(scopeTeacher1);
    expect(day.timetable.find((t) => t.timetableEntryId === entryOwned)?.attendance).toMatchObject({ sessionId: session.session!.id, status: "draft" });

    await saveRecords(scopeTeacher1, session.session!.id, [{ studentId, status: "present" }], { id: teacher1User, name: "Tara Rao" });
    await submitSession(scopeTeacher1, session.session!.id);
    day = await getMyDay(scopeTeacher1);
    expect(day.timetable.find((t) => t.timetableEntryId === entryOwned)?.attendance.status).toBe("submitted");
    // Submitted counts as completed, not pending.
    expect(day.attendance.pendingCount).toBe(0);

    await lockSession(scopeTeacher1, session.session!.id);
    day = await getMyDay(scopeTeacher1);
    expect(day.timetable.find((t) => t.timetableEntryId === entryOwned)?.attendance.status).toBe("locked");
  });

  it("SCHOOL_ADMIN (no Staff profile) gets an honest empty My Day, not a 500", async () => {
    const day = await getMyDay(scopeAdmin);
    expect(day.staff).toBeNull();
    expect(day.timetable).toEqual([]);
    // Phase 9B — homework is real now, even for an actor with no Staff profile.
    expect(day.homework).toEqual({ draftCount: 0, dueTodayOrOverdueCount: 0, items: [] });
    expect(day.lessonPlans).toEqual({ available: false });
  });

  it("Teacher A cannot see Teacher B's My Day — Teacher B has no lessons of their own", async () => {
    const dayB = await getMyDay(scopeTeacher2);
    expect(dayB.staff).toMatchObject({ id: staff2 });
    expect(dayB.timetable.some((t) => t.timetableEntryId === entryOwned)).toBe(false);
  });
});

describe.skipIf(!dbReady)("getMyDay — pending marks (DB)", () => {
  it("a DRAFT/SUBMITTED sheet the teacher owns is a pending action; VERIFIED is excluded", async () => {
    const term = await createTerm(scopeAdmin, { name: "Term 1", code: `T1-${stamp}` });
    const exam = await createExam(scopeAdmin, { examTermId: term.id, name: "Unit Test", code: `UT-${stamp}`, startsOn: "2026-08-24", endsOn: "2026-08-28" });
    await setExamStatus(scopeAdmin, exam.id, "scheduled"); // listMarksSummary/listUpcomingExams exclude DRAFT exams
    await reconcileExamClasses(scopeAdmin, exam.id, { classIds: [classId] });
    const entry = await createScheduleEntry(scopeAdmin, exam.id, { sectionId, subjectId: subjectOwned, examDate: "2026-08-24", startTime: "09:00", endTime: "10:00" });

    await saveMarks(scopeTeacher1, exam.id, entry.id, { records: [{ studentId, status: "marked", marksObtained: 80 }] });
    let day = await getMyDay(scopeTeacher1);
    expect(day.marks.pendingCount).toBe(1);
    expect(day.marks.actions[0]).toMatchObject({ entryId: entry.id, examId: exam.id, sheetStatus: "draft" });

    await submitMarks(scopeTeacher1, exam.id, entry.id);
    day = await getMyDay(scopeTeacher1);
    expect(day.marks.actions[0].sheetStatus).toBe("submitted");
    expect(day.marks.pendingCount).toBe(1);

    await verifyMarks(scopeAdmin, exam.id, entry.id);
    day = await getMyDay(scopeTeacher1);
    expect(day.marks.pendingCount).toBe(0); // VERIFIED sheets are never a pending action

    // Teacher 2 has no TeachingAssignment for this section+subject — never sees it.
    const day2 = await getMyDay(scopeTeacher2);
    expect(day2.marks.actions.find((a) => a.entryId === entry.id)).toBeUndefined();
  });
});

describe.skipIf(!dbReady)("getMyDay — upcoming exams (DB)", () => {
  it("a teacher sees only their own scheduled papers, not another subject's", async () => {
    const term = await createTerm(scopeAdmin, { name: "Term 2", code: `T2-${stamp}` });
    const exam = await createExam(scopeAdmin, { examTermId: term.id, name: "Future Exam", code: `FUT-${stamp}`, startsOn: "2099-01-01", endsOn: "2099-01-05" });
    await setExamStatus(scopeAdmin, exam.id, "scheduled");
    await reconcileExamClasses(scopeAdmin, exam.id, { classIds: [classId] });
    await createScheduleEntry(scopeAdmin, exam.id, { sectionId, subjectId: subjectOwned, examDate: "2099-01-01", startTime: "09:00", endTime: "10:00" });
    await createScheduleEntry(scopeAdmin, exam.id, { sectionId, subjectId: subjectOther, examDate: "2099-01-02", startTime: "09:00", endTime: "10:00" });

    const day = await getMyDay(scopeTeacher1);
    const mine = day.upcomingExams.filter((e) => e.examId === exam.id);
    expect(mine).toHaveLength(1);
    expect(mine[0].subject?.id).toBe(subjectOwned);
  });
});

describe.skipIf(!dbReady)("RBAC + DTO safety (DB)", () => {
  it("dashboard.view is granted to SCHOOL_ADMIN, PRINCIPAL, and TEACHER", () => {
    expect(ROLE_PERMISSIONS.SCHOOL_ADMIN).toContain("dashboard.view");
    expect(ROLE_PERMISSIONS.PRINCIPAL).toContain("dashboard.view");
    expect(ROLE_PERMISSIONS.TEACHER).toContain("dashboard.view");
  });

  it("MyDayDto exposes only safe, real fields", async () => {
    const day = await getMyDay(scopeTeacher1);
    expect(Object.keys(day).sort()).toEqual(["attendance", "date", "homework", "lessonPlans", "marks", "staff", "timetable", "upcomingExams", "weekday"]);
  });
});
