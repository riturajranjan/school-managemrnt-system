"use client";

import Link from "next/link";
import { BookOpen, Boxes, Calculator, ClipboardList, Gauge, Landmark, PiggyBank, Receipt, ScrollText, Store, TrendingUp, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { useSisStore } from "@/lib/hooks/use-store";
import { addMoney, formatMoney, sumMoney } from "@/lib/finance/money";

const quickLinks = [
  { href: "/accounting/income", label: "Income", description: "Donations, grants, sponsorships and other income", icon: TrendingUp },
  { href: "/accounting/expenses", label: "Expenses", description: "Submit, approve and pay school expenses", icon: Receipt },
  { href: "/accounting/vendors", label: "Vendors", description: "Vendor directory and categories", icon: Store },
  { href: "/accounting/purchase-orders", label: "Purchase orders", description: "PO workflow linked to expenses", icon: ClipboardList },
  { href: "/accounting/accounts", label: "Chart of accounts", description: "Asset, liability, income and expense accounts", icon: Boxes },
  { href: "/accounting/journals", label: "Journals", description: "Every posted double-entry journal", icon: BookOpen },
  { href: "/accounting/ledger", label: "Ledger", description: "Running balance per account, student or vendor", icon: ScrollText },
  { href: "/accounting/bank-reconciliation", label: "Bank & cash", description: "Bank accounts, cash registers, cashier shifts", icon: Landmark },
  { href: "/accounting/budgets", label: "Budgets", description: "Planned vs actual by category", icon: PiggyBank },
  { href: "/accounting/reports", label: "Reports", description: "Income statement, cash flow, trial balance", icon: Calculator },
];

export default function AccountingHubPage() {
  const db = useSisStore();

  const totalIncome = sumMoney(
    db.incomes.map((i) => i.amount),
    "INR",
  );
  const feeIncome = sumMoney(
    db.payments.filter((p) => p.status === "successful").map((p) => p.amount),
    "INR",
  );
  const totalExpense = sumMoney(
    db.expenses.filter((e) => e.status === "paid").map((e) => addMoney(e.amount, e.tax)),
    "INR",
  );
  const netCashFlow = addMoney(addMoney(totalIncome, feeIncome), { minorUnits: -totalExpense.minorUnits, currency: "INR" });
  const pendingApprovals = db.expenses.filter((e) => e.status === "submitted" || e.status === "under-review").length;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Accounting</h1>
          <p className="text-xs text-muted-foreground">Income, expenses, ledger and financial reporting</p>
        </div>
        <Button asChild size="sm">
          <Link href="/accounting/dashboard">
            <Gauge className="size-3.5" />
            Dashboard
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Fee income" value={formatMoney(feeIncome, { compact: true })} icon={Wallet} tone="success" />
        <StatTile label="Other income" value={formatMoney(totalIncome, { compact: true })} icon={TrendingUp} tone="info" />
        <StatTile label="Expenses (paid)" value={formatMoney(totalExpense, { compact: true })} icon={Receipt} tone="neutral" />
        <StatTile label="Net cash flow" value={formatMoney(netCashFlow, { compact: true })} tone={netCashFlow.minorUnits >= 0 ? "success" : "error"} />
      </div>

      {pendingApprovals > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-warning/30 bg-warning/8 p-sm text-sm text-warning">
          <span>
            {pendingApprovals} expense{pendingApprovals === 1 ? "" : "s"} pending approval
          </span>
          <Link href="/accounting/expenses" className="underline underline-offset-2">
            Review
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2 lg:grid-cols-3">
        {quickLinks.map(({ href, label, description, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="surface-3d flex items-center gap-sm rounded-lg border border-border bg-surface p-md outline-none transition-transform focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:-translate-y-0.5"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Icon className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{label}</p>
              <p className="truncate text-xs text-muted-foreground">{description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
