// Academics Core — Subjects + Class↔Subject DB integration tests (Phase 6). Real
// Postgres: subject CRUD + unique code, archive/restore, search/filter/paginate,
// class assignment (active-only, dedup, cross-school/session rejection), bulk
// reconcile atomicity, Section→Class inheritance resolver, audit + safe DTOs,
// cross-tenant/school/session isolation. Namespaced ("T6-"). Academics is NOT
// plan-feature-gated, so there is no feature-denial case (see §16 of the plan).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import {
  createSubject, duplicateSubject, getSubject, listSubjects, setSubjectStatus, updateSubject,
} from "@/lib/server/academics/subjects-service";
import {
  assignSubject, getSubjectsForSection, listClassSubjects, listSubjectClasses,
  reconcileClassSubjects, removeClassSubject,
} from "@/lib/server/academics/class-subjects-service";
import type { OrgScope } from "@/lib/server/api/scope";
import { ROLE_PERMISSIONS } from "@/lib/server/authz/catalog";

let dbReady = false;
try {
  dbReady = Boolean(await prisma.role.findFirst({ where: { key: "SCHOOL_ADMIN", isSystem: true } }));
} catch {
  dbReady = false;
}

const NS = "T6";
const stamp = Date.now().toString(36);
const actor = { id: "t6-actor", name: "T6 Tester" };

let tenantId = "", schoolId = "", branchA = "", sessionId = "", classId = "", classId2 = "", sectionA = "";
let scope: OrgScope;
// second school (isolation)
let schoolB = "", scopeB: OrgScope, subjectB = "";

async function mkSubject(scp: OrgScope, code: string, over: Record<string, unknown> = {}) {
  return createSubject(scp, { name: `Subj ${code}`, code, shortName: code.slice(0, 6), department: "Dept", type: "core", ...over });
}

