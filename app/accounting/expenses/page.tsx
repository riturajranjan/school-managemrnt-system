"use client";

import Link from "next/link";
import { Check, Plus, Receipt, X } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef, RowAction } from "@/components/data-table/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { addMoney, formatMoney } from "@/lib/finance/money";
import { approveExpense, markExpensePaid, rejectExpense } from "@/lib/services/income-expense-service";
import { expenseCategoryLabels, expenseStatusLabels, type Expense, type ExpenseStatus } from "@/lib/types/accounting";
import { formatDate } from "@/lib/utils";

const ACTOR = { name: "Finance Administrator", role: "Finance Administrator" };

const statusTone: Record<ExpenseStatus, "success" | "warning" | "error" | "neutral"> = {
  draft: "neutral",
  submitted: "warning",
  "under-review": "warning",
  approved: "neutral",
  rejected: "error",
  paid: "success",
  "partially-paid": "warning",
  cancelled: "error",
};

export default function ExpensesPage() {
  const db = useSisStore();
  const { can } = usePermissions();
  const canApprove = can("accounting.approveExpenses");
  const canManage = can("accounting.manageExpenses");

  function vendorName(id?: string) {
    if (!id) return "—";
    return db.vendors.find((v) => v.id === id)?.name ?? "—";
  }

  const columns: ColumnDef<Expense>[] = [
    {
      id: "description",
      header: "Expense",
      alwaysVisible: true,
      sortValue: (e) => e.date,
      cell: (e) => (
        <div>
          <p className="text-sm font-medium text-foreground">{e.description}</p>
          <p className="text-xs text-muted-foreground">
            {e.expenseNumber} · {vendorName(e.vendorId)}
          </p>
        </div>
      ),
    },
    { id: "category", header: "Category", cell: (e) => <Badge tone="info">{expenseCategoryLabels[e.category]}</Badge> },
    { id: "date", header: "Date", cell: (e) => <span className="text-sm text-muted-foreground">{formatDate(e.date)}</span> },
    { id: "amount", header: "Amount", align: "right", sortValue: (e) => e.amount.minorUnits + e.tax.minorUnits, cell: (e) => <span className="text-sm font-medium text-foreground">{formatMoney(addMoney(e.amount, e.tax))}</span> },
    { id: "status", header: "Status", align: "right", cell: (e) => <Badge tone={statusTone[e.status]}>{expenseStatusLabels[e.status]}</Badge> },
  ];

  const rowActions: RowAction<Expense>[] = [
    ...(canApprove
      ? [
          { key: "approve", label: "Approve", icon: <Check className="size-3.5" />, hidden: (e: Expense) => e.status !== "submitted" && e.status !== "under-review", onSelect: (e: Expense) => approveExpense(e.id, ACTOR) },
          { key: "reject", label: "Reject", icon: <X className="size-3.5" />, hidden: (e: Expense) => e.status !== "submitted" && e.status !== "under-review", destructive: true, onSelect: (e: Expense) => rejectExpense(e.id, "Not approved", ACTOR) },
        ]
      : []),
    ...(canManage ? [{ key: "pay", label: "Mark paid", icon: <Receipt className="size-3.5" />, hidden: (e: Expense) => e.status !== "approved", onSelect: (e: Expense) => markExpensePaid(e.id, ACTOR) }] : []),
  ];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Expenses</h1>
          <p className="text-xs text-muted-foreground">Submit, approve and pay school expenses</p>
        </div>
        {canManage && (
          <Button size="sm" asChild>
            <Link href="/accounting/expenses/new">
              <Plus className="size-3.5" />
              New expense
            </Link>
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={[...db.expenses].sort((a, b) => (a.date < b.date ? 1 : -1))}
        getRowId={(e) => e.id}
        caption="Expenses"
        rowActions={rowActions}
        renderMobileCard={(e) => (
          <div className="surface-3d flex flex-col gap-1 rounded-lg border border-border bg-surface p-sm">
            <div className="flex items-center justify-between gap-xs">
              <p className="truncate text-sm font-semibold text-foreground">{e.description}</p>
              <Badge tone={statusTone[e.status]}>{expenseStatusLabels[e.status]}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {e.expenseNumber} · {expenseCategoryLabels[e.category]} · {formatDate(e.date)}
            </p>
            <p className="text-sm font-medium text-foreground">{formatMoney(addMoney(e.amount, e.tax))}</p>
          </div>
        )}
        emptyIcon={Receipt}
        emptyTitle="No expenses yet"
      />
    </div>
  );
}
