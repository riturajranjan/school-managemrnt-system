// Action Inbox DB integration tests (Phase 9L). Real Postgres: every item is
// verified as a live derivation from an existing real domain's own rows —
// not a second workflow. Covers inclusion/exclusion per real state,
// disappearance on resolution, ownership (marks), broad-manager RBAC vs.
// requester-self exclusion, cross-school isolation, and summary counts.
// Namespaced ("T9L").
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { createStaff, setStaffUser } from "@/lib/server/staff/service";
import { createLessonPlan, submitLessonPlan, approveLessonPlan } from "@/lib/server/lesson-plans/service";
import { createLeaveRequest, approveLeaveRequest } from "@/lib/server/leave/service";
import { getMarksRoster, submitMarks, verifyMarks } from "@/lib/server/exams/marks-service";
import { createExpectedVisit, checkInVisit, checkOutVisit } from "@/lib/server/visitors/visits";
import { startDirectConversation, sendMessage, markConversationRead } from "@/lib/server/communication/service";
import { getActionInbox, getActionInboxSummary } from "@/lib/server/action-inbox/service";
import type { OrgScope } from "@/lib/server/api/scope";

let dbReady = false;
try {
  dbReady = Boolean(await prisma.role.findFirst({ where: { key: "SCHOOL_ADMIN", isSystem: true } }));
} catch {
  dbReady = false;
}

const NS = "T9L";
const stamp = Date.now().toString(36);
const NO_COMM = { communication: false };
const WITH_COMM = { communication: true };

let tenantId = "", schoolId = "", branchA = "", sessionId = "", classId = "", sectionId = "", subjectId = "";
let adminUserId = "", principalUserId = "", teacherUserId = "", teacher2UserId = "", librarianUserId = "";
let teacherStaffId = "", teacher2StaffId = "";
let adminScope: OrgScope, principalScope: OrgScope, teacherScope: OrgScope, teacher2Scope: OrgScope, librarianScope: OrgScope;
let leaveTypeId = "";

// Foreign school (isolation).
let schoolBId = "", foreignAdminScope: OrgScope;

async function makeUserWithRole(email: string, roleKey: string): Promise<string> {
  const u = await prisma.user.create({ data: { email, name: email.split("@")[0], status: "ACTIVE" }, select: { id: true } });
  const m = await prisma.tenantMembership.create({ data: { userId: u.id, tenantId, status: "ACTIVE" }, select: { id: true } });
  const role = await prisma.role.findFirstOrThrow({ where: { key: roleKey, isSystem: true }, select: { id: true } });
  await prisma.roleAssignment.create({ data: { membershipId: m.id, roleId: role.id } });
  return u.id;
}

