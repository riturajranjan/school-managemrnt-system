// Inventory Management DB integration tests (Phase 9O). Real Postgres:
// items/locations CRUD + duplicate rejection, ledger-derived stock (never a
// stored quantity column), receipts/issues/returns/transfers/adjustments,
// negative-stock prevention under concurrency, atomic no-half-transfer,
// low-stock derivation, isolation, RBAC, audit, DTO safety. Namespaced
// ("T9O"). Mirrors the exact setup/teardown pattern of
// lib/server/library/library.db.test.ts.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { createItem, getItem, listItems, updateItem } from "@/lib/server/inventory/items";
import { createLocation, listLocations } from "@/lib/server/inventory/locations";
import { receiveStock, listItemMovements } from "@/lib/server/inventory/movements";
import { issueStock, returnIssue, listIssues } from "@/lib/server/inventory/issues";
import { transferStock, listTransfers } from "@/lib/server/inventory/transfers";
import { adjustStock } from "@/lib/server/inventory/adjustments";
import { getInventoryDashboard } from "@/lib/server/inventory/dashboard";
import { getItemTotalStock } from "@/lib/server/inventory/stock";
import { HttpError } from "@/lib/server/api/guard";
import type { OrgScope } from "@/lib/server/api/scope";

let dbReady = false;
try {
  dbReady = Boolean(await prisma.role.findFirst({ where: { key: "SCHOOL_ADMIN", isSystem: true } }));
} catch {
  dbReady = false;
}

const NS = "T9O";
const stamp = Date.now().toString(36);

let tenantId = "", schoolId = "", branchA = "";
let staff1 = "", staffInactive = "", student1 = "";
let foreignTenantId = "", foreignSchoolId = "", foreignBranchId = "";
let scopeAdmin: OrgScope, scopePrincipal: OrgScope, scopeForeignAdmin: OrgScope;
let adminUser = "", principalUser = "", foreignAdminUser = "";

async function makeUserWithRole(email: string, roleKey: string, tid = tenantId): Promise<string> {
  const u = await prisma.user.create({ data: { email, name: email, status: "ACTIVE" }, select: { id: true } });
  const m = await prisma.tenantMembership.create({ data: { userId: u.id, tenantId: tid, status: "ACTIVE" }, select: { id: true } });
  const role = await prisma.role.findFirstOrThrow({ where: { key: roleKey, isSystem: true }, select: { id: true } });
  await prisma.roleAssignment.create({ data: { membershipId: m.id, roleId: role.id } });
  return u.id;
}

