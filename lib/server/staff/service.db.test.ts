// Staff + TeachingAssignment DB integration tests (Phase 6A). Real Postgres:
// staff CRUD + employeeCode uniqueness, status, search/paginate, optional User
// link (valid/invalid/cross-tenant), branch/tenant/school isolation, getTeaching-
// Staff filtering, safe DTO, audit; teaching-assignment validation (active +
// teaching-eligible + same-branch teacher, subject-must-be-in-class, dup 409,
// foreign section, session isolation, remove), RBAC catalog. Namespaced ("T6A-").
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import {
  createStaff, getStaff, getTeachingStaff, listStaff, setStaffStatus, setStaffUser, updateStaff,
} from "@/lib/server/staff/service";
import {
  createTeachingAssignment, listTeachingAssignments, removeTeachingAssignment,
} from "@/lib/server/academics/teaching-assignments-service";
import type { OrgScope } from "@/lib/server/api/scope";
import { ROLE_PERMISSIONS } from "@/lib/server/authz/catalog";

let dbReady = false;
try {
  dbReady = Boolean(await prisma.role.findFirst({ where: { key: "SCHOOL_ADMIN", isSystem: true } }));
} catch {
  dbReady = false;
}

const NS = "T6A";
const stamp = Date.now().toString(36);
const actor = { id: "t6a-actor", name: "T6A Tester" };

let tenantId = "", schoolId = "", branchA = "", branchB = "", sessionId = "";
let classId = "", sectionA = "", sectionBranchB = "", subjectId = "", offSubjectId = "";
let scope: OrgScope;
let memberUserId = "", nonMemberUserId = "";
// second school
let schoolB = "", scopeB: OrgScope, staffB = "";

async function mkStaff(scp: OrgScope, code: string, over: Record<string, unknown> = {}) {
  return createStaff(scp, { employeeCode: code, firstName: code, isTeaching: true, ...over });
}

