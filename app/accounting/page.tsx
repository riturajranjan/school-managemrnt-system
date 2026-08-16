"use client";

// Real PostgreSQL/API cutover (Phase 9G) — header stats now read
// GET /api/accounting/dashboard (ledger-derived) and the real Phase 9F Fees
// dashboard for fee income, instead of the mock db.incomes/db.expenses/
// db.payments store. Vendors, Purchase Orders and Budgets stay on their
// existing mock pages — out of this phase's scope (no real backend; see the
// final report's Deferred Items) — their quick-link cards are unchanged.
import Link from "next/link";
import { BookOpen, Boxes, Calculator, ClipboardList, Gauge, Landmark, PiggyBank, Receipt, ScrollText, Store, TrendingUp, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { useAccountingDashboard } from "@/lib/hooks/api/use-accounting-api";
import { useFeeDashboard } from "@/lib/hooks/api/use-fees-api";
import { formatCurrency } from "@/lib/utils";

const quickLinks = [
  { href: "/accounting/income", label: "Income", description: "Donations, grants, sponsorships and other income", icon: TrendingUp },
  { href: "/accounting/expenses", label: "Expenses", description: "Record school expenses", icon: Receipt },
  { href: "/accounting/vendors", label: "Vendors", description: "Vendor directory and categories", icon: Store },
  { href: "/accounting/purchase-orders", label: "Purchase orders", description: "PO workflow linked to expenses", icon: ClipboardList },
  { href: "/accounting/accounts", label: "Chart of accounts", description: "Asset, liability, income and expense accounts", icon: Boxes },
  { href: "/accounting/journals", label: "Journals", description: "Every posted double-entry journal", icon: BookOpen },
  { href: "/accounting/ledger", label: "Ledger", description: "Running balance per account", icon: ScrollText },
  { href: "/accounting/bank-reconciliation", label: "Bank & cash", description: "Real asset-account balances", icon: Landmark },
  { href: "/accounting/budgets", label: "Budgets", description: "Planned vs actual by category", icon: PiggyBank },
  { href: "/accounting/reports", label: "Reports", description: "Income statement and trial balance", icon: Calculator },
];

export default function AccountingHubPage() {
  const { data: accounting } = useAccountingDashboard();
  const { data: fees } = useFeeDashboard();

  const netCashFlow = accounting ? accounting.netIncome + (fees?.collectedThisMonth ?? 0) : null;

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
        <StatTile label="Fee income (this month)" value={fees ? formatCurrency(fees.collectedThisMonth) : "—"} icon={Wallet} tone="success" />
        <StatTile label="Other income (MTD)" value={accounting ? formatCurrency(accounting.totalIncome) : "—"} icon={TrendingUp} tone="info" />
        <StatTile label="Expenses (MTD)" value={accounting ? formatCurrency(accounting.totalExpense) : "—"} icon={Receipt} tone="neutral" />
        <StatTile label="Net cash flow (MTD)" value={netCashFlow !== null ? formatCurrency(netCashFlow) : "—"} tone={netCashFlow !== null && netCashFlow >= 0 ? "success" : "error"} />
      </div>

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
