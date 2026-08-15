// Lesson Plans DB integration tests (Phase 9C.2). Real Postgres: authorship
// via real Staff.userId -> Staff -> TeachingAssignment (mirrors Phase 9B
// homework ownership exactly); CREATE requires the actor themselves to hold
// the TeachingAssignment; broad managers (SCHOOL_ADMIN/PRINCIPAL) may EDIT/
// APPROVE/REJECT/COMPLETE/DUPLICATE any teacher's plan; structural fields
// (section/subject/staff) are impossible to edit by construction; topic
// linkage validated against the real ACTIVE curriculum for this section's
// class+subject; Draft -> Submitted -> Approved/Rejected -> Completed
// lifecycle; historical safety; isolation; RBAC; safe DTO shape; audit
// events; real "My Day" lookup. Namespaced ("T9C2").
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import {
  approveLessonPlan, completeLessonPlan, createLessonPlan, duplicateLessonPlan, getLessonPlan, getMyDayLessonPlanSummary,
  listLessonPlans, listMyLessonPlans, rejectLessonPlan, submitLessonPlan, updateLessonPlan,
} from "@/lib/server/lesson-plans/service";
import { createCurriculum, changeCurriculumStatus, createChapter, createTopic, createUnit } from "@/lib/server/curriculum/service";
import type { OrgScope } from "@/lib/server/api/scope";
import { ROLE_PERMISSIONS } from "@/lib/server/authz/catalog";

let dbReady = false;
try {
  dbReady = Boolean(await prisma.role.findFirst({ where: { key: "SCHOOL_ADMIN", isSystem: true } }));
} catch {
  dbReady = false;
}

const NS = "T9C2";
const stamp = Date.now().toString(36);

let tenantId = "", schoolId = "", branchA = "", sessionId = "", classId = "", subjectId = "", subjectId2 = "";
let staff1 = "", staff2 = "";
let scopeAdmin: OrgScope, scopeTeacher1: OrgScope, scopeTeacher2: OrgScope;
let adminUser = "", teacher1User = "", teacher2User = "";
let sectionSeq = 0;
let topicId1 = "", topicId2 = "", foreignTopicId = "";

async function makeUserWithRole(email: string, roleKey: string): Promise<string> {
  const u = await prisma.user.create({ data: { email, name: email, status: "ACTIVE" }, select: { id: true } });
  const m = await prisma.tenantMembership.create({ data: { userId: u.id, tenantId, status: "ACTIVE" }, select: { id: true } });
  const role = await prisma.role.findFirstOrThrow({ where: { key: roleKey, isSystem: true }, select: { id: true } });
  await prisma.roleAssignment.create({ data: { membershipId: m.id, roleId: role.id } });
  return u.id;
}

/** Fresh Section + real TeachingAssignment for staff1/teacher1 on subjectId. */
async function mkSection() {
  sectionSeq += 1;
  const section = await prisma.section.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, classId, name: `F${sectionSeq}`, status: "ACTIVE" }, select: { id: true, branchId: true } });
  await prisma.teachingAssignment.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, sectionId: section.id, subjectId, staffId: staff1 } });
  return section;
}

