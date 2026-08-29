"use client";

// UX simplification pass (see project brief) — restructures the Fees hub
// around the four things a school employee actually comes here to do,
// instead of listing every backend module as an equal card. No data,
// calculation, API or permission change: same useFeeDashboard/useDuesSummary/
// useStudentDues hooks the old hub and the Dues page already used.
import Link from "next/link";
import { useState } from "react";
import {
  AlertTriangle,
  Banknote,
  Bell,
  ChevronDown,
  HandCoins,
  Link2,
  Plus,
  Receipt,
  ScrollText,
  Settings,
  Users,
  Wallet,
} from "lucide-react";
import { StatTile } from "@/components/ui/stat-tile";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useDuesSummary, useFeeDashboard, useStudentDues } from "@/lib/hooks/api/use-fees-api";
import { roleLabels } from "@/lib/permissions/roles";
import { cn, formatCurrency } from "@/lib/utils";

const everydayTasks = [
  { href: "/fees/collection", label: "Collect Fee", description: "Record a student's payment.", icon: Wallet },
  { href: "/fees/students", label: "Student Fees", description: "Check a student's fees and payment history.", icon: Users },
  { href: "/fees/dues", label: "Pending Fees", description: "See students who still need to pay.", icon: AlertTriangle },
  { href: "/fees/receipts", label: "Receipts", description: "Find or download payment receipts.", icon: Receipt },
];

const moreTools = [
  { href: "/fees/refunds", label: "Refunds", description: "Money returned to a student.", icon: HandCoins },
  { href: "/fees/reconciliation", label: "Payment Matching", description: "Compare received payments with your records.", icon: Banknote },
  { href: "/fees/reminders", label: "Fee Reminders", description: "Follow up with students who owe fees.", icon: Bell },
  { href: "/fees/payment-links", label: "Online Payments", description: "Accept fee payments online.", icon: Link2 },
  { href: "/fees/reports", label: "Fee Reports", description: "Collection, dues and adjustment reports.", icon: ScrollText },
];

export default function FeesHubPage() {
  const { can, hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data, loading, error } = useFeeDashboard();
  const { data: duesSummary } = useDuesSummary();
  const { data: pendingRows } = useStudentDues();
  const canManage = can("fees.manage");
  const [moreOpen, setMoreOpen] = useState(false);

  if (!capabilitiesLoading && !hasServerPermission("fees.view")) return <PermissionDenied action="view the fees module" role={roleLabels[role]} backHref="/" />;

  const pendingCount = pendingRows?.length ?? null;
  const overdueCount = duesSummary?.studentsOverdue ?? null;

  return (
    <div className="flex flex-col gap-lg pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Fees</h1>
          <p className="text-xs text-muted-foreground">Manage student fees, payments and pending dues.</p>
        </div>
        <Link
          href="/fees/collection"
          className="flex min-h-10 items-center justify-center gap-xs rounded-md bg-primary px-md text-sm font-medium text-primary-foreground shadow-card outline-none transition-colors hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Plus className="size-4" />
          Collect Fee
        </Link>
      </div>

      {error && <p className="rounded-md border border-error/30 bg-error/8 p-sm text-sm text-error">{error}</p>}

      {/* Money summary */}
      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile
          label="Collected Today"
          value={data ? formatCurrency(data.collectedToday) : loading ? "…" : "—"}
          hint={data && data.collectedToday === 0 ? "No payments today" : undefined}
          icon={Wallet}
          tone="success"
        />
        <StatTile label="This Month" value={data ? formatCurrency(data.collectedThisMonth) : loading ? "…" : "—"} icon={ScrollText} tone="neutral" />
        <StatTile
          label="Pending Fees"
          value={data ? formatCurrency(data.outstanding) : loading ? "…" : "—"}
          hint={pendingCount === null ? undefined : pendingCount === 0 ? "No pending fees" : `${pendingCount} student${pendingCount === 1 ? "" : "s"} pending`}
          tone="neutral"
        />
        <StatTile
          label="Overdue"
          value={data ? formatCurrency(data.overdue) : loading ? "…" : "—"}
          hint={overdueCount === null ? undefined : overdueCount === 0 ? "No overdue students" : `${overdueCount} student${overdueCount === 1 ? "" : "s"} overdue`}
          icon={AlertTriangle}
          tone={data && data.overdue > 0 ? "error" : "success"}
        />
      </div>

      {/* Everyday tasks */}
      <div>
        <h2 className="text-sm font-semibold text-foreground">Everyday Tasks</h2>
        <p className="text-xs text-muted-foreground">Common fee activities you may need today.</p>
        <div className="mt-sm grid grid-cols-1 gap-sm sm:grid-cols-2 lg:grid-cols-4">
          {everydayTasks.map(({ href, label, description, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="surface-3d flex flex-col gap-sm rounded-xl border border-border bg-surface p-md outline-none transition-transform focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:-translate-y-0.5"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground">{description}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Fee setup — configuration, deliberately smaller and manage-only */}
      {canManage && (
        <div>
          <h2 className="text-sm font-semibold text-foreground">Fee Setup</h2>
          <p className="text-xs text-muted-foreground">Set fee amounts, types and student assignments.</p>
          <Link
            href="/fees/setup"
            className="surface-3d mt-sm flex items-center gap-sm rounded-lg border border-border bg-surface p-sm outline-none transition-colors [@media(hover:hover)]:hover:bg-surface-secondary/60 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-secondary text-muted-foreground">
              <Settings className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Configure fees</p>
              <p className="truncate text-xs text-muted-foreground">Fee types, fee structure, assignments, discounts and late fee rules</p>
            </div>
          </Link>
        </div>
      )}

      {/* Progressive disclosure — advanced tools stay out of the way until asked for */}
      <div>
        <button
          type="button"
          onClick={() => setMoreOpen((v) => !v)}
          className="flex items-center gap-xs text-sm font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-expanded={moreOpen}
        >
          <ChevronDown className={cn("size-4 transition-transform", moreOpen && "rotate-180")} />
          More Fee Tools
        </button>
        {moreOpen && (
          <div className="mt-sm grid grid-cols-1 gap-xs sm:grid-cols-2 lg:grid-cols-3">
            {moreTools.map(({ href, label, description, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-sm rounded-md border border-border bg-surface px-sm py-2 text-sm outline-none transition-colors [@media(hover:hover)]:hover:bg-surface-secondary/60 focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Icon className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{label}</p>
                  <p className="truncate text-xs text-muted-foreground">{description}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