beforeAll(async () => {
  if (!dbReady) return;
  tenantId = (await prisma.tenant.create({ data: { name: `${NS} T`, slug: `t6a-${stamp}` }, select: { id: true } })).id;
  schoolId = (await prisma.school.create({ data: { tenantId, name: `${NS} S`, code: `${NS}-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  branchA = (await prisma.branch.create({ data: { schoolId, name: "A", code: `${NS}-A`, status: "ACTIVE" }, select: { id: true } })).id;
  branchB = (await prisma.branch.create({ data: { schoolId, name: "B", code: `${NS}-B`, status: "ACTIVE" }, select: { id: true } })).id;
  sessionId = (await prisma.academicSession.create({ data: { schoolId, name: "26-27", code: `${NS}-S`, startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31"), status: "ACTIVE" }, select: { id: true } })).id;
  classId = (await prisma.class.create({ data: { tenantId, schoolId, academicSessionId: sessionId, name: "Grade 5", order: 5 }, select: { id: true } })).id;
  sectionA = (await prisma.section.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, classId, name: "A", capacity: 40, status: "ACTIVE" }, select: { id: true } })).id;
  sectionBranchB = (await prisma.section.create({ data: { tenantId, schoolId, branchId: branchB, academicSessionId: sessionId, classId, name: "B", capacity: 40, status: "ACTIVE" }, select: { id: true } })).id;
  // a subject offered by the class + one NOT offered
  subjectId = (await prisma.subject.create({ data: { tenantId, schoolId, code: `${NS}-MATH`, name: "Math", shortName: "MTH", department: "Math", type: "CORE" }, select: { id: true } })).id;
  offSubjectId = (await prisma.subject.create({ data: { tenantId, schoolId, code: `${NS}-ART`, name: "Art", shortName: "ART", department: "Arts", type: "ELECTIVE" }, select: { id: true } })).id;
  await prisma.classSubject.create({ data: { tenantId, schoolId, academicSessionId: sessionId, classId, subjectId } });
  scope = { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, actor: { id: actor.id, name: actor.name } };

  // users: one ACTIVE member of this tenant, one not a member
  memberUserId = (await prisma.user.create({ data: { email: `t6a-member-${stamp}@x.test`, name: "Member", status: "ACTIVE" }, select: { id: true } })).id;
  await prisma.tenantMembership.create({ data: { userId: memberUserId, tenantId, status: "ACTIVE" } });
  nonMemberUserId = (await prisma.user.create({ data: { email: `t6a-nonmember-${stamp}@x.test`, name: "NonMember", status: "ACTIVE" }, select: { id: true } })).id;

  // second school (isolation)
  schoolB = (await prisma.school.create({ data: { tenantId, name: `${NS} SB`, code: `${NS}-SB-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  const bBranch = (await prisma.branch.create({ data: { schoolId: schoolB, name: "SB", code: `${NS}-SBB`, status: "ACTIVE" }, select: { id: true } })).id;
  const bSession = (await prisma.academicSession.create({ data: { schoolId: schoolB, name: "26-27", code: `${NS}-SBS`, startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31"), status: "ACTIVE" }, select: { id: true } })).id;
  scopeB = { tenantId, schoolId: schoolB, branchId: bBranch, academicSessionId: bSession, actor: { id: actor.id, name: actor.name } };
  staffB = (await mkStaff(scopeB, "B-001")).id;
});

afterAll(async () => {
  if (!dbReady || !tenantId) return;
  await prisma.auditEvent.deleteMany({ where: { tenantId } });
  await prisma.staff.deleteMany({ where: { tenantId } }); // release userId links before user delete
  await prisma.user.deleteMany({ where: { id: { in: [memberUserId, nonMemberUserId] } } });
  await prisma.tenant.delete({ where: { id: tenantId } });
});

describe.skipIf(!dbReady)("staff (DB)", () => {
  it("creates staff + audit; DTO name falls back to first+last", async () => {
    const s = await mkStaff(scope, "S-001", { firstName: "Asha", lastName: "Verma" });
    expect(s).toMatchObject({ employeeCode: "S-001", name: "Asha Verma", isTeaching: true, status: "active", hasUser: false });
    const audit = await prisma.auditEvent.findFirst({ where: { tenantId, action: "STAFF_CREATED", entityId: s.id } });
    expect(audit).not.toBeNull();
  });

  it("rejects a duplicate employeeCode in the same school (409)", async () => {
    await mkStaff(scope, "DUP");
    await expect(mkStaff(scope, "dup")).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("updates + changes status; search + pagination run server-side", async () => {
    const s = await mkStaff(scope, "S-UPD", { firstName: "Ravi" });
    const upd = await updateStaff(scope, s.id, { designation: "Head of Dept" });
    expect(upd.designation).toBe("Head of Dept");
    const inactive = await setStaffStatus(scope, s.id, "inactive");
    expect(inactive.status).toBe("inactive");
    const bySearch = await listStaff(scope, { search: "Ravi" });
    expect(bySearch.some((x) => x.id === s.id)).toBe(true);
    const page = await listStaff(scope, { page: 1, pageSize: 2 });
    expect(page.length).toBeLessThanOrEqual(2);
  });

  it("links an optional User (member) and rejects a non-member / duplicate link", async () => {
    const s = await mkStaff(scope, "S-LINK");
    const linked = await setStaffUser(scope, s.id, memberUserId);
    expect(linked.hasUser).toBe(true);
    expect(linked.userEmail).toContain("t6a-member");
    const link = await prisma.auditEvent.findFirst({ where: { tenantId, action: "STAFF_USER_LINKED", entityId: s.id } });
    expect(link).not.toBeNull();
    // non-member user cannot be linked
    const s2 = await mkStaff(scope, "S-LINK2");
    await expect(setStaffUser(scope, s2.id, nonMemberUserId)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    // the member user is already linked → cannot link to another staff
    await expect(setStaffUser(scope, s2.id, memberUserId)).rejects.toMatchObject({ code: "CONFLICT" });
    // unlink works
    const unlinked = await setStaffUser(scope, s.id, null);
    expect(unlinked.hasUser).toBe(false);
  });

  it("getTeachingStaff returns ONLY active + teaching + in-scope staff", async () => {
    const t = await mkStaff(scope, "TEA-1", { firstName: "Teachy", isTeaching: true });
    await mkStaff(scope, "NON-1", { firstName: "Admin", isTeaching: false });
    const inactive = await mkStaff(scope, "TEA-OFF", { firstName: "Gone", isTeaching: true });
    await setStaffStatus(scope, inactive.id, "inactive");
    const teaching = await getTeachingStaff(scope);
    const ids = teaching.map((x) => x.id);
    expect(ids).toContain(t.id);
    expect(ids).not.toContain(inactive.id); // inactive excluded
    expect(teaching.every((x) => x.employeeCode !== "NON-1")); // non-teaching excluded
    expect(teaching.some((x) => x.employeeCode === "NON-1")).toBe(false);
  });

  it("cross-school isolation: a foreign staff id is not found, list excludes it", async () => {
    await expect(getStaff(scope, staffB)).rejects.toMatchObject({ code: "NOT_FOUND" });
    const list = await listStaff(scope);
    expect(list.every((x) => x.id !== staffB)).toBe(true);
  });

  it("list DTO exposes no userId / auth fields (only hasUser)", async () => {
    const [s] = await listStaff(scope, { search: "Asha" });
    expect(Object.keys(s)).toContain("hasUser");
    expect(Object.keys(s)).not.toContain("userId");
    expect(Object.keys(s)).not.toContain("passwordHash");
  });

  it("RBAC: hr.manage held by HR_ADMIN (not SCHOOL_ADMIN); academics.manage by admin", () => {
    expect(ROLE_PERMISSIONS.HR_ADMIN).toContain("hr.manage");
    expect(ROLE_PERMISSIONS.SCHOOL_ADMIN).toContain("hr.view");
    expect(ROLE_PERMISSIONS.SCHOOL_ADMIN).not.toContain("hr.manage");
    expect(ROLE_PERMISSIONS.SCHOOL_ADMIN).toContain("academics.manage");
  });
});

describe.skipIf(!dbReady)("teaching assignments (DB)", () => {
  it("assigns an active teaching staff to an offered subject + audits it", async () => {
    const t = await mkStaff(scope, "TA-1", { firstName: "Teach" });
    const a = await createTeachingAssignment(scope, sectionA, { subjectId, staffId: t.id });
    expect(a).toMatchObject({ sectionId: sectionA, subjectId, staffId: t.id, subjectName: "Math" });
    const audit = await prisma.auditEvent.findFirst({ where: { tenantId, action: "TEACHING_ASSIGNMENT_CREATED", entityId: a.id } });
    expect(audit).not.toBeNull();
  });

  it("blocks duplicate (same staff+section+subject) with 409", async () => {
    const t = await mkStaff(scope, "TA-DUP", { firstName: "Dup" });
    await createTeachingAssignment(scope, sectionA, { subjectId, staffId: t.id });
    await expect(createTeachingAssignment(scope, sectionA, { subjectId, staffId: t.id })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("rejects a subject NOT offered by the section's class", async () => {
    const t = await mkStaff(scope, "TA-OFF", { firstName: "Off" });
    await expect(createTeachingAssignment(scope, sectionA, { subjectId: offSubjectId, staffId: t.id })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("rejects a non-teaching, an inactive, and a foreign-school teacher", async () => {
    const nonTeach = await mkStaff(scope, "TA-NT", { firstName: "NT", isTeaching: false });
    await expect(createTeachingAssignment(scope, sectionA, { subjectId, staffId: nonTeach.id })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    const inactive = await mkStaff(scope, "TA-IN", { firstName: "In" });
    await setStaffStatus(scope, inactive.id, "inactive");
    await expect(createTeachingAssignment(scope, sectionA, { subjectId, staffId: inactive.id })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(createTeachingAssignment(scope, sectionA, { subjectId, staffId: staffB })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("rejects a cross-branch teacher (staff in branch A, section in branch B)", async () => {
    // sectionBranchB is in branchB; staff created under scope (branchA).
    const t = await mkStaff(scope, "TA-CB", { firstName: "CB" });
    // Need the branchB section to also have the subject offered — it shares the same class.
    await expect(createTeachingAssignment({ ...scope, branchId: branchB }, sectionBranchB, { subjectId, staffId: t.id })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("rejects a foreign / cross-session section", async () => {
    const t = await mkStaff(scope, "TA-FS", { firstName: "FS" });
    await expect(createTeachingAssignment(scope, "not-a-section", { subjectId, staffId: t.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    const wrongSession: OrgScope = { ...scope, academicSessionId: "nope" };
    await expect(createTeachingAssignment(wrongSession, sectionA, { subjectId, staffId: t.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("lists + removes an assignment", async () => {
    const t = await mkStaff(scope, "TA-RM", { firstName: "Rm" });
    const a = await createTeachingAssignment(scope, sectionA, { subjectId, staffId: t.id });
    const list = await listTeachingAssignments(scope, sectionA);
    expect(list.some((x) => x.id === a.id)).toBe(true);
    await removeTeachingAssignment(scope, sectionA, a.id);
    const after = await listTeachingAssignments(scope, sectionA);
    expect(after.every((x) => x.id !== a.id)).toBe(true);
    const audit = await prisma.auditEvent.findFirst({ where: { tenantId, action: "TEACHING_ASSIGNMENT_REMOVED", entityId: a.id } });
    expect(audit).not.toBeNull();
  });
});
