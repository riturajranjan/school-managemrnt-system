import type { Db } from "@/lib/data/store";
import type { BudgetLine } from "@/lib/types/accounting";
import { addMoney, compareMoney, percentOfMoney, sumMoney, zeroMoney, type Money } from "@/lib/finance/money";

const incomeCategories = new Set(["fees", "donations", "grants", "sponsorship", "rental-income", "event-income", "sale-of-materials", "interest", "other-income"]);

/** Live actual spend/receipt for a budget line, recomputed from the current
 * expense/income records rather than trusted from a stored snapshot — a
 * budget line's `actualAmount` field is only ever a seed-time convenience,
 * never the source of truth once expenses keep being recorded after it. */
export function actualForLine(db: Db, line: BudgetLine, financialYear: string): Money {
  if (incomeCategories.has(line.category)) {
    return sumMoney(
      db.incomes.filter((i) => i.category === line.category && i.date.slice(0, 4) >= financialYear.slice(0, 4)).map((i) => i.amount),
      line.plannedAmount.currency,
    );
  }
  return sumMoney(
    db.expenses.filter((e) => e.category === line.category && (e.status === "paid" || e.status === "approved")).map((e) => addMoney(e.amount, e.tax)),
    line.plannedAmount.currency,
  );
}

export function utilizationPercent(actual: Money, planned: Money): number {
  if (planned.minorUnits === 0) return actual.minorUnits === 0 ? 0 : 100;
  return Math.round((actual.minorUnits / planned.minorUnits) * 100);
}

export function isOverThreshold(actual: Money, line: BudgetLine): boolean {
  return compareMoney(actual, percentOfMoney(line.plannedAmount, line.alertThresholdPercent)) >= 0;
}

export function totalPlanned(lines: BudgetLine[], currency: Money["currency"] = "INR"): Money {
  return sumMoney(lines.map((l) => l.plannedAmount), currency);
}

export function totalActual(db: Db, lines: BudgetLine[], financialYear: string, currency: Money["currency"] = "INR"): Money {
  return lines.length === 0 ? zeroMoney(currency) : sumMoney(lines.map((l) => actualForLine(db, l, financialYear)), currency);
}
