"use client";

// Real PostgreSQL/API cutover (Phase 9G) — reads/writes the live
// /api/accounting/journals endpoint. Balance validation happens server-side
// (lib/server/accounting/journals.ts) — the client-side "Balanced" badge is
// UX only, never trusted as the authority.
import { useState } from "react";
import { AlertTriangle, BookOpen, Plus, RotateCcw, Trash2 } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef, RowAction } from "@/components/data-table/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermissions } from "@/components/providers/permissions-provider";
import { createAndPostJournalEntryRequest, reverseJournalEntryRequest, useAccountingAccounts, useJournalEntries, useJournalEntry } from "@/lib/hooks/api/use-accounting-api";
import type { JournalEntryListItemDto, JournalSourceTypeDto } from "@/lib/api/contracts";
import { formatCurrency, formatDate } from "@/lib/utils";

const sourceLabels: Record<JournalSourceTypeDto, string> = {
  manual: "Manual", fee_payment: "Fee payment", fee_refund: "Fee refund", payroll_payment: "Payroll payment",
  staff_advance_disbursement: "Loan/advance disbursement", staff_advance_repayment: "Loan/advance repayment",
};

type DraftLine = { accountId: string; side: "debit" | "credit"; amount: number };
function blankLine(): DraftLine {
  return { accountId: "", side: "debit", amount: 0 };
}

