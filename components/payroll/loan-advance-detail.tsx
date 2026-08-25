"use client";

// Shared detail-drawer body for /payroll/loans and /payroll/advances — both
// routes are filtered views over the same real StaffFinancialAdvance domain
// (see the schema doc comment), so the lifecycle UI (approve/reject/cancel/
// disburse/repay) is genuinely identical; only the mutation endpoints and a
// couple of labels differ, passed in as props by each page.
import { useState } from "react";
import { AlertTriangle, Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PayrollPaymentMethodDto, StaffFinancialAdvanceDetailDto, StaffFinancialAdvanceStatusDto } from "@/lib/api/contracts";
import { formatCurrency, formatDate } from "@/lib/utils";

export const statusLabels: Record<StaffFinancialAdvanceStatusDto, string> = { pending: "Pending", approved: "Approved", rejected: "Rejected", disbursed: "Disbursed", partially_repaid: "Partially repaid", repaid: "Repaid", cancelled: "Cancelled" };
export const statusTone: Record<StaffFinancialAdvanceStatusDto, "success" | "warning" | "error" | "neutral"> = { pending: "warning", approved: "neutral", rejected: "error", disbursed: "warning", partially_repaid: "warning", repaid: "success", cancelled: "error" };
export const methodLabels: Record<PayrollPaymentMethodDto, string> = { cash: "Cash", upi: "UPI", card: "Card", bank_transfer: "Bank transfer", cheque: "Cheque", other: "Other" };
export const methodOptions = Object.keys(methodLabels) as PayrollPaymentMethodDto[];
export const today = () => new Date().toISOString().slice(0, 10);

type MutationResult = { success: boolean; error?: { message: string } };

export type LoanAdvanceActionState = {
  approvedAmount: number | ""; setApprovedAmount: (v: number | "") => void;
  rejectReason: string; setRejectReason: (v: string) => void;
  disburseDate: string; setDisburseDate: (v: string) => void;
  disburseMethod: PayrollPaymentMethodDto; setDisburseMethod: (v: PayrollPaymentMethodDto) => void;
  disburseReference: string; setDisburseReference: (v: string) => void;
  repayAmount: number; setRepayAmount: (v: number) => void;
  repayDate: string; setRepayDate: (v: string) => void;
  repayMethod: PayrollPaymentMethodDto; setRepayMethod: (v: PayrollPaymentMethodDto) => void;
  repayReference: string; setRepayReference: (v: string) => void;
  actionError: string | null; setActionError: (v: string | null) => void;
  actionSaving: boolean; setActionSaving: (v: boolean) => void;
};

/** Every action-form field a Loan/Advance detail drawer needs, plus a
 * `reset` to call whenever a different row is opened (seeding the repayment
 * amount with that row's current outstanding balance). */
export function useLoanAdvanceActionState(): LoanAdvanceActionState & { reset: (outstanding?: number) => void } {
  const [approvedAmount, setApprovedAmount] = useState<number | "">("");
  const [rejectReason, setRejectReason] = useState("");
  const [disburseDate, setDisburseDate] = useState(today());
  const [disburseMethod, setDisburseMethod] = useState<PayrollPaymentMethodDto>("bank_transfer");
  const [disburseReference, setDisburseReference] = useState("");
  const [repayAmount, setRepayAmount] = useState(0);
  const [repayDate, setRepayDate] = useState(today());
  const [repayMethod, setRepayMethod] = useState<PayrollPaymentMethodDto>("cash");
  const [repayReference, setRepayReference] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSaving, setActionSaving] = useState(false);

  function reset(outstanding = 0) {
    setApprovedAmount(""); setRejectReason(""); setActionError(null);
    setDisburseDate(today()); setDisburseMethod("bank_transfer"); setDisburseReference("");
    setRepayAmount(outstanding); setRepayDate(today()); setRepayMethod("cash"); setRepayReference("");
  }

  return {
    approvedAmount, setApprovedAmount, rejectReason, setRejectReason,
    disburseDate, setDisburseDate, disburseMethod, setDisburseMethod, disburseReference, setDisburseReference,
    repayAmount, setRepayAmount, repayDate, setRepayDate, repayMethod, setRepayMethod, repayReference, setRepayReference,
    actionError, setActionError, actionSaving, setActionSaving, reset,
  };
}

