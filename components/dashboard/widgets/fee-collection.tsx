"use client";

import { Wallet } from "lucide-react";
import { fetchFeeCollection } from "../data/mock-data";
import { Sparkline } from "../mini-charts";
import { useWidgetData } from "../use-widget-data";
import { WidgetShell } from "../widget-shell";

function formatCurrency(amount: number) {
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  return `₹${amount.toLocaleString("en-IN")}`;
}

export function FeeCollectionWidget() {
  const state = useWidgetData(fetchFeeCollection);

  return (
    <WidgetShell
      title="Fee Collection"
      icon={Wallet}
      status={state.status}
      error={state.status === "error" ? state.error : undefined}
      onRetry={state.retry}
      isEmpty={state.status === "ready" && state.data.targetAmount === 0}
      emptyMessage="No fee data for this term yet."
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
          {state.data.overdueInvoices > 0 && (
            <p className="text-xs font-medium text-warning">{state.data.overdueInvoices} invoices overdue</p>
          )}
        </div>
      )}
    </WidgetShell>
  );
}
