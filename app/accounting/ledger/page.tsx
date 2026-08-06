"use client";

import { useMemo, useState } from "react";
import { ScrollText } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef } from "@/components/data-table/types";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatTile } from "@/components/ui/stat-tile";
import { useChartOfAccounts, useLedgerEntries } from "@/lib/hooks/use-finance";
import { formatMoney } from "@/lib/finance/money";
import { accountBalance } from "@/lib/selectors/ledger";
import { chartOfAccountTypeLabels, journalSourceTypeLabels, type LedgerEntry } from "@/lib/types/accounting";
import { formatDate } from "@/lib/utils";

export default function LedgerPage() {
  const accounts = useChartOfAccounts();
  const allLedgerEntries = useLedgerEntries();
  const [accountId, setAccountId] = useState<string>(accounts[0]?.id ?? "");

  const account = accounts.find((a) => a.id === accountId);
  const entries = useMemo(() => [...allLedgerEntries.filter((l) => l.ledgerRefId === accountId)].sort((a, b) => (a.date < b.date ? -1 : 1)), [allLedgerEntries, accountId]);
  const balance = accountBalance(allLedgerEntries, accountId);
  const totalDebit = entries.reduce((sum, e) => sum + e.debit.minorUnits, 0);
  const totalCredit = entries.reduce((sum, e) => sum + e.credit.minorUnits, 0);

  const columns: ColumnDef<LedgerEntry>[] = [
    { id: "date", header: "Date", alwaysVisible: true, sortValue: (e) => e.date, cell: (e) => <span className="text-sm text-foreground">{formatDate(e.date)}</span> },
    { id: "reference", header: "Reference", cell: (e) => <span className="text-sm text-muted-foreground">{e.reference}</span> },
    { id: "source", header: "Source", cell: (e) => <Badge tone="info">{journalSourceTypeLabels[e.source]}</Badge>, defaultVisible: false },
    { id: "debit", header: "Debit", align: "right", cell: (e) => <span className="text-sm text-foreground">{e.debit.minorUnits > 0 ? formatMoney(e.debit) : "—"}</span> },
    { id: "credit", header: "Credit", align: "right", cell: (e) => <span className="text-sm text-foreground">{e.credit.minorUnits > 0 ? formatMoney(e.credit) : "—"}</span> },
    { id: "balance", header: "Running balance", align: "right", cell: (e) => <span className="text-sm font-medium text-foreground">{formatMoney(e.runningBalance)}</span> },
  ];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Ledger</h1>
        <p className="text-xs text-muted-foreground">Running balance per account, replayed from every posted journal</p>
      </div>

      <div className="max-w-xs">
        <Select value={accountId} onValueChange={setAccountId}>
          <SelectTrigger aria-label="Account">
            <SelectValue placeholder="Select account" />
          </SelectTrigger>
          <SelectContent>
            {accounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.code} — {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {account && (
        <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
          <StatTile label="Account type" value={chartOfAccountTypeLabels[account.type]} tone="neutral" />
          <StatTile label="Total debit" value={formatMoney({ minorUnits: totalDebit, currency: "INR" }, { compact: true })} tone="neutral" />
          <StatTile label="Total credit" value={formatMoney({ minorUnits: totalCredit, currency: "INR" }, { compact: true })} tone="neutral" />
          <StatTile label="Current balance" value={formatMoney(balance, { compact: true })} tone={balance.minorUnits >= 0 ? "success" : "error"} />
        </div>
      )}

      <DataTable
        columns={columns}
        rows={entries}
        getRowId={(e) => e.id}
        caption="Ledger entries"
        renderMobileCard={(e) => (
          <div className="surface-3d flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{e.reference}</p>
              <p className="text-xs text-muted-foreground">{formatDate(e.date)}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm text-foreground">{e.debit.minorUnits > 0 ? `Dr ${formatMoney(e.debit)}` : `Cr ${formatMoney(e.credit)}`}</p>
              <p className="text-xs text-muted-foreground">{formatMoney(e.runningBalance)}</p>
            </div>
          </div>
        )}
        emptyIcon={ScrollText}
        emptyTitle="No ledger movement for this account"
      />
    </div>
  );
}
