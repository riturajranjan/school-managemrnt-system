// Contracts + Staff Documents DB integration tests (Production migration,
// Phase B, HR Sub-batch 2). Real Postgres: create/read/update/archive
// lifecycle for both domains, RBAC catalog contract (no new permission —
// hr.view/hr.manage/hr.viewOwn), confidential compensationNote redaction,
// staff-visible document filtering, cross-school ("School A" / "School B")
// isolation, invalid-staff rejection, and self-service own-record-only
// integration. Namespaced ("T9X2"). Mirrors the setup/teardown pattern of
// lib/server/hr/hr.db.test.ts.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import type { OrgScope } from "@/lib/server/api/scope";
import { createStaff } from "@/lib/server/staff/service";
import {
  CONTRACT_STATUS_VALUES,
  createContract,
  getContract,
  listContracts,
  listContractsForStaff,
  setContractStatus,
  updateContract,
} from "@/lib/server/hr/contracts";
import {
  getStaffDocument,
  listStaffDocuments,
  listStaffDocumentsForStaff,
  setStaffDocumentStatus,
  uploadStaffDocument,
} from "@/lib/server/hr/documents";
import { getMySelfService } from "@/lib/server/hr/self-service";
import { ROLE_PERMISSIONS } from "@/lib/server/authz/catalog";

let dbReady = false;
try {
  dbReady = Boolean(await prisma.role.findFirst({ where: { key: "SCHOOL_ADMIN", isSystem: true } }));
} catch {
  dbReady = false;
}

const NS = "T9X2";
const stamp = Date.now().toString(36);

// "School A" / "School B" per the task's tenant-isolation requirement.
let tenantA = "", schoolA = "", branchA = "";
let tenantB = "", schoolB = "", branchB = "";
let scopeHrAdminA: OrgScope, scopeSchoolAdminA: OrgScope, scopeTeacherA: OrgScope, scopeHrAdminB: OrgScope;
let hrAdminAUser = "", schoolAdminAUser = "", teacherAUser = "", hrAdminBUser = "";
let staffA1 = "", staffA2 = "", staffB1 = "";

async function makeUserWithRole(email: string, roleKey: string, tenantId: string): Promise<string> {
  const u = await prisma.user.create({ data: { email, name: email, status: "ACTIVE" }, select: { id: true } });
  const m = await prisma.tenantMembership.create({ data: { userId: u.id, tenantId, status: "ACTIVE" }, select: { id: true } });
  const role = await prisma.role.findFirstOrThrow({ where: { key: roleKey, isSystem: true }, select: { id: true } });
  await prisma.roleAssignment.create({ data: { membershipId: m.id, roleId: role.id } });
  return u.id;
}

