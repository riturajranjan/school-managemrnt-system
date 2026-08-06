"use client";

import { useState } from "react";
import { Banknote, Landmark, Lock, LockOpen, Wallet } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef, RowAction } from "@/components/data-table/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatTile } from "@/components/ui/stat-tile";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useBankAccounts, useCashAccounts, useCashierShifts, useLedgerEntries } from "@/lib/hooks/use-finance";
import { formatMoney, moneyFromMajor } from "@/lib/finance/money";
import { accountBalance } from "@/lib/selectors/ledger";
import { closeCashierShift, openCashierShift } from "@/lib/services/cashier-shift-service";
import type { BankAccount, CashAccount, CashierShift } from "@/lib/types/accounting";
import { formatDate } from "@/lib/utils";

const ACTOR = { name: "Cashier", role: "Cashier" };

export default function BankAndCashPage() {
  const bankAccounts = useBankAccounts();
  const cashAccounts = useCashAccounts();
  const cashierShifts = useCashierShifts();
  const ledgerEntries = useLedgerEntries();
  const { can } = usePermissions();
  const canManage = can("accounting.manageBank");

  const [openShiftDrawer, setOpenShiftDrawer] = useState(false);
  const [closeShift, setCloseShift] = useState<CashierShift | null>(null);
  const [cashierName, setCashierName] = useState("");
  const [openingCash, setOpeningCash] = useState(2000);
  const [actualClosing, setActualClosing] = useState(0);
  const [notes, setNotes] = useState("");

  const openShifts = cashierShifts.filter((s) => s.status === "open");

  const bankColumns: ColumnDef<BankAccount>[] = [
    {
      id: "bankName",
      header: "Bank account",
      alwaysVisible: true,
      cell: (b) => (
        <div>
          <p className="text-sm font-medium text-foreground">{b.bankName}</p>
          <p className="text-xs text-muted-foreground">
            {b.accountNumber} {b.ifsc ? `· ${b.ifsc}` : ""}
          </p>
        </div>
      ),
    },
    { id: "balance", header: "Balance", align: "right", cell: (b) => <span className="text-sm font-medium text-foreground">{formatMoney(accountBalance(ledgerEntries, b.accountId))}</span> },
    { id: "status", header: "Status", align: "right", cell: (b) => <Badge tone={b.status === "active" ? "success" : "neutral"}>{b.status === "active" ? "Active" : "Inactive"}</Badge> },
  ];

  const cashColumns: ColumnDef<CashAccount>[] = [
    { id: "name", header: "Register", alwaysVisible: true, cell: (c) => <span className="text-sm font-medium text-foreground">{c.name}</span> },
    { id: "type", header: "Type", cell: (c) => <Badge tone="info">{c.type === "main" ? "Main cash" : "Petty cash"}</Badge> },
    { id: "balance", header: "Balance", align: "right", cell: (c) => <span className="text-sm font-medium text-foreground">{formatMoney(accountBalance(ledgerEntries, c.accountId))}</span> },
  ];

  const shiftColumns: ColumnDef<CashierShift>[] = [
    {
      id: "cashierName",
      header: "Cashier",
      alwaysVisible: true,
      cell: (s) => (
        <div>
          <p className="text-sm font-medium text-foreground">{s.cashierName}</p>
          <p className="text-xs text-muted-foreground">Opened {formatDate(s.openedAt)}</p>
        </div>
      ),
    },
    { id: "opening", header: "Opening cash", align: "right", cell: (s) => <span className="text-sm text-muted-foreground">{formatMoney(s.openingCash)}</span> },
    { id: "collections", header: "Collections", align: "right", cell: (s) => <span className="text-sm text-foreground">{formatMoney(s.cashCollections)}</span> },
    { id: "expected", header: "Expected closing", align: "right", cell: (s) => <span className="text-sm text-foreground">{formatMoney(s.expectedClosing)}</span> },
    {
      id: "difference",
      header: "Difference",
      align: "right",
      cell: (s) => (s.difference ? <span className={`text-sm font-medium ${s.difference.minorUnits === 0 ? "text-foreground" : s.difference.minorUnits > 0 ? "text-success" : "text-error"}`}>{formatMoney(s.difference)}</span> : <span className="text-sm text-muted-foreground">—</span>),
    },
    { id: "status", header: "Status", align: "right", cell: (s) => <Badge tone={s.status === "open" ? "warning" : "success"}>{s.status === "open" ? "Open" : "Closed"}</Badge> },
  ];

  const shiftRowActions: RowAction<CashierShift>[] = canManage
    ? [
        {
          key: "close",
          label: "Close shift",
          icon: <Lock className="size-3.5" />,
          hidden: (s) => s.status !== "open",
          onSelect: (s) => {
            setCloseShift(s);
            setActualClosing(s.expectedClosing.minorUnits / 100);
            setNotes("");
          },
        },
      ]
    : [];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Bank & cash</h1>
          <p className="text-xs text-muted-foreground">Bank accounts, cash registers and cashier shift reconciliation</p>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setOpenShiftDrawer(true)}>
            <LockOpen className="size-3.5" />
            Open cash register
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-3">
        <StatTile label="Bank accounts" value={String(bankAccounts.length)} icon={Landmark} tone="neutral" />
        <StatTile label="Cash registers" value={String(cashAccounts.length)} icon={Wallet} tone="neutral" />
        <StatTile label="Open shifts" value={String(openShifts.length)} icon={Banknote} tone={openShifts.length > 0 ? "warning" : "success"} />
      </div>

      <div>
        <h2 className="mb-xs text-sm font-semibold text-foreground">Bank accounts</h2>
        <DataTable
          columns={bankColumns}
          rows={bankAccounts}
          getRowId={(b) => b.id}
          caption="Bank accounts"
          renderMobileCard={(b) => (
            <div className="surface-3d flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{b.bankName}</p>
                <p className="text-xs text-muted-foreground">{b.accountNumber}</p>
              </div>
              <span className="shrink-0 text-sm font-medium text-foreground">{formatMoney(accountBalance(ledgerEntries, b.accountId))}</span>
            </div>
          )}
          emptyIcon={Landmark}
          emptyTitle="No bank accounts configured"
        />
      </div>

      <div>
        <h2 className="mb-xs text-sm font-semibold text-foreground">Cash registers</h2>
        <DataTable
          columns={cashColumns}
          rows={cashAccounts}
          getRowId={(c) => c.id}
          caption="Cash registers"
          renderMobileCard={(c) => (
            <div className="surface-3d flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{c.name}</p>
                <p className="text-xs text-muted-foreground">{c.type === "main" ? "Main cash" : "Petty cash"}</p>
              </div>
              <span className="shrink-0 text-sm font-medium text-foreground">{formatMoney(accountBalance(ledgerEntries, c.accountId))}</span>
            </div>
          )}
          emptyIcon={Wallet}
          emptyTitle="No cash registers configured"
        />
      </div>

      <div>
        <h2 className="mb-xs text-sm font-semibold text-foreground">Cashier shifts</h2>
        <DataTable
          columns={shiftColumns}
          rows={[...cashierShifts].sort((a, b) => (a.openedAt < b.openedAt ? 1 : -1))}
          getRowId={(s) => s.id}
          caption="Cashier shifts"
          rowActions={shiftRowActions}
          renderMobileCard={(s) => (
            <div className="surface-3d flex flex-col gap-1 rounded-lg border border-border bg-surface p-sm">
              <div className="flex items-center justify-between gap-xs">
                <p className="truncate text-sm font-semibold text-foreground">{s.cashierName}</p>
                <Badge tone={s.status === "open" ? "warning" : "success"}>{s.status === "open" ? "Open" : "Closed"}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">Opened {formatDate(s.openedAt)}</p>
              <p className="text-sm text-foreground">Expected {formatMoney(s.expectedClosing)}</p>
            </div>
          )}
          emptyIcon={Banknote}
          emptyTitle="No cashier shifts yet"
        />
      </div>

      <DetailDrawer open={openShiftDrawer} onOpenChange={setOpenShiftDrawer} title="Open cash register" description="Starts a new shift with a counted opening float">
        <div className="flex flex-col gap-sm">
          <div>
            <Label htmlFor="shift-cashier">Cashier name</Label>
            <Input id="shift-cashier" value={cashierName} onChange={(e) => setCashierName(e.target.value)} placeholder="e.g. Priya Nair" />
          </div>
          <div>
            <Label htmlFor="shift-opening">Opening cash (₹)</Label>
            <Input id="shift-opening" type="number" min={0} value={openingCash} onChange={(e) => setOpeningCash(Number(e.target.value))} />
          </div>
          <Button
            disabled={!cashierName.trim()}
            onClick={() => {
              const result = openCashierShift({ cashierName: cashierName.trim(), branch: "main", openingCash: moneyFromMajor(openingCash, "INR") }, ACTOR);
              if (result.ok) {
                setOpenShiftDrawer(false);
                setCashierName("");
              }
            }}
          >
            Open register
          </Button>
        </div>
      </DetailDrawer>

      <DetailDrawer open={!!closeShift} onOpenChange={(open) => !open && setCloseShift(null)} title="Close cash register" description={closeShift ? `Expected closing: ${formatMoney(closeShift.expectedClosing)}` : undefined}>
        {closeShift && (
          <div className="flex flex-col gap-sm">
            <div>
              <Label htmlFor="shift-actual">Actual counted cash (₹)</Label>
              <Input id="shift-actual" type="number" min={0} value={actualClosing} onChange={(e) => setActualClosing(Number(e.target.value))} />
            </div>
            <div>
              <Label htmlFor="shift-notes">Notes</Label>
              <Input id="shift-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional — explain any variance" />
            </div>
            <Button
              onClick={() => {
                const result = closeCashierShift(closeShift.id, moneyFromMajor(actualClosing, "INR"), notes.trim() || undefined, ACTOR);
                if (result.ok) setCloseShift(null);
              }}
            >
              Close register
            </Button>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}
