// Academics foundation DB-integration tests (Phase 6-pre). Real Class/Section/
// Enrollment against Postgres: create + uniqueness, branch resolution, roster,
// enrollment validation (archived / cross-branch / cross-school / duplicate),
// scope isolation, RBAC, and audit. Namespaced ("T6P-").
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import {
  createClass,
  createSection,
  enrollStudents,
  getClass,
  listClasses,
  listEnrollableStudents,
  listRoster,
  unenroll,
} from "@/lib/server/academics/service";
import type { OrgScope } from "@/lib/server/api/scope";
import { ROLE_PERMISSIONS } from "@/lib/server/authz/catalog";

let dbReady = false;
try {
  dbReady = Boolean(await prisma.role.findFirst({ where: { key: "SCHOOL_ADMIN", isSystem: true } }));
} catch {
  dbReady = false;
}

const NS = "T6P";
const stamp = Date.now().toString(36);
let tenantId = "";
let schoolId = "";
let branchId = "";
let otherBranchId = "";
let sessionId = "";
let scope: OrgScope;
let otherScope: OrgScope; // a different school entirely
const studentIds: Record<string, string> = {};

async function makeStudent(key: string, over: { schoolId?: string; branchId?: string; academicSessionId?: string; status?: string } = {}) {
  const s = await prisma.student.create({
    data: {
      tenantId, schoolId: over.schoolId ?? schoolId, branchId: over.branchId ?? branchId, academicSessionId: over.academicSessionId ?? sessionId,
      admissionNumber: `${NS}-${stamp}-${key}`, firstName: key, lastName: "Test", dateOfBirth: new Date("2015-01-01"), admissionDate: new Date("2024-04-01"),
      status: (over.status ?? "ACTIVE") as never,
    },
    select: { id: true },
  });
  studentIds[key] = s.id;
  return s.id;
}

