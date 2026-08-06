import { beforeEach, describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { moneyFromMajor } from "@/lib/finance/money";
import { approveAdvance, approveLoan, closeLoanEarly, rejectAdvance, rejectLoan, requestAdvance, requestLoan } from "./loan-advance-service";

const ACTOR = { name: "Finance Administrator", role: "Finance Administrator" };

describe("loan-advance-service — loans", () => {
  beforeEach(() => resetDemoData());

  it("requests a loan in submitted status with an even monthly deduction", () => {
    const loan = requestLoan({ employeeId: "teacher-1", amount: moneyFromMajor(60000, "INR"), interestPercent: 0, installments: 6, startMonth: "2026-09" }, ACTOR);
    expect(loan.status).toBe("submitted");
    expect(loan.monthlyDeduction.minorUnits).toBe(moneyFromMajor(10000, "INR").minorUnits);
    expect(getSnapshot().employeeLoans.some((l) => l.id === loan.id)).toBe(true);
  });

  it("approves a submitted loan into active status", () => {
    const loan = requestLoan({ employeeId: "teacher-2", amount: moneyFromMajor(30000, "INR"), interestPercent: 0, installments: 3, startMonth: "2026-09" }, ACTOR);
    const result = approveLoan(loan.id, ACTOR);
    expect(result.ok).toBe(true);
    expect(getSnapshot().employeeLoans.find((l) => l.id === loan.id)?.status).toBe("active");
  });

  it("rejects a submitted loan", () => {
    const loan = requestLoan({ employeeId: "teacher-3", amount: moneyFromMajor(20000, "INR"), interestPercent: 0, installments: 2, startMonth: "2026-09" }, ACTOR);
    const result = rejectLoan(loan.id, "Not eligible", ACTOR);
    expect(result.ok).toBe(true);
    expect(getSnapshot().employeeLoans.find((l) => l.id === loan.id)?.status).toBe("rejected");
  });

  it("refuses to approve an already-approved loan", () => {
    const loan = requestLoan({ employeeId: "teacher-4", amount: moneyFromMajor(10000, "INR"), interestPercent: 0, installments: 1, startMonth: "2026-09" }, ACTOR);
    approveLoan(loan.id, ACTOR);
    expect(approveLoan(loan.id, ACTOR).ok).toBe(false);
  });

  it("closes an active loan early, zeroing the outstanding balance", () => {
    const loan = requestLoan({ employeeId: "teacher-5", amount: moneyFromMajor(50000, "INR"), interestPercent: 0, installments: 5, startMonth: "2026-09" }, ACTOR);
    approveLoan(loan.id, ACTOR);
    const result = closeLoanEarly(loan.id, ACTOR);
    expect(result.ok).toBe(true);
    const closed = getSnapshot().employeeLoans.find((l) => l.id === loan.id)!;
    expect(closed.status).toBe("closed");
    expect(closed.outstandingBalance.minorUnits).toBe(0);
  });
});

describe("loan-advance-service — advances", () => {
  beforeEach(() => resetDemoData());

  it("requests an advance in submitted status", () => {
    const advance = requestAdvance({ employeeId: "teacher-1", type: "salary-advance", amount: moneyFromMajor(15000, "INR"), deductionAmount: moneyFromMajor(5000, "INR") }, ACTOR);
    expect(advance.status).toBe("submitted");
    expect(getSnapshot().employeeAdvances.some((a) => a.id === advance.id)).toBe(true);
  });

  it("approves and rejects advances", () => {
    const toApprove = requestAdvance({ employeeId: "teacher-2", type: "emergency-advance", amount: moneyFromMajor(8000, "INR"), deductionAmount: moneyFromMajor(4000, "INR") }, ACTOR);
    expect(approveAdvance(toApprove.id, ACTOR).ok).toBe(true);
    expect(getSnapshot().employeeAdvances.find((a) => a.id === toApprove.id)?.status).toBe("active");

    const toReject = requestAdvance({ employeeId: "teacher-3", type: "custom", amount: moneyFromMajor(5000, "INR"), deductionAmount: moneyFromMajor(2500, "INR") }, ACTOR);
    expect(rejectAdvance(toReject.id, "Not approved", ACTOR).ok).toBe(true);
    expect(getSnapshot().employeeAdvances.find((a) => a.id === toReject.id)?.status).toBe("rejected");
  });
});
