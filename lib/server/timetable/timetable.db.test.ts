// Timetable DB integration tests (Phase 7). Real Postgres: bell-schedule reconcile
// (overlap / range / duplicate-number / break type), entry validation (subject
// offered, TeachingAssignment authoritative, active teaching staff, break periods
// rejected), section + teacher conflicts (DB-enforced), allowed non-conflicts,
// update/move, delete, scope isolation, RBAC catalog, audit, AND a concurrency
// race proving exactly one of two conflicting inserts survives. Namespaced ("T7").
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { listPeriods, reconcilePeriods } from "@/lib/server/timetable/periods-service";
import { createEntry, deleteEntry, getSectionTimetable, getTeacherTimetable, updateEntry } from "@/lib/server/timetable/entries-service";
import type { OrgScope } from "@/lib/server/api/scope";
import { ROLE_PERMISSIONS } from "@/lib/server/authz/catalog";

let dbReady = false;
try {
  dbReady = Boolean(await prisma.role.findFirst({ where: { key: "SCHOOL_ADMIN", isSystem: true } }));
} catch {
  dbReady = false;
}

const NS = "T7";
const stamp = Date.now().toString(36);
const actor = { id: "t7-actor", name: "T7 Tester" };

let tenantId = "", schoolId = "", branchA = "", sessionId = "", classId = "";
let section1 = "", section2 = "", subjectId = "", offSubjectId = "";
let staff1 = "", staff2 = "", ta1 = "", ta1b = "", ta2 = "";
let scope: OrgScope;
let scopeB: OrgScope; // foreign school
let p1 = "", p2 = "", pBreak = "";

async function reseedPeriods() {
  await reconcilePeriods(scope, {
    periods: [
      { name: "P1", periodNumber: 1, startTime: "08:00", endTime: "08:45", type: "teaching" },
      { name: "P2", periodNumber: 2, startTime: "08:45", endTime: "09:30", type: "teaching" },
      { name: "Lunch", periodNumber: 3, startTime: "09:30", endTime: "10:00", type: "break" },
    ],
  });
  const periods = await listPeriods(scope);
  p1 = periods.find((p) => p.periodNumber === 1)!.id;
  p2 = periods.find((p) => p.periodNumber === 2)!.id;
  pBreak = periods.find((p) => p.periodNumber === 3)!.id;
}

