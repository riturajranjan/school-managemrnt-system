"use client";

import Link from "next/link";
import { useMemo } from "react";
import { AlertTriangle, Receipt, TrendingUp, Wallet } from "lucide-react";
import { StatTile } from "@/components/ui/stat-tile";
import { Button } from "@/components/ui/button";
import { useSisStore } from "@/lib/hooks/use-store";
import { saasSummary } from "@/lib/selectors/saas-brief";
import { formatMinor } from "@/lib/finance/format-minor";
import { formatDate } from "@/lib/utils";

export default function BillingPage() {
  const db = useSisStore();
  const summary = useMemo(() => saasSummary(db), [db]);
  const paidThisMonth = useMemo(() => { const m = new Date().toISOString().slice(0, 7); return db.saas.payments.filter((p) => p.status === "successful" && p.date.slice(0, 7) === m).reduce((s, p) => s + p.amountMinor, 0); }, [db.saas.payments]);
  const outstanding = useMemo(() => db.saas.invoices.filter((i) => i.status === "issued" || i.status === "overdue").reduce((s, i) => s + i.totalMinor, 0), [db.saas.invoices]);
  const failed = db.saas.payments.filter((p) => p.status === "failed").length;
  const upcoming = useMemo(() => [...db.saas.subscriptions].filter((s) => s.status === "active").sort((a, b) => a.renewalDate.localeCompare(b.renewalDate)).slice(0, 5), [db.saas.subscriptions]);
  const tenantName = (id: string) => db.saas.tenants.find((t) => t.id === id)?.name ?? id;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><Wallet className="size-5 text-primary" /> Billing</h1><p className="text-xs text-muted-foreground">Platform billing overview · frontend simulation</p></div>
        <div className="flex gap-xs"><Button asChild size="sm" variant="outline"><Link href="/super-admin/invoices"><Receipt className="size-3.5" /> Invoices</Link></Button><Button asChild size="sm" variant="outline"><Link href="/super-admin/payments">Payments</Link></Button></div>
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Mock MRR" value={formatMinor(summary.mrrMinor, { compact: true })} icon={TrendingUp} tone="success" />
        <StatTile label="Mock ARR" value={formatMinor(summary.arrMinor, { compact: true })} tone="success" />
        <StatTile label="Outstanding" value={formatMinor(outstanding, { compact: true })} tone={outstanding > 0 ? "warning" : "success"} />
        <StatTile label="Paid this month" value={formatMinor(paidThisMonth, { compact: true })} tone="info" />
        <StatTile label="Overdue invoices" value={String(summary.overdue)} icon={Receipt} tone={summary.overdue > 0 ? "error" : "success"} />
        <StatTile label="Trials ending" value={String(summary.trialSchools)} tone="info" />
        <StatTile label="Failed payments" value={String(failed)} icon={AlertTriangle} tone={failed > 0 ? "error" : "success"} />
        <StatTile label="Upcoming renewals" value={String(db.saas.subscriptions.filter((s) => s.status === "active").length)} tone="neutral" />
      </div>

      <section className="rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm text-sm font-semibold text-foreground">Upcoming renewals</h2>
        <div className="flex flex-col gap-xs">
          {upcoming.map((s) => <div key={s.id} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm text-sm"><span className="truncate text-foreground">{tenantName(s.tenantId)}</span><span className="text-xs text-muted-foreground">{formatMinor(s.priceMinor)} · {formatDate(s.renewalDate)}</span></div>)}
        </div>
      </section>
      <p className="rounded-md border border-border bg-surface-secondary/40 p-sm text-xs text-muted-foreground">No payment gateway is connected. All revenue figures are frontend mock data for demonstration.</p>
    </div>
  );
}
