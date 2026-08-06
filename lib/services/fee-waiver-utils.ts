import { setState } from "@/lib/data/store";
import { splitEvenly, subtractMoney, type Money } from "@/lib/finance/money";

export type WaiverField = "discountAmount" | "scholarshipAmount";

/** Spreads a waived amount (discount, scholarship or concession) across every
 * matching, not-yet-fully-paid fee item, writing into the given field. A
 * concession is modeled as a discount for ledger purposes — the Concession/
 * Discount/Scholarship records keep the reason distinct for reporting, but
 * StudentFeeItem only needs "how much was waived", not why. Shared between
 * the direct-apply staff actions and the formal approval workflow so both
 * paths credit items identically. */
export function applyWaiverToItems(studentId: string, componentIds: string[], totalWaiver: Money, field: WaiverField): void {
  setState((db) => {
    const targetItems = db.studentFeeItems.filter((i) => i.studentId === studentId && componentIds.includes(i.componentId) && i.status !== "cancelled" && i.status !== "paid");
    if (targetItems.length === 0) return db;
    const shares = splitEvenly(totalWaiver, targetItems.length);
    const shareByItemId = new Map(targetItems.map((item, index) => [item.id, shares[index]]));
    return {
      ...db,
      studentFeeItems: db.studentFeeItems.map((item) => {
        const share = shareByItemId.get(item.id);
        if (!share) return item;
        return { ...item, [field]: { minorUnits: item[field].minorUnits + share.minorUnits, currency: item[field].currency } };
      }),
    };
  });
}

/** Reverses a previously-applied waiver on items that are still unpaid —
 * used when a discount/scholarship/concession is revoked. Paid items are
 * left untouched; correcting a settled bill is a refund decision, not an
 * automatic side effect of revoking a waiver. */
export function reverseWaiverOnUnpaidItems(studentId: string, componentIds: string[], totalWaiver: Money, field: WaiverField): void {
  setState((db) => {
    const targetItems = db.studentFeeItems.filter((i) => i.studentId === studentId && componentIds.includes(i.componentId) && i.status !== "cancelled" && i.status !== "paid");
    if (targetItems.length === 0) return db;
    const shares = splitEvenly(totalWaiver, targetItems.length);
    const shareByItemId = new Map(targetItems.map((item, index) => [item.id, shares[index]]));
    return {
      ...db,
      studentFeeItems: db.studentFeeItems.map((item) => {
        const share = shareByItemId.get(item.id);
        if (!share) return item;
        const reduced = subtractMoney(item[field], share);
        return { ...item, [field]: reduced.minorUnits < 0 ? { minorUnits: 0, currency: reduced.currency } : reduced };
      }),
    };
  });
}
