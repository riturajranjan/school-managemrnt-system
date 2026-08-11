"use client";

// Real payments ledger (Super Admin SA-4E). Payments are real DB rows settling
// invoices via /api/super-admin/payments. Record + reverse hit the real
// endpoints — no mock store, no fake transaction IDs, no localStorage.
import { useMemo, useState } from "react";
import { CreditCard, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePaymentList, usePayment, recordPaymentRequest, reversePaymentRequest } from "@/lib/hooks/api/use-payments";
import { useInvoiceList } from "@/lib/hooks/api/use-billing";
import { formatPlanPrice } from "@/lib/hooks/api/use-plans";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { usePermissions } from "@/components/providers/permissions-provider";
import { PAYMENT_METHODS, paymentMethodLabel, paymentStatusLabel, paymentStatusTone } from "@/lib/plans/payment-status";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

const STATUSES = ["all", "succeeded", "reversed"] as const;

export default function PaymentsPage() {
  const { can } = usePermissions();
  const manage = can("platform.payments.manage");
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, 250);
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [showForm, setShowForm] = useState(false);

  const { data: rows, meta, loading, error, reload } = usePaymentList({ pageSize: 100, search: debounced || undefined, status, sort: "receivedAt", order: "desc" });
  const detail = usePayment(openId ?? undefined);

  async function reverse(id: string) {
    setMsg(null);
    setBusyId(id);
    const res = await reversePaymentRequest(id);
    setBusyId(null);
    if (!res.success) return setMsg({ tone: "error", text: res.error?.message ?? "Reversal failed" });
    setMsg({ tone: "success", text: "Payment reversed; invoice re-opened." });
    reload();
    if (openId === id) detail.reload();
  }

  const p = detail.data;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <CreditCard className="size-5 text-primary" /> Payments
          </h1>
          <p className="text-xs text-muted-foreground">{meta ? `${meta.total} payments · manual ledger (no gateway)` : "…"}</p>
        </div>
        {manage && (
          <Button size="sm" onClick={() => setShowForm((v) => !v)}>
            <Plus className="size-3.5" /> Record payment
          </Button>
        )}
      </div>

      {showForm && manage && (
        <RecordPaymentForm
          onDone={(m) => {
            setMsg(m);
            setShowForm(false);
            reload();
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      <div className="flex flex-col gap-sm sm:flex-row sm:items-center">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search payment #, invoice #, reference, school…"
          aria-label="Search payments"
          className="w-full rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary sm:max-w-xs"
        />
        <div className="flex flex-wrap gap-1">
          {STATUSES.map((s) => (
            <button key={s} type="button" onClick={() => setStatus(s)} className={cn("rounded-pill px-2.5 py-1 text-xs font-medium transition", status === s ? "bg-primary text-primary-foreground" : "bg-surface-secondary text-muted-foreground hover:text-foreground")}>
              {s === "all" ? "All" : paymentStatusLabel(s)}
            </button>
          ))}
        </div>
      </div>

      {msg && (
        <p className={msg.tone === "success" ? "rounded-md border border-success/30 bg-success/8 p-sm text-xs text-success" : "rounded-md border border-error/30 bg-error/10 p-sm text-xs text-error"}>{msg.text}</p>
      )}

      {error ? (
        <div className="rounded-lg border border-error/30 bg-error/5 p-md text-sm text-error" role="alert">
          Could not load payments: {error}
          <Button variant="outline" size="sm" className="ml-sm" onClick={reload}>Retry</Button>
        </div>
      ) : loading && rows.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-2xl text-center text-sm text-muted-foreground">Loading payments…</div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-2xl text-center text-sm text-muted-foreground">No payments recorded yet.</div>
      ) : (
        <div className="flex flex-col gap-xs">
          {rows.map((row) => (
            <div key={row.id} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm text-sm">
              <button type="button" onClick={() => setOpenId(row.id)} className="min-w-0 flex-1 text-left">
                <p className="truncate font-medium text-foreground">{row.paymentNumber} · {row.school.name}</p>
                <p className="truncate text-xs text-muted-foreground">{row.invoice.invoiceNumber} · {paymentMethodLabel(row.method)} · {formatDate(row.receivedAt)}</p>
              </button>
              <span className="flex items-center gap-2">
                <span className="text-foreground">{formatPlanPrice(row.amount, row.currency)}</span>
                <Badge tone={paymentStatusTone(row.status)}>{paymentStatusLabel(row.status)}</Badge>
                {manage && row.status === "succeeded" && (
                  <Button size="sm" variant="ghost" disabled={busyId === row.id} onClick={() => reverse(row.id)}>Reverse</Button>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      <DetailDrawer open={Boolean(openId)} onOpenChange={(o) => !o && setOpenId(null)} title={p ? p.paymentNumber : "Payment"} description={p ? p.school.name : ""}>
        {p && (
          <div className="flex flex-col gap-sm text-sm">
            <div className="flex items-center justify-between">
              <Badge tone={paymentStatusTone(p.status)}>{paymentStatusLabel(p.status)}</Badge>
              <span className="text-lg font-semibold text-foreground">{formatPlanPrice(p.amount, p.currency)}</span>
            </div>
            <dl className="grid grid-cols-2 gap-y-1.5">
              <dt className="text-xs text-muted-foreground">Invoice</dt><dd className="text-right text-foreground">{p.invoice.invoiceNumber}</dd>
              <dt className="text-xs text-muted-foreground">Invoice due</dt><dd className="text-right text-foreground">{formatPlanPrice(p.invoice.amountDue, p.currency)}</dd>
              <dt className="text-xs text-muted-foreground">Method</dt><dd className="text-right text-foreground">{paymentMethodLabel(p.method)}</dd>
              <dt className="text-xs text-muted-foreground">Received</dt><dd className="text-right text-foreground">{formatDate(p.receivedAt)}</dd>
              {p.reference && (<><dt className="text-xs text-muted-foreground">Reference</dt><dd className="text-right text-foreground">{p.reference}</dd></>)}
              <dt className="text-xs text-muted-foreground">Tenant</dt><dd className="text-right text-foreground">{p.tenant.name}</dd>
              <dt className="text-xs text-muted-foreground">Plan</dt><dd className="text-right text-foreground">{p.subscription.planName}</dd>
              {p.recordedBy.name && (<><dt className="text-xs text-muted-foreground">Recorded by</dt><dd className="text-right text-foreground">{p.recordedBy.name}</dd></>)}
              {p.reversedAt && (<><dt className="text-xs text-muted-foreground">Reversed</dt><dd className="text-right text-foreground">{formatDate(p.reversedAt)}</dd></>)}
            </dl>
            {p.notes && <p className="rounded-md border border-border bg-surface-secondary/40 p-sm text-xs text-muted-foreground">{p.notes}</p>}
            {manage && p.status === "succeeded" && (
              <Button size="sm" variant="outline" disabled={busyId === p.id} onClick={() => reverse(p.id)}>Reverse payment</Button>
            )}
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}

function RecordPaymentForm({ onDone, onCancel }: { onDone: (m: { tone: "success" | "error"; text: string }) => void; onCancel: () => void }) {
  const [invoiceId, setInvoiceId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("bank-transfer");
  const [reference, setReference] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Only OPEN invoices with an outstanding balance are settleable.
  const { data: invoices } = useInvoiceList({ status: "open", pageSize: 100 });
  const options = useMemo(() => invoices.filter((i) => i.amountDue > 0), [invoices]);
  const selected = options.find((i) => i.id === invoiceId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!invoiceId) return setErr("Select an invoice.");
    const amt = Number(amount);
    if (!(amt > 0)) return setErr("Enter a valid amount.");
    setSubmitting(true);
    const res = await recordPaymentRequest({ invoiceId, amount: amt, method, reference: reference.trim() || undefined });
    setSubmitting(false);
    if (!res.success) return setErr(res.error.message);
    onDone({ tone: "success", text: `Payment ${res.data.paymentNumber} recorded (${res.data.invoice.status}).` });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
      {err && <p className="rounded-md border border-error/30 bg-error/10 p-sm text-xs text-error">{err}</p>}
      <div>
        <Label htmlFor="pf-invoice">Invoice *</Label>
        <select id="pf-invoice" value={invoiceId} onChange={(e) => { setInvoiceId(e.target.value); const inv = options.find((i) => i.id === e.target.value); if (inv) setAmount(String(inv.amountDue)); }} className="h-9 w-full rounded-md border border-border bg-surface px-2 text-sm text-foreground">
          <option value="">Select an open invoice…</option>
          {options.map((i) => (
            <option key={i.id} value={i.id}>{i.invoiceNumber} · {i.school.name} · due {formatPlanPrice(i.amountDue, i.currency)}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-1 gap-sm sm:grid-cols-3">
        <div>
          <Label htmlFor="pf-amount">Amount *{selected ? ` (due ${formatPlanPrice(selected.amountDue, selected.currency)})` : ""}</Label>
          <Input id="pf-amount" type="number" step="0.01" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="pf-method">Method</Label>
          <select id="pf-method" value={method} onChange={(e) => setMethod(e.target.value)} className="h-9 w-full rounded-md border border-border bg-surface px-2 text-sm text-foreground">
            {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{paymentMethodLabel(m)}</option>)}
          </select>
        </div>
        <div>
          <Label htmlFor="pf-ref">Reference</Label>
          <Input id="pf-ref" placeholder="UTR / cheque no." value={reference} onChange={(e) => setReference(e.target.value)} />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Partial payments are allowed; the invoice becomes Paid only when fully settled. No gateway — this records a manual/offline payment.</p>
      <div className="flex justify-end gap-sm">
        <Button type="button" variant="outline" disabled={submitting} onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={submitting}>{submitting ? "Recording…" : "Record payment"}</Button>
      </div>
    </form>
  );
}
