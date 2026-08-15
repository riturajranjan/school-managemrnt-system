// Main Dashboard DB integration tests (Phase 9A). Real Postgres: attendance
// summary is the exact canonical Phase 5B getDashboard() result (not
// recomputed); today's timetable is real and only present for an actor with
// a real teaching Staff profile; upcoming exams are personalized for a
// teaching actor and school-wide (collapsed one row per exam) otherwise;
// tenant isolation; safe DTO. Namespaced ("T9AD").
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { getDashboardSummary } from "@/lib/server/dashboard/service";
import { getDashboard as getAttendanceDashboard } from "@/lib/server/attendance/reports";
import { serverToday } from "@/lib/server/attendance/service";
import { weekdayOf } from "@/lib/server/attendance/period-service";
import { reconcilePeriods, listPeriods } from "@/lib/server/timetable/periods-service";
import { createEntry } from "@/lib/server/timetable/entries-service";
import { createTerm, createExam, reconcileExamClasses, setExamStatus } from "@/lib/server/exams/service";
import { createScheduleEntry } from "@/lib/server/exams/schedule-service";
import type { OrgScope } from "@/lib/server/api/scope";

let dbReady = false;
try {
  dbReady = Boolean(await prisma.role.findFirst({ where: { key: "SCHOOL_ADMIN", isSystem: true } }));
} catch {
  dbReady = false;
}

const NS = "T9AD";
const stamp = Date.now().toString(36);
const today = serverToday();
const todayWeekday = weekdayOf(today);

let tenantId = "", schoolId = "", branchA = "", sessionId = "", classId = "", sectionId = "", subjectId = "";
let staff1 = "", teacher1User = "", adminUser = "";
let scopeTeacher1: OrgScope, scopeAdmin: OrgScope;

async function makeUserWithRole(email: string, roleKey: string): Promise<string> {
  const u = await prisma.user.create({ data: { email, name: email, status: "ACTIVE" }, select: { id: true } });
  const m = await prisma.tenantMembership.create({ data: { userId: u.id, tenantId, status: "ACTIVE" }, select: { id: true } });
  const role = await prisma.role.findFirstOrThrow({ where: { key: roleKey, isSystem: true }, select: { id: true } });
  await prisma.roleAssignment.create({ data: { membershipId: m.id, roleId: role.id } });
  return u.id;
}

