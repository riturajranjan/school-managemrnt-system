"use client";

import { useState } from "react";
import { BookOpen, Plus, RotateCcw, Trash2 } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef, RowAction } from "@/components/data-table/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useChartOfAccounts, useJournalEntries } from "@/lib/hooks/use-finance";
import { formatMoney, moneyFromMajor, sumMoney, zeroMoney } from "@/lib/finance/money";
import { postJournalEntry, reverseJournalEntry } from "@/lib/services/journal-service";
import { journalSourceTypeLabels, type JournalEntry } from "@/lib/types/accounting";
import { formatDate } from "@/lib/utils";

const ACTOR = { name: "Finance Administrator", role: "Finance Administrator" };

type DraftLine = { accountId: string; side: "debit" | "credit"; amount: number };

function blankLine(): DraftLine {
  return { accountId: "", side: "debit", amount: 0 };
}

export default function JournalsPage() {
  const entries = useJournalEntries();
  const accounts = useChartOfAccounts();
  const { can } = usePermissions();
  const canPost = can("accounting.postJournals");

  const [viewEntry, setViewEntry] = useState<JournalEntry | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [narration, setNarration] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([blankLine(), blankLine()]);
  const [error, setError] = useState<string | null>(null);

  function accountName(id: string) {
    return accounts.find((a) => a.id === id)?.name ?? id;
  }

  const totalDebit = lines.filter((l) => l.side === "debit").reduce((sum, l) => sum + l.amount, 0);
  const totalCredit = lines.filter((l) => l.side === "credit").reduce((sum, l) => sum + l.amount, 0);
  const balanced = totalDebit === totalCredit && totalDebit > 0;

  const columns: ColumnDef<JournalEntry>[] = [
    {
      id: "entryNumber",
      header: "Entry",
      alwaysVisible: true,
      sortValue: (e) => e.entryNumber,
      cell: (e) => (
        <div>
          <p className="text-sm font-medium text-foreground">{e.entryNumber}</p>
          <p className="text-xs text-muted-foreground">{e.narration}</p>
        </div>
      ),
    },
    { id: "source", header: "Source", cell: (e) => <Badge tone="info">{journalSourceTypeLabels[e.sourceType]}</Badge> },
    { id: "date", header: "Date", sortValue: (e) => e.date, cell: (e) => <span className="text-sm text-muted-foreground">{formatDate(e.date)}</span> },
    {
      id: "amount",
      header: "Amount",
      align: "right",
      sortValue: (e) => sumMoney(e.lines.map((l) => l.debit), "INR").minorUnits,
      cell: (e) => <span className="text-sm font-medium text-foreground">{formatMoney(sumMoney(e.lines.map((l) => l.debit), "INR"))}</span>,
    },
    { id: "status", header: "Status", align: "right", cell: (e) => <Badge tone={e.status === "posted" ? "success" : "neutral"}>{e.status === "posted" ? "Posted" : "Reversed"}</Badge> },
  ];

  const rowActions: RowAction<JournalEntry>[] = [
    { key: "view", label: "View lines", icon: <BookOpen className="size-3.5" />, onSelect: (e) => setViewEntry(e) },
    ...(canPost ? [{ key: "reverse", label: "Reverse", icon: <RotateCcw className="size-3.5" />, hidden: (e: JournalEntry) => e.status !== "posted", destructive: true, onSelect: (e: JournalEntry) => reverseJournalEntry(e.id, "Correction", ACTOR) }] : []),
  ];

  function updateLine(index: number, patch: Partial<DraftLine>) {
    setLines((current) => current.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function resetForm() {
    setDate(new Date().toISOString().slice(0, 10));
    setNarration("");
    setLines([blankLine(), blankLine()]);
    setError(null);
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

      <DataTable
        columns={columns}
        rows={[...entries].sort((a, b) => (a.postedAt < b.postedAt ? 1 : -1))}
        getRowId={(e) => e.id}
        caption="Journal entries"
        rowActions={rowActions}
        renderMobileCard={(e) => (
          <button type="button" onClick={() => setViewEntry(e)} className="surface-3d flex w-full flex-col gap-1 rounded-lg border border-border bg-surface p-sm text-left">
            <div className="flex items-center justify-between gap-xs">
              <p className="truncate text-sm font-semibold text-foreground">{e.entryNumber}</p>
              <Badge tone={e.status === "posted" ? "success" : "neutral"}>{e.status === "posted" ? "Posted" : "Reversed"}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{e.narration}</p>
            <p className="text-sm font-medium text-foreground">{formatMoney(sumMoney(e.lines.map((l) => l.debit), "INR"))}</p>
          </button>
        )}
        emptyIcon={BookOpen}
        emptyTitle="No journal entries yet"
      />

      <DetailDrawer open={!!viewEntry} onOpenChange={(open) => !open && setViewEntry(null)} title={viewEntry?.entryNumber ?? ""} description={viewEntry?.narration}>
        {viewEntry && (
          <div className="flex flex-col gap-sm">
            <div className="flex flex-wrap gap-xs text-xs text-muted-foreground">
              <span>{formatDate(viewEntry.date)}</span>
              <span>·</span>
              <span>{journalSourceTypeLabels[viewEntry.sourceType]}</span>
              <span>·</span>
              <span>Posted by {viewEntry.postedBy}</span>
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
                      <td className="p-xs text-foreground">{accountName(l.accountId)}</td>
                      <td className="p-xs text-right text-foreground">{l.debit.minorUnits > 0 ? formatMoney(l.debit) : "—"}</td>
                      <td className="p-xs text-right text-foreground">{l.credit.minorUnits > 0 ? formatMoney(l.credit) : "—"}</td>
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
          {error && <p className="text-xs text-error">{error}</p>}
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
            <span className="text-muted-foreground">Debit {formatMoney(moneyFromMajor(totalDebit, "INR"))}</span>
            <span className="text-muted-foreground">Credit {formatMoney(moneyFromMajor(totalCredit, "INR"))}</span>
            <Badge tone={balanced ? "success" : "warning"}>{balanced ? "Balanced" : "Unbalanced"}</Badge>
          </div>

          <Button
            disabled={!balanced || !narration.trim() || lines.some((l) => !l.accountId)}
            onClick={() => {
              const result = postJournalEntry(
                {
                  date,
                  sourceType: "manual",
                  narration: narration.trim(),
                  lines: lines
                    .filter((l) => l.amount > 0)
                    .map((l) => ({ accountId: l.accountId, debit: l.side === "debit" ? moneyFromMajor(l.amount, "INR") : zeroMoney("INR"), credit: l.side === "credit" ? moneyFromMajor(l.amount, "INR") : zeroMoney("INR") })),
                },
                ACTOR,
              );
              if (!result.ok) {
                setError(result.error);
                return;
              }
              setCreateOpen(false);
              resetForm();
            }}
          >
            Post journal
          </Button>
        </div>
      </DetailDrawer>
    </div>
  );
}