export default function JournalsPage() {
  const { data: entries, loading, error, reload } = useJournalEntries({ pageSize: 100 });
  const { data: accounts } = useAccountingAccounts({ status: "active" });
  const { can } = usePermissions();
  const canPost = can("accounting.manage");
  const canReverse = can("accounting.reverse");

  const [viewEntryId, setViewEntryId] = useState<string | null>(null);
  const { data: viewEntry } = useJournalEntry(viewEntryId);
  const [createOpen, setCreateOpen] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [narration, setNarration] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([blankLine(), blankLine()]);
  const [error2, setError2] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const totalDebit = lines.filter((l) => l.side === "debit").reduce((sum, l) => sum + l.amount, 0);
  const totalCredit = lines.filter((l) => l.side === "credit").reduce((sum, l) => sum + l.amount, 0);
  const balanced = totalDebit === totalCredit && totalDebit > 0;

  const columns: ColumnDef<JournalEntryListItemDto>[] = [
    {
      id: "entryNumber",
      header: "Entry",
      alwaysVisible: true,
      sortValue: (e) => e.entryNumber,
      cell: (e) => (
        <div>
          <p className="text-sm font-medium text-foreground">{e.entryNumber}</p>
          <p className="text-xs text-muted-foreground">{e.description}</p>
        </div>
      ),
    },
    { id: "source", header: "Source", cell: (e) => <Badge tone="info">{sourceLabels[e.sourceType]}</Badge> },
    { id: "date", header: "Date", sortValue: (e) => e.entryDate, cell: (e) => <span className="text-sm text-muted-foreground">{formatDate(e.entryDate)}</span> },
    { id: "amount", header: "Amount", align: "right", sortValue: (e) => e.totalAmount, cell: (e) => <span className="text-sm font-medium text-foreground">{formatCurrency(e.totalAmount)}</span> },
    { id: "status", header: "Status", align: "right", cell: (e) => <Badge tone={e.status === "posted" ? "success" : e.status === "reversed" ? "neutral" : "warning"}>{e.status === "posted" ? "Posted" : e.status === "reversed" ? "Reversed" : "Draft"}</Badge> },
  ];

  const rowActions: RowAction<JournalEntryListItemDto>[] = [
    { key: "view", label: "View lines", icon: <BookOpen className="size-3.5" />, onSelect: (e) => setViewEntryId(e.id) },
    ...(canReverse ? [{ key: "reverse", label: "Reverse", icon: <RotateCcw className="size-3.5" />, hidden: (e: JournalEntryListItemDto) => e.status !== "posted" || e.isReversed, destructive: true, onSelect: (e: JournalEntryListItemDto) => reverseJournalEntryRequest(e.id, { reason: "Correction" }).then(reload) }] : []),
  ];

  function updateLine(index: number, patch: Partial<DraftLine>) {
    setLines((current) => current.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }
  function resetForm() {
    setDate(new Date().toISOString().slice(0, 10));
    setNarration("");
    setLines([blankLine(), blankLine()]);
    setError2(null);
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Journals</h1>
          <p className="text-xs text-muted-foreground">Every posted double-entry journal — balanced by construction, corrected only by reversal</p>
        </div>
        {canPost && (
          <Button
            size="sm"
            onClick={() => {
              resetForm();
              setCreateOpen(true);
            }}
          >
            <Plus className="size-3.5" />
            Post manual journal
          </Button>
        )}
      </div>

      {error && <p className="rounded-md border border-error/30 bg-error/8 p-sm text-sm text-error">{error}</p>}
      {loading && entries.length === 0 && <p className="text-xs text-muted-foreground">Loading…</p>}

      <DataTable
        columns={columns}
        rows={entries}
        getRowId={(e) => e.id}
        caption="Journal entries"
        rowActions={rowActions}
        renderMobileCard={(e) => (
          <button type="button" onClick={() => setViewEntryId(e.id)} className="surface-3d flex w-full flex-col gap-1 rounded-lg border border-border bg-surface p-sm text-left">
            <div className="flex items-center justify-between gap-xs">
              <p className="truncate text-sm font-semibold text-foreground">{e.entryNumber}</p>
              <Badge tone={e.status === "posted" ? "success" : "neutral"}>{e.status === "posted" ? "Posted" : e.status === "reversed" ? "Reversed" : "Draft"}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{e.description}</p>
            <p className="text-sm font-medium text-foreground">{formatCurrency(e.totalAmount)}</p>
          </button>
        )}
        emptyIcon={BookOpen}
        emptyTitle="No journal entries yet"
      />

      <DetailDrawer open={!!viewEntryId} onOpenChange={(open) => !open && setViewEntryId(null)} title={viewEntry?.entryNumber ?? ""} description={viewEntry?.description}>
        {viewEntry && (
          <div className="flex flex-col gap-sm">
            <div className="flex flex-wrap gap-xs text-xs text-muted-foreground">
              <span>{formatDate(viewEntry.entryDate)}</span>
              <span>·</span>
              <span>{sourceLabels[viewEntry.sourceType]}</span>
              <span>·</span>
              <span>Posted by {viewEntry.createdByName ?? "—"}</span>
            </div>
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-surface-secondary text-xs text-muted-foreground">
                  <tr>
                    <th className="p-xs text-left">Account</th>
                    <th className="p-xs text-right">Debit</th>
                    <th className="p-xs text-right">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {viewEntry.lines.map((l) => (
                    <tr key={l.id} className="border-t border-border">
                      <td className="p-xs text-foreground">{l.accountName}</td>
                      <td className="p-xs text-right text-foreground">{l.debit > 0 ? formatCurrency(l.debit) : "—"}</td>
                      <td className="p-xs text-right text-foreground">{l.credit > 0 ? formatCurrency(l.credit) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {viewEntry.status === "reversed" && <p className="text-xs text-warning">This entry has been reversed.</p>}
          </div>
        )}
      </DetailDrawer>

      <DetailDrawer
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) resetForm();
        }}
        title="Post manual journal"
        description="Debits must equal credits before this can be posted"
      >
        <div className="flex flex-col gap-sm">
          {error2 && (
            <p className="flex items-center gap-1.5 rounded-md border border-error/30 bg-error/8 p-sm text-xs text-error">
              <AlertTriangle className="size-3.5 shrink-0" /> {error2}
            </p>
          )}
          <div className="grid grid-cols-2 gap-sm">
            <div>
              <Label htmlFor="je-date">Date</Label>
              <Input id="je-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="je-narration">Narration</Label>
              <Input id="je-narration" value={narration} onChange={(e) => setNarration(e.target.value)} placeholder="What is this entry for?" />
            </div>
          </div>

          <div className="flex flex-col gap-xs">
            {lines.map((line, i) => (
              <div key={i} className="flex items-end gap-xs">
                <div className="min-w-0 flex-1">
                  <Label>Account</Label>
                  <Select value={line.accountId} onValueChange={(v) => updateLine(i, { accountId: v })}>
                    <SelectTrigger aria-label={`Line ${i + 1} account`}>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-24">
                  <Label>Side</Label>
                  <Select value={line.side} onValueChange={(v) => updateLine(i, { side: v as "debit" | "credit" })}>
                    <SelectTrigger aria-label={`Line ${i + 1} side`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="debit">Debit</SelectItem>
                      <SelectItem value="credit">Credit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-24">
                  <Label>Amount</Label>
                  <Input type="number" min={0} value={line.amount} onChange={(e) => updateLine(i, { amount: Number(e.target.value) })} />
                </div>
                <Button variant="ghost" size="icon" disabled={lines.length <= 2} onClick={() => setLines((current) => current.filter((_, idx) => idx !== i))} aria-label={`Remove line ${i + 1}`}>
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
            <Button variant="secondary" size="sm" onClick={() => setLines((current) => [...current, blankLine()])}>
              <Plus className="size-3.5" />
              Add line
            </Button>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border bg-surface-secondary p-sm text-sm">
            <span className="text-muted-foreground">Debit {formatCurrency(totalDebit)}</span>
            <span className="text-muted-foreground">Credit {formatCurrency(totalCredit)}</span>
            <Badge tone={balanced ? "success" : "warning"}>{balanced ? "Balanced" : "Unbalanced"}</Badge>
          </div>

          <Button
            disabled={!balanced || !narration.trim() || lines.some((l) => !l.accountId) || saving}
            onClick={async () => {
              setError2(null);
              setSaving(true);
              const res = await createAndPostJournalEntryRequest({
                entryDate: date, description: narration.trim(),
                lines: lines.filter((l) => l.amount > 0).map((l) => ({ accountId: l.accountId, debit: l.side === "debit" ? l.amount : undefined, credit: l.side === "credit" ? l.amount : undefined })),
              });
              setSaving(false);
              if (!res.success) {
                setError2(res.error.message);
                return;
              }
              setCreateOpen(false);
              resetForm();
              reload();
            }}
          >
            Post journal
          </Button>
        </div>
      </DetailDrawer>
    </div>
  );
}