beforeAll(async () => {
  if (!dbReady) return;
  tenantId = (await prisma.tenant.create({ data: { name: `${NS} T`, slug: `t9c2-${stamp}` }, select: { id: true } })).id;
  schoolId = (await prisma.school.create({ data: { tenantId, name: `${NS} S`, code: `${NS}-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  branchA = (await prisma.branch.create({ data: { schoolId, name: "A", code: `${NS}-A`, status: "ACTIVE" }, select: { id: true } })).id;
  sessionId = (await prisma.academicSession.create({ data: { schoolId, name: "26-27", code: `${NS}-S`, startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31"), status: "ACTIVE" }, select: { id: true } })).id;
  classId = (await prisma.class.create({ data: { tenantId, schoolId, academicSessionId: sessionId, name: "Grade 5", order: 5 }, select: { id: true } })).id;
  subjectId = (await prisma.subject.create({ data: { tenantId, schoolId, code: `${NS}-M`, name: "Math", shortName: "M", department: "Math", type: "CORE", maxMarks: 100, passingMarks: 33, theoryMarks: 100, practicalMarks: 0 }, select: { id: true } })).id;
  subjectId2 = (await prisma.subject.create({ data: { tenantId, schoolId, code: `${NS}-E`, name: "English", shortName: "E", department: "Lang", type: "CORE", maxMarks: 100, passingMarks: 33, theoryMarks: 100, practicalMarks: 0 }, select: { id: true } })).id; // deliberately NOT offered
  await prisma.classSubject.create({ data: { tenantId, schoolId, academicSessionId: sessionId, classId, subjectId } });
  staff1 = (await prisma.staff.create({ data: { tenantId, schoolId, branchId: branchA, employeeCode: `${NS}-T1`, firstName: "Tara", isTeaching: true, status: "ACTIVE" }, select: { id: true } })).id;
  staff2 = (await prisma.staff.create({ data: { tenantId, schoolId, branchId: branchA, employeeCode: `${NS}-T2`, firstName: "Ravi", isTeaching: true, status: "ACTIVE" }, select: { id: true } })).id;

  adminUser = await makeUserWithRole(`t9c2-admin-${stamp}@x.test`, "SCHOOL_ADMIN");
  teacher1User = await makeUserWithRole(`t9c2-t1-${stamp}@x.test`, "TEACHER");
  teacher2User = await makeUserWithRole(`t9c2-t2-${stamp}@x.test`, "TEACHER");
  await prisma.staff.update({ where: { id: staff1 }, data: { userId: teacher1User } });
  await prisma.staff.update({ where: { id: staff2 }, data: { userId: teacher2User } });

  scopeAdmin = { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, actor: { id: adminUser, name: "Admin" } };
  scopeTeacher1 = { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, actor: { id: teacher1User, name: "T1" } };
  scopeTeacher2 = { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, actor: { id: teacher2User, name: "T2" } };

  // Real ACTIVE curriculum with 2 topics for this class+subject.
  const curriculum = await createCurriculum(scopeAdmin, { classId, subjectId, title: "Syllabus" });
  const withUnit = await createUnit(scopeAdmin, curriculum.id, { title: "Unit A" });
  const withChapter = await createChapter(scopeAdmin, withUnit.units[0].id, { title: "Chapter 1" });
  const withTopics1 = await createTopic(scopeAdmin, withChapter.units[0].chapters[0].id, { title: "Topic 1" });
  const withTopics2 = await createTopic(scopeAdmin, withChapter.units[0].chapters[0].id, { title: "Topic 2" });
  topicId1 = withTopics1.units[0].chapters[0].topics[0].id;
  topicId2 = withTopics2.units[0].chapters[0].topics.find((t) => t.title === "Topic 2")!.id;
  await changeCurriculumStatus(scopeAdmin, curriculum.id, { status: "active" });

  // A topic that exists but belongs to a DIFFERENT (unrelated) curriculum.
  const freshClass = (await prisma.class.create({ data: { tenantId, schoolId, academicSessionId: sessionId, name: `Foreign ${stamp}`, order: 50 }, select: { id: true } })).id;
  await prisma.classSubject.create({ data: { tenantId, schoolId, academicSessionId: sessionId, classId: freshClass, subjectId } });
  const foreignCurriculum = await createCurriculum(scopeAdmin, { classId: freshClass, subjectId, title: "Foreign syllabus" });
  const foreignUnit = await createUnit(scopeAdmin, foreignCurriculum.id, { title: "Unit X" });
  const foreignChapter = await createChapter(scopeAdmin, foreignUnit.units[0].id, { title: "Chapter X" });
  const foreignTopic = await createTopic(scopeAdmin, foreignChapter.units[0].chapters[0].id, { title: "Foreign Topic" });
  foreignTopicId = foreignTopic.units[0].chapters[0].topics[0].id;
  await changeCurriculumStatus(scopeAdmin, foreignCurriculum.id, { status: "active" });
});

afterAll(async () => {
  if (!dbReady || !tenantId) return;
  await prisma.auditEvent.deleteMany({ where: { tenantId } });
  await prisma.staff.updateMany({ where: { tenantId }, data: { userId: null } });
  await prisma.user.deleteMany({ where: { id: { in: [adminUser, teacher1User, teacher2User] } } });
  await prisma.tenant.delete({ where: { id: tenantId } });
});

describe.skipIf(!dbReady)("create validation (DB)", () => {
  it("creates a DRAFT lesson plan for the assigned teacher, with real topic links", async () => {
    const { id: sectionId } = await mkSection();
    const plan = await createLessonPlan(scopeTeacher1, { sectionId, subjectId, title: "Plan A", learningObjective: "Understand X", teachingMethod: "Lecture", plannedDate: "2026-08-25", topicIds: [topicId1, topicId2] });
    expect(plan.status).toBe("draft");
    expect(plan.section.id).toBe(sectionId);
    expect(plan.topics.map((t) => t.id).sort()).toEqual([topicId1, topicId2].sort());
  });

  it("TEACHER_NOT_ASSIGNED: the actor has no real teaching Staff profile at all", async () => {
    const { id: sectionId } = await mkSection();
    await expect(createLessonPlan(scopeAdmin, { sectionId, subjectId, title: "X", learningObjective: "Y", teachingMethod: "Z", plannedDate: "2026-08-25" })).rejects.toMatchObject({ code: "TEACHER_NOT_ASSIGNED" });
  });

  it("NOT_FOUND: a foreign/nonexistent section is rejected", async () => {
    await expect(createLessonPlan(scopeTeacher1, { sectionId: "nonexistent", subjectId, title: "X", learningObjective: "Y", teachingMethod: "Z", plannedDate: "2026-08-25" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("SUBJECT_NOT_OFFERED: subject not on the section's class ClassSubject list is rejected", async () => {
    const { id: sectionId } = await mkSection();
    await expect(createLessonPlan(scopeTeacher1, { sectionId, subjectId: subjectId2, title: "X", learningObjective: "Y", teachingMethod: "Z", plannedDate: "2026-08-25" })).rejects.toMatchObject({ code: "SUBJECT_NOT_OFFERED" });
  });

  it("TEACHER_NOT_ASSIGNED: a teacher with no TeachingAssignment on this section+subject is rejected", async () => {
    const { id: sectionId } = await mkSection();
    await expect(createLessonPlan(scopeTeacher2, { sectionId, subjectId, title: "X", learningObjective: "Y", teachingMethod: "Z", plannedDate: "2026-08-25" })).rejects.toMatchObject({ code: "TEACHER_NOT_ASSIGNED" });
  });

  it("INVALID_TOPIC: a topic belonging to a different curriculum is rejected", async () => {
    const { id: sectionId } = await mkSection();
    await expect(createLessonPlan(scopeTeacher1, { sectionId, subjectId, title: "X", learningObjective: "Y", teachingMethod: "Z", plannedDate: "2026-08-25", topicIds: [foreignTopicId] })).rejects.toMatchObject({ code: "INVALID_TOPIC" });
  });

  it("VALIDATION_ERROR: an invalid plannedDate shape is rejected", async () => {
    const { id: sectionId } = await mkSection();
    await expect(createLessonPlan(scopeTeacher1, { sectionId, subjectId, title: "X", learningObjective: "Y", teachingMethod: "Z", plannedDate: "not-a-date" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});

describe.skipIf(!dbReady)("update: structural fields are impossible, not merely rejected (DB)", () => {
  it("edits content on a DRAFT", async () => {
    const { id: sectionId } = await mkSection();
    const plan = await createLessonPlan(scopeTeacher1, { sectionId, subjectId, title: "Draft A", learningObjective: "d", teachingMethod: "m", plannedDate: "2026-08-25" });
    const updated = await updateLessonPlan(scopeTeacher1, plan.id, { title: "Draft A revised", plannedDate: "2026-08-26" });
    expect(updated.title).toBe("Draft A revised");
    expect(updated.plannedDate).toBe("2026-08-26");
  });

  it("extra section/subject/staff keys in the request body are silently stripped, never applied", async () => {
    const { id: sectionId } = await mkSection();
    const other = await mkSection();
    const plan = await createLessonPlan(scopeTeacher1, { sectionId, subjectId, title: "Draft B", learningObjective: "d", teachingMethod: "m", plannedDate: "2026-08-25" });
    const updated = await updateLessonPlan(scopeTeacher1, plan.id, { title: "Still B", sectionId: other.id, subjectId: subjectId2, staffId: staff2 } as never);
    expect(updated.section.id).toBe(sectionId);
    expect(updated.subject.id).toBe(subjectId);
    expect(updated.teacher.name).toContain("Tara");
  });

  it("FORBIDDEN: a different teacher cannot edit another teacher's plan", async () => {
    const { id: sectionId } = await mkSection();
    const plan = await createLessonPlan(scopeTeacher1, { sectionId, subjectId, title: "Draft C", learningObjective: "d", teachingMethod: "m", plannedDate: "2026-08-25" });
    await expect(updateLessonPlan(scopeTeacher2, plan.id, { title: "Hijacked" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("CONFLICT: a SUBMITTED/APPROVED/COMPLETED plan cannot be edited", async () => {
    const { id: sectionId } = await mkSection();
    const plan = await createLessonPlan(scopeTeacher1, { sectionId, subjectId, title: "Draft D", learningObjective: "d", teachingMethod: "m", plannedDate: "2026-08-25" });
    await submitLessonPlan(scopeTeacher1, plan.id);
    await expect(updateLessonPlan(scopeTeacher1, plan.id, { title: "Nope" })).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe.skipIf(!dbReady)("lifecycle: draft -> submitted -> approved/rejected -> completed (DB)", () => {
  it("submit only from DRAFT; approve/complete only by broad managers where applicable", async () => {
    const { id: sectionId } = await mkSection();
    const plan = await createLessonPlan(scopeTeacher1, { sectionId, subjectId, title: "Life A", learningObjective: "d", teachingMethod: "m", plannedDate: "2026-08-25" });
    const submitted = await submitLessonPlan(scopeTeacher1, plan.id);
    expect(submitted.status).toBe("submitted");
    await expect(submitLessonPlan(scopeTeacher1, plan.id)).rejects.toMatchObject({ code: "CONFLICT" });
    const approved = await approveLessonPlan(scopeAdmin, plan.id);
    expect(approved.status).toBe("approved");
    const completed = await completeLessonPlan(scopeTeacher1, plan.id);
    expect(completed.status).toBe("completed");
  });

  it("FORBIDDEN: a teacher cannot approve/reject (broad-manager only)", async () => {
    const { id: sectionId } = await mkSection();
    const plan = await createLessonPlan(scopeTeacher1, { sectionId, subjectId, title: "Life B", learningObjective: "d", teachingMethod: "m", plannedDate: "2026-08-25" });
    await submitLessonPlan(scopeTeacher1, plan.id);
    await expect(approveLessonPlan(scopeTeacher1, plan.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(rejectLessonPlan(scopeTeacher1, plan.id, { comment: "no" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("reject requires a comment, resets to REJECTED, and edit+resubmit clears it back to DRAFT then SUBMITTED", async () => {
    const { id: sectionId } = await mkSection();
    const plan = await createLessonPlan(scopeTeacher1, { sectionId, subjectId, title: "Life C", learningObjective: "d", teachingMethod: "m", plannedDate: "2026-08-25" });
    await submitLessonPlan(scopeTeacher1, plan.id);
    const rejected = await rejectLessonPlan(scopeAdmin, plan.id, { comment: "Please revise" });
    expect(rejected.status).toBe("rejected");
    expect(rejected.reviewComment).toBe("Please revise");
    const edited = await updateLessonPlan(scopeTeacher1, plan.id, { title: "Life C revised" });
    expect(edited.status).toBe("draft"); // editing a rejected plan resets it to draft
    expect(edited.reviewComment).toBeNull();
    const resubmitted = await submitLessonPlan(scopeTeacher1, plan.id);
    expect(resubmitted.status).toBe("submitted");
  });

  it("CONFLICT: cannot complete a plan that isn't APPROVED", async () => {
    const { id: sectionId } = await mkSection();
    const plan = await createLessonPlan(scopeTeacher1, { sectionId, subjectId, title: "Life D", learningObjective: "d", teachingMethod: "m", plannedDate: "2026-08-25" });
    await expect(completeLessonPlan(scopeTeacher1, plan.id)).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe.skipIf(!dbReady)("duplicate (DB)", () => {
  it("preserves the ORIGINAL section/subject/staff — not the duplicating actor's own", async () => {
    const { id: sectionId } = await mkSection();
    const plan = await createLessonPlan(scopeTeacher1, { sectionId, subjectId, title: "Dup source", learningObjective: "d", teachingMethod: "m", plannedDate: "2026-08-25", topicIds: [topicId1] });
    const copy = await duplicateLessonPlan(scopeAdmin, plan.id, { plannedDate: "2026-09-01" }); // admin has no Staff/TeachingAssignment of their own
    expect(copy.status).toBe("draft");
    expect(copy.section.id).toBe(sectionId);
    expect(copy.subject.id).toBe(subjectId);
    expect(copy.teacher.name).toContain("Tara");
    expect(copy.plannedDate).toBe("2026-09-01");
    expect(copy.topics.map((t) => t.id)).toEqual([topicId1]);
    expect(copy.id).not.toBe(plan.id);
  });
});

describe.skipIf(!dbReady)("My Day lookup (DB)", () => {
  it("getMyDayLessonPlanSummary returns today's plans + draft count for this staff only", async () => {
    const { id: sectionId } = await mkSection();
    const todayPlan = await createLessonPlan(scopeTeacher1, { sectionId, subjectId, title: `MyDay today ${stamp}`, learningObjective: "d", teachingMethod: "m", plannedDate: "2026-08-15" });
    await createLessonPlan(scopeTeacher1, { sectionId, subjectId, title: `MyDay other day ${stamp}`, learningObjective: "d", teachingMethod: "m", plannedDate: "2026-08-20" });
    const summary = await getMyDayLessonPlanSummary(scopeTeacher1, staff1, "2026-08-15");
    expect(summary.items.some((i) => i.id === todayPlan.id)).toBe(true);
    expect(summary.items.every((i) => i.status === "draft")).toBe(true);
    expect(summary.draftCount).toBeGreaterThanOrEqual(1);
  });
});

describe.skipIf(!dbReady)("historical safety (DB)", () => {
  it("Subject archive/rename does not alter an already-created plan's subject reference", async () => {
    const { id: sectionId } = await mkSection();
    const plan = await createLessonPlan(scopeTeacher1, { sectionId, subjectId, title: "Hist A", learningObjective: "d", teachingMethod: "m", plannedDate: "2026-08-25" });
    await prisma.subject.update({ where: { id: subjectId }, data: { name: "Renamed Math", status: "ARCHIVED" } });
    const fetched = await getLessonPlan(scopeAdmin, plan.id);
    expect(fetched.subject.id).toBe(subjectId);
    await prisma.subject.update({ where: { id: subjectId }, data: { name: "Math", status: "ACTIVE" } });
  });

  it("Staff going INACTIVE does not remove already-created plans", async () => {
    const { id: sectionId } = await mkSection();
    const plan = await createLessonPlan(scopeTeacher1, { sectionId, subjectId, title: "Hist B", learningObjective: "d", teachingMethod: "m", plannedDate: "2026-08-25" });
    await prisma.staff.update({ where: { id: staff1 }, data: { status: "INACTIVE" } });
    const fetched = await getLessonPlan(scopeAdmin, plan.id);
    expect(fetched.id).toBe(plan.id);
    await prisma.staff.update({ where: { id: staff1 }, data: { status: "ACTIVE" } });
  });

  it("removing the TeachingAssignment referenced by an existing plan is blocked (Restrict FK)", async () => {
    sectionSeq += 1;
    const section = await prisma.section.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, classId, name: `F${sectionSeq}`, status: "ACTIVE" }, select: { id: true } });
    const assignment = await prisma.teachingAssignment.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, sectionId: section.id, subjectId, staffId: staff1 } });
    await createLessonPlan(scopeTeacher1, { sectionId: section.id, subjectId, title: "Hist C", learningObjective: "d", teachingMethod: "m", plannedDate: "2026-08-25" });
    await expect(prisma.teachingAssignment.delete({ where: { id: assignment.id } })).rejects.toThrow();
  });

  it("deleting a topic referenced by a lesson plan is blocked (Restrict FK)", async () => {
    const { id: sectionId } = await mkSection();
    await createLessonPlan(scopeTeacher1, { sectionId, subjectId, title: "Hist D", learningObjective: "d", teachingMethod: "m", plannedDate: "2026-08-25", topicIds: [topicId1] });
    await expect(prisma.curriculumTopic.delete({ where: { id: topicId1 } })).rejects.toThrow();
  });
});

describe.skipIf(!dbReady)("isolation (DB)", () => {
  it("a foreign school's scope cannot see this school's lesson plan", async () => {
    const { id: sectionId } = await mkSection();
    const plan = await createLessonPlan(scopeTeacher1, { sectionId, subjectId, title: "Iso A", learningObjective: "d", teachingMethod: "m", plannedDate: "2026-08-25" });
    const foreignSchool = (await prisma.school.create({ data: { tenantId, name: `${NS} SB`, code: `${NS}-SB-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
    const foreignBranch = (await prisma.branch.create({ data: { schoolId: foreignSchool, name: "B", code: `${NS}-BB`, status: "ACTIVE" }, select: { id: true } })).id;
    const foreignSession = (await prisma.academicSession.create({ data: { schoolId: foreignSchool, name: "26-27", code: `${NS}-SBS`, startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31"), status: "ACTIVE" }, select: { id: true } })).id;
    const scopeForeign: OrgScope = { tenantId, schoolId: foreignSchool, branchId: foreignBranch, academicSessionId: foreignSession, actor: { id: adminUser, name: "Admin" } };
    await expect(getLessonPlan(scopeForeign, plan.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe.skipIf(!dbReady)("list / mine / filters (DB)", () => {
  it("listMyLessonPlans returns only the caller's own plans, resolved server-side via real Staff.id", async () => {
    const { id: sectionId } = await mkSection();
    const plan = await createLessonPlan(scopeTeacher1, { sectionId, subjectId, title: `Mine A ${stamp}`, learningObjective: "d", teachingMethod: "m", plannedDate: "2026-08-25" });
    const { data } = await listMyLessonPlans(scopeTeacher1, {});
    expect(data.some((p) => p.id === plan.id)).toBe(true);
    const { data: teacher2Data } = await listMyLessonPlans(scopeTeacher2, {});
    expect(teacher2Data.some((p) => p.id === plan.id)).toBe(false);
  });

  it("listMyLessonPlans is empty (not an error) for an actor with no real Staff profile", async () => {
    const { data, meta } = await listMyLessonPlans(scopeAdmin, {});
    expect(data).toEqual([]);
    expect(meta.total).toBe(0);
  });

  it("filters by status and date range", async () => {
    const { id: sectionId } = await mkSection();
    const plan = await createLessonPlan(scopeTeacher1, { sectionId, subjectId, title: `Filter ${stamp}`, learningObjective: "d", teachingMethod: "m", plannedDate: "2026-10-01" });
    const { data } = await listLessonPlans(scopeAdmin, { status: "draft", dateFrom: "2026-09-30", dateTo: "2026-10-02" });
    expect(data.some((p) => p.id === plan.id)).toBe(true);
  });
});

describe.skipIf(!dbReady)("audit events (DB)", () => {
  it("records LESSON_PLAN_CREATED, _UPDATED, _STATUS_CHANGED (x2), _COMPLETED", async () => {
    const { id: sectionId } = await mkSection();
    const plan = await createLessonPlan(scopeTeacher1, { sectionId, subjectId, title: `Audit ${stamp}`, learningObjective: "d", teachingMethod: "m", plannedDate: "2026-08-25" });
    await updateLessonPlan(scopeTeacher1, plan.id, { title: `Audit ${stamp} v2` });
    await submitLessonPlan(scopeTeacher1, plan.id);
    await approveLessonPlan(scopeAdmin, plan.id);
    await completeLessonPlan(scopeTeacher1, plan.id);
    const events = await prisma.auditEvent.findMany({ where: { tenantId, entityType: "LessonPlan", entityId: plan.id }, select: { action: true } });
    const actions = events.map((e) => e.action).sort();
    expect(actions).toEqual(["LESSON_PLAN_COMPLETED", "LESSON_PLAN_CREATED", "LESSON_PLAN_STATUS_CHANGED", "LESSON_PLAN_STATUS_CHANGED", "LESSON_PLAN_UPDATED"]);
  });
});

describe.skipIf(!dbReady)("RBAC + DTO safety (DB)", () => {
  it("lessonPlans.view/lessonPlans.manage: SCHOOL_ADMIN, PRINCIPAL, TEACHER all granted", () => {
    for (const role of ["SCHOOL_ADMIN", "PRINCIPAL", "TEACHER"] as const) {
      expect(ROLE_PERMISSIONS[role]).toContain("lessonPlans.view");
      expect(ROLE_PERMISSIONS[role]).toContain("lessonPlans.manage");
    }
  });

  it("list item DTO exposes only safe display fields", async () => {
    const { id: sectionId } = await mkSection();
    const plan = await createLessonPlan(scopeTeacher1, { sectionId, subjectId, title: `DTO ${stamp}`, learningObjective: "d", teachingMethod: "m", plannedDate: "2026-08-25" });
    const { data } = await listLessonPlans(scopeAdmin, { search: `DTO ${stamp}` });
    const item = data.find((p) => p.id === plan.id)!;
    expect(Object.keys(item).sort()).toEqual(["createdAt", "id", "learningObjective", "period", "plannedDate", "section", "status", "subject", "teacher", "title", "topicCount", "updatedAt"]);
  });

  it("detail DTO adds content fields + real topic list on top of the list shape", async () => {
    const { id: sectionId } = await mkSection();
    const plan = await createLessonPlan(scopeTeacher1, { sectionId, subjectId, title: `DTO2 ${stamp}`, learningObjective: "d", teachingMethod: "m", plannedDate: "2026-08-25", topicIds: [topicId1] });
    const detail = await getLessonPlan(scopeAdmin, plan.id);
    expect(Object.keys(detail).sort()).toEqual([
      "activity", "assessmentMethod", "createdAt", "homeworkNote", "id", "learningObjective", "materials", "period",
      "plannedDate", "reviewComment", "reviewedByName", "section", "status", "subject", "teacher", "teachingMethod",
      "title", "topicCount", "topics", "updatedAt",
    ]);
    expect(detail.topics[0]).toMatchObject({ id: topicId1, title: "Topic 1", chapterTitle: "Chapter 1", unitTitle: "Unit A" });
  });
});
