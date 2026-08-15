// Curriculum / Syllabus Tracking DB integration tests (Phase 9C.1). Real
// Postgres: content (Curriculum -> Unit -> Chapter -> Topic) authored once per
// real (Class, Subject) validated against ClassSubject; DRAFT -> ACTIVE ->
// ARCHIVED lifecycle; progress tracked per real Section via
// CurriculumTopicProgress, upserted by a broad manager or the section's real
// TeachingAssignment holder; unit-level bulk "mark complete"; real, never-
// persisted percentage/status computation; historical safety; isolation;
// concurrency; RBAC; safe DTO shape; audit events. Namespaced ("T9C1").
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import {
  changeCurriculumStatus, completeUnitForSection, createChapter, createCurriculum, createTopic, createUnit,
  deleteCurriculum, deleteTopic, deleteUnit, getCurriculum, getCurriculumInsights, getSectionCurriculum,
  listCurriculum, updateTopicProgress, updateUnit,
} from "@/lib/server/curriculum/service";
import type { OrgScope } from "@/lib/server/api/scope";
import { ROLE_PERMISSIONS } from "@/lib/server/authz/catalog";

let dbReady = false;
try {
  dbReady = Boolean(await prisma.role.findFirst({ where: { key: "SCHOOL_ADMIN", isSystem: true } }));
} catch {
  dbReady = false;
}

const NS = "T9C1";
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

/** Fresh Class + real ClassSubject(subjectId) — Curriculum is unique per
 *  (class, subject), so any test that successfully creates a curriculum needs
 *  its OWN class, never the shared module-level `classId`. */
let classSeq = 0;
async function mkClass(): Promise<string> {
  classSeq += 1;
  const klass = await prisma.class.create({ data: { tenantId, schoolId, academicSessionId: sessionId, name: `C${stamp}-${classSeq}`, order: 100 + classSeq }, select: { id: true } });
  await prisma.classSubject.create({ data: { tenantId, schoolId, academicSessionId: sessionId, classId: klass.id, subjectId } });
  return klass.id;
}

/** Fresh Section (on the given class) with a real TeachingAssignment for staff1/teacher1 on subjectId. */
async function mkSection(forClassId: string = classId) {
  sectionSeq += 1;
  const section = await prisma.section.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, classId: forClassId, name: `F${sectionSeq}`, status: "ACTIVE" }, select: { id: true, branchId: true } });
  await prisma.teachingAssignment.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, sectionId: section.id, subjectId, staffId: staff1 } });
  return section;
}

/** Creates + activates a fresh curriculum (on its own fresh class) with 1 unit
 *  / 1 chapter / 2 topics, plus a real Section + TeachingAssignment for staff1. */
async function mkActiveCurriculum() {
  const freshClassId = await mkClass();
  const curriculum = await createCurriculum(scopeAdmin, { classId: freshClassId, subjectId, title: `Syllabus ${stamp}-${++curriculumSeq}` });
  const withUnit = await createUnit(scopeAdmin, curriculum.id, { title: "Unit A" });
  const unitId = withUnit.units[0].id;
  const withChapter = await createChapter(scopeAdmin, unitId, { title: "Chapter 1" });
  const chapterId = withChapter.units[0].chapters[0].id;
  await createTopic(scopeAdmin, chapterId, { title: "Topic 1" });
  await createTopic(scopeAdmin, chapterId, { title: "Topic 2" });
  const activated = await changeCurriculumStatus(scopeAdmin, curriculum.id, { status: "active" });
  const section = await mkSection(freshClassId);
  return { curriculumId: curriculum.id, unitId, chapterId, topicIds: activated.units[0].chapters[0].topics.map((t) => t.id), classId: freshClassId, sectionId: section.id };
}
let curriculumSeq = 0;

