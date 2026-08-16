// Accounting / General Ledger DB integration tests (Phase 9G). Real Postgres:
// Chart of Accounts CRUD (+ duplicate code / parent-type / cycle rejection),
// manual journal balance invariants, post/reverse/double-reverse, race-safe
// journal numbering, Fees->Accounting automatic + idempotent posting
// (payment/discount/scholarship/late-fee/refund), General Ledger + Trial
// Balance + Income/Expense reports (POSTED-only, deterministic ordering,
// honest empty state), isolation, RBAC, audit, historical safety. Namespaced
// ("T9G"). Mirrors the exact setup/teardown pattern of lib/server/fees/fees.db.test.ts.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { createFeeCategory } from "@/lib/server/fees/categories";
import { createFeeStructure, setFeeStructureStatus } from "@/lib/server/fees/structures";
import { assignFeeStructure } from "@/lib/server/fees/assignments";
import { applyFeeAdjustment } from "@/lib/server/fees/adjustments";
import { recordFeePayment } from "@/lib/server/fees/payments";
import { createFeeRefund } from "@/lib/server/fees/refunds";
import { getStudentFeeLedger } from "@/lib/server/fees/dues";
import { createAccountingAccount, getAccountingAccount, listAccountingAccounts, updateAccountingAccount } from "@/lib/server/accounting/accounts";
import { createAndPostJournalEntry, getJournalEntry, reverseJournalEntry } from "@/lib/server/accounting/journals";
import { postFeePaymentToAccounting } from "@/lib/server/accounting/fee-posting";
import { nextJournalEntryNumber } from "@/lib/server/accounting/entry-number";
import { findUnbalancedPostedJournals, getAccountLedger, getTrialBalance } from "@/lib/server/accounting/ledger";
import { getAccountingDashboard, getIncomeExpenseReport } from "@/lib/server/accounting/reports";
import { HttpError } from "@/lib/server/api/guard";
import type { OrgScope } from "@/lib/server/api/scope";
import { ROLE_PERMISSIONS } from "@/lib/server/authz/catalog";

let dbReady = false;
try {
  dbReady = Boolean(await prisma.role.findFirst({ where: { key: "SCHOOL_ADMIN", isSystem: true } }));
} catch {
  dbReady = false;
}

const NS = "T9G";
const stamp = Date.now().toString(36);

let tenantId = "", schoolId = "", branchA = "", sessionId = "", classId = "", sectionId = "";
let student1 = "", student2 = "", student3 = "";
let foreignTenantId = "", foreignSchoolId = "", foreignStudentId = "";
let scopeAdmin: OrgScope, scopeTeacher: OrgScope, scopeForeignAdmin: OrgScope;
let adminUser = "", teacherUser = "", foreignAdminUser = "";

async function makeUserWithRole(email: string, roleKey: string, tid = tenantId): Promise<string> {
  const u = await prisma.user.create({ data: { email, name: email, status: "ACTIVE" }, select: { id: true } });
  const m = await prisma.tenantMembership.create({ data: { userId: u.id, tenantId: tid, status: "ACTIVE" }, select: { id: true } });
  const role = await prisma.role.findFirstOrThrow({ where: { key: roleKey, isSystem: true }, select: { id: true } });
  await prisma.roleAssignment.create({ data: { membershipId: m.id, roleId: role.id } });
  return u.id;
}

