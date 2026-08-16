"use client";

// Real PostgreSQL/API cutover (Phase 9F) — reads GET /api/fees/refunds. A new
// refund is raised from the source receipt (/fees/receipts/[paymentId]),
// where refundable-remaining and the payment are already in view — this
// page is the real, school-wide refund register.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RefreshCcw } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef } from "@/components/data-table/types";
import { StatTile } from "@/components/ui/stat-tile";
import { useAllFeeRefunds, useFeeRefundReport } from "@/lib/hooks/api/use-fees-api";
import type { FeeRefundListItemDto } from "@/lib/api/contracts";
import { formatCurrency, formatDateTime } from "@/lib/utils";

export default function RefundsPage() {
  const router = useRouter();
  const { data: refunds, loading, error } = useAllFeeRefunds();
  const { data: report } = useFeeRefundReport();

  const columns: ColumnDef<FeeRefundListItemDto>[] = [
    {
      id: "receipt",
      header: "Receipt",
      alwaysVisible: true,
      cell: (r) => (
        <div>
          <p className="text-sm font-medium text-foreground">{r.receiptNumber}</p>
          <p className="text-xs text-muted-foreground">{r.studentName}</p>
        </div>
      ),
    },
    { id: "reason", header: "Reason", cell: (r) => <span className="line-clamp-1 text-xs text-muted-foreground">{r.reason}</span> },
    { id: "refundedAt", header: "Refunded", sortValue: (r) => r.refundedAt, cell: (r) => <span className="text-sm text-muted-foreground">{formatDateTime(r.refundedAt)}</span> },
    { id: "amount", header: "Amount", align: "right", sortValue: (r) => r.amount, cell: (r) => <span className="text-sm font-medium text-error">-{formatCurrency(r.amount)}</span> },
  ];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Refunds</h1>
        <p className="text-xs text-muted-foreground">Every refund issued against a real payment</p>
      </div>

      {error && <p className="rounded-md border border-error/30 bg-error/8 p-sm text-sm text-error">{error}</p>}

      {report && (
        <div className="grid grid-cols-2 gap-sm sm:grid-cols-2">
          <StatTile label="Total refunded" value={formatCurrency(report.totalRefunded)} tone="neutral" />
          <StatTile label="Refunds count" value={String(report.count)} tone="neutral" />
        </div>
      )}

      <DataTable
        columns={columns}
        rows={refunds}
        getRowId={(r) => r.id}
        caption="Refunds"
        onRowClick={(r) => router.push(`/fees/receipts/${r.paymentId}`)}
        renderMobileCard={(r) => (
          <Link href={`/fees/receipts/${r.paymentId}`} className="surface-3d flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{r.studentName}</p>
              <p className="text-xs text-muted-foreground">{r.receiptNumber}</p>
            </div>
            <span className="shrink-0 text-sm font-medium text-error">-{formatCurrency(r.amount)}</span>
          </Link>
        )}
        emptyIcon={RefreshCcw}
        emptyTitle={loading ? "Loading…" : "No refunds yet"}
        emptyDescription="Refunds appear here once one is raised from a receipt."
      />
    </div>
  );
}