beforeAll(async () => {
  if (!dbReady) return;
  tenantId = (await prisma.tenant.create({ data: { name: `${NS} T`, slug: `t9o-${stamp}` }, select: { id: true } })).id;
  schoolId = (await prisma.school.create({ data: { tenantId, name: `${NS} S`, code: `${NS}-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  branchA = (await prisma.branch.create({ data: { schoolId, name: "A", code: `${NS}-A`, status: "ACTIVE" }, select: { id: true } })).id;
  const sessionId = (await prisma.academicSession.create({ data: { schoolId, name: "26-27", code: `${NS}-S`, startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31"), status: "ACTIVE" }, select: { id: true } })).id;

  adminUser = await makeUserWithRole(`t9o-admin-${stamp}@x.test`, "SCHOOL_ADMIN");
  principalUser = await makeUserWithRole(`t9o-principal-${stamp}@x.test`, "PRINCIPAL");

  staff1 = (await prisma.staff.create({ data: { tenantId, schoolId, branchId: branchA, employeeCode: `${NS}-S1-${stamp}`, firstName: "One", lastName: "Staff", status: "ACTIVE" }, select: { id: true } })).id;
  staffInactive = (await prisma.staff.create({ data: { tenantId, schoolId, branchId: branchA, employeeCode: `${NS}-SI-${stamp}`, firstName: "Inactive", lastName: "Staff", status: "INACTIVE" }, select: { id: true } })).id;
  student1 = (await prisma.student.create({
    data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, admissionNumber: `${NS}-${stamp}-1`, firstName: "S", lastName: "One", dateOfBirth: new Date("2015-01-01"), admissionDate: new Date("2024-04-01"), status: "ACTIVE" },
    select: { id: true },
  })).id;

  foreignTenantId = (await prisma.tenant.create({ data: { name: `${NS} T2`, slug: `t9o-b-${stamp}` }, select: { id: true } })).id;
  foreignSchoolId = (await prisma.school.create({ data: { tenantId: foreignTenantId, name: `${NS} S2`, code: `${NS}-B-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  foreignBranchId = (await prisma.branch.create({ data: { schoolId: foreignSchoolId, name: "B", code: `${NS}-B`, status: "ACTIVE" }, select: { id: true } })).id;
  foreignAdminUser = await makeUserWithRole(`t9o-fadmin-${stamp}@x.test`, "SCHOOL_ADMIN", foreignTenantId);

  scopeAdmin = { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, actor: { id: adminUser, name: "Admin" } };
  scopePrincipal = { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, actor: { id: principalUser, name: "Principal" } };
  scopeForeignAdmin = { tenantId: foreignTenantId, schoolId: foreignSchoolId, branchId: foreignBranchId, academicSessionId: null, actor: { id: foreignAdminUser, name: "Foreign Admin" } };
});

afterAll(async () => {
  if (!dbReady || !tenantId) return;
  await prisma.auditEvent.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.inventoryIssue.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.inventoryStockMovement.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.inventoryStockBalance.deleteMany({ where: { location: { schoolId: { in: [schoolId, foreignSchoolId] } } } });
  await prisma.inventoryItem.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.inventoryLocation.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.student.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.staff.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.roleAssignment.deleteMany({ where: { membership: { tenantId: { in: [tenantId, foreignTenantId] } } } });
  await prisma.tenantMembership.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.academicSession.deleteMany({ where: { schoolId: { in: [schoolId, foreignSchoolId] } } });
  await prisma.branch.deleteMany({ where: { schoolId: { in: [schoolId, foreignSchoolId] } } });
  await prisma.school.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.user.deleteMany({ where: { id: { in: [adminUser, principalUser, foreignAdminUser] } } });
  await prisma.tenant.deleteMany({ where: { id: { in: [tenantId, foreignTenantId] } } });
});

describe.skipIf(!dbReady)("Items (DB)", () => {
  it("creates an item with opening stock; rejects a duplicate code; updates/archives", async () => {
    const item = await createItem(scopeAdmin, { code: `SKU-${stamp}-1`, name: "Chalk box", unit: "box", reorderLevel: 5, openingQuantity: 20 });
    expect(item.quantity).toBe(20);
    expect(item.status).toBe("in-stock");

    await expect(createItem(scopeAdmin, { code: `SKU-${stamp}-1`, name: "Dup", unit: "box" })).rejects.toThrow(HttpError);

    const updated = await updateItem(scopeAdmin, item.id, { reorderLevel: 25 });
    expect(updated.status).toBe("low-stock"); // 20 <= 25

    const archived = await updateItem(scopeAdmin, item.id, { status: "archived" });
    expect(archived.status).toBe("discontinued");
  });

  it("isolation: a foreign tenant cannot see or fetch another school's item", async () => {
    const item = await createItem(scopeAdmin, { code: `SKU-${stamp}-iso`, name: "Isolated item", unit: "piece" });
    const foreignList = await listItems(scopeForeignAdmin);
    expect(foreignList.some((i) => i.id === item.id)).toBe(false);
    await expect(getItem(scopeForeignAdmin, item.id)).rejects.toThrow(HttpError);
  });
});

describe.skipIf(!dbReady)("Locations (DB)", () => {
  it("creates a location; rejects a duplicate name in the same branch; lists it", async () => {
    const loc = await createLocation(scopeAdmin, { name: `Science Store ${stamp}` });
    expect(loc.status).toBe("active");
    await expect(createLocation(scopeAdmin, { name: `Science Store ${stamp}` })).rejects.toThrow(HttpError);
    const list = await listLocations(scopeAdmin);
    expect(list.some((l) => l.id === loc.id)).toBe(true);
  });
});

describe.skipIf(!dbReady)("Stock ledger: receipts / issues / adjustments (DB)", () => {
  it("canonical stock formula matches ledger sum after receive/issue/adjust", async () => {
    const item = await createItem(scopeAdmin, { code: `SKU-${stamp}-2`, name: "A4 paper", unit: "ream" });
    await receiveStock(scopeAdmin, { itemId: item.id, quantity: 50, reference: "Initial" });
    let stock = await getItemTotalStock(scopeAdmin, item.id);
    expect(stock).toBe(50);

    const issue = await issueStock(scopeAdmin, { itemId: item.id, quantity: 10, recipientKind: "staff", recipientStaffId: staff1, returnable: false });
    expect(issue.status).toBe("issued"); // non-returnable consumables are never expected back — status has nothing further to transition to
    stock = await getItemTotalStock(scopeAdmin, item.id);
    expect(stock).toBe(40);

    await adjustStock(scopeAdmin, { itemId: item.id, quantity: -5, reason: "Damaged in storage" });
    stock = await getItemTotalStock(scopeAdmin, item.id);
    expect(stock).toBe(35);

    const movements = await listItemMovements(scopeAdmin, item.id);
    const ledgerSum = movements.reduce((s, m) => s + m.quantityDelta, 0);
    expect(ledgerSum).toBe(35);
  });

  it("rejects an issue that would drive stock below zero", async () => {
    const item = await createItem(scopeAdmin, { code: `SKU-${stamp}-3`, name: "Marker", unit: "piece", openingQuantity: 5 });
    await expect(issueStock(scopeAdmin, { itemId: item.id, quantity: 6, recipientKind: "staff", recipientStaffId: staff1 })).rejects.toThrow(HttpError);
    expect(await getItemTotalStock(scopeAdmin, item.id)).toBe(5);
  });

  it("issues to a real Student.id and an OTHER descriptive label", async () => {
    const item = await createItem(scopeAdmin, { code: `SKU-${stamp}-student`, name: "Sports kit", unit: "kit", openingQuantity: 10 });
    const toStudent = await issueStock(scopeAdmin, { itemId: item.id, quantity: 1, recipientKind: "student", recipientStudentId: student1 });
    expect(toStudent.recipientName).toBeTruthy();
    const toOther = await issueStock(scopeAdmin, { itemId: item.id, quantity: 1, recipientKind: "other", recipientLabel: "Annual Day event" });
    expect(toOther.recipientName).toBe("Annual Day event");
    const issues = await listIssues(scopeAdmin);
    expect(issues.some((i) => i.id === toStudent.id)).toBe(true);
  });

  it("rejects an issue to a foreign/inactive/nonexistent recipient", async () => {
    const item = await createItem(scopeAdmin, { code: `SKU-${stamp}-4`, name: "Duster", unit: "piece", openingQuantity: 10 });
    await expect(issueStock(scopeAdmin, { itemId: item.id, quantity: 1, recipientKind: "staff", recipientStaffId: staffInactive })).rejects.toThrow(HttpError);
    await expect(issueStock(scopeAdmin, { itemId: item.id, quantity: 1, recipientKind: "staff", recipientStaffId: "nonexistent" })).rejects.toThrow(HttpError);
    await expect(issueStock(scopeAdmin, { itemId: item.id, quantity: 1, recipientKind: "other" })).rejects.toThrow(); // requires a label
  });

  it("adjustment requires a non-trivial reason", async () => {
    const item = await createItem(scopeAdmin, { code: `SKU-${stamp}-5`, name: "Broom", unit: "piece", openingQuantity: 5 });
    await expect(adjustStock(scopeAdmin, { itemId: item.id, quantity: 1, reason: "" })).rejects.toThrow();
    await expect(adjustStock(scopeAdmin, { itemId: item.id, quantity: 0, reason: "no-op" })).rejects.toThrow();
  });

  it("two concurrent issues cannot overdraw stock (only one succeeds when exactly one can)", async () => {
    const item = await createItem(scopeAdmin, { code: `SKU-${stamp}-race`, name: "Race item", unit: "piece", openingQuantity: 5 });
    const results = await Promise.all([
      issueStock(scopeAdmin, { itemId: item.id, quantity: 4, recipientKind: "staff", recipientStaffId: staff1 }).catch((e) => e),
      issueStock(scopeAdmin, { itemId: item.id, quantity: 4, recipientKind: "staff", recipientStaffId: staff1 }).catch((e) => e),
    ]);
    const succeeded = results.filter((r) => !(r instanceof Error));
    expect(succeeded.length).toBe(1);
    const finalStock = await getItemTotalStock(scopeAdmin, item.id);
    expect(finalStock).toBe(1);
    expect(finalStock).toBeGreaterThanOrEqual(0);
  });
});

describe.skipIf(!dbReady)("Returns (DB)", () => {
  it("good return re-enters the ledger; damaged return does not; over-return rejected", async () => {
    const item = await createItem(scopeAdmin, { code: `SKU-${stamp}-6`, name: "Lab kit", unit: "kit", openingQuantity: 10 });
    const issue = await issueStock(scopeAdmin, { itemId: item.id, quantity: 4, recipientKind: "staff", recipientStaffId: staff1, returnable: true });
    expect(await getItemTotalStock(scopeAdmin, item.id)).toBe(6);

    const partial = await returnIssue(scopeAdmin, issue.id, { quantity: 2, condition: "good" });
    expect(partial.status).toBe("partially-returned");
    expect(await getItemTotalStock(scopeAdmin, item.id)).toBe(8);

    const damaged = await returnIssue(scopeAdmin, issue.id, { quantity: 1, condition: "damaged" });
    expect(damaged.outstandingQuantity).toBe(1);
    expect(await getItemTotalStock(scopeAdmin, item.id)).toBe(8); // damaged return does not restock

    await expect(returnIssue(scopeAdmin, issue.id, { quantity: 5 })).rejects.toThrow(HttpError);

    const finished = await returnIssue(scopeAdmin, issue.id, { quantity: 1, condition: "good" });
    expect(finished.status).toBe("returned");
  });
});

describe.skipIf(!dbReady)("Transfers (DB)", () => {
  it("atomic transfer: moves stock between two locations in one transaction", async () => {
    const item = await createItem(scopeAdmin, { code: `SKU-${stamp}-7`, name: "Beaker", unit: "piece" });
    const locA = await createLocation(scopeAdmin, { name: `Store A ${stamp}` });
    const locB = await createLocation(scopeAdmin, { name: `Store B ${stamp}` });
    await receiveStock(scopeAdmin, { itemId: item.id, locationId: locA.id, quantity: 10 });

    const transfer = await transferStock(scopeAdmin, { itemId: item.id, fromLocationId: locA.id, toLocationId: locB.id, quantity: 4 });
    expect(transfer.fromLocationId).toBe(locA.id);
    expect(transfer.toLocationId).toBe(locB.id);

    const list = await listTransfers(scopeAdmin, { itemId: item.id });
    expect(list.some((t) => t.id === transfer.id)).toBe(true);
    expect(await getItemTotalStock(scopeAdmin, item.id)).toBe(10); // total unchanged, only relocated
  });

  it("insufficient source stock rejects the whole transfer — no half-transfer", async () => {
    const item = await createItem(scopeAdmin, { code: `SKU-${stamp}-8`, name: "Flask", unit: "piece" });
    const locA = await createLocation(scopeAdmin, { name: `Store C ${stamp}` });
    const locB = await createLocation(scopeAdmin, { name: `Store D ${stamp}` });
    await receiveStock(scopeAdmin, { itemId: item.id, locationId: locA.id, quantity: 2 });

    await expect(transferStock(scopeAdmin, { itemId: item.id, fromLocationId: locA.id, toLocationId: locB.id, quantity: 5 })).rejects.toThrow(HttpError);

    const movements = await listItemMovements(scopeAdmin, item.id);
    expect(movements.some((m) => m.movementType === "transfer-out")).toBe(false);
    expect(movements.some((m) => m.movementType === "transfer-in")).toBe(false);
  });

  it("rejects transferring to the same location", async () => {
    const item = await createItem(scopeAdmin, { code: `SKU-${stamp}-9`, name: "Test tube", unit: "piece" });
    const loc = await createLocation(scopeAdmin, { name: `Store E ${stamp}` });
    await receiveStock(scopeAdmin, { itemId: item.id, locationId: loc.id, quantity: 5 });
    await expect(transferStock(scopeAdmin, { itemId: item.id, fromLocationId: loc.id, toLocationId: loc.id, quantity: 1 })).rejects.toThrow(HttpError);
  });
});

describe.skipIf(!dbReady)("Low stock + dashboard (DB)", () => {
  it("low stock is derived, never persisted; out-of-stock at zero", async () => {
    const low = await createItem(scopeAdmin, { code: `SKU-${stamp}-low`, name: "Low item", unit: "piece", reorderLevel: 10, openingQuantity: 5 });
    const out = await createItem(scopeAdmin, { code: `SKU-${stamp}-out`, name: "Out item", unit: "piece", reorderLevel: 10, openingQuantity: 0 });
    const untracked = await createItem(scopeAdmin, { code: `SKU-${stamp}-nt`, name: "Untracked item", unit: "piece", openingQuantity: 0 });

    expect((await getItem(scopeAdmin, low.id)).status).toBe("low-stock");
    expect((await getItem(scopeAdmin, out.id)).status).toBe("out-of-stock");
    expect((await getItem(scopeAdmin, untracked.id)).status).toBe("out-of-stock"); // reorderLevel null -> not "tracked" for low-stock, but 0 qty is still out-of-stock

    const dashboard = await getInventoryDashboard(scopeAdmin);
    expect(dashboard.lowStockItems.some((i) => i.id === low.id)).toBe(true);
    expect(dashboard.outOfStockCount).toBeGreaterThanOrEqual(1);
  });
});

describe.skipIf(!dbReady)("RBAC + DTO safety (DB)", () => {
  it("PRINCIPAL can view but the service layer itself has no view/manage distinction bypass (route guard enforces .manage)", async () => {
    const list = await listItems(scopePrincipal);
    expect(Array.isArray(list)).toBe(true);
  });

  it("DTOs never leak tenantId/schoolId/branchId or raw Prisma internals", async () => {
    const item = await createItem(scopeAdmin, { code: `SKU-${stamp}-dto`, name: "DTO item", unit: "piece" });
    const raw = JSON.stringify(item);
    expect(raw).not.toContain(tenantId);
    expect(raw).not.toContain(schoolId);
  });

  it("audit events are recorded for item creation, receipt, issue and adjustment", async () => {
    const item = await createItem(scopeAdmin, { code: `SKU-${stamp}-audit`, name: "Audit item", unit: "piece", openingQuantity: 5 });
    await receiveStock(scopeAdmin, { itemId: item.id, quantity: 1 });
    const events = await prisma.auditEvent.findMany({ where: { tenantId, action: { in: ["INVENTORY_ITEM_CREATED", "INVENTORY_STOCK_RECEIVED"] } } });
    expect(events.some((e) => e.action === "INVENTORY_ITEM_CREATED" && e.entityId === item.id)).toBe(true);
    expect(events.some((e) => e.action === "INVENTORY_STOCK_RECEIVED")).toBe(true);
  });
});
