// Attendance DB-integration tests (Phase 5). Real Postgres: session create +
// uniqueness/concurrency, enrollment-derived roster, bulk marking + validation
// (archived/cross-section/cross-branch/cross-school/cross-session), lifecycle
// (submit/lock), summary, history + date filter, historical correctness after
// enrollment change, feature entitlement, RBAC, audit. Namespaced ("T5AT-").
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import {
  createOrGetSession,
  getSessionView,
  listHistory,
  lockSession,
  saveRecords,
  studentAttendance,
  submitSession,
} from "@/lib/server/attendance/service";
import type { OrgScope } from "@/lib/server/api/scope";
import { ROLE_PERMISSIONS } from "@/lib/server/authz/catalog";

let dbReady = false;
try {
  dbReady = Boolean(await prisma.role.findFirst({ where: { key: "SCHOOL_ADMIN", isSystem: true } }));
} catch {
  dbReady = false;
}

const NS = "T5AT";
const stamp = Date.now().toString(36);
const actor = { id: "t5at-actor", name: "T5AT Tester" };
let tenantId = "", schoolId = "", branchA = "", branchB = "", sessionId = "";
let classId = "", sectionA = "", sectionB = "", sectionBranchB = "";
let noFeatureSchoolId = "", noFeatureScope: OrgScope;
let scope: OrgScope;
const stu: Record<string, string> = {};

async function makeStudent(key: string, over: { branchId?: string; status?: string; schoolId?: string; academicSessionId?: string } = {}) {
  const s = await prisma.student.create({
    data: {
      tenantId, schoolId: over.schoolId ?? schoolId, branchId: over.branchId ?? branchA, academicSessionId: over.academicSessionId ?? sessionId,
      admissionNumber: `${NS}-${stamp}-${key}`, firstName: key.toUpperCase(), lastName: "Test",
      dateOfBirth: new Date("2015-01-01"), admissionDate: new Date("2024-04-01"), status: (over.status ?? "ACTIVE") as never,
    },
    select: { id: true },
  });
  stu[key] = s.id;
  return s.id;
}
async function enroll(studentId: string, sectionId: string, classIdArg = classId, branchId = branchA) {
  return (await prisma.enrollment.create({ data: { tenantId, schoolId, branchId, academicSessionId: sessionId, classId: classIdArg, sectionId, studentId, status: "ENROLLED" }, select: { id: true } })).id;
}

