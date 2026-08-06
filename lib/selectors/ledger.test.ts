import { describe, expect, it } from "vitest";
import { moneyFromMajor, zeroMoney } from "@/lib/finance/money";
import { accountBalance, buildLedgerFromJournal } from "./ledger";
import type { JournalEntry } from "@/lib/types/accounting";

function entry(overrides: Partial<JournalEntry>): JournalEntry {
  return {
    id: "je-1",
    entryNumber: "JE-000001",
    date: "2026-08-01",
    sourceType: "manual",
    narration: "Test",
    lines: [],
    status: "posted",
    postedBy: "Tester",
    postedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("buildLedgerFromJournal", () => {
  it("computes a running balance per account across multiple entries in date order", () => {
    const entries: JournalEntry[] = [
      entry({ id: "je-1", entryNumber: "JE-000001", date: "2026-08-01", lines: [{ id: "jl-1", accountId: "coa-cash", debit: moneyFromMajor(500, "INR"), credit: zeroMoney("INR") }, { id: "jl-2", accountId: "coa-income-other-fee", debit: zeroMoney("INR"), credit: moneyFromMajor(500, "INR") }] }),
      entry({ id: "je-2", entryNumber: "JE-000002", date: "2026-08-02", lines: [{ id: "jl-3", accountId: "coa-cash", debit: moneyFromMajor(200, "INR"), credit: zeroMoney("INR") }, { id: "jl-4", accountId: "coa-income-other-fee", debit: zeroMoney("INR"), credit: moneyFromMajor(200, "INR") }] }),
    ];
    const ledger = buildLedgerFromJournal(entries);
    const cashEntries = ledger.filter((l) => l.ledgerRefId === "coa-cash").sort((a, b) => (a.date < b.date ? -1 : 1));
    expect(cashEntries[0].runningBalance.minorUnits).toBe(moneyFromMajor(500, "INR").minorUnits);
    expect(cashEntries[1].runningBalance.minorUnits).toBe(moneyFromMajor(700, "INR").minorUnits);
  });

  it("excludes reversed entries from the ledger", () => {
    const entries: JournalEntry[] = [entry({ status: "reversed", lines: [{ id: "jl-1", accountId: "coa-cash", debit: moneyFromMajor(100, "INR"), credit: zeroMoney("INR") }] })];
    expect(buildLedgerFromJournal(entries)).toHaveLength(0);
  });

  it("sorts entries by date before replaying, regardless of input order", () => {
    const entries: JournalEntry[] = [
      entry({ id: "je-2", date: "2026-08-02", lines: [{ id: "jl-2", accountId: "coa-cash", debit: moneyFromMajor(100, "INR"), credit: zeroMoney("INR") }] }),
      entry({ id: "je-1", date: "2026-08-01", lines: [{ id: "jl-1", accountId: "coa-cash", debit: moneyFromMajor(50, "INR"), credit: zeroMoney("INR") }] }),
    ];
    const ledger = buildLedgerFromJournal(entries).sort((a, b) => (a.date < b.date ? -1 : 1));
    expect(ledger[0].runningBalance.minorUnits).toBe(moneyFromMajor(50, "INR").minorUnits);
    expect(ledger[1].runningBalance.minorUnits).toBe(moneyFromMajor(150, "INR").minorUnits);
  });
});

describe("accountBalance", () => {
  it("returns zero for an account with no ledger entries", () => {
    expect(accountBalance([], "coa-cash").minorUnits).toBe(0);
  });

  it("returns the most recent running balance for the account", () => {
    const entries: JournalEntry[] = [entry({ lines: [{ id: "jl-1", accountId: "coa-cash", debit: moneyFromMajor(300, "INR"), credit: zeroMoney("INR") }] })];
    const ledger = buildLedgerFromJournal(entries);
    expect(accountBalance(ledger, "coa-cash").minorUnits).toBe(moneyFromMajor(300, "INR").minorUnits);
  });
});
