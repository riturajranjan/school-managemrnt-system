// Homework / Assignments DB integration tests (Phase 9B). Real Postgres:
// authorship via real Staff.userId -> Staff -> TeachingAssignment (mirrors
// Phase 8B marks-entry ownership); CREATE requires the actor themselves to
// hold the TeachingAssignment (no impersonation), while broad managers
// (SCHOOL_ADMIN/PRINCIPAL) may EDIT/PUBLISH/CLOSE any homework; structural
// fields (section/subject/staff) are impossible to edit by construction;
// Draft -> Published -> Closed lifecycle; historical safety; isolation;
// concurrency; RBAC catalog; safe DTO shape; audit events. Namespaced ("T9B").
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import {
  closeHomework, createHomework, duplicateHomework, getHomework, getMyDayHomeworkSummary,
  listAssignableTeaching, listHomework, listMyHomework, publishHomework, updateHomework,
} from "@/lib/server/homework/service";
import type { OrgScope } from "@/lib/server/api/scope";
import { ROLE_PERMISSIONS } from "@/lib/server/authz/catalog";

let dbReady = false;
try {
  dbReady = Boolean(await prisma.role.findFirst({ where: { key: "SCHOOL_ADMIN", isSystem: true } }));
} catch {
  dbReady = false;
}

const NS = "T9B";
const stamp = Date.now().toString(36);

let tenantId = "", schoolId = "", branchA = "", sessionId = "", classId = "", subjectId = "", subjectId2 = "";
let staff1 = "", staff2 = "";
let scopeAdmin: OrgScope, scopeTeacher1: OrgScope, scopeTeacher2: OrgScope;
let adminUser = "", teacher1User = "", teacher2User = "";
let sectionSeq = 0;

async function makeUserWithRole(email: string, roleKey: string): Promise<string> {
  const u = await prisma.user.create({ data: { email, name: email, status: "ACTIVE" }, select: { id: true } });
  const m = await prisma.tenantMembership.create({ data: { userId: u.id, tenantId, status: "ACTIVE" }, select: { id: true } });
  const role = await prisma.role.findFirstOrThrow({ where: { key: roleKey, isSystem: true }, select: { id: true } });
  await prisma.roleAssignment.create({ data: { membershipId: m.id, roleId: role.id } });
  return u.id;
}

/** Fresh Section + a real TeachingAssignment for staff1/teacher1 on subjectId,
 *  plus a few enrolled students, so unrelated test cases never collide. */
async function mkSection(opts: { withSubject?: boolean; extraStudents?: number } = {}) {
  sectionSeq += 1;
  const section = (await prisma.section.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, classId, name: `F${sectionSeq}`, status: "ACTIVE" }, select: { id: true, branchId: true } }));
  if (opts.withSubject !== false) {
    await prisma.classSubject.upsert({ where: { classId_subjectId: { classId, subjectId } }, update: {}, create: { tenantId, schoolId, academicSessionId: sessionId, classId, subjectId } });
  }
  const assignment = await prisma.teachingAssignment.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, sectionId: section.id, subjectId, staffId: staff1 }, select: { id: true } });
  const enrolled: { studentId: string; enrollmentId: string }[] = [];
  for (let i = 0; i < (opts.extraStudents ?? 2); i++) {
    const k = String.fromCharCode(97 + i);
    const sid = (await prisma.student.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, admissionNumber: `${NS}-${stamp}-${sectionSeq}${k}`, firstName: k.toUpperCase(), lastName: "T", dateOfBirth: new Date("2015-01-01"), admissionDate: new Date("2024-04-01"), status: "ACTIVE" }, select: { id: true } })).id;
    const en = await prisma.enrollment.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, classId, sectionId: section.id, studentId: sid, status: "ENROLLED" }, select: { id: true } });
    enrolled.push({ studentId: sid, enrollmentId: en.id });
  }
  return { section, assignment, enrolled };
}

