// Teacher detail aggregation DB integration tests (Phase 9J). Real Postgres:
// TeachingAssignments always included; timetable/homework/lessonPlans gated
// by the caller-supplied permission flags (never fabricated when the flag is
// false); staff attendance gated by the SAME self-or-broad-manager rule as
// the existing Staff Attendance service (not by a permission flag — reused,
// not reinvented); leave included for self or a broad leave manager only;
// payroll section never carries an amount, only a visibility flag; foreign-
// school staff id 404s. Namespaced ("T9J").
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { createStaff, setStaffUser } from "@/lib/server/staff/service";
import { getStaffTeacherDetail } from "@/lib/server/staff/teacher-detail-service";
import type { OrgScope } from "@/lib/server/api/scope";

let dbReady = false;
try {
  dbReady = Boolean(await prisma.role.findFirst({ where: { key: "SCHOOL_ADMIN", isSystem: true } }));
} catch {
  dbReady = false;
}

const NS = "T9J";
const stamp = Date.now().toString(36);

let tenantId = "", schoolId = "", branchA = "", sessionId = "", classId = "", sectionId = "", subjectId = "";
let teacherStaffId = "", teacherUserId = "", assignmentId = "";
let adminScope: OrgScope, teacherScope: OrgScope, bystanderScope: OrgScope;
let schoolBId = "", foreignStaffId = "";

async function makeUserWithRole(email: string, roleKey: string): Promise<string> {
  const u = await prisma.user.create({ data: { email, name: email, status: "ACTIVE" }, select: { id: true } });
  const m = await prisma.tenantMembership.create({ data: { userId: u.id, tenantId, status: "ACTIVE" }, select: { id: true } });
  const role = await prisma.role.findFirstOrThrow({ where: { key: roleKey, isSystem: true }, select: { id: true } });
  await prisma.roleAssignment.create({ data: { membershipId: m.id, roleId: role.id } });
  return u.id;
}

