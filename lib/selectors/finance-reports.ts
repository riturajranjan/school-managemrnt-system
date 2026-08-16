import type { Db } from "@/lib/data/store";
import { addMoney, sumMoney, zeroMoney, type Money } from "@/lib/finance/money";

// ---------------------------------------------------------------------------
// Fee reports
//
// Phase 9F/9G note: the real Fees domain (lib/server/fees/reports.ts) and
// real Accounting domain (lib/server/accounting/reports.ts + ledger.ts) have
// their own server-derived reports now. totalCollected() below survives only
// because lib/selectors/finance-pulse.ts (still consumed by the not-yet-
// migrated Payroll dashboard) depends on it — trialBalance/incomeStatement/
// cashFlowSummary/collectionSummaryByMethod/waiverSummary/totalOutstanding
// were deleted here (Phase 9G) as zero-remaining-consumer mock accounting
// authority once the real Accounting Reports page stopped reading them.
// ---------------------------------------------------------------------------

export function totalCollected(db: Db): Money {
  return sumMoney(
    db.payments.filter((p) => p.status === "successful").map((p) => p.amount),
    "INR",
  );
}

// ---------------------------------------------------------------------------
// Payroll reports
// ---------------------------------------------------------------------------

export type PayrollCostByPeriod = { period: string; totalGross: Money; totalDeductions: Money; totalNet: Money; employeeCount: number };

export function payrollCostTrend(db: Db): PayrollCostByPeriod[] {
  return [...db.payrollRuns]
    .filter((r) => r.status !== "cancelled" && r.status !== "draft")
    .sort((a, b) => (a.period < b.period ? -1 : 1))
    .map((r) => ({ period: r.period, totalGross: r.totalGross, totalDeductions: r.totalDeductions, totalNet: r.totalNet, employeeCount: r.employees.length }));
}

export type TaxWithheldByPeriod = { period: string; taxWithheld: Money; employeeCount: number };

export function taxWithheldTrend(db: Db): TaxWithheldByPeriod[] {
  const byPeriod = new Map<string, { taxWithheld: Money; employeeCount: number }>();
  for (const payslip of db.payslips) {
    const taxLines = payslip.deductions.filter((d) => /tax/i.test(d.label));
    if (taxLines.length === 0) continue;
    const taxAmount = sumMoney(
      taxLines.map((d) => d.amount),
      "INR",
    );
    const existing = byPeriod.get(payslip.period) ?? { taxWithheld: zeroMoney("INR"), employeeCount: 0 };
    byPeriod.set(payslip.period, { taxWithheld: addMoney(existing.taxWithheld, taxAmount), employeeCount: existing.employeeCount + 1 });
  }
  return Array.from(byPeriod.entries())
    .map(([period, v]) => ({ period, ...v }))
    .sort((a, b) => (a.period < b.period ? -1 : 1));
}
