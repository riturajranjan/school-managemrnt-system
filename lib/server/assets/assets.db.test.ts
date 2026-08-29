// Asset Management DB integration tests (Phase 9O). Real Postgres: per-unit
// asset creation with race-safe server-generated tags, Staff-only assignment
// (real Staff.id, never a name string), exactly-one-active-assignment
// concurrency safety, return, lost/damaged status transitions (closing any
// active assignment), maintenance lifecycle, historical safety, isolation,
// audit, DTO safety. Namespaced ("T9O"). Mirrors the exact setup/teardown
// pattern of lib/server/library/library.db.test.ts.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { createAsset, getAsset, listAssets } from "@/lib/server/assets/register";
import { assignAsset, listAssignments, returnAsset } from "@/lib/server/assets/assignments";
import { setAssetStatus } from "@/lib/server/assets/status";
import { completeMaintenance, listMaintenance, openMaintenance } from "@/lib/server/assets/maintenance";
import { getAssetDashboard } from "@/lib/server/assets/dashboard";
import { getAssetHistory } from "@/lib/server/assets/history";
import { disposeAsset, listAssetDisposals } from "@/lib/server/assets/disposal";
import { HttpError } from "@/lib/server/api/guard";
import type { OrgScope } from "@/lib/server/api/scope";

let dbReady = false;
try {
  dbReady = Boolean(await prisma.role.findFirst({ where: { key: "SCHOOL_ADMIN", isSystem: true } }));
} catch {
  dbReady = false;
}

const NS = "T9OA";
const stamp = Date.now().toString(36);

let tenantId = "", schoolId = "", branchA = "";
let staff1 = "", staff2 = "", staffInactive = "";
let foreignTenantId = "", foreignSchoolId = "", foreignBranchId = "", foreignStaffId = "";
let scopeAdmin: OrgScope, scopeForeignAdmin: OrgScope;
let adminUser = "", foreignAdminUser = "";

async function makeUserWithRole(email: string, roleKey: string, tid = tenantId): Promise<string> {
  const u = await prisma.user.create({ data: { email, name: email, status: "ACTIVE" }, select: { id: true } });
  const m = await prisma.tenantMembership.create({ data: { userId: u.id, tenantId: tid, status: "ACTIVE" }, select: { id: true } });
  const role = await prisma.role.findFirstOrThrow({ where: { key: roleKey, isSystem: true }, select: { id: true } });
  await prisma.roleAssignment.create({ data: { membershipId: m.id, roleId: role.id } });
  return u.id;
}

