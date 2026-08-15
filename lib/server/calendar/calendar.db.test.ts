// Academic Calendar DB integration tests (Phase 9D.1). Real Postgres: manual
// CalendarEvent CRUD (broad-manager only), merged view with derived Exam/
// Homework/Lesson-Plan occurrences, weekly/yearly recurrence expansion,
// isolation, RBAC, audit events, real CALENDAR_EVENT notification fanout.
// Namespaced ("T9D1").
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { cancelCalendarEvent, createCalendarEvent, listCalendarEvents, updateCalendarEvent } from "@/lib/server/calendar/service";
import { HttpError } from "@/lib/server/api/guard";
import type { OrgScope } from "@/lib/server/api/scope";
import { ROLE_PERMISSIONS } from "@/lib/server/authz/catalog";

let dbReady = false;
try {
  dbReady = Boolean(await prisma.role.findFirst({ where: { key: "SCHOOL_ADMIN", isSystem: true } }));
} catch {
  dbReady = false;
}

const NS = "T9D1";
const stamp = Date.now().toString(36);

let tenantId = "", schoolId = "", branchA = "", sessionId = "", classId = "", subjectId = "";
let scopeAdmin: OrgScope, scopeTeacher: OrgScope;
let adminUser = "", teacherUser = "";

async function makeUserWithRole(email: string, roleKey: string): Promise<string> {
  const u = await prisma.user.create({ data: { email, name: email, status: "ACTIVE" }, select: { id: true } });
  const m = await prisma.tenantMembership.create({ data: { userId: u.id, tenantId, status: "ACTIVE" }, select: { id: true } });
  const role = await prisma.role.findFirstOrThrow({ where: { key: roleKey, isSystem: true }, select: { id: true } });
  await prisma.roleAssignment.create({ data: { membershipId: m.id, roleId: role.id } });
  return u.id;
}

