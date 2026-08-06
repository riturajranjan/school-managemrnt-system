"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Check, PlayCircle, Plus, RefreshCcw, X } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef, RowAction } from "@/components/data-table/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useStudents } from "@/lib/hooks/use-students";
import { useSisStore } from "@/lib/hooks/use-store";
import { formatMoney, moneyFromMajor, toMajorUnits } from "@/lib/finance/money";
import { approveRefund, getRefundableRemaining, processRefund, rejectRefund, requestRefund } from "@/lib/services/refund-service";
import { paymentMethodLabels, refundMethodLabels, refundReasonLabels, refundStatusLabels, type Refund, type RefundMethod, type RefundReason } from "@/lib/types/payments";
import { formatDateTime } from "@/lib/utils";

const ACTOR = { name: "Finance Administrator", role: "Finance Administrator" };
const reasonOptions = Object.keys(refundReasonLabels) as RefundReason[];
const methodOptions = Object.keys(refundMethodLabels) as RefundMethod[];

function RefundsContent() {
  const searchParams = useSearchParams();
  const initialStudentId = searchParams.get("studentId") ?? "";
  const initialPaymentId = searchParams.get("paymentId") ?? "";
  const db = useSisStore();
  const students = useStudents();
  const { can } = usePermissions();
  const canRequest = can("fees.refund");
  const canApprove = can("fees.approveRefund");

  const [createOpen, setCreateOpen] = useState(false);
  const [studentId, setStudentId] = useState(initialStudentId);
  const [paymentId, setPaymentId] = useState(initialPaymentId);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState<RefundReason>("excess-payment");
  const [method, setMethod] = useState<RefundMethod>("original-method");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  function studentName(id: string) {
    const s = students.find((st) => st.id === id);
    return s ? `${s.profile.firstName} ${s.profile.lastName}` : id;
  }

  const studentPayments = db.payments.filter((p) => p.studentId === studentId && p.status === "successful");
  const remaining = paymentId ? getRefundableRemaining(paymentId) : null;

  const columns: ColumnDef<Refund>[] = [
    {
      id: "student",
      header: "Student",
      alwaysVisible: true,
      sortValue: (r) => studentName(r.studentId),
      cell: (r) => (
        <div>
          <p className="text-sm font-medium text-foreground">{studentName(r.studentId)}</p>
          <p className="text-xs text-muted-foreground">{refundReasonLabels[r.reason]}</p>
        </div>
      ),
    },
    { id: "method", header: "Method", cell: (r) => <span className="text-sm text-foreground">{refundMethodLabels[r.method]}</span> },
    { id: "amount", header: "Amount", align: "right", cell: (r) => <span className="text-sm font-medium text-foreground">{formatMoney(r.amount)}</span> },
    { id: "requested", header: "Requested", cell: (r) => <span className="text-xs text-muted-foreground">{formatDateTime(r.requestedAt)}</span>, defaultVisible: false },
    {
      id: "status",
      header: "Status",
      align: "right",
      cell: (r) => <Badge tone={r.status === "completed" ? "success" : r.status === "rejected" || r.status === "failed" ? "error" : "neutral"}>{refundStatusLabels[r.status]}</Badge>,
    },
  ];

  const rowActions: RowAction<Refund>[] = [
    ...(canApprove ? [{ key: "approve", label: "Approve", icon: <Check className="size-3.5" />, hidden: (r: Refund) => r.status !== "submitted", onSelect: (r: Refund) => approveRefund(r.id, ACTOR) }] : []),
    ...(canApprove ? [{ key: "reject", label: "Reject", icon: <X className="size-3.5" />, hidden: (r: Refund) => r.status !== "submitted", destructive: true, onSelect: (r: Refund) => rejectRefund(r.id, "Not approved", ACTOR) }] : []),
    ...(canRequest ? [{ key: "process", label: "Process", icon: <PlayCircle className="size-3.5" />, hidden: (r: Refund) => r.status !== "approved", onSelect: (r: Refund) => processRefund(r.id, ACTOR) }] : []),
  ];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Refunds</h1>
          <p className="text-xs text-muted-foreground">Request, approve and process refunds against recorded payments</p>
        </div>
        {canRequest && (
          <Button
            size="sm"
            onClick={() => {
              setStudentId(initialStudentId);
              setPaymentId(initialPaymentId);
              setAmount("");
              setNote("");
              setError(null);
              setCreateOpen(true);
            }}
          >
            <Plus className="size-3.5" />
            Request refund
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={[...db.refunds].sort((a, b) => (a.requestedAt < b.requestedAt ? 1 : -1))}
        getRowId={(r) => r.id}
        caption="Refunds"
        rowActions={rowActions}
        renderMobileCard={(r) => (
          <div className="surface-3d flex flex-col gap-1 rounded-lg border border-border bg-surface p-sm">
            <div className="flex items-center justify-between gap-xs">
              <p className="truncate text-sm font-semibold text-foreground">{studentName(r.studentId)}</p>
              <Badge tone={r.status === "completed" ? "success" : "neutral"}>{refundStatusLabels[r.status]}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {formatMoney(r.amount)} · {refundReasonLabels[r.reason]}
            </p>
          </div>
        )}
        emptyIcon={RefreshCcw}
        emptyTitle="No refunds yet"
      />

      <DetailDrawer
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setError(null);
        }}
        title="Request a refund"
        description="Submitted for approval before any money moves"
      >
        <div className="flex flex-col gap-sm">
          {error && <p className="text-xs text-error">{error}</p>}
          <div>
            <Label>Student</Label>
            <Select
              value={studentId}
              onValueChange={(v) => {
                setStudentId(v);
                setPaymentId("");
              }}
            >
              <SelectTrigger aria-label="Student">
                <SelectValue placeholder="Select student" />
              </SelectTrigger>
              <SelectContent>
                {students
                  .filter((s) => s.status === "active")
                  .slice(0, 100)
                  .map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.profile.firstName} {s.profile.lastName}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Payment</Label>
            <Select value={paymentId} onValueChange={setPaymentId} disabled={!studentId}>
              <SelectTrigger aria-label="Payment">
                <SelectValue placeholder="Select payment" />
              </SelectTrigger>
              <SelectContent>
                {studentPayments.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {formatMoney(p.amount)} · {paymentMethodLabels[p.method]} · {formatDateTime(p.paidAt)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {remaining && <p className="mt-1 text-xs text-muted-foreground">Refundable balance: {formatMoney(remaining)}</p>}
          </div>
          <div>
            <Label htmlFor="refund-amount">Amount (₹)</Label>
            <Input id="refund-amount" type="number" min={0} value={amount || (remaining ? toMajorUnits(remaining) : "")} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <Label>Reason</Label>
            <Select value={reason} onValueChange={(v) => setReason(v as RefundReason)}>
              <SelectTrigger aria-label="Reason">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {reasonOptions.map((r) => (
                  <SelectItem key={r} value={r}>
                    {refundReasonLabels[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Refund method</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as RefundMethod)}>
              <SelectTrigger aria-label="Refund method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {methodOptions.map((m) => (
                  <SelectItem key={m} value={m}>
                    {refundMethodLabels[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="refund-note">Note</Label>
            <Input id="refund-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional supporting note" />
          </div>
          <Button
            disabled={!paymentId}
            onClick={() => {
              const result = requestRefund({ paymentId, amount: moneyFromMajor(Number(amount || (remaining ? toMajorUnits(remaining) : 0)), "INR"), reason, note: note.trim() || undefined, method }, ACTOR);
              if (!result.ok) {
                setError(result.errors.join(" "));
                return;
              }
              setCreateOpen(false);
            }}
          >
            Submit for approval
          </Button>
        </div>
      </DetailDrawer>
    </div>
  );
}

export default function RefundsPage() {
  return (
    <Suspense fallback={<div className="h-40" />}>
      <RefundsContent />
    </Suspense>
  );
}
