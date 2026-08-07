import { getSnapshot, setState } from "@/lib/data/store";
import type { FineType, LibraryFine } from "@/lib/types/library";
import type { StudentFeeItem } from "@/lib/types/fees";
import { addMoney, clampNonNegative, subtractMoney, zeroMoney, type Money } from "@/lib/finance/money";
import { generateId } from "@/lib/utils";
import { logResourceAudit } from "./resource-audit-service";
import { addDays } from "@/lib/selectors/library-loan-rules";

type Actor = { name: string; role: string };
type Result = { ok: true } | { ok: false; error: string };

/** Outstanding = billed − paid − waived, clamped so it never displays negative. */
export function fineOutstanding(fine: LibraryFine): Money {
  return clampNonNegative(subtractMoney(subtractMoney(fine.amount, fine.paidAmount), fine.waivedAmount));
}

export type ManualFineDraft = { libraryId: string; memberId: string; loanId?: string; copyId?: string; type: FineType; amount: Money; reason?: string };

export function createManualFine(draft: ManualFineDraft, actor: Actor): Result & { fine?: LibraryFine } {
  if (draft.amount.minorUnits <= 0) return { ok: false, error: "Fine amount must be greater than zero." };
  const now = new Date().toISOString();
  const fine: LibraryFine = {
    id: generateId("fine"),
    libraryId: draft.libraryId,
    memberId: draft.memberId,
    loanId: draft.loanId,
    copyId: draft.copyId,
    type: draft.type,
    amount: draft.amount,
    paidAmount: zeroMoney(draft.amount.currency),
    waivedAmount: zeroMoney(draft.amount.currency),
    status: "pending",
    reason: draft.reason,
    idempotencyKey: `manual:${generateId("k")}`,
    createdAt: now,
    updatedAt: now,
  };
  setState((db) => ({ ...db, libraryFines: [fine, ...db.libraryFines] }));
  logResourceAudit({ domain: "library", subjectId: fine.id, action: "fine-generated", actorName: actor.name, actorRole: actor.role, summary: `Manual ${draft.type} fine created.`, reason: draft.reason });
  return { ok: true, fine };
}

/** Records a (possibly partial) payment against a fine. Decimal-safe throughout;
 * a payment can never exceed the outstanding balance. */
export function collectFine(fineId: string, amount: Money, actor: Actor): Result {
  const db = getSnapshot();
  const fine = db.libraryFines.find((f) => f.id === fineId);
  if (!fine) return { ok: false, error: "Fine not found." };
  if (fine.status === "waived" || fine.status === "cancelled" || fine.status === "refunded") return { ok: false, error: `Fine is ${fine.status} and cannot take a payment.` };
  const outstanding = fineOutstanding(fine);
  if (amount.minorUnits <= 0) return { ok: false, error: "Payment amount must be greater than zero." };
  if (amount.minorUnits > outstanding.minorUnits) return { ok: false, error: "Payment exceeds the outstanding balance." };

  const now = new Date().toISOString();
  const newPaid = addMoney(fine.paidAmount, amount);
  const newOutstanding = subtractMoney(subtractMoney(fine.amount, newPaid), fine.waivedAmount);
  const status = newOutstanding.minorUnits <= 0 ? "paid" : "partially-paid";
  setState((current) => ({ ...current, libraryFines: current.libraryFines.map((f) => (f.id === fineId ? { ...f, paidAmount: newPaid, status, updatedAt: now } : f)) }));
  logResourceAudit({ domain: "library", subjectId: fineId, action: "fine-collected", actorName: actor.name, actorRole: actor.role, summary: `Collected ${amount.minorUnits / 100} on a ${fine.type} fine.` });
  return { ok: true };
}

/** Waives all or part of a fine. Callers MUST hold library.waiveFines — the
 * page gates the action and passes an approver so the waiver is attributable. */
