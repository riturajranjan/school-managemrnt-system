import { describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { sumMoney, zeroMoney } from "@/lib/finance/money";

describe("finance seed data", () => {
  it("gives every active student's class a fee structure", () => {
    resetDemoData();
    const db = getSnapshot();
    const activeStudents = db.students.filter((s) => s.status === "active");
    const structuredClassIds = new Set(db.feeStructures.flatMap((s) => s.applicableClassIds));
    const uncovered = activeStudents.filter((s) => !structuredClassIds.has(s.classId));
    expect(uncovered).toEqual([]);
  });

  it("assigns exactly one active fee assignment per active student", () => {
    resetDemoData();
    const db = getSnapshot();
    const activeStudents = db.students.filter((s) => s.status === "active");
    for (const student of activeStudents) {
      const assignments = db.studentFeeAssignments.filter((a) => a.studentId === student.id);
      expect(assignments.length).toBe(1);
      expect(assignments[0].status).toBe("active");
    }
  });

  it("never lets a fee item's paid amount exceed what was actually billed net of discounts", () => {
    resetDemoData();
    const db = getSnapshot();
    for (const item of db.studentFeeItems) {
      const netDue = item.billedAmount.minorUnits - item.discountAmount.minorUnits - item.scholarshipAmount.minorUnits;
      expect(item.paidAmount.minorUnits).toBeLessThanOrEqual(netDue);
    }
  });

  it("keeps every posted journal entry balanced — total debits equal total credits", () => {
    resetDemoData();
    const db = getSnapshot();
    expect(db.journalEntries.length).toBeGreaterThan(0);
    for (const entry of db.journalEntries) {
      const totalDebit = sumMoney(entry.lines.map((l) => l.debit), "INR");
      const totalCredit = sumMoney(entry.lines.map((l) => l.credit), "INR");
      expect(totalDebit.minorUnits).toBe(totalCredit.minorUnits);
    }
  });

  it("produces ledger entries whose final running balance per account matches the net of all its journal lines", () => {
    resetDemoData();
    const db = getSnapshot();
    const accountId = "coa-income-tuition";
    const journalLines = db.journalEntries.flatMap((e) => e.lines.filter((l) => l.accountId === accountId));
    const expectedBalance = sumMoney(
      journalLines.map((l) => ({ minorUnits: l.debit.minorUnits - l.credit.minorUnits, currency: "INR" as const })),
      "INR",
    );
    const accountLedgerEntries = db.ledgerEntries.filter((l) => l.ledgerRefId === accountId).sort((a, b) => (a.date < b.date ? -1 : 1));
    const lastEntry = accountLedgerEntries[accountLedgerEntries.length - 1];
    expect(lastEntry?.runningBalance.minorUnits ?? 0).toBe(expectedBalance.minorUnits);
  });

  it("generates exactly one receipt per payment, and every receipt total matches its payment amount", () => {
    resetDemoData();
    const db = getSnapshot();
    expect(db.payments.length).toBeGreaterThan(0);
    for (const payment of db.payments) {
      const receipt = db.receipts.find((r) => r.paymentId === payment.id);
      expect(receipt).toBeDefined();
      expect(receipt?.total.minorUnits).toBe(payment.amount.minorUnits);
      expect(payment.receiptId).toBe(receipt?.id);
    }
  });

  it("never issues a duplicate receipt number", () => {
    resetDemoData();
    const db = getSnapshot();
    const numbers = db.receipts.map((r) => r.receiptNumber);
    expect(new Set(numbers).size).toBe(numbers.length);
  });

  it("splits payment allocations across fee items so their sum equals the payment amount", () => {
    resetDemoData();
    const db = getSnapshot();
    for (const payment of db.payments) {
      const allocations = db.paymentAllocations.filter((a) => a.paymentId === payment.id);
      const total = sumMoney(
        allocations.map((a) => a.amount),
        "INR",
      );
      expect(total.minorUnits).toBe(payment.amount.minorUnits);
    }
  });

  it("only ever generates a July payroll run whose employee net-pay totals sum to the run total", () => {
    resetDemoData();
    const db = getSnapshot();
    const run = db.payrollRuns.find((r) => r.period === "2026-07");
    expect(run).toBeDefined();
    if (!run) return;
    const summedNet = sumMoney(
      run.employees.map((e) => e.netPay),
      "INR",
    );
    expect(summedNet.minorUnits).toBe(run.totalNet.minorUnits);
    expect(run.totalNet.minorUnits).toBeGreaterThan(0);
  });

  it("computes a non-zero opening chart of accounts with no duplicate account codes", () => {
    resetDemoData();
    const db = getSnapshot();
    expect(db.chartOfAccounts.length).toBeGreaterThan(0);
    const codes = db.chartOfAccounts.map((a) => a.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const account of db.chartOfAccounts) {
      expect(account.openingBalance.minorUnits).toBe(zeroMoney("INR").minorUnits);
    }
  });
});
