"use client";

// Real PostgreSQL/API cutover (Phase 9F) — reads GET /api/fees/payments/[id]
// (the `receiptId` route param is a FeePayment id — a receipt IS the
// payment). Immutable: no cancel/reissue/email/WhatsApp send (no real
// messaging provider) — print/save-as-PDF is the real, honest export path.
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { Printer, QrCode, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useFeePayment, listFeeRefundsRequest, createFeeRefundRequest, reconcilePaymentRequest } from "@/lib/hooks/api/use-fees-api";
import type { FeeRefundDto } from "@/lib/api/contracts";
import { roleLabels } from "@/lib/permissions/roles";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";

const methodLabels: Record<string, string> = { cash: "Cash", upi: "UPI", card: "Card", bank_transfer: "Bank transfer", cheque: "Cheque", other: "Other" };

export default function ReceiptPage({ params }: { params: Promise<{ receiptId: string }> }) {
  const { receiptId } = use(params);
  const { data: payment, loading, error, reload } = useFeePayment(receiptId);
  const { can, hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const canManage = can("fees.manage");
  const canRefund = can("fees.refund");

  const [refunds, setRefunds] = useState<FeeRefundDto[]>([]);
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [refundError, setRefundError] = useState<string | null>(null);

  useEffect(() => {
    if (payment) listFeeRefundsRequest(payment.id).then((res) => res.success && setRefunds(res.data));
  }, [payment]);

  if (!capabilitiesLoading && !hasServerPermission("fees.view")) return <PermissionDenied action="view the fees module" role={roleLabels[role]} backHref="/fees" />;

  if (loading && !payment) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (error || !payment) {
    return (
      <div className="flex flex-col items-center gap-sm py-2xl text-center">
        <p className="text-sm font-medium text-foreground">Receipt not found</p>
        <Button asChild variant="outline">
          <Link href="/fees/receipts">Back to receipts</Link>
        </Button>
      </div>
    );
  }

  const refundable = payment.amount - payment.refundedAmount;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-sm print:hidden">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Receipt {payment.receiptNumber}</h1>
          <p className="text-xs text-muted-foreground">
            {payment.studentName} · {formatDate(payment.paymentDate)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-xs">
          <Badge tone={payment.reconciliationStatus === "reconciled" ? "success" : payment.reconciliationStatus === "mismatch" ? "error" : "neutral"}>{payment.reconciliationStatus}</Badge>
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="size-3.5" />
            Print / Save as PDF
          </Button>
          {canRefund && refundable > 0 && (
            <Button size="sm" variant="outline" onClick={() => setRefundOpen(true)}>
              Raise refund
            </Button>
          )}
          {canManage && payment.reconciliationStatus === "unreconciled" && (
            <>
              <Button size="sm" variant="outline" onClick={() => reconcilePaymentRequest(payment.id, { status: "reconciled" }).then(reload)}>
                Mark reconciled
              </Button>
              <Button size="sm" variant="outline" className="text-error" onClick={() => reconcilePaymentRequest(payment.id, { status: "mismatch" }).then(reload)}>
                Mark mismatch
              </Button>
            </>
          )}
        </div>
      </div>

      {/* The document itself — a fixed white page surface even in dark theme, matching the printed/PDF output. */}
      <div className="mx-auto w-full max-w-[210mm] rounded-lg border border-border bg-white p-lg text-[#111827] shadow-card print:rounded-none print:border-0 print:shadow-none">
        <div className="mb-md flex items-center justify-between border-b border-[#e5e7eb] pb-sm">
          <div className="flex items-center gap-sm">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#022c43] text-base font-bold text-white">N</span>
            <div>
              <p className="text-base font-bold">Fee receipt</p>
              <p className="text-xs text-[#6b7280]">{payment.className ? `${payment.className}${payment.sectionName ? `-${payment.sectionName}` : ""}` : ""}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold">{payment.receiptNumber}</p>
            <p className="text-xs text-[#6b7280]">{formatDateTime(payment.createdAt)}</p>
          </div>
        </div>

        <div className="mb-md grid grid-cols-2 gap-sm text-sm sm:grid-cols-4">
          <div>
            <p className="text-[10px] uppercase text-[#6b7280]">Student</p>
            <p className="font-medium">{payment.studentName}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-[#6b7280]">Class</p>
            <p className="font-medium">
              {payment.className ?? "—"}
              {payment.sectionName ? `-${payment.sectionName}` : ""}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-[#6b7280]">Admission no.</p>
            <p className="font-medium">{payment.admissionNumber}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-[#6b7280]">Method</p>
            <p className="font-medium">{methodLabels[payment.method]}</p>
          </div>
        </div>

        <div className="mb-md overflow-x-auto">
          <table className="w-full min-w-[280px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#e5e7eb] text-left text-[10px] uppercase text-[#6b7280]">
                <th className="py-1">Description</th>
                <th className="py-1 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {payment.allocations.map((item, i) => (
                <tr key={i} className="border-b border-[#f3f4f6]">
                  <td className="py-1">{item.itemName || item.categoryName}</td>
                  <td className="py-1 text-right">{formatCurrency(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mb-md flex flex-col gap-1 text-sm">
          <div className="flex justify-between border-t border-[#e5e7eb] pt-1 text-base font-bold">
            <span>Total</span>
            <span>{formatCurrency(payment.amount)}</span>
          </div>
          {payment.refundedAmount > 0 && (
            <div className="flex justify-between text-error">
              <span>Refunded</span>
              <span>-{formatCurrency(payment.refundedAmount)}</span>
            </div>
          )}
        </div>

        {payment.notes && <p className="mb-md text-xs text-[#6b7280]">Notes: {payment.notes}</p>}
        {payment.reference && <p className="mb-md text-xs text-[#6b7280]">Reference: {payment.reference}</p>}

        <div className="mb-md mt-lg grid grid-cols-2 gap-sm text-center text-xs">
          <div className="border-t border-[#111827] pt-1">Cashier — {payment.receivedByName ?? "—"}</div>
          <div className="border-t border-[#111827] pt-1">Authorized signatory</div>
        </div>

        <div className="mb-md flex items-center gap-sm text-xs text-[#6b7280]">
          <span className="flex size-12 items-center justify-center rounded-md border border-dashed border-[#9ca3af]">
            <QrCode className="size-6" />
          </span>
          <span className="flex items-center gap-1">
            <ShieldCheck className="size-3.5" /> Receipt {payment.receiptNumber}
          </span>
        </div>

        <p className="mt-lg border-t border-[#e5e7eb] pt-sm text-center text-[10px] text-[#6b7280]">This is a computer-generated receipt and does not require a physical signature.</p>
      </div>

      {refunds.length > 0 && (
        <div className="rounded-lg border border-border bg-surface p-md print:hidden">
          <h2 className="mb-sm text-sm font-semibold text-foreground">Refunds</h2>
          <ul className="flex flex-col gap-1">
            {refunds.map((r) => (
              <li key={r.id} className="flex items-center justify-between text-xs">
                <span className="text-foreground">
                  {formatCurrency(r.amount)} — {r.reason}
                </span>
                <span className="text-muted-foreground">
                  {r.refundedByName} · {formatDateTime(r.refundedAt)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <DetailDrawer open={refundOpen} onOpenChange={setRefundOpen} title="Raise refund" description={`Receipt ${payment.receiptNumber} · Refundable ${formatCurrency(refundable)}`}>
        <div className="flex flex-col gap-sm">
          <div>
            <Label htmlFor="refund-amount">Amount</Label>
            <Input id="refund-amount" type="number" min={0} max={refundable} value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="refund-reason">Reason</Label>
            <Input id="refund-reason" value={refundReason} onChange={(e) => setRefundReason(e.target.value)} />
          </div>
          {refundError && <p className="rounded-md border border-error/30 bg-error/8 p-sm text-sm text-error">{refundError}</p>}
          <Button
            disabled={!refundAmount || !refundReason.trim()}
            onClick={async () => {
              setRefundError(null);
              const res = await createFeeRefundRequest(payment.id, { amount: Number(refundAmount), reason: refundReason.trim() });
              if (!res.success) return setRefundError(res.error.message);
              setRefundOpen(false);
              setRefundAmount("");
              setRefundReason("");
              reload();
              listFeeRefundsRequest(payment.id).then((r) => r.success && setRefunds(r.data));
            }}
          >
            Create refund
          </Button>
        </div>
      </DetailDrawer>
    </div>
  );
}
