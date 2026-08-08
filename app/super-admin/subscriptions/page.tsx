"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CreditCard } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useSisStore } from "@/lib/hooks/use-store";
import { subscriptionStatusLabels, subscriptionStatusTone, type SubscriptionStatus } from "@/lib/types/saas";
import { formatMinor } from "@/lib/finance/format-minor";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

const STATUSES: (SubscriptionStatus | "all")[] = ["all", "trial", "active", "past-due", "grace-period", "suspended", "cancelled", "expired"];

export default function SubscriptionsPage() {
  const db = useSisStore();
  const [status, setStatus] = useState<SubscriptionStatus | "all">("all");
  const tenantName = (id: string) => db.saas.tenants.find((t) => t.id === id)?.name ?? id;
  const planName = (id: string) => db.saas.plans.find((p) => p.id === id)?.name ?? id;
  const rows = useMemo(() => db.saas.subscriptions.filter((s) => (status === "all" ? true : s.status === status)), [db.saas.subscriptions, status]);

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div><h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><CreditCard className="size-5 text-primary" /> Subscriptions</h1><p className="text-xs text-muted-foreground">{rows.length} of {db.saas.subscriptions.length}</p></div>
      <div className="flex flex-wrap gap-1">{STATUSES.map((s) => <button key={s} type="button" onClick={() => setStatus(s)} className={cn("rounded-pill px-2.5 py-1 text-xs font-medium transition", status === s ? "bg-primary text-primary-foreground" : "bg-surface-secondary text-muted-foreground hover:text-foreground")}>{s === "all" ? "All" : subscriptionStatusLabels[s]}</button>)}</div>

      <div className="flex flex-col gap-xs">
        {rows.map((s) => (
          <Link key={s.id} href={`/super-admin/subscriptions/${s.id}`} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm text-sm transition hover:border-primary/40">
            <div className="min-w-0"><p className="truncate font-medium text-foreground">{tenantName(s.tenantId)}</p><p className="truncate text-xs text-muted-foreground">{planName(s.planId)} · {s.billingCycle} · renews {formatDate(s.renewalDate)}</p></div>
            <span className="flex items-center gap-2"><span className="hidden text-foreground sm:inline">{formatMinor(s.priceMinor)}</span><Badge tone={subscriptionStatusTone[s.status]}>{subscriptionStatusLabels[s.status]}</Badge></span>
          </Link>
        ))}
      </div>
    </div>
  );
}