export function LoanAdvanceDetail(props: {
  detail: StaffFinancialAdvanceDetailDto;
  kind: "loan" | "advance";
  canFinalize: boolean;
  canPay: boolean;
  canManage: boolean;
  state: LoanAdvanceActionState;
  onApprove: (id: string, body: { approvedAmount?: number }) => Promise<MutationResult>;
  onReject: (id: string, body: { reason: string }) => Promise<MutationResult>;
  onCancel: (id: string) => Promise<MutationResult>;
  onDisburse: (id: string, body: { disbursementDate: string; method: PayrollPaymentMethodDto; reference?: string }) => Promise<MutationResult>;
  onRepay: (id: string, body: { amount: number; paymentDate: string; method: PayrollPaymentMethodDto; reference?: string }) => Promise<MutationResult>;
  onRefresh: () => void;
}) {
  const { detail, kind, canFinalize, canPay, canManage, state: s } = props;
  const noun = kind === "loan" ? "loan" : "advance";

  return (
    <div className="flex flex-col gap-sm">
      <div className="flex flex-wrap items-center gap-xs text-xs text-muted-foreground">
        <Badge tone={statusTone[detail.status]}>{statusLabels[detail.status]}</Badge>
        <span>Requested {formatDate(detail.requestedAt)}</span>
      </div>
      <div className="grid grid-cols-2 gap-sm rounded-lg border border-border bg-surface-secondary p-sm text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Principal</p>
          <p className="font-medium text-foreground">{formatCurrency(detail.principalAmount)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Approved</p>
          <p className="font-medium text-foreground">{detail.approvedAmount !== null ? formatCurrency(detail.approvedAmount) : "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Outstanding</p>
          <p className="font-medium text-foreground">{formatCurrency(detail.outstanding)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Purpose</p>
          <p className="truncate font-medium text-foreground">{detail.purpose ?? "—"}</p>
        </div>
      </div>

      {s.actionError && (
        <p className="flex items-center gap-1.5 rounded-md border border-error/30 bg-error/8 p-sm text-xs text-error">
          <AlertTriangle className="size-3.5 shrink-0" /> {s.actionError}
        </p>
      )}

      {detail.status === "pending" && canFinalize && (
        <div className="flex flex-col gap-xs rounded-lg border border-border p-sm">
          <p className="text-sm font-medium text-foreground">Approve or reject</p>
          <div>
            <Label htmlFor="approved-amount">Approved amount (optional — defaults to principal)</Label>
            <Input id="approved-amount" type="number" min={1} max={detail.principalAmount} value={s.approvedAmount} onChange={(e) => s.setApprovedAmount(e.target.value === "" ? "" : Number(e.target.value))} placeholder={String(detail.principalAmount)} />
          </div>
          <Button
            size="sm"
            disabled={s.actionSaving}
            onClick={async () => {
              s.setActionError(null);
              s.setActionSaving(true);
              const res = await props.onApprove(detail.id, s.approvedAmount === "" ? {} : { approvedAmount: s.approvedAmount });
              s.setActionSaving(false);
              if (!res.success) {
                s.setActionError(res.error?.message ?? "Approval failed");
                return;
              }
              props.onRefresh();
            }}
          >
            <Check className="size-3.5" />
            Approve
          </Button>
          <div>
            <Label htmlFor="reject-reason">Rejection reason</Label>
            <Input id="reject-reason" value={s.rejectReason} onChange={(e) => s.setRejectReason(e.target.value)} placeholder="Why is this being rejected?" />
          </div>
          <Button
            size="sm"
            variant="secondary"
            disabled={!s.rejectReason.trim() || s.actionSaving}
            onClick={async () => {
              s.setActionError(null);
              s.setActionSaving(true);
              const res = await props.onReject(detail.id, { reason: s.rejectReason.trim() });
              s.setActionSaving(false);
              if (!res.success) {
                s.setActionError(res.error?.message ?? "Rejection failed");
                return;
              }
              props.onRefresh();
            }}
          >
            <X className="size-3.5" />
            Reject
          </Button>
        </div>
      )}

      {detail.status === "approved" && (
        <div className="flex flex-col gap-xs rounded-lg border border-border p-sm">
          {canPay && (
            <>
              <p className="text-sm font-medium text-foreground">Record disbursement</p>
              <p className="text-xs text-muted-foreground">Confirms the {noun} was manually paid out — not a real bank transfer.</p>
              <div className="grid grid-cols-2 gap-xs">
                <div>
                  <Label htmlFor="disburse-date">Date</Label>
                  <Input id="disburse-date" type="date" value={s.disburseDate} onChange={(e) => s.setDisburseDate(e.target.value)} />
                </div>
                <div>
                  <Label>Method</Label>
                  <Select value={s.disburseMethod} onValueChange={(v) => s.setDisburseMethod(v as PayrollPaymentMethodDto)}>
                    <SelectTrigger aria-label="Disbursement method">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {methodOptions.map((m) => (
                        <SelectItem key={m} value={m}>
                          {methodLabels[m]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="disburse-ref">Reference (optional)</Label>
                <Input id="disburse-ref" value={s.disburseReference} onChange={(e) => s.setDisburseReference(e.target.value)} />
              </div>
              <Button
                size="sm"
                disabled={s.actionSaving}
                onClick={async () => {
                  s.setActionError(null);
                  s.setActionSaving(true);
                  const res = await props.onDisburse(detail.id, { disbursementDate: s.disburseDate, method: s.disburseMethod, reference: s.disburseReference.trim() || undefined });
                  s.setActionSaving(false);
                  if (!res.success) {
                    s.setActionError(res.error?.message ?? "Recording disbursement failed");
                    return;
                  }
                  props.onRefresh();
                }}
              >
                Record disbursement
              </Button>
            </>
          )}
          {canManage && (
            <Button
              size="sm"
              variant="ghost"
              disabled={s.actionSaving}
              onClick={async () => {
                s.setActionError(null);
                s.setActionSaving(true);
                const res = await props.onCancel(detail.id);
                s.setActionSaving(false);
                if (!res.success) {
                  s.setActionError(res.error?.message ?? "Cancellation failed");
                  return;
                }
                props.onRefresh();
              }}
            >
              Cancel request
            </Button>
          )}
        </div>
      )}

      {(detail.status === "disbursed" || detail.status === "partially_repaid") && canPay && (
        <div className="flex flex-col gap-xs rounded-lg border border-border p-sm">
          <p className="text-sm font-medium text-foreground">Record repayment</p>
          <p className="text-xs text-muted-foreground">Manual recovery only — no automatic payroll deduction.</p>
          <div className="grid grid-cols-2 gap-xs">
            <div>
              <Label htmlFor="repay-amount">Amount (max {formatCurrency(detail.outstanding)})</Label>
              <Input id="repay-amount" type="number" min={0.01} max={detail.outstanding} value={s.repayAmount} onChange={(e) => s.setRepayAmount(Number(e.target.value))} />
            </div>
            <div>
              <Label htmlFor="repay-date">Date</Label>
              <Input id="repay-date" type="date" value={s.repayDate} onChange={(e) => s.setRepayDate(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Method</Label>
            <Select value={s.repayMethod} onValueChange={(v) => s.setRepayMethod(v as PayrollPaymentMethodDto)}>
              <SelectTrigger aria-label="Repayment method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {methodOptions.map((m) => (
                  <SelectItem key={m} value={m}>
                    {methodLabels[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="repay-ref">Reference (optional)</Label>
            <Input id="repay-ref" value={s.repayReference} onChange={(e) => s.setRepayReference(e.target.value)} />
          </div>
          <Button
            size="sm"
            disabled={s.repayAmount <= 0 || s.repayAmount > detail.outstanding || s.actionSaving}
            onClick={async () => {
              s.setActionError(null);
              s.setActionSaving(true);
              const res = await props.onRepay(detail.id, { amount: s.repayAmount, paymentDate: s.repayDate, method: s.repayMethod, reference: s.repayReference.trim() || undefined });
              s.setActionSaving(false);
              if (!res.success) {
                s.setActionError(res.error?.message ?? "Recording repayment failed");
                return;
              }
              props.onRefresh();
            }}
          >
            Record repayment
          </Button>
        </div>
      )}

      {detail.status === "rejected" && detail.rejectionReason && <p className="text-xs text-error">Rejected: {detail.rejectionReason}</p>}
      {detail.status === "cancelled" && <p className="text-xs text-muted-foreground">Cancelled by {detail.cancelledByName ?? "—"} on {detail.cancelledAt ? formatDate(detail.cancelledAt) : "—"}</p>}

      {detail.repayments.length > 0 && (
        <div className="flex flex-col gap-xs">
          <p className="text-sm font-medium text-foreground">Repayment history</p>
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface-secondary text-xs text-muted-foreground">
                <tr>
                  <th className="p-xs text-left">Date</th>
                  <th className="p-xs text-left">Method</th>
                  <th className="p-xs text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {detail.repayments.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="p-xs text-foreground">{formatDate(r.paymentDate)}</td>
                    <td className="p-xs text-foreground">{methodLabels[r.method]}</td>
                    <td className="p-xs text-right text-foreground">{formatCurrency(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
