// In-app Notifications DB integration tests (Phase 9D.2). Real Postgres:
// dedupeKey idempotency (no duplicate Notification row / no duplicate
// recipient fanout on retry), per-recipient read state, cross-user isolation,
// unread count, real trigger integration (EXAM_SCHEDULED via the real
// createScheduleEntry service, LESSON_PLAN_APPROVED/REJECTED via the real
// approve/reject services). Namespaced ("T9D2").
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { createNotification, getUnreadCount, listMyNotifications, markAllNotificationsRead, markNotificationRead } from "@/lib/server/notifications/service";
import { HttpError } from "@/lib/server/api/guard";
import { createScheduleEntry } from "@/lib/server/exams/schedule-service";
import { approveLessonPlan, createLessonPlan, rejectLessonPlan, submitLessonPlan } from "@/lib/server/lesson-plans/service";
import type { OrgScope } from "@/lib/server/api/scope";

let dbReady = false;
try {
  dbReady = Boolean(await prisma.role.findFirst({ where: { key: "SCHOOL_ADMIN", isSystem: true } }));
} catch {
  dbReady = false;
}

const NS = "T9D2";
const stamp = Date.now().toString(36);

let tenantId = "", schoolId = "", branchA = "", sessionId = "", classId = "", subjectId = "";
let staffTeacher = "";
let scopeAdmin: OrgScope, scopeTeacher: OrgScope;
let adminUser = "", teacherUser = "", otherUser = "";

async function makeUserWithRole(email: string, roleKey: string): Promise<string> {
  const u = await prisma.user.create({ data: { email, name: email, status: "ACTIVE" }, select: { id: true } });
  const m = await prisma.tenantMembership.create({ data: { userId: u.id, tenantId, status: "ACTIVE" }, select: { id: true } });
  const role = await prisma.role.findFirstOrThrow({ where: { key: roleKey, isSystem: true }, select: { id: true } });
  await prisma.roleAssignment.create({ data: { membershipId: m.id, roleId: role.id } });
  return u.id;
}

