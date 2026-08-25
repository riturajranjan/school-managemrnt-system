"use client";

// Real PostgreSQL/API cutover (Phase 9G) — a thin "quick entry" UI over the
// SAME real /api/accounting/journals endpoint the Journals page uses (Debit
// a real Cash/Bank asset account, Credit the selected real Income account) —
// not a parallel income ledger. The mock's fixed IncomeCategory enum is
// replaced by a real Income-type Chart-of-Accounts account picker (never a
// fake category); "Received via" now picks a real ASSET account (the
// CASH/BANK system accounts always exist — see accounts.ts's
// ensureCoreSystemAccounts — plus any other real asset account the school
// has created).
import { useState } from "react";
import { Plus, TrendingUp } from "lucide-react";
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

export default function IncomePage() {
  const { data: entries, loading, error, reload } = useJournalEntries({ sourceType: "manual", pageSize: 100 });
  const incomeEntries = entries.filter((e) => e.status === "posted");
  const { data: incomeAccounts } = useAccountingAccounts({ type: "income", status: "active" });
  const { data: assetAccounts } = useAccountingAccounts({ type: "asset", status: "active" });
  const { can, hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const canManage = can("accounting.manage");

  const [createOpen, setCreateOpen] = useState(false);
  const [accountId, setAccountId] = useState("");
  const [cashOrBankAccountId, setCashOrBankAccountId] = useState("");
  const [source, setSource] = useState("");
  const [amount, setAmount] = useState(1000);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!capabilitiesLoading && !hasServerPermission("accounting.view")) return <PermissionDenied action="view the accounting module" role={roleLabels[role]} backHref="/accounting" />;

  const total = incomeEntries.reduce((s, e) => s + e.totalAmount, 0);
  const defaultCashOrBank = cashOrBankAccountId || assetAccounts.find((a) => a.systemKey === "BANK")?.id || assetAccounts[0]?.id || "";

  const columns: ColumnDef<JournalEntryListItemDto>[] = [
    { id: "description", header: "Source", alwaysVisible: true, sortValue: (e) => e.entryDate, cell: (e) => <p className="text-sm font-medium text-foreground">{e.description}</p> },
    { id: "entryNumber", header: "Entry", cell: (e) => <Badge tone="info">{e.entryNumber}</Badge> },
    { id: "date", header: "Date", sortValue: (e) => e.entryDate, cell: (e) => <span className="text-sm text-muted-foreground">{formatDate(e.entryDate)}</span> },
    { id: "amount", header: "Amount", align: "right", sortValue: (e) => e.totalAmount, cell: (e) => <span className="text-sm font-medium text-foreground">{formatCurrency(e.totalAmount)}</span> },
  ];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Income</h1>
          <p className="text-xs text-muted-foreground">Non-fee income — donations, grants, sponsorships and more · Total {formatCurrency(total)}</p>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-3.5" />
            Record income
          </Button>
        )}
      </div>

      {error && <p className="rounded-md border border-error/30 bg-error/8 p-sm text-sm text-error">{error}</p>}

      <DataTable
        columns={columns}
        rows={incomeEntries}
        getRowId={(e) => e.id}
        caption="Income"
        renderMobileCard={(e) => (
          <div className="surface-3d flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{e.description}</p>
              <p className="text-xs text-muted-foreground">{e.entryNumber} · {formatDate(e.entryDate)}</p>
            </div>
            <span className="shrink-0 text-sm font-medium text-foreground">{formatCurrency(e.totalAmount)}</span>
          </div>
        )}
        emptyIcon={TrendingUp}
        emptyTitle={loading ? "Loading…" : "No income recorded yet"}
      />

      <DetailDrawer open={createOpen} onOpenChange={setCreateOpen} title="Record income" description="Posts a journal entry crediting the selected income account">
        <div className="flex flex-col gap-sm">
          <div>
            <Label htmlFor="income-source">Source</Label>
            <Input id="income-source" value={source} onChange={(e) => setSource(e.target.value)} placeholder="e.g. Alumni donation" />
          </div>
          <div>
            <Label>Income account</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger aria-label="Income account">
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {incomeAccounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-sm">
            <div>
              <Label htmlFor="income-amount">Amount (₹)</Label>
              <Input id="income-amount" type="number" min={0} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
            </div>
            <div>
              <Label htmlFor="income-date">Date</Label>
              <Input id="income-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label>Received via</Label>
              <Select value={defaultCashOrBank} onValueChange={setCashOrBankAccountId}>
                <SelectTrigger aria-label="Received via">
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
            disabled={!source.trim() || !accountId || !defaultCashOrBank || amount <= 0 || saving}
            onClick={async () => {
              setFormError(null);
              setSaving(true);
              const res = await createAndPostJournalEntryRequest({
                entryDate: date, description: source.trim(),
                lines: [{ accountId, credit: amount }, { accountId: defaultCashOrBank, debit: amount }],
              });
              setSaving(false);
              if (!res.success) {
                setFormError(res.error.message);
                return;
              }
              setCreateOpen(false);
              setSource("");
              setAmount(1000);
              reload();
            }}
          >
            Record income
          </Button>
        </div>
      </DetailDrawer>
    </div>
  );
}
