"use client";

import { useMemo, useState } from "react";
import { Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { useSisStore } from "@/lib/hooks/use-store";
import { setInvoiceStatus } from "@/lib/services/saas-service";
import { invoiceStatusLabels, invoiceStatusTone, type InvoiceStatus } from "@/lib/types/saas";
import { DOC_BRANDING } from "@/lib/data/seed/documents";
import { formatMinor } from "@/lib/finance/format-minor";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

const STATUSES: (InvoiceStatus | "all")[] = ["all", "issued", "paid", "overdue", "draft", "cancelled", "refunded"];

export default function InvoicesPage() {
  const db = useSisStore();
  const [, force] = useState(0);
  const [status, setStatus] = useState<InvoiceStatus | "all">("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const tenantName = (id: string) => db.saas.tenants.find((t) => t.id === id)?.name ?? id;
  const rows = useMemo(() => [...db.saas.invoices].filter((i) => (status === "all" ? true : i.status === status)).sort((a, b) => b.number.localeCompare(a.number)), [db.saas.invoices, status]);
  const inv = rows.find((i) => i.id === openId) ?? db.saas.invoices.find((i) => i.id === openId) ?? null;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div><h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><Receipt className="size-5 text-primary" /> Invoices</h1><p className="text-xs text-muted-foreground">{rows.length} of {db.saas.invoices.length}</p></div>
      <div className="flex flex-wrap gap-1">{STATUSES.map((s) => <button key={s} type="button" onClick={() => setStatus(s)} className={cn("rounded-pill px-2.5 py-1 text-xs font-medium transition", status === s ? "bg-primary text-primary-foreground" : "bg-surface-secondary text-muted-foreground hover:text-foreground")}>{s === "all" ? "All" : invoiceStatusLabels[s]}</button>)}</div>

      <div className="flex flex-col gap-xs">
        {rows.map((i) => (
          <div key={i.id} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm text-sm">
            <button type="button" onClick={() => setOpenId(i.id)} className="min-w-0 flex-1 text-left"><p className="truncate font-medium text-foreground">{i.number}</p><p className="truncate text-xs text-muted-foreground">{tenantName(i.tenantId)} · {i.planName} · due {formatDate(i.dueDate)}</p></button>
            <span className="flex items-center gap-2"><span className="hidden text-foreground sm:inline">{formatMinor(i.totalMinor)}</span><Badge tone={invoiceStatusTone[i.status]}>{invoiceStatusLabels[i.status]}</Badge>{(i.status === "issued" || i.status === "overdue") && <Button size="sm" variant="outline" onClick={() => { setInvoiceStatus(i.id, "paid"); force((n) => n + 1); }}>Mark paid</Button>}</span>
          </div>
        ))}
      </div>

      <DetailDrawer open={Boolean(inv)} onOpenChange={(o) => !o && setOpenId(null)} title={inv ? inv.number : ""} description={inv ? tenantName(inv.tenantId) : ""}>
        {inv && (
          <div className="rounded-md bg-white p-md text-neutral-900 shadow-sm ring-1 ring-black/10">
            <div className="mb-3 flex items-center justify-between border-b border-neutral-200 pb-2"><div><p className="text-sm font-bold">{DOC_BRANDING.name} — Platform</p><p className="text-[10px] text-neutral-500">Subscription invoice</p></div><span className="rounded px-2 py-0.5 text-[10px] font-medium" style={{ background: inv.status === "paid" ? "#dcfce7" : inv.status === "overdue" ? "#fee2e2" : "#e0f2fe", color: inv.status === "paid" ? "#166534" : inv.status === "overdue" ? "#991b1b" : "#075985" }}>{invoiceStatusLabels[inv.status]}</span></div>
            <div className="mb-2 grid grid-cols-2 gap-1 text-[11px]"><span className="text-neutral-500">Invoice</span><span className="text-right">{inv.number}</span><span className="text-neutral-500">School</span><span className="text-right">{tenantName(inv.tenantId)}</span><span className="text-neutral-500">Period</span><span className="text-right">{formatDate(inv.periodStart)} – {formatDate(inv.periodEnd)}</span><span className="text-neutral-500">Due</span><span className="text-right">{formatDate(inv.dueDate)}</span></div>
            <table className="w-full text-[11px]"><tbody>{inv.items.map((it, k) => <tr key={k} className="border-t border-neutral-100"><td className="py-1">{it.label}</td><td className="py-1 text-right">{formatMinor(it.amountMinor)}</td></tr>)}<tr className="border-t border-neutral-100"><td className="py-1 text-neutral-500">Tax (18%)</td><td className="py-1 text-right">{formatMinor(inv.taxMinor)}</td></tr><tr className="border-t border-neutral-300 font-bold"><td className="py-1">Total</td><td className="py-1 text-right">{formatMinor(inv.totalMinor)}</td></tr></tbody></table>
            <p className="mt-3 text-center text-[9px] text-neutral-400">Mock invoice preview — no real PDF or payment.</p>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}