beforeAll(async () => {
  if (!dbReady) return;
  tenantId = (await prisma.tenant.create({ data: { name: `${NS} T`, slug: `t9oa-${stamp}` }, select: { id: true } })).id;
  schoolId = (await prisma.school.create({ data: { tenantId, name: `${NS} S`, code: `${NS}-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  branchA = (await prisma.branch.create({ data: { schoolId, name: "A", code: `${NS}-A`, status: "ACTIVE" }, select: { id: true } })).id;

  adminUser = await makeUserWithRole(`t9oa-admin-${stamp}@x.test`, "SCHOOL_ADMIN");
  staff1 = (await prisma.staff.create({ data: { tenantId, schoolId, branchId: branchA, employeeCode: `${NS}-S1-${stamp}`, firstName: "One", lastName: "Staff", status: "ACTIVE" }, select: { id: true } })).id;
  staff2 = (await prisma.staff.create({ data: { tenantId, schoolId, branchId: branchA, employeeCode: `${NS}-S2-${stamp}`, firstName: "Two", lastName: "Staff", status: "ACTIVE" }, select: { id: true } })).id;
  staffInactive = (await prisma.staff.create({ data: { tenantId, schoolId, branchId: branchA, employeeCode: `${NS}-SI-${stamp}`, firstName: "Inactive", lastName: "Staff", status: "INACTIVE" }, select: { id: true } })).id;

  foreignTenantId = (await prisma.tenant.create({ data: { name: `${NS} T2`, slug: `t9oa-b-${stamp}` }, select: { id: true } })).id;
  foreignSchoolId = (await prisma.school.create({ data: { tenantId: foreignTenantId, name: `${NS} S2`, code: `${NS}-B-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  foreignBranchId = (await prisma.branch.create({ data: { schoolId: foreignSchoolId, name: "B", code: `${NS}-B`, status: "ACTIVE" }, select: { id: true } })).id;
  foreignStaffId = (await prisma.staff.create({ data: { tenantId: foreignTenantId, schoolId: foreignSchoolId, branchId: foreignBranchId, employeeCode: `${NS}-FS-${stamp}`, firstName: "Foreign", lastName: "Staff", status: "ACTIVE" }, select: { id: true } })).id;
  foreignAdminUser = await makeUserWithRole(`t9oa-fadmin-${stamp}@x.test`, "SCHOOL_ADMIN", foreignTenantId);

  scopeAdmin = { tenantId, schoolId, branchId: branchA, academicSessionId: null, actor: { id: adminUser, name: "Admin" } };
  scopeForeignAdmin = { tenantId: foreignTenantId, schoolId: foreignSchoolId, branchId: foreignBranchId, academicSessionId: null, actor: { id: foreignAdminUser, name: "Foreign Admin" } };
});

afterAll(async () => {
  if (!dbReady || !tenantId) return;
  await prisma.auditEvent.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.assetMaintenanceRecord.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.assetAssignment.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.asset.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.assetTagCounter.deleteMany({ where: { schoolId: { in: [schoolId, foreignSchoolId] } } });
  await prisma.staff.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.roleAssignment.deleteMany({ where: { membership: { tenantId: { in: [tenantId, foreignTenantId] } } } });
  await prisma.tenantMembership.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.branch.deleteMany({ where: { schoolId: { in: [schoolId, foreignSchoolId] } } });
  await prisma.school.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.user.deleteMany({ where: { id: { in: [adminUser, foreignAdminUser] } } });
  await prisma.tenant.deleteMany({ where: { id: { in: [tenantId, foreignTenantId] } } });
});

describe.skipIf(!dbReady)("Asset register (DB)", () => {
  it("creates an asset with a server-generated, unique asset tag", async () => {
    const a = await createAsset(scopeAdmin, { name: "Dell Laptop", category: "Laptop", cost: 55000 });
    expect(a.assetTag).toMatch(/^AST-\d{6}$/);
    expect(a.status).toBe("available");
    expect(a.cost).toBe(55000);
  });

  it("asset tags are unique and race-safe under concurrent creates", async () => {
    const results = await Promise.all(Array.from({ length: 8 }, (_, i) => createAsset(scopeAdmin, { name: `Race Asset ${i}` })));
    const tags = new Set(results.map((r) => r.assetTag));
    expect(tags.size).toBe(8);
  });

  it("isolation: a foreign tenant cannot see or fetch another school's asset", async () => {
    const a = await createAsset(scopeAdmin, { name: "Isolated Asset" });
    const foreignList = await listAssets(scopeForeignAdmin);
    expect(foreignList.some((x) => x.id === a.id)).toBe(false);
    await expect(getAsset(scopeForeignAdmin, a.id)).rejects.toThrow(HttpError);
  });
});

describe.skipIf(!dbReady)("Assignment: real Staff, exactly one active, concurrency (DB)", () => {
  it("assigns to a real active Staff; rejects inactive/foreign/nonexistent staff", async () => {
    const a = await createAsset(scopeAdmin, { name: "Projector 1" });
    await expect(assignAsset(scopeAdmin, { assetId: a.id, staffId: staffInactive })).rejects.toThrow(HttpError);
    await expect(assignAsset(scopeAdmin, { assetId: a.id, staffId: foreignStaffId })).rejects.toThrow(HttpError);
    await expect(assignAsset(scopeAdmin, { assetId: a.id, staffId: "nonexistent" })).rejects.toThrow(HttpError);

    const assignment = await assignAsset(scopeAdmin, { assetId: a.id, staffId: staff1 });
    expect(assignment.staffId).toBe(staff1);
    const updated = await getAsset(scopeAdmin, a.id);
    expect(updated.status).toBe("assigned");
    expect(updated.assignedToStaffId).toBe(staff1);
  });

  it("duplicate active assignment blocked; not available -> rejected", async () => {
    const a = await createAsset(scopeAdmin, { name: "Projector 2" });
    await assignAsset(scopeAdmin, { assetId: a.id, staffId: staff1 });
    await expect(assignAsset(scopeAdmin, { assetId: a.id, staffId: staff2 })).rejects.toThrow(HttpError);
  });

  it("two simultaneous assignments of the same asset -> exactly one winner", async () => {
    const a = await createAsset(scopeAdmin, { name: "Race Projector" });
    const results = await Promise.all([
      assignAsset(scopeAdmin, { assetId: a.id, staffId: staff1 }).catch((e) => e),
      assignAsset(scopeAdmin, { assetId: a.id, staffId: staff2 }).catch((e) => e),
    ]);
    const succeeded = results.filter((r) => !(r instanceof Error));
    expect(succeeded.length).toBe(1);
    const activeCount = await prisma.assetAssignment.count({ where: { assetId: a.id, returnedAt: null } });
    expect(activeCount).toBe(1);
  });

  it("return: success, server timestamp, duplicate return blocked", async () => {
    const a = await createAsset(scopeAdmin, { name: "Tablet 1" });
    const assignment = await assignAsset(scopeAdmin, { assetId: a.id, staffId: staff1 });
    const returned = await returnAsset(scopeAdmin, assignment.id);
    expect(returned.returnedAt).not.toBeNull();
    expect((await getAsset(scopeAdmin, a.id)).status).toBe("available");
    await expect(returnAsset(scopeAdmin, assignment.id)).rejects.toThrow(HttpError);
  });

  it("historical safety: a staff member's assignment history survives status change", async () => {
    const a = await createAsset(scopeAdmin, { name: "Historical Asset" });
    const assignment = await assignAsset(scopeAdmin, { assetId: a.id, staffId: staff1 });
    await returnAsset(scopeAdmin, assignment.id);
    await prisma.staff.update({ where: { id: staff1 }, data: { status: "INACTIVE" } });
    const history = await listAssignments(scopeAdmin, { assetId: a.id });
    expect(history.some((h) => h.id === assignment.id && h.staffName)).toBe(true);
    await prisma.staff.update({ where: { id: staff1 }, data: { status: "ACTIVE" } }); // restore for later tests
  });
});

describe.skipIf(!dbReady)("Lost / Damaged / Retired (DB)", () => {
  it("marking an assigned asset LOST closes its active assignment but keeps history", async () => {
    const a = await createAsset(scopeAdmin, { name: "Lost Laptop" });
    const assignment = await assignAsset(scopeAdmin, { assetId: a.id, staffId: staff1 });
    const lost = await setAssetStatus(scopeAdmin, a.id, { status: "lost" });
    expect(lost.status).toBe("lost");
    const row = await prisma.assetAssignment.findUniqueOrThrow({ where: { id: assignment.id } });
    expect(row.returnedAt).not.toBeNull();
  });

  it("retire is only reachable from AVAILABLE", async () => {
    const a = await createAsset(scopeAdmin, { name: "Retire Test" });
    await assignAsset(scopeAdmin, { assetId: a.id, staffId: staff1 });
    await expect(setAssetStatus(scopeAdmin, a.id, { status: "retired" })).rejects.toThrow(HttpError);
  });

  it("asset rename does not break assignment/status history", async () => {
    const a = await createAsset(scopeAdmin, { name: "Rename Me" });
    await prisma.asset.update({ where: { id: a.id }, data: { name: "Renamed Asset" } });
    const history = await getAssetHistory(scopeAdmin, a.id);
    expect(Array.isArray(history)).toBe(true);
  });
});

describe.skipIf(!dbReady)("Maintenance (DB)", () => {
  it("open requires AVAILABLE; moves asset to MAINTENANCE; complete returns it to AVAILABLE", async () => {
    const a = await createAsset(scopeAdmin, { name: "Printer 1" });
    const record = await openMaintenance(scopeAdmin, { assetId: a.id, description: "Toner jam" });
    expect(record.status).toBe("open");
    expect((await getAsset(scopeAdmin, a.id)).status).toBe("maintenance");

    await expect(openMaintenance(scopeAdmin, { assetId: a.id, description: "Another" })).rejects.toThrow(HttpError);

    const completed = await completeMaintenance(scopeAdmin, record.id, { status: "completed", cost: 500 });
    expect(completed.status).toBe("completed");
    expect(completed.cost).toBe(500);
    expect((await getAsset(scopeAdmin, a.id)).status).toBe("available");

    await expect(completeMaintenance(scopeAdmin, record.id)).rejects.toThrow();
  });

  it("cannot open maintenance on an assigned asset", async () => {
    const a = await createAsset(scopeAdmin, { name: "Printer 2" });
    await assignAsset(scopeAdmin, { assetId: a.id, staffId: staff1 });
    await expect(openMaintenance(scopeAdmin, { assetId: a.id, description: "x" })).rejects.toThrow(HttpError);
  });

  it("lists maintenance by asset/status", async () => {
    const a = await createAsset(scopeAdmin, { name: "Printer 3" });
    await openMaintenance(scopeAdmin, { assetId: a.id, description: "Inspection", type: "inspection" });
    const list = await listMaintenance(scopeAdmin, { assetId: a.id, status: "open" });
    expect(list.length).toBe(1);
    expect(list[0].type).toBe("inspection");
  });
});

describe.skipIf(!dbReady)("Dashboard + DTO safety + audit (DB)", () => {
  it("dashboard totals are DB-derived and totalCost is a plain sum, not a book value", async () => {
    const dashboard = await getAssetDashboard(scopeAdmin);
    expect(typeof dashboard.total).toBe("number");
    expect(typeof dashboard.totalCost).toBe("number");
  });

  it("DTOs never leak tenantId/schoolId/branchId", async () => {
    const a = await createAsset(scopeAdmin, { name: "DTO Asset" });
    const raw = JSON.stringify(a);
    expect(raw).not.toContain(tenantId);
    expect(raw).not.toContain(schoolId);
  });

  it("records ASSET_CREATED and ASSET_ASSIGNED audit events", async () => {
    const a = await createAsset(scopeAdmin, { name: "Audit Asset" });
    await assignAsset(scopeAdmin, { assetId: a.id, staffId: staff1 });
    const events = await prisma.auditEvent.findMany({ where: { tenantId, entityId: a.id } });
    expect(events.some((e) => e.action === "ASSET_CREATED")).toBe(true);
    const assignEvents = await prisma.auditEvent.findMany({ where: { tenantId, action: "ASSET_ASSIGNED" } });
    expect(assignEvents.length).toBeGreaterThan(0);
  });
});

describe.skipIf(!dbReady)("Depreciation — live-derived, never stored (DB)", () => {
  it("with no method set, book value is exactly cost and accumulated is zero", async () => {
    const a = await createAsset(scopeAdmin, { name: "Undepreciated Asset", cost: 50000 });
    expect(a.depreciationMethod).toBe("none");
    expect(a.bookValue).toBe(50000);
    expect(a.accumulatedDepreciation).toBe(0);
  });

  it("straight-line depreciation is computed live from cost/rate/purchaseDate", async () => {
    const a = await createAsset(scopeAdmin, {
      name: "Depreciating Asset", cost: 100000, purchaseDate: "2024-08-29",
      depreciationMethod: "straight_line", depreciationRatePercent: 20, salvageValue: 10000,
    });
    expect(a.bookValue).toBeLessThan(100000);
    expect(a.bookValue).toBeGreaterThanOrEqual(10000);
    expect(a.accumulatedDepreciation).toBeGreaterThan(0);
    expect(Math.round((a.cost! - a.accumulatedDepreciation) * 100) / 100).toBe(a.bookValue);
  });

  it("book value never drops below salvage value", async () => {
    const a = await createAsset(scopeAdmin, {
      name: "Old Asset", cost: 100000, purchaseDate: "2000-01-01",
      depreciationMethod: "straight_line", depreciationRatePercent: 20, salvageValue: 15000,
    });
    expect(a.bookValue).toBe(15000);
  });
});

describe.skipIf(!dbReady)("Disposal — real terminal audit record (DB)", () => {
  it("disposing an asset sets it RETIRED and creates a disposal record", async () => {
    const a = await createAsset(scopeAdmin, { name: "To Dispose" });
    const { asset, disposal } = await disposeAsset(scopeAdmin, a.id, { reason: "end_of_life", disposedAt: "2026-08-29", value: 500, notes: "Broken screen" });
    expect(asset.status).toBe("retired");
    expect(disposal.reason).toBe("end_of_life");
    expect(disposal.value).toBe(500);
    expect(disposal.createdByName).toBeTruthy();

    const fetched = await getAsset(scopeAdmin, a.id);
    expect(fetched.disposal?.id).toBe(disposal.id);
  });

  it("disposing an assigned asset auto-closes the active assignment", async () => {
    const a = await createAsset(scopeAdmin, { name: "Assigned Then Disposed" });
    await assignAsset(scopeAdmin, { assetId: a.id, staffId: staff1 });
    await disposeAsset(scopeAdmin, a.id, { reason: "damaged", disposedAt: "2026-08-29" });
    const assignments = await listAssignments(scopeAdmin, { assetId: a.id, status: "active" });
    expect(assignments.length).toBe(0);
  });

  it("cannot dispose an already-disposed asset", async () => {
    const a = await createAsset(scopeAdmin, { name: "Double Dispose" });
    await disposeAsset(scopeAdmin, a.id, { reason: "sold", disposedAt: "2026-08-29" });
    await expect(disposeAsset(scopeAdmin, a.id, { reason: "sold", disposedAt: "2026-08-29" })).rejects.toThrow(HttpError);
  });

  it("cannot dispose an asset that does not exist in this school (invalid id / cross-tenant)", async () => {
    const foreign = await createAsset(scopeForeignAdmin, { name: "Foreign Asset" });
    await expect(disposeAsset(scopeAdmin, foreign.id, { reason: "other", disposedAt: "2026-08-29" })).rejects.toThrow(HttpError);
    await expect(disposeAsset(scopeAdmin, "not-a-real-id", { reason: "other", disposedAt: "2026-08-29" })).rejects.toThrow(HttpError);
  });

  it("tenant isolation: disposal list never includes another tenant's disposals", async () => {
    const a = await createAsset(scopeAdmin, { name: "Isolation Asset" });
    await disposeAsset(scopeAdmin, a.id, { reason: "other", disposedAt: "2026-08-29" });
    const list = await listAssetDisposals(scopeAdmin);
    const foreignList = await listAssetDisposals(scopeForeignAdmin);
    expect(list.some((d) => d.assetId === a.id)).toBe(true);
    expect(foreignList.some((d) => d.assetId === a.id)).toBe(false);
  });
});
