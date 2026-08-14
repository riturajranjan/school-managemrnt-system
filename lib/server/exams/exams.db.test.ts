// Exams foundation DB integration tests (Phase 8A). Real Postgres: term CRUD +
// dedup + status lifecycle; exam CRUD + dedup + class applicability (real
// Class ids, cross-school/session rejection); schedule creation validates
// subject-offered (ClassSubject), exam→class assignment, time range, snapshots
// marks from Subject defaults; duplicate-subject / day-conflict / invigilator-
// conflict all rejected (and race-safe — exactly one survives); historical
// safety (Subject default change / archive does not rewrite/destroy a
// scheduled entry); RBAC catalog; audit; safe DTOs. Namespaced ("T8A-").
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { createExam, createTerm, getExam, listExams, listTerms, reconcileExamClasses, setTermStatus, updateTerm } from "@/lib/server/exams/service";
import { createScheduleEntry, deleteScheduleEntry, listSchedule, updateScheduleEntry } from "@/lib/server/exams/schedule-service";
import type { OrgScope } from "@/lib/server/api/scope";
import { ROLE_PERMISSIONS } from "@/lib/server/authz/catalog";

let dbReady = false;
try {
  dbReady = Boolean(await prisma.role.findFirst({ where: { key: "SCHOOL_ADMIN", isSystem: true } }));
} catch {
  dbReady = false;
}

const NS = "T8A";
const stamp = Date.now().toString(36);

let tenantId = "", schoolId = "", branchA = "", sessionId = "", classId = "";
let section1 = "", subjectId = "", subject2Id = "", offSubjectId = "";
let sectionSeq = 0;
async function mkFreshSection(): Promise<string> {
  sectionSeq += 1;
  return (await prisma.section.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, classId, name: `F${sectionSeq}`, status: "ACTIVE" }, select: { id: true } })).id;
}
let staff1 = "", staff2 = "";
let scope: OrgScope, scopeB: OrgScope;