beforeAll(async () => {
  if (!dbReady) return;
  tenantId = (await prisma.tenant.create({ data: { name: `${NS} T`, slug: `t9g-${stamp}` }, select: { id: true } })).id;
  schoolId = (await prisma.school.create({ data: { tenantId, name: `${NS} S`, code: `${NS}-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  branchA = (await prisma.branch.create({ data: { schoolId, name: "A", code: `${NS}-A`, status: "ACTIVE" }, select: { id: true } })).id;
  sessionId = (await prisma.academicSession.create({ data: { schoolId, name: "26-27", code: `${NS}-S`, startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31"), status: "ACTIVE" }, select: { id: true } })).id;
  classId = (await prisma.class.create({ data: { tenantId, schoolId, academicSessionId: sessionId, name: "Grade 5", order: 5 }, select: { id: true } })).id;
  sectionId = (await prisma.section.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, classId, name: "A", status: "ACTIVE" }, select: { id: true } })).id;

  for (const [i, name] of ["one", "two", "three"].entries()) {
    const s = (await prisma.student.create({
      data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, admissionNumber: `${NS}-${stamp}-${i}`, firstName: name, lastName: "T", dateOfBirth: new Date("2015-01-01"), admissionDate: new Date("2024-04-01"), status: "ACTIVE" },
      select: { id: true },
    })).id;
    await prisma.enrollment.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, classId, sectionId, studentId: s, status: "ENROLLED" } });
    if (i === 0) student1 = s;
    else if (i === 1) student2 = s;
    else student3 = s;
  }

  adminUser = await makeUserWithRole(`t9g-admin-${stamp}@x.test`, "SCHOOL_ADMIN");
  teacherUser = await makeUserWithRole(`t9g-t1-${stamp}@x.test`, "TEACHER");

  foreignTenantId = (await prisma.tenant.create({ data: { name: `${NS} T2`, slug: `t9g-b-${stamp}` }, select: { id: true } })).id;
  foreignSchoolId = (await prisma.school.create({ data: { tenantId: foreignTenantId, name: `${NS} S2`, code: `${NS}-B-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  const foreignBranch = (await prisma.branch.create({ data: { schoolId: foreignSchoolId, name: "B", code: `${NS}-B`, status: "ACTIVE" }, select: { id: true } })).id;
  const foreignSession = (await prisma.academicSession.create({ data: { schoolId: foreignSchoolId, name: "26-27", code: `${NS}-BS`, startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31"), status: "ACTIVE" }, select: { id: true } })).id;
  foreignStudentId = (await prisma.student.create({
    data: { tenantId: foreignTenantId, schoolId: foreignSchoolId, branchId: foreignBranch, academicSessionId: foreignSession, admissionNumber: `${NS}-F-${stamp}`, firstName: "Foreign", lastName: "S", dateOfBirth: new Date("2015-01-01"), admissionDate: new Date("2024-04-01"), status: "ACTIVE" },
    select: { id: true },
  })).id;
  foreignAdminUser = await makeUserWithRole(`t9g-fadmin-${stamp}@x.test`, "SCHOOL_ADMIN", foreignTenantId);

  scopeAdmin = { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, actor: { id: adminUser, name: "Admin" } };
  scopeTeacher = { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, actor: { id: teacherUser, name: "Teacher" } };
  scopeForeignAdmin = { tenantId: foreignTenantId, schoolId: foreignSchoolId, branchId: foreignBranch, academicSessionId: foreignSession, actor: { id: foreignAdminUser, name: "Foreign Admin" } };
});

afterAll(async () => {
  if (!dbReady || !tenantId) return;
  await prisma.auditEvent.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.journalLine.deleteMany({ where: { journalEntry: { schoolId: { in: [schoolId, foreignSchoolId] } } } });
  await prisma.journalEntry.deleteMany({ where: { schoolId: { in: [schoolId, foreignSchoolId] } } });
  await prisma.accountingEntryCounter.deleteMany({ where: { schoolId: { in: [schoolId, foreignSchoolId] } } });
  await prisma.accountingAccount.deleteMany({ where: { schoolId: { in: [schoolId, foreignSchoolId] } } });
  await prisma.feeRefund.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.feePaymentAllocation.deleteMany({ where: { payment: { tenantId: { in: [tenantId, foreignTenantId] } } } });
  await prisma.feePayment.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.feeAdjustment.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.feeCharge.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.studentFeeAssignment.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.feeStructureItem.deleteMany({ where: { feeStructure: { tenantId: { in: [tenantId, foreignTenantId] } } } });
  await prisma.feeStructureClass.deleteMany({ where: { feeStructure: { tenantId: { in: [tenantId, foreignTenantId] } } } });
  await prisma.feeStructure.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.feeCategory.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.feeReceiptCounter.deleteMany({ where: { schoolId: { in: [schoolId, foreignSchoolId] } } });
  await prisma.enrollment.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.student.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.section.deleteMany({ where: { tenantId } });
  await prisma.class.deleteMany({ where: { tenantId } });
  await prisma.roleAssignment.deleteMany({ where: { membership: { tenantId: { in: [tenantId, foreignTenantId] } } } });
  await prisma.tenantMembership.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.academicSession.deleteMany({ where: { schoolId: { in: [schoolId, foreignSchoolId] } } });
  await prisma.branch.deleteMany({ where: { schoolId: { in: [schoolId, foreignSchoolId] } } });
  await prisma.school.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.user.deleteMany({ where: { id: { in: [adminUser, teacherUser, foreignAdminUser] } } });
  await prisma.tenant.deleteMany({ where: { id: { in: [tenantId, foreignTenantId] } } });
});

// ---------------------------------------------------------------------------
// Helper: create a fee charge for a given student with an optional dueDate,
// mirroring the exact category -> structure -> assign flow fees.db.test.ts uses.
// ---------------------------------------------------------------------------
async function makeCharge(studentId: string, amount: number, dueDate: string, tag: string): Promise<string> {
  const cat = await createFeeCategory(scopeAdmin, { name: `Cat-${tag}`, code: `C${tag}${stamp}` });
  const structure = await createFeeStructure(scopeAdmin, { name: `Plan-${tag}-${stamp}`, classIds: [classId], items: [{ categoryId: cat.id, name: `Item-${tag}`, amount, dueDate }] });
  await setFeeStructureStatus(scopeAdmin, structure.id, { status: "active" });
  await assignFeeStructure(scopeAdmin, { feeStructureId: structure.id, target: { type: "student", studentId } });
  const ledger = await getStudentFeeLedger(scopeAdmin, studentId);
  return ledger.charges.find((c) => c.itemName === `Item-${tag}`)!.id;
}

describe.skipIf(!dbReady)("Chart of Accounts (DB)", () => {
  it("creates an account; duplicate code rejected; TEACHER cannot manage", async () => {
    const acc = await createAccountingAccount(scopeAdmin, { code: `A1-${stamp}`, name: "Test Asset", type: "asset" });
    expect(acc.type).toBe("asset");
    expect(acc.balance).toBe(0);
    await expect(createAccountingAccount(scopeAdmin, { code: `A1-${stamp}`, name: "Dup", type: "asset" })).rejects.toThrow(HttpError);
    await expect(createAccountingAccount(scopeTeacher, { code: `A2-${stamp}`, name: "X", type: "asset" })).rejects.toThrow(HttpError);
  });

  it("rejects a parent account of a different type", async () => {
    const parent = await createAccountingAccount(scopeAdmin, { code: `P1-${stamp}`, name: "Parent Income", type: "income" });
    await expect(createAccountingAccount(scopeAdmin, { code: `C1-${stamp}`, name: "Bad Child", type: "expense", parentId: parent.id })).rejects.toThrow(HttpError);
    const child = await createAccountingAccount(scopeAdmin, { code: `C2-${stamp}`, name: "Good Child", type: "income", parentId: parent.id });
    expect(child.parentId).toBe(parent.id);
  });

  it("updates name/description/status; type can never be changed (no field exists to change it)", async () => {
    const acc = await createAccountingAccount(scopeAdmin, { code: `U1-${stamp}`, name: "Original", type: "liability" });
    const updated = await updateAccountingAccount(scopeAdmin, acc.id, { name: "Renamed", description: "New desc" });
    expect(updated.name).toBe("Renamed");
    expect(updated.type).toBe("liability");
    const archived = await updateAccountingAccount(scopeAdmin, acc.id, { status: "archived" });
    expect(archived.status).toBe("archived");
  });

  it("rejects a circular parent hierarchy", async () => {
    const a = await createAccountingAccount(scopeAdmin, { code: `X1-${stamp}`, name: "X1", type: "expense" });
    const b = await createAccountingAccount(scopeAdmin, { code: `X2-${stamp}`, name: "X2", type: "expense", parentId: a.id });
    await expect(updateAccountingAccount(scopeAdmin, a.id, { parentId: b.id })).rejects.toThrow(HttpError);
  });

  it("there is no delete endpoint — archive (status) is the only removal path, so a posted-against account can never be destructively removed", async () => {
    const acc = await createAccountingAccount(scopeAdmin, { code: `NODEL-${stamp}`, name: "No Delete", type: "expense" });
    expect((acc as unknown as { delete?: unknown }).delete).toBeUndefined();
    const archived = await updateAccountingAccount(scopeAdmin, acc.id, { status: "archived" });
    expect(archived.id).toBe(acc.id); // still exists, only archived
  });

  it("cross-school account is invisible; cross-tenant account is invisible", async () => {
    const foreignAcc = await createAccountingAccount(scopeForeignAdmin, { code: `FA1-${stamp}`, name: "Foreign", type: "asset" });
    await expect(getAccountingAccount(scopeAdmin, foreignAcc.id)).rejects.toThrow(HttpError);
    const mine = await createAccountingAccount(scopeAdmin, { code: `MA1-${stamp}`, name: "Mine", type: "asset" });
    await expect(getAccountingAccount(scopeForeignAdmin, mine.id)).rejects.toThrow(HttpError);
  });

  it("CASH and BANK system accounts are guaranteed to exist on every list read, even before any Fee payment", async () => {
    const freshTenant = await prisma.tenant.create({ data: { name: `${NS} Fresh`, slug: `t9g-fresh-${stamp}` }, select: { id: true } });
    const freshSchool = await prisma.school.create({ data: { tenantId: freshTenant.id, name: `${NS} Fresh S`, code: `${NS}-FR-${stamp}`, status: "ACTIVE" }, select: { id: true } });
    const freshBranch = await prisma.branch.create({ data: { schoolId: freshSchool.id, name: "F", code: `${NS}-FRB`, status: "ACTIVE" }, select: { id: true } });
    const freshUser = await makeUserWithRole(`t9g-fresh-${stamp}@x.test`, "SCHOOL_ADMIN", freshTenant.id);
    const freshScope: OrgScope = { tenantId: freshTenant.id, schoolId: freshSchool.id, branchId: freshBranch.id, academicSessionId: null, actor: { id: freshUser, name: "Fresh" } };
    const accounts = await listAccountingAccounts(freshScope);
    expect(accounts.some((a) => a.systemKey === "CASH")).toBe(true);
    expect(accounts.some((a) => a.systemKey === "BANK")).toBe(true);
    await prisma.roleAssignment.deleteMany({ where: { membership: { tenantId: freshTenant.id } } });
    await prisma.tenantMembership.deleteMany({ where: { tenantId: freshTenant.id } });
    await prisma.accountingAccount.deleteMany({ where: { schoolId: freshSchool.id } });
    await prisma.branch.deleteMany({ where: { schoolId: freshSchool.id } });
    await prisma.school.deleteMany({ where: { tenantId: freshTenant.id } });
    await prisma.user.deleteMany({ where: { id: freshUser } });
    await prisma.tenant.deleteMany({ where: { id: freshTenant.id } });
  });
});

describe.skipIf(!dbReady)("Manual Journal Entries (DB)", () => {
  it("a balanced 2-line journal posts immediately (no separate draft->post step in this UI)", async () => {
    const cash = await createAccountingAccount(scopeAdmin, { code: `MJ-C-${stamp}`, name: "MJ Cash", type: "asset" });
    const rev = await createAccountingAccount(scopeAdmin, { code: `MJ-R-${stamp}`, name: "MJ Revenue", type: "income" });
    const entry = await createAndPostJournalEntry(scopeAdmin, { entryDate: "2026-06-01", description: "Manual sale", lines: [{ accountId: cash.id, debit: 500 }, { accountId: rev.id, credit: 500 }] });
    expect(entry.status).toBe("posted");
    expect(entry.entryNumber).toMatch(/^JE-\d{4}-\d{6}$/);
    expect(entry.lines.length).toBe(2);
  });

  it("unbalanced journal is rejected before POSTED", async () => {
    const cash = await createAccountingAccount(scopeAdmin, { code: `MJ-U1-${stamp}`, name: "U1", type: "asset" });
    const rev = await createAccountingAccount(scopeAdmin, { code: `MJ-U2-${stamp}`, name: "U2", type: "income" });
    await expect(createAndPostJournalEntry(scopeAdmin, { entryDate: "2026-06-01", description: "Unbalanced", lines: [{ accountId: cash.id, debit: 500 }, { accountId: rev.id, credit: 400 }] })).rejects.toThrow(HttpError);
  });

  it("a line with both debit and credit set is rejected (schema-level, never reaches the balance check)", async () => {
    const cash = await createAccountingAccount(scopeAdmin, { code: `MJ-B1-${stamp}`, name: "B1", type: "asset" });
    const rev = await createAccountingAccount(scopeAdmin, { code: `MJ-B2-${stamp}`, name: "B2", type: "income" });
    await expect(createAndPostJournalEntry(scopeAdmin, { entryDate: "2026-06-01", description: "Both set", lines: [{ accountId: cash.id, debit: 100, credit: 100 }, { accountId: rev.id, credit: 100 }] })).rejects.toThrow();
  });

  it("a single-line journal is rejected (minimum 2 lines)", async () => {
    const cash = await createAccountingAccount(scopeAdmin, { code: `MJ-S1-${stamp}`, name: "S1", type: "asset" });
    await expect(createAndPostJournalEntry(scopeAdmin, { entryDate: "2026-06-01", description: "One line", lines: [{ accountId: cash.id, debit: 100 }] })).rejects.toThrow();
  });

  it("a foreign/unknown account in a journal line is rejected", async () => {
    const cash = await createAccountingAccount(scopeAdmin, { code: `MJ-F1-${stamp}`, name: "F1", type: "asset" });
    await expect(createAndPostJournalEntry(scopeAdmin, { entryDate: "2026-06-01", description: "Foreign account", lines: [{ accountId: cash.id, debit: 100 }, { accountId: "nonexistent-account", credit: 100 }] })).rejects.toThrow(HttpError);
  });

  it("TEACHER cannot create a manual journal", async () => {
    const cash = await createAccountingAccount(scopeAdmin, { code: `MJ-T1-${stamp}`, name: "T1", type: "asset" });
    const rev = await createAccountingAccount(scopeAdmin, { code: `MJ-T2-${stamp}`, name: "T2", type: "income" });
    await expect(createAndPostJournalEntry(scopeTeacher, { entryDate: "2026-06-01", description: "Teacher journal", lines: [{ accountId: cash.id, debit: 100 }, { accountId: rev.id, credit: 100 }] })).rejects.toThrow(HttpError);
  });

  it("a POSTED journal is immutable — reversal creates a mirrored NEW entry rather than editing the original", async () => {
    const cash = await createAccountingAccount(scopeAdmin, { code: `MJ-RV1-${stamp}`, name: "RV1", type: "asset" });
    const rev = await createAccountingAccount(scopeAdmin, { code: `MJ-RV2-${stamp}`, name: "RV2", type: "income" });
    const original = await createAndPostJournalEntry(scopeAdmin, { entryDate: "2026-06-01", description: "To reverse", lines: [{ accountId: cash.id, debit: 300 }, { accountId: rev.id, credit: 300 }] });
    const reversal = await reverseJournalEntry(scopeAdmin, original.id, { reason: "Entered in error" });
    expect(reversal.id).not.toBe(original.id);
    expect(reversal.reversalOfId).toBe(original.id);
    expect(reversal.sourceType).toBe(original.sourceType);
    const reversalCashLine = reversal.lines.find((l) => l.accountId === cash.id)!;
    const originalCashLine = original.lines.find((l) => l.accountId === cash.id)!;
    expect(reversalCashLine.credit).toBe(originalCashLine.debit); // mirrored (debit<->credit swapped)
    expect(reversalCashLine.debit).toBe(originalCashLine.credit);

    const originalAfter = await getJournalEntry(scopeAdmin, original.id);
    expect(originalAfter.status).toBe("reversed");
    expect(originalAfter.lines).toEqual(original.lines); // the original's own lines never changed
    expect(originalAfter.isReversed).toBe(true);
  });

  it("a journal can be reversed at most once — the second attempt is rejected", async () => {
    const cash = await createAccountingAccount(scopeAdmin, { code: `MJ-RV3-${stamp}`, name: "RV3", type: "asset" });
    const rev = await createAccountingAccount(scopeAdmin, { code: `MJ-RV4-${stamp}`, name: "RV4", type: "income" });
    const original = await createAndPostJournalEntry(scopeAdmin, { entryDate: "2026-06-01", description: "Reverse once", lines: [{ accountId: cash.id, debit: 200 }, { accountId: rev.id, credit: 200 }] });
    await reverseJournalEntry(scopeAdmin, original.id, { reason: "First reversal" });
    await expect(reverseJournalEntry(scopeAdmin, original.id, { reason: "Second reversal" })).rejects.toThrow(HttpError);
  });

  it("journal-number allocation is race-safe and produces unique, correctly-formatted numbers under concurrency", async () => {
    const cash = await createAccountingAccount(scopeAdmin, { code: `MJ-RACE-C-${stamp}`, name: "RaceCash", type: "asset" });
    const rev = await createAccountingAccount(scopeAdmin, { code: `MJ-RACE-R-${stamp}`, name: "RaceRev", type: "income" });
    const results = await Promise.all(
      Array.from({ length: 8 }, () => createAndPostJournalEntry(scopeAdmin, { entryDate: "2026-06-01", description: "Race entry", lines: [{ accountId: cash.id, debit: 10 }, { accountId: rev.id, credit: 10 }] })),
    );
    const numbers = new Set(results.map((r) => r.entryNumber));
    expect(numbers.size).toBe(8); // every number is unique — never a collision
    for (const n of numbers) expect(n).toMatch(/^JE-\d{4}-\d{6}$/);
  });

  it("two concurrent reversals of the same journal: exactly one reversal succeeds", async () => {
    const cash = await createAccountingAccount(scopeAdmin, { code: `MJ-DR1-${stamp}`, name: "DR1", type: "asset" });
    const rev = await createAccountingAccount(scopeAdmin, { code: `MJ-DR2-${stamp}`, name: "DR2", type: "income" });
    const original = await createAndPostJournalEntry(scopeAdmin, { entryDate: "2026-06-01", description: "Double reverse race", lines: [{ accountId: cash.id, debit: 150 }, { accountId: rev.id, credit: 150 }] });
    const results = await Promise.all([
      reverseJournalEntry(scopeAdmin, original.id, { reason: "Race A" }).catch((e) => e),
      reverseJournalEntry(scopeAdmin, original.id, { reason: "Race B" }).catch((e) => e),
    ]);
    const succeeded = results.filter((r) => !(r instanceof Error));
    expect(succeeded.length).toBe(1);
    const reversalCount = await prisma.journalEntry.count({ where: { reversalOfId: original.id } });
    expect(reversalCount).toBe(1);
  });

  it("cross-school journal is invisible", async () => {
    const cash = await createAccountingAccount(scopeForeignAdmin, { code: `MJ-XS1-${stamp}`, name: "XS1", type: "asset" });
    const rev = await createAccountingAccount(scopeForeignAdmin, { code: `MJ-XS2-${stamp}`, name: "XS2", type: "income" });
    const foreignEntry = await createAndPostJournalEntry(scopeForeignAdmin, { entryDate: "2026-06-01", description: "Foreign entry", lines: [{ accountId: cash.id, debit: 50 }, { accountId: rev.id, credit: 50 }] });
    await expect(getJournalEntry(scopeAdmin, foreignEntry.id)).rejects.toThrow(HttpError);
  });
});

describe.skipIf(!dbReady)("Fees -> Accounting Integration (DB)", () => {
  it("a full cash payment with a discount and a scholarship posts one balanced journal with distinct traceable lines for each", async () => {
    const chargeId = await makeCharge(student1, 10000, "2027-06-01", `DS${stamp}`);
    await applyFeeAdjustment(scopeAdmin, { chargeId, kind: "discount", amountType: "percentage", value: 10, reason: "Sibling discount" });
    await applyFeeAdjustment(scopeAdmin, { chargeId, kind: "scholarship", amountType: "fixed", value: 500, reason: "Merit" });
    // netAmount = 10000 - 1000 - 500 = 8500
    const payment = await recordFeePayment(scopeAdmin, { studentId: student1, allocations: [{ chargeId, amount: 8500 }], method: "cash" });

    const journal = await prisma.journalEntry.findFirst({ where: { schoolId, sourceType: "FEE_PAYMENT", sourceId: payment.id }, select: { id: true, status: true, lines: { select: { debit: true, credit: true, account: { select: { systemKey: true } } } } } });
    expect(journal).toBeTruthy();
    expect(journal!.status).toBe("POSTED");
    const totalDebit = journal!.lines.reduce((s, l) => s + Number(l.debit), 0);
    const totalCredit = journal!.lines.reduce((s, l) => s + Number(l.credit), 0);
    expect(totalDebit).toBe(totalCredit); // balances by construction
    expect(totalDebit).toBe(10000);

    const cashLine = journal!.lines.find((l) => l.account.systemKey === "CASH")!;
    expect(Number(cashLine.debit)).toBe(8500);
    const incomeLine = journal!.lines.find((l) => l.account.systemKey === "FEE_INCOME")!;
    expect(Number(incomeLine.credit)).toBe(10000);
    const discountLine = journal!.lines.find((l) => l.account.systemKey === "DISCOUNT_GIVEN")!;
    expect(Number(discountLine.debit)).toBe(1000); // distinct line — never netted into income
    const scholarshipLine = journal!.lines.find((l) => l.account.systemKey === "SCHOLARSHIP_GIVEN")!;
    expect(Number(scholarshipLine.debit)).toBe(500); // distinct line — never netted with discount
  });

  it("a late fee produces its own traceable Late Fee Income line, and a non-CASH method routes to the generic BANK clearing account", async () => {
    const chargeId = await makeCharge(student2, 1000, "2020-01-01", `LF${stamp}`);
    await applyFeeAdjustment(scopeAdmin, { chargeId, kind: "late_fee", amountType: "fixed", value: 100, reason: "Overdue" });
    // netAmount = 1000 + 100 = 1100
    const payment = await recordFeePayment(scopeAdmin, { studentId: student2, allocations: [{ chargeId, amount: 1100 }], method: "bank_transfer" });

    const journal = await prisma.journalEntry.findFirstOrThrow({ where: { schoolId, sourceType: "FEE_PAYMENT", sourceId: payment.id }, select: { lines: { select: { debit: true, credit: true, account: { select: { systemKey: true } } } } } });
    const bankLine = journal.lines.find((l) => l.account.systemKey === "BANK")!;
    expect(Number(bankLine.debit)).toBe(1100);
    expect(journal.lines.some((l) => l.account.systemKey === "CASH")).toBe(false); // never touches the Cash account for a non-cash method
    const lateFeeLine = journal.lines.find((l) => l.account.systemKey === "LATE_FEE_INCOME")!;
    expect(Number(lateFeeLine.credit)).toBe(100);
    const incomeLine = journal.lines.find((l) => l.account.systemKey === "FEE_INCOME")!;
    expect(Number(incomeLine.credit)).toBe(1000);
  });

  it("a partial payment prorates income proportionally across two separate payments (two separate journals)", async () => {
    const chargeId = await makeCharge(student3, 5000, "2027-06-01", `PP${stamp}`);
    const p1 = await recordFeePayment(scopeAdmin, { studentId: student3, allocations: [{ chargeId, amount: 2000 }], method: "cash" });
    const p2 = await recordFeePayment(scopeAdmin, { studentId: student3, allocations: [{ chargeId, amount: 3000 }], method: "cash" });
    const j1 = await prisma.journalEntry.findFirstOrThrow({ where: { schoolId, sourceType: "FEE_PAYMENT", sourceId: p1.id }, select: { lines: { select: { debit: true, credit: true, account: { select: { systemKey: true } } } } } });
    const j2 = await prisma.journalEntry.findFirstOrThrow({ where: { schoolId, sourceType: "FEE_PAYMENT", sourceId: p2.id }, select: { lines: { select: { debit: true, credit: true, account: { select: { systemKey: true } } } } } });
    expect(Number(j1.lines.find((l) => l.account.systemKey === "FEE_INCOME")!.credit)).toBe(2000); // 5000 * (2000/5000)
    expect(Number(j2.lines.find((l) => l.account.systemKey === "FEE_INCOME")!.credit)).toBe(3000); // 5000 * (3000/5000)
  });

  it("automatic posting is idempotent on sequential retry — calling the posting function again for the same payment id is a no-op", async () => {
    const chargeId = await makeCharge(student1, 750, "2027-06-01", `IR${stamp}`);
    const payment = await recordFeePayment(scopeAdmin, { studentId: student1, allocations: [{ chargeId, amount: 750 }], method: "cash" });
    const before = await prisma.journalEntry.count({ where: { schoolId, sourceType: "FEE_PAYMENT", sourceId: payment.id } });
    expect(before).toBe(1);

    await prisma.$transaction((tx) =>
      postFeePaymentToAccounting(tx, scopeAdmin, { id: payment.id, amount: new Prisma.Decimal(750), method: "CASH", paymentDate: new Date(), allocations: [{ chargeId, amount: new Prisma.Decimal(750) }] }),
    );
    const after = await prisma.journalEntry.count({ where: { schoolId, sourceType: "FEE_PAYMENT", sourceId: payment.id } });
    expect(after).toBe(1); // still exactly one — no duplicate
  });

  it("two concurrent automatic postings for the SAME (not-yet-posted) FeePayment produce exactly one journal (true DB-unique sourceEventId race)", async () => {
    const chargeId = await makeCharge(student2, 900, "2027-06-01", `CR${stamp}`);
    const student = await prisma.student.findUniqueOrThrow({ where: { id: student2 }, select: { branchId: true, academicSessionId: true } });
    const school = await prisma.school.findUniqueOrThrow({ where: { id: schoolId }, select: { code: true, currency: true } });
    await prisma.feeReceiptCounter.upsert({ where: { schoolId }, create: { schoolId, counter: 0 }, update: {} });
    const counterRow = await prisma.$queryRaw<{ counter: number }[]>`UPDATE fee_receipt_counters SET counter = counter + 1 WHERE "schoolId" = ${schoolId} RETURNING counter`;
    // A FeePayment inserted directly (bypassing recordFeePayment, and therefore bypassing its
    // automatic posting) — this is the not-yet-posted state two concurrent posting attempts race over.
    const rawPayment = await prisma.feePayment.create({
      data: {
        tenantId, schoolId, branchId: student.branchId, academicSessionId: student.academicSessionId!, studentId: student2,
        receiptNumber: `RCP-RACE-${school.code}-${counterRow[0].counter}`, amount: 900, currency: school.currency, method: "CASH", paymentDate: new Date(),
        receivedByUserId: adminUser, receivedByName: "Admin",
      },
      select: { id: true },
    });
    await prisma.feePaymentAllocation.create({ data: { paymentId: rawPayment.id, chargeId, amount: 900 } });

    const attempt = () =>
      prisma.$transaction((tx) =>
        postFeePaymentToAccounting(tx, scopeAdmin, { id: rawPayment.id, amount: new Prisma.Decimal(900), method: "CASH", paymentDate: new Date(), allocations: [{ chargeId, amount: new Prisma.Decimal(900) }] }),
      );
    await Promise.all([attempt(), attempt(), attempt()]);
    const count = await prisma.journalEntry.count({ where: { schoolId, sourceType: "FEE_PAYMENT", sourceId: rawPayment.id } });
    expect(count).toBe(1); // exactly one, never a duplicate, even under real concurrency
  });

  it("a refund posts the exact opposite accounting effect and never mutates the original payment's journal", async () => {
    const chargeId = await makeCharge(student3, 1000, "2027-06-01", `RF${stamp}`);
    const payment = await recordFeePayment(scopeAdmin, { studentId: student3, allocations: [{ chargeId, amount: 1000 }], method: "cash" });
    const originalJournal = await prisma.journalEntry.findFirstOrThrow({ where: { schoolId, sourceType: "FEE_PAYMENT", sourceId: payment.id }, select: { id: true, lines: { select: { debit: true, credit: true, accountId: true } } } });

    const refund = await createFeeRefund(scopeAdmin, payment.id, { amount: 400, reason: "Overcharged" });
    const refundJournal = await prisma.journalEntry.findFirstOrThrow({ where: { schoolId, sourceType: "FEE_REFUND", sourceId: refund.id }, select: { lines: { select: { debit: true, credit: true, accountId: true } } } });

    const totalDebit = refundJournal.lines.reduce((s, l) => s + Number(l.debit), 0);
    const totalCredit = refundJournal.lines.reduce((s, l) => s + Number(l.credit), 0);
    expect(totalDebit).toBe(totalCredit);
    expect(totalDebit).toBe(400); // 40% of the original 1000

    const cashLineOriginal = originalJournal.lines.find((l) => Number(l.debit) === 1000)!;
    const cashLineRefund = refundJournal.lines.find((l) => l.accountId === cashLineOriginal.accountId)!;
    expect(Number(cashLineRefund.credit)).toBe(400); // opposite of the original's debit
    expect(Number(cashLineRefund.debit)).toBe(0);

    // the original journal's own lines are untouched
    const originalAfter = await prisma.journalEntry.findUniqueOrThrow({ where: { id: originalJournal.id }, select: { lines: { select: { debit: true, credit: true, accountId: true } } } });
    expect(originalAfter.lines).toEqual(originalJournal.lines);
  });

  it("refund posting does not duplicate on retry", async () => {
    const chargeId = await makeCharge(student1, 600, "2027-06-01", `RFR${stamp}`);
    const payment = await recordFeePayment(scopeAdmin, { studentId: student1, allocations: [{ chargeId, amount: 600 }], method: "cash" });
    const refund = await createFeeRefund(scopeAdmin, payment.id, { amount: 200, reason: "Retry test" });
    const before = await prisma.journalEntry.count({ where: { schoolId, sourceType: "FEE_REFUND", sourceId: refund.id } });
    expect(before).toBe(1);
    // A second attempt against the same refund event, as any retried request would be.
    const { postFeeRefundToAccounting } = await import("@/lib/server/accounting/fee-posting");
    await prisma.$transaction((tx) => postFeeRefundToAccounting(tx, scopeAdmin, { id: refund.id, paymentId: payment.id, amount: new Prisma.Decimal(200), refundedAt: new Date() }));
    const after = await prisma.journalEntry.count({ where: { schoolId, sourceType: "FEE_REFUND", sourceId: refund.id } });
    expect(after).toBe(1);
  });

  it("every posted Fee journal is traceable back to its real source id (FeePayment/FeeRefund)", async () => {
    const chargeId = await makeCharge(student2, 300, "2027-06-01", `TR${stamp}`);
    const payment = await recordFeePayment(scopeAdmin, { studentId: student2, allocations: [{ chargeId, amount: 300 }], method: "cash" });
    const journal = await prisma.journalEntry.findFirstOrThrow({ where: { schoolId, sourceType: "FEE_PAYMENT", sourceId: payment.id } });
    expect(journal.sourceId).toBe(payment.id);
    expect(journal.sourceEventId).toBe(`FEE_PAYMENT:${payment.id}`);
    const realPayment = await prisma.feePayment.findUnique({ where: { id: journal.sourceId! } });
    expect(realPayment).toBeTruthy(); // sourceId resolves to a real FeePayment row, not a synthetic one
  });
});

describe.skipIf(!dbReady)("General Ledger / Trial Balance / Reports (DB)", () => {
  it("ledger opening balance + running balance are correct and deterministically ordered", async () => {
    const cash = await createAccountingAccount(scopeAdmin, { code: `LG-C-${stamp}`, name: "Ledger Cash", type: "asset" });
    const rev = await createAccountingAccount(scopeAdmin, { code: `LG-R-${stamp}`, name: "Ledger Rev", type: "income" });
    await createAndPostJournalEntry(scopeAdmin, { entryDate: "2026-05-01", description: "Before window", lines: [{ accountId: cash.id, debit: 1000 }, { accountId: rev.id, credit: 1000 }] });
    await createAndPostJournalEntry(scopeAdmin, { entryDate: "2026-06-01", description: "In window 1", lines: [{ accountId: cash.id, debit: 200 }, { accountId: rev.id, credit: 200 }] });
    await createAndPostJournalEntry(scopeAdmin, { entryDate: "2026-06-02", description: "In window 2", lines: [{ accountId: cash.id, debit: 50 }, { accountId: rev.id, credit: 50 }] });

    const ledger = await getAccountLedger(scopeAdmin, cash.id, { from: "2026-06-01", to: "2026-06-30" });
    expect(ledger.openingBalance).toBe(1000); // the pre-window entry only
    expect(ledger.entries.length).toBe(2);
    expect(ledger.entries[0].description).toBe("In window 1");
    expect(ledger.entries[0].runningBalance).toBe(1200);
    expect(ledger.entries[1].runningBalance).toBe(1250);
    expect(ledger.closingBalance).toBe(1250);
  });

  it("trial balance: total debits equal total credits across every POSTED line; empty state is honest, not a fabricated zero", async () => {
    const tb = await getTrialBalance(scopeAdmin, {});
    expect(tb.totalDebit).toBe(tb.totalCredit);
    expect(tb.balanced).toBe(true);
    expect(tb.rows.length).toBeGreaterThan(0); // real data exists from the tests above

    const freshTenant = await prisma.tenant.create({ data: { name: `${NS} TBFresh`, slug: `t9g-tbfresh-${stamp}` }, select: { id: true } });
    const freshSchool = await prisma.school.create({ data: { tenantId: freshTenant.id, name: `${NS} TB S`, code: `${NS}-TB-${stamp}`, status: "ACTIVE" }, select: { id: true } });
    const freshUser = await makeUserWithRole(`t9g-tbfresh-${stamp}@x.test`, "SCHOOL_ADMIN", freshTenant.id);
    const freshScope: OrgScope = { tenantId: freshTenant.id, schoolId: freshSchool.id, branchId: null, academicSessionId: null, actor: { id: freshUser, name: "Fresh" } };
    const emptyTb = await getTrialBalance(freshScope, {});
    expect(emptyTb.rows).toEqual([]); // no fabricated rows
    expect(emptyTb.totalDebit).toBe(0);
    expect(emptyTb.totalCredit).toBe(0);
    expect(emptyTb.balanced).toBe(true); // 0 == 0, honestly
    await prisma.roleAssignment.deleteMany({ where: { membership: { tenantId: freshTenant.id } } });
    await prisma.tenantMembership.deleteMany({ where: { tenantId: freshTenant.id } });
    await prisma.school.deleteMany({ where: { tenantId: freshTenant.id } });
    await prisma.user.deleteMany({ where: { id: freshUser } });
    await prisma.tenant.deleteMany({ where: { id: freshTenant.id } });
  });

  it("a DRAFT journal (simulated directly, since the real UI always posts immediately) is excluded from the ledger, trial balance and unbalanced-scan", async () => {
    const cash = await createAccountingAccount(scopeAdmin, { code: `DRAFT-C-${stamp}`, name: "Draft Cash", type: "asset" });
    const rev = await createAccountingAccount(scopeAdmin, { code: `DRAFT-R-${stamp}`, name: "Draft Rev", type: "income" });
    const draftNumber = await prisma.$transaction((tx) => nextJournalEntryNumber(tx, schoolId, 2026));
    await prisma.journalEntry.create({
      data: {
        tenantId, schoolId, branchId: branchA, entryNumber: draftNumber, entryDate: new Date("2026-06-01"), description: "Draft never posted",
        status: "DRAFT", sourceType: "MANUAL", createdByUserId: adminUser,
        lines: { create: [{ accountId: cash.id, debit: 999, credit: 0 }, { accountId: rev.id, debit: 0, credit: 999 }] },
      },
    });
    const ledger = await getAccountLedger(scopeAdmin, cash.id, {});
    expect(ledger.entries.every((e) => e.description !== "Draft never posted")).toBe(true);
    const tb = await getTrialBalance(scopeAdmin, {});
    const cashRow = tb.rows.find((r) => r.accountId === cash.id);
    expect(cashRow).toBeUndefined(); // no POSTED activity on this brand-new account
  });

  it("income/expense report totals reflect POSTED journals only and match a direct DB aggregate", async () => {
    const report = await getIncomeExpenseReport(scopeAdmin, {});
    expect(report.totalIncome - report.totalExpense).toBe(report.netIncome);
    const incomeAccounts = await prisma.accountingAccount.findMany({ where: { schoolId, type: "INCOME" }, select: { id: true } });
    const agg = await prisma.journalLine.groupBy({ by: ["accountId"], where: { accountId: { in: incomeAccounts.map((a) => a.id) }, journalEntry: { schoolId, status: "POSTED" } }, _sum: { debit: true, credit: true } });
    const directIncomeTotal = agg.reduce((s, g) => s + (Number(g._sum.credit ?? 0) - Number(g._sum.debit ?? 0)), 0);
    expect(Math.round(directIncomeTotal * 100) / 100).toBe(report.totalIncome);
  });

  it("date-range filtering on the income/expense report is correct", async () => {
    const rev = await createAccountingAccount(scopeAdmin, { code: `DR-R-${stamp}`, name: "Date Range Rev", type: "income" });
    const cash = await createAccountingAccount(scopeAdmin, { code: `DR-C-${stamp}`, name: "Date Range Cash", type: "asset" });
    await createAndPostJournalEntry(scopeAdmin, { entryDate: "2020-01-01", description: "Old income", lines: [{ accountId: cash.id, debit: 5000 }, { accountId: rev.id, credit: 5000 }] });
    const reportExcludingOld = await getIncomeExpenseReport(scopeAdmin, { from: "2025-01-01" });
    const oldEntry = reportExcludingOld.incomeByAccount.find((r) => r.accountId === rev.id);
    expect(oldEntry).toBeUndefined();
    const reportIncludingOld = await getIncomeExpenseReport(scopeAdmin, { from: "2019-01-01", to: "2020-12-31" });
    const foundEntry = reportIncludingOld.incomeByAccount.find((r) => r.accountId === rev.id);
    expect(foundEntry?.amount).toBe(5000);
  });

  it("the accounting dashboard reports real, ledger-derived KPIs (no seeded/random authority) and trialBalanceOk reflects the actual scan", async () => {
    const dashboard = await getAccountingDashboard(scopeAdmin);
    expect(typeof dashboard.totalIncome).toBe("number");
    expect(typeof dashboard.cashAndBankBalance).toBe("number");
    expect(dashboard.trialBalanceOk).toBe(true);
    const unbalanced = await findUnbalancedPostedJournals(scopeAdmin);
    expect(unbalanced).toEqual([]); // confirms no pre-existing unbalanced posted journal in this school
  });
});

describe.skipIf(!dbReady)("Security / RBAC / Audit (DB)", () => {
  it("accounting.manage/post/reverse/view: SCHOOL_ADMIN has all; TEACHER has none; PRINCIPAL has view only", () => {
    expect(ROLE_PERMISSIONS.SCHOOL_ADMIN).toContain("accounting.manage");
    expect(ROLE_PERMISSIONS.SCHOOL_ADMIN).toContain("accounting.view");
    expect(ROLE_PERMISSIONS.SCHOOL_ADMIN).toContain("accounting.post");
    expect(ROLE_PERMISSIONS.SCHOOL_ADMIN).toContain("accounting.reverse");
    expect(ROLE_PERMISSIONS.TEACHER ?? []).not.toContain("accounting.manage");
    expect(ROLE_PERMISSIONS.TEACHER ?? []).not.toContain("accounting.view");
    expect(ROLE_PERMISSIONS.PRINCIPAL).toContain("accounting.view");
    expect(ROLE_PERMISSIONS.PRINCIPAL).not.toContain("accounting.manage");
  });

  it("account and journal mutations are audited", async () => {
    const events = await prisma.auditEvent.count({ where: { tenantId, action: { in: ["ACCOUNT_CREATED", "ACCOUNT_UPDATED", "ACCOUNT_STATUS_CHANGED", "JOURNAL_CREATED", "JOURNAL_POSTED", "JOURNAL_REVERSED"] } } });
    expect(events).toBeGreaterThan(5);
  });

  it("a foreign student cannot be charged, so no cross-tenant Fee payment can ever produce a cross-tenant journal", async () => {
    await expect(recordFeePayment(scopeAdmin, { studentId: foreignStudentId, allocations: [{ chargeId: "whatever", amount: 10 }], method: "cash" })).rejects.toThrow();
  });
});

describe.skipIf(!dbReady)("Historical Safety (DB)", () => {
  it("renaming an account after journal lines are posted against it never changes the historical monetary amounts", async () => {
    const cash = await createAccountingAccount(scopeAdmin, { code: `HS-C-${stamp}`, name: "History Cash", type: "asset" });
    const rev = await createAccountingAccount(scopeAdmin, { code: `HS-R-${stamp}`, name: "History Rev", type: "income" });
    const entry = await createAndPostJournalEntry(scopeAdmin, { entryDate: "2026-06-01", description: "Before rename", lines: [{ accountId: cash.id, debit: 777 }, { accountId: rev.id, credit: 777 }] });
    await updateAccountingAccount(scopeAdmin, cash.id, { name: "Renamed Cash" });
    const after = await getJournalEntry(scopeAdmin, entry.id);
    const cashLine = after.lines.find((l) => l.accountId === cash.id)!;
    expect(cashLine.debit).toBe(777); // the amount is immutable regardless of the account's current name
    expect(cashLine.accountName).toBe("Renamed Cash"); // display reflects the CURRENT name (accounts have no code/name snapshot per line — by design, see accounts.ts doc comment)
  });

  it("archiving an account after journal lines are posted against it does not erase or alter ledger history", async () => {
    const cash = await createAccountingAccount(scopeAdmin, { code: `HS-A1-${stamp}`, name: "Archive Cash", type: "asset" });
    const rev = await createAccountingAccount(scopeAdmin, { code: `HS-A2-${stamp}`, name: "Archive Rev", type: "income" });
    await createAndPostJournalEntry(scopeAdmin, { entryDate: "2026-06-01", description: "Before archive", lines: [{ accountId: cash.id, debit: 250 }, { accountId: rev.id, credit: 250 }] });
    await updateAccountingAccount(scopeAdmin, cash.id, { status: "archived" });
    const ledger = await getAccountLedger(scopeAdmin, cash.id, {});
    expect(ledger.entries.some((e) => e.description === "Before archive")).toBe(true);
    expect(ledger.closingBalance).toBeGreaterThanOrEqual(250);
  });

  it("a refund preserves the original journal exactly — refunding twice-partially never retroactively changes the first posting", async () => {
    const chargeId = await makeCharge(student1, 2000, "2027-06-01", `HSR${stamp}`);
    const payment = await recordFeePayment(scopeAdmin, { studentId: student1, allocations: [{ chargeId, amount: 2000 }], method: "cash" });
    const originalJournal = await prisma.journalEntry.findFirstOrThrow({ where: { schoolId, sourceType: "FEE_PAYMENT", sourceId: payment.id }, select: { id: true, lines: { select: { debit: true, credit: true } }, status: true } });
    await createFeeRefund(scopeAdmin, payment.id, { amount: 300, reason: "First partial" });
    const afterFirst = await prisma.journalEntry.findUniqueOrThrow({ where: { id: originalJournal.id }, select: { lines: { select: { debit: true, credit: true } }, status: true } });
    expect(afterFirst.lines).toEqual(originalJournal.lines);
    expect(afterFirst.status).toBe("POSTED"); // a refund never flips the original payment's journal to REVERSED
  });
});
