import type { JournalEntry, LedgerEntry } from "@/lib/types/accounting";
import { addMoney, subtractMoney, zeroMoney, type Money } from "@/lib/finance/money";
import { generateId } from "@/lib/utils";

/** Replays a set of posted journal entries into per-account running-balance
 * ledger rows, in date order — both the seed data and every live-posted
 * journal go through this same computation, so they can never drift out of
 * sync with each other. */
export function buildLedgerFromJournal(entries: JournalEntry[]): LedgerEntry[] {
  const sorted = [...entries].filter((e) => e.status === "posted").sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const runningBalances = new Map<string, Money>();
  const ledger: LedgerEntry[] = [];

  for (const entry of sorted) {
    for (const line of entry.lines) {
      const previous = runningBalances.get(line.accountId) ?? zeroMoney("INR");
      const next = addMoney(subtractMoney(previous, line.credit), line.debit);
      runningBalances.set(line.accountId, next);
      ledger.push({
        id: generateId("le"),
        ledgerType: "account",
        ledgerRefId: line.accountId,
        journalEntryId: entry.id,
        date: entry.date,
        debit: line.debit,
        credit: line.credit,
        runningBalance: next,
        reference: entry.entryNumber,
        source: entry.sourceType,
      });
    }
  }
  return ledger;
}

export function accountBalance(entries: LedgerEntry[], accountId: string): Money {
  const accountEntries = entries.filter((e) => e.ledgerRefId === accountId).sort((a, b) => (a.date < b.date ? -1 : 1));
  return accountEntries.length === 0 ? zeroMoney("INR") : accountEntries[accountEntries.length - 1].runningBalance;
}
