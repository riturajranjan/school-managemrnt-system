import { getSnapshot, setState, type Db } from "@/lib/data/store";
import type { PayrollEmployeeException, PayrollEmployeeLine, PayrollRun, Payslip, SalaryStructure } from "@/lib/types/payroll";
import { addMoney, subtractMoney, sumMoney, zeroMoney } from "@/lib/finance/money";
import { grossAfterProration, resolveSalaryStructure } from "@/lib/selectors/salary-calc";
import { generateId } from "@/lib/utils";
import { logFinancialAudit } from "./finance-audit-service";
import { postJournalEntry } from "./journal-service";

type Actor = { name: string; role: string };
type Result = { ok: true } | { ok: false; error: string };

const DEFAULT_WORKING_DAYS = 26;

function computeEmployeeLine(db: Db, structure: SalaryStructure, employeeName: string, attendanceDays: number, workingDays: number): PayrollEmployeeLine {
  const { grossPay } = grossAfterProration(structure, attendanceDays, workingDays);
  const { deductions, totalDeductions } = resolveSalaryStructure(structure);
  const currency = structure.currency;

  const loanDeduction = sumMoney(
    db.employeeLoans.filter((l) => l.employeeId === structure.employeeId && l.status === "active").map((l) => l.monthlyDeduction),
    currency,
  );
  const advanceDeduction = sumMoney(
    db.employeeAdvances.filter((a) => a.employeeId === structure.employeeId && a.status === "active").map((a) => a.deductionAmount),
    currency,
  );
  const taxDeducted = sumMoney(
    deductions.filter((d) => /tax/i.test(d.component.name)).map((d) => d.amount),
    currency,
  );

  const netPay = subtractMoney(subtractMoney(subtractMoney(grossPay, totalDeductions), loanDeduction), advanceDeduction);

  const exceptions: PayrollEmployeeException[] = [];
  if (netPay.minorUnits < 0) exceptions.push("negative-net-pay");

  return {
    id: generateId("prl"),
    employeeId: structure.employeeId,
    employeeName,
    structureId: structure.id,
    grossPay,
    totalDeductions,
    netPay,
    attendanceDays,
    workingDays,
    loanDeduction,
    advanceDeduction,
    taxDeducted,
    exceptions,
  };
}

/** Builds a draft run from every active salary structure — attendance
 * defaults to full working days and can be adjusted per employee while the
 * run is still a draft, since this demo has no month-long staff attendance
 * history to pull from automatically. */
export function createPayrollRun(period: string, branch: string, actor: Actor, workingDays: number = DEFAULT_WORKING_DAYS): { ok: true; run: PayrollRun } | { ok: false; error: string } {
  const db = getSnapshot();
  if (db.payrollRuns.some((r) => r.period === period && r.branch === branch && r.status !== "cancelled")) {
    return { ok: false, error: `A payroll run for ${period} already exists.` };
  }
  const activeStructures = db.salaryStructures.filter((s) => s.status === "active");
  if (activeStructures.length === 0) return { ok: false, error: "No active salary structures to run payroll for." };

  const employees = activeStructures.map((structure) => {
    const teacher = db.teachers.find((t) => t.id === structure.employeeId);
    return computeEmployeeLine(db, structure, teacher?.name ?? "Unknown employee", workingDays, workingDays);
  });

  const run: PayrollRun = {
    id: generateId("payroll"),
    period,
    branch,
    status: "draft",
    employees,
    totalGross: sumMoney(employees.map((e) => e.grossPay), "INR"),
    totalDeductions: sumMoney(employees.map((e) => e.totalDeductions), "INR"),
    totalNet: sumMoney(employees.map((e) => e.netPay), "INR"),
    createdBy: actor.name,
    createdAt: new Date().toISOString(),
  };
  setState((current) => ({ ...current, payrollRuns: [...current.payrollRuns, run] }));
  logFinancialAudit({ action: "payroll-calculated", actorName: actor.name, actorRole: actor.role, summary: `Payroll run for ${period} calculated for ${employees.length} employee(s).` });
  return { ok: true, run };
}

function recomputeTotals(employees: PayrollEmployeeLine[]) {
  return { totalGross: sumMoney(employees.map((e) => e.grossPay), "INR"), totalDeductions: sumMoney(employees.map((e) => e.totalDeductions), "INR"), totalNet: sumMoney(employees.map((e) => e.netPay), "INR") };
}

