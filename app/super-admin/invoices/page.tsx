"use client";

// Real invoice directory (Super Admin SA-4D). Reads GET /api/super-admin/invoices;
// generate/issue/void/mark-paid hit the real endpoints. No mock store, no fake
// delays. Invoices are generated from real Subscriptions.
import { useState } from "react";
import { Receipt, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import Link from "next/link";
import {
  useInvoiceList,
  useInvoice,
  generateInvoiceRequest,
  issueInvoiceRequest,
  voidInvoiceRequest,
} from "@/lib/hooks/api/use-billing";
import { useSubscriptionList } from "@/lib/hooks/api/use-subscriptions";
import { formatPlanPrice } from "@/lib/hooks/api/use-plans";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { usePermissions } from "@/components/providers/permissions-provider";
import { invoiceStateLabel, invoiceStateTone } from "@/lib/plans/invoice-status";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

const STATUSES = ["all", "draft", "open", "overdue", "paid", "void"] as const;

export default function InvoicesPage() {
  const { can } = usePermissions();
  const manage = can("platform.invoices.manage");
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, 250);
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [genSub, setGenSub] = useState("");

  const { data: rows, meta, loading, error, reload } = useInvoiceList({ pageSize: 100, search: debounced || undefined, status, sort: "createdAt", order: "desc" });
  const detail = useInvoice(openId ?? undefined);
  const billable = useSubscriptionList({ status: "active", pageSize: 100 });

  async function act(id: string, fn: () => Promise<{ success: boolean; error?: { message: string } }>, okText: string) {
    setMsg(null);
    setBusyId(id);
    const res = await fn();
    setBusyId(null);
    if (!res.success) return setMsg({ tone: "error", text: res.error?.message ?? "Action failed" });
    setMsg({ tone: "success", text: okText });
    reload();
    if (openId === id) detail.reload();
  }

  async function generate() {
    if (!genSub) return setMsg({ tone: "error", text: "Select a subscription to invoice." });
    setMsg(null);
    setBusyId("__gen__");
    const res = await generateInvoiceRequest(genSub);
    setBusyId(null);
    if (!res.success) return setMsg({ tone: "error", text: res.error?.message ?? "Generation failed" });
    setMsg({ tone: "success", text: `Invoice ${res.data.invoiceNumber} generated (draft).` });
    setGenSub("");
    reload();
  }

  const inv = detail.data;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Receipt className="size-5 text-primary" /> Invoices
          </h1>
          <p className="text-xs text-muted-foreground">{meta ? `${meta.total} invoices` : "…"}</p>
        </div>
        {manage && (
          <div className="flex items-center gap-xs">
            <select value={genSub} onChange={(e) => setGenSub(e.target.value)} aria-label="Subscription to invoice" className="h-8 max-w-[220px] rounded-md border border-border bg-surface px-2 text-xs text-foreground">
              <option value="">Select subscription…</option>
              {billable.data.map((s) => (
                <option key={s.id} value={s.id}>{s.school.name} · {s.plan.name}</option>
              ))}
            </select>
            <Button size="sm" disabled={busyId === "__gen__"} onClick={generate}>
              <Plus className="size-3.5" /> Generate
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-sm sm:flex-row sm:items-center">
        {/* <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search invoice #, school, tenant…"
          aria-label="Search invoices"
          className="w-full rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary sm:max-w-xs"
        /> */}
        <div className="flex flex-wrap gap-1">
          {STATUSES.map((s) => (
            <button key={s} type="button" onClick={() => setStatus(s)} className={cn("rounded-pill px-2.5 py-1 text-xs font-medium transition", status === s ? "bg-primary text-primary-foreground" : "bg-surface-secondary text-muted-foreground hover:text-foreground")}>
              {s === "all" ? "All" : invoiceStateLabel(s)}
            </button>
          ))}
        </div>
      </div>

      {msg && (
        <p className={msg.tone === "success" ? "rounded-md border border-success/30 bg-success/8 p-sm text-xs text-success" : "rounded-md border border-error/30 bg-error/10 p-sm text-xs text-error"}>{msg.text}</p>
      )}

      {error ? (
        <div className="rounded-lg border border-error/30 bg-error/5 p-md text-sm text-error" role="alert">
          Could not load invoices: {error}
          <Button variant="outline" size="sm" className="ml-sm" onClick={reload}>Retry</Button>
        </div>
      ) : loading && rows.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-2xl text-center text-sm text-muted-foreground">Loading invoices…</div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-2xl text-center text-sm text-muted-foreground">No invoices match your filters.</div>
      ) : (
        <div className="flex flex-col gap-xs">
          {rows.map((i) => {
            const busy = busyId === i.id;
            return (
              <div key={i.id} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm text-sm">
                <button type="button" onClick={() => setOpenId(i.id)} className="min-w-0 flex-1 text-left">
                  <p className="truncate font-medium text-foreground">{i.invoiceNumber}</p>
                  <p className="truncate text-xs text-muted-foreground">{i.school.name} · {i.subscription.planName} · due {formatDate(i.dueAt)}</p>
                </button>
                <span className="flex items-center gap-2">
                  <span className="hidden text-foreground sm:inline">{formatPlanPrice(i.totalAmount, i.currency)}</span>
                  <Badge tone={invoiceStateTone(i.derivedState)}>{invoiceStateLabel(i.derivedState)}</Badge>
                  {manage && i.status === "draft" && (
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => act(i.id, () => issueInvoiceRequest(i.id), `Invoice ${i.invoiceNumber} issued.`)}>Issue</Button>
                  )}
                  {manage && (i.status === "draft" || i.status === "open") && (
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => act(i.id, () => voidInvoiceRequest(i.id), `Invoice ${i.invoiceNumber} voided.`)}>Void</Button>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <DetailDrawer open={Boolean(openId)} onOpenChange={(o) => !o && setOpenId(null)} title={inv ? inv.invoiceNumber : "Invoice"} description={inv ? inv.school.name : ""}>
        {inv && (
          <div className="rounded-md bg-white p-md text-neutral-900 shadow-sm ring-1 ring-black/10">
            <div className="mb-3 flex items-center justify-between border-b border-neutral-200 pb-2">
              <div>
                <p className="text-sm font-bold">Novyra — Platform</p>
                <p className="text-[10px] text-neutral-500">Subscription invoice</p>
              </div>
              <span className="rounded px-2 py-0.5 text-[10px] font-medium" style={{ background: inv.derivedState === "paid" ? "#dcfce7" : inv.derivedState === "overdue" ? "#fee2e2" : "#e0f2fe", color: inv.derivedState === "paid" ? "#166534" : inv.derivedState === "overdue" ? "#991b1b" : "#075985" }}>{invoiceStateLabel(inv.derivedState)}</span>
            </div>
            <div className="mb-2 grid grid-cols-2 gap-1 text-[11px]">
              <span className="text-neutral-500">Invoice</span><span className="text-right">{inv.invoiceNumber}</span>
              <span className="text-neutral-500">School</span><span className="text-right">{inv.school.name}</span>
              <span className="text-neutral-500">Tenant</span><span className="text-right">{inv.tenant.name}</span>
              <span className="text-neutral-500">Period</span><span className="text-right">{formatDate(inv.periodStart)} – {formatDate(inv.periodEnd)}</span>
              <span className="text-neutral-500">Due</span><span className="text-right">{formatDate(inv.dueAt)}</span>
              {inv.issuedAt && (<><span className="text-neutral-500">Issued</span><span className="text-right">{formatDate(inv.issuedAt)}</span></>)}
              {inv.paidAt && (<><span className="text-neutral-500">Paid</span><span className="text-right">{formatDate(inv.paidAt)}</span></>)}
            </div>
            <table className="w-full text-[11px]">
              <tbody>
                {inv.lineItems.map((it) => (
                  <tr key={it.id} className="border-t border-neutral-100"><td className="py-1">{it.description}{it.quantity > 1 ? ` × ${it.quantity}` : ""}</td><td className="py-1 text-right">{formatPlanPrice(it.amount, inv.currency)}</td></tr>
                ))}
                <tr className="border-t border-neutral-100"><td className="py-1 text-neutral-500">Subtotal</td><td className="py-1 text-right">{formatPlanPrice(inv.subtotal, inv.currency)}</td></tr>
                <tr><td className="py-1 text-neutral-500">Tax</td><td className="py-1 text-right">{formatPlanPrice(inv.taxAmount, inv.currency)}</td></tr>
                {inv.discountAmount > 0 && <tr><td className="py-1 text-neutral-500">Discount</td><td className="py-1 text-right">−{formatPlanPrice(inv.discountAmount, inv.currency)}</td></tr>}
                <tr className="border-t border-neutral-300 font-bold"><td className="py-1">Total</td><td className="py-1 text-right">{formatPlanPrice(inv.totalAmount, inv.currency)}</td></tr>
                <tr><td className="py-1 text-neutral-500">Amount due</td><td className="py-1 text-right">{formatPlanPrice(inv.amountDue, inv.currency)}</td></tr>
              </tbody>
            </table>
            {inv.payments.length > 0 && (
              <div className="mt-3 border-t border-neutral-200 pt-2">
                <p className="mb-1 text-[10px] font-semibold text-neutral-500">Payments received</p>
                {inv.payments.map((pay) => (
                  <div key={pay.id} className="flex items-center justify-between text-[11px]">
                    <span className={pay.status === "reversed" ? "text-neutral-400 line-through" : "text-neutral-700"}>{pay.paymentNumber} · {formatDate(pay.receivedAt)}</span>
                    <span className={pay.status === "reversed" ? "text-neutral-400 line-through" : "text-neutral-900"}>{formatPlanPrice(pay.amount, inv.currency)}</span>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-3 text-center text-[9px] text-neutral-400">No payment gateway — record settlements on the Payments page.</p>
          </div>
        )}
        {inv && (inv.derivedState === "open" || inv.derivedState === "overdue") && manage && (
          <div className="mt-sm rounded-md border border-border bg-surface p-sm text-xs text-muted-foreground">
            Outstanding {formatPlanPrice(inv.amountDue, inv.currency)} —{" "}
            <Link href="/super-admin/payments" className="text-primary">record a payment</Link>.
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}
