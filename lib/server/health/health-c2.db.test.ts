// Health Medications (cross-visit log) + Reports DB integration tests
// (Phase C2). Real Postgres. Extends the Phase 9R Health foundation — see
// lib/server/health/health.db.test.ts for that domain's own tests. Covers:
// sensitive-content gating (medication list/detail entirely hidden without
// health.viewSensitive — no partial redaction, matching getVisitDetail's own
// precedent), search/pagination, patient resolution, reports aggregate
// accuracy (visitsByReason gated the same way), cross-tenant isolation, DTO
// safety. Namespaced ("TC2"). No Incidents/Appointments tests — deliberately
// deferred this phase (see app/health/incidents and app/health/appointments).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { closeVisit, createVisit } from "@/lib/server/health/visits";
import { getMedicationAdministration, listMedicationAdministrations, recordMedicationAdministration } from "@/lib/server/health/medications";
import { getHealthReports } from "@/lib/server/health/reports";
import { HttpError } from "@/lib/server/api/guard";
import type { OrgScope } from "@/lib/server/api/scope";

let dbReady = false;
try {
  dbReady = Boolean(await prisma.role.findFirst({ where: { key: "SCHOOL_ADMIN", isSystem: true } }));
} catch {
  dbReady = false;
}

const NS = "TC2";
const stamp = Date.now().toString(36);

let tenantId = "", schoolId = "", branchA = "", sessionId = "";
let student1 = "", student2 = "";
let foreignTenantId = "", foreignSchoolId = "", foreignBranchId = "", foreignStudentId = "";
let scopeAdmin: OrgScope, scopeForeignAdmin: OrgScope;
let adminUser = "", foreignAdminUser = "";

async function makeUserWithRole(email: string, roleKey: string, tid = tenantId): Promise<string> {
  const u = await prisma.user.create({ data: { email, name: email, status: "ACTIVE" }, select: { id: true } });
  const m = await prisma.tenantMembership.create({ data: { userId: u.id, tenantId: tid, status: "ACTIVE" }, select: { id: true } });
  const role = await prisma.role.findFirstOrThrow({ where: { key: roleKey, isSystem: true }, select: { id: true } });
  await prisma.roleAssignment.create({ data: { membershipId: m.id, roleId: role.id } });
  return u.id;
}

async function makeStudent(suffix: string, tid = tenantId, sid = schoolId, bid = branchA, sessId = sessionId): Promise<string> {
  return (await prisma.student.create({
    data: { tenantId: tid, schoolId: sid, branchId: bid, academicSessionId: sessId, admissionNumber: `${NS}-${stamp}-${suffix}`, firstName: suffix, lastName: "T", dateOfBirth: new Date("2012-01-01"), admissionDate: new Date("2024-04-01"), status: "ACTIVE" },
    select: { id: true },
  })).id;
}

