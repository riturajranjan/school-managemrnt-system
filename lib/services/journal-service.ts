import { getSnapshot, setState, type Db } from "@/lib/data/store";
import type { JournalEntry, JournalLine, JournalSourceType } from "@/lib/types/accounting";
import { sumMoney } from "@/lib/finance/money";
import { buildLedgerFromJournal } from "@/lib/selectors/ledger";
import { generateId } from "@/lib/utils";
import { logFinancialAudit } from "./finance-audit-service";

type Actor = { name: string; role: string };

export type PostJournalInput = {
  date: string;
  sourceType: JournalSourceType;
  sourceId?: string;
  narration: string;
  lines: Omit<JournalLine, "id">[];
};

export type PostJournalResult = { ok: true; entry: JournalEntry } | { ok: false; error: string };

function nextEntryNumber(db: Db): string {
  const maxSeq = db.journalEntries.reduce((max, e) => {
    const match = e.entryNumber.match(/(\d+)$/);
    const seq = match ? Number(match[1]) : 0;
    return seq > max ? seq : max;
  }, 0);
  return `JE-${String(maxSeq + 1).padStart(6, "0")}`;
}

/** The one place any Phase 5 workflow posts a double-entry journal — enforces
 * the balanced-journal invariant (total debits === total credits) before
 * anything is written, and rebuilds the ledger from the complete journal
 * list afterward so running balances never drift. Posted entries are
 * immutable; corrections go through reverseJournalEntry(), never a direct edit. */
export function postJournalEntry(input: PostJournalInput, actor: Actor): PostJournalResult {
  const db = getSnapshot();
  if (input.lines.length === 0) return { ok: false, error: "A journal entry needs at least one line." };
  const currency = input.lines[0].debit.currency;
  const totalDebit = sumMoney(input.lines.map((l) => l.debit), currency);
  const totalCredit = sumMoney(input.lines.map((l) => l.credit), currency);
  if (totalDebit.minorUnits !== totalCredit.minorUnits) {
    return { ok: false, error: `Journal entry is not balanced — debits (${totalDebit.minorUnits / 100}) do not equal credits (${totalCredit.minorUnits / 100}).` };
  }

  const now = new Date().toISOString();
  const entry: JournalEntry = {
    id: generateId("je"),
    entryNumber: nextEntryNumber(db),
    date: input.date,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    narration: input.narration,
    lines: input.lines.map((l) => ({ ...l, id: generateId("jl") })),
    status: "posted",
    postedBy: actor.name,
    postedAt: now,
  };

  setState((current) => {
    const journalEntries = [...current.journalEntries, entry];
    return { ...current, journalEntries, ledgerEntries: buildLedgerFromJournal(journalEntries) };
  });

  logFinancialAudit({ subjectId: input.sourceId, action: "journal-posted", actorName: actor.name, actorRole: actor.role, summary: `Journal ${entry.entryNumber} posted: ${input.narration}` });
  return { ok: true, entry };
}

/** Posted journals are never edited or deleted — a correction is a new
 * entry with every line's debit/credit swapped, referencing the original. */
export function reverseJournalEntry(entryId: string, reason: string, actor: Actor): PostJournalResult {
  const db = getSnapshot();
  const original = db.journalEntries.find((e) => e.id === entryId);
  if (!original) return { ok: false, error: "Journal entry not found." };
  if (original.status === "reversed") return { ok: false, error: "This entry has already been reversed." };

  const now = new Date().toISOString();
  const reversal: JournalEntry = {
    id: generateId("je"),
    entryNumber: nextEntryNumber(db),
    date: now.slice(0, 10),
    sourceType: "adjustment",
    sourceId: entryId,
    narration: `Reversal of ${original.entryNumber}: ${reason}`,
    lines: original.lines.map((l) => ({ id: generateId("jl"), accountId: l.accountId, debit: l.credit, credit: l.debit, description: l.description })),
    status: "posted",
    reversalOfEntryId: original.id,
    postedBy: actor.name,
    postedAt: now,
  };

  setState((current) => {
    const journalEntries = [...current.journalEntries.map((e) => (e.id === entryId ? { ...e, status: "reversed" as const } : e)), reversal];
    return { ...current, journalEntries, ledgerEntries: buildLedgerFromJournal(journalEntries) };
  });

  logFinancialAudit({ subjectId: entryId, action: "journal-reversed", actorName: actor.name, actorRole: actor.role, summary: `Journal ${original.entryNumber} reversed via ${reversal.entryNumber}.`, reason });
  return { ok: true, entry: reversal };
}
