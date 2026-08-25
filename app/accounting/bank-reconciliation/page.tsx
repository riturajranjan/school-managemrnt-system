"use client";

// Real PostgreSQL/API cutover (Phase 9G) — reads the live
// /api/accounting/accounts endpoint filtered to ASSET-type accounts. The
// mock's bank-account-number/IFSC metadata and cashier-shift open/close
// (with a cash-count variance) had no real accounting policy behind them —
// dropped rather than faked. Real fee collections already have a real
// reconciliation status (Phase 9F) — see the "Unreconciled fee collections"
// link, which is the honest bridge to that real source of truth.
import Link from "next/link";
import { AlertTriangle, Landmark } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef } from "@/components/data-table/types";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/ui/stat-tile";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useAccountingAccounts } from "@/lib/hooks/api/use-accounting-api";
import { useFeeReconciliationReport } from "@/lib/hooks/api/use-fees-api";
import type { AccountingAccountDto } from "@/lib/api/contracts";
import { roleLabels } from "@/lib/permissions/roles";
import { formatCurrency } from "@/lib/utils";

export default function BankAndCashPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data: accounts, loading, error } = useAccountingAccounts({ type: "asset", status: "active" });
  const { data: feeRecon } = useFeeReconciliationReport();
  if (!capabilitiesLoading && !hasServerPermission("accounting.view")) return <PermissionDenied action="view the accounting module" role={roleLabels[role]} backHref="/accounting" />;

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);

  const columns: ColumnDef<AccountingAccountDto>[] = [
    {
      id: "name",
      header: "Account",
      alwaysVisible: true,
      cell: (a) => (
        <div>
          <p className="text-sm font-medium text-foreground">{a.name}</p>
          <p className="text-xs text-muted-foreground">{a.code}{a.systemKey ? " · System" : ""}</p>
        </div>
      ),
    },
    { id: "balance", header: "Balance", align: "right", cell: (a) => <span className="text-sm font-medium text-foreground">{formatCurrency(a.balance)}</span> },
  ];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Bank &amp; cash</h1>
        <p className="text-xs text-muted-foreground">Real asset-account balances, derived from every posted journal</p>
      </div>

      {error && <p className="rounded-md border border-error/30 bg-error/8 p-sm text-sm text-error">{error}</p>}

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-3">
        <StatTile label="Total cash & bank" value={formatCurrency(totalBalance)} icon={Landmark} tone={totalBalance >= 0 ? "success" : "error"} />
        {feeRecon && (
          <>
            <StatTile label="Unreconciled fee collections" value={String(feeRecon.unreconciled)} tone={feeRecon.unreconciled > 0 ? "warning" : "success"} />
            <StatTile label="Reconciled" value={String(feeRecon.reconciled)} tone="neutral" />
          </>
        )}
      </div>

      {feeRecon && feeRecon.unreconciled > 0 && (
        <Link href="/fees/reconciliation" className="flex items-center justify-between gap-sm rounded-lg border border-warning/30 bg-warning/8 p-sm text-sm text-warning">
          <span className="flex items-center gap-1.5">
            <AlertTriangle className="size-4" /> {feeRecon.unreconciled} fee collection{feeRecon.unreconciled === 1 ? "" : "s"} not yet reconciled
          </span>
          <Badge tone="warning">Review in Fees</Badge>
        </Link>
      )}

      <DataTable
        columns={columns}
        rows={accounts}
        getRowId={(a) => a.id}
        caption="Bank & cash accounts"
        renderMobileCard={(a) => (
          <div className="surface-3d flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{a.name}</p>
              <p className="text-xs text-muted-foreground">{a.code}</p>
            </div>
            <span className="shrink-0 text-sm font-medium text-foreground">{formatCurrency(a.balance)}</span>
          </div>
        )}
        emptyIcon={Landmark}
        emptyTitle={loading ? "Loading…" : "No cash or bank accounts yet"}
      />
    </div>
  );
}
