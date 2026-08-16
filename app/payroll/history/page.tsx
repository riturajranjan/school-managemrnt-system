"use client";

// Real PostgreSQL/API cutover (Phase 9H).
import Link from "next/link";
import { History } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef } from "@/components/data-table/types";
import { Badge } from "@/components/ui/badge";
import { usePayrollRuns } from "@/lib/hooks/api/use-payroll-api";
import type { PayrollRunListItemDto, PayrollRunStatusDto } from "@/lib/api/contracts";
import { formatCurrency } from "@/lib/utils";

const statusTone: Record<PayrollRunStatusDto, "success" | "warning" | "error" | "neutral"> = { draft: "neutral", calculated: "warning", finalized: "neutral", paid: "success" };
const statusLabel: Record<PayrollRunStatusDto, string> = { draft: "Draft", calculated: "Calculated", finalized: "Finalized", paid: "Paid" };

export default function PayrollHistoryPage() {
  const { data: runs } = usePayrollRuns();

  const columns: ColumnDef<PayrollRunListItemDto>[] = [
    { id: "period", header: "Period", alwaysVisible: true, sortValue: (r) => r.period, cell: (r) => <span className="text-sm font-medium text-foreground">{r.period}</span> },
    { id: "staff", header: "Staff", cell: (r) => <span className="text-sm text-muted-foreground">{r.staffCount}</span> },
    { id: "gross", header: "Gross", align: "right", cell: (r) => <span className="text-sm text-foreground">{formatCurrency(r.totalGross)}</span> },
    { id: "net", header: "Net", align: "right", cell: (r) => <span className="text-sm font-medium text-foreground">{formatCurrency(r.totalNet)}</span> },
    { id: "status", header: "Status", align: "right", cell: (r) => <Badge tone={statusTone[r.status]}>{statusLabel[r.status]}</Badge> },
  ];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center justify-between gap-sm">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Payroll history</h1>
          <p className="text-xs text-muted-foreground">Every payroll run, past and present</p>
        </div>
        <Link href="/payroll/run" className="text-xs font-medium text-primary underline-offset-2 hover:underline">
          Go to active run
        </Link>
      </div>

      <DataTable
        columns={columns}
        rows={runs}
        getRowId={(r) => r.id}
        caption="Payroll history"
        renderMobileCard={(r) => (
          <div className="surface-3d flex flex-col gap-1 rounded-lg border border-border bg-surface p-sm">
            <div className="flex items-center justify-between gap-xs">
              <p className="text-sm font-semibold text-foreground">{r.period}</p>
              <Badge tone={statusTone[r.status]}>{statusLabel[r.status]}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{r.staffCount} staff</p>
            <p className="text-sm font-medium text-foreground">{formatCurrency(r.totalNet)} net</p>
          </div>
        )}
        emptyIcon={History}
        emptyTitle="No payroll history yet"
      />
    </div>
  );
}
