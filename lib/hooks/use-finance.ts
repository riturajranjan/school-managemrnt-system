"use client";

// Phase 9F: the Fees-domain hooks that used to live here (categories,
// structures, assignments, items, payments, receipts, discounts,
// scholarships, concessions, late-fee rules, reminders, refunds, credit
// balances) were deleted — zero remaining consumers after the real
// /api/fees/* cutover (see lib/hooks/api/use-fees-api.ts). Accounting/Payroll
// hooks below remain mock — those modules are not migrated yet.
import { useMemo } from "react";
import { useSisStore } from "./use-store";

export function useVendors() {
  const db = useSisStore();
  return db.vendors;
}

export function usePurchaseOrders() {
  const db = useSisStore();
  return db.purchaseOrders;
}

export function useExpenses() {
  const db = useSisStore();
  return db.expenses;
}

export function useChartOfAccounts() {
  const db = useSisStore();
  return db.chartOfAccounts;
}

export function useJournalEntries() {
  const db = useSisStore();
  return db.journalEntries;
}

export function useLedgerEntries(ledgerRefId?: string) {
  const db = useSisStore();
  return useMemo(() => (ledgerRefId ? db.ledgerEntries.filter((l) => l.ledgerRefId === ledgerRefId) : db.ledgerEntries), [db.ledgerEntries, ledgerRefId]);
}

export function useBudgets() {
  const db = useSisStore();
  return db.budgets;
}

export function useBankAccounts() {
  const db = useSisStore();
  return db.bankAccounts;
}

export function useCashAccounts() {
  const db = useSisStore();
  return db.cashAccounts;
}

export function useCashierShifts() {
  const db = useSisStore();
  return db.cashierShifts;
}

export function useBankTransactions() {
  const db = useSisStore();
  return db.bankTransactions;
}

export function useSalaryStructures() {
  const db = useSisStore();
  return db.salaryStructures;
}

export function usePayrollRuns() {
  const db = useSisStore();
  return db.payrollRuns;
}

export function usePayslips(employeeId?: string) {
  const db = useSisStore();
  return useMemo(() => (employeeId ? db.payslips.filter((p) => p.employeeId === employeeId) : db.payslips), [db.payslips, employeeId]);
}

export function useEmployeeLoans(employeeId?: string) {
  const db = useSisStore();
  return useMemo(() => (employeeId ? db.employeeLoans.filter((l) => l.employeeId === employeeId) : db.employeeLoans), [db.employeeLoans, employeeId]);
}

export function useEmployeeAdvances(employeeId?: string) {
  const db = useSisStore();
  return useMemo(() => (employeeId ? db.employeeAdvances.filter((a) => a.employeeId === employeeId) : db.employeeAdvances), [db.employeeAdvances, employeeId]);
}
