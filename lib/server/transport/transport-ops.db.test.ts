// Transport checkpoint DB integration tests. Real Postgres: Incidents
// (report/status transitions/isolation), Maintenance (schedule/start/
// complete + concurrency-safe status transition, mirroring Trip's
// transition() guard), Fuel (Decimal-safe cost, electric-vehicle rejection),
// Documents (metadata-only compliance + expired/expiring-soon/blocked
// derivation), Fees (thin view over the real Phase 9F engine — honest empty
// state when no "Transport" category exists, real aggregation once one
// does), Notifications (real Phase 9D engine — staff-linked-User-only
// fanout). Namespaced ("TOPS"). Mirrors transport.db.test.ts's setup pattern.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { reportIncident, updateIncidentStatus, listIncidents } from "@/lib/server/transport/incidents";
import { scheduleMaintenance, startMaintenance, completeMaintenance, listMaintenanceRecords, getMaintenanceInsights } from "@/lib/server/transport/maintenance";
import { logFuelEntry, listFuelLogs, getFuelInsights } from "@/lib/server/transport/fuel";
import { addDocument, listDocuments, getComplianceSummary } from "@/lib/server/transport/documents";
import { getTransportFeesSummary } from "@/lib/server/transport/fees";
import { sendTransportNotification, listTransportNotifications } from "@/lib/server/transport/notifications";
import { createFeeCategory } from "@/lib/server/fees/categories";
import { createFeeStructure } from "@/lib/server/fees/structures";
import { assignFeeStructure } from "@/lib/server/fees/assignments";
import { HttpError } from "@/lib/server/api/guard";
import type { OrgScope } from "@/lib/server/api/scope";

let dbReady = false;
try {
  dbReady = Boolean(await prisma.role.findFirst({ where: { key: "SCHOOL_ADMIN", isSystem: true } }));
} catch {
  dbReady = false;
}

const NS = "TOPS";
const stamp = Date.now().toString(36);

let tenantId = "", schoolId = "", branchA = "", sessionId = "", classId = "", sectionId = "";
let student1 = "";
let vehicleId = "", electricVehicleId = "";
let driverStaffLinked = "", driverStaffUnlinked = "";
let scopeAdmin: OrgScope, scopeManager: OrgScope;
let adminUser = "", managerUser = "", teacherUser = "", driverUser = "";

async function makeUserWithRole(email: string, roleKey: string): Promise<string> {
  const u = await prisma.user.create({ data: { email, name: email, status: "ACTIVE" }, select: { id: true } });
  const m = await prisma.tenantMembership.create({ data: { userId: u.id, tenantId, status: "ACTIVE" }, select: { id: true } });
  const role = await prisma.role.findFirstOrThrow({ where: { key: roleKey, isSystem: true }, select: { id: true } });
  await prisma.roleAssignment.create({ data: { membershipId: m.id, roleId: role.id } });
  return u.id;
}

