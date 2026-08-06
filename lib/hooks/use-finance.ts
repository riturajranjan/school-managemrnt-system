"use client";

import { useMemo } from "react";
import { useSisStore } from "./use-store";

export function useFeeCategories() {
  const db = useSisStore();
  return db.feeCategories;
}

export function useFeeStructures() {
  const db = useSisStore();
  return db.feeStructures;
}

export function useFeeStructure(structureId: string | undefined) {
  const db = useSisStore();
  return useMemo(() => db.feeStructures.find((s) => s.id === structureId), [db.feeStructures, structureId]);
}

export function useStudentFeeAssignments(studentId?: string) {
  const db = useSisStore();
  return useMemo(() => (studentId ? db.studentFeeAssignments.filter((a) => a.studentId === studentId) : db.studentFeeAssignments), [db.studentFeeAssignments, studentId]);
}

export function useStudentFeeItems(studentId?: string) {
  const db = useSisStore();
  return useMemo(() => (studentId ? db.studentFeeItems.filter((i) => i.studentId === studentId) : db.studentFeeItems), [db.studentFeeItems, studentId]);
}

export function usePayments(studentId?: string) {
  const db = useSisStore();
  return useMemo(() => (studentId ? db.payments.filter((p) => p.studentId === studentId) : db.payments), [db.payments, studentId]);
}

export function useReceipts(studentId?: string) {
  const db = useSisStore();
  return useMemo(() => (studentId ? db.receipts.filter((r) => r.studentId === studentId) : db.receipts), [db.receipts, studentId]);
}

export function useReceipt(receiptId: string | undefined) {
  const db = useSisStore();
  return useMemo(() => db.receipts.find((r) => r.id === receiptId), [db.receipts, receiptId]);
}

export function useDiscounts(studentId?: string) {
  const db = useSisStore();
  return useMemo(() => (studentId ? db.discounts.filter((d) => d.studentId === studentId) : db.discounts), [db.discounts, studentId]);
}

export function useScholarships(studentId?: string) {
  const db = useSisStore();
  return useMemo(() => (studentId ? db.scholarships.filter((s) => s.studentId === studentId) : db.scholarships), [db.scholarships, studentId]);
}

export function useConcessions(studentId?: string) {
  const db = useSisStore();
  return useMemo(() => (studentId ? db.concessions.filter((c) => c.studentId === studentId) : db.concessions), [db.concessions, studentId]);
}

export function useLateFeeRules() {
  const db = useSisStore();
  return db.lateFeeRules;
}

export function useReminderRules() {
  const db = useSisStore();
  return db.reminderRules;
}

export function useReminderLog(studentId?: string) {
  const db = useSisStore();
  return useMemo(() => (studentId ? db.reminderLog.filter((r) => r.studentId === studentId) : db.reminderLog), [db.reminderLog, studentId]);
}

export function useRefunds(studentId?: string) {
  const db = useSisStore();
  return useMemo(() => (studentId ? db.refunds.filter((r) => r.studentId === studentId) : db.refunds), [db.refunds, studentId]);
}

export function useCreditBalances(studentId?: string) {
  const db = useSisStore();
  return useMemo(() => (studentId ? db.creditBalances.filter((c) => c.studentId === studentId) : db.creditBalances), [db.creditBalances, studentId]);
}

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
