import { beforeEach, describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { moneyFromMajor, sumMoney, zeroMoney } from "@/lib/finance/money";
import { postJournalEntry, reverseJournalEntry } from "./journal-service";

const ACTOR = { name: "Accountant", role: "Accountant" };

describe("postJournalEntry", () => {
  beforeEach(() => resetDemoData());

  it("posts a balanced entry and rebuilds the ledger", () => {
    const result = postJournalEntry(
      { date: "2026-08-05", sourceType: "manual", narration: "Test entry", lines: [{ accountId: "coa-cash", debit: moneyFromMajor(500, "INR"), credit: zeroMoney("INR") }, { accountId: "coa-income-other-fee", debit: zeroMoney("INR"), credit: moneyFromMajor(500, "INR") }] },
      ACTOR,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(getSnapshot().journalEntries.some((e) => e.id === result.entry.id)).toBe(true);
    expect(getSnapshot().ledgerEntries.some((l) => l.journalEntryId === result.entry.id)).toBe(true);
  });

  it("refuses to post an unbalanced entry", () => {
    const countBefore = getSnapshot().journalEntries.length;
    const result = postJournalEntry(
      { date: "2026-08-05", sourceType: "manual", narration: "Unbalanced", lines: [{ accountId: "coa-cash", debit: moneyFromMajor(500, "INR"), credit: zeroMoney("INR") }, { accountId: "coa-income-other-fee", debit: zeroMoney("INR"), credit: moneyFromMajor(400, "INR") }] },
      ACTOR,
    );
    expect(result.ok).toBe(false);
    expect(getSnapshot().journalEntries.length).toBe(countBefore);
  });

  it("refuses to post an entry with no lines", () => {
    const result = postJournalEntry({ date: "2026-08-05", sourceType: "manual", narration: "Empty", lines: [] }, ACTOR);
    expect(result.ok).toBe(false);
  });

  it("assigns a sequential entry number continuing from existing entries", () => {
    const db = getSnapshot();
    const maxExisting = Math.max(...db.journalEntries.map((e) => Number(e.entryNumber.match(/(\d+)$/)?.[1] ?? 0)));
    const result = postJournalEntry(
      { date: "2026-08-05", sourceType: "manual", narration: "Sequence check", lines: [{ accountId: "coa-cash", debit: moneyFromMajor(1, "INR"), credit: zeroMoney("INR") }, { accountId: "coa-income-other-fee", debit: zeroMoney("INR"), credit: moneyFromMajor(1, "INR") }] },
      ACTOR,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(Number(result.entry.entryNumber.match(/(\d+)$/)?.[1])).toBe(maxExisting + 1);
  });

  it("keeps every posted entry in the store balanced (spot-check across the whole seed)", () => {
    const db = getSnapshot();
    for (const entry of db.journalEntries) {
      const totalDebit = sumMoney(entry.lines.map((l) => l.debit), "INR");
      const totalCredit = sumMoney(entry.lines.map((l) => l.credit), "INR");
      expect(totalDebit.minorUnits).toBe(totalCredit.minorUnits);
    }
  });
});

describe("reverseJournalEntry", () => {
  beforeEach(() => resetDemoData());

  it("creates a balanced reversal with debits and credits swapped", () => {
    const posted = postJournalEntry(
      { date: "2026-08-05", sourceType: "manual", narration: "To reverse", lines: [{ accountId: "coa-cash", debit: moneyFromMajor(500, "INR"), credit: zeroMoney("INR") }, { accountId: "coa-income-other-fee", debit: zeroMoney("INR"), credit: moneyFromMajor(500, "INR") }] },
      ACTOR,
    );
    if (!posted.ok) return;
    const reversed = reverseJournalEntry(posted.entry.id, "Data entry error", ACTOR);
    expect(reversed.ok).toBe(true);
    if (!reversed.ok) return;

    const cashLine = reversed.entry.lines.find((l) => l.accountId === "coa-cash")!;
    expect(cashLine.credit.minorUnits).toBe(moneyFromMajor(500, "INR").minorUnits);
    expect(cashLine.debit.minorUnits).toBe(0);

    const after = getSnapshot();
    expect(after.journalEntries.find((e) => e.id === posted.entry.id)?.status).toBe("reversed");
  });

  it("refuses to reverse an entry that doesn't exist", () => {
    const result = reverseJournalEntry("no-such-entry", "reason", ACTOR);
    expect(result.ok).toBe(false);
  });

  it("refuses to reverse an already-reversed entry", () => {
    const posted = postJournalEntry(
      { date: "2026-08-05", sourceType: "manual", narration: "To reverse twice", lines: [{ accountId: "coa-cash", debit: moneyFromMajor(200, "INR"), credit: zeroMoney("INR") }, { accountId: "coa-income-other-fee", debit: zeroMoney("INR"), credit: moneyFromMajor(200, "INR") }] },
      ACTOR,
    );
    if (!posted.ok) return;
    reverseJournalEntry(posted.entry.id, "First reversal", ACTOR);
    const second = reverseJournalEntry(posted.entry.id, "Second reversal", ACTOR);
    expect(second.ok).toBe(false);
  });
});
