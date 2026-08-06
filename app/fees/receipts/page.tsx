"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Receipt as ReceiptIcon } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef } from "@/components/data-table/types";
import { Badge } from "@/components/ui/badge";
import { useStudents } from "@/lib/hooks/use-students";
import { useSisStore } from "@/lib/hooks/use-store";
import { formatMoney } from "@/lib/finance/money";
import { paymentMethodLabels, receiptStatusLabels, type Receipt, type ReceiptStatus } from "@/lib/types/payments";
import { formatDateTime } from "@/lib/utils";

const statusFilters: (ReceiptStatus | "all")[] = ["all", "issued", "cancelled", "refunded", "partially-refunded", "replaced"];

export default function ReceiptsPage() {
  const router = useRouter();
  const db = useSisStore();
  const students = useStudents();
  const [statusFilter, setStatusFilter] = useState<ReceiptStatus | "all">("all");

  function studentName(studentId: string) {
    const s = students.find((st) => st.id === studentId);
    return s ? `${s.profile.firstName} ${s.profile.lastName}` : studentId;
  }

  const rows = [...db.receipts].sort((a, b) => (a.issuedAt < b.issuedAt ? 1 : -1));
  const filtered = statusFilter === "all" ? rows : rows.filter((r) => r.status === statusFilter);

  const columns: ColumnDef<Receipt>[] = [
    {
      id: "receiptNumber",
      header: "Receipt",
      alwaysVisible: true,
      sortValue: (r) => r.receiptNumber,
      cell: (r) => (
        <div>
          <p className="text-sm font-medium text-foreground">{r.receiptNumber}</p>
          <p className="text-xs text-muted-foreground">{studentName(r.studentId)}</p>
        </div>
      ),
    },
    { id: "method", header: "Method", cell: (r) => <span className="text-sm text-foreground">{paymentMethodLabels[r.method]}</span> },
    { id: "issuedAt", header: "Issued", sortValue: (r) => r.issuedAt, cell: (r) => <span className="text-sm text-muted-foreground">{formatDateTime(r.issuedAt)}</span> },
    { id: "amount", header: "Total", align: "right", sortValue: (r) => r.total.minorUnits, cell: (r) => <span className="text-sm font-medium text-foreground">{formatMoney(r.total)}</span> },
    { id: "status", header: "Status", align: "right", cell: (r) => <Badge tone={r.status === "issued" ? "success" : r.status === "cancelled" || r.status === "refunded" ? "error" : "neutral"}>{receiptStatusLabels[r.status]}</Badge> },
  ];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Receipts</h1>
        <p className="text-xs text-muted-foreground">Every receipt issued, cancelled, refunded or reissued</p>
      </div>

      <div className="scrollbar-none flex items-center gap-1 overflow-x-auto rounded-md bg-surface-secondary p-1">
        {statusFilters.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`min-h-9 shrink-0 rounded-md px-sm text-xs font-medium capitalize transition-colors ${statusFilter === s ? "bg-surface shadow-card text-foreground" : "text-muted-foreground"}`}
          >
            {s === "all" ? "All" : receiptStatusLabels[s]}
          </button>
        ))}
      </div>

      <DataTable
        columns={columns}
        rows={filtered}
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
              <p className="truncate text-xs text-muted-foreground">{studentName(r.studentId)}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-0.5">
              <span className="text-sm font-medium text-foreground">{formatMoney(r.total)}</span>
              <Badge tone={r.status === "issued" ? "success" : "neutral"}>{receiptStatusLabels[r.status]}</Badge>
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
