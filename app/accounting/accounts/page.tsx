"use client";

// Real PostgreSQL/API cutover (Phase 9G) — reads/writes the live
// /api/accounting/accounts endpoint. Balances are server-derived from
// POSTED journal lines (lib/server/accounting/accounts.ts), never
// reconstructed client-side.
import { useState } from "react";
import { Boxes, Plus } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef } from "@/components/data-table/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermissions } from "@/components/providers/permissions-provider";
import { createAccountingAccountRequest, useAccountingAccounts } from "@/lib/hooks/api/use-accounting-api";
import type { AccountingAccountDto, AccountingAccountTypeDto } from "@/lib/api/contracts";
import { formatCurrency } from "@/lib/utils";

const typeLabels: Record<AccountingAccountTypeDto, string> = { asset: "Asset", liability: "Liability", equity: "Equity", income: "Income", expense: "Expense" };
const typeOptions = Object.keys(typeLabels) as AccountingAccountTypeDto[];

export default function ChartOfAccountsPage() {
  const { data: accounts, loading, error, reload } = useAccountingAccounts();
  const { can } = usePermissions();
  const canManage = can("accounting.manage");

  const [createOpen, setCreateOpen] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountingAccountTypeDto>("expense");
  const [formError, setFormError] = useState<string | null>(null);

  const columns: ColumnDef<AccountingAccountDto>[] = [
    {
      id: "name",
      header: "Account",
      alwaysVisible: true,
      sortValue: (a) => a.code,
      cell: (a) => (
        <div>
          <p className="text-sm font-medium text-foreground">{a.name}</p>
          <p className="text-xs text-muted-foreground">{a.code}</p>
        </div>
      ),
    },
    { id: "type", header: "Type", cell: (a) => <Badge tone="info">{typeLabels[a.type]}</Badge> },
    { id: "balance", header: "Balance", align: "right", sortValue: (a) => a.balance, cell: (a) => <span className="text-sm font-medium text-foreground">{formatCurrency(a.balance)}</span> },
    { id: "status", header: "Status", align: "right", cell: (a) => <Badge tone={a.status === "active" ? "success" : "neutral"}>{a.status === "active" ? "Active" : "Archived"}</Badge> },
  ];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Chart of accounts</h1>
          <p className="text-xs text-muted-foreground">Asset, liability, income and expense accounts with live running balances</p>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-3.5" />
            New account
          </Button>
        )}
      </div>

      {error && <p className="rounded-md border border-error/30 bg-error/8 p-sm text-sm text-error">{error}</p>}
      {loading && accounts.length === 0 && <p className="text-xs text-muted-foreground">Loading…</p>}

      <DataTable
        columns={columns}
        rows={accounts}
        getRowId={(a) => a.id}
        caption="Chart of accounts"
        renderMobileCard={(a) => (
          <div className="surface-3d flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{a.name}</p>
              <p className="text-xs text-muted-foreground">
                {a.code} · {typeLabels[a.type]}
              </p>
            </div>
            <span className="shrink-0 text-sm font-medium text-foreground">{formatCurrency(a.balance)}</span>
          </div>
        )}
        emptyIcon={Boxes}
        emptyTitle="No accounts yet"
      />

      <DetailDrawer open={createOpen} onOpenChange={setCreateOpen} title="New account" description="Added to the chart of accounts with a zero opening balance">
        <div className="flex flex-col gap-sm">
          <div>
            <Label htmlFor="coa-code">Account code</Label>
            <Input id="coa-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. 5080" />
          </div>
          <div>
            <Label htmlFor="coa-name">Account name</Label>
            <Input id="coa-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Insurance Expense" />
          </div>
          <div>
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as AccountingAccountTypeDto)}>
              <SelectTrigger aria-label="Account type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {typeOptions.map((t) => (
                  <SelectItem key={t} value={t}>
                    {typeLabels[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {formError && <p className="rounded-md border border-error/30 bg-error/8 p-sm text-sm text-error">{formError}</p>}
          <Button
            disabled={!code.trim() || !name.trim()}
            onClick={async () => {
              setFormError(null);
              const res = await createAccountingAccountRequest({ code: code.trim(), name: name.trim(), type });
              if (!res.success) {
                setFormError(res.error.message);
                return;
              }
              setCreateOpen(false);
              setCode("");
              setName("");
              reload();
            }}
          >
            Create account
          </Button>
        </div>
      </DetailDrawer>
    </div>
  );
}