beforeAll(async () => {
  if (!dbReady) return;
  tenantId = (await prisma.tenant.create({ data: { name: `${NS} T`, slug: `t5at-${stamp}` }, select: { id: true } })).id;
  schoolId = (await prisma.school.create({ data: { tenantId, name: `${NS} S`, code: `${NS}-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  branchA = (await prisma.branch.create({ data: { schoolId, name: "A", code: `${NS}-A`, status: "ACTIVE" }, select: { id: true } })).id;
  branchB = (await prisma.branch.create({ data: { schoolId, name: "B", code: `${NS}-B`, status: "ACTIVE" }, select: { id: true } })).id;
  sessionId = (await prisma.academicSession.create({ data: { schoolId, name: "26-27", code: `${NS}-S`, startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31"), status: "ACTIVE" }, select: { id: true } })).id;
  classId = (await prisma.class.create({ data: { tenantId, schoolId, academicSessionId: sessionId, name: "Grade 5", order: 5 }, select: { id: true } })).id;
  sectionA = (await prisma.section.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, classId, name: "A", capacity: 40 }, select: { id: true } })).id;
  sectionB = (await prisma.section.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, classId, name: "B", capacity: 40 }, select: { id: true } })).id;
  sectionBranchB = (await prisma.section.create({ data: { tenantId, schoolId, branchId: branchB, academicSessionId: sessionId, classId, name: "C", capacity: 40 }, select: { id: true } })).id;
  // Enable the attendance feature for the test school (no plan needed).
  await prisma.schoolFeatureOverride.create({ data: { schoolId, tenantId, featureKey: "attendance", enabled: true } });
  scope = { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, actor: { id: actor.id, name: actor.name } };

  await makeStudent("a1"); await makeStudent("a2"); await makeStudent("archived", { status: "ARCHIVED" }); await makeStudent("secB"); await makeStudent("branchB", { branchId: branchB });
  await enroll(stu.a1, sectionA); await enroll(stu.a2, sectionA); await enroll(stu.secB, sectionB); await enroll(stu.branchB, sectionBranchB, classId, branchB);

  // A school WITHOUT the attendance feature (no override, no plan).
  noFeatureSchoolId = (await prisma.school.create({ data: { tenantId, name: `${NS} NF`, code: `${NS}-NF-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  const nfBranch = (await prisma.branch.create({ data: { schoolId: noFeatureSchoolId, name: "NF", code: `${NS}-NFB`, status: "ACTIVE" }, select: { id: true } })).id;
  const nfSession = (await prisma.academicSession.create({ data: { schoolId: noFeatureSchoolId, name: "26-27", code: `${NS}-NFS`, startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31"), status: "ACTIVE" }, select: { id: true } })).id;
  const nfClass = (await prisma.class.create({ data: { tenantId, schoolId: noFeatureSchoolId, academicSessionId: nfSession, name: "Grade 1", order: 1 }, select: { id: true } })).id;
  const nfSection = (await prisma.section.create({ data: { tenantId, schoolId: noFeatureSchoolId, branchId: nfBranch, academicSessionId: nfSession, classId: nfClass, name: "A" }, select: { id: true } })).id;
  noFeatureScope = { tenantId, schoolId: noFeatureSchoolId, branchId: nfBranch, academicSessionId: nfSession, actor: { id: actor.id, name: actor.name } };
  (globalThis as Record<string, unknown>).__t5at_nfSection = nfSection;
});

afterAll(async () => {
  if (!dbReady || !tenantId) return;
  await prisma.auditEvent.deleteMany({ where: { tenantId } });
  await prisma.tenant.delete({ where: { id: tenantId } }); // cascades everything
});

const DATE = "2026-08-12";

describe.skipIf(!dbReady)("attendance service (DB)", () => {
  it("get-or-create session is idempotent per (section, date) and roster comes from ENROLLED enrollment", async () => {
    const v1 = await createOrGetSession(scope, sectionA, DATE, actor);
    expect(v1.session).not.toBeNull();
    expect(v1.roster.map((r) => r.studentId).sort()).toEqual([stu.a1, stu.a2].sort()); // enrollment-derived, ACTIVE only
    expect(v1.roster.every((r) => r.status === null)).toBe(true); // unmarked
    const v2 = await createOrGetSession(scope, sectionA, DATE, actor);
    expect(v2.session!.id).toBe(v1.session!.id); // same logical session
    expect(await prisma.attendanceSession.count({ where: { sectionId: sectionA, date: new Date(`${DATE}T00:00:00Z`) } })).toBe(1);
    expect(await prisma.auditEvent.findFirst({ where: { entityId: v1.session!.id, action: "ATTENDANCE_SESSION_CREATED" } })).not.toBeNull();
  });

  it("concurrent create yields exactly one session", async () => {
    const D = "2026-08-13";
    const [a, b] = await Promise.all([createOrGetSession(scope, sectionA, D, actor), createOrGetSession(scope, sectionA, D, actor)]);
    expect(a.session!.id).toBe(b.session!.id);
    expect(await prisma.attendanceSession.count({ where: { sectionId: sectionA, date: new Date(`${D}T00:00:00Z`) } })).toBe(1);
  });

  it("bulk marking persists, summary is correct, and unmarked→present is caller-driven", async () => {
    const v = await createOrGetSession(scope, sectionA, DATE, actor);
    const res = await saveRecords(scope, v.session!.id, [
      { studentId: stu.a1, status: "present" },
      { studentId: stu.a2, status: "absent", remarks: "sick" },
    ], actor);
    expect(res.summary).toMatchObject({ total: 2, present: 1, absent: 1, attendancePercentage: 50 });
    // Read back through Prisma directly.
    const rows = await prisma.attendanceRecord.findMany({ where: { attendanceSessionId: v.session!.id }, select: { studentId: true, status: true, remarks: true, enrollmentId: true } });
    expect(rows.length).toBe(2);
    expect(rows.find((r) => r.studentId === stu.a2)).toMatchObject({ status: "ABSENT", remarks: "sick" });
    expect(rows.every((r) => r.enrollmentId)).toBe(true); // enrollment resolved server-side
    expect(await prisma.auditEvent.findFirst({ where: { entityId: v.session!.id, action: "ATTENDANCE_UPDATED" } })).not.toBeNull();
  });

  it("rejects archived / cross-section students on marking (server-resolved enrollment)", async () => {
    const v = await createOrGetSession(scope, sectionA, DATE, actor);
    await expect(saveRecords(scope, v.session!.id, [{ studentId: stu.archived, status: "present" }], actor)).rejects.toMatchObject({ code: "STUDENT_NOT_IN_SECTION" });
    await expect(saveRecords(scope, v.session!.id, [{ studentId: stu.secB, status: "present" }], actor)).rejects.toMatchObject({ code: "STUDENT_NOT_IN_SECTION" }); // enrolled in section B
  });

  it("isolation: cross-branch / cross-school / cross-session sections are not accessible", async () => {
    // Branch A scope cannot touch a branch B section.
    await expect(getSessionView(scope, sectionBranchB, DATE)).rejects.toMatchObject({ code: "INVALID_SCHOOL" });
    // A scope for a different school/session cannot reach this school's section.
    const otherScope: OrgScope = { ...scope, schoolId: noFeatureSchoolId, academicSessionId: (await prisma.academicSession.findFirstOrThrow({ where: { schoolId: noFeatureSchoolId }, select: { id: true } })).id, branchId: null };
    await expect(getSessionView(otherScope, sectionA, DATE)).rejects.toMatchObject({ code: "FEATURE_DISABLED" }); // feature gate hits first for that school
    const wrongSession: OrgScope = { ...scope, academicSessionId: "nope" };
    await expect(getSessionView(wrongSession, sectionA, DATE)).rejects.toMatchObject({ code: "INVALID_SCHOOL" });
  });

  it("submit then lock; locked session cannot be marked", async () => {
    const D = "2026-08-14";
    const v = await createOrGetSession(scope, sectionA, D, actor);
    await saveRecords(scope, v.session!.id, [{ studentId: stu.a1, status: "present" }], actor);
    const submitted = await submitSession(scope, v.session!.id);
    expect(submitted.session!.status).toBe("submitted");
    const locked = await lockSession(scope, v.session!.id);
    expect(locked.session!.status).toBe("locked");
    await expect(saveRecords(scope, v.session!.id, [{ studentId: stu.a2, status: "absent" }], actor)).rejects.toMatchObject({ code: "ATTENDANCE_ALREADY_LOCKED" });
  });

  it("history returns real sessions and honors the date filter", async () => {
    const all = await listHistory(scope, { page: 1, pageSize: 50 });
    expect(all.data.length).toBeGreaterThanOrEqual(3);
    const onlyDate = await listHistory(scope, { page: 1, pageSize: 50, dateFrom: DATE, dateTo: DATE });
    expect(onlyDate.data.every((s) => s.date === DATE)).toBe(true);
    expect(onlyDate.data.length).toBe(1);
  });

  it("historical attendance survives an enrollment change (unenroll)", async () => {
    const D = "2026-08-15";
    const v = await createOrGetSession(scope, sectionA, D, actor);
    await saveRecords(scope, v.session!.id, [{ studentId: stu.a1, status: "present" }], actor);
    // Student a1 leaves the section (delete enrollment) — attendance record must remain.
    await prisma.enrollment.deleteMany({ where: { sectionId: sectionA, studentId: stu.a1 } });
    const rec = await prisma.attendanceRecord.findFirst({ where: { attendanceSessionId: v.session!.id, studentId: stu.a1 }, select: { status: true, enrollmentId: true } });
    expect(rec).not.toBeNull();
    expect(rec!.status).toBe("PRESENT");
    expect(rec!.enrollmentId).toBeNull(); // SetNull preserved the historical record
    // Re-enroll a1 for later tests' cleanliness (not required).
    await enroll(stu.a1, sectionA);
  });

  it("student attendance summary aggregates real records", async () => {
    const s = await studentAttendance(scope, stu.a2, {});
    expect(s.summary.records).toBeGreaterThanOrEqual(1);
    expect(s.recent.some((r) => r.date === DATE && r.status === "absent")).toBe(true);
  });

  it("feature entitlement is enforced server-side (school without attendance → FEATURE_DISABLED)", async () => {
    const nfSection = (globalThis as Record<string, unknown>).__t5at_nfSection as string;
    await expect(getSessionView(noFeatureScope, nfSection, DATE)).rejects.toMatchObject({ code: "FEATURE_DISABLED" });
    await expect(createOrGetSession(noFeatureScope, nfSection, DATE, actor)).rejects.toMatchObject({ code: "FEATURE_DISABLED" });
  });

  it("safe errors: unknown session / invalid date", async () => {
    await expect(getSessionView(scope, sectionA, "2026/08/12")).rejects.toMatchObject({ code: "ATTENDANCE_DATE_INVALID" });
    await expect(submitSession(scope, "nope")).rejects.toMatchObject({ code: "ATTENDANCE_SESSION_NOT_FOUND" });
  });

  it("RBAC: attendance.view/mark are held by SCHOOL_ADMIN/PRINCIPAL; TEACHER per catalog; not weakened", () => {
    expect(ROLE_PERMISSIONS.SCHOOL_ADMIN).toEqual(expect.arrayContaining(["attendance.view", "attendance.mark"]));
    expect(ROLE_PERMISSIONS.PRINCIPAL).toContain("attendance.view");
    expect(ROLE_PERMISSIONS.TEACHER).toEqual(expect.arrayContaining(["attendance.view", "attendance.mark"]));
    // A role with no attendance perms stays denied.
    expect(ROLE_PERMISSIONS.LIBRARIAN ?? []).not.toContain("attendance.mark");
  });
});