export function updateEmployeeAttendance(runId: string, employeeId: string, attendanceDays: number, actor: Actor): Result {
  const db = getSnapshot();
  const run = db.payrollRuns.find((r) => r.id === runId);
  if (!run) return { ok: false, error: "Payroll run not found." };
  if (run.status !== "draft") return { ok: false, error: "Attendance can only be adjusted while the run is in draft." };
  const line = run.employees.find((e) => e.employeeId === employeeId);
  if (!line) return { ok: false, error: "Employee is not part of this run." };
  const structure = db.salaryStructures.find((s) => s.id === line.structureId);
  if (!structure) return { ok: false, error: "Salary structure not found." };

  const recomputed = computeEmployeeLine(db, structure, line.employeeName, attendanceDays, line.workingDays);
  const employees = run.employees.map((e) => (e.employeeId === employeeId ? { ...recomputed, id: e.id } : e));
  setState((current) => ({ ...current, payrollRuns: current.payrollRuns.map((r) => (r.id === runId ? { ...r, employees, ...recomputeTotals(employees) } : r)) }));
  logFinancialAudit({ action: "payroll-calculated", actorName: actor.name, actorRole: actor.role, summary: `Attendance for ${line.employeeName} in ${run.period} set to ${attendanceDays}/${line.workingDays} days.` });
  return { ok: true };
}

export function submitPayrollForReview(runId: string, actor: Actor): Result {
  const db = getSnapshot();
  const run = db.payrollRuns.find((r) => r.id === runId);
  if (!run) return { ok: false, error: "Payroll run not found." };
  if (run.status !== "draft") return { ok: false, error: `Cannot submit a run in "${run.status}" status.` };
  setState((current) => ({ ...current, payrollRuns: current.payrollRuns.map((r) => (r.id === runId ? { ...r, status: "review" } : r)) }));
  logFinancialAudit({ action: "payroll-calculated", actorName: actor.name, actorRole: actor.role, summary: `Payroll run for ${run.period} submitted for review.` });
  return { ok: true };
}

export function approvePayrollRun(runId: string, actor: Actor): Result {
  const db = getSnapshot();
  const run = db.payrollRuns.find((r) => r.id === runId);
  if (!run) return { ok: false, error: "Payroll run not found." };
  if (run.status !== "review") return { ok: false, error: `Cannot approve a run in "${run.status}" status.` };
  if (run.employees.some((e) => e.exceptions.length > 0)) return { ok: false, error: "Resolve every employee exception before approving." };

  setState((current) => ({ ...current, payrollRuns: current.payrollRuns.map((r) => (r.id === runId ? { ...r, status: "approved", approvedBy: actor.name, approvedAt: new Date().toISOString() } : r)) }));
  logFinancialAudit({ action: "payroll-approved", actorName: actor.name, actorRole: actor.role, summary: `Payroll run for ${run.period} approved.` });
  return { ok: true };
}

/** Locking is the point of no return: posts the balanced payroll journal,
 * recovers any loan/advance installments against their outstanding balance,
 * and generates one immutable payslip per employee. Nothing here is ever
 * un-done by editing — only a reversal journal or a new run corrects it. */