beforeAll(async () => {
  if (!dbReady) return;
  tenantId = (await prisma.tenant.create({ data: { name: `${NS} T`, slug: `t9ad-${stamp}` }, select: { id: true } })).id;
  schoolId = (await prisma.school.create({ data: { tenantId, name: `${NS} S`, code: `${NS}-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  branchA = (await prisma.branch.create({ data: { schoolId, name: "A", code: `${NS}-A`, status: "ACTIVE" }, select: { id: true } })).id;
  sessionId = (await prisma.academicSession.create({ data: { schoolId, name: "26-27", code: `${NS}-S`, startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31"), status: "ACTIVE" }, select: { id: true } })).id;
  classId = (await prisma.class.create({ data: { tenantId, schoolId, academicSessionId: sessionId, name: "Grade 5", order: 5 }, select: { id: true } })).id;
  sectionId = (await prisma.section.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, classId, name: "A", status: "ACTIVE" }, select: { id: true } })).id;
  subjectId = (await prisma.subject.create({ data: { tenantId, schoolId, code: `${NS}-M`, name: "Math", shortName: "M", department: "Math", type: "CORE", maxMarks: 100, passingMarks: 33, theoryMarks: 100, practicalMarks: 0 }, select: { id: true } })).id;
  await prisma.classSubject.create({ data: { tenantId, schoolId, academicSessionId: sessionId, classId, subjectId } });

  teacher1User = await makeUserWithRole(`${NS.toLowerCase()}-t1-${stamp}@x.test`, "TEACHER");
  adminUser = await makeUserWithRole(`${NS.toLowerCase()}-admin-${stamp}@x.test`, "SCHOOL_ADMIN");
  staff1 = (await prisma.staff.create({ data: { tenantId, schoolId, branchId: branchA, employeeCode: `${NS}-T1`, firstName: "Tara", isTeaching: true, status: "ACTIVE", userId: teacher1User }, select: { id: true } })).id;
  await prisma.teachingAssignment.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, sectionId, subjectId, staffId: staff1 } });

  scopeTeacher1 = { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, actor: { id: teacher1User, name: "Tara" } };
  scopeAdmin = { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, actor: { id: adminUser, name: "Admin" } };

  await prisma.schoolFeatureOverride.create({ data: { schoolId, tenantId, featureKey: "attendance", enabled: true } });
  await reconcilePeriods(scopeAdmin, { periods: [{ name: "P1", periodNumber: 1, startTime: "08:00", endTime: "08:45", type: "teaching" }] });
  const periodId = (await listPeriods(scopeAdmin))[0].id;
  await createEntry(scopeAdmin, { sectionId, subjectId, staffId: staff1, periodId, weekday: todayWeekday });

  const student = (await prisma.student.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, admissionNumber: `${NS}-${stamp}-1`, firstName: "S", lastName: "One", dateOfBirth: new Date("2015-01-01"), admissionDate: new Date("2024-04-01"), status: "ACTIVE" }, select: { id: true } })).id;
  await prisma.enrollment.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, classId, sectionId, studentId: student, status: "ENROLLED" } });
});

afterAll(async () => {
  if (!dbReady || !tenantId) return;
  await prisma.auditEvent.deleteMany({ where: { tenantId } });
  await prisma.tenant.delete({ where: { id: tenantId } });
});

describe.skipIf(!dbReady)("getDashboardSummary (DB)", () => {
  it("attendance is the exact canonical Phase 5B getDashboard() result — never recomputed", async () => {
    const summary = await getDashboardSummary(scopeAdmin);
    const canonical = await getAttendanceDashboard(scopeAdmin);
    expect(summary.attendance).toEqual(canonical);
  });

  it("today's timetable is real and populated for a teaching actor", async () => {
    const summary = await getDashboardSummary(scopeTeacher1);
    expect(summary.date).toBe(today);
    expect(summary.weekday).toBe(todayWeekday);
    expect(summary.todaysTimetable.available).toBe(true);
    expect(summary.todaysTimetable.entries.length).toBeGreaterThanOrEqual(1);
    expect(summary.todaysTimetable.entries[0]).toMatchObject({ subject: { id: subjectId }, section: { id: sectionId } });
  });

  it("today's timetable is honestly unavailable (not fabricated) for an actor with no teaching Staff profile", async () => {
    const summary = await getDashboardSummary(scopeAdmin);
    expect(summary.todaysTimetable).toEqual({ available: false, entries: [] });
  });

  it("upcoming exams are personalized for a teaching actor, school-wide (one row per exam) otherwise", async () => {
    const term = await createTerm(scopeAdmin, { name: "Term 1", code: `T1-${stamp}` });
    const exam = await createExam(scopeAdmin, { examTermId: term.id, name: "Dash Exam", code: `DE-${stamp}`, startsOn: "2099-01-01", endsOn: "2099-01-05" });
    await setExamStatus(scopeAdmin, exam.id, "scheduled");
    await reconcileExamClasses(scopeAdmin, exam.id, { classIds: [classId] });
    await createScheduleEntry(scopeAdmin, exam.id, { sectionId, subjectId, examDate: "2099-01-01", startTime: "09:00", endTime: "10:00" });

    const teacherView = await getDashboardSummary(scopeTeacher1);
    const teacherRow = teacherView.upcomingExams.find((e) => e.examId === exam.id);
    expect(teacherRow?.subject).toMatchObject({ id: subjectId }); // personalized: section/subject populated

    const adminView = await getDashboardSummary(scopeAdmin);
    const adminRow = adminView.upcomingExams.find((e) => e.examId === exam.id);
    expect(adminRow?.section).toBeNull(); // school-wide: collapsed, no single section/subject
    expect(adminRow?.subject).toBeNull();
  });

  it("a foreign school's dashboard never leaks into this school's summary", async () => {
    const foreignSchool = (await prisma.school.create({ data: { tenantId, name: `${NS} SB`, code: `${NS}-SB-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
    const foreignBranch = (await prisma.branch.create({ data: { schoolId: foreignSchool, name: "B", code: `${NS}-BB`, status: "ACTIVE" }, select: { id: true } })).id;
    const foreignSession = (await prisma.academicSession.create({ data: { schoolId: foreignSchool, name: "26-27", code: `${NS}-SBS`, startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31"), status: "ACTIVE" }, select: { id: true } })).id;
    await prisma.schoolFeatureOverride.create({ data: { schoolId: foreignSchool, tenantId, featureKey: "attendance", enabled: true } });
    const foreignScope: OrgScope = { tenantId, schoolId: foreignSchool, branchId: foreignBranch, academicSessionId: foreignSession, actor: { id: "x", name: "X" } };
    const summary = await getDashboardSummary(foreignScope);
    expect(summary.upcomingExams).toEqual([]);
    expect(summary.todaysTimetable).toEqual({ available: false, entries: [] });
  });

  it("SchoolDashboardSummaryDto exposes only safe, real fields", async () => {
    const summary = await getDashboardSummary(scopeAdmin);
    expect(Object.keys(summary).sort()).toEqual(["attendance", "date", "todaysTimetable", "upcomingExams", "weekday"]);
  });
});