beforeAll(async () => {
  if (!dbReady) return;
  tenantId = (await prisma.tenant.create({ data: { name: `${NS} T`, slug: `t6-${stamp}` }, select: { id: true } })).id;
  schoolId = (await prisma.school.create({ data: { tenantId, name: `${NS} S`, code: `${NS}-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  branchA = (await prisma.branch.create({ data: { schoolId, name: "A", code: `${NS}-A`, status: "ACTIVE" }, select: { id: true } })).id;
  sessionId = (await prisma.academicSession.create({ data: { schoolId, name: "26-27", code: `${NS}-S`, startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31"), status: "ACTIVE" }, select: { id: true } })).id;
  classId = (await prisma.class.create({ data: { tenantId, schoolId, academicSessionId: sessionId, name: "Grade 5", order: 5 }, select: { id: true } })).id;
  classId2 = (await prisma.class.create({ data: { tenantId, schoolId, academicSessionId: sessionId, name: "Grade 6", order: 6 }, select: { id: true } })).id;
  sectionA = (await prisma.section.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, classId, name: "A", capacity: 40, status: "ACTIVE" }, select: { id: true } })).id;
  scope = { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, actor: { id: actor.id, name: actor.name } };

  // Second school for isolation.
  schoolB = (await prisma.school.create({ data: { tenantId, name: `${NS} SB`, code: `${NS}-SB-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  const bBranch = (await prisma.branch.create({ data: { schoolId: schoolB, name: "SB", code: `${NS}-SBB`, status: "ACTIVE" }, select: { id: true } })).id;
  const bSession = (await prisma.academicSession.create({ data: { schoolId: schoolB, name: "26-27", code: `${NS}-SBS`, startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31"), status: "ACTIVE" }, select: { id: true } })).id;
  scopeB = { tenantId, schoolId: schoolB, branchId: bBranch, academicSessionId: bSession, actor: { id: actor.id, name: actor.name } };
  subjectB = (await mkSubject(scopeB, "ENG")).id;
});

afterAll(async () => {
  if (!dbReady || !tenantId) return;
  await prisma.auditEvent.deleteMany({ where: { tenantId } });
  await prisma.tenant.delete({ where: { id: tenantId } }); // cascades
});

describe.skipIf(!dbReady)("academics subjects (DB)", () => {
  it("creates a subject with all catalogue fields + a real audit row", async () => {
    const s = await mkSubject(scope, "MATH", { maxMarks: 80, gradeRangeStart: 1, gradeRangeEnd: 12 });
    expect(s).toMatchObject({ code: "MATH", name: "Subj MATH", status: "active", classCount: 0, maxMarks: 80 });
    const audit = await prisma.auditEvent.findFirst({ where: { tenantId, action: "SUBJECT_CREATED", entityId: s.id } });
    expect(audit).not.toBeNull();
  });

  it("rejects a duplicate code in the same school (409 CONFLICT)", async () => {
    await mkSubject(scope, "SCI");
    await expect(mkSubject(scope, "sci")).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("updates a subject and enforces unique code on rename", async () => {
    const a = await mkSubject(scope, "HIN");
    const b = await mkSubject(scope, "SST");
    const updated = await updateSubject(scope, a.id, { name: "Hindi (renamed)", maxMarks: 90 });
    expect(updated).toMatchObject({ name: "Hindi (renamed)", maxMarks: 90 });
    await expect(updateSubject(scope, a.id, { code: "SST" })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(b.id).toBeTruthy();
  });

  it("partial update leaves OMITTED fields unchanged (no reset to defaults)", async () => {
    const s = await mkSubject(scope, "PU", { type: "language", gradeRangeStart: 1, gradeRangeEnd: 12, maxMarks: 80 });
    expect(s).toMatchObject({ type: "language", gradeRangeStart: 1, gradeRangeEnd: 12, maxMarks: 80 });
    // Patch only maxMarks — type/gradeRange must be preserved.
    const updated = await updateSubject(scope, s.id, { maxMarks: 95 });
    expect(updated).toMatchObject({ type: "language", gradeRangeStart: 1, gradeRangeEnd: 12, maxMarks: 95 });
  });

  it("archives + restores; DTO status uses UI vocabulary (active|inactive)", async () => {
    const s = await mkSubject(scope, "GEO");
    const archived = await setSubjectStatus(scope, s.id, "inactive");
    expect(archived.status).toBe("inactive");
    const restored = await setSubjectStatus(scope, s.id, "active");
    expect(restored.status).toBe("active");
  });

  it("search + status filter + pagination all run server-side", async () => {
    const bySearch = await listSubjects(scope, { search: "MATH" });
    expect(bySearch.some((s) => s.code === "MATH")).toBe(true);
    expect(bySearch.every((s) => /math/i.test(`${s.name}${s.code}${s.department}`))).toBe(true);
    const page1 = await listSubjects(scope, { page: 1, pageSize: 2 });
    expect(page1.length).toBe(2);
    const active = await listSubjects(scope, { status: "active" });
    expect(active.every((s) => s.status === "active")).toBe(true);
  });

  it("duplicate creates a fresh ACTIVE copy with a distinct code", async () => {
    const s = await mkSubject(scope, "ART");
    const copy = await duplicateSubject(scope, s.id);
    expect(copy.id).not.toBe(s.id);
    expect(copy.code).not.toBe(s.code);
    expect(copy.status).toBe("active");
    expect(copy.name).toContain("Copy of");
  });

  it("cross-school isolation: a foreign subject id is not found", async () => {
    await expect(getSubject(scope, subjectB)).rejects.toMatchObject({ code: "NOT_FOUND" });
    const listA = await listSubjects(scope);
    expect(listA.every((s) => s.id !== subjectB)).toBe(true);
  });

  it("DTO exposes only safe display fields", async () => {
    const [s] = await listSubjects(scope, { search: "MATH" });
    expect(Object.keys(s).sort()).toEqual([
      "classCount", "code", "color", "credit", "department", "gradeRangeEnd", "gradeRangeStart",
      "id", "maxMarks", "name", "order", "passingMarks", "practicalMarks", "shortName", "status", "theoryMarks", "type",
    ]);
    expect(Object.keys(s)).not.toContain("tenantId");
    expect(Object.keys(s)).not.toContain("schoolId");
  });

  it("RBAC: academics.manage held by admin/principal, not librarian", () => {
    expect(ROLE_PERMISSIONS.SCHOOL_ADMIN).toContain("academics.manage");
    expect(ROLE_PERMISSIONS.PRINCIPAL).toContain("academics.manage");
    expect(ROLE_PERMISSIONS.LIBRARIAN ?? []).not.toContain("academics.manage");
    expect(ROLE_PERMISSIONS.TEACHER ?? []).toContain("academics.view");
  });
});

describe.skipIf(!dbReady)("academics class-subjects (DB)", () => {
  it("assigns an active subject to a class + audits it", async () => {
    const s = await mkSubject(scope, "CS1");
    const cs = await assignSubject(scope, classId, { subjectId: s.id });
    expect(cs).toMatchObject({ classId, subjectId: s.id, subjectName: s.name });
    const audit = await prisma.auditEvent.findFirst({ where: { tenantId, action: "CLASS_SUBJECT_ASSIGNED", entityId: cs.id } });
    expect(audit).not.toBeNull();
    // classCount now reflects the assignment.
    const fetched = await getSubject(scope, s.id);
    expect(fetched.classCount).toBe(1);
  });

  it("blocks a duplicate assignment (409)", async () => {
    const s = await mkSubject(scope, "CS2");
    await assignSubject(scope, classId, { subjectId: s.id });
    await expect(assignSubject(scope, classId, { subjectId: s.id })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("rejects a cross-school subject and an archived subject", async () => {
    await expect(assignSubject(scope, classId, { subjectId: subjectB })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    const arch = await mkSubject(scope, "OLD");
    await setSubjectStatus(scope, arch.id, "inactive");
    await expect(assignSubject(scope, classId, { subjectId: arch.id })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("rejects a cross-session / foreign class id (NOT_FOUND)", async () => {
    const s = await mkSubject(scope, "CS3");
    const wrongSession: OrgScope = { ...scope, academicSessionId: "nope" };
    await expect(assignSubject(wrongSession, classId, { subjectId: s.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(assignSubject(scope, "not-a-class", { subjectId: s.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("removes an assignment", async () => {
    const s = await mkSubject(scope, "CS4");
    const cs = await assignSubject(scope, classId, { subjectId: s.id });
    await removeClassSubject(scope, classId, cs.id);
    const list = await listClassSubjects(scope, classId);
    expect(list.every((x) => x.id !== cs.id)).toBe(true);
    const audit = await prisma.auditEvent.findFirst({ where: { tenantId, action: "CLASS_SUBJECT_REMOVED", entityId: cs.id } });
    expect(audit).not.toBeNull();
  });

  it("bulk reconcile is atomic: adds new, removes missing, keeps intersection", async () => {
    const a = await mkSubject(scope, "R1");
    const b = await mkSubject(scope, "R2");
    const c = await mkSubject(scope, "R3");
    await reconcileClassSubjects(scope, classId2, { subjectIds: [a.id, b.id] });
    let list = await listClassSubjects(scope, classId2);
    expect(new Set(list.map((x) => x.subjectId))).toEqual(new Set([a.id, b.id]));
    // Now reconcile to [b, c]: a removed, c added, b kept.
    const after = await reconcileClassSubjects(scope, classId2, { subjectIds: [b.id, c.id] });
    expect(new Set(after.map((x) => x.subjectId))).toEqual(new Set([b.id, c.id]));
    // A rejected (foreign) subject makes the whole reconcile fail — no partial writes.
    await expect(reconcileClassSubjects(scope, classId2, { subjectIds: [b.id, subjectB] })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    list = await listClassSubjects(scope, classId2);
    expect(new Set(list.map((x) => x.subjectId))).toEqual(new Set([b.id, c.id])); // unchanged
    const audit = await prisma.auditEvent.findFirst({ where: { tenantId, action: "CLASS_SUBJECTS_UPDATED", entityId: classId2 } });
    expect(audit).not.toBeNull();
  });

  it("Section inherits its Class's subjects via getSubjectsForSection", async () => {
    const s1 = await mkSubject(scope, "INH1");
    const s2 = await mkSubject(scope, "INH2");
    await reconcileClassSubjects(scope, classId, { subjectIds: [s1.id, s2.id] });
    const inherited = await getSubjectsForSection(scope, sectionA);
    const codes = inherited.map((x) => x.code);
    expect(codes).toContain("INH1");
    expect(codes).toContain("INH2");
    // A foreign section id is not found.
    await expect(getSubjectsForSection(scope, "nope")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("listSubjectClasses returns the classes a subject is in (session-scoped)", async () => {
    const s = await mkSubject(scope, "MULTI");
    await assignSubject(scope, classId, { subjectId: s.id });
    await assignSubject(scope, classId2, { subjectId: s.id });
    const classes = await listSubjectClasses(scope, s.id);
    expect(new Set(classes.map((c) => c.classId))).toEqual(new Set([classId, classId2]));
  });

  it("archived-but-assigned subjects survive a reconcile that keeps them (history readable)", async () => {
    const keep = await mkSubject(scope, "KEEP");
    await reconcileClassSubjects(scope, classId, { subjectIds: [keep.id] });
    await setSubjectStatus(scope, keep.id, "inactive"); // archive AFTER assignment
    // Reconcile keeping the (now archived) subject must not throw and must retain it.
    const after = await reconcileClassSubjects(scope, classId, { subjectIds: [keep.id] });
    expect(after.some((x) => x.subjectId === keep.id)).toBe(true);
  });
});
