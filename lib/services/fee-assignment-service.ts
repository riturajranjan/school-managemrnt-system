import { getSnapshot, setState, type Db } from "@/lib/data/store";
import type { Discount, FeeStructure, StudentFeeAssignment, StudentFeeItem } from "@/lib/types/fees";
import { multiplyMoney, percentOfMoney, splitEvenly, subtractMoney, sumMoney, zeroMoney, type Money } from "@/lib/finance/money";
import { generateId } from "@/lib/utils";
import { logFinancialAudit } from "./finance-audit-service";

export type AssignmentPreviewRow = {
  studentId: string;
  studentName: string;
  total: Money;
  alreadyAssigned: boolean;
  eligible: boolean;
  exception?: string;
};

export type AssignmentOptions = {
  optionalComponentIds: string[];
  /** When set, installments due before this date are waived entirely — a
   * coarse but explainable proration for a student joining mid-session. */
  proratedFromDate?: string;
  discountPercent?: number;
  discountName?: string;
};

/** Pure preview of a bulk assignment — every eligibility/exception check the
 * confirm step relies on, computed without touching the store, so the UI can
 * show "review exceptions" before anything is written. */
export function computeAssignmentPreview(db: Db, studentIds: string[], structure: FeeStructure, options: AssignmentOptions): AssignmentPreviewRow[] {
  return studentIds.map((studentId) => {
    const student = db.students.find((s) => s.id === studentId);
    const studentName = student ? `${student.profile.firstName} ${student.profile.lastName}` : studentId;
    if (!student) return { studentId, studentName, total: zeroMoney(structure.currency), alreadyAssigned: false, eligible: false, exception: "Student not found." };
    if (student.status !== "active") return { studentId, studentName, total: zeroMoney(structure.currency), alreadyAssigned: false, eligible: false, exception: `Student status is "${student.status}", not active.` };

    const alreadyAssigned = db.studentFeeAssignments.some((a) => a.studentId === studentId && a.structureId === structure.id && a.session === structure.session && a.status === "active");
    if (alreadyAssigned) return { studentId, studentName, total: zeroMoney(structure.currency), alreadyAssigned: true, eligible: false, exception: "Already has an active assignment against this structure." };

    if (structure.status !== "active" && structure.status !== "draft") {
      return { studentId, studentName, total: zeroMoney(structure.currency), alreadyAssigned: false, eligible: false, exception: `Structure is ${structure.status}, not assignable.` };
    }

    const optedIn = new Set(options.optionalComponentIds);
    const components = structure.components.filter((c) => !c.optional || optedIn.has(c.id));
    const installments = options.proratedFromDate ? structure.installments.filter((i) => i.dueDate >= options.proratedFromDate!) : structure.installments;
    const grossTotal = sumMoney(
      components.map((c) => c.amount),
      structure.currency,
    );
    const discount = options.discountPercent ? percentOfMoney(grossTotal, options.discountPercent) : zeroMoney(structure.currency);
    const proratedShare = installments.length === 0 ? zeroMoney(structure.currency) : multiplyMoney(grossTotal, installments.length / structure.installments.length);
    const total = subtractMoney(options.proratedFromDate ? proratedShare : grossTotal, discount);

    return { studentId, studentName, total, alreadyAssigned: false, eligible: true };
  });
}

export type ConfirmAssignmentResult = { assigned: number; skipped: number };

/** Creates the assignment + fee-item rows for every eligible student in the
 * preview — students already flagged ineligible by computeAssignmentPreview
 * are silently skipped rather than re-validated, since the caller already
 * showed those exceptions before confirm was clicked. */
