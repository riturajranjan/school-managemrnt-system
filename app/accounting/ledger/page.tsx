"use client";

// Real PostgreSQL/API cutover (Phase 9G) — reads GET /api/accounting/ledger.
// Running balance is computed server-side (lib/server/accounting/ledger.ts),
// replayed in deterministic order (entryDate, createdAt, id) from POSTED
// lines only.
import { useState } from "react";
import { ScrollText } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef } from "@/components/data-table/types";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatTile } from "@/components/ui/stat-tile";
import { useAccountLedger, useAccountingAccounts } from "@/lib/hooks/api/use-accounting-api";
import type { LedgerEntryDto } from "@/lib/api/contracts";
import { formatCurrency, formatDate } from "@/lib/utils";

const typeLabels: Record<string, string> = { asset: "Asset", liability: "Liability", equity: "Equity", income: "Income", expense: "Expense" };
const sourceLabels: Record<string, string> = { manual: "Manual", fee_payment: "Fee payment", fee_refund: "Fee refund", payroll_payment: "Payroll payment", staff_advance_disbursement: "Loan/advance disbursement", staff_advance_repayment: "Loan/advance repayment" };

export default function LedgerPage() {
  const { data: accounts } = useAccountingAccounts();
  const [accountId, setAccountId] = useState<string>("");
  const selectedId = accountId || accounts[0]?.id || null;
  const { data: ledger, loading } = useAccountLedger(selectedId);

  const entries = ledger?.entries ?? [];
  const totalDebit = entries.reduce((sum, e) => sum + e.debit, 0);
  const totalCredit = entries.reduce((sum, e) => sum + e.credit, 0);

  const columns: ColumnDef<LedgerEntryDto>[] = [
    { id: "date", header: "Date", alwaysVisible: true, sortValue: (e) => e.entryDate, cell: (e) => <span className="text-sm text-foreground">{formatDate(e.entryDate)}</span> },
    { id: "reference", header: "Reference", cell: (e) => <span className="text-sm text-muted-foreground">{e.entryNumber} · {e.description}</span> },
    { id: "source", header: "Source", cell: (e) => <Badge tone="info">{sourceLabels[e.sourceType]}</Badge>, defaultVisible: false },
    { id: "debit", header: "Debit", align: "right", cell: (e) => <span className="text-sm text-foreground">{e.debit > 0 ? formatCurrency(e.debit) : "—"}</span> },
    { id: "credit", header: "Credit", align: "right", cell: (e) => <span className="text-sm text-foreground">{e.credit > 0 ? formatCurrency(e.credit) : "—"}</span> },
    { id: "balance", header: "Running balance", align: "right", cell: (e) => <span className="text-sm font-medium text-foreground">{formatCurrency(e.runningBalance)}</span> },
  ];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Ledger</h1>
        <p className="text-xs text-muted-foreground">Running balance per account, replayed from every posted journal</p>
      </div>

      <div>
        <Select value={selectedId ?? ""} onValueChange={setAccountId}>
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

      {ledger && (
        <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
          <StatTile label="Account type" value={typeLabels[ledger.account.type]} tone="neutral" />
          <StatTile label="Total debit" value={formatCurrency(totalDebit)} tone="neutral" />
          <StatTile label="Total credit" value={formatCurrency(totalCredit)} tone="neutral" />
          <StatTile label="Current balance" value={formatCurrency(ledger.closingBalance)} tone={ledger.closingBalance >= 0 ? "success" : "error"} />
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
              <p className="truncate text-sm font-medium text-foreground">{e.entryNumber}</p>
              <p className="text-xs text-muted-foreground">{formatDate(e.entryDate)}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm text-foreground">{e.debit > 0 ? `Dr ${formatCurrency(e.debit)}` : `Cr ${formatCurrency(e.credit)}`}</p>
              <p className="text-xs text-muted-foreground">{formatCurrency(e.runningBalance)}</p>
            </div>
          </div>
        )}
        emptyIcon={ScrollText}
        emptyTitle={loading ? "Loading…" : "No ledger movement for this account"}
      />
    </div>
  );
}
