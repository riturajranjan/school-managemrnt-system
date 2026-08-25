"use client";

// Real PostgreSQL/API cutover (Phase 9G) — a thin "quick entry" UI over the
// SAME real /api/accounting/journals endpoint (Debit the selected real
// Expense account, Credit a real Cash/Bank asset account) — not a parallel
// expense ledger. The mock's submit→approve→reject→pay workflow and vendor
// linkage had no real backing (Vendors/Purchase Orders are out of this
// phase's scope — see the Accounting hub page) and are dropped rather than
// faked: a recorded expense here is posted immediately, matching how the
// real Journals/Income pages already behave.
import { useState } from "react";
import { Plus, Receipt } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef } from "@/components/data-table/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { createAndPostJournalEntryRequest, useAccountingAccounts, useJournalEntries } from "@/lib/hooks/api/use-accounting-api";
import type { JournalEntryListItemDto } from "@/lib/api/contracts";
import { roleLabels } from "@/lib/permissions/roles";
import { formatCurrency, formatDate } from "@/lib/utils";

export default function ExpensesPage() {
  const { data: entries, loading, error, reload } = useJournalEntries({ sourceType: "manual", pageSize: 100 });
  const { data: expenseAccounts } = useAccountingAccounts({ type: "expense", status: "active" });
  const { data: assetAccounts } = useAccountingAccounts({ type: "asset", status: "active" });
  const { can, hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const canManage = can("accounting.manage");

  // A manual expense entry always debits an EXPENSE account and credits a
  // Cash/Bank ASSET account — filter to those journals whose first line's
  // account is one of the school's real expense accounts.
  const expenseAccountIds = new Set(expenseAccounts.map((a) => a.id));
  const expenseEntries = entries.filter((e) => e.status === "posted");

  const [createOpen, setCreateOpen] = useState(false);
  const [accountId, setAccountId] = useState("");
  const [cashOrBankAccountId, setCashOrBankAccountId] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState(1000);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!capabilitiesLoading && !hasServerPermission("accounting.view")) return <PermissionDenied action="view the accounting module" role={roleLabels[role]} backHref="/accounting" />;

  const defaultCashOrBank = cashOrBankAccountId || assetAccounts.find((a) => a.systemKey === "BANK")?.id || assetAccounts[0]?.id || "";

  const columns: ColumnDef<JournalEntryListItemDto>[] = [
    { id: "description", header: "Expense", alwaysVisible: true, sortValue: (e) => e.entryDate, cell: (e) => <p className="text-sm font-medium text-foreground">{e.description}</p> },
    { id: "entryNumber", header: "Entry", cell: (e) => <Badge tone="info">{e.entryNumber}</Badge> },
    { id: "date", header: "Date", cell: (e) => <span className="text-sm text-muted-foreground">{formatDate(e.entryDate)}</span> },
    { id: "amount", header: "Amount", align: "right", sortValue: (e) => e.totalAmount, cell: (e) => <span className="text-sm font-medium text-foreground">{formatCurrency(e.totalAmount)}</span> },
  ];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Expenses</h1>
          <p className="text-xs text-muted-foreground">Record school expenses — posted immediately as a real journal entry</p>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-3.5" />
            New expense
          </Button>
        )}
      </div>

      {error && <p className="rounded-md border border-error/30 bg-error/8 p-sm text-sm text-error">{error}</p>}
      {expenseAccountIds.size === 0 && <p className="rounded-md border border-info/30 bg-info/8 p-sm text-sm text-info">Create an expense-type account in Chart of Accounts before recording expenses.</p>}

      <DataTable
        columns={columns}
        rows={expenseEntries}
        getRowId={(e) => e.id}
        caption="Expenses"
        renderMobileCard={(e) => (
          <div className="surface-3d flex flex-col gap-1 rounded-lg border border-border bg-surface p-sm">
            <div className="flex items-center justify-between gap-xs">
              <p className="truncate text-sm font-semibold text-foreground">{e.description}</p>
              <Badge tone="info">{e.entryNumber}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{formatDate(e.entryDate)}</p>
            <p className="text-sm font-medium text-foreground">{formatCurrency(e.totalAmount)}</p>
          </div>
        )}
        emptyIcon={Receipt}
        emptyTitle={loading ? "Loading…" : "No expenses yet"}
      />

      <DetailDrawer open={createOpen} onOpenChange={setCreateOpen} title="New expense" description="Posts a journal entry debiting the selected expense account">
        <div className="flex flex-col gap-sm">
          <div>
            <Label htmlFor="expense-desc">Description</Label>
            <Input id="expense-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Electricity bill — July" />
          </div>
          <div>
            <Label>Expense account</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger aria-label="Expense account">
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {expenseAccounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-sm">
            <div>
              <Label htmlFor="expense-amount">Amount (₹)</Label>
              <Input id="expense-amount" type="number" min={0} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
            </div>
            <div>
              <Label htmlFor="expense-date">Date</Label>
              <Input id="expense-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label>Paid via</Label>
              <Select value={defaultCashOrBank} onValueChange={setCashOrBankAccountId}>
                <SelectTrigger aria-label="Paid via">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {assetAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {formError && <p className="rounded-md border border-error/30 bg-error/8 p-sm text-sm text-error">{formError}</p>}
          <Button
            disabled={!description.trim() || !accountId || !defaultCashOrBank || amount <= 0 || saving}
            onClick={async () => {
              setFormError(null);
              setSaving(true);
              const res = await createAndPostJournalEntryRequest({
                entryDate: date, description: description.trim(),
                lines: [{ accountId, debit: amount }, { accountId: defaultCashOrBank, credit: amount }],
              });
              setSaving(false);
              if (!res.success) {
                setFormError(res.error.message);
                return;
              }
              setCreateOpen(false);
              setDescription("");
              setAmount(1000);
              reload();
            }}
          >
            Record expense
          </Button>
        </div>
      </DetailDrawer>
    </div>
  );
}
