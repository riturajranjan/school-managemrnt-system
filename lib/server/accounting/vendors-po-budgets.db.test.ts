// Production Accounting checkpoint DB integration tests: Vendors / Purchase
// Orders / Budgets. Real Postgres. Covers: Vendor CRUD + unique-code
// concurrency, PO create/approve/cancel lifecycle + concurrent approval +
// race-safe numbering, Budget create/approve + live actual/variance derived
// from POSTED JournalLines + duplicate-allocation concurrency, tenant
// isolation, RBAC, and historical safety (Vendor rename/inactive never
// corrupts a historical PO; a PO/Budget never writes a JournalEntry).
// Namespaced ("TVPB"). Mirrors accounting.db.test.ts's setup/teardown.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { createAccountingAccount } from "@/lib/server/accounting/accounts";
import { createAndPostJournalEntry } from "@/lib/server/accounting/journals";
import { createVendor, getVendor, listVendors, updateVendor } from "@/lib/server/accounting/vendors";
import { approvePurchaseOrder, cancelPurchaseOrder, createPurchaseOrder, getPurchaseOrder, listPurchaseOrders } from "@/lib/server/accounting/purchase-orders";
import { approveBudget, createBudget, getBudget } from "@/lib/server/accounting/budgets";
import type { OrgScope } from "@/lib/server/api/scope";

let dbReady = false;
try {
  dbReady = Boolean(await prisma.role.findFirst({ where: { key: "SCHOOL_ADMIN", isSystem: true } }));
} catch {
  dbReady = false;
}

const NS = "TVPB";
const stamp = Date.now().toString(36);

let tenantId = "", schoolId = "", branchA = "", sessionId = "";
let foreignTenantId = "", foreignSchoolId = "", foreignBranchId = "", foreignSessionId = "";
let scopeAdmin: OrgScope, scopeTeacher: OrgScope, scopeForeignAdmin: OrgScope;
let adminUser = "", teacherUser = "", foreignAdminUser = "";

async function makeUserWithRole(email: string, roleKey: string, tid: string): Promise<string> {
  const u = await prisma.user.create({ data: { email, name: email, status: "ACTIVE" }, select: { id: true } });
  const m = await prisma.tenantMembership.create({ data: { userId: u.id, tenantId: tid, status: "ACTIVE" }, select: { id: true } });
  const role = await prisma.role.findFirstOrThrow({ where: { key: roleKey, isSystem: true }, select: { id: true } });
  await prisma.roleAssignment.create({ data: { membershipId: m.id, roleId: role.id } });
  return u.id;
}

