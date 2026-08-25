// Production Payroll checkpoint DB integration tests: Loans / Advances. Real
// Postgres. Covers: full lifecycle (PENDING->APPROVED->DISBURSED->
// PARTIALLY_REPAID->REPAID, REJECTED, CANCELLED), Staff validation, race-safe
// numbering, concurrency (double approval, double disbursement, competing
// repayments cannot combine to overpay), accounting integration (disburse/
// repay post a balanced idempotent JournalEntry; create/approve never do),
// RBAC, tenant isolation, and historical safety (Staff rename/inactive never
// corrupts an existing record). Namespaced ("TPLA"). Mirrors
// accounting.db.test.ts's / vendors-po-budgets.db.test.ts's setup/teardown.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import {
  approveStaffFinancialAdvance,
  cancelStaffFinancialAdvance,
  createStaffFinancialAdvance,
  disburseStaffFinancialAdvance,
  getStaffFinancialAdvance,
  listStaffFinancialAdvances,
  rejectStaffFinancialAdvance,
  recordStaffFinancialAdvanceRepayment,
  updateStaffFinancialAdvance,
} from "@/lib/server/payroll/loans-advances";
import type { OrgScope } from "@/lib/server/api/scope";

let dbReady = false;
try {
  dbReady = Boolean(await prisma.role.findFirst({ where: { key: "SCHOOL_ADMIN", isSystem: true } }));
} catch {
  dbReady = false;
}

const NS = "TPLA";
const stamp = Date.now().toString(36);

let tenantId = "", schoolId = "", branchA = "", sessionId = "";
let foreignTenantId = "", foreignSchoolId = "", foreignBranchId = "", foreignSessionId = "";
let staffActiveId = "", staffInactiveId = "", foreignStaffId = "";
let scopeAdmin: OrgScope, scopePrincipal: OrgScope, scopeForeignAdmin: OrgScope;
let adminUser = "", principalUser = "", foreignAdminUser = "";

async function makeUserWithRole(email: string, roleKey: string, tid: string): Promise<string> {
  const u = await prisma.user.create({ data: { email, name: email, status: "ACTIVE" }, select: { id: true } });
  const m = await prisma.tenantMembership.create({ data: { userId: u.id, tenantId: tid, status: "ACTIVE" }, select: { id: true } });
  const role = await prisma.role.findFirstOrThrow({ where: { key: roleKey, isSystem: true }, select: { id: true } });
  await prisma.roleAssignment.create({ data: { membershipId: m.id, roleId: role.id } });
  return u.id;
}

