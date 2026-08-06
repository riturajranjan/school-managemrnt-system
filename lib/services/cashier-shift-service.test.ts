import { beforeEach, describe, expect, it } from "vitest";
import { resetDemoData } from "@/lib/data/store";
import { moneyFromMajor } from "@/lib/finance/money";
import { closeCashierShift, openCashierShift } from "./cashier-shift-service";

const ACTOR = { name: "Cashier", role: "Cashier" };

describe("cashier-shift-service", () => {
  beforeEach(() => resetDemoData());

  it("opens a shift with the opening cash as the initial expected closing", () => {
    const result = openCashierShift({ cashierName: "Test Cashier", branch: "main", openingCash: moneyFromMajor(2000, "INR") }, ACTOR);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.shift.status).toBe("open");
    expect(result.shift.expectedClosing.minorUnits).toBe(moneyFromMajor(2000, "INR").minorUnits);
  });

  it("refuses to open a second shift for a cashier who already has one open", () => {
    openCashierShift({ cashierName: "Test Cashier", branch: "main", openingCash: moneyFromMajor(2000, "INR") }, ACTOR);
    const second = openCashierShift({ cashierName: "Test Cashier", branch: "main", openingCash: moneyFromMajor(1000, "INR") }, ACTOR);
    expect(second.ok).toBe(false);
  });

  it("closes a shift, computing a zero difference when actual matches expected with no cash movement", () => {
    const opened = openCashierShift({ cashierName: "Fresh Cashier", branch: "main", openingCash: moneyFromMajor(5000, "INR") }, ACTOR);
    if (!opened.ok) return;
    const closed = closeCashierShift(opened.shift.id, moneyFromMajor(5000, "INR"), undefined, ACTOR);
    expect(closed.ok).toBe(true);
    if (!closed.ok) return;
    expect(closed.shift.status).toBe("closed");
    expect(closed.shift.difference?.minorUnits).toBe(0);
  });

  it("records a non-zero difference when actual count doesn't match expected", () => {
    const opened = openCashierShift({ cashierName: "Short Cashier", branch: "main", openingCash: moneyFromMajor(3000, "INR") }, ACTOR);
    if (!opened.ok) return;
    const closed = closeCashierShift(opened.shift.id, moneyFromMajor(2900, "INR"), "Short by 100", ACTOR);
    expect(closed.ok).toBe(true);
    if (!closed.ok) return;
    expect(closed.shift.difference?.minorUnits).toBe(moneyFromMajor(-100, "INR").minorUnits);
  });

  it("refuses to close an already-closed shift", () => {
    const opened = openCashierShift({ cashierName: "Double Close", branch: "main", openingCash: moneyFromMajor(1000, "INR") }, ACTOR);
    if (!opened.ok) return;
    closeCashierShift(opened.shift.id, moneyFromMajor(1000, "INR"), undefined, ACTOR);
    const second = closeCashierShift(opened.shift.id, moneyFromMajor(1000, "INR"), undefined, ACTOR);
    expect(second.ok).toBe(false);
  });

  it("refuses to close a shift that doesn't exist", () => {
    expect(closeCashierShift("no-such-shift", moneyFromMajor(0, "INR"), undefined, ACTOR).ok).toBe(false);
  });
});