beforeAll(async () => {
  if (!dbReady) return;
  tenantId = (await prisma.tenant.create({ data: { name: `${NS} T`, slug: `tvpb-${stamp}` }, select: { id: true } })).id;
  schoolId = (await prisma.school.create({ data: { tenantId, name: `${NS} S`, code: `${NS}-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  branchA = (await prisma.branch.create({ data: { schoolId, name: "A", code: `${NS}-A`, status: "ACTIVE" }, select: { id: true } })).id;
  sessionId = (await prisma.academicSession.create({ data: { schoolId, name: "26-27", code: `${NS}-S`, startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31"), status: "ACTIVE" }, select: { id: true } })).id;

  adminUser = await makeUserWithRole(`tvpb-admin-${stamp}@x.test`, "SCHOOL_ADMIN", tenantId);
  teacherUser = await makeUserWithRole(`tvpb-t1-${stamp}@x.test`, "TEACHER", tenantId);

  foreignTenantId = (await prisma.tenant.create({ data: { name: `${NS} T2`, slug: `tvpb-b-${stamp}` }, select: { id: true } })).id;
  foreignSchoolId = (await prisma.school.create({ data: { tenantId: foreignTenantId, name: `${NS} S2`, code: `${NS}-B-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  foreignBranchId = (await prisma.branch.create({ data: { schoolId: foreignSchoolId, name: "B", code: `${NS}-B`, status: "ACTIVE" }, select: { id: true } })).id;
  foreignSessionId = (await prisma.academicSession.create({ data: { schoolId: foreignSchoolId, name: "26-27", code: `${NS}-BS`, startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31"), status: "ACTIVE" }, select: { id: true } })).id;
  foreignAdminUser = await makeUserWithRole(`tvpb-fadmin-${stamp}@x.test`, "SCHOOL_ADMIN", foreignTenantId);

  scopeAdmin = { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, actor: { id: adminUser, name: "Admin" } };
  scopeTeacher = { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, actor: { id: teacherUser, name: "Teacher" } };
  scopeForeignAdmin = { tenantId: foreignTenantId, schoolId: foreignSchoolId, branchId: foreignBranchId, academicSessionId: foreignSessionId, actor: { id: foreignAdminUser, name: "Foreign Admin" } };
});

afterAll(async () => {
  if (!dbReady || !tenantId) return;
  await prisma.auditEvent.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.budgetAllocation.deleteMany({ where: { budget: { schoolId: { in: [schoolId, foreignSchoolId] } } } });
  await prisma.budget.deleteMany({ where: { schoolId: { in: [schoolId, foreignSchoolId] } } });
  await prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrder: { schoolId: { in: [schoolId, foreignSchoolId] } } } });
  await prisma.purchaseOrder.deleteMany({ where: { schoolId: { in: [schoolId, foreignSchoolId] } } });
  await prisma.purchaseOrderCounter.deleteMany({ where: { schoolId: { in: [schoolId, foreignSchoolId] } } });
  await prisma.vendor.deleteMany({ where: { schoolId: { in: [schoolId, foreignSchoolId] } } });
  await prisma.journalLine.deleteMany({ where: { journalEntry: { schoolId: { in: [schoolId, foreignSchoolId] } } } });
  await prisma.journalEntry.deleteMany({ where: { schoolId: { in: [schoolId, foreignSchoolId] } } });
  await prisma.accountingEntryCounter.deleteMany({ where: { schoolId: { in: [schoolId, foreignSchoolId] } } });
  await prisma.accountingAccount.deleteMany({ where: { schoolId: { in: [schoolId, foreignSchoolId] } } });
  await prisma.roleAssignment.deleteMany({ where: { membership: { tenantId: { in: [tenantId, foreignTenantId] } } } });
  await prisma.tenantMembership.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.academicSession.deleteMany({ where: { schoolId: { in: [schoolId, foreignSchoolId] } } });
  await prisma.branch.deleteMany({ where: { schoolId: { in: [schoolId, foreignSchoolId] } } });
  await prisma.school.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.user.deleteMany({ where: { id: { in: [adminUser, teacherUser, foreignAdminUser] } } });
  await prisma.tenant.deleteMany({ where: { id: { in: [tenantId, foreignTenantId] } } });
});

describe.skipIf(!dbReady)("Production Accounting checkpoint — Vendors / Purchase Orders / Budgets", () => {
  describe("Vendors", () => {
    it("creates a vendor and rejects a duplicate code (case-insensitive)", async () => {
      const v = await createVendor(scopeAdmin, { code: `V-${stamp}`, name: "Bright Stationers" });
      expect(v.code).toBe(`V-${stamp}`);
      expect(v.status).toBe("active");
      await expect(createVendor(scopeAdmin, { code: `v-${stamp}`, name: "Duplicate" })).rejects.toMatchObject({ code: "VENDOR_CODE_EXISTS" });
    });

    it("resolves two concurrent creates of the same code to exactly one winner", async () => {
      const code = `V-RACE-${stamp}`;
      const results = await Promise.allSettled([createVendor(scopeAdmin, { code, name: "Race A" }), createVendor(scopeAdmin, { code, name: "Race B" })]);
      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({ code: "VENDOR_CODE_EXISTS" });
      const rows = await prisma.vendor.findMany({ where: { schoolId, code: { equals: code, mode: "insensitive" } } });
      expect(rows).toHaveLength(1);
    });

    it("deactivates and reactivates without deleting the row; TEACHER cannot manage", async () => {
      const v = await createVendor(scopeAdmin, { code: `V-STATUS-${stamp}`, name: "Status Co" });
      await expect(createVendor(scopeTeacher, { code: `V-T-${stamp}`, name: "Nope" })).rejects.toMatchObject({ code: "FORBIDDEN" });
      const deactivated = await updateVendor(scopeAdmin, v.id, { status: "inactive" });
      expect(deactivated.status).toBe("inactive");
      const stillThere = await prisma.vendor.findUnique({ where: { id: v.id } });
      expect(stillThere).not.toBeNull();
      const reactivated = await updateVendor(scopeAdmin, v.id, { status: "active" });
      expect(reactivated.status).toBe("active");
    });

    it("isolates vendors by tenant", async () => {
      const v = await createVendor(scopeAdmin, { code: `V-ISO-${stamp}`, name: "Isolated" });
      await expect(getVendor(scopeForeignAdmin, v.id)).rejects.toMatchObject({ code: "VENDOR_NOT_FOUND" });
      const { data } = await listVendors(scopeForeignAdmin, {});
      expect(data.find((x) => x.id === v.id)).toBeUndefined();
    });
  });

  describe("Purchase Orders", () => {
    it("computes Decimal-safe totals and never writes a JournalEntry on create", async () => {
      const vendor = await createVendor(scopeAdmin, { code: `V-PO1-${stamp}`, name: "PO Vendor One" });
      const beforeJournals = await prisma.journalEntry.count({ where: { schoolId } });
      const po = await createPurchaseOrder(scopeAdmin, {
        vendorId: vendor.id, orderDate: "2026-08-01",
        items: [
          { description: "Item A", quantity: 3, unitRate: 100, taxPercent: 12 },
          { description: "Item B", quantity: 2, unitRate: 50, taxPercent: 0 },
        ],
        discountTotal: 10,
      });
      expect(po.status).toBe("draft");
      expect(po.subtotal).toBe(3 * 100 + 2 * 50);
      expect(po.taxTotal).toBe(3 * 100 * 0.12);
      expect(po.discountTotal).toBe(10);
      expect(po.totalAmount).toBe(po.subtotal + po.taxTotal - po.discountTotal);
      expect(po.items[0].lineTotal).toBe(336); // Decimal-exact 3*100*1.12 — deliberately not the JS float expression (336.00000000000006)
      const afterJournals = await prisma.journalEntry.count({ where: { schoolId } });
      expect(afterJournals).toBe(beforeJournals);
    });

    it("assigns unique, race-safe PO numbers under concurrent creation", async () => {
      const vendor = await createVendor(scopeAdmin, { code: `V-RACE2-${stamp}`, name: "Race Vendor" });
      const draft = { vendorId: vendor.id, orderDate: "2026-08-02", items: [{ description: "X", quantity: 1, unitRate: 10 }] };
      const results = await Promise.all(Array.from({ length: 5 }, () => createPurchaseOrder(scopeAdmin, draft)));
      const numbers = results.map((r) => r.poNumber);
      expect(new Set(numbers).size).toBe(5);
    });

    it("approves DRAFT -> APPROVED without ever writing a JournalEntry, and rejects re-approval", async () => {
      const vendor = await createVendor(scopeAdmin, { code: `V-PO2-${stamp}`, name: "PO Vendor Two" });
      const po = await createPurchaseOrder(scopeAdmin, { vendorId: vendor.id, orderDate: "2026-08-03", items: [{ description: "Y", quantity: 1, unitRate: 500 }] });
      const beforeJournals = await prisma.journalEntry.count({ where: { schoolId } });
      const approved = await approvePurchaseOrder(scopeAdmin, po.id);
      expect(approved.status).toBe("approved");
      expect(approved.approvedByName).toBe("Admin");
      const afterJournals = await prisma.journalEntry.count({ where: { schoolId } });
      expect(afterJournals).toBe(beforeJournals);
      await expect(approvePurchaseOrder(scopeAdmin, po.id)).rejects.toMatchObject({ code: "INVALID_PURCHASE_ORDER_TRANSITION" });
    });

    it("cancels a DRAFT PO but refuses to cancel an APPROVED one (immutable once approved)", async () => {
      const vendor = await createVendor(scopeAdmin, { code: `V-PO3-${stamp}`, name: "PO Vendor Three" });
      const draftPo = await createPurchaseOrder(scopeAdmin, { vendorId: vendor.id, orderDate: "2026-08-04", items: [{ description: "Z", quantity: 1, unitRate: 20 }] });
      const cancelled = await cancelPurchaseOrder(scopeAdmin, draftPo.id, { reason: "No longer needed" });
      expect(cancelled.status).toBe("cancelled");
      expect(cancelled.cancellationReason).toBe("No longer needed");

      const approvedPo = await createPurchaseOrder(scopeAdmin, { vendorId: vendor.id, orderDate: "2026-08-04", items: [{ description: "Z2", quantity: 1, unitRate: 20 }] });
      await approvePurchaseOrder(scopeAdmin, approvedPo.id);
      await expect(cancelPurchaseOrder(scopeAdmin, approvedPo.id, { reason: "Try anyway" })).rejects.toMatchObject({ code: "INVALID_PURCHASE_ORDER_TRANSITION" });
    });

    it("resolves two concurrent approvals to exactly one winner", async () => {
      const vendor = await createVendor(scopeAdmin, { code: `V-PORACE-${stamp}`, name: "PO Race Vendor" });
      const po = await createPurchaseOrder(scopeAdmin, { vendorId: vendor.id, orderDate: "2026-08-05", items: [{ description: "R", quantity: 1, unitRate: 1 }] });
      const results = await Promise.allSettled([approvePurchaseOrder(scopeAdmin, po.id), approvePurchaseOrder(scopeAdmin, po.id)]);
      const succeeded = results.filter((r) => r.status === "fulfilled");
      const failed = results.filter((r) => r.status === "rejected");
      expect(succeeded).toHaveLength(1);
      expect(failed).toHaveLength(1);
      expect((failed[0] as PromiseRejectedResult).reason).toMatchObject({ code: "INVALID_PURCHASE_ORDER_TRANSITION" });
      const final = await getPurchaseOrder(scopeAdmin, po.id);
      expect(final.status).toBe("approved");
    });

    it("historical safety: a later vendor rename/inactivation never changes an already-issued PO's snapshot", async () => {
      const vendor = await createVendor(scopeAdmin, { code: `V-HIST-${stamp}`, name: "Original Name" });
      const po = await createPurchaseOrder(scopeAdmin, { vendorId: vendor.id, orderDate: "2026-08-06", items: [{ description: "H", quantity: 1, unitRate: 10 }] });
      expect(po.vendorName).toBe("Original Name");
      expect(po.vendorCode).toBe(`V-HIST-${stamp}`);

      await updateVendor(scopeAdmin, vendor.id, { name: "Renamed Vendor Inc." });
      await updateVendor(scopeAdmin, vendor.id, { status: "inactive" });

      const reloaded = await getPurchaseOrder(scopeAdmin, po.id);
      expect(reloaded.vendorName).toBe("Original Name");
      expect(reloaded.vendorCode).toBe(`V-HIST-${stamp}`);
      const stillExists = await prisma.purchaseOrder.findUnique({ where: { id: po.id } });
      expect(stillExists).not.toBeNull();
    });

    it("rejects a PO against an inactive vendor and isolates POs by tenant", async () => {
      const vendor = await createVendor(scopeAdmin, { code: `V-INACT-${stamp}`, name: "Inactive Vendor" });
      await updateVendor(scopeAdmin, vendor.id, { status: "inactive" });
      await expect(createPurchaseOrder(scopeAdmin, { vendorId: vendor.id, orderDate: "2026-08-07", items: [{ description: "N", quantity: 1, unitRate: 1 }] })).rejects.toMatchObject({ code: "VENDOR_NOT_ACTIVE" });

      const activeVendor = await createVendor(scopeAdmin, { code: `V-ISOPO-${stamp}`, name: "Isolation PO Vendor" });
      const po = await createPurchaseOrder(scopeAdmin, { vendorId: activeVendor.id, orderDate: "2026-08-07", items: [{ description: "I", quantity: 1, unitRate: 1 }] });
      await expect(getPurchaseOrder(scopeForeignAdmin, po.id)).rejects.toMatchObject({ code: "PURCHASE_ORDER_NOT_FOUND" });
      const { data } = await listPurchaseOrders(scopeForeignAdmin, {});
      expect(data.find((x) => x.id === po.id)).toBeUndefined();
    });
  });

  describe("Budgets", () => {
    it("derives actual/variance live from POSTED JournalLines and never persists a second actual authority", async () => {
      const expenseAccount = await createAccountingAccount(scopeAdmin, { code: `5900-${stamp}`, name: "Test Supplies Expense", type: "expense" });
      const cashAccount = await createAccountingAccount(scopeAdmin, { code: `1900-${stamp}`, name: "Test Cash", type: "asset" });

      const budget = await createBudget(scopeAdmin, {
        name: "FY26 Test Budget", periodStart: "2026-04-01", periodEnd: "2027-03-31",
        allocations: [{ accountingAccountId: expenseAccount.id, amount: 10000 }],
      });
      expect(budget.status).toBe("draft");
      expect(budget.allocations[0].budgeted).toBe(10000);
      expect(budget.allocations[0].actual).toBe(0);
      expect(budget.allocations[0].variance).toBe(10000);

      await createAndPostJournalEntry(scopeAdmin, {
        entryDate: "2026-06-15", description: "Supplies purchase",
        lines: [{ accountId: expenseAccount.id, debit: 2500 }, { accountId: cashAccount.id, credit: 2500 }],
      });

      const reloaded = await getBudget(scopeAdmin, budget.id);
      expect(reloaded.allocations[0].actual).toBe(2500);
      expect(reloaded.allocations[0].variance).toBe(10000 - 2500);
      expect(reloaded.totalActual).toBe(2500);

      // The stored allocation amount itself never changes — only the derived read does.
      const rawAllocation = await prisma.budgetAllocation.findFirst({ where: { budgetId: budget.id } });
      expect(Number(rawAllocation?.amount)).toBe(10000);
    });

    it("does not count journal lines outside the budget's period", async () => {
      const account = await createAccountingAccount(scopeAdmin, { code: `5901-${stamp}`, name: "Out Of Period Expense", type: "expense" });
      const cashAccount = await createAccountingAccount(scopeAdmin, { code: `1901-${stamp}`, name: "Test Cash 2", type: "asset" });
      const budget = await createBudget(scopeAdmin, { name: "Narrow Window Budget", periodStart: "2026-01-01", periodEnd: "2026-01-31", allocations: [{ accountingAccountId: account.id, amount: 5000 }] });
      await createAndPostJournalEntry(scopeAdmin, { entryDate: "2026-06-15", description: "Outside window", lines: [{ accountId: account.id, debit: 999 }, { accountId: cashAccount.id, credit: 999 }] });
      const reloaded = await getBudget(scopeAdmin, budget.id);
      expect(reloaded.allocations[0].actual).toBe(0);
    });

    it("rejects a duplicate account within one create request", async () => {
      const account = await createAccountingAccount(scopeAdmin, { code: `5902-${stamp}`, name: "Dup Alloc Expense", type: "expense" });
      await expect(
        createBudget(scopeAdmin, { name: "Dup Budget", periodStart: "2026-04-01", periodEnd: "2027-03-31", allocations: [{ accountingAccountId: account.id, amount: 100 }, { accountingAccountId: account.id, amount: 200 }] }),
      ).rejects.toMatchObject({ code: "INVALID_BUDGET_ALLOCATION" });
    });

    it("enforces the (budgetId, accountingAccountId) unique constraint under concurrent inserts", async () => {
      const account = await createAccountingAccount(scopeAdmin, { code: `5903-${stamp}`, name: "Concurrency Alloc Expense", type: "expense" });
      const budget = await createBudget(scopeAdmin, { name: "Concurrency Budget", periodStart: "2026-04-01", periodEnd: "2027-03-31", allocations: [{ accountingAccountId: account.id, amount: 1 }] });
      // Simulate a second allocation racing in for the SAME account directly
      // against Prisma (no allocation-edit endpoint exists in this V1 — the
      // DB constraint is the sole guard here).
      const account2 = await createAccountingAccount(scopeAdmin, { code: `5904-${stamp}`, name: "Second Alloc Expense", type: "expense" });
      const insertSame = (accountId: string) => prisma.budgetAllocation.create({ data: { budgetId: budget.id, accountingAccountId: accountId, amount: new Prisma.Decimal(50) } });
      const results = await Promise.allSettled([insertSame(account2.id), insertSame(account2.id)]);
      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      const rows = await prisma.budgetAllocation.findMany({ where: { budgetId: budget.id, accountingAccountId: account2.id } });
      expect(rows).toHaveLength(1);
    });

    it("approves DRAFT -> APPROVED without writing a JournalEntry, resolves concurrent approval to one winner, and keeps stored allocations immutable across later journals", async () => {
      const account = await createAccountingAccount(scopeAdmin, { code: `5905-${stamp}`, name: "Approve Flow Expense", type: "expense" });
      const cashAccount = await createAccountingAccount(scopeAdmin, { code: `1905-${stamp}`, name: "Approve Flow Cash", type: "asset" });
      const budget = await createBudget(scopeAdmin, { name: "Approve Flow Budget", periodStart: "2026-04-01", periodEnd: "2027-03-31", allocations: [{ accountingAccountId: account.id, amount: 8000 }] });

      const beforeJournals = await prisma.journalEntry.count({ where: { schoolId } });
      const results = await Promise.allSettled([approveBudget(scopeAdmin, budget.id), approveBudget(scopeAdmin, budget.id)]);
      const afterJournals = await prisma.journalEntry.count({ where: { schoolId } });
      expect(afterJournals).toBe(beforeJournals);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);

      await createAndPostJournalEntry(scopeAdmin, { entryDate: "2026-07-01", description: "Post-approval spend", lines: [{ accountId: account.id, debit: 1200 }, { accountId: cashAccount.id, credit: 1200 }] });
      const reloaded = await getBudget(scopeAdmin, budget.id);
      expect(reloaded.status).toBe("approved");
      expect(reloaded.allocations[0].budgeted).toBe(8000); // unchanged
      expect(reloaded.allocations[0].actual).toBe(1200); // reflects the new posting
      expect(reloaded.allocations[0].variance).toBe(6800);
    });

    it("rejects an allocation against an archived or foreign account, and TEACHER cannot manage", async () => {
      const account = await createAccountingAccount(scopeAdmin, { code: `5906-${stamp}`, name: "Archive Test Expense", type: "expense" });
      await prisma.accountingAccount.update({ where: { id: account.id }, data: { status: "ARCHIVED" } });
      await expect(createBudget(scopeAdmin, { name: "Archived Alloc Budget", periodStart: "2026-04-01", periodEnd: "2027-03-31", allocations: [{ accountingAccountId: account.id, amount: 100 }] })).rejects.toMatchObject({ code: "ACCOUNTING_ACCOUNT_NOT_FOUND" });

      const validAccount = await createAccountingAccount(scopeAdmin, { code: `5907-${stamp}`, name: "Valid For RBAC", type: "expense" });
      await expect(createBudget(scopeTeacher, { name: "Teacher Budget", periodStart: "2026-04-01", periodEnd: "2027-03-31", allocations: [{ accountingAccountId: validAccount.id, amount: 100 }] })).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("isolates budgets by tenant", async () => {
      const account = await createAccountingAccount(scopeAdmin, { code: `5908-${stamp}`, name: "Isolation Expense", type: "expense" });
      const budget = await createBudget(scopeAdmin, { name: "Isolation Budget", periodStart: "2026-04-01", periodEnd: "2027-03-31", allocations: [{ accountingAccountId: account.id, amount: 100 }] });
      await expect(getBudget(scopeForeignAdmin, budget.id)).rejects.toMatchObject({ code: "BUDGET_NOT_FOUND" });
    });

    it("rejects periodEnd before periodStart", async () => {
      const account = await createAccountingAccount(scopeAdmin, { code: `5909-${stamp}`, name: "Bad Dates Expense", type: "expense" });
      await expect(createBudget(scopeAdmin, { name: "Bad Dates", periodStart: "2026-04-01", periodEnd: "2026-01-01", allocations: [{ accountingAccountId: account.id, amount: 100 }] })).rejects.toThrow();
    });
  });
});