beforeAll(async () => {
  if (!dbReady) return;
  tenantId = (await prisma.tenant.create({ data: { name: `${NS} T`, slug: `t9b-${stamp}` }, select: { id: true } })).id;
  schoolId = (await prisma.school.create({ data: { tenantId, name: `${NS} S`, code: `${NS}-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  branchA = (await prisma.branch.create({ data: { schoolId, name: "A", code: `${NS}-A`, status: "ACTIVE" }, select: { id: true } })).id;
  sessionId = (await prisma.academicSession.create({ data: { schoolId, name: "26-27", code: `${NS}-S`, startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31"), status: "ACTIVE" }, select: { id: true } })).id;
  classId = (await prisma.class.create({ data: { tenantId, schoolId, academicSessionId: sessionId, name: "Grade 5", order: 5 }, select: { id: true } })).id;
  subjectId = (await prisma.subject.create({ data: { tenantId, schoolId, code: `${NS}-M`, name: "Math", shortName: "M", department: "Math", type: "CORE", maxMarks: 100, passingMarks: 33, theoryMarks: 100, practicalMarks: 0 }, select: { id: true } })).id;
  subjectId2 = (await prisma.subject.create({ data: { tenantId, schoolId, code: `${NS}-E`, name: "English", shortName: "E", department: "Lang", type: "CORE", maxMarks: 100, passingMarks: 33, theoryMarks: 100, practicalMarks: 0 }, select: { id: true } })).id; // deliberately NOT offered to classId (not in classSubject)
  staff1 = (await prisma.staff.create({ data: { tenantId, schoolId, branchId: branchA, employeeCode: `${NS}-T1`, firstName: "Tara", isTeaching: true, status: "ACTIVE" }, select: { id: true } })).id;
  staff2 = (await prisma.staff.create({ data: { tenantId, schoolId, branchId: branchA, employeeCode: `${NS}-T2`, firstName: "Ravi", isTeaching: true, status: "ACTIVE" }, select: { id: true } })).id;

  adminUser = await makeUserWithRole(`t9b-admin-${stamp}@x.test`, "SCHOOL_ADMIN");
  teacher1User = await makeUserWithRole(`t9b-t1-${stamp}@x.test`, "TEACHER");
  teacher2User = await makeUserWithRole(`t9b-t2-${stamp}@x.test`, "TEACHER");
  await prisma.staff.update({ where: { id: staff1 }, data: { userId: teacher1User } });
  await prisma.staff.update({ where: { id: staff2 }, data: { userId: teacher2User } });

  scopeAdmin = { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, actor: { id: adminUser, name: "Admin" } };
  scopeTeacher1 = { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, actor: { id: teacher1User, name: "T1" } };
  scopeTeacher2 = { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, actor: { id: teacher2User, name: "T2" } };
});

afterAll(async () => {
  if (!dbReady || !tenantId) return;
  await prisma.auditEvent.deleteMany({ where: { tenantId } });
  await prisma.staff.updateMany({ where: { tenantId }, data: { userId: null } });
  await prisma.user.deleteMany({ where: { id: { in: [adminUser, teacher1User, teacher2User] } } });
  await prisma.tenant.delete({ where: { id: tenantId } });
});

describe.skipIf(!dbReady)("create validation (DB)", () => {
  it("creates a DRAFT homework for the assigned teacher", async () => {
    const { section } = await mkSection();
    const hw = await createHomework(scopeTeacher1, { sectionId: section.id, subjectId, title: "Worksheet 1", description: "Do the worksheet.", dueAt: "2026-08-25" });
    expect(hw.status).toBe("draft");
    expect(hw.section.id).toBe(section.id);
    expect(hw.subject.id).toBe(subjectId);
    expect(hw.teacher.name).toContain("Tara");
  });

  it("TEACHER_NOT_ASSIGNED: the actor has no real teaching Staff profile at all", async () => {
    const { section } = await mkSection();
    await expect(createHomework(scopeAdmin, { sectionId: section.id, subjectId, title: "X", description: "Y", dueAt: "2026-08-25" })).rejects.toMatchObject({ code: "TEACHER_NOT_ASSIGNED" });
  });

  it("NOT_FOUND: a foreign/nonexistent section is rejected", async () => {
    await expect(createHomework(scopeTeacher1, { sectionId: "nonexistent-id", subjectId, title: "X", description: "Y", dueAt: "2026-08-25" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("SUBJECT_NOT_OFFERED: subject not on the section's class ClassSubject list is rejected", async () => {
    const { section } = await mkSection();
    await expect(createHomework(scopeTeacher1, { sectionId: section.id, subjectId: subjectId2, title: "X", description: "Y", dueAt: "2026-08-25" })).rejects.toMatchObject({ code: "SUBJECT_NOT_OFFERED" });
  });

  it("TEACHER_NOT_ASSIGNED: a teacher with no TeachingAssignment on this section+subject is rejected", async () => {
    const { section } = await mkSection();
    await expect(createHomework(scopeTeacher2, { sectionId: section.id, subjectId, title: "X", description: "Y", dueAt: "2026-08-25" })).rejects.toMatchObject({ code: "TEACHER_NOT_ASSIGNED" });
  });

  it("VALIDATION_ERROR: an invalid dueAt shape is rejected", async () => {
    const { section } = await mkSection();
    await expect(createHomework(scopeTeacher1, { sectionId: section.id, subjectId, title: "X", description: "Y", dueAt: "not-a-date" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("VALIDATION_ERROR: an empty title is rejected", async () => {
    const { section } = await mkSection();
    await expect(createHomework(scopeTeacher1, { sectionId: section.id, subjectId, title: "", description: "Y", dueAt: "2026-08-25" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});

describe.skipIf(!dbReady)("listAssignableTeaching (DB)", () => {
  it("returns only the actor's own real TeachingAssignments", async () => {
    const { section } = await mkSection();
    const rows = await listAssignableTeaching(scopeTeacher1);
    expect(rows.some((r) => r.section.id === section.id && r.subject.id === subjectId)).toBe(true);
    const rows2 = await listAssignableTeaching(scopeTeacher2);
    expect(rows2.some((r) => r.section.id === section.id)).toBe(false);
  });

  it("empty for an actor with no real teaching Staff profile", async () => {
    const rows = await listAssignableTeaching(scopeAdmin);
    expect(rows).toEqual([]);
  });
});

describe.skipIf(!dbReady)("update: structural fields are impossible, not merely rejected (DB)", () => {
  it("edits title/description/dueAt on a DRAFT", async () => {
    const { section } = await mkSection();
    const hw = await createHomework(scopeTeacher1, { sectionId: section.id, subjectId, title: "Draft A", description: "First.", dueAt: "2026-08-25" });
    const updated = await updateHomework(scopeTeacher1, hw.id, { title: "Draft A revised", dueAt: "2026-08-26" });
    expect(updated.title).toBe("Draft A revised");
    expect(updated.dueAt).toBe("2026-08-26");
  });

  it("extra section/subject/staff keys in the request body are silently stripped, never applied", async () => {
    const { section } = await mkSection();
    const other = await mkSection();
    const hw = await createHomework(scopeTeacher1, { sectionId: section.id, subjectId, title: "Draft B", description: "First.", dueAt: "2026-08-25" });
    const updated = await updateHomework(scopeTeacher1, hw.id, { title: "Still B", sectionId: other.section.id, subjectId: subjectId2, staffId: staff2 } as never);
    expect(updated.section.id).toBe(section.id);
    expect(updated.subject.id).toBe(subjectId);
    expect(updated.teacher.name).toContain("Tara");
  });

  it("FORBIDDEN: a different teacher cannot edit another teacher's homework", async () => {
    const { section } = await mkSection();
    const hw = await createHomework(scopeTeacher1, { sectionId: section.id, subjectId, title: "Draft C", description: "First.", dueAt: "2026-08-25" });
    await expect(updateHomework(scopeTeacher2, hw.id, { title: "Hijacked" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("SCHOOL_ADMIN (broad manager) may edit any teacher's homework", async () => {
    const { section } = await mkSection();
    const hw = await createHomework(scopeTeacher1, { sectionId: section.id, subjectId, title: "Draft D", description: "First.", dueAt: "2026-08-25" });
    const updated = await updateHomework(scopeAdmin, hw.id, { title: "Admin edited" });
    expect(updated.title).toBe("Admin edited");
  });
});

describe.skipIf(!dbReady)("lifecycle: draft -> published -> closed (DB)", () => {
  it("publish only from DRAFT; re-publishing is rejected as HOMEWORK_ALREADY_PUBLISHED", async () => {
    const { section } = await mkSection();
    const hw = await createHomework(scopeTeacher1, { sectionId: section.id, subjectId, title: "Pub A", description: "d", dueAt: "2026-08-25" });
    const published = await publishHomework(scopeTeacher1, hw.id);
    expect(published.status).toBe("published");
    await expect(publishHomework(scopeTeacher1, hw.id)).rejects.toMatchObject({ code: "HOMEWORK_ALREADY_PUBLISHED" });
  });

  it("close only from PUBLISHED; closing a DRAFT is rejected", async () => {
    const { section } = await mkSection();
    const hw = await createHomework(scopeTeacher1, { sectionId: section.id, subjectId, title: "Close A", description: "d", dueAt: "2026-08-25" });
    await expect(closeHomework(scopeTeacher1, hw.id)).rejects.toMatchObject({ code: "CONFLICT" });
    await publishHomework(scopeTeacher1, hw.id);
    const closed = await closeHomework(scopeTeacher1, hw.id);
    expect(closed.status).toBe("closed");
    await expect(closeHomework(scopeTeacher1, hw.id)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("FORBIDDEN: a different teacher cannot publish/close another teacher's homework", async () => {
    const { section } = await mkSection();
    const hw = await createHomework(scopeTeacher1, { sectionId: section.id, subjectId, title: "Pub B", description: "d", dueAt: "2026-08-25" });
    await expect(publishHomework(scopeTeacher2, hw.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("SCHOOL_ADMIN may publish/close any teacher's homework", async () => {
    const { section } = await mkSection();
    const hw = await createHomework(scopeTeacher1, { sectionId: section.id, subjectId, title: "Pub C", description: "d", dueAt: "2026-08-25" });
    const published = await publishHomework(scopeAdmin, hw.id);
    expect(published.status).toBe("published");
    const closed = await closeHomework(scopeAdmin, hw.id);
    expect(closed.status).toBe("closed");
  });
});

describe.skipIf(!dbReady)("duplicate (DB)", () => {
  it("preserves the ORIGINAL section/subject/staff — not the duplicating actor's own", async () => {
    const { section } = await mkSection();
    const hw = await createHomework(scopeTeacher1, { sectionId: section.id, subjectId, title: "Dup source", description: "d", dueAt: "2026-08-25" });
    await publishHomework(scopeTeacher1, hw.id);
    const copy = await duplicateHomework(scopeAdmin, hw.id); // admin has no Staff/TeachingAssignment of their own
    expect(copy.status).toBe("draft");
    expect(copy.section.id).toBe(section.id);
    expect(copy.subject.id).toBe(subjectId);
    expect(copy.teacher.name).toContain("Tara"); // still the original teacher, not "Admin"
    expect(copy.title).toBe("Dup source (copy)");
    expect(copy.id).not.toBe(hw.id);
  });

  it("FORBIDDEN: a different teacher cannot duplicate another teacher's homework", async () => {
    const { section } = await mkSection();
    const hw = await createHomework(scopeTeacher1, { sectionId: section.id, subjectId, title: "Dup source 2", description: "d", dueAt: "2026-08-25" });
    await expect(duplicateHomework(scopeTeacher2, hw.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe.skipIf(!dbReady)("historical safety (DB)", () => {
  it("Subject archive/rename does not alter an already-created homework's subject reference", async () => {
    const { section } = await mkSection();
    const hw = await createHomework(scopeTeacher1, { sectionId: section.id, subjectId, title: "Hist A", description: "d", dueAt: "2026-08-25" });
    await prisma.subject.update({ where: { id: subjectId }, data: { name: "Renamed Math", status: "ARCHIVED" } });
    const fetched = await getHomework(scopeAdmin, hw.id);
    expect(fetched.subject.id).toBe(subjectId);
    expect(fetched.subject.name).toBe("Renamed Math"); // live join, not a snapshot — subject identity unaffected by archive
    await prisma.subject.update({ where: { id: subjectId }, data: { name: "Math", status: "ACTIVE" } });
  });

  it("Staff going INACTIVE does not remove already-created homework", async () => {
    const { section } = await mkSection();
    const hw = await createHomework(scopeTeacher1, { sectionId: section.id, subjectId, title: "Hist B", description: "d", dueAt: "2026-08-25" });
    await prisma.staff.update({ where: { id: staff1 }, data: { status: "INACTIVE" } });
    const fetched = await getHomework(scopeAdmin, hw.id);
    expect(fetched.id).toBe(hw.id);
    await prisma.staff.update({ where: { id: staff1 }, data: { status: "ACTIVE" } });
  });

  it("a student unenrolled after publish does not break the homework; studentCount reflects currently-enrolled only", async () => {
    const { section, enrolled } = await mkSection({ extraStudents: 3 });
    const hw = await createHomework(scopeTeacher1, { sectionId: section.id, subjectId, title: "Hist C", description: "d", dueAt: "2026-08-25" });
    const before = await getHomework(scopeAdmin, hw.id);
    expect(before.studentCount).toBe(3);
    await prisma.enrollment.update({ where: { id: enrolled[0].enrollmentId }, data: { status: "WITHDRAWN" } });
    const after = await getHomework(scopeAdmin, hw.id);
    expect(after.id).toBe(hw.id);
    expect(after.studentCount).toBe(2);
  });

  it("removing the TeachingAssignment referenced by an existing homework is blocked (Restrict FK)", async () => {
    const { section, assignment } = await mkSection();
    await createHomework(scopeTeacher1, { sectionId: section.id, subjectId, title: "Hist D", description: "d", dueAt: "2026-08-25" });
    await expect(prisma.teachingAssignment.delete({ where: { id: assignment.id } })).rejects.toThrow();
  });
});

describe.skipIf(!dbReady)("isolation (DB)", () => {
  it("a foreign school's scope cannot see this school's homework", async () => {
    const { section } = await mkSection();
    const hw = await createHomework(scopeTeacher1, { sectionId: section.id, subjectId, title: "Iso A", description: "d", dueAt: "2026-08-25" });
    const foreignSchool = (await prisma.school.create({ data: { tenantId, name: `${NS} SB`, code: `${NS}-SB-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
    const foreignBranch = (await prisma.branch.create({ data: { schoolId: foreignSchool, name: "B", code: `${NS}-BB`, status: "ACTIVE" }, select: { id: true } })).id;
    const foreignSession = (await prisma.academicSession.create({ data: { schoolId: foreignSchool, name: "26-27", code: `${NS}-SBS`, startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31"), status: "ACTIVE" }, select: { id: true } })).id;
    const scopeForeign: OrgScope = { tenantId, schoolId: foreignSchool, branchId: foreignBranch, academicSessionId: foreignSession, actor: { id: adminUser, name: "Admin" } };
    await expect(getHomework(scopeForeign, hw.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("list is scoped to the school+session — a homework row from another session never appears", async () => {
    const { section } = await mkSection();
    const hw = await createHomework(scopeTeacher1, { sectionId: section.id, subjectId, title: `Iso B ${stamp}`, description: "d", dueAt: "2026-08-25" });
    const otherSession = (await prisma.academicSession.create({ data: { schoolId, name: "27-28", code: `${NS}-S2`, startDate: new Date("2027-04-01"), endDate: new Date("2028-03-31"), status: "ACTIVE" }, select: { id: true } })).id;
    const scopeOtherSession: OrgScope = { tenantId, schoolId, branchId: branchA, academicSessionId: otherSession, actor: { id: adminUser, name: "Admin" } };
    const { data } = await listHomework(scopeOtherSession, {});
    expect(data.some((h) => h.id === hw.id)).toBe(false);
  });
});

describe.skipIf(!dbReady)("list / mine / My Day summary (DB)", () => {
  it("listMyHomework returns only the caller's own homework, resolved server-side via real Staff.id", async () => {
    const { section: s1 } = await mkSection();
    const hw1 = await createHomework(scopeTeacher1, { sectionId: s1.id, subjectId, title: `Mine A ${stamp}`, description: "d", dueAt: "2026-08-25" });
    const { data } = await listMyHomework(scopeTeacher1, {});
    expect(data.some((h) => h.id === hw1.id)).toBe(true);
    const { data: teacher2Data } = await listMyHomework(scopeTeacher2, {});
    expect(teacher2Data.some((h) => h.id === hw1.id)).toBe(false);
  });

  it("listMyHomework is empty (not an error) for an actor with no real Staff profile", async () => {
    const { data, meta } = await listMyHomework(scopeAdmin, {});
    expect(data).toEqual([]);
    expect(meta.total).toBe(0);
  });

  it("getMyDayHomeworkSummary reports draftCount + dueTodayOrOverdue + a bounded items list", async () => {
    const { section } = await mkSection();
    const draft = await createHomework(scopeTeacher1, { sectionId: section.id, subjectId, title: `MyDay Draft ${stamp}`, description: "d", dueAt: "2026-08-30" });
    const overdue = await createHomework(scopeTeacher1, { sectionId: section.id, subjectId, title: `MyDay Overdue ${stamp}`, description: "d", dueAt: "2026-08-01" });
    await publishHomework(scopeTeacher1, overdue.id);
    const summary = await getMyDayHomeworkSummary(scopeTeacher1, staff1, "2026-08-15");
    expect(summary.draftCount).toBeGreaterThanOrEqual(1);
    expect(summary.dueTodayOrOverdueCount).toBeGreaterThanOrEqual(1);
    expect(summary.items.some((i) => i.id === overdue.id)).toBe(true);
    expect(summary.items.every((i) => i.status === "published")).toBe(true);
    expect(draft.status).toBe("draft"); // sanity: the draft itself was never auto-published
  });
});

describe.skipIf(!dbReady)("concurrency (DB)", () => {
  it("two concurrent publish calls: exactly one succeeds, the other fails safely", async () => {
    const { section } = await mkSection();
    const hw = await createHomework(scopeTeacher1, { sectionId: section.id, subjectId, title: `Race ${stamp}`, description: "d", dueAt: "2026-08-25" });
    const results = await Promise.allSettled([publishHomework(scopeTeacher1, hw.id), publishHomework(scopeTeacher1, hw.id)]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
    if (rejected[0]?.status === "rejected") expect((rejected[0].reason as { code?: string }).code).toBe("HOMEWORK_ALREADY_PUBLISHED");
    const row = await prisma.homework.findUniqueOrThrow({ where: { id: hw.id }, select: { status: true } });
    expect(row.status).toBe("PUBLISHED");
  });
});

describe.skipIf(!dbReady)("audit events (DB)", () => {
  it("records HOMEWORK_CREATED, HOMEWORK_UPDATED, HOMEWORK_PUBLISHED, HOMEWORK_CLOSED", async () => {
    const { section } = await mkSection();
    const hw = await createHomework(scopeTeacher1, { sectionId: section.id, subjectId, title: `Audit ${stamp}`, description: "d", dueAt: "2026-08-25" });
    await updateHomework(scopeTeacher1, hw.id, { title: `Audit ${stamp} v2` });
    await publishHomework(scopeTeacher1, hw.id);
    await closeHomework(scopeTeacher1, hw.id);
    const events = await prisma.auditEvent.findMany({ where: { tenantId, entityType: "Homework", entityId: hw.id }, select: { action: true } });
    const actions = events.map((e) => e.action).sort();
    expect(actions).toEqual(["HOMEWORK_CLOSED", "HOMEWORK_CREATED", "HOMEWORK_PUBLISHED", "HOMEWORK_UPDATED"]);
  });
});

describe.skipIf(!dbReady)("RBAC + DTO safety (DB)", () => {
  it("homework.view/homework.manage: SCHOOL_ADMIN, PRINCIPAL, TEACHER all granted", () => {
    for (const role of ["SCHOOL_ADMIN", "PRINCIPAL", "TEACHER"] as const) {
      expect(ROLE_PERMISSIONS[role]).toContain("homework.view");
      expect(ROLE_PERMISSIONS[role]).toContain("homework.manage");
    }
  });

  it("list item DTO exposes only safe display fields", async () => {
    const { section } = await mkSection();
    const hw = await createHomework(scopeTeacher1, { sectionId: section.id, subjectId, title: `DTO ${stamp}`, description: "d", dueAt: "2026-08-25" });
    const { data } = await listHomework(scopeAdmin, {});
    const item = data.find((h) => h.id === hw.id)!;
    expect(Object.keys(item).sort()).toEqual(["createdAt", "dueAt", "id", "section", "status", "studentCount", "subject", "teacher", "title", "updatedAt"]);
  });

  it("detail DTO adds only description/instructions on top of the list shape", async () => {
    const { section } = await mkSection();
    const hw = await createHomework(scopeTeacher1, { sectionId: section.id, subjectId, title: `DTO2 ${stamp}`, description: "d", instructions: "bring a pencil", dueAt: "2026-08-25" });
    const detail = await getHomework(scopeAdmin, hw.id);
    expect(Object.keys(detail).sort()).toEqual(["createdAt", "description", "dueAt", "id", "instructions", "section", "status", "studentCount", "subject", "teacher", "title", "updatedAt"]);
  });
});
