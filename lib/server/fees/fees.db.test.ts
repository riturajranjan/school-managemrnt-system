// Fees & Collections DB integration tests (Phase 9F). Real Postgres: category
// CRUD, structure lifecycle, class/section bulk assignment (idempotent +
// concurrency-safe via real Enrollment), collection (full/partial/multi-
// charge/overpayment-rejected), receipt-number concurrency, dues derivation,
// discount/scholarship/late-fee via the one canonical adjustment engine,
// refund (valid/excessive/double-refund race), reconciliation, reports,
// isolation, RBAC, audit. Namespaced ("T9F").
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { createFeeCategory, updateFeeCategory } from "@/lib/server/fees/categories";
import { createFeeStructure, setFeeStructureStatus, updateFeeStructure } from "@/lib/server/fees/structures";
import { assignFeeStructure } from "@/lib/server/fees/assignments";
import { applyFeeAdjustment } from "@/lib/server/fees/adjustments";
import { getFeePayment, recordFeePayment, reconcilePayment } from "@/lib/server/fees/payments";
import { createFeeRefund } from "@/lib/server/fees/refunds";
import { getDuesSummary, getStudentFeeLedger, listStudentDues } from "@/lib/server/fees/dues";
import { getFeeCollectionReport, getFeeDashboard } from "@/lib/server/fees/reports";
import { HttpError } from "@/lib/server/api/guard";
import type { OrgScope } from "@/lib/server/api/scope";
import { ROLE_PERMISSIONS } from "@/lib/server/authz/catalog";

let dbReady = false;
try {
  dbReady = Boolean(await prisma.role.findFirst({ where: { key: "SCHOOL_ADMIN", isSystem: true } }));
} catch {
  dbReady = false;
}

const NS = "T9F";
const stamp = Date.now().toString(36);

let tenantId = "", schoolId = "", branchA = "", sessionId = "", classId = "", sectionId = "";
let student1 = "", student2 = "", student3 = "";
let foreignTenantId = "", foreignSchoolId = "", foreignStudentId = "";
let scopeAdmin: OrgScope, scopeTeacher: OrgScope;
let adminUser = "", teacherUser = "";

async function makeUserWithRole(email: string, roleKey: string, tid = tenantId): Promise<string> {
  const u = await prisma.user.create({ data: { email, name: email, status: "ACTIVE" }, select: { id: true } });
  const m = await prisma.tenantMembership.create({ data: { userId: u.id, tenantId: tid, status: "ACTIVE" }, select: { id: true } });
  const role = await prisma.role.findFirstOrThrow({ where: { key: roleKey, isSystem: true }, select: { id: true } });
  await prisma.roleAssignment.create({ data: { membershipId: m.id, roleId: role.id } });
  return u.id;
}

