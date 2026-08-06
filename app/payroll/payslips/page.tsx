"use client";

import Link from "next/link";
import { useState } from "react";
import { FileText } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef } from "@/components/data-table/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePayslips } from "@/lib/hooks/use-finance";
import { formatMoney } from "@/lib/finance/money";
import type { Payslip } from "@/lib/types/payroll";

export default function PayslipsPage() {
  const payslips = usePayslips();
  const [period, setPeriod] = useState<string>("all");

  const periods = Array.from(new Set(payslips.map((p) => p.period))).sort((a, b) => (a < b ? 1 : -1));
  const filtered = period === "all" ? payslips : payslips.filter((p) => p.period === period);

  const columns: ColumnDef<Payslip>[] = [
    {
      id: "employee",
      header: "Employee",
      alwaysVisible: true,
      sortValue: (p) => p.employeeName,
      cell: (p) => (
        <Link href={`/payroll/payslips/${p.id}`} className="text-sm font-medium text-foreground underline-offset-2 hover:underline">
          {p.employeeName}
        </Link>
      ),
    },
    { id: "period", header: "Period", cell: (p) => <span className="text-sm text-muted-foreground">{p.period}</span> },
    { id: "attendance", header: "Attendance", cell: (p) => <span className="text-sm text-muted-foreground">{p.attendanceDays}/{p.workingDays}</span>, defaultVisible: false },
    { id: "gross", header: "Gross", align: "right", sortValue: (p) => p.grossPay.minorUnits, cell: (p) => <span className="text-sm text-foreground">{formatMoney(p.grossPay)}</span> },
    { id: "net", header: "Net pay", align: "right", sortValue: (p) => p.netPay.minorUnits, cell: (p) => <span className="text-sm font-medium text-foreground">{formatMoney(p.netPay)}</span> },
  ];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Payslips</h1>
          <p className="text-xs text-muted-foreground">Generated automatically when a payroll run is locked</p>
        </div>
        <div className="w-40">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger aria-label="Period">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All periods</SelectItem>
              {periods.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={[...filtered].sort((a, b) => (a.period < b.period ? 1 : a.employeeName.localeCompare(b.employeeName)))}
        getRowId={(p) => p.id}
        caption="Payslips"
        renderMobileCard={(p) => (
          <Link href={`/payroll/payslips/${p.id}`} className="surface-3d flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{p.employeeName}</p>
              <p className="text-xs text-muted-foreground">{p.period}</p>
            </div>
            <span className="shrink-0 text-sm font-medium text-foreground">{formatMoney(p.netPay)}</span>
          </Link>
        )}
        emptyIcon={FileText}
        emptyTitle="No payslips yet"
      />
    </div>
  );
}