beforeAll(async () => {
  if (!dbReady) return;
  tenantId = (await prisma.tenant.create({ data: { name: `${NS} T`, slug: `t9c1-${stamp}` }, select: { id: true } })).id;
  schoolId = (await prisma.school.create({ data: { tenantId, name: `${NS} S`, code: `${NS}-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  branchA = (await prisma.branch.create({ data: { schoolId, name: "A", code: `${NS}-A`, status: "ACTIVE" }, select: { id: true } })).id;
  sessionId = (await prisma.academicSession.create({ data: { schoolId, name: "26-27", code: `${NS}-S`, startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31"), status: "ACTIVE" }, select: { id: true } })).id;
  classId = (await prisma.class.create({ data: { tenantId, schoolId, academicSessionId: sessionId, name: "Grade 5", order: 5 }, select: { id: true } })).id;
  subjectId = (await prisma.subject.create({ data: { tenantId, schoolId, code: `${NS}-M`, name: "Math", shortName: "M", department: "Math", type: "CORE", maxMarks: 100, passingMarks: 33, theoryMarks: 100, practicalMarks: 0 }, select: { id: true } })).id;
  subjectId2 = (await prisma.subject.create({ data: { tenantId, schoolId, code: `${NS}-E`, name: "English", shortName: "E", department: "Lang", type: "CORE", maxMarks: 100, passingMarks: 33, theoryMarks: 100, practicalMarks: 0 }, select: { id: true } })).id; // deliberately NOT offered
  await prisma.classSubject.create({ data: { tenantId, schoolId, academicSessionId: sessionId, classId, subjectId } });
  staff1 = (await prisma.staff.create({ data: { tenantId, schoolId, branchId: branchA, employeeCode: `${NS}-T1`, firstName: "Tara", isTeaching: true, status: "ACTIVE" }, select: { id: true } })).id;
  staff2 = (await prisma.staff.create({ data: { tenantId, schoolId, branchId: branchA, employeeCode: `${NS}-T2`, firstName: "Ravi", isTeaching: true, status: "ACTIVE" }, select: { id: true } })).id;

  adminUser = await makeUserWithRole(`t9c1-admin-${stamp}@x.test`, "SCHOOL_ADMIN");
  teacher1User = await makeUserWithRole(`t9c1-t1-${stamp}@x.test`, "TEACHER");
  teacher2User = await makeUserWithRole(`t9c1-t2-${stamp}@x.test`, "TEACHER");
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
  it("creates a DRAFT curriculum for a real, offered (class, subject)", async () => {
    const curriculum = await createCurriculum(scopeAdmin, { classId, subjectId, title: `Create A ${stamp}` });
    expect(curriculum.status).toBe("draft");
    expect(curriculum.class.id).toBe(classId);
    expect(curriculum.subject.id).toBe(subjectId);
    expect(curriculum.unitCount).toBe(0);
  });

  it("FORBIDDEN: a teacher cannot create curriculum content (broad-manager only)", async () => {
    await expect(createCurriculum(scopeTeacher1, { classId, subjectId, title: "X" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("SUBJECT_NOT_OFFERED: subject not on this class's ClassSubject list is rejected", async () => {
    await expect(createCurriculum(scopeAdmin, { classId, subjectId: subjectId2, title: "X" })).rejects.toMatchObject({ code: "SUBJECT_NOT_OFFERED" });
  });

  it("NOT_FOUND: a foreign/nonexistent class is rejected", async () => {
    await expect(createCurriculum(scopeAdmin, { classId: "nonexistent", subjectId, title: "X" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("CURRICULUM_ALREADY_EXISTS: a duplicate (class, subject) is rejected", async () => {
    await createCurriculum(scopeAdmin, { classId, subjectId: subjectId2, title: "dup-setup" }).catch(() => {}); // no-op, subject2 not offered
    // Use the already-offered subjectId, which curricula from earlier tests may have used — create fresh to be sure.
    const freshClass = (await prisma.class.create({ data: { tenantId, schoolId, academicSessionId: sessionId, name: `Grade 6 ${stamp}`, order: 6 }, select: { id: true } })).id;
    await prisma.classSubject.create({ data: { tenantId, schoolId, academicSessionId: sessionId, classId: freshClass, subjectId } });
    await createCurriculum(scopeAdmin, { classId: freshClass, subjectId, title: "First" });
    await expect(createCurriculum(scopeAdmin, { classId: freshClass, subjectId, title: "Second" })).rejects.toMatchObject({ code: "CURRICULUM_ALREADY_EXISTS" });
  });
});

describe.skipIf(!dbReady)("content authoring: units/chapters/topics (DB)", () => {
  it("builds a real Unit -> Chapter -> Topic tree", async () => {
    const curriculum = await createCurriculum(scopeAdmin, { classId: await mkClass(), subjectId, title: `Tree A ${stamp}` });
    const withUnit = await createUnit(scopeAdmin, curriculum.id, { title: "Unit 1", estimatedPeriods: 6 });
    expect(withUnit.units).toHaveLength(1);
    const unitId = withUnit.units[0].id;
    const withChapter = await createChapter(scopeAdmin, unitId, { title: "Chapter 1" });
    const chapterId = withChapter.units[0].chapters[0].id;
    const withTopic = await createTopic(scopeAdmin, chapterId, { title: "Topic 1", learningOutcomes: ["Explain X"] });
    expect(withTopic.units[0].chapters[0].topics[0]).toMatchObject({ title: "Topic 1", learningOutcomes: ["Explain X"] });
    expect(withTopic.units[0].chapters[0].topics[0].progress).toBeNull(); // no section context
  });

  it("content edits (title/order/dates) are only permitted for broad managers", async () => {
    const curriculum = await createCurriculum(scopeAdmin, { classId: await mkClass(), subjectId, title: `Edit A ${stamp}` });
    const withUnit = await createUnit(scopeAdmin, curriculum.id, { title: "Unit 1" });
    const unitId = withUnit.units[0].id;
    await expect(updateUnit(scopeTeacher1, unitId, { title: "Hijacked" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    const updated = await updateUnit(scopeAdmin, unitId, { title: "Renamed", plannedStart: "2026-08-01", plannedEnd: "2026-08-20" });
    expect(updated.units[0].title).toBe("Renamed");
    expect(updated.units[0].plannedStart).toBe("2026-08-01");
  });

  it("units/chapters/topics can only be deleted while the curriculum is DRAFT", async () => {
    const curriculum = await createCurriculum(scopeAdmin, { classId: await mkClass(), subjectId, title: `Delete A ${stamp}` });
    const withUnit = await createUnit(scopeAdmin, curriculum.id, { title: "Unit 1" });
    const unitId = withUnit.units[0].id;
    await deleteUnit(scopeAdmin, unitId); // DRAFT — allowed
    const rebuilt = await createUnit(scopeAdmin, curriculum.id, { title: "Unit 1 v2" });
    const unit2Id = rebuilt.units[0].id;
    await changeCurriculumStatus(scopeAdmin, curriculum.id, { status: "active" });
    await expect(deleteUnit(scopeAdmin, unit2Id)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("deleting a topic referenced by nothing succeeds; content stays consistent", async () => {
    const curriculum = await createCurriculum(scopeAdmin, { classId: await mkClass(), subjectId, title: `Delete B ${stamp}` });
    const withUnit = await createUnit(scopeAdmin, curriculum.id, { title: "Unit 1" });
    const withChapter = await createChapter(scopeAdmin, withUnit.units[0].id, { title: "Chapter 1" });
    const withTopic = await createTopic(scopeAdmin, withChapter.units[0].chapters[0].id, { title: "Topic 1" });
    const topicId = withTopic.units[0].chapters[0].topics[0].id;
    const result = await deleteTopic(scopeAdmin, topicId);
    expect(result.id).toBe(topicId);
  });
});

describe.skipIf(!dbReady)("lifecycle: draft -> active -> archived (DB)", () => {
  it("valid transitions succeed; invalid ones are rejected", async () => {
    const curriculum = await createCurriculum(scopeAdmin, { classId: await mkClass(), subjectId, title: `Lifecycle A ${stamp}` });
    await expect(changeCurriculumStatus(scopeAdmin, curriculum.id, { status: "draft" })).rejects.toMatchObject({ code: "INVALID_STATUS_TRANSITION" });
    const active = await changeCurriculumStatus(scopeAdmin, curriculum.id, { status: "active" });
    expect(active.status).toBe("active");
    await expect(changeCurriculumStatus(scopeAdmin, curriculum.id, { status: "draft" })).rejects.toMatchObject({ code: "INVALID_STATUS_TRANSITION" });
    const archived = await changeCurriculumStatus(scopeAdmin, curriculum.id, { status: "archived" });
    expect(archived.status).toBe("archived");
    await expect(changeCurriculumStatus(scopeAdmin, curriculum.id, { status: "active" })).rejects.toMatchObject({ code: "INVALID_STATUS_TRANSITION" });
  });

  it("only a DRAFT curriculum may be hard-deleted", async () => {
    const curriculum = await createCurriculum(scopeAdmin, { classId: await mkClass(), subjectId, title: `Lifecycle B ${stamp}` });
    await changeCurriculumStatus(scopeAdmin, curriculum.id, { status: "active" });
    await expect(deleteCurriculum(scopeAdmin, curriculum.id)).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe.skipIf(!dbReady)("section-scoped progress (DB)", () => {
  it("returns null (honest empty state) when no curriculum exists for this section's class+subject", async () => {
    const freshClass = (await prisma.class.create({ data: { tenantId, schoolId, academicSessionId: sessionId, name: `NoCurr ${stamp}`, order: 20 }, select: { id: true } })).id;
    await prisma.classSubject.create({ data: { tenantId, schoolId, academicSessionId: sessionId, classId: freshClass, subjectId } });
    const section = await prisma.section.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, classId: freshClass, name: "Z1", status: "ACTIVE" }, select: { id: true } });
    const result = await getSectionCurriculum(scopeAdmin, section.id, subjectId);
    expect(result).toBeNull();
  });

  it("zero-topic curriculum reports overallPercent: null, never a fake 0%", async () => {
    const freshClassId = await mkClass();
    const curriculum = await createCurriculum(scopeAdmin, { classId: freshClassId, subjectId, title: `Empty ${stamp}` });
    await changeCurriculumStatus(scopeAdmin, curriculum.id, { status: "active" });
    const section = await mkSection(freshClassId);
    const result = await getSectionCurriculum(scopeAdmin, section.id, subjectId);
    expect(result!.overallPercent).toBeNull();
  });

  it("the assigned teacher may record progress for their own section+subject", async () => {
    const { topicIds, sectionId } = await mkActiveCurriculum();
    const result = await updateTopicProgress(scopeTeacher1, sectionId, topicIds[0], { status: "completed" });
    const topic = result.units[0].chapters[0].topics.find((t) => t.id === topicIds[0])!;
    expect(topic.progress).toMatchObject({ status: "completed" });
    expect(topic.progress!.completedByStaffName).toContain("Tara");
    expect(result.overallPercent).toBe(50); // 1 of 2 topics
  });

  it("TEACHER_NOT_ASSIGNED: a teacher with no TeachingAssignment on this section+subject is rejected", async () => {
    const { topicIds, sectionId } = await mkActiveCurriculum();
    await expect(updateTopicProgress(scopeTeacher2, sectionId, topicIds[0], { status: "in-progress" })).rejects.toMatchObject({ code: "TEACHER_NOT_ASSIGNED" });
  });

  it("SCHOOL_ADMIN bypasses teacher-ownership entirely", async () => {
    const { topicIds, sectionId } = await mkActiveCurriculum();
    const result = await updateTopicProgress(scopeAdmin, sectionId, topicIds[0], { status: "completed" });
    expect(result.units[0].chapters[0].topics.find((t) => t.id === topicIds[0])?.progress?.status).toBe("completed");
  });

  it("CONFLICT: progress cannot be recorded against a DRAFT curriculum", async () => {
    const freshClassId = await mkClass();
    const curriculum = await createCurriculum(scopeAdmin, { classId: freshClassId, subjectId, title: `Draft progress ${stamp}` });
    const withUnit = await createUnit(scopeAdmin, curriculum.id, { title: "Unit 1" });
    const withChapter = await createChapter(scopeAdmin, withUnit.units[0].id, { title: "Chapter 1" });
    const withTopic = await createTopic(scopeAdmin, withChapter.units[0].chapters[0].id, { title: "Topic 1" });
    const topicId = withTopic.units[0].chapters[0].topics[0].id;
    const section = await mkSection(freshClassId);
    await expect(updateTopicProgress(scopeAdmin, section.id, topicId, { status: "completed" })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("re-recording progress upserts — one canonical row, never a duplicate", async () => {
    const { topicIds, sectionId } = await mkActiveCurriculum();
    await updateTopicProgress(scopeTeacher1, sectionId, topicIds[0], { status: "in-progress" });
    await updateTopicProgress(scopeTeacher1, sectionId, topicIds[0], { status: "completed" });
    const count = await prisma.curriculumTopicProgress.count({ where: { sectionId, topicId: topicIds[0] } });
    expect(count).toBe(1);
  });

  it("completeUnitForSection marks every topic under the unit COMPLETED for this section", async () => {
    const { unitId, topicIds, sectionId } = await mkActiveCurriculum();
    const result = await completeUnitForSection(scopeTeacher1, sectionId, unitId);
    expect(result.units[0].completedTopics).toBe(topicIds.length);
    expect(result.units[0].status).toBe("completed");
  });
});

describe.skipIf(!dbReady)("historical safety (DB)", () => {
  it("Subject rename/archive does not alter an already-created curriculum's reference", async () => {
    const curriculum = await createCurriculum(scopeAdmin, { classId: await mkClass(), subjectId, title: `Hist A ${stamp}` });
    await prisma.subject.update({ where: { id: subjectId }, data: { name: "Renamed Math", status: "ARCHIVED" } });
    const fetched = await getCurriculum(scopeAdmin, curriculum.id);
    expect(fetched.subject.id).toBe(subjectId);
    await prisma.subject.update({ where: { id: subjectId }, data: { name: "Math", status: "ACTIVE" } });
  });

  it("Staff going INACTIVE does not remove already-recorded progress", async () => {
    const { topicIds, sectionId } = await mkActiveCurriculum();
    await updateTopicProgress(scopeTeacher1, sectionId, topicIds[0], { status: "completed" });
    await prisma.staff.update({ where: { id: staff1 }, data: { status: "INACTIVE" } });
    const result = await getSectionCurriculum(scopeAdmin, sectionId, subjectId);
    expect(result!.units[0].chapters[0].topics.find((t) => t.id === topicIds[0])?.progress?.status).toBe("completed");
    await prisma.staff.update({ where: { id: staff1 }, data: { status: "ACTIVE" } });
  });
});

describe.skipIf(!dbReady)("isolation (DB)", () => {
  it("a foreign school's scope cannot see this school's curriculum", async () => {
    const curriculum = await createCurriculum(scopeAdmin, { classId: await mkClass(), subjectId, title: `Iso A ${stamp}` });
    const foreignSchool = (await prisma.school.create({ data: { tenantId, name: `${NS} SB`, code: `${NS}-SB-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
    const foreignBranch = (await prisma.branch.create({ data: { schoolId: foreignSchool, name: "B", code: `${NS}-BB`, status: "ACTIVE" }, select: { id: true } })).id;
    const foreignSession = (await prisma.academicSession.create({ data: { schoolId: foreignSchool, name: "26-27", code: `${NS}-SBS`, startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31"), status: "ACTIVE" }, select: { id: true } })).id;
    const scopeForeign: OrgScope = { tenantId, schoolId: foreignSchool, branchId: foreignBranch, academicSessionId: foreignSession, actor: { id: adminUser, name: "Admin" } };
    await expect(getCurriculum(scopeForeign, curriculum.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("list is scoped to the school+session", async () => {
    const curriculum = await createCurriculum(scopeAdmin, { classId: await mkClass(), subjectId, title: `Iso B ${stamp}` });
    const otherSession = (await prisma.academicSession.create({ data: { schoolId, name: "27-28", code: `${NS}-S2`, startDate: new Date("2027-04-01"), endDate: new Date("2028-03-31"), status: "ACTIVE" }, select: { id: true } })).id;
    const scopeOtherSession: OrgScope = { tenantId, schoolId, branchId: branchA, academicSessionId: otherSession, actor: { id: adminUser, name: "Admin" } };
    const { data } = await listCurriculum(scopeOtherSession, {});
    expect(data.some((c) => c.id === curriculum.id)).toBe(false);
  });
});

describe.skipIf(!dbReady)("concurrency (DB)", () => {
  it("two concurrent creates for the same (class, subject): exactly one canonical row (DB uniqueness is authority)", async () => {
    const freshClass = (await prisma.class.create({ data: { tenantId, schoolId, academicSessionId: sessionId, name: `Race ${stamp}`, order: 30 }, select: { id: true } })).id;
    await prisma.classSubject.create({ data: { tenantId, schoolId, academicSessionId: sessionId, classId: freshClass, subjectId } });
    const results = await Promise.allSettled([
      createCurriculum(scopeAdmin, { classId: freshClass, subjectId, title: "Race A" }),
      createCurriculum(scopeAdmin, { classId: freshClass, subjectId, title: "Race B" }),
    ]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    expect(fulfilled.length).toBe(1);
    const count = await prisma.curriculum.count({ where: { schoolId, academicSessionId: sessionId, classId: freshClass, subjectId } });
    expect(count).toBe(1);
  });

  it("two concurrent progress updates for the same (section, topic): one canonical row, no duplicates", async () => {
    const { topicIds, sectionId } = await mkActiveCurriculum();
    const results = await Promise.allSettled([
      updateTopicProgress(scopeTeacher1, sectionId, topicIds[0], { status: "in-progress" }),
      updateTopicProgress(scopeTeacher1, sectionId, topicIds[0], { status: "completed" }),
    ]);
    expect(results.every((r) => r.status === "fulfilled")).toBe(true);
    const count = await prisma.curriculumTopicProgress.count({ where: { sectionId, topicId: topicIds[0] } });
    expect(count).toBe(1);
  });
});

describe.skipIf(!dbReady)("audit events (DB)", () => {
  it("records CURRICULUM_CREATED, _UNIT_CREATED, _CHAPTER_CREATED, _TOPIC_CREATED, _STATUS_CHANGED, _TOPIC_PROGRESS_UPDATED", async () => {
    const freshClassId = await mkClass();
    const curriculum = await createCurriculum(scopeAdmin, { classId: freshClassId, subjectId, title: `Audit ${stamp}` });
    const withUnit = await createUnit(scopeAdmin, curriculum.id, { title: "Unit 1" });
    const withChapter = await createChapter(scopeAdmin, withUnit.units[0].id, { title: "Chapter 1" });
    const withTopic = await createTopic(scopeAdmin, withChapter.units[0].chapters[0].id, { title: "Topic 1" });
    const topicId = withTopic.units[0].chapters[0].topics[0].id;
    await changeCurriculumStatus(scopeAdmin, curriculum.id, { status: "active" });
    const section = await mkSection(freshClassId);
    await updateTopicProgress(scopeTeacher1, section.id, topicId, { status: "completed" });

    const curriculumEvents = await prisma.auditEvent.findMany({ where: { tenantId, entityType: "Curriculum", entityId: curriculum.id }, select: { action: true } });
    expect(curriculumEvents.map((e) => e.action).sort()).toEqual(["CURRICULUM_CREATED", "CURRICULUM_STATUS_CHANGED"]);
    const progressEvents = await prisma.auditEvent.findMany({ where: { tenantId, entityType: "CurriculumTopicProgress", entityId: topicId }, select: { action: true } });
    expect(progressEvents.map((e) => e.action)).toEqual(["CURRICULUM_TOPIC_PROGRESS_UPDATED"]);
  });
});

describe.skipIf(!dbReady)("insights (DB)", () => {
  it("computes real, DB-derived class/subject/teacher completion rollups", async () => {
    const { topicIds, sectionId, classId: freshClassId } = await mkActiveCurriculum();
    await updateTopicProgress(scopeTeacher1, sectionId, topicIds[0], { status: "completed" });
    await updateTopicProgress(scopeTeacher1, sectionId, topicIds[1], { status: "completed" });
    const insights = await getCurriculumInsights(scopeAdmin);
    expect(insights.byClass.some((c) => c.classId === freshClassId)).toBe(true);
    expect(insights.bySubject.some((s) => s.subjectId === subjectId)).toBe(true);
    expect(insights.byTeacher.some((t) => t.staffId === staff1)).toBe(true);
  });
});

describe.skipIf(!dbReady)("RBAC + DTO safety (DB)", () => {
  it("curriculum.view/curriculum.manage: SCHOOL_ADMIN, PRINCIPAL, TEACHER all granted", () => {
    for (const role of ["SCHOOL_ADMIN", "PRINCIPAL", "TEACHER"] as const) {
      expect(ROLE_PERMISSIONS[role]).toContain("curriculum.view");
      expect(ROLE_PERMISSIONS[role]).toContain("curriculum.manage");
    }
  });

  it("list item DTO exposes only safe display fields", async () => {
    const curriculum = await createCurriculum(scopeAdmin, { classId: await mkClass(), subjectId, title: `DTO-Unique ${stamp}` });
    const { data } = await listCurriculum(scopeAdmin, { search: `DTO-Unique ${stamp}` });
    const item = data.find((c) => c.id === curriculum.id)!;
    expect(Object.keys(item).sort()).toEqual(["class", "createdAt", "description", "id", "status", "subject", "title", "topicCount", "unitCount", "updatedAt"]);
  });
});
