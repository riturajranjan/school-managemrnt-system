"use client";

import { CircleDollarSign, PlusCircle, Wallet } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { FeePayment } from "../data/types";
import { fetchFeeCollection } from "../data/mock-data";
import { DetailDrawer } from "../detail-drawer";
import { Sparkline } from "../mini-charts";
import { useWidgetData } from "../use-widget-data";
import { WidgetShell, widgetActionButtonClass } from "../widget-shell";

function formatCurrency(amount: number) {
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  return `₹${amount.toLocaleString("en-IN")}`;
}

const PAYMENT_METHODS: FeePayment["method"][] = ["UPI", "Card", "Cash", "Bank Transfer"];

export function FeeCollectionWidget() {
  const state = useWidgetData(fetchFeeCollection);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [recordedPayments, setRecordedPayments] = useState<FeePayment[]>([]);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [studentName, setStudentName] = useState("");
  const [grade, setGrade] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<FeePayment["method"]>("UPI");
  const [formError, setFormError] = useState<string | null>(null);

  const payments = state.status === "ready" ? [...recordedPayments, ...state.data.recentPayments] : [];

  function resetForm() {
    setStudentName("");
    setGrade("");
    setAmount("");
    setMethod("UPI");
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const parsedAmount = Number(amount);
    if (!studentName.trim() || !grade.trim()) {
      setFormError("Student name and grade are required.");
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setFormError("Enter a valid payment amount.");
      return;
    }
    setFormError(null);
    const payment: FeePayment = {
      id: `local-${Date.now()}`,
      studentName: studentName.trim(),
      grade: grade.trim(),
      amount: parsedAmount,
      method,
      time: "Just now",
    };
    setRecordedPayments((prev) => [payment, ...prev]);
    setConfirmation(`Recorded ${formatCurrency(parsedAmount)} from ${payment.studentName}.`);
    resetForm();
  }

  return (
    <>
      <WidgetShell
        title="Fee Collection"
        icon={Wallet}
        status={state.status}
        error={state.status === "error" ? state.error : undefined}
        onRetry={state.retry}
        isEmpty={state.status === "ready" && state.data.targetAmount === 0}
        emptyMessage="No fee data for this term yet."
        action={
          state.status === "ready" ? (
            <button
              type="button"
              onClick={() => {
                setConfirmation(null);
                setFormError(null);
                setDrawerOpen(true);
              }}
              className={widgetActionButtonClass}
            >
              <PlusCircle className="size-3.5" aria-hidden="true" />
              Record payment
            </button>
          ) : undefined
        }
      >
        {state.status === "ready" && (
          <div className="flex h-full flex-col justify-between gap-sm">
            <div className="flex items-start justify-between gap-sm">
              <div>
                <p className="text-lg font-bold text-foreground">{formatCurrency(state.data.collectedAmount)}</p>
                <p className="text-xs text-muted-foreground">
                  of {formatCurrency(state.data.targetAmount)} · {state.data.collectedPercent}%
                </p>
              </div>
              <Sparkline data={state.data.trend} toneClassName="text-success" />
            </div>

            <dl className="grid grid-cols-2 gap-xs text-xs">
              <div className="rounded-md bg-surface-secondary px-sm py-xs">
                <dt className="text-muted-foreground">Pending</dt>
                <dd className="font-semibold text-foreground">{formatCurrency(state.data.pendingAmount)}</dd>
              </div>
              <div className="rounded-md bg-warning/15 px-sm py-xs">
                <dt className="text-warning">Overdue</dt>
                <dd className="font-semibold text-warning">
                  {formatCurrency(state.data.overdueAmount)} · {state.data.overdueInvoices} invoices
                </dd>
              </div>
            </dl>

            {payments.length > 0 && (
              <ul className="flex flex-col gap-0.5 border-t border-border pt-xs">
                {payments.slice(0, 2).map((payment) => (
                  <li key={payment.id} className="flex items-center justify-between gap-xs text-xs">
                    <span className="min-w-0 flex-1 truncate text-foreground">{payment.studentName}</span>
                    <span className="shrink-0 font-medium text-success">{formatCurrency(payment.amount)}</span>
                    <span className="shrink-0 text-muted-foreground">{payment.time}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </WidgetShell>

      <DetailDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title="Record payment"
        description="Log a fee payment received from a student."
        footer={
          <button
            type="submit"
            form="fee-payment-form"
            className="min-h-11 w-full rounded-md bg-primary px-sm text-sm font-medium text-primary-foreground outline-none transition-colors active:scale-[0.97] hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
          >
            Record payment
          </button>
        }
      >
        <div className="flex flex-col gap-lg">
          <form id="fee-payment-form" onSubmit={handleSubmit} className="flex flex-col gap-sm">
            <div className="flex flex-col gap-1">
              <label htmlFor="fee-student-name" className="text-xs font-medium text-muted-foreground">
                Student name
              </label>
              <input
                id="fee-student-name"
                type="text"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="e.g. Ishaan Bhatt"
                className="min-h-11 rounded-md border border-input bg-surface px-sm text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="fee-grade" className="text-xs font-medium text-muted-foreground">
                Grade
              </label>
              <input
                id="fee-grade"
                type="text"
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                placeholder="e.g. Grade 7"
                className="min-h-11 rounded-md border border-input bg-surface px-sm text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div className="flex gap-sm">
              <div className="flex flex-1 flex-col gap-1">
                <label htmlFor="fee-amount" className="text-xs font-medium text-muted-foreground">
                  Amount (₹)
                </label>
                <input
                  id="fee-amount"
                  type="number"
                  min={1}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="18500"
                  className="min-h-11 rounded-md border border-input bg-surface px-sm text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div className="flex flex-1 flex-col gap-1">
                <label htmlFor="fee-method" className="text-xs font-medium text-muted-foreground">
                  Method
                </label>
                <select
                  id="fee-method"
                  value={method}
                  onChange={(e) => setMethod(e.target.value as FeePayment["method"])}
                  className="min-h-11 rounded-md border border-input bg-surface px-sm text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {PAYMENT_METHODS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {formError && (
              <p role="alert" className="text-xs font-medium text-error">
                {formError}
              </p>
            )}
            {confirmation && (
              <p role="status" className="flex items-center gap-xs text-xs font-medium text-success">
                <CircleDollarSign className="size-3.5 shrink-0" aria-hidden="true" />
                {confirmation}
              </p>
            )}
          </form>

          <div>
            <p className="mb-xs text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recent payments</p>
            <ul className="flex flex-col gap-xs">
              {payments.map((payment) => (
                <li key={payment.id} className="flex items-center justify-between border-b border-border py-xs text-sm">
                  <span>
                    <span className="block text-foreground">{payment.studentName}</span>
                    <span className="block text-xs text-muted-foreground">
                      {payment.grade} · {payment.method}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block font-medium text-success">{formatCurrency(payment.amount)}</span>
                    <span className="block text-xs text-muted-foreground">{payment.time}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </DetailDrawer>
    </>
  );
}
