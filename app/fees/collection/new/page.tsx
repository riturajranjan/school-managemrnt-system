"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AlertTriangle, CheckCircle2, Keyboard, Printer, Search, Send, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useManagedClasses } from "@/lib/hooks/use-academics";
import { useCreditBalances } from "@/lib/hooks/use-finance";
import { useStudent, useStudentGuardians, useStudents } from "@/lib/hooks/use-students";
import { useSisStore } from "@/lib/hooks/use-store";
import { formatMoney, moneyFromMajor, subtractMoney, sumMoney, toMajorUnits } from "@/lib/finance/money";
import { outstandingForItem, totalOutstanding, totalOverdue } from "@/lib/selectors/fee-item-insights";
import { recordPayment, applyCreditToPayment } from "@/lib/services/payment-service";
import { paymentMethodLabels, type PaymentMethod } from "@/lib/types/payments";
import { formatDate, generateId } from "@/lib/utils";

const ACTOR = { name: "Priya Nair", role: "Cashier" };
const methodShortcuts: PaymentMethod[] = ["cash", "upi", "card", "bank-transfer", "cheque"];

function CollectionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const studentId = searchParams.get("studentId") ?? "";
  const student = useStudent(studentId);
  const students = useStudents();
  const classes = useManagedClasses();
  const guardians = useStudentGuardians(studentId);
  const db = useSisStore();
  const credits = useCreditBalances(studentId);
  const { can } = usePermissions();
  const canRecord = can("fees.record");

  const [cashierMode, setCashierMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string> | null>(null);
  const [amountOverride, setAmountOverride] = useState<string | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [transactionReference, setTransactionReference] = useState("");
  const [chequeNumber, setChequeNumber] = useState("");
  const [chequeDate, setChequeDate] = useState("");
  const [bankName, setBankName] = useState("");
  const [note, setNote] = useState("");
  const [allowAdvance, setAllowAdvance] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [success, setSuccess] = useState<{ receiptNumber: string; amount: string; receiptId: string } | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState(() => generateId("idem"));

  if (!studentId || !student) {
    const results = searchQuery.trim()
      ? students
          .filter((s) => `${s.profile.firstName} ${s.profile.lastName}`.toLowerCase().includes(searchQuery.trim().toLowerCase()) || s.admissionNumber.toLowerCase().includes(searchQuery.trim().toLowerCase()))
          .slice(0, 15)
      : [];
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
          {results.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => router.push(`/fees/collection/new?studentId=${s.id}`)}
              className="surface-3d flex items-center justify-between rounded-lg border border-border bg-surface p-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="text-sm text-foreground">
                {s.profile.firstName} {s.profile.lastName}
              </span>
              <span className="text-xs text-muted-foreground">{s.admissionNumber}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const items = db.studentFeeItems.filter((i) => i.studentId === studentId && i.status !== "cancelled" && i.status !== "paid").sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));
  const activeSelection = selectedItemIds ?? new Set(items.map((i) => i.id));
  const selectedItems = items.filter((i) => activeSelection.has(i.id));
  const outstanding = totalOutstanding(items);
  const overdue = totalOverdue(items);
  const nextDue = items[0];
  const availableCredit = sumMoney(
    credits.map((c) => subtractMoney(c.amount, c.consumedAmount)),
    "INR",
  );
  const guardian = guardians[0];
  const className = classes.find((c) => c.id === student.classId)?.name ?? student.classId;

  const selectedOutstanding = totalOutstanding(selectedItems);
  const amount = amountOverride !== null ? moneyFromMajor(Number(amountOverride) || 0, "INR") : selectedOutstanding;

  function toggleItem(id: string) {
    setSelectedItemIds((prev) => {
      const next = new Set(prev ?? items.map((i) => i.id));
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function resetForm() {
    setSelectedItemIds(null);
    setAmountOverride(null);
    setTransactionReference("");
    setChequeNumber("");
    setChequeDate("");
    setBankName("");
    setNote("");
    setAllowAdvance(false);
    setErrors([]);
    setIdempotencyKey(generateId("idem"));
  }

  function handleRecord() {
    const result = recordPayment(
      {
        studentId,
        itemIds: [...activeSelection],
        amount,
        method,
        transactionReference: transactionReference || undefined,
        chequeNumber: chequeNumber || undefined,
        chequeDate: chequeDate || undefined,
        bankName: bankName || undefined,
        note: note || undefined,
        allowAdvance,
        branch: "main",
        cashierName: ACTOR.name,
        idempotencyKey,
      },
      ACTOR,
    );
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors([]);
    setSuccess({ receiptNumber: result.receipt.receiptNumber, amount: formatMoney(result.payment.amount), receiptId: result.receipt.id });
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
            <Link href={`/fees/receipts/${success.receiptId}`}>View receipt</Link>
          </Button>
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            <Printer className="size-3.5" />
            Print
          </Button>
          <Button size="sm" variant="outline" disabled>
            <Send className="size-3.5" />
            Send receipt
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              resetForm();
              setSuccess(null);
            }}
          >
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
            Record payment — {student.profile.firstName} {student.profile.lastName}
          </h1>
          <p className="text-xs text-muted-foreground">
            {student.admissionNumber} · {className} · {guardian ? `${guardian.firstName} ${guardian.lastName} · ${guardian.contact.phone}` : "No guardian on file"}
          </p>
        </div>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Keyboard className="size-3.5" />
          Cashier mode
          <Switch checked={cashierMode} onCheckedChange={setCashierMode} />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <div className="rounded-lg border border-border bg-surface p-sm">
          <p className="text-xs text-muted-foreground">Outstanding</p>
          <p className="text-sm font-semibold text-foreground">{formatMoney(outstanding, { compact: true })}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-sm">
          <p className="text-xs text-muted-foreground">Overdue</p>
          <p className={`text-sm font-semibold ${overdue.minorUnits > 0 ? "text-error" : "text-foreground"}`}>{formatMoney(overdue, { compact: true })}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-sm">
          <p className="text-xs text-muted-foreground">Next due</p>
          <p className="text-sm font-semibold text-foreground">{nextDue ? formatDate(nextDue.dueDate) : "—"}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-sm">
          <p className="text-xs text-muted-foreground">Available credit</p>
          <p className="text-sm font-semibold text-foreground">{formatMoney(availableCredit, { compact: true })}</p>
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
        <h2 className="mb-sm text-sm font-semibold text-foreground">Fee items ({selectedItems.length} selected)</h2>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No outstanding fee items — this student is fully paid up.</p>
        ) : (
          <div className="flex flex-col gap-1">
            {items.map((item) => (
              <label key={item.id} className="flex min-h-11 items-center gap-sm rounded-md border border-border px-sm py-1.5 text-sm">
                <Checkbox checked={activeSelection.has(item.id)} onCheckedChange={() => toggleItem(item.id)} />
                <span className="min-w-0 flex-1 truncate text-foreground">{item.label}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{formatDate(item.dueDate)}</span>
                <span className="shrink-0 font-medium text-foreground">{formatMoney(outstandingForItem(item))}</span>
                <Badge tone={item.status === "overdue" ? "error" : item.status === "partial" ? "warning" : "neutral"}>{item.status}</Badge>
              </label>
            ))}
          </div>
        )}
      </div>

      {cashierMode ? (
        <div className="rounded-lg border border-border bg-surface p-md">
          <p className="text-center text-3xl font-bold tabular-nums text-foreground">{formatMoney(amount)}</p>
          <Input
            type="number"
            inputMode="decimal"
            className="mt-sm h-14 text-center text-xl"
            value={amountOverride ?? toMajorUnits(selectedOutstanding)}
            onChange={(e) => setAmountOverride(e.target.value)}
            aria-label="Payment amount"
          />
          <div className="mt-sm grid grid-cols-3 gap-1.5 sm:grid-cols-5">
            {methodShortcuts.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethod(m)}
                className={`min-h-11 rounded-md border px-sm text-xs font-medium transition-colors ${method === m ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
              >
                {paymentMethodLabels[m]}
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
              <Input id="amount" type="number" min={0} value={amountOverride ?? toMajorUnits(selectedOutstanding)} onChange={(e) => setAmountOverride(e.target.value)} />
            </div>
            <div>
              <Label>Method</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                <SelectTrigger aria-label="Payment method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(paymentMethodLabels) as PaymentMethod[]).map((m) => (
                    <SelectItem key={m} value={m}>
                      {paymentMethodLabels[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {(method === "cheque" || method === "demand-draft") && (
            <div className="mt-sm grid grid-cols-1 gap-sm sm:grid-cols-3">
              <div>
                <Label htmlFor="cheque-number">{method === "cheque" ? "Cheque" : "DD"} number</Label>
                <Input id="cheque-number" value={chequeNumber} onChange={(e) => setChequeNumber(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="cheque-date">{method === "cheque" ? "Cheque" : "DD"} date</Label>
                <Input id="cheque-date" type="date" value={chequeDate} onChange={(e) => setChequeDate(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="bank-name">Bank name</Label>
                <Input id="bank-name" value={bankName} onChange={(e) => setBankName(e.target.value)} />
              </div>
            </div>
          )}
          {(method === "card" || method === "upi" || method === "bank-transfer" || method === "online-gateway" || method === "wallet") && (
            <div className="mt-sm">
              <Label htmlFor="txn-ref">Transaction reference</Label>
              <Input id="txn-ref" value={transactionReference} onChange={(e) => setTransactionReference(e.target.value)} placeholder="UTR / transaction ID" />
            </div>
          )}

          <div className="mt-sm">
            <Label htmlFor="note">Note</Label>
            <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
          </div>

          <label className="mt-sm flex items-center justify-between rounded-md border border-border p-sm">
            <span className="text-sm text-foreground">Allow advance payment (amount may exceed what&apos;s due)</span>
            <Switch checked={allowAdvance} onCheckedChange={setAllowAdvance} />
          </label>
        </div>
      )}

      {availableCredit.minorUnits > 0 && (
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => {
            const result = applyCreditToPayment(studentId, [...activeSelection], amount.minorUnits > availableCredit.minorUnits ? availableCredit : amount, ACTOR);
            if (result.ok) setSuccess({ receiptNumber: result.receipt.receiptNumber, amount: formatMoney(result.payment.amount), receiptId: result.receipt.id });
          }}
        >
          <Wallet className="size-3.5" />
          Use available credit ({formatMoney(availableCredit, { compact: true })})
        </Button>
      )}

      {canRecord && (
        <div className="sticky bottom-16 left-0 right-0 flex justify-end gap-sm rounded-lg border border-border bg-surface p-sm shadow-floating sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
          <Button variant="outline" onClick={() => router.push(`/students/${studentId}/fees`)}>
            Cancel
          </Button>
          <Button disabled={activeSelection.size === 0 && amountOverride === null} onClick={handleRecord}>
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
