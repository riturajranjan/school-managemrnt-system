"use client";

import Link from "next/link";
import { History } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef } from "@/components/data-table/types";
import { Badge } from "@/components/ui/badge";
import { usePayrollRuns } from "@/lib/hooks/use-finance";
import { formatMoney } from "@/lib/finance/money";
import { payrollRunStatusLabels, type PayrollRun, type PayrollRunStatus } from "@/lib/types/payroll";
import { formatDate } from "@/lib/utils";

const statusTone: Record<PayrollRunStatus, "success" | "warning" | "error" | "neutral"> = {
  draft: "neutral",
  calculating: "warning",
  review: "warning",
  approved: "neutral",
  locked: "neutral",
  paid: "success",
  "partially-paid": "warning",
  cancelled: "error",
};

export default function PayrollHistoryPage() {
  const runs = usePayrollRuns();

  const columns: ColumnDef<PayrollRun>[] = [
    { id: "period", header: "Period", alwaysVisible: true, sortValue: (r) => r.period, cell: (r) => <span className="text-sm font-medium text-foreground">{r.period}</span> },
    { id: "employees", header: "Employees", cell: (r) => <span className="text-sm text-muted-foreground">{r.employees.length}</span> },
    { id: "gross", header: "Gross", align: "right", cell: (r) => <span className="text-sm text-foreground">{formatMoney(r.totalGross)}</span> },
    { id: "net", header: "Net", align: "right", cell: (r) => <span className="text-sm font-medium text-foreground">{formatMoney(r.totalNet)}</span> },
    { id: "paidAt", header: "Paid on", cell: (r) => <span className="text-sm text-muted-foreground">{r.paidAt ? formatDate(r.paidAt) : "—"}</span>, defaultVisible: false },
    { id: "status", header: "Status", align: "right", cell: (r) => <Badge tone={statusTone[r.status]}>{payrollRunStatusLabels[r.status]}</Badge> },
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
        rows={[...runs].sort((a, b) => (a.period < b.period ? 1 : -1))}
        getRowId={(r) => r.id}
        caption="Payroll history"
        renderMobileCard={(r) => (
          <div className="surface-3d flex flex-col gap-1 rounded-lg border border-border bg-surface p-sm">
            <div className="flex items-center justify-between gap-xs">
              <p className="text-sm font-semibold text-foreground">{r.period}</p>
              <Badge tone={statusTone[r.status]}>{payrollRunStatusLabels[r.status]}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{r.employees.length} employee(s)</p>
            <p className="text-sm font-medium text-foreground">{formatMoney(r.totalNet)} net</p>
          </div>
        )}
        emptyIcon={History}
        emptyTitle="No payroll history yet"
      />
    </div>
  );
}