beforeAll(async () => {
  if (!dbReady) return;
  tenantId = (await prisma.tenant.create({ data: { name: `${NS} T`, slug: `t9d2-${stamp}` }, select: { id: true } })).id;
  schoolId = (await prisma.school.create({ data: { tenantId, name: `${NS} S`, code: `${NS}-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  branchA = (await prisma.branch.create({ data: { schoolId, name: "A", code: `${NS}-A`, status: "ACTIVE" }, select: { id: true } })).id;
  sessionId = (await prisma.academicSession.create({ data: { schoolId, name: "26-27", code: `${NS}-S`, startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31"), status: "ACTIVE" }, select: { id: true } })).id;
  classId = (await prisma.class.create({ data: { tenantId, schoolId, academicSessionId: sessionId, name: "Grade 5", order: 5 }, select: { id: true } })).id;
  subjectId = (await prisma.subject.create({ data: { tenantId, schoolId, code: `${NS}-M`, name: "Math", shortName: "M", department: "Math", type: "CORE", maxMarks: 100, passingMarks: 33, theoryMarks: 100, practicalMarks: 0 }, select: { id: true } })).id;
  await prisma.classSubject.create({ data: { tenantId, schoolId, academicSessionId: sessionId, classId, subjectId } });

  adminUser = await makeUserWithRole(`t9d2-admin-${stamp}@x.test`, "SCHOOL_ADMIN");
  teacherUser = await makeUserWithRole(`t9d2-t1-${stamp}@x.test`, "TEACHER");
  otherUser = await makeUserWithRole(`t9d2-t2-${stamp}@x.test`, "TEACHER");
  staffTeacher = (await prisma.staff.create({ data: { tenantId, schoolId, branchId: branchA, employeeCode: `${NS}-T1`, firstName: "Tara", isTeaching: true, status: "ACTIVE", userId: teacherUser }, select: { id: true } })).id;

  scopeAdmin = { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, actor: { id: adminUser, name: "Admin" } };
  scopeTeacher = { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, actor: { id: teacherUser, name: "T1" } };
});

afterAll(async () => {
  if (!dbReady || !tenantId) return;
  await prisma.notificationRecipient.deleteMany({ where: { notification: { tenantId } } });
  await prisma.notification.deleteMany({ where: { tenantId } });
  await prisma.auditEvent.deleteMany({ where: { tenantId } });
  await prisma.lessonPlanTopic.deleteMany({ where: { lessonPlan: { tenantId } } });
  await prisma.lessonPlan.deleteMany({ where: { tenantId } });
  await prisma.examScheduleEntry.deleteMany({ where: { tenantId } });
  await prisma.examClass.deleteMany({ where: { tenantId } });
  await prisma.exam.deleteMany({ where: { tenantId } });
  await prisma.examTerm.deleteMany({ where: { tenantId } });
  await prisma.teachingAssignment.deleteMany({ where: { tenantId } });
  await prisma.section.deleteMany({ where: { tenantId } });
  await prisma.staff.deleteMany({ where: { tenantId } });
  await prisma.roleAssignment.deleteMany({ where: { membership: { tenantId } } });
  await prisma.tenantMembership.deleteMany({ where: { tenantId } });
  await prisma.classSubject.deleteMany({ where: { tenantId } });
  await prisma.subject.deleteMany({ where: { tenantId } });
  await prisma.class.deleteMany({ where: { tenantId } });
  await prisma.academicSession.deleteMany({ where: { schoolId } });
  await prisma.branch.deleteMany({ where: { schoolId } });
  await prisma.school.deleteMany({ where: { tenantId } });
  await prisma.user.deleteMany({ where: { id: { in: [adminUser, teacherUser, otherUser] } } });
  await prisma.tenant.deleteMany({ where: { id: tenantId } });
});

describe.skipIf(!dbReady)("createNotification (DB)", () => {
  it("fans out to real recipients with per-recipient read state", async () => {
    const dedupeKey = `CALENDAR_EVENT:test-${stamp}-1`;
    await prisma.$transaction((tx) =>
      createNotification(tx, { tenantId, schoolId, type: "CALENDAR_EVENT", title: "Hello", body: "World", dedupeKey, recipientUserIds: [teacherUser, otherUser] }),
    );
    const notif = await prisma.notification.findUnique({ where: { dedupeKey }, include: { recipients: true } });
    expect(notif!.recipients).toHaveLength(2);
    expect(notif!.recipients.every((r) => r.readAt === null)).toBe(true);
  });

  it("is idempotent on dedupeKey: a retried call never creates a second row or double-fans-out", async () => {
    const dedupeKey = `CALENDAR_EVENT:test-${stamp}-2`;
    const run = () => prisma.$transaction((tx) => createNotification(tx, { tenantId, schoolId, type: "CALENDAR_EVENT", title: "Retry", body: "Body", dedupeKey, recipientUserIds: [teacherUser] }));
    await run();
    await run(); // simulated retry
    expect(await prisma.notification.count({ where: { dedupeKey } })).toBe(1);
    expect(await prisma.notificationRecipient.count({ where: { notification: { dedupeKey } } })).toBe(1);
  });

  it("no-ops (creates nothing) when the recipient list is empty", async () => {
    const dedupeKey = `CALENDAR_EVENT:test-${stamp}-empty`;
    await prisma.$transaction((tx) => createNotification(tx, { tenantId, schoolId, type: "CALENDAR_EVENT", title: "Nobody", body: "Body", dedupeKey, recipientUserIds: [] }));
    expect(await prisma.notification.findUnique({ where: { dedupeKey } })).toBeNull();
  });
});

describe.skipIf(!dbReady)("list / read (DB)", () => {
  it("a user only ever sees their own notifications; unread count matches; mark-read is per-recipient", async () => {
    const dedupeKey = `CALENDAR_EVENT:test-${stamp}-list`;
    await prisma.$transaction((tx) => createNotification(tx, { tenantId, schoolId, type: "CALENDAR_EVENT", title: "Shared", body: "Body", dedupeKey, recipientUserIds: [teacherUser, otherUser] }));

    const { data: teacherList } = await listMyNotifications(scopeTeacher, {});
    expect(teacherList.some((n) => n.title === "Shared")).toBe(true);
    const teacherUnreadBefore = await getUnreadCount(scopeTeacher);

    const notif = await prisma.notification.findUniqueOrThrow({ where: { dedupeKey }, select: { id: true } });
    await markNotificationRead(scopeTeacher, notif.id);

    const teacherUnreadAfter = await getUnreadCount(scopeTeacher);
    expect(teacherUnreadAfter).toBe(teacherUnreadBefore - 1);

    // otherUser's own copy is untouched by teacherUser's mark-read.
    const otherScope: OrgScope = { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, actor: { id: otherUser, name: "Other" } };
    const { data: otherList } = await listMyNotifications(otherScope, {});
    expect(otherList.find((n) => n.id === notif.id)?.readAt).toBeNull();
  });

  it("NOTIFICATION_NOT_FOUND: marking a nonexistent notification read is rejected", async () => {
    await expect(markNotificationRead(scopeTeacher, "nonexistent")).rejects.toThrow(HttpError);
  });

  it("markAllNotificationsRead clears every unread recipient row for the actor only", async () => {
    const dedupeKey = `CALENDAR_EVENT:test-${stamp}-all`;
    await prisma.$transaction((tx) => createNotification(tx, { tenantId, schoolId, type: "CALENDAR_EVENT", title: "Bulk", body: "Body", dedupeKey, recipientUserIds: [teacherUser] }));
    await markAllNotificationsRead(scopeTeacher);
    expect(await getUnreadCount(scopeTeacher)).toBe(0);
  });
});

describe.skipIf(!dbReady)("real trigger integration (DB)", () => {
  it("EXAM_SCHEDULED: creating a real ExamScheduleEntry notifies the section+subject's TeachingAssignment holder", async () => {
    const section = await prisma.section.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, classId, name: `ES${stamp}`, status: "ACTIVE" }, select: { id: true } });
    await prisma.teachingAssignment.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, sectionId: section.id, subjectId, staffId: staffTeacher } });
    const examTerm = await prisma.examTerm.create({ data: { tenantId, schoolId, academicSessionId: sessionId, name: `Term ${stamp}`, code: `ET${stamp}` }, select: { id: true } });
    const exam = await prisma.exam.create({ data: { tenantId, schoolId, academicSessionId: sessionId, examTermId: examTerm.id, name: `Exam ${stamp}`, code: `EX${stamp}`, startsOn: new Date("2027-03-01"), endsOn: new Date("2027-03-01") }, select: { id: true } });
    await prisma.examClass.create({ data: { tenantId, schoolId, academicSessionId: sessionId, examId: exam.id, classId } });

    const entry = await createScheduleEntry(scopeAdmin, exam.id, { sectionId: section.id, subjectId, examDate: "2027-03-01", startTime: "09:00", endTime: "10:00" });
    const notif = await prisma.notification.findUnique({ where: { dedupeKey: `EXAM_SCHEDULED:${entry.id}` }, include: { recipients: true } });
    expect(notif).toBeTruthy();
    expect(notif!.recipients.some((r) => r.userId === teacherUser)).toBe(true);
  });

  it("LESSON_PLAN_APPROVED / LESSON_PLAN_REJECTED notify the plan's own teacher", async () => {
    const section = await prisma.section.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, classId, name: `LP${stamp}`, status: "ACTIVE" }, select: { id: true } });
    await prisma.teachingAssignment.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, sectionId: section.id, subjectId, staffId: staffTeacher } });

    const plan = await createLessonPlan(scopeTeacher, { sectionId: section.id, subjectId, title: `Notif ${stamp}`, learningObjective: "o", teachingMethod: "m", plannedDate: "2027-03-02" });
    await submitLessonPlan(scopeTeacher, plan.id);
    await approveLessonPlan(scopeAdmin, plan.id);
    const approvedNotif = await prisma.notification.findUnique({ where: { dedupeKey: `LESSON_PLAN_APPROVED:${plan.id}` }, include: { recipients: true } });
    expect(approvedNotif!.recipients.some((r) => r.userId === teacherUser)).toBe(true);

    const plan2 = await createLessonPlan(scopeTeacher, { sectionId: section.id, subjectId, title: `Notif2 ${stamp}`, learningObjective: "o", teachingMethod: "m", plannedDate: "2027-03-03" });
    await submitLessonPlan(scopeTeacher, plan2.id);
    await rejectLessonPlan(scopeAdmin, plan2.id, { comment: "Needs more detail" });
    const rejectedNotif = await prisma.notification.findUnique({ where: { dedupeKey: `LESSON_PLAN_REJECTED:${plan2.id}` }, include: { recipients: true } });
    expect(rejectedNotif!.recipients.some((r) => r.userId === teacherUser)).toBe(true);
  });
});
