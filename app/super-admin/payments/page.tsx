"use client";

import { useMemo, useState } from "react";
import { CreditCard } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useSisStore } from "@/lib/hooks/use-store";
import { paymentStatusLabels, paymentStatusTone, type PaymentStatus } from "@/lib/types/saas";
import { formatMinor } from "@/lib/finance/format-minor";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

const STATUSES: (PaymentStatus | "all")[] = ["all", "successful", "pending", "failed", "refunded"];

export default function PaymentsPage() {
  const db = useSisStore();
  const [status, setStatus] = useState<PaymentStatus | "all">("all");
  const tenantName = (id: string) => db.saas.tenants.find((t) => t.id === id)?.name ?? id;
  const rows = useMemo(() => [...db.saas.payments].filter((p) => (status === "all" ? true : p.status === status)).sort((a, b) => b.date.localeCompare(a.date)), [db.saas.payments, status]);

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div><h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><CreditCard className="size-5 text-primary" /> Payments</h1><p className="text-xs text-muted-foreground">{rows.length} records · no real payment gateway</p></div>
      <div className="flex flex-wrap gap-1">{STATUSES.map((s) => <button key={s} type="button" onClick={() => setStatus(s)} className={cn("rounded-pill px-2.5 py-1 text-xs font-medium transition", status === s ? "bg-primary text-primary-foreground" : "bg-surface-secondary text-muted-foreground hover:text-foreground")}>{s === "all" ? "All" : paymentStatusLabels[s]}</button>)}</div>

      <div className="flex flex-col gap-xs">
        {rows.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm text-sm">
            <div className="min-w-0"><p className="truncate font-medium text-foreground">{tenantName(p.tenantId)}</p><p className="truncate text-xs text-muted-foreground">{p.invoiceNumber} · {p.method} · {formatDate(p.date)}</p></div>
            <span className="flex items-center gap-2"><span className="text-foreground">{formatMinor(p.amountMinor)}</span><Badge tone={paymentStatusTone[p.status]}>{paymentStatusLabels[p.status]}</Badge></span>
          </div>
        ))}
        {rows.length === 0 && <div className="rounded-lg border border-dashed border-border p-2xl text-center text-sm text-muted-foreground">No payments.</div>}
      </div>
    </div>
  );
}
