import { getSnapshot, setState, type Db } from "@/lib/data/store";
import type { BankTransaction, ReconciliationRecord } from "@/lib/types/payments";
import { subtractMoney, type Money } from "@/lib/finance/money";
import { generateId } from "@/lib/utils";
import { logFinancialAudit } from "./finance-audit-service";

type Actor = { name: string; role: string };

export type MatchSuggestion = { bankTransactionId: string; paymentId: string; confidence: number; reasons: string[] };

function reconciledTransactionIds(db: Db): Set<string> {
  return new Set(db.reconciliationRecords.filter((r) => r.status !== "under-review" && r.bankTransactionId).map((r) => r.bankTransactionId!));
}

function reconciledPaymentIds(db: Db): Set<string> {
  return new Set(db.reconciliationRecords.filter((r) => (r.status === "matched" || r.status === "reconciled") && r.paymentId).map((r) => r.paymentId!));
}

/** Suggestions only — amount + date-proximity + reference overlap scored
 * into a 0-100 confidence, sorted best-first. Never writes anything; a human
 * always confirms via confirmMatch() before a match becomes real. */
export function computeMatchSuggestions(db: Db): MatchSuggestion[] {
  const doneTxns = reconciledTransactionIds(db);
  const donePayments = reconciledPaymentIds(db);
  const suggestions: MatchSuggestion[] = [];

  for (const txn of db.bankTransactions) {
    if (doneTxns.has(txn.id)) continue;
    for (const payment of db.payments) {
      if (payment.status !== "successful" || donePayments.has(payment.id)) continue;
      if (payment.amount.minorUnits !== txn.amount.minorUnits) continue;

      const dateDiffDays = Math.abs(new Date(txn.date).getTime() - new Date(payment.paidAt).getTime()) / (24 * 60 * 60 * 1000);
      if (dateDiffDays > 5) continue;

      let confidence = 60;
      const reasons = ["Amount matches"];
      if (dateDiffDays <= 1) {
        confidence += 25;
        reasons.push("Date matches");
      } else if (dateDiffDays <= 3) {
        confidence += 10;
        reasons.push("Date close");
      }
      if (payment.transactionReference && txn.reference.includes(payment.transactionReference)) {
        confidence += 15;
        reasons.push("Reference matches");
      }
      suggestions.push({ bankTransactionId: txn.id, paymentId: payment.id, confidence: Math.min(confidence, 100), reasons });
    }
  }

  return suggestions.sort((a, b) => b.confidence - a.confidence);
}

export function reconciliationStatusFor(db: Db, transactionId: string): ReconciliationRecord["status"] {
  const record = [...db.reconciliationRecords].reverse().find((r) => r.bankTransactionId === transactionId);
  return record?.status ?? "unmatched";
}

/** A transaction sharing amount, date and source with another still-unmatched
 * transaction is flagged so the workspace can surface it before a human
 * accidentally reconciles both against the same underlying payment. */
export function isDuplicateTransaction(db: Db, transactionId: string): boolean {
  const txn = db.bankTransactions.find((t) => t.id === transactionId);
  if (!txn) return false;
  return db.bankTransactions.some((t) => t.id !== transactionId && t.amount.minorUnits === txn.amount.minorUnits && t.date === txn.date && t.source === txn.source);
}

export function confirmMatch(bankTransactionId: string, paymentId: string, actor: Actor): ReconciliationRecord {
  const db = getSnapshot();
  const txn = db.bankTransactions.find((t) => t.id === bankTransactionId);
  const payment = db.payments.find((p) => p.id === paymentId);
  const difference: Money | undefined = txn && payment ? subtractMoney(txn.amount, payment.amount) : undefined;

  const record: ReconciliationRecord = {
    id: generateId("recon"),
    bankTransactionId,
    paymentId,
    status: "reconciled",
    difference,
    reconciledBy: actor.name,
    reconciledAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };
  setState((current) => ({ ...current, reconciliationRecords: [...current.reconciliationRecords, record] }));
  logFinancialAudit({ action: "reconciliation-completed", actorName: actor.name, actorRole: actor.role, summary: `Bank transaction matched to payment ${paymentId}.` });
  return record;
}

export function ignoreTransaction(bankTransactionId: string, reason: string, actor: Actor): ReconciliationRecord {
  const record: ReconciliationRecord = { id: generateId("recon"), bankTransactionId, status: "ignored", ignoredReason: reason, reconciledBy: actor.name, reconciledAt: new Date().toISOString(), createdAt: new Date().toISOString() };
  setState((current) => ({ ...current, reconciliationRecords: [...current.reconciliationRecords, record] }));
  logFinancialAudit({ action: "reconciliation-completed", actorName: actor.name, actorRole: actor.role, summary: `Bank transaction ignored.`, reason });
  return record;
}

/** Marks a transaction as a bank charge or settlement fee — real money the
 * gateway/bank deducted, not a student payment. Books it as an expense so
 * the P&L reflects it, and closes the reconciliation line. */
export function markAsFee(bankTransactionId: string, kind: "bank-charge" | "settlement-fee", actor: Actor): ReconciliationRecord | undefined {
  const db = getSnapshot();
  const txn = db.bankTransactions.find((t) => t.id === bankTransactionId);
  if (!txn) return undefined;
  const now = new Date().toISOString();
  const expenseNumber = `EXP-FEE-${String(db.expenses.length + 1).padStart(4, "0")}`;

  const record: ReconciliationRecord = { id: generateId("recon"), bankTransactionId, status: "reconciled", reconciledBy: actor.name, reconciledAt: now, createdAt: now };
  setState((current) => ({
    ...current,
    reconciliationRecords: [...current.reconciliationRecords, record],
    expenses: [
      ...current.expenses,
      {
        id: generateId("exp"),
        expenseNumber,
        date: txn.date,
        category: "other-expense",
        amount: txn.amount,
        tax: { minorUnits: 0, currency: txn.amount.currency },
        paymentMethod: "bank-transfer",
        branch: "main",
        description: kind === "bank-charge" ? "Bank charge (from reconciliation)" : "Payment gateway settlement fee (from reconciliation)",
        status: "paid",
        recurring: false,
        createdBy: actor.name,
        createdAt: now,
        paidAt: txn.date,
      },
    ],
  }));
  logFinancialAudit({ action: "expense-created", actorName: actor.name, actorRole: actor.role, summary: `Bank transaction booked as ${kind === "bank-charge" ? "a bank charge" : "a settlement fee"} (${expenseNumber}).` });
  return record;
}

export function undoReconciliation(bankTransactionId: string, actor: Actor) {
  setState((db) => ({ ...db, reconciliationRecords: db.reconciliationRecords.filter((r) => r.bankTransactionId !== bankTransactionId) }));
  logFinancialAudit({ action: "reconciliation-completed", actorName: actor.name, actorRole: actor.role, summary: `Reconciliation undone for a bank transaction.` });
}

export function findBankTransaction(id: string): BankTransaction | undefined {
  return getSnapshot().bankTransactions.find((t) => t.id === id);
}