export function waiveFine(fineId: string, actor: Actor, options: { amount?: Money; reason: string }): Result {
  const db = getSnapshot();
  const fine = db.libraryFines.find((f) => f.id === fineId);
  if (!fine) return { ok: false, error: "Fine not found." };
  if (fine.status === "paid" || fine.status === "refunded" || fine.status === "cancelled") return { ok: false, error: `Fine is ${fine.status} and cannot be waived.` };
  if (!options.reason?.trim()) return { ok: false, error: "A reason is required to waive a fine." };
  const outstanding = fineOutstanding(fine);
  const waiveAmount = options.amount ?? outstanding;
  if (waiveAmount.minorUnits <= 0 || waiveAmount.minorUnits > outstanding.minorUnits) return { ok: false, error: "Invalid waiver amount." };

  const now = new Date().toISOString();
  const newWaived = addMoney(fine.waivedAmount, waiveAmount);
  const newOutstanding = subtractMoney(subtractMoney(fine.amount, fine.paidAmount), newWaived);
  const status = newOutstanding.minorUnits <= 0 ? "waived" : "partially-paid";
  setState((current) => ({ ...current, libraryFines: current.libraryFines.map((f) => (f.id === fineId ? { ...f, waivedAmount: newWaived, status, waivedBy: actor.name, waiverReason: options.reason, updatedAt: now } : f)) }));
  logResourceAudit({ domain: "library", subjectId: fineId, action: "fine-waived", actorName: actor.name, actorRole: actor.role, summary: `Waived a ${fine.type} fine.`, reason: options.reason });
  return { ok: true };
}

export function refundFine(fineId: string, actor: Actor, reason?: string): Result {
  const db = getSnapshot();
  const fine = db.libraryFines.find((f) => f.id === fineId);
  if (!fine) return { ok: false, error: "Fine not found." };
  if (fine.paidAmount.minorUnits <= 0) return { ok: false, error: "Nothing has been paid on this fine to refund." };
  const now = new Date().toISOString();
  setState((current) => ({ ...current, libraryFines: current.libraryFines.map((f) => (f.id === fineId ? { ...f, status: "refunded", updatedAt: now } : f)) }));
  logResourceAudit({ domain: "library", subjectId: fineId, action: "fine-refunded", actorName: actor.name, actorRole: actor.role, summary: `Refunded a ${fine.type} fine.`, reason });
  return { ok: true };
}

/** Pushes a library fine onto a student's fee account so it collects through
 * the Phase 5 dues pipeline instead of a parallel money system. Creates one
 * `library`-component fee item against the student's existing assignment and
 * links it back to the fine. Only valid for student members with an assignment. */
export function addFineToAccount(fineId: string, actor: Actor): Result {
  const db = getSnapshot();
  const fine = db.libraryFines.find((f) => f.id === fineId);
  if (!fine) return { ok: false, error: "Fine not found." };
  if (fine.feeItemId) return { ok: false, error: "This fine is already on the student's account." };
  const member = db.libraryMembers.find((m) => m.id === fine.memberId);
  if (!member || member.type !== "student" || !member.personId) return { ok: false, error: "Only student members can have fines added to a fee account." };
  const assignment = db.studentFeeAssignments.find((a) => a.studentId === member.personId);
  if (!assignment) return { ok: false, error: "No fee assignment found for this student." };

  const now = new Date().toISOString();
  const feeItem: StudentFeeItem = {
    id: generateId("feeitem"),
    assignmentId: assignment.id,
    studentId: member.personId,
    session: assignment.session,
    structureId: assignment.structureId,
    componentId: "library-fine",
    componentType: "library",
    label: `Library ${fine.type} fine`,
    billedAmount: fineOutstanding(fine),
    discountAmount: zeroMoney(fine.amount.currency),
    scholarshipAmount: zeroMoney(fine.amount.currency),
    fineAmount: zeroMoney(fine.amount.currency),
    paidAmount: zeroMoney(fine.amount.currency),
    dueDate: addDays(now, 14),
    status: "pending",
    refundable: false,
  };
  setState((current) => ({
    ...current,
    studentFeeItems: [...current.studentFeeItems, feeItem],
    libraryFines: current.libraryFines.map((f) => (f.id === fineId ? { ...f, feeItemId: feeItem.id, updatedAt: now } : f)),
  }));
  logResourceAudit({ domain: "library", subjectId: fineId, action: "fine-generated", actorName: actor.name, actorRole: actor.role, summary: `${fine.type} fine added to ${member.name}'s fee account.` });
  return { ok: true };
}
