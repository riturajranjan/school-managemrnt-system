"use client";

import { useState } from "react";
import { Banknote, Check, Plus, X, XCircle } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef, RowAction } from "@/components/data-table/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useTeachers } from "@/lib/hooks/use-academics";
import { useEmployeeLoans } from "@/lib/hooks/use-finance";
import { formatMoney, moneyFromMajor } from "@/lib/finance/money";
import { approveLoan, closeLoanEarly, rejectLoan, requestLoan } from "@/lib/services/loan-advance-service";
import { loanStatusLabels, type EmployeeLoan, type LoanStatus } from "@/lib/types/payroll";
import { formatDate } from "@/lib/utils";

const ACTOR = { name: "Finance Administrator", role: "Finance Administrator" };

const statusTone: Record<LoanStatus, "success" | "warning" | "error" | "neutral"> = {
  draft: "neutral",
  submitted: "warning",
  approved: "neutral",
  rejected: "error",
  active: "success",
  closed: "neutral",
};

export default function LoansPage() {
  const loans = useEmployeeLoans();
  const teachers = useTeachers();
  const { can } = usePermissions();
  const canManage = can("payroll.manageLoans");

  const [createOpen, setCreateOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [amount, setAmount] = useState(50000);
  const [installments, setInstallments] = useState(6);
  const [startMonth, setStartMonth] = useState(new Date().toISOString().slice(0, 7));

  function employeeName(id: string) {
    return teachers.find((t) => t.id === id)?.name ?? id;
  }

  const columns: ColumnDef<EmployeeLoan>[] = [
    {
      id: "employee",
      header: "Employee",
      alwaysVisible: true,
      cell: (l) => (
        <div>
          <p className="text-sm font-medium text-foreground">{employeeName(l.employeeId)}</p>
          <p className="text-xs text-muted-foreground">
            {l.installments} installment(s) from {l.startMonth}
          </p>
        </div>
      ),
    },
    { id: "amount", header: "Amount", align: "right", cell: (l) => <span className="text-sm text-foreground">{formatMoney(l.amount)}</span> },
    { id: "monthly", header: "Monthly", align: "right", cell: (l) => <span className="text-sm text-foreground">{formatMoney(l.monthlyDeduction)}</span> },
    { id: "outstanding", header: "Outstanding", align: "right", cell: (l) => <span className="text-sm font-medium text-foreground">{formatMoney(l.outstandingBalance)}</span> },
    { id: "status", header: "Status", align: "right", cell: (l) => <Badge tone={statusTone[l.status]}>{loanStatusLabels[l.status]}</Badge> },
  ];

  const rowActions: RowAction<EmployeeLoan>[] = canManage
    ? [
        { key: "approve", label: "Approve", icon: <Check className="size-3.5" />, hidden: (l) => l.status !== "submitted", onSelect: (l) => approveLoan(l.id, ACTOR) },
        { key: "reject", label: "Reject", icon: <X className="size-3.5" />, hidden: (l) => l.status !== "submitted", destructive: true, onSelect: (l) => rejectLoan(l.id, "Not approved", ACTOR) },
        { key: "close", label: "Close early", icon: <XCircle className="size-3.5" />, hidden: (l) => l.status !== "active", onSelect: (l) => closeLoanEarly(l.id, ACTOR) },
      ]
    : [];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Employee loans</h1>
          <p className="text-xs text-muted-foreground">Recovered automatically through payroll each month it&apos;s active</p>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-3.5" />
            New loan
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={[...loans].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))}
        getRowId={(l) => l.id}
        caption="Employee loans"
        rowActions={rowActions}
        renderMobileCard={(l) => (
          <div className="surface-3d flex flex-col gap-1 rounded-lg border border-border bg-surface p-sm">
            <div className="flex items-center justify-between gap-xs">
              <p className="truncate text-sm font-semibold text-foreground">{employeeName(l.employeeId)}</p>
              <Badge tone={statusTone[l.status]}>{loanStatusLabels[l.status]}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">Since {formatDate(l.createdAt)}</p>
            <p className="text-sm font-medium text-foreground">{formatMoney(l.outstandingBalance)} outstanding</p>
          </div>
        )}
        emptyIcon={Banknote}
        emptyTitle="No employee loans"
      />

      <DetailDrawer open={createOpen} onOpenChange={setCreateOpen} title="New employee loan" description="Submitted for approval; recovery starts from the selected month">
        <div className="flex flex-col gap-sm">
          <div>
            <Label>Employee</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger aria-label="Employee">
                <SelectValue placeholder="Select employee" />
              </SelectTrigger>
              <SelectContent>
                {teachers.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-sm">
            <div>
              <Label htmlFor="loan-amount">Amount (₹)</Label>
              <Input id="loan-amount" type="number" min={0} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
            </div>
            <div>
              <Label htmlFor="loan-installments">Installments</Label>
              <Input id="loan-installments" type="number" min={1} value={installments} onChange={(e) => setInstallments(Number(e.target.value))} />
            </div>
          </div>
          <div>
            <Label htmlFor="loan-start">Start month</Label>
            <Input id="loan-start" type="month" value={startMonth} onChange={(e) => setStartMonth(e.target.value)} />
          </div>
          <p className="text-xs text-muted-foreground">Monthly deduction: {formatMoney(moneyFromMajor(Math.round(amount / Math.max(1, installments)), "INR"))}</p>
          <Button
            disabled={!employeeId || amount <= 0}
            onClick={() => {
              requestLoan({ employeeId, amount: moneyFromMajor(amount, "INR"), interestPercent: 0, installments, startMonth }, ACTOR);
              setCreateOpen(false);
              setEmployeeId("");
            }}
          >
            Submit loan request
          </Button>
        </div>
      </DetailDrawer>
    </div>
  );
}
