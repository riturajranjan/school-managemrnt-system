"use client";

// Real PostgreSQL/API cutover (Phase 9F) — POSTs to /api/fees/payments.
// Charges come from the real ledger (GET /api/fees/students/[id]/ledger);
// overpayment is rejected server-side (PAYMENT_EXCEEDS_OUTSTANDING) — the
// mock's "allow advance"/credit-balance affordances had no real backing and
// are dropped, not faked.
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AlertTriangle, CheckCircle2, Keyboard, Printer, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useStudentDetail, useStudentList } from "@/lib/hooks/api/use-students";
import { recordFeePaymentRequest, useStudentFeeLedger } from "@/lib/hooks/api/use-fees-api";
import type { FeePaymentMethodDto } from "@/lib/api/contracts";
import { formatCurrency, formatDate } from "@/lib/utils";

const methodLabels: Record<FeePaymentMethodDto, string> = { cash: "Cash", upi: "UPI", card: "Card", bank_transfer: "Bank transfer", cheque: "Cheque", other: "Other" };
const methodShortcuts: FeePaymentMethodDto[] = ["cash", "upi", "card", "bank_transfer", "cheque"];

function CollectionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const studentId = searchParams.get("studentId") ?? "";
  const { data: student } = useStudentDetail(studentId || undefined);
  const { data: ledger, reload: reloadLedger } = useStudentFeeLedger(studentId || null);
  const { can } = usePermissions();
  const canRecord = can("fees.collect");

  const [cashierMode, setCashierMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { data: searchList } = useStudentList({ search: searchQuery.trim() || undefined, pageSize: 15, status: ["active"] });
  const [selectedIds, setSelectedIds] = useState<Set<string> | null>(null);
  const [amountOverride, setAmountOverride] = useState<string | null>(null);
  const [method, setMethod] = useState<FeePaymentMethodDto>("cash");
  const [reference, setReference] = useState("");
  const [chequeNumber, setChequeNumber] = useState("");
  const [chequeDate, setChequeDate] = useState("");
  const [bankName, setBankName] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<{ receiptNumber: string; amount: string; paymentId: string } | null>(null);

  if (!studentId || !student) {
    return (
      <div className="flex flex-col gap-md pb-20 sm:pb-0">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Record payment</h1>
          <p className="text-xs text-muted-foreground">Search for a student to begin</p>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input autoFocus value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Student name or admission number" className="pl-9" />
        </div>
        <div className="flex flex-col gap-sm">
          {searchList.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => router.push(`/fees/collection/new?studentId=${s.id}`)}
              className="surface-3d flex items-center justify-between rounded-lg border border-border bg-surface p-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="text-sm text-foreground">
                {s.firstName} {s.lastName}
              </span>
              <span className="text-xs text-muted-foreground">{s.admissionNumber}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const charges = (ledger?.charges ?? []).filter((c) => c.status !== "paid").sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));
  const activeSelection = selectedIds ?? new Set(charges.map((c) => c.id));
  const selectedCharges = charges.filter((c) => activeSelection.has(c.id));
  const outstanding = charges.reduce((s, c) => s + c.balance, 0);
  const overdue = charges.filter((c) => c.status === "overdue").reduce((s, c) => s + c.balance, 0);
  const nextDue = charges[0];
  const selectedOutstanding = selectedCharges.reduce((s, c) => s + c.balance, 0);
  const amount = amountOverride !== null ? Number(amountOverride) || 0 : selectedOutstanding;

  function toggleCharge(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev ?? charges.map((c) => c.id));
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function resetForm() {
    setSelectedIds(null);
    setAmountOverride(null);
    setReference("");
    setChequeNumber("");
    setChequeDate("");
    setBankName("");
    setNotes("");
    setErrors([]);
  }

  async function handleRecord() {
    setErrors([]);
    if (activeSelection.size === 0) return setErrors(["Select at least one fee item."]);
    // Distribute the (possibly overridden) amount across selected charges, capped at each charge's balance.
    let remaining = amount;
    const allocations: { chargeId: string; amount: number }[] = [];
    for (const c of selectedCharges) {
      if (remaining <= 0) break;
      const alloc = Math.min(remaining, c.balance);
      if (alloc > 0) allocations.push({ chargeId: c.id, amount: Math.round(alloc * 100) / 100 });
      remaining -= alloc;
    }
    if (allocations.length === 0) return setErrors(["Enter a payment amount greater than zero."]);

    setSaving(true);
    const res = await recordFeePaymentRequest({
      studentId, allocations, method, reference: reference || undefined,
      chequeNumber: (method === "cheque" ? chequeNumber : "") || undefined, chequeDate: (method === "cheque" ? chequeDate : "") || undefined,
      bankName: (method === "cheque" || method === "bank_transfer" ? bankName : "") || undefined, notes: notes || undefined,
    });
    setSaving(false);
    if (!res.success) return setErrors([res.error.message]);
    setSuccess({ receiptNumber: res.data.receiptNumber, amount: formatCurrency(res.data.amount), paymentId: res.data.id });
    reloadLedger();
  }

  if (success) {
    return (
      <div className="flex flex-col items-center gap-md py-2xl text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-success/12 text-success">
          <CheckCircle2 className="size-7" />
        </span>
        <div>
          <p className="text-lg font-semibold text-foreground">Payment recorded</p>
          <p className="text-sm text-muted-foreground">
            {success.amount} · Receipt {success.receiptNumber}
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-sm">
          <Button asChild size="sm">
            <Link href={`/fees/receipts/${success.paymentId}`}>View receipt</Link>
          </Button>
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            <Printer className="size-3.5" />
            Print
          </Button>
          <Button size="sm" variant="outline" onClick={() => { resetForm(); setSuccess(null); }}>
            New payment
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link href={`/students/${studentId}/fees`}>Back to student</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-md pb-28 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">
            Record payment — {student.firstName} {student.lastName}
          </h1>
          <p className="text-xs text-muted-foreground">
            {student.admissionNumber} · {student.classLabel ?? "—"}
          </p>
        </div>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Keyboard className="size-3.5" />
          Cashier mode
          <Switch checked={cashierMode} onCheckedChange={setCashierMode} />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-surface p-sm">
          <p className="text-xs text-muted-foreground">Outstanding</p>
          <p className="text-sm font-semibold text-foreground">{formatCurrency(outstanding)}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-sm">
          <p className="text-xs text-muted-foreground">Overdue</p>
          <p className={`text-sm font-semibold ${overdue > 0 ? "text-error" : "text-foreground"}`}>{formatCurrency(overdue)}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-sm">
          <p className="text-xs text-muted-foreground">Next due</p>
          <p className="text-sm font-semibold text-foreground">{nextDue ? formatDate(nextDue.dueDate) : "—"}</p>
        </div>
      </div>

      {errors.length > 0 && (
        <div className="flex flex-col gap-1 rounded-lg border border-error/30 bg-error/8 p-sm text-xs text-error">
          <p className="flex items-center gap-1 font-medium">
            <AlertTriangle className="size-3.5" /> Fix these before recording
          </p>
          {errors.map((e, i) => (
            <p key={i}>{e}</p>
          ))}
        </div>
      )}

      <div className="rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm text-sm font-semibold text-foreground">Fee items ({selectedCharges.length} selected)</h2>
        {charges.length === 0 ? (
          <p className="text-sm text-muted-foreground">No outstanding fee items — this student is fully paid up.</p>
        ) : (
          <div className="flex flex-col gap-1">
            {charges.map((c) => (
              <label key={c.id} className="flex min-h-11 items-center gap-sm rounded-md border border-border px-sm py-1.5 text-sm">
                <Checkbox checked={activeSelection.has(c.id)} onCheckedChange={() => toggleCharge(c.id)} />
                <span className="min-w-0 flex-1 truncate text-foreground">{c.itemName || c.categoryName}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{formatDate(c.dueDate)}</span>
                <span className="shrink-0 font-medium text-foreground">{formatCurrency(c.balance)}</span>
                <Badge tone={c.status === "overdue" ? "error" : c.status === "partially_paid" ? "warning" : "neutral"}>{c.status.replace("_", " ")}</Badge>
              </label>
            ))}
          </div>
        )}
      </div>

      {cashierMode ? (
        <div className="rounded-lg border border-border bg-surface p-md">
          <p className="text-center text-3xl font-bold tabular-nums text-foreground">{formatCurrency(amount)}</p>
          <Input type="number" inputMode="decimal" className="mt-sm h-14 text-center text-xl" value={amountOverride ?? String(selectedOutstanding)} onChange={(e) => setAmountOverride(e.target.value)} aria-label="Payment amount" />
          <div className="mt-sm grid grid-cols-3 gap-1.5 sm:grid-cols-5">
            {methodShortcuts.map((m) => (
              <button key={m} type="button" onClick={() => setMethod(m)} className={`min-h-11 rounded-md border px-sm text-xs font-medium transition-colors ${method === m ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
                {methodLabels[m]}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-surface p-md">
          <h2 className="mb-sm text-sm font-semibold text-foreground">Payment details</h2>
          <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
            <div>
              <Label htmlFor="amount">Amount (₹)</Label>
              <Input id="amount" type="number" min={0} value={amountOverride ?? String(selectedOutstanding)} onChange={(e) => setAmountOverride(e.target.value)} />
            </div>
            <div>
              <Label>Method</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as FeePaymentMethodDto)}>
                <SelectTrigger aria-label="Payment method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(methodLabels) as FeePaymentMethodDto[]).map((m) => (
                    <SelectItem key={m} value={m}>
                      {methodLabels[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {method === "cheque" && (
            <div className="mt-sm grid grid-cols-1 gap-sm sm:grid-cols-3">
              <div>
                <Label htmlFor="cheque-number">Cheque number</Label>
                <Input id="cheque-number" value={chequeNumber} onChange={(e) => setChequeNumber(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="cheque-date">Cheque date</Label>
                <Input id="cheque-date" type="date" value={chequeDate} onChange={(e) => setChequeDate(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="bank-name">Bank name</Label>
                <Input id="bank-name" value={bankName} onChange={(e) => setBankName(e.target.value)} />
              </div>
            </div>
          )}
          {(method === "card" || method === "upi" || method === "bank_transfer") && (
            <div className="mt-sm">
              <Label htmlFor="txn-ref">Transaction reference</Label>
              <Input id="txn-ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UTR / transaction ID" />
            </div>
          )}

          <div className="mt-sm">
            <Label htmlFor="note">Note</Label>
            <Input id="note" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
          </div>
        </div>
      )}

      {canRecord && (
        <div className="sticky bottom-16 left-0 right-0 flex justify-end gap-sm rounded-lg border border-border bg-surface p-sm shadow-floating sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
          <Button variant="outline" onClick={() => router.push(`/students/${studentId}/fees`)}>
            Cancel
          </Button>
          <Button disabled={saving || charges.length === 0} onClick={handleRecord}>
            Record payment
          </Button>
        </div>
      )}
    </div>
  );
}

export default function FeeCollectionNewPage() {
  return (
    <Suspense fallback={<div className="h-40" />}>
      <CollectionContent />
    </Suspense>
  );
}
