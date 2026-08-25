"use client";

// Real PostgreSQL/API cutover (Phase 9F) — reads GET /api/fees/payments and
// POSTs GET /api/fees/payments/[id]/reconcile. Honest manual reconciliation:
// no bank-feed/gateway integration exists in this repo, so there is no
// automated match-suggestion — a school marks a payment reconciled/mismatch
// against its own external records.
import { useState } from "react";
import { Banknote } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatTile } from "@/components/ui/stat-tile";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { reconcilePaymentRequest, useFeePayments, useFeeReconciliationReport } from "@/lib/hooks/api/use-fees-api";
import type { FeeReconciliationStatusDto } from "@/lib/api/contracts";
import { roleLabels } from "@/lib/permissions/roles";
import { formatCurrency, formatDateTime } from "@/lib/utils";

export default function ReconciliationPage() {
  const { can, hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const canManage = can("fees.manage");
  const { data: report } = useFeeReconciliationReport();
  const [statusFilter, setStatusFilter] = useState<FeeReconciliationStatusDto | "all">("unreconciled");
  const { data: payments, loading, error, reload } = useFeePayments({ reconciliationStatus: statusFilter === "all" ? undefined : statusFilter, pageSize: 50 });
  if (!capabilitiesLoading && !hasServerPermission("fees.view")) return <PermissionDenied action="view the fees module" role={roleLabels[role]} backHref="/fees" />;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Reconciliation</h1>
        <p className="text-xs text-muted-foreground">Match recorded payments against your bank or gateway statement manually</p>
      </div>

      {error && <p className="rounded-md border border-error/30 bg-error/8 p-sm text-sm text-error">{error}</p>}

      {report && (
        <div className="grid grid-cols-3 gap-sm">
          <StatTile label="Unreconciled" value={String(report.unreconciled)} tone="warning" />
          <StatTile label="Reconciled" value={String(report.reconciled)} tone="success" />
          <StatTile label="Mismatch" value={String(report.mismatch)} tone="error" />
        </div>
      )}

      <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as FeeReconciliationStatusDto | "all")}>
        <SelectTrigger className="w-48" aria-label="Status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="unreconciled">Unreconciled</SelectItem>
          <SelectItem value="reconciled">Reconciled</SelectItem>
          <SelectItem value="mismatch">Mismatch</SelectItem>
        </SelectContent>
      </Select>

      <div className="flex flex-col gap-sm">
        {payments.map((p) => (
          <div key={p.id} className="surface-3d flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {p.receiptNumber} · {p.studentName}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDateTime(p.paymentDate)} · {p.method.replace("_", " ")} {p.reference ? `· Ref ${p.reference}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-sm">
              <span className="text-sm font-medium text-foreground">{formatCurrency(p.amount)}</span>
              <Badge tone={p.reconciliationStatus === "reconciled" ? "success" : p.reconciliationStatus === "mismatch" ? "error" : "neutral"}>{p.reconciliationStatus}</Badge>
              {canManage && p.reconciliationStatus !== "reconciled" && (
                <Button size="sm" variant="outline" onClick={() => reconcilePaymentRequest(p.id, { status: "reconciled" }).then(reload)}>
                  Mark reconciled
                </Button>
              )}
            </div>
          </div>
        ))}
        {!loading && payments.length === 0 && (
          <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
            <Banknote className="size-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No payments match this filter.</p>
          </div>
        )}
      </div>
    </div>
  );
}