beforeAll(async () => {
  if (!dbReady) return;
  tenantId = (await prisma.tenant.create({ data: { name: `${NS} T`, slug: `t9l-${stamp}` }, select: { id: true } })).id;
  schoolId = (await prisma.school.create({ data: { tenantId, name: `${NS} S`, code: `${NS}-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  branchA = (await prisma.branch.create({ data: { schoolId, name: "A", code: `${NS}-A`, status: "ACTIVE" }, select: { id: true } })).id;
  sessionId = (await prisma.academicSession.create({ data: { schoolId, name: "26-27", code: `${NS}-S`, startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31"), status: "ACTIVE" }, select: { id: true } })).id;
  classId = (await prisma.class.create({ data: { tenantId, schoolId, academicSessionId: sessionId, name: "Grade 5", order: 5 }, select: { id: true } })).id;
  sectionId = (await prisma.section.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, classId, name: "A", status: "ACTIVE" }, select: { id: true } })).id;
  subjectId = (await prisma.subject.create({ data: { tenantId, schoolId, code: `${NS}-MATH`, name: "Math", shortName: "MTH", department: "Math", type: "CORE" }, select: { id: true } })).id;
  await prisma.classSubject.create({ data: { tenantId, schoolId, academicSessionId: sessionId, classId, subjectId } });

  adminUserId = await makeUserWithRole(`t9l-admin-${stamp}@x.test`, "SCHOOL_ADMIN");
  adminScope = { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, actor: { id: adminUserId, name: "Admin" } };
  principalUserId = await makeUserWithRole(`t9l-principal-${stamp}@x.test`, "PRINCIPAL");
  principalScope = { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, actor: { id: principalUserId, name: "Principal" } };
  librarianUserId = await makeUserWithRole(`t9l-librarian-${stamp}@x.test`, "LIBRARIAN");
  librarianScope = { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, actor: { id: librarianUserId, name: "Lib" } };

  teacherUserId = await makeUserWithRole(`t9l-teacher-${stamp}@x.test`, "TEACHER");
  teacherStaffId = (await createStaff(adminScope, { employeeCode: "T9L-1", firstName: "Tara", isTeaching: true })).id;
  await setStaffUser(adminScope, teacherStaffId, teacherUserId);
  teacherScope = { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, actor: { id: teacherUserId, name: "Tara" } };

  teacher2UserId = await makeUserWithRole(`t9l-teacher2-${stamp}@x.test`, "TEACHER");
  teacher2StaffId = (await createStaff(adminScope, { employeeCode: "T9L-2", firstName: "Tom", isTeaching: true })).id;
  await setStaffUser(adminScope, teacher2StaffId, teacher2UserId);
  teacher2Scope = { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, actor: { id: teacher2UserId, name: "Tom" } };

  await prisma.teachingAssignment.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, sectionId, subjectId, staffId: teacherStaffId } });

  leaveTypeId = (await prisma.leaveType.create({ data: { tenantId, schoolId, name: "Casual", code: `${NS}-CL` }, select: { id: true } })).id;

  // Foreign school — isolation.
  schoolBId = (await prisma.school.create({ data: { tenantId, name: `${NS} SB`, code: `${NS}-SB-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  const branchB = (await prisma.branch.create({ data: { schoolId: schoolBId, name: "B", code: `${NS}-BB`, status: "ACTIVE" }, select: { id: true } })).id;
  const sessionB = (await prisma.academicSession.create({ data: { schoolId: schoolBId, name: "26-27", code: `${NS}-SBS`, startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31"), status: "ACTIVE" }, select: { id: true } })).id;
  foreignAdminScope = { tenantId, schoolId: schoolBId, branchId: branchB, academicSessionId: sessionB, actor: { id: adminUserId, name: "Admin" } };
});

afterAll(async () => {
  if (!dbReady || !tenantId) return;
  await prisma.notificationRecipient.deleteMany({ where: { notification: { tenantId } } });
  await prisma.notification.deleteMany({ where: { tenantId } });
  await prisma.message.deleteMany({ where: { conversation: { tenantId } } });
  await prisma.conversationParticipant.deleteMany({ where: { conversation: { tenantId } } });
  await prisma.conversation.deleteMany({ where: { tenantId } });
  await prisma.visitorVisit.deleteMany({ where: { tenantId } });
  await prisma.visitor.deleteMany({ where: { tenantId } });
  await prisma.feePayment.deleteMany({ where: { tenantId } });
  await prisma.payrollRun.deleteMany({ where: { tenantId } });
  await prisma.examMark.deleteMany({ where: { markSheet: { scheduleEntry: { tenantId } } } });
  await prisma.examMarkSheet.deleteMany({ where: { scheduleEntry: { tenantId } } });
  await prisma.examScheduleEntry.deleteMany({ where: { tenantId } });
  await prisma.examClass.deleteMany({ where: { tenantId } });
  await prisma.exam.deleteMany({ where: { tenantId } });
  await prisma.examTerm.deleteMany({ where: { tenantId } });
  await prisma.leaveRequest.deleteMany({ where: { tenantId } });
  await prisma.leaveType.deleteMany({ where: { tenantId } });
  await prisma.lessonPlan.deleteMany({ where: { tenantId } });
  await prisma.teachingAssignment.deleteMany({ where: { tenantId } });
  await prisma.auditEvent.deleteMany({ where: { tenantId } });
  await prisma.staff.deleteMany({ where: { tenantId } });
  await prisma.roleAssignment.deleteMany({ where: { membership: { tenantId } } });
  await prisma.tenantMembership.deleteMany({ where: { tenantId } });
  await prisma.academicSession.deleteMany({ where: { schoolId: { in: [schoolId, schoolBId] } } });
  await prisma.branch.deleteMany({ where: { schoolId: { in: [schoolId, schoolBId] } } });
  await prisma.school.deleteMany({ where: { tenantId } });
  const userIds = (await prisma.user.findMany({ where: { email: { contains: `-${stamp}@x.test` } }, select: { id: true } })).map((u) => u.id);
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.tenant.delete({ where: { id: tenantId } });
});

describe.skipIf(!dbReady)("lesson plan actions (DB)", () => {
  it("a SUBMITTED plan appears for a broad reviewer (admin), not the requester, not an unrelated role; approving it removes the action", async () => {
    const draft = await createLessonPlan(teacherScope, { sectionId, subjectId, title: "P1", learningObjective: "obj", teachingMethod: "lecture", plannedDate: "2026-09-01" });
    await submitLessonPlan(teacherScope, draft.id);

    const adminItems = await getActionInbox(adminScope, NO_COMM);
    expect(adminItems.some((i) => i.id === `LESSON_PLAN:${draft.id}:REVIEW`)).toBe(true);

    const teacherItems = await getActionInbox(teacherScope, NO_COMM);
    expect(teacherItems.some((i) => i.sourceId === draft.id)).toBe(false);

    const librarianItems = await getActionInbox(librarianScope, NO_COMM);
    expect(librarianItems.some((i) => i.sourceId === draft.id)).toBe(false);

    await approveLessonPlan(adminScope, draft.id);
    const afterApprove = await getActionInbox(adminScope, NO_COMM);
    expect(afterApprove.some((i) => i.sourceId === draft.id)).toBe(false);
  });
});

describe.skipIf(!dbReady)("leave actions (DB)", () => {
  it("a PENDING leave request appears for a broad manager, never for the requester themselves; approving removes it", async () => {
    const req = await createLeaveRequest(teacherScope, { staffId: teacherStaffId, leaveTypeId, startDate: "2026-09-10", endDate: "2026-09-10", reason: "personal" });

    const adminItems = await getActionInbox(adminScope, NO_COMM);
    expect(adminItems.some((i) => i.id === `LEAVE_REQUEST:${req.id}:APPROVE`)).toBe(true);

    const teacherItems = await getActionInbox(teacherScope, NO_COMM);
    expect(teacherItems.some((i) => i.sourceId === req.id)).toBe(false); // own pending request is not an action FOR the requester

    await approveLeaveRequest(adminScope, req.id);
    const afterApprove = await getActionInbox(adminScope, NO_COMM);
    expect(afterApprove.some((i) => i.sourceId === req.id)).toBe(false);
  });
});

describe.skipIf(!dbReady)("marks actions (DB) — ownership + lifecycle", () => {
  it("a DRAFT sheet is an 'enter' action for the OWNING teacher only; SUBMITTED becomes a 'verify' action for the admin; VERIFIED shows to neither", async () => {
    const term = await prisma.examTerm.create({ data: { tenantId, schoolId, academicSessionId: sessionId, name: "T1", code: `${NS}-TERM` }, select: { id: true } });
    const exam = await prisma.exam.create({ data: { tenantId, schoolId, academicSessionId: sessionId, examTermId: term.id, name: "Unit Test", code: `${NS}-EX`, startsOn: new Date("2026-08-01"), endsOn: new Date("2026-08-01"), status: "SCHEDULED" }, select: { id: true } });
    await prisma.examClass.create({ data: { tenantId, schoolId, academicSessionId: sessionId, examId: exam.id, classId } });
    const entry = await prisma.examScheduleEntry.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, examId: exam.id, sectionId, subjectId, examDate: new Date("2026-08-01"), startMinutes: 540, endMinutes: 600, maxMarks: 100, passingMarks: 33, theoryMarks: 100, practicalMarks: 0 }, select: { id: true } });

    await getMarksRoster(teacherScope, exam.id, entry.id); // auto-creates the DRAFT sheet

    const teacherDraft = await getActionInbox(teacherScope, NO_COMM);
    expect(teacherDraft.some((i) => i.id === `EXAM_MARK_SHEET:${entry.id}:ENTER`)).toBe(true);
    const teacher2Draft = await getActionInbox(teacher2Scope, NO_COMM);
    expect(teacher2Draft.some((i) => i.sourceId === entry.id)).toBe(false); // not this teacher's TeachingAssignment
    const adminDraft = await getActionInbox(adminScope, NO_COMM);
    expect(adminDraft.some((i) => i.sourceId === entry.id)).toBe(false); // draft isn't a verifier action yet

    await submitMarks(teacherScope, exam.id, entry.id);
    const teacherSubmitted = await getActionInbox(teacherScope, NO_COMM);
    expect(teacherSubmitted.some((i) => i.sourceId === entry.id)).toBe(false); // out of the teacher's hands now
    const adminSubmitted = await getActionInbox(adminScope, NO_COMM);
    expect(adminSubmitted.some((i) => i.id === `EXAM_MARK_SHEET:${entry.id}:VERIFY`)).toBe(true);

    await verifyMarks(adminScope, exam.id, entry.id);
    const adminVerified = await getActionInbox(adminScope, NO_COMM);
    expect(adminVerified.some((i) => i.sourceId === entry.id)).toBe(false);
  });
});

describe.skipIf(!dbReady)("fees actions (DB)", () => {
  it("summarizes unreconciled/mismatch payments into ONE action for a broad fee manager; reconciling clears it", async () => {
    const student = (await prisma.student.create({
      data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, admissionNumber: `${NS}-STU-${stamp}`, firstName: "Stu", lastName: "Dent", dateOfBirth: new Date("2015-01-01"), admissionDate: new Date("2024-04-01"), status: "ACTIVE" },
      select: { id: true },
    })).id;
    const payment = await prisma.feePayment.create({
      data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, studentId: student, receiptNumber: `${NS}-R-${stamp}`, amount: 500, method: "CASH", paymentDate: new Date(), receivedByUserId: adminUserId, reconciliationStatus: "UNRECONCILED" },
      select: { id: true },
    });

    const adminItems = await getActionInbox(adminScope, NO_COMM);
    const feeAction = adminItems.find((i) => i.category === "fees");
    expect(feeAction).toBeDefined();
    expect(feeAction!.status).toBe("unreconciled");

    const teacherItems = await getActionInbox(teacherScope, NO_COMM);
    expect(teacherItems.some((i) => i.category === "fees")).toBe(false);

    await prisma.feePayment.update({ where: { id: payment.id }, data: { reconciliationStatus: "RECONCILED" } });
    const afterReconcile = await getActionInbox(adminScope, NO_COMM);
    expect(afterReconcile.some((i) => i.category === "fees")).toBe(false);
  });
});

describe.skipIf(!dbReady)("payroll actions (DB)", () => {
  it("CALCULATED needs 'finalize' and FINALIZED needs 'pay', for SCHOOL_ADMIN only (PRINCIPAL is oversight-only here)", async () => {
    const calc = await prisma.payrollRun.create({ data: { tenantId, schoolId, branchId: branchA, year: 2026, month: 6, status: "CALCULATED", createdByUserId: adminUserId, calculatedAt: new Date() }, select: { id: true } });
    const fin = await prisma.payrollRun.create({ data: { tenantId, schoolId, branchId: branchA, year: 2026, month: 7, status: "FINALIZED", createdByUserId: adminUserId, calculatedAt: new Date(), finalizedAt: new Date() }, select: { id: true } });

    const adminItems = await getActionInbox(adminScope, NO_COMM);
    expect(adminItems.some((i) => i.id === `PAYROLL_RUN:${calc.id}:FINALIZE`)).toBe(true);
    expect(adminItems.some((i) => i.id === `PAYROLL_RUN:${fin.id}:PAY`)).toBe(true);

    const principalItems = await getActionInbox(principalScope, NO_COMM);
    expect(principalItems.some((i) => i.category === "payroll")).toBe(false);
  });
});

describe.skipIf(!dbReady)("visitor actions (DB)", () => {
  it("an EXPECTED visit needs check-in, CHECKED_IN needs check-out, CHECKED_OUT shows neither; SCHOOL_ADMIN only", async () => {
    const visit = await createExpectedVisit(adminScope, { fullName: "Vishal Visitor", phone: "9999999999", category: "guest", purpose: "Meeting", hostStaffId: teacherStaffId, expectedAt: new Date().toISOString() });

    const adminExpected = await getActionInbox(adminScope, NO_COMM);
    expect(adminExpected.some((i) => i.id === `VISITOR_VISIT:${visit.id}:CHECK_IN`)).toBe(true);
    const principalExpected = await getActionInbox(principalScope, NO_COMM);
    expect(principalExpected.some((i) => i.category === "visitor")).toBe(false);

    await checkInVisit(adminScope, visit.id);
    const adminCheckedIn = await getActionInbox(adminScope, NO_COMM);
    expect(adminCheckedIn.some((i) => i.id === `VISITOR_VISIT:${visit.id}:CHECK_OUT`)).toBe(true);
    expect(adminCheckedIn.some((i) => i.id === `VISITOR_VISIT:${visit.id}:CHECK_IN`)).toBe(false);

    await checkOutVisit(adminScope, visit.id);
    const adminCheckedOut = await getActionInbox(adminScope, NO_COMM);
    expect(adminCheckedOut.some((i) => i.sourceId === visit.id)).toBe(false);
  });
});

describe.skipIf(!dbReady)("communication actions (DB)", () => {
  it("summarizes unread conversations into one action; disappears when marked read; requires communication.send", async () => {
    const conv = await startDirectConversation(teacherScope, { recipientUserId: adminUserId });
    await sendMessage(teacherScope, conv.id, { body: "hello admin" });

    const adminNoComm = await getActionInbox(adminScope, NO_COMM);
    expect(adminNoComm.some((i) => i.category === "communication")).toBe(false); // permission flag off — feature not visible

    const adminWithComm = await getActionInbox(adminScope, WITH_COMM);
    expect(adminWithComm.some((i) => i.id === `COMMUNICATION:${adminUserId}:READ`)).toBe(true);

    await markConversationRead(adminScope, conv.id);
    const afterRead = await getActionInbox(adminScope, WITH_COMM);
    expect(afterRead.some((i) => i.category === "communication")).toBe(false);
  });
});

describe.skipIf(!dbReady)("isolation + summary + DTO safety (DB)", () => {
  it("cross-school isolation: a foreign school's admin never sees this school's actions", async () => {
    const draft = await createLessonPlan(teacherScope, { sectionId, subjectId, title: "Iso", learningObjective: "obj", teachingMethod: "lecture", plannedDate: "2026-09-15" });
    await submitLessonPlan(teacherScope, draft.id);
    const foreignItems = await getActionInbox(foreignAdminScope, NO_COMM);
    expect(foreignItems.some((i) => i.sourceId === draft.id)).toBe(false);
    await approveLessonPlan(adminScope, draft.id);
  });

  it("summary counts equal the real action list; an empty inbox returns zero/[]", async () => {
    const items = await getActionInbox(adminScope, WITH_COMM);
    const summary = await getActionInboxSummary(adminScope, WITH_COMM);
    expect(summary.total).toBe(items.length);
    const byPrioritySum = Object.values(summary.byPriority).reduce((a, b) => a + b, 0);
    expect(byPrioritySum).toBe(items.length);

    const emptyItems = await getActionInbox(librarianScope, NO_COMM);
    const emptySummary = await getActionInboxSummary(librarianScope, NO_COMM);
    expect(emptyItems).toEqual([]);
    expect(emptySummary.total).toBe(0);
  });

  it("action items expose only the documented DTO fields — no sensitive data", async () => {
    const req = await createLeaveRequest(teacherScope, { staffId: teacherStaffId, leaveTypeId, startDate: "2026-09-20", endDate: "2026-09-20", reason: "personal" });
    const items = await getActionInbox(adminScope, NO_COMM);
    const item = items.find((i) => i.sourceId === req.id)!;
    expect(Object.keys(item).sort()).toEqual(["actionLabel", "category", "createdAt", "description", "dueAt", "href", "id", "priority", "sourceId", "sourceType", "status", "title"].sort());
    await approveLeaveRequest(adminScope, req.id);
  });
});
