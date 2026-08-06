import type { StudentFeeItem } from "@/lib/types/fees";
import { addMoney, clampNonNegative, subtractMoney, sumMoney, zeroMoney, type Money } from "@/lib/finance/money";

/** What the student actually owes on this item after discounts and
 * scholarships, before payment — the number every fee screen should show as
 * "due", never the raw billedAmount. */
export function netDueForItem(item: StudentFeeItem): Money {
  return subtractMoney(item.billedAmount, addMoney(item.discountAmount, item.scholarshipAmount));
}

/** What's still outstanding on this item — net due plus any fine, minus what's
 * already been paid, clamped so a fully/over-paid item never shows negative. */
export function outstandingForItem(item: StudentFeeItem): Money {
  const dueWithFine = addMoney(netDueForItem(item), item.fineAmount);
  return clampNonNegative(subtractMoney(dueWithFine, item.paidAmount));
}

export function totalOutstanding(items: StudentFeeItem[]): Money {
  return sumMoney(items.map((i) => outstandingForItem(i)), items[0]?.billedAmount.currency ?? "INR");
}

export function totalOverdue(items: StudentFeeItem[]): Money {
  const overdueItems = items.filter((i) => i.status === "overdue");
  if (overdueItems.length === 0) return zeroMoney(items[0]?.billedAmount.currency ?? "INR");
  return totalOutstanding(overdueItems);
}
