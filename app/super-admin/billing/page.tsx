"use client";

// Real billing overview (Super Admin SA-4D). Every figure is DB-derived via
// GET /api/super-admin/billing/summary + real subscription data. No mock revenue,
// no localStorage. Payment collection is a later phase, so payment-specific cards
// (paid-this-month / failed payments) are intentionally omitted here.
import Link from "next/link";
import { Receipt, TrendingUp, Wallet } from "lucide-react";
import { StatTile } from "@/components/ui/stat-tile";
import { Button } from "@/components/ui/button";
import { useBillingSummary } from "@/lib/hooks/api/use-billing";
import { useSubscriptionList } from "@/lib/hooks/api/use-subscriptions";
import { formatPlanPrice } from "@/lib/hooks/api/use-plans";
import { formatDate } from "@/lib/utils";

export default function BillingPage() {
  const { data: summary, loading, error, reload } = useBillingSummary();
  const upcoming = useSubscriptionList({ status: "active", pageSize: 5, sort: "currentPeriodEnd", order: "asc" });
  const money = (n: number) => formatPlanPrice(n, summary?.currency ?? "INR");

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Wallet className="size-5 text-primary" /> Billing
          </h1>
          <p className="text-xs text-muted-foreground">Real subscription revenue &amp; invoice totals</p>
        </div>
        <div className="flex gap-xs">
          <Button asChild size="sm" variant="outline"><Link href="/super-admin/invoices"><Receipt className="size-3.5" /> Invoices</Link></Button>
          <Button asChild size="sm" variant="outline"><Link href="/super-admin/subscriptions">Subscriptions</Link></Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-error/30 bg-error/5 p-md text-sm text-error" role="alert">
          Could not load billing summary: {error}
          <Button variant="outline" size="sm" className="ml-sm" onClick={reload}>Retry</Button>
        </div>
      ) : loading && !summary ? (
        <div className="rounded-lg border border-border bg-surface p-2xl text-center text-sm text-muted-foreground">Loading billing summary…</div>
      ) : summary ? (
        <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
          <StatTile label="MRR" value={money(summary.mrr)} icon={TrendingUp} tone="success" hint="Active subs, monthly-normalized" />
          <StatTile label="ARR" value={money(summary.arr)} tone="success" hint="MRR × 12" />
          <StatTile label="Outstanding" value={money(summary.outstandingAmount)} tone={summary.outstandingAmount > 0 ? "warning" : "success"} hint="Open invoices" />
          <StatTile label="Collected" value={money(summary.collectedAmount)} tone="info" hint="All-time payments" />
          <StatTile label="Active subs" value={String(summary.activeSubscriptions)} tone="info" />
          <StatTile label="Trialing" value={String(summary.trialingSubscriptions)} tone="info" />
          <StatTile label="Open invoices" value={String(summary.openInvoices)} icon={Receipt} tone="neutral" />
          <StatTile label="Overdue invoices" value={String(summary.overdueInvoices)} icon={Receipt} tone={summary.overdueInvoices > 0 ? "error" : "success"} />
        </div>
      ) : null}

      <section className="rounded-lg border border-border bg-surface p-md">
        <div className="mb-sm flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Upcoming renewals</h2>
          <Link href="/super-admin/subscriptions" className="text-xs text-primary">All subscriptions →</Link>
        </div>
        <div className="flex flex-col gap-xs">
          {upcoming.data.map((s) => (
            <Link key={s.id} href={`/super-admin/subscriptions/${s.id}`} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm text-sm transition hover:border-primary/40">
              <span className="truncate text-foreground">{s.school.name}</span>
              <span className="text-xs text-muted-foreground">{formatPlanPrice(s.price, s.currency)} · renews {formatDate(s.currentPeriodEnd)}</span>
            </Link>
          ))}
          {upcoming.data.length === 0 && !upcoming.loading && <p className="py-md text-center text-sm text-muted-foreground">No active subscriptions.</p>}
        </div>
      </section>

      <p className="rounded-md border border-border bg-surface-secondary/40 p-sm text-xs text-muted-foreground">
        No payment gateway is connected in this phase. Invoices can be settled manually (administrative), but no payments are collected — real collection is a later phase.
      </p>
    </div>
  );
}
