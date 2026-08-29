"use client";

// Real PostgreSQL/API cutover (Phase 9F) — reads GET /api/fees/payments.
// A receipt IS the FeePayment (see the schema doc comment) — it is
// immutable, so there is no cancel/reissue/refund-status filter here; a
// refund is a separate real FeeRefund record against the payment, visible
// on the receipt detail page.
import { useRouter } from "next/navigation";
import { Receipt as ReceiptIcon } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef } from "@/components/data-table/types";
import { Badge } from "@/components/ui/badge";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useFeePayments } from "@/lib/hooks/api/use-fees-api";
import type { FeePaymentDto } from "@/lib/api/contracts";
import { roleLabels } from "@/lib/permissions/roles";
import { formatCurrency, formatDateTime } from "@/lib/utils";

const methodLabels: Record<string, string> = { cash: "Cash", upi: "UPI", card: "Card", bank_transfer: "Bank transfer", cheque: "Cheque", other: "Other" };

export default function ReceiptsPage() {
  const router = useRouter();
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data: payments, loading, error } = useFeePayments({ pageSize: 100 });
  if (!capabilitiesLoading && !hasServerPermission("fees.view")) return <PermissionDenied action="view the fees module" role={roleLabels[role]} backHref="/fees" />;

  const columns: ColumnDef<FeePaymentDto>[] = [
    {
      id: "receiptNumber",
      header: "Receipt",
      alwaysVisible: true,
      sortValue: (r) => r.receiptNumber,
      cell: (r) => (
        <div>
          <p className="text-sm font-medium text-foreground">{r.receiptNumber}</p>
          <p className="text-xs text-muted-foreground">{r.studentName}</p>
        </div>
      ),
    },
    { id: "method", header: "Method", cell: (r) => <span className="text-sm text-foreground">{methodLabels[r.method]}</span> },
    { id: "issuedAt", header: "Issued", sortValue: (r) => r.createdAt, cell: (r) => <span className="text-sm text-muted-foreground">{formatDateTime(r.createdAt)}</span> },
    { id: "amount", header: "Total", align: "right", sortValue: (r) => r.amount, cell: (r) => <span className="text-sm font-medium text-foreground">{formatCurrency(r.amount)}</span> },
    { id: "reconciliation", header: "Reconciliation", align: "right", cell: (r) => <Badge tone={r.reconciliationStatus === "reconciled" ? "success" : r.reconciliationStatus === "mismatch" ? "error" : "neutral"}>{r.reconciliationStatus}</Badge> },
  ];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Payment Receipts</h1>
        <p className="text-xs text-muted-foreground">Find or download a receipt for any fee payment.</p>
      </div>

      {error && <p className="rounded-md border border-error/30 bg-error/8 p-sm text-sm text-error">{error}</p>}
      {loading && payments.length === 0 && <p className="text-xs text-muted-foreground">Loading…</p>}

      <DataTable
        columns={columns}
        rows={payments}
        getRowId={(r) => r.id}
        caption="Receipts"
        onRowClick={(r) => router.push(`/fees/receipts/${r.id}`)}
        renderMobileCard={(r) => (
          <button
            type="button"
            onClick={() => router.push(`/fees/receipts/${r.id}`)}
            className="surface-3d flex w-full items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99]"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{r.receiptNumber}</p>
              <p className="truncate text-xs text-muted-foreground">{r.studentName}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-0.5">
              <span className="text-sm font-medium text-foreground">{formatCurrency(r.amount)}</span>
              <Badge tone={r.reconciliationStatus === "reconciled" ? "success" : "neutral"}>{r.reconciliationStatus}</Badge>
            </div>
          </button>
        )}
        emptyIcon={ReceiptIcon}
        emptyTitle="No receipts yet"
        emptyDescription="Receipts appear here once a fee payment is recorded."
      />
    </div>
  );
}
