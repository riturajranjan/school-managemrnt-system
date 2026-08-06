"use client";

import Link from "next/link";
import {
  AlertTriangle,
  Award,
  Banknote,
  Bell,
  ClipboardList,
  Coins,
  FileStack,
  Gauge,
  Gift,
  HandCoins,
  Link2,
  Receipt,
  RefreshCcw,
  Scale,
  ScrollText,
  Tags,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { useSisStore } from "@/lib/hooks/use-store";
import { formatMoney, sumMoney } from "@/lib/finance/money";
import { totalOverdue as computeTotalOverdue } from "@/lib/selectors/fee-item-insights";
import { CURRENT_SESSION } from "@/lib/data/seed/reference";

const quickLinks = [
  { href: "/fees/structures", label: "Fee structures", description: "Components, installments and rules per class", icon: FileStack },
  { href: "/fees/categories", label: "Fee categories", description: "Manage the fee-component registry", icon: Tags },
  { href: "/fees/assignments", label: "Assignments", description: "Bill students against a structure", icon: ClipboardList },
  { href: "/fees/collection", label: "Collection", description: "Record payments and issue receipts", icon: Wallet },
  { href: "/fees/dues", label: "Dues & overdue", description: "Aging, risk and follow-up actions", icon: AlertTriangle },
  { href: "/fees/receipts", label: "Receipts", description: "Issued, cancelled and refunded receipts", icon: Receipt },
  { href: "/fees/discounts", label: "Discounts", description: "Sibling, merit and promotional discounts", icon: Coins },
  { href: "/fees/scholarships", label: "Scholarships", description: "Merit, need-based and sponsored awards", icon: Award },
  { href: "/fees/concessions", label: "Concessions", description: "Hardship and management-approved relief", icon: Gift },
  { href: "/fees/fines", label: "Late fees", description: "Configurable fine rules and waivers", icon: Scale },
  { href: "/fees/refunds", label: "Refunds", description: "Refund workflow and credit balances", icon: RefreshCcw },
  { href: "/fees/reconciliation", label: "Reconciliation", description: "Match payments against bank & gateway", icon: Banknote },
  { href: "/fees/reminders", label: "Reminders", description: "Automated dues and payment nudges", icon: Bell },
  { href: "/fees/payment-links", label: "Payment links", description: "Shareable online payment requests", icon: Link2 },
  { href: "/fees/reports", label: "Reports", description: "Collection, dues and aging reports", icon: ScrollText },
];

export default function FeesHubPage() {
  const db = useSisStore();

  const activeItems = db.studentFeeItems.filter((item) => item.status !== "cancelled");
  const totalBilled = sumMoney(
    activeItems.map((i) => i.billedAmount),
    "INR",
  );
  const totalCollected = sumMoney(
    activeItems.map((i) => i.paidAmount),
    "INR",
  );
  const totalOverdue = computeTotalOverdue(activeItems);
  const collectionRate = totalBilled.minorUnits === 0 ? 0 : Math.round((totalCollected.minorUnits / totalBilled.minorUnits) * 100);

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Fees</h1>
          <p className="text-xs text-muted-foreground">{CURRENT_SESSION} · Structures, collection, dues and every fee workflow</p>
        </div>
        <Button asChild size="sm">
          <Link href="/fees/dashboard">
            <Gauge className="size-3.5" />
            Finance Command Centre
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Total billed" value={formatMoney(totalBilled, { compact: true })} icon={ScrollText} tone="neutral" />
        <StatTile label="Collected" value={formatMoney(totalCollected, { compact: true })} icon={Wallet} tone="success" />
        <StatTile label="Collection rate" value={`${collectionRate}%`} icon={HandCoins} tone={collectionRate >= 80 ? "success" : collectionRate >= 60 ? "warning" : "error"} />
        <StatTile label="Overdue" value={formatMoney(totalOverdue, { compact: true })} icon={AlertTriangle} tone={totalOverdue.minorUnits > 0 ? "error" : "success"} />
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