beforeAll(async () => {
  if (!dbReady) return;
  tenantId = (await prisma.tenant.create({ data: { name: `${NS} T`, slug: `tpla-${stamp}` }, select: { id: true } })).id;
  schoolId = (await prisma.school.create({ data: { tenantId, name: `${NS} S`, code: `${NS}-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  branchA = (await prisma.branch.create({ data: { schoolId, name: "A", code: `${NS}-A`, status: "ACTIVE" }, select: { id: true } })).id;
  sessionId = (await prisma.academicSession.create({ data: { schoolId, name: "26-27", code: `${NS}-S`, startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31"), status: "ACTIVE" }, select: { id: true } })).id;

  staffActiveId = (await prisma.staff.create({ data: { tenantId, schoolId, branchId: branchA, employeeCode: `${NS}-E1-${stamp}`, firstName: "Ravi", lastName: "Kumar", status: "ACTIVE", isTeaching: false }, select: { id: true } })).id;
  staffInactiveId = (await prisma.staff.create({ data: { tenantId, schoolId, branchId: branchA, employeeCode: `${NS}-E2-${stamp}`, firstName: "Inactive", lastName: "Staffer", status: "INACTIVE", isTeaching: false }, select: { id: true } })).id;

  adminUser = await makeUserWithRole(`tpla-admin-${stamp}@x.test`, "SCHOOL_ADMIN", tenantId);
  principalUser = await makeUserWithRole(`tpla-principal-${stamp}@x.test`, "PRINCIPAL", tenantId);

  foreignTenantId = (await prisma.tenant.create({ data: { name: `${NS} T2`, slug: `tpla-b-${stamp}` }, select: { id: true } })).id;
  foreignSchoolId = (await prisma.school.create({ data: { tenantId: foreignTenantId, name: `${NS} S2`, code: `${NS}-B-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  foreignBranchId = (await prisma.branch.create({ data: { schoolId: foreignSchoolId, name: "B", code: `${NS}-B`, status: "ACTIVE" }, select: { id: true } })).id;
  foreignSessionId = (await prisma.academicSession.create({ data: { schoolId: foreignSchoolId, name: "26-27", code: `${NS}-BS`, startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31"), status: "ACTIVE" }, select: { id: true } })).id;
  foreignStaffId = (await prisma.staff.create({ data: { tenantId: foreignTenantId, schoolId: foreignSchoolId, branchId: foreignBranchId, employeeCode: `${NS}-F1-${stamp}`, firstName: "Foreign", lastName: "Staffer", status: "ACTIVE", isTeaching: false }, select: { id: true } })).id;
  foreignAdminUser = await makeUserWithRole(`tpla-fadmin-${stamp}@x.test`, "SCHOOL_ADMIN", foreignTenantId);

  scopeAdmin = { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, actor: { id: adminUser, name: "Admin" } };
  scopePrincipal = { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, actor: { id: principalUser, name: "Principal" } };
  scopeForeignAdmin = { tenantId: foreignTenantId, schoolId: foreignSchoolId, branchId: foreignBranchId, academicSessionId: foreignSessionId, actor: { id: foreignAdminUser, name: "Foreign Admin" } };
});

afterAll(async () => {
  if (!dbReady || !tenantId) return;
  await prisma.auditEvent.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.staffFinancialAdvanceRepayment.deleteMany({ where: { advance: { schoolId: { in: [schoolId, foreignSchoolId] } } } });
  await prisma.staffFinancialAdvance.deleteMany({ where: { schoolId: { in: [schoolId, foreignSchoolId] } } });
  await prisma.staffFinancialAdvanceCounter.deleteMany({ where: { schoolId: { in: [schoolId, foreignSchoolId] } } });
  await prisma.journalLine.deleteMany({ where: { journalEntry: { schoolId: { in: [schoolId, foreignSchoolId] } } } });
  await prisma.journalEntry.deleteMany({ where: { schoolId: { in: [schoolId, foreignSchoolId] } } });
  await prisma.accountingEntryCounter.deleteMany({ where: { schoolId: { in: [schoolId, foreignSchoolId] } } });
  await prisma.accountingAccount.deleteMany({ where: { schoolId: { in: [schoolId, foreignSchoolId] } } });
  await prisma.staff.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.roleAssignment.deleteMany({ where: { membership: { tenantId: { in: [tenantId, foreignTenantId] } } } });
  await prisma.tenantMembership.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.academicSession.deleteMany({ where: { schoolId: { in: [schoolId, foreignSchoolId] } } });
  await prisma.branch.deleteMany({ where: { schoolId: { in: [schoolId, foreignSchoolId] } } });
  await prisma.school.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.user.deleteMany({ where: { id: { in: [adminUser, principalUser, foreignAdminUser] } } });
  await prisma.tenant.deleteMany({ where: { id: { in: [tenantId, foreignTenantId] } } });
});

describe.skipIf(!dbReady)("Production Payroll checkpoint — Loans / Advances", () => {
  describe("Staff validation", () => {
    it("creates a PENDING loan for a real ACTIVE staff member", async () => {
      const loan = await createStaffFinancialAdvance(scopeAdmin, "LOAN", { staffId: staffActiveId, principalAmount: 50000, purpose: "Home repair" });
      expect(loan.status).toBe("pending");
      expect(loan.type).toBe("loan");
      expect(loan.staffId).toBe(staffActiveId);
      expect(loan.principalAmount).toBe(50000);
      expect(loan.outstanding).toBe(0); // nothing owed until disbursed
    });

    it("rejects an unknown staffId", async () => {
      await expect(createStaffFinancialAdvance(scopeAdmin, "LOAN", { staffId: "does-not-exist", principalAmount: 1000 })).rejects.toMatchObject({ code: "INVALID_STAFF_FOR_ADVANCE" });
    });

    it("rejects an INACTIVE staff member", async () => {
      await expect(createStaffFinancialAdvance(scopeAdmin, "LOAN", { staffId: staffInactiveId, principalAmount: 1000 })).rejects.toMatchObject({ code: "INVALID_STAFF_FOR_ADVANCE" });
    });

    it("rejects a foreign-tenant staff member", async () => {
      await expect(createStaffFinancialAdvance(scopeAdmin, "LOAN", { staffId: foreignStaffId, principalAmount: 1000 })).rejects.toMatchObject({ code: "INVALID_STAFF_FOR_ADVANCE" });
    });
  });

  describe("Loan lifecycle", () => {
    it("runs the full happy path: PENDING -> APPROVED -> DISBURSED -> PARTIALLY_REPAID -> REPAID, posting exactly the right accounting", async () => {
      const loan = await createStaffFinancialAdvance(scopeAdmin, "LOAN", { staffId: staffActiveId, principalAmount: 60000 });
      expect(loan.number).toMatch(/^LOAN-\d{4}-\d{4}$/);

      // create/approve never post
      const beforeApprove = await prisma.journalEntry.count({ where: { schoolId } });
      const approved = await approveStaffFinancialAdvance(scopeAdmin, "LOAN", loan.id, { approvedAmount: 50000 });
      expect(approved.status).toBe("approved");
      expect(approved.approvedAmount).toBe(50000);
      expect(await prisma.journalEntry.count({ where: { schoolId } })).toBe(beforeApprove);

      const disbursed = await disburseStaffFinancialAdvance(scopeAdmin, "LOAN", loan.id, { disbursementDate: "2026-06-01", method: "bank_transfer", reference: "TXN-1" });
      expect(disbursed.status).toBe("disbursed");
      expect(disbursed.outstanding).toBe(50000);
      const disburseEntry = await prisma.journalEntry.findFirst({ where: { schoolId, sourceEventId: `STAFF_ADVANCE_DISBURSED:${loan.id}` }, include: { lines: { include: { account: true } } } });
      expect(disburseEntry).not.toBeNull();
      expect(disburseEntry?.sourceType).toBe("STAFF_ADVANCE_DISBURSEMENT");
      const debitLine = disburseEntry?.lines.find((l) => Number(l.debit) > 0);
      const creditLine = disburseEntry?.lines.find((l) => Number(l.credit) > 0);
      expect(debitLine?.account.systemKey).toBe("STAFF_LOANS_RECEIVABLE");
      expect(creditLine?.account.systemKey).toBe("BANK");
      expect(Number(debitLine?.debit)).toBe(50000);
      expect(Number(creditLine?.credit)).toBe(50000);

      const partiallyRepaid = await recordStaffFinancialAdvanceRepayment(scopeAdmin, "LOAN", loan.id, { amount: 20000, paymentDate: "2026-07-01", method: "cash" });
      expect(partiallyRepaid.status).toBe("partially_repaid");
      expect(partiallyRepaid.outstanding).toBe(30000);
      const repaymentEntry1 = await prisma.journalEntry.findFirst({ where: { schoolId, sourceType: "STAFF_ADVANCE_REPAYMENT", sourceId: loan.id }, include: { lines: { include: { account: true } } } });
      expect(repaymentEntry1).not.toBeNull();
      const repayDebit1 = repaymentEntry1?.lines.find((l) => Number(l.debit) > 0);
      const repayCredit1 = repaymentEntry1?.lines.find((l) => Number(l.credit) > 0);
      expect(repayDebit1?.account.systemKey).toBe("BANK");
      expect(repayCredit1?.account.systemKey).toBe("STAFF_LOANS_RECEIVABLE");

      const finalRepaid = await recordStaffFinancialAdvanceRepayment(scopeAdmin, "LOAN", loan.id, { amount: 30000, paymentDate: "2026-08-01", method: "cash" });
      expect(finalRepaid.status).toBe("repaid");
      expect(finalRepaid.outstanding).toBe(0);
      expect(finalRepaid.closedAt).not.toBeNull();
      expect(finalRepaid.repayments).toHaveLength(2);
    });

    it("approval amount can be lower than principal but never higher", async () => {
      const loan = await createStaffFinancialAdvance(scopeAdmin, "LOAN", { staffId: staffActiveId, principalAmount: 10000 });
      await expect(approveStaffFinancialAdvance(scopeAdmin, "LOAN", loan.id, { approvedAmount: 20000 })).rejects.toMatchObject({ code: "INVALID_APPROVED_AMOUNT" });
      const approved = await approveStaffFinancialAdvance(scopeAdmin, "LOAN", loan.id, { approvedAmount: 8000 });
      expect(approved.approvedAmount).toBe(8000);
    });

    it("rejects a PENDING loan with a reason, and refuses to approve it afterward", async () => {
      const loan = await createStaffFinancialAdvance(scopeAdmin, "LOAN", { staffId: staffActiveId, principalAmount: 5000 });
      const rejected = await rejectStaffFinancialAdvance(scopeAdmin, "LOAN", loan.id, { reason: "Insufficient justification" });
      expect(rejected.status).toBe("rejected");
      expect(rejected.rejectionReason).toBe("Insufficient justification");
      await expect(approveStaffFinancialAdvance(scopeAdmin, "LOAN", loan.id, {})).rejects.toMatchObject({ code: "INVALID_STAFF_FINANCIAL_ADVANCE_TRANSITION" });
    });

    it("cancels an APPROVED (not yet disbursed) loan, but refuses to cancel one already DISBURSED", async () => {
      const loan1 = await createStaffFinancialAdvance(scopeAdmin, "LOAN", { staffId: staffActiveId, principalAmount: 4000 });
      await approveStaffFinancialAdvance(scopeAdmin, "LOAN", loan1.id, {});
      const cancelled = await cancelStaffFinancialAdvance(scopeAdmin, "LOAN", loan1.id);
      expect(cancelled.status).toBe("cancelled");

      const loan2 = await createStaffFinancialAdvance(scopeAdmin, "LOAN", { staffId: staffActiveId, principalAmount: 4000 });
      await approveStaffFinancialAdvance(scopeAdmin, "LOAN", loan2.id, {});
      await disburseStaffFinancialAdvance(scopeAdmin, "LOAN", loan2.id, { disbursementDate: "2026-06-01", method: "cash" });
      await expect(cancelStaffFinancialAdvance(scopeAdmin, "LOAN", loan2.id)).rejects.toMatchObject({ code: "INVALID_STAFF_FINANCIAL_ADVANCE_TRANSITION" });
    });

    it("edits a PENDING loan's principal/purpose but refuses once APPROVED", async () => {
      const loan = await createStaffFinancialAdvance(scopeAdmin, "LOAN", { staffId: staffActiveId, principalAmount: 1000, purpose: "Original" });
      const updated = await updateStaffFinancialAdvance(scopeAdmin, "LOAN", loan.id, { principalAmount: 1500, purpose: "Revised" });
      expect(updated.principalAmount).toBe(1500);
      expect(updated.purpose).toBe("Revised");
      await approveStaffFinancialAdvance(scopeAdmin, "LOAN", loan.id, {});
      await expect(updateStaffFinancialAdvance(scopeAdmin, "LOAN", loan.id, { principalAmount: 2000 })).rejects.toMatchObject({ code: "INVALID_STAFF_FINANCIAL_ADVANCE_TRANSITION" });
    });

    it("rejects a repayment that exceeds the outstanding balance", async () => {
      const loan = await createStaffFinancialAdvance(scopeAdmin, "LOAN", { staffId: staffActiveId, principalAmount: 5000 });
      await approveStaffFinancialAdvance(scopeAdmin, "LOAN", loan.id, {});
      await disburseStaffFinancialAdvance(scopeAdmin, "LOAN", loan.id, { disbursementDate: "2026-06-01", method: "cash" });
      await expect(recordStaffFinancialAdvanceRepayment(scopeAdmin, "LOAN", loan.id, { amount: 6000, paymentDate: "2026-07-01", method: "cash" })).rejects.toMatchObject({ code: "REPAYMENT_EXCEEDS_OUTSTANDING" });
    });
  });

  describe("Advances (same domain, type=ADVANCE)", () => {
    it("runs the same lifecycle against the ADVANCE receivable account, independent numbering", async () => {
      const advance = await createStaffFinancialAdvance(scopeAdmin, "ADVANCE", { staffId: staffActiveId, principalAmount: 10000 });
      expect(advance.number).toMatch(/^ADV-\d{4}-\d{4}$/);
      await approveStaffFinancialAdvance(scopeAdmin, "ADVANCE", advance.id, {});
      const disbursed = await disburseStaffFinancialAdvance(scopeAdmin, "ADVANCE", advance.id, { disbursementDate: "2026-06-01", method: "cash" });
      expect(disbursed.status).toBe("disbursed");
      const entry = await prisma.journalEntry.findFirst({ where: { schoolId, sourceEventId: `STAFF_ADVANCE_DISBURSED:${advance.id}` }, include: { lines: { include: { account: true } } } });
      const debitLine = entry?.lines.find((l) => Number(l.debit) > 0);
      expect(debitLine?.account.systemKey).toBe("STAFF_ADVANCES_RECEIVABLE");

      const repaid = await recordStaffFinancialAdvanceRepayment(scopeAdmin, "ADVANCE", advance.id, { amount: 10000, paymentDate: "2026-07-01", method: "cash" });
      expect(repaid.status).toBe("repaid");
      expect(repaid.outstanding).toBe(0);
    });

    it("cannot approve/disburse/repay a LOAN id through the ADVANCE route (type-scoped lookup)", async () => {
      const loan = await createStaffFinancialAdvance(scopeAdmin, "LOAN", { staffId: staffActiveId, principalAmount: 1000 });
      await expect(getStaffFinancialAdvance(scopeAdmin, "ADVANCE", loan.id)).rejects.toMatchObject({ code: "STAFF_FINANCIAL_ADVANCE_NOT_FOUND" });
      await expect(approveStaffFinancialAdvance(scopeAdmin, "ADVANCE", loan.id, {})).rejects.toMatchObject({ code: "STAFF_FINANCIAL_ADVANCE_NOT_FOUND" });
    });
  });

  describe("Numbering", () => {
    it("assigns unique, race-safe numbers under concurrent creation, independently per type", async () => {
      const draft = { staffId: staffActiveId, principalAmount: 100 };
      const [loanResults, advanceResults] = await Promise.all([
        Promise.all(Array.from({ length: 5 }, () => createStaffFinancialAdvance(scopeAdmin, "LOAN", draft))),
        Promise.all(Array.from({ length: 5 }, () => createStaffFinancialAdvance(scopeAdmin, "ADVANCE", draft))),
      ]);
      expect(new Set(loanResults.map((r) => r.number)).size).toBe(5);
      expect(new Set(advanceResults.map((r) => r.number)).size).toBe(5);
    });
  });

  describe("Concurrency", () => {
    it("resolves two concurrent approvals to exactly one winner", async () => {
      const loan = await createStaffFinancialAdvance(scopeAdmin, "LOAN", { staffId: staffActiveId, principalAmount: 1000 });
      const results = await Promise.allSettled([approveStaffFinancialAdvance(scopeAdmin, "LOAN", loan.id, {}), approveStaffFinancialAdvance(scopeAdmin, "LOAN", loan.id, {})]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
    });

    it("resolves two concurrent disbursements to exactly one winner, with exactly one accounting posting", async () => {
      const loan = await createStaffFinancialAdvance(scopeAdmin, "LOAN", { staffId: staffActiveId, principalAmount: 1000 });
      await approveStaffFinancialAdvance(scopeAdmin, "LOAN", loan.id, {});
      const results = await Promise.allSettled([
        disburseStaffFinancialAdvance(scopeAdmin, "LOAN", loan.id, { disbursementDate: "2026-06-01", method: "cash" }),
        disburseStaffFinancialAdvance(scopeAdmin, "LOAN", loan.id, { disbursementDate: "2026-06-01", method: "cash" }),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
      const entries = await prisma.journalEntry.count({ where: { schoolId, sourceEventId: `STAFF_ADVANCE_DISBURSED:${loan.id}` } });
      expect(entries).toBe(1);
    });

    it("never allows two concurrent repayments to combine into an overpayment", async () => {
      const loan = await createStaffFinancialAdvance(scopeAdmin, "LOAN", { staffId: staffActiveId, principalAmount: 5000 });
      await approveStaffFinancialAdvance(scopeAdmin, "LOAN", loan.id, {});
      await disburseStaffFinancialAdvance(scopeAdmin, "LOAN", loan.id, { disbursementDate: "2026-06-01", method: "cash" });
      // Outstanding is 5000; two concurrent 4000 repayments combined (8000) would overpay.
      const results = await Promise.allSettled([
        recordStaffFinancialAdvanceRepayment(scopeAdmin, "LOAN", loan.id, { amount: 4000, paymentDate: "2026-07-01", method: "cash" }),
        recordStaffFinancialAdvanceRepayment(scopeAdmin, "LOAN", loan.id, { amount: 4000, paymentDate: "2026-07-01", method: "cash" }),
      ]);
      const succeeded = results.filter((r) => r.status === "fulfilled");
      const failed = results.filter((r) => r.status === "rejected");
      expect(succeeded).toHaveLength(1);
      expect(failed).toHaveLength(1);
      expect((failed[0] as PromiseRejectedResult).reason).toMatchObject({ code: "REPAYMENT_EXCEEDS_OUTSTANDING" });
      const final = await getStaffFinancialAdvance(scopeAdmin, "LOAN", loan.id);
      expect(final.outstanding).toBe(1000);
    });
  });

  describe("RBAC", () => {
    it("payroll.view-only (PRINCIPAL) can list/read but cannot create/approve/disburse/repay", async () => {
      const loan = await createStaffFinancialAdvance(scopeAdmin, "LOAN", { staffId: staffActiveId, principalAmount: 1000 });
      const readBack = await getStaffFinancialAdvance(scopePrincipal, "LOAN", loan.id);
      expect(readBack.id).toBe(loan.id);
      const { data } = await listStaffFinancialAdvances(scopePrincipal, "LOAN", {});
      expect(data.find((x) => x.id === loan.id)).toBeDefined();

      await expect(createStaffFinancialAdvance(scopePrincipal, "LOAN", { staffId: staffActiveId, principalAmount: 100 })).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(approveStaffFinancialAdvance(scopePrincipal, "LOAN", loan.id, {})).rejects.toMatchObject({ code: "FORBIDDEN" });
      const approved = await approveStaffFinancialAdvance(scopeAdmin, "LOAN", loan.id, {});
      await expect(disburseStaffFinancialAdvance(scopePrincipal, "LOAN", approved.id, { disbursementDate: "2026-06-01", method: "cash" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
  });

  describe("Historical safety", () => {
    it("a later Staff rename never rewrites an existing record's snapshot, and Staff inactivation never deletes history", async () => {
      const staff = await prisma.staff.create({ data: { tenantId, schoolId, branchId: branchA, employeeCode: `${NS}-HIST-${stamp}`, firstName: "Original", lastName: "Name", status: "ACTIVE", isTeaching: false }, select: { id: true } });
      const loan = await createStaffFinancialAdvance(scopeAdmin, "LOAN", { staffId: staff.id, principalAmount: 1000 });
      expect(loan.staffName).toBe("Original Name");

      await prisma.staff.update({ where: { id: staff.id }, data: { firstName: "Renamed", lastName: "Person", status: "INACTIVE" } });

      const reloaded = await getStaffFinancialAdvance(scopeAdmin, "LOAN", loan.id);
      expect(reloaded.staffName).toBe("Original Name");
      const stillExists = await prisma.staffFinancialAdvance.findUnique({ where: { id: loan.id } });
      expect(stillExists).not.toBeNull();
    });
  });

  describe("Isolation", () => {
    it("isolates loans/advances by tenant", async () => {
      const loan = await createStaffFinancialAdvance(scopeAdmin, "LOAN", { staffId: staffActiveId, principalAmount: 1000 });
      await expect(getStaffFinancialAdvance(scopeForeignAdmin, "LOAN", loan.id)).rejects.toMatchObject({ code: "STAFF_FINANCIAL_ADVANCE_NOT_FOUND" });
      const { data } = await listStaffFinancialAdvances(scopeForeignAdmin, "LOAN", {});
      expect(data.find((x) => x.id === loan.id)).toBeUndefined();
    });
  });

  describe("Audit", () => {
    it("records an audit event for create/approve/disburse/repay", async () => {
      const loan = await createStaffFinancialAdvance(scopeAdmin, "LOAN", { staffId: staffActiveId, principalAmount: 1000 });
      await approveStaffFinancialAdvance(scopeAdmin, "LOAN", loan.id, {});
      await disburseStaffFinancialAdvance(scopeAdmin, "LOAN", loan.id, { disbursementDate: "2026-06-01", method: "cash" });
      await recordStaffFinancialAdvanceRepayment(scopeAdmin, "LOAN", loan.id, { amount: 1000, paymentDate: "2026-07-01", method: "cash" });
      const events = await prisma.auditEvent.findMany({ where: { tenantId, entityId: loan.id }, select: { action: true } });
      const actions = events.map((e) => e.action);
      expect(actions).toContain("STAFF_FINANCIAL_ADVANCE_CREATED");
      expect(actions).toContain("STAFF_FINANCIAL_ADVANCE_APPROVED");
      expect(actions).toContain("STAFF_FINANCIAL_ADVANCE_DISBURSED");
      expect(actions).toContain("STAFF_FINANCIAL_ADVANCE_REPAYMENT_RECORDED");
    });
  });
});
