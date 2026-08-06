import type { Db } from "@/lib/data/store";
import { addMoney, sumMoney, zeroMoney, type Money } from "@/lib/finance/money";
import { reconciliationStatusFor } from "@/lib/services/reconciliation-service";
import { actualForLine, isOverThreshold } from "./budget-insights";

export type ExceptionSeverity = "high" | "medium" | "low";
export type FinanceException = { id: string; severity: ExceptionSeverity; label: string; description: string; href: string };

/** Every row here points at something a real user must act on — never a
 * decorative "all good" filler. An empty return means there is genuinely
 * nothing outstanding right now. */
export function financeExceptions(db: Db, today = new Date()): FinanceException[] {
  const exceptions: FinanceException[] = [];
  const todayIso = today.toISOString().slice(0, 10);

  const overdueItems = db.studentFeeItems.filter((i) => i.status === "overdue");
  if (overdueItems.length > 0) {
    exceptions.push({ id: "overdue-items", severity: "high", label: `${overdueItems.length} overdue fee item(s)`, description: "Students with fee items past their due date.", href: "/fees/dues" });
  }

  const pendingExpenses = db.expenses.filter((e) => e.status === "submitted" || e.status === "under-review");
  if (pendingExpenses.length > 0) {
    exceptions.push({ id: "pending-expenses", severity: "medium", label: `${pendingExpenses.length} expense(s) awaiting approval`, description: "Submitted expenses that haven't been approved or rejected.", href: "/accounting/expenses" });
  }

  const pendingPOs = db.purchaseOrders.filter((p) => p.status === "submitted");
  if (pendingPOs.length > 0) {
    exceptions.push({ id: "pending-pos", severity: "medium", label: `${pendingPOs.length} purchase order(s) awaiting approval`, description: "Purchase orders submitted but not yet approved.", href: "/accounting/purchase-orders" });
  }

  const pendingWaivers = [...db.discounts, ...db.scholarships, ...db.concessions].filter((w) => w.status === "submitted" || w.status === "under-review");
  if (pendingWaivers.length > 0) {
    exceptions.push({ id: "pending-waivers", severity: "low", label: `${pendingWaivers.length} discount/scholarship/concession request(s) pending`, description: "Waiver requests awaiting finance approval.", href: "/fees/discounts" });
  }

  const resolvedStatuses = new Set(["matched", "reconciled", "ignored"]);
  const unreconciled = db.bankTransactions.filter((t) => !resolvedStatuses.has(reconciliationStatusFor(db, t.id)));
  if (unreconciled.length > 0) {
    exceptions.push({ id: "unreconciled", severity: "medium", label: `${unreconciled.length} bank transaction(s) unreconciled`, description: "Imported transactions not yet matched to a payment.", href: "/fees/reconciliation" });
  }

  const overBudgetLines = db.budgets
    .filter((b) => b.status === "approved" || b.status === "revised")
    .flatMap((b) => b.lines.map((line) => ({ line, financialYear: b.financialYear })))
    .filter(({ line, financialYear }) => isOverThreshold(actualForLine(db, line, financialYear), line));
  if (overBudgetLines.length > 0) {
    exceptions.push({ id: "over-budget", severity: "high", label: `${overBudgetLines.length} budget line(s) over threshold`, description: "Category spend has crossed its alert threshold.", href: "/accounting/budgets" });
  }

  const payrollExceptions = db.payrollRuns.filter((r) => r.status === "review" || r.status === "draft").flatMap((r) => r.employees.filter((e) => e.exceptions.length > 0));
  if (payrollExceptions.length > 0) {
    exceptions.push({ id: "payroll-exceptions", severity: "high", label: `${payrollExceptions.length} payroll exception(s)`, description: "Employees with negative net pay or other blocking issues.", href: "/payroll/run" });
  }

  const expiringLinks = db.paymentLinks.filter((l) => l.status === "active" && l.expiresAt.slice(0, 10) <= todayIso);
  if (expiringLinks.length > 0) {
    exceptions.push({ id: "expiring-links", severity: "low", label: `${expiringLinks.length} payment link(s) expiring or expired`, description: "Active payment links at or past their expiry date.", href: "/fees/payment-links" });
  }

  const severityRank: Record<ExceptionSeverity, number> = { high: 0, medium: 1, low: 2 };
  return exceptions.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
}

export type DailyFinanceBrief = { todayCollected: Money; todayExpensePaid: Money; dueThisWeek: number; pendingApprovals: number };

export function dailyFinanceBrief(db: Db, today = new Date()): DailyFinanceBrief {
  const todayIso = today.toISOString().slice(0, 10);
  const weekAhead = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const todayCollected = sumMoney(
    db.payments.filter((p) => p.status === "successful" && p.paidAt.slice(0, 10) === todayIso).map((p) => p.amount),
    "INR",
  );
  const todayExpensePaid = sumMoney(
    db.expenses.filter((e) => e.status === "paid" && e.paidAt?.slice(0, 10) === todayIso).map((e) => addMoney(e.amount, e.tax)),
    "INR",
  );
  const dueThisWeek = db.studentFeeItems.filter((i) => (i.status === "pending" || i.status === "partial") && i.dueDate >= todayIso && i.dueDate <= weekAhead).length;
  const pendingApprovals = db.expenses.filter((e) => e.status === "submitted" || e.status === "under-review").length + db.purchaseOrders.filter((p) => p.status === "submitted").length;

  return { todayCollected: todayCollected.minorUnits > 0 ? todayCollected : zeroMoney("INR"), todayExpensePaid, dueThisWeek, pendingApprovals };
}
