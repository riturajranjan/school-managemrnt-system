"use client";

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
import { useChartOfAccounts, useLedgerEntries } from "@/lib/hooks/use-finance";
import { formatMoney } from "@/lib/finance/money";
import { accountBalance } from "@/lib/selectors/ledger";
import { createChartOfAccount } from "@/lib/services/chart-of-accounts-service";
import { chartOfAccountTypeLabels, type ChartOfAccount, type ChartOfAccountType } from "@/lib/types/accounting";

const ACTOR = { name: "Finance Administrator", role: "Finance Administrator" };
const typeOptions = Object.keys(chartOfAccountTypeLabels) as ChartOfAccountType[];

export default function ChartOfAccountsPage() {
  const accounts = useChartOfAccounts();
  const ledgerEntries = useLedgerEntries();
  const { can } = usePermissions();
  const canManage = can("accounting.manageChartOfAccounts");

  const [createOpen, setCreateOpen] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<ChartOfAccountType>("expense");

  const columns: ColumnDef<ChartOfAccount>[] = [
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
    { id: "type", header: "Type", cell: (a) => <Badge tone="info">{chartOfAccountTypeLabels[a.type]}</Badge> },
    {
      id: "balance",
      header: "Balance",
      align: "right",
      sortValue: (a) => accountBalance(ledgerEntries, a.id).minorUnits,
      cell: (a) => <span className="text-sm font-medium text-foreground">{formatMoney(accountBalance(ledgerEntries, a.id))}</span>,
    },
    { id: "status", header: "Status", align: "right", cell: (a) => <Badge tone={a.status === "active" ? "success" : "neutral"}>{a.status === "active" ? "Active" : "Inactive"}</Badge> },
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

      <DataTable
        columns={columns}
        rows={[...accounts].sort((a, b) => a.code.localeCompare(b.code))}
        getRowId={(a) => a.id}
        caption="Chart of accounts"
        renderMobileCard={(a) => (
          <div className="surface-3d flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{a.name}</p>
              <p className="text-xs text-muted-foreground">
                {a.code} · {chartOfAccountTypeLabels[a.type]}
              </p>
            </div>
            <span className="shrink-0 text-sm font-medium text-foreground">{formatMoney(accountBalance(ledgerEntries, a.id))}</span>
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
            <Select value={type} onValueChange={(v) => setType(v as ChartOfAccountType)}>
              <SelectTrigger aria-label="Account type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {typeOptions.map((t) => (
                  <SelectItem key={t} value={t}>
                    {chartOfAccountTypeLabels[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            disabled={!code.trim() || !name.trim()}
            onClick={() => {
              createChartOfAccount({ code: code.trim(), name: name.trim(), type }, ACTOR);
              setCreateOpen(false);
              setCode("");
              setName("");
            }}
          >
            Create account
          </Button>
        </div>
      </DetailDrawer>
    </div>
  );
}
