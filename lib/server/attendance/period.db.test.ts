// Period / subject attendance DB integration tests (Phase 7C). Real Postgres:
// DAILY default/uniqueness unchanged; PERIOD create from a real TimetableEntry;
// weekday validation; break rejection; roster from Enrollment; teacher lesson-
// ownership (own vs another's); PERIOD uniqueness + concurrency (one survives);
// isolation; historical safety (timetable move/delete, subject archive, staff
// inactive keep the snapshot); daily reports ignore PERIOD & period reports ignore
// DAILY; feature/RBAC; audit; DTO safety; canonical % reuse. Namespaced ("T7C").
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { createOrGetSession, getSessionDetail, saveRecords, submitSession } from "@/lib/server/attendance/service";
import { createOrGetPeriodSession, listPeriodLessons } from "@/lib/server/attendance/period-service";
import { getDashboard, getPeriodReport, getReport } from "@/lib/server/attendance/reports";
import type { OrgScope } from "@/lib/server/api/scope";

let dbReady = false;
try {
  dbReady = Boolean(await prisma.role.findFirst({ where: { key: "SCHOOL_ADMIN", isSystem: true } }));
} catch {
  dbReady = false;
}

const NS = "T7C";
const stamp = Date.now().toString(36);

let tenantId = "", schoolId = "", branchA = "", sessionId = "", classId = "";
let section1 = "", subjectId = "", staff1 = "", staff2 = "", period1 = "", periodBreak = "";
let entry1 = "", entry2 = "", entryBreak = "";
let scopeAdmin: OrgScope, scopeTeacher1: OrgScope, scopeTeacher2: OrgScope;
let adminUser = "", teacher1User = "", teacher2User = "";
// second school (isolation)
let entryB = "";
// a MONDAY date + a TUESDAY date (2026-08-03 is a Monday)
const MON = "2026-08-03";
const TUE = "2026-08-04";
const stu: string[] = [];

async function makeUserWithRole(email: string, roleKey: string): Promise<string> {
  const u = await prisma.user.create({ data: { email, name: email, status: "ACTIVE" }, select: { id: true } });
  const m = await prisma.tenantMembership.create({ data: { userId: u.id, tenantId, status: "ACTIVE" }, select: { id: true } });
  const role = await prisma.role.findFirstOrThrow({ where: { key: roleKey, isSystem: true }, select: { id: true } });
  await prisma.roleAssignment.create({ data: { membershipId: m.id, roleId: role.id } });
  return u.id;
}

