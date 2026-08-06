import { getSnapshot, setState } from "@/lib/data/store";
import type { Concession, ConcessionReason, Discount, DiscountType, Scholarship, ScholarshipType, StudentFeeItem } from "@/lib/types/fees";
import { moneyFromMajor, percentOfMoney, sumMoney, zeroMoney, type Money } from "@/lib/finance/money";
import { generateId } from "@/lib/utils";
import { logFinancialAudit } from "./finance-audit-service";
import { applyWaiverToItems } from "./fee-waiver-utils";

type Actor = { name: string; role: string };

export function applyDiscountToStudent(
  input: { studentId: string; name: string; type: DiscountType; percent?: number; amount?: Money; applicableComponentIds: string[]; session: string },
  actor: Actor,
): Discount {
  const db = getSnapshot();
  const now = new Date().toISOString();
  const targetItems = db.studentFeeItems.filter((i) => i.studentId === input.studentId && input.applicableComponentIds.includes(i.componentId) && i.status !== "cancelled" && i.status !== "paid");
  const billedTotal = sumMoney(targetItems.map((i) => i.billedAmount), targetItems[0]?.billedAmount.currency ?? "INR");
  const waiver = input.percent !== undefined ? percentOfMoney(billedTotal, input.percent) : (input.amount ?? zeroMoney("INR"));

  const discount: Discount = {
    id: generateId("disc"),
    name: input.name,
    type: input.type,
    studentId: input.studentId,
    percent: input.percent,
    amount: input.amount,
    applicableComponentIds: input.applicableComponentIds,
    session: input.session,
    effectiveFrom: now,
    status: "active",
    approvedBy: actor.name,
    approvedAt: now,
    createdBy: actor.name,
    createdAt: now,
  };

  applyWaiverToItems(input.studentId, input.applicableComponentIds, waiver, "discountAmount");
  setState((current) => ({
    ...current,
    discounts: [...current.discounts, discount],
    studentFeeAssignments: current.studentFeeAssignments.map((a) => (a.studentId === input.studentId && a.status === "active" ? { ...a, discountIds: [...a.discountIds, discount.id] } : a)),
  }));

  logFinancialAudit({ subjectId: input.studentId, action: "discount-applied", actorName: actor.name, actorRole: actor.role, summary: `Discount "${discount.name}" applied to student.`, session: input.session });
  return discount;
}

export function applyScholarshipToStudent(
  input: { studentId: string; name: string; type: ScholarshipType; percent?: number; amount?: Money; applicableComponentIds: string[]; session: string },
  actor: Actor,
): Scholarship {
  const db = getSnapshot();
  const now = new Date().toISOString();
  const targetItems = db.studentFeeItems.filter((i) => i.studentId === input.studentId && input.applicableComponentIds.includes(i.componentId) && i.status !== "cancelled" && i.status !== "paid");
  const billedTotal = sumMoney(targetItems.map((i) => i.billedAmount), targetItems[0]?.billedAmount.currency ?? "INR");
  const waiver = input.percent !== undefined ? percentOfMoney(billedTotal, input.percent) : (input.amount ?? zeroMoney("INR"));

  const scholarship: Scholarship = {
    id: generateId("schol"),
    name: input.name,
    type: input.type,
    studentId: input.studentId,
    session: input.session,
    percent: input.percent,
    amount: input.amount,
    applicableComponentIds: input.applicableComponentIds,
    effectiveFrom: now,
    renewable: false,
    status: "active",
    approvedBy: actor.name,
    approvedAt: now,
    createdBy: actor.name,
    createdAt: now,
  };

  applyWaiverToItems(input.studentId, input.applicableComponentIds, waiver, "scholarshipAmount");
  setState((current) => ({
    ...current,
    scholarships: [...current.scholarships, scholarship],
    studentFeeAssignments: current.studentFeeAssignments.map((a) => (a.studentId === input.studentId && a.status === "active" ? { ...a, scholarshipIds: [...a.scholarshipIds, scholarship.id] } : a)),
  }));

  logFinancialAudit({ subjectId: input.studentId, action: "scholarship-applied", actorName: actor.name, actorRole: actor.role, summary: `Scholarship "${scholarship.name}" applied to student.`, session: input.session });
  return scholarship;
}