beforeAll(async () => {
  if (!dbReady) return;
  tenantA = (await prisma.tenant.create({ data: { name: `${NS} A`, slug: `t9x2-a-${stamp}` }, select: { id: true } })).id;
  schoolA = (await prisma.school.create({ data: { tenantId: tenantA, name: `${NS} School A`, code: `${NS}-A-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  branchA = (await prisma.branch.create({ data: { schoolId: schoolA, name: "A", code: `${NS}-A`, status: "ACTIVE" }, select: { id: true } })).id;

  tenantB = (await prisma.tenant.create({ data: { name: `${NS} B`, slug: `t9x2-b-${stamp}` }, select: { id: true } })).id;
  schoolB = (await prisma.school.create({ data: { tenantId: tenantB, name: `${NS} School B`, code: `${NS}-B-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  branchB = (await prisma.branch.create({ data: { schoolId: schoolB, name: "B", code: `${NS}-B`, status: "ACTIVE" }, select: { id: true } })).id;

  hrAdminAUser = await makeUserWithRole(`t9x2-hra-${stamp}@x.test`, "HR_ADMIN", tenantA);
  schoolAdminAUser = await makeUserWithRole(`t9x2-sca-${stamp}@x.test`, "SCHOOL_ADMIN", tenantA);
  teacherAUser = await makeUserWithRole(`t9x2-teach-${stamp}@x.test`, "TEACHER", tenantA);
  hrAdminBUser = await makeUserWithRole(`t9x2-hrb-${stamp}@x.test`, "HR_ADMIN", tenantB);

  scopeHrAdminA = { tenantId: tenantA, schoolId: schoolA, branchId: branchA, academicSessionId: null, actor: { id: hrAdminAUser, name: "HR Admin A" } };
  scopeSchoolAdminA = { tenantId: tenantA, schoolId: schoolA, branchId: branchA, academicSessionId: null, actor: { id: schoolAdminAUser, name: "School Admin A" } };
  scopeTeacherA = { tenantId: tenantA, schoolId: schoolA, branchId: branchA, academicSessionId: null, actor: { id: teacherAUser, name: "Teacher A" } };
  scopeHrAdminB = { tenantId: tenantB, schoolId: schoolB, branchId: branchB, academicSessionId: null, actor: { id: hrAdminBUser, name: "HR Admin B" } };

  staffA1 = (await createStaff(scopeHrAdminA, { employeeCode: `${NS}-A1-${stamp}`, firstName: "Alice", lastName: "One", userId: teacherAUser })).id;
  staffA2 = (await createStaff(scopeHrAdminA, { employeeCode: `${NS}-A2-${stamp}`, firstName: "Alan", lastName: "Two" })).id;
  staffB1 = (await createStaff(scopeHrAdminB, { employeeCode: `${NS}-B1-${stamp}`, firstName: "Bob", lastName: "One" })).id;
});

afterAll(async () => {
  if (!dbReady || !tenantA) return;
  await prisma.auditEvent.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
  await prisma.staffDocument.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
  await prisma.contract.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
  await prisma.staff.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
  await prisma.roleAssignment.deleteMany({ where: { membership: { tenantId: { in: [tenantA, tenantB] } } } });
  await prisma.tenantMembership.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
  await prisma.branch.deleteMany({ where: { schoolId: { in: [schoolA, schoolB] } } });
  await prisma.school.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
  await prisma.user.deleteMany({ where: { id: { in: [hrAdminAUser, schoolAdminAUser, teacherAUser, hrAdminBUser] } } });
  await prisma.tenant.deleteMany({ where: { id: { in: [tenantA, tenantB] } } });
});

describe.skipIf(!dbReady)("RBAC catalog contract — no new permission introduced (DB)", () => {
  it("Contracts/Documents reuse hr.view/hr.manage/hr.viewOwn exactly as they already existed", () => {
    expect(ROLE_PERMISSIONS.HR_ADMIN).toContain("hr.manage");
    expect(ROLE_PERMISSIONS.HR_ADMIN).toContain("hr.view");
    expect(ROLE_PERMISSIONS.SCHOOL_ADMIN).toContain("hr.view");
    expect(ROLE_PERMISSIONS.SCHOOL_ADMIN).not.toContain("hr.manage");
    expect(ROLE_PERMISSIONS.TEACHER).toContain("hr.viewOwn");
    expect(ROLE_PERMISSIONS.TEACHER).not.toContain("hr.view");
    expect(ROLE_PERMISSIONS.TEACHER).not.toContain("hr.manage");
  });
});

describe.skipIf(!dbReady)("Contracts (DB)", () => {
  it("authorized create → read → update → status lifecycle → archive (never hard-deleted)", async () => {
    const created = await createContract(scopeHrAdminA, {
      staffId: staffA2, type: "fixed-term", startDate: "2026-01-01", endDate: "2026-12-31",
      noticePeriodDays: 30, workHoursPerWeek: 40, compensationNote: "₹50,000/month", terms: "Standard terms",
    });
    expect(created.status).toBe("draft");
    expect(created.staffId).toBe(staffA2);

    const read = await getContract(scopeHrAdminA, created.id);
    expect(read.id).toBe(created.id);
    expect(read.compensationNote).toBe("₹50,000/month");

    const updated = await updateContract(scopeHrAdminA, created.id, { terms: "Revised terms" });
    expect(updated.terms).toBe("Revised terms");

    const activated = await setContractStatus(scopeHrAdminA, created.id, "active");
    expect(activated.status).toBe("active");

    const archived = await setContractStatus(scopeHrAdminA, created.id, "archived");
    expect(archived.status).toBe("archived");
    const stillThere = await getContract(scopeHrAdminA, created.id);
    expect(stillThere.id).toBe(created.id); // archived, not deleted

    const events = await prisma.auditEvent.findMany({ where: { tenantId: tenantA, entityId: created.id } });
    expect(events.some((e) => e.action === "CONTRACT_CREATED")).toBe(true);
    expect(events.some((e) => e.action === "CONTRACT_STATUS_CHANGED")).toBe(true);
  });

  it("rejects a contract for a nonexistent or cross-school staffId", async () => {
    await expect(createContract(scopeHrAdminA, { staffId: "nonexistent", type: "permanent", startDate: "2026-01-01" })).rejects.toThrow(HttpError);
    await expect(createContract(scopeHrAdminA, { staffId: staffB1, type: "permanent", startDate: "2026-01-01" })).rejects.toThrow(HttpError);
  });

  it("rejects an end date before the start date", async () => {
    await expect(createContract(scopeHrAdminA, { staffId: staffA2, type: "permanent", startDate: "2026-06-01", endDate: "2026-01-01" })).rejects.toThrow();
  });

  it("School A / School B isolation: HR Admin B cannot read, update, or change status of School A's contract", async () => {
    const contract = await createContract(scopeHrAdminA, { staffId: staffA2, type: "permanent", startDate: "2026-02-01" });
    const listB = await listContracts(scopeHrAdminB);
    expect(listB.some((c) => c.id === contract.id)).toBe(false);
    await expect(getContract(scopeHrAdminB, contract.id)).rejects.toThrow(HttpError);
    await expect(updateContract(scopeHrAdminB, contract.id, { terms: "hijacked" })).rejects.toThrow(HttpError);
    await expect(setContractStatus(scopeHrAdminB, contract.id, "archived")).rejects.toThrow(HttpError);
  });

  it("SCHOOL_ADMIN (hr.view) can read the full directory listing", async () => {
    const contract = await createContract(scopeHrAdminA, { staffId: staffA2, type: "permanent", startDate: "2026-03-01" });
    const list = await listContracts(scopeSchoolAdminA);
    expect(list.some((c) => c.id === contract.id)).toBe(true);
  });

  it("confidential compensationNote is redacted for own-record (hr.viewOwn) reads, never for hr.view/hr.manage", async () => {
    await createContract(scopeHrAdminA, { staffId: staffA1, type: "permanent", startDate: "2026-01-01", compensationNote: "SECRET-SALARY" });
    const ownView = await listContractsForStaff(scopeTeacherA, staffA1);
    expect(ownView.length).toBeGreaterThan(0);
    expect(ownView.every((c) => c.compensationNote === null)).toBe(true);

    const adminView = await listContracts(scopeHrAdminA, { staffId: staffA1 });
    expect(adminView.some((c) => c.compensationNote === "SECRET-SALARY")).toBe(true);
  });

  it("own-record access never leaks another employee's contract", async () => {
    const other = await createContract(scopeHrAdminA, { staffId: staffA2, type: "permanent", startDate: "2026-04-01" });
    const ownView = await listContractsForStaff(scopeTeacherA, staffA1);
    expect(ownView.some((c) => c.id === other.id)).toBe(false);
  });

  it("rejects an invalid status value at the value-set level", () => {
    expect(CONTRACT_STATUS_VALUES).toContain("archived");
    expect(CONTRACT_STATUS_VALUES).not.toContain("bogus");
  });

  it("DTOs never leak tenantId/schoolId/branchId", async () => {
    const contract = await createContract(scopeHrAdminA, { staffId: staffA2, type: "permanent", startDate: "2026-05-01" });
    const raw = JSON.stringify(contract);
    expect(raw).not.toContain(tenantA);
    expect(raw).not.toContain(schoolA);
  });
});

describe.skipIf(!dbReady)("Staff Documents (DB) — metadata only, no file upload", () => {
  it("authorized upload → verify lifecycle, and reject lifecycle", async () => {
    const uploaded = await uploadStaffDocument(scopeHrAdminA, { staffId: staffA2, type: "id-proof", title: "Aadhaar card" });
    expect(uploaded.status).toBe("uploaded");
    expect(uploaded.visibility).toBe("hr-only"); // default: opt-in, not opt-out

    const verified = await setStaffDocumentStatus(scopeHrAdminA, uploaded.id, "verified");
    expect(verified.status).toBe("verified");
    expect(verified.verifiedByName).toBe("HR Admin A");

    const other = await uploadStaffDocument(scopeHrAdminA, { staffId: staffA2, type: "background-check", title: "BGV report" });
    const rejected = await setStaffDocumentStatus(scopeHrAdminA, other.id, "rejected");
    expect(rejected.status).toBe("rejected");

    const events = await prisma.auditEvent.findMany({ where: { tenantId: tenantA, entityId: uploaded.id } });
    expect(events.some((e) => e.action === "STAFF_DOCUMENT_UPLOADED")).toBe(true);
    expect(events.some((e) => e.action === "STAFF_DOCUMENT_VERIFIED")).toBe(true);
  });

  it("archive lifecycle (delete-equivalent — never hard-deleted)", async () => {
    const doc = await uploadStaffDocument(scopeHrAdminA, { staffId: staffA2, type: "custom", title: "Misc" });
    const archived = await setStaffDocumentStatus(scopeHrAdminA, doc.id, "archived");
    expect(archived.status).toBe("archived");
    const stillThere = await getStaffDocument(scopeHrAdminA, doc.id);
    expect(stillThere.id).toBe(doc.id);
  });

  it("rejects an upload for a nonexistent or cross-school staffId", async () => {
    await expect(uploadStaffDocument(scopeHrAdminA, { staffId: "nonexistent", type: "id-proof", title: "X" })).rejects.toThrow(HttpError);
    await expect(uploadStaffDocument(scopeHrAdminA, { staffId: staffB1, type: "id-proof", title: "X" })).rejects.toThrow(HttpError);
  });

  it("School A / School B isolation: HR Admin B cannot read or change status of School A's document", async () => {
    const doc = await uploadStaffDocument(scopeHrAdminA, { staffId: staffA2, type: "license", title: "Driving license" });
    const listB = await listStaffDocuments(scopeHrAdminB);
    expect(listB.some((d) => d.id === doc.id)).toBe(false);
    await expect(getStaffDocument(scopeHrAdminB, doc.id)).rejects.toThrow(HttpError);
    await expect(setStaffDocumentStatus(scopeHrAdminB, doc.id, "verified")).rejects.toThrow(HttpError);
  });

  it("self-service sees ONLY documents explicitly marked staff-visible, never hr-only ones", async () => {
    await uploadStaffDocument(scopeHrAdminA, { staffId: staffA1, type: "id-proof", title: "Hidden doc" }); // default hr-only
    const visible = await uploadStaffDocument(scopeHrAdminA, { staffId: staffA1, type: "appointment-letter", title: "Appointment letter", visibility: "staff-visible" });

    const ownView = await listStaffDocumentsForStaff(scopeTeacherA, staffA1);
    expect(ownView.some((d) => d.id === visible.id)).toBe(true);
    expect(ownView.every((d) => d.visibility === "staff-visible")).toBe(true);
    expect(ownView.some((d) => d.title === "Hidden doc")).toBe(false);
  });

  it("own-record access never leaks another employee's documents, even staff-visible ones", async () => {
    const otherVisible = await uploadStaffDocument(scopeHrAdminA, { staffId: staffA2, type: "appointment-letter", title: "A2's letter", visibility: "staff-visible" });
    const ownView = await listStaffDocumentsForStaff(scopeTeacherA, staffA1);
    expect(ownView.some((d) => d.id === otherVisible.id)).toBe(false);
  });

  it("expiryDate in the past derives isExpired: true (never stored)", async () => {
    const doc = await uploadStaffDocument(scopeHrAdminA, { staffId: staffA2, type: "medical-fitness", title: "Fitness cert", expiryDate: "2020-01-01" });
    expect(doc.isExpired).toBe(true);
  });

  it("DTOs never leak tenantId/schoolId/branchId", async () => {
    const doc = await uploadStaffDocument(scopeHrAdminA, { staffId: staffA2, type: "custom", title: "DTO check" });
    const raw = JSON.stringify(doc);
    expect(raw).not.toContain(tenantA);
    expect(raw).not.toContain(schoolA);
  });
});

describe.skipIf(!dbReady)("Employee Self Service — real caller-scoped Contracts/Documents (DB)", () => {
  it("returns the caller's own contracts (redacted) and staff-visible documents only, resolved server-side from Staff.userId", async () => {
    await createContract(scopeHrAdminA, { staffId: staffA1, type: "permanent", startDate: "2026-01-01", compensationNote: "SECRET" });
    await uploadStaffDocument(scopeHrAdminA, { staffId: staffA1, type: "appointment-letter", title: "Self-service visible doc", visibility: "staff-visible" });
    await uploadStaffDocument(scopeHrAdminA, { staffId: staffA1, type: "id-proof", title: "Self-service hidden doc" }); // hr-only

    const summary = await getMySelfService(scopeTeacherA);
    expect(summary.staff.id).toBe(staffA1);
    expect(summary.contracts.length).toBeGreaterThan(0);
    expect(summary.contracts.every((c) => c.compensationNote === null)).toBe(true);
    expect(summary.documents.some((d) => d.title === "Self-service visible doc")).toBe(true);
    expect(summary.documents.some((d) => d.title === "Self-service hidden doc")).toBe(false);
  });
});