beforeAll(async () => {
  if (!dbReady) return;
  tenantId = (await prisma.tenant.create({ data: { name: `${NS} T`, slug: `tops-${stamp}` }, select: { id: true } })).id;
  schoolId = (await prisma.school.create({ data: { tenantId, name: `${NS} S`, code: `${NS}-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  branchA = (await prisma.branch.create({ data: { schoolId, name: "A", code: `${NS}-A`, status: "ACTIVE" }, select: { id: true } })).id;
  sessionId = (await prisma.academicSession.create({ data: { schoolId, name: "26-27", code: `${NS}-S`, startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31"), status: "ACTIVE" }, select: { id: true } })).id;
  classId = (await prisma.class.create({ data: { tenantId, schoolId, academicSessionId: sessionId, name: "Grade 5", order: 5 }, select: { id: true } })).id;
  sectionId = (await prisma.section.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, classId, name: "A", status: "ACTIVE" }, select: { id: true } })).id;
  student1 = (
    await prisma.student.create({
      data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, admissionNumber: `${NS}-${stamp}`, firstName: "One", lastName: "T", dateOfBirth: new Date("2015-01-01"), admissionDate: new Date("2024-04-01"), status: "ACTIVE" },
      select: { id: true },
    })
  ).id;
  await prisma.enrollment.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, classId, sectionId, studentId: student1, status: "ENROLLED" } });

  adminUser = await makeUserWithRole(`tops-admin-${stamp}@x.test`, "SCHOOL_ADMIN");
  managerUser = await makeUserWithRole(`tops-mgr-${stamp}@x.test`, "TRANSPORT_MANAGER");
  teacherUser = await makeUserWithRole(`tops-t1-${stamp}@x.test`, "TEACHER");
  driverUser = await makeUserWithRole(`tops-driver-${stamp}@x.test`, "TEACHER");

  driverStaffLinked = (await prisma.staff.create({ data: { tenantId, schoolId, branchId: branchA, employeeCode: `${NS}-DL-${stamp}`, firstName: "Linked", lastName: "Driver", status: "ACTIVE", userId: driverUser } , select: { id: true } })).id;
  driverStaffUnlinked = (await prisma.staff.create({ data: { tenantId, schoolId, branchId: branchA, employeeCode: `${NS}-DU-${stamp}`, firstName: "Unlinked", lastName: "Driver", status: "ACTIVE" }, select: { id: true } })).id;

  vehicleId = (await prisma.transportVehicle.create({ data: { tenantId, schoolId, branchId: branchA, registrationNumber: `${NS}-V1-${stamp}`, capacity: 40, type: "BUS", status: "ACTIVE" }, select: { id: true } })).id;
  electricVehicleId = (await prisma.transportVehicle.create({ data: { tenantId, schoolId, branchId: branchA, registrationNumber: `${NS}-VE-${stamp}`, capacity: 20, type: "ELECTRIC_VEHICLE", status: "ACTIVE" }, select: { id: true } })).id;

  scopeAdmin = { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, actor: { id: adminUser, name: "Admin" } };
  scopeManager = { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, actor: { id: managerUser, name: "Manager" } };
});

afterAll(async () => {
  if (!dbReady || !tenantId) return;
  await prisma.notificationRecipient.deleteMany({ where: { notification: { schoolId } } });
  await prisma.notification.deleteMany({ where: { schoolId } });
  await prisma.feeCharge.deleteMany({ where: { schoolId } });
  await prisma.studentFeeAssignment.deleteMany({ where: { schoolId } });
  await prisma.feeStructureItem.deleteMany({ where: { feeStructure: { schoolId } } });
  await prisma.feeStructureClass.deleteMany({ where: { feeStructure: { schoolId } } });
  await prisma.feeStructure.deleteMany({ where: { schoolId } });
  await prisma.feeCategory.deleteMany({ where: { schoolId } });
  await prisma.transportDocument.deleteMany({ where: { schoolId } });
  await prisma.transportFuelLog.deleteMany({ where: { schoolId } });
  await prisma.transportMaintenanceRecord.deleteMany({ where: { schoolId } });
  await prisma.transportIncident.deleteMany({ where: { schoolId } });
  await prisma.transportVehicle.deleteMany({ where: { tenantId } });
  await prisma.enrollment.deleteMany({ where: { tenantId } });
  await prisma.student.deleteMany({ where: { tenantId } });
  await prisma.staff.deleteMany({ where: { tenantId } });
  await prisma.section.deleteMany({ where: { tenantId } });
  await prisma.class.deleteMany({ where: { tenantId } });
  await prisma.roleAssignment.deleteMany({ where: { membership: { tenantId } } });
  await prisma.tenantMembership.deleteMany({ where: { tenantId } });
  await prisma.academicSession.deleteMany({ where: { schoolId } });
  await prisma.branch.deleteMany({ where: { schoolId } });
  await prisma.auditEvent.deleteMany({ where: { tenantId } });
  await prisma.school.deleteMany({ where: { tenantId } });
  await prisma.user.deleteMany({ where: { id: { in: [adminUser, managerUser, teacherUser, driverUser] } } });
  await prisma.tenant.deleteMany({ where: { id: tenantId } });
});

describe.skipIf(!dbReady)("Transport Incidents (DB)", () => {
  it("reports an incident and lists it", async () => {
    const inc = await reportIncident(scopeManager, { type: "breakdown", severity: "high", vehicleId, description: "Engine stalled mid-route" });
    expect(inc.status).toBe("open");
    expect(inc.vehicleRegistration).toContain(NS);
    const list = await listIncidents(scopeAdmin);
    expect(list.some((i) => i.id === inc.id)).toBe(true);
  });

  it("transitions open -> investigating -> resolved with a resolution note", async () => {
    const inc = await reportIncident(scopeManager, { type: "delay", severity: "low", description: "Traffic delay" });
    const investigating = await updateIncidentStatus(scopeManager, inc.id, { status: "investigating" });
    expect(investigating.status).toBe("investigating");
    const resolved = await updateIncidentStatus(scopeManager, inc.id, { status: "resolved", resolution: "Cleared after 20 minutes" });
    expect(resolved.status).toBe("resolved");
    expect(resolved.resolution).toBe("Cleared after 20 minutes");
    expect(resolved.resolvedAt).not.toBeNull();
  });

  it("rejects a vehicle that does not belong to this school", async () => {
    await expect(reportIncident(scopeManager, { type: "other", severity: "low", vehicleId: "nonexistent-vehicle", description: "x" })).rejects.toThrow(HttpError);
  });
});

describe.skipIf(!dbReady)("Transport Maintenance (DB)", () => {
  it("schedules, starts and completes a work order with Decimal-safe cost", async () => {
    const rec = await scheduleMaintenance(scopeManager, { vehicleId, type: "routine-service", scheduledDate: "2026-01-10" });
    expect(rec.status).toBe("scheduled");
    const started = await startMaintenance(scopeManager, rec.id);
    expect(started.status).toBe("in-progress");
    const completed = await completeMaintenance(scopeManager, rec.id, { partsCost: 1234.56, labourCost: 500.44 });
    expect(completed.status).toBe("completed");
    expect(completed.totalCost).toBeCloseTo(1735, 2);
  });

  it("start->start is race-safe: only one concurrent transition wins", async () => {
    const rec = await scheduleMaintenance(scopeManager, { vehicleId, type: "repair", scheduledDate: "2026-01-11" });
    const results = await Promise.allSettled([startMaintenance(scopeManager, rec.id), startMaintenance(scopeManager, rec.id)]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
  });

  it("marks a record overdue once scheduledDate is in the past and still scheduled", async () => {
    const rec = await scheduleMaintenance(scopeManager, { vehicleId, type: "inspection", scheduledDate: "2020-01-01" });
    const list = await listMaintenanceRecords(scopeAdmin, { vehicleId });
    const found = list.find((r) => r.id === rec.id);
    expect(found?.overdue).toBe(true);
    const insights = await getMaintenanceInsights(scopeAdmin);
    expect(insights.overdueCount).toBeGreaterThanOrEqual(1);
  });
});

describe.skipIf(!dbReady)("Transport Fuel (DB)", () => {
  it("logs a fuel entry with a server-computed Decimal-safe total", async () => {
    const entry = await logFuelEntry(scopeManager, { vehicleId, date: "2026-01-05", odometerKm: 15000, quantityLitres: 40.5, ratePerLitre: 96.25 });
    expect(entry.totalCost).toBe(Math.round(40.5 * 96.25 * 100) / 100);
    const list = await listFuelLogs(scopeAdmin, { vehicleId });
    expect(list.some((f) => f.id === entry.id)).toBe(true);
    const insights = await getFuelInsights(scopeAdmin);
    expect(insights.fuelVehicleCount).toBeGreaterThanOrEqual(1);
  });

  it("rejects a fuel entry for an electric vehicle", async () => {
    await expect(logFuelEntry(scopeManager, { vehicleId: electricVehicleId, date: "2026-01-05", odometerKm: 1000, quantityLitres: 10, ratePerLitre: 96 })).rejects.toThrow(HttpError);
  });
});

describe.skipIf(!dbReady)("Transport Documents (DB)", () => {
  it("adds a vehicle document and a staff document, deriving effective status honestly", async () => {
    const past = new Date();
    past.setDate(past.getDate() - 5);
    const future = new Date();
    future.setDate(future.getDate() + 10);

    const expired = await addDocument(scopeManager, { subjectType: "vehicle", vehicleId, type: "insurance", expiryDate: past.toISOString().slice(0, 10) });
    expect(expired.effectiveStatus).toBe("expired");

    const soon = await addDocument(scopeManager, { subjectType: "staff", staffId: driverStaffLinked, type: "driving-license", expiryDate: future.toISOString().slice(0, 10) });
    expect(soon.effectiveStatus).toBe("expiring-soon");

    const list = await listDocuments(scopeAdmin);
    expect(list.some((d) => d.id === expired.id)).toBe(true);

    const compliance = await getComplianceSummary(scopeAdmin);
    expect(compliance.expiredCount).toBeGreaterThanOrEqual(1);
    expect(compliance.blockedVehicleCount).toBeGreaterThanOrEqual(1);
  });

  it("rejects a document type that does not belong to the subject", async () => {
    await expect(addDocument(scopeManager, { subjectType: "vehicle", vehicleId, type: "driving-license" })).rejects.toThrow(HttpError);
  });
});

describe.skipIf(!dbReady)("Transport Fees (DB)", () => {
  it("returns an honest empty state when no \"Transport\" fee category exists", async () => {
    const summary = await getTransportFeesSummary(scopeAdmin);
    expect(summary.categoryExists).toBe(false);
    expect(summary.rows).toEqual([]);
  });

  it("aggregates real charges once a \"Transport\" category/structure/assignment exists", async () => {
    const category = await createFeeCategory(scopeAdmin, { name: "Transport", code: `TRN${stamp}` });
    const structure = await createFeeStructure(scopeAdmin, { name: `Transport Plan ${stamp}`, classIds: [classId], items: [{ categoryId: category.id, amount: 2000, dueDate: "2026-06-01" }] });
    await assignFeeStructure(scopeAdmin, { feeStructureId: structure.id, target: { type: "student", studentId: student1 } });

    const summary = await getTransportFeesSummary(scopeAdmin);
    expect(summary.categoryExists).toBe(true);
    expect(summary.totalBilled).toBeGreaterThanOrEqual(2000);
    expect(summary.rows.some((r) => r.studentId === student1)).toBe(true);
  });
});

describe.skipIf(!dbReady)("Transport Notifications (DB)", () => {
  it("sends only to staff with a linked User account, reporting the skipped count", async () => {
    const result = await sendTransportNotification(scopeManager, { title: "Route delay", body: "Route 1 delayed 15 minutes", recipientStaffIds: [driverStaffLinked, driverStaffUnlinked] });
    expect(result.sentTo).toBe(1);
    expect(result.skipped).toBe(1);
    const list = await listTransportNotifications(scopeAdmin);
    expect(list.some((n) => n.title === "Route delay" && n.recipientCount === 1)).toBe(true);
  });

  it("rejects when none of the selected staff have a linked user account", async () => {
    await expect(sendTransportNotification(scopeManager, { title: "x", body: "y", recipientStaffIds: [driverStaffUnlinked] })).rejects.toThrow(HttpError);
  });
});