beforeAll(async () => {
  if (!dbReady) return;
  tenantId = (await prisma.tenant.create({ data: { name: `${NS} Tenant`, slug: `t6p-${stamp}` }, select: { id: true } })).id;
  schoolId = (await prisma.school.create({ data: { tenantId, name: `${NS} School`, code: `${NS}-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  branchId = (await prisma.branch.create({ data: { schoolId, name: "Main", code: `${NS}-MAIN`, status: "ACTIVE", isPrimary: true }, select: { id: true } })).id;
  otherBranchId = (await prisma.branch.create({ data: { schoolId, name: "Annex", code: `${NS}-ANNEX`, status: "ACTIVE" }, select: { id: true } })).id;
  sessionId = (await prisma.academicSession.create({ data: { schoolId, name: "2026-27", code: `${NS}-S`, startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31"), status: "ACTIVE", isCurrent: true }, select: { id: true } })).id;
  scope = { tenantId, schoolId, branchId, academicSessionId: sessionId, actor: { id: "t6p-actor", name: "T6P" } };

  // Another school (for cross-school isolation).
  const os = (await prisma.school.create({ data: { tenantId, name: `${NS} Other`, code: `${NS}-O-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  const ob = (await prisma.branch.create({ data: { schoolId: os, name: "OMain", code: `${NS}-OMAIN`, status: "ACTIVE" }, select: { id: true } })).id;
  const oses = (await prisma.academicSession.create({ data: { schoolId: os, name: "2026-27", code: `${NS}-OS`, startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31"), status: "ACTIVE" }, select: { id: true } })).id;
  otherScope = { tenantId, schoolId: os, branchId: ob, academicSessionId: oses, actor: { id: "t6p-actor", name: "T6P" } };

  await makeStudent("a");
  await makeStudent("b");
  await makeStudent("c");
  await makeStudent("archived", { status: "ARCHIVED" });
  await makeStudent("otherBranch", { branchId: otherBranchId });
  await makeStudent("otherSchool", { schoolId: os, branchId: ob, academicSessionId: oses });
});

afterAll(async () => {
  if (!dbReady || !tenantId) return;
  await prisma.auditEvent.deleteMany({ where: { tenantId } });
  await prisma.tenant.delete({ where: { id: tenantId } }); // cascades schools/students/classes/sections/enrollments
});

describe.skipIf(!dbReady)("academics foundation service (DB)", () => {
  let classId = "";
  let sectionId = "";

  it("creates a class (session-scoped) and rejects a duplicate name", async () => {
    const c = await createClass(scope, { name: "Grade 5", order: 5 });
    classId = c.id;
    expect(c).toMatchObject({ name: "Grade 5", order: 5, status: "active", sectionCount: 0, enrolledCount: 0 });
    await expect(createClass(scope, { name: "Grade 5" })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await prisma.auditEvent.findFirst({ where: { entityId: c.id, action: "CLASS_CREATED" } })).not.toBeNull();
  });

  it("creates a section (branch derived from scope) and rejects a duplicate", async () => {
    const s = await createSection(scope, { classId, name: "A", capacity: 30 });
    sectionId = s.id;
    expect(s).toMatchObject({ classId, name: "A", capacity: 30, status: "active", branchId, enrolledCount: 0 });
    await expect(createSection(scope, { classId, name: "A" })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("enrolls valid in-scope ACTIVE students; roster + counts reflect it", async () => {
    const roster = await enrollStudents(scope, sectionId, { studentIds: [studentIds.a, studentIds.b] });
    expect(roster.length).toBe(2);
    expect(roster.every((r) => r.status === "enrolled")).toBe(true);
    const detail = await getClass(scope, classId);
    expect(detail.enrolledCount).toBe(2);
    expect(detail.sections[0].enrolledCount).toBe(2);
    expect(await prisma.auditEvent.findFirst({ where: { entityId: sectionId, action: "STUDENT_ENROLLED" } })).not.toBeNull();
  });

  it("rejects archived / cross-branch / cross-school / already-enrolled students", async () => {
    await expect(enrollStudents(scope, sectionId, { studentIds: [studentIds.archived] })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(enrollStudents(scope, sectionId, { studentIds: [studentIds.otherBranch] })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(enrollStudents(scope, sectionId, { studentIds: [studentIds.otherSchool] })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(enrollStudents(scope, sectionId, { studentIds: [studentIds.a] })).rejects.toMatchObject({ code: "CONFLICT" }); // already enrolled this session
  });

  it("enrollable list excludes already-enrolled students; unenroll frees a student", async () => {
    const before = await listEnrollableStudents(scope);
    expect(before.some((s) => s.id === studentIds.a)).toBe(false); // enrolled
    expect(before.some((s) => s.id === studentIds.c)).toBe(true); // not yet

    const roster = await listRoster(scope, sectionId);
    const enrollmentA = roster.find((r) => r.student.id === studentIds.a)!;
    await unenroll(scope, enrollmentA.enrollmentId);
    const after = await listEnrollableStudents(scope);
    expect(after.some((s) => s.id === studentIds.a)).toBe(true); // freed → re-enrollable
    expect(await prisma.auditEvent.findFirst({ where: { entityId: sectionId, action: "STUDENT_UNENROLLED" } })).not.toBeNull();
  });

  it("scope isolation: another school cannot see or mutate this school's class", async () => {
    const otherList = await listClasses(otherScope);
    expect(otherList.some((c) => c.id === classId)).toBe(false);
    await expect(getClass(otherScope, classId)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(createSection(otherScope, { classId, name: "Z" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("RBAC: academics.view/manage are tenant perms held by SCHOOL_ADMIN; TEACHER is view-only", () => {
    expect(ROLE_PERMISSIONS.SCHOOL_ADMIN).toContain("academics.manage");
    expect(ROLE_PERMISSIONS.SCHOOL_ADMIN).toContain("academics.view");
    expect(ROLE_PERMISSIONS.TEACHER).toContain("academics.view");
    expect(ROLE_PERMISSIONS.TEACHER).not.toContain("academics.manage");
  });
});