async function mkSchool(name: string) {
  const s = (await prisma.school.create({ data: { tenantId, name: `${NS} ${name}`, code: `${NS}-${name}-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  const b = (await prisma.branch.create({ data: { schoolId: s, name: "A", code: `${NS}-${name}-B`, status: "ACTIVE" }, select: { id: true } })).id;
  const se = (await prisma.academicSession.create({ data: { schoolId: s, name: "26-27", code: `${NS}-${name}-S`, startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31"), status: "ACTIVE" }, select: { id: true } })).id;
  return { schoolId: s, branchId: b, academicSessionId: se };
}

beforeAll(async () => {
  if (!dbReady) return;
  tenantId = (await prisma.tenant.create({ data: { name: `${NS} T`, slug: `t8a-${stamp}` }, select: { id: true } })).id;
  const main = await mkSchool("main");
  schoolId = main.schoolId; branchA = main.branchId; sessionId = main.academicSessionId;
  classId = (await prisma.class.create({ data: { tenantId, schoolId, academicSessionId: sessionId, name: "Grade 5", order: 5 }, select: { id: true } })).id;
  section1 = (await prisma.section.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, classId, name: "A", status: "ACTIVE" }, select: { id: true } })).id;
  subjectId = (await prisma.subject.create({ data: { tenantId, schoolId, code: `${NS}-M`, name: "Math", shortName: "M", department: "Math", type: "CORE", maxMarks: 100, passingMarks: 33, theoryMarks: 100, practicalMarks: 0 }, select: { id: true } })).id;
  subject2Id = (await prisma.subject.create({ data: { tenantId, schoolId, code: `${NS}-S2`, name: "Science", shortName: "S2", department: "Science", type: "CORE" }, select: { id: true } })).id;
  offSubjectId = (await prisma.subject.create({ data: { tenantId, schoolId, code: `${NS}-A`, name: "Art", shortName: "A", department: "Arts", type: "ELECTIVE" }, select: { id: true } })).id; // never offered
  await prisma.classSubject.create({ data: { tenantId, schoolId, academicSessionId: sessionId, classId, subjectId } });
  await prisma.classSubject.create({ data: { tenantId, schoolId, academicSessionId: sessionId, classId, subjectId: subject2Id } });
  staff1 = (await prisma.staff.create({ data: { tenantId, schoolId, branchId: branchA, employeeCode: `${NS}-S1`, firstName: "Ina", isTeaching: false, status: "ACTIVE" }, select: { id: true } })).id;
  staff2 = (await prisma.staff.create({ data: { tenantId, schoolId, branchId: branchA, employeeCode: `${NS}-S2`, firstName: "Om", isTeaching: false, status: "ACTIVE" }, select: { id: true } })).id;
  scope = { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, actor: { id: "t8a-actor", name: "T8A Tester" } };

  const b = await mkSchool("b");
  scopeB = { tenantId, schoolId: b.schoolId, branchId: b.branchId, academicSessionId: b.academicSessionId, actor: { id: "t8a-actor", name: "T8A Tester" } };
});

afterAll(async () => {
  if (!dbReady || !tenantId) return;
  await prisma.auditEvent.deleteMany({ where: { tenantId } });
  await prisma.tenant.delete({ where: { id: tenantId } });
});

async function mkTermAndExam(code = `EX-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`) {
  const term = await createTerm(scope, { name: "Term 1", code: `T-${code}` });
  const exam = await createExam(scope, { examTermId: term.id, name: "Unit Test", code, startsOn: "2026-08-24", endsOn: "2026-08-28" });
  return { term, exam };
}

describe.skipIf(!dbReady)("exam terms (DB)", () => {
  it("creates a term + audits it; rejects a duplicate code", async () => {
    const t = await createTerm(scope, { name: "Term Alpha", code: "ALPHA" });
    expect(t).toMatchObject({ name: "Term Alpha", code: "ALPHA", status: "active", examCount: 0 });
    const audit = await prisma.auditEvent.findFirst({ where: { tenantId, action: "EXAM_TERM_CREATED", entityId: t.id } });
    expect(audit).not.toBeNull();
    await expect(createTerm(scope, { name: "Dup", code: "alpha" })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("updates a term and changes status", async () => {
    const t = await createTerm(scope, { name: "Term Beta", code: "BETA" });
    const updated = await updateTerm(scope, t.id, { name: "Term Beta Renamed" });
    expect(updated.name).toBe("Term Beta Renamed");
    const archived = await setTermStatus(scope, t.id, "archived");
    expect(archived.status).toBe("archived");
  });

  it("lists only in-scope terms", async () => {
    const before = await listTerms(scopeB);
    expect(before.every((t) => t.code !== "ALPHA")).toBe(true);
  });

  it("RBAC: exams.manage held by admin/principal, view by teacher only", () => {
    expect(ROLE_PERMISSIONS.SCHOOL_ADMIN).toContain("exams.manage");
    expect(ROLE_PERMISSIONS.PRINCIPAL).toContain("exams.manage");
    expect(ROLE_PERMISSIONS.TEACHER).toContain("exams.view");
    expect(ROLE_PERMISSIONS.TEACHER).not.toContain("exams.manage");
  });
});

describe.skipIf(!dbReady)("exams + class applicability (DB)", () => {
  it("creates an exam under a term + audits; rejects a duplicate code", async () => {
    const { exam } = await mkTermAndExam("DUPTEST");
    expect(exam.status).toBe("draft");
    const audit = await prisma.auditEvent.findFirst({ where: { tenantId, action: "EXAM_CREATED", entityId: exam.id } });
    expect(audit).not.toBeNull();
    const term2 = await createTerm(scope, { name: "T2", code: "T2X" });
    await expect(createExam(scope, { examTermId: term2.id, name: "Dup", code: "DUPTEST", startsOn: "2026-08-24", endsOn: "2026-08-28" })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("rejects endsOn before startsOn", async () => {
    const term = await createTerm(scope, { name: "T3", code: "T3X" });
    await expect(createExam(scope, { examTermId: term.id, name: "Bad dates", code: "BADDATE", startsOn: "2026-08-28", endsOn: "2026-08-20" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("assigns real classes (reconcile) + audits; rejects a foreign-school class", async () => {
    const { exam } = await mkTermAndExam();
    const assigned = await reconcileExamClasses(scope, exam.id, { classIds: [classId] });
    expect(assigned.map((c) => c.id)).toEqual([classId]);
    const detail = await getExam(scope, exam.id);
    expect(detail.classes.map((c) => c.id)).toEqual([classId]);
    const audit = await prisma.auditEvent.findFirst({ where: { tenantId, action: "EXAM_CLASS_ASSIGNED", entityId: exam.id } });
    expect(audit).not.toBeNull();
    // foreign class (belongs to scopeB) is rejected
    const foreignClass = (await prisma.class.create({ data: { tenantId, schoolId: scopeB.schoolId, academicSessionId: scopeB.academicSessionId!, name: "Foreign", order: 1 }, select: { id: true } })).id;
    await expect(reconcileExamClasses(scope, exam.id, { classIds: [foreignClass] })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("cross-school / cross-session isolation: exam not found in a foreign scope", async () => {
    const { exam } = await mkTermAndExam();
    await expect(getExam(scopeB, exam.id)).rejects.toMatchObject({ code: "EXAM_NOT_FOUND" });
    const list = await listExams(scopeB);
    expect(list.every((e) => e.id !== exam.id)).toBe(true);
  });

  it("DTO exposes only safe display fields", async () => {
    const { exam } = await mkTermAndExam();
    const detail = await getExam(scope, exam.id);
    // gradingSchemeId/gradingSchemeName added Phase 8C — real, safe display fields.
    expect(Object.keys(detail).sort()).toEqual(["classCount", "classes", "code", "description", "endsOn", "gradingSchemeId", "gradingSchemeName", "id", "mode", "name", "scheduleCount", "scope", "startsOn", "status", "term", "type"]);
  });
});

describe.skipIf(!dbReady)("exam schedule (DB)", () => {
  // Every persisting test gets its OWN fresh section: the "one paper per section
  // per calendar day" rule (plan §11's simplification, documented in the schema)
  // is enforced GLOBALLY per section across all exams, so sharing a section
  // across independent test cases would make them interfere with each other.
  async function examWithClass() {
    const { exam } = await mkTermAndExam();
    await reconcileExamClasses(scope, exam.id, { classIds: [classId] });
    const section = await mkFreshSection();
    return { exam, section };
  }

  it("schedules a real paper, snapshotting Subject marks defaults; audits it", async () => {
    const { exam, section } = await examWithClass();
    const entry = await createScheduleEntry(scope, exam.id, { sectionId: section, subjectId, examDate: "2026-08-24", startTime: "09:00", endTime: "11:00" });
    expect(entry).toMatchObject({ examDate: "2026-08-24", startTime: "09:00", endTime: "11:00", maxMarks: 100, passingMarks: 33 });
    expect(entry.subject.name).toBe("Math");
    const audit = await prisma.auditEvent.findFirst({ where: { tenantId, action: "EXAM_SCHEDULE_CREATED", entityId: entry.id } });
    expect(audit).not.toBeNull();
  });

  it("rejects a subject not offered to the section's class", async () => {
    const { exam, section } = await examWithClass();
    await expect(createScheduleEntry(scope, exam.id, { sectionId: section, subjectId: offSubjectId, examDate: "2026-08-24", startTime: "09:00", endTime: "10:00" })).rejects.toMatchObject({ code: "SUBJECT_NOT_OFFERED" });
  });

  it("rejects scheduling before the exam's class is assigned", async () => {
    const { exam } = await mkTermAndExam(); // no reconcileExamClasses
    await expect(createScheduleEntry(scope, exam.id, { sectionId: section1, subjectId, examDate: "2026-08-24", startTime: "09:00", endTime: "10:00" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("rejects invalid time range", async () => {
    const { exam, section } = await examWithClass();
    await expect(createScheduleEntry(scope, exam.id, { sectionId: section, subjectId, examDate: "2026-08-24", startTime: "11:00", endTime: "09:00" })).rejects.toMatchObject({ code: "INVALID_EXAM_TIME" });
  });

  it("DUPLICATE_EXAM_SUBJECT: same subject twice for the same exam+section rejected", async () => {
    const { exam, section } = await examWithClass();
    await createScheduleEntry(scope, exam.id, { sectionId: section, subjectId, examDate: "2026-08-24", startTime: "09:00", endTime: "10:00" });
    await expect(createScheduleEntry(scope, exam.id, { sectionId: section, subjectId, examDate: "2026-08-26", startTime: "09:00", endTime: "10:00" })).rejects.toMatchObject({ code: "DUPLICATE_EXAM_SUBJECT" });
  });

  it("EXAM_SCHEDULE_CONFLICT: a second paper the same section+date is rejected (one per day)", async () => {
    const { exam, section } = await examWithClass();
    await createScheduleEntry(scope, exam.id, { sectionId: section, subjectId, examDate: "2026-08-24", startTime: "09:00", endTime: "10:00" });
    await expect(createScheduleEntry(scope, exam.id, { sectionId: section, subjectId: subject2Id, examDate: "2026-08-24", startTime: "11:00", endTime: "12:00" })).rejects.toMatchObject({ code: "EXAM_SCHEDULE_CONFLICT" });
  });

  it("cross-school section rejected", async () => {
    const { exam } = await examWithClass();
    const foreignClassId = (await prisma.class.create({ data: { tenantId, schoolId: scopeB.schoolId, academicSessionId: scopeB.academicSessionId!, name: "FC", order: 1 }, select: { id: true } })).id;
    const foreignSection = (await prisma.section.create({ data: { tenantId, schoolId: scopeB.schoolId, branchId: scopeB.branchId!, academicSessionId: scopeB.academicSessionId!, classId: foreignClassId, name: "A", status: "ACTIVE" }, select: { id: true } })).id;
    await expect(createScheduleEntry(scope, exam.id, { sectionId: foreignSection, subjectId, examDate: "2026-08-24", startTime: "09:00", endTime: "10:00" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("INVIGILATOR_CONFLICT: same invigilator two papers the same day is rejected; inactive staff rejected", async () => {
    const { exam, section } = await examWithClass();
    const section2fresh = await mkFreshSection();
    const inactive = (await prisma.staff.create({ data: { tenantId, schoolId, branchId: branchA, employeeCode: `${NS}-INACT-${sectionSeq}`, firstName: "Off", status: "INACTIVE" }, select: { id: true } })).id;
    await expect(createScheduleEntry(scope, exam.id, { sectionId: section, subjectId, examDate: "2026-08-24", startTime: "09:00", endTime: "10:00", invigilatorStaffId: inactive })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    const e1 = await createScheduleEntry(scope, exam.id, { sectionId: section, subjectId, examDate: "2026-08-24", startTime: "09:00", endTime: "10:00", invigilatorStaffId: staff1 });
    expect(e1.invigilator?.id).toBe(staff1);
    await expect(createScheduleEntry(scope, exam.id, { sectionId: section2fresh, subjectId: subject2Id, examDate: "2026-08-24", startTime: "11:00", endTime: "12:00", invigilatorStaffId: staff1 })).rejects.toMatchObject({ code: "INVIGILATOR_CONFLICT" });
  });

  it("historical safety: Subject default change / archive does NOT rewrite or destroy an existing schedule entry", async () => {
    const { exam, section } = await examWithClass();
    const entry = await createScheduleEntry(scope, exam.id, { sectionId: section, subjectId, examDate: "2026-08-24", startTime: "09:00", endTime: "10:00" });
    expect(entry.maxMarks).toBe(100);
    await prisma.subject.update({ where: { id: subjectId }, data: { maxMarks: 50, status: "ARCHIVED" } });
    const list = await listSchedule(scope, exam.id);
    const same = list.find((e) => e.id === entry.id);
    expect(same).not.toBeUndefined();
    expect(same!.maxMarks).toBe(100); // unchanged despite Subject default now being 50
    expect(same!.subject.name).toBe("Math"); // still readable
    await prisma.subject.update({ where: { id: subjectId }, data: { maxMarks: 100, status: "ACTIVE" } });
  });

  it("update (move date) re-checks conflicts; delete removes + audits", async () => {
    const { exam, section } = await examWithClass();
    const a = await createScheduleEntry(scope, exam.id, { sectionId: section, subjectId, examDate: "2026-08-24", startTime: "09:00", endTime: "10:00" });
    const b = await createScheduleEntry(scope, exam.id, { sectionId: section, subjectId: subject2Id, examDate: "2026-08-25", startTime: "09:00", endTime: "10:00" });
    await expect(updateScheduleEntry(scope, exam.id, b.id, { examDate: "2026-08-24" })).rejects.toMatchObject({ code: "EXAM_SCHEDULE_CONFLICT" });
    const moved = await updateScheduleEntry(scope, exam.id, a.id, { startTime: "08:00", endTime: "09:00" });
    expect(moved.startTime).toBe("08:00");
    await deleteScheduleEntry(scope, exam.id, a.id);
    const after = await listSchedule(scope, exam.id);
    expect(after.every((e) => e.id !== a.id)).toBe(true);
    const audit = await prisma.auditEvent.findFirst({ where: { tenantId, action: "EXAM_SCHEDULE_DELETED", entityId: a.id } });
    expect(audit).not.toBeNull();
  });

  it("CONCURRENCY: two concurrent creates for the same section+date → exactly one row survives", async () => {
    const { exam, section } = await examWithClass();
    const results = await Promise.allSettled([
      createScheduleEntry(scope, exam.id, { sectionId: section, subjectId, examDate: "2026-08-24", startTime: "09:00", endTime: "10:00" }),
      createScheduleEntry(scope, exam.id, { sectionId: section, subjectId: subject2Id, examDate: "2026-08-24", startTime: "11:00", endTime: "12:00" }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled").length).toBe(1);
    const count = await prisma.examScheduleEntry.count({ where: { sectionId: section, examDate: new Date("2026-08-24T00:00:00.000Z") } });
    expect(count).toBe(1);
  });

  it("CONCURRENCY: two concurrent creates of the same exam+section+subject → exactly one row survives", async () => {
    const { exam, section } = await examWithClass();
    const results = await Promise.allSettled([
      createScheduleEntry(scope, exam.id, { sectionId: section, subjectId, examDate: "2026-08-24", startTime: "09:00", endTime: "10:00" }),
      createScheduleEntry(scope, exam.id, { sectionId: section, subjectId, examDate: "2026-08-25", startTime: "09:00", endTime: "10:00" }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled").length).toBe(1);
    const count = await prisma.examScheduleEntry.count({ where: { examId: exam.id, sectionId: section, subjectId } });
    expect(count).toBe(1);
  });
});