export function confirmAssignment(structure: FeeStructure, rows: AssignmentPreviewRow[], options: AssignmentOptions, actor: { name: string; role: string }): ConfirmAssignmentResult {
  const eligibleRows = rows.filter((r) => r.eligible);
  const newAssignments: StudentFeeAssignment[] = [];
  const newItems: StudentFeeItem[] = [];
  const newDiscounts: Discount[] = [];
  const now = new Date().toISOString();

  const optedIn = new Set(options.optionalComponentIds);
  const components = structure.components.filter((c) => !c.optional || optedIn.has(c.id));
  const installments = options.proratedFromDate ? structure.installments.filter((i) => i.dueDate >= options.proratedFromDate!) : structure.installments;

  for (const row of eligibleRows) {
    let discountId: string | undefined;
    if (options.discountPercent) {
      const discount: Discount = {
        id: generateId("disc"),
        name: options.discountName ?? "Bulk assignment discount",
        type: "promotional",
        studentId: row.studentId,
        percent: options.discountPercent,
        applicableComponentIds: components.map((c) => c.id),
        session: structure.session,
        effectiveFrom: now,
        status: "active",
        approvedBy: actor.name,
        approvedAt: now,
        createdBy: actor.name,
        createdAt: now,
      };
      newDiscounts.push(discount);
      discountId = discount.id;
    }

    const assignment: StudentFeeAssignment = {
      id: generateId("sfa"),
      studentId: row.studentId,
      session: structure.session,
      structureId: structure.id,
      discountIds: discountId ? [discountId] : [],
      scholarshipIds: [],
      optionalComponentIds: options.optionalComponentIds,
      status: "active",
      proratedFromDate: options.proratedFromDate,
      assignedAt: now,
      assignedBy: actor.name,
    };
    newAssignments.push(assignment);

    for (const component of components) {
      const shares = splitEvenly(component.amount, installments.length || 1);
      installments.forEach((installment, index) => {
        const discountAmount = options.discountPercent ? percentOfMoney(shares[index], options.discountPercent) : zeroMoney(structure.currency);
        newItems.push({
          id: generateId("sfi"),
          assignmentId: assignment.id,
          studentId: row.studentId,
          session: structure.session,
          structureId: structure.id,
          componentId: component.id,
          componentType: component.type,
          installmentId: installment.id,
          label: `${component.label} — ${installment.label}`,
          billedAmount: shares[index],
          discountAmount,
          scholarshipAmount: zeroMoney(structure.currency),
          fineAmount: zeroMoney(structure.currency),
          paidAmount: zeroMoney(structure.currency),
          dueDate: installment.dueDate,
          status: "pending",
          refundable: component.refundable,
        });
      });
    }
  }

  setState((current) => ({
    ...current,
    studentFeeAssignments: [...current.studentFeeAssignments, ...newAssignments],
    studentFeeItems: [...current.studentFeeItems, ...newItems],
    discounts: [...current.discounts, ...newDiscounts],
  }));

  if (newAssignments.length > 0) {
    logFinancialAudit({
      subjectId: structure.id,
      action: "fee-assigned",
      actorName: actor.name,
      actorRole: actor.role,
      summary: `${newAssignments.length} student(s) assigned to "${structure.name}".`,
      session: structure.session,
    });
  }
  if (newDiscounts.length > 0) {
    logFinancialAudit({
      subjectId: structure.id,
      action: "discount-applied",
      actorName: actor.name,
      actorRole: actor.role,
      summary: `"${newDiscounts[0].name}" (${newDiscounts[0].percent}%) applied to ${newDiscounts.length} student(s) during assignment.`,
      session: structure.session,
    });
  }

  return { assigned: newAssignments.length, skipped: rows.length - newAssignments.length };
}

/** Marks an assignment withdrawn — used when a student transfers out or is
 * withdrawn mid-session. Future (not-yet-due) items are cancelled; anything
 * already paid or overdue is left untouched for the finance team to settle
 * manually (a refund or write-off is a deliberate, separate decision). */
export function withdrawAssignment(assignmentId: string, actor: { name: string; role: string }) {
  const db = getSnapshot();
  const assignment = db.studentFeeAssignments.find((a) => a.id === assignmentId);
  if (!assignment) return;
  const today = new Date().toISOString().slice(0, 10);

  setState((current) => ({
    ...current,
    studentFeeAssignments: current.studentFeeAssignments.map((a) => (a.id === assignmentId ? { ...a, status: "withdrawn" } : a)),
    studentFeeItems: current.studentFeeItems.map((i) =>
      i.assignmentId === assignmentId && i.status === "pending" && i.dueDate > today ? { ...i, status: "cancelled" } : i,
    ),
  }));

  logFinancialAudit({
    subjectId: assignment.studentId,
    action: "fee-assigned",
    actorName: actor.name,
    actorRole: actor.role,
    summary: `Fee assignment withdrawn for student — future installments cancelled.`,
    session: assignment.session,
  });
}
