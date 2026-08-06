import { beforeEach, describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { moneyFromMajor } from "@/lib/finance/money";
import { approvePayrollRun, cancelPayrollRun, createPayrollRun, lockPayrollRun, markPayrollPaid, submitPayrollForReview, updateEmployeeAttendance } from "./payroll-run-service";
import { createSalaryStructure } from "./salary-structure-service";

const ACTOR = { name: "Finance Administrator", role: "Finance Administrator" };

describe("payroll-run-service", () => {
  beforeEach(() => resetDemoData());

  it("creates a draft run from active salary structures", () => {
    const db = getSnapshot();
    const activeCount = db.salaryStructures.filter((s) => s.status === "active").length;
    const result = createPayrollRun("2026-09", "main", ACTOR);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.run.status).toBe("draft");
    expect(result.run.employees.length).toBe(activeCount);
  });

  it("refuses to create a second run for the same period", () => {
    createPayrollRun("2026-09", "main", ACTOR);
    const second = createPayrollRun("2026-09", "main", ACTOR);
    expect(second.ok).toBe(false);
  });

  it("recomputes an employee's pay when attendance is adjusted in draft", () => {
    const created = createPayrollRun("2026-09", "main", ACTOR);
    if (!created.ok) return;
    const employee = created.run.employees[0];
    const result = updateEmployeeAttendance(created.run.id, employee.employeeId, 20, ACTOR);
    expect(result.ok).toBe(true);
    const updated = getSnapshot().payrollRuns.find((r) => r.id === created.run.id);
    expect(updated?.employees.find((e) => e.employeeId === employee.employeeId)?.attendanceDays).toBe(20);
  });

  it("moves draft -> review -> approved -> locked -> paid, posting a balanced journal and generating payslips", () => {
    const created = createPayrollRun("2026-09", "main", ACTOR);
    if (!created.ok) return;
    expect(submitPayrollForReview(created.run.id, ACTOR).ok).toBe(true);
    expect(approvePayrollRun(created.run.id, ACTOR).ok).toBe(true);

    const journalCountBefore = getSnapshot().journalEntries.length;
    const payslipCountBefore = getSnapshot().payslips.length;
    const lockResult = lockPayrollRun(created.run.id, ACTOR);
    expect(lockResult.ok).toBe(true);

    const afterLock = getSnapshot();
    expect(afterLock.journalEntries.length).toBe(journalCountBefore + 1);
    const run = afterLock.payrollRuns.find((r) => r.id === created.run.id)!;
    expect(run.status).toBe("locked");
    expect(afterLock.payslips.length).toBe(payslipCountBefore + run.employees.length);
    expect(run.employees.every((e) => !!e.payslipId)).toBe(true);

    const entry = afterLock.journalEntries.find((j) => j.id === run.journalEntryId)!;
    const totalDebit = entry.lines.reduce((sum, l) => sum + l.debit.minorUnits, 0);
    const totalCredit = entry.lines.reduce((sum, l) => sum + l.credit.minorUnits, 0);
    expect(totalDebit).toBe(totalCredit);

    expect(markPayrollPaid(created.run.id, ACTOR).ok).toBe(true);
    expect(getSnapshot().payrollRuns.find((r) => r.id === created.run.id)?.status).toBe("paid");
  });

  it("reduces loan/advance outstanding balances when locked", () => {
    const db = getSnapshot();
    const loan = db.employeeLoans.find((l) => l.status === "active");
    if (!loan) return;
    const structure = db.salaryStructures.find((s) => s.employeeId === loan.employeeId && s.status === "active");
    if (!structure) return;

    const created = createPayrollRun("2026-09", "main", ACTOR);
    if (!created.ok) return;
    submitPayrollForReview(created.run.id, ACTOR);
    approvePayrollRun(created.run.id, ACTOR);
    lockPayrollRun(created.run.id, ACTOR);

    const updatedLoan = getSnapshot().employeeLoans.find((l) => l.id === loan.id)!;
    expect(updatedLoan.outstandingBalance.minorUnits).toBeLessThan(loan.outstandingBalance.minorUnits);
  });

  it("refuses to approve a run that still has an unresolved negative-net-pay exception", () => {
    createSalaryStructure(
      {
        name: "Broken structure",
        employeeId: "teacher-broken-net-pay",
        session: "2026-2027",
        currency: "INR",
        effectiveFrom: "2026-08-01",
        components: [
          { id: "sc-broken-basic", name: "Basic", category: "earning", calcType: "fixed", amount: moneyFromMajor(1000, "INR"), taxable: true, recurring: true },
          { id: "sc-broken-deduction", name: "Heavy Deduction", category: "deduction", calcType: "fixed", amount: moneyFromMajor(5000, "INR"), taxable: false, recurring: true },
        ],
      },
      ACTOR,
    );

    const created = createPayrollRun("2026-09", "main", ACTOR);
    if (!created.ok) return;
    submitPayrollForReview(created.run.id, ACTOR);
    const result = approvePayrollRun(created.run.id, ACTOR);
    expect(result.ok).toBe(false);
  });

  it("cancels a draft run but refuses to cancel a locked one", () => {
    const created = createPayrollRun("2026-09", "main", ACTOR);
    if (!created.ok) return;
    expect(cancelPayrollRun(created.run.id, "Test cancellation", ACTOR).ok).toBe(true);

    const second = createPayrollRun("2026-10", "main", ACTOR);
    if (!second.ok) return;
    submitPayrollForReview(second.run.id, ACTOR);
    approvePayrollRun(second.run.id, ACTOR);
    lockPayrollRun(second.run.id, ACTOR);
    expect(cancelPayrollRun(second.run.id, "Too late", ACTOR).ok).toBe(false);
  });
});
