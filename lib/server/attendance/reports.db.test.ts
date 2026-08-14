// Attendance reporting DB-integration tests (Phase 5B). Real Postgres: dashboard
// today-counts + canonical %, marked/pending/eligible sections, below-minimum +
// consecutive-absence risk, reports (daily/trend/class/shortage/late-arrival/
// consecutive-absence), class/section filters on real ids, student aggregate over
// historical records, historical survival after unenrollment, zero-session
// safety, cross-school/branch/session isolation, feature entitlement, RBAC catalog,
// safe DTO shape, honest empty-DB result. Namespaced ("T5BR-").
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { getDashboard, getReport, ATTENDANCE_POLICY } from "@/lib/server/attendance/reports";
import { listHistory } from "@/lib/server/attendance/service";
import type { OrgScope } from "@/lib/server/api/scope";
import { ROLE_PERMISSIONS } from "@/lib/server/authz/catalog";

let dbReady = false;
try {
  dbReady = Boolean(await prisma.role.findFirst({ where: { key: "SCHOOL_ADMIN", isSystem: true } }));
} catch {
  dbReady = false;
}

const NS = "T5BR";
const stamp = Date.now().toString(36);
const actor = { id: "t5br-actor", name: "T5BR Tester" };

let tenantId = "", schoolId = "", branchA = "", branchB = "", sessionId = "";
let classId = "", sectionA = "", sectionB = "", sectionBranchB = "";
let scope: OrgScope;
// Second school (isolation) + no-feature + empty schools.
let schoolB = "", sectionSchoolB = "", scopeB: OrgScope;
let noFeatureScope: OrgScope, noFeatureSection = "";
let emptyScope: OrgScope;
const stu: Record<string, string> = {};
const enr: Record<string, string> = {};