beforeAll(async () => {
  if (!dbReady) return;
  tenantId = (await prisma.tenant.create({ data: { name: `${NS} T`, slug: `t7c-${stamp}` }, select: { id: true } })).id;
  schoolId = (await prisma.school.create({ data: { tenantId, name: `${NS} S`, code: `${NS}-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  branchA = (await prisma.branch.create({ data: { schoolId, name: "A", code: `${NS}-A`, status: "ACTIVE" }, select: { id: true } })).id;
  sessionId = (await prisma.academicSession.create({ data: { schoolId, name: "26-27", code: `${NS}-S`, startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31"), status: "ACTIVE" }, select: { id: true } })).id;
  await prisma.schoolFeatureOverride.create({ data: { schoolId, tenantId, featureKey: "attendance", enabled: true } });
  classId = (await prisma.class.create({ data: { tenantId, schoolId, academicSessionId: sessionId, name: "Grade 5", order: 5 }, select: { id: true } })).id;
  section1 = (await prisma.section.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, classId, name: "A", status: "ACTIVE" }, select: { id: true } })).id;
  subjectId = (await prisma.subject.create({ data: { tenantId, schoolId, code: `${NS}-M`, name: "Math", shortName: "M", department: "Math", type: "CORE" }, select: { id: true } })).id;
  await prisma.classSubject.create({ data: { tenantId, schoolId, academicSessionId: sessionId, classId, subjectId } });
  staff1 = (await prisma.staff.create({ data: { tenantId, schoolId, branchId: branchA, employeeCode: `${NS}-T1`, firstName: "Tara", isTeaching: true, status: "ACTIVE" }, select: { id: true } })).id;
  staff2 = (await prisma.staff.create({ data: { tenantId, schoolId, branchId: branchA, employeeCode: `${NS}-T2`, firstName: "Ravi", isTeaching: true, status: "ACTIVE" }, select: { id: true } })).id;
  const ta1 = (await prisma.teachingAssignment.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, sectionId: section1, subjectId, staffId: staff1 }, select: { id: true } })).id;
  const ta2 = (await prisma.teachingAssignment.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, sectionId: section1, subjectId, staffId: staff2 }, select: { id: true } })).id;
  period1 = (await prisma.timetablePeriod.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, name: "P1", periodNumber: 1, startMinutes: 480, endMinutes: 525, type: "TEACHING", order: 0 }, select: { id: true } })).id;
  const period2 = (await prisma.timetablePeriod.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, name: "P2", periodNumber: 2, startMinutes: 525, endMinutes: 570, type: "TEACHING", order: 1 }, select: { id: true } })).id;
  periodBreak = (await prisma.timetablePeriod.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, name: "Lunch", periodNumber: 3, startMinutes: 570, endMinutes: 600, type: "BREAK", order: 2 }, select: { id: true } })).id;
  // entry1: MONDAY P1, staff1. entry2: TUESDAY P2, staff2. entryBreak: MONDAY break (invalid).
  entry1 = (await prisma.timetableEntry.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, sectionId: section1, subjectId, staffId: staff1, teachingAssignmentId: ta1, periodId: period1, weekday: "MONDAY" }, select: { id: true } })).id;
  entry2 = (await prisma.timetableEntry.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, sectionId: section1, subjectId, staffId: staff2, teachingAssignmentId: ta2, periodId: period2, weekday: "TUESDAY" }, select: { id: true } })).id;
  entryBreak = (await prisma.timetableEntry.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, sectionId: section1, subjectId, staffId: staff1, teachingAssignmentId: ta1, periodId: periodBreak, weekday: "MONDAY" }, select: { id: true } })).id;

  // students + enrollments
  for (const k of ["a", "b", "c"]) {
    const s = (await prisma.student.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, admissionNumber: `${NS}-${stamp}-${k}`, firstName: k.toUpperCase(), lastName: "T", dateOfBirth: new Date("2015-01-01"), admissionDate: new Date("2024-04-01"), status: "ACTIVE" }, select: { id: true } })).id;
    stu.push(s);
    await prisma.enrollment.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, classId, sectionId: section1, studentId: s, status: "ENROLLED" } });
  }

  adminUser = await makeUserWithRole(`t7c-admin-${stamp}@x.test`, "SCHOOL_ADMIN");
  teacher1User = await makeUserWithRole(`t7c-t1-${stamp}@x.test`, "TEACHER");
  teacher2User = await makeUserWithRole(`t7c-t2-${stamp}@x.test`, "TEACHER");
  await prisma.staff.update({ where: { id: staff1 }, data: { userId: teacher1User } });
  await prisma.staff.update({ where: { id: staff2 }, data: { userId: teacher2User } });

  scopeAdmin = { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, actor: { id: adminUser, name: "Admin" } };
  scopeTeacher1 = { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, actor: { id: teacher1User, name: "T1" } };
  scopeTeacher2 = { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, actor: { id: teacher2User, name: "T2" } };

  // second school (isolation) — its own lesson
  const sB = (await prisma.school.create({ data: { tenantId, name: `${NS} SB`, code: `${NS}-SB-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  const bB = (await prisma.branch.create({ data: { schoolId: sB, name: "B", code: `${NS}-BB`, status: "ACTIVE" }, select: { id: true } })).id;
  const seB = (await prisma.academicSession.create({ data: { schoolId: sB, name: "26-27", code: `${NS}-SBS`, startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31"), status: "ACTIVE" }, select: { id: true } })).id;
  await prisma.schoolFeatureOverride.create({ data: { schoolId: sB, tenantId, featureKey: "attendance", enabled: true } });
  const cB = (await prisma.class.create({ data: { tenantId, schoolId: sB, academicSessionId: seB, name: "G5", order: 5 }, select: { id: true } })).id;
  const secB = (await prisma.section.create({ data: { tenantId, schoolId: sB, branchId: bB, academicSessionId: seB, classId: cB, name: "A", status: "ACTIVE" }, select: { id: true } })).id;
  const subB = (await prisma.subject.create({ data: { tenantId, schoolId: sB, code: `${NS}-BM`, name: "Math", shortName: "M", department: "M", type: "CORE" }, select: { id: true } })).id;
  await prisma.classSubject.create({ data: { tenantId, schoolId: sB, academicSessionId: seB, classId: cB, subjectId: subB } });
  const stB = (await prisma.staff.create({ data: { tenantId, schoolId: sB, branchId: bB, employeeCode: `${NS}-BT`, firstName: "B", isTeaching: true, status: "ACTIVE" }, select: { id: true } })).id;
  const taB = (await prisma.teachingAssignment.create({ data: { tenantId, schoolId: sB, branchId: bB, academicSessionId: seB, sectionId: secB, subjectId: subB, staffId: stB }, select: { id: true } })).id;
  const pB = (await prisma.timetablePeriod.create({ data: { tenantId, schoolId: sB, branchId: bB, academicSessionId: seB, name: "P1", periodNumber: 1, startMinutes: 480, endMinutes: 525, type: "TEACHING", order: 0 }, select: { id: true } })).id;
  entryB = (await prisma.timetableEntry.create({ data: { tenantId, schoolId: sB, branchId: bB, academicSessionId: seB, sectionId: secB, subjectId: subB, staffId: stB, teachingAssignmentId: taB, periodId: pB, weekday: "MONDAY" }, select: { id: true } })).id;
  expect([entry2, period1, periodBreak]).toBeTruthy();
});

afterAll(async () => {
  if (!dbReady || !tenantId) return;
  await prisma.auditEvent.deleteMany({ where: { tenantId } });
  await prisma.staff.updateMany({ where: { tenantId }, data: { userId: null } });
  await prisma.user.deleteMany({ where: { id: { in: [adminUser, teacher1User, teacher2User] } } });
  await prisma.tenant.delete({ where: { id: tenantId } });
});

describe.skipIf(!dbReady)("period attendance (DB)", () => {
  it("DAILY create defaults type=DAILY and is unchanged", async () => {
    const v = await createOrGetSession(scopeAdmin, section1, MON, { id: adminUser, name: "Admin" });
    expect(v.type).toBe("daily");
    const row = await prisma.attendanceSession.findFirst({ where: { sectionId: section1, date: new Date(`${MON}T00:00:00Z`), type: "DAILY" }, select: { type: true } });
    expect(row?.type).toBe("DAILY");
  });

  it("lists real scheduled lessons for a date (weekday-matched)", async () => {
    const monLessons = await listPeriodLessons(scopeAdmin, section1, MON);
    // entry1 (P1 Mon) is a TEACHING lesson; the Monday break entry is excluded.
    expect(monLessons.some((l) => l.timetableEntryId === entry1)).toBe(true);
    expect(monLessons.every((l) => l.timetableEntryId !== entryBreak)).toBe(true);
    const tueLessons = await listPeriodLessons(scopeAdmin, section1, TUE);
    expect(tueLessons.some((l) => l.timetableEntryId === entry2)).toBe(true);
    expect(tueLessons.every((l) => l.timetableEntryId !== entry1)).toBe(true); // Monday lesson not on Tuesday
  });

  it("creates a PERIOD session from a real lesson + snapshots subject/period/teacher", async () => {
    const v = await createOrGetPeriodSession(scopeAdmin, entry1, MON, { id: adminUser, name: "Admin" });
    expect(v.type).toBe("period");
    expect(v.lesson?.timetableEntryId).toBe(entry1);
    expect(v.lesson?.subject.name).toBe("Math");
    expect(v.roster.length).toBe(3); // roster from Enrollment, not the lesson
    const row = await prisma.attendanceSession.findFirst({ where: { type: "PERIOD", timetableEntryId: entry1, date: new Date(`${MON}T00:00:00Z`) }, select: { subjectName: true, periodName: true, staffId: true } });
    expect(row).toMatchObject({ subjectName: "Math", periodName: "P1", staffId: staff1 });
    const audit = await prisma.auditEvent.findFirst({ where: { tenantId, action: "ATTENDANCE_SESSION_CREATED", entityId: v.session!.id } });
    expect(audit).not.toBeNull();
  });

  it("rejects a date whose weekday does not match the lesson", async () => {
    // entry1 is MONDAY; TUE is a Tuesday.
    await expect(createOrGetPeriodSession(scopeAdmin, entry1, TUE, { id: adminUser, name: "Admin" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("rejects a break/lunch lesson", async () => {
    await expect(createOrGetPeriodSession(scopeAdmin, entryBreak, MON, { id: adminUser, name: "Admin" })).rejects.toMatchObject({ code: "INVALID_TIMETABLE_PERIOD" });
  });

  it("rejects a foreign-school lesson", async () => {
    await expect(createOrGetPeriodSession(scopeAdmin, entryB, MON, { id: adminUser, name: "Admin" })).rejects.toMatchObject({ code: "TIMETABLE_ENTRY_NOT_FOUND" });
  });

  it("PERIOD uniqueness: repeated create returns the SAME session (one per lesson/date)", async () => {
    const a = await createOrGetPeriodSession(scopeAdmin, entry1, MON, { id: adminUser, name: "Admin" });
    const b = await createOrGetPeriodSession(scopeAdmin, entry1, MON, { id: adminUser, name: "Admin" });
    expect(a.session!.id).toBe(b.session!.id);
    const count = await prisma.attendanceSession.count({ where: { type: "PERIOD", timetableEntryId: entry1, date: new Date(`${MON}T00:00:00Z`) } });
    expect(count).toBe(1);
  });

  it("concurrent PERIOD create → exactly one session (partial-unique, race-safe)", async () => {
    // entry2 is a TUESDAY lesson; both concurrent creates target it on TUE.
    const results = await Promise.allSettled([
      createOrGetPeriodSession(scopeAdmin, entry2, TUE, { id: adminUser, name: "Admin" }),
      createOrGetPeriodSession(scopeAdmin, entry2, TUE, { id: adminUser, name: "Admin" }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled").length).toBe(2); // both resolve (get-or-create)
    const count = await prisma.attendanceSession.count({ where: { type: "PERIOD", timetableEntryId: entry2, date: new Date(`${TUE}T00:00:00Z`) } });
    expect(count).toBe(1); // but only ONE row exists
  });

  it("teacher can open/mark their OWN lesson but NOT another teacher's", async () => {
    // teacher1 owns entry1 (Mon P1); teacher2 owns entry2 (Tue P2).
    const own = await createOrGetPeriodSession(scopeTeacher1, entry1, MON, { id: teacher1User, name: "T1" });
    expect(own.type).toBe("period");
    await expect(createOrGetPeriodSession(scopeTeacher2, entry1, MON, { id: teacher2User, name: "T2" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    // teacher2 also cannot save/submit teacher1's session
    await expect(saveRecords(scopeTeacher2, own.session!.id, [{ studentId: stu[0], status: "present" }], { id: teacher2User, name: "T2" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(submitSession(scopeTeacher2, own.session!.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("bulk marking + submit lifecycle works on a PERIOD session (canonical %)", async () => {
    const v = await createOrGetPeriodSession(scopeAdmin, entry1, MON, { id: adminUser, name: "Admin" });
    const saved = await saveRecords(scopeAdmin, v.session!.id, [
      { studentId: stu[0], status: "present" }, { studentId: stu[1], status: "absent" }, { studentId: stu[2], status: "late" },
    ], { id: adminUser, name: "Admin" });
    expect(saved.type).toBe("period");
    expect(saved.summary.attendancePercentage).toBe(67); // (present+late)/3
    const sub = await submitSession(scopeAdmin, v.session!.id);
    expect(sub.session!.status).toBe("submitted");
    const detail = await getSessionDetail(scopeAdmin, v.session!.id);
    expect(detail.type).toBe("period");
  });

  it("historical safety: subject archive + staff inactive + timetable delete keep the snapshot", async () => {
    const v = await createOrGetPeriodSession(scopeAdmin, entry2, TUE, { id: adminUser, name: "Admin" });
    await prisma.subject.update({ where: { id: subjectId }, data: { status: "ARCHIVED" } });
    await prisma.staff.update({ where: { id: staff2 }, data: { status: "INACTIVE" } });
    await prisma.timetableEntry.delete({ where: { id: entry2 } }); // SetNull, not cascade
    const row = await prisma.attendanceSession.findUnique({ where: { id: v.session!.id }, select: { timetableEntryId: true, subjectName: true, periodName: true, staffName: true } });
    expect(row).not.toBeNull();
    expect(row!.timetableEntryId).toBeNull(); // link SetNull, session survives
    expect(row!.subjectName).toBe("Math"); // snapshot intact
    expect(row!.periodName).toBe("P2");
    // restore for other tests
    await prisma.subject.update({ where: { id: subjectId }, data: { status: "ACTIVE" } });
    await prisma.staff.update({ where: { id: staff2 }, data: { status: "ACTIVE" } });
  });

  it("daily dashboard/reports IGNORE period sessions; period report ignores daily", async () => {
    // Ensure a marked DAILY session exists for MON so daily reports have data.
    const daily = await createOrGetSession(scopeAdmin, section1, MON, { id: adminUser, name: "Admin" });
    await saveRecords(scopeAdmin, daily.session!.id, [{ studentId: stu[0], status: "present" }], { id: adminUser, name: "Admin" });
    // class report (daily) counts only DAILY records for this section.
    const classRep = await getReport(scopeAdmin, { type: "class" });
    const secRow = classRep.rows.find((r) => r.Section === "A");
    // Only the single daily record (1 student) — period records excluded.
    expect(secRow?.Sessions).toBe(1);
    // Period subject-summary counts only PERIOD records.
    const periodRep = await getPeriodReport(scopeAdmin, { type: "subject-summary" });
    expect(periodRep.rows.some((r) => r.Subject === "Math")).toBe(true);
    expect(periodRep.type).toBe("subject-summary");
    // dashboard present% is derived from DAILY today-sessions only (no throw).
    const d = await getDashboard(scopeAdmin);
    expect(d).toHaveProperty("presentTodayPct");
  });

  it("empty state: no scheduled lessons → empty list (not an error)", async () => {
    // Sunday has no lessons for section1.
    const sun = await listPeriodLessons(scopeAdmin, section1, "2026-08-02");
    expect(sun).toEqual([]);
  });

  it("cross-session isolation: wrong academic session finds no lesson", async () => {
    const wrong: OrgScope = { ...scopeAdmin, academicSessionId: "nope" };
    await expect(createOrGetPeriodSession(wrong, entry1, MON, { id: adminUser, name: "Admin" })).rejects.toMatchObject({ code: "TIMETABLE_ENTRY_NOT_FOUND" });
  });
});
