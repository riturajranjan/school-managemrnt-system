"use client";

// Real PostgreSQL/API cutover (Phase 9H, extended by the Production Payroll
// checkpoint). Loans/Advances are now real (StaffFinancialAdvance) — Tax
// stays an honest deferred stub, no statutory tax policy exists in this repo.
import Link from "next/link";
import { Banknote, CalendarClock, FileText, Gauge, HandCoins, History, Percent, Receipt, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { usePayrollDashboard } from "@/lib/hooks/api/use-payroll-api";
import { roleLabels } from "@/lib/permissions/roles";
import { formatCurrency } from "@/lib/utils";

const quickLinks = [
  { href: "/payroll/structures", label: "Salary structures", description: "Components, reusable structures and staff assignments", icon: Users },
  { href: "/payroll/run", label: "Run payroll", description: "Calculate, finalize and pay a monthly run", icon: HandCoins },
  { href: "/payroll/history", label: "Payroll history", description: "Every past run with its status", icon: History },
  { href: "/payroll/payslips", label: "Payslips", description: "Generated payslips, one per staff member per period", icon: FileText },
  { href: "/payroll/tax", label: "Tax summary", description: "Not available — no statutory tax policy configured", icon: Percent },
  { href: "/payroll/loans", label: "Loans", description: "Request, approve, disburse and recover staff loans", icon: Banknote },
  { href: "/payroll/advances", label: "Advances", description: "Single-amount staff salary advances", icon: Receipt },
];

export default function PayrollHubPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data } = usePayrollDashboard();
  if (!capabilitiesLoading && !hasServerPermission("payroll.view")) return <PermissionDenied action="view the payroll module" role={roleLabels[role]} backHref="/" />;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Payroll</h1>
          <p className="text-xs text-muted-foreground">Salary structures, monthly runs, payslips and payments</p>
        </div>
        <Button asChild size="sm">
          <Link href="/payroll/dashboard">
            <Gauge className="size-3.5" />
            Dashboard
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Active structures" value={String(data?.activeStructures ?? "—")} icon={Users} tone="neutral" />
        <StatTile label="Current period" value={data?.currentPeriod?.period ?? "—"} icon={CalendarClock} tone="neutral" />
        <StatTile label="Current period net" value={formatCurrency(data?.currentRunNet ?? 0)} icon={HandCoins} tone="success" />
        <StatTile label="Runs this year" value={String(data?.recentRuns.length ?? "—")} icon={History} tone="neutral" />
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
