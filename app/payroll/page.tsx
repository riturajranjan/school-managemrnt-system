"use client";

import Link from "next/link";
import { Banknote, CalendarClock, FileText, Gauge, HandCoins, History, Percent, Receipt, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { usePayrollRuns, usePayslips, useSalaryStructures } from "@/lib/hooks/use-finance";
import { formatMoney } from "@/lib/finance/money";

const quickLinks = [
  { href: "/payroll/structures", label: "Salary structures", description: "Earning and deduction components per employee", icon: Users },
  { href: "/payroll/run", label: "Run payroll", description: "Draft, review, approve and lock a monthly run", icon: HandCoins },
  { href: "/payroll/history", label: "Payroll history", description: "Every past run with its status and journal", icon: History },
  { href: "/payroll/payslips", label: "Payslips", description: "Generated payslips, one per employee per period", icon: FileText },
  { href: "/payroll/tax", label: "Tax summary", description: "Statutory deductions withheld per period", icon: Percent },
  { href: "/payroll/loans", label: "Loans", description: "Employee loans and monthly recovery schedule", icon: Banknote },
  { href: "/payroll/advances", label: "Advances", description: "Salary and emergency advances", icon: Receipt },
];

export default function PayrollHubPage() {
  const structures = useSalaryStructures();
  const runs = usePayrollRuns();
  const payslips = usePayslips();

  const activeStructures = structures.filter((s) => s.status === "active").length;
  const lastRun = [...runs].sort((a, b) => (a.period < b.period ? 1 : -1))[0];
  const pendingRuns = runs.filter((r) => r.status === "draft" || r.status === "calculating" || r.status === "review").length;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Payroll</h1>
          <p className="text-xs text-muted-foreground">Salary structures, monthly runs, payslips, loans and advances</p>
        </div>
        <Button asChild size="sm">
          <Link href="/payroll/dashboard">
            <Gauge className="size-3.5" />
            Dashboard
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Active structures" value={String(activeStructures)} icon={Users} tone="neutral" />
        <StatTile label="Last run" value={lastRun ? lastRun.period : "—"} icon={CalendarClock} tone="neutral" />
        <StatTile label="Last net pay" value={lastRun ? formatMoney(lastRun.totalNet, { compact: true }) : "—"} icon={HandCoins} tone="success" />
        <StatTile label="Runs pending" value={String(pendingRuns)} icon={History} tone={pendingRuns > 0 ? "warning" : "success"} />
      </div>

      <p className="text-xs text-muted-foreground">{payslips.length} payslip(s) generated to date.</p>

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
