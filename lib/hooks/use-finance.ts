"use client";

// Phase 9F: the Fees-domain hooks that used to live here (categories,
// structures, assignments, items, payments, receipts, discounts,
// scholarships, concessions, late-fee rules, reminders, refunds, credit
// balances) were deleted — zero remaining consumers after the real
// /api/fees/* cutover (see lib/hooks/api/use-fees-api.ts).
//
// Phase 9G: the Accounting-domain hooks that used to live here (vendors,
// purchase orders, expenses, chart of accounts, journal entries, ledger
// entries, budgets, bank accounts, cash accounts, cashier shifts, bank
// transactions) were deleted — zero remaining consumers after the real
// /api/accounting/* cutover (see lib/hooks/api/use-accounting-api.ts).
// Vendors/Purchase-Orders/Budgets pages remain mock (out of Phase 9G scope)
// but never consumed these hooks directly from this file's exports beyond
// their own now-removed usages.
//
// Payroll hooks below remain mock — Payroll is not migrated yet.
import { useMemo } from "react";
import { useSisStore } from "./use-store";

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
