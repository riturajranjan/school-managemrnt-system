"use client";

import { useState } from "react";
import { Check, Plus, Receipt, X } from "lucide-react";
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
import { useEmployeeAdvances } from "@/lib/hooks/use-finance";
import { formatMoney, moneyFromMajor } from "@/lib/finance/money";
import { approveAdvance, rejectAdvance, requestAdvance } from "@/lib/services/loan-advance-service";
import { employeeAdvanceTypeLabels, loanStatusLabels, type EmployeeAdvance, type EmployeeAdvanceType, type LoanStatus } from "@/lib/types/payroll";
import { formatDate } from "@/lib/utils";

const ACTOR = { name: "Finance Administrator", role: "Finance Administrator" };
const typeOptions = Object.keys(employeeAdvanceTypeLabels) as EmployeeAdvanceType[];

const statusTone: Record<LoanStatus, "success" | "warning" | "error" | "neutral"> = {
  draft: "neutral",
  submitted: "warning",
  approved: "neutral",
  rejected: "error",
  active: "success",
  closed: "neutral",
};

export default function AdvancesPage() {
  const advances = useEmployeeAdvances();
  const teachers = useTeachers();
  const { can } = usePermissions();
  const canManage = can("payroll.manageLoans");

  const [createOpen, setCreateOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [type, setType] = useState<EmployeeAdvanceType>("salary-advance");
  const [amount, setAmount] = useState(10000);
  const [deductionAmount, setDeductionAmount] = useState(5000);

  function employeeName(id: string) {
    return teachers.find((t) => t.id === id)?.name ?? id;
  }

  const columns: ColumnDef<EmployeeAdvance>[] = [
    {
      id: "employee",
      header: "Employee",
      alwaysVisible: true,
      cell: (a) => (
        <div>
          <p className="text-sm font-medium text-foreground">{employeeName(a.employeeId)}</p>
          <p className="text-xs text-muted-foreground">{employeeAdvanceTypeLabels[a.type]}</p>
        </div>
      ),
    },
    { id: "amount", header: "Amount", align: "right", cell: (a) => <span className="text-sm text-foreground">{formatMoney(a.amount)}</span> },
    { id: "deduction", header: "Monthly deduction", align: "right", cell: (a) => <span className="text-sm text-foreground">{formatMoney(a.deductionAmount)}</span> },
    { id: "outstanding", header: "Outstanding", align: "right", cell: (a) => <span className="text-sm font-medium text-foreground">{formatMoney(a.outstandingBalance)}</span> },
    { id: "status", header: "Status", align: "right", cell: (a) => <Badge tone={statusTone[a.status]}>{loanStatusLabels[a.status]}</Badge> },
  ];

  const rowActions: RowAction<EmployeeAdvance>[] = canManage
    ? [
        { key: "approve", label: "Approve", icon: <Check className="size-3.5" />, hidden: (a) => a.status !== "submitted", onSelect: (a) => approveAdvance(a.id, ACTOR) },
        { key: "reject", label: "Reject", icon: <X className="size-3.5" />, hidden: (a) => a.status !== "submitted", destructive: true, onSelect: (a) => rejectAdvance(a.id, "Not approved", ACTOR) },
      ]
    : [];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Employee advances</h1>
          <p className="text-xs text-muted-foreground">Salary and emergency advances, recovered through payroll</p>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-3.5" />
            New advance
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={[...advances].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))}
        getRowId={(a) => a.id}
        caption="Employee advances"
        rowActions={rowActions}
        renderMobileCard={(a) => (
          <div className="surface-3d flex flex-col gap-1 rounded-lg border border-border bg-surface p-sm">
            <div className="flex items-center justify-between gap-xs">
              <p className="truncate text-sm font-semibold text-foreground">{employeeName(a.employeeId)}</p>
              <Badge tone={statusTone[a.status]}>{loanStatusLabels[a.status]}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {employeeAdvanceTypeLabels[a.type]} · {formatDate(a.createdAt)}
            </p>
            <p className="text-sm font-medium text-foreground">{formatMoney(a.outstandingBalance)} outstanding</p>
          </div>
        )}
        emptyIcon={Receipt}
        emptyTitle="No employee advances"
      />

      <DetailDrawer open={createOpen} onOpenChange={setCreateOpen} title="New employee advance" description="Submitted for approval before it can be recovered through payroll">
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
          <div>
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as EmployeeAdvanceType)}>
              <SelectTrigger aria-label="Advance type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {typeOptions.map((t) => (
                  <SelectItem key={t} value={t}>
                    {employeeAdvanceTypeLabels[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-sm">
            <div>
              <Label htmlFor="adv-amount">Amount (₹)</Label>
              <Input id="adv-amount" type="number" min={0} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
            </div>
            <div>
              <Label htmlFor="adv-deduction">Monthly deduction (₹)</Label>
              <Input id="adv-deduction" type="number" min={0} value={deductionAmount} onChange={(e) => setDeductionAmount(Number(e.target.value))} />
            </div>
          </div>
          <Button
            disabled={!employeeId || amount <= 0}
            onClick={() => {
              requestAdvance({ employeeId, type, amount: moneyFromMajor(amount, "INR"), deductionAmount: moneyFromMajor(deductionAmount, "INR") }, ACTOR);
              setCreateOpen(false);
              setEmployeeId("");
            }}
          >
            Submit advance request
          </Button>
        </div>
      </DetailDrawer>
    </div>
  );
}
