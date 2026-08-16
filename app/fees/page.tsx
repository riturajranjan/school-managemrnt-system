"use client";

// Real PostgreSQL/API cutover (Phase 9F) — reads GET /api/fees/dashboard.
// "Concessions" now points at Discounts (see app/fees/concessions/page.tsx);
// "Finance Command Centre" now points at the real Fee Reports page.
import Link from "next/link";
import {
  AlertTriangle,
  Award,
  Banknote,
  Bell,
  ClipboardList,
  Coins,
  FileStack,
  HandCoins,
  Link2,
  Receipt,
  Scale,
  ScrollText,
  Tags,
  Wallet,
} from "lucide-react";
import { StatTile } from "@/components/ui/stat-tile";
import { useFeeDashboard } from "@/lib/hooks/api/use-fees-api";
import { formatCurrency } from "@/lib/utils";

const quickLinks = [
  { href: "/fees/structures", label: "Fee structures", description: "Fee items and applicable classes per session", icon: FileStack },
  { href: "/fees/categories", label: "Fee categories", description: "Manage the fee-category registry", icon: Tags },
  { href: "/fees/assignments", label: "Assignments", description: "Bill students against a structure", icon: ClipboardList },
  { href: "/fees/collection", label: "Collection", description: "Record payments and issue receipts", icon: Wallet },
  { href: "/fees/dues", label: "Dues & overdue", description: "Aging and outstanding balances", icon: AlertTriangle },
  { href: "/fees/receipts", label: "Receipts", description: "Every fee payment recorded", icon: Receipt },
  { href: "/fees/discounts", label: "Discounts", description: "Sibling, merit and promotional discounts", icon: Coins },
  { href: "/fees/scholarships", label: "Scholarships", description: "Merit, need-based and sponsored awards", icon: Award },
  { href: "/fees/fines", label: "Late fees", description: "Apply late fees to overdue items", icon: Scale },
  { href: "/fees/refunds", label: "Refunds", description: "Refunds issued against real payments", icon: HandCoins },
  { href: "/fees/reconciliation", label: "Reconciliation", description: "Match payments against your records", icon: Banknote },
  { href: "/fees/reminders", label: "Reminders", description: "Overdue follow-up (manual — no delivery channel yet)", icon: Bell },
  { href: "/fees/payment-links", label: "Payment links", description: "Not available — no gateway configured", icon: Link2 },
  { href: "/fees/reports", label: "Reports", description: "Collection, dues and adjustment reports", icon: ScrollText },
];

export default function FeesHubPage() {
  const { data, loading, error } = useFeeDashboard();

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Fees</h1>
        <p className="text-xs text-muted-foreground">Structures, collection, dues and every fee workflow</p>
      </div>

      {error && <p className="rounded-md border border-error/30 bg-error/8 p-sm text-sm text-error">{error}</p>}

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Collected today" value={data ? formatCurrency(data.collectedToday) : loading ? "…" : "—"} icon={Wallet} tone="success" />
        <StatTile label="Collected this month" value={data ? formatCurrency(data.collectedThisMonth) : loading ? "…" : "—"} icon={ScrollText} tone="neutral" />
        <StatTile label="Outstanding" value={data ? formatCurrency(data.outstanding) : loading ? "…" : "—"} tone="neutral" />
        <StatTile label="Overdue" value={data ? formatCurrency(data.overdue) : loading ? "…" : "—"} icon={AlertTriangle} tone={data && data.overdue > 0 ? "error" : "success"} />
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
