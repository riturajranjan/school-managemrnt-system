import { getSnapshot, setState } from "@/lib/data/store";
import type { EmployeeAdvance, EmployeeAdvanceType, EmployeeLoan } from "@/lib/types/payroll";
import { zeroMoney, type Money } from "@/lib/finance/money";
import { generateId } from "@/lib/utils";
import { logFinancialAudit } from "./finance-audit-service";

type Actor = { name: string; role: string };
type Result = { ok: true } | { ok: false; error: string };

export type LoanRequestInput = { employeeId: string; amount: Money; interestPercent: number; installments: number; startMonth: string; supportingDocumentName?: string };

export function requestLoan(input: LoanRequestInput, actor: Actor): EmployeeLoan {
  const monthlyDeduction: Money = { minorUnits: Math.round(input.amount.minorUnits / Math.max(1, input.installments)), currency: input.amount.currency };
  const loan: EmployeeLoan = {
    id: generateId("loan"),
    employeeId: input.employeeId,
    amount: input.amount,
    interestPercent: input.interestPercent,
    installments: input.installments,
    startMonth: input.startMonth,
    monthlyDeduction,
    outstandingBalance: input.amount,
    status: "submitted",
    supportingDocumentName: input.supportingDocumentName,
    createdAt: new Date().toISOString(),
  };
  setState((db) => ({ ...db, employeeLoans: [...db.employeeLoans, loan] }));
  logFinancialAudit({ action: "loan-approved", actorName: actor.name, actorRole: actor.role, summary: `Loan of ${input.amount.minorUnits / 100} requested for employee ${input.employeeId}.` });
  return loan;
}

export function approveLoan(loanId: string, actor: Actor): Result {
  const db = getSnapshot();
  const loan = db.employeeLoans.find((l) => l.id === loanId);
  if (!loan) return { ok: false, error: "Loan not found." };
  if (loan.status !== "submitted") return { ok: false, error: `Cannot approve a loan in "${loan.status}" status.` };
  setState((current) => ({ ...current, employeeLoans: current.employeeLoans.map((l) => (l.id === loanId ? { ...l, status: "active", approvedBy: actor.name } : l)) }));
  logFinancialAudit({ action: "loan-approved", actorName: actor.name, actorRole: actor.role, summary: `Loan for employee ${loan.employeeId} approved — recovery starts ${loan.startMonth}.` });
  return { ok: true };
}

export function rejectLoan(loanId: string, reason: string, actor: Actor): Result {
  const db = getSnapshot();
  const loan = db.employeeLoans.find((l) => l.id === loanId);
  if (!loan) return { ok: false, error: "Loan not found." };
  if (loan.status !== "submitted") return { ok: false, error: `Cannot reject a loan in "${loan.status}" status.` };
  setState((current) => ({ ...current, employeeLoans: current.employeeLoans.map((l) => (l.id === loanId ? { ...l, status: "rejected" } : l)) }));
  logFinancialAudit({ action: "loan-approved", actorName: actor.name, actorRole: actor.role, summary: `Loan for employee ${loan.employeeId} rejected.`, reason });
  return { ok: true };
}

export function closeLoanEarly(loanId: string, actor: Actor): Result {
  const db = getSnapshot();
  const loan = db.employeeLoans.find((l) => l.id === loanId);
  if (!loan) return { ok: false, error: "Loan not found." };
  if (loan.status !== "active") return { ok: false, error: "Only an active loan can be closed." };
  setState((current) => ({ ...current, employeeLoans: current.employeeLoans.map((l) => (l.id === loanId ? { ...l, status: "closed", outstandingBalance: zeroMoney(l.outstandingBalance.currency) } : l)) }));
  logFinancialAudit({ action: "loan-approved", actorName: actor.name, actorRole: actor.role, summary: `Loan for employee ${loan.employeeId} closed early (paid off outside payroll).` });
  return { ok: true };
}

export type AdvanceRequestInput = { employeeId: string; type: EmployeeAdvanceType; amount: Money; deductionAmount: Money };

export function requestAdvance(input: AdvanceRequestInput, actor: Actor): EmployeeAdvance {
  const advance: EmployeeAdvance = {
    id: generateId("advance"),
    employeeId: input.employeeId,
    type: input.type,
    amount: input.amount,
    deductionAmount: input.deductionAmount,
    outstandingBalance: input.amount,
    status: "submitted",
    createdAt: new Date().toISOString(),
  };
  setState((db) => ({ ...db, employeeAdvances: [...db.employeeAdvances, advance] }));
  logFinancialAudit({ action: "advance-approved", actorName: actor.name, actorRole: actor.role, summary: `Advance of ${input.amount.minorUnits / 100} requested for employee ${input.employeeId}.` });
  return advance;
}

export function approveAdvance(advanceId: string, actor: Actor): Result {
  const db = getSnapshot();
  const advance = db.employeeAdvances.find((a) => a.id === advanceId);
  if (!advance) return { ok: false, error: "Advance not found." };
  if (advance.status !== "submitted") return { ok: false, error: `Cannot approve an advance in "${advance.status}" status.` };
  setState((current) => ({ ...current, employeeAdvances: current.employeeAdvances.map((a) => (a.id === advanceId ? { ...a, status: "active", approvedBy: actor.name } : a)) }));
  logFinancialAudit({ action: "advance-approved", actorName: actor.name, actorRole: actor.role, summary: `Advance for employee ${advance.employeeId} approved.` });
  return { ok: true };
}

export function rejectAdvance(advanceId: string, reason: string, actor: Actor): Result {
  const db = getSnapshot();
  const advance = db.employeeAdvances.find((a) => a.id === advanceId);
  if (!advance) return { ok: false, error: "Advance not found." };
  if (advance.status !== "submitted") return { ok: false, error: `Cannot reject an advance in "${advance.status}" status.` };
  setState((current) => ({ ...current, employeeAdvances: current.employeeAdvances.map((a) => (a.id === advanceId ? { ...a, status: "rejected" } : a)) }));
  logFinancialAudit({ action: "advance-approved", actorName: actor.name, actorRole: actor.role, summary: `Advance for employee ${advance.employeeId} rejected.`, reason });
  return { ok: true };
}