// server-local "today" (matches serverToday()) + recent history days.
const today = new Date().toISOString().slice(0, 10);
function offsetDay(n: number): string {
  const d = new Date(`${today}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}
const d1 = offsetDay(1);
const d2 = offsetDay(2);

async function makeStudent(key: string, over: { schoolId?: string; branchId?: string; academicSessionId?: string } = {}) {
  const s = await prisma.student.create({
    data: {
      tenantId, schoolId: over.schoolId ?? schoolId, branchId: over.branchId ?? branchA, academicSessionId: over.academicSessionId ?? sessionId,
      admissionNumber: `${NS}-${stamp}-${key}`, firstName: key.toUpperCase(), lastName: "Test",
      dateOfBirth: new Date("2015-01-01"), admissionDate: new Date("2024-04-01"), status: "ACTIVE",
    },
    select: { id: true },
  });
  stu[key] = s.id;
  return s.id;
}
async function enroll(key: string, sectionId: string, cId = classId, branchId = branchA, sId = schoolId, acId = sessionId) {
  const e = await prisma.enrollment.create({ data: { tenantId, schoolId: sId, branchId, academicSessionId: acId, classId: cId, sectionId, studentId: stu[key], status: "ENROLLED" }, select: { id: true } });
  enr[key] = e.id;
  return e.id;
}
async function mkSession(sectionId: string, dateStr: string, recs: { key: string; status: string }[], branchId = branchA, sId = schoolId, acId = sessionId) {
  const session = await prisma.attendanceSession.create({
    data: { tenantId, schoolId: sId, branchId, academicSessionId: acId, sectionId, date: new Date(`${dateStr}T00:00:00.000Z`), status: "SUBMITTED", markedByName: "Class Teacher", submittedAt: new Date() },
    select: { id: true },
  });
  for (const r of recs) {
    await prisma.attendanceRecord.create({ data: { attendanceSessionId: session.id, studentId: stu[r.key], enrollmentId: enr[r.key] ?? null, status: r.status as never, markedAt: new Date() } });
  }
  return session.id;
}

beforeAll(async () => {
  if (!dbReady) return;
  tenantId = (await prisma.tenant.create({ data: { name: `${NS} T`, slug: `t5br-${stamp}` }, select: { id: true } })).id;
  schoolId = (await prisma.school.create({ data: { tenantId, name: `${NS} S`, code: `${NS}-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  branchA = (await prisma.branch.create({ data: { schoolId, name: "A", code: `${NS}-A`, status: "ACTIVE" }, select: { id: true } })).id;
  branchB = (await prisma.branch.create({ data: { schoolId, name: "B", code: `${NS}-B`, status: "ACTIVE" }, select: { id: true } })).id;
  sessionId = (await prisma.academicSession.create({ data: { schoolId, name: "26-27", code: `${NS}-S`, startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31"), status: "ACTIVE" }, select: { id: true } })).id;
  classId = (await prisma.class.create({ data: { tenantId, schoolId, academicSessionId: sessionId, name: "Grade 5", order: 5 }, select: { id: true } })).id;
  sectionA = (await prisma.section.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, classId, name: "A", capacity: 40, status: "ACTIVE" }, select: { id: true } })).id;
  sectionB = (await prisma.section.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, classId, name: "B", capacity: 40, status: "ACTIVE" }, select: { id: true } })).id;
  sectionBranchB = (await prisma.section.create({ data: { tenantId, schoolId, branchId: branchB, academicSessionId: sessionId, classId, name: "C", capacity: 40, status: "ACTIVE" }, select: { id: true } })).id;
  await prisma.schoolFeatureOverride.create({ data: { schoolId, tenantId, featureKey: "attendance", enabled: true } });
  scope = { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, actor: { id: actor.id, name: actor.name } };

  await makeStudent("a1"); await makeStudent("a2"); await makeStudent("a3"); await makeStudent("b1"); await makeStudent("bb", { branchId: branchB });
  await enroll("a1", sectionA); await enroll("a2", sectionA); await enroll("a3", sectionA);
  await enroll("b1", sectionB); // enrolled, but NEVER marked (zero-session student)
  await enroll("bb", sectionBranchB, classId, branchB);

  // Section A history (today + last 2 days). a3 absent every day → 0% + 3-day streak.
  await mkSession(sectionA, today, [{ key: "a1", status: "PRESENT" }, { key: "a2", status: "LATE" }, { key: "a3", status: "ABSENT" }]);
  await mkSession(sectionA, d1, [{ key: "a1", status: "PRESENT" }, { key: "a2", status: "PRESENT" }, { key: "a3", status: "ABSENT" }]);
  await mkSession(sectionA, d2, [{ key: "a1", status: "PRESENT" }, { key: "a2", status: "PRESENT" }, { key: "a3", status: "ABSENT" }]);

  // Second school with the feature — for cross-school isolation.
  schoolB = (await prisma.school.create({ data: { tenantId, name: `${NS} SB`, code: `${NS}-SB-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  const bBranch = (await prisma.branch.create({ data: { schoolId: schoolB, name: "SB", code: `${NS}-SBB`, status: "ACTIVE" }, select: { id: true } })).id;
  const bSession = (await prisma.academicSession.create({ data: { schoolId: schoolB, name: "26-27", code: `${NS}-SBS`, startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31"), status: "ACTIVE" }, select: { id: true } })).id;
  const bClass = (await prisma.class.create({ data: { tenantId, schoolId: schoolB, academicSessionId: bSession, name: "Grade 5", order: 5 }, select: { id: true } })).id;
  sectionSchoolB = (await prisma.section.create({ data: { tenantId, schoolId: schoolB, branchId: bBranch, academicSessionId: bSession, classId: bClass, name: "A", capacity: 40, status: "ACTIVE" }, select: { id: true } })).id;
  await prisma.schoolFeatureOverride.create({ data: { schoolId: schoolB, tenantId, featureKey: "attendance", enabled: true } });
  await makeStudent("sbStu", { schoolId: schoolB, branchId: bBranch, academicSessionId: bSession });
  await enroll("sbStu", sectionSchoolB, bClass, bBranch, schoolB, bSession);
  await mkSession(sectionSchoolB, today, [{ key: "sbStu", status: "ABSENT" }], bBranch, schoolB, bSession);
  scopeB = { tenantId, schoolId: schoolB, branchId: bBranch, academicSessionId: bSession, actor: { id: actor.id, name: actor.name } };

  // No-feature school.
  const nfSchool = (await prisma.school.create({ data: { tenantId, name: `${NS} NF`, code: `${NS}-NF-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  const nfBranch = (await prisma.branch.create({ data: { schoolId: nfSchool, name: "NF", code: `${NS}-NFB`, status: "ACTIVE" }, select: { id: true } })).id;
  const nfSession = (await prisma.academicSession.create({ data: { schoolId: nfSchool, name: "26-27", code: `${NS}-NFS`, startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31"), status: "ACTIVE" }, select: { id: true } })).id;
  const nfClass = (await prisma.class.create({ data: { tenantId, schoolId: nfSchool, academicSessionId: nfSession, name: "G1", order: 1 }, select: { id: true } })).id;
  noFeatureSection = (await prisma.section.create({ data: { tenantId, schoolId: nfSchool, branchId: nfBranch, academicSessionId: nfSession, classId: nfClass, name: "A", status: "ACTIVE" }, select: { id: true } })).id;
  noFeatureScope = { tenantId, schoolId: nfSchool, branchId: nfBranch, academicSessionId: nfSession, actor: { id: actor.id, name: actor.name } };

  // Empty school WITH the feature: one section + enrolled student, no attendance yet.
  const eSchool = (await prisma.school.create({ data: { tenantId, name: `${NS} E`, code: `${NS}-E-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  const eBranch = (await prisma.branch.create({ data: { schoolId: eSchool, name: "E", code: `${NS}-EB`, status: "ACTIVE" }, select: { id: true } })).id;
  const eSess = (await prisma.academicSession.create({ data: { schoolId: eSchool, name: "26-27", code: `${NS}-ES`, startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31"), status: "ACTIVE" }, select: { id: true } })).id;
  const eClass = (await prisma.class.create({ data: { tenantId, schoolId: eSchool, academicSessionId: eSess, name: "G1", order: 1 }, select: { id: true } })).id;
  const eSection = (await prisma.section.create({ data: { tenantId, schoolId: eSchool, branchId: eBranch, academicSessionId: eSess, classId: eClass, name: "A", status: "ACTIVE" }, select: { id: true } })).id;
  await prisma.schoolFeatureOverride.create({ data: { schoolId: eSchool, tenantId, featureKey: "attendance", enabled: true } });
  const eStu = (await prisma.student.create({ data: { tenantId, schoolId: eSchool, branchId: eBranch, academicSessionId: eSess, admissionNumber: `${NS}-${stamp}-e`, firstName: "E", lastName: "Test", dateOfBirth: new Date("2015-01-01"), admissionDate: new Date("2024-04-01"), status: "ACTIVE" }, select: { id: true } })).id;
  await prisma.enrollment.create({ data: { tenantId, schoolId: eSchool, branchId: eBranch, academicSessionId: eSess, classId: eClass, sectionId: eSection, studentId: eStu, status: "ENROLLED" } });
  emptyScope = { tenantId, schoolId: eSchool, branchId: eBranch, academicSessionId: eSess, actor: { id: actor.id, name: actor.name } };
});

afterAll(async () => {
  if (!dbReady || !tenantId) return;
  await prisma.auditEvent.deleteMany({ where: { tenantId } });
  await prisma.tenant.delete({ where: { id: tenantId } }); // cascades everything
});

describe.skipIf(!dbReady)("attendance reporting (DB)", () => {
  it("dashboard derives today's real counts with the canonical % formula", async () => {
    const d = await getDashboard(scope);
    expect(d.date).toBe(today);
    // today: 1 PRESENT + 1 LATE + 1 ABSENT → (present+late)/total = 2/3 → 67
    expect(d.presentTodayPct).toBe(67);
    expect(d.lateToday).toBe(1);
  });

  it("marked / pending / eligible section counts are correct", async () => {
    const d = await getDashboard(scope);
    expect(d.totalSections).toBe(2); // sectionA + sectionB (branchA, ACTIVE, ≥1 enrolled)
    expect(d.markedSections).toBe(1); // only sectionA has a submitted session today
    expect(d.pendingSections).toBe(1); // sectionB not marked today
  });

  it("below-minimum + consecutive-absence risk come from historical records", async () => {
    const d = await getDashboard(scope);
    expect(d.belowMinimumCount).toBe(1); // a3 (0%)
    expect(d.consecutiveAbsenceRiskCount).toBe(1); // a3 (3-day streak ≥ 3)
    expect(d.policy.shortageThresholdPct).toBe(ATTENDANCE_POLICY.shortageThresholdPct);
    expect(d.policy.consecutiveAbsenceThreshold).toBe(ATTENDANCE_POLICY.consecutiveAbsenceThreshold);
  });

  it("daily report lists today's per-section session with canonical %", async () => {
    const r = await getReport(scope, { type: "daily" });
    expect(r.columns).toContain("Attendance %");
    expect(r.rows.length).toBe(1);
    expect(r.rows[0]).toMatchObject({ Section: "A", Present: 1, Absent: 1, Late: 1, "Attendance %": 67, "Marked by": "Class Teacher" });
  });

  it("monthly-trend report uses real queried days", async () => {
    const r = await getReport(scope, { type: "monthly-trend" });
    const dates = r.rows.map((row) => row.Date);
    expect(dates).toEqual([d2, d1, today]);
    expect(r.rows.every((row) => row["Present %"] === 67)).toBe(true);
  });

  it("class report aggregates a section across its history", async () => {
    const r = await getReport(scope, { type: "class" });
    const secA = r.rows.find((row) => row.Section === "A");
    expect(secA).toMatchObject({ Sessions: 9, "Attendance %": 67 }); // 3 students × 3 days; 6/9 attended
  });

  it("shortage report flags below-threshold students; zero-session students are NOT flagged", async () => {
    const r = await getReport(scope, { type: "shortage" });
    expect(r.threshold).toBe(75);
    const admissions = r.rows.map((row) => row["Admission No."]);
    expect(admissions).toContain(`${NS}-${stamp}-a3`); // 0%
    expect(admissions).not.toContain(`${NS}-${stamp}-a1`); // 100%
    expect(admissions).not.toContain(`${NS}-${stamp}-b1`); // never marked → null %, excluded
  });

  it("consecutive-absence report reports the real streak", async () => {
    const r = await getReport(scope, { type: "consecutive-absence" });
    expect(r.threshold).toBe(3);
    const a3 = r.rows.find((row) => row.Student === "A3 Test");
    expect(a3).toMatchObject({ "Consecutive absences": 3 });
  });

  it("late-arrival report lists real LATE records", async () => {
    const r = await getReport(scope, { type: "late-arrival" });
    expect(r.rows.some((row) => row.Student === "A2 Test" && row.Date === today)).toBe(true);
    expect(r.rows.every((row) => row.Student !== "A1 Test")).toBe(true); // A1 never late
  });

  it("section + class filters use real ids (report + history)", async () => {
    const bySection = await getReport(scope, { type: "class", sectionId: sectionA });
    expect(bySection.rows.length).toBe(1);
    const byClass = await getReport(scope, { type: "class", classId: classId });
    expect(byClass.rows.length).toBe(1); // only sectionA has records in this class
    const emptySection = await getReport(scope, { type: "class", sectionId: sectionB });
    expect(emptySection.rows.length).toBe(0); // sectionB has no records

    const hist = await listHistory(scope, { page: 1, pageSize: 50, sectionId: sectionA });
    expect(hist.data.length).toBe(3);
    expect(hist.data.every((s) => s.section.id === sectionA)).toBe(true);
    const histByClass = await listHistory(scope, { page: 1, pageSize: 50, classId });
    expect(histByClass.data.every((s) => s.class.id === classId)).toBe(true);
  });

  it("date filter narrows the report to the requested range", async () => {
    const r = await getReport(scope, { type: "class", dateFrom: today, dateTo: today });
    expect(r.rows.find((row) => row.Section === "A")).toMatchObject({ Sessions: 3 }); // only today
  });

  it("historical attendance survives an enrollment change (unenroll)", async () => {
    const secC = (await prisma.section.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, classId, name: "Z", capacity: 40, status: "ACTIVE" }, select: { id: true } })).id;
    await makeStudent("a4");
    await enroll("a4", secC);
    const sess = await mkSession(secC, d2, [{ key: "a4", status: "ABSENT" }]);
    await prisma.enrollment.delete({ where: { id: enr.a4 } }); // student leaves the section
    const rec = await prisma.attendanceRecord.findFirst({ where: { attendanceSessionId: sess, studentId: stu.a4 }, select: { status: true, enrollmentId: true } });
    expect(rec).not.toBeNull();
    expect(rec!.status).toBe("ABSENT");
    expect(rec!.enrollmentId).toBeNull(); // SetNull preserved the historical record
    // Aggregate still counts the historical record (section/class fall back to "—").
    const r = await getReport(scope, { type: "shortage", sectionId: secC });
    expect(r.rows.some((row) => row["Admission No."] === `${NS}-${stamp}-a4`)).toBe(true);
  });

  it("cross-school isolation: school A never sees school B data, and a foreign filter is empty", async () => {
    const d = await getDashboard(scope);
    expect(d.totalSections).toBe(2); // schoolB section excluded
    // Supplying schoolB's sectionId to a schoolA-scoped report yields nothing.
    const leak = await getReport(scope, { type: "class", sectionId: sectionSchoolB });
    expect(leak.rows.length).toBe(0);
    // schoolB's own scope sees only its data.
    const db = await getDashboard(scopeB);
    expect(db.totalSections).toBe(1);
  });

  it("cross-branch + cross-session isolation", async () => {
    const d = await getDashboard(scope); // branchA scope
    expect(d.totalSections).toBe(2); // sectionBranchB (branchB) excluded
    const wrongSession: OrgScope = { ...scope, academicSessionId: "nope" };
    const dws = await getDashboard(wrongSession);
    expect(dws.totalSections).toBe(0);
    expect(dws.belowMinimumCount).toBe(0);
    const rep = await getReport(wrongSession, { type: "shortage" });
    expect(rep.rows.length).toBe(0);
  });

  it("feature entitlement is enforced (school without attendance → FEATURE_DISABLED)", async () => {
    await expect(getDashboard(noFeatureScope)).rejects.toMatchObject({ code: "FEATURE_DISABLED" });
    await expect(getReport(noFeatureScope, { type: "daily" })).rejects.toMatchObject({ code: "FEATURE_DISABLED" });
    expect(noFeatureSection).toBeTruthy();
  });

  it("empty (feature-enabled) school returns an honest zero/empty result, never seeded data", async () => {
    const d = await getDashboard(emptyScope);
    expect(d.presentTodayPct).toBeNull();
    expect(d.lateToday).toBe(0);
    expect(d.markedSections).toBe(0);
    expect(d.totalSections).toBe(1);
    expect(d.pendingSections).toBe(1);
    expect(d.belowMinimumCount).toBe(0);
    expect(d.consecutiveAbsenceRiskCount).toBe(0);
    const r = await getReport(emptyScope, { type: "shortage" });
    expect(r.rows).toEqual([]);
  });

  it("DTOs expose only safe display fields (no studentId / user fields)", async () => {
    const d = await getDashboard(scope);
    expect(Object.keys(d).sort()).toEqual([
      "belowMinimumCount", "consecutiveAbsenceRiskCount", "date", "lateToday",
      "markedSections", "pendingSections", "policy", "presentTodayPct", "totalSections",
    ]);
    const r = await getReport(scope, { type: "shortage" });
    for (const row of r.rows) {
      expect(Object.keys(row)).toEqual(["Student", "Admission No.", "Class", "Section", "Sessions", "Attendance %"]);
      expect(Object.keys(row)).not.toContain("studentId");
    }
  });

  it("RBAC: attendance.view is held by reader roles; reports never require attendance.mark", () => {
    expect(ROLE_PERMISSIONS.SCHOOL_ADMIN).toContain("attendance.view");
    expect(ROLE_PERMISSIONS.PRINCIPAL).toContain("attendance.view");
    expect(ROLE_PERMISSIONS.LIBRARIAN ?? []).not.toContain("attendance.view");
  });
});