export function applyConcessionToStudent(input: { studentId: string; reason: ConcessionReason; description: string; amount: Money; applicableComponentIds: string[] }, actor: Actor): Concession {
  const now = new Date().toISOString();
  const concession: Concession = {
    id: generateId("conc"),
    studentId: input.studentId,
    reason: input.reason,
    description: input.description,
    amount: input.amount,
    applicableComponentIds: input.applicableComponentIds,
    effectiveFrom: now,
    status: "active",
    approvedBy: actor.name,
    approvedAt: now,
    createdBy: actor.name,
    createdAt: now,
  };

  applyWaiverToItems(input.studentId, input.applicableComponentIds, input.amount, "discountAmount");
  setState((current) => ({ ...current, concessions: [...current.concessions, concession] }));

  logFinancialAudit({ subjectId: input.studentId, action: "concession-applied", actorName: actor.name, actorRole: actor.role, summary: `Concession applied: ${input.description}`, reason: input.reason });
  return concession;
}

export function addManualCredit(studentId: string, amountMajor: number, note: string, actor: Actor) {
  const credit = { id: generateId("credit"), studentId, amount: moneyFromMajor(amountMajor, "INR"), consumedAmount: zeroMoney("INR"), source: "manual-credit" as const, note, createdAt: new Date().toISOString() };
  setState((db) => ({ ...db, creditBalances: [...db.creditBalances, credit] }));
  logFinancialAudit({ subjectId: studentId, action: "manual-override-used", actorName: actor.name, actorRole: actor.role, summary: `Manual credit of ${amountMajor} added: ${note}` });
  return credit;
}

/** Cancels an optional component's not-yet-paid items — used when a family
 * opts out of transport, hostel, or another optional service mid-session.
 * Anything already paid is left alone; that's a refund decision, not a
 * removal. */
export function removeOptionalComponent(studentId: string, componentId: string, actor: Actor) {
  const before = getSnapshot().studentFeeItems.filter((i) => i.studentId === studentId && i.componentId === componentId && i.status !== "paid" && i.status !== "cancelled");
  setState((db) => ({
    ...db,
    studentFeeItems: db.studentFeeItems.map((i) => (i.studentId === studentId && i.componentId === componentId && i.status !== "paid" && i.status !== "cancelled" ? { ...i, status: "cancelled" } : i)),
  }));
  if (before.length > 0) {
    logFinancialAudit({ subjectId: studentId, action: "fee-assigned", actorName: actor.name, actorRole: actor.role, summary: `Optional fee component removed — ${before.length} unpaid item(s) cancelled.` });
  }
}

/** A one-off fee outside the student's regular structure (e.g. a replacement
 * ID card charge) — creates a single standalone StudentFeeItem not tied to
 * any installment. */
export function addAdHocFeeItem(studentId: string, session: string, label: string, amountMajor: number, dueDate: string, actor: Actor): StudentFeeItem {
  const item: StudentFeeItem = {
    id: generateId("sfi"),
    assignmentId: "adhoc",
    studentId,
    session,
    structureId: "adhoc",
    componentId: generateId("fc"),
    componentType: "custom",
    label,
    billedAmount: moneyFromMajor(amountMajor, "INR"),
    discountAmount: zeroMoney("INR"),
    scholarshipAmount: zeroMoney("INR"),
    fineAmount: zeroMoney("INR"),
    paidAmount: zeroMoney("INR"),
    dueDate,
    status: "pending",
    refundable: false,
  };
  setState((db) => ({ ...db, studentFeeItems: [...db.studentFeeItems, item] }));
  logFinancialAudit({ subjectId: studentId, action: "fee-assigned", actorName: actor.name, actorRole: actor.role, summary: `Ad-hoc fee "${label}" added.`, session });
  return item;
}
