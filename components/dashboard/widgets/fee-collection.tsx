"use client";

// Real PostgreSQL/API cutover (Phase 9F) — reuses the canonical Fee
// Dashboard report (useFeeDashboard / GET /api/fees/dashboard), the same
// data the real /fees hub shows. No fake comparison percentages.
import { Wallet } from "lucide-react";
import Link from "next/link";
import { useFeeDashboard } from "@/lib/hooks/api/use-fees-api";
import { usePermissions } from "@/components/providers/permissions-provider";
import { formatCurrency } from "@/lib/utils";
import { WidgetShell, widgetActionButtonClass } from "../widget-shell";
import { DeferredWidget } from "./deferred-widget";

export function FeeCollectionWidget() {
  const { can } = usePermissions();
  if (!can("fees.view")) {
    return <DeferredWidget title="Fee Collection" icon={Wallet} message="You don't have permission to view fee collection data." />;
  }
  return <FeeCollectionWidgetInner />;
}

function FeeCollectionWidgetInner() {
  const { data, loading, error } = useFeeDashboard();
  const status = loading ? "loading" : error ? "error" : "ready";

  return (
    <WidgetShell
      title="Fee Collection"
      icon={Wallet}
      status={status}
      error={error ? new Error(error) : undefined}
      isEmpty={false}
      action={
        status === "ready" ? (
          <Link href="/fees" className={widgetActionButtonClass}>
            <Wallet className="size-3.5" aria-hidden="true" />
            View fees
          </Link>
        ) : undefined
      }
    >
      {data && (
        <dl className="grid h-full grid-cols-2 gap-sm text-center">
          <div className="flex flex-col justify-center rounded-md border border-border p-sm">
            <dt className="text-xs text-muted-foreground">Collected today</dt>
            <dd className="text-lg font-semibold text-success">{formatCurrency(data.collectedToday)}</dd>
          </div>
          <div className="flex flex-col justify-center rounded-md border border-border p-sm">
            <dt className="text-xs text-muted-foreground">Outstanding</dt>
            <dd className="text-lg font-semibold text-foreground">{formatCurrency(data.outstanding)}</dd>
          </div>
          <div className="flex flex-col justify-center rounded-md border border-border p-sm">
            <dt className="text-xs text-muted-foreground">Overdue</dt>
            <dd className={`text-lg font-semibold ${data.overdue > 0 ? "text-error" : "text-foreground"}`}>{formatCurrency(data.overdue)}</dd>
          </div>
          <div className="flex flex-col justify-center rounded-md border border-border p-sm">
            <dt className="text-xs text-muted-foreground">This month</dt>
            <dd className="text-lg font-semibold text-foreground">{formatCurrency(data.collectedThisMonth)}</dd>
          </div>
        </dl>
      )}
    </WidgetShell>
  );
}