beforeAll(async () => {
  if (!dbReady) return;
  tenantId = (await prisma.tenant.create({ data: { name: `${NS} T`, slug: `t9j-${stamp}` }, select: { id: true } })).id;
  schoolId = (await prisma.school.create({ data: { tenantId, name: `${NS} S`, code: `${NS}-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  branchA = (await prisma.branch.create({ data: { schoolId, name: "A", code: `${NS}-A`, status: "ACTIVE" }, select: { id: true } })).id;
  sessionId = (await prisma.academicSession.create({ data: { schoolId, name: "26-27", code: `${NS}-S`, startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31"), status: "ACTIVE" }, select: { id: true } })).id;
  classId = (await prisma.class.create({ data: { tenantId, schoolId, academicSessionId: sessionId, name: "Grade 5", order: 5 }, select: { id: true } })).id;
  sectionId = (await prisma.section.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, classId, name: "A", capacity: 40, status: "ACTIVE" }, select: { id: true } })).id;
  subjectId = (await prisma.subject.create({ data: { tenantId, schoolId, code: `${NS}-MATH`, name: "Math", shortName: "MTH", department: "Math", type: "CORE" }, select: { id: true } })).id;
  await prisma.classSubject.create({ data: { tenantId, schoolId, academicSessionId: sessionId, classId, subjectId } });

  const adminUserId = await makeUserWithRole(`t9j-admin-${stamp}@x.test`, "SCHOOL_ADMIN");
  adminScope = { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, actor: { id: adminUserId, name: "Admin" } };

  teacherStaffId = (await createStaff(adminScope, { employeeCode: "T9J-1", firstName: "Teach", isTeaching: true })).id;
  teacherUserId = await makeUserWithRole(`t9j-teacher-${stamp}@x.test`, "TEACHER");
  await setStaffUser(adminScope, teacherStaffId, teacherUserId);
  teacherScope = { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, actor: { id: teacherUserId, name: "Teach" } };

  const bystanderUserId = await makeUserWithRole(`t9j-bystander-${stamp}@x.test`, "LIBRARIAN");
  bystanderScope = { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, actor: { id: bystanderUserId, name: "Bystander" } };

  assignmentId = (await prisma.teachingAssignment.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, sectionId, subjectId, staffId: teacherStaffId }, select: { id: true } })).id;

  await prisma.homework.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, sectionId, subjectId, staffId: teacherStaffId, teachingAssignmentId: assignmentId, title: "HW", description: "d", dueAt: new Date("2026-05-01"), status: "PUBLISHED", createdByUserId: teacherUserId } });
  await prisma.lessonPlan.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, sectionId, subjectId, staffId: teacherStaffId, teachingAssignmentId: assignmentId, title: "LP", learningObjective: "obj", teachingMethod: "lecture", plannedDate: new Date("2026-05-01"), createdByUserId: teacherUserId } });
  const todayMidnightUtc = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
  await prisma.staffAttendanceRecord.create({ data: { tenantId, schoolId, branchId: branchA, staffId: teacherStaffId, date: todayMidnightUtc, status: "PRESENT", markedByUserId: adminUserId } });
  const leaveType = (await prisma.leaveType.create({ data: { tenantId, schoolId, name: "Casual", code: `${NS}-CL` }, select: { id: true } })).id;
  await prisma.leaveRequest.create({ data: { tenantId, schoolId, branchId: branchA, staffId: teacherStaffId, leaveTypeId: leaveType, startDate: new Date("2026-05-10"), endDate: new Date("2026-05-10"), reason: "personal", requestedByUserId: teacherUserId, status: "PENDING" } });

  // foreign-school staff for isolation
  schoolBId = (await prisma.school.create({ data: { tenantId, name: `${NS} SB`, code: `${NS}-SB-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  const branchB = (await prisma.branch.create({ data: { schoolId: schoolBId, name: "B", code: `${NS}-B`, status: "ACTIVE" }, select: { id: true } })).id;
  const sessionB = (await prisma.academicSession.create({ data: { schoolId: schoolBId, name: "26-27", code: `${NS}-SBS`, startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31"), status: "ACTIVE" }, select: { id: true } })).id;
  const scopeB: OrgScope = { tenantId, schoolId: schoolBId, branchId: branchB, academicSessionId: sessionB, actor: { id: adminUserId, name: "Admin" } };
  foreignStaffId = (await createStaff(scopeB, { employeeCode: "T9J-FOREIGN", firstName: "Foreign" })).id;
});

afterAll(async () => {
  if (!dbReady || !tenantId) return;
  await prisma.leaveRequest.deleteMany({ where: { tenantId } });
  await prisma.leaveType.deleteMany({ where: { tenantId } });
  await prisma.staffAttendanceRecord.deleteMany({ where: { tenantId } });
  await prisma.lessonPlan.deleteMany({ where: { tenantId } });
  await prisma.homework.deleteMany({ where: { tenantId } });
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

const NO_PERMS = { timetable: false, homework: false, lessonPlans: false, leaveManage: false, payroll: false };

describe.skipIf(!dbReady)("teacher detail aggregation (DB)", () => {
  it("always includes real teachingAssignments regardless of permission flags", async () => {
    const detail = await getStaffTeacherDetail(adminScope, teacherStaffId, NO_PERMS);
    expect(detail.teachingAssignments).toHaveLength(1);
    expect(detail.teachingAssignments[0]).toMatchObject({ subject: { id: subjectId }, section: { id: sectionId } });
  });

  it("omits timetable/homework/lessonPlans (null) when the caller's permission flags are false", async () => {
    const detail = await getStaffTeacherDetail(adminScope, teacherStaffId, NO_PERMS);
    expect(detail.timetable).toBeNull();
    expect(detail.homework).toBeNull();
    expect(detail.lessonPlans).toBeNull();
  });

  it("includes homework/lessonPlans/timetable when the flags are true", async () => {
    const detail = await getStaffTeacherDetail(adminScope, teacherStaffId, { ...NO_PERMS, timetable: true, homework: true, lessonPlans: true });
    expect(detail.timetable).not.toBeNull();
    expect(detail.homework?.items.map((h) => h.title)).toContain("HW");
    expect(detail.lessonPlans?.items.map((p) => p.title)).toContain("LP");
  });

  it("attendance: visible to the staff member themselves and to a broad manager (admin)", async () => {
    const asAdmin = await getStaffTeacherDetail(adminScope, teacherStaffId, NO_PERMS);
    expect(asAdmin.attendance).not.toBeNull();
    const asSelf = await getStaffTeacherDetail(teacherScope, teacherStaffId, NO_PERMS);
    expect(asSelf.attendance).not.toBeNull();
  });

  it("attendance: null (never thrown, never fabricated) for a non-manager viewing someone else", async () => {
    const detail = await getStaffTeacherDetail(bystanderScope, teacherStaffId, NO_PERMS);
    expect(detail.attendance).toBeNull();
  });

  it("leave: included for self, and for a broad leave manager (leaveManage:true); omitted otherwise", async () => {
    const asSelf = await getStaffTeacherDetail(teacherScope, teacherStaffId, NO_PERMS);
    expect(asSelf.leave?.items.length).toBeGreaterThan(0);
    const asManager = await getStaffTeacherDetail(adminScope, teacherStaffId, { ...NO_PERMS, leaveManage: true });
    expect(asManager.leave?.items.length).toBeGreaterThan(0);
    const asBystander = await getStaffTeacherDetail(bystanderScope, teacherStaffId, NO_PERMS);
    expect(asBystander.leave).toBeNull();
  });

  it("payroll section never carries an amount — visible mirrors the caller's payroll flag only", async () => {
    const visible = await getStaffTeacherDetail(adminScope, teacherStaffId, { ...NO_PERMS, payroll: true });
    expect(visible.payroll).toEqual({ visible: true });
    const hidden = await getStaffTeacherDetail(adminScope, teacherStaffId, NO_PERMS);
    expect(hidden.payroll).toEqual({ visible: false });
  });

  it("cross-school isolation: a foreign-school staff id 404s", async () => {
    await expect(getStaffTeacherDetail(adminScope, foreignStaffId, NO_PERMS)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