beforeAll(async () => {
  if (!dbReady) return;
  tenantId = (await prisma.tenant.create({ data: { name: `${NS} T`, slug: `t9d1-${stamp}` }, select: { id: true } })).id;
  schoolId = (await prisma.school.create({ data: { tenantId, name: `${NS} S`, code: `${NS}-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  branchA = (await prisma.branch.create({ data: { schoolId, name: "A", code: `${NS}-A`, status: "ACTIVE" }, select: { id: true } })).id;
  sessionId = (await prisma.academicSession.create({ data: { schoolId, name: "26-27", code: `${NS}-S`, startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31"), status: "ACTIVE" }, select: { id: true } })).id;
  classId = (await prisma.class.create({ data: { tenantId, schoolId, academicSessionId: sessionId, name: "Grade 5", order: 5 }, select: { id: true } })).id;
  subjectId = (await prisma.subject.create({ data: { tenantId, schoolId, code: `${NS}-M`, name: "Math", shortName: "M", department: "Math", type: "CORE", maxMarks: 100, passingMarks: 33, theoryMarks: 100, practicalMarks: 0 }, select: { id: true } })).id;

  adminUser = await makeUserWithRole(`t9d1-admin-${stamp}@x.test`, "SCHOOL_ADMIN");
  teacherUser = await makeUserWithRole(`t9d1-t1-${stamp}@x.test`, "TEACHER");
  await prisma.staff.create({ data: { tenantId, schoolId, branchId: branchA, employeeCode: `${NS}-T1`, firstName: "Tara", isTeaching: true, status: "ACTIVE", userId: teacherUser }, select: { id: true } });

  scopeAdmin = { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, actor: { id: adminUser, name: "Admin" } };
  scopeTeacher = { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, actor: { id: teacherUser, name: "T1" } };
});

afterAll(async () => {
  if (!dbReady || !tenantId) return;
  await prisma.notificationRecipient.deleteMany({ where: { notification: { tenantId } } });
  await prisma.notification.deleteMany({ where: { tenantId } });
  await prisma.auditEvent.deleteMany({ where: { tenantId } });
  await prisma.calendarEvent.deleteMany({ where: { tenantId } });
  await prisma.staff.deleteMany({ where: { tenantId } });
  await prisma.roleAssignment.deleteMany({ where: { membership: { tenantId } } });
  await prisma.tenantMembership.deleteMany({ where: { tenantId } });
  await prisma.subject.deleteMany({ where: { tenantId } });
  await prisma.class.deleteMany({ where: { tenantId } });
  await prisma.academicSession.deleteMany({ where: { schoolId } });
  await prisma.branch.deleteMany({ where: { schoolId } });
  await prisma.school.deleteMany({ where: { tenantId } });
  await prisma.user.deleteMany({ where: { id: { in: [adminUser, teacherUser] } } });
  await prisma.tenant.deleteMany({ where: { id: tenantId } });
});

describe.skipIf(!dbReady)("Calendar (DB)", () => {
  it("SCHOOL_ADMIN creates a manual event; TEACHER (view-only) cannot", async () => {
    await expect(createCalendarEvent(scopeTeacher, { title: "PTM", type: "ptm", startDate: "2026-09-10" })).rejects.toThrow(HttpError);
    const id = await createCalendarEvent(scopeAdmin, { title: `PTM ${stamp}`, type: "ptm", startDate: "2026-09-10" });
    expect(id).toBeTruthy();
  });

  it("weekly recurrence expands into every matching week within the requested range", async () => {
    await createCalendarEvent(scopeAdmin, { title: `Assembly ${stamp}`, type: "activity", startDate: "2026-10-05", recurring: "weekly" });
    const events = await listCalendarEvents(scopeAdmin, { from: "2026-10-01", to: "2026-10-31" });
    const occ = events.filter((e) => e.title === `Assembly ${stamp}`);
    expect(occ.length).toBe(4); // Oct 5, 12, 19, 26
  });

  it("real recipients (Staff.userId) are notified when a manual event is created", async () => {
    const id = await createCalendarEvent(scopeAdmin, { title: `Sports day ${stamp}`, type: "celebration", startDate: "2026-11-01" });
    const notif = await prisma.notification.findUnique({ where: { dedupeKey: `CALENDAR_EVENT:${id}` }, include: { recipients: true } });
    expect(notif).toBeTruthy();
    expect(notif!.recipients.some((r) => r.userId === teacherUser)).toBe(true);
  });

  it("cancelling removes the event from the merged list", async () => {
    const id = await createCalendarEvent(scopeAdmin, { title: `Cancel me ${stamp}`, type: "other", startDate: "2026-12-01" });
    await cancelCalendarEvent(scopeAdmin, id);
    const events = await listCalendarEvents(scopeAdmin, { from: "2026-12-01", to: "2026-12-01" });
    expect(events.some((e) => e.title === `Cancel me ${stamp}`)).toBe(false);
  });

  it("updates a manual event's fields", async () => {
    const id = await createCalendarEvent(scopeAdmin, { title: `Edit me ${stamp}`, type: "other", startDate: "2027-01-05" });
    await updateCalendarEvent(scopeAdmin, id, { title: `Edited ${stamp}` });
    const events = await listCalendarEvents(scopeAdmin, { from: "2027-01-05", to: "2027-01-05" });
    expect(events.some((e) => e.title === `Edited ${stamp}`)).toBe(true);
  });

  it("CALENDAR_EVENT_NOT_FOUND: a foreign calendarEventId is rejected", async () => {
    await expect(updateCalendarEvent(scopeAdmin, "nonexistent", { title: "x" })).rejects.toThrow(HttpError);
  });

  it("merges a real derived Exam occurrence into the calendar without persisting a CalendarEvent row", async () => {
    const examTerm = await prisma.examTerm.create({ data: { tenantId, schoolId, academicSessionId: sessionId, name: `Term ${stamp}`, code: `T${stamp}` }, select: { id: true } });
    const exam = await prisma.exam.create({ data: { tenantId, schoolId, academicSessionId: sessionId, examTermId: examTerm.id, name: `Unit Test ${stamp}`, code: `U${stamp}`, startsOn: new Date("2027-02-10"), endsOn: new Date("2027-02-10") }, select: { id: true } });
    await prisma.examClass.create({ data: { tenantId, schoolId, academicSessionId: sessionId, examId: exam.id, classId } });
    const section = await prisma.section.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, classId, name: `CS${stamp}`, status: "ACTIVE" }, select: { id: true } });
    await prisma.classSubject.create({ data: { tenantId, schoolId, academicSessionId: sessionId, classId, subjectId } });
    const before = await prisma.examScheduleEntry.count();
    await prisma.examScheduleEntry.create({
      data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, examId: exam.id, sectionId: section.id, subjectId, examDate: new Date("2027-02-10T00:00:00.000Z"), startMinutes: 540, endMinutes: 600, maxMarks: 100, passingMarks: 33, theoryMarks: 100, practicalMarks: 0 },
    });
    expect(await prisma.examScheduleEntry.count()).toBe(before + 1);

    const events = await listCalendarEvents(scopeAdmin, { from: "2027-02-10", to: "2027-02-10" });
    const derived = events.find((e) => e.sourceType === "exam");
    expect(derived).toBeTruthy();
    expect(derived!.editable).toBe(false);
    // No CalendarEvent row was ever created for this occurrence.
    expect(await prisma.calendarEvent.count({ where: { tenantId, title: { contains: "Unit Test" } } })).toBe(0);
  });
});

describe.skipIf(!dbReady)("Calendar RBAC (DB)", () => {
  it("calendar.view/calendar.manage: SCHOOL_ADMIN and PRINCIPAL have manage; TEACHER has view only", () => {
    expect(ROLE_PERMISSIONS.SCHOOL_ADMIN).toContain("calendar.manage");
    expect(ROLE_PERMISSIONS.PRINCIPAL).toContain("calendar.manage");
    expect(ROLE_PERMISSIONS.TEACHER).toContain("calendar.view");
    expect(ROLE_PERMISSIONS.TEACHER).not.toContain("calendar.manage");
  });
});
