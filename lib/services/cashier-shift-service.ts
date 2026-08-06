import { getSnapshot, setState } from "@/lib/data/store";
import type { CashierShift } from "@/lib/types/accounting";
import { addMoney, subtractMoney, sumMoney, zeroMoney, type Money } from "@/lib/finance/money";
import { generateId } from "@/lib/utils";
import { logFinancialAudit } from "./finance-audit-service";

type Actor = { name: string; role: string };

export function openCashierShift(input: { cashierName: string; branch: string; openingCash: Money }, actor: Actor): { ok: true; shift: CashierShift } | { ok: false; error: string } {
  const db = getSnapshot();
  const alreadyOpen = db.cashierShifts.find((s) => s.cashierName === input.cashierName && s.status === "open");
  if (alreadyOpen) return { ok: false, error: `${input.cashierName} already has an open shift.` };

  const shift: CashierShift = {
    id: generateId("shift"),
    cashierName: input.cashierName,
    branch: input.branch,
    openedAt: new Date().toISOString(),
    openingCash: input.openingCash,
    cashCollections: zeroMoney(input.openingCash.currency),
    cashRefunds: zeroMoney(input.openingCash.currency),
    cashExpenses: zeroMoney(input.openingCash.currency),
    expectedClosing: input.openingCash,
    status: "open",
  };
  setState((current) => ({ ...current, cashierShifts: [...current.cashierShifts, shift] }));
  logFinancialAudit({ action: "cashier-shift-closed", actorName: actor.name, actorRole: actor.role, summary: `Cash register opened by ${shift.cashierName} with ${input.openingCash.minorUnits / 100} opening cash.` });
  return { ok: true, shift };
}

/** Recomputes expected closing from every cash movement recorded since the
 * shift opened — collections, refunds and expenses are looked up fresh
 * rather than tallied incrementally, so a shift always reflects the current
 * state of the ledger even if entries were corrected after the fact. */
export function closeCashierShift(shiftId: string, actualClosing: Money, notes: string | undefined, actor: Actor): { ok: true; shift: CashierShift } | { ok: false; error: string } {
  const db = getSnapshot();
  const shift = db.cashierShifts.find((s) => s.id === shiftId);
  if (!shift) return { ok: false, error: "Shift not found." };
  if (shift.status !== "open") return { ok: false, error: "This shift is already closed." };

  const currency = shift.openingCash.currency;
  const cashCollections = sumMoney(
    db.payments.filter((p) => p.method === "cash" && p.status === "successful" && p.cashierName === shift.cashierName && p.paidAt >= shift.openedAt).map((p) => p.amount),
    currency,
  );
  const cashRefunds = sumMoney(
    db.refunds.filter((r) => r.method === "cash" && r.status === "completed" && r.processedAt && r.processedAt >= shift.openedAt).map((r) => r.amount),
    currency,
  );
  const cashExpenses = sumMoney(
    db.expenses.filter((e) => e.paymentMethod === "cash" && e.status === "paid" && e.paidAt && e.paidAt >= shift.openedAt).map((e) => addMoney(e.amount, e.tax)),
    currency,
  );
  const expectedClosing = subtractMoney(subtractMoney(addMoney(shift.openingCash, cashCollections), cashRefunds), cashExpenses);
  const difference = subtractMoney(actualClosing, expectedClosing);

  const closed: CashierShift = { ...shift, closedAt: new Date().toISOString(), cashCollections, cashRefunds, cashExpenses, expectedClosing, actualClosing, difference, notes, status: "closed", approvedBy: actor.name };
  setState((current) => ({ ...current, cashierShifts: current.cashierShifts.map((s) => (s.id === shiftId ? closed : s)) }));
  logFinancialAudit({
    action: "cashier-shift-closed",
    actorName: actor.name,
    actorRole: actor.role,
    summary: `Cash register closed for ${shift.cashierName} — expected ${expectedClosing.minorUnits / 100}, counted ${actualClosing.minorUnits / 100}${difference.minorUnits !== 0 ? ` (difference ${difference.minorUnits / 100})` : ""}.`,
  });
  return { ok: true, shift: closed };
}