export function lockPayrollRun(runId: string, actor: Actor): Result {
  const db = getSnapshot();
  const run = db.payrollRuns.find((r) => r.id === runId);
  if (!run) return { ok: false, error: "Payroll run not found." };
  if (run.status !== "approved") return { ok: false, error: `Cannot lock a run in "${run.status}" status.` };

  const currency = run.totalGross.currency;
  const loanAdvanceTotal = sumMoney(run.employees.map((e) => addMoney(e.loanDeduction, e.advanceDeduction)), currency);

  const journal = postJournalEntry(
    {
      date: new Date().toISOString().slice(0, 10),
      sourceType: "payroll",
      sourceId: run.id,
      narration: `Payroll for ${run.period} — ${run.employees.length} employee(s)`,
      lines: [
        { accountId: "coa-expense-salaries", debit: run.totalGross, credit: zeroMoney(currency) },
        { accountId: "coa-tax-payable", debit: zeroMoney(currency), credit: run.totalDeductions },
        { accountId: "coa-salaries-payable", debit: zeroMoney(currency), credit: loanAdvanceTotal },
        { accountId: "coa-bank", debit: zeroMoney(currency), credit: run.totalNet },
      ].filter((l) => l.debit.minorUnits > 0 || l.credit.minorUnits > 0),
    },
    actor,
  );
  if (!journal.ok) return { ok: false, error: journal.error };

  const now = new Date().toISOString();
  const payslips: Payslip[] = run.employees.map((line) => {
    const structure = db.salaryStructures.find((s) => s.id === line.structureId);
    const resolved = structure ? resolveSalaryStructure(structure) : undefined;
    return {
      id: generateId("pslip"),
      payrollRunId: run.id,
      employeeId: line.employeeId,
      employeeName: line.employeeName,
      period: run.period,
      earnings: resolved ? resolved.earnings.map((e) => ({ label: e.component.name, amount: e.amount })) : [{ label: "Gross pay", amount: line.grossPay }],
      deductions: [
        ...(resolved ? resolved.deductions.map((d) => ({ label: d.component.name, amount: d.amount })) : []),
        ...(line.loanDeduction.minorUnits > 0 ? [{ label: "Loan recovery", amount: line.loanDeduction }] : []),
        ...(line.advanceDeduction.minorUnits > 0 ? [{ label: "Advance recovery", amount: line.advanceDeduction }] : []),
      ],
      grossPay: line.grossPay,
      netPay: line.netPay,
      attendanceDays: line.attendanceDays,
      workingDays: line.workingDays,
      leaveDays: line.workingDays - line.attendanceDays,
      generatedAt: now,
      version: 1,
    };
  });

  const employees = run.employees.map((line) => ({ ...line, payslipId: payslips.find((p) => p.employeeId === line.employeeId)?.id }));

  setState((current) => ({
    ...current,
    payrollRuns: current.payrollRuns.map((r) => (r.id === runId ? { ...r, status: "locked", employees, lockedAt: now, journalEntryId: journal.entry.id } : r)),
    payslips: [...current.payslips, ...payslips],
    employeeLoans: current.employeeLoans.map((loan) => {
      const line = run.employees.find((e) => e.employeeId === loan.employeeId && loan.status === "active" && e.loanDeduction.minorUnits > 0);
      if (!line) return loan;
      const outstandingBalance = { minorUnits: Math.max(0, loan.outstandingBalance.minorUnits - line.loanDeduction.minorUnits), currency: loan.outstandingBalance.currency };
      return { ...loan, outstandingBalance, status: outstandingBalance.minorUnits === 0 ? ("closed" as const) : loan.status };
    }),
    employeeAdvances: current.employeeAdvances.map((advance) => {
      const line = run.employees.find((e) => e.employeeId === advance.employeeId && advance.status === "active" && e.advanceDeduction.minorUnits > 0);
      if (!line) return advance;
      const outstandingBalance = { minorUnits: Math.max(0, advance.outstandingBalance.minorUnits - line.advanceDeduction.minorUnits), currency: advance.outstandingBalance.currency };
      return { ...advance, outstandingBalance, status: outstandingBalance.minorUnits === 0 ? ("closed" as const) : advance.status };
    }),
  }));

  logFinancialAudit({ action: "payroll-locked", actorName: actor.name, actorRole: actor.role, summary: `Payroll run for ${run.period} locked, journal ${journal.entry.entryNumber} posted, ${payslips.length} payslip(s) generated.` });
  return { ok: true };
}

export function markPayrollPaid(runId: string, actor: Actor): Result {
  const db = getSnapshot();
  const run = db.payrollRuns.find((r) => r.id === runId);
  if (!run) return { ok: false, error: "Payroll run not found." };
  if (run.status !== "locked") return { ok: false, error: `Cannot mark a run in "${run.status}" status as paid.` };
  setState((current) => ({ ...current, payrollRuns: current.payrollRuns.map((r) => (r.id === runId ? { ...r, status: "paid", paidAt: new Date().toISOString() } : r)) }));
  logFinancialAudit({ action: "payroll-approved", actorName: actor.name, actorRole: actor.role, summary: `Payroll run for ${run.period} marked paid.` });
  return { ok: true };
}

export function cancelPayrollRun(runId: string, reason: string, actor: Actor): Result {
  const db = getSnapshot();
  const run = db.payrollRuns.find((r) => r.id === runId);
  if (!run) return { ok: false, error: "Payroll run not found." };
  if (run.status !== "draft" && run.status !== "review") return { ok: false, error: `Cannot cancel a run in "${run.status}" status — it has already been posted.` };
  setState((current) => ({ ...current, payrollRuns: current.payrollRuns.map((r) => (r.id === runId ? { ...r, status: "cancelled" } : r)) }));
  logFinancialAudit({ action: "payroll-calculated", actorName: actor.name, actorRole: actor.role, summary: `Payroll run for ${run.period} cancelled.`, reason });
  return { ok: true };
}

export function payrollExceptionSummary(run: PayrollRun): Record<PayrollEmployeeException, number> {
  const summary = {} as Record<PayrollEmployeeException, number>;
  for (const employee of run.employees) {
    for (const exception of employee.exceptions) {
      summary[exception] = (summary[exception] ?? 0) + 1;
    }
  }
  return summary;
}