beforeAll(async () => {
  if (!dbReady) return;
  tenantId = (await prisma.tenant.create({ data: { name: `${NS} T`, slug: `tc2-${stamp}` }, select: { id: true } })).id;
  schoolId = (await prisma.school.create({ data: { tenantId, name: `${NS} S`, code: `${NS}-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  branchA = (await prisma.branch.create({ data: { schoolId, name: "A", code: `${NS}-A`, status: "ACTIVE" }, select: { id: true } })).id;
  sessionId = (await prisma.academicSession.create({ data: { schoolId, name: "26-27", code: `${NS}-S`, startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31"), status: "ACTIVE" }, select: { id: true } })).id;

  adminUser = await makeUserWithRole(`tc2-admin-${stamp}@x.test`, "SCHOOL_ADMIN");
  scopeAdmin = { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, actor: { id: adminUser, name: "Admin" } };

  student1 = await makeStudent("s1");
  student2 = await makeStudent("s2");

  foreignTenantId = (await prisma.tenant.create({ data: { name: `${NS} T2`, slug: `tc2-b-${stamp}` }, select: { id: true } })).id;
  foreignSchoolId = (await prisma.school.create({ data: { tenantId: foreignTenantId, name: `${NS} S2`, code: `${NS}-B-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  foreignBranchId = (await prisma.branch.create({ data: { schoolId: foreignSchoolId, name: "B", code: `${NS}-B`, status: "ACTIVE" }, select: { id: true } })).id;
  const foreignSession = (await prisma.academicSession.create({ data: { schoolId: foreignSchoolId, name: "26-27", code: `${NS}-BS`, startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31"), status: "ACTIVE" }, select: { id: true } })).id;
  foreignStudentId = await makeStudent("foreign", foreignTenantId, foreignSchoolId, foreignBranchId, foreignSession);
  foreignAdminUser = await makeUserWithRole(`tc2-fadmin-${stamp}@x.test`, "SCHOOL_ADMIN", foreignTenantId);
  scopeForeignAdmin = { tenantId: foreignTenantId, schoolId: foreignSchoolId, branchId: foreignBranchId, academicSessionId: foreignSession, actor: { id: foreignAdminUser, name: "Foreign Admin" } };
});

afterAll(async () => {
  if (!dbReady || !tenantId) return;
  await prisma.auditEvent.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.healthMedicationAdministration.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.healthTreatmentRecord.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.healthVitalObservation.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.healthVisit.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.student.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.staff.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.roleAssignment.deleteMany({ where: { membership: { tenantId: { in: [tenantId, foreignTenantId] } } } });
  await prisma.tenantMembership.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.academicSession.deleteMany({ where: { schoolId: { in: [schoolId, foreignSchoolId] } } });
  await prisma.branch.deleteMany({ where: { schoolId: { in: [schoolId, foreignSchoolId] } } });
  await prisma.school.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.user.deleteMany({ where: { id: { in: [adminUser, foreignAdminUser] } } });
  await prisma.tenant.deleteMany({ where: { id: { in: [tenantId, foreignTenantId] } } });
});

describe.skipIf(!dbReady)("Medications cross-visit log (DB)", () => {
  it("is entirely hidden (list and detail) without health.viewSensitive — never partially redacted", async () => {
    const v = await createVisit(scopeAdmin, { studentId: student1, reason: "Sensitivity test" });
    const m = await recordMedicationAdministration(scopeAdmin, v.id, { medicationName: "Cetirizine" });

    const nonSensitiveList = await listMedicationAdministrations(scopeAdmin, false, {});
    expect(nonSensitiveList.data).toEqual([]);
    expect(nonSensitiveList.meta.total).toBe(0);

    await expect(getMedicationAdministration(scopeAdmin, m.id, false)).rejects.toThrow(HttpError);

    const sensitiveDetail = await getMedicationAdministration(scopeAdmin, m.id, true);
    expect(sensitiveDetail.medicationName).toBe("Cetirizine");
  });

  it("resolves the real patient (student) from the parent visit, and supports search + pagination", async () => {
    const v1 = await createVisit(scopeAdmin, { studentId: student1, reason: "Med list test" });
    await recordMedicationAdministration(scopeAdmin, v1.id, { medicationName: "Paracetamol-XYZ", quantity: "1", unit: "tablet" });
    const v2 = await createVisit(scopeAdmin, { studentId: student2, reason: "Med list test 2" });
    await recordMedicationAdministration(scopeAdmin, v2.id, { medicationName: "Ibuprofen-XYZ" });

    const all = await listMedicationAdministrations(scopeAdmin, true, { search: "XYZ", page: 1, pageSize: 1 });
    expect(all.meta.total).toBe(2);
    expect(all.data.length).toBe(1);
    expect(all.data[0].patientType).toBe("student");
    expect([student1, student2]).toContain(all.data[0].patientId);

    const byStudent = await listMedicationAdministrations(scopeAdmin, true, { studentId: student1 });
    expect(byStudent.data.every((d) => d.patientId === student1)).toBe(true);
  });

  it("cross-tenant isolation", async () => {
    const v = await createVisit(scopeForeignAdmin, { studentId: foreignStudentId, reason: "Foreign" });
    const m = await recordMedicationAdministration(scopeForeignAdmin, v.id, { medicationName: "ForeignMed" });
    const list = await listMedicationAdministrations(scopeAdmin, true, {});
    expect(list.data.some((d) => d.id === m.id)).toBe(false);
    await expect(getMedicationAdministration(scopeAdmin, m.id, true)).rejects.toThrow(HttpError);
  });

  it("DTO never leaks tenantId/schoolId", async () => {
    const v = await createVisit(scopeAdmin, { studentId: student1, reason: "DTO test" });
    const m = await recordMedicationAdministration(scopeAdmin, v.id, { medicationName: "DtoMed" });
    const raw = JSON.stringify(await getMedicationAdministration(scopeAdmin, m.id, true));
    expect(raw).not.toContain(tenantId);
    expect(raw).not.toContain(schoolId);
  });
});

describe.skipIf(!dbReady)("Health Reports (DB)", () => {
  it("aggregates match real persisted counts, and visitsByReason is gated by sensitive", async () => {
    const v1 = await createVisit(scopeAdmin, { studentId: student1, reason: "Report reason A" });
    await recordMedicationAdministration(scopeAdmin, v1.id, { medicationName: "ReportMed" });
    await closeVisit(scopeAdmin, v1.id);
    await createVisit(scopeAdmin, { studentId: student2, reason: "Report reason B" });

    const report = await getHealthReports(scopeAdmin, true);
    expect(report.totalVisits).toBeGreaterThanOrEqual(2);
    expect(report.closedVisits).toBeGreaterThanOrEqual(1);
    expect(report.openVisits).toBeGreaterThanOrEqual(1);
    expect(report.medicationsRecorded).toBeGreaterThanOrEqual(1);
    expect(report.visitsByReason.length).toBeGreaterThan(0);

    const nonSensitiveReport = await getHealthReports(scopeAdmin, false);
    expect(nonSensitiveReport.totalVisits).toBe(report.totalVisits);
    expect(nonSensitiveReport.visitsByReason).toEqual([]);
  });

  it("school isolation: a foreign school's data never leaks into another school's report", async () => {
    await createVisit(scopeForeignAdmin, { studentId: foreignStudentId, reason: "Foreign report visit" });
    const foreignReport = await getHealthReports(scopeForeignAdmin, true);
    const mainReport = await getHealthReports(scopeAdmin, true);
    expect(foreignReport.totalVisits).toBeGreaterThanOrEqual(1);
    expect(foreignReport.visitsByReason.some((r) => r.reason === "Foreign report visit")).toBe(true);
    expect(mainReport.visitsByReason.some((r) => r.reason === "Foreign report visit")).toBe(false);
  });

  it("empty data: a school with zero visits reports all-zero counts", async () => {
    const emptyTenant = await prisma.tenant.create({ data: { name: `${NS} Empty`, slug: `tc2-empty-${stamp}` }, select: { id: true } });
    const emptySchool = await prisma.school.create({ data: { tenantId: emptyTenant.id, name: `${NS} Empty S`, code: `${NS}-EMPTY-${stamp}`, status: "ACTIVE" }, select: { id: true } });
    const emptyScope: OrgScope = { tenantId: emptyTenant.id, schoolId: emptySchool.id, branchId: null, academicSessionId: null, actor: { id: adminUser, name: "Admin" } };
    const report = await getHealthReports(emptyScope, true);
    expect(report).toEqual({ totalVisits: 0, openVisits: 0, closedVisits: 0, referredVisits: 0, medicationsRecorded: 0, followUpsPending: 0, visitsByReason: [] });
    await prisma.school.delete({ where: { id: emptySchool.id } });
    await prisma.tenant.delete({ where: { id: emptyTenant.id } });
  });
});