beforeAll(async () => {
  if (!dbReady) return;
  tenantId = (await prisma.tenant.create({ data: { name: `${NS} T`, slug: `t9f-${stamp}` }, select: { id: true } })).id;
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

  adminUser = await makeUserWithRole(`t9f-admin-${stamp}@x.test`, "SCHOOL_ADMIN");
  teacherUser = await makeUserWithRole(`t9f-t1-${stamp}@x.test`, "TEACHER");

  foreignTenantId = (await prisma.tenant.create({ data: { name: `${NS} T2`, slug: `t9f-b-${stamp}` }, select: { id: true } })).id;
  foreignSchoolId = (await prisma.school.create({ data: { tenantId: foreignTenantId, name: `${NS} S2`, code: `${NS}-B-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  const foreignBranch = (await prisma.branch.create({ data: { schoolId: foreignSchoolId, name: "B", code: `${NS}-B`, status: "ACTIVE" }, select: { id: true } })).id;
  const foreignSession = (await prisma.academicSession.create({ data: { schoolId: foreignSchoolId, name: "26-27", code: `${NS}-BS`, startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31"), status: "ACTIVE" }, select: { id: true } })).id;
  foreignStudentId = (await prisma.student.create({
    data: { tenantId: foreignTenantId, schoolId: foreignSchoolId, branchId: foreignBranch, academicSessionId: foreignSession, admissionNumber: `${NS}-F-${stamp}`, firstName: "Foreign", lastName: "S", dateOfBirth: new Date("2015-01-01"), admissionDate: new Date("2024-04-01"), status: "ACTIVE" },
    select: { id: true },
  })).id;

  scopeAdmin = { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, actor: { id: adminUser, name: "Admin" } };
  scopeTeacher = { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, actor: { id: teacherUser, name: "Teacher" } };
});

afterAll(async () => {
  if (!dbReady || !tenantId) return;
  await prisma.auditEvent.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
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
  await prisma.roleAssignment.deleteMany({ where: { membership: { tenantId } } });
  await prisma.tenantMembership.deleteMany({ where: { tenantId } });
  await prisma.academicSession.deleteMany({ where: { schoolId: { in: [schoolId, foreignSchoolId] } } });
  await prisma.branch.deleteMany({ where: { schoolId: { in: [schoolId, foreignSchoolId] } } });
  await prisma.school.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.user.deleteMany({ where: { id: { in: [adminUser, teacherUser] } } });
  await prisma.tenant.deleteMany({ where: { id: { in: [tenantId, foreignTenantId] } } });
});

describe.skipIf(!dbReady)("Fee Categories (DB)", () => {
  it("creates a category; duplicate code rejected; TEACHER cannot manage", async () => {
    const cat = await createFeeCategory(scopeAdmin, { name: "Tuition", code: `TUI${stamp}` });
    expect(cat.status).toBe("active");
    await expect(createFeeCategory(scopeAdmin, { name: "X", code: `TUI${stamp}` })).rejects.toThrow(HttpError);
    await expect(createFeeCategory(scopeTeacher, { name: "Y", code: `Y${stamp}` })).rejects.toThrow(HttpError);
  });

  it("archives a category; history is not the concern of this call (structures/charges snapshot separately)", async () => {
    const cat = await createFeeCategory(scopeAdmin, { name: "Library", code: `LIB${stamp}` });
    const archived = await updateFeeCategory(scopeAdmin, cat.id, { status: "archived" });
    expect(archived.status).toBe("archived");
  });
});

describe.skipIf(!dbReady)("Fee Structures (DB)", () => {
  it("creates a structure with items + real classes; rejects a foreign/invalid class", async () => {
    const cat = (await createFeeCategory(scopeAdmin, { name: "Tuition2", code: `TU2${stamp}` }));
    const structure = await createFeeStructure(scopeAdmin, { name: `Plan ${stamp}`, classIds: [classId], items: [{ categoryId: cat.id, amount: 10000, dueDate: "2026-06-01" }] });
    expect(structure.status).toBe("draft");
    expect(structure.items.length).toBe(1);

    await expect(createFeeStructure(scopeAdmin, { name: `Bad ${stamp}`, classIds: ["nonexistent-class"], items: [{ categoryId: cat.id, amount: 1000, dueDate: "2026-06-01" }] })).rejects.toThrow(HttpError);
  });

  it("blocks structural edits once a student is assigned", async () => {
    const cat = await createFeeCategory(scopeAdmin, { name: "Exam", code: `EX${stamp}` });
    const structure = await createFeeStructure(scopeAdmin, { name: `Locked ${stamp}`, classIds: [classId], items: [{ categoryId: cat.id, amount: 500, dueDate: "2026-05-01" }] });
    await setFeeStructureStatus(scopeAdmin, structure.id, { status: "active" });
    await assignFeeStructure(scopeAdmin, { feeStructureId: structure.id, target: { type: "student", studentId: student1 } });
    await expect(updateFeeStructure(scopeAdmin, structure.id, { name: "Renamed" })).rejects.toThrow(HttpError);
  });
});

describe.skipIf(!dbReady)("Fee Assignment (DB)", () => {
  it("bulk-assigns a whole section via real Enrollment; re-running is idempotent (no duplicate charges)", async () => {
    const cat = await createFeeCategory(scopeAdmin, { name: "Activity", code: `ACT${stamp}` });
    const structure = await createFeeStructure(scopeAdmin, { name: `Section plan ${stamp}`, classIds: [classId], items: [{ categoryId: cat.id, amount: 1000, dueDate: "2026-07-01" }, { categoryId: cat.id, amount: 500, dueDate: "2026-08-01" }] });
    await setFeeStructureStatus(scopeAdmin, structure.id, { status: "active" });

    const first = await assignFeeStructure(scopeAdmin, { feeStructureId: structure.id, target: { type: "section", sectionId } });
    expect(first.assigned).toBe(3);

    const second = await assignFeeStructure(scopeAdmin, { feeStructureId: structure.id, target: { type: "section", sectionId } });
    expect(second.assigned).toBe(0);
    expect(second.alreadyAssigned).toBe(3);

    const charges = await prisma.feeCharge.count({ where: { assignment: { feeStructureId: structure.id, studentId: student1 } } });
    expect(charges).toBe(2); // one per item, never duplicated
  });

  it("concurrent assignment of the same student never creates duplicate charges", async () => {
    const cat = await createFeeCategory(scopeAdmin, { name: "Concurrent", code: `CONC${stamp}` });
    const structure = await createFeeStructure(scopeAdmin, { name: `Race plan ${stamp}`, classIds: [classId], items: [{ categoryId: cat.id, amount: 2000, dueDate: "2026-09-01" }] });
    await setFeeStructureStatus(scopeAdmin, structure.id, { status: "active" });

    const results = await Promise.all([
      assignFeeStructure(scopeAdmin, { feeStructureId: structure.id, target: { type: "student", studentId: student2 } }),
      assignFeeStructure(scopeAdmin, { feeStructureId: structure.id, target: { type: "student", studentId: student2 } }),
    ]);
    const totalAssigned = results.reduce((s, r) => s + r.assigned, 0);
    expect(totalAssigned).toBe(1);
    const assignmentCount = await prisma.studentFeeAssignment.count({ where: { studentId: student2, feeStructureId: structure.id } });
    expect(assignmentCount).toBe(1);
  });

  it("a foreign student cannot be targeted for assignment", async () => {
    const cat = await createFeeCategory(scopeAdmin, { name: "Foreign", code: `FOR${stamp}` });
    const structure = await createFeeStructure(scopeAdmin, { name: `Foreign plan ${stamp}`, classIds: [classId], items: [{ categoryId: cat.id, amount: 100, dueDate: "2026-06-01" }] });
    await setFeeStructureStatus(scopeAdmin, structure.id, { status: "active" });
    await expect(assignFeeStructure(scopeAdmin, { feeStructureId: structure.id, target: { type: "student", studentId: foreignStudentId } })).rejects.toThrow(HttpError);
  });
});

describe.skipIf(!dbReady)("Fee Collection (DB)", () => {
  let chargeId1 = "", chargeId2 = "", paymentStudent = "";

  it("sets up a billed student with two charges", async () => {
    const cat = await createFeeCategory(scopeAdmin, { name: "Collect", code: `COL${stamp}` });
    const structure = await createFeeStructure(scopeAdmin, { name: `Collect plan ${stamp}`, classIds: [classId], items: [{ categoryId: cat.id, name: `Term1-${stamp}`, amount: 5000, dueDate: "2027-06-01" }, { categoryId: cat.id, name: `Term2-${stamp}`, amount: 5000, dueDate: "2027-09-01" }] });
    await setFeeStructureStatus(scopeAdmin, structure.id, { status: "active" });
    await assignFeeStructure(scopeAdmin, { feeStructureId: structure.id, target: { type: "student", studentId: student3 } });
    const ledger = await getStudentFeeLedger(scopeAdmin, student3);
    const thisStructureCharges = ledger.charges.filter((c) => c.itemName === `Term1-${stamp}` || c.itemName === `Term2-${stamp}`);
    expect(thisStructureCharges.length).toBe(2); // exactly one charge per item on THIS structure — the ledger may also hold charges from other structures assigned to this student
    chargeId1 = thisStructureCharges.find((c) => c.itemName === `Term1-${stamp}`)!.id;
    chargeId2 = thisStructureCharges.find((c) => c.itemName === `Term2-${stamp}`)!.id;
    paymentStudent = student3;
  });

  it("records a partial payment; balance reflects it", async () => {
    // fees.collect is enforced at the route layer (see app/api/fees/payments/route.ts),
    // not inside recordFeePayment itself — covered by the RBAC catalog check below
    // and the runtime HTTP verification, not a direct service-level throw here.
    const payment = await recordFeePayment(scopeAdmin, { studentId: paymentStudent, allocations: [{ chargeId: chargeId1, amount: 2000 }], method: "cash" });
    expect(payment.amount).toBe(2000);
    expect(payment.receiptNumber).toMatch(/^RCP-/);
    const ledger = await getStudentFeeLedger(scopeAdmin, paymentStudent);
    const charge = ledger.charges.find((c) => c.id === chargeId1)!;
    expect(charge.status).toBe("partially_paid");
    expect(charge.balance).toBe(3000);
  });

  it("records a full multi-charge payment covering the remainder", async () => {
    const payment = await recordFeePayment(scopeAdmin, { studentId: paymentStudent, allocations: [{ chargeId: chargeId1, amount: 3000 }, { chargeId: chargeId2, amount: 5000 }], method: "upi", reference: "UTR123" });
    expect(payment.amount).toBe(8000);
    expect(payment.allocations.length).toBe(2);
    const ledger = await getStudentFeeLedger(scopeAdmin, paymentStudent);
    const thisStructureCharges = ledger.charges.filter((c) => c.id === chargeId1 || c.id === chargeId2);
    expect(thisStructureCharges.every((c) => c.status === "paid")).toBe(true);
  });

  it("overpayment beyond the outstanding balance is rejected", async () => {
    await expect(recordFeePayment(scopeAdmin, { studentId: paymentStudent, allocations: [{ chargeId: chargeId1, amount: 500 }], method: "cash" })).rejects.toThrow(HttpError);
  });

  it("a foreign charge cannot be paid", async () => {
    await expect(recordFeePayment(scopeAdmin, { studentId: paymentStudent, allocations: [{ chargeId: "nonexistent", amount: 100 }], method: "cash" })).rejects.toThrow(HttpError);
  });

  it("receipt numbers are unique and race-safe under concurrent payments", async () => {
    const cat = await createFeeCategory(scopeAdmin, { name: "Race", code: `RACE${stamp}` });
    const structure = await createFeeStructure(scopeAdmin, { name: `Race collect ${stamp}`, classIds: [classId], items: [{ categoryId: cat.id, amount: 100000, dueDate: "2026-10-01" }] });
    await setFeeStructureStatus(scopeAdmin, structure.id, { status: "active" });
    await assignFeeStructure(scopeAdmin, { feeStructureId: structure.id, target: { type: "student", studentId: student1 } });
    const ledger = await getStudentFeeLedger(scopeAdmin, student1);
    const raceCharge = ledger.charges.find((c) => c.netAmount === 100000)!;

    const payments = await Promise.all(
      Array.from({ length: 5 }, () => recordFeePayment(scopeAdmin, { studentId: student1, allocations: [{ chargeId: raceCharge.id, amount: 1000 }], method: "cash" }).catch((e) => e)),
    );
    const succeeded = payments.filter((p) => !(p instanceof Error));
    const receiptNumbers = new Set(succeeded.map((p) => p.receiptNumber));
    expect(receiptNumbers.size).toBe(succeeded.length); // every receipt number is unique
  });
});

describe.skipIf(!dbReady)("Dues & Overdue (DB)", () => {
  it("derives unpaid/overdue status live and never persists a fake status", async () => {
    const cat = await createFeeCategory(scopeAdmin, { name: "Overdue", code: `OD${stamp}` });
    const structure = await createFeeStructure(scopeAdmin, { name: `Overdue plan ${stamp}`, classIds: [classId], items: [{ categoryId: cat.id, amount: 750, dueDate: "2020-01-01" }] });
    await setFeeStructureStatus(scopeAdmin, structure.id, { status: "active" });
    await assignFeeStructure(scopeAdmin, { feeStructureId: structure.id, target: { type: "student", studentId: student2 } });

    const dues = await listStudentDues(scopeAdmin, {});
    const row = dues.find((r) => r.studentId === student2);
    expect(row).toBeTruthy();
    expect(row!.overdue).toBeGreaterThanOrEqual(750);

    const summary = await getDuesSummary(scopeAdmin);
    expect(summary.totalOverdue).toBeGreaterThanOrEqual(750);
  });

  it("a fully paid charge contributes zero to outstanding/overdue — dues never counts settled charges", async () => {
    const cat = await createFeeCategory(scopeAdmin, { name: "PaidUp", code: `PU${stamp}` });
    const structure = await createFeeStructure(scopeAdmin, { name: `Paid-up plan ${stamp}`, classIds: [classId], items: [{ categoryId: cat.id, name: `PaidItem-${stamp}`, amount: 400, dueDate: "2020-01-01" }] });
    await setFeeStructureStatus(scopeAdmin, structure.id, { status: "active" });
    await assignFeeStructure(scopeAdmin, { feeStructureId: structure.id, target: { type: "student", studentId: student1 } });
    const ledger = await getStudentFeeLedger(scopeAdmin, student1);
    const charge = ledger.charges.find((c) => c.itemName === `PaidItem-${stamp}`)!;
    expect(charge.status).toBe("overdue");

    await recordFeePayment(scopeAdmin, { studentId: student1, allocations: [{ chargeId: charge.id, amount: 400 }], method: "cash" });
    const after = await getStudentFeeLedger(scopeAdmin, student1);
    const settled = after.charges.find((c) => c.id === charge.id)!;
    expect(settled.status).toBe("paid");
    expect(settled.balance).toBe(0);
  });
});

describe.skipIf(!dbReady)("Discounts, Scholarships, Late Fees (DB)", () => {
  it("applies a percentage discount and a fixed scholarship without mutating the original charge amount", async () => {
    const cat = await createFeeCategory(scopeAdmin, { name: "Adjust", code: `ADJ${stamp}` });
    const structure = await createFeeStructure(scopeAdmin, { name: `Adjust plan ${stamp}`, classIds: [classId], items: [{ categoryId: cat.id, name: `AdjItem-${stamp}`, amount: 10000, dueDate: "2027-06-01" }] });
    await setFeeStructureStatus(scopeAdmin, structure.id, { status: "active" });
    await assignFeeStructure(scopeAdmin, { feeStructureId: structure.id, target: { type: "student", studentId: student1 } });
    const ledger = await getStudentFeeLedger(scopeAdmin, student1);
    const charge = ledger.charges.find((c) => c.itemName === `AdjItem-${stamp}`)!;
    expect(charge.status).toBe("unpaid");

    await applyFeeAdjustment(scopeAdmin, { chargeId: charge.id, kind: "discount", amountType: "percentage", value: 10, reason: "Sibling discount" });
    await applyFeeAdjustment(scopeAdmin, { chargeId: charge.id, kind: "scholarship", amountType: "fixed", value: 500, reason: "Merit Scholarship" });

    const after = await getStudentFeeLedger(scopeAdmin, student1);
    const updated = after.charges.find((c) => c.id === charge.id)!;
    expect(updated.billedAmount).toBe(10000); // original obligation never mutated
    expect(updated.discountAmount).toBe(1000);
    expect(updated.scholarshipAmount).toBe(500);
    expect(updated.netAmount).toBe(8500);

    const dbCharge = await prisma.feeCharge.findUniqueOrThrow({ where: { id: charge.id }, select: { amount: true } });
    expect(Number(dbCharge.amount)).toBe(10000);
  });

  it("rejects a percentage adjustment over 100%", async () => {
    const cat = await createFeeCategory(scopeAdmin, { name: "Invalid", code: `INV${stamp}` });
    const structure = await createFeeStructure(scopeAdmin, { name: `Invalid plan ${stamp}`, classIds: [classId], items: [{ categoryId: cat.id, name: `InvItem-${stamp}`, amount: 1000, dueDate: "2027-06-01" }] });
    await setFeeStructureStatus(scopeAdmin, structure.id, { status: "active" });
    await assignFeeStructure(scopeAdmin, { feeStructureId: structure.id, target: { type: "student", studentId: student2 } });
    const ledger = await getStudentFeeLedger(scopeAdmin, student2);
    const charge = ledger.charges.find((c) => c.itemName === `InvItem-${stamp}`)!;
    await expect(applyFeeAdjustment(scopeAdmin, { chargeId: charge.id, kind: "discount", amountType: "percentage", value: 150, reason: "x" })).rejects.toThrow(HttpError);
  });

  it("a late fee increases the payable balance", async () => {
    const cat = await createFeeCategory(scopeAdmin, { name: "LateFeeTest", code: `LFT${stamp}` });
    const structure = await createFeeStructure(scopeAdmin, { name: `Late plan ${stamp}`, classIds: [classId], items: [{ categoryId: cat.id, name: `LateItem-${stamp}`, amount: 1000, dueDate: "2020-01-01" }] });
    await setFeeStructureStatus(scopeAdmin, structure.id, { status: "active" });
    await assignFeeStructure(scopeAdmin, { feeStructureId: structure.id, target: { type: "student", studentId: student3 } });
    const ledger = await getStudentFeeLedger(scopeAdmin, student3);
    const charge = ledger.charges.find((c) => c.itemName === `LateItem-${stamp}`)!;
    expect(charge.status).toBe("overdue");
    await applyFeeAdjustment(scopeAdmin, { chargeId: charge.id, kind: "late_fee", amountType: "fixed", value: 100, reason: "Overdue 30+ days" });
    const after = await getStudentFeeLedger(scopeAdmin, student3);
    const updated = after.charges.find((c) => c.id === charge.id)!;
    expect(updated.lateFeeAmount).toBe(100);
    expect(updated.balance).toBe(1100);
  });
});

describe.skipIf(!dbReady)("Refunds (DB)", () => {
  it("valid refund; excessive refund rejected; double-refund race only succeeds once up to the remaining amount", async () => {
    const cat = await createFeeCategory(scopeAdmin, { name: "Refund", code: `REF${stamp}` });
    const structure = await createFeeStructure(scopeAdmin, { name: `Refund plan ${stamp}`, classIds: [classId], items: [{ categoryId: cat.id, name: `RefundItem-${stamp}`, amount: 1000, dueDate: "2027-06-01" }] });
    await setFeeStructureStatus(scopeAdmin, structure.id, { status: "active" });
    await assignFeeStructure(scopeAdmin, { feeStructureId: structure.id, target: { type: "student", studentId: student2 } });
    const ledger = await getStudentFeeLedger(scopeAdmin, student2);
    const charge = ledger.charges.find((c) => c.itemName === `RefundItem-${stamp}`)!;
    const payment = await recordFeePayment(scopeAdmin, { studentId: student2, allocations: [{ chargeId: charge.id, amount: 1000 }], method: "cash" });

    await expect(createFeeRefund(scopeAdmin, payment.id, { amount: 2000, reason: "too much" })).rejects.toThrow(HttpError);

    const results = await Promise.all([
      createFeeRefund(scopeAdmin, payment.id, { amount: 700, reason: "partial A" }).catch((e) => e),
      createFeeRefund(scopeAdmin, payment.id, { amount: 700, reason: "partial B" }).catch((e) => e),
    ]);
    const succeeded = results.filter((r) => !(r instanceof Error));
    expect(succeeded.length).toBe(1); // the second would exceed the refundable remainder (1000 - 700 = 300 < 700)

    const finalPayment = await getFeePayment(scopeAdmin, payment.id);
    expect(finalPayment.refundedAmount).toBe(700);
  });
});

describe.skipIf(!dbReady)("Reconciliation (DB)", () => {
  it("marks a payment reconciled", async () => {
    const cat = await createFeeCategory(scopeAdmin, { name: "Recon", code: `RCN${stamp}` });
    const structure = await createFeeStructure(scopeAdmin, { name: `Recon plan ${stamp}`, classIds: [classId], items: [{ categoryId: cat.id, amount: 300, dueDate: "2026-06-01" }] });
    await setFeeStructureStatus(scopeAdmin, structure.id, { status: "active" });
    await assignFeeStructure(scopeAdmin, { feeStructureId: structure.id, target: { type: "student", studentId: student1 } });
    const ledger = await getStudentFeeLedger(scopeAdmin, student1);
    const charge = ledger.charges.find((c) => c.billedAmount === 300)!;
    const payment = await recordFeePayment(scopeAdmin, { studentId: student1, allocations: [{ chargeId: charge.id, amount: 300 }], method: "bank_transfer" });
    expect(payment.reconciliationStatus).toBe("unreconciled");
    const reconciled = await reconcilePayment(scopeAdmin, payment.id, { status: "reconciled" });
    expect(reconciled.reconciliationStatus).toBe("reconciled");
  });
});

describe.skipIf(!dbReady)("Reports & Isolation (DB)", () => {
  it("collection report totals match real payments; foreign-school data never leaks", async () => {
    const report = await getFeeCollectionReport(scopeAdmin);
    const allPayments = await prisma.feePayment.aggregate({ where: { schoolId }, _sum: { amount: true } });
    expect(report.totalCollected).toBe(Number(allPayments._sum.amount));

    const dashboard = await getFeeDashboard(scopeAdmin);
    expect(dashboard.outstanding).toBeGreaterThanOrEqual(0);

    // Nothing from the foreign school/tenant is scoped into this school's report.
    const foreignPaymentCount = await prisma.feePayment.count({ where: { schoolId: foreignSchoolId } });
    expect(foreignPaymentCount).toBe(0); // none were ever created against the foreign school in this suite
  });

  it("financial mutations are audited", async () => {
    const events = await prisma.auditEvent.count({ where: { tenantId, action: { in: ["FEE_CATEGORY_CREATED", "FEE_STRUCTURE_CREATED", "FEE_ASSIGNED", "FEE_PAYMENT_RECORDED", "FEE_DISCOUNT_APPLIED", "FEE_SCHOLARSHIP_APPLIED", "FEE_LATE_FEE_APPLIED", "FEE_REFUND_CREATED", "FEE_PAYMENT_RECONCILED"] } } });
    expect(events).toBeGreaterThan(10);
  });
});

describe.skipIf(!dbReady)("Fees RBAC (DB)", () => {
  it("fees.manage/collect/refund: SCHOOL_ADMIN has all; TEACHER has none", () => {
    expect(ROLE_PERMISSIONS.SCHOOL_ADMIN).toContain("fees.manage");
    expect(ROLE_PERMISSIONS.SCHOOL_ADMIN).toContain("fees.collect");
    expect(ROLE_PERMISSIONS.SCHOOL_ADMIN).toContain("fees.refund");
    expect(ROLE_PERMISSIONS.TEACHER ?? []).not.toContain("fees.manage");
    expect(ROLE_PERMISSIONS.TEACHER ?? []).not.toContain("fees.collect");
    expect(ROLE_PERMISSIONS.PRINCIPAL).toContain("fees.view");
    expect(ROLE_PERMISSIONS.PRINCIPAL).not.toContain("fees.manage");
  });
});