beforeAll(async () => {
  if (!dbReady) return;
  tenantId = (await prisma.tenant.create({ data: { name: `${NS} T`, slug: `t7-${stamp}` }, select: { id: true } })).id;
  schoolId = (await prisma.school.create({ data: { tenantId, name: `${NS} S`, code: `${NS}-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  branchA = (await prisma.branch.create({ data: { schoolId, name: "A", code: `${NS}-A`, status: "ACTIVE" }, select: { id: true } })).id;
  sessionId = (await prisma.academicSession.create({ data: { schoolId, name: "26-27", code: `${NS}-S`, startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31"), status: "ACTIVE" }, select: { id: true } })).id;
  classId = (await prisma.class.create({ data: { tenantId, schoolId, academicSessionId: sessionId, name: "Grade 5", order: 5 }, select: { id: true } })).id;
  section1 = (await prisma.section.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, classId, name: "A", status: "ACTIVE" }, select: { id: true } })).id;
  section2 = (await prisma.section.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, classId, name: "B", status: "ACTIVE" }, select: { id: true } })).id;
  subjectId = (await prisma.subject.create({ data: { tenantId, schoolId, code: `${NS}-M`, name: "Math", shortName: "M", department: "Math", type: "CORE" }, select: { id: true } })).id;
  offSubjectId = (await prisma.subject.create({ data: { tenantId, schoolId, code: `${NS}-A`, name: "Art", shortName: "A", department: "Arts", type: "ELECTIVE" }, select: { id: true } })).id;
  await prisma.classSubject.create({ data: { tenantId, schoolId, academicSessionId: sessionId, classId, subjectId } });
  staff1 = (await prisma.staff.create({ data: { tenantId, schoolId, branchId: branchA, employeeCode: `${NS}-T1`, firstName: "Tara", isTeaching: true, status: "ACTIVE" }, select: { id: true } })).id;
  staff2 = (await prisma.staff.create({ data: { tenantId, schoolId, branchId: branchA, employeeCode: `${NS}-T2`, firstName: "Ravi", isTeaching: true, status: "ACTIVE" }, select: { id: true } })).id;
  ta1 = (await prisma.teachingAssignment.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, sectionId: section1, subjectId, staffId: staff1 }, select: { id: true } })).id;
  ta1b = (await prisma.teachingAssignment.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, sectionId: section2, subjectId, staffId: staff1 }, select: { id: true } })).id;
  ta2 = (await prisma.teachingAssignment.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, sectionId: section1, subjectId, staffId: staff2 }, select: { id: true } })).id;
  scope = { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, actor: { id: actor.id, name: actor.name } };

  const sB = (await prisma.school.create({ data: { tenantId, name: `${NS} SB`, code: `${NS}-SB-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  const bB = (await prisma.branch.create({ data: { schoolId: sB, name: "B", code: `${NS}-BB`, status: "ACTIVE" }, select: { id: true } })).id;
  const seB = (await prisma.academicSession.create({ data: { schoolId: sB, name: "26-27", code: `${NS}-SBS`, startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31"), status: "ACTIVE" }, select: { id: true } })).id;
  scopeB = { tenantId, schoolId: sB, branchId: bB, academicSessionId: seB, actor: { id: actor.id, name: actor.name } };

  await reseedPeriods();
  expect([ta1b, ta2]).toBeTruthy();
});

afterAll(async () => {
  if (!dbReady || !tenantId) return;
  await prisma.auditEvent.deleteMany({ where: { tenantId } });
  await prisma.tenant.delete({ where: { id: tenantId } });
});

describe.skipIf(!dbReady)("timetable periods (DB)", () => {
  it("reconcile stores periods with minute times + break type; list is scoped", async () => {
    const periods = await listPeriods(scope);
    expect(periods.length).toBe(3);
    const p = periods.find((x) => x.periodNumber === 1)!;
    expect(p).toMatchObject({ startTime: "08:00", endTime: "08:45", startMinutes: 480, endMinutes: 525, type: "teaching" });
    expect(periods.find((x) => x.periodNumber === 3)!.type).toBe("break");
    // audit
    const audit = await prisma.auditEvent.findFirst({ where: { tenantId, action: "TIMETABLE_PERIODS_UPDATED" } });
    expect(audit).not.toBeNull();
    // foreign scope sees nothing
    expect(await listPeriods(scopeB)).toEqual([]);
  });

  it("rejects start>=end, overlaps and duplicate numbers", async () => {
    await expect(reconcilePeriods(scope, { periods: [{ name: "X", periodNumber: 1, startTime: "10:00", endTime: "09:00", type: "teaching" }] })).rejects.toMatchObject({ code: "INVALID_TIMETABLE_PERIOD" });
    await expect(reconcilePeriods(scope, { periods: [
      { name: "A", periodNumber: 1, startTime: "08:00", endTime: "09:00", type: "teaching" },
      { name: "B", periodNumber: 2, startTime: "08:30", endTime: "09:30", type: "teaching" },
    ] })).rejects.toMatchObject({ code: "INVALID_TIMETABLE_PERIOD" });
    await expect(reconcilePeriods(scope, { periods: [
      { name: "A", periodNumber: 1, startTime: "08:00", endTime: "09:00", type: "teaching" },
      { name: "B", periodNumber: 1, startTime: "09:00", endTime: "10:00", type: "teaching" },
    ] })).rejects.toMatchObject({ code: "INVALID_TIMETABLE_PERIOD" });
    // invalid state didn't wipe the good schedule
    expect((await listPeriods(scope)).length).toBe(3);
  });

  it("RBAC: timetable.manage held by admin/principal, view by teacher", () => {
    expect(ROLE_PERMISSIONS.SCHOOL_ADMIN).toContain("timetable.manage");
    expect(ROLE_PERMISSIONS.PRINCIPAL).toContain("timetable.manage");
    expect(ROLE_PERMISSIONS.TEACHER).toContain("timetable.view");
    expect(ROLE_PERMISSIONS.TEACHER).not.toContain("timetable.manage");
  });
});

describe.skipIf(!dbReady)("timetable entries (DB)", () => {
  it("creates a valid entry + audit; section timetable is grid-friendly", async () => {
    const e = await createEntry(scope, { sectionId: section1, subjectId, staffId: staff1, periodId: p1, weekday: "monday" });
    expect(e).toMatchObject({ weekday: "monday", periodId: p1, teachingAssignmentId: ta1 });
    expect(e.subject.name).toBe("Math");
    const audit = await prisma.auditEvent.findFirst({ where: { tenantId, action: "TIMETABLE_ENTRY_CREATED", entityId: e.id } });
    expect(audit).not.toBeNull();
    const grid = await getSectionTimetable(scope, section1);
    expect(grid.periods.length).toBe(3);
    expect(grid.weekdays).toContain("monday");
    expect(grid.entries.some((x) => x.id === e.id)).toBe(true);
    await deleteEntry(scope, e.id);
  });

  it("rejects: subject not offered, teacher not assigned, break period", async () => {
    await expect(createEntry(scope, { sectionId: section1, subjectId: offSubjectId, staffId: staff1, periodId: p1, weekday: "monday" })).rejects.toMatchObject({ code: "SUBJECT_NOT_OFFERED" });
    // staff2 has an assignment for section1, but a staff with NO assignment:
    const stranger = await prisma.staff.create({ data: { tenantId, schoolId, branchId: branchA, employeeCode: `${NS}-STR`, firstName: "Stray", isTeaching: true, status: "ACTIVE" }, select: { id: true } });
    await expect(createEntry(scope, { sectionId: section1, subjectId, staffId: stranger.id, periodId: p1, weekday: "monday" })).rejects.toMatchObject({ code: "TEACHER_NOT_ASSIGNED" });
    await expect(createEntry(scope, { sectionId: section1, subjectId, staffId: staff1, periodId: pBreak, weekday: "monday" })).rejects.toMatchObject({ code: "INVALID_TIMETABLE_PERIOD" });
  });

  it("rejects an inactive assigned teacher", async () => {
    await prisma.staff.update({ where: { id: staff2 }, data: { status: "INACTIVE" } });
    await expect(createEntry(scope, { sectionId: section1, subjectId, staffId: staff2, periodId: p1, weekday: "tuesday" })).rejects.toMatchObject({ code: "TEACHER_NOT_ASSIGNED" });
    await prisma.staff.update({ where: { id: staff2 }, data: { status: "ACTIVE" } });
  });

  it("SECTION conflict: same section+weekday+period is rejected (409)", async () => {
    const e = await createEntry(scope, { sectionId: section1, subjectId, staffId: staff1, periodId: p1, weekday: "wednesday" });
    await expect(createEntry(scope, { sectionId: section1, subjectId, staffId: staff2, periodId: p1, weekday: "wednesday" })).rejects.toMatchObject({ code: "TIMETABLE_SECTION_CONFLICT" });
    await deleteEntry(scope, e.id);
  });

  it("TEACHER conflict: same teacher+weekday+period across sections is rejected (409)", async () => {
    const e = await createEntry(scope, { sectionId: section1, subjectId, staffId: staff1, periodId: p1, weekday: "thursday" });
    await expect(createEntry(scope, { sectionId: section2, subjectId, staffId: staff1, periodId: p1, weekday: "thursday" })).rejects.toMatchObject({ code: "TIMETABLE_TEACHER_CONFLICT" });
    await deleteEntry(scope, e.id);
  });

  it("allows non-conflicts: different teacher same slot other section; same teacher other period; same section other period", async () => {
    const a = await createEntry(scope, { sectionId: section1, subjectId, staffId: staff1, periodId: p1, weekday: "friday" });
    const b = await createEntry(scope, { sectionId: section2, subjectId, staffId: staff2 === staff2 ? (await ensureAssign(section2, staff2)) : staff2, periodId: p1, weekday: "friday" }); // different teacher, other section, same slot
    const c = await createEntry(scope, { sectionId: section1, subjectId, staffId: staff1, periodId: p2, weekday: "friday" }); // same teacher, other period
    expect([a.id, b.id, c.id].every(Boolean)).toBe(true);
    await deleteEntry(scope, a.id); await deleteEntry(scope, b.id); await deleteEntry(scope, c.id);
  });

  it("update/move re-checks conflicts; foreign section + session isolation", async () => {
    const a = await createEntry(scope, { sectionId: section1, subjectId, staffId: staff1, periodId: p1, weekday: "monday" });
    const moved = await updateEntry(scope, a.id, { periodId: p2 });
    expect(moved.periodId).toBe(p2);
    // moving onto an occupied slot conflicts
    const b = await createEntry(scope, { sectionId: section1, subjectId, staffId: staff1, periodId: p1, weekday: "monday" });
    await expect(updateEntry(scope, b.id, { periodId: p2 })).rejects.toMatchObject({ code: "TIMETABLE_SECTION_CONFLICT" });
    await deleteEntry(scope, a.id); await deleteEntry(scope, b.id);
    await expect(getSectionTimetable(scope, "nope")).rejects.toMatchObject({ code: "NOT_FOUND" });
    const wrongSession: OrgScope = { ...scope, academicSessionId: "nope" };
    await expect(createEntry(wrongSession, { sectionId: section1, subjectId, staffId: staff1, periodId: p1, weekday: "monday" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("teacher timetable returns that teacher's entries only", async () => {
    const a = await createEntry(scope, { sectionId: section1, subjectId, staffId: staff1, periodId: p1, weekday: "monday" });
    const tt = await getTeacherTimetable(scope, staff1);
    expect(tt.entries.some((x) => x.id === a.id)).toBe(true);
    expect(tt.entries.every((x) => x.staff.id === staff1)).toBe(true);
    await deleteEntry(scope, a.id);
  });
});

async function ensureAssign(sectionId: string, staffId: string): Promise<string> {
  await prisma.teachingAssignment.upsert({
    where: { sectionId_subjectId_staffId: { sectionId, subjectId, staffId } },
    create: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, sectionId, subjectId, staffId },
    update: {},
  });
  return staffId;
}

describe.skipIf(!dbReady)("timetable concurrency (DB)", () => {
  it("SECTION race: two concurrent inserts for same section+slot → exactly one survives", async () => {
    const wd = "saturday" as const;
    const results = await Promise.allSettled([
      createEntry(scope, { sectionId: section1, subjectId, staffId: staff1, periodId: p1, weekday: wd }),
      createEntry(scope, { sectionId: section1, subjectId, staffId: staff2, periodId: p1, weekday: wd }),
    ]);
    const ok = results.filter((r) => r.status === "fulfilled");
    expect(ok.length).toBe(1);
    const count = await prisma.timetableEntry.count({ where: { sectionId: section1, weekday: "SATURDAY", periodId: p1 } });
    expect(count).toBe(1);
    await prisma.timetableEntry.deleteMany({ where: { sectionId: section1, weekday: "SATURDAY", periodId: p1 } });
  });

  it("TEACHER race: two concurrent inserts for same teacher+slot (different sections) → exactly one survives", async () => {
    const wd = "saturday" as const;
    const results = await Promise.allSettled([
      createEntry(scope, { sectionId: section1, subjectId, staffId: staff1, periodId: p2, weekday: wd }),
      createEntry(scope, { sectionId: section2, subjectId, staffId: staff1, periodId: p2, weekday: wd }),
    ]);
    const ok = results.filter((r) => r.status === "fulfilled");
    expect(ok.length).toBe(1);
    const count = await prisma.timetableEntry.count({ where: { staffId: staff1, weekday: "SATURDAY", periodId: p2 } });
    expect(count).toBe(1);
    await prisma.timetableEntry.deleteMany({ where: { staffId: staff1, weekday: "SATURDAY", periodId: p2 } });
  });
});
